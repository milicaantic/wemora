import ts from "typescript"

// Web-only things a mobile port has to replace. Names are stable strings; analyzers and the report read them.
const GLOBALS = new Set([
  "localStorage",
  "sessionStorage",
  "window",
  "document",
  "navigator",
  "fetch",
  "XMLHttpRequest",
  "matchMedia",
])

const JSX_ATTRIBUTES: Record<string, string> = {
  onMouseEnter: "hover",
  onMouseOver: "hover",
  onMouseLeave: "hover",
  onMouseOut: "hover",
  onContextMenu: "contextmenu",
  onKeyDown: "keyboard",
  onKeyUp: "keyboard",
  onKeyPress: "keyboard",
  onDoubleClick: "doubleclick",
  draggable: "drag",
  onDrag: "drag",
  onDragStart: "drag",
  onDrop: "drag",
}

/** True when the identifier is a value reference, not a property name, key or declaration. */
function isValueReference(id: ts.Identifier): boolean {
  const parent = id.parent
  if (ts.isPropertyAccessExpression(parent) && parent.name === id) return false
  if ((ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent) || ts.isMethodDeclaration(parent)) && parent.name === id) return false
  if (ts.isImportSpecifier(parent) || ts.isImportClause(parent) || ts.isNamespaceImport(parent)) return false
  if ((ts.isVariableDeclaration(parent) || ts.isParameter(parent) || ts.isFunctionDeclaration(parent)) && parent.name === id) return false
  if (ts.isJsxAttribute(parent)) return false
  return true
}

/** Web APIs used in one file, sorted, without duplicates. */
export function findWebApis(sourceFile: ts.SourceFile): string[] {
  const found = new Set<string>()
  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && GLOBALS.has(node.text) && isValueReference(node)) found.add(node.text)
    if (ts.isPropertyAccessExpression(node) && node.name.text === "addEventListener") found.add("addEventListener")
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText()
      if (JSX_ATTRIBUTES[name]) found.add(JSX_ATTRIBUTES[name])
      // A `title` on a DOM element is a hover tooltip.
      const owner = node.parent.parent
      if (name === "title" && (ts.isJsxOpeningElement(owner) || ts.isJsxSelfClosingElement(owner)) && /^[a-z]/.test(owner.tagName.getText())) {
        found.add("title-tooltip")
      }
    }
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText() === "table") found.add("table")
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return [...found].sort()
}
