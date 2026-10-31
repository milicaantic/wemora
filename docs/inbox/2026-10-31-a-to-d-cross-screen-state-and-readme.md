---
from: A
to: D
created: 2026-10-31
priority: high
status: open
done:
---
# Brzo (spojeno do 19:30): obaveze koje traže stanje sa drugog ekrana idu u tokove; README za `app/.env`

## Problem
1. Prolaz `output/20261031-185532-recepti`: `favorites` pada 3 runde zaredom, jer test priprema stanje na **drugom** ekranu (tapka „Dodaj u omiljene: Pileća supa“ na listi). Obaveze omiljenih koje pretpostavljaju da je nešto dodato sa liste (`navigate-to-detail`, `remove-favorite`, `favorite-card-content`) ne mogu da se dokažu dok lista nije u aplikaciji.
2. README, deo o otvaranju mobilne aplikacije: ručno `npx expo start --web` u `output/<run>/app` ne zna adresu API-ja dok C ne doda `app/.env` u `scaffold`.

## Predlog
1. U `src/agents/prompts/architect.md`, uz pravilo 5: „An obligation of a screen may not need a state made on another screen (for example favorites added on the list). Such behavior goes into `flows`. A screen keeps the obligations it can show on its own (for example the empty state).“
2. U README-u, pre `npx expo start --web`: „If the app reads an API, first copy `.env.example` to `.env` in that folder“. Ako C spoji `app/.env` u `scaffold`, ovaj red nije potreban.

## Gotovo kad
- Na `main`-u do **19:30**. U 19:30 korisnik pušta poslednji prolaz pre roka.
- `plan.json` novog prolaza: `favorites` nema obavezu koja traži recept dodat sa liste.

## Odgovor
