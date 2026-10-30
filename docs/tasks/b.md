# Zadaci: osoba B — testovi i dokaz

Ovo su koraci osobe B iz `docs/tim-plan.md` (faze F0–F4), prepisani tako da svaki zadatak ima: šta radi, fajlove, tačne korake, kriterijum završetka, zavisnosti i trenutak za PR. Struktura sistema je u `docs/architecture.md`, tačni oblici podataka u `src/contracts/` (kod pobeđuje tekst). Ovaj fajl ne sadrži kod.

> **Stanje na dan 30. 10. 2026:** A0 je spojen u `main`, pa važi kod u `src/contracts/`. Imena tipova ispod (`Scenario`, `Step`, `ScenarioResult`, `Coverage`, `InteractiveElement`, `RunScenarios`, `ValidateScenario`, `ExtractInteractive`, `ComputeCoverage`, `Verify`, `Sabotage`, `Viewport`) se slažu sa njim (B0). A-ova grana `skeleton` (check-layers, prazni `index.ts`) još nije spojena.

**Moji folderi:** `src/scenarios/`, `src/verify/`, `src/agents/tester.ts`, `src/agents/prompts/tester.md`, `scripts/sabotage.ts`, `docs/status/b.md`.

**Pre svakog PR-a:** `git pull --rebase origin main && npm run build && npm test`, plus ažuriran `docs/status/b.md`. Review radi **C** (tim-plan §1), najviše 10 min.

**Oznaka za PR:** 🔀 **PR** znači „ovde otvori pull request“. Zadatak bez te oznake ide u PR sledećeg zadatka.

---

## Folderi

Napravljeni su prazni folderi (sa `.gitkeep`, da ih git čuva). Fajlovi u njima nastaju u zadacima navedenim desno.

```
src/
├── scenarios/                    B — domen (sloj 2), bez Mozaika
│   ├── index.ts                  prazan pravi A (A3); B popunjava u B2–B6
│   ├── compile.ts                B2  DSL → Playwright akcije, reveal
│   ├── run.ts                    B3  runScenarios()
│   ├── serve.ts                  B3  lokalni statički server (testovi, verify)
│   ├── validate.ts               B4  validateScenario()
│   ├── interactive.ts            B5  extractInteractive()
│   ├── coverage.ts               B6  computeCoverage()
│   ├── maestro.ts                B16 (opciono) DSL → Maestro YAML
│   ├── *.test.ts                 testovi uz svaki fajl
│   └── mocks/                    statičke HTML strane, blank.html, ručni scenariji
├── verify/                       B — domen (sloj 2), bez Mozaika
│   ├── index.ts                  B12 verify()
│   ├── *.test.ts
│   └── mocks/run/                B12 ručno napravljen „prolaz“ za testove
└── agents/                       deljen folder (sloj 3); moj je samo tester
    ├── tester.ts                 B8
    └── prompts/tester.md         B8
scripts/                          deljen folder; moj je samo sabotage.ts
└── sabotage.ts                   B13 (vidi pitanje Q14)
docs/status/b.md                  B1
```

---

## Pregled

| ID | Faza | Zadatak | Grana / PR |
|---|---|---|---|
| B0 | F0 | Review ugovora za moj deo | review A-ovog `contracts/initial` |
| B1 | F0 | Priprema: Playwright, status | 🔀 `b/deps` |
| | | **Kapija G0 (proverava A)** | |
| B2 | F1 | Prevodilac DSL → Playwright | ide uz B3 |
| B3 | F1 | `runScenarios()` i lokalni server | 🔀 `b/compiler-runner` |
| B4 | F1 | `validateScenario()` i 3 ručna scenarija | 🔀 `b/validate-setup` |
| B5 | F1 | `extractInteractive()` | ide uz B6 |
| B6 | F1 | `computeCoverage()` i `index.ts` | 🔀 `b/interactive-coverage` |
| B7 | F1 | Moje stavke kapije G1 (zajednički test sa C) | bez PR-a |
| | | **Kapija G1 (proverava D)** | |
| B8 | F2 | Agent tester | 🔀 `b/tester` |
| B9 | F2 | Prazan ekran iz C-ovog scaffolda | 🔀 `b/tester-blank` |
| B10 | F2 | MockRunner odgovori testera za TodoMVC | 🔀 `b/mock-tester` |
| B11 | F2 | Integracija F2 | 🔀 `b/fix-<opis>` po potrebi |
| | | **Kapija G2 (proverava A)** | |
| B12 | F3 | `verify()` | 🔀 `b/verify` |
| B13 | F3 | `sabotage()` | 🔀 `b/sabotage` |
| B14 | F3 | Pokrivenost → status → izveštaj | 🔀 `b/coverage-status` |
| | | **Kapija G3 (proverava B)** + prva predaja | |
| B15 | F4 | Stabilizacija i rezervni plan | 🔀 `b/fix-<opis>` |
| B16 | F4 | (opciono) Maestro prevodilac | 🔀 `b/maestro` |

---

## F0: Temelj

