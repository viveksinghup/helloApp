import type { Message } from '../stores/chatStore'

interface Props { messages: Message[] }

export default function ChatHistory({ messages }: Props) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-600 text-sm italic">अभी तक कोई बातचीत नहीं</p>
      </div>
    )
  }

  return (
    <div className="flex-1 chat-scroll px-4 pb-6 space-y-4">
      {messages.map(msg => (
        <div
          key={msg.id}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div className={msg.role === 'user' ? 'bubble-user' : 'bubble-ai'}>
            <p className="text-xs opacity-40 mb-1">
              {msg.role === 'user' ? 'आप' : 'Jarvis'} •{' '}
              {new Date(msg.timestamp).toLocaleTimeString('hi-IN', {
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
            {msg.content}
          </div>
        </div>
      ))}
    </div>
  )
}
