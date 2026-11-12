import { useChatStore, type AgentMode } from '../stores/chatStore'
import { MessageCircle, Search, CheckSquare, FileText } from 'lucide-react'

const MODES: { key: AgentMode; label: string; icon: React.ReactNode }[] = [
  { key: 'chat',     label: 'Chat',     icon: <MessageCircle className="w-3.5 h-3.5" /> },
  { key: 'research', label: 'Research', icon: <Search className="w-3.5 h-3.5" /> },
  { key: 'tasks',    label: 'Tasks',    icon: <CheckSquare className="w-3.5 h-3.5" /> },
  { key: 'notes',    label: 'Notes',    icon: <FileText className="w-3.5 h-3.5" /> },
]

export default function ModeBar() {
  const { mode, setMode } = useChatStore()

  return (
    <div className="flex gap-1.5 px-4 py-2 border-b border-surface-border overflow-x-auto no-scrollbar">
      {MODES.map(({ key, label, icon }) => (
        <button
          key={key}
          onClick={() => setMode(key)}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium
            whitespace-nowrap transition-all duration-200 shrink-0
            ${mode === key
              ? 'bg-accent/20 text-accent border border-accent/40'
              : 'text-slate-500 hover:text-slate-300 hover:bg-surface-hover border border-transparent'
            }
          `}
        >
          {icon}
          {label}
        </button>
      ))}
    </div>
  )
}

