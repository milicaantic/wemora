# Status: osoba D
Faza: F2
Poslednja izmena: 2026-10-30

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

## Gotovo, čeka spajanje (grana `d/architect`)
- D13: domen za arhitektu u `src/analysis/`, izvezen iz `index.ts` za `agents/architect.ts` (D14):
  - `expoRouteFor(webPath, allPaths)` (`expoRoute.ts`): `/recepti/:id` → `/recepti/[id]`, `/docs/*` → `/docs/[...rest]`, `*` → `/` kad je jedina ruta (TodoMVC).
  - `ArchitectOutputSchema` = `PlanSchema` bez `routeMap` (šema za model, bez otvorenog objekta koji Anthropic odbija); `normalizePlan(output, parsed)` (`normalizePlan.ts`) posle modela, pre `validatePlan`: putanje sa `/`, izbacuje fajlove kojih nema, `size` iz fajlova, talasi iz `dependsOn` (ciklus ostavlja `validatePlan`-u), podrazumevani `writes`, `routeMap` za svaku rutu, stabilan redosled. Dva puta zaredom daje isto.
  - `architectBrief(parsed, reports)` i `architectRetryMessage(brief, previous, errors)` (`architectBrief.ts`): poruka zadatka (rute, fajlovi, zajednički fajlovi, svi izveštaji, napomena za rezervne izveštaje) i poruka za novi pokušaj (brief + numerisane greške + prethodni plan), jer svaki pokušaj ide u svež kontekst.
  - 22 testa u `architect-domain.test.ts`.
- D14: agent arhitekta, `createArchitect(id): AgentHandle<ArchitectTask>` u `src/agents/architect.ts`, prompt `src/agents/prompts/architect.md`:
  - `assign({ partIds })`: skupi `board().reports` svih delova, `architectBrief`, pa `runStructured(…, ArchitectOutputSchema)` sa `MODELS.strong`, `maxOutputTokens: 16000`, bez alata, uz `CancelGuard`;
  - izlaz → `normalizePlan` → `validatePlan`; uz greške nov pokušaj u svežem kontekstu sa `architectRetryMessage`, najviše `1 + DEFAULTS.maxPlanRetries` = 3 pokušaja; svaki odbijen pokušaj ide u log `plan.rejected`;
  - uspeh: `board().plan`, `plan.json`, log `plan.accepted`, pa `emit("plan.ready", {})`;
  - neuspeh (3 loša plana, prekid ili greška): log `plan.failed`, `plan.errors.json` (`attempts`, `errors`, `lastPlan`), `board().plan` ostaje `null`, bez događaja (vidi PD2 ispod), proces ne pada;
  - mock ključevi: `taskId` je `"plan"`, a broj pokušaja ide u `TaskMeta.round`, pa skripta za MockRunner ima `architect:plan:1`, `architect:plan:2`… ili samo `architect` za sve pokušaje;
  - 5 testova u `src/agents/architect.test.ts` sa `MockRunner`-om nad Receptima podeljenim na 2 dela: ispravan plan, pa loš plan (bez `/kupovina`) + ispravan, tri loša plana, `normalizePlan` popravlja `size`/`wave`/`writes`, zauzet agent + prekid.

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

## U radu
- ništa

## Sledeće
- PR `d/architect` (D13, D14)
- D15: MockRunner odgovori za TodoMVC i Recepte; pun `migrate:mock` čeka A-ov `cli migrate` (A11) i Conductor (A10)
- izveštaj: zameniti lokalnu šemu linije `run.jsonl` A-ovim `LogEntry` iz `core/log.ts`

## Za A (D12, D14)
- **ID agenta:** Mozaik daje agentu nasumičan UUID (`agent.getId()`), pa je `producerId` u `analysis.done` taj UUID, a `handle.id` je ime koje daje Conductor (npr. `analyzer-1`) i ide u `TaskMeta.agentId` (log, trošak, mock ključevi). Conductor povezuje događaj sa agentom preko `handle.participant.getId()`.
- `board().agents` (`busyWith`) agent ne dira; pretpostavljam da ga vodi Conductor.

