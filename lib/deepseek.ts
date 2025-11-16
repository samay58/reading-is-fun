import { readFile } from 'fs/promises';

const DEEPSEEK_API_URL = 'https://api.alphaxiv.org/models/v1/deepseek/deepseek-ocr/inference';

export async function extractPDF(pdfPath: string): Promise<{
  markdown: string;
  pageCount: number;
}> {
  try {
    // Read the PDF file
    const fileBuffer = await readFile(pdfPath);
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });

    // Create form data
    const formData = new FormData();
    formData.append('file', blob, pdfPath.split('/').pop() || 'document.pdf');

    // Call DeepSeek OCR via alphaxiv API (FREE, no auth needed!)
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();

    // Extract OCR text and metadata
    const markdown = data.data?.ocr_text || '';
    const pageCount = data.data?.num_pages || 1;

    if (!markdown || markdown.trim().length === 0) {
      throw new Error('DeepSeek returned empty text');
    }

    console.log(`DeepSeek OCR: ${pageCount} pages, ${markdown.length} chars`);

    return { markdown, pageCount };
  } catch (error: any) {
    throw new Error(`DeepSeek OCR extraction failed: ${error?.message || 'Unknown error'}`);
  }
}
