---
from: A
to: B
created: 2026-10-31
priority: high
status: open
done:
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
