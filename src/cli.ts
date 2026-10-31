import path from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"
import { DEFAULTS } from "./core/config"

// Entry point of the `wemora` CLI (architecture.md §13). Mozaik and the orchestration are imported
// only inside `migrate`, so `verify` and `sabotage` never load them (invariant 10).

export type CliCommand =
  | {
      cmd: "migrate"
      webDir: string
      out: string
      maxBuilders: number
      maxTesters: number
      budget: number
      mock: boolean
      mockDir?: string
      originalUrl?: string
    }
  | { cmd: "verify"; runDir: string }
  | { cmd: "sabotage"; runDir: string; unitId: string }
  | { cmd: "help" }

export class UsageError extends Error {}

export const USAGE = `Usage:
  wemora migrate <web-dir> [--original-url <url>] [--out output] [--max-builders 4] [--max-testers 2] [--budget 5] [--mock] [--mock-dir <dir>]

  --original-url  the running original web app, for the tester (start it first, e.g. npm run serve in examples/todomvc)
  wemora verify <run-dir>
  wemora sabotage <run-dir> <unitId>

  verify          runs every saved test of a finished run again, without a model or API key
  sabotage        breaks one promoted screen in place, so verify must fail on it: run it on a copy of a run`

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
        "original-url": { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    })
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error))
  }
  const { values, positionals } = parsed
  const [cmd, ...rest] = positionals
  if (values.help || cmd === undefined) return { cmd: "help" }

  const migrateOnly = ["out", "max-builders", "max-testers", "budget", "mock", "mock-dir", "original-url"].filter((name) => name in values)
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
        originalUrl: httpUrl(values["original-url"], "--original-url"),
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
      try {
        return await (command.cmd === "verify" ? runVerify(command.runDir) : runSabotage(command.runDir, command.unitId))
      } catch (error) {
        console.error(`wemora ${command.cmd}: ${error instanceof Error ? error.message : String(error)}`)
        return 1
      }
  }
}

// B's verify (B12): exit 1 when a proven or partial screen no longer passes its tests.
async function runVerify(runDir: string): Promise<number> {
  const { verifyDetailed, formatVerifyReport } = await import("./verify")
  const details = await verifyDetailed(runDir)
  console.log(formatVerifyReport(details))
  return details.ok ? 0 : 1
}

// B's sabotage (B13) changes the run folder in place.
async function runSabotage(runDir: string, unitId: string): Promise<number> {
  const { sabotageDetailed } = await import("./verify")
  const change = await sabotageDetailed(runDir, unitId)
  console.log(`sabotaged ${change.unitId}: "${change.target}" (${change.kind}) in ${change.file}; now run verify on this folder`)
  return 0
}

function positiveInt(raw: string | undefined, fallback: number, flag: string): number {
  const value = raw === undefined ? fallback : Number(raw)
  if (!Number.isInteger(value) || value < 1) throw new UsageError(`${flag} must be a whole number of at least 1, got "${raw}"`)
  return value
}

function httpUrl(raw: string | undefined, flag: string): string | undefined {
  if (raw === undefined) return undefined
  const protocol = URL.canParse(raw) ? new URL(raw).protocol : null
  if (protocol !== "http:" && protocol !== "https:") throw new UsageError(`${flag} must be an http(s) address, got "${raw}"`)
  return raw
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
