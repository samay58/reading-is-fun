# Testing Guide: PDF-to-Voice MVP

**How to reliably test your MVP before sharing with users**

---

## Pre-Test Setup (5 minutes)

### 1. Add API Keys

```bash
cd ~/pdf-voice-tool
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
OPENAI_API_KEY=sk-...          # From platform.openai.com/api-keys
ANTHROPIC_API_KEY=sk-ant-...   # From console.anthropic.com/settings/keys
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. Verify marker-pdf

```bash
source ~/phoenix/.venv/bin/activate
marker_single --help
```

Should show marker-pdf help. If not: `pip install marker-pdf`

### 3. Start Dev Server

```bash
cd ~/pdf-voice-tool
npm run dev
```

Visit http://localhost:3000 - should see "PDF to Voice" page

---

## Test Suite: 3 Golden PDFs (30 minutes)

### Test 1: Simple Single-Column PDF (Baseline)

**Download test PDF**:
```bash
curl -o ~/Downloads/test-simple.pdf "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
```

**Or use any**: Simple research paper, blog post PDF, or single-column document without tables

**Expected Result**:
- Processing time: 15-25 seconds
- Audio quality: Clear, natural voice
- Cost: ~$0.15-0.25 (5 pages)
- No errors

**What to verify**:
- [x] Upload works
- [x] "Processing..." spinner appears
- [x] Audio player appears with play button
- [x] Audio plays smoothly in browser
- [x] Download MP3 works
- [x] Cost display shows ~$0.15-0.25

**If fails**: Check console logs - likely marker-pdf or OpenAI API issue

---

### Test 2: Multi-Column Academic Paper (Table Handling)

**Find a PDF**: Any academic paper with tables (conference papers, research articles)

**Or create test table PDF**: Use any paper from your vault research folders (likely has tables)

**Example from vault**:
```bash
# If you have Mauboussin research or similar in phoenix/
find ~/phoenix -name "*.pdf" -size -5M | head -5
# Pick one with tables
```

**Expected Result**:
- Processing time: 40-60 seconds (10-20 pages, 3-5 tables)
- Tables summarized as natural sentences
- Cost: $0.50-0.75
- "X tables summarized" message

**What to verify**:
- [x] Tables detected correctly
- [x] Table summaries sound natural when played
  - Good: "Table 1 shows revenue growing from $10M to $15M"
  - Bad: "Row 1 Column 2 dollar sign ten M row 2 column 2 fifteen M"
- [x] Multi-column layout preserved (text flows correctly)
- [x] Cost includes table summarization (~$0.015 per table)

**If tables sound bad**:
- Check `lib/claude.ts` - summarization should return prose
- Check console for Claude API errors
- Test table detection: Add `console.log(tables)` in process route

---

### Test 3: Page Limit Enforcement (Edge Case)

**Create**: Any PDF with >25 pages, OR upload same PDF twice (doesn't matter what)

**Expected Result**:
- Upload succeeds
- Processing starts
- **Error appears**: "PDF too large. Maximum 25 pages for MVP. This PDF has ~X pages."
- Error state shows "Try Another PDF" button

**What to verify**:
- [x] Page limit enforced (MAX_PAGES = 25 in code)
- [x] Clear error message
- [x] Can retry with smaller PDF (reset button works)

---

## Local Testing Checklist (Before Deploy)

### Functional Tests ✅

- [ ] **Upload validation**
  - Reject non-PDF files → shows "Only PDF files are supported"
  - Reject files >10MB → shows "File too large"
  - Accept valid PDFs → shows "Uploading..."

- [ ] **Processing**
  - Shows spinner during processing
  - Shows helpful status message
  - Completes in <60 seconds for 20-page PDF
  - Handles marker-pdf failures gracefully

- [ ] **Audio generation**
  - Audio file created in /tmp
  - Preview text appears (first 500 chars)
  - Cost breakdown displayed
  - Table count shown

- [ ] **Playback**
  - Play button works
  - Audio plays smoothly
  - Pause button works
  - Time remaining displayed
  - Progress bar updates

- [ ] **Download**
  - Download button appears
  - MP3 file downloads
  - Filename is `audio-{jobId}.mp3`
  - File plays in audio player

### Error Handling ✅

- [ ] **PDF parsing failure**
  - Upload scanned PDF (image-only) → graceful error
  - Error message: "PDF could not be parsed"

- [ ] **API failures**
  - Invalid OPENAI_API_KEY → error "Audio generation failed"
  - Invalid ANTHROPIC_API_KEY → error "Table summarization failed"

- [ ] **Network errors**
  - Kill server mid-processing → shows error
  - Can retry (reset button)

### Cost Tracking ✅

- [ ] Cost calculator shows before processing (future feature)
- [ ] Actual cost displayed after completion
- [ ] Costs match estimates (~$0.66 per 20 pages)

---

## iPhone Safari Testing (After Vercel Deploy)

### Deploy First

```bash
cd ~/pdf-voice-tool

