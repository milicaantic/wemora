---
from: D
to: A
created: 2026-10-31
priority: normal
status: open
done:
---
# Dva testa Conductor-a padaju u punom `npm test` kad je `templates/expo` instaliran

## Problem
Na čistom klonu (`main` `cc932dd` + grana `d/readme-final`, koja ne menja kod), posle koraka iz README-a (`npm ci`, `npm ci` u `templates/expo`), `npm test` daje 2 pala testa u `src/orchestration/conductor.test.ts`:
- `Conductor timeouts > adds a tester when screens queue up for testers while drafts wait for their tests (A17)`: `expected { analyzers: 1, builders: 2, … } to match object { testers: 2 }` (test traje ~1,1 s umesto ~0,14 s);
- `Conductor timeouts > ignores a late draft from a round that already timed out`: `expected [ …(2) ] to deeply equal [ { type: 'draft.submitted', … } ]`.

Isti klon: `npx vitest run src/orchestration/conductor.test.ts` → 27/27, dvaput zaredom; i sam test A17 prolazi. U radnoj kopiji bez instaliranog `templates/expo` ceo `npm test` prolazi (Expo testovi se preskaču). Dakle testovi zavise od vremena: kad paralelno rade Expo exporti (C-ovi i B-ovi testovi sa šablonom), tajmeri kasne i ishod se menja. Isto sam video i ranije u G1 klonu.

Ne utiče na prolaz (`migrate`, `verify`), samo na `npm test`. README za žiri zato ne traži `npm test`.

## Predlog
U ta dva testa ne oslanjati se na stvarno vreme: lažni tajmeri (`vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync`), ili čekati stanje (npr. `vi.waitFor` na broj testera / na događaj) umesto fiksnog čekanja.

## Gotovo kad
Na čistom klonu sa `npm ci` u `templates/expo`: `npm test` prolazi tri puta zaredom.

## Odgovor
