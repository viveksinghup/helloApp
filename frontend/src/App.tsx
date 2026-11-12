import LockScreen from './components/LockScreen'
import VoiceScreen from './components/VoiceScreen'
import { useAuthStore } from './stores/authStore'

export default function App() {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <VoiceScreen /> : <LockScreen />
}
