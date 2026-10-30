# Wemora — plan tima

**4 osobe: A, B, C, D**

Ovaj dokument kaže ko šta radi, kojim redom i kada se kod spaja i proverava. Šta pravimo i zašto je u `docs/wemora-plan.md`. Kako je sistem sastavljen (komponente, događaji, tabla, kapije, invarijante) je u `docs/architecture.md`. Pravila za kod su u `CLAUDE.md`.

**Ako se ovaj plan ne slaže sa `docs/architecture.md`, važi arhitektura**, a za tačne oblike podataka važi `src/contracts/`. Neslaganje se javlja timu, ne rešava se sam.

**Glavno pravilo:** rad ide u **fazama**. Na kraju svake faze je **kapija (G0–G4)**: svi spoje svoje PR-ove, jedna osoba na čistom `main`-u pusti listu provera, i tek kad sve prođe kreće sledeća faza. Tako nikad nemamo gomilu koda koji nije proveren zajedno.

---

## 1. Uloge i vlasništvo

| Osoba | Uloga | Folderi (samo ona menja) | Javne funkcije koje drugi koriste |
|---|---|---|---|
| **A** | Orkestracija i Mozaik | `src/contracts/` (vodi), `src/core/`, `src/orchestration/`, `src/agents/_shared/`, `src/cli.ts`, `scripts/check-layers.ts` | `runtime` (`runLoop`, `sendEvent`, `join`, `leave`), `MigrationState`, `BudgetedRunner`, `MockRunner`, `log()`, `config`, `freshContext()`, `OwnershipGuard` |
| **B** | Testovi i dokaz | `src/scenarios/`, `src/verify/`, `src/agents/tester.ts`, `scripts/sabotage.ts` | `runScenarios()`, `validateScenario()`, `extractInteractive()`, `computeCoverage()`, `verify()`, `sabotage()` |
| **C** | Gatekeeper i mobilna aplikacija | `src/gatekeeper/`, `src/scaffold/`, `templates/expo/`, `src/agents/builder.ts`, `src/agents/gatekeeperParticipant.ts` | `scaffold()`, `checkDraft()`, `promote()`, `rollback()`, `serveApp()`, `computeStatus()` |
| **D** | Ulaz, izlaz i integracija | `src/analysis/`, `src/report/`, `examples/`, `src/agents/analyzer.ts`, `src/agents/architect.ts`, `README.md`, `runs/` | `parseApp()` → `ParsedApp`, `validatePlan()`, `buildReport()` |

Tačni potpisi i tipovi su u `src/contracts/` (kod pobeđuje tekst). Ako nešto od ovoga nema u ugovorima, A to dodaje u Fazi 0.

**Ko kome radi review** (parovi prate gde se delovi dodiruju):

| PR od | Review radi | Zašto |
|---|---|---|
| A | C | Gatekeeper-učesnik i builder koriste runtime i OwnershipGuard |
| B | C | Gatekeeper poziva `runScenarios()` |
| C | B | C koristi scenarije i web build za testove |
| D | A | arhitekta i analizator su agenti, plan ide Conductoru |

Review traje najviše 10 minuta. Ako recenzent ne stigne za 15 minuta, PR spaja autor, a recenzent ga pogleda naknadno.

---

## 2. Pravila za PR i git (kratko)

1. **Mali PR-ovi:** jedan PR = jedna stvar koja radi i ima test. Cilj je 2–4 PR-a po osobi po fazi, ne jedan ogroman na kraju.
2. **Svaki PR mora da prođe pre spajanja:**
   ```bash
   git pull --rebase origin main
   npm run build      # tsc + provera slojeva
   npm test           # vitest, bez mreže
   ```
3. **Svaki PR ažurira `docs/status/<osoba>.md`**: šta je gotovo, šta je još mock (šablon na kraju dokumenta).
4. **Ugovori** (`src/contracts/`) se menjaju samo kroz granu `contracts/<opis>`, koju spaja A, uz poruku u chatu tima. Posle toga svi odmah urade `git pull --rebase`.
5. **Zavisnosti** (`package.json`) se dodaju samo kroz poseban mali PR koji sadrži samo `package.json` i `package-lock.json`. Posle spajanja svi urade `npm ci`.
6. **Kad zatreba tuđi deo koji još ne postoji:** napravi mock u svom folderu (`<folder>/mocks/`) i zabeleži ga u status. Mock se briše u fazi kad pravi deo stigne.
7. **Kapija je stop za sve:** u vreme kapije niko ne počinje novi posao dok lista provera ne prođe.

