// Ambient background: drafts drift from the web side (left) toward the phone side (right).
// At the Gatekeeper line most pass (green dot with a check) and some are sent back (red ✕, fade out),
// the way drafts go through gates and rounds. Each crossing sends a ripple along the line.
// Three depth layers (parallax on scroll), even lanes over the whole height, drafts step aside
// from the pointer. Behind the content, never clickable, paused when hidden, off with reduced motion.
(() => {
  const canvas = document.querySelector(".ambient")
  if (!canvas) return
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
  const ctx = canvas.getContext("2d")

  // far → near: size, speed, opacity and how much it moves with scrolling
  const LAYERS = [
    { scale: 0.6, speed: 0.55, alpha: 0.16, parallax: 0.04 },
    { scale: 0.9, speed: 0.85, alpha: 0.24, parallax: 0.09 },
    { scale: 1.25, speed: 1.2, alpha: 0.32, parallax: 0.16 },
  ]

  let w = 0, h = 0, dpr = 1, gateX = 0, scrollY = window.scrollY
  let colors = {}
  let items = []
  const ripples = []
  const pointer = { x: -9999, y: -9999 }
  let lane = 0

  function readColors() {
    const s = getComputedStyle(document.documentElement)
    const v = (n) => s.getPropertyValue(n).trim()
    colors = { draft: v("--muted"), pass: v("--accent"), fail: v("--failed"), gate: v("--line"), bg: v("--bg") }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    w = window.innerWidth
    h = window.innerHeight
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    gateX = w * (w < 700 ? 0.7 : 0.65)
    const target = Math.round(Math.min(48, Math.max(16, (w * h) / 26000)))
    items = Array.from({ length: target }, (_, i) => spawn(true, i, target))
  }

  // Even lanes: the next draft takes the next lane (with a little jitter), so drafts never bunch up.
  function laneY(index, total) {
    const n = (total ?? items.length) || 1
    const i = index ?? lane++ % n
    return ((i + 0.5) / n) * h + (Math.random() - 0.5) * (h / n) * 0.8
  }

  function spawn(anywhere, index, total) {
    const layer = LAYERS[Math.floor(Math.random() * LAYERS.length)]
    return {
      layer,
      x: anywhere ? Math.random() * gateX * 0.98 : -30 - Math.random() * w * 0.25,
      y: laneY(index, total),
      v: (0.22 + Math.random() * 0.3) * layer.speed,
      size: (5 + Math.random() * 3) * layer.scale,
      wobble: Math.random() * Math.PI * 2,
      dx: 0,
      dy: 0,
      state: "draft", // draft → pass | fail
      fade: 1,
      fails: Math.random() < 0.2,
    }
  }

  function screenY(it) {
    // parallax: nearer layers shift more when the page scrolls
    const shift = (scrollY * it.layer.parallax) % h
    let y = it.y - shift + Math.sin(it.wobble) * 6 * it.layer.scale + it.dy
    if (y < -20) y += h + 40
    return y
  }

  function draw(it) {
    const x = it.x + it.dx
    const y = screenY(it)
    const a = it.layer.alpha * it.fade
    if (it.state === "draft") {
      ctx.globalAlpha = a
      ctx.strokeStyle = colors.draft
      ctx.lineWidth = 1.2
      const s = it.size
      ctx.strokeRect(x - s, y - s * 1.2, s * 2, s * 2.4)
      ctx.beginPath()
      ctx.moveTo(x - s * 0.5, y - s * 0.35)
      ctx.lineTo(x + s * 0.5, y - s * 0.35)
      ctx.moveTo(x - s * 0.5, y + s * 0.15)
      ctx.lineTo(x + s * 0.2, y + s * 0.15)
      ctx.stroke()
      return
    }
    const color = it.state === "pass" ? colors.pass : colors.fail
    ctx.globalAlpha = a * 1.25
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, y, it.size, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = Math.min(1, a * 2.4)
    ctx.strokeStyle = colors.bg
    ctx.lineWidth = Math.max(1.2, it.size * 0.22)
    ctx.beginPath()
    if (it.state === "pass") {
      ctx.moveTo(x - it.size * 0.45, y)
      ctx.lineTo(x - it.size * 0.1, y + it.size * 0.4)
      ctx.lineTo(x + it.size * 0.5, y - it.size * 0.35)
    } else {
      const k = it.size * 0.4
      ctx.moveTo(x - k, y - k)
      ctx.lineTo(x + k, y + k)
      ctx.moveTo(x + k, y - k)
      ctx.lineTo(x - k, y + k)
    }
    ctx.stroke()
  }

  function drawGate() {
    ctx.globalAlpha = 0.45
    ctx.strokeStyle = colors.gate
    ctx.lineWidth = 1
    ctx.setLineDash([4, 8])
    ctx.lineDashOffset = -performance.now() / 60 // the dashes flow downward
    ctx.beginPath()
    ctx.moveTo(gateX, 0)
    ctx.lineTo(gateX, h)
    ctx.stroke()
    ctx.setLineDash([])
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i]
      r.t += 1
      const p = r.t / 60
      if (p >= 1) {
        ripples.splice(i, 1)
        continue
      }
      ctx.globalAlpha = 0.45 * (1 - p)
      ctx.strokeStyle = r.color
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(gateX, r.y, 4 + p * 38, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  function nudge(it) {
    // drafts step aside from the pointer, then drift back
    const x = it.x + it.dx
    const y = screenY(it)
    const ddx = x - pointer.x
    const ddy = y - pointer.y
    const d2 = ddx * ddx + ddy * ddy
    if (d2 < 120 * 120 && d2 > 1) {
      const f = (1 - Math.sqrt(d2) / 120) * 2.2
      const d = Math.sqrt(d2)
      it.dx += (ddx / d) * f
      it.dy += (ddy / d) * f
    }
    it.dx *= 0.94
    it.dy *= 0.94
  }

  function step() {
    ctx.clearRect(0, 0, w, h)
    drawGate()
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      it.wobble += 0.012
      nudge(it)
      if (it.state === "draft") {
        it.x += it.v
        if (it.x >= gateX) {
          it.state = it.fails ? "fail" : "pass"
          ripples.push({ y: screenY(it), t: 0, color: it.fails ? colors.fail : colors.pass })
        }
      } else if (it.state === "pass") {
        it.x += it.v * 1.5
        if (it.x > w + 30) items[i] = spawn(false)
      } else {
        it.x -= it.v * 0.9
        it.fade -= 0.008
        if (it.fade <= 0) items[i] = spawn(false)
      }
      draw(it)
    }
    ctx.globalAlpha = 1
    if (!document.hidden) raf = requestAnimationFrame(step)
  }

  let raf = 0
  readColors()
  resize()
  window.addEventListener("resize", resize)
  window.addEventListener("scroll", () => { scrollY = window.scrollY }, { passive: true })
  window.addEventListener("pointermove", (e) => { pointer.x = e.clientX; pointer.y = e.clientY }, { passive: true })
  window.addEventListener("pointerleave", () => { pointer.x = pointer.y = -9999 })
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readColors)
  new MutationObserver(readColors).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(step)
    }
  })
  raf = requestAnimationFrame(step)
})()
