# PDF to Voice - MVP

Convert PDFs to podcast-quality audio with intelligent table handling.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables
Copy `.env.local.example` to `.env.local` and add your API keys.

### 3. Run Development Server
```bash
npm run dev
```

Visit http://localhost:3000

## Features

- **Lightning-fast PDF extraction** with DeepSeek OCR (19s for 18 pages!)
- AI-powered table summarization (Claude Haiku)
- High-quality TTS (OpenAI tts-1-hd)
- Mobile-optimized (iPhone Safari)
- Download MP3 files
- **20x faster** than marker-pdf

## Cost

~$0.60-0.75 per 20-page PDF

## Tech Stack

Next.js 15 + React + Tailwind + **DeepSeek OCR** (via alphaxiv) + Claude + OpenAI TTS

## Deployment

```bash
vercel --prod
```

See planning docs in ~/phoenix/02-personal/projects/pdf-to-voice-tool/ for details.
