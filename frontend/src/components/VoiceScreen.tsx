/**
 * VoiceScreen — main app UI
 * Clean architecture: no stale closures, simple JSON fetch (no SSE)
 */
import { useState, useRef, useEffect } from 'react'
import { History, X, Keyboard, Mic, Settings } from 'lucide-react'
import MindSphere from './MindSphere'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { useTTS } from '../hooks/useTTS'
import { useChatStore } from '../stores/chatStore'
import { useAuthStore } from '../stores/authStore'
import FabMenu from './FabMenu'
import ChatHistory from './ChatHistory'

type SphereState = 'idle' | 'listening' | 'thinking' | 'speaking'

const API = (import.meta.env.VITE_API_URL || '/api') + '/chat'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning, Sir!'
  if (h < 17) return 'Hello Sir!'
  if (h < 21) return 'Good Evening, Sir!'
  return 'Good Night, Sir!'
}

export default function VoiceScreen() {
  const { messages, addMessage, updateMessage, clearChat } = useChatStore()
  const { logout } = useAuthStore()
  const { speak, stop: stopTTS } = useTTS()

  const [sphere, setSphere]           = useState<SphereState>('idle')
  const [status, setStatus]           = useState('')
  const [interim, setInterim]         = useState('')
  const [showKeyboard, setShowKeyboard] = useState(false)
  const [typedText, setTypedText]     = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [fabOpen, setFabOpen]         = useState(false)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const busyRef    = useRef(false)   // prevent double-send
  const greetedRef = useRef(false)

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Initial greeting
  useEffect(() => {
    if (greetedRef.current || messages.length > 0) return
    greetedRef.current = true
    const msg = `${greeting()} Main Jarvis hoon. Mic dabao ya type karo — main ready hoon Sir.`
    setTimeout(() => {
      addMessage({ role: 'assistant', content: msg })
      setSphere('speaking')
      speak(msg, () => { setSphere('idle'); setStatus('') })
    }, 500)
  }, []) // eslint-disable-line

  // ── Core send — uses ref to avoid all stale closure issues ──────────────
  async function sendMessage(text: string) {
    const content = text.trim()
    if (!content || busyRef.current) return

    busyRef.current = true
    setShowKeyboard(false)
    setTypedText('')
    setInterim('')
    setSphere('thinking')
    setStatus('Soch raha hoon...')

    // Add user message
    addMessage({ role: 'user', content })

    // Add empty AI message placeholder
    const aiId = addMessage({ role: 'assistant', content: '', isStreaming: true })

    try {
      // Build history from live store
      const liveMessages = useChatStore.getState().messages
      const history = liveMessages
        .filter(m => m.content && !m.isStreaming)
        .slice(-16)
        .map(m => ({ role: m.role, content: m.content }))

      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 30000)

      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, history }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)

      let reply = ''
      if (res.ok) {
        const data = await res.json()
        reply = data.reply || ''
      }

      if (!reply) reply = 'Sir, kuch samajh nahi aaya. Dobara bolein please.'

      updateMessage(aiId, reply, false)
      setSphere('speaking')
      setStatus('Bol raha hoon...')

      speak(reply, () => {
        setSphere('idle')
        setStatus('')
        busyRef.current = false
      })

    } catch (err: any) {
      const msg = err?.name === 'AbortError'
        ? 'Sir, response aane mein waqt lag raha tha. Dobara try karein.'
        : 'Sir, network problem ho gayi. Check karein aur try karein.'
      updateMessage(aiId, msg, false)
      setSphere('speaking')
      speak(msg, () => {
        setSphere('idle')
        setStatus('')
        busyRef.current = false
      })
    }
  }

  // ── Speech recognition callbacks ─────────────────────────────────────────
  const { isListening, interimText, start: startMic, stop: stopMic } =
    useSpeechRecognition((finalText) => {
      setInterim('')
      setSphere('thinking')
      setStatus('Samajh raha hoon...')
      sendMessage(finalText)
    })

  useEffect(() => {
    if (isListening) {
      setSphere('listening')
      setStatus('Sun raha hoon...')
    }
    setInterim(interimText)
  }, [isListening, interimText])

  function toggleMic() {
    if (isListening) {
      stopMic()
      stopTTS()
      setSphere('idle')
      setStatus('')
      busyRef.current = false
    } else {
      if (busyRef.current) return  // don't start mic while processing
      stopTTS()
      startMic()
    }
  }

  function cancel() {
    stopMic()
    stopTTS()
    setSphere('idle')
    setStatus('')
    setInterim('')
    busyRef.current = false
  }

  const hasMessages = messages.length > 0
  const sphereSize = hasMessages ? 100 : 190

  return (
    <div className="flex flex-col h-full bg-black relative select-none">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-safe pb-2 z-10 flex-shrink-0">
        <button className="icon-btn" onClick={() => setShowHistory(true)}>
          <History className="w-3.5 h-3.5" />
        </button>
        <h1 className="jarvis-title text-lg text-white">Jarvis</h1>
        <button className="icon-btn" onClick={() => setFabOpen(!fabOpen)}>
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Sphere area */}
      <div className={`flex flex-col items-center flex-shrink-0 ${hasMessages ? 'pt-1 pb-1' : 'flex-1 justify-center pb-6'}`}>
        <MindSphere state={sphere} size={sphereSize} />

        {!hasMessages && (
          <div className="text-center mt-4 px-8">
            <p className="text-white text-lg italic" style={{ fontFamily: 'Playfair Display, serif' }}>
              {greeting()}
            </p>
            <p className="text-gray-600 text-xs mt-1.5">Mic dabao ya type karo</p>
          </div>
        )}

        {status ? (
          <p className="listening-text mt-1">{status}</p>
        ) : null}
        {interim ? (
          <p className="text-gray-500 text-xs mt-0.5 italic px-6 text-center max-w-xs truncate">
            "{interim}"
          </p>
        ) : null}
      </div>

      {/* Chat bubbles */}
      {hasMessages && (
        <div className="flex-1 chat-scroll px-3 pt-1 pb-1 space-y-1.5 min-h-0">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={msg.role === 'user' ? 'bubble-user' : 'bubble-ai'}>
                {msg.content
                  ? msg.content
                  : <span className="opacity-40 animate-pulse">···</span>
                }
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Keyboard input */}
      {showKeyboard && (
        <div className="px-3 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2 bg-gray-900 rounded-xl px-3 py-2 border border-gray-800 focus-within:border-purple-900">
            <input
              autoFocus
              type="text"
              value={typedText}
              onChange={e => setTypedText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && typedText.trim()) {
                  sendMessage(typedText)
                }
              }}
              placeholder="Type here..."
              className="flex-1 bg-transparent text-white text-xs placeholder-gray-600 outline-none"
            />
            <button
              onClick={() => sendMessage(typedText)}
              disabled={!typedText.trim() || busyRef.current}
              className="text-purple-400 text-xs font-medium disabled:text-gray-700"
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div className="flex items-center justify-center gap-8 pb-safe py-4 flex-shrink-0">
        <button className="ctrl-btn" onClick={cancel}>
          <X className="w-3.5 h-3.5" />
        </button>

        <button
          className={`mic-btn-sm ${isListening ? 'listening' : ''}`}
          onClick={toggleMic}
        >
          <Mic className="w-5 h-5 text-black" strokeWidth={2.5} />
        </button>

        <button
          className="ctrl-btn"
          onClick={() => setShowKeyboard(v => !v)}
        >
          <Keyboard className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* FAB menu */}
      <FabMenu
        isOpen={fabOpen}
        onToggle={() => setFabOpen(v => !v)}
        onClearChat={() => { clearChat(); setFabOpen(false) }}
        onLogout={() => { logout(); setFabOpen(false) }}
        onToggleHistory={() => { setShowHistory(true); setFabOpen(false) }}
      />

      {/* History panel */}
      {showHistory && (
        <div className="absolute inset-0 bg-black z-30 flex flex-col">
          <div className="flex items-center justify-between px-4 pt-safe pb-3 flex-shrink-0">
            <h2 className="jarvis-title text-base text-white italic">Chat History</h2>
            <button className="icon-btn" onClick={() => setShowHistory(false)}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <ChatHistory messages={messages} />
        </div>
      )}
    </div>
  )
}
