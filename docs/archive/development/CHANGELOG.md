# Changelog

## [v0.2] - 2025-10-31 - DeepSeek OCR Migration

### Changed
- **BREAKING**: Replaced marker-pdf with DeepSeek OCR via alphaxiv.org
- **Performance**: 20x faster PDF extraction (19s vs 6.5min for 18-page PDF)
- Updated imports: `lib/marker.ts` → `lib/deepseek.ts`
- Updated README and footer branding

### Added
- `lib/deepseek.ts` - DeepSeek OCR API integration
- `DEEPSEEK-MIGRATION.md` - Migration documentation
- 2-minute timeout for API calls
- Better error handling for empty responses

### Removed
- Python subprocess dependency (marker_single)
- Complex CLI argument handling
- `--disable_image_extraction` workarounds (not needed with DeepSeek)

### Performance
- PDF extraction: 6.5min → 19s (20x faster)
- Total pipeline: 7-9min → 40-85s (8-10x faster)
- Reliability: Improved (no subprocess failures)

---

## [v0.1] - 2025-10-30 - Initial MVP

### Added
- Next.js 15 full-stack app
- PDF upload with validation
- marker-pdf integration (replaced in v0.2)
- Claude 3.5 Haiku table summarization
- OpenAI TTS (tts-1-hd model)
- HTML5 audio player with Wake Lock
- Mobile-optimized UI (iPhone Safari)
- Cost tracking and display
- Download MP3 functionality

### Features
- Upload PDF (max 25 pages, 10MB)
- Intelligent table handling
- Browser playback + download
- Clean Tailwind UI
- Error handling and validation

### Documentation
- README.md
- QUICKSTART.md
- TESTING-GUIDE.md
- BUILD-STATUS.md
