/**
 * DeepInfra LLM integration for text and vision tasks
 * Replaces Anthropic Claude with DeepInfra-hosted models
 */

import OpenAI from 'openai';

// Models
const TEXT_MODEL = 'meta-llama/Llama-3.3-70B-Instruct-Turbo';
const VISION_MODEL = 'meta-llama/Llama-3.2-11B-Vision-Instruct';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.DEEPINFRA_API_KEY || process.env.DEEPINFRA_TTS_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPINFRA_API_KEY not set');
    }
    client = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepinfra.com/v1/openai',
    });
  }
  return client;
}

/**
 * Text chat completion using Llama 3.3 70B
 */
export async function chatCompletion(
  prompt: string,
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const { maxTokens = 500, temperature = 0.7 } = options;

  const response = await getClient().chat.completions.create({
    model: TEXT_MODEL,
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.choices[0]?.message?.content?.trim() || '';
}

/**
 * Vision chat completion using Llama 3.2 11B Vision
 */
export async function visionCompletion(
  imageBase64: string,
  prompt: string,
  options: { maxTokens?: number } = {}
): Promise<string> {
  const { maxTokens = 150 } = options;

  const response = await getClient().chat.completions.create({
    model: VISION_MODEL,
    max_tokens: maxTokens,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: `data:image/png;base64,${imageBase64}` },
        },
        { type: 'text', text: prompt },
      ],
    }],
  });

  return response.choices[0]?.message?.content?.trim() || '';
}
