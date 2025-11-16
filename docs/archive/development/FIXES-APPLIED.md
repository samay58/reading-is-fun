# Fixes Applied (Oct 30, 2025)

## Issue 1: marker_single CLI Syntax ✅ FIXED

**Problem**:
```bash
marker_single "/tmp/input.pdf" "/tmp/output.md" --output_format markdown
Error: Got unexpected extra argument (/tmp/output.md)
```

**Root Cause**: marker_single only accepts 1 positional argument (input PDF)

**Fix Applied** (lib/marker.ts:21):
```typescript
// OLD (WRONG):
`${MARKER_PATH} "${pdfPath}" "${outputPath}" --output_format markdown`

// NEW (CORRECT):
`${MARKER_PATH} "${pdfPath}" --output_dir "/tmp" --output_format markdown`
```

**How it works**: marker_single auto-generates output filename
- Input: `/tmp/abc-123.pdf`
- Output: `/tmp/abc-123.md` (automatic)

---

## Issue 2: Multiple Lockfiles Warning ✅ FIXED

**Problem**:
```
Warning: Next.js inferred your workspace root, but it may not be correct.
Detected multiple lockfiles:
  * /Users/samaydhawan/pnpm-lock.yaml
  * /Users/samaydhawan/pdf-voice-tool/package-lock.json
```

**Root Cause**: pnpm-lock.yaml in home directory confuses Next.js workspace detection

**Fix Applied** (next.config.ts:5):
```typescript
const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname, // Explicitly set project root
};
```

---

## Verification

✅ Build passing: `npm run build` succeeds without warnings
✅ TypeScript: All types valid
✅ marker_single syntax: Verified via --help output

---

## Status

**Ready for testing** - Both errors resolved, build clean
