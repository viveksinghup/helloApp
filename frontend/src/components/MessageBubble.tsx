import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Message } from '../stores/chatStore'
import { Sparkles } from 'lucide-react'

interface Props {
  message: Message
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex items-start gap-3 animate-fade-up ${isUser ? 'flex-row-reverse' : ''}`}>

      {/* Avatar */}
      {!isUser && (
        <div className="w-8 h-8 bg-accent/15 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="w-4 h-4 text-accent" />
        </div>
      )}

      {/* Bubble */}
      <div
        className={`
          max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${isUser
            ? 'bg-accent text-white rounded-tr-sm ml-auto'
            : 'bg-surface-card text-slate-200 border border-surface-border rounded-tl-sm'
          }
          ${message.isStreaming ? 'animate-pulse' : ''}
        `}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none
            prose-p:my-1 prose-ul:my-1 prose-li:my-0.5
            prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5
            prose-code:rounded prose-code:text-accent-light prose-code:text-xs
            prose-pre:bg-slate-800 prose-pre:border prose-pre:border-slate-700
            prose-headings:text-white prose-strong:text-white
          ">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Timestamp */}
        <p className={`text-[10px] mt-1.5 ${isUser ? 'text-indigo-200/70' : 'text-slate-600'}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

