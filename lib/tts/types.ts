/**
 * TTS Provider Abstraction Types
 * Enables seamless switching between different TTS providers
 */

export interface TTSProvider {
  name: string;
  priority: number; // Lower number = higher priority
  costPer1MChars: number; // Cost in USD per 1 million characters
  maxCharsPerChunk: number; // Maximum characters the provider can handle per request

  /**
   * Check if the provider is available and configured
   */
  isAvailable(): Promise<boolean>;

  /**
   * Generate audio from text
   * @returns Buffer containing audio data (MP3 format)
   */
  synthesize(text: string, options?: TTSOptions): Promise<Buffer>;

  /**
   * Get estimated cost for text
   */
  estimateCost(text: string | number): number;

  /**
   * Provider-specific metrics
   */
  getMetrics(): TTSMetrics;
}

export interface TTSOptions {
  voice?: string;
  speed?: number; // 0.5 to 2.0
  emotion?: 'neutral' | 'happy' | 'sad' | 'excited' | 'calm' | 'serious';
  language?: string;
  // Provider-specific options
  providerOptions?: Record<string, any>;
}

export interface TTSMetrics {
  totalRequests: number;
  totalCharacters: number;
  totalCost: number;
  averageLatency: number;
  errors: number;
  lastError?: string;
}

export interface TTSProviderConfig {
  hathora?: {
    apiKey: string;
    baseUrl?: string;
    maxCharsPerChunk?: number;
  };
  openai?: {
    apiKey: string;
    model?: 'tts-1' | 'tts-1-hd';
    voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  };
  inworld?: {
    apiKey: string;
    workspaceId: string;
    characterId?: string;
  };
  // New providers (2025-11 migration)
  deepinfra?: {
    apiKey: string;
    voice?: string;
  };
  orpheus?: {
    apiKey: string;
    voice?: string;
    enableEmotionTags?: boolean;
  };
  minimax?: {
    apiKey: string;
    groupId: string;
  };
  elevenlabs?: {
    apiKey: string;
    voiceId?: string;
  };
  sesame?: {
    apiKey: string;
    speakerId?: number; // 0-based speaker ID
  };
}

export class TTSError extends Error {
  constructor(
    message: string,
    public provider: string,
    public code?: string,
    public retryable: boolean = true
  ) {
    super(message);
    this.name = 'TTSError';
  }
}

export interface TTSQualityMetrics {
  provider: string;
  timestamp: Date;
  textLength: number;
  generationTime: number;
  fileSize: number;
  userRating?: number; // 1-5
  selected?: boolean; // For A/B testing
}
