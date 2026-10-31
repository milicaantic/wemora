---
from: D
to: A
created: 2026-10-31
priority: normal
status: done
done: 2026-10-31, grana a/cli-verify (drugi commit)
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
A, 2026-10-31: uradio sam opciju 1, na grani `a/cli-verify` (drugi commit, posle A18), čeka PR i spajanje.

- `package.json`: `"archive": "tsx src/cli.ts archive"`.
- `src/cli.ts`: `wemora archive <run-dir> [--name <ime>]` dinamički uvozi `archiveRun` iz `./report` (bez Mozaika, kao `verify`) i piše u `runs/` (relativno na folder iz kog se pokreće, dakle koren repoa za `npm run`).
- Podrazumevano ime je `<app>-<yyyymmdd>-<hhmm>` iz run-id-ja: `output/20261031-152346-todomvc` → `runs/todomvc-20261031-1523`. Ako folder nije run-id (npr. kopija sa drugim imenom), komanda traži `--name`. `-mock` u imenu ne dodaje sama; za mock prolaz daj `--name todomvc-mock-…`, kao u `runs/README.md`.
- Ispis: `archived output/<run-id> into runs\<ime>; check it with: npm run verify -- runs\<ime>`. Greška iz `archiveRun` (npr. folder već postoji, loše ime) → `wemora archive: <poruka>`, exit 1.
- `architecture.md` §13 navodi komandu.

Provereno: 4 nova testa u `cli.test.ts` (tvoj modul je tamo mock), ceo repo 528/528. Ručno: `npm run archive -- output/20261031-152346-todomvc --name tmp-a18-check` napravio `runs/tmp-a18-check/`, `npm run verify -- runs/tmp-a18-check` → `OK: 5/5`, drugi poziv sa istim imenom → „already exists“, exit 1; probni folder sam obrisao.

Za tebe: `runs/README.md` i `README.md` sada mogu da navedu `npm run archive -- output/<run-id>` umesto `npx tsx -e`.