**Rad sa Claude Code-om:** na početku svake sesije napiši: *„Ja sam osoba X. Pročitaj `CLAUDE.md`, `docs/architecture.md`, `docs/tasks/x.md` i `docs/status/x.md`. Radimo korak X.Y.“* Tako agent ne dira tuđe foldere. `docs/tasks/<x>.md` su koraci te osobe iz ovog plana (faze F0–F4), prepisani u jedan fajl. Za Mozaik API agent čita `.claude/rules/mozaik.md`.

---

## 3. Pregled faza

| Faza | Cilj | Kapija |
|---|---|---|
| **F0 Temelj** | Repo, ugovori, kostur `core/`, sve zavisnosti | **G0** |
| **F1 Delovi rade sami** | Svaki domenski deo radi sa mockovima i ima testove | **G1** |
| **F2 Jedan ekran ceo put** | Agenti i Conductor povezani; TodoMVC prolazi automatski | **G2** |
| **F3 Recepti i dokaz** | Ceo prolaz nad Receptima, statusi, `verify`, sabotaža, izveštaj | **G3** + **prva predaja** |
| **F4 Stabilizacija** | Crveni tim, popravke, rezervni plan ako treba | **G4** = zaključavanje koda |
| Predaja | Finalni prolaz u `runs/`, predaja na sajtu | — |

Kontrolna tačka iz glavnog plana ostaje: **bar 4 od 5 ekrana Recepata dokazano** u F4, inače prelazimo na rezervni plan *Wemora Lab* (iz `wemora-plan.md`).

---

## 4. F0 — Temelj

Ako je nešto od ovoga već urađeno, samo proverite da kapija G0 prolazi i pređite na F1.

### Svi zajedno (na početku)
- Pregledaju `src/contracts/` i dogovore tipove po `docs/architecture.md`:
  - `types.ts`: `ParsedApp`, `AnalyzerReport`, `Plan = { units, flows, routeMap }`, `Unit` (`id`, `kind`, `wave`, `route?`, `sources`, `writes`, `dependsOn`, `obligations`, `intentionalDifferences`, `size`), `Flow`, `GateResult`, `ScenarioResult`, `ScreenStatus` (`proven | partial | unproven | failed`)
  - `scenario.ts`: DSL (`goto`, `tap`, `fill`, `expectVisible`, `expectNotVisible`), scenario sa `id`, `unitId`, `obligation`, `setup?`, `apiFixture?`, `steps`
  - `difference.ts`: `hiddenBehind` (sa `reveal`), `movedTo`, `notPortable`
  - `state.ts`: oblik `MigrationState` (status jedinice `waiting | building | submitted | promoted | failed`)
  - `events.ts`: imena i payload-i (samo ID-jevi: `{ partId }`, `{ unitId }`, `{ unitId, round }`)
- Dogovore potpise javnih funkcija iz tabele u odeljku 1.

### A
1. Push kostura repoa: `package.json` sa svim zavisnostima, `tsconfig.json` (strict, ESM), `.gitignore`, `.env.example`, `vitest` konfiguracija.
2. `src/contracts/` sa svim tipovima i zod šemama iz dogovora.
3. `scripts/check-layers.ts` (D-004) i ubacivanje u `npm run build`. Pravila iz `architecture.md` §2: domen ne sme da zavisi od `@mozaik-ai/core`, `agents/` ni `orchestration/`, ni direktno ni preko drugih fajlova; drugi domen samo preko njegovog `index.ts`; u `core/` samo `runtime.ts`, `state.ts` i `runner.ts` smeju da uvoze Mozaik.
4. Prazni `index.ts` u svakom folderu, sa potpisima funkcija koje bacaju `"not implemented"`.

