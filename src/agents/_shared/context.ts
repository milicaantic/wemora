import { DeveloperMessageItem, ModelContext } from "@mozaik-ai/core"
import { registerContext, type TaskMeta } from "../../core/runner"

// A new context per task: agent memory grows in place, so it is never used for work (mozaik.md §4).
// Registering it lets the runner know which agent pays for the call and which mock replies to use.
export function freshContext(prompt: string, meta: TaskMeta): ModelContext {
  const context = ModelContext.create().addContextItem(DeveloperMessageItem.create(prompt))
  registerContext(context, meta)
  return context
}
