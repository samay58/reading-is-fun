import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';

const execAsync = promisify(exec);

// Path to marker-pdf in vault's Python environment
const MARKER_PATH = '/Users/samaydhawan/phoenix/.venv/bin/marker_single';

export async function extractPDF(pdfPath: string): Promise<{
  markdown: string;
  pageCount: number;
}> {
  // marker_single auto-generates output filename (input.pdf → input.md)
  const outputPath = pdfPath.replace('.pdf', '.md');

  try {
    // Run marker-pdf with optimizations for speed
    // --disable_image_extraction: Skip images (we don't need them for TTS)
    // --disable_multiprocessing: More reliable, avoid deadlocks
    const { stdout, stderr } = await execAsync(
      `${MARKER_PATH} "${pdfPath}" --output_dir "/tmp" --output_format markdown --disable_image_extraction --disable_multiprocessing`,
      {
        maxBuffer: 20 * 1024 * 1024, // 20MB buffer
        timeout: 120000 // 2 minute timeout (safety)
      }
    );

    // Check if marker actually created the output file
    try {
      const markdown = await readFile(outputPath, 'utf-8');

      if (!markdown || markdown.trim().length === 0) {
        throw new Error('marker-pdf produced empty output');
      }

      return { markdown, pageCount: estimatePageCount(markdown) };
    } catch (readError: any) {
      // Output file not found - marker failed silently
      throw new Error(`marker-pdf did not produce output. stderr: ${stderr}`);
    }

  } catch (error: any) {
    // Clean up any partial files
    await unlink(outputPath).catch(() => {});
    await unlink(pdfPath).catch(() => {});

    throw new Error(`marker-pdf extraction failed: ${error?.message || 'Unknown error'}`);
  } finally {
    // Always clean up the output markdown file
    await unlink(outputPath).catch(() => {});
  }
}

function estimatePageCount(markdown: string): number {
  // marker-pdf doesn't always include page metadata
  // Estimate: ~1000 chars per page for academic papers
  const charCount = markdown.length;
  return Math.max(1, Math.ceil(charCount / 1000));
}
