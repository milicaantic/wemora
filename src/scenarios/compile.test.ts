import { describe, expect, it } from "vitest"
import type { IntentionalDifference, Step } from "../contracts"
import { compileSteps } from "./compile"

const allKinds: Step[] = [
  { goto: "/narudzbine" },
  { tap: { role: "button", name: "Sačuvaj" } },
  { tap: { text: "#1042" } },
  { fill: { label: "Pretraga", value: "Petar" } },
  { expectVisible: { text: "#1042" } },
  { expectNotVisible: { text: "#1043" } },
]

const filtersHidden: IntentionalDifference = {
  kind: "hiddenBehind",
  element: { label: "Status" },
  reveal: { role: "button", name: "Filteri" },
}

describe("compileSteps", () => {
  it("translates every step kind and keeps the index of its DSL step", () => {
    expect(compileSteps(allKinds, [])).toEqual({
      ok: true,
      actions: [
        { step: 0, kind: "goto", path: "/narudzbine" },
        { step: 1, kind: "tap", target: { by: "role", role: "button", name: "Sačuvaj" } },
        { step: 2, kind: "tap", target: { by: "text", text: "#1042" } },
        { step: 3, kind: "fill", target: { by: "label", label: "Pretraga" }, value: "Petar" },
        { step: 4, kind: "expectVisible", text: "#1042" },
        { step: 5, kind: "expectNotVisible", text: "#1043" },
      ],
    })
  })

  it("inserts one conditional reveal right before the step that uses a hidden element", () => {
    const steps: Step[] = [{ goto: "/narudzbine" }, { fill: { label: "Status", value: "Poslato" } }]
    expect(compileSteps(steps, [filtersHidden])).toEqual({
      ok: true,
      actions: [
        { step: 0, kind: "goto", path: "/narudzbine" },
        {
          step: 1,
          kind: "reveal",
          element: { by: "label", label: "Status" },
          reveal: { by: "role", role: "button", name: "Filteri" },
        },
        { step: 1, kind: "fill", target: { by: "label", label: "Status" }, value: "Poslato" },
      ],
    })
  })

  it("reveals before expectVisible but not before expectNotVisible", () => {
    const hiddenText: IntentionalDifference = { ...filtersHidden, element: { text: "Status" } }
    const steps: Step[] = [{ expectVisible: { text: "Status" } }, { expectNotVisible: { text: "Status" } }]
    const result = compileSteps(steps, [hiddenText])
    expect(result.ok && result.actions.map((a) => a.kind)).toEqual(["reveal", "expectVisible", "expectNotVisible"])
  })

  it("matches by name across target kinds, but not across different roles", () => {
    const hiddenButton: IntentionalDifference = { ...filtersHidden, element: { role: "button", name: "Izvezi" } }
    const kinds = (steps: Step[]) => {
      const result = compileSteps(steps, [hiddenButton])
      return result.ok && result.actions.map((a) => a.kind)
    }
    expect(kinds([{ tap: { text: "Izvezi" } }])).toEqual(["reveal", "tap"])
    expect(kinds([{ tap: { role: "link", name: "Izvezi" } }])).toEqual(["tap"])
  })

  it("translates submit like fill, with a reveal before it and notPortable checked (D-017)", () => {
    const hiddenField: IntentionalDifference = { ...filtersHidden, element: { label: "New Todo Input" } }
    const steps: Step[] = [{ submit: { label: "New Todo Input", value: "Buy milk" } }]
    expect(compileSteps(steps, [hiddenField])).toEqual({
      ok: true,
      actions: [
        { step: 0, kind: "reveal", element: { by: "label", label: "New Todo Input" }, reveal: { by: "role", role: "button", name: "Filteri" } },
        { step: 0, kind: "submit", target: { by: "label", label: "New Todo Input" }, value: "Buy milk" },
      ],
    })
    const notPortable: IntentionalDifference = { kind: "notPortable", element: { role: "textbox", name: "New Todo Input" }, reason: "x" }
    expect(compileSteps(steps, [notPortable]).ok).toBe(false)
  })

  it("inserts nothing without differences (the original web app)", () => {
    const result = compileSteps([{ fill: { label: "Status", value: "Poslato" } }], [])
    expect(result.ok && result.actions).toHaveLength(1)
  })

  it("rejects a step that uses a notPortable element and names it", () => {
    const hover: IntentionalDifference = { kind: "notPortable", element: { role: "button", name: "Info" }, reason: "hover only" }
    const steps: Step[] = [{ goto: "/" }, { tap: { role: "button", name: "Info" } }]
    expect(compileSteps(steps, [hover])).toEqual({
      ok: false,
      step: 1,
      error: 'step uses "Info", which does not exist on mobile (notPortable: hover only)',
    })
  })
})
