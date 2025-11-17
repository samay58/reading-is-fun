'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Download, ChevronLeft } from 'lucide-react';
import type { StreamEvent, ChunkReadyEvent } from '@/lib/streaming/types';

// Helper to convert base64 to Blob
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

interface StreamingPlayerProps {
  documentId: string;
  fileName: string;
  file: File;
  onReset: () => void;
}

interface AudioChunk {
  index: number;
  audioUrl: string;
  duration: number;
  status: 'pending' | 'ready' | 'played';
}

export function StreamingPlayer({ documentId, fileName, file, onReset }: StreamingPlayerProps) {
  const [chunks, setChunks] = useState<AudioChunk[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [totalChunks, setTotalChunks] = useState<number | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<'connecting' | 'extracting' | 'processing' | 'complete' | 'error'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [extractionInfo, setExtractionInfo] = useState<{
    charCount?: number;
    tableCount?: number;
    pageCount?: number;
  }>({});

  const audioRef = useRef<HTMLAudioElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Connect to SSE stream via POST (Vercel-compatible)
  useEffect(() => {
    let aborted = false;

    async function startProcessing() {
      try {
        setStreamStatus('extracting');

        // Send file via POST
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`/api/process-stream/${documentId}`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (!aborted) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const event: StreamEvent = JSON.parse(data);
                handleStreamEvent(event);
              } catch (err) {
                console.error('Failed to parse SSE event:', err);
              }
            }
          }
        }
      } catch (err: any) {
        if (!aborted) {
          console.error('Streaming error:', err);
          setStreamStatus('error');
          setError(err.message || 'Processing failed. Please try again.');
        }
      }
    }

    startProcessing();

    return () => {
      aborted = true;
      // Clean up blob URLs to prevent memory leaks
      chunks.forEach(chunk => {
        if (chunk?.audioUrl) {
          URL.revokeObjectURL(chunk.audioUrl);
        }
      });
    };
  }, [documentId, file, chunks]);

  const handleStreamEvent = (event: StreamEvent) => {
    switch (event.type) {
      case 'extraction_start':
        setStreamStatus('extracting');
        break;

      case 'extraction_complete':
        setStreamStatus('processing');
        setTotalChunks(event.totalChunks);
        setExtractionInfo({
          charCount: event.charCount,
          tableCount: event.tableCount,
          pageCount: event.pageCount,
        });
        break;

      case 'chunk_processing':
        break;

      case 'chunk_ready':
        handleChunkReady(event);
        break;

      case 'complete':
        setStreamStatus('complete');
        setDownloadUrl(event.downloadUrl);
        setStats(event.stats);
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
        break;

      case 'error':
        setStreamStatus('error');
        setError(event.message);
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
        break;
    }
  };

  const handleChunkReady = (event: ChunkReadyEvent) => {
    // Convert base64 audio data to blob URL
    const audioBlob = base64ToBlob(event.audioData, 'audio/mpeg');
    const blobUrl = URL.createObjectURL(audioBlob);

    const newChunk: AudioChunk = {
      index: event.index,
      audioUrl: blobUrl,
      duration: event.duration,
      status: 'ready',
    };

    setChunks(prev => {
      const updated = [...prev];
      updated[event.index] = newChunk;
      return updated;
    });

    // Auto-play first chunk when ready
    if (event.index === 0 && !isPlaying && audioRef.current) {
      audioRef.current.src = blobUrl;
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error('Play failed:', err));
    }
  };

  const handleChunkEnd = useCallback(() => {
    if (currentChunkIndex < chunks.length - 1) {
      const nextIndex = currentChunkIndex + 1;
      const nextChunk = chunks[nextIndex];

      if (nextChunk && nextChunk.status === 'ready' && audioRef.current) {
        setCurrentChunkIndex(nextIndex);
        audioRef.current.src = nextChunk.audioUrl;
        audioRef.current.play()
          .then(() => {
            setChunks(prev => {
              const updated = [...prev];
              if (updated[currentChunkIndex]) {
                updated[currentChunkIndex].status = 'played';
              }
              return updated;
            });
          })
          .catch(err => {
            console.error('Failed to play next chunk:', err);
            setIsPlaying(false);
          });
      } else {
        setIsPlaying(false);
      }
    } else {
      setIsPlaying(false);
    }
  }, [currentChunkIndex, chunks]);

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      const nextUnplayed = chunks.findIndex((c, i) => i >= currentChunkIndex && c.status === 'ready');
      if (nextUnplayed !== -1) {
        setCurrentChunkIndex(nextUnplayed);
        audioRef.current.src = chunks[nextUnplayed].audioUrl;
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(err => console.error('Play failed:', err));
      }
    }
  };

  const getChunksReadyCount = () => chunks.filter(c => c?.status === 'ready').length;
  const canPlay = getChunksReadyCount() > 0;

  const getProgressMessage = () => {
    if (streamStatus === 'connecting') return 'Connecting...';
    if (streamStatus === 'extracting') return 'Extracting text from PDF...';
    if (streamStatus === 'processing') {
      const readyChunks = getChunksReadyCount();
      if (totalChunks) {
        return `Generating audio: ${readyChunks}/${totalChunks} chunks ready`;
      }
      return 'Processing audio...';
    }
    if (streamStatus === 'complete') return 'Processing complete';
    if (streamStatus === 'error') return error || 'An error occurred';
    return '';
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="card">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-medium mb-1">{fileName}</h2>
            <div className="flex items-center gap-2 text-sm text-muted">
              {streamStatus === 'extracting' && <div className="spinner" style={{ width: '14px', height: '14px' }} />}
              {streamStatus === 'processing' && <div className="w-1 h-1 rounded-full bg-[var(--accent)]" />}
              {streamStatus === 'complete' && <div className="w-1 h-1 rounded-full bg-[var(--success)]" />}
              {streamStatus === 'error' && <div className="w-1 h-1 rounded-full bg-[var(--error)]" />}
              <span>{getProgressMessage()}</span>
            </div>
          </div>
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Convert another</span>
          </button>
        </div>

        {/* Extraction Info */}
        {extractionInfo.pageCount && (
          <div className="grid grid-cols-3 gap-4 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-lg">
            <div className="text-center">
              <div className="text-xs text-muted">Pages</div>
              <div className="text-lg font-medium">{extractionInfo.pageCount}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted">Tables</div>
              <div className="text-lg font-medium">{extractionInfo.tableCount || 0}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted">Characters</div>
              <div className="text-lg font-medium">
                {extractionInfo.charCount ? `${(extractionInfo.charCount / 1000).toFixed(1)}K` : '-'}
              </div>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {totalChunks && totalChunks > 0 && streamStatus === 'processing' && (
          <div className="mt-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted">Chunks ready</span>
              <span className="font-medium">
                {getChunksReadyCount()}/{totalChunks}
              </span>
            </div>
            <div className="progress">
              <div
                className="progress-bar"
                style={{ width: `${(getChunksReadyCount() / totalChunks) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Player Controls */}
      {(canPlay || streamStatus === 'complete') && (
        <div className="card">
          <audio
            ref={audioRef}
            onEnded={handleChunkEnd}
            preload="auto"
          />

          {/* Controls */}
          <div className="flex gap-3">
            <button
              onClick={togglePlayPause}
              disabled={!canPlay}
              className="flex-1 primary"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-5 h-5" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  <span>Play</span>
                </>
              )}
            </button>

            {downloadUrl && (
              <a
                href={downloadUrl}
                download
                className="inline-flex items-center gap-2 px-4 py-3 border border-[var(--border)] rounded-lg hover:border-[var(--accent)] transition-colors"
              >
                <Download className="w-5 h-5" />
                <span>Download</span>
              </a>
            )}
          </div>

          {/* Playback Status */}
          {isPlaying && chunks[currentChunkIndex] && (
            <p className="mt-4 text-center text-sm text-muted">
              Playing chunk {currentChunkIndex + 1} of {totalChunks || '?'}
              {chunks.filter(c => c?.status === 'ready').length < (totalChunks || 0) && (
                <span> • Processing more...</span>
              )}
            </p>
          )}
        </div>
      )}

      {/* Error State */}
      {streamStatus === 'error' && (
        <div className="card border-[var(--error)]">
          <h3 className="font-medium mb-1">Processing Error</h3>
          <p className="text-sm text-muted">{error}</p>
        </div>
      )}

      {/* Success Stats */}
      {stats && streamStatus === 'complete' && (
        <div className="card border-[var(--success)]">
          <h3 className="font-medium mb-3">Processing Complete</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted">Duration:</span>
              <span className="ml-1 font-medium">
                {Math.floor(stats.audioDurationSeconds / 60)}:{String(Math.floor(stats.audioDurationSeconds % 60)).padStart(2, '0')}
              </span>
            </div>
            <div>
              <span className="text-muted">Time:</span>
              <span className="ml-1 font-medium">{stats.processingTimeSeconds}s</span>
            </div>
            <div>
              <span className="text-muted">Cost:</span>
              <span className="ml-1 font-medium">${stats.cost.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}