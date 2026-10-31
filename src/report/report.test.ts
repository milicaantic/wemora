import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, describe, expect, it } from "vitest"
import { buildReport } from "./index"
import { escapeHtml } from "./html"
import { loadRun } from "./load"
import { usdText } from "./costs"
import { describeDifference, toReportModel } from "./model"
import { renderReport } from "./render"
import { buildTimeline, peakTeam, speedupText } from "./timeline"

const fixture = fileURLToPath(new URL("./mocks/run", import.meta.url))
const temps: string[] = []
const tempDir = (copyFixture: boolean) => {
  const dir = mkdtempSync(path.join(tmpdir(), "wemora-report-"))
  temps.push(dir)
  if (copyFixture) cpSync(fixture, dir, { recursive: true })
  return dir
}
afterAll(() => temps.forEach((d) => rmSync(d, { recursive: true, force: true })))

describe("buildReport over the fixture run", async () => {
  const runDir = tempDir(true)
  const file = await buildReport(runDir)
  const html = readFileSync(file, "utf8")

  it("writes report.html into the run folder and returns its path", () => {
    expect(file).toBe(path.join(runDir, "report.html"))
    expect(html.startsWith("<!doctype html>")).toBe(true)
  })

  it("shows every screen and all four status colors", () => {
    for (const id of ["recipe-list", "recipe-detail", "categories", "favorites", "shopping-list"]) expect(html).toContain(`id="unit-${id}"`)
    for (const status of ["proven", "partial", "unproven", "failed", "no-result"]) expect(html).toContain(`status-${status}`)
  })

  it("shows when the run happened, in a fixed format", () => {
    expect(html).toContain("Od 2026-10-30 10:00:00 UTC do 2026-10-30 10:07:30 UTC (7 min 30 s)")
  })

  it("writes coverage the way the plan describes it", () => {
    expect(html).toContain("6/6 obaveze, 5/5 elemenata")
    expect(html).toContain("3/5 obaveze, 2/3 elemenata (nedostaje &#39;Dodaj sastojke u listu za kupovinu&#39;)")
  })

  it("explains every status that is not proven", () => {
    expect(html).toContain("pada u rundi 4 na kapiji scenarios")
    expect(html).toContain("nema validiranih testova ni posle drugog testera")
    expect(html).toContain("nema rezultata: jedinica nije završena")
    expect(html).toContain("obaveze bez testa: add-to-shopping-list, not-found")
    expect(html).not.toContain("nedostaju obaveze")
  })

  it("lists intentional differences as sentences", () => {
    expect(html).toContain("&#39;Supe&#39; je na telefonu iza &#39;Filteri&#39;")
    expect(html).toContain("Namerne razlike (7)")
  })

  it("escapes text from disk", () => {
    expect(html).not.toContain("<script>alert(1)</script>")
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;")
  })

  it("is self-contained: no scripts, links or external URLs", () => {
    expect(html).not.toMatch(/<script|<link|\bsrc=|https?:\/\//)
  })

  it("reports bad files as warnings instead of failing", () => {
    expect(html).toContain("results/broken.json nije ispravan JSON")
    // "this line is not json" and a line without t
    expect(html).toContain("run.jsonl: 2 neispravne linije su preskočene")
  })

  it("is byte-for-byte the same on a second build", async () => {
    await buildReport(runDir)
    expect(readFileSync(file, "utf8")).toBe(html)
  })
})

describe("buildReport on an empty folder", () => {
  it("still writes a report and says what is missing", async () => {
    const runDir = tempDir(false)
    const html = readFileSync(await buildReport(runDir), "utf8")
    expect(html).toContain("plan.json ne postoji")
    expect(html).toContain("run.jsonl ne postoji")
    expect(html).toContain("Plan nema nijedan ekran.")
  })
})

describe("how the run ended (run.finished from the Conductor)", () => {
  const line = (event: string, data: unknown) => JSON.stringify({ t: "2026-10-30T10:00:00.000Z", agent: "conductor", event, data })
  const runWith = (lines: string[], files: Record<string, string> = {}) => {
    const runDir = tempDir(false)
    writeFileSync(path.join(runDir, "run.jsonl"), `${lines.join("\n")}\n`)
    for (const [name, text] of Object.entries(files)) writeFileSync(path.join(runDir, name), text)
    return runDir
  }

  it("on plan.failed says the architect gave up and lists the plan errors", async () => {
    const runDir = runWith([line("run.started", {}), line("run.finished", { outcome: "plan.failed", error: "the architect could not produce a valid plan" })], {
      "plan.errors.json": JSON.stringify({ attempts: 3, errors: ['route "/kupovina" has no screen unit', "<b>bad</b>"], lastPlan: null }),
    })
    const html = readFileSync(await buildReport(runDir), "utf8")
    expect(html).toContain("arhitekta ni posle ponovnih pokušaja nije napravio plan")
    expect(html).toContain("route &quot;/kupovina&quot; has no screen unit")
    expect(html).toContain("&lt;b&gt;bad&lt;/b&gt;")
  })

  it("on an error shows the Conductor's message", () => {
    const runDir = runWith([line("run.finished", { outcome: "error", error: "the gatekeeper agent is not available yet (C, C2.4)" })])
    expect(toReportModel(loadRun(runDir)).stop).toEqual({
      outcome: "error",
      text: "Prolaz je stao zbog greške: the gatekeeper agent is not available yet (C, C2.4)",
      planErrors: [],
    })
  })

  it("shows nothing when the run finished normally or there is no run.finished line", async () => {
    expect(toReportModel(loadRun(runWith([line("run.finished", { outcome: "finished" })]))).stop).toBeNull()
    expect(toReportModel(loadRun(fixture)).stop).toBeNull()
    const html = readFileSync(await buildReport(runWith([line("run.finished", { outcome: "finished" })])), "utf8")
    expect(html).not.toContain("Ishod prolaza")
  })
})

describe("v2: timeline, speed-up, cost and rounds from run.jsonl", () => {
  const at = (s: number) => new Date(Date.UTC(2026, 9, 30, 10, 0, s)).toISOString()
  const line = (s: number, agent: string, event: string, data?: unknown, costUsd?: number) => ({ t: at(s), agent, event, data, costUsd })
  const loop = (agent: string, id: string, from: number, to: number) => [
    line(from, agent, "message_received.started", { loopId: id }),
    line(to, agent, "model.answer", { loopId: id, text: "ok" }),
  ]
  const model = toReportModel(loadRun(fixture))

  it("speed-up is the sum of all bars over the run window: 2 bars of 60 s in 80 s → 1,5×", () => {
    const log = [line(0, "conductor", "run.started"), ...loop("builder-1", "a", 10, 70), ...loop("tester-1", "b", 20, 80)]
    const timeline = buildTimeline(log)!
    expect(timeline.windowMs).toBe(80_000)
    expect(timeline.busyMs).toBe(120_000)
    expect(timeline.speedup).toBe(1.5)
    expect(speedupText(timeline.speedup!)).toBe("1,5×")
  })

  it("draws one row per agent, with bars from message_received.started to model.answer and the task as label", () => {
    const rows = model.timeline!.rows
    expect(rows.map((r) => [r.agent, r.kind])).toEqual([
      ["analyzer-1", "analyzer"],
      ["architect-1", "architect"],
      ["tester-1", "tester"],
      ["builder-1", "builder"],
      ["builder-2", "builder"],
    ])
    const builder = rows.find((r) => r.agent === "builder-1")!
    expect(builder.bars.map((b) => [b.label, b.durationMs])).toEqual([
      ["recipe-list · runda 1", 60_000],
      ["recipe-list · runda 2", 60_000],
    ])
    expect(rows.find((r) => r.agent === "architect-1")!.bars[0]!.label).toBe("plan")
    expect(rows.find((r) => r.agent === "tester-1")!.left).toEqual(["2026-10-30T10:05:00.000Z"])
    // 4 + 60 + 120 + 60 + 60 + 150 = 454 s of work in 450 s
    expect(speedupText(model.timeline!.speedup!)).toBe("1,0×")
  })

  it("keeps a loop with no model.answer as an open bar up to the end, and ignores answers it cannot pair", () => {
    const log = [line(0, "conductor", "run.started"), line(5, "builder-1", "message_received.started", { loopId: "x" }), line(9, "builder-1", "model.answer", { loopId: "other" }), line(30, "conductor", "run.finished")]
    const bar = buildTimeline(log)!.rows[0]!.bars[0]!
    expect(bar).toMatchObject({ open: true, durationMs: 25_000, end: at(30) })
  })

  it("sums cost per agent, sorted by cost, with calls, tokens and models", () => {
    expect(model.costs.rows.map((r) => [r.agent, Number(r.usd.toFixed(4)), r.calls])).toEqual([
      ["architect-1", 0.05, 1],
      ["builder-1", 0.022, 2],
      ["builder-2", 0.009, 1],
      ["tester-1", 0.008, 1],
      ["analyzer-1", 0.002, 1],
    ])
    expect(model.costs.rows.find((r) => r.agent === "analyzer-1")).toMatchObject({ inputTokens: 1200, cachedTokens: 3000, outputTokens: 400, models: ["claude-haiku-4-5"] })
    expect(usdText(model.costs.totalUsd)).toBe("$0.0910")
    expect(model.costs.calls).toBe(6)
  })

  it("lists builder rounds per unit with the model and the rounds the Gatekeeper rejected", () => {
    expect(model.rounds).toEqual([
      {
        unitId: "recipe-list",
        rounds: [
          { round: 1, model: "claude-haiku-4-5", failed: true },
          { round: 2, model: "claude-haiku-4-5", failed: false },
        ],
      },
      { unitId: "shopping-list", rounds: [{ round: 1, model: "claude-haiku-4-5", failed: false }] },
    ])
  })

  it("lists team changes (agents.rescaled, A14) with the counts before and after, by time", () => {
    expect(model.rescales.map((r) => [r.t.slice(11, 19), r.team, r.from])).toEqual([
      ["10:00:01", { analyzers: 1, builders: 0, testers: 0 }, null],
      ["10:01:20", { analyzers: 1, builders: 2, testers: 1 }, { builders: 0, testers: 0 }],
      ["10:05:50", { analyzers: 1, builders: 1, testers: 1 }, { builders: 2, testers: 1 }],
    ])
    expect(model.rescales[0]!.text).toBe("2986 tokens → 1 analyzer(s)")
  })

  it("finds the most agents of each kind running at once (agent.started / agent.stopped)", () => {
    expect(model.peak).toEqual({ analyzer: 1, architect: 1, tester: 1, builder: 2 })
    const at = (s: number) => new Date(Date.UTC(2026, 9, 30, 10, 0, s)).toISOString()
    const ev = (s: number, event: string, id: string) => ({ t: at(s), agent: "conductor", event, data: { id, kind: "builder" } })
    // builder-1 stops before builder-3 starts, so at most 2 run at once
    const log = [ev(0, "agent.started", "builder-1"), ev(1, "agent.started", "builder-2"), ev(2, "agent.stopped", "builder-1"), ev(3, "agent.started", "builder-3")]
    expect(peakTeam(log)).toEqual({ builder: 2 })
  })

  it("renders the Agents section: peak, counts as 'before → after' and the reason", async () => {
    const html = readFileSync(await buildReport(tempDir(true)), "utf8")
    expect(html).toContain("<h2>Agenti</h2>")
    expect(html).toContain("Najviše istovremeno: builderi <strong>2</strong>, testeri <strong>1</strong>, analizatori <strong>1</strong>, arhitekte <strong>1</strong>.")
    expect(html).toContain("0 → <strong>2</strong>")
    expect(html).toContain("2 → <strong>1</strong>")
    expect(html).toContain("5 ready + 0 busy → 2 builder(s) (max 4), 1 tester(s) (max 2)")
    // 10:01:20 is 1 min 20 s after the run started at 10:00:00
    expect(html).toContain(`<td class="num">1 min 20 s</td>`)
  })

  it("has no Agents section when the log has neither rescales nor started agents", async () => {
    const html = readFileSync(await buildReport(tempDir(false)), "utf8")
    expect(html).not.toContain("<h2>Agenti</h2>")
  })

  it("renders the timeline as inline SVG and the new sections", async () => {
    const html = readFileSync(await buildReport(tempDir(true)), "utf8")
    expect(html).toContain("<svg")
    expect(html).toContain("Ubrzanje <strong>1,0×</strong>")
    expect(html).toContain("<title>builder-1 · recipe-list · runda 2 · 1 min 0 s</title>")
    expect(html).toContain("2986 tokens → 1 analyzer(s)")
    expect(html).toContain("$0.0910")
    expect(html).toContain("Runde i modeli")
  })

  it("says so when there is no agent work or no cost", async () => {
    const html = readFileSync(await buildReport(tempDir(false)), "utf8")
    expect(html).toContain("nema vremenske ose")
    expect(html).toContain("Nema zapisa o trošku")
    expect(html).not.toContain("Runde i modeli")
  })
})

describe("tests with no per-test results", () => {
  const gate = (round: number, name: "scenarios" | "tsc", ok: boolean) => ({ unitId: "categories", round, gate: name, ok, message: "" })
  const outcomes = (gates: ReturnType<typeof gate>[]) => {
    const data = loadRun(fixture)
    data.results.categories = { unitId: "categories", status: "proven", rounds: 2, gates, scenarios: [], coverage: null }
    return toReportModel(data).screens.find((s) => s.unitId === "categories")!.scenarios.map((s) => s.outcome)
  }

  it("shows them as passing when the scenarios gate of the last round passed (gate 5 runs every test)", () => {
    expect(outcomes([gate(1, "scenarios", false), gate(2, "scenarios", true)])).toEqual(["pass"])
  })

  it("keeps them as not run when the last round did not pass the scenarios gate", () => {
    expect(outcomes([gate(1, "scenarios", true), gate(2, "tsc", false)])).toEqual(["not-run"])
    expect(outcomes([])).toEqual(["not-run"])
  })
})

describe("toReportModel", () => {
  const model = toReportModel(loadRun(fixture))
  const screen = (id: string) => model.screens.find((s) => s.unitId === id)!

  it("counts screens by status, shared units apart", () => {
    expect(model.counts).toEqual({ proven: 1, partial: 1, unproven: 1, failed: 1, "no-result": 1 })
    expect(model.shared.map((s) => [s.unitId, s.status])).toEqual([
      ["data", "promoted"],
      ["layout", "promoted"],
    ])
  })

  it("orders screens by wave, then id", () => {
    expect(model.screens.map((s) => s.unitId)).toEqual(["categories", "favorites", "recipe-detail", "recipe-list", "shopping-list"])
  })

  it("counts obligations from tests when there is no coverage, and marks tests that never ran", () => {
    expect(screen("categories").coverageText).toBe("1/2 obaveze, elementi nisu izmereni")
    expect(screen("categories").scenarios).toEqual([{ id: "cat-pick", obligation: "pick-category", outcome: "not-run" }])
  })

  it("keeps the failing step and error of a failed test", () => {
    const failing = screen("shopping-list").scenarios.find((s) => s.outcome === "fail")!
    expect(failing).toMatchObject({ id: "sl-mark", failedStep: 3 })
  })

  it("takes run times from run.jsonl", () => {
    expect(model.startedAt).toBe("2026-10-30T10:00:00.000Z")
    expect(model.durationText).toBe("7 min 30 s")
  })
})

describe("helpers", () => {
  it("escapeHtml escapes all five special characters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;")
  })

  it("describeDifference has a sentence for each kind", () => {
    expect(describeDifference({ kind: "hiddenBehind", element: { label: "Status" }, reveal: { text: "Filteri" } })).toBe("'Status' je na telefonu iza 'Filteri'")
    expect(describeDifference({ kind: "movedTo", what: "email kupca", toUnit: "order-detail" })).toBe("email kupca je prebačeno na ekran order-detail")
    expect(describeDifference({ kind: "notPortable", element: { role: "button", name: "Info" }, reason: "samo hover" })).toBe("button 'Info' nije prenosivo: samo hover")
  })
})

describe("theme note (D-027)", () => {
  it("says that looks come from the theme and the proof is about behavior, only when the plan has a theme", () => {
    const sentence = "Izgled (font, veličine, boje) se prenosi sa weba preko teme; dokaz je za ponašanje, ne za izgled."
    const data = loadRun(fixture)
    expect(renderReport(toReportModel(data))).not.toContain(sentence)
    const theme = { ...data.plan!.units.find((u) => u.id === "data")!, id: "theme", sources: [], writes: ["src/shared/theme/"], dependsOn: [] }
    data.plan = { ...data.plan!, units: [theme, ...data.plan!.units] }
    expect(renderReport(toReportModel(data))).toContain(sentence)
  })
})
