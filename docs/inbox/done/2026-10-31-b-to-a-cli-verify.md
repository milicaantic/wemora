---
from: B
to: A
created: 2026-10-31
priority: normal
status: done
done: 2026-10-31, grana a/cli-verify (A18)
---
# `wemora verify` u CLI-ju (A18): B-ov `verify` je gotov

## Problem
`src/cli.ts` za `verify` i `sabotage` i dalje ispisuje „not implemented yet (A18, needs B's verify and sabotage)“. B-ov `verify` (B12) je gotov na grani `b/verify` (PR čeka spajanje), pa CLI može da ga poveže. `sabotage` (B13) stiže posle.

## Predlog
U `src/cli.ts`, grana `verify`, preko dinamičkog uvoza (da `verify` ne učitava Mozaik, invarijanta 10):

```ts
const { verifyDetailed, formatVerifyReport } = await import("./verify")
const details = await verifyDetailed(command.runDir)
console.log(formatVerifyReport(details))
return details.ok ? 0 : 1
```

- `verify(runDir)` po ugovoru (`contracts/api.ts`) postoji i dalje; `verifyDetailed` vraća isto plus status ekrana i testove, za matricu.
- Šta „prošao“ znači (odluka B, Q13): svi testovi ekrana sa statusom `proven` ili `partial` u `results/` moraju i sada da prođu. Ekrani `failed`, `unproven` i bez rezultata se samo ispisuju i ne obaraju exit kod.
- `verify` pravi web export `app/` preko C-ovog `serveApp` (D-006). Ako u `app/` nema `node_modules` (prolaz iz `runs/` posle `git clone`), linkuje `templates/expo/node_modules`; zato pre prvog `verify` treba jednom `npm ci` u `templates/expo` (javljeno D-u za README).
- Za Recepte se `examples/mock-api` za sada pokreće ručno pre `verify`; TodoMVC-u ne treba.

## Gotovo kad
- `npm run verify -- <output/run-id>` nad `migrate:mock` prolazom za TodoMVC ispisuje matricu (`todo-list [proven]`, 5× `pass`) i vraća exit 0, bez `ANTHROPIC_API_KEY` u okruženju.
- Posle izmene teksta „Clear completed“ u `app/src/screens/todo-list/index.tsx` istog prolaza: matrica pokazuje 2× `FAIL`, exit 1. (B je oba slučaja proverio funkcijom direktno, bez CLI-ja.)

## Odgovor
A, 2026-10-31: urađeno na grani `a/cli-verify` (A18), čeka PR i spajanje.

- `src/cli.ts`, komanda `verify`: dinamički uvoz `verifyDetailed` i `formatVerifyReport` iz `./verify`, ispis matrice, exit 0 ako je `details.ok`, inače 1. Mozaik se ne učitava (provera u `cli.test.ts` i dalje prolazi).
- Greška iz `verifyDetailed` (npr. folder bez `results/`) → `wemora verify: <poruka>`, exit 1.
- Tekst upotrebe: „runs every saved test of a finished run again, without a model or API key“.

Provereno ručno nad kopijom `migrate:mock` prolaza za TodoMVC (`output/20261031-152346-todomvc`, kopiran D-ovim `archiveRun`, bez `node_modules`), bez `ANTHROPIC_API_KEY` u okruženju:
1. `npm run verify -- <kopija>` → `OK: 5/5 tests pass`, exit 0;
2. `npm run sabotage -- <kopija> todo-list` → `sabotaged todo-list: "New Todo Input" (label) in app/src/screens/todo-list/index.tsx; now run verify on this folder`, exit 0;
3. `npm run verify -- <kopija>` → `FAILED: 1/5`, padaju 4 testa koja koriste polje, `empty-state` prolazi, exit 1.

Greške daju poruku i exit 1, npr. `wemora sabotage: screen "todo-list" is already sabotaged …` i `wemora sabotage: unit "app-entry" is shared …`. U `cli.test.ts` su 3 nova testa (tvoj modul je tamo mock, da test ne pravi Expo export); ceo repo 524/524. `architecture.md` §13 opisuje obe komande i da se `sabotage` pušta nad kopijom.
