import { usdText } from "./costs"
import { escapeHtml as e } from "./html"
import { formatDuration, type ReportModel, type RowStatus, type ScreenRow, type SharedRow } from "./model"
import { STYLES } from "./styles"
import { speedupText, type AgentKindName, type Rescale, type Timeline } from "./timeline"

// Pure: ReportModel → one self-contained HTML page (no scripts, no external files).

export const STATUS_LABELS: Record<RowStatus, string> = {
  proven: "dokazan",
  partial: "delimično dokazan",
  unproven: "nedokazan",
  failed: "neuspeo",
  "no-result": "nema rezultata",
}

const SUMMARY_ORDER: RowStatus[] = ["proven", "partial", "unproven", "failed", "no-result"]
const OUTCOME = { pass: "✓", fail: "✗", "not-run": "—" } as const
const OUTCOME_LABEL = { pass: "prolazi", fail: "pada", "not-run": "nije pušten" } as const

const badge = (status: RowStatus) => `<span class="badge status-${status}">${e(STATUS_LABELS[status])}</span>`
const rounds = (n: number | null) => (n === null ? "" : ` · ${n} ${n === 1 ? "runda" : n < 5 ? "runde" : "rundi"}`)

function renderSummary(model: ReportModel): string {
  const tiles = SUMMARY_ORDER.filter((s) => s !== "no-result" || model.counts[s] > 0).map(
    (s) => `<div class="tile status-${s}"><div class="n">${model.counts[s]}</div><div>${e(STATUS_LABELS[s])}</div></div>`,
  )
  return `<section class="summary" aria-label="Sažetak">${tiles.join("")}</section>`
}

function renderScenarios(row: ScreenRow): string {
  if (row.scenarios.length === 0) return `<p class="muted">Nema sačuvanih testova.</p>`
  const lines = row.scenarios.map((s) => {
    const detail =
      s.outcome === "fail"
        ? `<span class="error">${s.failedStep !== undefined ? `korak ${s.failedStep + 1}: ` : ""}${e(s.error ?? "pada")}</span>`
        : ""
    return `<tr><td class="outcome ${s.outcome}" title="${OUTCOME_LABEL[s.outcome]}">${OUTCOME[s.outcome]}</td><td><code>${e(s.id)}</code></td><td>${e(s.obligation)}</td><td>${detail}</td></tr>`
  })
  return `<table><thead><tr><th>Rezultat</th><th>Scenario</th><th>Obaveza</th><th>Greška</th></tr></thead><tbody>${lines.join("")}</tbody></table>`
}

function renderScreen(row: ScreenRow): string {
  const differences =
    row.differences.length > 0
      ? `<p><strong>Namerne razlike (${row.differences.length}):</strong></p><ul class="plain">${row.differences.map((d) => `<li>${e(d)}</li>`).join("")}</ul>`
      : ""
  return `<article class="screen status-${row.status}" id="unit-${e(row.unitId)}">
<div class="screen-head"><h3>${e(row.unitId)}</h3><code>${e(row.route)}</code>${badge(row.status)}<span class="muted">talas ${row.wave}${rounds(row.rounds)}</span></div>
<p class="coverage">${e(row.coverageText)}</p>
${row.reason ? `<p class="reason"><strong>Razlog:</strong> ${e(row.reason)}</p>` : ""}
${differences}
${renderScenarios(row)}
</article>`
}

const SHARED_LABEL: Record<SharedRow["status"], string> = { promoted: "promovisana", failed: "neuspela", "no-result": "nema rezultata" }
const SHARED_CLASS: Record<SharedRow["status"], RowStatus> = { promoted: "proven", failed: "failed", "no-result": "no-result" }

