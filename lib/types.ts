export interface Table {
  index: number;
  markdown: string;
  startLine: number;
  endLine: number;
}

export interface ProcessingResult {
  jobId: string;
  status: 'complete' | 'failed';
  audioUrl?: string;
  downloadUrl?: string;
  preview?: string;
  tableCount?: number;
  pageCount?: number;
  cost?: {
    parsing: number;
    tables: number;
    tts: number;
    total: number;
  };
  stats?: {
    originalChars: number;
    cleanedChars: number;
    tablesNarrated: number;
    audioDurationSeconds: number;
    audioDurationMinutes: number;
    ttsChunks: number;
    processingTimeSeconds: number;
  };
  error?: string;
}

export interface JobInfo {
  jobId: string;
  fileName: string;
  fileSize: number;
}
