export interface HTMLTable {
  index: number;
  html: string;
  contextBefore: string; // 2 paragraphs before for context
  contextAfter: string;  // 1 paragraph after
  startPos: number;
  endPos: number;
}

export function extractHTMLTables(text: string): HTMLTable[] {
  const tables: HTMLTable[] = [];
  const tableRegex = /<table>[\s\S]*?<\/table>/gi;
  let match;

  while ((match = tableRegex.exec(text)) !== null) {
    const tableHTML = match[0];
    const startPos = match.index;
    const endPos = startPos + tableHTML.length;

    // Extract context (text before and after table)
    const before = text.slice(Math.max(0, startPos - 1000), startPos);
    const after = text.slice(endPos, Math.min(text.length, endPos + 500));

    // Get last 2 paragraphs before table
    const paragraphsBefore = before.split('\n\n').filter(p => p.trim().length > 0);
    const contextBefore = paragraphsBefore.slice(-2).join('\n\n');

    // Get first paragraph after table
    const paragraphsAfter = after.split('\n\n').filter(p => p.trim().length > 0);
    const contextAfter = paragraphsAfter[0] || '';

    tables.push({
      index: tables.length,
      html: tableHTML,
      contextBefore,
      contextAfter,
      startPos,
      endPos,
    });
  }

  return tables;
}

export function parseHTMLTable(html: string): string[][] {
  // Simple HTML table parser - extract rows and cells
  const rows: string[][] = [];

  // Extract all <tr> elements
  const trRegex = /<tr>([\s\S]*?)<\/tr>/gi;
  let trMatch;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowHTML = trMatch[1];
    const cells: string[] = [];

    // Extract <td> or <th> cells
    const cellRegex = /<t[dh].*?>(.*?)<\/t[dh]>/gi;
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowHTML)) !== null) {
      const cellText = cellMatch[1]
        .replace(/<br\s*\/?>/gi, ' ')  // Replace <br> with space
        .replace(/<[^>]+>/g, '')       // Strip other HTML tags
        .trim();

      if (cellText) {
        cells.push(cellText);
      }
    }

    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  return rows;
}

export function tableToMarkdown(rows: string[][]): string {
  if (rows.length === 0) return '';

  const lines: string[] = [];

  // Header row
  lines.push('| ' + rows[0].join(' | ') + ' |');
  lines.push('| ' + rows[0].map(() => '---').join(' | ') + ' |');

  // Data rows
  for (let i = 1; i < rows.length; i++) {
    lines.push('| ' + rows[i].join(' | ') + ' |');
  }

  return lines.join('\n');
}
