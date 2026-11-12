import { useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { Sparkles } from 'lucide-react'

export default function LockScreen() {
  const { login } = useAuthStore()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  const handleKey = (key: string) => {
    if (key === 'del') {
      setPin((p) => p.slice(0, -1))
      setError(false)
      return
    }
    if (pin.length >= 4) return
    const next = pin + key
    setPin(next)

    if (next.length === 4) {
      setTimeout(() => {
        const ok = login(next)
        if (!ok) {
          setShake(true)
          setError(true)
          setPin('')
          setTimeout(() => setShake(false), 600)
        }
      }, 150)
    }
  }

  const keys = ['1','2','3','4','5','6','7','8','9','','0','del']

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 safe-top safe-bottom gap-10">

      {/* Logo / Identity */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-20 h-20 bg-accent/10 border border-accent/30 rounded-3xl flex items-center justify-center">
          <Sparkles className="w-10 h-10 text-accent" />
        </div>
        <h1 className="text-2xl font-semibold text-white">Jarvis</h1>
        <p className="text-sm text-slate-400">Your Private AI Assistant</p>
      </div>

      {/* PIN Dots */}
      <div className={`flex gap-4 ${shake ? 'animate-[wiggle_0.5s_ease-in-out]' : ''}`}
        style={shake ? { animation: 'shake 0.5s ease-in-out' } : {}}>
        {[0,1,2,3].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
              pin.length > i
                ? error
                  ? 'bg-red-400 border-red-400'
                  : 'bg-accent border-accent'
                : 'border-slate-600 bg-transparent'
            }`}
          />
        ))}
      </div>
      {error && (
        <p className="text-red-400 text-sm -mt-6 animate-fade-up">Wrong PIN. Try again.</p>
      )}

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
        {keys.map((k, i) => (
          k === '' ? (
            <div key={i} />
          ) : (
            <button
              key={i}
              onClick={() => handleKey(k)}
              className={`
                h-16 rounded-2xl text-xl font-medium transition-all duration-150 active:scale-90
                ${k === 'del'
                  ? 'text-slate-400 bg-transparent hover:bg-surface-hover text-base'
                  : 'bg-surface-card hover:bg-surface-hover text-white border border-surface-border'}
              `}
            >
              {k === 'del' ? '⌫' : k}
            </button>
          )
        ))}
      </div>

      <p className="text-xs text-slate-600 mt-auto pb-4">Only you have access to this app.</p>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  )
}

