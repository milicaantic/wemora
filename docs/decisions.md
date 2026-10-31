# Wemora — odluke

Ovde se beleži svaka odluka koja menja ili dopunjuje `docs/architecture.md` ili `src/contracts/`, kao i rezultati spike-ova. Pre predloga promene arhitekture ili ugovora pročitaj ovaj fajl.

Novi zapis ide na kraj, sa sledećim brojem. Odluka važi tek kad je status „prihvaćeno“.

## Šablon

```markdown
## D-000: Kratak naslov
- Datum: GGGG-MM-DD
- Ko: A/B/C/D
- Status: predlog | prihvaćeno | odbijeno | zamenjeno sa D-xxx
- Odluka: šta tačno važi od sada.
- Zašto: razlog u 1–3 rečenice.
- Posledice: koji fajlovi ili delovi se menjaju.
```

---

## D-001: `zod` 4 i `vitest` 5 kao osnovne zavisnosti
- Datum: 2026-10-30
- Ko: A
- Status: predlog (B potvrdio 2026-10-30; čeka ostatak tima)
- Odluka: `zod@4.6.7` za sve šeme u `src/contracts/`, `vitest@5.0.5` za testove.
- Zašto: zod 4 ima `z.toJSONSchema()`, potreban za Mozaik `structuredOutput`; bez njega treba još jedna biblioteka. Vitest navode `CLAUDE.md` i `tim-plan.md`.
- Posledice: Vitest 5 traži Node ≥ 22.12, a `.nvmrc` sada kaže samo `22`.

## D-002: `zod` je jedini spoljni uvoz u `src/contracts/`
- Datum: 2026-10-30
- Ko: A
- Status: predlog (B potvrdio 2026-10-30; čeka ostatak tima; `docs/tasks/a.md`, P1)
- Odluka: `src/contracts/` uvozi samo `zod` i sopstvene fajlove.
- Zašto: `architecture.md` §2 kaže da `contracts/` ne uvozi ništa, a tim-plan F0 traži zod šeme u `contracts/`.
- Posledice: `scripts/check-layers.ts` (D-004) propušta `zod` u `contracts/`.

## D-003: Oblik table se u ugovorima zove `MigrationStateFields`
- Datum: 2026-10-30
- Ko: A
- Status: predlog (B potvrdio 2026-10-30; čeka ostatak tima; `docs/tasks/a.md`, P2)
- Odluka: `src/contracts/state.ts` izvozi `MigrationStateFields`, a `src/core/state.ts` izvozi `class MigrationState extends RuntimeState implements MigrationStateFields`.
- Zašto: `contracts/` ne sme da uvozi Mozaik `RuntimeState`, pa oblik i klasa ne mogu da imaju isto ime.
- Posledice: `architecture.md` §6 i dalje kaže `MigrationState`, što je ime klase u `core/`.

## D-004: Provera slojeva je `scripts/check-layers.ts`, ne `.sh`
- Datum: 2026-10-30
- Ko: A
- Status: prihvaćeno (A; niko u timu nema Git Bash)
- Odluka: provera slojeva je TypeScript skripta koju `npm run build` pokreće preko `tsx`. Domen ne sme da zavisi od `@mozaik-ai/core` ni posredno, preko drugih fajlova.
- Zašto: na Windowsu `npm run build` ide kroz `cmd.exe`, a bez Git Bash-a `bash` ne postoji ili je WSL. Uvoze čita TypeScript (`ts.preProcessFile`), koji je već instaliran, pa nema nove zavisnosti. Posredna provera rešava `docs/tasks/a.md` P3 bez spiska dozvoljenih `core/` fajlova.
- Posledice: `architecture.md` §2, `CLAUDE.md` i `tim-plan.md` usklađeni 2026-10-30 (grana `a/align-f1`).

## D-005: Spike A — Playwright selektori rade na Expo webu, uz obavezan `role`
- Datum: 2026-10-30
- Ko: C
- Status: prihvaćeno 2026-10-30 (autor C; B potvrdio; A kao vlasnik arhitekture). Usklađeno u `architecture.md` §11.
- Potvrda (B): slaže se sa izvršiocem testova (`src/scenarios/run.ts`: `getByRole`/`getByLabel` sa tačnim imenom, `getByText`); u B7 provereno nad Expo web exportom sa `TextInput accessibilityLabel` i `Pressable role="button"`. Predlog dopune za prompt buildera (C2.1), jer testovi Recepata traže i ove uloge: checkbox → `role="checkbox"` + `aria-checked` + ime stavke kao labela; link → Expo Router `Link` (na webu `<a>`) ili `role="link"`, a ne `Pressable` sa `router.push` bez uloge.
- Odluka: ostajemo na selektorima po labeli, ulozi i tekstu, **bez** `testID` ugovora. Builder **mora** da stavi `role="button"` na svaki `Pressable` koji je na webu dugme i `role="list"` / `role="listitem"` na liste. Polja dobijaju `accessibilityLabel` sa istom labelom kao na webu.
- Zašto: ručni RN ekran (Expo SDK 58, `react-native-web` 0.21, statički web export, viewport 390×844), provereno skriptom `templates/spike-a/check.ts`:

  | Selektor | RN zapis | Rezultat |
  |---|---|---|
  | `getByLabel("Pretraga")` + `fill` | `TextInput accessibilityLabel="Pretraga"` | radi, `fill` menja stanje |
  | `getByRole("button", { name })` + `click` | `Pressable` + `Text`, **bez uloge** | **ne radi** (renderuje se kao `<div tabindex="0">`) |
  | `getByRole("button", { name })` + `click` | `Pressable role="button"` | radi, okida `onPress` |
  | `getByRole("button", { name })` + `click` | `Pressable accessibilityRole="button"` | radi, okida `onPress` |
  | `getByText("Traži")` + `click` | `Pressable` + `Text`, bez uloge | radi, okida `onPress` |
  | `getByText(...)` | stavka u `FlatList` | radi |
  | `getByRole("listitem")` | `FlatList`, bez uloga | **ne radi** (nema `list`/`listitem` u ARIA stablu) |
  | `getByRole("list")` / `getByRole("listitem")` | `View role="list"` / `View role="listitem"` | radi |