### B, C, D (dok A radi korake 1–4)
- **B:** prazan `docs/status/b.md`; pokrene `examples/recepti` lokalno (ako postoji) i Playwright (`npx playwright install chromium`).
- **C:** generiše Expo SDK 58 šablon u `templates/expo/` (Expo Router, TypeScript) i proveri da `npx expo export --platform web` radi.
- **D:** prebaci TodoMVC React primer u `examples/todomvc/` i proveri da se pokreće.

### Kapija G0 — proverava A
- [ ] `git clone` + `npm ci` + `npm run build` prolazi na čistom klonu
- [ ] `npm test` se pokreće (može 0 testova)
- [ ] `check-layers.ts` (`npm run build`) pada ako se u `src/scenarios/` privremeno doda `import "@mozaik-ai/core"` (proverite, pa vratite)
- [ ] `templates/expo/` pravi web export
- [ ] svi su povukli `main` i napravili svoju granu za F1

---

## 5. F1 — Svaki deo radi sam

Niko ne čeka nikoga. Svako radi nad mockovima i ručno napisanim primerima.

### A — runtime, runner i Conductor bez agenata
1. **`core/runtime.ts`, `core/state.ts`:** jedini `defineRuntime<MigrationState>()`; tabla po `contracts/state.ts` (`runId`, `parsed`, `reports`, `plan`, `units`, `tests`, `results`, `coverage`, `statuses`, `agents`, `ledger`, `config`).
2. **`core/runner.ts`:**
   - `BudgetedRunner`: retry na 429/529/mrežu, nikad ne baca grešku, računa trošak iz `tokenUsage`, tvrdi limit (`--budget`), šalje `budget.exceeded`.
   - `MockRunner`: vraća unapred zapisane odgovore iz JSON fajla (po agentu i koraku), uključujući function call-ove i structured output. Bez ovoga niko ne može da testira tok za $0.
   - dodat `claude-haiku-5-5` u listu modela.
3. **`core/config.ts`:** sve vrednosti iz `architecture.md` §9 na jednom mestu: formule za broj agenata (`maxBuilders = 4`, `maxTesters`), modeli po rundi (1–2 Haiku 5.5, 3–4 Sonnet 5.5), timeouti (builder 10 min po rundi, tester 8 min po jedinici, Gatekeeper čeka testove 10 min).
4. **`core/log.ts`, `core/safety.ts`:** JSONL log (`t`, `agent`, `event`, trošak, podaci) u `output/<run>/run.jsonl`; `unhandledRejection` handler.
5. **`agents/_shared/`:** `freshContext(prompt)`, `OwnershipGuard(prefix)`, pomoćnik za pravljenje alata, pomoćnik za structured output sa zod proverom i najviše 2 ponovna pokušaja.
6. **`orchestration/queue.ts`:** red zadataka sa talasima i zavisnostima (bez Mozaika, čista logika). Izbor sledeće jedinice po `architecture.md` §9: sve `dependsOn` promovisane → testovi već postoje → više tokova zavisi od nje → veća pre manje.

**Testovi:** red zadataka (talasi, zavisnosti, redosled izbora, oslobađanje posle promocije); `OwnershipGuard.isSatisfiedBy` za `staging/<builderId>/<unitId>/` (dozvoljeno) i bilo šta drugo (odbijeno); runner: retry i prekid na limitu budžeta.

**PR-ovi:** `a/runtime-runner`, `a/shared-guard`, `a/queue`.

