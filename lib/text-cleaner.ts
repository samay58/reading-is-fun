export function cleanDeepSeekOutput(text: string): string {
  let cleaned = text;

  // Remove page split markers (DeepSeek artifact)
  cleaned = cleaned.replace(/<---\s*Page Split\s*--->/gi, '\n\n');

  // Remove HTML tags (after table/image extraction)
  // Keep the content, just remove tags
  cleaned = cleaned.replace(/<center>([\s\S]*?)<\/center>/gi, '$1');
  cleaned = cleaned.replace(/<br\s*\/?>/gi, ' ');

  // Remove standalone metadata lines (ALL CAPS FORMATTING)
  // Example: "INSIGHTS | COUNTERPOINT GLOBAL | April 2025"
  cleaned = cleaned.replace(/^[A-Z\s|]+\|\s*[A-Z\s|]+\|\s*[A-Z0-9\s]+$/gm, '');

  // Remove isolated section codes (e.g., "## DISPLAY 1" on its own line)
  cleaned = cleaned.replace(/^##\s*DISPLAY\s*\d+\s*$/gm, '');

  // Remove excessive header formatting
  // Convert "# # Title" to "Title"
  cleaned = cleaned.replace(/^#+\s*#+\s*/gm, '');

  // Clean up excessive whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');  // Max 2 newlines
  cleaned = cleaned.replace(/[ \t]+/g, ' ');     // Single spaces

  // Remove leading/trailing whitespace from lines
  cleaned = cleaned.split('\n').map(line => line.trim()).join('\n');

  // Remove common footer patterns
  cleaned = cleaned.replace(/^Source:.*$/gim, ''); // Source citations (visual only)
  cleaned = cleaned.replace(/^Note:.*as of.*$/gim, ''); // Date notes

  return cleaned.trim();
}

export function shouldRemoveLine(line: string): boolean {
  // Heuristics for lines to completely remove

  // Empty or whitespace-only
  if (!line.trim()) return true;

  // All caps metadata (e.g., "APRIL 2025")
  if (/^[A-Z0-9\s|]+$/.test(line) && line.length < 50) return true;

  // Isolated numbers (page numbers)
  if (/^\d{1,3}$/.test(line.trim())) return true;

  // Copyright/legal boilerplate patterns
  if (/©|copyright|all rights reserved/i.test(line)) return true;

  // URLs on their own line (not in sentence)
  if (/^https?:\/\//.test(line.trim())) return true;

  // Email addresses on their own line
  if (/^[\w.+-]+@[\w.-]+\.\w+$/.test(line.trim())) return true;

  return false;
}

export function prepareForNarration(text: string): string {
  // Final pass to make text narrator-friendly

  let narration = text;

  // Convert heading markers to natural speech
  narration = narration.replace(/^#\s+(.+)$/gm, '\n$1.\n'); // "# Title" → "Title."
  narration = narration.replace(/^##\s+(.+)$/gm, '\n$1.\n');
  narration = narration.replace(/^###\s+(.+)$/gm, '\n$1.\n');

  // Expand abbreviations for clarity
  narration = narration.replace(/\be\.g\.\s*/gi, 'for example ');
  narration = narration.replace(/\bi\.e\.\s*/gi, 'that is ');
  narration = narration.replace(/\bvs\.\s*/gi, 'versus ');
  narration = narration.replace(/\bet al\.\s*/gi, 'and others ');
  narration = narration.replace(/\bFig\.\s*/gi, 'Figure ');
  narration = narration.replace(/\bTab\.\s*/gi, 'Table ');

  // Handle mathematical notation
  narration = narration.replace(/\$\s*(\d+)M\b/g, '$1 million dollars');
  narration = narration.replace(/\$\s*(\d+)B\b/g, '$1 billion dollars');
  narration = narration.replace(/\$\s*(\d+)K\b/g, '$1 thousand dollars');

  // Clean up whitespace
  narration = narration.replace(/\n{3,}/g, '\n\n');
  narration = narration.trim();

  return narration;
}
