import { escapeHtml as e } from "./html"
import type { ReportModel, RowStatus, ScreenRow, SharedRow } from "./model"
import { STYLES } from "./styles"

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

function renderWarnings(warnings: string[]): string {
  if (warnings.length === 0) return ""
  return `<h2>Upozorenja</h2><div class="warnings"><ul class="plain">${warnings.map((w) => `<li>${e(w)}</li>`).join("")}</ul></div>`
}

/** "2026-10-30T10:00:00.000Z" → "2026-10-30 10:00:00 UTC" (fixed format, no locale). */
const readableTime = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`
}

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
<p class="muted">Ekran je dokazan samo kad svi testovi prolaze i pokrivene su sve obaveze i svi interaktivni elementi originala. Ekran bez testova nikad nije dokazan.</p>
<h2>Ekrani</h2>
${screens}
${renderShared(model.shared)}
${renderWarnings(model.warnings)}
</main>
</body>
</html>
`
}
