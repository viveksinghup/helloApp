import { useRef, useEffect } from 'react'
import { useChatStore } from '../stores/chatStore'
import { useAuthStore } from '../stores/authStore'
import ChatInput from './ChatInput'
import MessageBubble from './MessageBubble'
import ModeBar from './ModeBar'
import { Sparkles, LogOut, Trash2 } from 'lucide-react'

export default function ChatScreen() {
  const { messages, clearChat, isLoading, mode } = useChatStore()
  const { logout } = useAuthStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const modeLabels: Record<string, string> = {
    chat: 'General Chat',
    research: 'Deep Research',
    tasks: 'Task Manager',
    notes: 'Smart Notes',
  }

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border safe-top bg-surface/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-accent/15 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white leading-tight">Jarvis</h1>
            <p className="text-xs text-slate-500 leading-tight">{modeLabels[mode]}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => { if (confirm('Clear all chat?')) clearChat() }}
              className="btn-icon text-slate-500 hover:text-red-400"
              title="Clear chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={logout}
            className="btn-icon text-slate-500 hover:text-white"
            title="Lock screen"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mode selector bar */}
      <ModeBar />

      {/* Messages */}
      <div className="flex-1 chat-scroll px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
            <div className="w-16 h-16 bg-accent/10 rounded-3xl flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-accent/60" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Hey Vivek! 👋</h2>
              <p className="text-slate-500 text-sm">
                Your private AI assistant is ready.<br/>
                Ask me anything — I'm here to help.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full mt-2">
              {QUICK_PROMPTS.map((qp) => (
                <QuickPrompt key={qp.label} {...qp} />
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Typing Indicator */}
        {isLoading && (
          <div className="flex items-start gap-3 animate-fade-up">
            <div className="w-8 h-8 bg-accent/15 rounded-xl flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-accent" />
            </div>
            <div className="card px-4 py-3 flex items-center gap-1.5">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput />
    </div>
  )
}

// Quick action prompts on empty state
const QUICK_PROMPTS = [
  { label: '📋 My tasks today', prompt: "What tasks or reminders should I focus on today?" },
  { label: '🔍 Research a topic', prompt: "Research and summarize the latest about: " },
  { label: '💡 Explain something', prompt: "Explain in simple terms: " },
  { label: '✍️ Write for me', prompt: "Help me write: " },
]

function QuickPrompt({ label, prompt }: { label: string; prompt: string }) {
  const { addMessage, setLoading } = useChatStore()

  const handleClick = async () => {
    if (prompt.endsWith(': ')) return // skip fill-in prompts
    addMessage({ role: 'user', content: prompt })
    setLoading(true)
    // Trigger the actual send via store subscription
  }

  return (
    <button
      onClick={handleClick}
      className="card px-3 py-2.5 text-left text-xs text-slate-400 hover:text-white hover:border-accent/50 transition-all duration-200 active:scale-95"
    >
      {label}
    </button>
  )
}

