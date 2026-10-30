import { z } from "zod"

// Anthropic's strict mode (structured output and strict tools) rejects some JSON Schema keywords that
// zod emits, e.g. minLength, minimum/maximum from .int(), oneOf from discriminated unions and
// minItems above 1. We send a looser schema and still validate the reply with the full zod schema.

const DROPPED = new Set([
  "$schema",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "maxItems",
  "minProperties",
  "maxProperties",
  "propertyNames",
])

// Keys whose values are maps of name → schema, so their own keys are names, not keywords.
const SCHEMA_MAPS = new Set(["properties", "$defs", "definitions"])

export function toModelSchema(schema: z.ZodType): Record<string, unknown> {
  return clean(z.toJSONSchema(schema)) as Record<string, unknown>
}

function clean(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(clean)
  if (node === null || typeof node !== "object") return node
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node)) {
    if (DROPPED.has(key)) continue
    if (key === "minItems" && typeof value === "number" && value > 1) continue
    if (SCHEMA_MAPS.has(key) && value !== null && typeof value === "object") {
      out[key] = Object.fromEntries(Object.entries(value).map(([name, schema]) => [name, clean(schema)]))
      continue
    }
    out[key === "oneOf" ? "anyOf" : key] = clean(value)
  }
  return out
}
