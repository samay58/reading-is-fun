# Phoenix Voice - Complete Frontend Redesign

**Last Updated**: December 12, 2025
**Status**: Production deployed at voice.samayz.ing
**Session Log**: See `docs/SESSION-LOG-2025-12-12.md` for latest changes

## Overview

Complete rebuild from "Warm Circuits" retro aesthetic to modern, Linear/Vercel-inspired design system. Rebranded as "Phoenix Voice" with custom waveform icon and streamlined codebase.

## What Changed (Dec 11, 2025)

### AI-Generated Cover Artwork
- **Provider**: Fal.ai Nano Banana Pro ($0.15/image)
- **Style**: Minimalist hand-drawn manuscript sketch, whimsical ink illustration
- **Flow**: Document text → DeepInfra extracts theme → Fal.ai generates artwork
- **New files**: `lib/fal.ts`, `lib/deepinfra-llm.ts`
- **Events**: `artwork_generating`, `artwork_ready` added to SSE stream

### Anthropic → DeepInfra Migration
- **Table narration**: Now uses DeepInfra Llama 3.3 70B instead of Claude Haiku
- **Image captioning**: Now uses DeepInfra Llama 3.2 11B Vision
- **Theme extraction**: DeepInfra Llama for artwork prompt generation
- **Cost reduction**: Significantly cheaper than Anthropic

### StreamingPlayer Enhancements
- **Artwork container**: Displays AI-generated cover art with loading state
- **Volume controls**: Slider + mute button with animated music bars
- **Skip buttons**: ±10 seconds navigation
- **Better animations**: Shimmer, pulse-glow, music-bar keyframes

## What Changed (Dec 12, 2025)

### OCR Line Break Normalization
- **Problem**: Visual `\n` from PDF layout caused choppy TTS narration
- **Solution**: `normalizeLineBreaksForNarration()` in `lib/text-cleaner.ts`
- **Heuristics**: Lowercase continuation, continuation words, list/header detection
- **Result**: `"The state of\nenterprise AI"` → `"The state of enterprise AI"`

### Enhanced Debug Logging
- Labeled separators for image narrations in terminal
- Full narration breakdown (OCR chars → tables → images → final chars)
- Complete clean text output before TTS generation

### Kokoro Voice Mapping Fix
- **Problem**: Code used non-existent voices (`af_heart`, `am_eric`)
- **Fix**: Updated to real Kokoro voices in `lib/tts/providers/deepinfra.ts`
- **Available**: af_bella, af_nicole, af_sarah, af_sky, am_adam, am_michael, bf_emma, bf_isabella, bm_george, bm_lewis

### Sesame CSM-1B (Attempted)
- Created provider at `lib/tts/providers/sesame.ts`
- Uses DeepInfra API for Maya voice
- **Status**: Disabled - API issues, rolled back to Kokoro

## What Changed (Nov 29, 2025)

### Branding
- **Name**: "PDF to Voice" → "Phoenix Voice"
- **Icon**: Generic file icon → Custom 6-bar waveform SVG (varying heights/opacity)
- **Aesthetic**: Retro tape deck → Modern, refined, professional

### Design System
- **Light mode default** with dark mode via `prefers-color-scheme`
- **Color palette**:
  - Light: `#ffffff` bg, `#171717` fg, `#0070f3` accent
  - Dark: `#0a0a0a` bg, `#ededed` fg, `#0070f3` accent
- **Typography**: Geist Sans/Mono (replaced DM Serif Display + IBM Plex)
- **Spacing**: Generous whitespace, vertically centered layouts
- **Motion**: Minimal opacity fades (150-200ms), subtle transforms (max 8px)

### Code Reduction
- `globals.css`: 1,230 → 245 lines (80% reduction)
- `motion.ts`: 491 → 57 lines (88% reduction)
- `Upload.tsx`: 335 → 321 lines (streamlined with inline styles)
- `StreamingPlayer.tsx`: 760 → 502 lines (34% reduction)
- `page.tsx`: 332 → 282 lines (15% reduction)

### Components Deleted
- VUMeter.tsx
- NixieCounter.tsx
- TransportButton.tsx
- useSpotlight.ts
- useMagneticButton.ts
- useMousePosition.ts

### StreamingPlayer Improvements
- **Music player controls** visible immediately when first chunk ready
- **Clickable progress scrubber** for seeking within chunks
- **Elegant buttons**: Restart, Play/Pause (blue accent with glow), Download
- **Hover states**: Proper color/border transitions on all controls
- **X close button** in top-right (replaces disconnected "New file" button)
- **Status hierarchy**: Document name (1rem bold) → metadata (0.75rem faint)

### Technical Implementation
- **Explicit inline styles** for guaranteed centering (no Tailwind class conflicts)
- **Blue accent color** (`#0070f3`) with subtle glow on play button
- **Responsive hover effects** on all interactive elements
- **Keyboard shortcuts** preserved: Space (play/pause), R (restart), Esc (close)

## Deployment

**Production URL**: https://voice.samayz.ing
**Vercel Project**: pdf-voice-tool
**Domain**: Custom CNAME configured
**Build**: TypeScript clean, all tests passing

## Previous Redesign (Nov 16, 2025 - Archived)

### Rauno Freiberg Minimal Design

**Applied Principles**:
1. "Actions frequent and low in novelty should avoid extraneous animations"
2. Invisible details - interface disappears, content shines
3. Functional minimalism - every element serves purpose
4. Mathematical precision - 8px grid system
5. Timeless design - good in 10 years

**Changes Made**:
- Monochromatic palette (#fafafa to #171717)
- Mathematical 8px grid
- Zero decorative animations
- System fonts for clarity
- Removed gradients, shadows, parallax
- 150ms functional transitions only

## Design Philosophy Evolution

**Nov 16**: Rauno Freiberg minimalism (neutral, timeless)
**Nov 29**: Linear/Vercel refinement (modern, blue accent, polished)

Both iterations maintain core principle: **clarity over decoration**. The Nov 29 redesign adds polish and refinement while preserving the minimal foundation.

## Next Steps

See ROADMAP.md for feature backlog:
- P0: Pause/Resume functionality
- P1: Playback speed controls
- P2: Periodic summaries
- P3: Reading history

---

**Production**: voice.samayz.ing
**Design**: Linear/Vercel inspired
**Code**: Streamlined, modern, maintainable
