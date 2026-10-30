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

## Gotovo, čeka review i spajanje (grana `a/config`)
- A4: `src/core/config.ts` (modeli, cene, `DEFAULTS` iz §9, formule za broj agenata, `modelForRound`, `costUsd`) i 23 testa
- A5: `src/core/state.ts` (`MigrationState extends RuntimeState`, `createInitialState`), `src/core/runtime.ts` (jedini `defineRuntime`, `board()`, `emit()`) i 7 testova
- `check-layers`: test fajlovi u `core/` smeju da uvoze Mozaik (potrebno za testove runtime-a), uz 1 novi test
- A6: `src/core/log.ts` (`initLog`, `log` → `run.jsonl`) i `src/core/safety.ts` (`installSafety`), 5 testova

## U radu
- ništa

## Sledeće
- PR `a/config` → `main` (A4, A5, A6)
- A7 (`BudgetedRunner`, `MockRunner`), zatim A8 (`agents/_shared/`) i A9 (red zadataka)

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
