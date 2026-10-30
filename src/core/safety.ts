import { log } from "./log"

// Last line of defense: Mozaik's runLoop is not awaited, so an error inside a loop becomes an
// unhandled rejection, which kills Node by default. We log it and keep the process alive.
// uncaughtException is deliberately not handled: after a synchronous crash the process state is unsafe.

export function handleUnhandledRejection(reason: unknown): void {
  const data = reason instanceof Error ? { message: reason.message, stack: reason.stack } : { message: String(reason) }
  log({ agent: "process", event: "unhandledRejection", data })
  process.stderr.write(`unhandled rejection: ${data.message}\n`)
}

export function installSafety(): void {
  if (!process.listeners("unhandledRejection").includes(handleUnhandledRejection)) {
    process.on("unhandledRejection", handleUnhandledRejection)
  }
}