# Install Vercel CLI
npm install -g vercel

# Deploy to production
vercel --prod

# Add environment variables in Vercel dashboard:
# - OPENAI_API_KEY
# - ANTHROPIC_API_KEY
# - NEXT_PUBLIC_APP_URL (your Vercel URL)
```

### iPhone Testing Checklist

**Requirements**: iPhone with iOS 15+ and Safari

**Test on iPhone** (visit your-app.vercel.app on iPhone Safari):

1. **Upload** ✅
   - [ ] File picker opens
   - [ ] Can select PDF from Files app
   - [ ] Upload succeeds

2. **Processing** ✅
   - [ ] Spinner shows
   - [ ] Doesn't timeout (<60s for 20-page PDF)
   - [ ] Success state appears

3. **Playback** ✅
   - [ ] Tap "Play" button → audio starts
   - [ ] Audio plays smoothly (no stuttering)
   - [ ] Screen stays on during playback (iOS 16.4+)
   - [ ] Pause works
   - [ ] Time/progress updates correctly

4. **Download** ✅
   - [ ] Tap "Download MP3" button
   - [ ] File downloads (or opens in new tab)
   - [ ] Can save to Files app
   - [ ] Downloaded file plays in Voice Memos/Music

**Common iOS Issues**:

**Audio doesn't play**:
- AudioContext requires user gesture (already handled in Player.tsx)
- Must be over HTTPS (Vercel provides this)
- Check: Tap play, look for errors in Safari Web Inspector

**Screen goes to sleep**:
- Wake Lock only works on iOS 16.4+ (graceful fallback)
- Check: Is your iPhone updated?

**Download opens inline instead of downloading**:
- Long-press the Download button → "Download Linked File"
- Or: File opens → Share → Save to Files

---

## Test with Real PDFs (Golden Set)

### Recommended Test PDFs

**1. Simple text** (5-10 pages, no tables):
- Any blog post PDF
- Simple research summary
- Expected: Fast processing (~20s), perfect quality

**2. Academic paper** (10-20 pages, 2-5 tables):
- arXiv paper (arxiv.org/pdf/...)
- Conference paper (ACL, NeurIPS, etc.)
- Expected: Tables sound natural, multi-column handled

**3. Financial report** (10-15 pages, 5+ tables):
- Quarterly earnings report
- Market research report
- Expected: Dense tables summarized well

### Where to Find Test PDFs

**From your vault** (already have marker-pdf tested ones):
```bash
# Find PDFs in phoenix that worked with marker-pdf
find ~/phoenix -name "*.pdf" -size -10M | head -10
```

**Public sources**:
- arXiv.org (academic papers)
- SEC filings (financial reports)
- Your own documents

**Create simple test**:
- Write a Google Doc with text + a table
- Export as PDF → test

---

## Debugging Guide

### Check Logs

**Local development**:
- Terminal: Shows `console.log` from API routes
- Browser console (F12): Shows frontend errors

**Vercel deployed**:
- Vercel dashboard → Your project → Logs
- Real-time logs show API route execution

### Common Issues

**Issue**: "marker_single: command not found"
```bash
# Fix: Activate vault Python env first
source ~/phoenix/.venv/bin/activate
marker_single --help  # Should work now

# In lib/marker.ts, path is hardcoded:
# const MARKER_PATH = '/Users/samaydhawan/phoenix/.venv/bin/marker_single';
```

**Issue**: "OpenAI API error: Incorrect API key"
```bash
# Fix: Check .env.local
cat .env.local
# Should show: OPENAI_API_KEY=sk-...
# If not, add your key from platform.openai.com
```

**Issue**: "Anthropic API error"
```bash
# Fix: Same as above for ANTHROPIC_API_KEY
# Get key from console.anthropic.com
```

**Issue**: "Processing timeout (>60s)"
```bash
# Fix 1: Test with smaller PDF (<20 pages)
# Fix 2: Upgrade to Vercel Pro ($20/month, 5-min timeout)
# Fix 3: Add BullMQ worker (V1 feature)
```

**Issue**: "Audio doesn't play on iPhone"
```bash
# Must be HTTPS (Vercel provides this)
# Check: Are you testing on localhost (HTTP)? Deploy to Vercel first.
```

**Issue**: "Tables still sound like gibberish"
```bash
# Debug: Check if summaries are being generated
# In app/api/process/[id]/route.ts, add:
console.log('Table summaries:', Array.from(summaries.values()));

