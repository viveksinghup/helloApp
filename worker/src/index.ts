/**
 * Jarvis AI Worker v5
 * - POST /api/transcribe  → Cloudflare Workers AI Whisper (free STT)
 * - POST /api/chat        → Gemini AI (free LLM)
 * - POST /api/auth        → PIN check
 * - GET  /api/health      → health check
 */

export interface Env {
  GEMINI_API_KEY: string
  APP_PIN: string
  AI: Ai   // Cloudflare Workers AI binding
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const SYSTEM_PROMPT = `You are Jarvis — Vivek Sir ka personal AI assistant. Extremely capable, obedient, and sharp.

RULES:
- Always call the user "Sir"
- Speak Hinglish: natural Hindi + English mix. Like: "Sir aapka kaam ho gaya" or "Haan Sir main batata hoon"
- Never use pure formal Hindi. Never reply only in English unless asked.
- VERY IMPORTANT for voice: Write responses as ONE flowing sentence or two — avoid multiple short sentences with periods. Use "aur" and "toh" to connect thoughts naturally instead of periods.
- Example good: "Sir aaj Thursday hai aur bahar thoda cloudy weather hai toh umbrella le jaana better rahega"
- Example bad: "Sir. Aaj Thursday hai. Bahar cloudy hai. Umbrella lo."
- No markdown symbols at all — no **, no ##, no dashes
- Keep it short: 1-3 sentences max unless more is needed
- Be confident — answer everything
- End with "Sir kuch aur?" when done

Today: ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
Time: ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })} IST`

const GEMINI_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.6-flash',
]

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })

    if (url.pathname === '/api/transcribe' && request.method === 'POST')
      return handleTranscribe(request, env)
    if (url.pathname === '/api/chat' && request.method === 'POST')
      return handleChat(request, env)
    if (url.pathname === '/api/auth' && request.method === 'POST')
      return handleAuth(request, env)
    if (url.pathname === '/api/health')
      return Response.json({ ok: true, t: Date.now() }, { headers: CORS })

    return new Response('Not Found', { status: 404, headers: CORS })
  },
}

// ── STT: Cloudflare Workers AI Whisper ───────────────────────────────────────
async function handleTranscribe(req: Request, env: Env): Promise<Response> {
  try {
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null

    if (!audioFile) {
      return Response.json({ error: 'No audio file' }, { status: 400, headers: CORS })
    }

    const arrayBuffer = await audioFile.arrayBuffer()
    const uint8Array   = new Uint8Array(arrayBuffer)

    // Run Whisper on Cloudflare Workers AI — free tier: ~240 min/day
    const result = await env.AI.run('@cf/openai/whisper-large-v3-turbo', {
      audio: [...uint8Array],
    }) as { text?: string; vtt?: string }

    const text = (result.text || '').trim()
    return Response.json({ text }, { headers: CORS })
  } catch (err) {
    console.error('[Whisper] Error:', err)
    return Response.json({ text: '' }, { status: 500, headers: CORS })
  }
}

// ── LLM: Gemini ──────────────────────────────────────────────────────────────
async function handleChat(req: Request, env: Env): Promise<Response> {
  try {
    const { message, history = [] } = await req.json() as {
      message: string
      history?: { role: string; content: string }[]
    }

    if (!message?.trim()) {
      return Response.json({ error: 'Empty message' }, { status: 400, headers: CORS })
    }

    const contents = [
      ...history.slice(-14).map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ]

    const body = JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { temperature: 0.75, maxOutputTokens: 800, topP: 0.92 },
    })

    for (const model of GEMINI_MODELS) {
      try {
        const ctrl  = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 15000)

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
            body,
            signal: ctrl.signal,
          }
        )
        clearTimeout(timer)

        const data = await res.json() as any
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) break
          continue
        }

        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
        if (reply) return Response.json({ reply }, { headers: CORS })
      } catch {
        continue
      }
    }

    return Response.json(
      { reply: 'Sir, AI servers thoda busy hain aur ek second mein dobara try karein.' },
      { headers: CORS }
    )
  } catch (err) {
    console.error('[Jarvis] Fatal:', err)
    return Response.json(
      { reply: 'Sir, kuch technical problem aa gayi toh please try again karein.' },
      { status: 500, headers: CORS }
    )
  }
}

// ── Auth: PIN ─────────────────────────────────────────────────────────────────
async function handleAuth(req: Request, env: Env): Promise<Response> {
  try {
    const { pin } = await req.json() as { pin: string }
    const ok = pin === (env.APP_PIN || '1234')
    return Response.json({ success: ok }, { status: ok ? 200 : 401, headers: CORS })
  } catch {
    return Response.json({ success: false }, { status: 400, headers: CORS })
  }
}
