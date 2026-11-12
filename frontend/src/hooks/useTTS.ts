import { useCallback, useRef } from 'react'

export function useTTS() {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const speak = useCallback((text: string, onDone?: () => void) => {
    if (!window.speechSynthesis) return

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    // Strip markdown for clean speech
    const clean = text
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/\n+/g, ' ')
      .trim()
      .slice(0, 800)  // limit length

    const utter = new SpeechSynthesisUtterance(clean)
    utter.lang  = 'hi-IN'    // Hindi voice
    utter.rate  = 0.95
    utter.pitch = 1.0
    utter.volume = 1.0

    // Try to pick a Hindi voice if available
    const voices = window.speechSynthesis.getVoices()
    const hindiVoice = voices.find(v =>
      v.lang.startsWith('hi') || v.name.toLowerCase().includes('hindi')
    )
    if (hindiVoice) utter.voice = hindiVoice

    utter.onend   = () => onDone?.()
    utter.onerror = () => onDone?.()

    utteranceRef.current = utter
    window.speechSynthesis.speak(utter)
  }, [])

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel()
  }, [])

  return { speak, stop }
}

