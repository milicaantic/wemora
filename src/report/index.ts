import { writeFileSync } from "node:fs"
import path from "node:path"
import type { BuildReport } from "../contracts"
import { loadRun } from "./load"
import { toReportModel } from "./model"
import { renderReport } from "./render"

// Public API of report/ (owner: D). Signature comes from contracts/api.ts.

/** Builds <runDir>/report.html from the files of one run and returns its path. */
export const buildReport: BuildReport = async (runDir) => {
  const html = renderReport(toReportModel(loadRun(runDir)))
  const file = path.join(runDir, "report.html")
  writeFileSync(file, html, "utf8")
  return file
}