### B0 — Review ugovora za moj deo
- **Šta radi:** pre nego što bilo ko piše kod, proveravam da A-ov predlog ugovora pokriva sve što mi treba za scenarije, pokrivenost i `verify`. Potvrđujem tipove u chatu ili tražim izmenu kroz A-ovu granu.
- **Fajlovi:** ništa moje. Čitam `src/contracts/scenario.ts`, `difference.ts`, `types.ts` (`ScenarioResult`, `InteractiveElement`, `Coverage`, `UnitResult`) i `api.ts` (B-ovi potpisi).
- **Koraci:**
  1. Uporedim `Step` i `Scenario` sa `architecture.md` §11: tačno 5 vrsta koraka, `.strict()`, nema `seed`.
  2. Proverim da `HiddenBehind.element` i `NotPortable.element` mogu da se uporede sa koracima (`tap {role,name}`, `tap {text}`, `fill {label}`), jer na tome rade B2 i B6.
  3. Proverim da `ScenarioResult` ima sve što treba Gatekeeperu, izveštaju i `verify` (`failedStep`, `error`).
  4. Proverim B-ove potpise u `api.ts` (`RunScenarios`, `ValidateScenario`, `ExtractInteractive`, `ComputeCoverage`, `Verify`, `Sabotage`).
  5. U chatu pošaljem samo ono što traži izmenu ugovora, plus Q1 (blokira F1). Ostala pitanja šaljem kad dođem do zadatka na koji se odnose.
- **Gotovo kad:** u chatu sam potvrdio svoje tipove ili je A dobio listu tačnih izmena.
- **Zavisnosti i mock:** A0 (A).
- **PR:** nema mog PR-a; radim review A-ovog.

### B1 — Priprema: Playwright i status
- **Šta radi:** dodaje Playwright kao zavisnost kroz poseban mali PR i proverava da Chromium radi na mojoj mašini. Pravi prazan `docs/status/b.md`.
- **Fajlovi:** `package.json`, `package-lock.json` (samo oni u PR-u, tim-plan §2.5), `docs/status/b.md`.
- **Koraci:**
  1. U chatu tražim odobrenje za paket `playwright` (biblioteka, **ne** `@playwright/test`, jer testove pokreće vitest), tačno pinovana verzija (A-ov P15).
  2. `npm install playwright@<verzija> --save-exact`, pa `npx playwright install chromium`.
  3. Ručno: mali Node skript iz scratch foldera otvori `about:blank` u Chromium-u i zatvori ga (ne commit-uje se).
  4. Ako `examples/recepti` već postoji, pokrenem ga lokalno i zapišem komandu u status.
  5. Napravim `docs/status/b.md` po šablonu iz tim-plan §10.
- **Gotovo kad:** na čistom klonu `npm ci && npx playwright install chromium` prolazi; `docs/status/b.md` postoji.
- **Zavisnosti i mock:** A0.0 (A dodaje `zod`/`vitest` u svom PR-u; moj ide posle njega da ne bude konflikta u `package-lock.json`).
- 🔀 **PR `b/deps`** — odmah posle ovog koraka, samo `package.json` + `package-lock.json`. `docs/status/b.md` ide u prvi sledeći PR.

### Kapija G0 (proverava A)
Moja stavka: povučem `main`, napravim granu za F1 i proverim da `check-layers.sh` pada kad u `src/scenarios/index.ts` privremeno dodam `import "@mozaik-ai/core"` (pa vratim).

---

## F1: Svaki deo radi sam

### B2 — Prevodilac DSL → Playwright (`scenarios/compile.ts`)
- **Šta radi:** pretvara korake scenarija u listu konkretnih akcija nad Playwright stranicom, sa automatskim skrolovanjem i čekanjem. Za mobilni izvršilac ubacuje `reveal` korake iz `hiddenBehind` razlika jedinice. Izlaz je obična lista podataka (lako se snimi kao snapshot), a izvršavanje je u B3.
- **Fajlovi:** `src/scenarios/compile.ts`, `src/scenarios/compile.test.ts`.
- **Koraci:**
  1. Definišem interni (ne-ugovorni) oblik prevedene akcije: vrsta akcije, lokator (uloga+ime / tekst / labela), vrednost, oznaka da li je akcija ubačena (`reveal`) i indeks originalnog koraka (za `failedStep`).
  2. Mapiranje, po jedan red za svaki korak:
     - `goto` → otvori `baseUrl + putanja`;
     - `tap {role,name}` → element po ulozi i tačnom imenu, klik;
     - `tap {text}` → element po tekstu, klik;
     - `fill {label,value}` → polje po tačnoj labeli, upis;
     - `expectVisible {text}` → čekaj da bar jedan element sa tim tekstom bude vidljiv;
     - `expectNotVisible {text}` → čekaj da nijedan ne bude vidljiv.
     Pravila poklapanja teksta (tačno ili podniz, više poklapanja) su pitanje Q2; do odluke koristim predlog iz Q2.
  3. Skrol: pre svake akcije i provere element se skroluje u vidno polje. Za mobilni prikaz (RN-web liste se renderuju tek kad se skroluje) dodajem „skroluj dok se ne pojavi“ sa ograničenim brojem pokušaja.
  4. `reveal`: za svaki korak koji koristi element iz `HiddenBehind.element`, ispred njega ubacim uslovni korak „ako element nije vidljiv, tapni `reveal`“. Uslovni je da drugi tap ne bi ponovo sakrio element. Kad je lista razlika prazna (original), ništa se ne ubacuje.
  5. Korak koji koristi `notPortable` element: prevodilac vraća grešku (predlog Q5).
  6. Ako Spike A (C) padne, prelazimo na `testID` ugovor: lokatori u koraku 2 se menjaju na `testID`, ostatak ostaje isti.
