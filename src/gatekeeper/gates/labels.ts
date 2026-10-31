// Kapija 4: svaka labela (fill i submit), naziv dugmeta i tekst iz testova jedinice postoji u kodu nacrta.
//
// Proverava se samo ono što postoji doslovno u originalnom web kodu jedinice.
// Ostalo (npr. "Sarma", "Kupljeno: 0 od 1") dolazi iz podataka i ne može da bude u kodu.
// Traži se u nacrtu i u već promovisanim zajedničkim jedinicama (`app/src/shared/`).
import { readFileSync } from "node:fs"
import { join } from "node:path"
import ts from "typescript"
import type { Scenario } from "../../contracts"
import { codeFiles, parseFile, walk } from "./source"
import type { Gate } from "./types"

type Need =
  | { kind: "label"; value: string; test: string }
  | { kind: "role"; role: string; value: string; test: string }
  | { kind: "text"; value: string; test: string }

type Found = {
  labels: Set<string>
  roles: { role: string; names: string[] }[]
  texts: string[]
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim()

function needsOf(tests: Scenario[]): Need[] {
  const out = new Map<string, Need>()
  for (const t of tests) {
    for (const step of [...(t.setup ?? []), ...t.steps]) {
      let need: Need | undefined
      if ("fill" in step) need = { kind: "label", value: step.fill.label, test: t.id }
      else if ("submit" in step) need = { kind: "label", value: step.submit.label, test: t.id }
      else if ("tap" in step) {
        const tap = step.tap
        need = "role" in tap
          ? { kind: "role", role: tap.role, value: tap.name, test: t.id }
          : { kind: "text", value: tap.text, test: t.id }
      }
      else if ("expectVisible" in step) need = { kind: "text", value: step.expectVisible.text, test: t.id }
      if (need) out.set(`${need.kind}|${"role" in need ? need.role : ""}|${need.value}`, need)
    }
  }
  return [...out.values()]
}

/** Vrednost JSX atributa ako je konstantan string: a="x", a={"x"}, a={`x`}. */
function literalAttr(attr: ts.JsxAttribute): string | undefined {
  const init = attr.initializer
  if (!init) return undefined
  if (ts.isStringLiteral(init)) return init.text
  if (ts.isJsxExpression(init) && init.expression) {
    const e = init.expression
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text
  }
  return undefined
}

function attrs(el: ts.JsxOpeningElement | ts.JsxSelfClosingElement): Map<string, string | undefined> {
  const out = new Map<string, string | undefined>()
  for (const p of el.attributes.properties) {
    if (ts.isJsxAttribute(p)) out.set(p.name.getText(), literalAttr(p))
  }
  return out
}

/** Da li je čvor deo vrednosti nekog JSX atributa (style, role, onPress…), a ne vidljiv tekst. */
function inAttribute(node: ts.Node, stop: ts.Node): boolean {
  for (let p = node.parent; p && p !== stop; p = p.parent) if (ts.isJsxAttribute(p)) return true
  return false
}

/**
 * Konstantni tekstovi unutar elementa: JSX tekst i svi stringovi u {…}, i u izrazima
 * (npr. `{f === "all" ? "All" : "Active"}`), osim vrednosti atributa.
 */
function textPieces(node: ts.Node): string[] {
  const out: string[] = []
  walk(node, (n) => {
    if (ts.isJsxText(n) && norm(n.text)) out.push(norm(n.text))
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && norm(n.text) && !inAttribute(n, node)) out.push(norm(n.text))
  })
  return out
}

function collect(files: string[]): Found {
  const found: Found = { labels: new Set(), roles: [], texts: [] }
  for (const file of files) {
    const sf = parseFile(file)
    walk(sf, (n) => {
      if (ts.isJsxText(n) && norm(n.text)) found.texts.push(norm(n.text))
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) found.texts.push(norm(n.text))
      if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) found.texts.push(norm(n.text))

      const opening = ts.isJsxElement(n) ? n.openingElement : ts.isJsxSelfClosingElement(n) ? n : undefined
      if (!opening) return
      const a = attrs(opening)
      const label = a.get("accessibilityLabel") ?? a.get("aria-label")
      if (label) found.labels.add(norm(label))
      const tag = opening.tagName.getText(sf)
      const role = a.get("role") ?? a.get("accessibilityRole") ?? (tag === "Link" ? "link" : undefined)
      if (role) {
        const pieces = ts.isJsxElement(n) ? textPieces(n) : []
        found.roles.push({ role, names: [...(label ? [norm(label)] : []), norm(pieces.join(" ")), ...pieces] })
      }
    })
  }
  return found
}

function missing(need: Need, found: Found): string | undefined {
  const v = norm(need.value)
  const where = `(test "${need.test}")`
  if (need.kind === "label") {
    if (found.labels.has(v)) return undefined
    return `nema elementa sa accessibilityLabel "${need.value}"; polje mora da ima istu labelu kao na webu ${where}`
  }
  if (need.kind === "role") {
    if (found.roles.some((r) => r.role === need.role && r.names.includes(v))) return undefined
    const textExists = found.texts.some((t) => t.includes(v)) || found.labels.has(v)
    if (textExists) {
      return `postoji tekst "${need.value}", ali nijedan element sa role="${need.role}" nema taj naziv; dodaj role="${need.role}" na element (npr. <Pressable role="${need.role}">) ${where}`
    }
    return `nema elementa sa role="${need.role}" i nazivom "${need.value}"; tekst mora da bude isti kao na webu ${where}`
  }
  if (found.texts.some((t) => t.includes(v))) return undefined
  return `tekst "${need.value}" ne postoji u kodu; mora da bude isti kao na webu ${where}`
}

export const labelsGate: Gate = async ({ draftDir, appDir, tests, originalFiles }) => {
  const original = norm(originalFiles.map((f) => readFileSync(f, "utf8")).join("\n"))
  const all = needsOf(tests)
  // Bez originala proveravamo sve (strožije, nikad blaže).
  const needs = originalFiles.length === 0 ? all : all.filter((n) => original.includes(norm(n.value)))
  const skipped = all.length - needs.length

  const found = collect([...codeFiles(draftDir), ...codeFiles(join(appDir, "src/shared"))])
  const errors = needs.map((n) => missing(n, found)).filter((e): e is string => e !== undefined)
  if (errors.length > 0) {
    return { gate: "labels", ok: false, message: `Fale labele ili tekstovi koje testovi traže:\n${errors.join("\n")}` }
  }
  return {
    gate: "labels",
    ok: true,
    message: `Pronađeno ${needs.length} labela/tekstova; preskočeno ${skipped} (dolaze iz podataka, nema ih u originalu).`,
  }
}
