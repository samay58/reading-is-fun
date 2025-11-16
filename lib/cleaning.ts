import type { HTMLTable } from './html-tables';
import { cleanDeepSeekOutput, prepareForNarration } from './text-cleaner';

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
  tableNarrations: Map<number, string>
): string {
  let processed = rawText;

  // Step 1: Replace HTML tables with narrations
  processed = replaceTablesWithNarrations(processed, tables, tableNarrations);

  // Step 2: Clean DeepSeek artifacts and scratch text
  processed = cleanDeepSeekOutput(processed);

  // Step 3: Prepare for narration (expand abbreviations, etc.)
  processed = prepareForNarration(processed);

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