- **Gotovo kad:** `npx vitest run src/scenarios/compile.test.ts`:
  1. snapshot prevoda za svih 5 vrsta koraka;
  2. sa jednom `hiddenBehind` razlikom ubačen je tačno jedan uslovni `reveal`, ispred pravog koraka;
  3. bez razlika nema ubačenih koraka;
  4. korak sa `notPortable` elementom daje grešku sa imenom elementa;
  5. svaka prevedena akcija pamti indeks originalnog koraka.
- **Zavisnosti i mock:** A0 (`Step`, `IntentionalDifference`). Bez browsera.
- **PR:** ide uz B3 u `b/compiler-runner`.

### B3 — `runScenarios()` i lokalni server (`scenarios/run.ts`, `scenarios/serve.ts`)
- **Šta radi:** pušta listu scenarija nad zadatim URL-om u pravom Chromium-u i vraća `ScenarioResult[]`. Svaki scenario dobija čist browser kontekst (prazan `localStorage`), prvo `setup`, pa `steps`. Funkcija nikad ne baca izuzetak: svaka greška postaje `ok: false` sa porukom.
- **Fajlovi:** `src/scenarios/run.ts`, `src/scenarios/serve.ts`, `src/scenarios/run.test.ts`, `src/scenarios/mocks/static/` (mala HTML strana: polje „Pretraga“, dugme, lista, skriveni filter iza dugmeta „Filteri“).
- **Koraci:**
  1. `serve.ts`: statički server preko `node:http` (bez nove zavisnosti) koji servira folder na slobodnom portu, sa SPA fallback-om na `index.html`, i vraća `{ url, close }`. Koriste ga testovi, a kasnije i `verify` (B12).
  2. `run.ts`: jedan Chromium po pozivu, za svaki scenario nov kontekst sa zadatim `viewport`-om (1280×800 original, 390×844 mobilni).
  3. Scenario se zod-om proveri pre puštanja; neispravan → `ok: false`, bez pokretanja.
  4. Prevedem `setup` + `steps` preko B2 (sa `differences`), izvršim redom, sa vremenskim limitom po koraku (konstanta, vidi Q20).
  5. Kod pada: `failedStep` = indeks u `steps` (greška u `setup` → poruka počinje sa `setup:`), `error` = poruka koju razume i čovek i model (šta se tražilo, šta nije nađeno).
  6. `durationMs` se meri, ali ne ulazi u poređenje rezultata (determinizam za `verify`).
  7. Scenariji se puštaju **redom**, u redosledu ulaza, da rezultat bude isti svaki put.
  8. `apiFixture` za sada samo prenosim dalje; mehanizam zavisi od Q1 (D i `examples/mock-api`).
- **Gotovo kad:** `npx vitest run src/scenarios/run.test.ts` (lokalni server, bez interneta):
  1. ispravan scenario nad `mocks/static/` prolazi;
  2. scenario sa pogrešnom labelom pada sa tačnim `failedStep` i porukom koja sadrži labelu;
  3. strana ispisuje širinu prozora, pa test potvrđuje oba viewporta;
  4. `setup` se izvršava pre `steps`, a `localStorage` iz jednog scenarija se ne vidi u sledećem;
  5. sa `hiddenBehind` razlikom scenario prolazi iako je element iza dugmeta „Filteri“;
  6. ugašen server → svi rezultati `ok: false`, bez izuzetka.
- **Zavisnosti i mock:** B1 (Playwright), B2.
- 🔀 **PR `b/compiler-runner`** — posle B3 (B2 + B3 zajedno, prvi PR u F1).

### B4 — `validateScenario()` i 3 ručna scenarija (`scenarios/validate.ts`)
- **Šta radi:** odlučuje da li je scenario dovoljno dobar da postane dokaz: mora da prođe na originalu dva puta zaredom, da padne na praznom ekranu, i svaka provera posle radnje mora da padne kad se pusti pre te radnje. Vraća `{ ok, reason }`, gde je `reason` napisan tako da ga model (tester) razume i popravi test.
- **Fajlovi:** `src/scenarios/validate.ts`, `src/scenarios/validate.test.ts`, `src/scenarios/mocks/blank.html`, `src/scenarios/mocks/recepti/*.json` (3 ručna scenarija).
- **Koraci:**
  1. Zod provera scenarija.
  2. Pravilo 1: dva odvojena `runScenarios` nad originalom (desktop, bez razlika); oba moraju `ok`. Inače: „nestabilan test, pada u N. pokušaju na koraku K“.
  3. Pravilo 2: jedno puštanje nad `blankUrl`; mora da padne. Inače: „prolazi i na praznom ekranu, ništa ne proverava“. Viewport i razlike za prazan ekran: Q4.
  4. Pravilo 3: za svaku `expect*` proveru posle radnje napravim varijantu „svi koraci do poslednje radnje pre nje + ta provera“ i pustim nad originalom; mora da padne. Inače: „provera na koraku K važi i pre radnje na koraku R, radnja ništa ne menja“. Šta se računa kao radnja: Q3.
  5. Rezultat je prvi razlog odbijanja (po redosledu pravila), ili `{ ok: true }`.
  6. U F1 `blankUrl` je `mocks/blank.html` preko `serve.ts`; u F2 ga menja placeholder iz C-ovog scaffolda (B9).
  7. Napišem 3 ručna scenarija za Recepte (lista, pretraga, omiljeni kroz `setup` korake preko UI-ja) i pustim ih ručno nad pokrenutim Receptima.
