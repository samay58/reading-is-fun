# Phoenix Voice

Transform documents into natural audio. Upload a PDF, hear the first paragraph in 10 seconds. Keep listening while the rest streams in progressively. No waiting. No progress bars. Just audio that starts playing immediately.

**Production**: https://voice.samayz.ing

## What It Does

Transforms any PDF into premium audiobook-quality narration. Research papers, technical reports, ebooks, documentation—if it's a PDF, you can listen to it with natural-sounding AI voices.

The difference: streaming architecture that respects your time. Traditional converters batch-process entire documents. This tool chunks intelligently and generates audio progressively. First chunk plays while chunk two generates. Chunk two plays while chunk three generates. You're listening while it's working.

## Quick Start

```bash
# Clone and install
git clone [repository-url]
npm install

# Add your API keys
cp .env.example .env
# Edit .env with your keys

# Run
npm run dev
```

Open localhost:3000, upload a PDF, press play. Ten seconds later, you're listening.

## The Technical Stack

### 1. Extraction (DeepSeek OCR)

Pulls text from PDFs with layout awareness. Handles complex documents—multi-column layouts, embedded tables, academic formatting. Processes 40-page documents completely free.

Detects when tables appear. Flags them for intelligent narration instead of robotic cell-by-cell reading.

### 2. Intelligence (Claude AI)

Tables are unlistenable when read cell by cell. "Q1. 10 million. Q2. 15 million. Q3. 22 million." Your brain checks out after row two.

Claude transforms table data into natural narration: "The company grew revenue from 10 million in Q1 to 15 million in Q2—a 50% increase—then jumped to 22 million in Q3."

Same data. Completely different listening experience.

### 3. Cost Optimization (Multi-Provider TTS)

Three providers with automatic fallback:

- **Hathora Kokoro**: ~$0.50 per 1M characters (primary, 98% cheaper)
- **Inworld AI**: $10 per 1M characters (fallback)
- **OpenAI TTS HD**: $30 per 1M characters (final fallback)

Smart routing saves 98% on costs. A typical 10-page PDF costs $0.015 instead of $0.90.

The math:

- 10 pages = ~5,000 words = ~30,000 characters
- Hathora: 30,000 × $0.0000005 = $0.015
- Inworld: 30,000 × $0.00001 = $0.30
- OpenAI: 30,000 × $0.00003 = $0.90

Cost scales linearly. A 100-page document costs $0.05 with Hathora, $3.00 with OpenAI.

### 4. Streaming Architecture

**Intelligent Chunking**:

- Respects paragraph and sentence boundaries (no mid-sentence cuts)
- Provider-aware sizing (2,000 characters for Hathora/Inworld, 4,000 for OpenAI)
- Sequential generation with immediate playback
- Automatic WAV→MP3 conversion for Hathora (using ffmpeg)

**Progressive Delivery**:

- Text extracted and chunked in ~5 seconds
- First audio chunk generates in ~5 seconds
- Playback starts at 10 seconds
- Remaining chunks generate while you listen
- Complete file available for download when finished

A 40-page document starts playing in 10 seconds. You've listened to three pages by the time the full file finishes generating.

## Design Philosophy

Modern, refined aesthetic inspired by Linear and Vercel. Clean, professional, and built to last.

**The System**:

- Light mode default with automatic dark mode (`prefers-color-scheme`)
- Blue accent (`#0070f3`) for interactive elements
- Geist Sans/Mono typography
- Generous whitespace and centered layouts
- Minimal motion (150ms opacity fades only)

No decoration. No clutter. Just elegant hierarchy and functional design.

## Architecture

```
PDF Upload
  ↓
DeepSeek OCR (text + table detection)
  ↓
Claude AI (table narration generation)
  ↓
Text Chunking (boundary-aware, provider-optimized)
  ↓
TTS Generation (Inworld primary, OpenAI fallback)
  ↓
Progressive Streaming (chunk-by-chunk playback)
  ↓
Complete File Download
```

**API Keys Required**:

- DeepSeek: OCR and extraction
- Claude (Anthropic): Table intelligence
- Inworld AI: Primary TTS
- OpenAI: Fallback TTS

Free tiers available for testing. Production costs scale predictably.

## Roadmap

Features worth building:

**Pause and Resume**: Start a 200-page document, pause at page 47, resume tomorrow.

**Chapter Summaries**: Claude generates 2-minute summaries for 50-page sections.

**Conversion History**: Library of every PDF you've converted with timestamps and playback position.

**Voice Selection**: Choose narration style (neutral, expressive, technical).

**Speed Control**: 1.5x for dense academic papers, 0.8x for poetry.

## Why This Exists

Reading is slow. Listening is portable. But audiobook production costs thousands of dollars and takes weeks.

AI narration solves the cost problem but creates a waiting problem. This tool solves both.

The streaming architecture makes audio generation feel instant. The dual-provider system keeps costs reasonable. The intelligent table narration makes technical documents listenable.

No single piece of this stack is revolutionary. The combination creates something that feels magical.

---

Built for developers who read technical papers on commutes and researchers who need to consume documents faster. Works for anyone who's ever wished a PDF could just read itself aloud.