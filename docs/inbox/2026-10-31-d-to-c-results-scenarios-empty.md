---
from: D
to: C
created: 2026-10-31
priority: normal
status: open
done:
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
