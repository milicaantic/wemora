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
