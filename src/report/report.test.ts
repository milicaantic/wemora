import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, describe, expect, it } from "vitest"
import { buildReport } from "./index"
import { escapeHtml } from "./html"
import { loadRun } from "./load"
import { describeDifference, toReportModel } from "./model"

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
    expect(html).toContain("run.jsonl: 1 neispravna linija je preskočena")
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