## Za B i C
- **B:** ID-jevi obaveza za ručne scenarije Recepata su u `examples/recepti/wemora/README.md` (npr. `recipe-list` / `search-by-name`).
- **C:** `examples/recepti/wemora/plan.manual.json` je fixture za `scaffold()` (G1). `writes` su `src/screens/<id>/` i `src/shared/<id>/`; po C-ovom odgovoru na PD3/PD4 `layout` sme da menja i `src/app/_layout.tsx`, pa `validatePlan` (pravilo 9) i `normalizePlan` treba da dobiju taj izuzetak.

## Odgovor za B
- **Q1 (`apiFixture`):** `runScenarios` pre scenarija zove `POST /__fixture` sa `scenario.apiFixture ?? "default"`, a posle prolaza `POST /__reset`. Podaci su samo za čitanje, pa je izbor fixture-a jedino stanje servera i dva puštanja zaredom vide iste podatke. Adresa mock-api-ja treba B-u kao parametar; to je deo B-ovog Q8 (URL-ovi u `RunConfig`).

## Mockovi koje koristim
- `src/report/load.ts`: lokalna blaga šema za liniju `run.jsonl` (`t`, `agent`, `event`, `costUsd`) dok A ne doda `LogEntry` u `core/log.ts` (A6); tada je menjam uvozom.
- Format `tests/<unitId>.json` je niz `Scenario[]` po B-ovom predlogu Q9.

## Čeka odluku tima
- **TodoMVC i DSL (B, A): nema koraka za taster Enter.** U TodoMVC-u se zadatak dodaje samo tasterom Enter u polju `New Todo Input`; dugme ne postoji. DSL ima `fill`, ali ne i pritisak tastera, pa nijedan test ne može da doda zadatak, a bez zadataka se ne vidi ništa drugo (lista, filteri, brojač). To ugrožava stavku G2 „bar 1 ekran dokazan na TodoMVC-u“. Mogućnosti: (a) nov DSL korak, npr. `{ submit: { label } }` (Enter u polju; na RN `onSubmitEditing`), što je promena ugovora; (b) B-ov kompajler posle svakog `fill` pritisne Enter, što menja značenje `fill` i može da pošalje formu tamo gde ne treba. Predlažem (a). Ostale prepreke iz TodoMVC-a: checkbox zadatka nema ime, „Delete todo“ se vidi samo na hover i nije jedinstveno, izmena je na dvoklik. To arhitekta beleži kao `notPortable`/`hiddenBehind`.
- **`routeMap` od modela (moje, D13/D14).** Arhitekta ne vraća `routeMap`: šema za model je `PlanSchema.omit({ routeMap: true })`, a `routeMap` računa kod (`expoRouteFor`). Tako nema `additionalProperties` koji nije `false`. (Ostale ključeve koje Anthropic ne podržava čisti A-ov `toModelSchema` u `runStructured`: rešeno.)
- **`Unit.id` kao ime foldera.** `UnitSchema` traži samo `min(1)`. `validatePlan` proverava `^[a-z0-9][a-z0-9-]*$`, pa ugovor ne mora da se menja.
- **Neuspeo plan (A, PD2).** Nema događaja za „arhitekta nije uspela posle 3 pokušaja“. D14 zasad: log `plan.failed` + `plan.errors.json`, `board().plan` ostaje `null`, a Conductor to hvata timeout-om. Predlog: događaj `plan.failed {}` u `contracts/events.ts` (promena ugovora, ide kroz A), pa ga arhitekta šalje umesto da Conductor čeka.
- Odgovori na P4 (`splitParts`) i P5 (Conductor čeka sve `analysis.done`) iz `docs/tasks/a.md`: slažem se sa predlozima.

## Blokira me
- ništa
