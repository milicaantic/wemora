---
from: C
to: A, B
created: 2026-10-31
priority: normal
status: open
done:
---
# Testovi toka (`Flow`, C3.3): ko ih piše i gde stoje

## Problem
Plan ima tokove (npr. Recepti `favorite-flow`: „otvori recept, dodaj u omiljene, idi na Omiljeni“, jedinice `recipe-detail` i `favorites`), a `architecture.md` §11 kaže da se testovi toka puštaju tek kad su sve njihove jedinice promovisane. Nigde nije dogovoreno:
- ko piše scenarije za tok (tester trenutno piše samo za jednu jedinicu);
- gde stoje: tabla nema polje za testove toka, a `tests/<unitId>.json` je po jedinici;
- šta se dešava kad tok padne.

Bez toga C3.3 (Gatekeeper pušta `Flow`) ne može da se uradi.

## Predlog
1. **A (ugovor):** tabla dobija `flowTests: Record<flowId, Scenario[]>`, na disku `tests/flows/<flowId>.json`; nov događaj `flow.tests.ready { flowId }`. `Scenario.unitId` za test toka je prva jedinica toka (ili novo polje `flowId`, kako A odluči).
2. **B (tester):** kad sve jedinice toka imaju `tests.ready`, tester piše 1 scenario po toku (opis toka je obaveza), validira ga istim pravilima (prolazi na originalu, pada na praznom ekranu) i šalje `flow.tests.ready`.
3. **C (Gatekeeper):** posle svakog `unit.promoted` proveri tokove čije su sve jedinice promovisane i imaju testove; pusti ih nad aplikacijom (390×844) i upiše `results/flows/<flowId>.json` (`{ flowId, ok, scenarios }`).
4. **Tok koji pada ne vraća nijedan ekran** (svaki je već dokazan svojim testovima, a rollback bi kvario druge tokove). Samo se prijavljuje u izveštaju (D) kao „tok ne radi: …“.

Ako nema vremena: C3.3 ostaje van obima F3 (tim-plan ga ionako stavlja „samo ako je sve ostalo zeleno“), a izveštaj kaže „tokovi nisu provereni“.

## Gotovo kad
- `migrate:mock` nad Receptima ili TodoMVC-om upiše `results/flows/<flowId>.json` za bar jedan tok;
- test u `src/agents/gatekeeperParticipant.test.ts`: tok se pušta tek kad su sve njegove jedinice promovisane, a pad toka ne vraća ekrane.

## Odgovor
A, 2026-10-31: tačka 1 (ugovor) je urađena na grani `contracts/flow-tests`, odluka D-022. Tačku 4 (pad toka ne vraća ekrane) prihvatam, upisana je u `architecture.md` §11. Poruka ostaje `open` dok B ne odgovori na tačku 2.

- `Scenario.flowId` (opciono): test toka je običan `Scenario`, `unitId` je prva jedinica toka (odatle kreće `goto`), `obligation` je `Flow.id`. Izabrao sam polje umesto novog tipa, da `validateScenario`, `runScenarios` i tvoje kapije rade bez izmena.
- Tabla: `flowTests: Record<flowId, Scenario[]>` i `flowResults: Record<flowId, FlowResult>`, oba prazna na početku (`src/core/state.ts`).
- `FlowResultSchema = { flowId, ok, scenarios: ScenarioResult[] }` u `src/contracts/types.ts`, za `results/flows/<flowId>.json`.
- Događaj `flow.tests.ready { flowId }` (tester → Gatekeeper), u `src/contracts/events.ts`.
- Disk: `tests/flows/<flowId>.json` (tester) i `results/flows/<flowId>.json` (Gatekeeper), u `architecture.md` §7.

Provereno: `npm run build`, 493/493 testova (4 nova u `contracts.test.ts` i `runtime.test.ts`).

Još nije urađeno (A, korak 2, grana `a/flow-dispatch`, posle A15 i A16): `TestTask` dobija `flowId?`, a Conductor daje slobodnom testeru `{ flowId }` kad sve jedinice toka imaju `tests.ready`. Do tada C3.3 može da se testira tako što test sam upiše `board().flowTests` i pošalje `flow.tests.ready`.

B, 2026-10-31: tačka 2 je urađena na grani `b/tester-flows` (PR čeka; napravljena iznad `b/serve-original`).
- `assign({ flowId })`: tester piše jedan scenario po toku. `unitId` je prva jedinica toka, `obligation` i `flowId` su `Flow.id`, a `notPortable` svih ekrana toka je zabranjen. Validacija ide po istim pravilima.
- Sačuvan test ide u `tests/flows/<flowId>.json` i `board().flowTests`, posle čega tester šalje `flow.tests.ready { flowId }`. Bez sačuvanog scenarija ne šalje ništa (`tests.none`).
- Kad tester dobija tok odlučuje Conductor (A, `a/flow-dispatch`). Detalji za A su u `2026-10-31-b-to-a-serve-original-and-flow-tester.md`.
- Sa strane B ova poruka je gotova. Status ostavljam A-u, jer A još ima svoj korak.
