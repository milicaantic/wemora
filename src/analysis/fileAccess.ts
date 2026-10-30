import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import type { AnalysisPart, ParsedApp } from "../contracts"

/** Longest file an analyzer gets in one read, so one request stays far below 100k tokens. */
export const MAX_FILE_CHARS = 40_000

export type FileAccess = {
  /** Every file the analyzer may read, sorted. */
  list(): string[]
  /** File text with LF line endings. Throws a message meant for the model when the path is not allowed. */
  read(file: string): string
}

export function findPart(parsed: ParsedApp, partId: string): AnalysisPart {
  const part = parsed.parts.find((p) => p.id === partId)
  if (!part) throw new Error(`unknown part "${partId}"; parts: ${parsed.parts.map((p) => p.id).join(", ")}`)
  return part
}

/** Files of the part plus the shared files: what one analyzer may read. */
export function allowedFiles(parsed: ParsedApp, partId: string): string[] {
  return [...new Set([...findPart(parsed, partId).files, ...parsed.sharedFiles])].sort()
}

/**
 * Turns what the model asked for into a project path ("src/x.tsx"), or null when the path
 * is absolute or leaves the project. Accepts "./src/x.tsx" and Windows separators.
 */
export function normalizeRequestedPath(requested: string): string | null {
  const slashed = requested.trim().replaceAll("\\", "/")
  if (slashed === "" || slashed.startsWith("/") || /^[a-zA-Z]:/.test(slashed)) return null
  const normalized = path.posix.normalize(slashed)
  if (normalized === ".." || normalized.startsWith("../")) return null
  return normalized.replace(/^\.\//, "")
}

/** Read-only access for one analyzer. The agent's tools call this; the rules live here, not in the agent. */
export function createFileAccess(parsed: ParsedApp, partId: string): FileAccess {
  const allowed = allowedFiles(parsed, partId)
  const allowedSet = new Set(allowed)
  const refuse = (requested: string) =>
    new Error(`File not allowed: "${requested}". You may read only the files of your part and the shared files; call list_files to see them.`)

  return {
    list: () => [...allowed],
    read(requested) {
      const file = normalizeRequestedPath(requested)
      if (file === null || !allowedSet.has(file)) throw refuse(requested)
      const abs = path.join(parsed.webDir, file)
      if (!existsSync(abs)) throw new Error(`File "${file}" is listed but no longer exists on disk.`)
      const text = readFileSync(abs, "utf8").replace(/\r\n/g, "\n")
      if (text.length <= MAX_FILE_CHARS) return text
      return `${text.slice(0, MAX_FILE_CHARS)}\n…[truncated: the file has ${text.length} characters, only the first ${MAX_FILE_CHARS} are shown]`
    },
  }
}