function renderShared(rows: SharedRow[]): string {
  if (rows.length === 0) return ""
  const lines = rows.map(
    (r) =>
      `<tr><td><code>${e(r.unitId)}</code></td><td><span class="badge status-${SHARED_CLASS[r.status]}">${e(SHARED_LABEL[r.status])}</span></td><td>${r.sources}</td><td>${r.rounds ?? "—"}</td><td>${e(r.reason ?? "")}</td></tr>`,
  )
  return `<h2>Zajedničke jedinice</h2>
<p class="muted">Nemaju svoje UI testove; dokazuju se kroz ekrane koji ih koriste.</p>
<table class="shared"><thead><tr><th>Jedinica</th><th>Status</th><th>Fajlova</th><th>Rundi</th><th>Napomena</th></tr></thead><tbody>${lines.join("")}</tbody></table>`
}

function renderStop(stop: ReportModel["stop"]): string {
  if (!stop) return ""
  const errors =
    stop.planErrors.length > 0
      ? `<p>Poslednje greške plana (<code>plan.errors.json</code>):</p><ol>${stop.planErrors.map((x) => `<li>${e(x)}</li>`).join("")}</ol>`
      : ""
  return `<section class="warnings run-stop" aria-label="Ishod prolaza"><p><strong>${e(stop.text)}</strong></p>${errors}</section>`
}

// v2 (D17): timeline, speed-up, team changes, cost and rounds, all from run.jsonl.

const KIND_LABEL: Record<AgentKindName, string> = {
  analyzer: "analizator",
  architect: "arhitekta",
  tester: "tester",
  builder: "builder",
  other: "ostalo",
}

// SVG geometry in viewBox units; the image scales to the page width.
const SVG = { width: 1000, labelWidth: 130, right: 16, axis: 26, rowHeight: 28, barHeight: 16 }
const fixed = (n: number) => Number(n.toFixed(1))

function timelineSvg(timeline: Timeline): string {
  const plot = SVG.width - SVG.labelWidth - SVG.right
  const t0 = Date.parse(timeline.startedAt)
  const span = Math.max(timeline.windowMs, 1)
  const x = (iso: string) => fixed(SVG.labelWidth + ((Date.parse(iso) - t0) / span) * plot)
  const height = SVG.axis + timeline.rows.length * SVG.rowHeight + 6

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const tx = fixed(SVG.labelWidth + f * plot)
    const anchor = f === 0 ? "start" : f === 1 ? "end" : "middle"
    return `<line class="grid" x1="${tx}" y1="${SVG.axis - 6}" x2="${tx}" y2="${height}"/><text class="tick" x="${tx}" y="${SVG.axis - 10}" text-anchor="${anchor}">${e(formatDuration(f * timeline.windowMs))}</text>`
  })

  const rows = timeline.rows.map((row, i) => {
    const top = SVG.axis + i * SVG.rowHeight
    const mid = top + SVG.rowHeight / 2
    const bars = row.bars.map((b) => {
      const bx = x(b.start)
      const width = Math.max(fixed(x(b.end) - bx), 2)
      const title = `${row.agent}${b.label ? ` · ${b.label}` : ""} · ${formatDuration(b.durationMs)}${b.open ? " (nije završeno)" : ""}`
      const text = b.label && width > 70 ? `<text class="bar-text" x="${fixed(bx + 5)}" y="${fixed(mid + 4)}">${e(b.label)}</text>` : ""
      return `<g><title>${e(title)}</title><rect class="bar kind-${row.kind}${b.open ? " open" : ""}" x="${bx}" y="${fixed(mid - SVG.barHeight / 2)}" width="${width}" height="${SVG.barHeight}" rx="3"/>${text}</g>`
    })
    const dot = (t: string, cls: string, what: string) =>
      `<circle class="${cls}" cx="${x(t)}" cy="${fixed(top + SVG.rowHeight - 3)}" r="3"><title>${e(`${row.agent} ${what} posle ${formatDuration(Date.parse(t) - t0)}`)}</title></circle>`
    return [
      `<line class="lane" x1="${SVG.labelWidth}" y1="${fixed(mid)}" x2="${SVG.width - SVG.right}" y2="${fixed(mid)}"/>`,
      `<text class="lane-label" x="${SVG.labelWidth - 8}" y="${fixed(mid + 4)}" text-anchor="end">${e(row.agent)}</text>`,
      ...bars,
      ...row.joined.map((t) => dot(t, "joined", "ulazi")),
      ...row.left.map((t) => dot(t, "left", "izlazi")),
    ].join("")
  })

  const label = `Vremenska osa: ${timeline.rows.length} agenata tokom ${formatDuration(timeline.windowMs)}`
  return `<svg class="timeline" viewBox="0 0 ${SVG.width} ${height}" role="img" aria-label="${e(label)}">${ticks.join("")}${rows.join("")}</svg>`
}

