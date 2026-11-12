# 🤖 Jarvis AI — Personal PWA

> My private AI assistant. Built with React + Cloudflare Workers + Gemini API.
> Runs 24/7 for free. Installable as a PWA on iPhone/Android.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Tailwind CSS + Vite |
| PWA | vite-plugin-pwa + Workbox Service Worker |
| Backend | Cloudflare Worker (TypeScript) |
| AI Brain | Google Gemini 2.0 Flash (streaming) |
| Storage | Cloudflare KV + D1 |
| CI/CD | GitHub Actions → auto-deploy on push |

## Features

- 🔐 PIN lock screen (private — only I can access)
- 🤖 Streaming AI responses (token-by-token, feels instant)
- 🎙️ Voice input (Web Speech API, Indian English)
- 📋 4 modes: Chat · Research · Tasks · Notes
- 📱 Installable PWA (Add to Home Screen)
- 🌙 Full dark mode, iPhone-safe-area aware
- ⚡ Offline-ready via Service Worker

## Local Development

```bash
# Terminal 1 — Worker backend
cd worker && npm install && npx wrangler dev

# Terminal 2 — Frontend
cd frontend && npm install && npm run dev
```

Open: http://localhost:5173

## Deploy to Cloudflare (one-time setup)

```bash
# 1. Login
npx wrangler login

# 2. Create storage
cd worker
npx wrangler kv namespace create JARVIS_KV   # copy id to wrangler.toml
npx wrangler d1 create jarvis-db             # copy id to wrangler.toml

# 3. Set secrets
npx wrangler secret put GEMINI_API_KEY       # from aistudio.google.com
npx wrangler secret put APP_PIN              # your unlock PIN

# 4. Deploy worker
npx wrangler deploy

# 5. Deploy frontend
cd ../frontend
npm run build
npx wrangler pages deploy dist --project-name=jarvis-ai
```

## GitHub Actions Auto-Deploy

Add these **Repository Secrets** in GitHub → Settings → Secrets:

| Secret | Where to get it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare Dashboard → My Profile → API Tokens |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Dashboard → right sidebar |
| `VITE_API_URL` | `https://jarvis-ai-worker.YOUR_SUBDOMAIN.workers.dev/api` |

After setting secrets, every `git push` to `main` auto-deploys both worker + frontend.

## Privacy

- Repo is **private** on GitHub
- API keys stored as encrypted Cloudflare Secrets (never in code)
- App is PIN-locked — only accessible by you
- All data stays within your own Cloudflare account
