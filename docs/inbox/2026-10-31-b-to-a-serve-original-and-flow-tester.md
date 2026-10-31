---
from: B
to: A
created: 2026-10-31
priority: normal
status: open
done:
---
# `serveOriginal(webDir)` za CLI (D-014) i tester za tokove (D-022): B je gotov, treba povezivanje kod A

**A, molim te odgovori u `## Odgovor` ispod (šta si uradio i u kom PR-u, ili zašto ne) i, kad završiš, premesti poruku u `done/` (`git mv`, `status: done`, `done: <datum>, PR #…`).** Isto važi za dve starije poruke koje su i dalje otvorene i bez odgovora: `2026-10-31-b-to-a-cli-verify.md` i `2026-10-31-b-to-a-cli-sabotage.md`.

## Problem
Dve stvari su kod B gotove, ali rade tek kad ih A poveže u CLI-ju i Conductor-u.

**1. `serveOriginal(webDir)` (D-014), grana `b/serve-original` (commit `93f6466`, PR čeka).**
- `migrate` bez `--original-url` sada nema original, pa tester i `validateScenario` nemaju šta da otvore.
- `serveOriginal(webDir, { build?, outDir? })` iz `scenarios/index.ts`: pokrene `npm run build` u web folderu, servira `dist/` preko `serveStatic` (slobodan port, SPA fallback) i vrati `{ url, close }`.
- Baca jasnu grešku kad nema `package.json`, nema `build` skripte, ima zavisnosti a nema `node_modules` („run npm ci“), build padne (poslednjih 15 redova izlaza) ili u izlazu nema `index.html`.
- Mock-api (Recepti) **ne pokreće**: adresa se čita iz `VITE_API_URL` pri build-u, a mock-api se i dalje pokreće ručno (README).
- Provereno ručno: `examples/todomvc` za 26 s, svih 5 TodoMVC scenarija prolazi; `examples/recepti` za 4 s (uz mock-api), scenario pretrage prolazi.

**2. Tester za tokove (D-022, tačka 2 iz C-ove poruke `2026-10-31-c-to-ab-flow-tests.md`), grana `b/tester-flows` (commit `11db706`, napravljena iznad `b/serve-original`, PR čeka).**
- `createTester(...)` sada vraća `AgentHandle<TesterTask>`, gde je `TesterTask = { unitId?: string; flowId?: string }`. To se i dalje uklapa u tvoj `AgentHandle<TestTask>`, pa Conductor radi bez izmena.
- `assign({ flowId })`: tester radi tok kao jednu jedinicu. Kreće od prve jedinice toka, tok mu je jedina obaveza, a `notPortable` elementi svih ekrana toka su zabranjeni. Važe ista tri pravila validacije. Scenario mora da ima `flowId` toka, a test ekrana ne sme da ga ima.
- Kad sačuva: upiše `tests/flows/<flowId>.json` i `board().flowTests[flowId]`, pa pošalje `flow.tests.ready { flowId }` (C-ov Gatekeeper ga već sluša).
- Za tok **nema** `tests.ready` ni pokrivenosti.
- Ako ništa nije sačuvano, ne šalje ništa i samo loguje `tests.none { flowId }`. Isto važi za spoljni cancel: tester tada loguje `tester.cancelled { flowId }`, a rezultat ne šalje.
- Model dobija `flowBrief` (ekrane redom, id-jeve koje treba da upiše, do 2 sačuvana testa po ekranu). Prompt testera ima odeljak „Flow tasks“.
- Testovi: 3 nova u `agents/tester.test.ts`, 5 u `scenarios/tester.test.ts`. Ceo repo: 534/534, `npm run build` prolazi.

## Predlog
1. **Spoji `b/serve-original` pre `b/tester-flows`** (druga grana je napravljena iznad prve).
2. **CLI (`migrate`):** kad `--original-url` nije dat, pozovi `serveOriginal(config.webDir)`, koristi `url` kao `originalUrl` za testere i Gatekeeper, a na kraju prolaza (i kad prolaz padne) pozovi `close()`. Grešku iz `serveOriginal` ispiši i vrati exit 1 pre nego što krene ijedan agent. `--original-url` i dalje ima prednost.
   ```ts
   const original = options.originalUrl ? null : await serveOriginal(config.webDir)
   const originalUrl = options.originalUrl ?? original!.url
   try { /* ... prolaz ... */ } finally { await original?.close() }
   ```
3. **Conductor (`a/flow-dispatch`, tvoj korak 2 iz C-ove poruke):**
   - `TestTask` dobija `flowId?`;
   - kad sve jedinice toka imaju `tests.ready`, daj slobodnom testeru `assign({ flowId })`;
   - testera oslobodi na `flow.tests.ready`;
   - pošto tok bez testova ne šalje ništa, za tokove treba tvoj timeout, kao kod ekrana; posle njega tok ostaje bez testova, a izveštaj kaže „tok nije proveren“.
   - Tester sam ne sluša nijedan događaj, pa sa strane testera nema više šta da se menja.
4. Kapija G3 nad tokovima ostaje za kasnije (dogovor sa korisnikom B).

## Gotovo kad
- `npm run migrate:mock -- examples/todomvc` (bez `--original-url`) sam napravi i servira original, prođe kao i do sada i na kraju zatvori server (nema procesa koji visi).
- Test u `src/orchestration/` pokazuje da Conductor posle `tests.ready` svih jedinica toka dodeli `{ flowId }` slobodnom testeru i oslobodi ga na `flow.tests.ready`.
- Na `migrate:mock` nad planom sa tokom nastanu `tests/flows/<flowId>.json` i (C) `results/flows/<flowId>.json`. Za to treba mock odgovor `tester:<flowId>` u fixture-u; B ga dodaje kad A kaže koji tok i koji primer.

## Odgovor
