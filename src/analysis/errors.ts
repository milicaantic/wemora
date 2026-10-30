export type UnsupportedInputCode =
  | "not-react"
  | "nextjs"
  | "no-router"
  | "router-v5"
  | "no-routes"
  | "unresolved-route"
  | "parse-error"

/** The web project is outside the supported input profile (docs/architecture.md §1). */
export class UnsupportedInputError extends Error {
  constructor(
    readonly code: UnsupportedInputCode,
    message: string,
  ) {
    super(message)
    this.name = "UnsupportedInputError"
  }
}
