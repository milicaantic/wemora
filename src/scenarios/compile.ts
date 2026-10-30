import type { ElementRef, IntentionalDifference, NotPortable, Step, TapTarget } from "../contracts"

// Translates DSL steps (architecture.md §11) into a plain list of actions. run.ts executes them on a Playwright page.

export type Target =
  | { by: "role"; role: string; name: string }
  | { by: "text"; text: string }
  | { by: "label"; label: string }

export type Action = { step: number } & (
  | { kind: "goto"; path: string }
  | { kind: "tap"; target: Target }
  | { kind: "fill"; target: Target; value: string }
  | { kind: "expectVisible"; text: string }
  | { kind: "expectNotVisible"; text: string }
  // Inserted for a hiddenBehind difference: tap `reveal` only when `element` is not visible yet,
  // so a second reveal of the same element does not hide it again.
  | { kind: "reveal"; element: Target; reveal: Target }
)

export type CompileResult = { ok: true; actions: Action[] } | { ok: false; step: number; error: string }

/** `step` in every action is the index of the DSL step it came from. Pass no differences for the original web app. */
export function compileSteps(steps: Step[], differences: IntentionalDifference[]): CompileResult {
  const actions: Action[] = []
  for (const [step, s] of steps.entries()) {
    const acted = actedOn(s)
    const blocked = acted && differences.find((d): d is NotPortable => d.kind === "notPortable" && sameElement(acted, toTarget(d.element)))
    if (blocked) {
      return { ok: false, step, error: `step uses "${blocked.element.name}", which does not exist on mobile (notPortable: ${blocked.reason})` }
    }

    const shown = acted ?? ("expectVisible" in s ? toTarget({ text: s.expectVisible.text }) : null)
    for (const d of differences) {
      if (d.kind === "hiddenBehind" && shown && sameElement(shown, toTarget(d.element))) {
        actions.push({ step, kind: "reveal", element: toTarget(d.element), reveal: toTarget(d.reveal) })
      }
    }
    actions.push(toAction(s, step))
  }
  return { ok: true, actions }
}

export function describeAction(action: Action): string {
  switch (action.kind) {
    case "goto":
      return `goto ${action.path}`
    case "tap":
      return `tap ${describeTarget(action.target)}`
    case "fill":
      return `fill ${describeTarget(action.target)}`
    case "expectVisible":
      return `expectVisible "${action.text}"`
    case "expectNotVisible":
      return `expectNotVisible "${action.text}"`
    case "reveal":
      return `reveal ${describeTarget(action.element)} by tapping ${describeTarget(action.reveal)}`
  }
}

export function describeTarget(target: Target): string {
  if (target.by === "role") return `${target.role} "${target.name}"`
  if (target.by === "text") return `text "${target.text}"`
  return `field labelled "${target.label}"`
}

function toAction(s: Step, step: number): Action {
  if ("goto" in s) return { step, kind: "goto", path: s.goto }
  if ("tap" in s) return { step, kind: "tap", target: toTarget(s.tap) }
  if ("fill" in s) return { step, kind: "fill", target: toTarget({ label: s.fill.label }), value: s.fill.value }
  if ("expectVisible" in s) return { step, kind: "expectVisible", text: s.expectVisible.text }
  return { step, kind: "expectNotVisible", text: s.expectNotVisible.text }
}

// The element a step interacts with. Expectations only read the screen, so they never hit notPortable.
function actedOn(s: Step): Target | null {
  if ("tap" in s) return toTarget(s.tap)
  if ("fill" in s) return toTarget({ label: s.fill.label })
  return null
}

function toTarget(ref: ElementRef | TapTarget): Target {
  if ("role" in ref) return { by: "role", role: ref.role, name: ref.name }
  if ("text" in ref) return { by: "text", text: ref.text }
  return { by: "label", label: ref.label }
}

// Same accessible name; roles are compared only when both sides name one.
function sameElement(a: Target, b: Target): boolean {
  if (a.by === "role" && b.by === "role" && a.role !== b.role) return false
  return nameOf(a) === nameOf(b)
}

function nameOf(target: Target): string {
  if (target.by === "role") return target.name
  return target.by === "text" ? target.text : target.label
}
