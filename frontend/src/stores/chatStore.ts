import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Role = 'user' | 'assistant' | 'system'

export interface Message {
  id: string
  role: Role
  content: string
  timestamp: number
  isStreaming?: boolean
}

interface ChatState {
  messages: Message[]
  isLoading: boolean
  addMessage: (msg: Omit<Message, 'id' | 'timestamp'>) => string
  updateMessage: (id: string, content: string, isStreaming?: boolean) => void
  clearChat: () => void
  setLoading: (v: boolean) => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      isLoading: false,

      addMessage: (msg) => {
        const id = crypto.randomUUID()
        set((state) => ({
          messages: [...state.messages, { ...msg, id, timestamp: Date.now() }],
        }))
        return id
      },

      updateMessage: (id, content, isStreaming = false) =>
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, content, isStreaming } : m
          ),
        })),

      clearChat: () => set({ messages: [] }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'jarvis-chat',
      partialize: (state) => ({
        messages: state.messages.slice(-60),
      }),
    }
  )
)
