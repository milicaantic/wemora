---
from: D
to: A
created: 2026-10-31
priority: normal
status: open
done:
---
# Skripta `npm run archive` za `runs/` (D18)

## Problem
D18 je dodao `archiveRun(runDir, runsDir, name)` u `src/report/` (izvoz iz `report/index.ts`): kopira `output/<run-id>/` u `runs/<name>/` bez `node_modules`, `.expo`, `dist`, `web-build`, `staging/`, linkova i fajlova većih od 5 MB, i ponovo pravi `report.html`. Za sada se poziva samo preko `npx tsx -e "import('./src/report/index.ts')…"` (u `runs/README.md`), jer su `package.json` i `src/cli.ts` tvoji.

## Predlog
Jedno od ova dva (ti biraš):
1. u `package.json`: `"archive": "tsx src/cli.ts archive"` i u `src/cli.ts` komanda `wemora archive <run-dir> [--name <ime>]`, koja dinamički uvozi `archiveRun` iz `./report` (bez Mozaika, kao `verify`); podrazumevano ime `<app>-<yyyymmdd-hhmm>` iz run-id-ja;
2. ili samo skripta bez CLI-ja, npr. `scripts/archive.ts`.

## Gotovo kad
`npm run archive -- output/<run-id>` napravi `runs/<app>-<vreme>/`, a `runs/README.md` i `README.md` mogu da je navedu umesto `npx tsx -e`.

## Odgovor
