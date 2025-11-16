'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Download } from 'lucide-react';

interface PlayerProps {
  audioUrl: string;
  downloadUrl: string;
}

export function Player({ audioUrl, downloadUrl }: PlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  function play() {
    if (audioRef.current) {
      audioRef.current.play();
      setPlaying(true);
    }
  }

  function pause() {
    if (audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
    }
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="card">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <div className="flex flex-col gap-4">
        {/* Main controls */}
        <div className="flex gap-3">
          <button
            onClick={() => (playing ? pause() : play())}
            className="flex-1 primary"
          >
            {playing ? (
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

          <a
            href={downloadUrl}
            download
            className="inline-flex items-center gap-2 px-4 py-3 border border-[var(--border)] rounded-lg hover:border-[var(--accent)] transition-colors"
          >
            <Download className="w-5 h-5" />
            <span>Download</span>
          </a>
        </div>

        {/* Progress bar */}
        {duration > 0 && (
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted">{formatTime(currentTime)}</span>
              <span className="text-muted">{formatTime(duration - currentTime)} remaining</span>
            </div>
            <div className="progress">
              <div
                className="progress-bar"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Status message */}
        {playing && (
          <p className="text-sm text-center text-muted">
            Playing...
          </p>
        )}
      </div>
    </div>
  );
}