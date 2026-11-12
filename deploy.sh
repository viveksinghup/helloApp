#!/bin/bash
# ─────────────────────────────────────────────────────────────────
#  Jarvis AI — Full Deploy Script
#  Deploys Worker backend + PWA frontend to Cloudflare
# ─────────────────────────────────────────────────────────────────

set -e
echo "🚀 Starting Jarvis AI deployment..."

# 1. Deploy the Worker backend
echo ""
echo "📡 Step 1/3: Deploying Cloudflare Worker backend..."
cd worker
npm install
npx wrangler deploy
cd ..

# Get the worker URL from wrangler output (update .env.production)
echo ""
echo "🔑 Step 2/3: Set your secrets (if not already done):"
echo "   npx wrangler secret put GEMINI_API_KEY   (from aistudio.google.com)"
echo "   npx wrangler secret put APP_PIN           (your personal unlock PIN)"
echo ""
read -p "   Have you set your secrets? (y/n): " secrets_done
if [ "$secrets_done" != "y" ]; then
  echo "⚠️  Please set your secrets first, then re-run this script."
  exit 1
fi

# 3. Build & deploy the PWA frontend to Cloudflare Pages
echo ""
echo "🌐 Step 3/3: Building and deploying PWA frontend..."
cd frontend
npm install
npm run build

echo ""
echo "🎉 Deploy complete!"
echo ""
echo "📱 Your app URLs:"
echo "   Worker API: https://jarvis-ai-worker.YOUR_SUBDOMAIN.workers.dev"
echo "   PWA App:    https://jarvis-ai.pages.dev  (or your Pages URL)"
echo ""
echo "📲 To install as PWA on your phone:"
echo "   1. Open the Pages URL in Safari (iOS) or Chrome (Android)"
echo "   2. Tap Share → Add to Home Screen"
echo "   3. Done! Jarvis is now on your home screen."

