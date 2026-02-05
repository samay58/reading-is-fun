# 🚀 Deploy to Vercel Production

## Pre-Deployment Checklist

✅ **Code is production-ready:**
- Streaming works with chunked audio generation
- Pause/resume functionality fixed
- SSE events flow properly
- Download provides full audio (Note: Some players may show incorrect duration but audio plays fully)
- 40-page PDF limit enforced
- Error handling with retries for DeepSeek API

## Step 1: Set Up Vercel Project

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# In your project directory
vercel
```

Follow the prompts:
- Setup and deploy? **Yes**
- Which scope? **Your personal account**
- Link to existing project? **No** (first time) or **Yes** (if already exists)
- Project name? **pdf-voice-tool**
- Directory? **./** (current directory)
- Override settings? **No**

## Step 2: Configure Environment Variables

Go to your Vercel dashboard → Your Project → Settings → Environment Variables

Add these **REQUIRED** variables for Production:

```env
# Anthropic API (for table narration)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# OpenAI API (fallback TTS if Inworld fails)
OPENAI_API_KEY=your_openai_api_key_here

# Inworld AI (primary TTS - 67% cheaper than OpenAI)
INWORLD_API_KEY=your_inworld_api_key_here
INWORLD_WORKSPACE_ID=your_inworld_workspace_id_here

# TTS Settings
TTS_PROVIDER=auto
TTS_AB_TESTING_ENABLED=false
TTS_AB_TESTING_RATIO=0.1

# App URL (update with your Vercel URL after first deploy)
NEXT_PUBLIC_APP_URL=https://pdf-voice-tool.vercel.app
```

## Step 3: Deploy to Production

```bash
# Deploy to production
vercel --prod
```

Or push to GitHub and Vercel will auto-deploy if connected.

## Step 4: Get Your Production URL

After deployment, Vercel will give you a URL like:
- `https://pdf-voice-tool.vercel.app`
- or `https://pdf-voice-tool-[username].vercel.app`

## Step 5: Update App URL Environment Variable

Go back to Vercel dashboard → Settings → Environment Variables
Update `NEXT_PUBLIC_APP_URL` with your actual production URL.

Redeploy:
```bash
vercel --prod
```

## 📱 Tomorrow's Drive Link

Your production URL will be:
```
https://pdf-voice-tool.vercel.app
```

Or if taken:
```
https://pdf-voice-tool-samaydhawan.vercel.app
```

This will work on:
- ✅ Mobile browser
- ✅ Desktop
- ✅ Any device with internet

## ⚠️ Important Notes

1. **DeepSeek OCR API**: Free but sometimes returns 500 errors. The app retries 3 times with exponential backoff.

2. **Audio Concatenation**: Downloads work but some players may show incorrect duration metadata. The full audio IS there and will play completely.

3. **40-page limit**: PDFs over 40 pages will be rejected to prevent timeout.

4. **Streaming**: Works great! Audio starts playing as soon as first chunk is ready.

5. **Costs**:
   - Inworld TTS: ~$0.40 per 40-page PDF
   - OpenAI TTS (fallback): ~$1.20 per 40-page PDF
   - Anthropic (tables): ~$0.02 per PDF

## 🔧 Troubleshooting

### If deployment fails:
```bash
# Check build logs
vercel logs

# Clear cache and rebuild
vercel --prod --force
```

### If audio doesn't generate:
- Check API keys in Vercel dashboard
- Verify DeepSeek API is working (sometimes down)
- Check Vercel Function logs in dashboard

### If download shows wrong duration:
- This is expected with simple concatenation
- Audio WILL play fully, just scrubbing may not work perfectly
- Use VLC or other robust players for best experience

## 🎯 Test Your Deployment

1. Go to your production URL
2. Upload a PDF (under 40 pages, < 10MB)
3. Wait for processing (2-3 minutes for 20 pages)
4. Audio should auto-play first chunk
5. Download button appears when complete
6. Downloaded file plays full audio

## 📊 Monitor Usage

Vercel Dashboard shows:
- Function execution time
- Error logs
- Usage/costs

## 🔐 Security Notes

- API keys are server-side only (never sent to browser)
- Files auto-delete after 1 hour
- No user data is permanently stored

---

## Quick Deploy Command

After initial setup, future deploys are just:
```bash
vercel --prod
```

That's it! Your PDF-to-Voice tool is ready for production! 🎉