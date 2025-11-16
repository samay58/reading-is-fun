#!/bin/bash

# Test script for PDF-to-Voice streaming functionality
# Usage: ./test-streaming.sh

echo "🚀 PDF-to-Voice Streaming Test"
echo "=============================="

# Check if server is running
echo "Checking if dev server is running..."
curl -s http://localhost:3000 > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Dev server not running. Starting it now..."
    echo "Please run: npm run dev"
    echo "Then run this script again."
    exit 1
else
    echo "✅ Dev server is running"
fi

# Create a test PDF if needed
TEST_PDF="/tmp/test-document.pdf"
if [ ! -f "$TEST_PDF" ]; then
    echo "📝 Creating test PDF..."
    # You would need to have a test PDF ready
    echo "Please provide a test PDF at: $TEST_PDF"
    echo "You can use any academic paper or document (5-10 pages recommended)"
    exit 1
fi

echo ""
echo "📋 Test Checklist:"
echo "1. Visit http://localhost:3000"
echo "2. Ensure 'Enable streaming (beta)' is checked"
echo "3. Upload your test PDF"
echo ""
echo "Expected Results:"
echo "✅ Extraction starts immediately"
echo "✅ First audio chunk plays in ~30 seconds"
echo "✅ Progress bar shows chunks processing"
echo "✅ Audio plays continuously without gaps"
echo "✅ Download button appears when complete"
echo ""
echo "Performance Targets:"
echo "- Extraction: ~19 seconds for 18 pages"
echo "- First chunk: ~30 seconds total"
echo "- Full processing: ~90-120 seconds for 20 pages"
echo ""
echo "🎯 Ready to test! Open http://localhost:3000 in your browser."