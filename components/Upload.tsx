'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload as UploadIcon, FileText, Check, Loader2, AlertCircle } from 'lucide-react';
import { transition } from '@/lib/motion';

interface UploadProps {
  onUpload: (jobId: string, fileName: string, file?: File) => void;
}

export function Upload({ onUpload }: UploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLocal = process.env.NODE_ENV !== 'production';
  const maxFileMB = isLocal
    ? parseInt(
        process.env.NEXT_PUBLIC_MAX_UPLOAD_MB_DEV ||
          process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ||
          '250',
        10
      )
    : parseInt(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || '10', 10);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);
      setUploadSuccess(false);
      setFileName(file.name);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Upload failed');
        }

        setUploadSuccess(true);
        setTimeout(() => {
          onUpload(data.jobId, data.fileName, file);
        }, 400);
      } catch (err: any) {
        setError(err.message);
        setUploading(false);
        setFileName(null);
      }
    },
    [onUpload]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    },
    [handleFile]
  );

  return (
    <div style={{ width: '100%' }}>
      {/* Upload Card */}
      <div
        className="card"
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        style={{
          cursor: uploading ? 'default' : 'pointer',
          borderColor: dragActive ? 'var(--accent)' : error ? 'var(--error)' : uploadSuccess ? 'var(--success)' : undefined,
          transition: 'border-color 150ms ease',
          pointerEvents: uploading ? 'none' : 'auto',
        }}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          disabled={uploading}
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        />

        {/* Content */}
        <div
          style={{
            padding: '3rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <AnimatePresence mode="wait">
            {/* Idle State */}
            {!uploading && !uploadSuccess && (
              <motion.div
                key="idle"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={transition}
              >
                <div
                  style={{
                    width: '3.5rem',
                    height: '3.5rem',
                    marginBottom: '1.5rem',
                    borderRadius: '9999px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: dragActive ? 'var(--accent-muted)' : 'var(--surface-elevated)',
                    transition: 'background-color 150ms ease',
                  }}
                >
                  <UploadIcon
                    style={{
                      width: '1.5rem',
                      height: '1.5rem',
                      color: dragActive ? 'var(--accent)' : 'var(--muted)',
                    }}
                    strokeWidth={1.5}
                  />
                </div>
                <p style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                  {dragActive ? 'Drop to upload' : 'Drop your PDF here'}
                </p>
                <p style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '1.25rem' }}>
                  or click to browse
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--faint)' }}>
                  PDF up to {maxFileMB}MB
                </p>
              </motion.div>
            )}

            {/* Uploading State */}
            {uploading && !uploadSuccess && (
              <motion.div
                key="uploading"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={transition}
              >
                <div
                  style={{
                    width: '3.5rem',
                    height: '3.5rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Loader2
                    style={{
                      width: '1.75rem',
                      height: '1.75rem',
                      color: 'var(--accent)',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                </div>
                <p style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                  Uploading...
                </p>
                <p
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--muted)',
                    fontFamily: 'var(--font-mono)',
                    maxWidth: '16rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {fileName}
                </p>
              </motion.div>
            )}

            {/* Success State */}
            {uploadSuccess && (
              <motion.div
                key="success"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={transition}
              >
                <div
                  style={{
                    width: '3.5rem',
                    height: '3.5rem',
                    marginBottom: '1.5rem',
                    borderRadius: '9999px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0, 200, 83, 0.1)',
                  }}
                >
                  <Check style={{ width: '1.5rem', height: '1.5rem', color: 'var(--success)' }} />
                </div>
                <p style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                  Ready
                </p>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    color: 'var(--muted)',
                  }}
                >
                  <FileText style={{ width: '1rem', height: '1rem' }} />
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      maxWidth: '12rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {fileName}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              backgroundColor: 'rgba(255, 68, 68, 0.1)',
              border: '1px solid var(--error)',
            }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle
                style={{ width: '1rem', height: '1rem', color: 'var(--error)', flexShrink: 0 }}
              />
              <p style={{ fontSize: '0.875rem', color: 'var(--error)' }}>{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
