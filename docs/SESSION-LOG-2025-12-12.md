# Session Log: December 12, 2025

## Summary
Fixed OCR line breaks, added debug logging, researched TTS emotion control, attempted Sesame CSM-1B integration (failed), rolled back to Kokoro.

---

## Changes Made This Session

### 1. OCR Line Break Normalization
**File:** `lib/text-cleaner.ts`

**Problem:** OCR output contained visual line breaks (`\n`) from PDF column layout causing choppy TTS narration.

**Solution:** Added `normalizeLineBreaksForNarration()` function with smart heuristics:
- Collapses visual wraps to spaces (lowercase continuation, continuation words)
- Preserves paragraph breaks (`\n\n`)
- Preserves list items and headers

```typescript
// Key heuristics:
- /^[a-z]/.test(curr) → collapse (lowercase start = continuation)
- /\b(of|the|and|...)$/i.test(prev) → collapse (continuation word)
- /^\s*[-*•]\s/.test(curr) → preserve (list item)
- looksLikeHeader(prev) → preserve
```

### 2. Enhanced Debug Logging
**File:** `app/api/process-stream/[id]/route.ts`

Added labeled separators for debugging:
```
[id] -------- IMAGE NARRATIONS --------
[id] [Page 1] A visualization showing...
[id] -----------------------------------
[id] ========== NARRATION BREAKDOWN ==========
[id] OCR text: 42000 chars
[id] Tables narrated: 2
[id] Images narrated: 6
[id] Final clean text: 35683 chars
[id] ========== FULL NARRATION START ==========
...full text...
[id] ========== FULL NARRATION END ==========
```

### 3. Fixed Kokoro Voice Mapping
**File:** `lib/tts/providers/deepinfra.ts`

**Problem:** Code used non-existent Kokoro voices (`af_heart`, `am_eric`, `af_nova`, `af_river`).

**Fix:** Updated to real voices:
```typescript
const emotionVoiceMap = {
  neutral: 'af_bella',
  calm: 'af_sarah',
  excited: 'af_sky',
  happy: 'af_nicole',
  serious: 'am_adam',
  sad: 'bf_emma',
};
```

### 4. Sesame CSM-1B Provider (Created but Not Working)
**File:** `lib/tts/providers/sesame.ts` (new)

Created provider for Sesame Maya voice via DeepInfra. Currently disabled - API returned errors.

### 5. Anthropic → DeepInfra Migration (Prior in Session)
**Files:** `lib/claude.ts`, `lib/fal.ts`, `lib/images.ts`, `lib/deepinfra-llm.ts`

Replaced all Anthropic API calls with DeepInfra Llama models:
- Text: `meta-llama/Llama-3.3-70B-Instruct-Turbo`
- Vision: `meta-llama/Llama-3.2-11B-Vision-Instruct`

---

## Current Architecture

```
PDF Upload
    ↓
[DeepInfra OCR] → rawText (with visual line breaks)
    ↓
[Extract Images] → [DeepInfra Vision] → imageNarrations
    ↓
[Extract Tables] → [DeepInfra LLM] → tableNarrations
    ↓
[processDeepSeekText()]
    ├─ injectImageNarrations()
    ├─ replaceTablesWithNarrations()
    ├─ cleanDeepSeekOutput()
    │   └─ normalizeLineBreaksForNarration() ← NEW
    ├─ removeLowValueSections()
    └─ prepareForNarration()
    ↓
cleanText (ready for TTS)
    ↓
[chunkText()] → chunks (max 8000 chars for Kokoro)
    ↓
[DeepInfra Kokoro TTS] → audio chunks
    ↓
[SSE Stream] → StreamingPlayer
    ↓
[Audio concatenation] → final MP3
```

