# Status: osoba A
Faza: F1
Poslednja izmena: 2026-10-30

## Gotovo (spojeno u main)
- `docs/tasks/a.md`: plan zadataka A0–A19 i pitanja za tim
- A0.0: `zod` 4.6.7, `vitest` 5.0.5, `tsconfig.json`, `vitest.config.ts` (PR #1)
- A0: `src/contracts/` (`scenario`, `difference`, `types`, `state`, `events`, `api`, `index`) i 11 testova u `contracts.test.ts` (PR #1)
- A1: skripte u `package.json`, `.env.example`, `.gitignore` (`output/`, lični Claude fajlovi), `docs/decisions.md`, privremeni `src/cli.ts`, ovaj fajl (PR #1)
- A2: `scripts/check-layers.ts` (7 pravila, 10 testova), uključen u `npm run build`; odluka D-004 (PR #5)
- A3: `index.ts` u `analysis`, `report`, `scenarios`, `verify`, `scaffold` i `gatekeeper`, sa tipovima iz `contracts/api.ts` (PR #5)
- Kapija G0 prošla 2026-10-30 na čistom klonu (`e9b83a0`): build, testovi, `check-layers` pada na Mozaik u domenu, Expo web export (7 s)

- A4: `src/core/config.ts` (modeli, cene, `DEFAULTS` iz §9, formule za broj agenata, `modelForRound`, `costUsd`) i 23 testa
- A5: `src/core/state.ts` (`MigrationState extends RuntimeState`, `createInitialState`), `src/core/runtime.ts` (jedini `defineRuntime`, `board()`, `emit()`) i 7 testova
- `check-layers`: test fajlovi u `core/` smeju da uvoze Mozaik (potrebno za testove runtime-a), uz 1 novi test
- A6: `src/core/log.ts` (`initLog`, `log` → `run.jsonl`) i `src/core/safety.ts` (`installSafety`), 5 testova

## Gotovo, čeka review i spajanje (grana `a/runner`)
- A7: `src/core/runner.ts`: `BudgetedRunner` (retry iznad SDK-ovog, budžet, nikad ne baca grešku, `onUsage`/`onRateLimited`), `MockRunner` (odgovori po `kind:taskId:round`), `loadMockFixture`, `registerContext`, registracija `claude-haiku-5-5`; 16 testova, uključujući pravi Mozaik `runLoop` nad `MockRunner`-om. U `config.ts` dodati `apiRetries` i `apiRetryBaseMs`.

## U radu
- ništa

## Sledeće
- PR `a/runner` → `main` (A7)
- A8 (`agents/_shared/`: `freshContext`, `OwnershipGuard`, `runTask`, `runStructured`), zatim A9 (red zadataka)

## Za kraj F1 (dogovoreno da se tim obavesti tada)
- dopuna `.claude/rules/mozaik.md` §6: pošiljalac mora da uradi `join` pre `emit`/`sendEvent`
- `LogEntrySchema` u `src/contracts/` (D čeka zamenu privremene šeme u `src/report/load.ts`)
- odgovori na D-ova pitanja iz `docs/status/d.md`: Enter korak u DSL-u (`submit`, blokira G2), čišćenje JSON Scheme za structured output (ulazi u A8), događaj `plan.failed`, P4 i P5
- format MockRunner fajla (`MockFixtureSchema` u `core/runner.ts`) za A12, kad B, C i D pišu odgovore svojih agenata

## Važno za tim
- `emit()` / `sendEvent` rade samo ako je pošiljalac prethodno uradio `join` (Mozaik baca `Participant <id> not found`). Važi za Conductor, Gatekeeper-učesnika (C) i sve agente.
- format linije u `run.jsonl` je `LogEntry` iz `src/core/log.ts`: `{ t, agent, event, costUsd?, data? }`; D ga čita za vremensku osu i trošak u izveštaju. Domen sme da koristi `log()`.

## Mockovi koje koristim
- `src/cli.ts` samo javlja „not implemented“, a pravi CLI stiže u A11 i A18

## Čeka odluku tima
- review ugovora: B (`scenario.ts`, `ScenarioResult`, `Coverage`), C (`GateResult`, `UnitResult`, potpisi iz P16), D (`ParsedApp`, `AnalyzerReport`, `Plan`, `SplitParts`)
- pitanja P1–P18 u `docs/tasks/a.md`; P1 i P2 su zapisani kao predlozi D-002 i D-003 u `docs/decisions.md`; P3 i P14 su rešeni kroz D-004
- usklađivanje `architecture.md` §2, `CLAUDE.md` i `tim-plan.md` sa D-004 (`check-layers.ts`)
- cene modela u `config.ts` su prepisane iz wemora-plan §6; pretpostavka da ×5 preko 100k važi za ceo zahtev

## Blokira me
- ništa
