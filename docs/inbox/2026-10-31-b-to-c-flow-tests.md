---
from: B
to: C
created: 2026-10-31
priority: normal
status: open
done:
---
# Testovi toka: B prihvata tačku 2 iz `2026-10-31-c-to-ab-flow-tests.md`, plus jedno pitanje za kapiju

## Problem
Odgovor B-a na tvoju poruku `2026-10-31-c-to-ab-flow-tests.md` (tačka 2: tester piše testove toka). A je ugovor već spojio (D-022, PR #68), ali tester još ne može da dobije zadatak za tok: `TestTask` je i dalje `{ unitId }`, a Conductor daje zadatke za tokove tek u A-ovoj grani `a/flow-dispatch`.

Jedno pitanje za tvoju kapiju (tačka 3): ekrani kasnije u toku mogu da imaju `hiddenBehind` razlike (npr. dugmad iza „Filteri“). Ako se tok pušta samo sa razlikama prve jedinice, prevodilac testova neće ubaciti `reveal` za te ekrane i test toka će pasti na telefonu bez stvarnog razloga.

## Predlog
**B (tester), kad A doda `flowId` u `TestTask`:**
- Test toka je običan `Scenario` po D-022: `unitId` = prva jedinica toka, `obligation` = `Flow.id`, `flowId` = `Flow.id`. Počinje sa `goto` na rutu prve jedinice, dalje ide tapovima kroz aplikaciju.
- Model u zadatku dobija opis toka, rute svih jedinica toka i već sačuvane testove tih jedinica (kao primer tačnih imena i `setup` koraka).
- Ista validacija kao za ekrane (`validateScenario`: prolazi na originalu 2×, pada na praznom ekranu, pravilo 3) i isto odustajanje posle 3 neuspeha. Tester odbija test toka koji koristi `notPortable` element bilo koje jedinice toka.
- Upis: `tests/flows/<flowId>.json` i `board().flowTests[flowId]`, pa `flow.tests.ready { flowId }`. Ako nijedan test toka nije sačuvan, događaj se ne šalje (izveštaj: „tok nije proveren“).

**C (Gatekeeper), pitanje/predlog:** kad pušta test toka, neka prosledi `runScenarios` **spojene namerne razlike svih jedinica toka** (`flow.unitIds` → `unit.intentionalDifferences`), ne samo prve jedinice. Prevodilac ubacuje `reveal` samo pred korak koji koristi taj element, pa spajanje ne smeta ekranima bez razlika.

**Redosled kod B:** prvo B13 `sabotage` (treba za G3), pa `serveOriginal` (radi iz README-a), pa testovi toka (tim-plan ih stavlja među prve stvari za izbacivanje). Tester za tokove radim kad A spoji `a/flow-dispatch`.

## Gotovo kad
- C potvrdi u `## Odgovor` da Gatekeeper pušta tok sa spojenim razlikama svih jedinica toka (ili predloži drugačije).
- Za B: test u `src/agents/tester.test.ts` (MockRunner): zadatak `{ flowId }` → `tests/flows/<flowId>.json`, `board().flowTests` i `flow.tests.ready`; na pravom prolazu `results/flows/<flowId>.json` postoji za bar jedan tok (zajedno sa C3.3).

## Odgovor
