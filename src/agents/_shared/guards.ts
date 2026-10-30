import path from "node:path"
import {
  FunctionCallOutputItem,
  ModelMessageItem,
  type ExecutableTransition,
  type InterceptionHandler,
} from "@mozaik-ai/core"
import { WEMORA_ERROR } from "../../core/runner"

// Interception handlers run before every loop transition and must never throw: a throw there
// is an unhandled rejection inside Mozaik's runLoop.

const toPosix = (p: string) => path.posix.normalize(p.replace(/\\/g, "/"))

// Rejects writes outside the allowed paths before they happen (architecture.md invariant 6).
// One string is a folder. In a list, "screens/x/" allows everything below it and "app/_layout.tsx"
// only that file (D-015; the layout unit writes both, PD3).
export class OwnershipGuard implements InterceptionHandler {
  private readonly folders: string[]
  private readonly files: string[]

  constructor(
    allowed: string | readonly string[],
    private readonly toolNames: readonly string[] = ["write_file"],
  ) {
    const entries = typeof allowed === "string" ? [toPosix(allowed).replace(/\/?$/, "/")] : allowed.map(toPosix)
    this.folders = entries.filter((entry) => entry.endsWith("/"))
    this.files = entries.filter((entry) => !entry.endsWith("/"))
  }

  isSatisfiedBy(transition: ExecutableTransition): boolean {
    if (transition.nextStateId !== "function_call") return false
    const { call } = transition.input
    return this.toolNames.includes(call.name) && !this.allows(call.args)
  }

  async handle(transition: ExecutableTransition): Promise<ExecutableTransition> {
    if (transition.nextStateId !== "function_call") return transition
    const { call, inferenceInput } = transition.input
    const allowed = [...this.folders, ...this.files].join(", ")
    const rejection = FunctionCallOutputItem.create(call.callId, `Rejected: you may only write inside ${allowed}`)
    inferenceInput.context.addContextItems([call, rejection])
    return { nextStateId: "inference", input: inferenceInput }
  }

  private allows(args: string): boolean {
    try {
      const target = (JSON.parse(args) as { path?: unknown }).path
      if (typeof target !== "string" || target === "") return false
      const normalized = toPosix(target)
      const absolute = normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)
      if (absolute) return false
      return this.files.includes(normalized) || this.folders.some((folder) => normalized.startsWith(folder))
    } catch {
      return false
    }
  }
}

// Ends the loop at its next transition with a WEMORA_ERROR answer. Mozaik cannot stop a loop from
// outside, so this is how the Conductor applies timeouts (A13).
export class CancelGuard implements InterceptionHandler {
  private reason: string | null = null

  cancel(reason: string): void {
    this.reason ??= reason
  }

  isCancelled(): boolean {
    return this.reason !== null
  }

  isSatisfiedBy(transition: ExecutableTransition): boolean {
    return this.reason !== null && transition.nextStateId !== "model_message"
  }

  async handle(): Promise<ExecutableTransition> {
    const answer = ModelMessageItem.rehydrate({ text: `${WEMORA_ERROR} ${this.reason}` })
    return { nextStateId: "model_message", input: { answer } }
  }
}

// runLoop accepts a single interception handler; this runs several in order.
export function composeGuards(...guards: InterceptionHandler[]): InterceptionHandler {
  return {
    isSatisfiedBy: (transition) => guards.some((guard) => guard.isSatisfiedBy(transition)),
    handle: async (transition) => {
      let current = transition
      for (const guard of guards) {
        if (guard.isSatisfiedBy(current)) current = await guard.handle(current)
      }
      return current
    },
  }
}
