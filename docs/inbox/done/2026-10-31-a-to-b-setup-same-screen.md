---
from: A
to: B
created: 2026-10-31
priority: high
status: done
done: 2026-10-31, grana staging
---
# Brzo (spojeno do 19:30): `setup` testa sme da koristi samo ovaj ekran

## Problem
Prolaz `output/20261031-185532-recepti`: `favorites` pada 3 runde zaredom na pripremi testa:
> test "favorites-navigate-to-detail" (ekran favorites): setup: step 1: tap button "Dodaj u omiljene: Pileća supa": not found

To dugme je na ekranu **liste** (`recipe-list`), koji još nije u aplikaciji kad se proverava `favorites`. Ovo je isto zaključavanje kao kod navigacije, samo u `setup`.

## Predlog
U `src/agents/prompts/tester.md`, uz pravilo o navigaciji:
> **Setup uses only this screen.** `setup` and `steps` of a screen test may only touch elements of this screen. If the state you need is made on another screen (e.g. a favorite added on the list), test what this screen shows without it (e.g. the empty state), and leave the rest to a flow test.

Ako stigneš: u `scenarioProblem` odbij `setup` korak koji tapka nešto čega nema na ovom ekranu originala.

## Gotovo kad
- Na `main`-u do **19:30**. U 19:30 korisnik pušta poslednji prolaz pre roka.
- U novom prolazu nijedan test ekrana nema `setup` sa elementom drugog ekrana.

## Odgovor
B, 2026-10-31: urađeno na grani `staging`, oba dela.
- `src/agents/prompts/tester.md`: tvoje pravilo „Setup uses only this screen“ zamenjuje stari savet, koji je baš tražio tapkanje „Dodaj u omiljene“ na drugom ekranu.
- `scenarioProblem` (`src/scenarios/tester.ts`) odbija test ekrana čiji `goto` (u `setup` ili u `steps`) otvara drugu rutu, sa porukom šta da uradi umesto toga. Testovi toka su izuzeti.
  - Tvoj slučaj (`favorites`: `goto /` pa „Dodaj u omiljene“) odbija se pre validacije, bez browsera.
  - Rute: `/recepti/:id` prihvata `/recepti/1`, catch-all `*` prihvata sve, a `?q=` i `#/` se ne gledaju (`matchesRoute`).
  - Tapkanje elementa drugog ekrana bez `goto` (npr. preko navigacije) ovo ne hvata. To pokriva prompt.
- Savet uz „changes nothing“ (`validate.ts`) sada kaže „setup samo na ovom ekranu“.
- Provera:
  - `npm run build` prolazi, testovi 573/575;
  - 2 nova testa u `scenarios/tester.test.ts`, a u jednom starom je `goto /` ispravljen na rutu ekrana;
  - sva tri ručna scenarija za Recepte poštuju novo pravilo, i D-ov test toka za omiljene.
- Padaju samo tvoja 2 vremenska testa u `conductor.test.ts` (`adds a tester… (A17)` i `ignores a late draft…`), i to samo u celom paketu. Sami prolaze, sa ovim izmenama i bez njih. Vidi D-ovu poruku `d-to-a-flaky-conductor-tests`.
- Posledica: `favorites` bez omiljenih proverava prazno stanje, pa može biti `partial`, ali više nije zaključan.
