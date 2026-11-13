/**
 * useWhisperSTT — Cloudflare Workers AI Whisper (free STT)
 *
 * Records audio via MediaRecorder (works on iOS Safari + Android Chrome)
 * → sends audio blob to Worker → Whisper transcribes → returns text
 *
 * UX: tap mic to START recording → tap again to STOP & transcribe
 * Auto-stops after 30s to prevent runaway recording
 */
import { useRef, useState, useCallback } from 'react'

type Callback = (text: string) => void

const API_BASE = (import.meta.env.VITE_API_URL || '/api')

// Pick best supported audio format
function bestMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',   // Chrome/Android — smallest, best
    'audio/webm',               // Chrome fallback
    'audio/mp4',                // Safari iOS
    'audio/ogg;codecs=opus',    // Firefox
    '',                         // browser default
  ]
  for (const t of types) {
    if (!t || MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

export function useWhisperSTT(onResult: Callback) {
  const [isListening,  setIsListening]  = useState(false)
  const [interimText,  setInterimText]  = useState('')   // kept for API compat
  const [isProcessing, setIsProcessing] = useState(false)

  const mediaRef    = useRef<MediaRecorder | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const autoStopRef = useRef<ReturnType<typeof setTimeout>>()
  const onResultRef = useRef<Callback>(onResult)
  onResultRef.current = onResult  // always current

  const start = useCallback(async () => {
    if (isListening || isProcessing) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,       // Whisper optimal sample rate
        },
      })

      chunksRef.current = []
      const mimeType = bestMimeType()
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

      rec.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data)
      }

      rec.onstop = async () => {
        // Stop all mic tracks immediately
        stream.getTracks().forEach(t => t.stop())
        clearTimeout(autoStopRef.current)
        setIsListening(false)

        const chunks = chunksRef.current
        chunksRef.current = []

        if (chunks.length === 0) return

        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
        if (blob.size < 1000) return  // too small — probably silence

        setIsProcessing(true)
        setInterimText('Transcribing...')

        try {
          const form = new FormData()
          form.append('audio', blob, 'audio.webm')

          const ctrl  = new AbortController()
          const timer = setTimeout(() => ctrl.abort(), 20000)

          const res = await fetch(`${API_BASE}/transcribe`, {
            method: 'POST',
            body: form,
            signal: ctrl.signal,
          })
          clearTimeout(timer)

          if (res.ok) {
            const data = await res.json() as { text?: string }
            const text = (data.text || '').trim()
            if (text) onResultRef.current(text)
          }
        } catch (err: any) {
          if (err?.name !== 'AbortError') console.error('[Whisper] fetch error:', err)
        } finally {
          setIsProcessing(false)
          setInterimText('')
        }
      }

      rec.start(500)   // collect audio in 500ms chunks
      mediaRef.current = rec
      setIsListening(true)

      // Auto-stop safety: 30 seconds max recording
      autoStopRef.current = setTimeout(() => {
        if (mediaRef.current?.state === 'recording') mediaRef.current.stop()
      }, 30000)

    } catch (err: any) {
      console.error('[STT] mic access error:', err)
      setIsListening(false)
      // If permission denied, alert user
      if (err?.name === 'NotAllowedError') {
        alert('Mic permission needed. Please allow microphone access in your browser settings.')
      }
    }
  }, [isListening, isProcessing])

  const stop = useCallback(() => {
    clearTimeout(autoStopRef.current)
    if (mediaRef.current?.state === 'recording') {
      mediaRef.current.stop()   // triggers onstop → Whisper
    } else {
      setIsListening(false)
    }
  }, [])

  return { isListening, isProcessing, interimText, start, stop }
}

