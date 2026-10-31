// Ambient background: drafts drift from the web side (left) toward the phone (right).
// At the Gatekeeper line most pass (green dot with a check) and some are sent back (red, fade out),
// the way drafts go through gates and rounds. Behind the content, never clickable, paused when hidden,
// off with reduced motion.
(() => {
  const canvas = document.querySelector(".ambient")
  if (!canvas) return
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
  const ctx = canvas.getContext("2d")
  let w = 0, h = 0, dpr = 1, gateX = 0
  let colors = {}
  const items = []

  function readColors() {
    const s = getComputedStyle(document.documentElement)
    const v = (n) => s.getPropertyValue(n).trim()
    colors = { draft: v("--muted"), pass: v("--accent"), fail: v("--failed"), gate: v("--line"), bg: v("--bg") }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    w = window.innerWidth; h = window.innerHeight
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    gateX = w * 0.58
    const target = Math.round(Math.min(34, Math.max(12, w / 40)))
    while (items.length < target) items.push(spawn(true))
    items.length = target
  }

  function spawn(anywhere) {
    return {
      x: anywhere ? Math.random() * gateX : -20 - Math.random() * 200,
      y: 20 + Math.random() * (h - 40),
      v: 0.25 + Math.random() * 0.45,
      size: 5 + Math.random() * 5,
      wobble: Math.random() * Math.PI * 2,
      state: "draft", // draft → pass | fail
      fade: 1,
      fails: Math.random() < 0.22,
    }
  }

  function draw(it) {
    ctx.globalAlpha = 0.3 * it.fade
    const y = it.y + Math.sin(it.wobble) * 6
    if (it.state === "draft") {
      ctx.strokeStyle = colors.draft; ctx.lineWidth = 1.2
      ctx.strokeRect(it.x - it.size, y - it.size * 1.2, it.size * 2, it.size * 2.4)
      ctx.beginPath(); ctx.moveTo(it.x - it.size * 0.5, y - 2); ctx.lineTo(it.x + it.size * 0.5, y - 2); ctx.stroke()
      return
    }
    const color = it.state === "pass" ? colors.pass : colors.fail
    ctx.fillStyle = color
    ctx.beginPath(); ctx.arc(it.x, y, it.size, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 0.6 * it.fade
    ctx.strokeStyle = colors.bg
    ctx.lineWidth = 1.6; ctx.beginPath()
    if (it.state === "pass") { ctx.moveTo(it.x - it.size * 0.45, y); ctx.lineTo(it.x - it.size * 0.1, y + it.size * 0.4); ctx.lineTo(it.x + it.size * 0.5, y - it.size * 0.35) }
    else { const k = it.size * 0.4; ctx.moveTo(it.x - k, y - k); ctx.lineTo(it.x + k, y + k); ctx.moveTo(it.x + k, y - k); ctx.lineTo(it.x - k, y + k) }
    ctx.stroke()
  }

  function step() {
    ctx.clearRect(0, 0, w, h)
    // the Gatekeeper line
    ctx.globalAlpha = 0.5; ctx.strokeStyle = colors.gate; ctx.lineWidth = 1
    ctx.setLineDash([4, 8]); ctx.beginPath(); ctx.moveTo(gateX, 0); ctx.lineTo(gateX, h); ctx.stroke(); ctx.setLineDash([])
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      it.wobble += 0.012
      if (it.state === "draft") {
        it.x += it.v
        if (it.x >= gateX) it.state = it.fails ? "fail" : "pass"
      } else if (it.state === "pass") {
        it.x += it.v * 1.4
        if (it.x > w + 30) items[i] = spawn(false)
      } else {
        it.x -= it.v * 0.9; it.fade -= 0.008
        if (it.fade <= 0) items[i] = spawn(false)
      }
      draw(it)
    }
    ctx.globalAlpha = 1
    if (!document.hidden) raf = requestAnimationFrame(step)
  }

  let raf = 0
  readColors(); resize()
  window.addEventListener("resize", resize)
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readColors)
  new MutationObserver(readColors).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { cancelAnimationFrame(raf); raf = requestAnimationFrame(step) } })
  raf = requestAnimationFrame(step)
})()
