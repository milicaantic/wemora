# Status: osoba D
Faza: F3
Poslednja izmena: 2026-10-31

## Gotovo (spojeno u main)
- D0: review ugovora za moj deo. Tipovi odgovaraju planu, promena ugovora ne treba; nalazi su ispod (PR #4).
- D1: `examples/todomvc`, React primer iz `tastejs/todomvc` (commit `ff43b02`, MIT), bez izmena koda; `npm ci && npm run build && npm run serve` na portu 7002. Detalji u `examples/todomvc/SOURCE.md` (PR #4).
- D2: ovaj fajl (PR #4)
- D3: `examples/mock-api`, HTTP server bez zavisnosti (`node:http`), port 3000 (isti kao `EXPO_PUBLIC_API_URL` u C-ovom šablonu). Rute `GET /api/categories`, `/api/recipes`, `/api/recipes/:id`, kontrolne `GET /__health`, `POST /__fixture { name }`, `POST /__reset`. Fixture `default` (4 kategorije, 12 recepata) i `empty`. Pri pokretanju i sa `npm run check` proverava podatke, uključujući to da nijedno ime ne sadrži drugo. Sve rute ručno proverene curl-om. Uputstvo u `examples/mock-api/README.md`.
- D4: `examples/recepti`, React 18 + React Router 6 (ugnežđene rute) + Vite + TypeScript, 5 ekrana namerno samo za desktop: `/` (tabela sa 8 kolona, hover), `/recepti/:id` (dve kolone, porcije), `/kategorije` (lista i detalj jedan pored drugog), `/omiljeni`, `/kupovina` (`localStorage`). `npm run build` prolazi. Playwright provera nad build-om (28 slučajeva, svih 5 ekrana, prazni podaci, pad API-ja, osvežavanje) prolazi; svaki interaktivni element ima jedinstveno pristupačno ime. Ekrani i tačna imena su u `examples/recepti/README.md`.
  - Odstupanje od plana: filter kategorija je grupa dugmadi, ne `<select>`, jer DSL nema korak za izbor iz liste.
  - `npm audit`: 2 umerene ranjivosti u React Router 6 (open redirect preko `\` u linku, SSR hidratacija). Ne odnose se na lokalni primer bez SSR-a i bez korisničkih linkova; ostajem na v6 da parser ima i v6 (Recepti) i v7 (TodoMVC).
- D5: `examples/recepti/wemora/plan.manual.json`, ručni plan za Recepte: 2 zajedničke jedinice (`data`, `layout`) u talasu 0, 5 ekrana u talasu 1, 20 obaveza, 2 toka, `routeMap` za svih 5 ruta. Svaki od 23 fajla iz `src/` je u tačno jednoj jedinici; `size` je izračunat pravilom parsera. Prolazi `PlanSchema` i pravila za plan (provereno skriptom; pravi test dolazi sa `validatePlan` u D8). Tabela jedinica i ID-jevi obaveza su u `examples/recepti/wemora/README.md`. (D3–D5: PR #8)
- D6: `parseApp(webDir)` u `src/analysis/` (`parse.ts`, `source.ts`, `imports.ts`, `routes.ts`, `webApis.ts`, `errors.ts`). Proverava `package.json` (Next.js, bez Reacta, bez rutera, React Router 5 → `UnsupportedInputError` sa kodom), parsira sve `.js/.jsx/.ts/.tsx` iz `src/`, pravi graf uvoza (i CSS), nalazi rute iz JSX `<Route>` i iz `createBrowserRouter`/`useRoutes` (ugnežđivanje, `index`, layout rute, `Navigate`, `Suspense`, `lazy`), deli fajlove na ekrane i zajedničke, beleži web API-je po ekranu i broji tokene (`ceil(znakovi/4)`, LF). Bez nove zavisnosti: koristi `typescript` (predlog odluke D-007).
  - Recepti: 5 ruta, isti fajlovi i iste veličine kao `plan.manual.json` (test to proverava). TodoMVC: jedna ruta `*`, 9 fajlova, `src/index.js` zajednički.
  - 27 testova u `src/analysis/parse.test.ts` nad oba primera i 9 malih fixture aplikacija u `src/analysis/mocks/` (`.jsx`, pa ih root `tsc` i provera slojeva ne čitaju).
  - `parts` je `splitParts(parsed, 1)`; Conductor ponovo deli sa svojim N.
  - Ograničenja: ugnežđeni `<Routes>` unutar komponenti ekrana se ne prate; web API-ji iz zajedničkih fajlova nisu ni na jednoj ruti (ugovor nema polje za njih; analizator ih vidi čitanjem fajlova).
- D7: `splitParts(parsed, n)` u `src/analysis/split.ts`: deli rute na delove slične veličine u tokenima (najveća ruta prva, uvek u najlakši deo, izjednačenja po manjem indeksu i po putanji). `n` se svodi na ceo broj u [1, broj ruta], pa nema praznih delova; zajednički fajlovi nisu ni u jednom delu (svaki analizator ih čita iz `sharedFiles`). 11 testova u `split.test.ts`, nad Receptima i nad ručnim primerima. (D6–D7: PR #10)
- D8: `validatePlan(plan, parsed)` u `src/analysis/validatePlan.ts`. Vraća listu grešaka na engleskom (prazna = ok), poređanu po pravilima, uvek istim redom. Svaka poruka imenuje jedinicu, fajl ili rutu i kaže šta da se promeni, jer je čita model arhitekta. Pravila: šema (`PlanSchema`), ID-jevi jedinica (jedinstveni, kebab-case), `kind` ↔ `route`, svaka ruta iz parsera u tačno jednom ekranu, izvorni fajlovi postoje i pripadaju najviše jednoj jedinici, fajl komponente ide uz svoj ekran, `dependsOn` (postoji, bez sebe, bez ciklusa, sa putanjom ciklusa u poruci), talasi (zajedničke u talasu 0 i zavise samo od zajedničkih; ekran posle svojih zavisnosti), `writes` (samo `src/screens/<id>/` ili `src/shared/<id>/`, bez preklapanja), obaveze (ekran ih ima, zajednička nema, kebab-case, bez duplikata), namerne razlike (samo na ekranima, `movedTo` na postojeći ekran), `routeMap` (svaka ruta, `[param]` umesto `:param`, bez duplikata i viška), tokovi (postojeći ekrani, bez duplikata). (PR #12)
  - 23 testa u `validatePlan.test.ts`: ručni plan za Recepte prolazi, a svaka vrsta greške se hvata nad njegovom pokvarenom kopijom; plan za TodoMVC (ruta `*`) prolazi.
  - Pravilo za `writes` prati C-ov šablon. Ako C dozvoli `layout` jedinici da menja `src/app/_layout.tsx` (PD3), pravilo 9 dobija taj izuzetak.
- D9: `buildReport(runDir)` u `src/report/` (`load.ts` čita i proverava zod-om, `model.ts` računa, `render.ts` pravi HTML, `html.ts` escape, `styles.ts`). Pravi jedan samostalan `report.html` (bez skripti i spoljnih fajlova, svetla i tamna tema, radi i na telefonu): sažetak u 4 boje statusa (+ „nema rezultata“), po ekranu pokrivenost („6/6 obaveze, 5/5 elemenata“), razlog za svaki status osim „dokazan“, namerne razlike kao rečenice i tabela scenarija (✓/✗/— sa korakom i greškom), zatim zajedničke jedinice i upozorenja. Fajl koji fali ili ne prolazi šemu postaje upozorenje, a ne greška. Isti prolaz uvek daje isti HTML; vreme dolazi iz `run.jsonl`, ne sa sata. Sav tekst ide kroz escape.
  - 18 testova u `src/report/report.test.ts` nad lažnim prolazom `src/report/mocks/run/` (plan Recepata, sva 4 statusa, ekran bez rezultata, pokvaren JSON, loša linija u logu, `<script>` u poruci) i nad praznim folderom. Izgled proveren snimcima ekrana u Chromium-u (desktop, telefon, tamna tema).
  - Vremenska osa, trošak po agentu i mera ubrzanja dolaze u v2 (D17).
- D10: kostur `README.md` (engleski, uz rezime na srpskom: predlog PD7). Sve komande koje navodi rade danas (`npm ci`, `build`, `test`, Playwright, mock-api, Recepti, TodoMVC); `migrate`, `verify` i `sabotage` su označeni kao „in progress“. (D9–D10: PR #14)

## Gotovo, spojeno u main (PR #29, grana `d/analyzer`)
- D11: domen za analizatora u `src/analysis/`, izvezen iz `index.ts` za `agents/analyzer.ts` (D12):
  - `createFileAccess(parsed, partId)` (`fileAccess.ts`): `list()` i `read(path)` samo za fajlove dela i zajedničke fajlove. Prihvata `./x` i `\`; odbija apsolutne putanje, izlaz iz projekta i tuđe fajlove porukom za model; fajl duži od 40 000 znakova seče uz napomenu.
  - `analyzerBrief(parsed, partId)` (`analyzerBrief.ts`): poruka zadatka sa rutama dela, njihovim fajlovima, web API-jima i zajedničkim fajlovima; bez sadržaja fajlova.
  - `analyzerOutputSchema(parsed, partId)` (`reports.ts`): šema za `runStructured` (`{ reports: [...] }`, bez `partId`) plus pravilo „tačno jedan izveštaj po ruti dela“, pa se pogrešne rute vraćaju modelu kao greška šeme. `z.toJSONSchema` i dalje radi.
  - `finalizeReports(raw, parsed, partId)`: proverava izlaz i dopunjuje ga onim što parser sigurno zna (`partId`, fajlovi i web API-ji rute), izbacuje fajlove van dela, sortira; greška je poruka za model.
  - `fallbackReports(parsed, partId, why)`: izveštaji samo iz parsera kad model ne uspe, sa ekranom po imenu fajla i problemima za telefon izvedenim iz web API-ja; prolaz se nastavlja.
  - 21 test u `analyzer-domain.test.ts` nad Receptima podeljenim na 2 dela.
- D12: agent analizator, `createAnalyzer(id): AgentHandle<AnalyzeTask>` u `src/agents/analyzer.ts`, prompt `src/agents/prompts/analyzer.md`:
  - alati `list_files` i `read_file` (`defineTool`) samo pozivaju `FileAccess` tekućeg zadatka; odbijena putanja ide modelu kao `Error calling tool: …` i petlja se nastavlja;
  - `assign({ partId })`: `runStructured` sa `analyzerOutputSchema`, `MODELS.default`, `maxOutputTokens: 8000`, `CancelGuard`; rezultat ide kroz `finalizeReports`;
  - kad model ni posle 3 pokušaja ne da ispravan izlaz ili je zadatak prekinut (`cancel`): `fallbackReports` i log `analysis.fallback`; kad nema `board().parsed` ili deo ne postoji: log `analysis.failed` i prazna lista. `analysis.done` se šalje u svakom slučaju, pa prolaz ne visi;
  - upiše `board().reports[partId]` i `analysis/<partId>.json` (niz `AnalyzerReport[]`), oslobodi se, pa `emit("analysis.done", { partId })`; drugi `assign` dok radi se ignoriše (log `task.ignored`);
  - 7 testova u `src/agents/analyzer.test.ts` sa `MockRunner`-om nad TodoMVC-om (sve 4 stavke iz `docs/tasks/d.md` + zauzet agent, prekid, nepoznat deo).

## Gotovo, spojeno u main (PR #36, grana `d/architect`)
- D13: domen za arhitektu u `src/analysis/`, izvezen iz `index.ts` za `agents/architect.ts` (D14):
  - `expoRouteFor(webPath, allPaths)` (`expoRoute.ts`): `/recepti/:id` → `/recepti/[id]`, `/docs/*` → `/docs/[...rest]`, `*` → `/` kad je jedina ruta (TodoMVC).
  - `ArchitectOutputSchema` = `PlanSchema` bez `routeMap` (šema za model, bez otvorenog objekta koji Anthropic odbija); `normalizePlan(output, parsed)` (`normalizePlan.ts`) posle modela, pre `validatePlan`: putanje sa `/`, izbacuje fajlove kojih nema, `size` iz fajlova, talasi iz `dependsOn` (ciklus ostavlja `validatePlan`-u), podrazumevani `writes`, `routeMap` za svaku rutu, stabilan redosled. Dva puta zaredom daje isto.
  - `architectBrief(parsed, reports)` i `architectRetryMessage(brief, previous, errors)` (`architectBrief.ts`): poruka zadatka (rute, fajlovi, zajednički fajlovi, svi izveštaji, napomena za rezervne izveštaje) i poruka za novi pokušaj (brief + numerisane greške + prethodni plan), jer svaki pokušaj ide u svež kontekst.
  - 22 testa u `architect-domain.test.ts`.
- D14: agent arhitekta, `createArchitect(id): AgentHandle<ArchitectTask>` u `src/agents/architect.ts`, prompt `src/agents/prompts/architect.md`:
  - `assign({ partIds })`: skupi `board().reports` svih delova, `architectBrief`, pa `runStructured(…, ArchitectOutputSchema)` sa `MODELS.strong`, `maxOutputTokens: 16000`, bez alata, uz `CancelGuard`;
  - izlaz → `normalizePlan` → `validatePlan`; uz greške nov pokušaj u svežem kontekstu sa `architectRetryMessage`, najviše `1 + DEFAULTS.maxPlanRetries` = 3 pokušaja; svaki odbijen pokušaj ide u log `plan.rejected`;
  - uspeh: `board().plan`, `plan.json`, log `plan.accepted`, pa `emit("plan.ready", {})`;
  - neuspeh (3 loša plana, prekid ili greška): log `plan.gave_up` sa greškama, `plan.errors.json` (`attempts`, `errors`, `lastPlan`), `board().plan` ostaje `null`, pa `emit("plan.failed", {})` (D-012); Conductor završava prolaz, proces ne pada;
  - mock ključevi: `taskId` je `"plan"`, a broj pokušaja ide u `TaskMeta.round`, pa skripta za MockRunner ima `architect:plan:1`, `architect:plan:2`… ili samo `architect` za sve pokušaje;
  - 5 testova u `src/agents/architect.test.ts` sa `MockRunner`-om nad Receptima podeljenim na 2 dela: ispravan plan, pa loš plan (bez `/kupovina`) + ispravan, tri loša plana (`plan.failed` tačno jednom), `normalizePlan` popravlja `size`/`wave`/`writes`, zauzet agent + prekid.
  - Provereno sa A-ovim pravim Conductor-om (A10) nad TodoMVC-om, uz pravi parser, analizator i arhitektu i A-ove lažne buildere, testere i Gatekeeper: ispravan plan → `plan.ready` → obe jedinice `promoted`, ishod `finished`; loš plan → `plan.failed` → ishod `plan.failed`, prolaz se odmah završava.
  - A je uključio arhitektu u `src/orchestration/agents.ts` (D-014).

## Gotovo, spojeno u main (PR #38, grana `d/mock-replies`)
- D15: MockRunner odgovori za moje agente po D-013:
  - `src/agents/mocks/todomvc/analyzer.json` (`analyzer:part-1`: `list_files`, 4× `read_file`, izveštaj za rutu `*`) i `architect.json` (`architect`: plan sa `app-entry` + `todo-list`, 5 obaveza, `notPortable` za „Delete todo“ i izmenu na dvoklik);
  - `src/agents/mocks/recepti/analyzer.json` (`list_files`, 6× `read_file`, 5 izveštaja) i `architect.json` (`plan.manual.json` bez `routeMap`, sa `size: 0` i praznim `writes`, kao što bi model vratio);
  - ključ `analyzer:part-1` važi za jednog analizatora (F2, `FIXED_TEAM`); sa više delova (F3) analizator bez ključa ide na rezervni izveštaj, a ključ `architect` važi za svaki pokušaj;
  - 7 testova u `src/agents/mocks/d.mocks.test.ts`: fajlovi prolaze `MockFixtureSchema` i `loadMockFixtureDir`, svaki `read_file` je dozvoljen, izveštaji prolaze `finalizeReports` za sve rute, plan posle `normalizePlan` prolazi `validatePlan`, a plan za Recepte je posle normalizacije isti kao `plan.manual.json`.
  - `npm run migrate:mock -- examples/todomvc`: analizator radi iz mock-a (bez rezervnog izveštaja), prolaz staje kod arhitekte jer je u `agents.ts` još zamena. Sa A-ovim Conductor-om i mojim agentima (privremena skripta, ostali agenti lažni) obe aplikacije stižu do `plan.ready` iz prvog pokušaja i do `finished`.
  - C je premestio builderov mock u `src/agents/mocks/todomvc/builder.json` (PR #39).

## D16 (PR #43, grana `d/fix`): integracija urađena, pravi prolazi čekaju API ključ
- **`migrate:mock` sa svim pravim agentima** (čist klon `main`-a `27f45ee`, instaliran `templates/expo`, original pokrenut, `--original-url`):
  - TodoMVC: analizator iz mock-a → `analysis.done` → arhitekta `plan.accepted` iz 1. pokušaja → `plan.ready`; `plan.json` (2 jedinice, `routeMap` `{"*":"/"}`), `analysis/`, `report.html` postoje. Prolaz zatim staje: `the gatekeeper agent is not available yet (C, C2.4)`.
  - Recepti: isto; plan ima istih 7 jedinica i iste `size` kao `plan.manual.json`; staje na istom mestu (Gatekeeper, C2.4).
  - Moje G2 stavke za mock: `plan.json` i `analysis/` ✅, `report.html` ✅. Pravi prolaz nad TodoMVC-om: čeka API ključ.
- **Popravke u mojim folderima:**
  - izveštaj prikazuje kako se prolaz završio (poslednja linija `run.finished` od Conductor-a): „Prolaz je stao zbog greške: …“, „…arhitekta nije napravio plan…“ uz greške iz `plan.errors.json`, ili „…potrošen je budžet…“; kad je prolaz `finished`, nema trake. Ranije je izveštaj prolaza koji je stao pokazivao samo „nema rezultata“ bez razloga. 3 nova testa.
  - `validatePlan` pravilo 9: zajednička jedinica `layout` sme da ima i `src/app/_layout.tsx` u `writes` (C, PD3/PD4); ostale jedinice ne. Prompt arhitekte to kaže modelu. Ranije bi takav plan bio odbijen i potrošio pokušaj. `normalizePlan` ne dodaje taj fajl sam; po D-015 `OwnershipGuard` prima listu putanja, pa builder može da ga upiše kad je u `writes`.
- Posle ovoga su A i C povezali Gatekeeper-učesnika (C2.4, PR #47 i #49), pa prolaz više ne staje posle plana. Ceo `migrate:mock` kroz Gatekeeper još nisam ponovio.
- **Čeka:** `ANTHROPIC_API_KEY` u `.env` (nema ga ni u `.env` ni u okruženju). Tada: dva prava prolaza do plana nad Receptima (`npm run migrate -- examples/recepti --budget 1 --original-url …`), poređenje plana sa `plan.manual.json` (jedinice, zajedničke `data`/`layout`, zavisnosti, obaveze sa tekstom iz originala, `hiddenBehind`/`notPortable`) i popravka prompta; pa pravi prolaz `--budget 1` nad TodoMVC-om.

## Kapija G1: prošla 2026-10-30 (proverio D)
Na čistom klonu `main`-a `6289b3c` (posle toga su u `main` stigle samo izmene dokumentacije, do `ea67e09`):
- [x] `npm run build` zeleno, `npm test` 280/280 (23 fajla, sa C-ovim `g1.test.ts` i kapijama 3–4 nad instaliranim `templates/expo`)
- [x] Spike A u `docs/decisions.md` (D-005, D-006; D-005 prihvaćen)
- [x] `parseApp(examples/recepti)` daje 5 ekrana, `validatePlan(plan.manual.json)` je prazan
- [x] B: 3 ručna scenarija prolaze nad pokrenutim Receptima (mock-api + build, 1280×800); `validateScenario` prihvata sva 3 i odbija scenario koji prolazi i na praznom ekranu
- [x] C: `scaffold(plan.manual.json)` pravi aplikaciju, `serveApp()` otvara svih 5 ruta bez greške (posle D-009); dobar ekran prolazi kapije 1–4, loš pada na tačnoj (`gates.test.ts`, `g1.test.ts`)
- [x] prvi zajednički test: B-ov scenario pada nad praznim ekranom, a prolazi nad ručno napisanim RN ekranom preko C-ovog `serveApp()` (390×844)
- [x] A: `src/core`, `src/agents/_shared`, `src/orchestration` zeleno (deo `npm test`)
- [x] statusi A, B, C i D ažurirani

Prvi put (na `8fae0cf`) je pala stavka C: aplikacija iz `scaffold()` je davala „No routes found“ zbog zajedničkog Metro keša. C je popravio (D-009, PR #22).

## Posle F2 (spojeno u main)
- PR #55 (`d/todomvc-coverage`): link „TodoMVC“ je `notPortable`, obaveze preko „❯ Toggle All Input“, prompt-ovi traže da svaki imenovani element bude u obavezi ili u razlikama.
- `d/g2-wording`: izveštaj piše „obaveze bez testa“; filteri u adresi (`#/active`) su na telefonu stanje ekrana (opis obaveze i prompt-ovi).
- PR #63 (`d/web-obligations`, inbox poruka A → D): obaveze moraju da se izvedu na originalnom webu DSL koracima; `validatePlan` odbija long-press, hover, dupli klik, prevlačenje, desni klik, prečice i obaveze o `notPortable` elementima.

## Gotovo, spojeno u main (PR #69, grana `d/report-v2`)
- D17: izveštaj v2, sve izračunato iz `run.jsonl`, bez modela:
  - `src/report/timeline.ts`: jedan red po agentu; traka je petlja od `message_received.started` do `model.answer` istog agenta sa istim `data.loopId` (Mozaik događaji kroz A-ov `eventLogger`); oznaka trake je zadatak iz poslednjeg `task.assigned` za tog agenta (`part-1`, `plan`, `todo-list · runda 2`); vrsta agenta iz `agent.started`; petlja bez `model.answer` je „otvorena“ traka do kraja loga. `participant.joined`/`left` (samo `role: agent`) su tačke ispod trake.
  - **Ubrzanje** = zbir trajanja svih traka ÷ (poslednji − prvi zapis), jedna decimala: „1,5×“.
  - **Agenti** (A14, D-021, inbox poruka A → D): najveći broj agenata svake vrste koji su radili istovremeno (iz `agent.started`/`agent.stopped`) i tabela svih `agents.rescaled` promena: vreme od početka prolaza, analizatori, builderi i testeri kao „pre → posle“ (`from`), razlog. Provereno i nad pravim `migrate:mock` prolazom posle A14.
  - **Runde i modeli:** po jedinici, svaka builderova runda (`task.assigned` sa `round` i `model`) i da li je odbijena (`gate.failed`).
  - `src/report/costs.ts`: trošak po agentu (zbir `costUsd`, broj poziva, ulazni/keširani/izlazni tokeni i modeli iz `model.usage`, D-020), sortirano po trošku, plus ukupno.
  - `render.ts`: sekcije „Tok prolaza“ (inline SVG bez biblioteka, boja po vrsti agenta, legenda, `<title>` na traci), „Trošak“, „Runde i modeli“; v1 sekcije ostaju. Na telefonu se osa i tabele skroluju u svom okviru.
  - `load.ts`: linija bez `t` ili koja nije JSON se preskače uz upozorenje (sa pravilnom množinom: „2 neispravne linije su preskočene“).
  - Fixture `src/report/mocks/run/run.jsonl`: 6 traka koje se preklapaju, trošak, odbijena runda, `agents.rescaled`, loše linije. 11 novih testova (29 ukupno), među njima 2 trake po 60 s u 80 s → 1,5×.
  - Ručno: snimci u Chromium-u (desktop, tamna tema, telefon) nad fixture-om i nad pravim mock prolazom TodoMVC-a.

## Gotovo, spojeno u main (PR #71, grana `d/runs`)
- D18: `archiveRun(runDir, runsDir, name)` u `src/report/archive.ts` (izvoz iz `report/index.ts`; `buildReport` je premešten u `build.ts` da nema kružnog uvoza):
  - kopira `output/<run-id>/` u `runs/<name>/` bez `node_modules`, `.expo`, `dist`, `web-build` (na bilo kojoj dubini), `staging/`, linkova (ne prati ih; `app/node_modules` je link na šablon) i fajlova većih od 5 MB; spisak izostavljenog je u `<name>/archive.json`; `report.html` se pravi ponovo iz kopije; nikad ne prepisuje postojeći folder i odbija ime sa putanjom;
  - 3 testa u `src/report/archive.test.ts` nad lažnim prolazom (`node_modules`, `.expo`, `dist`, `web-build`, `staging/`, junction link, fajl od 5 MB + 1 B).
  - `runs/todomvc-mock-20261031-1454/`: arhiva `migrate:mock` prolaza nad TodoMVC-om (`todo-list` proven, 5/5), 1,4 MB. B-ov `verifyDetailed` nad njom: 5/5 `pass`, `OK`, exit 0, bez API ključa. Jasno označen kao mock (odgovori modela su skripta); arhiva pravog prolaza ide kad A pusti `npm run migrate` sa ključem.
  - `runs/README.md`: tabela prolaza, šta je u folderu, kako se proverava (`npm ci` u `templates/expo`, mock-api za Recepte, značenje izlaza) i kako se dodaje prolaz.
- Inbox B → D (README pre `verify`): urađeno u `README.md` i `runs/README.md`, poruka u `docs/inbox/done/`.
- Inbox D → A (nova): skripta `npm run archive` / `wemora archive` (A-ov `package.json` i `cli.ts`).

## Delimično gotovo, čeka spajanje (grana `d/readme`)
- D19, sve što može danas (README ceo na engleskom, bez srpskog rezimea, po želji tima; izveštaj ostaje na srpskom):
  1. jedna rečenica + snimak izveštaja (`docs/img/report-summary.png`, iz `runs/todomvc-mock-…`); u „How it works“ i snimak vremenske ose (`docs/img/report-timeline.png`);
  2. problem i rešenje (wrapper vs. AI generator; „proizvod je dokaz, ne kod“);
  3. mermaid dijagram toka + tabela statusa;
  4. Mozaik: paralelni agenti, `join`/`leave` po formulama (A14), tabla `MigrationState`, događaji sa ID-jevima, `OwnershipGuard`/`CancelGuard`, structured output, `BudgetedRunner`/`MockRunner`, `eventLogger`; svaka tvrdnja sa linkom na fajl; tabela agenata, modela i alata;
  5. brzi start bez ključa: `npm ci`, Playwright, `npm ci` u `templates/expo`, build, test, `verify` nad `runs/todomvc-mock-…`, pa `sabotage` nad kopijom u `output/` i `verify` koji pada (1/5, exit 1); dok A18 ne stigne, preko `npx tsx -e`; izlaz obe komande je prekopiran iz terminala (čist klon);
  6. pun prolaz: `--mock` nad TodoMVC-om sa `--original-url` (pušteno, ~3 min, `finished`) i pravi prolaz nad Receptima (`.env`, gateway, mock-api, original, podrazumevani budžet $5);
  7. stablo `output/<run-id>/`; 8. ograničenja i van obima (arch §15, ulazni profil, testovi na Expo webu, Android još nije kapija); 9. tim: tabela ko je vlasnik čega (JavorFaks = A, Vujic04 = B, Milica Antić = C, Kuzma04 = D, po autorima commit-a u tim folderima) i linkovi na `docs/`.
  - Svaka tvrdnja proverena u kodu (modeli po D-023, runde 3–4 na jačem modelu po A15, Android kapija ne postoji, budžet gasi jedinice koje čekaju); svi linkovi vode na postojeće fajlove.
- Usput: izveštaj je prikazivao „— nije pušten“ za sve testove dokazanog ekrana, jer Gatekeeper upisuje `results/<unit>.json` sa praznim `scenarios`. Izveštaj sada, kad nema pojedinačnih rezultata, a kapija `scenarios` poslednje runde je prošla, prikazuje testove kao prolazne (2 testa). Inbox D → C: da Gatekeeper popunjava `scenarios`.
- **Šta fali u README-u** (isto je u HTML komentarima `TODO(D19)` u samom README-u, nevidljivo na GitHub-u):
  1. prolaz za Recepte u `runs/recepti-<vreme>`: treba pravi prolaz (A, ključ) ili mock odgovori testera i buildera za Recepte (B, C); onda snimak njegovog izveštaja i primer u brzom startu;
  2. `npm run verify` i `npm run sabotage` u CLI-ju (A18): zameniti `npx tsx -e …` komande u brzom startu tim komandama i prekopirati izlaz;
  3. pravi prolaz (ne `--mock`) arhiviran u `runs/`, sa troškom i ubrzanjem iz izveštaja;
  4. licenca (nema `LICENSE`, `package.json` kaže ISC, što je npm podrazumevano), i puna imena tima ako ih tim želi umesto GitHub imena;
  5. završni prolaz: neko ko nije pisao README ga prati na čistom klonu; komande i izlaz prekopirati iz terminala.

## U radu
- ništa

## Sledeće
- PR `d/readme` (D19, delimično)
- D19 do kraja kad stignu stavke iz liste „Šta fali u README-u“
- kad A pusti pravi prolaz: arhivirati ga u `runs/` i pogledati izveštaj v2 nad pravim podacima (trošak, ubrzanje)

## Odgovori D (2026-10-31)
- **C: ID ekrana za TodoMVC je `todo-list`** (zajednička jedinica je `app-entry`). To vraća moj `src/agents/mocks/todomvc/architect.json` (PR #38). Tvoj `builder.json` (`builder:todo-list:1`, `builder:todo-list:2`, `screens/todo-list/index.tsx`) i B-ov `tester.json` (`tester:todo-list`, obaveza `empty-state`) već odgovaraju, pa ne treba ništa menjati.
- **A: review ugovora za D** (`ParsedApp`, `AnalyzerReport`, `Plan`, `SplitParts`): ok, bez izmena. Urađeno u D0 (PR #4) i potvrđeno kroz D6–D16: parser, `splitParts`, `validatePlan`, analizator, arhitekta i mock prolaz rade sa ugovorom kakav jeste.

## Za A (D12, D14)
- **ID agenta:** Mozaik daje agentu nasumičan UUID (`agent.getId()`), pa je `producerId` u `analysis.done` taj UUID, a `handle.id` je ime koje daje Conductor (npr. `analyzer-1`) i ide u `TaskMeta.agentId` (log, trošak, mock ključevi). Conductor povezuje događaj sa agentom preko `handle.participant.getId()`.
- `board().agents` (`busyWith`) agent ne dira; pretpostavljam da ga vodi Conductor.
- **Izveštaj v2 (D17, PD6):** čita `message_received.started`/`model.answer` (`data.loopId`), `agent.started` (`data.kind`), `task.assigned` (`data.to`, `data.task`), `gate.failed`, `participant.joined`/`left` (`data.name`, `data.role`) i `model.usage`/`costUsd`, sve kako ih danas piše `eventLogger` i Conductor, plus A14 `agents.rescaled { analyzers, builders, testers, from?, reason }` i `agent.stopped { id, kind }` (D-021); format je dobar, ništa ne treba menjati.

## Za B i C
- **B:** ID-jevi obaveza za ručne scenarije Recepata su u `examples/recepti/wemora/README.md` (npr. `recipe-list` / `search-by-name`).
- **C:** `examples/recepti/wemora/plan.manual.json` je fixture za `scaffold()` (G1). `writes` su `src/screens/<id>/` i `src/shared/<id>/`; po C-ovom odgovoru na PD3/PD4 `layout` sme da menja i `src/app/_layout.tsx`, i `validatePlan` (pravilo 9) to sada prihvata (D16).

## Odgovor za B
- **Q1 (`apiFixture`):** `runScenarios` pre scenarija zove `POST /__fixture` sa `scenario.apiFixture ?? "default"`, a posle prolaza `POST /__reset`. Podaci su samo za čitanje, pa je izbor fixture-a jedino stanje servera i dva puštanja zaredom vide iste podatke. Adresa mock-api-ja treba B-u kao parametar; to je deo B-ovog Q8 (URL-ovi u `RunConfig`).

## Mockovi koje koristim
- `src/report/load.ts`: lokalna blaga zod šema za liniju `run.jsonl` (`t`, `agent`, `event`, `costUsd`). `core/log.ts` ima samo TypeScript tip `LogEntry`, a podatke sa diska proveravam zod-om; kad A doda `LogEntrySchema` u `src/contracts/`, menjam je uvozom.
- Format `tests/<unitId>.json` je niz `Scenario[]` po B-ovom predlogu Q9.

## Čeka odluku tima
- **TodoMVC i DSL (B, A): nema koraka za taster Enter.** U TodoMVC-u se zadatak dodaje samo tasterom Enter u polju `New Todo Input`; dugme ne postoji. DSL ima `fill`, ali ne i pritisak tastera, pa nijedan test ne može da doda zadatak, a bez zadataka se ne vidi ništa drugo (lista, filteri, brojač). To ugrožava stavku G2 „bar 1 ekran dokazan na TodoMVC-u“. Mogućnosti: (a) nov DSL korak, npr. `{ submit: { label } }` (Enter u polju; na RN `onSubmitEditing`), što je promena ugovora; (b) B-ov kompajler posle svakog `fill` pritisne Enter, što menja značenje `fill` i može da pošalje formu tamo gde ne treba. Predlažem (a). Ostale prepreke iz TodoMVC-a: checkbox zadatka nema ime, „Delete todo“ se vidi samo na hover i nije jedinstveno, izmena je na dvoklik. To arhitekta beleži kao `notPortable`/`hiddenBehind`.
- **`routeMap` od modela (moje, D13/D14).** Arhitekta ne vraća `routeMap`: šema za model je `PlanSchema.omit({ routeMap: true })`, a `routeMap` računa kod (`expoRouteFor`). Tako nema `additionalProperties` koji nije `false`. (Ostale ključeve koje Anthropic ne podržava čisti A-ov `toModelSchema` u `runStructured`: rešeno.)
- **`Unit.id` kao ime foldera.** `UnitSchema` traži samo `min(1)`. `validatePlan` proverava `^[a-z0-9][a-z0-9-]*$`, pa ugovor ne mora da se menja.
- ~~**Neuspeo plan (A, PD2).**~~ Rešeno: događaj `plan.failed {}` (D-012); D14 ga šalje.
- Odgovori na P4 (`splitParts`) i P5 (Conductor čeka sve `analysis.done`) iz `docs/tasks/a.md`: slažem se sa predlozima.

## Blokira me
- ništa
