/**
 * Hathora TTS Provider (Kokoro Model)
 * Ultra-low cost alternative using Kokoro-82M model
 * Returns WAV format - converted to MP3 for compatibility
 */

import { TTSProvider, TTSOptions, TTSMetrics, TTSError } from '../../types';
import { spawn } from 'child_process';

export class HathoraProvider implements TTSProvider {
  name = 'hathora';
  priority = 0; // Highest priority - cheapest option
  costPer1MChars = 0.50; // Estimated - significantly cheaper than alternatives
  maxCharsPerChunk = 4000; // Safe default (~1k tokens). Override with HATHORA_MAX_CHARS.

  private apiKey: string;
  // Allow overriding the base URL; default to the app host from Hathora docs
  private baseUrl = process.env.HATHORA_BASE_URL || 'https://app-01312daf-6e53-4b9d-a4ad-13039f35adc4.app.hathora.dev';
  private readonly defaultBaseUrl = 'https://app-01312daf-6e53-4b9d-a4ad-13039f35adc4.app.hathora.dev';
  private defaultVoice = 'af_bella';

  private metrics: TTSMetrics = {
    totalRequests: 0,
    totalCharacters: 0,
    totalCost: 0,
    averageLatency: 0,
    errors: 0
  };

  private normalizeBaseUrl(url: string): string {
    return url.replace(/\/+$/, '').replace(/\/synthesize$/i, '');
  }

  constructor(config: { apiKey: string; baseUrl?: string; maxCharsPerChunk?: number }) {
    this.apiKey = config.apiKey;
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }
    this.baseUrl = this.normalizeBaseUrl(this.baseUrl);
    this.baseUrl ||= this.defaultBaseUrl;

    const override = process.env.HATHORA_MAX_CHARS && parseInt(process.env.HATHORA_MAX_CHARS, 10);
    const maxOverride = config.maxCharsPerChunk || override;
    if (maxOverride && maxOverride > 0) {
      this.maxCharsPerChunk = maxOverride;
    }

