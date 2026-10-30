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

## Gotovo, čeka spajanje (grana `d/analyzer`)
- D11: domen za analizatora u `src/analysis/`, izvezen iz `index.ts` za `agents/analyzer.ts` (D12):
  - `createFileAccess(parsed, partId)` (`fileAccess.ts`): `list()` i `read(path)` samo za fajlove dela i zajedničke fajlove. Prihvata `./x` i `\`; odbija apsolutne putanje, izlaz iz projekta i tuđe fajlove porukom za model; fajl duži od 40 000 znakova seče uz napomenu.
  - `analyzerBrief(parsed, partId)` (`analyzerBrief.ts`): poruka zadatka sa rutama dela, njihovim fajlovima, web API-jima i zajedničkim fajlovima; bez sadržaja fajlova.
  - `analyzerOutputSchema(parsed, partId)` (`reports.ts`): šema za `runStructured` (`{ reports: [...] }`, bez `partId`) plus pravilo „tačno jedan izveštaj po ruti dela“, pa se pogrešne rute vraćaju modelu kao greška šeme. `z.toJSONSchema` i dalje radi.
  - `finalizeReports(raw, parsed, partId)`: proverava izlaz i dopunjuje ga onim što parser sigurno zna (`partId`, fajlovi i web API-ji rute), izbacuje fajlove van dela, sortira; greška je poruka za model.
  - `fallbackReports(parsed, partId, why)`: izveštaji samo iz parsera kad model ne uspe, sa ekranom po imenu fajla i problemima za telefon izvedenim iz web API-ja; prolaz se nastavlja.
  - 21 test u `analyzer-domain.test.ts` nad Receptima podeljenim na 2 dela.

## U radu
- ništa

## Sledeće
- kapija G1 (proveravam ja): lista u `docs/tim-plan.md` §5, kad A, B i C spoje F1
- D13: domen za arhitektu (`normalizePlan`, `expoRouteFor`, brief)
- D12/D14: agenti analizator i arhitekta, kad stignu A-ovi `core/` i `agents/_shared/` (A5, A7, A8)

## Za B i C
- **B:** ID-jevi obaveza za ručne scenarije Recepata su u `examples/recepti/wemora/README.md` (npr. `recipe-list` / `search-by-name`).
- **C:** `examples/recepti/wemora/plan.manual.json` je fixture za `scaffold()` (G1). `writes` su `src/screens/<id>/` i `src/shared/<id>/`. Otvoreno: ko menja `src/app/_layout.tsx` za navigaciju (PD3).

## Odgovor za B
- **Q1 (`apiFixture`):** `runScenarios` pre scenarija zove `POST /__fixture` sa `scenario.apiFixture ?? "default"`, a posle prolaza `POST /__reset`. Podaci su samo za čitanje, pa je izbor fixture-a jedino stanje servera i dva puštanja zaredom vide iste podatke. Adresa mock-api-ja treba B-u kao parametar; to je deo B-ovog Q8 (URL-ovi u `RunConfig`).

## Mockovi koje koristim
- `src/report/load.ts`: lokalna blaga šema za liniju `run.jsonl` (`t`, `agent`, `event`, `costUsd`) dok A ne doda `LogEntry` u `core/log.ts` (A6); tada je menjam uvozom.
- Format `tests/<unitId>.json` je niz `Scenario[]` po B-ovom predlogu Q9.

## Čeka odluku tima
- **TodoMVC i DSL (B, A): nema koraka za taster Enter.** U TodoMVC-u se zadatak dodaje samo tasterom Enter u polju `New Todo Input`; dugme ne postoji. DSL ima `fill`, ali ne i pritisak tastera, pa nijedan test ne može da doda zadatak, a bez zadataka se ne vidi ništa drugo (lista, filteri, brojač). To ugrožava stavku G2 „bar 1 ekran dokazan na TodoMVC-u“. Mogućnosti: (a) nov DSL korak, npr. `{ submit: { label } }` (Enter u polju; na RN `onSubmitEditing`), što je promena ugovora; (b) B-ov kompajler posle svakog `fill` pritisne Enter, što menja značenje `fill` i može da pošalje formu tamo gde ne treba. Predlažem (a). Ostale prepreke iz TodoMVC-a: checkbox zadatka nema ime, „Delete todo“ se vidi samo na hover i nije jedinstveno, izmena je na dvoklik. To arhitekta beleži kao `notPortable`/`hiddenBehind`.
- **Structured output i Anthropic (A, `runStructured` u A8).** Mozaik šalje šemu Anthropicu bez izmena (`output_config.format`). `z.toJSONSchema(PlanSchema)` sadrži ključeve koje Anthropic ne podržava: `minLength` (20×), `minimum`/`maximum` (iz `.int()`), `oneOf` (namerne razlike), `minItems: 2` (`Flow.unitIds`) i `additionalProperties: {type: string}` + `propertyNames` (`routeMap`). Šema analizatora ima `minLength` (3×). Predlog: `runStructured` pre slanja čisti JSON Schemu (briše `minLength`, `maxLength`, `minimum`, `maximum`, `propertyNames`, `$schema`, `minItems > 1`; `oneOf` → `anyOf`), a zod proverava odgovor posle, kao i do sada. Ugovori se ne menjaju.
- **`routeMap` od modela (moje, D13/D14).** Arhitekta ne vraća `routeMap`: šema za model je `PlanSchema.omit({ routeMap: true })`, a `routeMap` računa kod (`expoRouteFor`). Tako nema `additionalProperties` koji nije `false`.
- **`writes` (C).** Test ugovora koristi `src/screens/<id>/`, dakle putanje relativne u odnosu na `app/`. Tako radim `validatePlan` i `normalizePlan`, osim ako C kaže drugačije.
- **`Unit.id` kao ime foldera.** `UnitSchema` traži samo `min(1)`. `validatePlan` proverava `^[a-z0-9][a-z0-9-]*$`, pa ugovor ne mora da se menja.
- **Neuspeo plan (A, PD2).** Nema događaja za „arhitekta nije uspela posle 3 pokušaja“. Predlog: `plan.failed {}` ili timeout u Conductoru uz `plan.errors.json`.
- Odgovori na P4 (`splitParts`) i P5 (Conductor čeka sve `analysis.done`) iz `docs/tasks/a.md`: slažem se sa predlozima.

## Blokira me
- ništa
