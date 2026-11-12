import { useState, useRef, useEffect } from 'react'
import { useChatStore } from '../stores/chatStore'
import { Send, Mic, MicOff } from 'lucide-react'

// The deployed Worker URL — updated at deploy time
const API_BASE = import.meta.env.VITE_API_URL || '/api'

export default function ChatInput() {
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const { addMessage, updateMessage, setLoading, isLoading, mode } = useChatStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }, [text])

  const sendMessage = async () => {
    const content = text.trim()
    if (!content || isLoading) return
    setText('')

    // Add user message
    addMessage({ role: 'user', content })

    // Add placeholder AI message (streaming)
    setLoading(true)
    const aiId = addMessage({ role: 'assistant', content: '', isStreaming: true })

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, mode }),
      })

      if (!response.ok) throw new Error('API error')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let full = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          // Parse SSE: "data: {...}\n\n"
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.text) {
                  full += data.text
                  updateMessage(aiId, full, true)
                }
              } catch {}
            }
          }
        }
        updateMessage(aiId, full, false)
      }
    } catch (err) {
      updateMessage(aiId, '⚠️ Something went wrong. Please check your connection and try again.', false)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Voice Input (Web Speech API)
  const toggleVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.')
      return
    }

    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-IN'
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join('')
      setText(transcript)
    }

    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  return (
    <div className="px-4 py-3 safe-bottom border-t border-surface-border bg-surface/80 backdrop-blur-md">
      <div className="flex items-end gap-2 card px-3 py-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Jarvis..."
          rows={1}
          className="flex-1 bg-transparent text-white placeholder-slate-500 text-sm resize-none
                     focus:outline-none leading-relaxed py-1 max-h-40"
        />

        {/* Voice Button */}
        <button
          onClick={toggleVoice}
          className={`btn-icon mb-0.5 shrink-0 ${listening ? 'text-red-400' : 'text-slate-500 hover:text-white'}`}
          title="Voice input"
        >
          {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Send Button */}
        <button
          onClick={sendMessage}
          disabled={!text.trim() || isLoading}
          className="mb-0.5 shrink-0 w-9 h-9 bg-accent disabled:bg-accent/30 hover:bg-accent-dark
                     rounded-xl flex items-center justify-center transition-all duration-200
                     active:scale-90 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>

      {listening && (
        <p className="text-xs text-red-400 text-center mt-2 animate-pulse">
          🎙 Listening… speak now
        </p>
      )}
      <p className="text-[10px] text-slate-700 text-center mt-1.5">
        Private · Encrypted · Only you can see this
      </p>
    </div>
  )
}

