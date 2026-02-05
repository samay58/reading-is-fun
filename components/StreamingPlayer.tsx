'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Download,
  Sparkles,
  X,
  FileText
} from 'lucide-react';
import { fadeUp } from '@/lib/motion';
import type { StreamEvent, ChunkReadyEvent, ArtworkReadyEvent } from '@/lib/streaming/types';

// --- Types ---

interface Props {
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

type PlayerStatus = 'connecting' | 'extracting' | 'processing' | 'complete' | 'error';
type ArtworkStatus = 'none' | 'generating' | 'ready' | 'failed';

// --- Utilities ---

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

function formatTime(seconds: number): string {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// --- Icon Button Component ---

function IconButton({
  icon: Icon,
  onClick,
  active = false,
  size = 20,
  disabled = false,
  className = '',
  title,
}: {
  icon: React.ElementType;
  onClick?: () => void;
  active?: boolean;
  size?: number;
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        position: 'relative',
        padding: '0.75rem',
        borderRadius: '1rem',
        border: 'none',
        background: active ? 'var(--accent-muted)' : 'transparent',
        color: active ? 'var(--accent)' : disabled ? 'var(--faint)' : 'var(--muted)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'all 150ms ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = 'var(--surface-elevated)';
          e.currentTarget.style.color = 'var(--foreground)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = active ? 'var(--accent-muted)' : 'transparent';
          e.currentTarget.style.color = active ? 'var(--accent)' : 'var(--muted)';
        }
      }}
      className={className}
    >
      <Icon size={size} strokeWidth={2.5} />
    </button>
  );
}

