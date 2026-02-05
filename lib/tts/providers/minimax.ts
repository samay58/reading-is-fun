/**
 * MiniMax TTS Provider (Speech-02-Turbo)
 * Tertiary fallback with native emotion support ($30/M chars)
 * Supports 40+ languages and professional-grade quality
 */

import { TTSProvider, TTSOptions, TTSMetrics, TTSError } from '../types';

export class MiniMaxProvider implements TTSProvider {
  name = 'minimax';
  priority = 2; // Third priority after DeepInfra and Orpheus
  costPer1MChars = 30;
  maxCharsPerChunk = 8000; // Conservative (supports 10k)

  private apiKey: string;
  private groupId: string;
  private metrics: TTSMetrics = {
    totalRequests: 0,
    totalCharacters: 0,
    totalCost: 0,
    averageLatency: 0,
    errors: 0
  };

  // MiniMax native emotions
  private readonly supportedEmotions = ['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'neutral'] as const;

  constructor(config: { apiKey: string; groupId: string }) {
    this.apiKey = config.apiKey;
    this.groupId = config.groupId;
  }

  async isAvailable(): Promise<boolean> {
    try {
      return !!(this.apiKey && this.groupId);
    } catch (error) {
      console.error('MiniMax TTS availability check failed:', error);
      return false;
    }
  }

  async synthesize(text: string, options?: TTSOptions): Promise<Buffer> {
    const startTime = Date.now();

    // Validate text length
    if (text.length > this.maxCharsPerChunk) {
      throw new TTSError(
        `Text length ${text.length} exceeds MiniMax limit of ${this.maxCharsPerChunk} characters`,
        this.name,
        'TEXT_TOO_LONG',
        false
      );
    }

    try {
      const voiceId = this.selectVoiceForEmotion(options?.emotion) || 'male-qn-qingse';
      const emotion = this.mapToMiniMaxEmotion(options?.emotion);
      const speed = options?.speed || 1.0;

      console.log(`[MiniMax] Synthesizing ${text.length} chars with voice=${voiceId}, emotion=${emotion}`);

      const response = await fetch(`https://api.minimaxi.chat/v1/t2a_v2?GroupId=${this.groupId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'speech-02-turbo',
          text,
          voice_setting: {
            voice_id: voiceId,
            emotion,
            speed
          },
          audio_setting: {
            format: 'mp3',
            sample_rate: 32000
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`MiniMax API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // MiniMax returns JSON with base64-encoded audio or direct audio
      const contentType = response.headers.get('content-type');
      let buffer: Buffer;

      if (contentType?.includes('application/json')) {
        // Handle JSON response with base64 audio
        const json = await response.json();
        if (json.audio_file) {
          buffer = Buffer.from(json.audio_file, 'base64');
        } else if (json.data?.audio) {
          buffer = Buffer.from(json.data.audio, 'base64');
        } else {
          throw new Error('MiniMax response missing audio data');
        }
      } else {
        // Direct audio response
        buffer = Buffer.from(await response.arrayBuffer());
      }

      console.log(`[MiniMax] Received MP3 audio: ${buffer.length} bytes`);

      // Update metrics
      const latency = Date.now() - startTime;
      this.updateMetrics(text.length, latency, true);

      return buffer;
    } catch (error) {
      console.error('[MiniMax] Synthesis failed:', error);
      this.updateMetrics(text.length, Date.now() - startTime, false, error as Error);

      throw new TTSError(
        `MiniMax TTS failed: ${(error as Error).message}`,
        this.name,
        'SYNTHESIS_FAILED',
        true // Retryable
      );
    }
  }

  /**
   * Map generic emotions to MiniMax's supported emotion set
   */
  private mapToMiniMaxEmotion(emotion?: string): string {
    if (!emotion) return 'neutral';

    const emotionMap: Record<string, string> = {
      'neutral': 'neutral',
      'happy': 'happy',
      'sad': 'sad',
      'excited': 'happy',      // Map to closest
      'calm': 'neutral',
      'serious': 'neutral',
      'angry': 'angry',
      'fearful': 'fearful',
      'disgusted': 'disgusted',
      'surprised': 'surprised',
    };

    return emotionMap[emotion] || 'neutral';
  }

  private selectVoiceForEmotion(emotion?: string): string | null {
    if (!emotion) return null;

    // MiniMax voice mapping (using their voice IDs)
    const emotionVoiceMap: Record<string, string> = {
      'neutral': 'male-qn-qingse',
      'happy': 'female-shaonv',
      'sad': 'female-yujie',
      'excited': 'female-shaonv',
      'calm': 'male-qn-qingse',
      'serious': 'presenter_male',
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
