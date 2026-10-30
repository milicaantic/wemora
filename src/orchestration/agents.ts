import path from "node:path"
import { createAnalyzer } from "../agents/analyzer"
import { createArchitect } from "../agents/architect"
import { createBuilder } from "../agents/builder"
import { createGatekeeper } from "../agents/gatekeeperParticipant"
import { createTester } from "../agents/tester"
import type { ServeApp } from "../contracts"
import { board } from "../core/runtime"
import { serveApp } from "../gatekeeper"
import { blankApp, type BlankApp } from "../scenarios"
import type { AgentFactories } from "./conductor"

// Which real agent the CLI gives the Conductor for each role, and what the agents share for one run.

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
      gatekeeper: (id) => createGatekeeper(id),
    },
    close: async () => {
      await blank?.close()
      blank = null
    },
  }
}
