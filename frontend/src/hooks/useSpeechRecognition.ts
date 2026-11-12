import { useRef, useState, useCallback } from 'react'

export function useSpeechRecognition(onResult: (text: string) => void) {
  const [isListening, setIsListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const recRef = useRef<SpeechRecognition | null>(null)

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      alert('आपके browser में voice support नहीं है। Chrome use करें।')
      return
    }
    if (recRef.current) {
      try { recRef.current.stop() } catch {}
    }

    const rec = new SR()
    rec.lang = 'hi-IN'           // Hindi — primary language
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onstart  = () => { setIsListening(true); setInterimText('') }
    rec.onend    = () => { setIsListening(false); setInterimText('') }
    rec.onerror  = () => { setIsListening(false); setInterimText('') }

    rec.onresult = (e) => {
      let interim = ''
      let final   = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          final += e.results[i][0].transcript
        } else {
          interim += e.results[i][0].transcript
        }
      }
      if (interim) setInterimText(interim)
      if (final)   onResult(final.trim())
    }

    recRef.current = rec
    rec.start()
  }, [onResult])

  const stop = useCallback(() => {
    try { recRef.current?.stop() } catch {}
    setIsListening(false)
    setInterimText('')
  }, [])

  return { isListening, interimText, start, stop }
}

