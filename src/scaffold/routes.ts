// Pretvaranje Expo Router adrese u putanju fajla rute u `app/src/app/`.

const SEGMENT = /^(\[\.{0,3}[A-Za-z0-9_-]+\]|[A-Za-z0-9_.-]+)$/

/** Delovi adrese, npr. "/recepti/[id]" → ["recepti", "[id]"]. Baca grešku za neispravnu adresu. */
export function routeSegments(expoPath: string): string[] {
  if (!expoPath.startsWith("/")) {
    throw new Error(`Expo adresa "${expoPath}" mora da počinje sa "/".`)
  }
  const segments = expoPath.split("/").filter((s) => s !== "")
  for (const s of segments) {
    if (s === "." || s === ".." || !SEGMENT.test(s)) {
      throw new Error(
        `Expo adresa "${expoPath}" ima neispravan deo "${s}". ` +
          `Dozvoljeno: slova, brojevi, "-", "_", "." i parametri u obliku "[id]" (ne ":id").`,
      )
    }
  }
  return segments
}

/**
 * Putanja fajla rute, relativno u odnosu na `src/app/`.
 * "/" → "index.tsx", "/kategorije" → "kategorije.tsx", "/recepti/[id]" → "recepti/[id].tsx".
 * Ako neka druga adresa ide „ispod“ ove (npr. "/recepti" i "/recepti/[id]"), fajl je "recepti/index.tsx".
 */
export function routeFile(expoPath: string, allExpoPaths: string[]): string {
  const segments = routeSegments(expoPath)
  if (segments.length === 0) return "index.tsx"
  const prefix = "/" + segments.join("/") + "/"
  const hasChildren = allExpoPaths.some((p) => p.startsWith(prefix))
  return hasChildren ? `${segments.join("/")}/index.tsx` : `${segments.join("/")}.tsx`
}
