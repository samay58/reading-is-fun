# Quick Test with Simple PDF

The "investinginsecondordereffects" PDF might be complex. Let's test with something simpler first.

## Create a Simple Test PDF

**Option 1**: Use a PDF you know works with marker-pdf
```bash
# Find PDFs that worked before
find ~/phoenix -name "*.pdf" -size -500k | head -5
```

**Option 2**: Create a trivial test PDF
```bash
# Install wkhtmltopdf if needed: brew install wkhtmltopdf
echo "<h1>Test Document</h1><p>This is a simple test. It has no tables.</p>" > /tmp/test.html
wkhtmltopdf /tmp/test.html /tmp/simple-test.pdf
```

**Option 3**: Download a known-good PDF
```bash
# Simple single-page PDF
curl -o ~/Downloads/test-simple.pdf "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
```

## Test Again (After Server Restarts)

1. Refresh http://localhost:3000
2. Upload the simple PDF
3. Should complete in ~10-20 seconds

If this works, the "investinginsecondordereffects" PDF likely has complex images that slow down marker_single.

## Optimizations Applied

Added to marker_single command:
- `--disable_image_extraction` → Skip images (we only need text)
- `--disable_multiprocessing` → More reliable
- `timeout: 120000` → 2-minute hard limit

This should make processing much faster (~10-30s instead of 5+ minutes).
