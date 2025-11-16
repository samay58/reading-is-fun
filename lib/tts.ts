import OpenAI from 'openai';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { TTSManager } from './tts/manager';
import { TTSProviderConfig } from './tts/types';

// Legacy OpenAI client for backward compatibility
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize TTS Manager with provider configuration
let ttsManager: TTSManager | null = null;

function getTTSManager(): TTSManager {
  if (!ttsManager) {
    const config: TTSProviderConfig = {};

    // Configure Inworld if credentials are available
    if (process.env.INWORLD_API_KEY && process.env.INWORLD_WORKSPACE_ID) {
      config.inworld = {
        apiKey: process.env.INWORLD_API_KEY,
        workspaceId: process.env.INWORLD_WORKSPACE_ID,
      };
    }

    // Configure OpenAI if credentials are available
    if (process.env.OPENAI_API_KEY) {
      config.openai = {
        apiKey: process.env.OPENAI_API_KEY,
        model: 'tts-1-hd',
        voice: 'onyx'
      };
    }

    ttsManager = new TTSManager(config);

    // Enable A/B testing if configured
    if (process.env.TTS_AB_TESTING_ENABLED === 'true') {
      const ratio = parseFloat(process.env.TTS_AB_TESTING_RATIO || '0.1');
      ttsManager.enableABTesting(ratio);
    }
  }

  return ttsManager;
}

export interface TTSOptions {
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  speed?: number; // 0.25 to 4.0
  model?: 'tts-1' | 'tts-1-hd';
  provider?: 'auto' | 'inworld' | 'openai'; // New: provider selection
}

export async function generateAudio(
  text: string,
  jobId: string,
  options: TTSOptions = {}
): Promise<string> {
  const {
    voice = 'onyx',      // Masculine voice, clear and professional
    speed = 1.1,         // 10% faster than normal (better for long content)
    model = 'tts-1-hd',  // HD quality for audiobook
    provider = process.env.TTS_PROVIDER || 'auto' // Use configured provider or auto-select
  } = options;

  // Decide whether to use new manager or legacy implementation
  const useManager = provider !== 'openai' &&
    (process.env.INWORLD_API_KEY || process.env.TTS_PROVIDER === 'auto');

  if (useManager) {
    // Use new TTS Manager for cost optimization
    return generateAudioWithManager(text, jobId, { speed });
  }

  // Legacy OpenAI implementation for backward compatibility
  const MAX_CHARS_PER_CHUNK = 4000; // OpenAI limit for legacy mode

  // Check if text needs chunking
  if (text.length <= MAX_CHARS_PER_CHUNK) {
    // Small text - single API call
    const mp3Response = await openai.audio.speech.create({
      model,
      voice,
      input: text,
      speed,
    });

    const buffer = Buffer.from(await mp3Response.arrayBuffer());
    const audioPath = join('/tmp', `${jobId}.mp3`);
    await writeFile(audioPath, buffer);
    return audioPath;
  }

  // Large text - chunk and concatenate
  console.log(`Text is ${text.length} chars, chunking into ${Math.ceil(text.length / MAX_CHARS_PER_CHUNK)} pieces...`);

  const chunks = chunkText(text, MAX_CHARS_PER_CHUNK);
  const audioBuffers: Buffer[] = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`Generating audio chunk ${i + 1}/${chunks.length}...`);

    const mp3Response = await openai.audio.speech.create({
      model,
      voice,
      input: chunks[i],
      speed,
    });

    audioBuffers.push(Buffer.from(await mp3Response.arrayBuffer()));
  }

  // Concatenate all MP3 buffers
  const finalBuffer = Buffer.concat(audioBuffers);
  const audioPath = join('/tmp', `${jobId}.mp3`);
  await writeFile(audioPath, finalBuffer);

  console.log(`Generated ${chunks.length} chunks, total size: ${finalBuffer.length} bytes`);
  return audioPath;
}

