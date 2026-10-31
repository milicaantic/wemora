---
from: D
to: C
created: 2026-10-31
priority: normal
status: done
done: 2026-10-31, grana c/results-scenarios
---
# `results/<unit>.json` ima prazno `scenarios`, iako su testovi prošli

## Problem
`migrate:mock` nad TodoMVC-om (arhiva `runs/todomvc-mock-20261031-1454/results/todo-list.json`): `status: "proven"`, a poslednja kapija je `{ gate: "scenarios", round: 2, ok: true, message: "Svi testovi jedinice prolaze (5)." }`, ali je `scenarios: []`. Po ugovoru (`UnitResultSchema.scenarios: ScenarioResult[]`, `src/contracts/types.ts`) tu je rezultat svakog testa (`scenarioId`, `ok`, `failedStep?`, `error?`, `durationMs`).

Posledica: izveštaj nema po čemu da prikaže koji test je prošao ili pao, ni korak i grešku kad padne. Do sada je u tabeli testova stajalo „— nije pušten“ za svih 5 testova dokazanog ekrana. D je u izveštaju (grana `d/readme`) dodao zamenu: kad je `scenarios` prazno, a kapija `scenarios` poslednje runde je prošla, svi testovi se prikazuju kao „prolazi“. Za pad pojedinačnog testa i dalje nema podataka.

## Predlog
Gatekeeper u `results/<unit>.json` upisuje `scenarios` iz poslednjeg puštanja kapije 5 (rezultat `runScenarios` nad Expo web buildom): jedan `ScenarioResult` po testu jedinice, i kad prolazi i kad pada.

## Gotovo kad
Posle `migrate:mock` nad TodoMVC-om `results/todo-list.json` ima 5 stavki u `scenarios`, sve sa `ok: true`; kad kapija 5 padne, stavka testa koji pada ima `ok: false`, `failedStep` i `error`.

## Odgovor
C, 2026-10-31: urađeno na grani `c/results-scenarios`, bez promene ugovora.

- `src/gatekeeper/check.ts`: `checkDraft` pamti rezultat **svakog testa** iz poslednjeg puštanja kapije 5 (jedan `ScenarioResult` po testu, redom kao testovi; test bez rezultata = `ok: false`, `error: "nema rezultata"`; ako aplikacija ne može da se pokrene, svaki test dobija tu grešku). Na početku svake provere stari rezultati se brišu, pa nacrt koji padne na kapijama 1–4 ima `scenarios: []`.
- `src/gatekeeper/index.ts` izvozi `scenarioResultsOf(unitId)`.
- Gatekeeper-učesnik ih upisuje u `results/<unitId>.json` (`scenarios`) i status računa iz njih (`computeStatus`), a ne iz pretpostavke da su svi prošli.
- Provera: `migrate:mock -- examples/todomvc --original-url http://localhost:7002` → `results/todo-list.json` ima 5 stavki, sve `ok: true`, status `proven`. Kad kapija 5 padne, test koji pada ima `ok: false`, `failedStep` i `error` (testovi u `src/gatekeeper/check.test.ts` i `src/agents/gatekeeperParticipant.test.ts`).

Tvoja zamena u izveštaju („kapija prošla → svi prolaze“) može da ostane kao rezerva za stare arhive u `runs/`.

