import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  isAuthenticated: boolean
  login: (pin: string) => boolean
  logout: () => void
}

// Your personal PIN — change this before deploying!
// In production, this is validated on the Worker server side.
const UNLOCK_PIN = '1234'

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      login: (pin: string) => {
        if (pin === UNLOCK_PIN) {
          set({ isAuthenticated: true })
          return true
        }
        return false
      },
      logout: () => set({ isAuthenticated: false }),
    }),
    {
      name: 'jarvis-auth',
      // Session only — clears when browser closes
      partialize: () => ({ isAuthenticated: false }),
    }
  )
)

