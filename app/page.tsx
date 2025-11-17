'use client';

import React, { useState } from 'react';
import { Upload } from '@/components/Upload';
import { Preview } from '@/components/Preview';
import { Player } from '@/components/Player';
import { StreamingPlayer } from '@/components/StreamingPlayer';
import { FileAudio, Zap } from 'lucide-react';
import type { ProcessingResult } from '@/lib/types';

export default function Home() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [useStreaming, setUseStreaming] = useState(true);

  async function handleUpload(id: string, name: string, uploadedFile?: File) {
    setJobId(id);
    setFileName(name);
    setFile(uploadedFile || null);
    setResult(null);

    if (!useStreaming) {
      setProcessing(true);
      try {
        const res = await fetch(`/api/process/${id}`, { method: 'POST' });
        const data = await res.json();

        if (!res.ok || data.status === 'failed') {
          throw new Error(data.error || 'Processing failed');
        }

        setResult(data);
      } catch (err: any) {
        setResult({
          jobId: id,
          status: 'failed',
          error: err.message,
        });
      } finally {
        setProcessing(false);
      }
    }
  }

  function reset() {
    setJobId(null);
    setFileName('');
    setFile(null);
    setProcessing(false);
    setResult(null);
  }

  return (
    <main className="container">
      <div className="mt-12 mb-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <FileAudio className="w-12 h-12" strokeWidth={1} />
          </div>

          <h1 className="mb-4">PDF to Voice</h1>
          <p className="text-lg text-muted">
            Transform documents into premium audio experiences
          </p>

          {/* Streaming Toggle */}
          <div className="mt-6 flex justify-center">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={useStreaming}
                onChange={(e) => setUseStreaming(e.target.checked)}
                className="sr-only"
              />
              <div className={`
                relative w-12 h-6 rounded-full transition-colors
                ${useStreaming ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}
              `}>
                <div className={`
                  absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform
                  ${useStreaming ? 'translate-x-6' : 'translate-x-0'}
                `} />
              </div>
              <span className="text-sm font-medium flex items-center gap-2">
                {useStreaming && <Zap className="w-4 h-4" />}
                {useStreaming ? 'Streaming enabled' : 'Standard mode'}
              </span>
            </label>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-2xl mx-auto">
          {!jobId && !processing && !result && (
            <Upload onUpload={handleUpload} />
          )}

          {useStreaming && jobId && fileName && file && (
            <StreamingPlayer
              documentId={jobId}
              fileName={fileName}
              file={file}
              onReset={reset}
            />
          )}

          {!useStreaming && processing && (
            <div className="card">
              <div className="flex flex-col items-center gap-6">
                <div className="spinner" />
                <div className="text-center">
                  <p className="text-lg font-medium mb-2">
                    Processing {fileName}
                  </p>
                  <p className="text-sm text-muted">
                    Extracting text → Summarizing tables → Generating audio
                  </p>
                  <p className="text-xs text-muted mt-4">
                    Usually takes 30-60 seconds for 10-20 pages
                  </p>
                </div>
              </div>
            </div>
          )}

          {!useStreaming && result && result.status === 'complete' && (
            <div className="space-y-6">
              <div className="card">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="mb-1">{fileName}</h2>
                    <p className="text-sm text-muted">Ready to listen</p>
                  </div>
                  <button onClick={reset} className="text-sm">
                    ← Convert another
                  </button>
                </div>

                {result.preview && result.tableCount !== undefined && result.pageCount && result.cost && (
                  <Preview
                    text={result.preview}
                    tableCount={result.tableCount}
                    pageCount={result.pageCount}
                    cost={result.cost}
                    stats={result.stats}
                  />
                )}
              </div>

              {result.audioUrl && result.downloadUrl && (
                <Player
                  audioUrl={result.audioUrl}
                  downloadUrl={result.downloadUrl}
                />
              )}
            </div>
          )}

          {!useStreaming && result && result.status === 'failed' && (
            <div className="card border-[var(--error)]">
              <div className="text-center">
                <div className="text-5xl mb-4">⚠️</div>
                <h2 className="mb-3">Processing Failed</h2>
                <p className="text-muted mb-6">
                  {result.error || 'An error occurred while processing your PDF'}
                </p>
                <button onClick={reset} className="primary">
                  Try Another PDF
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-sm text-muted">
          <p className="font-medium">v0.6 • Premium Audio Generation</p>
          <p className="mt-2">
            {useStreaming
              ? 'Progressive streaming for instant playback'
              : 'High-quality batch processing'}
          </p>
          <p className="text-xs mt-2">
            DeepSeek OCR • Claude Intelligence • OpenAI Voice
          </p>
          <p className="text-xs">
            Maximum 40 pages • Files auto-delete after 1 hour
          </p>
        </div>
      </div>
    </main>
  );
}