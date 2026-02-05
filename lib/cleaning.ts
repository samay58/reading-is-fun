import type { HTMLTable } from './html-tables';
import { cleanDeepSeekOutput, prepareForNarration, removeLowValueSections } from './text-cleaner';
import type { ImageNarration } from './images';
import { injectImageNarrations } from './images';

export function replaceTablesWithNarrations(
  text: string,
  tables: HTMLTable[],
  narrations: Map<number, string>
): string {
  let result = text;

  // Replace tables from end to start (to preserve positions)
  const sortedTables = [...tables].sort((a, b) => b.startPos - a.startPos);

  for (const table of sortedTables) {
    const narration = narrations.get(table.index);
    if (narration) {
      // Replace HTML table with natural narration
      const before = result.slice(0, table.startPos);
      const after = result.slice(table.endPos);

      result = before + `\n\n${narration}\n\n` + after;
    }
  }

  return result;
}

export function processDeepSeekText(
  rawText: string,
  tables: HTMLTable[],
  tableNarrations: Map<number, string>,
  imageNarrations: ImageNarration[] = []
): string {
  let processed = rawText;

  // Step 0: Insert image narrations near their pages before any other transforms
  if (imageNarrations.length > 0) {
    processed = injectImageNarrations(processed, imageNarrations);
  }

  // Step 1: Replace HTML tables with narrations
  processed = replaceTablesWithNarrations(processed, tables, tableNarrations);

  // Step 2: Clean DeepSeek artifacts and scratch text
  processed = cleanDeepSeekOutput(processed);

  // Step 3: Remove low-value/admin sections that don't help the listener
  processed = removeLowValueSections(processed);

  // Step 4: Prepare for narration (expand abbreviations, etc.)
  processed = prepareForNarration(processed);

  // Safety: if cleaning removes too much, fall back to the raw OCR text
  // Check both empty and suspiciously short (less than 10% of original)
  if (!processed.trim()) {
    console.warn('[Cleaning] Clean text empty after processing, falling back to raw OCR text');
    processed = rawText;
  } else if (processed.length < rawText.length * 0.1 && rawText.length > 200) {
    console.warn(`[Cleaning] Clean text suspiciously short (${processed.length} vs ${rawText.length} chars, ${Math.round(processed.length/rawText.length*100)}%), falling back to raw OCR text`);
    processed = rawText;
  }

  return processed;
}

// Keep old function for backward compatibility
export function replaceTablesWithSummaries(
  markdown: string,
  tables: any[],
  summaries: Map<number, string>
): string {
  // Legacy function - not used with DeepSeek
  return markdown;
}
