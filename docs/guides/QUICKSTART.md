# Quickstart Guide

## Setup (5 minutes)

### 1. Create .env.local

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your API keys:
```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000

### 3. Test with a PDF

1. Upload a PDF (try a 5-10 page academic paper first)
2. Wait 30-60 seconds for processing
3. Play audio or download MP3

## What to Test

- [ ] Upload simple PDF (5 pages, no tables) - should work in ~15-20 seconds
- [ ] Upload PDF with tables (10 pages, 3+ tables) - tables should sound natural
- [ ] Test on iPhone Safari (requires HTTPS - deploy to Vercel first)
- [ ] Verify screen stays on during playback (iOS 16.4+)
- [ ] Verify download works (Content-Disposition header)

## Expected Behavior

**Upload → Processing → Play/Download**

1. Upload: Instant (file saved to /tmp)
2. Processing: 30-60 seconds
   - marker-pdf extraction: ~10-20s
   - Claude table summaries: ~5-15s
   - OpenAI TTS: ~20-30s
3. Audio ready: Play in browser OR download MP3

## Troubleshooting

**"marker-pdf not found"**
→ Ensure marker-pdf is in vault: `source ~/phoenix/.venv/bin/activate && which marker_single`

**"Processing takes >60 seconds and times out"**
→ PDF too large. Limit to 20 pages for MVP. Or upgrade to Vercel Pro ($20/month, 5-min timeout).

**"Audio doesn't play on iPhone"**
→ Deploy to Vercel (need HTTPS). AudioContext requires user gesture on iOS.

**"Tables sound like gibberish"**
→ Check Claude API key. Verify table summaries are generated (check console logs).

## Next Steps After Testing

1. Deploy to Vercel (`vercel --prod`)
2. Test on real iPhone over HTTPS
3. Share with 5-10 beta testers
4. Gather feedback
5. Decide: Continue to V1 OR pivot/kill

## Cost Tracking

Log your test conversions:
- Test 1: X pages → $Y cost
- Test 2: X pages → $Y cost
- ...

Target: ~$10 total for 10-20 test conversions

## Deployment

```bash
vercel login
vercel

# Add environment variables in Vercel dashboard
# Then deploy to production:
vercel --prod
```

Your app will be live at https://pdf-voice-tool.vercel.app (or similar)

## Success Criteria

✅ Upload 10-page PDF → Audio plays in <60 seconds
✅ Tables sound natural (not "column 1, row 2")
✅ Works on iPhone Safari (after deploying to Vercel)
✅ Download MP3 works on all devices
✅ Cost per conversion: $0.50-0.75

If all ✅: **MVP is complete!** Proceed to V1 planning.