    console.log(`[Hathora] Base URL set to ${this.baseUrl}/synthesize (max ${this.maxCharsPerChunk} chars)`);
  }

  async isAvailable(): Promise<boolean> {
    try {
      return !!this.apiKey;
    } catch (error) {
      console.error('Hathora TTS availability check failed:', error);
      return false;
    }
  }

  async synthesize(text: string, options?: TTSOptions): Promise<Buffer> {
    const startTime = Date.now();

    // Validate text length
    if (text.length > this.maxCharsPerChunk) {
      console.warn(`Hathora: Text length ${text.length} exceeds limit of ${this.maxCharsPerChunk} characters`);
      throw new TTSError(
        `Text length ${text.length} exceeds Hathora limit of ${this.maxCharsPerChunk} characters`,
        this.name,
        'TEXT_TOO_LONG',
        false
      );
    }

    try {
      const voice = this.selectVoiceForEmotion(options?.emotion) || options?.voice || this.defaultVoice;
      const speed = options?.speed || 1.05;

      console.log(`[Hathora] Synthesizing ${text.length} chars with voice=${voice}, speed=${speed}`);

      const mp3Buffer = await this.callHathora(text, voice, speed, this.baseUrl);

      // Update metrics
      const latency = Date.now() - startTime;
      this.updateMetrics(text.length, latency, true);

      return mp3Buffer;
    } catch (error: any) {
      console.error('[Hathora] Synthesis failed:', error);

      // Update error metrics
      this.updateMetrics(text.length, Date.now() - startTime, false, error as Error);

      throw new TTSError(
        `Hathora TTS failed: ${(error as Error).message}`,
        this.name,
        'SYNTHESIS_FAILED',
        true // Retryable
      );
    }
  }

  private selectVoiceForEmotion(emotion?: string): string | null {
    if (!emotion) return null;

    const emotionVoiceMap: Record<string, string> = {
      neutral: this.defaultVoice,
      calm: 'af_heart',
      excited: 'af_sky',
      happy: 'af_nova',
      serious: 'am_eric',
      sad: 'af_river',
    };

    return emotionVoiceMap[emotion] || null;
  }

  /**
   * Perform the Hathora call and fallback to default base URL if we hit 404/405
   */
  private async callHathora(
    text: string,
    voice: string,
    speed: number,
    baseUrl: string,
    isFallback: boolean = false
  ): Promise<Buffer> {
    const normalizedBase = this.normalizeBaseUrl(baseUrl || this.defaultBaseUrl);
    const url = `${normalizedBase}/synthesize`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text, voice, speed })
    });

    if (!response.ok) {
      const errorText = await response.text();
      const statusText = response.statusText ? ` ${response.statusText}` : '';
      const hint = response.status === 405
        ? ' (check HATHORA_BASE_URL is the app host without /synthesize)'
        : '';

      // Retry once with the known-good default host if the configured host fails with a method/path issue
      if (!isFallback && normalizedBase !== this.defaultBaseUrl && (response.status === 405 || response.status === 404)) {
        console.warn(`[Hathora] ${response.status} at ${normalizedBase}, retrying default host ${this.defaultBaseUrl}`);
        // Persist the working base URL for future calls
        this.baseUrl = this.defaultBaseUrl;
        return this.callHathora(text, voice, speed, this.defaultBaseUrl, true);
      }

      throw new Error(`Hathora API error: ${response.status}${statusText}${hint} - ${errorText} [base=${normalizedBase}]`);
    }

    const wavBuffer = Buffer.from(await response.arrayBuffer());

    console.log(`[Hathora] Received WAV audio: ${wavBuffer.length} bytes from ${normalizedBase}`);

    const mp3Buffer = await this.convertWavToMp3(wavBuffer);

    console.log(`[Hathora] Converted to MP3: ${mp3Buffer.length} bytes`);

    return mp3Buffer;
  }

  /**
   * Convert WAV buffer to MP3 using ffmpeg
   */
  private async convertWavToMp3(wavBuffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', 'pipe:0',           // Input from stdin (WAV)
        '-acodec', 'libmp3lame',  // MP3 encoder
        '-b:a', '128k',           // Bitrate (matching system standard)
        '-ar', '48000',           // Sample rate
        '-f', 'mp3',              // Output format
        'pipe:1'                  // Output to stdout
      ]);

      const chunks: Buffer[] = [];
      let errorOutput = '';

      // Collect MP3 output
      ffmpeg.stdout.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      // Collect error output for debugging
      ffmpeg.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      // Handle completion
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`ffmpeg exited with code ${code}: ${errorOutput}`));
        }
      });

      // Handle process errors
      ffmpeg.on('error', (error) => {
        reject(new Error(`ffmpeg process error: ${error.message}`));
      });

      // Write WAV input and close stdin
      ffmpeg.stdin.write(wavBuffer);
      ffmpeg.stdin.end();
    });
  }

  estimateCost(text: string | number): number {
    const length = typeof text === 'number' ? text : text.length;
    return (length / 1_000_000) * this.costPer1MChars;
  }

  getMetrics(): TTSMetrics {
    return { ...this.metrics };
  }

  private updateMetrics(
    charCount: number,
    latency: number,
    success: boolean,
    error?: Error
  ): void {
    this.metrics.totalRequests++;
    this.metrics.totalCharacters += charCount;
    this.metrics.totalCost += this.estimateCost(charCount);

    // Update rolling average latency
    const totalLatency = this.metrics.averageLatency * (this.metrics.totalRequests - 1) + latency;
    this.metrics.averageLatency = totalLatency / this.metrics.totalRequests;

    if (!success) {
      this.metrics.errors++;
      if (error) {
        this.metrics.lastError = error.message;
      }
    }
  }
}
