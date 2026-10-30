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
- A7–A9 (PR #20):
- A7: `src/core/runner.ts`: `BudgetedRunner` (retry iznad SDK-ovog, budžet, nikad ne baca grešku, `onUsage`/`onRateLimited`), `MockRunner` (odgovori po `kind:taskId:round`), `loadMockFixture`, `registerContext`, registracija `claude-haiku-5-5`; 16 testova, uključujući pravi Mozaik `runLoop` nad `MockRunner`-om. U `config.ts` dodati `apiRetries` i `apiRetryBaseMs`.
- A8: `src/agents/_shared/`: `freshContext`, `OwnershipGuard`, `CancelGuard`, `composeGuards`, `defineTool`, `toModelSchema` (čišćenje JSON Scheme za Anthropic), `runTask`, `runStructured` (zod provera + najviše 2 ponovna pokušaja), `AgentHandle` i tipovi zadataka; 25 testova kroz pravi Mozaik runtime nad `MockRunner`-om.

- A9: `src/orchestration/queue.ts`: `readyUnits`, `nextForBuilder`, `nextForTester`, `unlockedBy`, `blockedBy`, `isFinished` (čista logika po §9, P7 i P8 po predlogu); 15 testova.
- Moja stavka za G1: `npx vitest run src/core src/agents/_shared src/orchestration scripts` → 102/102.

- usklađeni dokumenti samo tamo gde postoji potvrda (PR #23): `check-layers.sh` → `.ts` i posredna provera (D-004) u `architecture.md` §2, `tim-plan.md` i `CLAUDE.md`; `splitParts`, Conductor čeka sve `analysis.done` i poziva `scaffold()` (nova D-010, potvrda D-a u `docs/status/d.md`); nova D-011 (testovi u `core/` smeju da uvoze Mozaik); ispravljena D-002

## Gotovo, čeka review i spajanje (grana `a/accept-d005-d008`)
- D-005 i D-008 prihvaćeni (A kao vlasnik arhitekture; D-005: C i B; D-008: C i D); usklađeni `architecture.md` §10 (kapije 1, 2 i 4) i §11 (ugovor za buildera: `role`, `accessibilityLabel`) i `tim-plan.md` (C, korak 4)

## U radu
- ništa

## Sledeće
- PR `a/accept-d005-d008` → `main`
- kraj F1: obavestiti tim (spisak ispod), čekaju se odgovori za Y1–Y4 i odluke N1–N6 (vidi „Čeka odluku tima“); kapija G1 (proverava D)
- `contracts/f1`: izmene ugovora koje B, C i D čekaju za F2
- F2: A10 (Conductor)

## Za kraj F1 (dogovoreno da se tim obavesti tada)
- dopuna `.claude/rules/mozaik.md` §6: pošiljalac mora da uradi `join` pre `emit`/`sendEvent`
- `LogEntrySchema` u `src/contracts/` (D čeka zamenu privremene šeme u `src/report/load.ts`)
- odgovori na D-ova pitanja iz `docs/status/d.md`: Enter korak u DSL-u (`submit`, blokira G2), čišćenje JSON Scheme za structured output (ulazi u A8), događaj `plan.failed`, P4 i P5
- format MockRunner fajla (`MockFixtureSchema` u `core/runner.ts`) za A12, kad B, C i D pišu odgovore svojih agenata
- za B, C i D, pre pisanja agenata (F2): koristite `agents/_shared` (`runTask`, `runStructured`, `defineTool`, `OwnershipGuard`), ne pravite svoje; agent mora da uradi `join` pre `runTask`; D: čišćenje šeme za structured output je urađeno (`toModelSchema`); interfejs `AgentHandle` i tipovi zadataka (P6) čekaju potvrdu

## Važno za tim
- `emit()` / `sendEvent` rade samo ako je pošiljalac prethodno uradio `join` (Mozaik baca `Participant <id> not found`). Važi za Conductor, Gatekeeper-učesnika (C) i sve agente.
- format linije u `run.jsonl` je `LogEntry` iz `src/core/log.ts`: `{ t, agent, event, costUsd?, data? }`; D ga čita za vremensku osu i trošak u izveštaju. Domen sme da koristi `log()`.

## Mockovi koje koristim
- `src/cli.ts` samo javlja „not implemented“, a pravi CLI stiže u A11 i A18

## Čeka odluku tima
- review ugovora: B (`scenario.ts`, `ScenarioResult`, `Coverage`), C (`GateResult`, `UnitResult`, potpisi iz P16), D (`ParsedApp`, `AnalyzerReport`, `Plan`, `SplitParts`)
- pitanja P1–P18 u `docs/tasks/a.md`; P1 i P2 su zapisani kao predlozi D-002 i D-003 u `docs/decisions.md`; P3 i P14 su rešeni kroz D-004; P4 i P5 kroz D-010
- usklađivanje koje čeka „ok“ jedne osobe: D-001–D-003 i „contracts: samo zod“ u §2 (C), D-007 (parser na TypeScript-u; kapije su već usklađene kroz D-008), mesto `sabotage` (B, Q14)
- usklađivanje koje čeka odluku tima: B-ovo pravilo 3 („bar jedna“, Q3, Q22), osnova putanja u `writes` (C, PD4), ko sme da prihvati odluku
- uslov iz D-008: `checkDraft` u ugovoru dobija putanje originalnih fajlova jedinice (`contracts/f1`, pre C2.3)
- cene modela u `config.ts` su prepisane iz wemora-plan §6; pretpostavka da ×5 preko 100k važi za ceo zahtev

## Blokira me
- ništa
