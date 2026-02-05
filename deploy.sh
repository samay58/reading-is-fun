#!/bin/bash

# PDF to Voice - Quick Deploy Script

echo "🚀 Deploying PDF to Voice to Vercel..."
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null
then
    echo "❌ Vercel CLI not found. Installing..."
    npm i -g vercel
fi

# Build the project first to catch any errors
echo "📦 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed! Please fix errors before deploying."
    exit 1
fi

echo "✅ Build successful!"
echo ""

# Deploy to Vercel
echo "🚀 Deploying to Vercel production..."
vercel --prod

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "📱 Your app is ready at:"
    echo "   https://pdf-voice-tool.vercel.app"
    echo ""
    echo "💡 Remember to:"
    echo "   1. Set environment variables in Vercel dashboard"
    echo "   2. Update NEXT_PUBLIC_APP_URL with your production URL"
    echo ""
    echo "📖 See DEPLOY-TO-VERCEL.md for detailed instructions"
else
    echo "❌ Deployment failed. Check the error messages above."
    exit 1
fi