- **Gotovo kad:** `npx vitest run src/scenarios/validate.test.ts`:
  1. dobar scenario nad `mocks/static/` → `ok: true`;
  2. scenario koji samo proverava zajednički tekst (prolazi i na `blank.html`) → odbijen, razlog pominje prazan ekran;
  3. provera koja važi i pre radnje → odbijena, razlog navodi oba koraka;
  4. strana koja se razlikuje pri drugom učitavanju → odbijen kao nestabilan;
  5. ručno: 3 scenarija iz `mocks/recepti/` prolaze nad pokrenutim Receptima (G1).
- **Zavisnosti i mock:** B3. `examples/recepti` i `examples/mock-api` (D); dok ne stignu, ručne scenarije puštam nad `mocks/static/`, a status beleži da Recepti fale.
- 🔀 **PR `b/validate-setup`** — posle B4.

### B5 — `extractInteractive()` (`scenarios/interactive.ts`)
- **Šta radi:** otvori stranicu originala i iz ARIA snapshota izvuče listu interaktivnih elemenata (dugmad, polja, linkovi i sl.) kao parove uloga + ime. Ta lista je osnova za pravilo „svaki element mora biti korišćen u bar jednom testu“.
- **Fajlovi:** `src/scenarios/interactive.ts`, `src/scenarios/interactive.test.ts`.
- **Koraci:**
  1. Otvori `url + route` u 1280×800 i sačekaj da se mreža smiri.
  2. Uzmi ARIA snapshot tela strane (tekst u YAML obliku) i parsiraj ga linijama, bez nove zavisnosti.
  3. Zadrži interaktivne uloge: `button`, `link`, `textbox`, `searchbox`, `checkbox`, `radio`, `combobox`, `switch`, `tab`, `menuitem`, `slider`, `spinbutton`.
  4. Element bez imena se preskače i broji (ne može da se testira po imenu); broj ide u log poruku za izveštaj.
  5. Duplikati (isto dugme u svakom redu liste) se spajaju po paru uloga + ime.
  6. Rezultat se sortira, da bude isti svaki put.
- **Gotovo kad:** `npx vitest run src/scenarios/interactive.test.ts`: nad `mocks/static/` vraća tačno očekivanu listu; skriveni elementi nisu u njoj; dva poziva daju isti rezultat.
- **Zavisnosti i mock:** B1, B3 (`serve.ts`).
- **PR:** ide uz B6 u `b/interactive-coverage`.

### B6 — `computeCoverage()` i `scenarios/index.ts`
- **Šta radi:** čista funkcija bez browsera: za jedinicu, njene validirane scenarije i listu interaktivnih elemenata kaže koje obaveze i koji elementi su pokriveni, koji fale, a koji su `notPortable`. Uz to `index.ts` izvozi sve javne funkcije sa tipovima iz `contracts/api.ts`.
- **Fajlovi:** `src/scenarios/coverage.ts`, `src/scenarios/coverage.test.ts`, `src/scenarios/index.ts`.
- **Koraci:**
  1. Obaveze: pokrivena je svaka `Obligation.id` koja se javlja kao `scenario.obligation` u bar jednom scenariju; ostale su `missing`.
  2. Elementi: element je pokriven ako ga koristi bar jedan korak (`setup` ili `steps`): `tap {role,name}` sa istim parom, `fill {label}` sa istim imenom polja, `tap {text}` sa istim imenom. Tačna pravila poklapanja: Q2.
  3. Elementi koji odgovaraju `notPortable` razlikama jedinice idu u `notPortable`, ne u `missing`.
  4. `movedTo` za sada ne menja pokrivenost (Q6).
  5. `index.ts`: izvoz `runScenarios`, `validateScenario`, `extractInteractive`, `computeCoverage` (tipovi iz `api.ts`), plus pomoćne funkcije koje koristi samo B (`serve`, ARIA snapshot za tester) — vidi Q21.
- **Gotovo kad:** `npx vitest run src/scenarios`: ručni primer (3 obaveze, 5 elemenata, 1 `notPortable`) daje tačan `Coverage`; scenario sa nepoznatom obavezom ne računa se ni u jednu; `npm run build` prolazi (potpisi se slažu sa `api.ts`).
- **Zavisnosti i mock:** A0 (`Coverage`, `Unit`), B5.
- 🔀 **PR `b/interactive-coverage`** — posle B6.

### B7 — Moje stavke kapije G1
- **Šta radi:** proverava da moj deo radi nad pravim primerima i, zajedno sa C, prvi „ceo put“ bez AI-ja: moj scenario pušten nad C-ovim ručno napisanim RN ekranom.
- **Fajlovi:** nema novih; samo `docs/status/b.md`.
- **Koraci:**
  1. Pokrenem Recepte i pustim 3 ručna scenarija (B4) → svi prolaze.
  2. Pokažem da `validateScenario` odbija scenario koji prolazi i na praznom ekranu.
  3. Sa C: C pokrene `serveApp()` nad ručno napisanim RN ekranom; ja pustim isti scenario kroz `runScenarios` sa 390×844 → prolazi. Ako ne prolazi zbog selektora, to je ulaz za Spike A odluku.
  4. Ažuriram status.
- **Gotovo kad:** sve tri stavke prolaze na čistom `main`-u (G1).
- **Zavisnosti i mock:** C (`serveApp`, Spike A), D (Recepti).
- **PR:** bez PR-a (provera). Ako pri tome popravim nešto, to ide kao `b/fix-<opis>`.

---

## F2: Jedan ekran ceo put