# Should show natural sentences, not table markdown
```

---

## Performance Benchmarks

### Expected Processing Times

| PDF Size | Pages | Tables | Time | Cost |
|----------|-------|--------|------|------|
| Small | 5 | 0 | 15-20s | $0.15-0.20 |
| Medium | 10-15 | 2-3 | 35-45s | $0.40-0.50 |
| Large | 20-25 | 4-5 | 50-60s | $0.65-0.75 |

**If your times are much slower**:
- marker-pdf: Check PDF complexity (scanned PDFs take longer)
- Claude API: Check network latency
- OpenAI TTS: Check character count (should be ~1K chars/page)

---

## Beta Testing Protocol (After Deploy)

### Recruit 5-10 Testers

**Who to ask**:
- Friends who read academic papers
- Colleagues who consume research
- People who commute (target users)

**How to ask**:
```
Hey! I built a tool that converts PDFs to audio with intelligent table handling.
Can you test it? Takes 2 minutes.

Link: [your-vercel-url]

Steps:
1. Upload a PDF (academic paper, research doc, etc.)
2. Wait ~30-60s for processing
3. Play the audio
4. Tell me: Did tables sound natural? Would you use this?

Budget: I'm paying for the conversions, so test a few if you want!
```

### Track Results

| Tester | PDF Type | Pages | Success? | Tables Natural? | Feedback |
|--------|----------|-------|----------|-----------------|----------|
| 1 | Academic | 15 | ✅ | ✅ | "Loved it, would pay $9.99/mo" |
| 2 | Simple | 8 | ✅ | N/A | "Voice quality good enough" |
| 3 | Financial | 20 | ✅ | ⚠️ | "One table still sounded weird" |
| ... | ... | ... | ... | ... | ... |

### Success Criteria

**MVP succeeds if**:
- ✅ 8/10 testers complete flow successfully
- ✅ <20% failure rate
- ✅ 7/10 say "would use regularly"
- ✅ 5/10 willing to pay $9.99/month

**If achieved**: Build V1 (BullMQ + Cartesia + user accounts)

**If not**: Analyze failures:
- Quality issues → Try Cartesia voice
- Parsing issues → Try Reducto
- UX issues → Iterate on design
- No market demand → Kill project

---

## Quick Test Script (5 Minutes)

**Fastest way to verify everything works**:

```bash
# 1. Start server
cd ~/pdf-voice-tool
npm run dev

# 2. In another terminal, upload a test PDF
curl -X POST http://localhost:3000/api/upload \
  -F "file=@/path/to/test.pdf" \
  | jq .

# Should return: {"jobId":"...","fileName":"test.pdf","fileSize":...}

# 3. Process it (replace JOB_ID)
curl -X POST http://localhost:3000/api/process/JOB_ID \
  | jq .

# Should return: {"status":"complete","audioUrl":"/api/audio/JOB_ID",...}

# 4. Download audio
curl http://localhost:3000/api/audio/JOB_ID -o test.mp3

# 5. Play audio
open test.mp3  # macOS
# Or: Play in VLC, QuickTime, etc.
```

**Expected**: Audio plays, tables sound natural

---

## Automated Test Cases (Optional - For V1)

### Create test-pdfs/ Directory

```bash
mkdir -p test-pdfs
cd test-pdfs

# Download sample PDFs
curl -o simple.pdf "..."
curl -o academic.pdf "..."
curl -o financial.pdf "..."
```

### Simple Test Runner Script

```typescript
// test-runner.ts (create if you want automated testing)
import { readdir } from 'fs/promises';
import { join } from 'path';

async function testPDF(filePath: string) {
  const formData = new FormData();
  const file = await Bun.file(filePath);
  formData.append('file', file);

  // Upload
  const uploadRes = await fetch('http://localhost:3000/api/upload', {
    method: 'POST',
    body: formData,
  });
  const { jobId } = await uploadRes.json();

  // Process
  const processRes = await fetch(`http://localhost:3000/api/process/${jobId}`, {
    method: 'POST',
  });
  const result = await processRes.json();

  console.log(`✅ ${filePath}: ${result.status} (${result.pageCount} pages, $${result.cost?.total.toFixed(2)})`);
  return result.status === 'complete';
}