### B — scenariji nad pravim browserom
1. **`scenarios/compile.ts`:** svaki DSL korak → Playwright akcija (`goto`, `tap {role,name}`, `tap {text}`, `fill {label,value}`, `expectVisible`, `expectNotVisible`), sa automatskim skrolom i auto-wait-om. Za mobilni izvršilac prevodilac ubacuje `reveal` korake iz `hiddenBehind` razlika jedinice.
2. **`scenarios/run.ts`:** `runScenarios(baseUrl, scenarios, { viewport, differences })` → `ScenarioResult[]`. Viewport 1280×800 za original, 390×844 za mobilnu verziju. Prvo se puštaju `setup` koraci, pa `steps`.
3. **Podaci za testove:** obe aplikacije čitaju isti `examples/mock-api` (adresa iz `VITE_API_URL` / `EXPO_PUBLIC_API_URL`; `apiFixture` bira podatke). Stanje u klijentu (npr. omiljeni) priprema se **`setup` koracima preko UI-ja, ne upisom u skladište**, jer se ključevi razlikuju između weba i telefona.
4. **`scenarios/validate.ts`:** `validateScenario(originalUrl, blankUrl, scenario)`: prolazi na originalu (2× zaredom), pada na praznom ekranu, svaka `expect*` provera pada kad se pusti pre svoje radnje. Za prazan ekran u F1 koristi mali statički HTML u `scenarios/mocks/`; u F2 ga menja placeholder ekran iz C-ovog scaffolda.
5. **`scenarios/interactive.ts`:** `extractInteractive(url, route)` iz `ariaSnapshot()`: lista dugmadi, polja i linkova.
6. **`scenarios/coverage.ts`:** `computeCoverage()`: obaveze iz plana pokrivene testovima + interaktivni elementi korišćeni u bar jednom testu, minus `notPortable`.

**Testovi:** kompajler (snapshot generisanih koraka, uključujući ubačen `reveal`); `runScenarios` nad malom statičkom HTML stranom u `scenarios/mocks/` (pokreće se lokalni server, bez interneta); `computeCoverage` nad ručnim primerom.

**Ručna provera:** 3 ručno napisana scenarija za Recepte prolaze na originalu.

**PR-ovi:** `b/compiler-runner`, `b/validate-setup`, `b/interactive-coverage`.

### C — Spike A, scaffold i kapije
1. **Spike A, prvi korak, najvažnije u celoj fazi:** ručno napravi jedan Expo ekran (polje sa `accessibilityLabel="Pretraga"`, dugme, lista) i proveri da ga Playwright nalazi sa `getByLabel`/`getByRole`/`getByText` na RN-webu. Proveri i `role="listitem"`. Zapiši rezultat u `docs/decisions.md`. **Ako ne radi**, odmah javi timu: prelazimo na `testID` ugovor (B menja kompajler).
2. **Izmeri:** koliko traje `expo export --platform web` za šablon. Ako je preko ~30 s, Gatekeeper koristi Metro dev server nad `app/` (inkrementalno, brzo), a statički export samo `verify`. Zapiši u `docs/decisions.md`.
3. **`scaffold/`:** `scaffold(plan, outDir)`: kopira šablon u `app/`, pravi jednu Expo Router rutu po ekranu u `app/src/app/…`, placeholder u `app/src/screens/<unitId>/`, prazne `app/src/shared/<unitId>/`. API adresa iz `EXPO_PUBLIC_API_URL`.
4. **`gatekeeper/gates/`, tačno ovim redom** (`architecture.md` §10): `parse` (Babel) → `forbiddenApis` (`div`, `span`, `window`, `document`, `localStorage`, `react-dom`, `react-router-dom`) → `tsc` (nacrt + `app/`) → `labels` (svaka labela i tekst iz testova jedinice postoji u kodu nacrta). Opciono `androidExport` (`expo export --platform android`).
5. **`gatekeeper/promote.ts`:** `promote(unitId, draftDir)`: `staging/<builderId>/<unitId>/` ima isti raspored kao `app/src/`, pa je promocija kopiranje; čuva prethodnu verziju za `rollback(unitId)`.
6. **`gatekeeper/serve.ts`:** `serveApp(appDir)` → URL (dev server ili statički, po odluci iz koraka 2).
7. **`gatekeeper/status.ts`:** `computeStatus()` po tabeli iz `architecture.md` §10. Nula testova nikad nije `proven`.

**Testovi:** svaka kapija nad dobrim i lošim fixture fajlom (`gatekeeper/mocks/`); promote + rollback vraća tačno prethodni fajl; `computeStatus` za sva 4 statusa.

**PR-ovi:** `c/spike-a` (samo `docs/decisions.md` i primer), `c/scaffold`, `c/gates`, `c/promote-serve`.

