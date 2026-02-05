/**
 * SSE Streaming endpoint for progressive audio generation
 */

import { NextRequest } from 'next/server';
import { join } from 'path';
import { extractPDF } from '@/lib/deepseek';
import { extractHTMLTables } from '@/lib/html-tables';
import { narrateTables } from '@/lib/claude';
import { processDeepSeekText } from '@/lib/cleaning';
import { createTTSManager, generateAudio } from '@/lib/tts';
import { calculateExactCost } from '@/lib/cost';
import { SSEEncoder, getSSEHeaders, KEEPALIVE_INTERVAL } from '@/lib/streaming/sse-helpers';
import { ChunkManager, chunkText, estimateChunkDuration } from '@/lib/streaming/chunk-manager';
import type { StreamEvent, ProcessingStats } from '@/lib/streaming/types';
import { extractImages, narrateImages, splitTextByPage, cleanupImages } from '@/lib/images';
import type { ImageNarration } from '@/lib/images';
import { generateDocumentArtworkWithTimeout, type ArtworkResult } from '@/lib/fal';

const isLocalDev = process.env.NODE_ENV === 'development' || !process.env.VERCEL;
const MAX_PAGES = isLocalDev ? Infinity : 40;

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
      let streamClosed = false;
      let keepaliveTimer: NodeJS.Timeout | null = null;

      const enqueueOrStop = (data: Uint8Array) => {
        if (streamClosed) return false;
        try {
          controller.enqueue(data);
          return true;
        } catch (err) {
          streamClosed = true;
          console.warn(`[${id}] Stream closed while enqueuing:`, (err as Error).message);
          try {
            controller.close();
          } catch {
            // ignore
          }
          return false;
        }
      };

      const sendEvent = (event: StreamEvent) => enqueueOrStop(encoder.encode(event));
      const sendKeepalive = () => enqueueOrStop(encoder.keepalive());

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
            sendEvent(errorEvent);
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
          sendEvent(errorEvent);
          controller.close();
          return;
        }

        // Set up keepalive to prevent timeout
        keepaliveTimer = setInterval(() => {
          sendKeepalive();
        }, KEEPALIVE_INTERVAL);

        // Step 1: Extract PDF
        const extractionStart: StreamEvent = {
          type: 'extraction_start',
          timestamp: Date.now(),
        };
        if (!sendEvent(extractionStart)) return;

        console.log(`[${id}] Starting PDF extraction...`);
        const startTime = Date.now();
        const { markdown: rawText, pageCount } = await extractPDF(pdfPath);
        console.log(`[${id}] OCR length: ${rawText.length} chars`);
        console.log(`[${id}] OCR sample (first 500 chars): ${rawText.slice(0, 500)}`);

        if (pageCount > MAX_PAGES) {
          const errorEvent: StreamEvent = {
            type: 'error',
            message: `PDF too large. Maximum ${MAX_PAGES} pages. This PDF has ${pageCount} pages.`,
            recoverable: false,
            timestamp: Date.now(),
          };
          sendEvent(errorEvent);
          controller.close();
          return;
        }

        // Step 2: Extract tables and generate narrations
        console.log(`[${id}] Extracting tables...`);
        const tables = extractHTMLTables(rawText);

        // Step 2b: Extract and narrate images in the background
        let imageNarrations: ImageNarration[] = [];
        try {
          const images = await extractImages(pdfPath, id);
          if (images.length > 0) {
            console.log(`[${id}] Found ${images.length} images, generating narrations...`);
            const pageContexts = splitTextByPage(rawText);
            imageNarrations = await narrateImages(images, pageContexts);
            console.log(`[${id}] Narrated ${imageNarrations.length} images`);

            // Log each image narration for debugging
            if (imageNarrations.length > 0) {
              console.log(`[${id}] -------- IMAGE NARRATIONS --------`);
              imageNarrations.forEach((n, i) => {
                console.log(`[${id}] [Page ${n.page}] ${n.caption.slice(0, 100)}${n.caption.length > 100 ? '...' : ''}`);
              });
              console.log(`[${id}] -----------------------------------`);
            }
          } else {
            console.log(`[${id}] No images detected`);
          }
        } catch (error: any) {
          console.error(`[${id}] Image extraction/narration failed:`, error.message || error);
        } finally {
          cleanupImages(id).catch(() => {});
        }

        // Send table extraction progress event
        if (tables.length > 0) {
          const tableEvent: StreamEvent = {
            type: 'chunk_processing',
            index: 0,
            total: tables.length,
            text: `Processing ${tables.length} table${tables.length > 1 ? 's' : ''}...`,
            timestamp: Date.now(),
          };
          if (!sendEvent(tableEvent)) return;
        }

        console.log(`[${id}] Generating table narrations...`);
        let narrations: Map<number, string>;
        try {
          narrations = tables.length > 0
            ? await narrateTables(tables)
            : new Map();
          console.log(`[${id}] Successfully narrated ${narrations.size} tables`);
        } catch (error: any) {
          console.error(`[${id}] Table narration failed:`, error);
          // Fallback: use empty narrations to continue processing
          narrations = new Map();
          // Note: Table narration failure won't block audio generation
        }

        // Step 3: Clean and process text
        console.log(`[${id}] Processing text...`);
        const cleanText = processDeepSeekText(rawText, tables, narrations, imageNarrations);
        console.log(`[${id}] Clean text length: ${cleanText.length} chars`);
        console.log(`[${id}] Clean text sample (first 500 chars): ${cleanText.slice(0, 500)}`);

        // Full narration debug output with breakdown
        console.log(`[${id}] ========== NARRATION BREAKDOWN ==========`);
        console.log(`[${id}] OCR text: ${rawText.length} chars`);
        console.log(`[${id}] Tables narrated: ${tables.length}`);
        console.log(`[${id}] Images narrated: ${imageNarrations.length}`);
        console.log(`[${id}] Final clean text: ${cleanText.length} chars`);
        console.log(`[${id}] ========== FULL NARRATION START ==========`);
        console.log(cleanText);
        console.log(`[${id}] ========== FULL NARRATION END ==========`);

        // Step 4: Get dynamic chunk size and chunk the text
        // Initialize TTS Manager to get the appropriate chunk size
        const providerPref = process.env.TTS_PROVIDER || 'auto';
        const ttsManager = createTTSManager(providerPref);
        const maxChunkSize = await ttsManager.getPrimaryChunkSize();
        console.log(`[${id}] Using chunk size of ${maxChunkSize} chars based on primary provider`);

        const textChunks = chunkText(cleanText, maxChunkSize);
        const totalChunks = textChunks.length;

        if (totalChunks === 0) {
          throw new Error('No text extracted from PDF (OCR returned empty content)');
        }

        // Send extraction complete event
        const extractionComplete: StreamEvent = {
          type: 'extraction_complete',
          charCount: cleanText.length,
          tableCount: tables.length,
          pageCount,
          totalChunks,
          timestamp: Date.now(),
        };
        if (!sendEvent(extractionComplete)) return;

        // Start artwork generation in parallel (non-blocking)
        let artworkResult: ArtworkResult | null = null;
        let artworkPromise: Promise<void> | null = null;

        if (process.env.FAL_KEY && cleanText.length > 200) {
          artworkPromise = (async () => {
            try {
              // Send artwork_generating event
              const artworkGeneratingEvent: StreamEvent = {
                type: 'artwork_generating',
                prompt: 'Generating manuscript-style illustration...',
                timestamp: Date.now(),
              };
              sendEvent(artworkGeneratingEvent);

              // Generate artwork with 30s timeout
              artworkResult = await generateDocumentArtworkWithTimeout(cleanText, pageCount, 30000);

              // Send artwork_ready event
              const artworkReadyEvent: StreamEvent = {
                type: 'artwork_ready',
                imageData: artworkResult.imageData,
                mimeType: artworkResult.mimeType,
                prompt: artworkResult.prompt,
                cost: artworkResult.cost,
                timestamp: Date.now(),
              };
              sendEvent(artworkReadyEvent);

              console.log(`[${id}] Artwork generated successfully`);
            } catch (error: any) {
              console.error(`[${id}] Artwork generation failed:`, error.message || error);
              // Don't block audio - just skip artwork
            }
          })();
        }

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
          if (!sendEvent(processingEvent)) return;

          // Generate audio for this chunk
          console.log(`[${id}] Generating audio for chunk ${i + 1}/${totalChunks}...`);
          console.log(`[${id}] Chunk ${i} text: "${chunkText.slice(0, 200)}..."`);
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
          if (!sendEvent(chunkReadyEvent)) return;

          chunkAudioUrls.push(`chunk-${i}`);
        }

        // Step 6: Generate concatenated file in background (for download)
        console.log(`[${id}] Creating concatenated file for download...`);
        // Note: In production, this could be done asynchronously
        const concatenatedPath = await chunkManager.concatenateChunks(totalChunks);

        // Wait for artwork to complete (if it was started)
        if (artworkPromise) {
          await artworkPromise.catch(() => {});
        }

        // Calculate final costs (include artwork if generated)
        const hasArtwork = artworkResult !== null;
        const cost = calculateExactCost(cleanText.length, tables.length, hasArtwork);
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
            artwork: cost.artwork,
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
        sendEvent(completeEvent);

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
        sendEvent(errorEvent);
      } finally {
        // Clean up keepalive timer
        if (keepaliveTimer) {
          clearInterval(keepaliveTimer);
        }

        // Close the stream
        if (!streamClosed) {
          controller.close();
          streamClosed = true;
        }
      }
    },
  });

  return new Response(stream, {
    headers: getSSEHeaders(),
  });
}
