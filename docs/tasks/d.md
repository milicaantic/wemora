# Zadaci: osoba D — ulaz, izlaz i integracija

> Ovo su koraci osobe D iz `docs/tim-plan.md`, prepisani tako da ih AI model može direktno koristiti za pisanje koda. Šta je urađeno i šta čeka piše u `docs/status/d.md`. Prati faze F0–F4 i kapije G0–G4 iz `docs/tim-plan.md`, a format prati `docs/tasks/a.md`: *Fajlovi i izvozi* → *Šta radi* → *Gotovo kad* → *Zavisnosti i mock*.

## 0. Uputstvo za AI model (pročitaj prvo)

**Početak svake sesije:** „Ja sam osoba D. Pročitaj `CLAUDE.md`, `docs/architecture.md`, `docs/tasks/d.md` i `docs/status/d.md`. Radimo korak Dx.“

**Prioritet izvora istine:** `src/contracts/` (kod) > `docs/architecture.md` > `docs/tim-plan.md` > ovaj fajl. Ako se ovaj fajl ne slaže sa ugovorima ili arhitekturom, **stani i reci šta se ne slaže**. Ne rešavaj sam i ne menjaj ugovor.

> **Stanje na dan 30. 10. 2026 (posle D0):** ugovori su spojeni u `main` (PR #1) i proveren je svaki moj tip: tipovi ispod su isti kao u `src/contracts/`. Dve stvari iz D0 menjaju moje zadatke:
> 1. **Izlaz modela ne sme da koristi ugovorne šeme direktno kao `structuredOutput`.** Anthropic odbija `minLength`, `minimum`, `maximum`, `oneOf`, `propertyNames`, `minItems > 1` i `additionalProperties` koji nije `false`, a `z.toJSONSchema(PlanSchema)` ima sve to. Čišćenje šeme je predlog za A-ov `runStructured`. Za svaki slučaj: arhitekta ne vraća `routeMap` (šema za model je `PlanSchema.omit({ routeMap: true })`, a `routeMap` pravi kod), a zod provera ugovornom šemom ide uvek posle odgovora.
> 2. **`writes` su relativne u odnosu na `app/`**: `src/screens/<id>/` i `src/shared/<id>/` (tako piše test ugovora). Važi za D5, D8 i D13.

**Moji folderi (samo njih menjam):** `src/analysis/`, `src/report/`, `examples/`, `src/agents/analyzer.ts`, `src/agents/architect.ts`, `src/agents/prompts/analyzer.md`, `src/agents/prompts/architect.md`, `README.md`, `runs/`, `docs/status/d.md`.

**Tvrda pravila za kod:**
1. `src/analysis/` i `src/report/` su **domen**: ne uvoze `@mozaik-ai/core`, `src/agents/`, `src/orchestration/` ni `core/runtime|state|runner`. Iz `core/` smeju samo `core/config.ts` i `core/log.ts` (P3 iz a.md). Drugi domen samo preko njegovog `index.ts`.
2. Agenti (`analyzer.ts`, `architect.ts`) su tanki: prompt, alati, reakcija na zadatak. Sva logika (brief za model, provera izlaza, normalizacija plana) je u `src/analysis/` i testira se bez Mozaika.
3. Tipovi samo iz `src/contracts/`. Nema lokalnih kopija tipova. Sav JSON sa diska i od modela prolazi zod šemu iz `contracts/`.
4. Putanje u svim izlazima su **relativne i sa `/`** (Windows!): `src/pages/List.tsx`, nikad `src\pages\List.tsx`. Koristi `path.posix` posle `relative()` + `replaceAll("\\", "/")`.
5. Svi izlazi su **deterministički**: sortirane liste, bez `Date.now()` u sadržaju (vreme dolazi iz `run.jsonl`), bez nasumičnih ID-jeva.
6. Testovi su vitest, bez mreže i bez pravog modela (MockRunner). Fixture-i su u `<moj folder>/mocks/`.
7. Imena u kodu i komentari na engleskom. Poruke grešaka koje čita model su na engleskom. Tekst u `examples/recepti` i u `report.html` je na srpskom.
8. Nove npm zavisnosti samo uz odobrenje tima, kroz poseban PR (`package.json` + `package-lock.json`). `examples/*` imaju svoj `package.json` i nisu u root `tsconfig`-u.
9. ESM, TypeScript strict, Node 22, `tsx`. Uvozi bez ekstenzije (`moduleResolution: Bundler`, A0.0).

**Pre svakog PR-a:** `git pull --rebase origin main && npm run build && npm test`, plus ažuriran `docs/status/d.md`. Commit poruka: `<folder>: opis` (npr. `analysis: route parser`). Review radi A (tim-plan §1).

---

## Pregled

| ID | Faza | Zadatak | Grana | Procena |
|---|---|---|---|---|
| D0 | F0 | Review ugovora za moj deo | (review `contracts/initial`) | 30 min |
| D1 | F0 | `examples/todomvc` | `d/todomvc` | 30 min |
| D2 | F0 | `docs/status/d.md` | `d/todomvc` | 5 min |
| | | **Kapija G0 (proverava A)** | | |
| D3 | F1 | `examples/mock-api` | `d/recepti` | 45 min |
| D4 | F1 | `examples/recepti` (5 ekrana, samo desktop) | `d/recepti` | 2–3 h |
| D5 | F1 | Ručni plan za Recepte (`plan.manual.json`) | `d/recepti` | 30 min |
| D6 | F1 | Parser: `parseApp()` | `d/parser` | 2 h |
| D7 | F1 | Podela: `splitParts()` | `d/parser` | 30 min |
| D8 | F1 | `validatePlan()` | `d/validate-plan` | 1 h |
| D9 | F1 | Izveštaj v1: `buildReport()` | `d/report-v1` | 2 h |
| D10 | F1 | Kostur `README.md` | `d/report-v1` | 20 min |
| | | **Kapija G1 (proverava D)** | | |
| D11 | F2 | Domen za analizatora (pristup fajlovima, brief, provera izlaza) | `d/analyzer` | 1 h |
| D12 | F2 | Agent analizator + prompt | `d/analyzer` | 1 h |
| D13 | F2 | Domen za arhitektu (`normalizePlan`, `expoRouteFor`, brief) | `d/architect` | 1 h |
| D14 | F2 | Agent arhitekta + prompt | `d/architect` | 1 h |
| D15 | F2 | MockRunner odgovori za moje agente | `d/mock-replies` | 30 min |
| D16 | F2 | Ručna provera plana za Recepte + integracija | `d/fix-<opis>` | 1 h |
| | | **Kapija G2 (proverava A)** | | |
| D17 | F3 | Izveštaj v2: vremenska osa, trošak, ubrzanje, agenti | `d/report-v2` | 2 h |
| D18 | F3 | `runs/` i arhiviranje prolaza | `d/runs` | 45 min |
| D19 | F3 | Pun `README.md` | `d/readme` | 1,5 h |
| | | **Kapija G3 (proverava B) + prva predaja** | | |
| D20 | F4 | Crveni tim | issue-i vlasnicima | cela faza |
| D21 | F4 | Rezervni plan *Wemora Lab* (samo ako treba) | `d/lab` | 1 h |
| | | **Kapija G4 (proverava D) = zaključavanje koda** | | |

Redosled u F1: D3 → D4 → D5 su jedan tok (aplikacija), D6 → D7 → D8 → D9 drugi. Ako radiš sa dva AI agenta istovremeno, ova dva toka se ne dodiruju. D5 zavisi od D8 samo za test.

---

## Tipovi koje koristim (predlog iz A0, proveri u `src/contracts/`)

```ts
// contracts/types.ts — parser (moje)
type ParsedRoute  = { path: string; file: string; files: string[]; tokens: number; webApis: string[] }
type AnalysisPart = { id: string; routes: string[]; files: string[]; tokens: number }
type ParsedApp    = { webDir: string; routes: ParsedRoute[]; sharedFiles: string[]; totalTokens: number; parts: AnalysisPart[] }

// analizator (moje)
type AnalyzerReport = {
  partId: string; route: string; screen: string; summary: string
  files: string[]; components: string[]; dataSources: string[]; navigatesTo: string[]
  webApis: string[]; mobileIssues: string[]; suggestedObligations: string[]
}

// plan (moje: arhitekta)
type Obligation = { id: string; description: string }
type Unit = {
  id: string; kind: "shared" | "screen"; wave: number; route?: string
  sources: string[]; writes: string[]; dependsOn: string[]
  obligations: Obligation[]; intentionalDifferences: IntentionalDifference[]; size: number
}
type Flow = { id: string; description: string; unitIds: string[] }
type Plan = { units: Unit[]; flows: Flow[]; routeMap: Record<string, string> }   // web putanja → Expo ruta

// contracts/difference.ts
type HiddenBehind = { kind: "hiddenBehind"; element: ElementRef; reveal: TapTarget }
type MovedTo      = { kind: "movedTo"; what: string; toUnit: string }
type NotPortable  = { kind: "notPortable"; element: { role: string; name: string }; reason: string }

// izveštaj čita i ovo (B, C)
type ScreenStatus = "proven" | "partial" | "unproven" | "failed"
type GateResult, ScenarioResult, Coverage, UnitResult   // vidi a.md A0.3

// contracts/api.ts — moji potpisi
type ParseApp     = (webDir: string) => Promise<ParsedApp>
type SplitParts   = (parsed: ParsedApp, n: number) => AnalysisPart[]
type ValidatePlan = (plan: Plan, parsed: ParsedApp) => string[]          // prazna lista = ok
type BuildReport  = (runDir: string) => Promise<string>                  // putanja do report.html

// agents/_shared/handle.ts (A8) — interfejs prema Conductoru
interface AgentHandle<TTask> { id: string; kind: AgentKind; participant: Participant; isBusy(): boolean; assign(task: TTask): void; cancel(reason: string): void }
type AnalyzeTask   = { partId: string }
type ArchitectTask = { partIds: string[] }
```

Svaki moj `index.ts` izvozi funkciju sa tipom iz `contracts/api.ts`, npr. `export const parseApp: ParseApp = async (webDir) => { … }`, pa `tsc` javlja čim se potpis i implementacija raziđu.

---

## F0: Temelj

### D0 — Review ugovora za moj deo
- **Fajlovi:** nijedan moj. Review PR-a `contracts/initial` (A0).
- **Šta radi:** proveravam da `ParsedApp`, `AnalysisPart`, `AnalyzerReport`, `Obligation`, `Unit`, `Flow`, `Plan`, `SplitParts`, `ValidatePlan` i `BuildReport` odgovaraju ovom planu. Posebno:
  1. `ParsedRoute.path` je web putanja posle spajanja ugnežđenih ruta (`/recepti/:id`), a `file` je fajl komponente ekrana.
  2. `Unit.id` mora da prođe regex `^[a-z0-9][a-z0-9-]*$` (koristi se kao ime foldera). Predlažem da to bude u `UnitSchema`.
  3. `AnalyzerReport.partId` upisuje kod, ne model (vidi D11).
  4. `PlanSchema` je objekat na vrhu (Anthropic structured output traži objekat), a `AnalyzerReport[]` ide kao `{ reports: AnalyzerReport[] }`. Omotač je lokalna zod šema u `analysis/`, sastavljena od ugovornih šema, nije kopija tipa.
  5. Javljam svoje pitanje za zavisnost: `@babel/parser` (P15, isti paket koji C koristi za kapiju `parse`).
- **Gotovo kad:** u chatu potvrđeni moji tipovi ili tačno navedeno šta treba promeniti.
- **Zavisnosti i mock:** A0.

### D1 — `examples/todomvc`
- **Fajlovi:** `examples/todomvc/**` (kopija), `examples/todomvc/SOURCE.md`, `examples/todomvc/LICENSE`.
- **Šta radi:** prebacuje React primer iz `tastejs/todomvc` (folder `examples/react`, MIT) **bez izmena koda** (to je poenta: aplikacija koju nismo mi napisali). `SOURCE.md` beleži URL repoa, commit hash, datum i jedine izmene koje smo napravili (npr. fiksni port). Ako primer ne koristi React Router 6/7, to odmah javi timu, jer parser podržava samo React Router (pitanje PD10). Zabeleži koji router koristi (`HashRouter`?) i koje rute ima (verovatno samo `*`).
- **Gotovo kad:** `cd examples/todomvc && npm install && npm run dev` (ili skripta koju primer ima) otvara aplikaciju u browseru; dodavanje, štikliranje i filteri rade; u `SOURCE.md` su sve informacije iznad. `node_modules/` i `dist/` iz primera nisu u gitu.
- **Zavisnosti i mock:** nema.

### D2 — `docs/status/d.md`
- **Fajlovi:** `docs/status/d.md` po šablonu iz tim-plan §10 (`Faza: F0`, prazne sekcije).
- **Gotovo kad:** fajl postoji i ide u isti PR kao D1.

### Kapija G0 (proverava A)
Moja stavka: `examples/todomvc` se pokreće; povukao sam `main` i napravio `d/recepti` i `d/parser`.

---

## F1: Delovi rade sami

### D3 — `examples/mock-api`
- **Fajlovi:** `examples/mock-api/package.json` (bez zavisnosti, `"type": "module"`, skripta `start: node server.mjs`), `examples/mock-api/server.mjs`, `examples/mock-api/fixtures/default.json`, `examples/mock-api/fixtures/empty.json`, `examples/mock-api/README.md`.
- **Šta radi:** mali HTTP server samo na `node:http`, bez zavisnosti. Obe aplikacije (original i Expo) čitaju isti API, pa iste podatke vide i web i telefon (arch §11).
  - `PORT` iz `MOCK_API_PORT`, podrazumevano `3000` (isto kao C-ov šablon). Opciono kašnjenje `MOCK_API_DELAY_MS` (podrazumevano 0).
  - CORS: `Access-Control-Allow-Origin: *`, odgovor na `OPTIONS`.
  - Rute:
    - `GET /api/recipes` → svi recepti (lista bez `steps`, sa `ingredients`)
    - `GET /api/recipes/:id` → jedan recept, 404 `{ "error": "not found" }`
    - `GET /api/categories` → kategorije
    - `GET /__health` → `{ "ok": true, "fixture": "<ime>" }`
    - `POST /__fixture` sa telom `{ "name": "default" }` → menja aktivni fixture (za `Scenario.apiFixture`), 400 za nepoznato ime. **Predlog, potvrđuje B (PD1).**
  - Podaci su read-only. Stanje klijenta (omiljeni, lista za kupovinu) je u `localStorage` aplikacije, ne u API-ju.
  - `fixtures/default.json`: 4 kategorije (`supe` Supe, `glavna-jela` Glavna jela, `salate` Salate, `deserti` Deserti), 12 recepata sa ID-jevima `"1"`–`"12"`. Svaki recept: `id`, `name`, `categoryId`, `timeMin`, `difficulty` (`Lako|Srednje|Teško`), `servings`, `calories`, `rating` (1–5, jedna decimala), `ingredients: { name, amount, unit }[]`, `steps: string[]`. Imena recepata su jedinstvena i nijedno nije podniz drugog (npr. ne „Pita“ i „Pita od jabuka“), da `expectVisible`/`expectNotVisible` ne bi slučajno pogađali dva recepta.
  - `fixtures/empty.json`: kategorije postoje, recepata nema.
- **Gotovo kad:** `node examples/mock-api/server.mjs`, pa u drugom terminalu `curl localhost:3000/api/recipes` vraća 12 recepata, `curl localhost:3000/api/recipes/999` vraća 404, `curl -X POST -d '{"name":"empty"}' localhost:3000/__fixture` i ponovo `/api/recipes` vraća `[]`.
- **Zavisnosti i mock:** nema. B koristi ovaj server u svojim testovima, pa API ne menjam bez poruke B-u.

### D4 — `examples/recepti` (5 ekrana, namerno samo za desktop)
- **Fajlovi:**
  ```
  examples/recepti/
    package.json          vite, @vitejs/plugin-react, react@18, react-dom@18, react-router-dom@6, typescript
    index.html  vite.config.ts  tsconfig.json  README.md
    src/main.tsx          createRoot + <BrowserRouter><App/></BrowserRouter>
    src/App.tsx           <Routes> (vidi ispod)
    src/api/client.ts     API_URL, getRecipes(), getRecipe(id), getCategories(), tipovi Recipe, Category
    src/store/favorites.ts      useFavorites(): { ids, isFavorite(id), toggle(id) }  — localStorage "recepti.favorites"
    src/store/shoppingList.ts   useShoppingList(): { items, add(name), toggle(id), clearBought(), addMany(names) } — "recepti.shopping"
    src/components/Layout.tsx + Layout.css      bočni meni (Sidebar) + <Outlet/>
    src/components/Sidebar.tsx
    src/components/FavoriteButton.tsx           koristi ga lista i detalj → parser ga vidi kao zajednički
    src/components/Status.tsx                   <Loading/> „Učitavanje…“, <ErrorMessage/> „Greška pri učitavanju podataka“
    src/pages/RecipeListPage.tsx + .css
    src/pages/RecipeDetailPage.tsx + .css
    src/pages/CategoriesPage.tsx + .css
    src/pages/FavoritesPage.tsx + .css
    src/pages/ShoppingListPage.tsx + .css
  ```
- **Rute** (ugnežđene namerno, da parser mora da spaja putanje i da prepozna layout rutu):
  ```tsx
  <Routes>
    <Route path="/" element={<Layout />}>
      <Route index element={<RecipeListPage />} />
      <Route path="recepti/:id" element={<RecipeDetailPage />} />
      <Route path="kategorije" element={<CategoriesPage />} />
      <Route path="omiljeni" element={<FavoritesPage />} />
      <Route path="kupovina" element={<ShoppingListPage />} />
    </Route>
  </Routes>
  ```
- **Ekrani** (svaki 80–180 linija, da ga Haiku builder može preneti u jednoj rundi):

  | Ruta | Ekran | Desktop-only osobina | Interaktivni elementi (tačna pristupačna imena) |
  |---|---|---|---|
  | `/` | Lista recepata | **široka tabela** sa 8 kolona (Naziv, Kategorija, Vreme, Težina, Porcije, Kalorije, Ocena, Omiljeni); **hover** na redu prikazuje `role="tooltip"` sa sastojcima | polje „Pretraga“ (filtrira po nazivu, bez obzira na velika slova), grupa „Kategorija“ sa dugmadima „Sve kategorije“ + 4 kategorije (ne `<select>`: DSL nema izbor iz liste), dugme „Sortiraj po vremenu“, link sa nazivom recepta → `/recepti/:id`, dugme „Dodaj u omiljene: <naziv>“ / „Ukloni iz omiljenih: <naziv>“; prazno: „Nema recepata za zadatu pretragu“ |
  | `/recepti/:id` | Detalj recepta | **dve kolone** (sastojci levo, koraci desno) | dugmad „Smanji porcije“ / „Povećaj porcije“ (min 1), tekst „Porcije: N“, količine sastojaka se skaliraju; „Dodaj u omiljene“ / „Ukloni iz omiljenih“; „Dodaj sastojke u listu za kupovinu“ → poruka „Sastojci su dodati u listu za kupovinu“; nepostojeći ID: „Recept nije pronađen“ |
  | `/kategorije` | Kategorije | **lista i detalj jedan pored drugog** | dugme za svaku kategoriju sa imenom („Supe“…); posle izbora desno naslov kategorije i njeni recepti kao linkovi; pre izbora: „Izaberite kategoriju“ |
  | `/omiljeni` | Omiljeni | mreža kartica u 3 kolone | kartica sa linkom na recept, dugme „Ukloni iz omiljenih: <naziv>“; prazno: „Nemate omiljenih recepata“ |
  | `/kupovina` | Lista za kupovinu | tabela sa kolonama i prečica na tastaturi (Enter dodaje) | polje „Namirnica“, dugme „Dodaj“, checkbox po stavci sa labelom = ime namirnice, dugme „Obriši kupljene“; prazno: „Lista za kupovinu je prazna“ |

  Bočni meni (u `Layout`) ima linkove „Recepti“, „Kategorije“, „Omiljeni“, „Lista za kupovinu“ (`NavLink`, aktivna stavka označena). Naslov aplikacije „Recepti“ je `<h1>` u meniju, a svaki ekran ima svoj `<h2>`.
- **Pravila za aplikaciju:**
  1. **Pristupačna imena na svemu**: svako polje ima `<label htmlFor>` ili `aria-label`; svako dugme ima vidljiv tekst ili `aria-label`. **Imena su jedinstvena na ekranu** (zato „Dodaj u omiljene: Sarma“ u tabeli), da Playwright `getByRole` ne bi našao dva elementa.
  2. Podaci samo preko `src/api/client.ts`: `const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000"`. Filtriranje i sortiranje rade se u klijentu.
  3. Dok se učitava: „Učitavanje…“. Kad API ne radi: „Greška pri učitavanju podataka“.
  4. Obični CSS fajlovi, bez CSS-in-JS i bez Tailwinda (ulazni profil, arch §1). Fiksne širine (`min-width: 1100px` za layout), da bude jasno da nije prilagođeno telefonu.
  5. Hooks i Context, bez Reduxa. Bez biblioteka osim React Routera.
  6. Vite dev server na `5173` sa `strictPort: true`.
- **Gotovo kad:**
  1. sa pokrenutim `mock-api`: `cd examples/recepti && npm install && npm run dev` i svih 5 ekrana rade ručno po tabeli iznad;
  2. `npm run build` u `examples/recepti` prolazi (TypeScript bez grešaka);
  3. u Chrome DevTools → Accessibility, svako dugme i polje ima ime;
  4. omiljeni i lista za kupovinu preživljavaju osvežavanje stranice;
  5. `examples/recepti/README.md` ima komande za pokretanje sa mock-api-jem.
- **Zavisnosti i mock:** D3.

### D5 — Ručni plan za Recepte
- **Fajlovi:** `examples/recepti/wemora/plan.manual.json`, `examples/recepti/wemora/README.md` (čemu služi).
- **Šta radi:** ručno napisan `Plan` za Recepte po ugovoru. Služi kao fixture za C (`scaffold()` u G1), za B (obaveze i `obligation` ID-jevi za ručne scenarije), kao primer za prompt arhitekte i kao očekivanje za D16. Sadržaj:
  - zajedničke jedinice (talas 0): `data` (api klijent + oba store-a: `src/api/client.ts`, `src/store/*.ts`), `layout` (`Layout`, `Sidebar`, `FavoriteButton`, `Status`, `main.tsx`, `App.tsx`);
  - ekrani (talas 1, `dependsOn: ["data", "layout"]`): `recipe-list`, `recipe-detail`, `categories`, `favorites`, `shopping-list`;
  - obaveze, po 2–4 po ekranu, sa kebab-case ID-jevima, npr. `recipe-list`: `shows-recipes`, `search-by-name`, `filter-by-category`, `open-detail`; `recipe-detail`: `shows-ingredients`, `scale-servings`, `toggle-favorite`, `add-to-shopping-list`;
  - namerne razlike: `recipe-list` → `hiddenBehind` za dugmad kategorija (npr. `{ role: "button", name: "Deserti" }`) iza dugmeta „Filteri“, `notPortable` za tooltip sa sastojcima (hover); `categories` → nijedna (test proverava rezultat, ne raspored);
  - tokovi: `favorite-flow` (`recipe-detail` → `favorites`), `shopping-flow` (`recipe-detail` → `shopping-list`);
  - `routeMap`: `"/" → "/"`, `"/recepti/:id" → "/recepti/[id]"`, `"/kategorije" → "/kategorije"`, `"/omiljeni" → "/omiljeni"`, `"/kupovina" → "/kupovina"`;
  - `writes`: `["src/screens/<id>/"]` za ekrane i `["src/shared/<id>/"]` za zajedničke jedinice (relativno u odnosu na `app/`, kao u testu ugovora; PD4);
  - `size`: tokeni iz `parseApp` (posle D6 popuni tačno).
- **Gotovo kad:** test u D8 učitava ovaj fajl, provlači ga kroz `PlanSchema` i `validatePlan(plan, await parseApp("examples/recepti"))` vraća `[]`. Poslat C-u i B-u u chatu.
- **Zavisnosti i mock:** D4, A0. Pre D6/D8 proveri samo `PlanSchema`.

### D6 — Parser: `parseApp()`
- **Fajlovi:** `src/analysis/parse.ts`, `src/analysis/imports.ts`, `src/analysis/routes.ts`, `src/analysis/webApis.ts`, `src/analysis/tokens.ts`, `src/analysis/errors.ts`, `src/analysis/index.ts`, `src/analysis/parse.test.ts`, fixture aplikacije u `src/analysis/mocks/`.
- **Izvozi (iz `index.ts`):**
  ```ts
  export const parseApp: ParseApp
  export class UnsupportedInputError extends Error {
    constructor(public code: "not-react" | "nextjs" | "no-router" | "router-v5" | "no-routes" | "unresolved-route", message: string)
  }
  ```
- **Zavisnost:** `@babel/parser` (PD8, isti paket kao C-ova kapija `parse`). Bez `@babel/traverse`: obilazak AST-a je mala rekurzivna funkcija u `imports.ts` koja prolazi kroz sve vrednosti čvorova koje imaju `type`.
- **Šta radi, korak po korak:**
  1. **Provera ulaza** (`package.json` u `webDir`, zod šema samo za polja koja čitam): ako u `dependencies`/`devDependencies` postoji `next` → `nextjs` („Next.js is not supported: Wemora migrates client-side React SPAs with React Router 6/7.“); nema `react` → `not-react`; nema `react-router-dom` ni `react-router` → `no-router`; verzija rutera počinje sa `^5`/`5` → `router-v5`.
  2. **Skup fajlova:** svi `.js .jsx .ts .tsx` ispod `src/` (ako ne postoji `src/`, koren `webDir`), bez `node_modules`, `dist`, `build`, `*.test.*`, `*.spec.*`, `__tests__`, `*.d.ts`. CSS fajlovi se ne parsiraju, ali ulaze u fajlove ako ih neko uvozi (`import "./X.css"`, `import s from "./X.module.css"`).
  3. **Parsiranje:** `@babel/parser` sa `sourceType: "module"`, `plugins: ["jsx", "typescript"]` (za `.js`/`.jsx` samo `jsx`). Fajl koji ne može da se parsira → greška sa imenom fajla.
  4. **Graf uvoza:** za svaki `import … from "./x"`, `export … from "./x"` i `import("./x")` razreši relativnu putanju: `x`, `x.tsx`, `x.ts`, `x.jsx`, `x.js`, `x/index.*`, i `.css`. Paketi (`react`, `react-router-dom`) se ignorišu.
  5. **Rute:**
     - JSX: `<Route path="…" element={<X />}>` i `<Route index element={<X />}>`, sa ugnežđivanjem: putanja deteta se spaja sa roditeljem (`"/" + "recepti/:id"` → `/recepti/:id`), `index` dobija putanju roditelja, apsolutna putanja deteta se ne spaja.
     - Objekti: `createBrowserRouter([...])`, `createHashRouter([...])`, `useRoutes([...])` sa `{ path, index, element, Component, children, lazy }`.
     - **Ekran je samo list ruta** (ruta bez dece). Ruta sa decom je layout: njen element i fajlovi su zajednički.
     - Element `<Navigate …/>` nije ekran (preusmerenje), preskače se.
     - Komponenta ekrana se razrešava preko imena: lokalna deklaracija u istom fajlu ili uvoz (`import X from "./pages/X"`, imenovani uvoz, `React.lazy(() => import("./pages/X"))`). Ako ne može da se razreši → `unresolved-route` sa putanjom i imenom.
     - Nijedna ruta → `no-routes`.
     - Normalizacija putanje: počinje sa `/`, bez završnog `/` (osim korena), `*` ostaje `*`.
  6. **Fajlovi po ruti:** tranzitivno zatvorenje uvoza od `file` ekrana. **Zajednički fajlovi** (`sharedFiles`) su: (a) fajlovi koji se javljaju u zatvorenjima 2 ili više ruta, i (b) fajlovi dostupni iz ulaza (`main.*`, `index.*`, fajl sa rutama, layout rute) koji nisu ni u jednom zatvorenju ekrana. `ParsedRoute.files` = zatvorenje minus zajednički fajlovi. Tako svaki fajl pripada tačno jednoj ruti ili zajedničkom delu.
  7. **Web API-ji** (`webApis.ts`, lista je konstanta): `localStorage`, `sessionStorage`, `window`, `document`, `navigator`, `fetch`, `XMLHttpRequest`, `addEventListener`, `matchMedia`, `hover` (JSX `onMouseEnter`/`onMouseOver`/`onMouseLeave`), `contextmenu` (`onContextMenu`), `keyboard` (`onKeyDown`/`onKeyUp`/`onKeyPress`), `drag` (`draggable`, `onDrag*`), `table` (JSX `<table>`), `title-tooltip` (JSX atribut `title`). Po ruti: unija nalaza iz njenih fajlova, sortirana, bez duplikata.
  8. **Tokeni** (`tokens.ts`): `estimateTokens(text) = Math.ceil(text.replace(/\r\n/g, "\n").length / 4)`, bez biblioteke. Krajevi linija se normalizuju jer git na Windowsu pravi CRLF, a broj ne sme da zavisi od mašine (D5 `size` vrednosti su računate ovako). Ruta: zbir njenih fajlova. `totalTokens`: zbir svih različitih fajlova (rute + zajednički).
  9. **Delovi:** `parts: splitParts(parsed, 1)` (jedan deo). Conductor kasnije zove `splitParts` sa svojim N (P4).
  10. **Izlaz:** sve putanje relativne u odnosu na `webDir`, sa `/`; rute sortirane po `path`, fajlovi abecedno; `webDir` je apsolutna putanja. Rezultat prolazi `ParsedAppSchema.parse` pre vraćanja.
- **Fixture aplikacije u `src/analysis/mocks/`** (samo `package.json` + nekoliko malih fajlova): `next-app/` (ima `next`), `no-router/`, `router-v5/`, `object-routes/` (`createBrowserRouter` sa `children` i `index`), `lazy-routes/` (`React.lazy`), `unresolved/` (element iz nepostojećeg uvoza).
- **Gotovo kad:** `npx vitest run src/analysis/parse.test.ts`:
  1. `examples/recepti` → tačno 5 ruta: `/`, `/kategorije`, `/kupovina`, `/omiljeni`, `/recepti/:id`; `src/components/Layout.tsx` i `src/api/client.ts` su u `sharedFiles`, a `src/pages/RecipeListPage.tsx` je samo u ruti `/`; `webApis` rute `/` sadrži `table` i `hover`, a `/omiljeni` ne sadrži `table`;
  2. `examples/todomvc` → rute koje su zapisane u `SOURCE.md` (D1), bez greške;
  3. svaki fajl iz `routes[*].files` i `sharedFiles` se javlja tačno jednom;
  4. `next-app` → `UnsupportedInputError` sa `code: "nextjs"`; `router-v5` → `router-v5`; `unresolved` → `unresolved-route`;
  5. `object-routes` i `lazy-routes` daju očekivane putanje i fajlove;
  6. nijedna putanja u izlazu ne sadrži `\`;
  7. dva poziva nad istim folderom daju `JSON.stringify` jednak rezultat.
- **Zavisnosti i mock:** A0 (`ParsedAppSchema`), A3 (prazan `analysis/index.ts`), PD8 (`@babel/parser`). Do spajanja ugovora: lokalni tip u testu **ne praviti**; sačekaj A0 ili radi na grani preko `contracts/initial`.

### D7 — Podela: `splitParts()`
- **Fajlovi:** `src/analysis/split.ts`, `src/analysis/split.test.ts`; izvoz iz `index.ts`.
- **Izvozi:** `export const splitParts: SplitParts`.
- **Šta radi:** deli rute na `n` delova približno jednake veličine u tokenima (pohlepno: rute sortirane po `tokens` opadajuće, pa po `path`; svaka ide u deo sa najmanje tokena; kod izjednačenja manji indeks). `n` se ograničava na `[1, broj ruta]`, pa nema praznih delova. ID-jevi `part-1`, `part-2`…; `routes` su putanje, `files` unija fajlova tih ruta (sortirano), `tokens` zbir. Zajednički fajlovi **ne** ulaze u `files` dela; svaki analizator ih dobija kao read-only (D11).
- **Gotovo kad:** `npx vitest run src/analysis/split.test.ts`: Recepti sa `n=1` → 1 deo sa 5 ruta; sa `n=2` → 2 dela, svaka ruta tačno u jednom, razlika u tokenima ≤ najveća pojedinačna ruta; `n=10` → 5 delova; `n=0` → 1 deo; isti ulaz daje isti izlaz.
- **Zavisnosti i mock:** D6 (ili ručni `ParsedApp` u testu).

### D8 — `validatePlan()`
- **Fajlovi:** `src/analysis/validatePlan.ts`, `src/analysis/validatePlan.test.ts`; izvoz iz `index.ts`.
- **Izvozi:** `export const validatePlan: ValidatePlan`.
- **Šta radi:** vraća listu grešaka na engleskom, tako napisanih da ih arhitekta (model) razume i popravi. Redosled grešaka je redosled pravila, pa jedinice po `id`. Pravila:
  1. `PlanSchema.safeParse(plan)`; ako ne prođe, vrati zod poruke (putanja + poruka) i stani.
  2. `id` jedinica jedinstveni i po regexu `^[a-z0-9][a-z0-9-]*$`.
  3. `screen` ima `route`, `shared` nema `route`.
  4. Svaka ruta iz `parsed.routes` je `route` **tačno jedne** `screen` jedinice; nijedna `route` ne sme da ne postoji u parseru. Poruka: `route "/kupovina" is not covered by any screen unit`.
  5. Svaki `sources` fajl postoji u `parsed` (u nekoj ruti ili u `sharedFiles`) i pripada **najviše jednoj** jedinici. Poruka: `file "src/api/client.ts" is in units "data" and "recipe-list"; a file may belong to at most one unit`.
  6. `file` ekrana iz parsera je u `sources` jedinice koja pokriva tu rutu.
  7. `dependsOn` pokazuje na postojeće jedinice, bez sebe same, bez ciklusa (DFS; poruka navodi ciklus `a -> b -> a`).
  8. Talasi: `shared` je talas 0 i sme da zavisi samo od drugih `shared` jedinica (bez ciklusa; npr. `layout` → `data` u Receptima); `screen` je talas ≥ 1 i veći od talasa svake svoje zavisnosti; ekran koji zavisi od drugog ekrana ima talas ≥ 2.
  9. `writes`: neprazno, samo unutar dozvoljenog prefiksa jedinice (po dogovoru sa C, PD4), dve jedinice nemaju preklapajuće `writes`.
  10. `screen` ima bar jednu obavezu; ID-jevi obaveza jedinstveni u jedinici i kebab-case; `description` nije prazan.
  11. Namerne razlike: `movedTo.toUnit` postoji i nije ista jedinica; `shared` jedinica nema namernih razlika.
  12. `routeMap`: svaka ruta iz parsera ima ključ; vrednosti počinju sa `/` i jedinstvene su; `:param` je preveden u `[param]`.
  13. Tokovi: ID-jevi jedinstveni, `unitIds` postoje, svi su `screen`, bar 2.
- **Gotovo kad:** `npx vitest run src/analysis/validatePlan.test.ts`, polazeći od `plan.manual.json` (D5) i pravog `parseApp("examples/recepti")`:
  1. ispravan plan → `[]`;
  2. obrisan ekran `shopping-list` → greška koja sadrži `"/kupovina"`;
  3. `src/api/client.ts` dodat i u `recipe-list.sources` → greška koja navodi obe jedinice;
  4. `dependsOn: ["nepostoji"]` → greška; ciklus `recipe-detail ↔ favorites` → greška sa ciklusom;
  5. ekran u talasu 0 → greška; `routeMap` bez `"/recepti/:id"` → greška;
  6. `kind: "page"` → zod greška iz pravila 1, bez izuzetka.
- **Zavisnosti i mock:** D5, D6, A0 (`PlanSchema`). PD4 za pravilo 9; dok se ne odluči, pravilo 9 proverava samo „neprazno i bez preklapanja“.

### D9 — Izveštaj v1: `buildReport()`
- **Fajlovi:** `src/report/load.ts`, `src/report/model.ts`, `src/report/render.ts`, `src/report/html.ts`, `src/report/styles.ts`, `src/report/index.ts`, `src/report/report.test.ts`, fixture `src/report/mocks/run/` (`plan.json`, `tests/*.json`, `results/*.json`, `run.jsonl`).
- **Izvozi:** `export const buildReport: BuildReport`. Interno (bez izvoza iz `index.ts`):
  ```ts
  // load.ts — čita disk, sve kroz zod; fajl koji fali ili ne prolazi šemu → upozorenje, ne izuzetak
  type RunData = { runId: string; plan: Plan | null; tests: Record<string, Scenario[]>; results: Record<string, UnitResult>; log: LogLine[]; warnings: string[] }
  function loadRun(runDir: string): Promise<RunData>
  // model.ts — čista funkcija, bez diska
  type UnitRow = { unitId: string; kind: "shared" | "screen"; route?: string; status: ScreenStatus | "no-result"; reason?: string
                   obligations: { covered: number; total: number }; elements: { covered: number; total: number; missing: string[] }
                   differences: string[]; scenarios: { id: string; obligation: string; ok: boolean | null }[]; rounds: number }
  type ReportModel = { runId: string; title: string; counts: Record<ScreenStatus | "no-result", number>; units: UnitRow[]; warnings: string[] }
  function toReportModel(data: RunData): ReportModel
  // render.ts — čista funkcija, ReportModel → HTML string
  function renderReport(model: ReportModel): string
  // html.ts
  function escapeHtml(s: string): string
  ```
- **Šta radi:** iz `output/<run-id>/` pravi jedan samostalan `report.html` (CSS u `<style>`, bez spoljnih fajlova, fontova i CDN-a, radi i otvoren direktno sa diska). Sekcije v1:
  1. **Zaglavlje:** ime prolaza (`runId` = ime foldera), aplikacija, vreme prvog i poslednjeg zapisa iz `run.jsonl` (nikad `Date.now()`).
  2. **Sažetak:** broj ekrana po statusu u 4 boje: dokazan (zelena), delimično dokazan (žuta), nedokazan (siva), neuspeo (crvena). Zajedničke jedinice se broje odvojeno („2 zajedničke jedinice promovisane“).
  3. **Matrica ekran × scenario:** red po ekranu, kolona po scenariju tog ekrana (grupisano po ekranu, ne jedna ogromna tabela); ćelija ✓ / ✗ / — (nije pušten). Uz ✗ ide `failedStep` i `error` iz `ScenarioResult`.
  4. **Pokrivenost po ekranu**, tačno u obliku iz wemora-plan §4.6: „4/4 obaveze, 6/7 elemenata (nedostaje 'Izvezi CSV')“.
  5. **Namerne razlike** kao rečenice: `hiddenBehind` → „'Kategorija' je iza dugmeta 'Filteri'“; `movedTo` → „<what> je prebačeno na <toUnit>“; `notPortable` → „<role> '<name>' nije prenosivo: <reason>“.
  6. **Razlog** za svaki status osim „dokazan“ (`UnitResult.reason`, ili izveden: „nema validiranih testova“, „pada posle runde N: <gate> — <message>“).
  7. **Upozorenja** (fajlovi koji fale ili ne prolaze šemu).
  - Sav tekst iz modela i sa diska ide kroz `escapeHtml` (XSS iz imena recepta ili poruke greške).
  - Ekrani poređani po talasu pa po `id`.
  - Upiše `<runDir>/report.html` i vrati tu putanju.
- **Fixture `src/report/mocks/run/`:** plan Recepata (kopija `plan.manual.json`), i rezultati koji pokrivaju **sva 4 statusa**: `recipe-list` proven, `recipe-detail` partial (fali element), `favorites` unproven (bez testova), `shopping-list` failed (✗ sa porukom), `categories` bez `results/` fajla (`no-result`). Jedan `results/*.json` sa namerno lošim JSON-om (upozorenje). Jedan naziv sa `<script>alert(1)</script>`.
- **Gotovo kad:** `npx vitest run src/report`:
  1. `buildReport(tmpKopijaFixture)` vraća putanju, fajl postoji i počinje sa `<!doctype html>`;
  2. HTML sadrži svih 5 ID-jeva ekrana i po jednu klasu `status-proven`, `status-partial`, `status-unproven`, `status-failed`;
  3. sadrži „4/4 obaveze“ ili tačan oblik iz fixture-a;
  4. ne sadrži `<script>alert(1)</script>`, a sadrži `&lt;script&gt;`;
  5. loš JSON ne obara funkciju i javlja se u sekciji upozorenja;
  6. folder bez `plan.json` daje izveštaj sa upozorenjem, ne izuzetak;
  7. dva poziva daju bajt za bajt isti HTML;
  8. ručno: otvori fajl u browseru i proveri da izgleda pregledno.
- **Zavisnosti i mock:** A0 (`UnitResult`, `ScenarioResult`, `Coverage`, `Scenario`, `Plan`), oblik linije iz A6 (`LogEntry`; uvozim tip iz `core/log.ts`, P3). Do tada fixture pišem ručno po predlogu iz a.md.

### D10 — Kostur `README.md`
- **Fajlovi:** `README.md`.
- **Šta radi:** naslov, jedna rečenica šta je Wemora, sekcije sa naslovima iz D19 i oznakom „u izradi“ gde nema sadržaja, i odmah tačni koraci koji već rade: `npm ci`, `npm run build`, `npm test`, pokretanje `examples/mock-api` i `examples/recepti`.
- **Gotovo kad:** svaka komanda u README-u radi na čistom klonu.

### Kapija G1 — proverava D ✅ 2026-10-30
Pušta se na **čistom** `main`-u (novi folder, `git clone`, `npm ci`). Redom (prošlo na `6289b3c`, detalji u `docs/status/d.md`):
- [x] `npm run build && npm test` zeleno
- [x] `docs/decisions.md` ima odluku o Spike A (C)
- [x] `npx tsx -e "import { parseApp } from './src/analysis'; parseApp('examples/recepti').then(p => console.log(p.routes.length))"` ispisuje `5`
- [x] B: 3 ručna scenarija prolaze na pokrenutim Receptima (`mock-api` + `npm run dev`); `validateScenario` odbija scenario koji prolazi i na praznom ekranu
- [x] C: `scaffold()` nad `examples/recepti/wemora/plan.manual.json` pravi aplikaciju koja se servira; dobar ekran prolazi 4 kapije, loš pada na tačnoj
- [x] prvi zajednički test: B-ov scenario preko C-ovog `serveApp()` nad ručno napisanim RN ekranom prolazi
- [x] A: `npx vitest run src/core src/agents/_shared src/orchestration` zeleno
- [x] svaki `docs/status/*.md` ažuriran

Rezultat (koja stavka pada i ko je vlasnik) pišem u chat tima. Ako stavka padne, vlasnik popravlja, a ja krećem na D11 i D13 (ne zavise od tuđih stavki).

---

## F2: Jedan ekran ceo put

### D11 — Domen za analizatora
- **Fajlovi:** `src/analysis/fileAccess.ts`, `src/analysis/analyzerBrief.ts`, `src/analysis/reports.ts`, testovi `src/analysis/analyzer-domain.test.ts`; izvozi iz `index.ts`.
- **Izvozi:**
  ```ts
  export type FileAccess = { list(): string[]; read(path: string): string }
  export function createFileAccess(parsed: ParsedApp, partId: string): FileAccess
  export function analyzerBrief(parsed: ParsedApp, partId: string): string          // poruka zadatka za model
  export const AnalyzerOutputSchema                                                 // z.object({ reports: z.array(AnalyzerReportSchema.omit({ partId: true })) })
  export function finalizeReports(raw: unknown, parsed: ParsedApp, partId: string): { ok: true; reports: AnalyzerReport[] } | { ok: false; error: string }
  export function fallbackReports(parsed: ParsedApp, partId: string, why: string): AnalyzerReport[]
  ```
- **Šta radi:**
  - `createFileAccess`: dozvoljeni su samo fajlovi dela plus `sharedFiles`. Putanja se normalizuje (`\` → `/`, `posix.normalize`, odbija `..`, apsolutne putanje i sve van `webDir`). Nedozvoljena putanja baca `Error("File not allowed: <p>. Allowed files: call list_files.")` (Mozaik je vraća modelu kao tekst). Fajl veći od ~40 000 znakova se seče sa napomenom `…[truncated]`, da jedan zahtev ostane ispod 100k tokena (wemora-plan §6.1).
  - `analyzerBrief`: tekst sa rutama dela (putanja, fajl ekrana, fajlovi, tokeni, `webApis`) i listom zajedničkih fajlova. Bez sadržaja fajlova (model ih čita alatom).
  - `finalizeReports`: zod provera; tačno jedan izveštaj po ruti dela (fali → greška `missing report for route "/x"`, višak ili nepoznata ruta → greška); `partId` upisuje kod; `files` filtrira na dozvoljene; liste sortira. Greška ide nazad modelu (najviše 2 puta, to radi `runStructured` iz A8).
  - `fallbackReports`: ako model i posle ponovnih pokušaja ne da ispravan izlaz, pravi izveštaje iz parsera (`summary: "Automatic fallback: <why>"`, `files` i `webApis` iz parsera, prazne obaveze). Tako Conductor uvek dobije `analysis.done` i prolaz ne visi.
- **Gotovo kad:** testovi: pristup fajlu dela i zajedničkom fajlu radi; `../package.json`, `C:\x`, `src\..\..\x` i fajl drugog dela bacaju grešku; brief sadrži sve rute dela; `finalizeReports` hvata rutu koja fali i nepoznatu rutu i upisuje `partId`; `fallbackReports` prolazi `AnalyzerReportSchema`.
- **Zavisnosti i mock:** D6, D7.

### D12 — Agent analizator + prompt
- **Fajlovi:** `src/agents/analyzer.ts`, `src/agents/prompts/analyzer.md`, `src/agents/analyzer.test.ts`.
- **Izvozi:** `export function createAnalyzer(id: string): AgentHandle<AnalyzeTask>` (fabrika za `AgentFactories.analyzer`, A10).
- **Šta radi:**
  1. `createAgent` sa imenom `id` i alatima `list_files` (bez argumenata) i `read_file({ path })`, oba preko `defineTool` (A8); `invoke` samo zove `FileAccess`.
  2. `assign({ partId })`: ako je zauzet → log i ignoriše. Inače čita `board().parsed`, pravi `FileAccess` i brief, i zove `runStructured(agent, { prompt: analyzer.md, message: brief, meta: { agentId: id, kind: "analyzer", taskId: partId }, model: MODELS.default, maxOutputTokens: 8000, tools }, AnalyzerOutputSchema)`.
  3. Rezultat → `finalizeReports`; ako ne prođe, ili je `ok: false` → `fallbackReports` i log `analysis.fallback`.
  4. Upiše `board().reports[partId]` i `<runDir>/analysis/<partId>.json` (lepo formatiran JSON), pa `emit("analysis.done", { partId }, id)`.
  5. Sve async ide sa `.catch(log)`; `isBusy()` je tačan od `assign` do `emit`. `cancel(reason)` prosleđuje `CancelGuard`-u (A8).
- **Prompt `analyzer.md`** (engleski, ~60–100 linija), sekcije:
  1. Uloga: analiziraš deo React web aplikacije koja se prenosi na Expo; pišeš samo izveštaj, ne kod.
  2. Alati: „Call one tool at a time.“ Prvo `list_files`, pa `read_file` za fajl ekrana i fajlove koje uvozi. Ne pogađaj sadržaj fajla koji nisi pročitao.
  3. Šta izveštaj sadrži, polje po polje, sa primerom za jedan ekran (Lista recepata).
  4. `mobileIssues` čeklista: široka tabela, bočni meni, dve kolone jedna pored druge, hover, desni klik, prečice na tastaturi, prevlačenje, fiksne širine, `window`/`document`.
  5. `suggestedObligations`: posmatrano ponašanje koje korisnik vidi, sa tačnim tekstom sa ekrana („typing 'Sarma' in 'Pretraga' shows only Sarma“), ne implementacija. 2–5 po ekranu.
  6. `navigatesTo`: web putanje (`/recepti/:id`), ne imena komponenti.
  7. Izlaz: samo JSON po šemi, jedan izveštaj po ruti iz zadatka.
- **Gotovo kad:** `npx vitest run src/agents/analyzer.test.ts` sa `MockRunner`-om (skripta: `list_files` → `read_file` → JSON), u istom fajlu kao inicijalizacija runtime-a (rizik iz A5):
  1. posle `assign` postoji `analysis/part-1.json` koji prolazi šemu i `board().reports["part-1"]` je popunjen;
  2. stigao je tačno jedan `analysis.done` sa `{ partId: "part-1" }`;
  3. skripta sa 3 neispravna JSON-a → fallback izveštaj i ipak `analysis.done`;
  4. `read_file` na `../package.json` vraća modelu poruku greške, petlja se nastavlja.
- **Zavisnosti i mock:** A5 (`board`, `emit`), A7 (`MockRunner`), A8 (`defineTool`, `runStructured`, `AgentHandle`, `CancelGuard`), A4 (`MODELS`). Dok ne stignu: radim samo D11 i prompt.

### D13 — Domen za arhitektu
- **Fajlovi:** `src/analysis/architectBrief.ts`, `src/analysis/normalizePlan.ts`, `src/analysis/expoRoute.ts`, testovi `src/analysis/architect-domain.test.ts`; izvozi iz `index.ts`.
- **Izvozi:**
  ```ts
  export function expoRouteFor(webPath: string, allPaths: string[]): string
  export function architectBrief(parsed: ParsedApp, reports: AnalyzerReport[]): string
  export function architectRetryMessage(previous: Plan, errors: string[]): string
  export function normalizePlan(plan: Plan, parsed: ParsedApp): Plan
  ```
- **Šta radi:**
  - `expoRouteFor`: `/` → `/`; `/recepti/:id` → `/recepti/[id]`; `*` → `/` ako je to jedina ruta (TodoMVC), inače `/[...rest]`; ostalo isto.
  - `architectBrief`: `ParsedApp` (rute, fajlovi, zajednički fajlovi, tokeni, `webApis`) + svi izveštaji kao JSON + pravila iz arch §8 (talas 0, svaki fajl u najviše jednoj jedinici, ekrani zavise samo od zajedničkih, modal se spaja sa ekranom).
  - `architectRetryMessage`: prethodni plan + numerisana lista grešaka iz `validatePlan` + „Return the full corrected plan.“
  - `normalizePlan` (deterministički, **posle** modela, pre `validatePlan`): briše ono što kod zna bolje od modela:
    1. `size` = zbir tokena fajlova iz `sources` (iz parsera);
    2. `wave`: `shared` → 0; `screen` → 1 + najveći talas ekrana od kojih zavisi (ili 1); kod ciklusa ostavi kako jeste (`validatePlan` javlja);
    3. `writes` prazno → podrazumevani prefiks po PD4;
    4. `routeMap` dopuni preko `expoRouteFor` za rute koje fale;
    5. sortira jedinice (talas, pa `id`), `sources`, `dependsOn`, obaveze po `id`;
    6. odbacuje `sources` koji ne postoje u parseru.
- **Gotovo kad:** testovi: `expoRouteFor` za sve primere iznad; `normalizePlan` nad planom sa pogrešnim `size` i `wave` vraća tačne vrednosti; nad `plan.manual.json` ne menja ništa osim redosleda (idempotentno: dva poziva isti rezultat); brief sadrži sve rute i ID-jeve delova.
- **Zavisnosti i mock:** D5, D6, D8.

### D14 — Agent arhitekta + prompt
- **Fajlovi:** `src/agents/architect.ts`, `src/agents/prompts/architect.md`, `src/agents/architect.test.ts`.
- **Izvozi:** `export function createArchitect(id: string): AgentHandle<ArchitectTask>`.
- **Šta radi:**
  1. `createAgent` bez alata.
  2. `assign({ partIds })`: skuplja `board().reports[partId]` za sve delove, pravi brief i zove `runStructured(…, PlanSchema)` sa `MODELS.strong`, `maxOutputTokens: 16000`.
  3. `normalizePlan` → `validatePlan`. Ako ima grešaka: **nov** `runStructured` (svež kontekst, invarijanta 4) sa `architectRetryMessage`, najviše 2 ponavljanja (`DEFAULTS.maxPlanRetries`).
  4. Uspeh: `board().plan = plan`, upiše `<runDir>/plan.json`, `emit("plan.ready", {}, id)`.
  5. Neuspeh posle 3 pokušaja: log `plan.failed` sa listom grešaka, upiše `<runDir>/plan.errors.json`, a Conductor se obaveštava na način dogovoren u PD2. Proces ne pada.
- **Prompt `architect.md`** (engleski), sekcije:
  1. Uloga: od izveštaja analizatora praviš plan migracije; ne pišeš kod.
  2. Jedinice: kada je nešto `shared` (koristi ga 2+ ekrana, skladište podataka, API klijent, navigacija/layout), kada `screen`; modal ili deo koji postoji samo u jednom ekranu ide uz taj ekran.
  3. Svaki izvorni fajl u najviše jednoj jedinici. Svaka ruta tačno jedan ekran.
  4. `dependsOn`: ekrani zavise od zajedničkih; od drugog ekrana samo ako stvarno uvoze njegov kod (retko). Navigacija ide preko `routeMap`, ne preko zavisnosti.
  5. Obaveze: 2–5 po ekranu, kebab-case `id`, opis posmatranog ponašanja sa tačnim tekstom/labelama iz originala. To je osnova pokrivenosti, pa moraju biti proverive kroz UI.
  6. Namerne razlike: kada `hiddenBehind` (desktop element koji na telefonu ide iza dugmeta, npr. filteri), `movedTo` (kolona tabele koja ide na detalj), `notPortable` (hover, desni klik, prečice). Primer za svaku. Što manje razlika, jer svaka slabi dokaz.
  7. Tokovi: samo za ponašanje preko više ekrana (dodaj u omiljene → omiljeni).
  8. Polja `size`, `wave` i podrazumevane `writes` popunjava kod; vrati razumne vrednosti, biće prepisane.
  9. Primer: skraćen `plan.manual.json` (2 jedinice), ne ceo, da model ne bi prepisivao Recepte.
- **Gotovo kad:** `npx vitest run src/agents/architect.test.ts` sa `MockRunner`-om:
  1. ispravan plan → `plan.json` postoji, prolazi `PlanSchema` i `validatePlan`, `plan.ready` emitovan tačno jednom;
  2. skripta [plan bez rute `/kupovina`, ispravan plan] → dva poziva modela, drugi kontekst sadrži grešku sa `"/kupovina"`, na kraju `plan.ready`;
  3. tri loša plana → nema `plan.ready`, postoji `plan.errors.json`, proces ne pada.
- **Zavisnosti i mock:** D13, A5, A7, A8, PD2.

### D15 — MockRunner odgovori za moje agente
- **Fajlovi:** po odluci P13: `src/core/mocks/todomvc.json` (A-ov fajl, ja dajem delove) ili `src/agents/mocks/d.todomvc.json` i `d.recepti.json`.
- **Šta radi:** za TodoMVC: ključ `analyzer:part-1` → [`list_files`, `read_file` za fajl ekrana, `{ json: { reports: [...] } }`], ključ `architect` → [`{ json: <plan> }`]. Isto za Recepte (5 izveštaja, plan = `plan.manual.json`). Plan iz mock-a mora da prođe `validatePlan` nad pravim `parseApp`.
- **Gotovo kad:** `MockFixtureSchema` prolazi; `npm run migrate:mock -- examples/todomvc` stiže do `plan.ready` (dalje je tuđi deo).
- **Zavisnosti i mock:** A7, A12.

### D16 — Ručna provera plana + integracija
- **Šta radi:**
  1. Pravi prolaz samo do plana (`npm run migrate -- examples/recepti --budget 1`, prekini posle `plan.ready` ako ostali delovi još ne rade).
  2. Uporedi `output/<run>/plan.json` sa `plan.manual.json`: da li su `data` i `layout` zajednički, da li ekrani zavise samo od njih, da li su obaveze proverive kroz UI i koriste tekst iz originala, da li su `hiddenBehind`/`notPortable` tamo gde treba. Razlike zapiši u `docs/status/d.md` i popravi **prompt** (ne kod za normalizaciju, osim ako je pravilo determinističko).
  3. Integracija F2: `npm run migrate:mock -- examples/todomvc`, pa pravi prolaz `--budget 1`. Popravljam samo svoje foldere.
- **Gotovo kad:** dva uzastopna prava prolaza daju plan za Recepte koji prolazi `validatePlan` iz prvog ili drugog pokušaja, sa istim jedinicama kao ručni plan.

### Kapija G2 (proverava A)
Moje stavke: `migrate:mock` nad TodoMVC-om pravi `plan.json` i `analysis/`; pravi prolaz nad TodoMVC-om ima plan koji je prošao `validatePlan`; `report.html` postoji (makar v1).

---

## F3: Recepti i dokaz

### D17 — Izveštaj v2
- **Fajlovi:** `src/report/timeline.ts`, `src/report/costs.ts`, izmene u `model.ts` i `render.ts`, testovi u `src/report/report.test.ts`, bogatiji `src/report/mocks/run/run.jsonl`.
- **Šta radi:** dodaje sekcije iz tim-plan F3/D1, sve izračunato iz `run.jsonl` (bez modela):
  1. **Vremenska osa:** jedan red po agentu, trake od `message_received.started` do `model.answer` sa istim `agent` (imena događaja potvrditi sa A, PD6). Crta se kao inline SVG (bez biblioteka), boja po vrsti agenta, oznaka jedinice na traci. Ispod: `participant.joined`/`left` kao tačke.
  2. **Trošak po agentu:** zbir `costUsd` po `agent`, i ukupno; tabela sortirana po trošku.
  3. **Mera ubrzanja:** zbir trajanja svih traka / ukupno vreme prolaza (prvi do poslednjeg zapisa), sa jednom decimalom: „ubrzanje 3,4×“.
  4. **Broj agenata i razlog:** linije `agents.rescaled` (ime dogovoreno sa A u A14) u listi po vremenu.
  5. **Runde i eskalacije po ekranu:** broj `gate.failed` po jedinici i model po rundi ako je u logu.
  6. Sekcije iz v1 ostaju.
- **Gotovo kad:** testovi nad fixture `run.jsonl` sa dva agenta koji se preklapaju: ubrzanje je tačno izračunato (npr. 2 trake po 60 s u prozoru od 80 s → 1,5×); trošak po agentu tačan; nepoznate linije i linije bez `t` se preskaču uz upozorenje; HTML sadrži `<svg`. Ručno: `buildReport` nad pravim `output/<run>` Recepata izgleda pregledno.
- **Zavisnosti i mock:** A6 (`LogEntry`), A10 (logger), A14 (`agents.rescaled`), PD6.

### D18 — `runs/` i arhiviranje prolaza
- **Fajlovi:** `src/report/archive.ts` (izvoz iz `report/index.ts`: `archiveRun(runDir: string, runsDir: string, name: string): Promise<string>`), test, `runs/README.md`.
- **Šta radi:** kopira `output/<run>/` u `runs/<name>/` **bez** `node_modules`, `.expo`, `dist`, `web-build`, `staging/` (nacrti nisu dokaz) i bez fajlova većih od 5 MB; ponovo pravi `report.html` u kopiji. `runs/README.md` objašnjava šta je u svakom folderu i komandu `npm run verify -- runs/<x>`. Skripta u `package.json` (`archive`) je A-ov fajl, pa je predlažem A-u; do tada `npx tsx -e "import { archiveRun } from './src/report'; …"`.
- **Gotovo kad:** test nad tmp folderom sa lažnim `app/node_modules` → kopija ga nema; `runs/todomvc-<vreme>/` je commit-ovan (G2) i `verify` (B) prolazi nad njim; ukupna veličina `runs/` je ispod 20 MB.
- **Zavisnosti i mock:** B (`verify` mora raditi nad kopijom bez `node_modules`; ako treba `npm install` u `app/`, to piše u `runs/README.md`).

### D19 — Pun `README.md`
- **Fajlovi:** `README.md` (+ eventualno slika iz `docs/img/` ako postoji).
- **Šta radi:** README je 15 bodova sam po sebi, a „radi iz README-a“ još 25. Sekcije, redom:
  1. **Wemora** u jednoj rečenici + jedan screenshot `report.html`.
  2. **Problem i rešenje** (korisnost i originalnost, 30 bodova): web app → mobilna sa dokazom; po čemu se razlikuje od wrapper-a i AI generatora; „proizvod je dokaz, ne kod“.
  3. **Kako radi:** mermaid dijagram toka (analizatori → arhitekta → testeri ‖ builderi → Gatekeeper → izveštaj) i tabela statusa.
  4. **Mozaik** (30 bodova): paralelni agenti (koliko i zašto), deljena tabla `MigrationState`, događaji koji nose samo ID-jeve, `join`/`leave` za dinamički broj agenata, interception (`OwnershipGuard`), sopstveni `BudgetedRunner`; svaka tvrdnja sa linkom na fajl.
  5. **Brzi start (bez API ključa):** Node 22, `npm ci`, `npx playwright install chromium`, `npm run verify -- runs/recepti-<x>`, otvaranje `runs/recepti-<x>/report.html`, `npm run sabotage` + `verify` (mora da padne).
  6. **Pun prolaz:** `.env` sa `ANTHROPIC_API_KEY`, pokretanje mock-api, `npm run migrate -- examples/recepti --budget 3`, i `--mock` varijanta za $0.
  7. **Izlaz jednog prolaza:** stablo `output/<run-id>/` iz arch §7.
  8. **Ograničenja i van obima:** arch §15, ulazni profil, Android opciono.
  9. **Tim i licenca.**
  - Svaka komanda prekopirana iz terminala posle stvarnog pokretanja na čistom klonu. Windows napomene (Git Bash) gde treba.
- **Gotovo kad:** neko iz tima ko nije pisao README ga prati na čistom klonu i sve komande iz sekcija 5 i 6 rade.
- **Zavisnosti i mock:** svi (komande A i B, rezultati u `runs/`). Jezik: PD7.

### Kapija G3 (proverava B)
Moje stavke: `report.html` se otvara i prikazuje sve sekcije; **prva predaja**: `archiveRun` → `runs/recepti-<vreme>/`, commit, push, predaja na sajtu (zajedno sa timom).

---

## F4: Stabilizacija

### D20 — Crveni tim (cela faza)
- **Šta radi:**
  1. Novi folder van repoa, `git clone`, bez `.env`, bez globalnih paketa koje README ne pominje. Pratim **samo README**, korak po korak, kao žiri.
  2. Za svaki korak beležim: komanda, očekivano, dobijeno, vreme. Svaki korak koji ne radi ili nije jasan → issue vlasniku (`[redteam] <korak>: <šta>`, sa tačnim izlazom). Ako je problem u README-u, popravljam ga sam.
  3. Pustim `verify` i `sabotage` iz README-a; `verify` mora da prođe bez `ANTHROPIC_API_KEY` (`env -u ANTHROPIC_API_KEY …` u Git Bash-u).
  4. Pustim `migrate` nad TodoMVC-om iz README-a (sa `--mock`, i jednom pravi sa malim budžetom).
  5. Ponavljam posle svake popravke, dok ceo README ne prođe od početka do kraja.
- **Gotovo kad:** ceo README prolazi na čistom klonu bez ijednog ručnog koraka koji nije napisan.

### D21 — Rezervni plan *Wemora Lab* (samo ako < 4/5 ekrana dokazano)
- **Šta radi:** README menja fokus: analizatori, arhitekta, testeri i `verify` nad bilo kojom mobilnom verzijom (može i ručno napisanom); builderi su opcioni. Izveštaj već radi nad bilo kojim `results/`, pa se menja samo naslov i tekst objašnjenja. B i C prilagođavaju `verify` i Gatekeeper.
- **Gotovo kad:** README i izveštaj jasno kažu šta se dokazuje u Lab režimu, i komande rade.

### Kapija G4 = zaključavanje koda — proverava D
Na čistom klonu:
- [ ] README → sve komande rade (D20 prošao od početka do kraja)
- [ ] finalni prolazi nad Receptima i TodoMVC-om su u `runs/`
- [ ] `env -u ANTHROPIC_API_KEY npm run verify -- runs/<x>` prolazi za oba
- [ ] `git log -p | grep -i "sk-ant"` ne vraća ništa; `git log --all --name-only | grep -E "(^|/)\.env$|CLAUDE\.local\.md|settings\.local\.json"` ne vraća ništa
- [ ] `docs/status/*.md` svih ažurirani, `docs/decisions.md` ima sve odluke

---

## Pitanja za tim (moja)

Svako ima predlog, ali se ne menja ništa dok tim ne odluči.

- **PD1 (B). Izbor podataka za scenario.** `Scenario.apiFixture` postoji, ali nije rečeno kako se mock-api prebacuje. Predlog: `POST /__fixture { name }` pre scenarija (D3), a `runScenarios` ga zove kad `apiFixture` postoji, i vraća na `default` posle.
- **PD2 (A). Neuspeo plan.** Nema događaja za „arhitekta nije uspela“, a bez toga Conductor čeka zauvek. Predlog: novi događaj `plan.failed {}` (promena ugovora), ili Conductor posle `assign` arhitekti čeka `plan.ready` sa timeout-om i čita `plan.errors.json`.
- **PD3 (C). Navigacija i `src/app/_layout.tsx`.** Bočni meni postaje tab navigacija, a to je fajl Expo Routera koji pravi scaffold. Da li ga zajednička jedinica `layout` sme da menja (njen `writes`), ili ga scaffold pravi konačno iz `routeMap`?
- **PD4 (C). Oblik `writes`.** Test ugovora koristi `src/screens/<id>/`, pa važi: putanje relativne u odnosu na `app/`, ekran `src/screens/<id>/`, zajednička `src/shared/<id>/` (+ `src/app/_layout.tsx` za `layout` ako PD3 kaže da). C samo treba da potvrdi. `validatePlan` pravilo 9 i `normalizePlan` prate odluku.
- **PD5 (A, B, C). Ko pokreće original.** Tester i `validateScenario` trebaju URL pokrenutog originala, a `migrate` treba i mock-api. Nigde nije rečeno ko pokreće `npm run dev` ulazne aplikacije i mock-api. Predlog: Conductor (A) pre testera, preko male domenske funkcije `serveOriginal(webDir)` u `scenarios/` (B), sa komandom iz `package.json` ulazne aplikacije.
- **PD6 (A). Imena u `run.jsonl` za izveštaj.** Treba mi potvrda da logger piše Mozaik događaje `message_received.started` i `model.answer` sa `agent = producerId`, i ime za promenu broja agenata (`agents.rescaled`?) sa poljem `reason`.
- **PD7 (svi). Jezik README-a i izveštaja.** Predlog: README na engleskom (žiri + Mozaik zajednica), sa kratkim rezimeom na srpskom; izveštaj na srpskom.
- **PD8 (A, C). Parser zavisnost.** Predlog: samo `@babel/parser` u root `package.json` (koristimo ga i ja i C), bez `@babel/traverse` i bez ts-morph.
- **PD9 (A). Gde su MockRunner odgovori** (isto kao P13 u a.md).
- **PD10 (B). TodoMVC i hash rute.** Ako TodoMVC koristi `HashRouter` sa rutom `*` i filterima `#/active`, `goto` u testovima mora da radi sa hash adresama, a Expo strana nema hash. Predlog: TodoMVC je jedan ekran (`*` → `/`), a filteri se testiraju tapom na link „Active“, ne preko `goto`.
