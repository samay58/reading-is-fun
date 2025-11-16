'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface AudioVisualizerProps {
  isPlaying: boolean;
  audioElement?: HTMLAudioElement | null;
  className?: string;
}

export function AudioVisualizer({ isPlaying, audioElement, className = '' }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [bars, setBars] = useState<number[]>(Array(12).fill(0));

  useEffect(() => {
    if (!audioElement || !canvasRef.current) {
      // Fallback to fake visualization
      if (isPlaying) {
        const interval = setInterval(() => {
          setBars(Array(12).fill(0).map(() => Math.random()));
        }, 150);
        return () => clearInterval(interval);
      } else {
        setBars(Array(12).fill(0.1));
      }
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create audio context and analyzer
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;

    try {
      const source = audioContext.createMediaElementSource(audioElement);
      source.connect(analyser);
      analyser.connect(audioContext.destination);
    } catch (e) {
      // Element already connected, use fake visualization
      if (isPlaying) {
        const interval = setInterval(() => {
          setBars(Array(12).fill(0).map(() => Math.random()));
        }, 150);
        return () => clearInterval(interval);
      }
      return;
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isPlaying) {
        setBars(Array(12).fill(0.1));
        return;
      }

      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      // Sample 12 bars from the frequency data
      const barCount = 12;
      const barData: number[] = [];
      const step = Math.floor(bufferLength / barCount);

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step] / 255;
        barData.push(value);
      }

      setBars(barData);
    };

    if (isPlaying) {
      draw();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, audioElement]);

  return (
    <div className={`flex items-center justify-center gap-1 h-16 ${className}`}>
      {bars.map((height, index) => (
        <motion.div
          key={index}
          className="w-1 bg-gradient-to-t from-purple-500 to-pink-500 rounded-full"
          animate={{
            height: `${Math.max(8, height * 64)}px`,
            opacity: isPlaying ? 0.8 : 0.3,
          }}
          transition={{
            height: { duration: 0.1, ease: 'easeOut' },
            opacity: { duration: 0.2 },
          }}
          style={{
            boxShadow: isPlaying ? '0 0 10px rgba(139, 92, 246, 0.5)' : 'none',
          }}
        />
      ))}
      <canvas ref={canvasRef} className="hidden" width={0} height={0} />
    </div>
  );
}

export function SimpleVisualizer({ isPlaying }: { isPlaying: boolean }) {
  const barCount = 5;
  const [animationDelays] = useState(() =>
    Array(barCount)
      .fill(0)
      .map(() => Math.random() * 0.3)
  );

  return (
    <div className="flex items-center justify-center gap-1.5 h-8">
      {Array(barCount)
        .fill(0)
        .map((_, index) => (
          <motion.div
            key={index}
            className="w-1 bg-gradient-to-t from-purple-500 to-pink-500 rounded-full"
            animate={
              isPlaying
                ? {
                    height: [8, 24, 8],
                    opacity: [0.5, 1, 0.5],
                  }
                : {
                    height: 8,
                    opacity: 0.3,
                  }
            }
            transition={
              isPlaying
                ? {
                    height: {
                      duration: 1,
                      repeat: Infinity,
                      repeatType: 'loop',
                      ease: 'easeInOut',
                      delay: animationDelays[index],
                    },
                    opacity: {
                      duration: 1,
                      repeat: Infinity,
                      repeatType: 'loop',
                      ease: 'easeInOut',
                      delay: animationDelays[index],
                    },
                  }
                : {
                    duration: 0.3,
                  }
            }
          />
        ))}
    </div>
  );
}