- Posledice:
  - `src/agents/prompts/web-to-rn.md` i `builder.md` (C2.1): `button` → `Pressable role="button"` + `Text`; `ul/li` → `role="list"` / `role="listitem"`; `input` → `TextInput accessibilityLabel`.
  - Kapija 4 `labels` (C1.4) može da proverava i da `Pressable` sa tekstom dugmeta iz testova ima `role="button"`.
  - Expo Router `Stack` prikazuje naziv rute kao naslov (u ARIA stablu: `heading "index"`). Scaffold (C1.3) treba da postavi pravi naslov ili sakrije zaglavlje, da tekst rute ne smeta `getByText`.

### Usputni nalazi
- **Greška pri renderovanju jednog ekrana** (dev server, Metro): ostali ekrani rade, Metro ostaje živ; pokvaren ekran je prazan, greška je u konzoli browsera i u Metro logu (`WARN An error occurred in the <BrokenRender> component`).
- **Sintaksna greška u jednom ekranu ruši celu aplikaciju** na dev serveru: Metro ostaje živ, ali bundle vraća 500, pa ni ispravni ekrani ne rade. Gatekeeper zato mora da pusti kapiju 1 (`parse`) **pre** nego što nacrt dođe u aplikaciju koju Metro služi.
- Sa `CI=1` Metro **ne prati izmene fajlova**: novi fajl se ne vidi bez ponovnog pokretanja. Bitno za C1.2/C1.5 ako se koristi dev server.
- **`expo export --platform android` radi bez uređaja i emulatora** (~16 s sa toplim kešom, ~88 s prvi put). Kapija 6 je izvodljiva.
- Web export šablona + ovog ekrana: ~71 s prvi put (hladan keš).

## D-006: Gatekeeper koristi statički web export, ne Metro dev server
- Datum: 2026-10-30
- Ko: C
- Status: prihvaćeno (C, po pravilu iz `docs/tasks/c.md` C1.2: ispod ~30 s → statički export svuda)
- Odluka: Gatekeeper (kapija 5, regresija), `serveApp` i `verify` koriste `npx expo export --platform web` (`web.output: "single"`) i serviraju izlazni folder kao statičke fajlove. Metro dev server se ne koristi.
- Zašto: izmereno skriptom `templates/spike-a/measure.ts` (Node 22, 3 kruga po slučaju):

  | Ekrana | Slučaj | Prosek | Min–max |
  |---|---|---|---|
  | 1 | hladno (`--clear`) | 50,0 s | 44,9–53,9 s |
  | 1 | toplo, bez izmena | 5,4 s | 5,2–5,8 s |
  | 1 | toplo, izmenjen jedan ekran | 6,3 s | 5,9–6,4 s |
  | 5 | hladno (`--clear`) | 52,4 s | 46,8–63,3 s |
  | 5 | toplo, bez izmena | 5,6 s | 4,9–6,7 s |
  | 5 | toplo, izmenjen jedan ekran | 6,2 s | 6,0–6,5 s |
  | 1 | nov folder, postojeći keš | ~12 s | jedno merenje |

  Realan slučaj za Gatekeeper (izmenjen jedan ekran) je ~6 s i ne raste sa brojem ekrana. Dev server ima i dodatne mane (D-005): sa `CI=1` ne vidi nove fajlove, a sintaksna greška u jednom ekranu obori sve ekrane.
- Posledice:
  - `serveApp` (C1.5): export + mali statički server sa SPA rezervom (nepoznata putanja → `index.html`), primer u `templates/spike-a/check.ts`.
  - Prvi export u prolazu traje ~50 s (hladan keš). Keš je zajednički za sve foldere, pa ga treba „zagrejati“ jednom na početku prolaza, npr. odmah posle `scaffold()`.
  - Nikad ne pozivati export sa `--clear` u Gatekeeperu.
  - Napomena (D-009): red „nov folder, postojeći keš ~12 s“ ne važi; taj export je davao aplikaciju bez ruta. Svaka aplikacija sada ima svoj keš.

## D-007: Parser koristi TypeScript compiler API, ne Babel ni ts-morph
- Datum: 2026-10-30
- Ko: D
- Status: predlog (B potvrdio 2026-10-30; čeka ostatak tima)
- Odluka: `parseApp` (`src/analysis/`) parsira `.js`, `.jsx`, `.ts` i `.tsx` sa `typescript` paketom (`ts.createSourceFile`, a za sintaksne greške `ts.transpileModule` sa `reportDiagnostics`). Nova zavisnost ne treba.
- Zašto: `typescript` je već u `package.json` i koristi ga `scripts/check-layers.ts`. `wemora-plan.md` §6 kaže „ts-morph ili Babel“, ali oba bi bila nova zavisnost za isti posao. Kapija `parse` (C, `architecture.md` §10) može da ostane na Babel-u ili da koristi isti API; to je odluka C.
- Posledice: `typescript` se koristi i u toku rada, ne samo pri proveri tipova. Sada je u `devDependencies`, kao i `tsx` kojim se CLI pokreće, pa se ništa ne lomi; ako tim odluči da pravi produkcioni paket, `typescript` prelazi u `dependencies`.

