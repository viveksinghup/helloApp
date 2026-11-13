/**
 * TTS hook — natural, human-sounding speech
 * Fix: proper rate, clean punctuation pauses, correct lang for Hinglish
 */
import { useRef, useCallback, useEffect } from 'react'

export function useTTS() {
  const activeRef = useRef(false)
  const timerRef  = useRef<ReturnType<typeof setTimeout>>()
  const keepAliveRef = useRef<ReturnType<typeof setInterval>>()

  // Pre-warm on mount so iOS unlocks audio
  useEffect(() => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.getVoices()
    // Silent utterance to unlock iOS audio context
    const warm = new SpeechSynthesisUtterance('')
    warm.volume = 0
    try { window.speechSynthesis.speak(warm) } catch {}
  }, [])

  const speak = useCallback((text: string, onDone?: () => void) => {
    if (!window.speechSynthesis) { onDone?.(); return }

    // Clear any previous timers
    clearTimeout(timerRef.current)
    clearInterval(keepAliveRef.current)
    window.speechSynthesis.cancel()
    activeRef.current = true

    // ── Clean text for natural TTS ─────────────────────────────────────────
    let clean = text
      // Remove markdown
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/#{1,6}\s?/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')

      // Remove emojis (TTS reads them as "emoji" on some engines)
      .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')
      .replace(/[\u2600-\u27FF]/g, '')

      // Replace newlines with a brief pause word (not punctuation)
      .replace(/\n+/g, ' ')

      // KEY FIX: Remove mid-sentence periods that cause robotic pauses
      // Replace "word. word" (short pause) with "word, word" (shorter pause)
      // But keep end-of-sentence feel by just using comma
      .replace(/\.\s+/g, ', ')

      // Remove multiple commas/spaces
      .replace(/,\s*,/g, ',')
      .replace(/\s{2,}/g, ' ')

      // Trim trailing punctuation
      .replace(/[.,!?]+$/, '')
      .trim()

      // Limit length to avoid iOS TTS cut-off
      .slice(0, 400)

    if (!clean) { onDone?.(); return }

    const utter   = new SpeechSynthesisUtterance(clean)
    utter.volume  = 1.0
    utter.pitch   = 1.05   // slightly higher = sounds more natural/warm

    // ── Voice selection — KEY for natural sound ────────────────────────────
    const voices = window.speechSynthesis.getVoices()

    // Priority: Indian English > any English > default
    // Do NOT use hi-IN — it makes Hinglish sound robotic
    const inEn   = voices.find(v => v.lang === 'en-IN')
    const enGB   = voices.find(v => v.lang === 'en-GB')
    const enAU   = voices.find(v => v.lang === 'en-AU')  // smoother than US
    const enUS   = voices.find(v => v.lang.startsWith('en-US'))
    const anyEn  = voices.find(v => v.lang.startsWith('en'))

    const picked = inEn || enGB || enAU || enUS || anyEn

    if (picked) {
      utter.voice = picked
      utter.lang  = picked.lang
      // Adjust rate per voice type — Indian English needs slightly slower
      utter.rate  = picked.lang === 'en-IN' ? 1.08 : 1.12
    } else {
      utter.lang = 'en-IN'
      utter.rate = 1.08
    }

    const done = () => {
      clearTimeout(timerRef.current)
      clearInterval(keepAliveRef.current)
      activeRef.current = false
      onDone?.()
    }

    utter.onend   = done
    utter.onerror = done

    // iOS keep-alive: speechSynthesis pauses after ~15s without this
    keepAliveRef.current = setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        clearInterval(keepAliveRef.current)
        return
      }
      window.speechSynthesis.pause()
      window.speechSynthesis.resume()
    }, 10000)

    // Safety fallback if onend never fires (iOS bug)
    const words     = clean.split(' ').length
    const safetyMs  = Math.max(4000, (words / utter.rate) * 400 + 2000)
    timerRef.current = setTimeout(() => {
      if (activeRef.current) {
        window.speechSynthesis.cancel()
        done()
      }
    }, safetyMs)

    window.speechSynthesis.speak(utter)
  }, [])

  const stop = useCallback(() => {
    clearTimeout(timerRef.current)
    clearInterval(keepAliveRef.current)
    activeRef.current = false
    window.speechSynthesis?.cancel()
  }, [])

  return { speak, stop }
}
