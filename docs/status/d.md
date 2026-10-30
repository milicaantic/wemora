# Status: osoba D
Faza: F1
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

## Gotovo, čeka spajanje (grana `d/parser`)
- D6: `parseApp(webDir)` u `src/analysis/` (`parse.ts`, `source.ts`, `imports.ts`, `routes.ts`, `webApis.ts`, `errors.ts`). Proverava `package.json` (Next.js, bez Reacta, bez rutera, React Router 5 → `UnsupportedInputError` sa kodom), parsira sve `.js/.jsx/.ts/.tsx` iz `src/`, pravi graf uvoza (i CSS), nalazi rute iz JSX `<Route>` i iz `createBrowserRouter`/`useRoutes` (ugnežđivanje, `index`, layout rute, `Navigate`, `Suspense`, `lazy`), deli fajlove na ekrane i zajedničke, beleži web API-je po ekranu i broji tokene (`ceil(znakovi/4)`, LF). Bez nove zavisnosti: koristi `typescript` (predlog odluke D-007).
  - Recepti: 5 ruta, isti fajlovi i iste veličine kao `plan.manual.json` (test to proverava). TodoMVC: jedna ruta `*`, 9 fajlova, `src/index.js` zajednički.
  - 27 testova u `src/analysis/parse.test.ts` nad oba primera i 9 malih fixture aplikacija u `src/analysis/mocks/` (`.jsx`, pa ih root `tsc` i provera slojeva ne čitaju).
  - `parts` je za sada jedan deo sa svim rutama; `splitParts` dolazi u D7.
  - Ograničenja: ugnežđeni `<Routes>` unutar komponenti ekrana se ne prate; web API-ji iz zajedničkih fajlova nisu ni na jednoj ruti (ugovor nema polje za njih; analizator ih vidi čitanjem fajlova).

## U radu
- ništa

## Sledeće
- D7: `splitParts` (ista grana)
- D8: `validatePlan`, sa testom nad `plan.manual.json`

## Za B i C
- **B:** ID-jevi obaveza za ručne scenarije Recepata su u `examples/recepti/wemora/README.md` (npr. `recipe-list` / `search-by-name`).
- **C:** `examples/recepti/wemora/plan.manual.json` je fixture za `scaffold()` (G1). `writes` su `src/screens/<id>/` i `src/shared/<id>/`. Otvoreno: ko menja `src/app/_layout.tsx` za navigaciju (PD3).

## Odgovor za B
- **Q1 (`apiFixture`):** `runScenarios` pre scenarija zove `POST /__fixture` sa `scenario.apiFixture ?? "default"`, a posle prolaza `POST /__reset`. Podaci su samo za čitanje, pa je izbor fixture-a jedino stanje servera i dva puštanja zaredom vide iste podatke. Adresa mock-api-ja treba B-u kao parametar; to je deo B-ovog Q8 (URL-ovi u `RunConfig`).

## Mockovi koje koristim
- nijedan

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
