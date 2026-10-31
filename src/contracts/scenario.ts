import { z } from "zod"

// Test DSL (architecture.md §11). Every step is a strict object with exactly one key.

export const TapTargetSchema = z.union([
  z.strictObject({ role: z.string().min(1), name: z.string().min(1) }),
  z.strictObject({ text: z.string().min(1) }),
])
export type TapTarget = z.infer<typeof TapTargetSchema>

export const StepSchema = z.union([
  z.strictObject({ goto: z.string().min(1) }),
  z.strictObject({ tap: TapTargetSchema }),
  z.strictObject({ fill: z.strictObject({ label: z.string().min(1), value: z.string() }) }),
  // Type into the field and press Enter (D-017); on mobile this is TextInput onSubmitEditing.
  z.strictObject({ submit: z.strictObject({ label: z.string().min(1), value: z.string() }) }),
  z.strictObject({ expectVisible: z.strictObject({ text: z.string().min(1) }) }),
  z.strictObject({ expectNotVisible: z.strictObject({ text: z.string().min(1) }) }),
])
export type Step = z.infer<typeof StepSchema>

export const ScenarioSchema = z.strictObject({
  id: z.string().min(1),
  unitId: z.string().min(1),
  // Obligation.id from the plan.
  obligation: z.string().min(1),
  setup: z.array(StepSchema).optional(),
  apiFixture: z.string().min(1).optional(),
  steps: z.array(StepSchema).min(1),
})
export type Scenario = z.infer<typeof ScenarioSchema>
