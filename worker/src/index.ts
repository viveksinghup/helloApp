/**
 * Jarvis AI — Cloudflare Worker v3
 * Powerful · Fast · Reliable
 */

export interface Env {
  GEMINI_API_KEY: string
  APP_PIN: string
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// ── System Prompt — Hinglish, powerful, obedient ──────────────────────────────
const SYSTEM_PROMPT = `You are Jarvis — Vivek Sir ka personal, highly capable AI assistant. You run on Sir's private infrastructure.

PERSONALITY & RULES (non-negotiable):
- Always address the user as "Sir" — never skip this.
- Speak in Hinglish: natural Hindi + English mix, like educated Indians talk daily.
  Example: "Sir, aapka kaam ho gaya. Yeh raha result." or "Haan Sir, main check karta hoon."
- Never use pure formal Hindi (too old). Never respond only in English unless Sir asks.
- Be extremely capable — answer everything confidently: math, code, science, news, advice, creative writing, analysis, planning. Never say "I can't" unless it's genuinely impossible.
- Keep answers concise and conversational for voice. No markdown symbols (**, ##, --) in responses.
- If the question needs a detailed answer, give it clearly in natural paragraphs.
- Always end with "Sir, kuch aur chahiye?" when the response is complete.
- Be enthusiastic, respectful, and sharp. Sir is the boss — you serve him perfectly.

CAPABILITIES you must use confidently:
- Math & calculations (solve step by step)
- Code (write, debug, explain any language)
- Science, history, geography, general knowledge
- Current date/time awareness
- Creative: stories, poems, scripts, marketing copy
- Planning: travel, business, daily routines
- Personal assistant: reminders, lists, decisions
- Language: translate, explain, grammar
- Analysis: summarize, compare, evaluate

Today: ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
Time: ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })} IST
`

// ── Model priority — fastest + most reliable first ───────────────────────────
const MODELS = [
  'gemini-flash-lite-latest',   // ← fastest, lowest latency
  'gemini-3.5-flash-lite',      // fast tier 2
  'gemini-flash-latest',        // standard
  'gemini-3.6-flash',           // premium
  'gemini-3.8-flash',           // top tier fallback
]

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })

    if (url.pathname === '/api/chat' && request.method === 'POST') return handleChat(request, env)
    if (url.pathname === '/api/auth' && request.method === 'POST') return handleAuth(request, env)

    if (url.pathname === '/api/health') {
      return Response.json({ status: 'ok', v: '3.0', t: new Date().toISOString() }, { headers: CORS })
    }

    return new Response('Not Found', { status: 404, headers: CORS })
  },
}

async function handleAuth(request: Request, env: Env): Promise<Response> {
  try {
    const { pin } = await request.json() as { pin: string }
    if (pin === (env.APP_PIN || '1234')) return Response.json({ success: true }, { headers: CORS })
    return Response.json({ success: false }, { status: 401, headers: CORS })
  } catch {
    return Response.json({ error: 'Bad request' }, { status: 400, headers: CORS })
  }
}

async function handleChat(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as {
      message: string
      mode?: string
      history?: Array<{ role: string; content: string }>
    }

    const { message, history = [] } = body

    if (!message?.trim()) {
      return Response.json({ error: 'Message required' }, { status: 400, headers: CORS })
    }

    // Build conversation (keep last 20 turns for strong context)
    const contents = [
      ...history.slice(-20).map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ]

    const requestBody = JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: {
        temperature: 0.75,
        topP: 0.92,
        topK: 40,
        maxOutputTokens: 2048,
        candidateCount: 1,
      },
    })

    let replyText = ''
    let lastError = ''

    for (const model of MODELS) {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
      try {
        // Per-model timeout: 14 seconds
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 14000)

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
          body: requestBody,
          signal: ctrl.signal,
        })
        clearTimeout(timer)

        const data = await res.json() as any

        if (!res.ok) {
          lastError = data?.error?.message || `HTTP ${res.status}`
          console.error(`[Jarvis] ${model} → ${res.status}: ${lastError}`)
          // Auth error — stop immediately
          if (res.status === 401 || res.status === 403) break
          continue
        }

        replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
        if (replyText) {
          console.log(`[Jarvis] ✓ ${model}`)
          break
        }
      } catch (e: any) {
        lastError = e?.name === 'AbortError' ? `${model} timeout` : String(e)
        console.error(`[Jarvis] ${model} error:`, lastError)
        continue
      }
    }

    // If all models fail — give a smart Hinglish fallback, not a dead error
    if (!replyText) {
      console.error('[Jarvis] All models failed:', lastError)
      replyText = 'Sir, abhi AI servers thoda busy hain. Ek second mein dobara try karein — main ready hoon.'
    }

    // Stream response as SSE
    const enc = new TextEncoder()
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()

    ;(async () => {
      const CHUNK = 70  // larger chunks = fewer round trips = faster display
      for (let i = 0; i < replyText.length; i += CHUNK) {
        await writer.write(
          enc.encode(`data: ${JSON.stringify({ text: replyText.slice(i, i + CHUNK) })}\n\n`)
        )
      }
      await writer.write(enc.encode('data: [DONE]\n\n'))
      await writer.close()
    })()

    return new Response(readable, {
      headers: { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    })

  } catch (err) {
    console.error('[Jarvis] Fatal:', err)
    return Response.json({ error: 'Internal error' }, { status: 500, headers: CORS })
  }
}
