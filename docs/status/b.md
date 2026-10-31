# Status: osoba B
Faza: F2
Poslednja izmena: 2026-10-31

## Gotovo (spojeno u main)
- F0 (PR #3): `docs/tasks/b.md`, folderi, B0 (review ugovora, potvrda D-001–D-003), B1 (`playwright@1.64.1`)
- B2 + B3 (PR #7): `scenarios/compile.ts`, `run.ts` (`runScenarios`), `serve.ts` (`serveStatic`)
- B4 + B5 (PR #11): `validate.ts` (`validateScenario`), `interactive.ts` (`extractInteractive`), `mocks/blank/`, 3 ručna scenarija za Recepte u `mocks/recepti/` (ručno provereni nad Receptima), popravka `expectNotVisible` dok se ekran učitava

- B6 (PR #13): `coverage.ts` (`computeCoverage`); `compile.ts` izvozi `actedOn`, `toTarget`, `sameElement` (pravilo poklapanja je isto kao u izvršiocu)
- `scenarios/index.ts` izvozi `serveStatic` (C ga koristi u `serveApp`)
- potvrde D-001, D-002, D-003, D-005, D-007 i D-008 u `docs/decisions.md`

- B8 (PR #31): agent tester (`agents/tester.ts`, `prompts/tester.md`) i njegov domen (`scenarios/tester.ts`, `ariaSnapshot`). Alati `aria_snapshot`, `try_scenario`, `save_scenario`; čuvaju se samo validni scenariji u `tests/<unitId>.json` i `board.tests`. **Nije probano sa pravim modelom**, samo kroz `MockRunner`.

- B9 (PR #35): `scenarios/blank.ts` (`blankApp(appDir, serveApp)`): prazan ekran u pravom prolazu je placeholder iz `scaffold()`, izvezen jednom i serviran do kraja prolaza, pa ostaje prazan i posle promocija. Tester prima `blankUrl` kao string ili funkciju.

- B10 (PR #41): `src/agents/mocks/todomvc/tester.json` (D-013), usklađen sa D-ovim mock planom: ključ `tester:todo-list`, scenario `todo-list-empty-state` (obaveza `empty-state`), ručno proveren nad pravim TodoMVC-om i placeholderom iz D-ovog plana.

## B11 (integracija F2): mock prolaz radi do kraja
- Posle C-ovog `builder:app-entry:1` (PR #52) i A-ovog povezivanja Gatekeeper-a (PR #49), **`npm run migrate:mock -- examples/todomvc --original-url http://localhost:7002` prolazi ceo tok** (ishod `finished`, ~30 s): `app-entry` promovisan kao `unproven` (zajednička jedinica nema testove); `todo-list` posle namerno lošeg nacrta u rundi 1 promovisan u rundi 2 (svih 5 kapija, uključujući B-ove testove na telefonu) kao **`partial`**. Tester i builder rade istovremeno; Gatekeeper čeka `tests.ready` pre provere ekrana; u `tests/` je samo validiran scenario; pokrivenost iz testera je u `results/todo-list.json`.
- **2026-10-31, posle koraka `submit` (PR #56) i C-ovog usklađenog nacrta: `todo-list` je u mock prolazu `proven`** (5/5 obaveza, 5/5 testova na telefonu, link `TodoMVC` `notPortable`).
- Ostaje: pravi prolaz sa modelom `--budget 1` (G2).

## Spojeno (PR #75): `serveOriginal(webDir)` (D-014, PD5)
- `src/scenarios/original.ts`, izvoz kroz `scenarios/index.ts`: `serveOriginal(webDir, { build?, outDir? })` pokrene `npm run build` u web folderu i servira izlaz (`dist/`) preko `serveStatic` (slobodan port, SPA fallback) → `{ url, close }`. Jasne greške: nema `package.json`, nema `build` skripte, ima zavisnosti a nema `node_modules` („run npm ci“), build pao (poslednjih 15 redova izlaza), nema `index.html` u izlazu. Mock-api (Recepti) ne pokreće: aplikacija čita adresu iz `VITE_API_URL` pri build-u, a mock-api se pokreće ručno (README).
- Testovi: `src/scenarios/original.test.ts` (4), nad lažnim web projektom bez zavisnosti (`mocks/webapp/`, kopira se u privremeni folder).
- **Ručno:** `serveOriginal("examples/todomvc")` (26 s) → svih 5 TodoMVC scenarija prolazi; `serveOriginal("examples/recepti")` (4 s, mock-api pokrenut) → scenario pretrage prolazi.
- **Za A (CLI):** kad `--original-url` nije dat, `migrate` može da pozove `serveOriginal(webDir)` i na kraju `close()`.

## Spojeno (PR #75): tester za tokove (D-022, priprema)
- Tester prima i zadatak toka: `assign({ flowId })` pored `assign({ unitId })` (`TesterTask` u `agents/tester.ts`; `AgentHandle<TesterTask>` se i dalje uklapa u Conductor-ov `AgentHandle<TestTask>`). Tok se vidi kao jedna jedinica (`flowAsUnit`): prvi ekran toka, tok kao jedina obaveza, `notPortable` svih ekrana toka. Ista tri pravila validacije; scenario mora da nosi `flowId` toka, a test ekrana ne sme da ga ima (`scenarioProblem`).
- Čuva u `tests/flows/<flowId>.json` i `board().flowTests[flowId]`, pa šalje `flow.tests.ready { flowId }` (C-ov Gatekeeper ga već sluša). Za tok nema pokrivenosti ni `tests.ready`; bez sačuvanog scenarija ne šalje ništa (`tests.none`). Brief: `flowBrief` (ekrani redom, id-jevi koje treba upisati, do 2 sačuvana testa po ekranu, elementi koje ne sme da koristi). Prompt ima odeljak „Flow tasks“.
- Testovi: 3 nova u `agents/tester.test.ts`, 5 u `scenarios/tester.test.ts`. Ceo repo: 534.
- **Za A (Conductor):** posle F2 da dodeli testeru `{ flowId }` za svaki tok iz plana, oslobodi ga na `flow.tests.ready` (ili `tests.none` / svoj timeout) i doda `flowId` u `TestTask`. Kapija G3 nad tokovima ostaje za kasnije.

## Gotovo, čeka PR (grana `b/sabotage`): B13 `sabotage`
- `src/verify/sabotage.ts`, izvoz kroz `verify/index.ts`: `sabotage(runDir, unitId)` po ugovoru, plus `sabotageDetailed` (vraća šta je promenjeno: fajl, ime, vrsta) za A-ov CLI (A18). `scripts/sabotage.ts` nije potreban: `npm run sabotage` ide kroz `src/cli.ts` (b.md Q14).
- **Kako radi:** samo ekran sa testovima i statusom `proven`/`partial` (inače `verify` ne bi pokazao štetu). Iz testova bira ime koje se traži (labela polja, pa ime sa ulogom, pa vidljiv tekst) i u kodu ekrana `app/src/screens/<unitId>/` ga zameni sa `[sabotaged]`, samo unutar stringa ili JSX teksta (identifikatori ostaju). Menja zadati folder na mestu: pušta se nad kopijom prolaza. Odbija drugu sabotažu istog ekrana i ekran čiji kod ne sadrži nijedno testirano ime.
- Testovi: `src/verify/sabotage.test.ts` (5). Ceo repo: 513 testova.
- **Ručno, sa pravim delovima (G3):** kopija pravog `migrate:mock` prolaza za TodoMVC: `verify` OK → `sabotage todo-list` (labela `New Todo Input`) → `verify` FAILED, padaju tačno 4 testa koja koriste polje, `empty-state` prolazi; originalni prolaz netaknut.

## Spojeno: B12 `verify` (PR #67)
- `src/verify/verify.ts`, izvoz kroz `verify/index.ts`: `verify(runDir)` po ugovoru, plus `verifyDetailed(runDir)` i `formatVerifyReport(details)` za A-ov CLI (A18), koji ispisuje matricu i vraća exit kod.
- **Kako radi (odluke B, 2026-10-31):** učita `plan.json`, `tests/*.json` i `results/*.json` (zod); napravi web export `app/` C-ovim `serveApp` (D-006, Q12) i ako u `app/` nema `node_modules` (run iz `runs/` posle `git clone`), linkuje ga na `templates/expo/node_modules` kao scaffold (treba jednom `npm ci` u `templates/expo`); pusti testove svakog ekrana na telefonu (390×844, iste namerne razlike kao Gatekeeper), ekran po ekran, redom iz plana. **„Prošao“ (Q13):** svi testovi ekrana sa statusom `proven` ili `partial` (oni su prošli kapiju 5) moraju i sada da prođu; ekrani `failed`/`unproven`/bez rezultata se samo ispisuju. Matrica nema vremena trajanja, pa je isti tekst svaki put. Bez Mozaika i API ključa (`check-layers` prolazi). Mock-api za Recepte se za sada pokreće ručno pre `verify`.
- Testovi: `src/verify/verify.test.ts` (4) nad ručnim prolazom u `src/verify/mocks/run/` (lažni `serveApp` servira statičku stranu umesto Expo exporta): prolaz, pokvaren ekran pada samo on, isti ispis dva puta, jasna greška za folder koji nije prolaz. `scenarios/index.ts` sada izvozi i `createRunScenarios` (kraći limiti u testovima). Ceo repo: 484 testa.
- **Ručno, sa pravim delovima:** `verify` nad svežim `migrate:mock` izlazom za TodoMVC: OK, 5/5 testova (7 s); nad kopijom bez `node_modules`: sam napravi link, OK (13 s); posle izmene teksta „Clear completed“ u `app/src/screens/todo-list/index.tsx`: FAILED, padaju tačno 2 testa koja koriste to dugme.
- **Novi zadatak za B (D-014, PD5):** `serveOriginal(webDir)` koja sama pokreće original, da `--original-url` ne bi bio obavezan („radi iz README-a“, F3).

## Gotovo, čeka PR (grana `b/tester-gives-up`): A-ova poruka `docs/inbox/2026-10-31-a-to-b-tester-gives-up-and-logs.md`
- **Log razloga:** posle svakog neuspelog `try_scenario`/`save_scenario` tester upiše `tester.try_failed` / `tester.save_failed` `{ unitId, scenarioId, obligation, problem }` (prvih 300 znakova razloga) u `run.jsonl`.
- **Odustajanje (u kodu, ne samo u promptu):** posle `MAX_FAILURES_PER_OBLIGATION` (3) neuspeha za istu obavezu alat modelu kaže „Give up on obligation X … move to the next one: …“ i loguje `tester.obligation_skipped`; nov pokušaj za tu obavezu se odbija bez validacije. Prompt objašnjava pravilo.
- **Kraj bez čekanja limita:** kad je svaka obaveza sačuvana ili napuštena, a elementi pokriveni (ili model 3 puta zaredom ne napreduje), tester sam završi (sopstveni `CancelGuard`, nije prekid spolja) i pošalje `tests.ready`; `tester.finished` ima `reason` i listu `givenUp`.
- Testovi u `agents/tester.test.ts`: 3 neuspeha → `tester.obligation_skipped`, kraj pre ostatka odgovora modela, razlozi u logu; napuštena obaveza se odbija bez validacije, ostale se nastavljaju. Ceo repo: 474 testa. Pravi prolaz sa modelom nad TodoMVC-om nije pušten (treba API ključ).

## Spojeno: korak `submit` (PR #56, D-017 predlog)
- **Korak `submit` (D-017, predlog):** `{ submit: { label, value } }` u `StepSchema` (+ test ugovora): upis u polje pa Enter; na telefonu `TextInput onSubmitEditing`.
- B-ov deo (A-ove stavke 1–5): `compile.ts` (akcija `submit`, meta kao `fill`, pa ga pokrivenost, `notPortable` i `reveal` vide kao korišćenje polja; nepoznat korak sada obara `tsc` umesto da se tiho izvrši kao `expectNotVisible`), `run.ts` (`fill` pa `press("Enter")`), `validate.ts` (`submit` je radnja za pravilo 3), `prompts/tester.md` (red u tabeli, pravilo 3, kada koristiti `submit`), `mocks/todomvc/tester.json` (5 scenarija za svih 5 obaveza `todo-list`; dovršavanje preko „❯ Toggle All Input“, jer checkbox jednog zadatka nema ime). Testovi: kompajler, izvršilac (strana `mocks/static/zadaci.html`, samo Enter dodaje zadatak), validacija, pokrivenost, ugovor. Ceo repo: 465 testova.
- Stavka 6 provereno: Enter u RN `TextInput` na Expo web exportu (390×844) okida `onSubmitEditing`.
- **Pravo: svih 5 scenarija prolazi `validateScenario`** nad pravim TodoMVC-om i placeholderom iz D-ovog plana; pokrivenost `todo-list`: 5/5 obaveza, polje `New Todo Input` pokriveno kroz `submit`, link `TodoMVC` `notPortable` → kad nacrt prođe testove, ekran može biti `proven`.
- **Za C, pre spajanja:** sa novim testovima `migrate:mock` daje `todo-list: failed`, jer C-ov mock nacrt (runda 2) nema linkove „Active“, „Completed“ i „All“ (kapija 4 `labels`). C treba da uskladi `builder.json` sa spiskom koraka (vidi poruku C-u) i da kapija 4 proverava i `submit.label`; najbolje da C-ov nacrt i ova grana budu spojeni zajedno.

## Odluke u B8 i B9 (čekaju potvrdu tima)
- **B9, ograničenje:** placeholder je potpuno prazan (nema ni zajedničkih delova kao što je meni), pa pravilo 2 **ne odbija** scenario koji proverava samo tekst iz zajedničkog dela aplikacije (npr. naslov „Recepti“ iz bočnog menija). Kriterijum iz b.md B9 („scenario koji proverava samo zajednički naslov biva odbijen“) zato nije ispunjen. Takav scenario sprečava samo prompt („ne proveravaj naslov ili meni koji imaju svi ekrani“). Bolji prazan ekran (aplikacija sa promovisanim zajedničkim jedinicama) ne postoji kad testeri kreću, jer talas 0 tada tek počinje.
- **Za A (CLI, A11):** `const blank = blankApp(path.join(runDir, "app"), serveApp)`, tester kao `(id) => createTester(id, { originalUrl, blankUrl: blank.url })`, i `blank.close()` na kraju prolaza.
- **`tests.ready` (b.md Q10):** šalje se jednom, **na kraju petlje**, ako je sačuvan bar jedan scenario, i kad nisu pokrivene sve obaveze (status ekrana tada postaje `partial`). Bez ijednog scenarija se ništa ne šalje (u log ide `tests.none`), pa jedinicu posle timeouta dobija drugi tester. Ovo se razlikuje od b.md B8 kriterijuma 4 („tek kad su sve obaveze pokrivene“), jer bi inače ekran bez pune pokrivenosti ostao zauvek bez testova.
- **Rute sa parametrima** (`/recepti/:id`): `extractInteractive` ne može da otvori rutu sa `:id`, pa tester za takav ekran ne dobija listu elemenata (samo obaveze); u promptu piše da otvori rutu sa pravom vrednošću.
- **Usklađeno sa Conductor-om (A10, PR #30)** po pravilima iz `agents/_shared/handle.ts`: fabrika `createTester(id, deps)` (CLI vezuje `deps`), `name: id`, bez `join`, `emit` sa sopstvenog učesnika, tabla i fajl pre događaja, jedan `assign` = jedan zadatak, greške uhvaćene u `assign`. Build i 336 testova prolaze zajedno.
- **Za A (CLI, A11):** CLI mora da pokrene original (Q8); prazan ekran daje `blankApp` (B9, gore).
- **Za A (A13, timeouti):** Conductor oslobađa testera samo na `tests.ready`. Tester koji ne sačuva nijedan scenario ne šalje ništa (po pravilu „Conductor čeka“), pa ostaje zauzet u Conductor-u. U F2 postoji samo 1 tester (`FIXED_TEAM`), pa bi stalo testiranje svih ostalih ekrana dok A13 ne doda timeout. Predlog za A13: posle isteka osloboditi testera i dati jedinicu drugom.

## Urađeno ručno (F1, bez PR-a)
- B7 (G1): **ceo put bez AI-ja radi.** Scenario `shopping-list/add-item`:
  1. prolazi `validateScenario` (original: pokrenuti Recepti; prazan ekran: RN placeholder kao iz scaffolda, Expo web export);
  2. prolazi nad ručno napisanim RN ekranom (`TextInput accessibilityLabel`, `Pressable role="button"`, `role="list"`), Expo web export, 390×844;
  3. pada nad placeholderom sa porukom `fill field labelled "Namirnica": not found on screen within 5000 ms`;
  4. `computeCoverage` za `shopping-list`: 1/4 obaveze, 2/2 elementa.
  - **Napomena:** C-ov `serveApp()` još nije spojen, pa je umesto njega korišćen isti put po D-006 (`expo export --platform web` + moj `serveStatic`). Kad C spoji `serveApp`, proveru treba ponoviti sa njim. RN ekran je bio u privremenom folderu, ne u repou.

## Odluke (B4/B5, dogovoreno sa B; tim još treba da potvrdi)
- **Pravilo 3** (`architecture.md` §11): za svaku radnju (`tap`/`fill`) iza koje slede provere, **bar jedna** od tih provera mora da padne kad se pusti pre radnje. Doslovno čitanje („svaka provera“) odbija i primer iz `wemora-plan.md` §4.1. Radnje su samo `tap` i `fill`, ne `goto`. Treba zapis u `docs/decisions.md`.
- **Pravilo 2**: nad praznim ekranom se pušta samo `steps` (bez `setup`), u 390×844, bez `reveal`. Pad već na `goto` znači da se prazan ekran ne učitava, pa se scenario ne prihvata.
- **B5, ponovljeni redovi**: od redova tabele/liste (`row`, `listitem`) računaju se samo elementi prvog reda koji ih ima. Tester u promptu (B8) dobija pravilo „za liste koristi prvu stavku“.
- **B5, meni**: ako stranica ima `main`, elementi se uzimaju samo iz njega; zajednički meni ne ulazi u pokrivenost ekrana.
- Iz B2/B3 i dalje važe: `failedStep` = indeks u `steps` (pad u `setup` → bez `failedStep`, `error` počinje sa `setup: step N:`); poklapanje teksta po b.md Q2; vremenski limiti su konstante u `run.ts` (Q20).

## Spojeno: pokrivenost i D-016 u testeru (PR #51)
- Tester upiše `board().coverage[unitId]` (`computeCoverage`) **pa tek onda** pošalje `tests.ready`; Gatekeeper ga čita u `computeStatus` i u `results/<unitId>.json`. Posle `cancel` spolja tester ne šalje `tests.ready`; sopstveni limit `testerUnitTimeoutMs` (8 min) završava zadatak sa onim što je sačuvano.

## Gotovo, čeka PR (grana `b/tester-catchall`)
- **Popravka:** ekran sa rutom koja hvata sve (`*`, TodoMVC) tester je otvarao na `/*`, što je 404 na običnom statičkom serveru, pa je lista interaktivnih elemenata tiho ostajala prazna i pokrivenost elemenata se nije proveravala. Sada `openablePath` (`scenarios/tester.ts`) otvara `*` na `/` i `/docs/*` na `/docs/`; rute sa `:id` ostaju bez liste elemenata. U zadatku za model piše gde se ruta otvara. Provereno pravim `migrate:mock`: `todo-list` sada ima 2 elementa (`New Todo Input`, link `TodoMVC`).
- Testovi: `openablePath` i napomena u zadatku (`scenarios/tester.test.ts`), tester za `*` otvara `/` (`agents/tester.test.ts`). Ceo repo: 458 testova.

## Usklađenost sa C2.3 i C2.4 (PR #44, #47) i A13 (PR #45)
- `checkDraft` zove `runScenarios(url, tests, { viewport: 390×844, differences: unit.intentionalDifferences })` po ugovoru; `failedStep` čita kao indeks u `steps` (prikazuje ga +1), a scenario bez rezultata računa kao pao.
- B7 „ponoviti sa `serveApp`“ je pokriven: C-ov `src/gatekeeper/g1.test.ts` pušta B-ov scenario kroz `runScenarios` preko pravog `serveApp`.
- Gatekeeper-učesnik čita testove iz `board().tests` (tester ih tu upisuje) i čeka `tests.ready`: usklađeno.
- C je po D-016 dodao reakciju na `tests.missing` (ekran ulazi kao `unproven`) i ignorisanje zakasnelog nacrta (PR #48); prompt buildera ima checkbox i `Link` (predlog uz D-005). Usklađeno sa testerom; build i 455 testova prolaze.
- A je povezao Gatekeeper u CLI (PR #49), a C dodao mock buildera za `app-entry` (PR #52): mock prolaz nad TodoMVC-om radi do kraja (vidi B11).

## Gotovo: B14 (pokrivenost → status → izveštaj), bez novog koda kod B
- Koraci 1–4 iz `docs/tasks/b.md` su već pokriveni spojenim radom:
  1. tester računa pokrivenost i stavlja je na tablu pre `tests.ready`, a Gatekeeper je upisuje u `results/<unitId>.json`;
  2. C-ov `computeStatus` prima pokrivenost, a `notPortable` ne kvari `proven` (`status.test.ts`);
  3. D-ov izveštaj čita `results.coverage`;
  4. C-ov `status.test.ts` ima oba slučaja: puna pokrivenost daje `proven`, a element koji fali daje `partial`.
- **Rupa:** Gatekeeper je upisivao `scenarios: []` u `results/`, pa je izveštaj za dokazan ekran pisao „nije pušten“. D je to prijavio C-u, a C je popravio u PR #83, bez promene ugovora.
- **Provera (2026-10-31)** nad `migrate:mock -- examples/todomvc` (`output/20261031-160553-todomvc`):
  - `results/todo-list.json` ima 5 rezultata testova, svi `ok`, a status je `proven`;
  - `report.html` pokazuje 5 ✓ i „5/5 obaveze, 1/1 elemenata“, što se slaže sa `results/`;
  - `verify` daje OK 5/5, a posle `sabotage` FAILED 1/5.
- Grana `b/coverage-status` nije bila potrebna. Kriterijum „pravi prolaz nad Receptima“ prelazi u kapiju G3 (korak 2), jer traži API ključ.

## A18 proveren kroz CLI (2026-10-31, PR #78)
- Nad kopijom `runs/todomvc-mock-20261031-1454`, bez API ključa:
  1. `npm run verify` → `OK: 5/5`, exit 0;
  2. `npm run sabotage -- <kopija> todo-list` → `"New Todo Input" (label)`, exit 0;
  3. `verify` → `FAILED: 1/5`, padaju tačno 4 testa koja koriste polje.
- Original u `runs/` je netaknut.

## U radu
- ništa

## Sledeće
- pravi prolaz `npm run migrate -- examples/todomvc --budget 1` (G2), uz API ključ; od D-025 (PR #85) `--original-url` nije potreban
- kapija G3 (sa koracima iz B14 i tokovima): pravi prolaz nad Receptima, `verify`, `sabotage`, `report.html`
- tokovi: A je povezao dodelu u Conductor-u (D-025). Za mock prolaz sa `tests/flows/` treba mock odgovor `tester:favorite-flow` za Recepte, kad C doda mock odgovore buildera za Recepte.
- napomena za kasnije: tester toka koji ništa ne sačuva šalje samo log `tests.none`, pa Conductor čeka svoj timeout (10 min, 2 pokušaja) pre kraja prolaza

## Mockovi koje koristim
- `src/scenarios/mocks/static/` i `mocks/blank/` umesto pravih aplikacija, samo u testovima
- `apiFixture` se prenosi, ali se ne primenjuje: D je odgovorio (Q1: `POST /__fixture` pre, `POST /__reset` posle), ali `runScenarios` nema adresu mock-api-ja dok A ne reši Q8

## Čeka odluku tima
- A: komentar za `ScenarioResult.failedStep`
- A: zajednička šema za `tests/<unitId>.json` (niz `Scenario`); do tada `scenarios/tester.ts` koristi `z.array(ScenarioSchema)`
- A: URL originala i mock-api-ja u `RunConfig` ili drugom ugovoru (b.md Q8); posle toga uključujem `apiFixture`, a tester prestaje da ih prima kao parametre
- C: dopuna prompta buildera za D-005 (`role="checkbox"`, `Link`/`role="link"`)
- D (TodoMVC, taster Enter): DSL nema korak za Enter, pa se u TodoMVC ne može dodati zadatak. Predlog D: nov korak `{ submit: { label } }` (promena ugovora). Odluka B/A otvorena. Do tada TodoMVC može biti najviše „delimično dokazan“ (samo `shows-header`).

## Blokira me
- ništa
