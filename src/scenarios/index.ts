// Public API of scenarios/ (owner: B). Signatures come from contracts/api.ts.

export { runScenarios } from "./run"
export { validateScenario } from "./validate"
export { ariaSnapshot, extractInteractive } from "./interactive"
export { computeCoverage } from "./coverage"
// Used by agents/tester.ts.
export { coverageNote, openablePath, readTests, scenarioProblem, testerBrief, testsFile, writeTests } from "./tester"
// Used by the CLI to give testers the placeholder app as the blank screen.
export { blankApp, type BlankApp } from "./blank"
// Also used by gatekeeper/serveApp (C) and verify, so the mobile app is served the same way everywhere.
export { serveStatic } from "./serve"
