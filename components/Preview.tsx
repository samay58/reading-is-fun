'use client';
import React from 'react';
import { formatCost } from '@/lib/cost';

interface PreviewProps {
  text: string;
  tableCount: number;
  pageCount: number;
  cost: {
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
}

export function Preview({ text, tableCount, pageCount, cost, stats }: PreviewProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Generation Summary */}
      <div className="p-4 border border-[var(--border)] rounded-lg bg-[var(--surface)]">
        <h3 className="font-medium mb-3">Generation Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-muted mb-1">Audio Duration</div>
            <div className="font-medium">
              {stats ? `${stats.audioDurationMinutes} minutes` : 'Calculating...'}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted mb-1">Processing Time</div>
            <div className="font-medium">
              {stats ? `${stats.processingTimeSeconds}s` : 'Calculating...'}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted mb-1">Text Processed</div>
            <div className="font-medium">
              {stats ? `${(stats.cleanedChars / 1000).toFixed(1)}K chars` : `${pageCount} pages`}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted mb-1">Tables Narrated</div>
            <div className="font-medium">
              {tableCount} table{tableCount !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="p-4 border border-[var(--border)] rounded-lg bg-[var(--surface)]">
        <h3 className="font-medium mb-3">Cost Breakdown</h3>
        <div className="text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-muted">DeepSeek OCR:</span>
            <span className="font-medium">FREE</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Claude narrations ({tableCount} tables):</span>
            <span className="font-medium">{formatCost(cost.tables)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">OpenAI TTS ({stats?.ttsChunks || '?'} chunks):</span>
            <span className="font-medium">{formatCost(cost.tts)}</span>
          </div>
          <div className="flex justify-between font-medium pt-3 mt-3 border-t border-[var(--border)]">
            <span>Total:</span>
            <span>{formatCost(cost.total)}</span>
          </div>
        </div>
      </div>

      {/* Text Preview */}
      <div className="p-4 border border-[var(--border)] rounded-lg bg-[var(--surface)]">
        <h3 className="font-medium mb-2">Text Preview</h3>
        <p className="text-sm text-muted whitespace-pre-wrap leading-relaxed">
          {text.substring(0, 500)}...
        </p>
      </div>
    </div>
  );
}
