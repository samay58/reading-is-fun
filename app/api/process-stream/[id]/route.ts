/**
 * SSE Streaming endpoint for progressive audio generation
 */

import { NextRequest } from 'next/server';
import { join } from 'path';
import { extractPDF } from '@/lib/deepseek';
import { extractHTMLTables } from '@/lib/html-tables';
import { narrateTables } from '@/lib/claude';
import { processDeepSeekText } from '@/lib/cleaning';
import { generateAudio } from '@/lib/tts';
import { calculateExactCost } from '@/lib/cost';
import { SSEEncoder, getSSEHeaders, KEEPALIVE_INTERVAL } from '@/lib/streaming/sse-helpers';
import { ChunkManager, chunkText, estimateChunkDuration } from '@/lib/streaming/chunk-manager';
import type { StreamEvent, ProcessingStats } from '@/lib/streaming/types';
import { TTSManager } from '@/lib/tts/manager';
import { TTSProviderConfig } from '@/lib/tts/types';

const MAX_PAGES = 40;

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const { id } = params;
  const pdfPath = join('/tmp', `${id}.pdf`);

  const encoder = new SSEEncoder();
  const chunkManager = new ChunkManager(id);

  // Initialize chunk storage
  await chunkManager.initialize();

  const stream = new ReadableStream({
    async start(controller) {
      let keepaliveTimer: NodeJS.Timeout | null = null;

      try {
        // Step 0: Receive and save PDF file
        try {
          const formData = await req.formData();
          const file = formData.get('file') as File;

          if (!file) {
            const errorEvent: StreamEvent = {
              type: 'error',
              message: 'No file provided in request',
              recoverable: false,
              timestamp: Date.now(),
            };
            controller.enqueue(encoder.encode(errorEvent));
            controller.close();
            return;
          }

          // Save file to /tmp
          const buffer = Buffer.from(await file.arrayBuffer());
          const { writeFile } = await import('fs/promises');
          await writeFile(pdfPath, buffer);
        } catch (uploadError: any) {
          console.error(`[${id}] Failed to save uploaded file:`, uploadError);
          const errorEvent: StreamEvent = {
            type: 'error',
            message: `File upload failed: ${uploadError.message}`,
            recoverable: false,
            timestamp: Date.now(),
          };
          controller.enqueue(encoder.encode(errorEvent));
          controller.close();
          return;
        }

        // Set up keepalive to prevent timeout
        keepaliveTimer = setInterval(() => {
          controller.enqueue(encoder.keepalive());
        }, KEEPALIVE_INTERVAL);

        // Step 1: Extract PDF
        const extractionStart: StreamEvent = {
          type: 'extraction_start',
          timestamp: Date.now(),
        };
        controller.enqueue(encoder.encode(extractionStart));

        console.log(`[${id}] Starting PDF extraction...`);
        const startTime = Date.now();
        const { markdown: rawText, pageCount } = await extractPDF(pdfPath);

        if (pageCount > MAX_PAGES) {
          const errorEvent: StreamEvent = {
            type: 'error',
            message: `PDF too large. Maximum ${MAX_PAGES} pages. This PDF has ${pageCount} pages.`,
            recoverable: false,
            timestamp: Date.now(),
          };
          controller.enqueue(encoder.encode(errorEvent));
          controller.close();
          return;
        }

        // Step 2: Extract tables and generate narrations
        console.log(`[${id}] Extracting tables...`);
        const tables = extractHTMLTables(rawText);

        console.log(`[${id}] Generating table narrations...`);
        const narrations = tables.length > 0
          ? await narrateTables(tables)
          : new Map();

        // Step 3: Clean and process text
        console.log(`[${id}] Processing text...`);
        const cleanText = processDeepSeekText(rawText, tables, narrations);

        // Step 4: Get dynamic chunk size and chunk the text
        // Initialize TTS Manager to get the appropriate chunk size
        const config: TTSProviderConfig = {};
        if (process.env.INWORLD_API_KEY && process.env.INWORLD_WORKSPACE_ID) {
          config.inworld = {
            apiKey: process.env.INWORLD_API_KEY,
            workspaceId: process.env.INWORLD_WORKSPACE_ID,
          };
        }
        if (process.env.OPENAI_API_KEY) {
          config.openai = {
            apiKey: process.env.OPENAI_API_KEY,
            model: 'tts-1-hd',
            voice: 'onyx'
          };
        }
        const ttsManager = new TTSManager(config);
        const maxChunkSize = await ttsManager.getMaxChunkSize();
        console.log(`[${id}] Using chunk size of ${maxChunkSize} chars based on available providers`);

        const textChunks = chunkText(cleanText, maxChunkSize);
        const totalChunks = textChunks.length;

        // Send extraction complete event
        const extractionComplete: StreamEvent = {
          type: 'extraction_complete',
          charCount: cleanText.length,
          tableCount: tables.length,
          pageCount,
          totalChunks,
          timestamp: Date.now(),
        };
        controller.enqueue(encoder.encode(extractionComplete));

        // Step 5: Process chunks progressively
        console.log(`[${id}] Processing ${totalChunks} chunks...`);
        const chunkAudioUrls: string[] = [];
        let totalDuration = 0;

        for (let i = 0; i < textChunks.length; i++) {
          const chunkText = textChunks[i];

          // Send chunk processing event
          const processingEvent: StreamEvent = {
            type: 'chunk_processing',
            index: i,
            total: totalChunks,
            text: chunkText.slice(0, 100) + '...',
            timestamp: Date.now(),
          };
          controller.enqueue(encoder.encode(processingEvent));

          // Generate audio for this chunk
          console.log(`[${id}] Generating audio for chunk ${i + 1}/${totalChunks}...`);
          const audioPath = await generateAudio(chunkText, `${id}-chunk-${i}`);

          // Read the audio file as buffer
          const chunkBuffer = await import('fs/promises').then(fs => fs.readFile(audioPath));

          // Save to chunk manager for final concatenation
          await chunkManager.saveChunk(i, chunkBuffer);

          // Clean up temp file
          await import('fs/promises').then(fs => fs.rm(audioPath).catch(() => {}));

          // Calculate duration
          const duration = estimateChunkDuration(chunkText);
          totalDuration += duration;

          // Encode audio as base64 for inline transmission
          const audioBase64 = chunkBuffer.toString('base64');

          // Send chunk ready event with embedded audio data
          const chunkReadyEvent: StreamEvent = {
            type: 'chunk_ready',
            index: i,
            total: totalChunks,
            audioData: audioBase64, // Send base64-encoded audio inline
            duration,
            charCount: chunkText.length,
            timestamp: Date.now(),
          };
          controller.enqueue(encoder.encode(chunkReadyEvent));

          chunkAudioUrls.push(`chunk-${i}`);
        }

        // Step 6: Generate concatenated file in background (for download)
        console.log(`[${id}] Creating concatenated file for download...`);
        // Note: In production, this could be done asynchronously
        const concatenatedPath = await chunkManager.concatenateChunks(totalChunks);

        // Calculate final costs
        const cost = calculateExactCost(cleanText.length, tables.length);
        const processingTime = Math.floor((Date.now() - startTime) / 1000);

        // Prepare stats
        const stats: ProcessingStats = {
          originalChars: rawText.length,
          cleanedChars: cleanText.length,
          tablesNarrated: tables.length,
          totalChunks,
          processingTimeSeconds: processingTime,
          audioDurationSeconds: totalDuration,
          cost: {
            parsing: cost.parsing,
            tables: cost.tables,
            tts: cost.tts,
            total: cost.total,
          },
        };

        // Send complete event
        const completeEvent: StreamEvent = {
          type: 'complete',
          downloadUrl: `/api/download/${id}`,
          totalDuration,
          totalCost: cost.total,
          stats,
          timestamp: Date.now(),
        };
        controller.enqueue(encoder.encode(completeEvent));

        console.log(`[${id}] Streaming complete! Processed ${totalChunks} chunks in ${processingTime}s`);

      } catch (error: any) {
        console.error(`[${id}] Streaming failed:`, error);

        // Send error event
        const errorEvent: StreamEvent = {
          type: 'error',
          message: error.message || 'Processing failed',
          recoverable: false,
          timestamp: Date.now(),
        };
        controller.enqueue(encoder.encode(errorEvent));
      } finally {
        // Clean up keepalive timer
        if (keepaliveTimer) {
          clearInterval(keepaliveTimer);
        }

        // Close the stream
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: getSSEHeaders(),
  });
}