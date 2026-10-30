import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import type { ServeApp } from "../contracts"
import { initializeRuntime } from "../core/runtime"
import { createInitialState } from "../core/state"
import { createAgentFactories } from "./agents"

const runDir = mkdtempSync(path.join(tmpdir(), "agents-"))

beforeAll(() => {
  initializeRuntime({
    state: createInitialState("agents-test", { webDir: "w", runDir, maxBuilders: 1, maxTesters: 1, budgetUsd: 1, mock: true }),
  })
})
afterAll(() => rmSync(runDir, { recursive: true, force: true }))

describe("createAgentFactories", () => {
  it("wires D's analyzer and architect, and C's builder", () => {
    const { factories } = createAgentFactories()
    expect(factories.analyzer("analyzer-1")).toMatchObject({ id: "analyzer-1", kind: "analyzer" })
    expect(factories.architect("architect-1")).toMatchObject({ id: "architect-1", kind: "architect" })
    expect(factories.builder("builder-1")).toMatchObject({ id: "builder-1", kind: "builder" })
  })

  it("explains that the tester needs --original-url when it is missing", () => {
    const { factories } = createAgentFactories()
    expect(() => factories.tester("tester-1")).toThrow("pass --original-url <url> (Q8)")
  })

  it("wires B's tester without serving the blank app until a task asks for it", async () => {
    const serveApp = vi.fn<ServeApp>(async () => ({ url: "http://blank", close: async () => {} }))
    const { factories, close } = createAgentFactories({ originalUrl: "http://localhost:7002", serveApp })

    const tester = factories.tester("tester-1")
    factories.tester("tester-2")

    expect(tester).toMatchObject({ id: "tester-1", kind: "tester" })
    expect(serveApp).not.toHaveBeenCalled()
    await expect(close()).resolves.toBeUndefined()
  })

  it("wires C's Gatekeeper participant under the name the Conductor gives it", () => {
    const { factories } = createAgentFactories()
    expect(factories.gatekeeper("gatekeeper-1").getManifest()).toMatchObject({ name: "gatekeeper-1", role: "human" })
  })
})
