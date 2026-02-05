export function cleanDeepSeekOutput(text: string): string {
  let cleaned = text;

  // Remove page split markers (DeepSeek artifact)
  cleaned = cleaned.replace(/<---\s*Page Split\s*--->/gi, '\n\n');

  // Normalize visual line breaks for fluent narration
  // This collapses OCR line wraps to spaces while preserving paragraphs/lists
  cleaned = normalizeLineBreaksForNarration(cleaned);

  // Strip frequently repeated headers/footers (likely admin chrome)
  cleaned = stripFrequentLines(cleaned);

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

/**
 * Normalize line breaks for TTS narration.
 * Collapses visual line wraps (OCR artifacts) to spaces while preserving
 * semantic breaks like paragraphs, list items, and headers.
 */
export function normalizeLineBreaksForNarration(text: string): string {
  const paragraphs = text.split(/\n\n+/);

  const processed = paragraphs.map(para => {
    const lines = para.split('\n');
    if (lines.length <= 1) return para;

    let result = lines[0];
    for (let i = 1; i < lines.length; i++) {
      const prev = lines[i - 1].trim();
      const curr = lines[i].trim();

      if (!curr) { result += '\n'; continue; }

      if (shouldCollapseLineBreak(prev, curr)) {
        // Handle hyphenated words: "enter-\nprises" → "enterprises"
        if (/[a-z]-$/i.test(prev)) {
          result = result.trimEnd().slice(0, -1) + curr;
        } else {
          result = result.trimEnd() + ' ' + curr;
        }
      } else {
        result += '\n' + curr;
      }
    }
    return result;
  });

  return processed.join('\n\n');
}

function shouldCollapseLineBreak(prev: string, curr: string): boolean {
  if (!prev || !curr) return false;

  // PRESERVE: list items
  if (/^\s*[-*•·▪]\s/.test(curr)) return false;
  if (/^\s*\d+[.)]\s/.test(curr)) return false;
  if (/^\s*[a-z][.)]\s/i.test(curr)) return false;

  // PRESERVE: markdown headers, special markers
  if (/^#{1,6}\s/.test(curr)) return false;
  if (/^\[/.test(curr)) return false;

  // COLLAPSE: lowercase continuation (strongest signal)
  if (/^[a-z]/.test(curr)) return true;

  // COLLAPSE: continuation punctuation
  if (/[,;:\-\u2013\u2014]$/.test(prev)) return true;

  // COLLAPSE: continuation words
  if (/\b(the|a|an|of|in|on|at|to|for|with|by|from|and|or|but|as|if|than|that|which|who|whose|where|when|while|because|since|unless|until|whether|after|before)$/i.test(prev)) return true;

  // PRESERVE: headers
  if (looksLikeHeader(prev)) return false;

  // PRESERVE: sentence end + capital start
  if (/[.!?]$/.test(prev) && /^[A-Z]/.test(curr)) return false;

  // COLLAPSE: long lines without terminal punctuation (likely wrapped)
  if (prev.length > 40 && !/[.!?]$/.test(prev)) return true;

  return false;
}

function looksLikeHeader(line: string): boolean {
  const t = line.trim();
  if (t.length > 60 || t.length < 3) return false;
  if (/[.!?,;]$/.test(t)) return false;
  if (t === t.toUpperCase() && /[A-Z]/.test(t)) return true; // ALL CAPS

  const minor = ['the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or', 'but', 'as'];
  const words = t.split(/\s+/).filter(w => !minor.includes(w.toLowerCase()));
  if (words.length === 0) return false;
  const caps = words.filter(w => /^[A-Z]/.test(w)).length;
  return caps / words.length > 0.6; // Mostly title case
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

/**
 * Drop lines that look like repeated headers/footers across pages.
 */
function stripFrequentLines(text: string): string {
  const lines = text.split('\n');
  const counts: Record<string, number> = {};

  for (const line of lines) {
    const normalized = line.trim();
    if (!normalized || normalized.length > 140) continue;
    counts[normalized] = (counts[normalized] || 0) + 1;
  }

  const looksLikeChrome = (line: string) => {
    const upperRatio = line.replace(/[^A-Z]/g, '').length / Math.max(line.length, 1);
    return (
      /page\s*\d+/i.test(line) ||
      /confidential|copyright|all rights reserved|forward-looking/i.test(line) ||
      /^https?:\/\//i.test(line) ||
      upperRatio > 0.6 ||
      line.split(' ').length <= 6
    );
  };

  const filtered = lines.filter(line => {
    const normalized = line.trim();
    if (!normalized) return false;
    const frequency = counts[normalized] || 0;
    if (frequency >= 3 && looksLikeChrome(normalized)) {
      return false;
    }
    return true;
  });

  return filtered.join('\n');
}

/**
 * Remove low-value sections that don't contribute to narration (TOCs, legal boilerplate).
 */
export function removeLowValueSections(text: string): string {
  const paragraphs = text.split(/\n{2,}/);

  const lowValuePatterns = [
    /^table of contents$/i,
    /^contents$/i,
    /^appendix\s+[a-z0-9]+$/i,
    /^references$/i,
    /^bibliography$/i,
    /^index$/i,
    /forward[-\s]?looking statements/i,
    /safe harbor/i,
    /confidential/i,
    /do not distribute/i,
    /all rights reserved/i,
    /copyright/i,
    /legal notice/i,
    /information purposes only/i,
    /click here/i,
    /contact .*@/i,
  ];

  const shouldDropParagraph = (p: string) => {
    const trimmed = p.trim();
    if (!trimmed) return true;

    // Only drop truly low-value short paragraphs (was too aggressive - caused "0.5m" bug)
    // Pure page numbers (1-3 digits only)
    if (trimmed.length < 10 && /^\d{1,3}$/.test(trimmed)) return true;
    // Only digits, periods, and @/email chars (e.g., "1.2.3" or "foo@bar.com")
    if (trimmed.length < 40 && /^[\d.@\s]+$/.test(trimmed)) return true;

    return lowValuePatterns.some(pattern => pattern.test(trimmed));
  };

  return paragraphs
    .filter(p => !shouldDropParagraph(p))
    .join('\n\n')
    .trim();
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
