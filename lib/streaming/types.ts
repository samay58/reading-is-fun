/**
 * Streaming event types for Server-Sent Events
 */

export type StreamEventType =
  | 'extraction_start'
  | 'extraction_complete'
  | 'artwork_generating'
  | 'artwork_ready'
  | 'chunk_processing'
  | 'chunk_ready'
  | 'complete'
  | 'error';

export interface BaseStreamEvent {
  type: StreamEventType;
  timestamp: number;
}

export interface ExtractionStartEvent extends BaseStreamEvent {
  type: 'extraction_start';
}

export interface ExtractionCompleteEvent extends BaseStreamEvent {
  type: 'extraction_complete';
  charCount: number;
  tableCount: number;
  pageCount: number;
  totalChunks: number;
}

export interface ChunkProcessingEvent extends BaseStreamEvent {
  type: 'chunk_processing';
  index: number;
  total: number;
  text: string; // First 100 chars of chunk
}

export interface ChunkReadyEvent extends BaseStreamEvent {
  type: 'chunk_ready';
  index: number;
  total: number;
  audioUrl?: string; // Deprecated: kept for backward compatibility
  audioData: string; // Base64-encoded MP3 data
  duration: number; // Estimated duration in seconds
  charCount: number;
}

export interface CompleteEvent extends BaseStreamEvent {
  type: 'complete';
  downloadUrl: string;
  totalDuration: number;
  totalCost: number;
  stats: ProcessingStats;
}

export interface ErrorEvent extends BaseStreamEvent {
  type: 'error';
  message: string;
  recoverable: boolean;
}

export interface ArtworkGeneratingEvent extends BaseStreamEvent {
  type: 'artwork_generating';
  prompt: string;
}

export interface ArtworkReadyEvent extends BaseStreamEvent {
  type: 'artwork_ready';
  imageData: string;
  mimeType: 'image/png' | 'image/jpeg';
  prompt: string;
  cost: number;
}

export type StreamEvent =
  | ExtractionStartEvent
  | ExtractionCompleteEvent
  | ArtworkGeneratingEvent
  | ArtworkReadyEvent
  | ChunkProcessingEvent
  | ChunkReadyEvent
  | CompleteEvent
  | ErrorEvent;

export interface ProcessingStats {
  originalChars: number;
  cleanedChars: number;
  tablesNarrated: number;
  totalChunks: number;
  processingTimeSeconds: number;
  audioDurationSeconds: number;
  cost: {
    parsing: number;
    tables: number;
    tts: number;
    artwork: number;
    total: number;
  };
}

export interface ChunkMetadata {
  index: number;
  text: string;
  charCount: number;
  audioPath?: string;
  audioDuration?: number;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  error?: string;
}

export interface StreamingJob {
  id: string;
  fileName: string;
  chunks: ChunkMetadata[];
  status: 'extracting' | 'processing' | 'complete' | 'failed';
  startedAt: number;
  completedAt?: number;
}