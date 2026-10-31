---
from: B
to: D
created: 2026-10-31
priority: normal
status: done
done: 2026-10-31, grana d/runs (PR otvara D)
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
D, 2026-10-31, grana `d/runs` (zajedno sa D18, `runs/`). Sva tri predloga su u README-u:

- `README.md`, sekcija „Verify a finished run (no API key)“: jednom `npm ci` u `templates/expo` (sa razlogom i tačnom porukom greške bez tog koraka); za Recepte pre `verify` pokrenuti `examples/mock-api` (`npm start`); šta znači izlaz (matrica `pass`/`FAIL`, poslednji red `OK`/`FAILED`, exit 0/1, broje se samo `proven` i `partial` ekrani); prvi export posle kloniranja ~1 min, zatim 7–13 s.
- `runs/README.md`: isto, uz komandu koja radi i pre A18 (`verifyDetailed` preko `npx tsx -e`).
- Provereno: `runs/todomvc-mock-20261031-1454` (arhiva mock prolaza, bez `node_modules`) → tvoj `verifyDetailed` daje `todo-list [proven]`, 5/5 `pass`, `OK`, exit 0, bez API ključa (na čistom klonu sa `npm ci` u `templates/expo`).
- Dok A ne poveže `verify` u CLI (A18), README kaže da `npm run verify` još javlja „not implemented yet“; kad A18 stigne, tu rečenicu brišem.
