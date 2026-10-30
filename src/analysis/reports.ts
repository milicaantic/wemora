import path from "node:path"
import { z } from "zod"
import { AnalyzerReportSchema, type AnalyzerReport, type ParsedApp } from "../contracts"
import { allowedFiles, findPart, normalizeRequestedPath } from "./fileAccess"

/** One report as the model writes it: the code adds partId. */
export const ModelReportSchema = AnalyzerReportSchema.omit({ partId: true })
export type ModelReport = z.infer<typeof ModelReportSchema>

/** Structured output of the analyzer (an object at the root, as structured output requires). */
export const AnalyzerOutputSchema = z.strictObject({ reports: z.array(ModelReportSchema) })
export type AnalyzerOutput = z.infer<typeof AnalyzerOutputSchema>

/** Problems with which routes the reports cover; empty means exactly one report per route of the part. */
export function routeProblems(reports: { route: string }[], partRoutes: string[]): string[] {
  const problems: string[] = []
  for (const route of partRoutes) {
    const count = reports.filter((r) => r.route === route).length
    if (count === 0) problems.push(`missing report for route "${route}"`)
    if (count > 1) problems.push(`${count} reports for route "${route}"; write exactly one`)
  }
  for (const report of reports) {
    if (!partRoutes.includes(report.route)) {
      problems.push(`report for route "${report.route}" is not in your part; your routes are ${partRoutes.map((r) => `"${r}"`).join(", ")}`)
    }
  }
  return [...new Set(problems)]
}

/**
 * The schema the analyzer agent passes to runStructured: the output shape plus the
 * one-report-per-route rule, so a wrong set of routes goes back to the model like a schema error.
 * The extra rule is a refinement, so z.toJSONSchema still gives the plain shape.
 */
export function analyzerOutputSchema(parsed: ParsedApp, partId: string) {
  const partRoutes = findPart(parsed, partId).routes
  return AnalyzerOutputSchema.superRefine((output, ctx) => {
    for (const message of routeProblems(output.reports, partRoutes)) ctx.addIssue({ code: "custom", message, path: ["reports"] })
  })
}

const zodMessage = (error: z.ZodError) =>
  error.issues.map((i) => `${i.path.length > 0 ? i.path.join(".") : "(root)"}: ${i.message}`).join("\n")

const tidy = (items: string[]) => [...new Set(items.map((x) => x.trim()).filter((x) => x !== ""))]
const sorted = (items: string[]) => tidy(items).sort()

/**
 * Checks the model's output and completes it with what the parser knows for sure:
 * partId, the route's own files and web APIs. Files outside the part are dropped.
 * On failure returns a message for the model.
 */
export function finalizeReports(
  raw: unknown,
  parsed: ParsedApp,
  partId: string,
): { ok: true; reports: AnalyzerReport[] } | { ok: false; error: string } {
  const output = analyzerOutputSchema(parsed, partId).safeParse(raw)
  if (!output.success) return { ok: false, error: zodMessage(output.error) }

  const allowed = new Set(allowedFiles(parsed, partId))
  const byRoute = new Map(parsed.routes.map((r) => [r.path, r]))
  const reports = output.data.reports
    .map((report): AnalyzerReport => {
      const route = byRoute.get(report.route)!
      const files = report.files.map(normalizeRequestedPath).filter((f): f is string => f !== null && allowed.has(f))
      return {
        partId,
        route: report.route,
        screen: report.screen.trim(),
        summary: report.summary.trim(),
        files: sorted([...route.files, ...files]),
        components: sorted(report.components),
        dataSources: sorted(report.dataSources),
        navigatesTo: sorted(report.navigatesTo),
        webApis: sorted([...route.webApis, ...report.webApis]),
        mobileIssues: tidy(report.mobileIssues),
        suggestedObligations: tidy(report.suggestedObligations),
      }
    })
    .sort((a, b) => a.route.localeCompare(b.route))
  return { ok: true, reports: z.array(AnalyzerReportSchema).parse(reports) }
}

// Fallback: what the parser alone can say about a screen.

const ISSUE_HINTS: Record<string, string> = {
  table: "uses an HTML table; a wide table does not fit a phone screen",
  hover: "shows content on mouse hover; touch screens have no hover",
  "title-tooltip": "uses title tooltips, which only appear on mouse hover",
  contextmenu: "uses right click (context menu)",
  keyboard: "reacts to keyboard events",
  doubleclick: "reacts to double click",
  drag: "uses drag and drop",
  localStorage: "stores data in localStorage",
  sessionStorage: "stores data in sessionStorage",
  window: "uses the browser window object",
  document: "uses the DOM document object",
}

/** Name of a screen from its file: "src/pages/RecipeListPage.tsx" → "RecipeListPage". */
const screenName = (file: string) => path.posix.basename(file).replace(/\.[jt]sx?$/, "")

/**
 * Reports built from the parser only, used when the model fails even after retries.
 * The run continues (analysis.done is still sent) and the architect sees that these are fallbacks.
 */
export function fallbackReports(parsed: ParsedApp, partId: string, why: string): AnalyzerReport[] {
  const part = findPart(parsed, partId)
  return parsed.routes
    .filter((r) => part.routes.includes(r.path))
    .map((r) => ({
      partId,
      route: r.path,
      screen: screenName(r.file),
      summary: `Automatic fallback from the parser, the model gave no valid report: ${why}`,
      files: [...r.files],
      components: [],
      dataSources: [],
      navigatesTo: [],
      webApis: [...r.webApis],
      mobileIssues: r.webApis.flatMap((api) => (ISSUE_HINTS[api] ? [ISSUE_HINTS[api]] : [])),
      suggestedObligations: [],
    }))
    .sort((a, b) => a.route.localeCompare(b.route))
}
