import { appendFileSync, mkdirSync } from "node:fs"
import path from "node:path"

// JSONL run log (output/<run>/run.jsonl). No Mozaik, so the domain may use it too.
// Lines are appended synchronously, so their order is the order of events (the report's timeline).

export type LogEntry = { t: string; agent: string; event: string; costUsd?: number; data?: unknown }

let logFile: string | null = null

export function initLog(runDir: string): void {
  mkdirSync(runDir, { recursive: true })
  logFile = path.join(runDir, "run.jsonl")
}

// Never throws: logging is called from error paths and Mozaik handlers, where a throw would crash the run.
export function log(entry: Omit<LogEntry, "t">): void {
  const line = serialize({ t: new Date().toISOString(), ...entry })
  if (logFile === null) {
    process.stderr.write(`[log before initLog] ${line}\n`)
    return
  }
  try {
    appendFileSync(logFile, `${line}\n`)
  } catch (error) {
    process.stderr.write(`[log write failed: ${String(error)}] ${line}\n`)
  }
}

function serialize(entry: LogEntry): string {
  try {
    return JSON.stringify(entry)
  } catch {
    // e.g. circular data or BigInt: keep the entry, drop the data.
    return JSON.stringify({ ...entry, data: "[unserializable]" })
  }
}
