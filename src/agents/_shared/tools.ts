import type { Tool } from "@mozaik-ai/core"
import { z } from "zod"
import { toModelSchema } from "./schema"

type ToolSpec<S extends z.ZodObject> = {
  name: string
  description: string
  args: S
  invoke: (args: z.infer<S>) => Promise<string | object>
}

// Builds a Mozaik tool from a zod schema: the model gets the JSON Schema, and arguments are
// checked with zod before `invoke`. Invalid arguments go back to the model as a readable error.
export function defineTool<S extends z.ZodObject>(spec: ToolSpec<S>): Tool {
  return {
    type: "function",
    name: spec.name,
    description: spec.description,
    parameters: toModelSchema(spec.args),
    strict: true,
    invoke: async (raw: unknown) => {
      const parsed = spec.args.safeParse(raw)
      if (!parsed.success) return `Error: invalid arguments for ${spec.name}:\n${z.prettifyError(parsed.error)}`
      return spec.invoke(parsed.data)
    },
  }
}