### D — test aplikacije, parser i izveštaj
1. **`examples/recepti/`:** 5 ekrana, **namerno samo za desktop** (bočni meni, široka tabela, lista i detalj jedan pored drugog, hover info, omiljeni u `localStorage`). Pristupačna imena na svim poljima i dugmadima. Podaci iz `examples/mock-api/` preko `VITE_API_URL`.
2. **`analysis/`:** `parseApp(webDir)` → `ParsedApp`: rute iz React Routera, fajlovi po ruti, upotreba web API-ja, veličina u tokenima (procena). Podelu ruta na N delova za analizatore pravi posebna funkcija `splitParts(parsed, n)`; N daje Conductor (D-010). Nepodržan ulaz (Next.js) → jasna greška.
3. **`analysis/validatePlan.ts`:** `validatePlan(plan, parsed)`: svaka ruta iz parsera je u planu, svaki izvorni fajl pripada najviše jednoj jedinici, `dependsOn` pokazuju na postojeće jedinice; vraća listu grešaka (prazna = ok).
4. **`report/`:** `buildReport(runDir)` iz ručno napisanog fixture-a (`report/mocks/run/`): matrica ekran × scenario, statusi u 4 boje, pokrivenost, namerne razlike. Vremenska osa i trošak mogu u F3.
5. **`README.md`:** kostur sa koracima pokretanja (dopunjuje se u svakoj fazi).

**Testovi:** `parseApp` nad `examples/recepti` (5 ruta) i `examples/todomvc` (očekivane rute), podela na 1 i na 2 dela; `validatePlan` hvata rutu koja fali i fajl u dve jedinice; `buildReport` napravi HTML bez greške.

**PR-ovi:** `d/recepti`, `d/parser`, `d/validate-plan`, `d/report-v1`.

### Kapija G1 — proverava D
- [ ] svi F1 PR-ovi spojeni, `npm run build && npm test` zeleno na čistom `main`-u
- [ ] **Spike A odlučen** i zapisan u `docs/decisions.md`
- [ ] `parseApp(examples/recepti)` vraća 5 ekrana
- [ ] B: 3 ručna scenarija prolaze na pokrenutim Receptima; `validateScenario` odbija scenario koji prolazi i na praznom ekranu
- [ ] C: `scaffold()` nad ručno napisanim `plan.json` za Recepte pravi aplikaciju koja se servira; ručno napisan dobar ekran prolazi sve 4 kapije, loš pada na tačnoj
- [ ] **Prvi zajednički test:** B-ov scenario puštén preko C-ovog `serveApp()` nad ručno napisanim RN ekranom prolazi (ovo je mali „ceo put“ bez AI-ja)
- [ ] A: unit testovi reda, runnera i guarda prolaze
- [ ] svaki `docs/status/*.md` ažuriran

Ako stavka padne: vlasnik je popravlja odmah, ostali pomažu ili kreću na F2 korake koji ne zavise od nje.

---

## 6. F2 — Jedan ekran ceo put

Sada se uvode agenti. Broj agenata je u ovoj fazi **fiksan** (1 analizator, 2 buildera, 1 tester); dinamika dolazi u F3.

### A — Conductor i povezivanje
1. **`orchestration/conductor.ts`:** tok iz `architecture.md` §4:
   - `cli migrate` → napravi `output/<run-id>/`, runtime, tablu → `parseApp()` → pokreće analizatore (u F2 jedan)
   - `analysis.done` ×N → kad stignu svi, pokreće arhitektu
   - `plan.ready` → `scaffold()` (C), puni red po talasima; **testeri odmah kreću na sve talase**, builderi na talas 0
   - `tests.ready` / `draft.submitted { unitId, round }` → Gatekeeper-učesnik reaguje sam
   - `gate.failed { unitId, round }` → **isti builder**, sledeća runda, svež kontekst (prompt + izvor + trenutni kod + poslednja greška). U F2 samo runde 1–2 na Haiku 5.5, zatim jedinica `failed`
   - `unit.promoted` → oslobađa zavisne jedinice i ponovo računa broj agenata
   - builder bez posla → `leave`; gasi se samo agent bez aktivne petlje
