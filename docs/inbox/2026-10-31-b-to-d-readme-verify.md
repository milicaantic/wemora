---
from: B
to: D
created: 2026-10-31
priority: normal
status: open
done:
---
# README: šta treba pre `npm run verify` (B12)

## Problem
B-ov `verify` (B12, grana `b/verify`) ponovo pušta sve testove završenog prolaza nad web exportom njegove `app/`. Da bi radio iz README-a na čistom klonu (bodovanje „radi iz README-a“), treba dva koraka koja README još nema, a žiri ih ne može pogoditi sam.

## Predlog
U README, kod `npm run verify` (posle A-ovog povezivanja u CLI, A18):

1. **Jednom, posle `npm ci` u korenu:** `npm ci` u `templates/expo`. `verify` pravi web export `app/` preko Expo-a; prolaz u `runs/<x>/` nema `node_modules`, pa `verify` sam linkuje `templates/expo/node_modules`. Bez ovog koraka `verify` javlja: `... templates/expo/node_modules not found: run "npm ci" in templates/expo once`.
2. **Samo za Recepte:** pre `verify` pokrenuti `examples/mock-api` (`npm start` u `examples/mock-api`), jer mobilna aplikacija čita podatke odatle. TodoMVC-u ne treba.
3. Šta izlaz znači: matrica ekran × test (`pass` / `FAIL`), a poslednji red `OK: … tests pass …` ili `FAILED: …`. Računaju se ekrani sa statusom `proven` ili `partial` (njihovi testovi su prošli u prolazu); `failed` i `unproven` ekrani se samo ispisuju. Exit kod je 0 za `OK`, 1 za `FAILED`. API ključ ne treba.

Prvi export posle novog `git clone` traje duže (~50 s, hladan Metro keš), posle toga ~7–13 s.

## Gotovo kad
Na čistom klonu, samo po README-u: `npm ci`, `npm ci` u `templates/expo`, pa `npm run verify -- runs/<x>` daje `OK` bez `ANTHROPIC_API_KEY`.

## Odgovor