## D-008: Kapije 1–4 čitaju kod TypeScriptom; `labels` proverava samo tekst koji postoji u originalu
- Datum: 2026-10-30
- Ko: C
- Status: prihvaćeno 2026-10-30 (autor C; D i B potvrdili sve tri tačke; A kao vlasnik arhitekture). Usklađeno u `architecture.md` §10 i `tim-plan.md`. Uslov: `checkDraft` u ugovoru dobija putanje originalnih fajlova jedinice (`contracts/f1`, pre C2.3).
- Potvrda (B): tačka 3 je potrebna, jer ručni scenariji za Recepte (`src/scenarios/mocks/recepti/`) proveravaju tekst iz podataka. `reveal` dugmad (npr. „Filteri“) nisu u testovima, jer ih ubacuje prevodilac testova, pa ih proverava tek kapija 5.
- Odluka:
  1. Kapije `parse`, `forbiddenApis` i `labels` čitaju nacrt TypeScript compiler API-jem (kao parser u D-007), ne Babelom. Kapija `tsc` koristi TypeScript iz šablona (`templates/expo`), nad privremenom kopijom `app/` sa nacrtom.
  2. `forbiddenApis` odbija **svaki** JSX tag malim slovom (`div`, `span`, `p`, `button`, `input`…), jer u RN nema HTML elemenata, i za svaki predlaže RN zamenu.
  3. `labels` proverava labelu polja (`fill.label`), naziv elementa sa ulogom (`tap { role, name }`) i tekst (`tap { text }`, `expectVisible`) **samo ako se ta vrednost doslovno pojavljuje u originalnom web kodu jedinice** (`Unit.sources`). Ostalo dolazi iz podataka i preskače se. Traži se u nacrtu i u `app/src/shared/` (već promovisane zajedničke jedinice). `expectNotVisible` se ne proverava.
- Zašto: (1) Babel nije u glavnom `package.json`, a TypeScript jeste; isti parser kao D-007. (2) `div` i `span` iz `architecture.md` su samo primeri; svaki HTML tag ruši RN. (3) Testovi sadrže tekst iz podataka („Sarma“, „Kupljeno: 0 od 1“, „Dodaj u omiljene: Sarma“) koji nikad ne može da bude u kodu ekrana; bez ovog pravila kapija bi odbijala dobre nacrte.
- Posledice: `architecture.md` §10 („Babel parsira“) treba uskladiti (A). `checkDraft` (C2.3) mora da prosledi apsolutne putanje `Unit.sources`.

## D-009: Svaka Expo aplikacija ima svoj Metro keš
- Datum: 2026-10-30
- Ko: C
- Status: prihvaćeno (C; popravka greške, ne menja ugovore)
- Odluka: `templates/expo/metro.config.js` postavlja Metro keš u `<app>/.expo/metro-cache`, umesto zajedničkog keša u sistemskom `tmp`.
- Zašto: aplikacije iz `scaffold()` dele `node_modules` šablona preko linka. Sa zajedničkim kešom, export nove aplikacije (novi folder) uzima iz keša spisak ruta **prethodne** aplikacije: export uspeva, ali stranica javlja „No routes found“ i nijedan ekran se ne otvara. Sa `--clear` radi, bez njega ne. Uhvatio ga je zajednički G1 test (`src/gatekeeper/g1.test.ts`).
- Posledice:
  - prvi export nove aplikacije je hladan (~50–100 s), sledeći nad istom aplikacijom ~6 s (D-006 i dalje važi: Gatekeeper ceo prolaz koristi isti `app/`);
  - `npm test` traje ~2,5 min zbog jednog hladnog exporta u G1 testu; testovi za `serveApp` su spojeni u isti fajl da se keš zagreva jednom.

## D-010: Conductor vodi tok posle analize: deli rute, čeka sve `analysis.done`, poziva `scaffold()`
- Datum: 2026-10-30
- Ko: A
- Status: prihvaćeno (A i D; `docs/status/d.md`: „Odgovori na P4 i P5: slažem se sa predlozima“)
- Odluka:
  1. `parseApp()` vraća `ParsedApp` sa jednim delom. Conductor računa broj analizatora N (`architecture.md` §9) i deli rute pozivom `splitParts(parsed, N)` iz `analysis/` (D).
  2. Conductor čeka **sve** `analysis.done`, pa tek onda pokreće arhitektu. Arhitekta ne sluša `analysis.done`.
  3. Na `plan.ready` reaguje Conductor i poziva `scaffold()`. Domenske funkcije ne slušaju događaje.
