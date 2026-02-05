import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';

const execAsync = promisify(exec);
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const DEEPINFRA_API_URL = 'https://api.deepinfra.com/v1/openai/chat/completions';
const PDFTOPPM_BIN = process.env.PDFTOPPM_PATH || '/opt/homebrew/opt/poppler-qt5/bin/pdftoppm';

interface DeepInfraMessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

interface DeepInfraChoice {
  message?: {
    content?:
      | string
      | Array<{ type: 'text'; text: string } | { type: string; [key: string]: unknown }>;
  };
}

interface DeepInfraResponse {
  choices?: DeepInfraChoice[];
}

function requireApiKey(): string {
  const key = process.env.DEEPINFRA_API_KEY;
  if (!key) {
    throw new Error('DEEPINFRA_API_KEY is not set');
  }
  return key;
}

async function renderPdfToPng(pdfPath: string, prefix: string): Promise<string[]> {
  // Render all pages to PNG files (150 DPI for speed/quality tradeoff)
  const renderCmd = `"${PDFTOPPM_BIN}" -png -r 150 "${pdfPath}" "${prefix}"`;
  try {
    await execAsync(renderCmd, { maxBuffer: 50 * 1024 * 1024 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`pdftoppm failed: ${message}`);
  }

  const dir = dirname(prefix);
  const base = prefix.split('/').pop() || 'page';
  const files = (await readdir(dir))
    .filter(name => name.startsWith(base) && name.endsWith('.png'))
    .sort();

  return files.map(file => join(dir, file));
}

async function ocrImage(base64: string, apiKey: string): Promise<string> {
  const body = {
    model: 'deepseek-ai/DeepSeek-OCR',
    max_tokens: 4092,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'You are an OCR engine. Transcribe every visible character from this page. Preserve reading order. For tables, output valid HTML table markup (<table><tr><td>).</table>). Do not summarize; return only raw text/HTML.',
          } satisfies DeepInfraMessageContent,
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${base64}`,
            },
          } satisfies DeepInfraMessageContent,
        ],
      },
    ],
  };

  const res = await fetch(DEEPINFRA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    const snippet = text.slice(0, 500);

    if (res.status === 402) {
      throw new Error('DeepInfra requires positive balance to run OCR (HTTP 402)');
    }
    if (res.status === 401) {
      throw new Error('DeepInfra API key rejected (HTTP 401)');
    }

    throw new Error(`DeepInfra returned ${res.status}: ${snippet}`);
  }

  const json = (await res.json()) as DeepInfraResponse;
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepInfra response missing content');

  // Handle either a raw string or an array of content blocks.
  if (typeof content === 'string') {
    let text = content.trim();
    if (!text) throw new Error('DeepInfra returned empty OCR text');

    // Strip CSS artifacts that DeepSeek sometimes extracts from styled PDFs
    // Common patterns: "0.5em", "1px", "10pt", margin/padding values
    const cssPattern = /\b\d+(\.\d+)?(em|px|pt|rem|vh|vw|%)\b/gi;
    const cssMatches = text.match(cssPattern) || [];

    // If >50% of content looks like CSS units, strip them
    const cssCharCount = cssMatches.join('').length;
    if (cssCharCount > text.length * 0.3) {
      console.warn(`[DeepInfra] Detected CSS artifacts (${cssMatches.length} patterns, ${Math.round(cssCharCount/text.length*100)}% of text), stripping...`);
      text = text.replace(cssPattern, '').replace(/\s+/g, ' ').trim();
    }

    // Also strip standalone CSS-like repeated patterns (0.5em 0.5em 0.5em...)
    text = text.replace(/(\d+(\.\d+)?em\s*){3,}/gi, '').trim();

    if (!text) throw new Error('DeepInfra returned empty OCR text after CSS stripping');

    // Detect likely garbage/corrupted output
    if (text.length < 100) {
      const repeatingPattern = /^(.{2,10})\1{3,}$/; // Same pattern repeated 4+ times
      if (repeatingPattern.test(text)) {
        console.warn(`[DeepInfra] Suspicious repeating OCR output: "${text.slice(0, 50)}..."`);
        throw new Error('DeepInfra OCR returned likely corrupted output (repeating pattern)');
      }
      // Very short text with only numbers/units is suspicious
      if (/^[\d.mMkKbB%\s]+$/.test(text)) {
        console.warn(`[DeepInfra] Suspicious numeric-only OCR output: "${text}"`);
        throw new Error('DeepInfra OCR returned likely corrupted output (numeric only)');
      }
    }

    return text;
  }

  const textBlocks = content
    .filter(block => block && block.type === 'text' && typeof (block as any).text === 'string')
    .map(block => (block as { type: 'text'; text: string }).text.trim())
    .filter(Boolean);

  if (textBlocks.length === 0) {
    throw new Error('DeepInfra returned empty OCR text');
  }

  return textBlocks.join('\n');
}

export async function extractPdfWithDeepInfra(pdfPath: string, jobId: string): Promise<{
  markdown: string;
  pageCount: number;
}> {
  const apiKey = requireApiKey();
  const prefix = join('/tmp', `${jobId || 'pdf'}-page`);
  const MAX_PAGE_RETRIES = 2;
  const pageSummaries: string[] = [];

  // Convert PDF pages to PNGs
  const images = await renderPdfToPng(pdfPath, prefix);
  if (images.length === 0) {
    throw new Error('No pages rendered for OCR');
  }

  // OCR each page sequentially to stay within rate limits
  const pageTexts: string[] = [];
  for (let i = 0; i < images.length; i++) {
    const imgPath = images[i];
    const base64 = (await readFile(imgPath)).toString('base64');
    console.log(`[DeepInfra] OCR page ${i + 1}/${images.length}`);
    let text = '';

    for (let attempt = 1; attempt <= MAX_PAGE_RETRIES; attempt++) {
      try {
        text = await ocrImage(base64, apiKey);
        if (text.trim()) {
          break;
        }
        console.warn(`[DeepInfra] Page ${i + 1} empty (attempt ${attempt}/${MAX_PAGE_RETRIES})`);
      } catch (err) {
        console.warn(`[DeepInfra] Page ${i + 1} failed (attempt ${attempt}/${MAX_PAGE_RETRIES}):`, (err as Error).message);
        if (attempt === MAX_PAGE_RETRIES) {
          throw err;
        }
      }
      await sleep(500 * attempt);
    }

    pageSummaries.push(`p${i + 1}:${text.trim().length}`);
    pageTexts.push(text);
  }

  const joined = pageTexts.join('\n\n<--- Page Split --->\n\n');
  if (!joined.trim()) {
    throw new Error('DeepInfra returned empty OCR text for all pages');
  }

  console.log(`[DeepInfra] OCR complete: ${images.length} pages, ${joined.length} chars; per-page lens: ${pageSummaries.slice(0, 20).join(',')}...`);
  return { markdown: joined, pageCount: images.length };
}
