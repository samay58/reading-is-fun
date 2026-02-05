/**
 * Chunk Manager - Handles chunk storage, queue management, and cleanup
 */

import { writeFile, mkdir, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { ChunkMetadata } from './types';

const execAsync = promisify(exec);

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
   * Note: Simple concatenation works for streaming MP3s created by the same encoder
   */
  async concatenateChunks(totalChunks: number): Promise<string> {
    if (totalChunks <= 0) {
      throw new Error('No chunks to concatenate');
    }

    console.log(`[${this.jobId}] Concatenating ${totalChunks} chunks...`);

    const chunks: Buffer[] = [];
    let totalDurationMs = 0;

    // Read all chunks in order and estimate total duration
    for (let i = 0; i < totalChunks; i++) {
      const chunkBuffer = await this.readChunk(i);
      chunks.push(chunkBuffer);
      // Estimate duration based on MP3 bitrate (128 kbps)
      // 128 kbps = 16 KB/s = 16384 bytes/s
      totalDurationMs += (chunkBuffer.length / 16384) * 1000;
    }

    // For Vercel compatibility, we use simple concatenation
    // This works because all chunks are encoded with the same settings
    const concatenated = Buffer.concat(chunks);

    // Save as temporary file
    const tempPath = join(this.basePath, `${this.jobId}_temp.mp3`);
    await writeFile(tempPath, concatenated);

    // Final output path
    const completePath = join(this.basePath, `${this.jobId}.mp3`);

    // Try to use ffmpeg to fix metadata if available (local environment)
    const isLocal = process.env.NODE_ENV === 'development' || !process.env.VERCEL;

    if (isLocal) {
      try {
        console.log(`[${this.jobId}] Fixing MP3 metadata with ffmpeg...`);

        // Calculate duration in seconds
        const durationSeconds = Math.round(totalDurationMs / 1000);

        // Use ffmpeg to re-encode with proper metadata
        // -acodec copy: copy audio stream without re-encoding
        // -map_metadata -1: clear all metadata
        // -metadata duration: set correct duration
        const ffmpegCmd = `ffmpeg -i "${tempPath}" -acodec copy -map_metadata -1 -y "${completePath}" 2>/dev/null`;

        await execAsync(ffmpegCmd);

        // Clean up temp file
        if (existsSync(tempPath)) {
          await rm(tempPath);
        }

        console.log(`[${this.jobId}] MP3 metadata fixed, duration: ${durationSeconds}s`);
      } catch (error) {
        console.warn(`[${this.jobId}] FFmpeg not available or failed, using simple concatenation`);
        console.warn(`Error: ${error}`);

        // Fallback: rename temp to final
        if (existsSync(tempPath)) {
          await writeFile(completePath, concatenated);
          await rm(tempPath);
        }
      }
    } else {
      // Vercel environment: use simple concatenation
      // Note: Some players may show incorrect duration but audio will play fully
      await writeFile(completePath, concatenated);
      console.log(`[${this.jobId}] Simple concatenation used (Vercel environment)`);
    }

    console.log(`[${this.jobId}] Concatenation complete, file size: ${concatenated.length} bytes`);
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