- Zašto: N zavisi od `totalTokens`, koji daje tek `parseApp`, pa podela mora biti posebna funkcija (`docs/tasks/a.md`, P4). Conductor već zna N i dodeljuje sve zadatke (P5). `scaffold()` je domen, a domen ne sme da uvozi Mozaik (`architecture.md` §2, invarijanta 1), pa ne može da bude učesnik.
- Posledice: usklađeni `architecture.md` §3, §4 i §5 i `tim-plan.md` (D, korak 2). `tim-plan.md` F2 (A) je već tako pisao. Kod: `splitParts` postoji (D7, PR #10), Conductor dolazi u A10.

## D-011: Test fajlovi u `src/core/` smeju da uvoze Mozaik
- Datum: 2026-10-30
- Ko: A
- Status: prihvaćeno (A; tiče se samo `src/core/` i `scripts/check-layers.ts`, oba su A-ova)
- Odluka: pravilo `core-mozaik` u `scripts/check-layers.ts` važi za kod u `src/core/`, ali ne i za `*.test.ts` u njemu. Pravilo za domen (`domain-no-mozaik`) i dalje važi i za testove.
- Zašto: testovi za `core/runtime.ts` i `core/runner.ts` trebaju prave Mozaik učesnike (`createHuman`, `createAgent`) da provere događaje i petlju. Testovi se ne izvršavaju u prolazu, pa ne utiču na to da `verify` radi bez Mozaika.
- Posledice: nema izmena u `architecture.md`; test u `scripts/check-layers.test.ts` proverava oba slučaja (uvedeno u A5).

## D-012: Događaj `plan.failed` kad arhitekta odustane
- Datum: 2026-10-30
- Ko: A
- Status: prihvaćeno (A; predlog D, PD2 u `docs/tasks/d.md`)
- Odluka: u `src/contracts/events.ts` postoji događaj `plan.failed` sa praznim payload-om `{}`. Arhitekta ga šalje kad ni posle ponovnih pokušaja (`architecture.md` §4, korak 4) nema plan koji prolazi `validatePlan()`. Conductor tada završava prolaz sa ishodom `plan.failed` i ipak pravi izveštaj. Greške plana arhitekta može da upiše u log; payload nosi samo ID-jeve (invarijanta 5), pa ih ne nosi.
- Zašto: bez događaja Conductor ne zna da plan neće stići i čeka zauvek.
- Posledice: `architecture.md` §4 (korak 4) i §5 (tabela događaja). D-ov arhitekta (D14) šalje `plan.failed`; Conductor (A10) ga obrađuje.

## D-013: MockRunner odgovori: jedan fajl po vlasniku agenta
- Datum: 2026-10-30
- Ko: A
- Status: prihvaćeno (A; rešava `docs/tasks/a.md` P13, B-ov Q17 i D-ov PD9, koji su čekali odluku A)
- Odluka: odgovori za `--mock` su u `src/agents/mocks/<aplikacija>/<agent>.json` (npr. `todomvc/analyzer.json` i `todomvc/architect.json` drži D, `todomvc/tester.json` B, `todomvc/builder.json` C). Format je `MockFixtureSchema` iz `src/core/runner.ts`, a ključevi su `vrsta:zadatak:runda`, `vrsta:zadatak` ili `vrsta`. `wemora migrate --mock` učitava sve `.json` fajlove iz foldera i spaja ih; isti ključ u dva fajla je greška. Drugi folder se bira sa `--mock-dir`.
- Zašto: svako piše samo svoj fajl, pa nema izuzetka od vlasništva ni čekanja na A.
- Posledice: `src/core/runner.ts` (`loadMockFixtureDir`) i `src/orchestration/migrate.ts` (A11). Dok nema fajlova, `npm run migrate:mock -- examples/todomvc` jasno javlja koji folder fali.

## D-014: Adresa originala za testera: `--original-url`, dok B ne napravi `serveOriginal`
- Datum: 2026-10-30
- Ko: A
- Status: prihvaćeno (A; privremeno rešenje za `docs/tasks/a.md` P8 i B-ov Q8, uz B-ov zahtev da A poveže testera); dopunjeno sa D-025: bez `--original-url` CLI sam pokreće original preko B-ovog `serveOriginal`
- Odluka: `wemora migrate` prima `--original-url <url>`: adresu originala koji je pokrenut ručno (npr. `npm run serve` u `examples/todomvc`, plus `examples/mock-api` za Recepte). CLI je prosleđuje B-ovom testeru (`createTester(id, { originalUrl, blankUrl })`); prazna aplikacija je jedan `blankApp` po prolazu, koji se gasi posle prolaza. Bez `--original-url` tester se ne pokreće, a prolaz staje sa porukom šta fali. `RunConfig` u ugovoru se ne menja.
- Zašto: tester otvara original u browseru i u `--mock` prolazu (mock zamenjuje samo model), a niko još ne pokreće original automatski. Dogovor iz PD5 je da to radi B-ova `serveOriginal(webDir)`, koja još ne postoji.
- Posledice: `architecture.md` §13 (opcije `--original-url` i `--mock-dir`, D-013). Kad B napravi `serveOriginal` (potrebno za „radi iz README-a“ u F3), CLI je koristi kad `--original-url` nije dat.

## D-015: `checkDraft` dobija jedinicu, rundu i `webDir`; `OwnershipGuard` prima listu putanja
- Datum: 2026-10-30
- Ko: A
- Status: prihvaćeno (A; predlog C, P16 u `docs/status/c.md`; ispunjava uslov iz D-008)
- Odluka:
  1. `CheckDraft = (input: CheckDraftInput) => Promise<GateResult[]>`, gde je `CheckDraftInput = { unit, round, draftDir, tests, webDir }` (`src/contracts/api.ts`). `round` ide u svaki `GateResult`; `unit.sources` (putanje prema `webDir`) koristi kapija 4 (D-008), a `unit.intentionalDifferences` kapija 5.
  2. `StatusInput.roundsExhausted` je opciono, jer ga `computeStatus` ne koristi (C1.6). Uklanja se iz ugovora kad C izbaci polje iz svojih testova.
  3. `OwnershipGuard` (`src/agents/_shared/guards.ts`) prima jedan string (folder, kao do sada) ili listu: putanja sa `/` na kraju dozvoljava sve ispod nje, a bez `/` samo taj fajl. Tako zajednička jedinica `layout` sme da piše i `app/_layout.tsx` (PD3); C-ov builder prosleđuje svoj `allowedPaths(unit)`.
- Zašto: C2.3 (`checkDraft`) i jedinica `layout` nisu mogli da se urade sa starim potpisima, a C je tačno naveo šta fali.
- Posledice: `architecture.md` §3 (ulaz Gatekeepera). C-ov `checkDraft` (C2.3) koristi novi potpis; C-ov builder može da zameni `guardPrefix(unit)` sa `allowedPaths(unit)`. Postojeći pozivi `OwnershipGuard` sa jednim stringom rade kao pre.

## D-016: Timeouti testera i buildera; događaj `tests.missing`
- Datum: 2026-10-31
- Ko: A
- Status: prihvaćeno (A; rešava `docs/tasks/a.md` P9 i P10; B je tražio isto u `docs/status/b.md`, „Za A (A13)“)
- Odluka:
  1. **Tester:** ako za `testsWaitTimeoutMs` (10 min) posle dodele nema `tests.ready`, Conductor prekida testera (`cancel`), oslobađa ga i povećava `units[id].testAttempts`. Ekran se vraća u red, ali iza ekrana koji još nisu probani. Posle `maxTestAttempts` (2) pokušaja Conductor šalje **`tests.missing { unitId }`** i ekran se više ne daje testeru. Testerov sopstveni limit od 8 min (`testerUnitTimeoutMs`) je B-ov, unutar petlje; Conductorov tajmer je poslednja zaštita.
  2. **Gatekeeper** na `tests.missing` promoviše ekran kao `unproven`: odmah ako nacrt već čeka, ili čim nacrt stigne, bez čekanja testova (§9: „posle drugog isteka ekran se promoviše kao nedokazan“).
  3. **Builder:** ako za `builderRoundTimeoutMs` (10 min) posle dodele runde nema `draft.submitted`, Conductor prekida buildera i to se **računa kao neuspela runda** (P10): isti builder dobija sledeću rundu sa porukom „no draft was submitted within 10 min“, a posle poslednje runde jedinica je `failed`.
  4. **Zakasneli događaji:** `draft.submitted` i `gate.failed` iz ranije runde dolaze iz petlje koja je već istekla. Conductor ih ignoriše i upisuje `event.stale` u log; Gatekeeper takođe treba da ignoriše nacrt čija runda nije `board().units[unitId].round`. Prekinuti agent ne šalje rezultat tog zadatka (`src/agents/_shared/handle.ts`).
  5. Novi zadatak prekinutom agentu ide tek kad agent stvarno stane (`isBusy()` je `false`), uz proveru na svakih `idleCheckMs` (1 s).
- Zašto: u F2 postoji samo jedan tester, pa bi jedan zaglavljen ekran zaustavio testiranje svih ostalih; bez timeouta buildera jedinica bi čekala zauvek. Mozaik ne može da prekine petlju spolja, pa se prekid radi kroz `CancelGuard` (A8).
- Posledice: `src/contracts/events.ts` (`tests.missing`), `architecture.md` §5 i §9, `src/core/config.ts` (`maxTestAttempts`, `idleCheckMs`), `src/orchestration/` (A13). C-ov Gatekeeper-učesnik (C2.4) reaguje na `tests.missing` i ignoriše zakasnele nacrte.

## D-017: Korak `submit` u DSL-u testova (upis u polje pa Enter)
- Datum: 2026-10-31
- Ko: B (izmena ugovora uz A-ovu dozvolu, grana `contracts/submit`; A pregleda i spaja)
- Status: predlog (čeka A)
- Odluka: `StepSchema` u `src/contracts/scenario.ts` dobija korak `{ submit: { label, value } }`: upiši `value` u polje sa labelom `label`, pa pritisni Enter u tom polju. Na telefonu je to `TextInput` sa `onSubmitEditing`. Za pokrivenost, `notPortable` i `reveal` `submit` se računa kao korišćenje tog polja (kao `fill`); za pravilo 3 (`architecture.md` §11) je radnja, kao `tap` i `fill`.
- Zašto: u TodoMVC-u se zadatak dodaje samo Enter-om, a dugme ne postoji. Bez ovog koraka nijedan test ne može da doda zadatak, pa četiri od pet obaveza ekrana `todo-list` ne mogu da se pokriju i TodoMVC ne može biti `proven` (G2). Provereno: Enter u RN `TextInput` na Expo web exportu okida `onSubmitEditing` (telefonski ekran 390×844), a svih 5 scenarija za `todo-list` iz `src/agents/mocks/todomvc/tester.json` prolazi `validateScenario` nad pravim TodoMVC-om i placeholderom iz scaffolda.
- Posledice: `src/contracts/scenario.ts` i test ugovora; B: `scenarios/compile.ts`, `run.ts`, `validate.ts`, `prompts/tester.md`, `mocks/todomvc/tester.json`; `architecture.md` §11 (tabela koraka) treba dopuniti (A); C: kapija 4 `labels` treba da proverava i `submit.label` (C je to najavio), a TodoMVC nacrt buildera mora da prođe nove testove.

## D-018: Modeli se biraju kroz `.env`; cene za modele hakaton gateway-a
- Datum: 2026-10-31
- Ko: A
- Status: prihvaćeno (A; pravi prolaz nad TodoMVC-om je stao na `plan.failed`, jer gateway ne nudi `claude-haiku-5-5` ni `claude-sonnet-5-5`); podrazumevani modeli i cene delimično zamenjeni sa D-023
- Odluka:
  1. `MODELS.default` i `MODELS.strong` (`src/core/config.ts`) čitaju `WEMORA_MODEL_DEFAULT` i `WEMORA_MODEL_STRONG` iz okruženja, pri svakom pristupu (CLI učitava `.env` posle `config.ts`). Bez njih važe modeli iz `architecture.md` §12 (`DEFAULT_MODELS`: `claude-haiku-5-5`, `claude-sonnet-5-5`).
  2. `PRICING` ima i `claude-haiku-4-5` ($1 / $5) i `claude-sonnet-4-6` ($3 / $15 po milionu tokena), po Anthropic cenovniku. Budžet i dalje odbija model bez cene.
  3. Registracija `claude-haiku-5-5` u `src/core/runner.ts` koristi stalno ime (`DEFAULT_MODELS.default`), ne `MODELS.default`.
- Zašto: gateway hakatona (`ANTHROPIC_BASE_URL` = `api.app.jigjoy.ai`) nudi samo `claude-haiku-4-5` i `claude-sonnet-4-6` (provereno po jednim malim zahtevom po modelu, 2026-10-31); `haiku-5-5` vraća 404, a `sonnet-5-5` 503 „not available on Mozaik Cloud yet“. Izbor kroz `.env` ne traži izmenu koda kad se gateway promeni.
- Posledice: `.env.example` (zakomentarisani primer), `architecture.md` §12 (napomena). Haiku 4.5 je ~10× skuplji od cene uzete za 5.5, pa pravi prolazi trebaju veći `--budget` (podrazumevano je $3). Brojač troška računa po Anthropic ceni; gateway možda naplaćuje drugačije. Svi zahtevi modelu sa ovim `ANTHROPIC_BASE_URL` idu preko JigJoy servera; to nije telemetrija (`MOZAIK_API_KEY` i dalje nije postavljen).

## D-019: Poruke između članova tima kroz `docs/inbox/`
- Datum: 2026-10-31
- Ko: A
- Status: predlog (čeka B, C i D, posebno tačku 3)
- Odluka:
  1. Svaka poruka koja traži da neko nešto uradi ili odgovori je jedan fajl u `docs/inbox/` (ime `<datum>-<od>-to-<kome>-<opis>.md`), u formatu iz `docs/inbox/README.md`: frontmatter `from`, `to`, `created`, `priority`, `status`, `done` i sekcije Problem, Predlog, Gotovo kad, Odgovor.
  2. Pošiljalac pravi fajl. Primalac menja `status` i `done`, piše odgovor i premešta fajl u `docs/inbox/done/`.
  3. Fajlovi u `docs/inbox/` idu direktno na `main`, bez PR-a.
  4. Odluke o arhitekturi i ugovorima i dalje idu u ovaj fajl. Poruka se samo poziva na njih.
- Zašto: poruke u chatu se gube i ne zna se da li su urađene. Jedan fajl po poruci ne pravi merge konflikte. Direktno na `main`, jer bi poruka preko PR-a stigla tek posle review-a. Claude svake osobe može da pročita svoj inbox na početku sesije.
- Posledice: `docs/inbox/README.md`, `docs/inbox/done/`. Predlog dopune `CLAUDE.md`, sekcija „Dokumentacija“: na početku sesije proveriti `docs/inbox/` za otvorene poruke sa svojim slovom.

## D-020: Trošak računa i keširane tokene (prompt caching na gateway-u)
- Datum: 2026-10-31
- Ko: A
- Status: prihvaćeno (A; pravi prolaz `output/20261031-030034-todomvc` je prijavio $0.00027 za ~100 poziva)
- Odluka:
  1. `costUsd(model, inputTokens, outputTokens, cache?)` (`src/core/config.ts`): `inputTokens` je nekeširani ulaz, a `cache = { readTokens, writeTokens }`. Čitanje iz keša košta `CACHE_READ_PRICE` (0,1×), a upis `CACHE_WRITE_PRICE` (1,25×) cene ulaza, po Anthropic ceni za keš od 5 minuta. Granica za `longContext` se računa na ceo ulaz, keš uključen.
  2. `BudgetedRunner` čita `cache_read_input_tokens` i `cache_creation_input_tokens` iz `output.rowResponse.usage` (sirov odgovor provajdera, proveren zod šemom). Ako ih nema, ceo `tokenUsage.inputTokenDetails.cached_tokens` se računa kao upis, da budžet nikad ne potceni.
  3. `UsageRecord.inputTokens` i `LedgerEntry.inputTokens` su ceo ulaz (keš uključen). `UsageRecord` i linija `model.usage` u `run.jsonl` imaju i `cacheReadTokens` i `cacheWriteTokens`.
- Zašto: gateway hakatona sam radi prompt caching, a Anthropic `usage.input_tokens` tada sadrži samo nekeširani deo (5–6 tokena po pozivu). Mozaik oba keš broja sabira u jedan (`cached_tokens`), pa se iz `TokenUsage` ne vidi šta je čitanje, a šta upis.
- Posledice: `src/core/config.ts`, `src/core/runner.ts`, `src/orchestration/migrate.ts`, testovi. Ugovor (`LedgerEntry`) se ne menja. Ako gateway koristi keš od 1 h (upis 2×), trošak upisa je potcenjen za 0,75× cene ulaza. Ovo je i dalje procena: stvarnu potrošnju ključa vidi samo izdavalac ključa. Napomena „Anthropic mapper ne radi prompt caching“ u `CLAUDE.md` i `.claude/rules/mozaik.md` §3 važi za Mozaik, ali ne i za gateway.

## D-021: Broj agenata po formulama (A14): najmanje 1 builder, ponovno računanje posle isteka minuta
- Datum: 2026-10-31
- Ko: A
- Status: prihvaćeno (A)
- Odluka:
  1. Conductor računa broj analizatora na početku iz `parsed.totalTokens`, a broj buildera i testera pre svakog `dispatch()` (posle `plan.ready`, `unit.promoted`, neuspele jedinice, `tests.ready`), po formulama iz `architecture.md` §9, do `RunConfig.maxBuilders` i `maxTesters` (`--max-builders`, `--max-testers`).
  2. Buildera je **najmanje 1**, i kad formula da 0 (ništa spremno i niko zauzet).
  3. Promena se primenjuje najviše jednom u `DEFAULTS.rescaleIntervalMs` (60 s). Promena odbijena unutar tog vremena nije izgubljena: kad interval istekne, Conductor ponovo računa (`Rescaler`, `src/orchestration/scaling.ts`).
  4. Smanjenje gasi samo agenta bez zadatka i bez aktivne petlje. Zauzet agent ostaje, pa broj može privremeno biti iznad formule (razlog to kaže).
  5. Log: `agents.rescaled { analyzers, builders, testers, from?, reason }` i `agent.stopped { id, kind }`. Ugašen agent ostaje u `board().agents` kao istorija.
  6. `ConductorOptions.team` fiksira tim (testovi, poređenje). `FIXED_TEAM.maxRounds` (2) važi dok A15 ne uvede runde 3–4.
- Zašto: (2) bez najmanje jednog buildera, nov posao bi čekao do minut na sledeću dozvoljenu promenu. (3) Recepti otključavaju 5 ekrana desetak sekundi posle prve promene (`data`, pa `layout`). Bez ponovnog računanja ostali bi sa 1 builderom do sledećeg događaja.
- Posledice: `src/orchestration/scaling.ts` (nov), `conductor.ts`, `migrate.ts` (više ne šalje fiksni tim), `architecture.md` §9. D čita `agents.rescaled` za sekciju izveštaja „broj agenata i razlog“.

## D-022: Ugovor za testove toka (`Flow`, C3.3)
- Datum: 2026-10-31
- Ko: A (na predlog C-a, `docs/inbox/2026-10-31-c-to-ab-flow-tests.md`)
- Status: prihvaćeno (A; ugovor). Ko i kada piše testove toka: korak 2, posle A15 i A16.
- Odluka:
  1. Test toka je `Scenario` sa opcionim poljem `flowId`. `unitId` je prva jedinica toka (od nje kreće `goto`), a `obligation` je `Flow.id`. Zato `validateScenario`, `runScenarios` i kapije rade nad testom toka bez izmena.
  2. Na tabli: `flowTests: Record<flowId, Scenario[]>` i `flowResults: Record<flowId, FlowResult>`. Na disku: `tests/flows/<flowId>.json` (tester) i `results/flows/<flowId>.json` (Gatekeeper).
  3. `FlowResult = { flowId, ok, scenarios: ScenarioResult[] }` (`src/contracts/types.ts`).
  4. Nov događaj `flow.tests.ready { flowId }` (tester → Gatekeeper). Gatekeeper pušta tok posle `unit.promoted` kad su sve jedinice toka promovisane i stigao je `flow.tests.ready`.
  5. Tok koji pada ne vraća nijedan ekran. Samo se prijavljuje u `results/flows/` i u izveštaju.
- Zašto: C3.3 ne može bez mesta za testove toka. Opciono polje umesto novog tipa ne menja postojeći kod. Vraćanje ekrana zbog toka bi poništilo dokaze koje ekran već ima i kvarilo druge tokove.
- Posledice: `src/contracts/scenario.ts`, `types.ts`, `state.ts`, `events.ts`, `src/core/state.ts`, `architecture.md` §5, §6, §7, §11. Korak 2 (A, grana `a/flow-dispatch`): `TestTask` dobija `flowId?`, a Conductor daje testeru `{ flowId }` kad sve jedinice toka imaju `tests.ready`. B: tester piše scenario toka kad dobije `{ flowId }`. C: C3.3 nad ovim ugovorom. Ako ponestane vremena, tokovi ostaju neprovereni, a izveštaj to kaže.

## D-023: Podrazumevani modeli su oni koje stvarno koristimo: `claude-haiku-4-5` i `claude-sonnet-4-6`
- Datum: 2026-10-31
- Ko: A
- Status: prihvaćeno (A; zamenjuje podrazumevane modele i cene iz D-018 i `architecture.md` §12)
- Odluka:
  1. `DEFAULT_MODELS` (`src/core/config.ts`) su `claude-haiku-4-5` (osnovni: analizator, tester, builder runde 1–2) i `claude-sonnet-4-6` (arhitekta, builder runde 3–4). `WEMORA_MODEL_DEFAULT` i `WEMORA_MODEL_STRONG` i dalje mogu da ih zamene (D-018).
  2. `PRICING` ima samo te modele (Anthropic cene: $1 / $5 i $3 / $15 po milionu tokena). Cene za `claude-haiku-5-5` i `claude-sonnet-5-5` i pravilo „×5 preko 100k ulaznih tokena“ su izbačeni.
  3. Oba modela su u Mozaikovom `supportedModels`, pa `src/core/runner.ts` više ne registruje nijedan model (`models = [...supportedModels]`).
  4. `DEFAULTS.budgetUsd` (`--budget`) je $5 umesto $3, zbog cena iz tačke 2 i do 4 runde po jedinici (A15).
- Zašto: gateway hakatona nudi samo ova dva modela (D-018), a kod i dokumentacija su i dalje navodili modele 5.5 i njihove cene. To je zbunjivalo i tražilo `.env` podešavanje za jedini gateway koji koristimo.
- Posledice: `src/core/config.ts`, `runner.ts` i njihovi testovi, `.env.example`, `CLAUDE.md`, `.claude/rules/mozaik.md` §3, `architecture.md` §9 i §12, `tasks/a.md`, `tim-plan.md`, `wemora-plan.md` (i nova procena troška, §6.1). `claude-haiku-5-5` je ostao samo kao tekst u testovima i fixture-ima kod C-a i D-a i u `tasks/b.md` i `c.md` (poruke u inboxu, po jedna za B, C i D).

## D-024: Posle `budget.exceeded` jedinice koje se grade odmah padaju (dopuna P11); 429 spušta granicu buildera
- Datum: 2026-10-31
- Ko: A
- Status: prihvaćeno (A)
- Odluka:
  1. Na `budget.exceeded`: nema novih zadataka ni nove runde (`roundFailed`). Jedinica sa statusom `building` odmah dobija `failed` sa razlogom „budget exceeded“, a njen builder se prekida (`cancel`). Testeri se prekidaju. Predati nacrti (`submitted`) se i dalje proveravaju, a za ekran bez `tests.ready` Conductor šalje `tests.missing`, da Gatekeeper ne čeka.
  2. Ako budžet nestane pre plana, novi analizatori i arhitekta se ne pokreću. Prolaz se završava kad se zauzeti vrate.
  3. Ishod prolaza u kom je budžet potrošen je `budget.exceeded`, i kad svaka jedinica ima konačan status, i kad arhitekta zbog toga ne napravi plan.
  4. Na 429 ili 529 (`BudgetedRunner.onRateLimited` → `Conductor.notifyRateLimited()`) granica buildera pada za 1, najmanje do 1, najviše jednom u `DEFAULTS.rateLimitCooldownMs` (60 s). 429 u tom vremenu znači još jedan korak dole kad vreme istekne, a mirno vreme vraća jednog buildera, do `--max-builders`. Granica važi u `dispatch()` odmah, a `rescale()` (A14) gasi slobodne buildere. Log: `rate.limited` i `rate.recovered { maxBuilders }`.
  5. `src/cli.ts` ne zove `process.exit` odmah, nego postavi `process.exitCode`, a `process.exit` ide tek posle 500 ms, preko `unref` tajmera, ako nešto drži proces živim.
- Zašto: (1) P11 je predlagao da se aktivne petlje „završe“, ali runner odbija svaki sledeći poziv, pa builder ne može da preda nacrt. Conductor bi čekao timeout od 10 min po rundi i zatim pokretao nove runde, do 40 min bez koristi. (2) i (3): pravi prolaz sa `--budget 0.01` je pokrenuo arhitektu posle `budget.exceeded` i završio sa `plan.failed`. (5): kratak prolaz je na Windowsu padao na izlazu (`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`, exit 127), jer je `process.exit` stizao dok se keep-alive TLS veza ka API-ju još zatvarala.
- Posledice: `src/orchestration/conductor.ts`, `migrate.ts` (`onRateLimited`), `mocks/fakeAgents.ts` (lažni agent posle `cancel` ne šalje ništa, kao pravi), `src/core/config.ts` (`rateLimitCooldownMs`), `src/cli.ts`, `architecture.md` §9.

## D-025: `migrate` sam servira original; Conductor daje testove toka (D-022, korak 2)
- Datum: 2026-10-31
- Ko: A (na B-ov zahtev, `docs/inbox/done/2026-10-31-b-to-a-serve-original-and-flow-tester.md`)
- Status: prihvaćeno (A)
- Odluka:
  1. Bez `--original-url`, `wemora migrate` pre ijednog agenta poziva B-ov `serveOriginal(webDir)` (`npm run build`, pa `dist/` na slobodnom portu) i tu adresu daje testerima. Server se gasi na kraju prolaza, i kad prolaz padne. Ako original ne može da se servira, `migrate` ispiše razlog i vrati exit 1, bez foldera prolaza. `--original-url` i dalje ima prednost. U `run.jsonl` `migrate.started` ima `originalUrl` i `servedOriginal`. Mock-api (Recepti) se i dalje pokreće ručno.
  2. `TestTask` je `{ unitId } | { flowId }`. Slobodan tester prvo uzima ekrane (`nextForTester`). Tok dobija tek kad nema ekrana za njega i kad su za sve jedinice toka stigli `tests.ready`. Oznaka zadatka testera za tok je `flow:<flowId>`.
  3. `flow.tests.ready` oslobađa testera. Tok bez testova ima isti timeout kao ekran (`testsWaitTimeoutMs`, `maxTestAttempts` pokušaja, log `flow.tests.timeout { flowId, attempt, gaveUp }`). Posle poslednjeg pokušaja tok ostaje bez testova.
  4. Prolaz se ne završava dok ima toka koji se testira, koji će se testirati (sve jedinice imaju testove) ili koji čeka Gatekeeperovu proveru (ima testove, sve jedinice su promovisane, a `flowResults` još nema rezultat). Gatekeeper upisuje rezultat bez događaja, pa Conductor proverava tablu svakih `idleCheckMs`.
  5. Posle `budget.exceeded` testovi toka se ne dele, a tester toka se prekida kao i ostali.
- Zašto: B je napravio `serveOriginal` i testera za tokove, ali oba rade tek kad ih poveže CLI, odnosno Conductor. Ekrani idu pre tokova, jer bez testova ekrana nema dokaza, a tok samo dopunjuje dokaz. Čekanje na proveru toka sprečava da kraj prolaza prekine Gatekeepera usred `checkFlow`.
- Posledice: `src/orchestration/migrate.ts` (`MigrateServices` za testove), `src/cli.ts` (tekst za `--original-url`), `src/agents/_shared/handle.ts` (`TestTask`), `src/orchestration/conductor.ts`, `mocks/fakeAgents.ts` (lažni tester i Gatekeeper znaju za tokove), `architecture.md` §9 i §13.
