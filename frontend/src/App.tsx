import { useState } from 'react'
import LockScreen from './components/LockScreen'
import ChatScreen from './components/ChatScreen'
import { useAuthStore } from './stores/authStore'

export default function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      {!isAuthenticated ? <LockScreen /> : <ChatScreen />}
    </div>
  )
}

