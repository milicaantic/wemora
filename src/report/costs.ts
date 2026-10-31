import { z } from "zod"
import type { LogLine } from "./load"

// Pure: run.jsonl lines → cost per agent. Every line with costUsd counts; model.usage lines
// (orchestration/migrate.ts, D-020) also carry the model and token counts.

export type AgentCost = {
  agent: string
  usd: number
  calls: number
  inputTokens: number
  cachedTokens: number
  outputTokens: number
  models: string[]
}

export type CostTable = { rows: AgentCost[]; totalUsd: number; calls: number }

const Usage = z.looseObject({
  model: z.string().optional(),
  inputTokens: z.number().optional(),
  cacheReadTokens: z.number().optional(),
  cacheWriteTokens: z.number().optional(),
  outputTokens: z.number().optional(),
})

export function costTable(log: LogLine[]): CostTable {
  const byAgent = new Map<string, AgentCost>()
  for (const l of log) {
    if (typeof l.costUsd !== "number" || !Number.isFinite(l.costUsd)) continue
    const agent = l.agent ?? "unknown"
    let row = byAgent.get(agent)
    if (!row) byAgent.set(agent, (row = { agent, usd: 0, calls: 0, inputTokens: 0, cachedTokens: 0, outputTokens: 0, models: [] }))
    row.usd += l.costUsd
    row.calls++
    const usage = Usage.safeParse(l.data)
    if (usage.success) {
      const u = usage.data
      row.inputTokens += u.inputTokens ?? 0
      row.cachedTokens += (u.cacheReadTokens ?? 0) + (u.cacheWriteTokens ?? 0)
      row.outputTokens += u.outputTokens ?? 0
      if (u.model && !row.models.includes(u.model)) row.models.push(u.model)
    }
  }
  const rows = [...byAgent.values()].sort((a, b) => b.usd - a.usd || a.agent.localeCompare(b.agent, "en", { numeric: true }))
  for (const r of rows) r.models.sort()
  return { rows, totalUsd: rows.reduce((s, r) => s + r.usd, 0), calls: rows.reduce((s, r) => s + r.calls, 0) }
}

/** "$0.4213" below one dollar, "$1.24" above: costs here are cents, so small amounts keep 4 decimals. */
export const usdText = (usd: number) => `$${usd.toFixed(usd >= 1 ? 2 : 4)}`
