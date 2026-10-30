import path from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"
import { DEFAULTS } from "./core/config"

// Entry point of the `wemora` CLI (architecture.md §13). Mozaik and the orchestration are imported
// only inside `migrate`, so `verify` and `sabotage` never load them (invariant 10).

export type CliCommand =
  | { cmd: "migrate"; webDir: string; out: string; maxBuilders: number; maxTesters: number; budget: number; mock: boolean; mockDir?: string }
  | { cmd: "verify"; runDir: string }
  | { cmd: "sabotage"; runDir: string; unitId: string }
  | { cmd: "help" }

export class UsageError extends Error {}

export const USAGE = `Usage:
  wemora migrate <web-dir> [--out output] [--max-builders 4] [--max-testers 2] [--budget 3] [--mock] [--mock-dir <dir>]
  wemora verify <run-dir>
  wemora sabotage <run-dir> <unitId>`

export function parseCliArgs(argv: string[]): CliCommand {
  let parsed
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        out: { type: "string" },
        "max-builders": { type: "string" },
        "max-testers": { type: "string" },
        budget: { type: "string" },
        mock: { type: "boolean" },
        "mock-dir": { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    })
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error))
  }
  const { values, positionals } = parsed
  const [cmd, ...rest] = positionals
  if (values.help || cmd === undefined) return { cmd: "help" }

  const migrateOnly = ["out", "max-builders", "max-testers", "budget", "mock", "mock-dir"].filter((name) => name in values)
  if (cmd !== "migrate" && migrateOnly.length > 0) throw new UsageError(`--${migrateOnly[0]} only works with migrate`)

  switch (cmd) {
    case "migrate":
      if (rest.length !== 1) throw new UsageError("migrate needs exactly one <web-dir>")
      return {
        cmd,
        webDir: rest[0],
        out: values.out ?? "output",
        maxBuilders: positiveInt(values["max-builders"], DEFAULTS.maxBuilders, "--max-builders"),
        maxTesters: positiveInt(values["max-testers"], DEFAULTS.maxTesters, "--max-testers"),
        budget: positiveNumber(values.budget, DEFAULTS.budgetUsd, "--budget"),
        mock: values.mock ?? false,
        mockDir: values["mock-dir"],
      }
    case "verify":
      if (rest.length !== 1) throw new UsageError("verify needs exactly one <run-dir>")
      return { cmd, runDir: rest[0] }
    case "sabotage":
      if (rest.length !== 2) throw new UsageError("sabotage needs <run-dir> and <unitId>")
      return { cmd, runDir: rest[0], unitId: rest[1] }
    default:
      throw new UsageError(`unknown command "${cmd}"`)
  }
}

export async function main(argv: string[]): Promise<number> {
  let command: CliCommand
  try {
    command = parseCliArgs(argv)
  } catch (error) {
    if (!(error instanceof UsageError)) throw error
    console.error(`wemora: ${error.message}\n\n${USAGE}`)
    return 2
  }
  switch (command.cmd) {
    case "help":
      console.log(USAGE)
      return argv.length === 0 ? 2 : 0
    case "migrate": {
      // Only a real run needs the API key from .env.
      if (!command.mock) await import("dotenv/config")
      const { runMigrate } = await import("./orchestration/migrate")
      return runMigrate(command)
    }
    case "verify":
    case "sabotage":
      console.error(`wemora ${command.cmd}: not implemented yet (A18, needs B's verify and sabotage)`)
      return 1
  }
}

function positiveInt(raw: string | undefined, fallback: number, flag: string): number {
  const value = raw === undefined ? fallback : Number(raw)
  if (!Number.isInteger(value) || value < 1) throw new UsageError(`${flag} must be a whole number of at least 1, got "${raw}"`)
  return value
}

function positiveNumber(raw: string | undefined, fallback: number, flag: string): number {
  const value = raw === undefined ? fallback : Number(raw)
  if (!Number.isFinite(value) || value <= 0) throw new UsageError(`${flag} must be a positive number of dollars, got "${raw}"`)
  return value
}

// process.exit, not exitCode: a finished run may leave servers or timers that would keep Node alive.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(error)
      process.exit(1)
    },
  )
}