## TTS Provider Chain
```
Priority 0: DeepInfra Kokoro ($0.62/M) ← ACTIVE
Priority 1: Orpheus ($15/M)
Priority 2: MiniMax ($30/M)
Priority 3: OpenAI ($30/M)
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `lib/text-cleaner.ts` | Text normalization, line break handling |
| `lib/cleaning.ts` | Orchestrates text processing pipeline |
| `lib/tts/providers/deepinfra.ts` | Kokoro TTS provider |
| `lib/tts/manager.ts` | Provider selection, fallback chain |
| `lib/tts.ts` | TTS config builder, manager factory |
| `lib/streaming/chunk-manager.ts` | Text chunking, audio concatenation |
| `app/api/process-stream/[id]/route.ts` | Main streaming endpoint |
| `components/StreamingPlayer.tsx` | Audio player UI |

---

## Environment Variables

```env
# Active TTS
TTS_PROVIDER=auto
DEEPINFRA_TTS_API_KEY=...
DEEPINFRA_VOICE=af_bella

# Available voices (Kokoro)
# American Female: af_bella, af_nicole, af_sarah, af_sky
# American Male: am_adam, am_michael
# British Female: bf_emma, bf_isabella
# British Male: bm_george, bm_lewis
```

---

## Learnings

### TTS Emotion Control
1. **Kokoro**: No explicit emotion param. Voice selection is the only lever. Training data is synthetic/neutral.
2. **Sesame CSM-1B**: Emotion from audio context, not params. Best with conversational history.
3. **Zonos-v0.1**: Has explicit emotion params (happy, fear, sad, angry) - worth exploring.
4. **OpenAudio S1**: In-text markers (`<angry>`, `<whisper>`) - interesting approach.

### OCR Line Breaks
- Single `\n` = visual wrap from PDF column width
- Double `\n\n` = semantic paragraph break
- Key signal: lowercase continuation after line break = collapse to space

### Sesame Issues
- API may require specific context_audio for good results
- Without conversational context, output quality may be flat
- DeepInfra endpoint may have different requirements than documented

---

## Known Issues

### 1. Audio Chunk Stitching (HIGH PRIORITY)
**Symptom:** Audio not streaming correctly, chunks may not concatenate properly.

**Location:** `lib/streaming/chunk-manager.ts`

**Investigate:**
- `concatenateChunks()` function
- SSE event ordering
- Buffer handling in `StreamingPlayer.tsx`
- MP3 frame boundaries when splitting/joining

### 2. Voice Flexibility (MEDIUM PRIORITY)
**Current:** Voice is set via env var, no runtime control.

**Wanted:** Easy toggle to test different voices/emotions without code changes.

---

## Next Steps / Roadmap

### Immediate (Next Session)
1. **Debug audio stitching**
   - Add logging to `concatenateChunks()`
   - Verify chunk order in SSE events
   - Check for MP3 header issues when joining
   - Test with single-chunk documents first

2. **Voice toggle system**
   - Add UI dropdown for voice selection
   - Pass voice preference through API
   - Consider per-section emotion mapping

### Short-term
3. **Explore Zonos-v0.1** for explicit emotion control
4. **Section-aware emotion** - detect headers, conclusions, quotes and vary voice
5. **Audio quality metrics** - log bitrate, duration, file size per chunk

### Medium-term
6. **Pre-recorded intro context** for Sesame (if revisiting)
7. **A/B testing dashboard** for voice quality comparison
8. **Caching layer** for repeated TTS requests

---

## Quick Commands

```bash
# Run dev server
npm run dev

# Test with specific voice
DEEPINFRA_VOICE=af_sky npm run dev

# Check available voices
# See: https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md

# Build & type check
npm run build
```

---

## File Changes Summary

```
Modified:
  lib/text-cleaner.ts          +75 lines (normalizeLineBreaksForNarration)
  lib/tts/providers/deepinfra.ts  ~10 lines (voice mapping fix)
  lib/tts/manager.ts            +5 lines (Sesame import)
  lib/tts/types.ts              +4 lines (Sesame config)
  lib/tts.ts                    +12 lines (Sesame config)
  app/api/process-stream/[id]/route.ts  +15 lines (debug logging)
  .env.local                    ~3 lines (TTS_PROVIDER)

Created:
  lib/tts/providers/sesame.ts   ~120 lines (disabled)
  docs/SESSION-LOG-2025-12-12.md  (this file)
```
