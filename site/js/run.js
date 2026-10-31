// Real run section: both videos start together; "Replay both" restarts them in step.
// With reduced motion they do not play on their own; the posters show the end state.
const videos = [...document.querySelectorAll(".run-video")]
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches

function playAll() {
  for (const v of videos) {
    v.currentTime = 0
    v.play().catch(() => {})
  }
}

if (reduce) {
  for (const v of videos) {
    v.removeAttribute("autoplay")
    v.pause()
    v.controls = true
  }
}

document.getElementById("replay")?.addEventListener("click", playAll)
