import type { HTMLTable } from './html-tables';
import { parseHTMLTable, tableToMarkdown } from './html-tables';
import { chatCompletion } from './deepinfra-llm';

export async function narrateTable(table: HTMLTable): Promise<string> {
  // Parse HTML table to readable format
  const rows = parseHTMLTable(table.html);
  const markdown = tableToMarkdown(rows);

  // Create context-aware prompt
  const prompt = `You are narrating an audiobook/podcast. A listener cannot see the table, so you need to describe it naturally and conversationally.

Context before the table:
${table.contextBefore}

The table data:
${markdown}

Context after the table:
${table.contextAfter}

Instructions:
1. Describe what the table shows in 2-4 sentences
2. Highlight the most important insights or comparisons
3. Preserve key numbers and data points
4. Make it flow naturally as if you're explaining it to someone
5. Don't say "the table shows" - just describe it naturally as part of the narrative

Example style:
"Display 1 compares first-order and second-order technology beneficiaries across three eras. Automobile manufacturers in 1900 faced consolidation, but investing in suburbanization's big-box retail delivered 1,622x returns through Walmart. Similarly, Wi-Fi router makers commoditized, while Netflix returned 519x by capitalizing on streaming video."

Generate the narration (2-4 sentences):`;

  try {
    const narration = await chatCompletion(prompt, { maxTokens: 600 });
    return narration || markdown; // Fallback to raw table if empty
  } catch (error) {
    console.error('Table narration failed:', error);
    return markdown; // Fallback to raw table on error
  }
}

export async function narrateTables(tables: HTMLTable[]): Promise<Map<number, string>> {
  const narrations = new Map<number, string>();

  // Process tables in parallel (faster) with timeout protection
  const promises = tables.map(async (table) => {
    try {
      // Add 30-second timeout to prevent infinite hangs
      const narrationPromise = narrateTable(table);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Table narration timeout after 30s')), 30000)
      );

      const narration = await Promise.race([narrationPromise, timeoutPromise]);
      return { index: table.index, narration };
    } catch (error) {
      console.error(`Failed to narrate table ${table.index}:`, error);
      // Fallback: simple markdown representation
      const rows = parseHTMLTable(table.html);
      const markdown = tableToMarkdown(rows);
      return { index: table.index, narration: markdown };
    }
  });

  const results = await Promise.all(promises);
  results.forEach(({ index, narration }) => narrations.set(index, narration));

  return narrations;
}

export async function describeDisplay(displayText: string, context: string): Promise<string> {
  // For image/chart placeholders like "DISPLAY 1" or "DISPLAY 2"
  const prompt = `You are narrating an audiobook. The listener cannot see the visual, so describe what it shows based on the context.

Context around the visual:
${context}

Visual element mentioned:
${displayText}

Generate a 1-2 sentence description that flows naturally in the narrative. Don't say "the image shows" - just describe it as if you're explaining it conversationally.

Example: "Display 1 presents a timeline comparing technology adoption across three eras, showing how second-order investments in Walmart and Netflix dramatically outperformed first-order hardware manufacturers."

Narration:`;

  try {
    const narration = await chatCompletion(prompt, { maxTokens: 300 });
    return narration || displayText; // Fallback if empty
  } catch (error) {
    console.error('Display description failed:', error);
    return displayText; // Fallback on error
  }
}
