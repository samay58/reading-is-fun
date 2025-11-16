import type { Table } from './types';

export function detectTables(markdown: string): Table[] {
  const lines = markdown.split('\n');
  const tables: Table[] = [];
  let inTable = false;
  let tableStart = -1;
  let tableLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Table delimiter: |---|---| or |:---|:---|
    if (line.match(/^\s*\|[\s\-:]+\|/)) {
      if (!inTable) {
        inTable = true;
        tableStart = i > 0 && lines[i - 1].match(/^\s*\|/) ? i - 1 : i;
        if (tableStart < i) {
          tableLines.push(lines[i - 1]); // Include header row
        }
      }
      tableLines.push(line);
    } else if (inTable && line.match(/^\s*\|/)) {
      // Table data row
      tableLines.push(line);
    } else if (inTable) {
      // End of table
      tables.push({
        index: tables.length,
        markdown: tableLines.join('\n'),
        startLine: tableStart,
        endLine: i - 1,
      });
      inTable = false;
      tableStart = -1;
      tableLines = [];
    }
  }

  // Handle table at end of document
  if (inTable && tableLines.length > 0) {
    tables.push({
      index: tables.length,
      markdown: tableLines.join('\n'),
      startLine: tableStart,
      endLine: lines.length - 1,
    });
  }

  return tables;
}

export function isSimpleTable(tableMarkdown: string): boolean {
  // Simple tables (2x2 or smaller) don't need summarization
  const rows = tableMarkdown.split('\n').filter(line => line.trim().startsWith('|'));
  const cols = rows[0]?.split('|').filter(c => c.trim()).length || 0;
  return rows.length <= 3 && cols <= 2;
}
