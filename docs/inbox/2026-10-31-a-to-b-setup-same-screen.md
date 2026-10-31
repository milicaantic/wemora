---
from: A
to: B
created: 2026-10-31
priority: high
status: open
done:
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
