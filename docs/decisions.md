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
- Status: prihvaćeno (C; B potvrdio 2026-10-30)
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
- Status: predlog (D i B potvrdili 2026-10-30, sve tri tačke; čeka A; `architecture.md` §10 kaže „Babel parsira“)
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
