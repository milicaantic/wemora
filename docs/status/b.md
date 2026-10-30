# Status: osoba B
Faza: F2
Poslednja izmena: 2026-10-30

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
- `todo-list` je `partial`, ne `proven`: pokrivena je 1 od 5 obaveza (`empty-state`) i nijedan od 2 elementa (`New Todo Input`, link `TodoMVC`). Ostale obaveze traže dodavanje zadatka, a to ide samo Enter-om: **bez koraka `submit` TodoMVC ne može biti dokazan (G2)**.
- Ostaje: pravi prolaz sa modelom `--budget 1` (G2), i odluka o `submit`.
- **Novi zadatak za B (D-014, PD5):** `serveOriginal(webDir)` koja sama pokreće original, da `--original-url` ne bi bio obavezan („radi iz README-a“, F3).

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

## U radu
- ništa

## Sledeće
- pravi prolaz `npm run migrate -- examples/todomvc --original-url http://localhost:7002 --budget 1` (G2), uz API ključ
- F3: `serveOriginal(webDir)`, B12 `verify`, B13 `sabotage` (ne zavise od drugih)

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
