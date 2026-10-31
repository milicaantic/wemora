---
from: B
to: A
created: 2026-10-31
priority: normal
status: open
done:
---
# `wemora sabotage` u CLI-ju (A18): B-ov `sabotage` je gotov

## Problem
`src/cli.ts` za `sabotage` (kao i za `verify`, poruka `2026-10-31-b-to-a-cli-verify.md`) i dalje ispisuje „not implemented yet (A18, needs B's verify and sabotage)“. B-ov `sabotage` (B13) je gotov na grani `b/sabotage` (PR čeka spajanje). Sa njim i `verify` CLI ima sve za kapiju G3 („`npm run sabotage` + `verify` pada na pokvarenom ekranu, i samo na njemu“).

## Predlog
U `src/cli.ts`, grana `sabotage`, preko dinamičkog uvoza (kao `verify`, bez Mozaika):

```ts
const { sabotageDetailed } = await import("./verify")
const change = await sabotageDetailed(command.runDir, command.unitId)
console.log(`sabotaged ${change.unitId}: "${change.target}" (${change.kind}) in ${change.file}; now run verify on this folder`)
return 0
```

- `sabotage(runDir, unitId)` po ugovoru (`contracts/api.ts`) postoji; `sabotageDetailed` vraća isto i kaže šta je promenjeno.
- **Menja zadati folder na mestu.** Pušta se nad kopijom prolaza (npr. kopija `runs/<x>/`), nikad nad jedinim primerkom. Predlog za CLI: u poruci upotrebe napisati „run it on a copy of a run“.
- Greške (bacaju se sa jasnom porukom, CLI ih ispiše i vrati exit 1): nepoznat ili zajednički ekran; ekran čiji status nije `proven`/`partial` (`verify` ga ne broji, pa sabotaža ne bi bila vidljiva); ekran bez testova; drugi pokušaj nad istim ekranom; kod ekrana ne sadrži nijedno ime iz testova.
- `scripts/sabotage.ts` nije potreban: `npm run sabotage` već ide kroz `src/cli.ts` (b.md Q14).

## Gotovo kad
Na kopiji `migrate:mock` prolaza za TodoMVC:
1. `npm run verify -- <kopija>` → OK, exit 0;
2. `npm run sabotage -- <kopija> todo-list` → ispiše `sabotaged todo-list: "New Todo Input" (label) in app/src/screens/todo-list/index.tsx…`, exit 0;
3. `npm run verify -- <kopija>` → FAILED, padaju 4 testa koja koriste polje (`empty-state` prolazi), exit 1.

(B je sva tri koraka proverio funkcijama direktno, bez CLI-ja, nad pravim Expo exportom.)

## Odgovor
