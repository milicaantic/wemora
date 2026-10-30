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

## Gotovo, čeka PR (grana `b/mock-tester`)
- B10 `src/agents/mocks/todomvc/tester.json` (D-013), usklađen sa D-ovim mock planom (`architect.json`, D15): ključ `tester:todo-list`; model pogleda ekran (`aria_snapshot`), proba i sačuva scenario `todo-list-empty-state` (obaveza `empty-state`: `goto /` → `expectVisible "todos"` → `expectNotVisible "items left!"`), pa objasni zašto ostale četiri obaveze ne mogu da se pokriju (nema koraka za Enter).
- **Ručno provereno nad pravim TodoMVC-om**, sa praznim ekranom iz C-ovog `scaffold` nad **D-ovim pravim mock planom** (+ `blankApp`/`serveApp`): scenario iz fajla prolazi `validateScenario`. ARIA snapshot praznog TodoMVC-a ima samo `heading "todos"` i `textbox "New Todo Input"`.
- Test u `agents/tester.test.ts`: pravi tester kroz `MockRunner` sa ovim fajlom stiže do sačuvanog scenarija i `tests.ready`. Ceo repo: 412 testova.
- Usklađeno sa `main`-om posle PR #36 (arhitekta), #37 (builder), #38 (D15 mock odgovori) i #39 (C-ov mock na mestu iz D-013): sva tri TodoMVC mock fajla koriste ekran `todo-list`. A je povezao testera u CLI kako je predloženo u B9 (D-014: `--original-url`, jedan `blankApp` po prolazu).

## B11 (integracija F2): stanje
- `migrate --mock --original-url http://localhost:7002` nad TodoMVC-om stiže do `plan.ready` (D-ov analizator i arhitekta kroz mock, C-ov scaffold), a onda staje: **Gatekeeper (C2.4) još ne postoji**, a Conductor ga pravi pre testera i buildera. Tester zato u prolazu još ne kreće. B11 čeka C2.4.
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

## U radu
- ništa

## Sledeće
- B11 (integracija F2) čim C spoji Gatekeeper-učesnika (C2.4); sve ostalo je povezano
- ponoviti B7 sa C-ovim `serveApp()` (prazan ekran je u B9 već proveren preko `serveApp`)

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
