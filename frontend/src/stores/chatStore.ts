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

export type AgentMode = 'chat' | 'research' | 'tasks' | 'notes'

interface ChatState {
  messages: Message[]
  mode: AgentMode
  isLoading: boolean
  addMessage: (msg: Omit<Message, 'id' | 'timestamp'>) => string
  updateMessage: (id: string, content: string, isStreaming?: boolean) => void
  clearChat: () => void
  setMode: (mode: AgentMode) => void
  setLoading: (v: boolean) => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      mode: 'chat',
      isLoading: false,

      addMessage: (msg) => {
        const id = crypto.randomUUID()
        set((state) => ({
          messages: [
            ...state.messages,
            { ...msg, id, timestamp: Date.now() },
          ],
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
      setMode: (mode) => set({ mode }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'jarvis-chat',
      // Keep last 50 messages only
      partialize: (state) => ({
        messages: state.messages.slice(-50),
        mode: state.mode,
      }),
    }
  )
)