### B8 — Agent tester (`agents/tester.ts`, `prompts/tester.md`)
- **Šta radi:** AI agent (Haiku 5.5) koji za jednu jedinicu gleda samo original, isprobava ga i piše scenarije, a čuva samo one koji prođu `validateScenario`. Kad su sve obaveze iz plana pokrivene, upiše `tests/<unitId>.json` i pošalje `tests.ready { unitId }`. Agent je tanak omotač: posao rade funkcije iz `scenarios/`.
- **Fajlovi:** `src/agents/tester.ts`, `src/agents/prompts/tester.md`, `src/agents/tester.test.ts`.
- **Koraci:**
  1. Fabrika testera vraća `AgentHandle<TestTask>` (A-ov P6); svaki tester je zasebna `createAgent` instanca. Spoljne zavisnosti (URL originala, URL praznog ekrana, `validateScenario`, snapshot) fabrika dobija kao parametre, da test ne pokreće browser (Q8, Q16).
  2. `assign({ unitId })`: sa table čita jedinicu (ruta, obaveze, razlike), pravi svež kontekst (`freshContext` iz A8) i pokreće `runTask` sa modelom `MODELS.default` i postavljenim `maxOutputTokens`.
  3. Alati (preko `defineTool` iz A8, argumenti zod):
     - `aria_snapshot(route)` → ARIA snapshot originala (desktop);
     - `try_scenario(scenario)` → zod + `validateScenario`; vraća `ok` ili razlog;
     - `save_scenario(scenario)` → ponovo proveri (ili iskoristi rezultat istog scenarija iz `try_scenario` u istom zadatku), proveri da je `unitId` tačan i da `obligation` postoji u planu, pa doda scenario u `tests/<unitId>.json` (upis preko privremenog fajla i preimenovanja) i u `board.tests[unitId]`. Vraća listu obaveza koje još fale.
  4. Putanju fajla pravi kod, ne model: tester piše samo u `tests/<unitId>.json` svoje jedinice. Tester nema `write_file`, pa mu `OwnershipGuard` ne treba.
  5. Kad `computeCoverage` kaže da nema obaveza koje fale → jednom `tests.ready { unitId }` (preko A-ovog `emit`). Šta ako petlja završi bez pune pokrivenosti: Q10.
  6. `prompts/tester.md`: uloga (vidiš samo original), DSL sa primerima, „jedan alat po koraku“, imena tačno iz snapshota, pokrij sve obaveze i sve elemente, ne koristi `notPortable` elemente, ne broj stavke nego navedi šta se vidi i šta ne, stanje pripremi `setup` koracima preko UI-ja, objašnjenje pravila „pre i posle radnje“, `hiddenBehind` ignoriši (prevodilac to radi sam).
  7. Timeout (8 min) vodi Conductor preko `cancel` na handle-u; tester tada samo završava petlju.
- **Gotovo kad:** `npx vitest run src/agents/tester.test.ts` (MockRunner, lažni `validateScenario`, bez mreže):
  1. scenario koji ne prolazi validaciju nije sačuvan, a model dobija razlog;
  2. sačuvani `tests/<unitId>.json` prolazi zod šemu;
  3. scenario sa tuđim `unitId` ili nepoznatom obavezom je odbijen;
  4. `tests.ready` je poslat tačno jednom, tek kad su sve obaveze pokrivene;
  5. drugi `assign` dok petlja radi vraća „agent busy“;
  6. `check-layers` prolazi (tester je sloj 3, uvozi domen samo preko `scenarios/index.ts`).
- **Zavisnosti i mock:** A5 (`emit`, tabla), A7 (`MockRunner`), A8 (`freshContext`, `defineTool`, `runTask`, `AgentHandle`), B4, B6. Do A8 radim samo prompt i logiku alata kao obične funkcije.
- 🔀 **PR `b/tester`** — posle B8.

### B9 — Prazan ekran iz C-ovog scaffolda
- **Šta radi:** u pravom prolazu „prazan ekran“ za pravilo 2 više nije `mocks/blank.html`, nego placeholder ekran jedinice iz C-ovog scaffolda, serviran preko `serveApp()`. Tako test mora da padne baš na onome što builder dobija na početku.
- **Fajlovi:** izmene u `src/agents/tester.ts` (odakle dolazi `blankUrl`), `docs/status/b.md`. `mocks/blank.html` ostaje samo za unit testove.
- **Koraci:**
  1. Dogovor sa A i C: ko pokreće `serveApp()` nad scaffoldom i kako tester dobija URL (Q8).
  2. `blankUrl` = URL scaffolda + ruta jedinice iz `routeMap`.
  3. Rešim slučaj kad je jedinica već promovisana (tester posle timeouta, Q4): prazan ekran mora ostati placeholder.
  4. Iz statusa brišem mock „blank.html umesto placeholdera“.
- **Gotovo kad:** nad scaffoldom TodoMVC-a scenario koji prolazi na originalu pada na placeholderu, a scenario koji proverava samo zajednički naslov aplikacije biva odbijen.
- **Zavisnosti i mock:** C (`scaffold`, `serveApp`), A (Conductor).
- 🔀 **PR `b/tester-blank`** — posle B9 (mali PR).

