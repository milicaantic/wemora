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

- D-005 i D-008 prihvaćeni (potvrdili C, B, D i A); usklađeni `architecture.md` §10 i §11 i `tim-plan.md` (PR #28)
- Kapija G1 prošla 2026-10-30 (proverio D)

- plan: grane A10–A18 grupisane u 5 (`docs/tasks/a.md`)
- A10: Conductor, `eventLogger`, lažni agenti, 10 testova; `FIXED_TEAM`; nov događaj `plan.failed` (D-012); pravila za agente u `agents/_shared/handle.ts` i `mozaik.md` §6 (PR #30)

- A11: `wemora migrate` (`src/cli.ts`, `src/orchestration/migrate.ts`, `agents.ts`), `loadMockFixtureDir`, `Conductor.notifyBudgetExceeded()`, D-013 (PR #34)

- povezivanje agenata u CLI (commit `ad80f8c`, greškom direktno na `main` bez PR-a; C radi review naknadno):
- B-ov tester (B8) povezan u `src/orchestration/agents.ts`: `createTester(id, { originalUrl, blankUrl })`, jedan B-ov `blankApp` (B9) po prolazu nad C-ovim `serveApp`, gasi se posle prolaza; `createAgentFactories` vraća `{ factories, close }`
- nova opcija `--original-url <url>` (samo `migrate`, mora http(s)); bez nje tester javlja „pass --original-url (Q8)“; D-014 i `architecture.md` §13 (sa `--mock-dir` iz D-013); 9 novih testova
- C-ov builder (C2.2, PR #37) povezan (`createBuilder(id)`); jedino Gatekeeper-učesnik (C2.4) je još zamena
- D-ov arhitekta (D14, PR #36) povezan; provereno: `migrate --mock` nad TodoMVC-om sada ide analizator → arhitekta → `plan.failed` (bez mock odgovora) → izveštaj, uz `plan.errors.json`

- D-015, za C: `checkDraft({ unit, round, draftDir, tests, webDir })`, `roundsExhausted` opciono, `OwnershipGuard` prima listu putanja (PR #40)

## U radu
- ništa

## Gotovo, čeka review i spajanje (grana `a/wire-gatekeeper`)
- C-ov Gatekeeper-učesnik (C2.4, PR #47) povezan u `src/orchestration/agents.ts` (`createGatekeeper`); zamena „agent još ne postoji“ uklonjena, jer su sada svi agenti pravi; test u `agents.test.ts`
- čeka C (D-016, njegov fajl): handler za `tests.missing` umesto sopstvenog tajmera od 10 min, i ignorisanje nacrta iz ranije runde

## Gotovo, A13 (grana `a/timeouts`, PR #45)
- A13 (D-016): Conductor prekida testera bez `tests.ready` posle 10 min i daje ekran ponovo (iza neprobanih); posle 2. isteka šalje nov događaj `tests.missing { unitId }` (Gatekeeper promoviše `unproven`); builder bez nacrta posle 10 min = neuspela runda; zakasneli događaji iz ranije runde se ignorišu (`event.stale`); nov zadatak prekinutom agentu tek kad stane. Fajlovi: `orchestration/timeouts.ts`, `conductor.ts`, `queue.ts`, `mocks/manualClock.ts`, `mocks/fakeAgents.ts`; `config.ts` (`maxTestAttempts`, `idleCheckMs`); `contracts/events.ts`; pravilo o `cancel` u `agents/_shared/handle.ts`; 9 novih testova; `architecture.md` §5 i §9

## Sledeće
- PR `a/timeouts` → `main`
- `contracts/f1`: Enter korak (`submit`) za TodoMVC (čeka B-ovo „da“, blokira G2), šema `tests/<unitId>.json`, `failedStep`, `LogEntrySchema`, uklanjanje `roundsExhausted` (kad ga C izbaci iz testova)
- B (F3, PD5): `serveOriginal(webDir)`; CLI je koristi kad `--original-url` nije dat
- C (C2.4): Gatekeeper-učesnik; kad bude spojen, zamena u `src/orchestration/agents.ts` postaje `import`

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
- cene modela u `config.ts` su prepisane iz wemora-plan §6; pretpostavka da ×5 preko 100k važi za ceo zahtev

## Blokira me
- ništa
