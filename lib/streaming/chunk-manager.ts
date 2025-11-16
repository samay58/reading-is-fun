/**
 * Chunk Manager - Handles chunk storage, queue management, and cleanup
 */

import { writeFile, mkdir, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type { ChunkMetadata } from './types';

export class ChunkManager {
  private basePath: string;
  private jobId: string;
  private chunksDir: string;

  constructor(jobId: string) {
    this.jobId = jobId;
    this.basePath = '/tmp';
    this.chunksDir = join(this.basePath, `${jobId}-chunks`);
  }

  /**
   * Initialize chunk storage directory
   */
  async initialize(): Promise<void> {
    if (!existsSync(this.chunksDir)) {
      await mkdir(this.chunksDir, { recursive: true });
    }
  }

  /**
   * Save an audio chunk
   */
  async saveChunk(index: number, audioBuffer: Buffer): Promise<string> {
    await this.initialize();
    const chunkPath = join(this.chunksDir, `${index}.mp3`);
    await writeFile(chunkPath, audioBuffer);
    return chunkPath;
  }

  /**
   * Get the path for a chunk (for serving via API)
   */
  getChunkPath(index: number): string {
    return join(this.chunksDir, `${index}.mp3`);
  }

  /**
   * Get the URL for a chunk
   */
  getChunkUrl(index: number): string {
    return `/api/audio-chunk/${this.jobId}/${index}`;
  }

  /**
   * Read a chunk audio file
   */
  async readChunk(index: number): Promise<Buffer> {
    const chunkPath = this.getChunkPath(index);
    if (!existsSync(chunkPath)) {
      throw new Error(`Chunk ${index} not found for job ${this.jobId}`);
    }
    return await readFile(chunkPath);
  }

  /**
   * Concatenate all chunks into a single file
   */
  async concatenateChunks(totalChunks: number): Promise<string> {
    const chunks: Buffer[] = [];

    // Read all chunks in order
    for (let i = 0; i < totalChunks; i++) {
      const chunkBuffer = await this.readChunk(i);
      chunks.push(chunkBuffer);
    }

    // Concatenate all buffers
    const concatenated = Buffer.concat(chunks);

    // Save as complete file
    const completePath = join(this.basePath, `${this.jobId}.mp3`);
    await writeFile(completePath, concatenated);

    return completePath;
  }

  /**
   * Clean up chunk files (call after concatenation)
   */
  async cleanup(): Promise<void> {
    try {
      if (existsSync(this.chunksDir)) {
        await rm(this.chunksDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error(`Failed to cleanup chunks for job ${this.jobId}:`, error);
      // Non-fatal error - chunks will be cleaned up by OS eventually
    }
  }

  /**
   * Clean up all files for this job (chunks + concatenated + original PDF)
   */
  async cleanupAll(): Promise<void> {
    try {
      // Clean up chunks directory
      await this.cleanup();

      // Clean up concatenated file
      const concatenatedPath = join(this.basePath, `${this.jobId}.mp3`);
      if (existsSync(concatenatedPath)) {
        await rm(concatenatedPath);
      }

      // Clean up original PDF
      const pdfPath = join(this.basePath, `${this.jobId}.pdf`);
      if (existsSync(pdfPath)) {
        await rm(pdfPath);
      }
    } catch (error) {
      console.error(`Failed to cleanup all files for job ${this.jobId}:`, error);
    }
  }
}

/**
 * Text chunking utility - intelligent splitting for better audio continuity
 */
export function chunkText(text: string, maxChars: number = 4000): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining.trim());
      break;
    }

    // Find a good break point (paragraph or sentence)
    let breakPoint = maxChars;

    // Try to break at paragraph boundary
    const paragraphEnd = remaining.lastIndexOf('\n\n', maxChars);
    if (paragraphEnd > maxChars * 0.7) {
      breakPoint = paragraphEnd + 2;
    } else {
      // Try to break at sentence boundary
      const sentenceEnd = remaining.lastIndexOf('. ', maxChars);
      if (sentenceEnd > maxChars * 0.7) {
        breakPoint = sentenceEnd + 2;
      } else {
        // Try to break at any punctuation
        const punctuation = remaining.lastIndexOf(', ', maxChars);
        if (punctuation > maxChars * 0.8) {
          breakPoint = punctuation + 2;
        }
      }
    }

    chunks.push(remaining.slice(0, breakPoint).trim());
    remaining = remaining.slice(breakPoint).trim();
  }

  return chunks;
}

/**
 * Estimate audio duration for a text chunk
 * Based on ~150 words per minute at 1.1x speed
 */
export function estimateChunkDuration(text: string): number {
  const wordsPerMinute = 150 * 1.1; // Adjusted for 1.1x speed
  const avgCharsPerWord = 5;
  const charsPerMinute = wordsPerMinute * avgCharsPerWord;
  const minutes = text.length / charsPerMinute;
  return Math.ceil(minutes * 60); // Return seconds
}