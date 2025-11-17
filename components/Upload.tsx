'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Upload as UploadIcon, CheckCircle } from 'lucide-react';

interface UploadProps {
  onUpload: (jobId: string, fileName: string, file?: File) => void;
}

export function Upload({ onUpload }: UploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setUploading(true);
    setUploadSuccess(false);

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
      }, 500);
    } catch (err: any) {
      setError(err.message);
      setUploading(false);
    }
  }, [onUpload]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  return (
    <div className="upload-container">
      <div
        className={`
          card cursor-pointer transition-colors
          ${dragActive ? 'border-[var(--accent)]' : ''}
          ${uploading ? 'pointer-events-none opacity-50' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          disabled={uploading}
          className="sr-only"
        />

        <div className="text-center py-8">
          {!uploading && !uploadSuccess && (
            <>
              <UploadIcon className="w-8 h-8 mx-auto mb-4 text-muted" strokeWidth={1.5} />
              <h3 className="text-lg font-medium mb-1">
                {dragActive ? 'Drop your PDF here' : 'Upload your PDF'}
              </h3>
              <p className="text-sm text-muted mb-4">
                Drag and drop or click to browse
              </p>
              <div className="flex items-center justify-center gap-4 text-xs text-muted">
                <span>Max 40 pages</span>
                <span>•</span>
                <span>10MB limit</span>
              </div>
            </>
          )}

          {uploading && !uploadSuccess && (
            <>
              <div className="spinner mx-auto mb-4" />
              <p className="font-medium">Uploading...</p>
              <p className="text-sm text-muted">
                Preparing your document for processing
              </p>
            </>
          )}

          {uploadSuccess && (
            <>
              <CheckCircle className="w-8 h-8 mx-auto mb-4 text-[var(--success)]" />
              <p className="font-medium">Upload Complete!</p>
              <p className="text-sm text-muted">
                Starting audio processing...
              </p>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 border border-[var(--error)] rounded-lg bg-red-50 dark:bg-red-950/20">
          <p className="text-sm text-[var(--error)]">{error}</p>
        </div>
      )}
    </div>
  );
}