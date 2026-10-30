import { fileURLToPath } from "node:url"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { ServedApp } from "../contracts"
import { serveStatic } from "./serve"

let app: ServedApp

beforeAll(async () => {
  app = await serveStatic(fileURLToPath(new URL("./mocks/static", import.meta.url)))
})

afterAll(async () => {
  await app.close()
})

describe("serveStatic", () => {
  it("serves a file with its content type", async () => {
    const res = await fetch(`${app.url}/lista.html`)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/html")
    expect(await res.text()).toContain("<title>Lista</title>")
  })

  it("falls back to index.html for app routes", async () => {
    const res = await fetch(`${app.url}/narudzbine/1042`)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain("<title>Narudžbine</title>")
  })

  it("returns 404 for a missing asset", async () => {
    expect((await fetch(`${app.url}/missing.js`)).status).toBe(404)
  })

  it("does not serve files outside the folder", async () => {
    const res = await fetch(`${app.url}/%2e%2e/%2e%2e/run.ts`)
    expect([403, 404]).toContain(res.status)
    expect(await res.text()).not.toContain("createRunScenarios")
  })
})
