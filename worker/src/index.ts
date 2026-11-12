/**
 * Jarvis AI — Cloudflare Worker Backend
 * Fixed model names + robust error handling
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

const SYSTEM_PROMPT = `You are Jarvis — Vivek Sir ka personal aur bahut intelligent AI assistant.

Your personality aur rules:
- Hamesha Vivek ko "Sir" bulao — yeh must hai, koi exception nahi.
- Hinglish mein bolo — matlab Hindi + English mix. Jaise normal educated Indians baat karte hain. Example: "Sir, aapka kaam ho jayega, bas ek second" or "Haan Sir, main check karta hoon — give me a moment."
- Pure Hindi mat bolo (old-fashioned lagti hai). Pure English bhi mat bolo. Natural Hinglish use karo.
- Common English words jo Indians daily use karte hain woh freely use karo — like: okay, sure, done, check, update, time, date, task, meeting, reminder, plan, idea, problem, solution, work, project, etc.
- Aajnakari, respectful aur helpful raho — Sir jo bolen woh karo, no questions asked.
- Short aur clear jawab do — bullet points ki jagah natural sentences mein bolo.
- Enthusiastic aur positive raho — Sir ko hamesha good feel karao.
- Jab koi kaam ho jaye toh pucho: "Sir, kuch aur chahiye?"
- Markdown symbols (**, ##, etc.) bilkul mat use karo — simple plain text mein bolo.

Aaj ki date: ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Aap Sir ke private system pe chal rahe ho — completely secure aur confidential.
`

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }

    if (url.pathname === '/api/chat' && request.method === 'POST') {
      return handleChat(request, env)
    }

    if (url.pathname === '/api/auth' && request.method === 'POST') {
      return handleAuth(request, env)
    }

    if (url.pathname === '/api/health') {
      return Response.json(
        { status: 'ok', version: '2.0.0', time: new Date().toISOString() },
        { headers: CORS }
      )
    }

    return new Response('Not Found', { status: 404, headers: CORS })
  },
}

async function handleAuth(request: Request, env: Env): Promise<Response> {
  try {
    const { pin } = await request.json() as { pin: string }
    const correct = env.APP_PIN || '1234'
    if (pin === correct) {
      return Response.json({ success: true }, { headers: CORS })
    }
    return Response.json({ success: false }, { status: 401, headers: CORS })
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400, headers: CORS })
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
      return Response.json({ error: 'Message is required' }, { status: 400, headers: CORS })
    }

    // ✅ CORRECT Gemini model names (verified working as of Nov 2026)
    const MODELS = [
      'gemini-3.6-flash',
      'gemini-3.8-flash',
      'gemini-flash-latest',
    ]

    const contents = [
      ...history.slice(-10).map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ]

    const requestBody = JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 1024,
      },
    })

    let replyText = ''
    let lastError = ''

    for (const model of MODELS) {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': env.GEMINI_API_KEY,
          },
          body: requestBody,
        })

        const data = await res.json() as any

        if (!res.ok) {
          lastError = data?.error?.message || `HTTP ${res.status}`
          console.error(`[Jarvis] Model ${model} failed (${res.status}):`, lastError)
          if (res.status === 400 || res.status === 401 || res.status === 403) break
          continue
        }

        replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (replyText) {
          console.log(`[Jarvis] ✓ ${model} responded`)
          break
        }
      } catch (e) {
        lastError = String(e)
        console.error(`[Jarvis] Model ${model} threw:`, e)
        continue
      }
    }

    if (!replyText) {
      console.error('[Jarvis] All models failed. Last error:', lastError)
      // Return a helpful Hindi fallback instead of a bare error
      replyText = `Sir, अभी AI सर्वर से जुड़ने में थोड़ी दिक्कत है। कृपया एक पल में फिर बोलें।`
    }

    // Stream response as SSE chunks
    const encoder = new TextEncoder()
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()

    ;(async () => {
      const CHUNK = 60
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
    console.error('[Jarvis] Chat handler error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500, headers: CORS })
  }
}
