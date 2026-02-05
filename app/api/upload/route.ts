import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

const isLocalDev = process.env.NODE_ENV === 'development' || !process.env.VERCEL;

// Allow generous uploads locally for large PDFs (e.g., situational awareness doc),
// keep a safer ceiling in production. Can be overridden with env vars.
const DEV_MAX_FILE_MB = parseInt(process.env.MAX_UPLOAD_MB_DEV || process.env.MAX_UPLOAD_MB || '250', 10);
const PROD_MAX_FILE_MB = parseInt(process.env.MAX_UPLOAD_MB || '10', 10);
const MAX_FILE_SIZE = (isLocalDev ? DEV_MAX_FILE_MB : PROD_MAX_FILE_MB) * 1024 * 1024;

const ALLOWED_TYPE = 'application/pdf';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (file.type !== ALLOWED_TYPE) {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size: ${Math.floor(MAX_FILE_SIZE / (1024 * 1024))}MB` },
        { status: 400 }
      );
    }

    // Generate unique job ID
    const jobId = randomUUID();

    // Save to /tmp
    const buffer = Buffer.from(await file.arrayBuffer());
    const tmpPath = join('/tmp', `${jobId}.pdf`);
    await writeFile(tmpPath, buffer);

    return NextResponse.json({
      jobId,
      fileName: file.name,
      fileSize: file.size,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
