/**
 * OpenAI TTS Provider
 * Wraps existing OpenAI TTS functionality
 */

import OpenAI from 'openai';
import { TTSProvider, TTSOptions, TTSMetrics, TTSError } from '../types';

export class OpenAIProvider implements TTSProvider {
  name = 'openai';
  priority = 2; // Lower priority due to higher cost
  costPer1MChars = 30; // $30 per 1M characters
  maxCharsPerChunk = 4000; // OpenAI TTS limit is 4096, using 4000 for safety

  private client: OpenAI;
  private model: 'tts-1' | 'tts-1-hd';
  private defaultVoice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  private metrics: TTSMetrics = {
    totalRequests: 0,
    totalCharacters: 0,
    totalCost: 0,
    averageLatency: 0,
    errors: 0
  };

  constructor(config: {
    apiKey: string;
    model?: 'tts-1' | 'tts-1-hd';
    voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  }) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.model = config.model || 'tts-1';
    this.defaultVoice = config.voice || 'onyx';
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Test with a minimal request
      const testText = 'test';
      await this.client.audio.speech.create({
        model: this.model,
        voice: this.defaultVoice,
        input: testText,
        response_format: 'mp3',
        speed: 1.0
      });
      return true;
    } catch (error) {
      console.error('OpenAI TTS availability check failed:', error);
      return false;
    }
  }

  async synthesize(text: string, options?: TTSOptions): Promise<Buffer> {
    const startTime = Date.now();

    try {
      // Map speed to OpenAI's speed parameter
      const speed = options?.speed || 1.1; // Default to 1.1x for readability

      // Select voice based on emotion hint (if provided)
      const voice = this.selectVoiceForEmotion(options?.emotion) || this.defaultVoice;

      const response = await this.client.audio.speech.create({
        model: this.model,
        voice: voice,
        input: text,
        response_format: 'mp3',
        speed: Math.max(0.25, Math.min(4.0, speed)) // OpenAI limits
      });

      // Convert response to buffer
      const buffer = Buffer.from(await response.arrayBuffer());

      // Update metrics
      const latency = Date.now() - startTime;
      this.updateMetrics(text.length, latency, true);

      return buffer;
    } catch (error) {
      this.updateMetrics(text.length, Date.now() - startTime, false, error as Error);

      throw new TTSError(
        `OpenAI TTS failed: ${(error as Error).message}`,
        this.name,
        'SYNTHESIS_FAILED',
        true
      );
    }
  }

  private selectVoiceForEmotion(emotion?: string): 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' | null {
    if (!emotion) return null;

    // Map emotions to OpenAI voices based on their characteristics
    const emotionVoiceMap: Record<string, 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'> = {
      'neutral': 'onyx',    // Deep, neutral
      'happy': 'nova',      // Warm, friendly
      'sad': 'echo',        // Softer tone
      'excited': 'shimmer', // Energetic
      'calm': 'fable',      // Soothing
      'serious': 'alloy'    // Professional
    };

    return emotionVoiceMap[emotion] || null;
  }

  estimateCost(text: string): number {
    // OpenAI charges per character
    const characters = text.length;
    return (characters / 1_000_000) * this.costPer1MChars;
  }

  getMetrics(): TTSMetrics {
    return { ...this.metrics };
  }

  private updateMetrics(
    characters: number,
    latency: number,
    success: boolean,
    error?: Error
  ) {
    this.metrics.totalRequests++;
    this.metrics.totalCharacters += characters;
    this.metrics.totalCost += this.estimateCost(characters.toString());

    // Update average latency
    const prevTotal = this.metrics.averageLatency * (this.metrics.totalRequests - 1);
    this.metrics.averageLatency = (prevTotal + latency) / this.metrics.totalRequests;

    if (!success) {
      this.metrics.errors++;
      this.metrics.lastError = error?.message;
    }
  }
}