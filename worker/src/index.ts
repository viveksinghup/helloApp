/**
 * Jarvis AI — Cloudflare Worker Backend
 * Private personal AI agent. Streams responses via Gemini API.
 */

export interface Env {
  GEMINI_API_KEY: string
  APP_PIN: string
  JARVIS_KV: KVNamespace
  JARVIS_DB: D1Database
  ENVIRONMENT: string
}

// ─── CORS helper ──────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// ─── System Prompt for your personal AI ───────────────────────────────────────
const SYSTEM_PROMPT = `You are Jarvis, Vivek's private and highly intelligent personal AI assistant.

Your personality:
- Friendly, concise, and straight to the point
- Proactive: suggest follow-ups, related ideas, or improvements when useful
- You know Vivek prefers clear bullet points and structured answers
- For research tasks: provide sources, key facts, and a summary
- For tasks/planning: use numbered steps and checklists
- For notes: organize and format clearly in Markdown
- Always respond in the same language the user writes in

You are running privately on Vivek's personal infrastructure.
Today's date: ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
`

// ─── Mode-specific system prompts ─────────────────────────────────────────────
const MODE_PROMPTS: Record<string, string> = {
  chat: '',
  research: `\nYou are in RESEARCH MODE. For every query:
1. Provide a clear summary first
2. List key facts with bullet points  
3. Mention what else Vivek might want to explore
4. Format all output in clean Markdown`,
  tasks: `\nYou are in TASK MODE. Help Vivek:
- Create, organize, and prioritize tasks
- Break big goals into actionable steps
- Use ✅ ⏳ 🔴 emoji to indicate status
- Output clean numbered or bulleted checklists`,
  notes: `\nYou are in NOTES MODE. Help Vivek:
- Organize thoughts and information clearly
- Format everything in well-structured Markdown
- Use headers, lists, and code blocks appropriately
- Summarize and extract key insights`,
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

    // Call Gemini API with streaming
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:streamGenerateContent?alt=sse&key=${env.GEMINI_API_KEY}`

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          maxOutputTokens: 2048,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      }),
    })

    if (!geminiResponse.ok) {
      const err = await geminiResponse.text()
      console.error('Gemini error:', err)
      return Response.json(
        { error: 'AI service error. Check your API key.' },
        { status: 502, headers: CORS }
      )
    }

    // Stream Gemini SSE → Client SSE transform
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()

    // Process Gemini's SSE stream and forward to client
    ;(async () => {
      const reader = geminiResponse.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const jsonStr = line.slice(6).trim()
            if (jsonStr === '[DONE]') continue
            try {
              const parsed = JSON.parse(jsonStr)
              const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text
              if (text) {
                const sseChunk = `data: ${JSON.stringify({ text })}\n\n`
                await writer.write(encoder.encode(sseChunk))
              }
            } catch {}
          }
        }
      } finally {
        await writer.write(encoder.encode('data: [DONE]\n\n'))
        await writer.close()
      }
    })()

    return new Response(readable, {
      headers: {
        ...CORS,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err) {
    console.error('Chat error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500, headers: CORS })
  }
}