### B10 — MockRunner odgovori testera za TodoMVC
- **Šta radi:** 2–3 unapred zapisana odgovora testera za TodoMVC, da `migrate:mock` prođe ceo put za $0 (A12).
- **Fajlovi:** fajl sa odgovorima, mesto po odluci A-ovog P13.
- **Koraci:**
  1. Zapišem redosled: poziv `aria_snapshot`, poziv `save_scenario` sa ispravnim scenarijem za TodoMVC, završni tekst.
  2. Scenario prvo ručno proverim kroz `validateScenario` nad pokrenutim TodoMVC-om.
  3. Ključevi po A7 formatu (`tester:<unitId>` ili `tester`).
- **Gotovo kad:** fajl prolazi `MockFixtureSchema`, a `migrate:mock` posle mog dela upisuje `tests/<unitId>.json` i šalje `tests.ready`.
- **Zavisnosti i mock:** A7, A12, B8.
- 🔀 **PR `b/mock-tester`** — posle B10 (ili deo A-ovog PR-a, po P13).

### B11 — Integracija F2
- **Šta radi:** zajednički prolaz nad TodoMVC-om, prvo sa MockRunner-om, pa sa pravim modelom. Popravljam samo svoje foldere.
- **Koraci:**
  1. `npm run migrate:mock -- examples/todomvc`; proverim da `tests/` ima samo validirane scenarije.
  2. `npm run migrate -- examples/todomvc --budget 1`; u `run.jsonl` proverim da su tester i builder radili istovremeno.
  3. Svaku grešku u svom delu popravim u posebnoj maloj grani.
- **Gotovo kad:** moje stavke G2 prolaze: bar 1 ekran „dokazan“ sa validiranim testovima; preklapanje tester/builder vidljivo u `run.jsonl`.
- 🔀 **PR `b/fix-<opis>`** — po jedan za svaku popravku.

---

## F3: Recepti i dokaz

### B12 — `verify()` (`src/verify/`)
- **Šta radi:** nezavisna provera gotovog prolaza: servira mobilnu aplikaciju iz `output/<run-id>/` ili `runs/<x>/`, pusti sve testove iz `tests/`, uporedi sa `results/` i ispiše matricu ekran × scenario. Radi bez API ključa i bez Mozaika i daje isti rezultat svaki put.
- **Fajlovi:** `src/verify/index.ts` (i pomoćni fajlovi po potrebi), `src/verify/verify.test.ts`, `src/verify/mocks/run/` (mali ručni prolaz: plan, testovi, rezultati i statička mobilna aplikacija).
- **Koraci:**
  1. Učitaj i zod-om proveri `plan.json`, `tests/*.json` i `results/*.json`; neispravan fajl → jasna greška sa putanjom.
  2. Servira mobilnu aplikaciju. Način (statički export u runu ili build pri pozivu) zavisi od Q12.
  3. Za svaku jedinicu sa testovima: `runScenarios(url, testovi, { viewport: 390×844, differences: unit.intentionalDifferences })`.
  4. Poredi sa `results/` po scenariju; značenje `ok` je Q13 (predlog: pada ako je scenario koji je u `results/` prolazio sada pao).
  5. Ispis: matrica sortirana po jedinici i scenariju, ✓/✗, status iz `results/`, bez vremena trajanja (da izlaz bude identičan).
  6. Uvozi samo `contracts`, `scenarios/index.ts` (i eventualno `gatekeeper/index.ts`) i `node:*`; `check-layers` to proverava.
- **Gotovo kad:**
  1. `npx vitest run src/verify`: nad `mocks/run/` → `ok: true`; nad kopijom gde je ekran pokvaren → `ok: false` samo za tu jedinicu; dva poziva daju identičnu matricu;
  2. ručno (Git Bash): `env -u ANTHROPIC_API_KEY npm run verify -- <run>` radi (posle A18).
- **Zavisnosti i mock:** B3, C (način serviranja), A18 (CLI). Do A18 zovem funkciju iz testa.
- 🔀 **PR `b/verify`** — posle B12.

### B13 — `sabotage()` (`scripts/sabotage.ts`)
- **Šta radi:** namerno pokvari jedan promovisan ekran u izlazu prolaza (npr. ukloni polje za pretragu), da se pokaže da `verify` to hvata. `verify` posle sabotaže mora da padne baš na testovima te jedinice, i samo na njima.
- **Fajlovi:** `scripts/sabotage.ts` (mesto i oblik: Q14), test uz B12.
- **Koraci:**
  1. Proveri da jedinica postoji u planu, da je promovisana i da ima testove.
  2. Izaberi cilj deterministički: prva labela iz `fill` koraka testova jedinice, a ako je nema, prvo ime iz `tap` koraka.
  3. U fajlovima jedinice u `app/src/screens/<unitId>/` ukloni element sa tim imenom (ili zameni ekran placeholderom; dogovor sa C). Ako `verify` koristi statički export, sabotaža mora da pogodi i njega (Q12, Q14).
  4. Ispiši šta je promenjeno (fajl, ime elementa).
  5. Radi nad kopijom runa, nikad nad originalom u `runs/` (Q14).
- **Gotovo kad:** nad kopijom `verify/mocks/run/`: `sabotage` + `verify` → pada samo jedinica koja je sabotirana; originalni fixture je nepromenjen; isti `unitId` uvek daje istu izmenu.
- **Zavisnosti i mock:** B12, A18 (CLI), C (struktura `app/`).
- 🔀 **PR `b/sabotage`** — posle B13.

