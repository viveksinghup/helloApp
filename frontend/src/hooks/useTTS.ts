/**
 * TTS hook — works on iOS Safari, Android Chrome, desktop
 * iOS requires: speak() called in or close to a user gesture
 * Fix: pre-warm speechSynthesis on mount, use short utterances
 */
import { useRef, useCallback, useEffect } from 'react'

export function useTTS() {
  const activeRef = useRef(false)

  // Pre-warm on mount (iOS Safari needs this to unlock audio)
  useEffect(() => {
    if (!window.speechSynthesis) return
    // Load voices
    window.speechSynthesis.getVoices()
    // Fire a silent utterance so iOS unlocks TTS (must be on page load)
    const warm = new SpeechSynthesisUtterance(' ')
    warm.volume = 0
    window.speechSynthesis.speak(warm)
  }, [])

  const speak = useCallback((text: string, onDone?: () => void) => {
    if (!window.speechSynthesis) { onDone?.(); return }

    // Cancel anything playing
    window.speechSynthesis.cancel()
    activeRef.current = true

    // Clean text
    const clean = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/#{1,6}\s?/g, '')
      .replace(/\n+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500)   // keep it short — long TTS hangs on iOS

    if (!clean) { onDone?.(); return }

    const utter = new SpeechSynthesisUtterance(clean)
    utter.rate   = 1.0
    utter.pitch  = 1.0
    utter.volume = 1.0

    // Pick best voice: prefer Hindi, then Indian English, then any English
    const voices = window.speechSynthesis.getVoices()
    const hindi  = voices.find(v => v.lang.startsWith('hi'))
    const inEn   = voices.find(v => v.lang === 'en-IN')
    const enUs   = voices.find(v => v.lang.startsWith('en'))
    const picked = hindi || inEn || enUs
    if (picked) { utter.voice = picked; utter.lang = picked.lang }
    else { utter.lang = 'en-IN' }

    utter.onend = () => { activeRef.current = false; onDone?.() }
    utter.onerror = () => { activeRef.current = false; onDone?.() }

    // iOS Chrome bug: speechSynthesis pauses after ~15s — keep it alive
    const keepAlive = setInterval(() => {
      if (!window.speechSynthesis.speaking) { clearInterval(keepAlive); return }
      window.speechSynthesis.pause()
      window.speechSynthesis.resume()
    }, 10000)

    window.speechSynthesis.speak(utter)

    // Safety fallback: if onend never fires (iOS bug), call after estimated duration
    const wordCount = clean.split(' ').length
    const estimatedMs = Math.max(3000, wordCount * 350)
    const safetyTimer = setTimeout(() => {
      if (activeRef.current) {
        clearInterval(keepAlive)
        activeRef.current = false
        window.speechSynthesis.cancel()
        onDone?.()
      }
    }, estimatedMs + 2000)

    // Clear safety timer when utterance ends normally
    const origOnend = utter.onend
    utter.onend = (e) => {
      clearTimeout(safetyTimer)
      clearInterval(keepAlive)
      ;(origOnend as any)?.(e)
    }
    const origOnerror = utter.onerror
    utter.onerror = (e) => {
      clearTimeout(safetyTimer)
      clearInterval(keepAlive)
      ;(origOnerror as any)?.(e)
    }
  }, [])

  const stop = useCallback(() => {
    activeRef.current = false
    window.speechSynthesis?.cancel()
  }, [])

  return { speak, stop }
}
