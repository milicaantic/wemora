import { createAnalyzer } from "../agents/analyzer"
import type { AgentFactories } from "./conductor"

// Which real agent the CLI gives the Conductor for each role. An agent that is not merged yet is a
// stand-in that fails with a clear message; when its owner merges it, the stand-in becomes one import.

function notYet(role: string, owner: string, task: string): (id: string) => never {
  return (id) => {
    throw new Error(`the ${role} agent is not available yet (${owner}, ${task}); cannot start ${id}`)
  }
}

export function createAgentFactories(): AgentFactories {
  return {
    analyzer: createAnalyzer,
    architect: notYet("architect", "D", "D14"),
    tester: notYet("tester", "B", "B8"),
    builder: notYet("builder", "C", "C2.1"),
    gatekeeper: notYet("gatekeeper", "C", "C2.4"),
  }
}
