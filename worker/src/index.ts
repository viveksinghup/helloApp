/**
 * Jarvis AI — Cloudflare Worker Backend
 * Private personal AI agent. Streams responses via Gemini API.
 */

export interface Env {
  GEMINI_API_KEY: string
  APP_PIN: string
  ENVIRONMENT: string
  JARVIS_KV?: KVNamespace   // optional — add later
  JARVIS_DB?: D1Database    // optional — add later
}

// ─── CORS helper ──────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// ─── System Prompt — Hindi-first, "Sir" personality ───────────────────────────
const SYSTEM_PROMPT = `आप Jarvis हैं — Vivek Sir के निजी और अत्यंत बुद्धिमान AI सहायक।

आपका स्वभाव और नियम:
- हमेशा Vivek को "Sir" कहकर बुलाएं — यह अनिवार्य है।
- **डिफ़ॉल्ट भाषा हिंदी है।** जब तक Sir कोई अन्य भाषा में न बोलें, हमेशा हिंदी में जवाब दें।
- आज्ञाकारी, विनम्र और सहायक रहें — Sir जो कहें वही करें।
- जवाब संक्षिप्त और स्पष्ट दें — ज़्यादा लंबे paragraph न लिखें।
- Voice के लिए जवाब natural बोलने योग्य हिंदी में दें — markdown कम से कम use करें।
- Bullet points की जगह साधारण वाक्यों में बताएं।
- Sir की हर ज़रूरत को प्राथमिकता दें।
- उत्साहपूर्वक और सकारात्मक रहें — Sir को हमेशा अच्छा महसूस कराएं।
- जब कोई बात पूरी हो जाए तो पूछें: "Sir, क्या और कुछ चाहिए?"

आज की तारीख: ${new Date().toLocaleDateString('hi-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
आप Sir के निजी infrastructure पर चल रहे हैं — पूरी तरह सुरक्षित और गोपनीय।
`

// ─── Mode-specific prompts (all in Hindi) ─────────────────────────────────────
const MODE_PROMPTS: Record<string, string> = {
  chat: '',
  research: `\nआप RESEARCH MODE में हैं। हर query के लिए:
1. पहले संक्षिप्त summary दें
2. मुख्य तथ्य बोलने योग्य हिंदी में बताएं
3. Sir को suggest करें कि आगे क्या जानें`,
  tasks: `\nआप TASK MODE में हैं। Sir की मदद करें:
- कामों को organize और prioritize करें
- बड़े goals को छोटे steps में तोड़ें
- Status बताने के लिए ✅ ⏳ 🔴 use करें`,
  notes: `\nआप NOTES MODE में हैं। Sir की मदद करें:
- विचारों को स्पष्ट रूप से organize करें
- Key insights निकालें और सरल भाषा में बताएं`,
}

// ─── Main Worker Handler ──────────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }

    // ── Route: POST /api/chat ─────────────────────────────────────────────────
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      return handleChat(request, env)
    }

    // ── Route: POST /api/auth ─────────────────────────────────────────────────
    if (url.pathname === '/api/auth' && request.method === 'POST') {
      return handleAuth(request, env)
    }

    // ── Route: GET /api/health ────────────────────────────────────────────────
    if (url.pathname === '/api/health') {
      return Response.json(
        { status: 'ok', version: '1.0.0', time: new Date().toISOString() },
        { headers: CORS }
      )
    }

    return new Response('Not Found', { status: 404, headers: CORS })
  },
}

// ─── Auth Handler ─────────────────────────────────────────────────────────────
async function handleAuth(request: Request, env: Env): Promise<Response> {
  try {
    const { pin } = await request.json() as { pin: string }
    const correct = env.APP_PIN || '1234' // falls back to '1234' if secret not set
    if (pin === correct) {
      return Response.json({ success: true }, { headers: CORS })
    }
    return Response.json({ success: false }, { status: 401, headers: CORS })
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400, headers: CORS })
  }
}

// ─── Chat Handler (Streaming) ─────────────────────────────────────────────────
async function handleChat(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as {
      message: string
      mode?: string
      history?: Array<{ role: string; content: string }>
    }

    const { message, mode = 'chat', history = [] } = body

    if (!message?.trim()) {
      return Response.json({ error: 'Message is required' }, { status: 400, headers: CORS })
    }

    // Build system instruction
    const systemInstruction = SYSTEM_PROMPT + (MODE_PROMPTS[mode] || '')

    // Build conversation history for Gemini
    const contents = [
      ...history.slice(-10).map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ]

    // Model priority: 3.6-flash (stable) → gemini-flash-latest → gemini-flash-lite-latest
    const MODELS = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest']

    const requestBody = JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents,
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 2048,
      },
    })

    // Try each model until one succeeds
    let replyText = ''
    let lastError = ''

    for (const model of MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': env.GEMINI_API_KEY,   // ← correct header auth
          },
          body: requestBody,
        })

        const data = await res.json() as any

        if (!res.ok) {
          lastError = data?.error?.message || `HTTP ${res.status}`
          console.error(`Model ${model} failed (${res.status}):`, lastError)
          if (res.status === 401 || res.status === 403) break  // bad key — stop trying
          continue  // 503/404 → try next model
        }

        replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (replyText) {
          console.log(`✓ Response from ${model}: ${replyText.slice(0, 60)}...`)
          break
        }
      } catch (e) {
        lastError = String(e)
        console.error(`Model ${model} fetch error:`, e)
        continue
      }
    }

    if (!replyText) {
      console.error('All models failed. Last error:', lastError)
      return Response.json(
        { error: 'AI service error. Try again in a moment.' },
        { status: 502, headers: CORS }
      )
    }

    // Send as SSE chunks for smooth frontend typing effect
    const encoder = new TextEncoder()
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()

    ;(async () => {
      const CHUNK = 50
      for (let i = 0; i < replyText.length; i += CHUNK) {
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ text: replyText.slice(i, i + CHUNK) })}\n\n`)
        )
      }
      await writer.write(encoder.encode('data: [DONE]\n\n'))
      await writer.close()
    })()

    return new Response(readable, {
      headers: {
        ...CORS,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('Chat error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500, headers: CORS })
  }
}

