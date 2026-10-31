import { useEffect, useState, type DependencyList } from "react"

export type AsyncState<T> =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "ok"; data: T }

/** Runs `load` when `deps` change and ignores results that arrive after the component moved on. */
export function useAsync<T>(load: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" })

  useEffect(() => {
    let cancelled = false
    setState({ status: "loading" })
    load().then(
      (data) => {
        if (!cancelled) setState({ status: "ok", data })
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: "error", error: error instanceof Error ? error : new Error(String(error)) })
      },
    )
    return () => {
      cancelled = true
    }
  }, deps)

  return state
}
