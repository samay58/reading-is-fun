import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { extractPDF } from '@/lib/deepseek';
import { extractHTMLTables } from '@/lib/html-tables';
import { narrateTables } from '@/lib/claude';
import { processDeepSeekText } from '@/lib/cleaning';
import { generateAudio } from '@/lib/tts';
import { estimateCost } from '@/lib/cost';
import { extractImages, narrateImages, splitTextByPage, cleanupImages } from '@/lib/images';
import type { ImageNarration } from '@/lib/images';

const isLocalDev = process.env.NODE_ENV === 'development' || !process.env.VERCEL;
const MAX_PAGES = isLocalDev ? Infinity : 40;

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const { id } = params;
  const pdfPath = join('/tmp', `${id}.pdf`);

  try {
    // Step 1: Extract text with DeepSeek OCR
    console.log(`[${id}] Extracting PDF with DeepSeek OCR...`);
    const { markdown: rawText, pageCount } = await extractPDF(pdfPath);

    if (pageCount > MAX_PAGES) {
      return NextResponse.json(
        {
          error: `PDF too large. Maximum ${MAX_PAGES} pages. This PDF has ~${pageCount} pages. Try selecting specific pages or splitting into smaller documents.`,
        },
        { status: 400 }
      );
    }

    // Step 2: Extract HTML tables (DeepSeek returns HTML, not markdown)
    console.log(`[${id}] Extracting HTML tables...`);
    const tables = extractHTMLTables(rawText);
    console.log(`[${id}] Found ${tables.length} tables`);

    // Step 2b: Extract and narrate images
    let imageNarrations: ImageNarration[] = [];
    try {
      const images = await extractImages(pdfPath, id);
      if (images.length > 0) {
        console.log(`[${id}] Found ${images.length} images, generating narrations...`);
        const pageContexts = splitTextByPage(rawText);
        imageNarrations = await narrateImages(images, pageContexts);
        console.log(`[${id}] Narrated ${imageNarrations.length} images`);
      } else {
        console.log(`[${id}] No images detected`);
      }
    } catch (error) {
      console.error(`[${id}] Image extraction/narration failed:`, (error as Error).message);
    } finally {
      cleanupImages(id).catch(() => {});
    }

    // Step 3: Generate context-aware narrations for tables
    console.log(`[${id}] Generating table narrations (with context)...`);
    const narrations = tables.length > 0
      ? await narrateTables(tables)
      : new Map();

    // Step 4: Process text (replace tables, clean scratch text, prepare for narration)
    console.log(`[${id}] Cleaning and processing text...`);
    const cleanText = processDeepSeekText(rawText, tables, narrations, imageNarrations);

    // Calculate exact cost and audio duration
    const { calculateExactCost, estimateAudioDuration } = await import('@/lib/cost');
    const exactCost = calculateExactCost(cleanText.length, tables.length);
    const audioDurationSeconds = estimateAudioDuration(cleanText.length);

    console.log(`[${id}] Cost estimate: $${exactCost.total.toFixed(2)}, Audio: ~${Math.floor(audioDurationSeconds / 60)}min`);

    // Step 5: Generate audio with OpenAI TTS
    const startTTS = Date.now();
    console.log(`[${id}] Generating audio (${cleanText.length} chars)...`);
    const audioPath = await generateAudio(cleanText, id);
    const ttsTime = Math.floor((Date.now() - startTTS) / 1000);

    console.log(`[${id}] Complete! Cost: $${exactCost.total.toFixed(2)}, TTS time: ${ttsTime}s`);

    return NextResponse.json({
      status: 'complete',
      jobId: id,
      audioUrl: `/api/audio/${id}`,
      downloadUrl: `/api/download/${id}`,
      preview: cleanText.slice(0, 500),
      tableCount: tables.length,
      pageCount,
      stats: {
        originalChars: rawText.length,
        cleanedChars: cleanText.length,
        tablesNarrated: tables.length,
        audioDurationSeconds,
        audioDurationMinutes: Math.floor(audioDurationSeconds / 60),
        ttsChunks: Math.ceil(cleanText.length / 4000),
        processingTimeSeconds: ttsTime,
      },
      cost: {
        parsing: exactCost.parsing,
        tables: exactCost.tables,
        tts: exactCost.tts,
        total: exactCost.total,
      },
    });
  } catch (error: any) {
    console.error(`[${id}] Processing failed:`, error);

    // Provide helpful error messages
    let errorMessage = 'Processing failed';
    if (error.message?.includes('marker')) {
      errorMessage = 'PDF could not be parsed. Try a different PDF with text content (not scanned images).';
    } else if (error.message?.includes('OpenAI') || error.message?.includes('TTS')) {
      errorMessage = 'Audio generation failed. Please try again.';
    } else if (error.message?.includes('Anthropic') || error.message?.includes('Claude')) {
      errorMessage = 'Table summarization failed. Please try again.';
    }

    return NextResponse.json(
      { status: 'failed', error: errorMessage },
      { status: 500 }
    );
  }
}