2. **`cli.ts`:** `wemora migrate <web-dir> [--out output] [--max-builders 4] [--max-testers 2] [--budget 3] [--mock]`.
3. **MockRunner scenario fajlovi** za ceo tok nad TodoMVC-om (zajedno sa B, C, D: svako da 2–3 primera odgovora svog agenta).
4. Timeouti iz `core/config.ts`: builder 10 min po rundi, tester 8 min po jedinici; posle 10 min bez testova jedinica ide drugom testeru, posle drugog isteka ekran se promoviše kao `unproven`.

**Testovi:** Conductor nad lažnim događajima (bez modela): red zadataka ide redom kojim treba.

### B — agent tester
1. **`agents/tester.ts` + `prompts/tester.md`:** alati `aria_snapshot(route)`, `try_scenario(scenario)` (zove `validateScenario`), `save_scenario` (prihvata **samo** scenarije koji prolaze `validateScenario`). Tester vidi samo original. Model Haiku 5.5.
2. Kad su obaveze iz plana pokrivene → `tests.ready { unitId }`.
3. Upis testova u `output/<run>/tests/<unitId>.json`; tester piše samo tu.
4. `validateScenario` sada koristi placeholder ekran iz C-ovog scaffolda kao „prazan ekran“.

### C — agent builder i Gatekeeper-učesnik
1. **`agents/builder.ts` + `prompts/builder.md` + `prompts/web-to-rn.md`** (tabela mapiranja web → RN): alati `read_source` (izvorni web fajlovi jedinice, samo čitanje), `read_app` (trenutni `app/`, samo čitanje), `write_file` (OwnershipGuard: samo `staging/<builderId>/<unitId>/`), `check_draft` (kapije 1–4, brza provera), `submit_draft` → `draft.submitted { unitId, round }`. **Builder nema nijedan alat za testove.**
2. **`gatekeeper/index.ts`:** `checkDraft(unitId, draftDir, tests)` = kapije 1–4 → kapija 5 `scenarios` (testovi jedinice nad Expo web buildom sa nacrtom, mobilni viewport) → promocija u `app/` → regresija (testovi svih već promovisanih jedinica) → rollback ako regresija padne. Vraća `GateResult[]` sa porukom koju builder razume; kod regresije i listu pokvarenih testova.
3. **Zajedničke jedinice (talas 0)** prolaze samo kapije 1–3 (i opciono `androidExport`) i nemaju sopstvene UI testove.
4. **`agents/gatekeeperParticipant.ts`:** deterministički učesnik koji na `draft.submitted` pušta `checkDraft` i šalje `gate.failed { unitId, round }` ili `unit.promoted { unitId }`. Proverava **serijski**, jedan nacrt odjednom.
5. Pravilo „bez testova nema zelenog“: ako ekran nema testova, nacrt čeka (timeout iz `core/config.ts`).

### D — agenti analizator i arhitekta
1. **`agents/analyzer.ts` + `prompts/analyzer.md`:** dobije svoj deo `ParsedApp`, alati `read_file` i `list_files` (samo njegov deo + zajednički fajlovi, samo čitanje), vraća `AnalyzerReport[]` kao structured output (zod-validiran), upiše `analysis/<partId>.json` i šalje `analysis.done { partId }`. Model Haiku 5.5.
2. **`agents/architect.ts` + `prompts/architect.md`:** bez alata, structured output, Sonnet 5.5. Spaja izveštaje u `Plan` (`units`, `flows`, `routeMap`): zajedničke jedinice u talasu 0, adrese, `dependsOn`, `writes`, obaveze, strukturisane namerne razlike (`hiddenBehind`, `movedTo`, `notPortable`), talasi. Zatim `validatePlan()`; ako ima grešaka, arhitekta dobija listu i ponavlja **najviše 2 puta**, posle toga prolaz staje sa greškom. Upiše `plan.json` i šalje `plan.ready`.
3. Ručno proveri plan za Recepte: da li obaveze imaju smisla (to je osnova pokrivenosti) i da li ekrani zavise samo od zajedničkih jedinica.

### Integracija (svi)
1. **Prvo:** `npm run migrate:mock -- examples/todomvc` prolazi do kraja sa MockRunner-om. Ovo hvata greške u povezivanju bez trošenja tokena.
2. **Zatim:** isto sa pravim modelom (`npm run migrate -- examples/todomvc --budget 1`).
3. Popravke. Svako popravlja samo svoj folder.

