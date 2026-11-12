/**
 * Generates mind-sphere PNG icons using pure Node.js (no deps).
 * Writes minimal valid PNG files using raw pixel manipulation.
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

// ── PNG writer (pure Node, no deps) ──────────────────────────────────────────
function writePNG(width, height, pixels) {
  // pixels: Uint8Array of RGBA values, row by row
  function crc32(buf) {
    let crc = 0xFFFFFFFF
    const table = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
      table[i] = c
    }
    for (const b of buf) crc = table[(crc ^ b) & 0xFF] ^ (crc >>> 8)
    return (crc ^ 0xFFFFFFFF) >>> 0
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const t = Buffer.from(type, 'ascii')
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
    return Buffer.concat([len, t, data, crc])
  }

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0 // 8-bit RGB, no alpha for simplicity

  // Raw scanlines (filter byte 0 = None, then RGB pixels)
  const raw = Buffer.alloc(height * (1 + width * 3))
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0 // filter type None
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4
      const dst = y * (1 + width * 3) + 1 + x * 3
      raw[dst] = pixels[src]     // R
      raw[dst+1] = pixels[src+1] // G
      raw[dst+2] = pixels[src+2] // B
      // ignore alpha for PNG RGB mode
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 })
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))])
}

// ── Render sphere to pixel buffer ─────────────────────────────────────────────
function renderSphere(size) {
  const pixels = new Uint8Array(size * size * 4)

  // Fill black background
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 0; pixels[i+1] = 0; pixels[i+2] = 0; pixels[i+3] = 255
  }

  // Rounded rect clip (rounded corners like iOS icon)
  const radius = size * 0.22
  function inRoundedRect(x, y) {
    const cx = size / 2, cy = size / 2
    const hw = size / 2, hh = size / 2
    const dx = Math.max(0, Math.abs(x - cx) - (hw - radius))
    const dy = Math.max(0, Math.abs(y - cy) - (hh - radius))
    return dx * dx + dy * dy <= radius * radius
  }

  // Set pixel helper (with alpha blend for anti-aliasing)
  function setPixel(x, y, opacity) {
    const ix = Math.round(x), iy = Math.round(y)
    if (ix < 0 || iy < 0 || ix >= size || iy >= size) return
    if (!inRoundedRect(ix, iy)) return
    const idx = (iy * size + ix) * 4
    const v = Math.min(255, Math.round(255 * opacity))
    pixels[idx]   = Math.min(255, pixels[idx]   + v)
    pixels[idx+1] = Math.min(255, pixels[idx+1] + v)
    pixels[idx+2] = Math.min(255, pixels[idx+2] + v)
  }

  // Draw soft dot (gaussian-ish falloff)
  function drawDot(px, py, dotRadius, opacity) {
    const r = Math.ceil(dotRadius * 2)
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const dist = Math.sqrt(dx*dx + dy*dy)
        if (dist > dotRadius * 2) continue
        const alpha = opacity * Math.max(0, 1 - dist / dotRadius)
        setPixel(px + dx, py + dy, alpha)
      }
    }
  }

  // Fibonacci sphere dots
  const cx = size / 2, cy = size / 2
  const sphereR = size * 0.34
  const nDots = size >= 400 ? 480 : 200
  const golden = Math.PI * (3 - Math.sqrt(5))

  for (let i = 0; i < nDots; i++) {
    const y3d = 1 - (i / (nDots - 1)) * 2
    const r3d = Math.sqrt(Math.max(0, 1 - y3d * y3d))
    const theta = golden * i
    const x3d = Math.cos(theta) * r3d
    const z3d = Math.sin(theta) * r3d  // unused in ortho but kept for depth

    // Orthographic projection
    const depth = (z3d + 1) / 2  // 0=back, 1=front
    const perspective = 0.75 + depth * 0.25
    const px = cx + x3d * sphereR * perspective
    const py = cy - y3d * sphereR * perspective

    const opacity = 0.25 + depth * 0.75
    const dotR = size >= 400 ? (1.5 + depth * 2.5) : (0.8 + depth * 1.5)
    drawDot(px, py, dotR, opacity)
  }

  // Clip corners to black (enforce rounded rect)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!inRoundedRect(x, y)) {
        const idx = (y * size + x) * 4
        pixels[idx] = 0; pixels[idx+1] = 0; pixels[idx+2] = 0; pixels[idx+3] = 255
      }
    }
  }

  return pixels
}

// ── Generate icons ────────────────────────────────────────────────────────────
const outDir = path.join(__dirname, 'frontend/public/icons')
fs.mkdirSync(outDir, { recursive: true })

for (const size of [192, 512]) {
  console.log(`Rendering ${size}x${size} sphere...`)
  const pixels = renderSphere(size)
  const png = writePNG(size, size, pixels)
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), png)
  console.log(`✓ icon-${size}.png (${(png.length/1024).toFixed(1)} KB)`)
}

// 180px Apple Touch Icon
console.log('Rendering 180x180 apple-touch-icon...')
const applePixels = renderSphere(180)
const applePng = writePNG(180, 180, applePixels)
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), applePng)
console.log(`✓ apple-touch-icon.png`)

console.log('\n✅ All PNG icons generated!')
