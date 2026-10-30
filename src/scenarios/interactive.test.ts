import { fileURLToPath } from "node:url"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { ServedApp } from "../contracts"
import { extractInteractive, interactiveElements, parseAriaSnapshot } from "./interactive"
import { serveStatic } from "./serve"

let app: ServedApp

beforeAll(async () => {
  app = await serveStatic(fileURLToPath(new URL("./mocks/static", import.meta.url)))
})

afterAll(async () => {
  await app.close()
})

describe("parseAriaSnapshot", () => {
  it("reads nesting, single-quoted entries and escaped quotes", () => {
    const yaml = [
      "- main:",
      "  - searchbox \"Pretraga\"",
      "  - 'button \"Dodaj u omiljene: Pileća supa\"': ☆",
      "  - link \"Paradajz \\\"čorba\\\"\":",
      "    - /url: /recepti/2",
      "  - button \"Obriši kupljene\" [disabled]",
      "  - button",
      "  - text: Hleb",
    ].join("\n")
    expect(parseAriaSnapshot(yaml)).toEqual([
      {
        role: "main",
        name: null,
        children: [
          { role: "searchbox", name: "Pretraga", children: [] },
          { role: "button", name: "Dodaj u omiljene: Pileća supa", children: [] },
          { role: "link", name: 'Paradajz "čorba"', children: [] },
          { role: "button", name: "Obriši kupljene", children: [] },
          { role: "button", name: null, children: [] },
          { role: "text", name: null, children: [] },
        ],
      },
    ])
  })

  it("keeps only the first row with controls among repeated rows", () => {
    const row = (name: string) => ({ role: "row", name, children: [{ role: "link", name, children: [] }] })
    const header = { role: "row", name: "Naziv", children: [{ role: "columnheader", name: "Naziv", children: [] }] }
    expect(interactiveElements([{ role: "rowgroup", name: null, children: [header, row("A"), row("B")] }])).toEqual([
      { role: "link", name: "A" },
    ])
  })
})

describe("extractInteractive", { timeout: 60_000 }, () => {
  it("lists the controls of main in document order: first table row only, no hidden, unnamed or duplicate ones", async () => {
    expect(await extractInteractive(app.url, "/elementi.html")).toEqual([
      { role: "searchbox", name: "Pretraga" },
      { role: "button", name: "Sve kategorije" },
      { role: "button", name: "Supe" },
      { role: "link", name: "Pileća supa" },
      { role: "button", name: "Dodaj u omiljene: Pileća supa" },
      { role: "button", name: "Sortiraj po vremenu" },
      { role: "checkbox", name: "Hleb" },
      { role: "button", name: "Obriši kupljene" },
    ])
  })

  it("reads the whole page when there is no main landmark (hidden 'Filteri' is left out on desktop)", async () => {
    expect(await extractInteractive(app.url, "/")).toEqual([
      { role: "textbox", name: "Pretraga" },
      { role: "textbox", name: "Status" },
      { role: "button", name: "Sačuvaj" },
      { role: "button", name: "Dodaj u omiljene" },
    ])
  })

  it("gives the same result every time", async () => {
    const first = await extractInteractive(app.url, "/elementi.html")
    expect(await extractInteractive(app.url, "/elementi.html")).toEqual(first)
  })
})
