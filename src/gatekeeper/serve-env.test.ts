import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import { exportEnv } from "./serve"

// Adresa mock-api-ja za web export mobilne aplikacije (A → C, G3: bez nje ekrani ostaju na „Učitavanje…“).
const app = mkdtempSync(join(tmpdir(), "wemora-env-"))
writeFileSync(join(app, ".env.example"), "# komentar\nEXPO_PUBLIC_API_URL=http://localhost:3000\n")
const empty = mkdtempSync(join(tmpdir(), "wemora-env-empty-"))
afterAll(() => {
  rmSync(app, { recursive: true, force: true })
  rmSync(empty, { recursive: true, force: true })
})

describe("exportEnv", () => {
  it("zadata EXPO_PUBLIC_API_URL ostaje kakva jeste", () => {
    expect(exportEnv(app, { EXPO_PUBLIC_API_URL: "http://api:9000", VITE_API_URL: "http://drugi" }).EXPO_PUBLIC_API_URL).toBe("http://api:9000")
  })

  it("bez nje: ista adresa kao original (VITE_API_URL)", () => {
    expect(exportEnv(app, { VITE_API_URL: "http://localhost:4100" }).EXPO_PUBLIC_API_URL).toBe("http://localhost:4100")
  })

  it("bez obe: vrednost iz app/.env.example", () => {
    expect(exportEnv(app, {}).EXPO_PUBLIC_API_URL).toBe("http://localhost:3000")
  })

  it("bez .env.example: ništa se ne izmišlja", () => {
    expect(exportEnv(empty, {}).EXPO_PUBLIC_API_URL).toBeUndefined()
  })

  it("uvek isključuje interaktivni režim i telemetriju Expo-a", () => {
    expect(exportEnv(app, {})).toMatchObject({ CI: "1", EXPO_NO_TELEMETRY: "1" })
  })
})