### B14 — Pokrivenost → status → izveštaj
- **Šta radi:** povezuje moju pokrivenost sa C-ovim `computeStatus()` i D-ovim izveštajem, da „4/4 obaveze, 6/7 elemenata (nedostaje 'Izvezi CSV')“ i status ekrana dolaze iz istih podataka.
- **Fajlovi:** samo `src/scenarios/` po potrebi; C i D menjaju svoje foldere u svojim PR-ovima.
- **Koraci:**
  1. Sa C: ko i kada zove `extractInteractive` i `computeCoverage` (predlog: Gatekeeper, posle `tests.ready`, jednom po jedinici) i da `Coverage` ide u `results/<unitId>.json` i `board.coverage` (Q11).
  2. Proverim da `computeStatus` dobija `Coverage` i da `notPortable` ne kvari `proven`.
  3. Sa D: izveštaj čita `Coverage` iz `results/`; dam primer fajla.
  4. Test nad ručnim primerom: puna pokrivenost → `proven`; jedan element fali → `partial`.
- **Gotovo kad:** na pravom prolazu nad Receptima `report.html` prikazuje pokrivenost po ekranu i ona se slaže sa `results/`.
- **Zavisnosti i mock:** C (`computeStatus`, Gatekeeper), D (`buildReport`).
- 🔀 **PR `b/coverage-status`** — posle B14 (samo moje izmene).

### Kapija G3 (proverava B)
Puštam na čistom `main`-u, redom:
1. `npm run build && npm test`.
2. Pravi prolaz nad Receptima: bar 3 od 5 ekrana `proven`, ostali imaju tačan razlog u `results/`.
3. `env -u ANTHROPIC_API_KEY npm run verify -- output/<run>` prolazi.
4. Kopija runa → `npm run sabotage -- <kopija> <unitId>` → `verify` pada samo na tom ekranu.
5. `report.html` se otvara i ima sve sekcije.
6. **Prva predaja:** rezultat u `runs/recepti-<vreme>/`, push, predaja na sajtu.

---

## F4: Stabilizacija

### B15 — Popravke i rezervni plan
- **Šta radi:** popravljam samo greške iz crvenog tima (D) i iz izveštaja, bez novih funkcija. Ako je dokazano manje od 4/5 ekrana, prilagođavam `verify` za rezervni plan *Wemora Lab* (provera bilo koje mobilne verzije, i ručno napisane).
- **Koraci:**
  1. Za svaki issue iz crvenog tima: mala grana `b/fix-<opis>`, test koji reprodukuje grešku, popravka.
  2. Ako važi Wemora Lab: `verify` radi i nad folderom bez `results/` i `staging/` (samo `plan.json`, `tests/`, `app/`) i tada samo prijavljuje prolaz/pad.
  3. Proverim da `verify` nad `runs/` prolazi bez ključa (G4).
- **Gotovo kad:** moje stavke G4 prolaze; `docs/status/b.md` je ažuran.
- 🔀 **PR `b/fix-<opis>`** — jedan po popravci.

### B16 — (opciono) Maestro prevodilac
- **Šta radi:** isti DSL preveden u Maestro YAML (`tapOn`, `inputText`, `assertVisible`, `assertNotVisible`, `scrollUntilVisible`) za proveru na Android emulatoru. Prvi je na listi za izbacivanje; radi se samo ako je sve ostalo zeleno.
- **Fajlovi:** `src/scenarios/maestro.ts`, `src/scenarios/maestro.test.ts`.
- **Koraci:** prevod svakog koraka, ubacivanje `reveal` kao u B2, snapshot testovi YAML-a.
- **Gotovo kad:** snapshot testovi prolaze; ručno, jedan scenario prolazi na emulatoru (API 34).
- 🔀 **PR `b/maestro`** — samo ako se radi.

---

## Pitanja za tim

Svako pitanje ima predlog, ali ništa ne menjam dok tim ne odluči. Promene arhitekture i ugovora idu kroz `docs/decisions.md` i granu koju spaja A. Gde se pitanje poklapa sa A-ovim (`docs/tasks/a.md`), navodim njegov broj.

**DSL i izvršavanje**
- **Q1. `apiFixture`.** §11 kaže da `apiFixture` bira podatke iz `examples/mock-api`, ali `RunScenarios` ne dobija adresu mock-api-ja, a nigde nije opisano kako se fixture bira ni kako se stanje vraća na početak između dva puštanja (pravilo 1 traži 2 prolaza zaredom). Predlog (D): mock-api ima rutu za izbor i reset fixture-a, a adresa dolazi iz okruženja; `runScenarios` je zove pre svakog scenarija.
- **Q2. Poklapanje imena i teksta.** Nije zadato da li je poređenje tačno ili podniz, ni šta kad više elemenata ima isti tekst. Predlog: uloga+ime i labela tačno; `expectVisible {text}` — bar jedan vidljiv element sadrži tekst; `expectNotVisible` — nijedan; `tap {text}` — tačno jedan element, inače greška.
- **Q3. Šta je „radnja“ u pravilu 3.** Ako se i `goto` računa, svaka provera „pre `goto`“ trivijalno pada. Predlog: radnje su samo `tap` i `fill`; provere pre prve radnje ne podležu pravilu 3 (pokriva ih pravilo 2).
- **Q4. Prazan ekran.** (a) U kom viewportu i sa kojim razlikama se pušta? Ako se ubaci `reveal`, test pada samo zato što placeholder nema dugme, pa pravilo 2 ništa ne dokazuje. Predlog: 390×844, bez razlika. (b) Kad je jedinica već promovisana (drugi tester posle timeouta), u `app/` više nema placeholdera. Predlog: placeholder se servira iz netaknute kopije scaffolda; to dodaje folder u §7, pa treba odluka (C).
- **Q5. `notPortable` u scenariju.** Nije rečeno šta ako tester ipak koristi takav element. Predlog: `save_scenario` ga odbija, a prevodilac vraća grešku.
- **Q6. `movedTo`.** §8 kaže da testovi za premešten podatak „pripadaju toj jedinici“, ali tester piše scenario za jedinicu koju je dobio, sa `goto` na web rutu originala. Ko menja `unitId` i koji `goto` važi na telefonu?
- **Q7. `goto` i `routeMap`.** *Rešeno u B0:* `routeMap` menja samo zapis rute (`/recepti/:id` → `/recepti/[id]`), a Expo Router na webu daje isti URL kao original (`/recepti/3`), pa mobilni izvršilac ne prevodi putanju. Ako arhitekta ikad promeni sam URL, ovo se otvara ponovo.

