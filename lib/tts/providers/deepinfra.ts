/**
 * DeepInfra Kokoro TTS Provider
 * Ultra-low cost primary provider ($0.62/M chars)
 * Returns MP3 directly - no conversion needed
 */

import { TTSProvider, TTSOptions, TTSMetrics, TTSError } from '../types';

export class DeepInfraProvider implements TTSProvider {
  name = 'deepinfra';
  priority = 0; // Highest priority - cheapest option
  costPer1MChars = 0.62;
  maxCharsPerChunk = 8000; // Conservative (API supports 10k)

  private apiKey: string;
  private defaultVoice: string;
  private metrics: TTSMetrics = {
    totalRequests: 0,
    totalCharacters: 0,
    totalCost: 0,
    averageLatency: 0,
    errors: 0
  };

  constructor(config: { apiKey: string; voice?: string }) {
    this.apiKey = config.apiKey;
    this.defaultVoice = config.voice || 'af_bella';
  }

  async isAvailable(): Promise<boolean> {
    try {
      return !!this.apiKey;
    } catch (error) {
      console.error('DeepInfra TTS availability check failed:', error);
      return false;
    }
  }

  async synthesize(text: string, options?: TTSOptions): Promise<Buffer> {
    const startTime = Date.now();

    // Validate text length
    if (text.length > this.maxCharsPerChunk) {
      throw new TTSError(
        `Text length ${text.length} exceeds DeepInfra limit of ${this.maxCharsPerChunk} characters`,
        this.name,
        'TEXT_TOO_LONG',
        false
      );
    }

    try {
      const voice = this.selectVoiceForEmotion(options?.emotion) || this.defaultVoice;
      const speed = options?.speed || 1.05;

      console.log(`[DeepInfra] Synthesizing ${text.length} chars with voice=${voice}, speed=${speed}`);

      const response = await fetch('https://api.deepinfra.com/v1/inference/hexgrad/Kokoro-82M', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          voice,
          speed,
          output_format: 'mp3'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepInfra API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // DeepInfra may return JSON with base64 audio or direct binary
      const contentType = response.headers.get('content-type');
      let buffer: Buffer;

      if (contentType?.includes('application/json')) {
        // Handle JSON response with base64-encoded audio
        const json = await response.json();
        let audioData = json.audio;

        if (!audioData) {
          throw new Error('DeepInfra response missing audio data');
        }

        // Strip data URI prefix if present (e.g., "data:audio/mp3;base64,")
        if (audioData.includes(',')) {
          audioData = audioData.split(',')[1];
        }

        buffer = Buffer.from(audioData, 'base64');
        console.log(`[DeepInfra] Decoded base64 audio from JSON response`);
      } else {
        // Direct binary response
        buffer = Buffer.from(await response.arrayBuffer());
      }

      console.log(`[DeepInfra] Received MP3 audio: ${buffer.length} bytes`);

      // Update metrics
      const latency = Date.now() - startTime;
      this.updateMetrics(text.length, latency, true);

      return buffer;
    } catch (error) {
      console.error('[DeepInfra] Synthesis failed:', error);
      this.updateMetrics(text.length, Date.now() - startTime, false, error as Error);

      throw new TTSError(
        `DeepInfra TTS failed: ${(error as Error).message}`,
        this.name,
        'SYNTHESIS_FAILED',
        true // Retryable
      );
    }
  }

  private selectVoiceForEmotion(emotion?: string): string | null {
    if (!emotion) return null;

    // Kokoro voice mapping - using actual available voices
    // See: https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md
    // American Female: af_bella, af_nicole, af_sarah, af_sky
    // American Male: am_adam, am_michael
    // British Female: bf_emma, bf_isabella
    // British Male: bm_george, bm_lewis
    const emotionVoiceMap: Record<string, string> = {
      neutral: 'af_bella',
      calm: 'af_sarah',
      excited: 'af_sky',
      happy: 'af_nicole',
      serious: 'am_adam',
      sad: 'bf_emma', // British female for softer, more somber tone
    };

    return emotionVoiceMap[emotion] || null;
  }

  estimateCost(text: string | number): number {
    const characters = typeof text === 'number' ? text : text.length;
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
  ): void {
    this.metrics.totalRequests++;
    this.metrics.totalCharacters += characters;
    this.metrics.totalCost += this.estimateCost(characters);

    // Update rolling average latency
    const prevTotal = this.metrics.averageLatency * (this.metrics.totalRequests - 1);
    this.metrics.averageLatency = (prevTotal + latency) / this.metrics.totalRequests;

    if (!success) {
      this.metrics.errors++;
      if (error) {
        this.metrics.lastError = error.message;
      }
    }
  }
}
