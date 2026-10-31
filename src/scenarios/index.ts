// Public API of scenarios/ (owner: B). Signatures come from contracts/api.ts.

export { runScenarios } from "./run"
// Shorter step limits for tests of other folders (e.g. verify) that run scenarios meant to fail.
export { createRunScenarios, type RunnerSettings } from "./run"
export { validateScenario } from "./validate"
export { ariaSnapshot, extractInteractive } from "./interactive"
// Used by agents/tester.ts: a real path for a route with parameters, and where a screen's links go.
export { findOpenPath, linkTargets, type LinkTarget } from "./interactive"
export { computeCoverage } from "./coverage"
// Used by agents/tester.ts.
export { coverageNote, matchesRoute, openablePath, readTests, scenarioProblem, testerBrief, testsFile, writeTests } from "./tester"
// Flow tests (D-022), also used by agents/tester.ts.
export { flowAsUnit, flowBrief, flowTestsFile, readFlowTests, writeFlowTests } from "./tester"
// Used by the CLI to give testers the placeholder app as the blank screen.
export { blankApp, type BlankApp } from "./blank"
// Also used by gatekeeper/serveApp (C) and verify, so the mobile app is served the same way everywhere.
export { serveStatic } from "./serve"
// For the CLI (A): builds and serves the original web app when --original-url is not given (D-014).
export { serveOriginal, type ServeOriginalOptions } from "./original"
