import OpenAI from 'openai';
import { writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { TTSManager } from './tts/manager';
import { TTSProviderConfig } from './tts/types';

const execAsync = promisify(exec);

// Legacy OpenAI client for backward compatibility
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

export function buildTTSConfig(providerPref: string): TTSProviderConfig {
  const config: TTSProviderConfig = {};
  const pref = (providerPref || 'auto').toLowerCase();

  // New provider chain (2025-11 migration)
  // Priority: DeepInfra ($0.62/M) → Orpheus ($15/M) → MiniMax ($30/M) → OpenAI ($30/M)
  // Or: Sesame ($1.50/M) when TTS_PROVIDER=sesame

  const includeSesame = pref === 'sesame';
  const includeDeepInfra = pref === 'auto' || pref === 'deepinfra';
  const includeOrpheus = pref === 'auto' || pref === 'orpheus';
  const includeMiniMax = pref === 'auto' || pref === 'minimax';
  const includeOpenAI = pref === 'auto' || pref === 'openai';

  // DeepInfra API key (shared for Kokoro and Sesame)
  const deepinfraKey = process.env.DEEPINFRA_TTS_API_KEY || process.env.DEEPINFRA_API_KEY;

  // Sesame CSM-1B (Maya voice) - Natural conversational voice ($1.50/M chars est)
  if (includeSesame && deepinfraKey) {
    config.sesame = {
      apiKey: deepinfraKey,
      speakerId: parseInt(process.env.SESAME_SPEAKER_ID || '0', 10),
    };
  }

  // DeepInfra Kokoro - PRIMARY ($0.62/M chars)
  if (includeDeepInfra && deepinfraKey) {
    config.deepinfra = {
      apiKey: deepinfraKey,
      voice: process.env.DEEPINFRA_VOICE || 'af_bella',
    };
  }

  // Together.ai Orpheus - SECONDARY ($15/M chars)
  if (includeOrpheus && process.env.TOGETHER_API_KEY) {
    config.orpheus = {
      apiKey: process.env.TOGETHER_API_KEY,
      voice: process.env.ORPHEUS_VOICE || 'tara',
      enableEmotionTags: process.env.ORPHEUS_EMOTION_TAGS !== 'false',
    };
  }

  // MiniMax Speech-02-Turbo - TERTIARY ($30/M chars)
  if (includeMiniMax && process.env.MINIMAX_API_KEY && process.env.MINIMAX_GROUP_ID) {
    config.minimax = {
      apiKey: process.env.MINIMAX_API_KEY,
      groupId: process.env.MINIMAX_GROUP_ID,
    };
  }

  // OpenAI TTS-1-HD - FINAL FALLBACK ($30/M chars)
  if (includeOpenAI && process.env.OPENAI_API_KEY) {
    config.openai = {
      apiKey: process.env.OPENAI_API_KEY,
      model: 'tts-1-hd',
      voice: 'onyx'
    };
  }

  // ARCHIVED: Old providers removed 2025-11
  // if (process.env.HATHORA_API_KEY) {
  //   config.hathora = { apiKey: process.env.HATHORA_API_KEY, ... };
  // }
  // if (process.env.INWORLD_API_KEY) {
  //   config.inworld = { apiKey: process.env.INWORLD_API_KEY, ... };
  // }

  return config;
}

// Initialize TTS Manager with provider configuration
export function createTTSManager(providerPref: string): TTSManager {
  const manager = new TTSManager(buildTTSConfig(providerPref));

  // Enable A/B testing if configured
  if (process.env.TTS_AB_TESTING_ENABLED === 'true') {
    const ratio = parseFloat(process.env.TTS_AB_TESTING_RATIO || '0.1');
    manager.enableABTesting(ratio);
  }

  return manager;
}

export interface TTSOptions {
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  speed?: number; // 0.25 to 4.0
  model?: 'tts-1' | 'tts-1-hd';
  provider?: 'auto' | 'inworld' | 'openai';
  emotion?: 'neutral' | 'happy' | 'sad' | 'excited' | 'calm' | 'serious';
}

export async function generateAudio(
  text: string,
  jobId: string,
  options: TTSOptions = {}
): Promise<string> {
  const {
    voice = 'onyx',      // Masculine voice, clear and professional
    speed = 1.05,        // Slightly brisk but still clear
    model = 'tts-1-hd',  // HD quality for audiobook
    provider = process.env.TTS_PROVIDER || 'auto', // Use configured provider or auto-select
    emotion = (process.env.TTS_EMOTION_DEFAULT as TTSOptions['emotion']) || 'neutral',
  } = options;

  // Decide whether to use new manager or legacy implementation
  // Use manager for all new providers or auto mode
  const useManager = provider !== 'openai' &&
    (provider === 'deepinfra' || provider === 'orpheus' || provider === 'minimax' || provider === 'auto' ||
     process.env.DEEPINFRA_API_KEY || process.env.TOGETHER_API_KEY || process.env.MINIMAX_API_KEY);

  if (useManager) {
    // Use new TTS Manager for cost optimization
    return generateAudioWithManager(text, jobId, { speed, voice, emotion, provider });
  }

  // Legacy OpenAI implementation for backward compatibility
  const MAX_CHARS_PER_CHUNK = 4000; // OpenAI limit for legacy mode
  const client = getOpenAIClient();

  // Check if text needs chunking
  if (text.length <= MAX_CHARS_PER_CHUNK) {
    // Small text - single API call
    const mp3Response = await client.audio.speech.create({
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

    const mp3Response = await client.audio.speech.create({
      model,
      voice,
      input: chunks[i],
      speed,
    });

    audioBuffers.push(Buffer.from(await mp3Response.arrayBuffer()));
  }

  // Concatenate all MP3 buffers
  const finalBuffer = Buffer.concat(audioBuffers);

  // Save as temporary file
  const tempPath = join('/tmp', `${jobId}_temp.mp3`);
  await writeFile(tempPath, finalBuffer);

  // Final output path
  const audioPath = join('/tmp', `${jobId}.mp3`);

  // Try to use ffmpeg to fix metadata if available (local environment)
  const isLocal = process.env.NODE_ENV === 'development' || !process.env.VERCEL;

  if (isLocal) {
    try {
      console.log(`Fixing MP3 metadata with ffmpeg...`);

      // Use ffmpeg to copy with fixed metadata
      const ffmpegCmd = `ffmpeg -i "${tempPath}" -acodec copy -map_metadata -1 -y "${audioPath}" 2>/dev/null`;
      await execAsync(ffmpegCmd);

      // Clean up temp file
      if (existsSync(tempPath)) {
        await rm(tempPath);
      }

      console.log(`MP3 metadata fixed`);
    } catch (error) {
      console.warn(`FFmpeg not available or failed, using simple concatenation`);

      // Fallback: use simple concatenation
      await writeFile(audioPath, finalBuffer);
      if (existsSync(tempPath)) {
        await rm(tempPath);
      }
    }
  } else {
    // Vercel environment: use simple concatenation
    await writeFile(audioPath, finalBuffer);
  }

  console.log(`Generated ${chunks.length} chunks, total size: ${finalBuffer.length} bytes`);
  return audioPath;
}

/**
 * Generate audio using the new TTS Manager with provider abstraction
 */
async function generateAudioWithManager(
  text: string,
  jobId: string,
  options: { speed?: number; voice?: TTSOptions['voice']; emotion?: TTSOptions['emotion']; provider?: string } = {}
): Promise<string> {
  const providerPref = (options.provider || process.env.TTS_PROVIDER || 'auto').toLowerCase();
  const manager = createTTSManager(providerPref);

  // Get the chunk size for the primary provider to avoid over-fragmenting
  const maxChunkSize = await manager.getPrimaryChunkSize();
  console.log(`Using chunk size of ${maxChunkSize} chars based on primary provider`);

  // Check if text needs chunking
  if (text.length <= maxChunkSize) {
    // Small text - single synthesis call
    const result = await manager.synthesize(text, {
      speed: options.speed || 1.05,
      voice: options.voice,
      emotion: options.emotion,
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
      speed: options.speed || 1.05,
      voice: options.voice,
      emotion: options.emotion,
    });

    audioBuffers.push(result.audio);
    totalCost += result.cost;
    providers.add(result.provider);
  }

  // Concatenate all MP3 buffers
  const finalBuffer = Buffer.concat(audioBuffers);

  // Save as temporary file
  const tempPath = join('/tmp', `${jobId}_temp.mp3`);
  await writeFile(tempPath, finalBuffer);

  // Final output path
  const audioPath = join('/tmp', `${jobId}.mp3`);

  // Try to use ffmpeg to fix metadata if available (local environment)
  const isLocal = process.env.NODE_ENV === 'development' || !process.env.VERCEL;

  if (isLocal) {
    try {
      console.log(`Fixing MP3 metadata with ffmpeg...`);

      // Use ffmpeg to copy with fixed metadata
      const ffmpegCmd = `ffmpeg -i "${tempPath}" -acodec copy -map_metadata -1 -y "${audioPath}" 2>/dev/null`;
      await execAsync(ffmpegCmd);

      // Clean up temp file
      if (existsSync(tempPath)) {
        await rm(tempPath);
      }

      console.log(`MP3 metadata fixed`);
    } catch (error) {
      console.warn(`FFmpeg not available or failed, using simple concatenation`);

      // Fallback: use simple concatenation
      await writeFile(audioPath, finalBuffer);
      if (existsSync(tempPath)) {
        await rm(tempPath);
      }
    }
  } else {
    // Vercel environment: use simple concatenation
    await writeFile(audioPath, finalBuffer);
  }

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

  const deepinfraCost = (charCount / 1_000_000) * 0.62;
  const orpheusCost = (charCount / 1_000_000) * 15;
  const minimaxCost = (charCount / 1_000_000) * 30;
  const openaiCost = (charCount / 1_000_000) * 30;

  return {
    deepinfra: deepinfraCost,
    orpheus: orpheusCost,
    minimax: minimaxCost,
    openai_hd: openaiCost,
    openai_standard: (charCount / 1_000_000) * 15,
    // Savings when using DeepInfra vs OpenAI HD
    savings_vs_openai: openaiCost - deepinfraCost,
    savings_percent: Math.round((1 - (deepinfraCost / openaiCost)) * 100)
  };
}