function renderFlow(model: ReportModel): string {
  const t = model.timeline
  if (!t || t.rows.length === 0) return `<h2>Tok prolaza</h2><p class="muted">U run.jsonl nema rada agenata, pa nema vremenske ose.</p>`
  const kinds = [...new Set(t.rows.map((r) => r.kind))]
  const legend = [
    ...kinds.map((k) => `<span><i class="swatch kind-${k}"></i>${e(KIND_LABEL[k])}</span>`),
    `<span><i class="dot joined"></i>ulazi</span>`,
    `<span><i class="dot left"></i>izlazi</span>`,
  ].join("")
  const speedup =
    t.speedup === null
      ? `<p class="muted">Ubrzanje nije moguće izračunati.</p>`
      : `<p>Ubrzanje <strong>${e(speedupText(t.speedup))}</strong>: agenti su zajedno radili ${e(formatDuration(t.busyMs))}, a prolaz je trajao ${e(formatDuration(t.windowMs))} (zbir trajanja svih traka ÷ trajanje prolaza).</p>`
  return `<h2>Tok prolaza</h2>
${speedup}
<div class="timeline-box">${timelineSvg(t)}</div>
<p class="legend">${legend}</p>`
}

const PEAK_LABEL: [AgentKindName, string][] = [
  ["builder", "builderi"],
  ["tester", "testeri"],
  ["analyzer", "analizatori"],
  ["architect", "arhitekte"],
]

// Team size over time (A14, D-021): agents.rescaled lines and the peak from agent.started / agent.stopped.
function renderAgents(model: ReportModel): string {
  const peak = PEAK_LABEL.filter(([k]) => (model.peak[k] ?? 0) > 0).map(([k, label]) => `${label} <strong>${model.peak[k]}</strong>`)
  if (model.rescales.length === 0 && peak.length === 0) return ""
  const peakLine = peak.length > 0 ? `<p>Najviše istovremeno: ${peak.join(", ")}.</p>` : ""
  if (model.rescales.length === 0) return `<h2>Agenti</h2>${peakLine}<p class="muted">Broj agenata se nije menjao tokom prolaza (nema linija <code>agents.rescaled</code>).</p>`

  const start = model.startedAt ? Date.parse(model.startedAt) : Date.parse(model.rescales[0]!.t)
  const cell = (r: Rescale, key: "analyzers" | "builders" | "testers") => {
    const to = r.team[key]
    if (to === undefined) return "—"
    const from = r.from?.[key]
    return from !== undefined && from !== to ? `${from} → <strong>${to}</strong>` : `${to}`
  }
  const rows = model.rescales.map(
    (r) =>
      `<tr><td class="num">${e(formatDuration(Date.parse(r.t) - start))}</td><td class="num">${cell(r, "analyzers")}</td><td class="num">${cell(r, "builders")}</td><td class="num">${cell(r, "testers")}</td><td>${e(r.text)}</td></tr>`,
  )
  return `<h2>Agenti</h2>
${peakLine}
<p class="muted">Conductor menja broj agenata po formulama iz arhitekture, najviše jednom u minuti. Svaka promena i njen razlog:</p>
<div class="table-scroll"><table class="agents"><thead><tr><th class="num">Posle</th><th class="num">Analizatori</th><th class="num">Builderi</th><th class="num">Testeri</th><th>Razlog</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>`
}

