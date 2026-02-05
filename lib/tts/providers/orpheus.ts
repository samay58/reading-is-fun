/**
 * Orpheus TTS Provider (via Together.ai)
 * Secondary provider with full emotion tag support ($15/M chars)
 * Supports: <laugh>, <chuckle>, <sigh>, <cough>, <gasp>, <yawn>, <groan>, <sniffle>
 */

import { TTSProvider, TTSOptions, TTSMetrics, TTSError } from '../types';

export class OrpheusProvider implements TTSProvider {
  name = 'orpheus';
  priority = 1; // Second priority after DeepInfra
  costPer1MChars = 15;
  maxCharsPerChunk = 4000; // Together.ai limit is 4096, using 4000 for safety

  private apiKey: string;
  private defaultVoice: string;
  private enableEmotionTags: boolean;
  private metrics: TTSMetrics = {
    totalRequests: 0,
    totalCharacters: 0,
    totalCost: 0,
    averageLatency: 0,
    errors: 0
  };

  // Available Orpheus voices
  private readonly availableVoices = ['tara', 'leah', 'jess', 'leo', 'dan', 'mia', 'zac', 'zoe'] as const;

  constructor(config: { apiKey: string; voice?: string; enableEmotionTags?: boolean }) {
    this.apiKey = config.apiKey;
    this.defaultVoice = config.voice || 'tara';
    this.enableEmotionTags = config.enableEmotionTags !== false; // Default to true
  }

  async isAvailable(): Promise<boolean> {
    try {
      return !!this.apiKey;
    } catch (error) {
      console.error('Orpheus TTS availability check failed:', error);
      return false;
    }
  }

  async synthesize(text: string, options?: TTSOptions): Promise<Buffer> {
    const startTime = Date.now();

    // Validate text length
    if (text.length > this.maxCharsPerChunk) {
      throw new TTSError(
        `Text length ${text.length} exceeds Orpheus limit of ${this.maxCharsPerChunk} characters`,
        this.name,
        'TEXT_TOO_LONG',
        false
      );
    }

    try {
      const voice = this.selectVoiceForEmotion(options?.emotion) || this.defaultVoice;

      // Inject emotion tags if enabled
      const processedText = this.enableEmotionTags
        ? this.injectEmotionTags(text, options?.emotion)
        : text;

      console.log(`[Orpheus] Synthesizing ${text.length} chars with voice=${voice}, emotionTags=${this.enableEmotionTags}`);

      const response = await fetch('https://api.together.ai/v1/audio/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'canopylabs/orpheus-3b-0.1-ft',
          input: processedText,
          voice,
          response_format: 'mp3'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Orpheus API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      console.log(`[Orpheus] Received MP3 audio: ${buffer.length} bytes`);

      // Update metrics
      const latency = Date.now() - startTime;
      this.updateMetrics(text.length, latency, true);

      return buffer;
    } catch (error) {
      console.error('[Orpheus] Synthesis failed:', error);
      this.updateMetrics(text.length, Date.now() - startTime, false, error as Error);

      throw new TTSError(
        `Orpheus TTS failed: ${(error as Error).message}`,
        this.name,
        'SYNTHESIS_FAILED',
        true // Retryable
      );
    }
  }

  /**
   * Inject emotion tags at paragraph breaks for natural speech flow
   * Orpheus supports: <laugh>, <chuckle>, <sigh>, <cough>, <gasp>, <yawn>, <groan>, <sniffle>
   */
  private injectEmotionTags(text: string, emotion?: string): string {
    if (!emotion || emotion === 'neutral') return text;

    const transitionTags: Record<string, string> = {
      'happy': '<chuckle>',
      'sad': '<sigh>',
      'excited': '<gasp>',
      'tired': '<yawn>',
      'frustrated': '<groan>',
      'amused': '<laugh>',
      'calm': '',
      'serious': '',
    };

    const tag = transitionTags[emotion];
    if (!tag) return text;

    // Inject at paragraph breaks for natural flow
    return text.replace(/\n\n/g, `\n\n${tag} `);
  }

  private selectVoiceForEmotion(emotion?: string): string | null {
    if (!emotion) return null;

    // Map emotions to Orpheus voices based on their characteristics
    const emotionVoiceMap: Record<string, string> = {
      'neutral': 'tara',    // Balanced, natural
      'happy': 'mia',       // Warm, friendly
      'sad': 'leah',        // Softer tone
      'excited': 'zoe',     // Energetic
      'calm': 'jess',       // Soothing
      'serious': 'leo',     // Professional male voice
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