### Kapija G2 — proverava A
- [ ] `npm run build && npm test` zeleno na čistom `main`-u
- [ ] `migrate:mock` nad TodoMVC-om završava bez greške i pravi `output/<run>/` sa svim fajlovima iz `CLAUDE.md`
- [ ] **pravi prolaz nad TodoMVC-om: bar 1 ekran „dokazan“**, sa validiranim testovima, kroz Gatekeeper
- [ ] `run.jsonl` pokazuje da su tester i builder radili **u isto vreme** (preklapanje vremena)
- [ ] namerno pokvaren nacrt (ručno) dobija `gate.failed` sa razumljivom porukom i builder ga popravlja u sledećoj rundi
- [ ] builder nije mogao da pročita ni upiše ništa u `tests/` ni u `app/` (proveriti u `run.jsonl` da nema uspešnih upisa van `staging/`)
- [ ] trošak prolaza je zapisan i ispod limita
- [ ] prvi rezultat commit-ovan u `runs/todomvc-<vreme>/` (rezerva ako sve drugo propadne)

**Ako G2 ne prolazi:** u F3 se prvo završava G2. Ništa novo se ne dodaje dok ceo put ne radi.

---

## 7. F3 — Recepti i dokaz

### A — dinamika i otpornost
1. Conductor računa broj agenata po formulama iz `architecture.md` §9 (vrednosti u `core/config.ts`) i zapisuje razlog u log („5 ekrana → 1 analizator, 4 buildera, 2 testera“). Broj se menja najviše jednom u minutu.
2. Eskalacija: runde 3–4 na Sonnet 5.5, posle 4. neuspele runde jedinica je `failed`.
3. Smanjenje paralelnosti na 429 i na `budget.exceeded`.
4. Prilagođavanje u toku rada (dodaj testera kad red bez testova raste) **samo ako je sve ostalo zeleno**. Ovo je stavka 3 u redosledu izbacivanja.
5. U `cli.ts` poveže `wemora verify <run-dir>` i `wemora sabotage <run-dir> <unitId>` sa B-ovim funkcijama.

### B — `verify` i sabotaža
1. **`verify/`:** `verify(runDir)` nad `output/<run-id>/` ili `runs/<x>/`: statički web build iz `app/`, pusti sve testove iz `tests/`, uporedi sa `results/`, ispiše matricu. **Bez API ključa i bez Mozaika** (proverava `check-layers`), isti rezultat svaki put.
2. **`scripts/sabotage.ts`:** `sabotage(runDir, unitId)` pokvari jedan promovisan ekran (npr. obriše polje za pretragu u kopiji izlaza); `verify` mora da padne baš na testovima te jedinice.
3. `computeCoverage()` povezan sa C-ovim `computeStatus()` i sa izveštajem.

### C — promocija i statusi
1. Regresija i rollback (iz F2) provereni nad pravim prolazom sa više jedinica.
2. Statusi `proven / partial / unproven / failed` po `architecture.md` §10; zapis u `results/<unitId>.json`.
3. Ekran bez testova posle drugog timeouta ulazi u aplikaciju kao `unproven`.
4. Testovi toka (`Flow`): Gatekeeper ih pušta kad su sve jedinice toka promovisane. **Samo ako je sve ostalo zeleno** (stavka 4 u redosledu izbacivanja).
5. Opciono, poslednje: kapija `androidExport`.

### D — izveštaj i README
1. `buildReport` iz pravog `output/`: matrica, statusi, pokrivenost („4/4 obaveze, 6/7 elemenata“), namerne razlike, **vremenska osa iz `run.jsonl`**, trošak po agentu, mera ubrzanja (zbir vremena agenata / ukupno vreme), broj agenata i razlog.
2. `README.md` po kategorijama bodovanja: šta je i zašto (korisnost), dijagram slojeva i agenata (Mozaik), **koraci pokretanja od nule** (radi iz README-a), `verify` bez ključa, ograničenja.

