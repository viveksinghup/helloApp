import { useEffect, useRef } from 'react'

type SphereState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface Props {
  state: SphereState
  size?: number
}

const NUM_PARTICLES = 700

export default function MindSphere({ state, size = 220 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef  = useRef<number>(0)
  const timeRef   = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    // HiDPI support
    const dpr = window.devicePixelRatio || 1
    canvas.width  = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const R    = size * 0.42       // sphere radius
    const cx   = size / 2
    const cy   = size / 2

    // ── Generate particles on sphere surface (Fibonacci sphere) ───────────
    type Particle = { ox: number; oy: number; oz: number; x: number; y: number; z: number }
    const particles: Particle[] = []
    const goldenAngle = Math.PI * (1 + Math.sqrt(5))
    for (let i = 0; i < NUM_PARTICLES; i++) {
      const t     = Math.acos(1 - (2 * (i + 0.5)) / NUM_PARTICLES)
      const p     = goldenAngle * i
      const ox    = Math.sin(t) * Math.cos(p)
      const oy    = Math.sin(t) * Math.sin(p)
      const oz    = Math.cos(t)
      particles.push({ ox, oy, oz, x: ox, y: oy, z: oz })
    }

    // ── 3D rotation helpers ───────────────────────────────────────────────
    function rotateY(p: Particle, a: number) {
      const cos = Math.cos(a), sin = Math.sin(a)
      const x = p.x * cos + p.z * sin
      const z = -p.x * sin + p.z * cos
      p.x = x; p.z = z
    }
    function rotateX(p: Particle, a: number) {
      const cos = Math.cos(a), sin = Math.sin(a)
      const y = p.y * cos - p.z * sin
      const z = p.y * sin + p.z * cos
      p.y = y; p.z = z
    }

    // ── Draw frame ────────────────────────────────────────────────────────
    function draw(t: number) {
      ctx.clearRect(0, 0, size, size)

      const isListening = state === 'listening'
      const isThinking  = state === 'thinking'
      const isSpeaking  = state === 'speaking'

      // Rotation speed per state
      const rotSpeed = isListening ? 0.008 : isThinking ? 0.012 : isSpeaking ? 0.006 : 0.003

      // Reset to original positions + apply noise per state
      for (const p of particles) {
        let r = R

        if (isListening) {
          // Pulsate outward with noise
          const noise = Math.sin(t * 3 + p.ox * 8 + p.oy * 6) * 0.08
          r = R * (1 + noise + Math.sin(t * 2.5) * 0.06)
        } else if (isThinking) {
          // Swirl + compress
          const noise = Math.sin(t * 5 + p.oz * 10) * 0.05
          r = R * (0.9 + noise)
        } else if (isSpeaking) {
          // Wave pulse
          const wave = Math.sin(t * 4 + p.oy * 12) * 0.07
          r = R * (1 + wave)
        } else {
          // Idle — gentle breathing
          r = R * (1 + Math.sin(t * 1.2) * 0.025)
        }

        p.x = p.ox * r
        p.y = p.oy * r
        p.z = p.oz * r
      }

      // Apply rotation
      for (const p of particles) {
        rotateY(p, rotSpeed)
        if (isListening || isThinking)  rotateX(p, rotSpeed * 0.4)
      }

      // Sort by z (back to front)
      const sorted = [...particles].sort((a, b) => a.z - b.z)

      // Draw particles
      for (const p of sorted) {
        // Project to 2D
        const perspective = (size * 1.2) / (size * 1.2 - p.z * 0.6)
        const px = cx + p.x * perspective
        const py = cy + p.y * perspective * 0.95

        // Depth-based opacity and size
        const depth = (p.z / R + 1) / 2    // 0 (back) → 1 (front)
        const alpha = isListening
          ? 0.25 + depth * 0.75
          : 0.1  + depth * 0.65
        const dotSize = isListening
          ? (0.5 + depth * 1.2) * perspective
          : (0.3 + depth * 0.9) * perspective

        // Color — white/cream particles, slight lavender tint on front ones
        const lv = isListening ? Math.floor(depth * 30) : 0
        ctx.fillStyle = `rgba(${220 + lv}, ${218 + lv}, ${255}, ${Math.min(alpha, 1)})`
        ctx.beginPath()
        ctx.arc(px, py, Math.max(dotSize, 0.4), 0, Math.PI * 2)
        ctx.fill()
      }

      // Listening ring pulse
      if (isListening) {
        const ringR = R * (1.08 + Math.sin(t * 3) * 0.04)
        ctx.strokeStyle = `rgba(176,170,255,${0.08 + Math.sin(t * 3) * 0.06})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2)
        ctx.stroke()
      }

      timeRef.current = t
      frameRef.current = requestAnimationFrame((ts) => draw(ts * 0.001))
    }

    frameRef.current = requestAnimationFrame((ts) => draw(ts * 0.001))
    return () => cancelAnimationFrame(frameRef.current)
  }, [state, size])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="select-none"
    />
  )
}

