import { describe, expect, it } from "vitest"
import type { ServeApp } from "../contracts"
import { blankApp } from "./blank"

// A fake serveApp: counts exports and closes, optionally fails the first export.
function fakeServe(failFirst = false) {
  const calls = { serve: 0, close: 0 }
  const serve: ServeApp = async (appDir) => {
    calls.serve++
    if (failFirst && calls.serve === 1) throw new Error("export failed")
    return { url: `http://blank.test/${calls.serve}?dir=${appDir}`, close: async () => void calls.close++ }
  }
  return { serve, calls }
}

describe("blankApp", () => {
  it("exports the app once, on the first url() call, and reuses that URL", async () => {
    const { serve, calls } = fakeServe()
    const blank = blankApp("out/run/app", serve)
    expect(calls.serve).toBe(0)
    const urls = await Promise.all([blank.url(), blank.url(), blank.url()])
    expect(new Set(urls)).toEqual(new Set(["http://blank.test/1?dir=out/run/app"]))
    expect(calls.serve).toBe(1)
  })

  it("tries the export again after a failure", async () => {
    const { serve, calls } = fakeServe(true)
    const blank = blankApp("app", serve)
    await expect(blank.url()).rejects.toThrow("export failed")
    expect(await blank.url()).toBe("http://blank.test/2?dir=app")
    expect(calls.serve).toBe(2)
  })

  it("closes the served app once, and does nothing when it was never served", async () => {
    const { serve, calls } = fakeServe()
    const blank = blankApp("app", serve)
    await blank.close()
    expect(calls.close).toBe(0)
    await blank.url()
    await blank.close()
    await blank.close()
    expect(calls.close).toBe(1)
  })
})
