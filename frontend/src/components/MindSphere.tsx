import { useEffect, useRef } from 'react'

type SphereState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface Props {
  state: SphereState
  size?: number
}

const NUM_PARTICLES = 750

export default function MindSphere({ state, size = 220 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef  = useRef<number>(0)
  const stateRef  = useRef<SphereState>(state)

  // Keep stateRef current without restarting the animation loop
  useEffect(() => { stateRef.current = state }, [state])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const dpr = window.devicePixelRatio || 1
    canvas.width  = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const R  = size * 0.40
    const cx = size / 2
    const cy = size / 2

    // ── Fibonacci sphere particle seed positions ───────────────────────────
    type P = { ox: number; oy: number; oz: number; x: number; y: number; z: number; phase: number }
    const particles: P[] = []
    const golden = Math.PI * (1 + Math.sqrt(5))
    for (let i = 0; i < NUM_PARTICLES; i++) {
      const t  = Math.acos(1 - (2 * (i + 0.5)) / NUM_PARTICLES)
      const ph = golden * i
      const ox = Math.sin(t) * Math.cos(ph)
      const oy = Math.sin(t) * Math.sin(ph)
      const oz = Math.cos(t)
      particles.push({ ox, oy, oz, x: ox, y: oy, z: oz, phase: Math.random() * Math.PI * 2 })
    }

    // Persistent rotation angles — smoothly driven per frame
    let rotY = 0
    let rotX = 0

    function rotateY(p: P, a: number) {
      const c = Math.cos(a), s = Math.sin(a)
      const x = p.x * c + p.z * s
      const z = -p.x * s + p.z * c
      p.x = x; p.z = z
    }
    function rotateX(p: P, a: number) {
      const c = Math.cos(a), s = Math.sin(a)
      const y = p.y * c - p.z * s
      const z = p.y * s + p.z * c
      p.y = y; p.z = z
    }

    // ── THINKING ANIMATION (base style — applied to ALL states) ───────────
    // Each state just tweaks speed / distortion intensity on top of this base.
    function draw(t: number) {
      ctx.clearRect(0, 0, size, size)
      const s = stateRef.current

      // ── Per-state parameters (all use the thinking swirl as base) ────────
      let rotSpeedY   = 0.0
      let rotSpeedX   = 0.0
      let distort     = 0.0   // radial distortion amount
      let distortFreq = 5.0   // noise frequency
      let distortTime = 1.0   // time multiplier for distortion
      let breathe     = 0.0   // global breathing pulse
      let scatter     = 0.0   // random scatter amount (thinking chaos)
      let baseR       = R

      if (s === 'idle') {
        rotSpeedY   = 0.004
        rotSpeedX   = 0.001
        distort     = 0.03
        distortFreq = 4
        distortTime = 0.8
        breathe     = 0.018
        scatter     = 0.0
      } else if (s === 'listening') {
        // Thinking style + outward pulse rings
        rotSpeedY   = 0.010
        rotSpeedX   = 0.004
        distort     = 0.07
        distortFreq = 6
        distortTime = 2.5
        breathe     = 0.055
        scatter     = 0.012
      } else if (s === 'thinking') {
        // The "good" one — fast swirl, compressed, noisy chaos
        rotSpeedY   = 0.016
        rotSpeedX   = 0.007
        distort     = 0.10
        distortFreq = 10
        distortTime = 5.0
        breathe     = 0.0
        baseR       = R * 0.88
        scatter     = 0.025
      } else {
        // speaking — wave ripple outward
        rotSpeedY   = 0.008
        rotSpeedX   = 0.003
        distort     = 0.08
        distortFreq = 8
        distortTime = 3.5
        breathe     = 0.045
        scatter     = 0.008
      }

      rotY += rotSpeedY
      rotX += rotSpeedX

      // Global breathe/pulse
      const pulse = Math.sin(t * 2.2) * breathe

      // Apply positions with noise distortion
      for (const p of particles) {
        const noise  = Math.sin(t * distortTime + p.oz * distortFreq + p.phase) *
                       Math.cos(t * distortTime * 0.7 + p.ox * distortFreq * 0.8) * distort
        const scatterN = scatter > 0 ? (Math.random() - 0.5) * scatter : 0
        const r = (baseR + pulse * R) * (1 + noise + scatterN)
        p.x = p.ox * r
        p.y = p.oy * r
        p.z = p.oz * r
      }

      // Apply global rotation
      for (const p of particles) {
        rotateY(p, rotSpeedY)
        rotateX(p, rotSpeedX)
      }

      // Sort back→front
      const sorted = [...particles].sort((a, b) => a.z - b.z)

      for (const p of sorted) {
        const perspective = (size * 1.3) / (size * 1.3 - p.z * 0.5)
        const px = cx + p.x * perspective
        const py = cy + p.y * perspective * 0.96

        const depth = (p.z / R + 1) / 2   // 0=back → 1=front

        // Thinking: extra hot center cluster effect
        let alpha: number
        let dotSz: number

        if (s === 'thinking') {
          alpha = 0.15 + depth * 0.85
          // Some particles flash brighter (neural-fire effect)
          const flash = Math.sin(t * 8 + p.phase * 3) > 0.7 ? 1.4 : 1.0
          alpha = Math.min(1, alpha * flash)
          dotSz = (0.4 + depth * 1.1) * perspective
        } else if (s === 'listening') {
          alpha = 0.2 + depth * 0.8
          dotSz = (0.5 + depth * 1.3) * perspective
        } else if (s === 'speaking') {
          const wave = Math.sin(t * 5 + depth * Math.PI) > 0 ? 1.2 : 0.85
          alpha = (0.18 + depth * 0.7) * wave
          dotSz = (0.4 + depth * 1.0) * perspective
        } else {
          alpha = 0.08 + depth * 0.55
          dotSz = (0.3 + depth * 0.8) * perspective
        }

        // Slight lavender tint on front-most particles
        const lv = Math.floor(depth * 25)
        ctx.fillStyle = `rgba(${215 + lv},${212 + lv},${255},${Math.min(alpha, 1).toFixed(2)})`
        ctx.beginPath()
        ctx.arc(px, py, Math.max(dotSz, 0.35), 0, Math.PI * 2)
        ctx.fill()
      }

      // ── State-specific overlays ──────────────────────────────────────────
      if (s === 'thinking') {
        // Rotating inner energy ring
        const r1 = R * (0.7 + Math.sin(t * 3) * 0.05)
        ctx.strokeStyle = `rgba(180,170,255,${0.08 + Math.sin(t * 3) * 0.04})`
        ctx.lineWidth = 0.8
        ctx.beginPath(); ctx.arc(cx, cy, r1, 0, Math.PI * 2); ctx.stroke()
        // Outer dim halo
        const r2 = R * (1.05 + Math.sin(t * 1.8) * 0.03)
        ctx.strokeStyle = `rgba(180,170,255,${0.04 + Math.sin(t * 1.8) * 0.02})`
        ctx.lineWidth = 0.5
        ctx.beginPath(); ctx.arc(cx, cy, r2, 0, Math.PI * 2); ctx.stroke()
      }

      if (s === 'listening') {
        // Pulsing ring — hearing wave
        const ringR = R * (1.1 + Math.sin(t * 2.8) * 0.05)
        ctx.strokeStyle = `rgba(176,170,255,${0.10 + Math.sin(t * 2.8) * 0.06})`
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2); ctx.stroke()
      }

      if (s === 'speaking') {
        // Two outward expanding rings (ripple)
        for (let k = 0; k < 2; k++) {
          const phase = (t * 1.5 + k * Math.PI) % (Math.PI * 2)
          const rr = R * (1.0 + (phase / (Math.PI * 2)) * 0.25)
          const op = Math.max(0, 0.12 - (phase / (Math.PI * 2)) * 0.12)
          ctx.strokeStyle = `rgba(200,195,255,${op})`
          ctx.lineWidth = 0.8
          ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke()
        }
      }

      frameRef.current = requestAnimationFrame((ts) => draw(ts * 0.001))
    }

    frameRef.current = requestAnimationFrame((ts) => draw(ts * 0.001))
    return () => cancelAnimationFrame(frameRef.current)
  }, [size])  // ← only restart when size changes, NOT on state change (smooth transitions)

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="select-none"
    />
  )
}
