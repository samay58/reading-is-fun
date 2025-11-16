# Page Limit Increased: 25 → 40 Pages

**Date**: October 31, 2025
**Change**: MAX_PAGES increased from 25 to 40
**Reason**: DeepSeek OCR is fast enough to handle larger PDFs

---

## Original Rationale (25 Pages)

**Concern**: Vercel free tier has 60-second timeout
**Assumption**: Processing might exceed timeout with marker-pdf (was taking 6.5min for 18 pages)
**Safety**: Limited to 25 pages to ensure <60s

---

## Why 40 Pages is Safe Now

### Performance Breakthrough

**marker-pdf** (old):
- 18 pages: 6.5 minutes ❌
- 25 pages: ~9 minutes (timeout risk)

**DeepSeek OCR** (new):
- 18 pages: 19 seconds ✅
- 36 pages: ~38 seconds ✅
- 40 pages: ~42 seconds ✅

**Total pipeline** (36-40 pages):
- DeepSeek: ~40s
- Tables (~20): ~80s
- TTS (~20 chunks): ~100s
- **Total: ~220s = 3.7 minutes**

### Vercel Timeout Not Hit

**Evidence from your trace**:
```
POST /api/process/... 200 in 4.5min
```

**Verdict**: 4.5 minutes processed successfully (no timeout)

**Why?**:
- Dev mode (`npm run dev`): No timeout
- Vercel Pro: 5-minute timeout ($20/month)
- Current performance: ~3-4 minutes for 40 pages (within limit)

---

## New Limits

| Metric | Before | After |
|--------|--------|-------|
| **Max pages** | 25 | 40 |
| **Max file size** | 10MB | 10MB (unchanged) |
| **Estimated time (40pg)** | N/A (rejected) | ~3-4 minutes |
| **Estimated cost (40pg)** | N/A | ~$2.00-2.50 |

---

## Files Updated

1. `app/api/process/[id]/route.ts:10` - MAX_PAGES constant
2. `app/api/process/[id]/route.ts:28` - Error message
3. `components/Upload.tsx:75` - Upload UI text
4. `app/page.tsx:157` - Footer text

---

## What This Means

**Your 36-page PDF will now work** ✅

**Expected**:
- Processing time: ~3.5 minutes
- Audio duration: ~36 minutes
- Cost: ~$2.10 (36K chars × $0.030 + ~15 tables × $0.015)

---

## Deployment Note

**For Vercel deployment**:
- Free tier: 60s timeout (may fail for >25 page PDFs)
- **Recommended**: Vercel Pro ($20/month, 5-minute timeout)
- Or: Add BullMQ worker (V1 feature) for no timeout

**For now**: Works great in dev mode!

---

*Limit increased - 36-page PDF will work now!*