/**
 * Generate audio using the new TTS Manager with provider abstraction
 */
async function generateAudioWithManager(
  text: string,
  jobId: string,
  options: { speed?: number } = {}
): Promise<string> {
  const manager = getTTSManager();

  // Get the maximum chunk size that's safe for all available providers
  const maxChunkSize = await manager.getMaxChunkSize();
  console.log(`Using chunk size of ${maxChunkSize} chars based on available providers`);

  // Check if text needs chunking
  if (text.length <= maxChunkSize) {
    // Small text - single synthesis call
    const result = await manager.synthesize(text, {
      speed: options.speed || 1.1
    });

    console.log(`Generated audio with ${result.provider} (cost: $${result.cost.toFixed(4)})`);

    const audioPath = join('/tmp', `${jobId}.mp3`);
    await writeFile(audioPath, result.audio);
    return audioPath;
  }

  // Large text - chunk and synthesize separately
  console.log(`Text is ${text.length} chars, chunking into ${Math.ceil(text.length / maxChunkSize)} pieces...`);

  const chunks = chunkText(text, maxChunkSize);
  const audioBuffers: Buffer[] = [];
  let totalCost = 0;
  const providers = new Set<string>();

  for (let i = 0; i < chunks.length; i++) {
    console.log(`Generating audio chunk ${i + 1}/${chunks.length}...`);

    const result = await manager.synthesize(chunks[i], {
      speed: options.speed || 1.1
    });

    audioBuffers.push(result.audio);
    totalCost += result.cost;
    providers.add(result.provider);
  }

  // Concatenate all MP3 buffers
  const finalBuffer = Buffer.concat(audioBuffers);
  const audioPath = join('/tmp', `${jobId}.mp3`);
  await writeFile(audioPath, finalBuffer);

  console.log(`Generated ${chunks.length} chunks using ${Array.from(providers).join(', ')}`);
  console.log(`Total cost: $${totalCost.toFixed(4)} (saved ${((0.03 * text.length / 1000) - totalCost).toFixed(4)} vs OpenAI)`);

  return audioPath;
}

function chunkText(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining);
      break;
    }

    // Find a good break point (end of sentence or paragraph)
    let breakPoint = maxChars;

    // Try to break at paragraph
    const paragraphEnd = remaining.lastIndexOf('\n\n', maxChars);
    if (paragraphEnd > maxChars * 0.7) {
      breakPoint = paragraphEnd + 2;
    } else {
      // Try to break at sentence
      const sentenceEnd = remaining.lastIndexOf('. ', maxChars);
      if (sentenceEnd > maxChars * 0.7) {
        breakPoint = sentenceEnd + 2;
      }
    }

    chunks.push(remaining.slice(0, breakPoint).trim());
    remaining = remaining.slice(breakPoint).trim();
  }

  return chunks;
}

export function estimateTTSCost(text: string, model: string = 'tts-1-hd'): number {
  const charCount = text.length;

  // Check if using new provider system
  const provider = process.env.TTS_PROVIDER || 'auto';

  if (provider === 'inworld' || (provider === 'auto' && process.env.INWORLD_API_KEY)) {
    // Inworld pricing: $10 per 1M chars (actual pricing from API)
    return (charCount / 1_000_000) * 10;
  }

  // OpenAI pricing (default/fallback)
  const costPer1K = model === 'tts-1-hd' ? 0.030 : 0.015;
  return (charCount / 1000) * costPer1K;
}

/**
 * Get cost comparison between providers
 */
export function getCostComparison(text: string): Record<string, number> {
  const charCount = text.length;

  return {
    openai_hd: (charCount / 1000) * 0.030,
    openai_standard: (charCount / 1000) * 0.015,
    inworld: (charCount / 1_000_000) * 10,
    savings: ((charCount / 1000) * 0.030) - ((charCount / 1_000_000) * 10)
  };
}
