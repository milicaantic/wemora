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

- A13 (D-016): timeouti testera i buildera, događaj `tests.missing`, ignorisanje zakasnelih događaja (PR #45)
- C-ov Gatekeeper-učesnik povezan u `agents.ts`; svi agenti su pravi; C je ispravio Gatekeeper po D-016 (PR #48)
- korak `submit` (D-017): ugovor uradio B, kapija 4 i prompt C, plan D (PR #55–#58)
- D-018: modeli kroz `.env`, cene za modele gateway-a (PR #60); D-019 inbox (predlog)
- G2 mock prolaz (`output/20261031-020235-todomvc`): `todo-list` `proven` (5/5 obaveza), runda 1 `gate.failed`, runda 2 promovisan; `main` 467/467 testova

## U radu
- G2 pravi prolaz nad TodoMVC-om: `output/20261031-030034-todomvc` (posle PR #59, #61): `todo-list` `partial`, runda 1 `gate.failed` (toggle all), runda 2 promovisan; filteri kao stanje ekrana. Čeka B (PR #62, spojeno) i D (inbox: obaveze izvodljive na webu) za `proven`

## Gotovo, čeka review i spajanje (grana `a/scaling`)
- D-023: podrazumevani modeli su `claude-haiku-4-5` i `claude-sonnet-4-6` (oni koje gateway nudi), izbačene cene i registracija modela 5-5, `--budget` podrazumevano $5. Kod, testovi (506/506) i dokumentacija (`CLAUDE.md`, `mozaik.md`, `architecture.md`, `tasks/a.md`, `tim-plan.md`, `wemora-plan.md`)
- A15: eskalacija modela. Jedinica ima `DEFAULTS.maxRounds` (4) runde umesto 2; runde 3–4 idu na `MODELS.strong` (`modelForRound`), isti builder, posle 4. neuspele runde `failed` (`unit.failed` „failed after 4 round(s)“). `FIXED_TEAM` obrisan (fiksni tim samo kroz `ConductorOptions.team`). Nov test eskalacije, 4 testa prešla na 4 runde, 509/509; `migrate:mock` nad TodoMVC-om prolazi

## Gotovo (spojeno u main)
- D-022 (PR #68) (na C-ov zahtev, C3.3): ugovor za testove toka. `Scenario.flowId?`, `FlowResultSchema`, tabla `flowTests` i `flowResults`, događaj `flow.tests.ready { flowId }`, `tests/flows/` i `results/flows/`; `architecture.md` §5, §6, §7, §11. 4 nova testa, 493/493. Korak 2 (`a/flow-dispatch`: `TestTask.flowId`, Conductor dodeljuje test toka) posle A15 i A16
- A14 (D-021, PR #66): broj agenata po formulama iz §9 umesto fiksnog tima. `src/orchestration/scaling.ts` (`planAgentCounts`, `Rescaler`: jedna promena u minutu, odbijena se ponovi kad minut istekne), Conductor računa pre svakog `dispatch()`, gasi samo slobodne agente, najmanje 1 builder. Log `agents.rescaled` i `agent.stopped`. 9 novih testova, 489/489. `migrate:mock` nad TodoMVC-om: 1/1/1, `todo-list` `proven`

## Gotovo (spojeno u main), F2 kraj
- D-020: trošak računa i keširane tokene (`a/cache-cost`). `costUsd` dobija `cache` (čitanje 0,1×, upis 1,25×), `BudgetedRunner` čita keš iz `rowResponse.usage`, `model.usage` ima `cacheReadTokens` i `cacheWriteTokens`
- F2 zatvoren po odluci tima (2026-10-31); prelazak na F3

## Sledeće
- proveriti D-020 u pravom prolazu: `model.usage` u `run.jsonl` treba da ima `cacheReadTokens` > 0, a `cost:` na kraju realan iznos
- D-017 prihvatiti (A) i dopisati `submit` u `architecture.md` §11
- G2: provera stavki iz pravog prolaza, rezultat u `runs/todomvc-<vreme>/`
- `contracts/f1`: šema `tests/<unitId>.json`, `failedStep`, `LogEntrySchema`, uklanjanje `roundsExhausted`
- B (F3, PD5): `serveOriginal(webDir)`; CLI je koristi kad `--original-url` nije dat

## Za kraj F1 (dogovoreno da se tim obavesti tada)
- dopuna `.claude/rules/mozaik.md` §6: pošiljalac mora da uradi `join` pre `emit`/`sendEvent`
- `LogEntrySchema` u `src/contracts/` (D čeka zamenu privremene šeme u `src/report/load.ts`)
- odgovori na D-ova pitanja iz `docs/status/d.md`: Enter korak u DSL-u (`submit`, blokira G2), čišćenje JSON Scheme za structured output (ulazi u A8), događaj `plan.failed`, P4 i P5
- format MockRunner fajla (`MockFixtureSchema` u `core/runner.ts`) za A12, kad B, C i D pišu odgovore svojih agenata
- za B, C i D, pre pisanja agenata (F2): koristite `agents/_shared` (`runTask`, `runStructured`, `defineTool`, `OwnershipGuard`), ne pravite svoje; agent mora da uradi `join` pre `runTask`; D: čišćenje šeme za structured output je urađeno (`toModelSchema`); interfejs `AgentHandle` i tipovi zadataka (P6) čekaju potvrdu

## Važno za tim
- `emit()` / `sendEvent` rade samo ako je pošiljalac prethodno uradio `join` (Mozaik baca `Participant <id> not found`). Važi za Conductor, Gatekeeper-učesnika (C) i sve agente.
- **ne pokreći `npm ci` / `npm install` u `output/<run>/app/`**: `app/node_modules` je junction na `templates/expo/node_modules` (C-ov `scaffold`), pa npm isprazni šablon i svaki sledeći prolaz pada na `tsc` kapiji („nema TypeScripta“). Popravka: `npm ci` u `templates/expo`. Desilo se 2026-10-31 u G2 (runda 2 `todo-list`). Predlog za C: zaštita u `scaffold` ili napomena u `app/`
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
