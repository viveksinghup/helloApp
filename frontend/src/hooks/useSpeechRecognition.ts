/**
 * Speech Recognition hook — robust, mobile-first
 * Handles iOS webkitSpeechRecognition, Hindi + fallback lang
 */
import { useRef, useState, useCallback } from 'react'

type Callback = (text: string) => void

export function useSpeechRecognition(onResult: Callback) {
  const [isListening, setIsListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const recRef    = useRef<any>(null)
  const onResultRef = useRef<Callback>(onResult)
  onResultRef.current = onResult  // always current, no stale closure

  const start = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      alert('Voice not supported in this browser. Please type instead.')
      return
    }

    // Kill any existing instance
    if (recRef.current) {
      try { recRef.current.abort() } catch {}
      recRef.current = null
    }

    const rec = new SR()
    rec.continuous      = false
    rec.interimResults  = true
    rec.maxAlternatives = 1

    // Try hi-IN first; on error fall back to en-IN
    rec.lang = 'hi-IN'

    rec.onstart = () => setIsListening(true)
    rec.onend   = () => { setIsListening(false); setInterimText('') }

    rec.onerror = (e: any) => {
      setIsListening(false)
      setInterimText('')
      recRef.current = null

      // If Hindi not supported, retry with device default
      if (e.error === 'language-not-supported' || e.error === 'not-allowed') return

      // For no-speech / audio-capture — just silently end
      if (e.error === 'no-speech' || e.error === 'audio-capture') return

      // Network or other — try with en-IN
      try {
        const rec2 = new SR()
        rec2.lang = 'en-IN'
        rec2.continuous = false
        rec2.interimResults = true
        rec2.onstart  = () => setIsListening(true)
        rec2.onend    = () => { setIsListening(false); setInterimText('') }
        rec2.onerror  = () => { setIsListening(false); setInterimText('') }
        rec2.onresult = handleResult
        recRef.current = rec2
        rec2.start()
      } catch {}
    }

    function handleResult(e: any) {
      let interim = '', final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t
        else interim += t
      }
      if (interim) setInterimText(interim)
      if (final.trim()) {
        setInterimText('')
        onResultRef.current(final.trim())
      }
    }

    rec.onresult = handleResult
    recRef.current = rec

    try { rec.start() } catch (err) {
      console.warn('[STT] start error:', err)
      setIsListening(false)
    }
  }, [])

  const stop = useCallback(() => {
    try { recRef.current?.abort() } catch {}
    recRef.current = null
    setIsListening(false)
    setInterimText('')
  }, [])

  return { isListening, interimText, start, stop }
}