### Kapija G3 — proverava B
- [ ] `npm run build && npm test` zeleno
- [ ] pravi prolaz nad Receptima: **bar 3 od 5 ekrana dokazano**, ostali imaju tačan razlog
- [ ] `npm run verify -- output/<run>` prolazi **bez `ANTHROPIC_API_KEY`** u okruženju
- [ ] `npm run sabotage` + `verify` pada na pokvarenom ekranu, i samo na njemu
- [ ] `report.html` se otvara i prikazuje sve sekcije
- [ ] **PRVA PREDAJA:** rezultat u `runs/recepti-<vreme>/`, push, predaja na sajtu. Ponovne predaje su dozvoljene.

---

## 8. F4 — Stabilizacija

### D — crveni tim (cela faza)
1. Novi folder, `git clone`, prati **samo README**, korak po korak, kao da je žiri. Svaki korak koji ne radi ili nije jasan → issue vlasniku.
2. Pusti `verify` i `sabotage` iz README-a.
3. Pusti `migrate` nad TodoMVC-om iz README-a.

### A, B, C
- Popravljaju samo greške iz crvenog tima i iz izveštaja. **Nove funkcije ne.**
- Ako ostane vremena, redom: testovi toka → prilagođavanje broja agenata → eskalacija (obrnuto od redosleda izbacivanja).

### Odluka posle prvog stabilnog prolaza
- **≥ 4 od 5 ekrana dokazano:** nastavljamo stabilizaciju.
- **manje:** rezervni plan *Wemora Lab*: builderi postaju opcioni, a fokus je na analizatorima, arhitekti, testerima i `verify` nad bilo kojom mobilnom verzijom (može i ručno napisanom). D menja README, B i C prilagode `verify` i Gatekeeper.

### Kapija G4 = zaključavanje koda — proverava D
- [ ] čist klon + README → sve komande rade
- [ ] finalni prolaz nad Receptima i TodoMVC-om commit-ovan u `runs/`
- [ ] `verify` nad `runs/` prolazi bez ključa
- [ ] nema `.env`, ključeva ni `CLAUDE.local.md` u istoriji (`git log -p | grep -i "sk-ant"` ne vraća ništa)
- [ ] status svih osoba ažuriran, `docs/decisions.md` ima sve odluke

**Posle G4:** finalna predaja na sajtu. Posle predaje se kod ne menja, samo priprema demoa i snimak kao rezerva.

---

## 9. Šta radi ko kad je blokiran

| Situacija | Šta raditi |
|---|---|
| Čekaš tuđu funkciju | Mock u `<tvoj-folder>/mocks/`, zapis u status, nastavi |
| Ugovor ne odgovara | Stani, napiši u chat tačno šta treba promeniti; A pravi `contracts/<opis>` |
| Kapija pada na tuđem delu | Vlasnik popravlja; ti mu pomažeš ili radiš sledeći korak koji ne zavisi od toga |
| Pravi model troši previše | Prelazi na `--mock`; A proverava limit u runneru |
| Spike A ne radi | Odmah prelazak na `testID` ugovor (odluka u `docs/decisions.md`) |
| Faza kasni više od 1 h | Izbaci sledeću stavku iz redosleda izbacivanja; ne pomeraj kapiju unedogled |
| Zadatak se ne slaže sa `architecture.md` ili `src/contracts/` | Stani, javi timu; promena ide kroz `docs/decisions.md` i granu koju spaja A |

**Redosled izbacivanja ako se kasni:** 1. Android i Maestro (`androidExport`), 2. eskalacija modela (ostaju samo runde na Haiku 5.5), 3. prilagođavanje broja agenata u toku rada, 4. testovi toka, 5. regresija posle promocije.

**Nikad se ne izbacuje:** testovi iz originala, testeri istovremeno sa builderima, Gatekeeper sa pravilom „nula testova nikad nije `proven`“, izveštaj i `verify`.

---

## 10. Šablon za `docs/status/<osoba>.md`

```markdown
# Status: osoba B
Faza: F3

## Gotovo (spojeno u main)
- scenarios/compile.ts, run.ts (PR b/compiler-runner)

## U radu
- verify/ — fali poređenje sa results/

## Mockovi koje koristim
- scenarios/mocks/blank.html umesto placeholdera iz scaffolda (briše se u F2)

## Blokira me
- ništa / čekam C: serveApp() vraća URL tek posle 40 s
```
