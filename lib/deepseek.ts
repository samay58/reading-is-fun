import { basename } from 'path';
import { readFile } from 'fs/promises';
import { extractPdfWithDeepInfra } from './deepinfra-ocr';
// @ts-expect-error pdf-parse has no type declarations
import pdfParse from 'pdf-parse';

const DEEPSEEK_API_URL = 'https://api.alphaxiv.org/models/v1/deepseek/deepseek-ocr/inference';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function extractWithDeepSeek(pdfPath: string, maxRetries = 3): Promise<{
  markdown: string;
  pageCount: number;
}> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[DeepSeek] Attempt ${attempt}/${maxRetries} for ${pdfPath.split('/').pop()}`);

      // Read the PDF file
      const fileBuffer = await readFile(pdfPath);
      const fileSizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(2);
      console.log(`[DeepSeek] File size: ${fileSizeMB}MB`);

      const blob = new Blob([fileBuffer], { type: 'application/pdf' });

      // Create form data
      const formData = new FormData();
      formData.append('file', blob, pdfPath.split('/').pop() || 'document.pdf');

      // Call DeepSeek OCR via alphaxiv API (FREE, no auth needed!)
      const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        body: formData,
      });

      const responseText = await response.text();

      if (!response.ok) {
        const errorMsg = `DeepSeek API returned ${response.status}: ${responseText}`;
        console.error(`[DeepSeek] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      const data = JSON.parse(responseText);

      // Extract OCR text and metadata
      const markdown = data.data?.ocr_text || '';
      const pageCount = data.data?.num_pages || 1;

      if (!markdown || markdown.trim().length === 0) {
        throw new Error('DeepSeek returned empty text');
      }

      console.log(`[DeepSeek] Success: ${pageCount} pages, ${markdown.length} chars`);

      return { markdown, pageCount };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      lastError = error as Error;
      console.error(`[DeepSeek] Attempt ${attempt} failed:`, message);

      // Don't retry on certain errors
      if (message.includes('empty text') || message.includes('404')) {
        throw new Error(`DeepSeek OCR extraction failed: ${message}`);
      }

      // Exponential backoff before retry
      if (attempt < maxRetries) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`[DeepSeek] Retrying in ${delayMs}ms...`);
        await sleep(delayMs);
      }
    }
  }

  throw new Error(`DeepSeek OCR extraction failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Fallback extraction using pdf-parse (pure JS, works on Vercel)
 */
async function extractWithPdfParse(pdfPath: string): Promise<{
  markdown: string;
  pageCount: number;
}> {
  console.log('[pdf-parse] Attempting fallback text extraction...');

  try {
    const dataBuffer = await readFile(pdfPath);
    const data = await pdfParse(dataBuffer);

    const cleanText = data.text?.trim() || '';
    const pageCount = data.numpages || 1;

    if (!cleanText || cleanText.length < 50) {
      throw new Error('pdf-parse returned insufficient text');
    }

    console.log(`[pdf-parse] Success: ${pageCount} pages, ${cleanText.length} chars`);
    return { markdown: cleanText, pageCount };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`pdf-parse fallback failed: ${message}`);
  }
}

export async function extractPDF(pdfPath: string, maxRetries = 3): Promise<{
  markdown: string;
  pageCount: number;
}> {
  // Try DeepInfra first (handles scanned PDFs with OCR)
  if (process.env.DEEPINFRA_API_KEY) {
    try {
      console.log('[DeepInfra] Using DeepSeek-OCR via DeepInfra (primary)');
      const result = await extractPdfWithDeepInfra(pdfPath, basename(pdfPath, '.pdf'));

      if (result.markdown?.trim()) {
        return result;
      }
      console.warn('[DeepInfra] Returned empty text, trying fallback...');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`[DeepInfra] OCR failed: ${message}, trying pdf-parse fallback...`);
    }
  } else {
    console.warn('[DeepInfra] API key not set, using pdf-parse directly');
  }

  // Fallback to pdf-parse (works for text-based PDFs, not scanned images)
  return extractWithPdfParse(pdfPath);
}