function renderCosts(costs: ReportModel["costs"]): string {
  if (costs.rows.length === 0) return `<h2>Trošak</h2><p class="muted">Nema zapisa o trošku (prolaz bez modela, npr. <code>--mock</code>, ne troši ništa).</p>`
  const rows = costs.rows.map(
    (r) =>
      `<tr><td><code>${e(r.agent)}</code></td><td>${e(r.models.join(", ") || "—")}</td><td class="num">${r.calls}</td><td class="num">${r.inputTokens}${r.cachedTokens > 0 ? ` <span class="muted">(+${r.cachedTokens} keš)</span>` : ""}</td><td class="num">${r.outputTokens}</td><td class="num">${e(usdText(r.usd))}</td></tr>`,
  )
  return `<h2>Trošak</h2>
<div class="table-scroll"><table class="costs"><thead><tr><th>Agent</th><th>Model</th><th class="num">Poziva</th><th class="num">Ulaznih tokena</th><th class="num">Izlaznih tokena</th><th class="num">Trošak</th></tr></thead>
<tbody>${rows.join("")}</tbody>
<tfoot><tr><td colspan="2">Ukupno</td><td class="num">${costs.calls}</td><td></td><td></td><td class="num">${e(usdText(costs.totalUsd))}</td></tr></tfoot></table></div>`
}

function renderRounds(rounds: ReportModel["rounds"]): string {
  if (rounds.length === 0) return ""
  const rows = rounds.map((u) => {
    const list = u.rounds
      .map((r) => `<span class="${r.failed ? "fail" : "pass"}">${r.round}: ${e(r.model ?? "?")} ${r.failed ? "✗" : "✓"}</span>`)
      .join(" · ")
    const rejected = u.rounds.filter((r) => r.failed).length
    return `<tr><td><code>${e(u.unitId)}</code></td><td>${list}</td><td class="num">${rejected}</td></tr>`
  })
  return `<h2>Runde i modeli</h2>
<p class="muted">✗ znači da je Gatekeeper odbio nacrt te runde (<code>gate.failed</code>), pa je builder dobio sledeću.</p>
<div class="table-scroll"><table class="rounds"><thead><tr><th>Jedinica</th><th>Runda: model</th><th class="num">Odbijeno</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>`
}

function renderWarnings(warnings: string[]): string {
  if (warnings.length === 0) return ""
  return `<h2>Upozorenja</h2><div class="warnings"><ul class="plain">${warnings.map((w) => `<li>${e(w)}</li>`).join("")}</ul></div>`
}

/** "2026-10-30T10:00:00.000Z" → "2026-10-30 10:00:00 UTC" (fixed format, no locale). */
const readableTime = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`
}

// D-027: the theme carries fonts, sizes and colors; the proof is still about behavior, not looks.
const themeNote = (model: ReportModel) =>
  model.shared.some((s) => s.unitId === "theme") ? " Izgled (font, veličine, boje) se prenosi sa weba preko teme; dokaz je za ponašanje, ne za izgled." : ""

export function renderReport(model: ReportModel): string {
  const when =
    model.startedAt && model.finishedAt
      ? `<p class="muted">Od ${e(readableTime(model.startedAt))} do ${e(readableTime(model.finishedAt))} (${e(model.durationText ?? "")})</p>`
      : `<p class="muted">Vreme prolaza nije poznato (nema run.jsonl).</p>`
  const screens =
    model.screens.length > 0 ? model.screens.map(renderScreen).join("\n") : `<p class="muted">Plan nema nijedan ekran.</p>`

  return `<!doctype html>
<html lang="sr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wemora izveštaj ${e(model.runId)}</title>
<style>${STYLES}</style>
</head>
<body>
<main>
<h1>Wemora izveštaj</h1>
<p>Prolaz <code>${e(model.runId)}</code></p>
${when}
${renderSummary(model)}
${renderStop(model.stop)}
<p class="muted">Ekran je dokazan samo kad svi testovi prolaze i pokrivene su sve obaveze i svi interaktivni elementi originala. Ekran bez testova nikad nije dokazan.${themeNote(model)}</p>
<h2>Ekrani</h2>
${screens}
${renderShared(model.shared)}
${renderFlow(model)}
${renderAgents(model)}
${renderCosts(model.costs)}
${renderRounds(model.rounds)}
${renderWarnings(model.warnings)}
</main>
</body>
</html>
`
}
