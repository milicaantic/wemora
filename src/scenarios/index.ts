// Public API of scenarios/ (owner: B). Signatures come from contracts/api.ts.

export { runScenarios } from "./run"
export { validateScenario } from "./validate"
export { ariaSnapshot, extractInteractive } from "./interactive"
export { computeCoverage } from "./coverage"
// Used by agents/tester.ts.
export { coverageNote, readTests, scenarioProblem, testerBrief, testsFile, writeTests } from "./tester"
// Also used by gatekeeper/serveApp (C) and verify, so the mobile app is served the same way everywhere.
export { serveStatic } from "./serve"