**Tester**
- **Q8. Ko pokreće original, mock-api i scaffold i daje URL-ove.** §3 kaže da tester dobija „jedinicu + URL originala“, ali `TestTask` ima samo `unitId`, a `RunConfig` nema URL-ove. Predlog: Conductor ih pokreće jednom po prolazu, a URL-ovi idu u `RunConfig` (promena `state.ts`) ili kao parametri fabrike testera.
- **Q9. Format `tests/<unitId>.json`.** Nije zadat. Predlog: JSON niz `Scenario[]`, proveren šemom niza iz `contracts/`.
- **Q10. `tests.ready` bez pune pokrivenosti** (veza P9). Šta ako petlja završi ili istekne pre nego što su sve obaveze pokrivene? Predlog: ako je sačuvan bar jedan scenario, tester ipak šalje `tests.ready`, a status će biti `partial`. Drugi tester (posle timeouta) dopisuje u isti fajl, bez duplikata po `id`.
- **Q16. Interfejs testera** (veza P6). Potvrđujem da fabrika vraća `AgentHandle<TestTask>`; tražim da fabrika sme da dobije zavisnosti kao parametre (URL-ovi, funkcije za test bez browsera).
- **Q17. Mesto MockRunner odgovora** (veza P13).

**Pokrivenost i statusi**
- **Q11. Ko zove `extractInteractive` i gde se čuva lista.** Nije zadato ko je zove ni kada, a §7 nema fajl za nju. Predlog: Gatekeeper (C), jednom po jedinici posle `tests.ready`; lista se ne čuva posebno jer je cela sadržana u `Coverage` (`covered` + `missing` + `notPortable`) u `results/<unitId>.json`.
- **Q15. Testovi toka** (veza P12). Ko piše testove toka, gde se čuvaju i da li ih piše tester? Moji zadaci ih zato trenutno ne pokrivaju.

**`verify` i sabotaža**
- **Q12. Kako `verify` servira mobilnu aplikaciju bez mreže.** `app/` u `runs/<x>/` nema `node_modules`, pa `expo export` traži `npm install` (mreža) i traje. Predlog: Gatekeeper na kraju prolaza upiše statički web export u run (npr. `web/`), a `verify` ga servira preko `scenarios/serve.ts`. To dodaje folder u §7, pa treba odluka (C, D).
- **Q13. Šta znači `ok` u `verify`.** Ako ekran ima status `failed`, njegovi testovi padaju i u `verify`, pa bi `verify` uvek vraćao 1. Predlog: `ok` je `false` kad scenario koji je u `results/` prolazio sada pada; ostala odstupanja se ispisuju, ali ne obaraju exit kod.
- **Q14. Mesto i način sabotaže.** `scripts/` nije u `tsconfig` (`include: ["src"]`) ni u `check-layers`, a A18 uvozi `sabotage()` iz CLI-ja. Predlog: logika u `src/verify/sabotage.ts`, izvoz kroz `verify/index.ts`, a `scripts/sabotage.ts` ostaje tanak omotač ili otpada (promena vlasništva u tim-plan §1). Takođe: menja li sabotaža zadati folder na mestu (korisnik prvo kopira) ili sama pravi kopiju?

**Zavisnosti, konstante, izvozi**
- **Q18. Playwright** (veza P15). Predlog: `playwright` (biblioteka), tačno pinovan; README (D) dobija korak `npx playwright install chromium`. `npm test` posle toga radi bez mreže.
- **Q19. Spike A.** Čekam C-ovu odluku u `docs/decisions.md`. Ako se prelazi na `testID`, menjaju se prevodilac (B2) i ugovor za buildera.
- **Q20. Vremenski limit po koraku testa.** Predlog: konstanta u `core/config.ts` (`DEFAULTS`, A), koju domen sme da uvozi (P3).
- **Q21. Javni izvozi van tim-plan §1.** Tester treba ARIA snapshot, a `verify` statički server, oba iz `scenarios/index.ts`. Predlog: to su izvozi mog `index.ts`, pa ne idu u `contracts/api.ts`. *Delimično rešeno:* `serveStatic` se izvozi iz `index.ts` i koristi ga i C (`serveApp`, D-006), pa mu se ponašanje (SPA fallback, `close()`) menja samo uz dogovor sa C.
- **Q22. Prvi korak scenarija.** Predlog: `steps` (ili `setup`, ako postoji) mora početi sa `goto`, inače je početno stanje nedefinisano. Ovo je novo pravilo validacije, pa tražim potvrdu.