// Run tests
const files = await readdir('test-pdfs');
for (const file of files.filter(f => f.endsWith('.pdf'))) {
  await testPDF(join('test-pdfs', file));
}
```

**Defer this**: Only build if you're doing >20 tests. For MVP, manual testing is fine.

---

## What to Look For

### ✅ Success Indicators

- Processing completes in <60 seconds (Vercel timeout)
- Tables sound like natural sentences
- Voice quality is clear (not robotic)
- No crashes or blank pages
- Error states are helpful (not technical jargon)
- Works on iPhone Safari after deploy

### 🚨 Red Flags

- Processing takes >60 seconds (will timeout on Vercel free tier)
- Tables read as "Row 1 Column 2..." (Claude summarization not working)
- Audio is robotic/choppy (OpenAI API issue)
- Crashes on certain PDFs (marker-pdf compatibility issue)
- >30% failure rate (quality issue, need Reducto fallback)

---

## Performance Targets

### Processing Time

| Component | Target | Actual | Status |
|-----------|--------|--------|--------|
| marker-pdf | <10s for 10pg | ? | Test this |
| Claude (3 tables) | <10s | ? | Test this |
| OpenAI TTS (10K chars) | <25s | ? | Test this |
| **Total (10 pages)** | **<45s** | **?** | **Test this** |

**How to measure**:
- Add timestamps in `app/api/process/[id]/route.ts`:
```typescript
const start = Date.now();
console.log(`[${id}] Started`);
// ... processing
console.log(`[${id}] Completed in ${Date.now() - start}ms`);
```

### Audio Quality

**Test**: Listen to a table narration
- Good: "Table 2 shows revenue of $15M in Q2, up from $10M in Q1"
- Bad: "Vertical bar Q1 vertical bar dollar sign ten M vertical bar"

**If bad**: Claude summarization isn't working - check API key and logs

---

## Cost Tracking

### Log Your Test Conversions

| Test | Pages | Tables | Parsing | Tables | TTS | Total |
|------|-------|--------|---------|--------|-----|-------|
| 1 - Simple | 5 | 0 | $0.00 | $0.00 | $0.15 | $0.15 |
| 2 - Academic | 15 | 3 | $0.00 | $0.045 | $0.45 | $0.495 |
| 3 - Financial | 20 | 5 | $0.00 | $0.075 | $0.60 | $0.675 |
| ... | ... | ... | ... | ... | ... | ... |
| **Total** | - | - | - | - | - | **$X.XX** |

**Target**: <$15 total for 10-20 test conversions

---

## Final Validation (Before Calling MVP "Done")

### The 3-3-3 Rule

**3 PDF types**:
- [x] Simple text document
- [x] Academic paper with tables
- [x] Complex document (financial, research)

**3 devices**:
- [x] Desktop (Chrome or Safari)
- [x] iPhone Safari (iOS 15+)
- [x] One other (Android, iPad, Firefox, etc.)

**3 external testers**:
- [x] Tester 1 completes flow successfully
- [x] Tester 2 completes flow successfully
- [x] Tester 3 completes flow successfully

**If all 3×3×3 pass**: MVP is validated ✅

---

## Quick Iteration Loop

**If you find a bug**:

1. **Reproduce locally** (http://localhost:3000)
2. **Check logs** (terminal + browser console)
3. **Fix code**
4. **Test fix** (try same PDF again)
5. **Redeploy** (`vercel --prod`)
6. **Retest on iPhone** (if mobile-specific bug)

**Common fixes take 5-15 minutes each**

---

## After Testing: Next Steps

### If MVP Succeeds (8/10 testers happy)

1. **Document feedback** - What users loved, what to improve
2. **Plan V1** - Which features to add (BullMQ? Cartesia? User accounts?)
3. **Build V1** - Follow MIGRATION-GUIDE.md
4. **Launch publicly** - Twitter, Reddit, Hacker News

### If MVP Fails (<5/10 testers happy)

1. **Analyze failure mode**:
   - Quality (voice, table handling)?
   - UX (too slow, confusing)?
   - Value prop (don't see the point)?

2. **Decide**:
   - Pivot (try different approach)
   - Iterate (fix specific issues)
   - Kill (minimal sunk cost: $10-15 + 2 weeks)

---

*Testing guide complete - Follow this to reliably validate your MVP*
*Estimated testing time: 2-3 hours (local + deploy + iPhone + beta)*
