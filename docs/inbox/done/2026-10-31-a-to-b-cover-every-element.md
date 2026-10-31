---
from: A
to: B
created: 2026-10-31
priority: high
status: done
done: 2026-10-31, grana staging
---
# Recepti: `recipe-list` je `partial` samo zbog jednog netestiranog dugmeta

## Problem
Prolaz `output/20261031-193916-recepti`: `recipe-list` ima sve obaveze pokrivene i svih 8 testova prolazi, ali je `partial`, jer element originala nema test:
```
coverage.elements.missing: [{ "role": "button", "name": "Dodaj u omiljene: Pileća supa" }]
```
Tester je završio sa „every obligation is saved or given up“, iako je element ostao nepokriven. Pravilo „3 neuspeha zaredom“ za elemente se nije ni aktiviralo, jer tester nije ni pokušao.

## Predlog
1. U `tester.ts`: kad su sve obaveze sačuvane, a `coverage.elements.missing` nije prazan, tester **ne završava**, nego dobija poruku: „Every obligation is covered, but these elements have no test yet: …; write one scenario that taps each, then save.“ Završava tek kad su elementi pokriveni ili posle 3 neuspeha zaredom (to pravilo već postoji).
2. U `tester.md`: za dugme koje menja sopstveno stanje (npr. omiljeni) proveri ono što se vidi posle klika na **ovom** ekranu (promenjeno ime dugmeta, npr. „Ukloni iz omiljenih: Pileća supa“, ako ga original menja), ili da prethodno ime nestaje.

## Gotovo kad
- `npm test` prolazi, sa testom za tačku 1 (MockRunner: obaveze pokrivene, element ne → tester ne završava odmah).
- U sledećem prolazu `recipe-list` nema `elements.missing`.

## Odgovor
B, 2026-10-31: urađeno na grani `staging`, obe tačke.

**1. `src/agents/tester.ts`.** Uzrok je bio dvostruk.
- Tester je odustao od obaveze posle 3 neuspeha, a ta 3 neuspeha su se računala i kao „3 neuspeha zaredom“ za kraj. Zato je završio odmah posle odustajanja, a element nije ni pokušao.
- Neuspeh scenarija za element se brojao kao neuspeh njegove (već pokrivene) obaveze. Posle 3 takva neuspeha tester bi od nje odustao i odbijao svaki sledeći pokušaj.
- Sada:
  - odustaje se samo od obaveze koja još nema test;
  - kad više nema otvorenih obaveza, brojač neuspeha zaredom kreće od nule, pa elementi dobijaju svoja 3 pokušaja;
  - tester dobija poruku: „Every obligation is covered or given up, but these elements have no test yet: …; write one scenario that taps or fills each (obligation: one that already has a test, e.g. …), then save it.“
- Test u `src/agents/tester.test.ts` (MockRunner, `tester:u-elements`): obaveze su pokrivene ili napuštene, element nije, a tester ne završava, nego pokrije element. Sa starim `tester.ts` ovaj test pada.

**2. `src/agents/prompts/tester.md`.**
- Posle dugmeta koje menja svoje stanje proverava se šta se vidi na **ovom** ekranu: novo ime dugmeta (original zaista menja „Dodaj u omiljene“ u „Ukloni iz omiljenih“), poruka, ili da staro ime nestaje.
- Novo pravilo „Cover every element“.

Provera: `npm run build` prolazi, `npm test` 576/576. Da `recipe-list` nema `elements.missing`, vidi se u sledećem pravom prolazu.
