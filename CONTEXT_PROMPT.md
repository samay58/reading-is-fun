# Quick Re-engage Prompt

Copy/paste the block below to bring a new session up to speed fast:

```
Project: pdf-voice-tool
Focus: DeepInfra OCR primary; Hathora TTS primary; streaming audio in chunks
Recent changes:
- DeepInfra OCR solid on long PDFs (~450k chars); cleaning now falls back to raw OCR if it strips everything.
- Hathora TTS pointed at https://app-01312daf-6e53-4b9d-a4ad-13039f35adc4.app.hathora.dev with max chunk 4000 (HATHORA_MAX_CHARS); Inworld/OpenAI are fallbacks.
- TTS_PROVIDER=hathora; Anthropic image captions use claude-3-haiku-20240307 and auto-disable on first error.
Known issues:
- Hathora previously returned 405; verify with current base URL. Long runs still big (119 chunks) and can stress streaming if fallback triggers.
- Cleaning is aggressive; currently guarded by fallback to raw OCR.
Recent logs: ~/phoenix/02-personal/projects/pdf-to-voice-tool/_planning/implementation/2025-11-25-session-log.md and 2025-11-26-session-log.md
Current env (non-secret): TTS_PROVIDER=hathora, HATHORA_BASE_URL set to app host, HATHORA_MAX_CHARS=4000, ANTHROPIC_IMAGE_MODEL=claude-3-haiku-20240307
Run checks: npm run build (last pass), npm run dev then upload long PDF to confirm Hathora 405 resolved.
Please pick up from there.
```
