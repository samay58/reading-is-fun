#!/usr/bin/env node
/**
 * Local helper to push a PDF through the batch API without the UI.
 * Usage: node process-local.js /path/to/file.pdf [http://localhost:3000]
 */

import { readFile } from 'fs/promises';
import { basename } from 'path';

const [filePath, hostArg] = process.argv.slice(2);
const host = hostArg || process.env.PDF_VOICE_HOST || 'http://localhost:3000';

async function main() {
  if (!filePath) {
    console.error('Usage: node process-local.js /path/to/file.pdf [host]');
    process.exit(1);
  }

  const buffer = await readFile(filePath);
  const fileName = basename(filePath);
  const file = new File([buffer], fileName, { type: 'application/pdf' });
  const formData = new FormData();
  formData.append('file', file);

  console.log(`Uploading ${fileName} to ${host}...`);
  const uploadRes = await fetch(`${host}/api/upload`, {
    method: 'POST',
    body: formData,
  });
  const uploadData = await uploadRes.json();
  if (!uploadRes.ok) {
    console.error('Upload failed:', uploadData);
    process.exit(1);
  }

  const jobId = uploadData.jobId;
  console.log(`Job ${jobId} created, starting processing...`);

  const processRes = await fetch(`${host}/api/process/${jobId}`, {
    method: 'POST',
  });
  const processData = await processRes.json();

  console.log('Process response:', JSON.stringify(processData, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
