'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload } from '@/components/Upload';
import { Preview } from '@/components/Preview';
import { Player } from '@/components/Player';
import { StreamingPlayer } from '@/components/StreamingPlayer';
import { AlertCircle } from 'lucide-react';
import { fadeUp, fadeIn, transition } from '@/lib/motion';
import type { ProcessingResult } from '@/lib/types';

// Custom Phoenix Voice icon - elegant waveform
function PhoenixIcon({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      style={{ color: 'var(--muted)' }}
    >
      {/* Sound wave bars */}
      <rect x="8" y="20" width="3" height="8" rx="1.5" fill="currentColor" opacity="0.5" />
      <rect x="14" y="14" width="3" height="20" rx="1.5" fill="currentColor" opacity="0.7" />
      <rect x="20" y="8" width="3" height="32" rx="1.5" fill="currentColor" />
      <rect x="26" y="12" width="3" height="24" rx="1.5" fill="currentColor" opacity="0.8" />
      <rect x="32" y="16" width="3" height="16" rx="1.5" fill="currentColor" opacity="0.6" />
      <rect x="38" y="20" width="3" height="8" rx="1.5" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

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
        setResult({ jobId: id, status: 'failed', error: err.message });
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
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: '26rem' }}>
        {/* Header */}
        <motion.header
          style={{ textAlign: 'center', marginBottom: '2.5rem' }}
          initial="initial"
          animate="animate"
          variants={fadeUp}
        >
          <div style={{ marginBottom: '1rem' }}>
            <PhoenixIcon size={48} />
          </div>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              marginBottom: '0.5rem',
            }}
          >
            Phoenix Voice
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '1rem' }}>
            Transform documents into natural audio
          </p>
        </motion.header>

        {/* Main Content */}
        <AnimatePresence mode="wait">
          {/* Upload State */}
          {!jobId && !processing && !result && (
            <motion.div
              key="upload"
              initial="initial"
              animate="animate"
              exit={{ opacity: 0, y: -10 }}
              variants={fadeUp}
            >
              <Upload onUpload={handleUpload} />
            </motion.div>
          )}

          {/* Streaming Player */}
          {useStreaming && jobId && fileName && file && (
            <motion.div
              key="streaming-player"
              initial="initial"
              animate="animate"
              exit={{ opacity: 0 }}
              variants={fadeIn}
            >
              <StreamingPlayer
                documentId={jobId}
                fileName={fileName}
                file={file}
                onReset={reset}
              />
            </motion.div>
          )}

          {/* Standard Processing */}
          {!useStreaming && processing && (
            <motion.div
              key="processing"
              className="card"
              style={{ textAlign: 'center', padding: '3rem 2rem' }}
              initial="initial"
              animate="animate"
              exit={{ opacity: 0 }}
              variants={fadeIn}
            >
              <div className="spinner" style={{ margin: '0 auto 1rem' }} />
              <p style={{ fontWeight: 500, marginBottom: '0.375rem' }}>
                Processing {fileName}
              </p>
              <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
                This usually takes 30-60 seconds
              </p>
            </motion.div>
          )}

          {/* Standard Result */}
          {!useStreaming && result && result.status === 'complete' && (
            <motion.div
              key="result"
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
              initial="initial"
              animate="animate"
              exit={{ opacity: 0 }}
              variants={fadeUp}
            >
              <div className="card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '1.5rem',
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      {fileName}
                    </h2>
                    <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
                      Ready to listen
                    </p>
                  </div>
                  <button
                    onClick={reset}
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--muted)',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                    }}
                  >
                    New file
                  </button>
                </div>
                {result.preview &&
                  result.tableCount !== undefined &&
                  result.pageCount &&
                  result.cost && (
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
                <Player audioUrl={result.audioUrl} downloadUrl={result.downloadUrl} />
              )}
            </motion.div>
          )}

          {/* Error State */}
          {!useStreaming && result && result.status === 'failed' && (
            <motion.div
              key="error"
              className="card"
              style={{ borderColor: 'var(--error)' }}
              initial="initial"
              animate="animate"
              exit={{ opacity: 0 }}
              variants={fadeUp}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <AlertCircle
                  style={{
                    width: '1.25rem',
                    height: '1.25rem',
                    color: 'var(--error)',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                />
                <div>
                  <p style={{ fontWeight: 500, marginBottom: '0.375rem' }}>
                    Processing failed
                  </p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '1rem' }}>
                    {result.error || 'An error occurred'}
                  </p>
                  <button onClick={reset} className="primary" style={{ fontSize: '0.875rem' }}>
                    Try again
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <motion.footer
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: '0.75rem',
          color: 'var(--faint)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ ...transition, delay: 0.3 }}
      >
        Files auto-delete after 1 hour
      </motion.footer>
    </main>
  );
}
