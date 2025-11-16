/**
 * Server-Sent Events helper utilities
 */

import type { StreamEvent } from './types';

export class SSEEncoder {
  private encoder = new TextEncoder();

  /**
   * Format an event for SSE transmission
   */
  formatEvent(event: StreamEvent): string {
    return `data: ${JSON.stringify(event)}\n\n`;
  }

  /**
   * Encode an event to bytes for streaming
   */
  encode(event: StreamEvent): Uint8Array {
    return this.encoder.encode(this.formatEvent(event));
  }

  /**
   * Send a keepalive comment to prevent timeout
   */
  keepalive(): Uint8Array {
    return this.encoder.encode(': keepalive\n\n');
  }

  /**
   * Send an error and close the stream
   */
  error(message: string, recoverable = false): Uint8Array {
    const event: StreamEvent = {
      type: 'error',
      message,
      recoverable,
      timestamp: Date.now(),
    };
    return this.encode(event);
  }
}

/**
 * Create SSE response headers
 */
export function getSSEHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable Nginx buffering
  };
}

/**
 * Retry delay for SSE reconnection (in milliseconds)
 */
export const SSE_RETRY_DELAY = 3000;

/**
 * Maximum time for a single chunk to process before timeout
 */
export const CHUNK_TIMEOUT = 30000; // 30 seconds

/**
 * Keepalive interval to prevent connection timeout
 */
export const KEEPALIVE_INTERVAL = 15000; // 15 seconds