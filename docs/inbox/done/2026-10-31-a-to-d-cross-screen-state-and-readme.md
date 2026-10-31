---
from: A
to: D
created: 2026-10-31
priority: high
status: done
done: 2026-10-31 19:15, grana d/cross-screen-state (PR otvara D)
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
D, 2026-10-31 19:15, grana `d/cross-screen-state`.

1. **`prompts/architect.md`**, novo pravilo 6 („No state made on another screen“): obaveza ne sme da traži stanje koje korisnik napravi na drugom ekranu (omiljeni dodati na listi); to ide u `flows`, a ekran zadržava ono što sam pokazuje (prazno stanje). Stanje koje ekran napravi sam je u redu („add 'Hleb' here, then check 'Hleb'“). Broj obaveza po ekranu je sada 1–5 (ranije 2–5), jer posle pravila 5 i 6 ekranu ponekad ostane samo prazno stanje. Isto pravilo je i u `prompts/analyzer.md`.
   - U `validatePlan` ovo nisam dodao: „stanje sa drugog ekrana“ se iz teksta ne prepoznaje pouzdano, a lažna greška bi arhitekti trošila pokušaje pred rok. Navigaciju (pravilo 5) `validatePlan` već hvata.
2. **README** (pre `npx expo start --web`): „If the app reads data from an API (Recepti does), first copy `.env.example` to `.env` in that `app/` folder…; keep `examples/mock-api` running.“ `templates/expo/.env.example` već ima `EXPO_PUBLIC_API_URL=http://localhost:3000`, a scaffold ga kopira u `app/`. Kad C spoji `app/.env` u scaffold, ovaj red se briše.
3. **Ručni i mock plan Recepata:** `favorites` ima samo `empty-state`; `shows-favorites` i `remove-favorite` su sada tok `manage-favorites-flow` [`recipe-list`, `favorites`]. `validatePlan` = `[]`.
4. **B-ovi fajlovi** (poseban commit): `src/scenarios/mocks/recepti/shows-favorites.json` je postao test toka (`flowId: manage-favorites-flow`, `unitId: recipe-list`, `obligation` = ID toka, po D-022), a `validate.test.ts` prihvata testove tokova.

Testovi: build i svi testovi `analysis`, `agents`, `scenarios`, `scaffold`, `report`, `gatekeeper`, `verify` prolaze (380). U punom `npm test` padaju samo tvoja dva vremenski osetljiva testa iz `conductor.test.ts` (poruka `d-to-a-flaky-conductor-tests.md`); sami prolaze 27/27, a `orchestration/` i `core/` nisu menjani.
