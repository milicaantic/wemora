// Kapija 1: da li je kod nacrta sintaksno ispravan.
// Sintaksna greška u jednom ekranu obara celu aplikaciju (D-005), pa je ovo prva provera.
import { readFileSync } from "node:fs"
import ts from "typescript"
import { codeFiles, shown } from "./source"
import type { Gate } from "./types"

export const parseGate: Gate = async ({ draftDir }) => {
  const files = codeFiles(draftDir)
  if (files.length === 0) {
    return { gate: "parse", ok: false, message: "Nacrt je prazan: nema nijednog .ts/.tsx fajla." }
  }
  const errors: string[] = []
  for (const file of files) {
    const { diagnostics = [] } = ts.transpileModule(readFileSync(file, "utf8"), {
      fileName: file,
      reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.Latest },
    })
    for (const d of diagnostics) {
      const line = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : 0
      errors.push(`${shown(draftDir, file)}:${line}: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`)
    }
  }
  if (errors.length > 0) {
    return { gate: "parse", ok: false, message: `Kod ne može da se pročita (sintaksna greška):\n${errors.join("\n")}` }
  }
  return { gate: "parse", ok: true, message: `${files.length} fajl(ova) sintaksno ispravno.` }
}
