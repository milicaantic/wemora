# runs/: committed migration runs

Each folder here is one finished Wemora run, copied from `output/<run-id>/` so that anyone can check its proof after `git clone`, with no AI and no API key.

## Runs

| Folder | App | How it was made | Result |
|---|---|---|---|
| `todomvc-mock-20261031-1454` | `examples/todomvc` | `npm run migrate:mock` (scripted model replies from `src/agents/mocks/todomvc/`; the app, the gates and the tests are real) | `todo-list` **proven**: 5/5 obligations, 5 tests; `app-entry` promoted |

A run made by `--mock` shows that the pipeline works end to end (Gatekeeper, regression, report, `verify`). It does not show what a model writes: the agents' answers were written by hand. Runs from a real model (`npm run migrate`) are added here with names without `mock`.

## What is in a folder

| Path | What it is |
|---|---|
| `report.html` | The report: status of every screen, coverage, tests, timeline, cost. Open it in a browser. |
| `plan.json` | The migration plan from the architect: units, obligations, intentional differences, route map. |
| `analysis/` | One report per part of the web app, from the analyzers. |
| `tests/<unit>.json` | The validated test scenarios of each screen (they passed on the original web app and failed on an empty screen). |
| `results/<unit>.json` | Gate results, status and coverage of each unit. |
| `app/` | The Expo app at the end of the run (source only). |
| `run.jsonl` | Every event of the run, one JSON line each. |
| `archive.json` | What was left out of the copy, and why. |

Left out on purpose: `node_modules/`, `.expo/`, `dist/`, `web-build/` (rebuilt from `templates/expo`), `staging/` (builder drafts are not proof), links, and files over 5 MB. Keep the whole `runs/` folder under 20 MB.

## Check a run again

Once, after cloning:

```bash
npm ci
cd templates/expo && npm ci && cd ../..
```

`verify` exports `app/` for the web with Expo. A committed run has no `node_modules`, so `verify` links `templates/expo/node_modules`, which the second `npm ci` installs.

Then:

```bash
npm run verify -- runs/todomvc-mock-20261031-1454
```

- For a Recepti run, start the mock API first (`cd examples/mock-api && npm start`): the app reads its data from there. TodoMVC needs nothing else.
- The output is a screen × test matrix (`pass` / `FAIL`) and a last line `OK: …` or `FAILED: …`. Only screens that were `proven` or `partial` in the run count; `failed` and `unproven` screens are listed but do not fail `verify`. Exit code 0 means `OK`.
- The first export after a fresh clone takes about a minute (cold Metro cache); later ones take 7–13 s.

*Until `wemora verify` is wired in the CLI (A18), the same check runs with:*

```bash
npx tsx -e "import('./src/verify/index.ts').then(async (m) => { const d = await m.verifyDetailed('runs/todomvc-mock-20261031-1454'); console.log(m.formatVerifyReport(d)); process.exit(d.ok ? 0 : 1) })"
```

## Add a run

```bash
npx tsx -e "import('./src/report/index.ts').then(async (m) => console.log(await m.archiveRun('output/<run-id>', 'runs', '<app>-<yyyymmdd-hhmm>')))"
```

`archiveRun` never overwrites a folder, leaves out what is listed above and builds `report.html` again in the copy. Then add a row to the table above.
