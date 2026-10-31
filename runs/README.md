# runs/

Finished Wemora migrations, kept in the repository so anyone can check their proof after `git clone`, with no AI and no API key.

| Folder | App | Made with | Result |
|---|---|---|---|
| `todomvc-mock-20261031-1454` | [TodoMVC](../examples/todomvc/) | `npm run migrate:mock` | `todo-list` **proven**: 5/5 obligations, 5 tests |

A `--mock` run uses recorded model answers instead of a live model. Everything else in it is real: the Expo app, the gates, and the tests on the original web app and on the mobile app.

## What is in a folder

| Path | What it is |
|---|---|
| `report.html` | the report: status of every screen, coverage, tests, timeline, cost (open it in a browser) |
| `plan.json` | the migration plan: units, obligations, intentional differences, route map |
| `analysis/` | one report per part of the web app |
| `tests/` | the validated tests of each screen |
| `results/` | gate results, status and coverage of each unit |
| `app/` | the Expo app (source only) |
| `run.jsonl` | every event of the run |
| `archive.json` | what was left out of the copy |

Left out: `node_modules/`, `.expo/`, `dist/`, `web-build/` (rebuilt from `templates/expo`), builder drafts, links, and files over 5 MB.

## Check a run

After the install steps in the [main README](../README.md#1-install):

```bash
npm run verify -- runs/todomvc-mock-20261031-1454
```

`verify` exits with 0 when every test of every `proven` or `partial` screen still passes, and with 1 otherwise. For a Recepti run, start the data server first (`cd examples/mock-api && npm start`).

## Add a run

```bash
npm run archive -- output/<run-id>
```

It copies the run to `runs/<app>-<date>-<time>/`, leaves out what is listed above, and builds `report.html` again in the copy. Then add a row to the table.
