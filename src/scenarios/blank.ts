import type { ServeApp, ServedApp } from "../contracts"

export type BlankApp = {
  /** URL of the served placeholder app; the first call starts the export, later calls reuse it. */
  url(): Promise<string>
  close(): Promise<void>
}

/**
 * The blank screen for validateScenario (rule 2) in a real run: the placeholder app from scaffold().
 * serveApp exports the app once and serves that snapshot (D-006), so as long as the first url() call
 * comes before the first promotion, the blank screen stays a placeholder for the whole run while app/
 * keeps changing. `serve` is gatekeeper's serveApp, passed in because gatekeeper/ already imports scenarios/.
 */
export function blankApp(appDir: string, serve: ServeApp): BlankApp {
  let served: Promise<ServedApp> | null = null
  return {
    url() {
      // A failed export is not kept, so the next tester task tries again.
      served ??= serve(appDir).catch((error: unknown) => {
        served = null
        throw error
      })
      return served.then((app) => app.url)
    },
    async close() {
      const app = await served?.catch(() => null)
      served = null
      await app?.close()
    },
  }
}
