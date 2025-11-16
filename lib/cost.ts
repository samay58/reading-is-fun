export function estimateCost(pageCount: number, tableCount: number = 0) {
  const charsPerPage = 1000; // Conservative estimate
  const totalChars = pageCount * charsPerPage;

  // Actual table count used if provided, otherwise estimate ~0.2 tables/page
  const tables = tableCount > 0 ? tableCount : Math.ceil(pageCount * 0.2);

  return {
    parsing: 0, // DeepSeek OCR is FREE
    tables: tables * 0.015, // Claude Haiku per table
    tts: (totalChars / 1000) * 0.030, // OpenAI tts-1-hd
    total: (tables * 0.015) + ((totalChars / 1000) * 0.030),
  };
}

export function calculateExactCost(charCount: number, tableCount: number) {
  return {
    parsing: 0, // DeepSeek OCR is FREE
    tables: tableCount * 0.015, // Claude Haiku per table ($0.015/table)
    tts: (charCount / 1000) * 0.030, // OpenAI tts-1-hd ($0.030/1K chars)
    total: (tableCount * 0.015) + ((charCount / 1000) * 0.030),
  };
}

export function estimateAudioDuration(charCount: number): number {
  // Estimate audio duration in seconds
  // Assumptions:
  // - 150 words per minute (standard narration speed)
  // - Average 5 characters per word
  // - Speed is 1.1x (10% faster)

  const wordsPerMinute = 150 * 1.1; // Adjusted for 1.1x speed
  const charsPerMinute = wordsPerMinute * 5;
  const minutes = charCount / charsPerMinute;

  return Math.ceil(minutes * 60); // Return seconds
}

export function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

export function estimateProcessingTime(pageCount: number, tableCount: number = 0): number {
  // Rough estimates in seconds
  const extraction = pageCount * 2; // ~2s per page for marker-pdf
  const tableSummaries = tableCount * 3; // ~3s per table for Claude
  const tts = pageCount * 3; // ~3s per page for TTS generation

  return extraction + tableSummaries + tts;
}
