import { z } from "zod"
import { TapTargetSchema } from "./scenario"

// Intentional differences between web and mobile (architecture.md §8).

export const ElementRefSchema = z.union([TapTargetSchema, z.strictObject({ label: z.string().min(1) })])
export type ElementRef = z.infer<typeof ElementRefSchema>

// The mobile test translator inserts `tap reveal` before the step that uses `element`.
export const HiddenBehindSchema = z.strictObject({
  kind: z.literal("hiddenBehind"),
  element: ElementRefSchema,
  reveal: TapTargetSchema,
})
export type HiddenBehind = z.infer<typeof HiddenBehindSchema>

export const MovedToSchema = z.strictObject({
  kind: z.literal("movedTo"),
  what: z.string().min(1),
  toUnit: z.string().min(1),
})
export type MovedTo = z.infer<typeof MovedToSchema>

export const NotPortableSchema = z.strictObject({
  kind: z.literal("notPortable"),
  element: z.strictObject({ role: z.string().min(1), name: z.string().min(1) }),
  reason: z.string().min(1),
})
export type NotPortable = z.infer<typeof NotPortableSchema>

export const IntentionalDifferenceSchema = z.discriminatedUnion("kind", [
  HiddenBehindSchema,
  MovedToSchema,
  NotPortableSchema,
])
export type IntentionalDifference = z.infer<typeof IntentionalDifferenceSchema>
