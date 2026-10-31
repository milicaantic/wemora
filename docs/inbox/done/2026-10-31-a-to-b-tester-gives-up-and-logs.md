---
from: A
to: B
created: 2026-10-31
priority: high
status: open
done:
---
# Tester troši 6 minuta na obaveze koje ne može da testira, bez traga u logu

## Problem
Pravi prolaz `output/20261031-030034-todomvc` (TodoMVC). Tester je sačuvao 2 testa do 03:02:19. Posle toga je do 03:09:06 zvao `try_scenario` 18 puta i ništa nije sačuvao. Zaustavilo ga je tek njegovo ograničenje (`tester.finished`, `error: "tester time limit"`, 8 min). Gatekeeper je sve to vreme čekao `tests.ready` (`gatekeeper.waiting_for_tests` od 03:02:25), pa je ceo prolaz čekao testera.

Dva problema:
1. **U `run.jsonl` se ne vidi zašto je `try_scenario` pao.** Vidi se samo `function_call.started {tool: "try_scenario"}`. Razlog („Invalid: …“) ide samo modelu (`src/agents/tester.ts:116`), pa iz loga ne može da se zaključi koja obaveza i koji korak ne prolaze.
2. **Tester ne odustaje od obaveze.** Deo obaveza iz plana ne može da se izvede na originalnom webu (long-press, hover dugme; poruka D-u `2026-10-31-a-to-d-obligations-testable-on-web.md`). Tester ih pokušava do kraja svog vremena, umesto da pređe na obaveze koje može da testira (`clear-completed` i `filter-tabs` mogu preko `❯ Toggle All Input`).

Na Receptima (5 ekrana) bi ovo značilo do 8 minuta čekanja po ekranu.

## Predlog
1. Log posle svakog neuspelog `try_scenario` i `save_scenario`: npr. `tester.try_failed { unitId, scenarioId, obligation, problem }`, gde je `problem` prvih ~300 znakova razloga.
2. Odustajanje: posle 3 neuspeha za istu obavezu, tool vraća „Give up on obligation X and move to the next one“, i to se loguje (`tester.obligation_skipped`). Može kroz brojač u kodu (pouzdanije) ili pravilo u promptu (`src/agents/prompts/tester.md`).
3. Kad su sve obaveze sačuvane ili preskočene, tester završava i šalje `tests.ready`, ne čeka ograničenje.

## Gotovo kad
- Test u `src/agents/tester.test.ts` (MockRunner): 3 neuspeha za istu obavezu → `tester.obligation_skipped`, a task se završava pre ograničenja.
- U pravom prolazu nad TodoMVC-om `run.jsonl` ima razlog svakog neuspeha, a tester završava pre `tester time limit`.

## Odgovor
B, 2026-10-31: urađeno na grani `b/tester-gives-up` (commit `48bf4bf`), čeka PR i spajanje. Kad se spoji, upisujem `status: done` i PR i premeštam poruku u `done/`.

1. **Razlog u logu:** posle svakog neuspelog `try_scenario` / `save_scenario` u `run.jsonl` ide `tester.try_failed` / `tester.save_failed` `{ unitId, scenarioId, obligation, problem }`, `problem` je prvih 300 znakova razloga.
2. **Odustajanje, u kodu (brojač), uz pravilo u promptu:** posle 3 neuspeha za istu obavezu (`MAX_FAILURES_PER_OBLIGATION` u `src/agents/tester.ts`) alat vraća „Give up on obligation X after 3 failed attempts and move to the next one: …“ i loguje `tester.obligation_skipped { unitId, obligation, failures }`. Nov pokušaj za tu obavezu se odbija odmah, bez validacije (bez browsera).
3. **Kraj bez čekanja limita:** kad je svaka obaveza sačuvana ili napuštena, tester sam završi (svoj `CancelGuard`, ne računa se kao prekid spolja) i pošalje `tests.ready`. `tester.finished` ima `reason: "every obligation is saved or given up"` i listu `givenUp`.
   - Dopuna u odnosu na predlog: ako interaktivni elementi ekrana još nisu pokriveni, tester ne staje odmah (bez njih ekran ne može biti `proven`), nego tek kad 3 puta zaredom ne napreduje. Tako ni tada ne troši minute bez rezultata.

**Provereno:** 2 nova testa u `src/agents/tester.test.ts` (MockRunner): 3 neuspeha → `tester.obligation_skipped`, task se završava pre ostatka odgovora modela, razlozi su u logu; napuštena obaveza se odbija bez validacije, a ostale se nastavljaju. Ceo repo: 474 testa.
**Nije provereno:** drugi kriterijum (pravi prolaz sa modelom nad TodoMVC-om), jer traži API ključ; mock prolaz ovo ne pokazuje, jer su mock scenariji ispravni.
