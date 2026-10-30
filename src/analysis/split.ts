import type { AnalysisPart, ParsedRoute, SplitParts } from "../contracts"

/** How many parts to make: an integer in [1, routes], so no part is ever empty. */
function partCount(n: number, routes: number): number {
  const wanted = Number.isFinite(n) ? Math.floor(n) : 1
  return Math.min(Math.max(wanted, 1), routes)
}

/**
 * Splits routes into `n` parts of similar size in tokens, one part per analyzer.
 * Greedy: the largest route goes first, always into the lightest part (ties → lower index).
 * Shared files are not in any part; every analyzer reads them from `parsed.sharedFiles`.
 */
export const splitParts: SplitParts = (parsed, n) => {
  if (parsed.routes.length === 0) return []
  const count = partCount(n, parsed.routes.length)
  const bins: { routes: ParsedRoute[]; tokens: number }[] = Array.from({ length: count }, () => ({ routes: [], tokens: 0 }))

  const largestFirst = [...parsed.routes].sort((a, b) => b.tokens - a.tokens || a.path.localeCompare(b.path))
  for (const route of largestFirst) {
    let lightest = 0
    for (let i = 1; i < bins.length; i++) if (bins[i]!.tokens < bins[lightest]!.tokens) lightest = i
    bins[lightest]!.routes.push(route)
    bins[lightest]!.tokens += route.tokens
  }

  return bins.map((bin, i): AnalysisPart => ({
    id: `part-${i + 1}`,
    routes: bin.routes.map((r) => r.path).sort((a, b) => a.localeCompare(b)),
    files: [...new Set(bin.routes.flatMap((r) => r.files))].sort(),
    tokens: bin.tokens,
  }))
}
