import { useRef, useState, useCallback } from 'react'

export function useSpeechRecognition(onResult: (text: string) => void) {
  const [isListening, setIsListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const recRef = useRef<SpeechRecognition | null>(null)

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      alert('Voice not supported. Please type your message using the keyboard button.')
      return
    }
    if (recRef.current) {
      try { recRef.current.abort() } catch {}
    }

    const rec = new SR()
    // Use hi-IN for Hinglish — falls back gracefully on most phones
    rec.lang = 'hi-IN'
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onstart = () => { setIsListening(true); setInterimText('') }
    rec.onend   = () => { setIsListening(false); setInterimText('') }

    rec.onerror = (e: any) => {
      setIsListening(false)
      setInterimText('')
      console.warn('[STT] error:', e.error)
      // If Hindi lang fails, try again with device default language
      if (e.error === 'language-not-supported' || e.error === 'no-speech') {
        const rec2 = new SR()
        rec2.lang = navigator.language || 'en-IN'
        rec2.continuous = false
        rec2.interimResults = true
        rec2.onstart  = () => { setIsListening(true); setInterimText('') }
        rec2.onend    = () => { setIsListening(false); setInterimText('') }
        rec2.onerror  = () => { setIsListening(false); setInterimText('') }
        rec2.onresult = (ev: any) => {
          let final = ''
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            if (ev.results[i].isFinal) final += ev.results[i][0].transcript
          }
          if (final) onResult(final.trim())
        }
        recRef.current = rec2
        try { rec2.start() } catch {}
      }
    }

    rec.onresult = (e: any) => {
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
    try { rec.start() } catch (err) {
      console.error('[STT] start failed:', err)
      setIsListening(false)
    }
  }, [onResult])

  const stop = useCallback(() => {
    try { recRef.current?.abort() } catch {}
    setIsListening(false)
    setInterimText('')
  }, [])

  return { isListening, interimText, start, stop }
}
