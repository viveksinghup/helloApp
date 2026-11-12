/**
 * Generates mind-sphere PNG icons for the Jarvis PWA.
 * Uses only built-in Node.js — no extra deps needed.
 * Outputs SVG files that the browser/OS can use as icons.
 */

const fs = require('fs')
const path = require('path')

// Generate Fibonacci sphere points projected to 2D
function fibonacciSphere(n, radius, cx, cy) {
  const points = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const theta = golden * i
    const x3d = Math.cos(theta) * r
    const z3d = Math.sin(theta) * r
    // Simple orthographic projection + depth cue
    const depth = (y + 1) / 2  // 0 = back, 1 = front
    const scale = 0.7 + depth * 0.3
    const px = cx + x3d * radius * scale
    const py = cy - y * radius * scale
    const opacity = 0.3 + depth * 0.7
    const dotR = (1.2 + depth * 1.4)
    points.push({ px, py, opacity, dotR })
  }
  return points
}

function makeSVG(size) {
  const cx = size / 2
  const cy = size / 2
  const sphereR = size * 0.44
  const nDots = size >= 400 ? 500 : 220

  const dots = fibonacciSphere(nDots, sphereR, cx, cy)

  const circles = dots.map(d =>
    `<circle cx="${d.px.toFixed(1)}" cy="${d.py.toFixed(1)}" r="${d.dotR.toFixed(1)}" fill="white" opacity="${d.opacity.toFixed(2)}"/>`
  ).join('\n    ')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#000000"/>
  <!-- Particle sphere -->
  <g>
    ${circles}
  </g>
  <!-- Subtle glow ring -->
  <circle cx="${cx}" cy="${cy}" r="${sphereR * 1.05}" fill="none" stroke="white" stroke-width="0.5" opacity="0.08"/>
</svg>`
}

const outDir = path.join(__dirname, 'frontend/public/icons')
fs.mkdirSync(outDir, { recursive: true })

const sizes = [192, 512]
for (const size of sizes) {
  const svg = makeSVG(size)
  const svgPath = path.join(outDir, `icon-${size}.svg`)
  fs.writeFileSync(svgPath, svg)
  console.log(`✓ Written: icon-${size}.svg`)
}

// Also write a small favicon SVG
const faviconSvg = makeSVG(64)
fs.writeFileSync(path.join(__dirname, 'frontend/public/favicon.svg'), faviconSvg)
console.log('✓ Written: favicon.svg')

console.log('\nAll icons generated! Now convert SVG → PNG for best compatibility.')
console.log('The SVGs work directly on modern browsers as PWA icons.')

