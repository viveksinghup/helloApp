import { useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import MindSphere from './MindSphere'

export default function LockScreen() {
  const { login } = useAuthStore()
  const [pin, setPin]     = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  const handleKey = (key: string) => {
    if (key === 'del') { setPin(p => p.slice(0, -1)); setError(false); return }
    if (pin.length >= 4) return
    const next = pin + key
    setPin(next)
    if (next.length === 4) {
      setTimeout(() => {
        const ok = login(next)
        if (!ok) {
          setShake(true); setError(true); setPin('')
          setTimeout(() => setShake(false), 600)
        }
      }, 150)
    }
  }

  const keys = ['1','2','3','4','5','6','7','8','9','','0','del']

  return (
    <div className="flex flex-col items-center justify-between h-full bg-black px-6 pt-safe pb-safe">

      {/* Top — sphere + title */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <MindSphere state="idle" size={160} />
        <div className="text-center mt-2">
          <h1 className="jarvis-title text-2xl text-white">Jarvis</h1>
          <p className="text-gray-600 text-xs mt-1 tracking-widest uppercase">Personal AI</p>
        </div>
      </div>

      {/* PIN UI */}
      <div className="w-full max-w-xs pb-8 flex flex-col items-center gap-6">

        {/* Dots */}
        <div
          className="flex gap-5"
          style={shake ? { animation: 'shake 0.5s ease-in-out' } : {}}
        >
          {[0,1,2,3].map(i => (
            <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
              pin.length > i
                ? error ? 'bg-red-500 border-red-500' : 'bg-purple-400 border-purple-400'
                : 'border-gray-700 bg-transparent'
            }`} />
          ))}
        </div>

        {error && <p className="text-red-400 text-xs -mt-3 animate-fade-up">गलत PIN। फिर से कोशिश करें।</p>}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {keys.map((k, i) => (
            k === '' ? <div key={i} /> : (
              <button
                key={i}
                onClick={() => handleKey(k)}
                className={`h-14 rounded-2xl text-lg font-medium transition-all duration-150 active:scale-90
                  ${k === 'del'
                    ? 'text-gray-500 bg-transparent text-base'
                    : 'bg-gray-900 hover:bg-gray-800 text-white border border-gray-800'}`}
              >
                {k === 'del' ? '⌫' : k}
              </button>
            )
          ))}
        </div>

        <p className="text-xs text-gray-800 tracking-wide">केवल आपके लिए</p>
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-8px); }
          40%      { transform: translateX(8px); }
          60%      { transform: translateX(-6px); }
          80%      { transform: translateX(6px); }
        }
      `}</style>
    </div>
  )
}
