/**
 * Inworld TTS Provider
 * Cost-effective alternative: $10 per 1M characters (67% cheaper than OpenAI)
 * Based on actual Inworld AI API documentation
 */

import { TTSProvider, TTSOptions, TTSMetrics, TTSError } from '../../types';

interface InworldVoice {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  description?: string;
}

export class InworldProvider implements TTSProvider {
  name = 'inworld';
  priority = 1; // Higher priority due to lower cost
  costPer1MChars = 10; // $10 per 1M characters (based on actual pricing: $0.000640 per 64 chars)
  maxCharsPerChunk = 2000; // Inworld API limit is 2000 characters per request (keep fixed)

  private apiKey: string;
  private workspaceId: string;
  private baseUrl = 'https://api.inworld.ai/tts/v1';
  private defaultVoice = 'Dennis'; // Default voice from API

  private metrics: TTSMetrics = {
    totalRequests: 0,
    totalCharacters: 0,
    totalCost: 0,
    averageLatency: 0,
    errors: 0
  };

  // Inworld voice catalog (based on actual API availability)
  // Note: Only Dennis voice is available in the current workspace
  private voices: Record<string, InworldVoice> = {
    'Dennis': {
      id: 'Dennis',
      name: 'Dennis',
      gender: 'male',
      description: 'Clear, professional male voice'
    }
  };

  constructor(config: {
    apiKey: string;
    workspaceId: string;
    characterId?: string;
  }) {
    this.apiKey = config.apiKey;
    this.workspaceId = config.workspaceId;

    // If character ID provided, use their voice
    if (config.characterId) {
      this.defaultVoice = config.characterId;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Simple check: if we have API key and workspace ID, assume available
      // Don't make actual API calls in availability check (wasteful and slow)
      return !!(this.apiKey && this.workspaceId);
    } catch (error) {
      console.error('Inworld TTS availability check failed:', error);
      return false;
    }
  }

  async synthesize(text: string, options?: TTSOptions): Promise<Buffer> {
    const startTime = Date.now();

    // Validate text length
    if (text.length > this.maxCharsPerChunk) {
      console.warn(`Inworld: Text length ${text.length} exceeds limit of ${this.maxCharsPerChunk} characters`);
      throw new TTSError(
        `Text length ${text.length} exceeds Inworld limit of ${this.maxCharsPerChunk} characters`,
        this.name,
        'TEXT_TOO_LONG',
        false
      );
    }

    try {
      // Select voice based on emotion or use default
      const voiceId = this.selectVoiceForEmotion(options?.emotion) || this.defaultVoice;

      // Map speed to Inworld's speaking_rate parameter
      const speakingRate = options?.speed || 1.05;

      const response = await fetch(`${this.baseUrl}/voice`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          voice_id: voiceId,
          model_id: 'inworld-tts-1-max',
          audio_config: {
            audio_encoding: 'MP3',
            speaking_rate: Math.max(0.5, Math.min(1.5, speakingRate))
          },
          temperature: 1.1 // Slight variation for natural speech
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Inworld API error: ${response.status} - ${error}`);
      }

      // Try to parse JSON, but handle non-JSON responses
      let result;
      const contentType = response.headers.get('content-type');
      const responseText = await response.text();

      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        // Response isn't JSON - log the actual content for debugging
        console.error('Inworld API returned non-JSON response:', responseText.slice(0, 200));
        throw new Error(`Inworld API returned invalid JSON. Response starts with: ${responseText.slice(0, 100)}`);
      }

      // Decode base64 audio content
      const audioContent = result.audioContent;
      if (!audioContent) {
        throw new Error('No audio content in response');
      }

      const buffer = Buffer.from(audioContent, 'base64');

      // Update metrics
      const latency = Date.now() - startTime;
      this.updateMetrics(text.length, latency, true);

      return buffer;
    } catch (error) {
      this.updateMetrics(text.length, Date.now() - startTime, false, error as Error);

      throw new TTSError(
        `Inworld TTS failed: ${(error as Error).message}`,
        this.name,
        'SYNTHESIS_FAILED',
        true
      );
    }
  }

  /**
   * Select appropriate voice based on emotion
   */
  private selectVoiceForEmotion(emotion?: string): string | null {
    // Currently only Dennis voice is available
    // Future: Map different emotions to different voices when available
    return 'Dennis';
  }

  estimateCost(text: string | number): number {
    // Inworld charges per character
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
  ) {
    this.metrics.totalRequests++;
    this.metrics.totalCharacters += characters;
    this.metrics.totalCost += this.estimateCost(characters);

    // Update average latency
    const prevTotal = this.metrics.averageLatency * (this.metrics.totalRequests - 1);
    this.metrics.averageLatency = (prevTotal + latency) / this.metrics.totalRequests;

    if (!success) {
      this.metrics.errors++;
      this.metrics.lastError = error?.message;
    }
  }

  /**
   * Get available voices for this provider
   */
  getAvailableVoices(): InworldVoice[] {
    return Object.values(this.voices);
  }

  /**
   * Set default voice by ID
   */
  setDefaultVoice(voiceId: string): void {
    if (this.voices[voiceId]) {
      this.defaultVoice = voiceId;
    } else {
      console.warn(`Voice ${voiceId} not found in Inworld catalog`);
    }
  }
}
