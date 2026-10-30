// Kapija 2: nacrt ne sme da koristi ono što postoji samo u browseru.
import ts from "typescript"
import { codeFiles, lineOf, parseFile, shown, walk } from "./source"
import type { Gate } from "./types"

const FORBIDDEN_MODULES = ["react-dom", "react-router-dom", "react-router"]
const FORBIDDEN_GLOBALS: Record<string, string> = {
  window: "nema `window` na telefonu; za dimenzije koristi useWindowDimensions iz react-native",
  document: "nema `document` na telefonu; ne diraj DOM, koristi stanje (useState)",
  localStorage: "nema `localStorage` na telefonu; koristi zajednički store iz src/shared/",
}
// Svaki JSX tag malim slovom je HTML element, a u React Native ih nema.
const RN_INSTEAD: Record<string, string> = {
  div: "<View>",
  span: "<Text>",
  p: "<Text>",
  h1: "<Text>",
  h2: "<Text>",
  h3: "<Text>",
  label: "<Text>",
  button: '<Pressable role="button"> sa <Text> unutra',
  a: "<Link> iz expo-router",
  input: "<TextInput accessibilityLabel=…>",
  textarea: "<TextInput multiline accessibilityLabel=…>",
  img: "<Image>",
  ul: '<View role="list">',
  ol: '<View role="list">',
  li: '<View role="listitem">',
  form: "<View>",
  table: "listu kartica (<View>)",
}

function isForbiddenModule(spec: string): boolean {
  return FORBIDDEN_MODULES.some((m) => spec === m || spec.startsWith(`${m}/`))
}

/** Da li je identifikator stvarno upotrebljen kao globalna promenljiva (a ne `x.window` ili `{ window: 1 }`). */
function isGlobalUse(id: ts.Identifier): boolean {
  const p = id.parent
  if (ts.isPropertyAccessExpression(p) && p.name === id) return false
  if ((ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p) || ts.isPropertySignature(p)) && p.name === id) return false
  if (ts.isJsxAttribute(p)) return false
  if ((ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isBindingElement(p)) && p.name === id) return false
  if (ts.isImportSpecifier(p) || ts.isExportSpecifier(p)) return false
  return true
}

export const forbiddenApisGate: Gate = async ({ draftDir }) => {
  const errors: string[] = []
  for (const file of codeFiles(draftDir)) {
    const sf = parseFile(file)
    const at = (node: ts.Node) => `${shown(draftDir, file)}:${lineOf(sf, node)}`
    walk(sf, (node) => {
      // import … from "react-dom" / export … from "react-dom"
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
        const spec = (node.moduleSpecifier as ts.StringLiteral).text
        if (isForbiddenModule(spec)) errors.push(`${at(node)}: uvoz "${spec}" ne radi na telefonu (za navigaciju koristi expo-router).`)
      }
      // require("react-dom") / import("react-dom")
      if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]!)) {
        const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require"
        const isDynamic = node.expression.kind === ts.SyntaxKind.ImportKeyword
        const spec = (node.arguments[0] as ts.StringLiteral).text
        if ((isRequire || isDynamic) && isForbiddenModule(spec)) {
          errors.push(`${at(node)}: uvoz "${spec}" ne radi na telefonu (za navigaciju koristi expo-router).`)
        }
      }
      // <div>, <span>, …
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText(sf)
        if (/^[a-z][a-z0-9]*$/.test(tag)) {
          const instead = RN_INSTEAD[tag]
          errors.push(`${at(node)}: <${tag}> ne postoji u React Native${instead ? `, koristi ${instead}` : ""}.`)
        }
      }
      // window, document, localStorage
      if (ts.isIdentifier(node) && node.text in FORBIDDEN_GLOBALS && isGlobalUse(node)) {
        errors.push(`${at(node)}: ${FORBIDDEN_GLOBALS[node.text]}.`)
      }
    })
  }
  if (errors.length > 0) {
    return { gate: "forbiddenApis", ok: false, message: `Nacrt koristi nešto što postoji samo u browseru:\n${errors.join("\n")}` }
  }
  return { gate: "forbiddenApis", ok: true, message: "Nema web-only API-ja." }
}
