/**
 * useKokoroTTS — 100% free, local, human-sounding TTS
 *
 * Uses Kokoro-82M (Apache 2.0) running entirely in the browser
 * via ONNX Runtime + WebGPU (or WASM fallback on iOS).
 *
 * First load: downloads ~86MB model from HuggingFace CDN (cached forever after)
 * Subsequent: instant from browser cache
 */
import { useEffect, useRef, useCallback, useState } from 'react'

type KokoroState = 'loading' | 'ready' | 'speaking' | 'error'

// Voice options:  bm_george (British male — Jarvis-like), af_heart (warm female)
const VOICE = 'bm_george'

export function useKokoroTTS() {
  const ttsRef      = useRef<any>(null)
  const sourceRef   = useRef<AudioBufferSourceNode | null>(null)
  const ctxRef      = useRef<AudioContext | null>(null)
  const [state, setState]       = useState<KokoroState>('loading')
  const [loadPct, setLoadPct]   = useState(0)

  // Load model once on mount — cached in browser IndexedDB after first time
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        // Dynamic import so it doesn't block the initial page render
        const { KokoroTTS } = await import('kokoro-js')

        const tts = await KokoroTTS.from_pretrained(
          'onnx-community/Kokoro-82M-v1.0-ONNX',
          {
            dtype: 'q8',           // quantized — 86MB, great quality/speed balance
            device: 'webgpu',      // auto-falls back to wasm on Safari/iOS
            progress_callback: (p: any) => {
              // p.progress is 0–1 fraction during model download
              if (p?.progress != null) setLoadPct(Math.round(p.progress * 100))
            },
          }
        )

        if (cancelled) return
        ttsRef.current = tts
        setState('ready')
        setLoadPct(100)
      } catch (err) {
        console.error('[Kokoro] load failed — will fall back to browser TTS:', err)
        if (!cancelled) setState('error')
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const speak = useCallback(async (rawText: string, onDone?: () => void) => {
    // ── Clean text same as before ─────────────────────────────────────────
    const clean = rawText
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/#{1,6}\s?/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')
      .replace(/[\u2600-\u27FF]/g, '')
      .replace(/\n+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 450)   // Kokoro works best under 500 chars

    if (!clean) { onDone?.(); return }

    // ── If Kokoro loaded → use it ─────────────────────────────────────────
    if (ttsRef.current) {
      try {
        setState('speaking')

        // Stop any currently playing audio
        sourceRef.current?.stop()
        ctxRef.current?.close()

        const result = await ttsRef.current.generate(clean, { voice: VOICE })
        // result = { audio: Float32Array, sampling_rate: 24000 }

        const audioCtx = new AudioContext({ sampleRate: result.sampling_rate ?? 24000 })
        ctxRef.current = audioCtx

        const buffer = audioCtx.createBuffer(1, result.audio.length, result.sampling_rate ?? 24000)
        buffer.copyToChannel(result.audio, 0)

        const source = audioCtx.createBufferSource()
        source.buffer = buffer
        source.connect(audioCtx.destination)
        sourceRef.current = source

        source.onended = () => {
          setState('ready')
          onDone?.()
        }

        source.start(0)
        return
      } catch (err) {
        console.error('[Kokoro] generate error — falling back to browser TTS:', err)
        setState('ready')
        // fall through to browser TTS fallback below
      }
    }

    // ── Fallback: browser speechSynthesis if Kokoro fails ────────────────
    if (!window.speechSynthesis) { onDone?.(); return }
    window.speechSynthesis.cancel()

    const utter = new SpeechSynthesisUtterance(clean)
    utter.volume = 1.0
    utter.rate   = 1.08
    utter.pitch  = 1.05

    const voices  = window.speechSynthesis.getVoices()
    const picked  = voices.find(v => v.lang === 'en-IN')
                 || voices.find(v => v.lang === 'en-GB')
                 || voices.find(v => v.lang.startsWith('en'))
    if (picked) { utter.voice = picked; utter.lang = picked.lang }
    else utter.lang = 'en-IN'

    utter.onend   = () => { onDone?.() }
    utter.onerror = () => { onDone?.() }
    window.speechSynthesis.speak(utter)
  }, [])

  const stop = useCallback(() => {
    sourceRef.current?.stop()
    ctxRef.current?.close()
    window.speechSynthesis?.cancel()
    setState(ttsRef.current ? 'ready' : state === 'loading' ? 'loading' : 'error')
  }, [state])

  return { speak, stop, state, loadPct }
}

