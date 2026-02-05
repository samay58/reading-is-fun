/**
 * Sesame CSM-1B TTS Provider via DeepInfra
 * Natural conversational voice (Maya voice model)
 * https://deepinfra.com/sesame/csm-1b
 */

import { TTSProvider, TTSOptions, TTSMetrics, TTSError } from '../types';

export class SesameProvider implements TTSProvider {
  name = 'sesame';
  priority = 0; // Highest priority when selected
  costPer1MChars = 1.50; // Estimate - CSM is more expensive than Kokoro
  maxCharsPerChunk = 2000; // CSM works best with shorter chunks for natural speech

  private apiKey: string;
  private defaultSpeakerId: number;
  private metrics: TTSMetrics = {
    totalRequests: 0,
    totalCharacters: 0,
    totalCost: 0,
    averageLatency: 0,
    errors: 0
  };

  constructor(config: { apiKey: string; speakerId?: number }) {
    this.apiKey = config.apiKey;
    this.defaultSpeakerId = config.speakerId ?? 0;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async synthesize(text: string, options?: TTSOptions): Promise<Buffer> {
    const startTime = Date.now();

    if (text.length > this.maxCharsPerChunk) {
      throw new TTSError(
        `Text length ${text.length} exceeds Sesame limit of ${this.maxCharsPerChunk} characters`,
        this.name,
        'TEXT_TOO_LONG',
        false
      );
    }

    try {
      const speakerId = this.defaultSpeakerId;

      // Sesame uses speaker ID prefix in the text
      const textWithSpeaker = `[${speakerId}]${text}`;

      console.log(`[Sesame] Synthesizing ${text.length} chars with speaker=${speakerId}`);

      const response = await fetch('https://api.deepinfra.com/v1/inference/sesame/csm-1b', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: textWithSpeaker,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sesame API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const json = await response.json();

      if (!json.audio) {
        throw new Error('Sesame response missing audio data');
      }

      // Handle base64 audio data
      let audioData = json.audio;
      if (audioData.includes(',')) {
        audioData = audioData.split(',')[1];
      }

      const buffer = Buffer.from(audioData, 'base64');
      console.log(`[Sesame] Received audio: ${buffer.length} bytes`);

      // Log inference stats if available
      if (json.inference_status) {
        console.log(`[Sesame] Runtime: ${json.inference_status.runtime_ms}ms, Cost: $${json.inference_status.cost}`);
      }

      const latency = Date.now() - startTime;
      this.updateMetrics(text.length, latency, true);

      return buffer;
    } catch (error) {
      console.error('[Sesame] Synthesis failed:', error);
      this.updateMetrics(text.length, Date.now() - startTime, false, error as Error);

      throw new TTSError(
        `Sesame TTS failed: ${(error as Error).message}`,
        this.name,
        'SYNTHESIS_FAILED',
        true
      );
    }
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
