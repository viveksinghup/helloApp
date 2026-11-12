import { useState, useRef, useEffect, useCallback } from 'react'
import { History, Settings, X, Keyboard, Plus, Mic } from 'lucide-react'
import MindSphere from './MindSphere'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { useTTS } from '../hooks/useTTS'
import { useChatStore } from '../stores/chatStore'
import { useAuthStore } from '../stores/authStore'
import FabMenu from './FabMenu'
import ChatHistory from './ChatHistory'

type SphereState = 'idle' | 'listening' | 'thinking' | 'speaking'
const API_BASE = import.meta.env.VITE_API_URL || '/api'

// Greeting based on time of day in Hindi
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'शुभ प्रभात, Sir! 🌅'
  if (h < 17) return 'नमस्ते, Sir! 👋'
  if (h < 21) return 'शुभ संध्या, Sir! 🌆'
  return 'शुभ रात्रि, Sir! 🌙'
}

export default function VoiceScreen() {
  const { messages, addMessage, updateMessage, setLoading, isLoading, clearChat } = useChatStore()
  const { logout } = useAuthStore()

  const [sphereState, setSphereState] = useState<SphereState>('idle')
  const [showHistory, setShowHistory]  = useState(false)
  const [showKeyboard, setShowKeyboard] = useState(false)
  const [typedText, setTypedText]       = useState('')
  const [fabOpen, setFabOpen]           = useState(false)
  const [statusText, setStatusText]     = useState('')
  const [interimDisplay, setInterimDisplay] = useState('')

  const { speak, stop: stopTTS } = useTTS()
  const bottomRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Auto-greeting on first load ──────────────────────────────────────────
  const greetedRef = useRef(false)
  useEffect(() => {
    if (greetedRef.current || messages.length > 0) return
    greetedRef.current = true

    const greeting = `${getGreeting()} मैं Jarvis हूँ, आपका व्यक्तिगत AI सहायक। बताइए, आज मैं आपकी किस प्रकार सेवा कर सकता हूँ?`
    setTimeout(() => {
      const id = addMessage({ role: 'assistant', content: greeting })
      setSphereState('speaking')
      setStatusText('बोल रहा हूँ...')
      speak(greeting, () => {
        setSphereState('idle')
        setStatusText('')
      })
    }, 600)
  }, [])

  // ── Send message to API ──────────────────────────────────────────────────
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return
    setShowKeyboard(false)
    setTypedText('')

    addMessage({ role: 'user', content })
    setSphereState('thinking')
    setStatusText('सोच रहा हूँ...')
    setLoading(true)

    const aiId = addMessage({ role: 'assistant', content: '', isStreaming: true })

    try {
      const history = messages.slice(-8).map(m => ({ role: m.role, content: m.content }))

      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, mode: 'chat', history }),
      })

      if (!response.ok) throw new Error('API error')

      const reader  = response.body!.getReader()
      const decoder = new TextDecoder()
      let full = ''

      setSphereState('speaking')
      setStatusText('जवाब दे रहा हूँ...')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value).split('\n')) {
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
      setStatusText('बोल रहा हूँ...')

      // Speak the response
      speak(full, () => {
        setSphereState('idle')
        setStatusText('')
      })
    } catch {
      const errMsg = 'क्षमा करें Sir, कुछ गड़बड़ हो गई। एक बार फिर बोलें।'
      updateMessage(aiId, errMsg, false)
      speak(errMsg, () => { setSphereState('idle'); setStatusText('') })
    } finally {
      setLoading(false)
    }
  }, [messages, isLoading, addMessage, updateMessage, setLoading, speak])

  // ── Speech recognition ───────────────────────────────────────────────────
  const { isListening, interimText, start: startListening, stop: stopListening } =
    useSpeechRecognition((finalText) => {
      setSphereState('thinking')
      setStatusText('समझ रहा हूँ...')
      setInterimDisplay('')
      sendMessage(finalText)
    })

  useEffect(() => {
    if (isListening) {
      setSphereState('listening')
      setStatusText('सुन रहा हूँ...')
    }
    setInterimDisplay(interimText)
  }, [isListening, interimText])

  const toggleMic = () => {
    if (isListening) {
      stopListening()
      stopTTS()
      setSphereState('idle')
      setStatusText('')
    } else {
      stopTTS()
      startListening()
    }
  }

  const handleCancel = () => {
    stopListening()
    stopTTS()
    setSphereState('idle')
    setStatusText('')
    setInterimDisplay('')
  }

  const isConversing = messages.length > 0
  const sphereSize   = isConversing ? 110 : 220

  return (
    <div className="flex flex-col h-full bg-black relative overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 pt-safe pb-3 z-10">
        <button className="icon-btn" onClick={() => setShowHistory(!showHistory)}>
          <History className="w-4 h-4" />
        </button>

        <h1 className="jarvis-title text-xl text-white tracking-wide">Jarvis</h1>

        <div className="flex gap-2">
          <button className="icon-btn" onClick={() => setShowHistory(!showHistory)}>
            <History className="w-4 h-4" />
          </button>
          <button className="icon-btn" onClick={() => setFabOpen(!fabOpen)}>
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Mind Sphere + Status ── */}
      <div className={`flex flex-col items-center transition-all duration-500 ${
        isConversing ? 'pt-2' : 'pt-6 flex-1'
      }`}>
        <div className={`transition-all duration-500 ${isConversing ? '' : 'drop-shadow-2xl'}`}>
          <MindSphere state={sphereState} size={sphereSize} />
        </div>

        {/* Status / greeting text */}
        {!isConversing && (
          <div className="text-center mt-5 px-8 animate-fade-up">
            <p className="text-white text-xl font-medium tracking-wide"
               style={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic' }}>
              {getGreeting()}
            </p>
            <p className="text-gray-500 text-sm mt-1.5">
              बात करने के लिए mic दबाएं
            </p>
          </div>
        )}

        {/* Listening / status indicator */}
        {statusText && (
          <p className="listening-text mt-2">{statusText}</p>
        )}
        {interimDisplay && (
          <p className="text-gray-400 text-xs mt-1 italic px-6 text-center">
            "{interimDisplay}"
          </p>
        )}
      </div>

      {/* ── Chat History Bubbles ── */}
      {isConversing && (
        <div className="flex-1 chat-scroll px-4 py-3 space-y-3">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex animate-fade-up ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={msg.role === 'user' ? 'bubble-user' : 'bubble-ai'}>
                {msg.content || <span className="animate-pulse opacity-50">...</span>}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* ── Keyboard text input (shows when keyboard icon tapped) ── */}
      {showKeyboard && (
        <div className="px-4 py-3 animate-fade-up">
          <div className="flex items-center gap-2 bg-gray-900 rounded-2xl px-4 py-3
                          border border-gray-700 focus-within:border-purple-700">
            <input
              autoFocus
              type="text"
              value={typedText}
              onChange={e => setTypedText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && typedText.trim()) sendMessage(typedText) }}
              placeholder="यहाँ लिखें..."
              className="flex-1 bg-transparent text-white text-sm placeholder-gray-600 outline-none"
            />
            <button
              onClick={() => typedText.trim() && sendMessage(typedText)}
              disabled={!typedText.trim()}
              className="text-purple-400 disabled:text-gray-700 transition-colors"
            >
              भेजें
            </button>
          </div>
        </div>
      )}

      {/* ── Bottom Controls — X | MIC | Keyboard ── */}
      <div className="flex items-center justify-center gap-8 pb-safe py-6 relative">

        {/* Cancel / Clear */}
        <button
          className="ctrl-btn"
          onClick={handleCancel}
          title="रद्द करें"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Main MIC button */}
        <button
          className={`mic-btn-sm ${isListening ? 'listening' : ''}`}
          onClick={toggleMic}
        >
          <Mic className="w-5 h-5 text-black" strokeWidth={2.5} />
        </button>

        {/* Keyboard toggle */}
        <button
          className="ctrl-btn"
          onClick={() => setShowKeyboard(!showKeyboard)}
          title="टाइप करें"
        >
          <Keyboard className="w-4 h-4" />
        </button>
      </div>

      {/* ── FAB "+" Menu (bottom right) ── */}
      <FabMenu
        isOpen={fabOpen}
        onToggle={() => setFabOpen(!fabOpen)}
        onClearChat={() => { clearChat(); setFabOpen(false) }}
        onLogout={() => { logout(); setFabOpen(false) }}
        onToggleHistory={() => { setShowHistory(!showHistory); setFabOpen(false) }}
      />

      {/* ── Slide-in History Panel ── */}
      {showHistory && (
        <div className="absolute inset-0 bg-black/95 z-30 flex flex-col animate-scale-in">
          <div className="flex items-center justify-between px-5 pt-safe pb-4">
            <h2 className="jarvis-title text-lg text-white italic">बातचीत का इतिहास</h2>
            <button className="icon-btn" onClick={() => setShowHistory(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <ChatHistory messages={messages} />
        </div>
      )}
    </div>
  )
}
