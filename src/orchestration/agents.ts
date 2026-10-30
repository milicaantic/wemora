import path from "node:path"
import { createAnalyzer } from "../agents/analyzer"
import { createArchitect } from "../agents/architect"
import { createBuilder } from "../agents/builder"
import { createTester } from "../agents/tester"
import type { ServeApp } from "../contracts"
import { board } from "../core/runtime"
import { serveApp } from "../gatekeeper"
import { blankApp, type BlankApp } from "../scenarios"
import type { AgentFactories } from "./conductor"

// Which real agent the CLI gives the Conductor for each role. An agent that is not merged yet is a
// stand-in that fails with a clear message; when its owner merges it, the stand-in becomes one import.

export type AgentWiring = {
  /** The running original web app (Q8); the tester cannot work without it. */
  originalUrl?: string
  /** Replaceable so tests do not run an Expo export. */
  serveApp?: ServeApp
}

export type RunAgents = {
  factories: AgentFactories
  /** Stops what the agents share for the whole run (the blank app server). */
  close(): Promise<void>
}

function notYet(role: string, owner: string, task: string): (id: string) => never {
  return (id) => {
    throw new Error(`the ${role} agent is not available yet (${owner}, ${task}); cannot start ${id}`)
  }
}

export function createAgentFactories(wiring: AgentWiring = {}): RunAgents {
  // One blank app per run: B's blankApp exports the scaffold placeholder on the first tester task.
  let blank: BlankApp | null = null

  const tester: AgentFactories["tester"] = (id) => {
    const { originalUrl } = wiring
    if (!originalUrl) {
      throw new Error(`the tester needs the running original app: pass --original-url <url> (Q8); cannot start ${id}`)
    }
    const shared = (blank ??= blankApp(path.join(board().config.runDir, "app"), wiring.serveApp ?? serveApp))
    return createTester(id, { originalUrl, blankUrl: () => shared.url() })
  }

  return {
    factories: {
      analyzer: createAnalyzer,
      architect: createArchitect,
      tester,
      builder: createBuilder,
      gatekeeper: notYet("gatekeeper", "C", "C2.4"),
    },
    close: async () => {
      await blank?.close()
      blank = null
    },
  }
}
