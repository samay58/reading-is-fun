import { exec } from 'child_process';
import { promisify } from 'util';
import { mkdir, readdir, readFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { visionCompletion } from './deepinfra-llm';

const execAsync = promisify(exec);
let captioningDisabledReason: string | null = null;

// Prefer explicit binary path if provided (Poppler is bundled at /opt/homebrew/opt/poppler-qt5/bin/pdfimages on macOS)
const PDFIMAGES_BIN = process.env.PDFIMAGES_PATH || '/opt/homebrew/opt/poppler-qt5/bin/pdfimages';
const IMAGE_OUTPUT_ROOT = '/tmp';

export interface ImageInfo {
  path: string;
  page: number | null;
  index: number;
}

export interface ImageNarration {
  page: number | null;
  caption: string;
  sourcePath: string;
  placeholder?: boolean;
}

/**
 * Parse `pdfimages -list` output to recover page assignments for each image.
 * We only keep the page column to align with extracted files.
 */
function parsePdfImagesList(output: string): number[] {
  const lines = output.split('\n').slice(2); // Skip header rows
  const pages: number[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // First column is page (integer)
    const parts = trimmed.split(/\s+/);
    if (parts.length > 0 && /^\d+$/.test(parts[0])) {
      pages.push(parseInt(parts[0], 10));
    }
  }

  return pages;
}

/**
 * Extract images from a PDF using `pdfimages`.
 * Returns the list of image files with their page numbers (when available).
 */
export async function extractImages(pdfPath: string, jobId: string): Promise<ImageInfo[]> {
  const outputDir = join(IMAGE_OUTPUT_ROOT, `${jobId}-images`);
  await mkdir(outputDir, { recursive: true });

  // Get page metadata
  const listCmd = `"${PDFIMAGES_BIN}" -list "${pdfPath}"`;
  const { stdout: listOutput } = await execAsync(listCmd, { maxBuffer: 5 * 1024 * 1024 });
  const pages = parsePdfImagesList(listOutput);

  // Extract as PNG files
  const prefix = join(outputDir, 'image');
  const extractCmd = `"${PDFIMAGES_BIN}" -png "${pdfPath}" "${prefix}"`;
  await execAsync(extractCmd, { maxBuffer: 50 * 1024 * 1024 });

  // Collect generated files
  const files = (await readdir(outputDir))
    .filter(name => name.endsWith('.png'))
    .sort(); // pdfimages names incrementally, sort to align with list order

  return files.map((file, idx) => ({
    path: join(outputDir, file),
    page: pages[idx] ?? null,
    index: idx,
  }));
}

/**
 * Caption a single image with optional textual context using DeepInfra Vision.
 */
async function captionImage(image: ImageInfo, context: string): Promise<string> {
  if (captioningDisabledReason) {
    return 'An image is present here.';
  }

  const buffer = await readFile(image.path);
  const base64 = buffer.toString('base64');

  try {
    const prompt = `Provide a concise, listener-friendly narration (1-2 sentences) of this figure. Use the context if helpful: ${context.slice(0, 600)}`;
    const caption = await visionCompletion(base64, prompt, { maxTokens: 150 });
    return caption || 'A visual element appears here.';
  } catch (error) {
    const message = (error as Error).message;
    if (!captioningDisabledReason) {
      captioningDisabledReason = message || 'Captioning failed';
      console.error(`[Images] Captioning disabled after error: ${captioningDisabledReason}`);
    }
  }

  return 'A visual element appears here.';
}

/**
 * Simple concurrency limiter to avoid overloading VLM calls.
 */
async function withLimit<T, R>(items: T[], limit: number, task: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const current = index;
      index++;
      results[current] = await task(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Generate narrated captions for extracted images.
 */
export async function narrateImages(
  images: ImageInfo[],
  pageContexts: string[]
): Promise<ImageNarration[]> {
  if (images.length === 0) return [];

  const narrations = await withLimit(images, 3, async (image) => {
    const pageIndex = image.page ? image.page - 1 : null;
    const context = pageIndex !== null ? (pageContexts[pageIndex] || '') : '';
    const caption = await captionImage(image, context);
    return {
      page: image.page,
      caption,
      sourcePath: image.path,
      placeholder: false,
    };
  });

  return narrations;
}

/**
 * Cleanup image artifacts for a job.
 */
export async function cleanupImages(jobId: string) {
  const dir = join(IMAGE_OUTPUT_ROOT, `${jobId}-images`);
  if (existsSync(dir)) {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Split text by DeepSeek page markers if present.
 */
export function splitTextByPage(text: string): string[] {
  const parts = text.split(/<---\s*Page Split\s*--->/gi);
  return parts.length > 0 ? parts : [text];
}

/**
 * Inject image narrations into the raw text near their page boundaries.
 * If page numbers are missing, append narrations to the end.
 */
export function injectImageNarrations(text: string, narrations: ImageNarration[]): string {
  if (!narrations.length) return text;

  const pages = splitTextByPage(text);
  const assembled: string[] = [];

  for (let i = 0; i < pages.length; i++) {
    const pageNumber = i + 1;
    const pageText = pages[i];
    const pageNarrations = narrations.filter(n => (n.page ?? pageNumber) === pageNumber);

    if (pageNarrations.length === 0) {
      assembled.push(pageText);
      continue;
    }

    const narrationText = pageNarrations
      .map(n => `[Image on page ${n.page ?? pageNumber}] ${n.caption}`)
      .join('\n\n');

    assembled.push(`${pageText.trim()}\n\n${narrationText}\n`);
  }

  // Any narrations that reference pages beyond detected count are appended
  const extraNarrations = narrations.filter(n => (n.page || 0) > pages.length);
  if (extraNarrations.length > 0) {
    const extraText = extraNarrations
      .map(n => `[Image on page ${n.page}] ${n.caption}`)
      .join('\n\n');
    assembled.push(extraText);
  }

  // Preserve page split markers so downstream cleaning can normalize spacing
  return assembled.join('\n\n<--- Page Split --->\n\n');
}