export function StreamingPlayer({ documentId, fileName, file, onReset }: Props) {
  // --- Refs ---
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // --- State ---
  const [chunks, setChunks] = useState<AudioChunk[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [totalChunks, setTotalChunks] = useState<number | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<PlayerStatus>('connecting');
  const [error, setError] = useState<string | null>(null);

  // Playback state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isHoveringScrubber, setIsHoveringScrubber] = useState(false);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);

  // Artwork state
  const [artworkStatus, setArtworkStatus] = useState<ArtworkStatus>('none');
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);

  // --- Derived State ---
  const chunksReady = chunks.filter((c) => c?.status === 'ready').length;
  const generationProgress = totalChunks ? (chunksReady / totalChunks) * 100 : 0;
  const isGenerating = status === 'extracting' || status === 'processing';
  const hasStartedPlayback = chunksReady > 0;
  const displayName = fileName.replace('.pdf', '').replace(/_/g, ' ');

  // --- SSE & Stream Logic ---

  useEffect(() => {
    let aborted = false;
    const controller = new AbortController();

    async function start() {
      try {
        setStatus('extracting');
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`/api/process-stream/${documentId}`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (!aborted) {
          const { done, value } = await reader.read();
          if (done || aborted) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const block of events) {
            for (const line of block.trim().split('\n')) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                try {
                  handleEvent(JSON.parse(data));
                } catch (e) {
                  console.error('Parse error', e);
                }
              }
            }
          }
        }
      } catch (err: any) {
        if (!aborted && err.name !== 'AbortError') {
          setStatus('error');
          setError(err.message || 'Processing failed');
        }
      }
    }

    start();
    return () => {
      aborted = true;
      controller.abort();
      chunks.forEach((c) => c?.audioUrl && URL.revokeObjectURL(c.audioUrl));
      if (artworkUrl) URL.revokeObjectURL(artworkUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, file]);

  function handleEvent(event: StreamEvent) {
    switch (event.type) {
      case 'extraction_start':
        setStatus('extracting');
        break;
      case 'extraction_complete':
        setStatus('processing');
        setTotalChunks(event.totalChunks);
        setPageCount(event.pageCount || null);
        break;
      case 'artwork_generating':
        setArtworkStatus('generating');
        break;
      case 'artwork_ready':
        handleArtworkReady(event as ArtworkReadyEvent);
        break;
      case 'chunk_ready':
        handleChunkReady(event as ChunkReadyEvent);
        break;
      case 'complete':
        setStatus('complete');
        setDownloadUrl(event.downloadUrl);
        break;
      case 'error':
        setStatus('error');
        setError(event.message);
        break;
    }
  }

  function handleArtworkReady(event: ArtworkReadyEvent) {
    const blob = base64ToBlob(event.imageData, event.mimeType);
    const url = URL.createObjectURL(blob);
    setArtworkUrl(url);
    setArtworkStatus('ready');
  }

  function handleChunkReady(event: ChunkReadyEvent) {
    const blob = base64ToBlob(event.audioData, 'audio/mpeg');
    const url = URL.createObjectURL(blob);

    setChunks((prev) => {
      const updated = [...prev];
      updated[event.index] = { index: event.index, audioUrl: url, duration: event.duration, status: 'ready' };
      return updated;
    });

    // Auto-play first chunk
    if (event.index === 0 && audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => console.log('Autoplay blocked'));
    }
  }

  const handleChunkEnd = useCallback(() => {
    const nextIndex = currentChunkIndex + 1;
    const nextChunk = chunks[nextIndex];

    if (nextChunk?.status === 'ready' && audioRef.current) {
      setCurrentChunkIndex(nextIndex);
      audioRef.current.src = nextChunk.audioUrl;
      audioRef.current.play().catch(() => setIsPlaying(false));
    } else {
      setIsPlaying(false);
    }
  }, [currentChunkIndex, chunks]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      const chunk = chunks[currentChunkIndex];
      if (chunk?.status === 'ready') {
        if (!audioRef.current.src || audioRef.current.ended) {
          audioRef.current.src = chunk.audioUrl;
        }
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(() => {});
      }
    }
  }, [isPlaying, chunks, currentChunkIndex]);

  const restart = useCallback(() => {
    const first = chunks[0];
    if (first?.status === 'ready' && audioRef.current) {
      setCurrentChunkIndex(0);
      audioRef.current.src = first.audioUrl;
      audioRef.current.currentTime = 0;
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [chunks]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !audioRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pos * duration;
    setCurrentTime(pos * duration);
  };

  const skipForward = () => {
    if (audioRef.current) audioRef.current.currentTime += 10;
  };

  const skipBackward = () => {
    if (audioRef.current) audioRef.current.currentTime -= 10;
  };

  // --- Effects ---

  // Volume control
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (chunksReady > 0) togglePlay();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        restart();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        onReset();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        skipForward();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        skipBackward();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, restart, onReset, chunksReady]);

  // --- Render ---

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={fadeUp}
      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {/* --- Player Card --- */}
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '28rem',
          padding: '1.5rem',
          borderRadius: '1.5rem',
          overflow: 'hidden',
        }}
      >
        {/* Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <IconButton icon={FileText} size={18} title="Document" />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{
              fontSize: '0.625rem',
              fontWeight: 700,
              letterSpacing: '0.15em',
              color: 'var(--faint)',
              textTransform: 'uppercase',
            }}>
              {isGenerating ? 'Synthesizing' : status === 'error' ? 'Error' : 'Ready'}
            </span>
          </div>
          <IconButton icon={X} onClick={onReset} title="Close" />
        </div>

        {/* --- Artwork Container --- */}
        <div style={{
          position: 'relative',
          aspectRatio: '1 / 1',
          width: '100%',
          maxWidth: '260px',
          margin: '0 auto 1.5rem',
        }}>
          {/* Glowing Shadow */}
          <div
            className={isPlaying ? 'animate-pulse-glow' : ''}
            style={{
              position: 'absolute',
              inset: '1.5rem',
              background: 'linear-gradient(to top right, var(--accent-muted), var(--accent-muted))',
              borderRadius: '1.5rem',
              filter: 'blur(1.5rem)',
              opacity: isPlaying ? 0.6 : 0.2,
              transition: 'opacity 700ms ease',
            }}
          />

          {/* Main Art Container */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: '1.5rem',
            overflow: 'hidden',
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            border: '1px solid var(--border)',
            background: 'var(--surface-elevated)',
          }}>
            {/* The Image (if available) */}
            {artworkUrl ? (
              <img
                src={artworkUrl}
                alt="Generated artwork"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transition: 'all 500ms ease-out',
                  opacity: isPlaying ? 1 : 0.85,
                  transform: isPlaying ? 'scale(1.05)' : 'scale(1)',
                }}
              />
            ) : (
              /* Placeholder with document icon */
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--surface)',
              }}>
                <FileText size={64} strokeWidth={1} style={{ color: 'var(--faint)' }} />
              </div>
            )}

            {/* State Overlays */}
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: artworkStatus === 'generating' || (isGenerating && !artworkUrl) ? 'rgba(0,0,0,0.5)' : 'transparent',
              transition: 'background 300ms ease',
            }}>
              <AnimatePresence mode="wait">
                {status === 'error' ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ textAlign: 'center', padding: '1rem' }}
                  >
                    <span style={{ color: 'var(--error)', fontSize: '0.875rem', fontWeight: 500 }}>
                      Generation Failed
                    </span>
                    <p style={{ fontSize: '0.625rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                      {error}
                    </p>
                  </motion.div>
                ) : (artworkStatus === 'generating' || (isGenerating && !artworkUrl)) ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}
                  >
                    <Sparkles className="animate-spin-slow" size={32} style={{ color: 'white' }} />
                    <span style={{
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.1em',
                      color: 'white',
                      textTransform: 'uppercase',
                    }}>
                      {status === 'extracting' ? 'Reading PDF...' : artworkStatus === 'generating' ? 'Creating artwork...' : 'Generating audio...'}
                    </span>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* --- Document Info --- */}
        <div style={{ marginBottom: '1.5rem', paddingLeft: '0.25rem', paddingRight: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                marginBottom: '0.125rem',
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                paddingRight: '1rem',
              }}>
                {displayName}
              </h2>
              <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted)' }}>
                {pageCount ? `${pageCount} Pages` : 'Document'}
                {chunksReady > 0 && ` · Part ${currentChunkIndex + 1}`}
              </p>
            </div>

            {/* Download Button */}
            {downloadUrl && (
              <a
                href={downloadUrl}
                download
                style={{
                  padding: '0.5rem',
                  background: 'var(--surface-elevated)',
                  borderRadius: '50%',
                  color: 'var(--muted)',
                  transition: 'all 150ms',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Download Full Audio"
              >
                <Download size={16} />
              </a>
            )}
          </div>
        </div>

        {/* --- Scrubber --- */}
        <div
          ref={progressRef}
          onClick={hasStartedPlayback ? handleSeek : undefined}
          onMouseEnter={() => setIsHoveringScrubber(true)}
          onMouseLeave={() => {
            setIsHoveringScrubber(false);
            setHoverPosition(null);
          }}
          onMouseMove={(e) => {
            if (progressRef.current && hasStartedPlayback) {
              const rect = progressRef.current.getBoundingClientRect();
              setHoverPosition(e.clientX - rect.left);
            }
          }}
          style={{
            position: 'relative',
            height: '2rem',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            marginBottom: '1rem',
            cursor: hasStartedPlayback ? 'pointer' : 'default',
          }}
        >
          {/* Track Background */}
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: isHoveringScrubber && hasStartedPlayback ? '0.5rem' : '0.25rem',
            background: 'var(--border)',
            borderRadius: '9999px',
            overflow: 'hidden',
            transition: 'height 150ms ease',
          }}>
            {/* Fill */}
            <div style={{
              height: '100%',
              borderRadius: '9999px',
              background: isGenerating ? 'var(--accent)' : 'var(--foreground)',
              opacity: isGenerating ? 0.5 : 1,
              width: isGenerating
                ? `${generationProgress}%`
                : `${duration ? (currentTime / duration) * 100 : 0}%`,
              transition: 'width 100ms linear',
            }} />
          </div>

          {/* Hover Tooltip */}
          {isHoveringScrubber && hoverPosition !== null && hasStartedPlayback && (
            <div style={{
              position: 'absolute',
              top: '-1.5rem',
              left: hoverPosition,
              transform: 'translateX(-50%)',
              background: 'var(--foreground)',
              color: 'var(--background)',
              fontSize: '0.625rem',
              fontWeight: 700,
              padding: '0.25rem 0.5rem',
              borderRadius: '0.375rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              pointerEvents: 'none',
            }}>
              {formatTime((hoverPosition / (progressRef.current?.clientWidth || 1)) * duration)}
            </div>
          )}

          {/* Time Labels */}
          <div style={{
            position: 'absolute',
            top: '1.25rem',
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.625rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 500,
            color: 'var(--faint)',
            opacity: hasStartedPlayback ? 1 : 0,
            transition: 'opacity 150ms ease',
          }}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* --- Main Controls --- */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}>
          <IconButton
            icon={RotateCcw}
            size={22}
            disabled={!hasStartedPlayback}
            onClick={skipBackward}
            title="Skip back 10s"
          />

          {/* Play Button */}
          <button
            onClick={togglePlay}
            disabled={!hasStartedPlayback}
            style={{
              position: 'relative',
              width: '4.5rem',
              height: '4.5rem',
              background: hasStartedPlayback ? 'var(--accent)' : 'var(--surface-elevated)',
              border: 'none',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: hasStartedPlayback ? 'pointer' : 'not-allowed',
              opacity: hasStartedPlayback ? 1 : 0.5,
              boxShadow: hasStartedPlayback ? '0 4px 20px rgba(0, 112, 243, 0.4)' : 'none',
              transition: 'all 200ms ease',
              color: hasStartedPlayback ? 'white' : 'var(--faint)',
            }}
            onMouseEnter={(e) => {
              if (hasStartedPlayback) {
                e.currentTarget.style.transform = 'scale(1.05)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {isPlaying ? (
              <Pause size={28} fill="currentColor" strokeWidth={0} />
            ) : (
              <Play size={28} fill="currentColor" strokeWidth={0} style={{ marginLeft: '3px' }} />
            )}
          </button>

          <IconButton
            icon={RotateCw}
            size={22}
            disabled={!hasStartedPlayback}
            onClick={skipForward}
            title="Skip forward 10s"
          />
        </div>

        {/* --- Volume / Footer --- */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          background: 'var(--surface-elevated)',
          borderRadius: '1rem',
          padding: '0.75rem',
          border: '1px solid var(--border)',
        }}>
          <button
            onClick={() => setIsMuted(!isMuted)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setVolume(val);
              if (audioRef.current) audioRef.current.volume = val;
              setIsMuted(val === 0);
            }}
            style={{
              flex: 1,
              height: '4px',
              background: 'var(--border)',
              borderRadius: '9999px',
              appearance: 'none',
              cursor: 'pointer',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '12px' }}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={isPlaying ? 'animate-music-bar' : ''}
                style={{
                  width: '3px',
                  background: 'var(--success)',
                  borderRadius: '9999px',
                  height: isPlaying ? '12px' : '3px',
                  animationDelay: `${i * 0.1}s`,
                  transition: 'height 300ms ease',
                }}
              />
            ))}
          </div>
        </div>

        {/* Keyboard hints */}
        <div style={{
          marginTop: '1rem',
          textAlign: 'center',
          fontSize: '0.625rem',
          color: 'var(--faint)',
          opacity: 0.7,
        }}>
          <span style={{ fontFamily: 'var(--font-mono)' }}>Space</span> play ·{' '}
          <span style={{ fontFamily: 'var(--font-mono)' }}>R</span> restart ·{' '}
          <span style={{ fontFamily: 'var(--font-mono)' }}>Esc</span> close
        </div>
      </div>

      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        onEnded={handleChunkEnd}
        onTimeUpdate={handleTimeUpdate}
        preload="auto"
      />
    </motion.div>
  );
}
