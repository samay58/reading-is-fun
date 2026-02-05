/**
 * TTS Manager
 * Handles provider selection, fallback chains, and A/B testing
 */

import {
  TTSProvider,
  TTSOptions,
  TTSProviderConfig,
  TTSError,
  TTSQualityMetrics
} from './types';
// ARCHIVED: Old providers moved to _deprecated/
// import { HathoraProvider } from './providers/hathora';
// import { InworldProvider } from './providers/inworld';

// New provider chain (2025-11 migration)
import { DeepInfraProvider } from './providers/deepinfra';
import { OrpheusProvider } from './providers/orpheus';
import { MiniMaxProvider } from './providers/minimax';
import { OpenAIProvider } from './providers/openai';
import { SesameProvider } from './providers/sesame';

export class TTSManager {
  private providers: TTSProvider[] = [];
  private config: TTSProviderConfig;
  private abTestingEnabled: boolean = false;
  private abTestingRatio: number = 0.1; // 10% of requests use alternative provider
  private qualityMetrics: TTSQualityMetrics[] = [];

  constructor(config: TTSProviderConfig) {
    this.config = config;
    this.initializeProviders();
  }

  private initializeProviders() {
    // Initialize providers in priority order (lowest cost first)

    // Priority 0: Sesame CSM-1B ($1.50/M) - Natural conversational voice (when selected)
    if (this.config.sesame) {
      this.providers.push(new SesameProvider(this.config.sesame));
    }

    // Priority 0: DeepInfra Kokoro ($0.62/M) - Ultra-low cost primary
    if (this.config.deepinfra) {
      this.providers.push(new DeepInfraProvider(this.config.deepinfra));
    }

    // Priority 1: Orpheus via Together.ai ($15/M) - Emotion tags
    if (this.config.orpheus) {
      this.providers.push(new OrpheusProvider(this.config.orpheus));
    }

    // Priority 2: MiniMax Speech-02-Turbo ($30/M) - Quality fallback
    if (this.config.minimax) {
      this.providers.push(new MiniMaxProvider(this.config.minimax));
    }

    // Priority 3: OpenAI TTS-1-HD ($30/M) - Final safety net
    if (this.config.openai) {
      this.providers.push(new OpenAIProvider(this.config.openai));
    }

    // ARCHIVED: Old providers (Hathora, Inworld) removed 2025-11
    // if (this.config.hathora) {
    //   this.providers.push(new HathoraProvider(this.config.hathora));
    // }
    // if (this.config.inworld) {
    //   this.providers.push(new InworldProvider(this.config.inworld));
    // }

    // Sort by priority (lower number = higher priority)
    this.providers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get the primary provider (lowest cost that's available)
   */
  private async getPrimaryProvider(): Promise<TTSProvider | null> {
    // Sort by cost for primary selection
    const sortedByCost = [...this.providers].sort(
      (a, b) => a.costPer1MChars - b.costPer1MChars
    );

    for (const provider of sortedByCost) {
      if (await provider.isAvailable()) {
        return provider;
      }
    }

    return null;
  }

  /**
   * Synthesize text with automatic provider selection and fallback
   */
  async synthesize(text: string, options?: TTSOptions): Promise<{
    audio: Buffer;
    provider: string;
    cost: number;
    duration: number;
  }> {
    const startTime = Date.now();

    // A/B Testing: Occasionally use alternative provider
    let selectedProvider: TTSProvider | null = null;

    if (this.abTestingEnabled && Math.random() < this.abTestingRatio) {
      // Select alternative provider for A/B testing
      selectedProvider = await this.getAlternativeProvider();
    } else {
      // Use primary (lowest cost) provider
      selectedProvider = await this.getPrimaryProvider();
    }

    if (!selectedProvider) {
      throw new TTSError(
        'No TTS providers available',
        'manager',
        'NO_PROVIDERS',
        false
      );
    }

    // Try selected provider with fallback chain
    let lastError: Error | null = null;
    const attemptedProviders = new Set<string>();

    while (selectedProvider) {
      try {
        attemptedProviders.add(selectedProvider.name);

        const audio = await selectedProvider.synthesize(text, options);
        const duration = Date.now() - startTime;
        const cost = selectedProvider.estimateCost(text);

        // Record quality metrics for analysis
        this.recordMetrics({
          provider: selectedProvider.name,
          timestamp: new Date(),
          textLength: text.length,
          generationTime: duration,
          fileSize: audio.length,
          selected: !this.abTestingEnabled || Math.random() < this.abTestingRatio
        });

        return {
          audio,
          provider: selectedProvider.name,
          cost,
          duration
        };
      } catch (error) {
        lastError = error as Error;
        console.error(`TTS provider ${selectedProvider.name} failed:`, error);

        // Find next available provider in fallback chain
        selectedProvider = await this.getNextProvider(attemptedProviders, text.length);
      }
    }

    throw new TTSError(
      `All TTS providers failed. Last error: ${lastError?.message}`,
      'manager',
      'ALL_FAILED',
      false
    );
  }

  /**
   * Get next available provider that hasn't been attempted
   */
  private async getNextProvider(attempted: Set<string>, textLength?: number): Promise<TTSProvider | null> {
    for (const provider of this.providers) {
      if (!attempted.has(provider.name) && await provider.isAvailable()) {
        if (textLength && provider.maxCharsPerChunk < textLength) {
          continue;
        }
        return provider;
      }
    }
    return null;
  }

  /**
   * Get alternative provider for A/B testing
   */
  private async getAlternativeProvider(): Promise<TTSProvider | null> {
    // Get second-best provider by cost
    const sortedByCost = [...this.providers].sort(
      (a, b) => a.costPer1MChars - b.costPer1MChars
    );

    for (let i = 1; i < sortedByCost.length; i++) {
      if (await sortedByCost[i].isAvailable()) {
        return sortedByCost[i];
      }
    }

    // Fall back to primary if no alternative
    return this.getPrimaryProvider();
  }

  /**
   * Enable A/B testing between providers
   */
  enableABTesting(ratio: number = 0.1) {
    this.abTestingEnabled = true;
    this.abTestingRatio = Math.max(0, Math.min(1, ratio));
  }

  /**
   * Disable A/B testing
   */
  disableABTesting() {
    this.abTestingEnabled = false;
  }

  /**
   * Record quality metrics for analysis
   */
  private recordMetrics(metrics: TTSQualityMetrics) {
    this.qualityMetrics.push(metrics);

    // Keep only last 1000 metrics to prevent memory issues
    if (this.qualityMetrics.length > 1000) {
      this.qualityMetrics = this.qualityMetrics.slice(-1000);
    }
  }

  /**
   * Get quality report for providers
   */
  getQualityReport() {
    const report: Record<string, any> = {};

    for (const provider of this.providers) {
      const providerMetrics = this.qualityMetrics.filter(
        m => m.provider === provider.name
      );

      if (providerMetrics.length === 0) continue;

      const avgGenerationTime = providerMetrics.reduce(
        (sum, m) => sum + m.generationTime, 0
      ) / providerMetrics.length;

      const avgFileSize = providerMetrics.reduce(
        (sum, m) => sum + m.fileSize, 0
      ) / providerMetrics.length;

      const avgRating = providerMetrics
        .filter(m => m.userRating !== undefined)
        .reduce((sum, m) => sum + (m.userRating || 0), 0) /
        providerMetrics.filter(m => m.userRating !== undefined).length || 0;

      report[provider.name] = {
        totalRequests: providerMetrics.length,
        averageGenerationTime: Math.round(avgGenerationTime),
        averageFileSize: Math.round(avgFileSize),
        averageUserRating: avgRating || 'N/A',
        costPer1MChars: provider.costPer1MChars,
        metrics: provider.getMetrics()
      };
    }

    return report;
  }

  /**
   * Estimate cost for text across all providers
   */
  estimateCosts(text: string): Record<string, number> {
    const costs: Record<string, number> = {};

    for (const provider of this.providers) {
      costs[provider.name] = provider.estimateCost(text);
    }

    return costs;
  }

  /**
   * Get list of available providers
   */
  async getAvailableProviders(): Promise<string[]> {
    const available: string[] = [];

    for (const provider of this.providers) {
      if (await provider.isAvailable()) {
        available.push(provider.name);
      }
    }

    return available;
  }

  /**
   * Get the maximum chunk size that's safe for all available providers
   * Returns the minimum maxCharsPerChunk value across all providers
   */
  async getMaxChunkSize(): Promise<number> {
    const available: number[] = [];

    for (const provider of this.providers) {
      if (await provider.isAvailable()) {
        available.push(provider.maxCharsPerChunk);
      }
    }

    if (available.length === 0) {
      // Default to most conservative limit if no providers available
      return 2000;
    }

    // Return the minimum (most restrictive) chunk size
    return Math.min(...available);
  }

  /**
   * Get the chunk size for the primary (cheapest available) provider.
   * Useful to avoid over-fragmenting when fallback providers have stricter limits.
   */
  async getPrimaryChunkSize(): Promise<number> {
    const primary = await this.getPrimaryProvider();
    if (primary) {
      return primary.maxCharsPerChunk;
    }
    return 2000;
  }
}
