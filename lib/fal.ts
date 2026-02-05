/**
 * Fal.ai integration for generating document cover artwork
 * Uses Nano Banana model to create manuscript-style illustrations
 */

import { fal } from '@fal-ai/client';
import { chatCompletion } from './deepinfra-llm';

// Cost per image (Nano Banana Pro)
export const FAL_COST_PER_IMAGE = 0.15;

// Configure Fal.ai client
if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY });
}

export interface ArtworkResult {
  imageData: string;  // base64-encoded image
  mimeType: 'image/png' | 'image/jpeg';
  prompt: string;
  cost: number;
}

/**
 * Extract a concise theme from document text using DeepInfra Llama
 */
async function extractDocumentTheme(documentText: string): Promise<string> {
  const prompt = `In 5-10 words, describe the main theme/subject of this document for an artist to illustrate. Be specific and visual - mention concrete objects, scenes, or concepts that can be drawn.

Document excerpt:
${documentText.slice(0, 2000)}

Theme (5-10 words):`;

  const response = await chatCompletion(prompt, { maxTokens: 60 });
  return response || 'abstract document concept';
}

/**
 * Build the image generation prompt with consistent style
 */
function buildArtworkPrompt(theme: string): string {
  return `Minimalist hand-drawn manuscript sketch, elegant ink illustration on aged cream paper. Subject: ${theme}. Style: Whimsical delicate linework, single cohesive scene, absolutely no text or words or letters, subtle sepia and warm earth tones, artistic and sophisticated, fine art quality. Square composition, centered subject, plenty of negative space.`;
}

/**
 * Generate cover artwork for a document using Fal.ai Nano Banana
 */
export async function generateDocumentArtwork(
  cleanText: string,
  pageCount: number
): Promise<ArtworkResult> {
  // Check for API key
  if (!process.env.FAL_KEY) {
    throw new Error('FAL_KEY environment variable not set');
  }

  console.log(`[fal] Generating artwork for ${pageCount}-page document...`);
  const startTime = Date.now();

  // Step 1: Extract theme from document
  const theme = await extractDocumentTheme(cleanText);
  console.log(`[fal] Extracted theme: "${theme}"`);

  // Step 2: Build consistent style prompt
  const prompt = buildArtworkPrompt(theme);
  console.log(`[fal] Full prompt: "${prompt.slice(0, 100)}..."`);

  // Step 3: Generate image via Fal.ai Nano Banana Pro
  const result = await fal.subscribe('fal-ai/nano-banana-pro', {
    input: {
      prompt,
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === 'IN_PROGRESS' && update.logs) {
        update.logs.map((log) => log.message).forEach((msg) => console.log(`[fal] ${msg}`));
      }
    },
  });

  // Step 4: Fetch image and convert to base64
  const imageUrl = result.data?.images?.[0]?.url;
  if (!imageUrl) {
    throw new Error('Fal.ai returned no image URL');
  }

  console.log(`[fal] Image generated, fetching from URL...`);

  // Fetch the image and convert to base64
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch generated image: ${imageResponse.status}`);
  }

  const imageBuffer = await imageResponse.arrayBuffer();
  const imageData = Buffer.from(imageBuffer).toString('base64');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[fal] Artwork complete in ${elapsed}s (${(imageData.length / 1024).toFixed(0)}KB)`);

  return {
    imageData,
    mimeType: 'image/png',
    prompt,
    cost: FAL_COST_PER_IMAGE,
  };
}

/**
 * Generate artwork with timeout protection (default 30 seconds)
 */
export async function generateDocumentArtworkWithTimeout(
  cleanText: string,
  pageCount: number,
  timeoutMs: number = 30000
): Promise<ArtworkResult> {
  const artworkPromise = generateDocumentArtwork(cleanText, pageCount);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Artwork generation timeout after ${timeoutMs}ms`)), timeoutMs)
  );

  return Promise.race([artworkPromise, timeoutPromise]);
}
