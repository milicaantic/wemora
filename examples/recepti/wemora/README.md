# Ručni plan za Recepte

`plan.manual.json` je ručno napisan `Plan` (`src/contracts/types.ts`) za `examples/recepti`. Pravi plan pravi agent arhitekta tokom `migrate`. Ovaj fajl služi kao:

- **fixture za C:** `scaffold()` u kapiji G1 (`docs/tim-plan.md` §5);
- **izvor ID-jeva obaveza za B:** `Scenario.obligation` je `Obligation.id` iz ovog plana, a `Scenario.unitId` je `id` jedinice;
- **očekivanje za D:** test za `validatePlan` (D8) i poređenje sa planom arhitekte (D16);
- **primer** za prompt arhitekte.

Prolazi `PlanSchema` i `validatePlan` nad pravim `parseApp("examples/recepti")` (test u `src/analysis/validatePlan.test.ts`).

## Jedinice

| Jedinica | Vrsta | Talas | Ruta | Zavisi od | Izvorni fajlovi | Tokeni |
|---|---|---|---|---|---|---|
| `theme` | shared | 0 | — | — | `src/components/Layout.css` (globalna pravila: `*`, `body`, `a`, `button`) | 305 |
| `data` | shared | 0 | — | `theme` | `src/api/*`, `src/store/*`, `src/format.ts` | 1445 |
| `layout` | shared | 0 | — | `data`, `theme` | `src/App.tsx`, `src/main.tsx`, `src/components/*` osim `Layout.css` | 889 |
| `recipe-list` | screen | 1 | `/` | `data`, `layout`, `theme` | `src/pages/RecipeListPage.*` | 1390 |
| `recipe-detail` | screen | 1 | `/recepti/:id` | `data`, `layout`, `theme` | `src/pages/RecipeDetailPage.*` | 1043 |
| `categories` | screen | 1 | `/kategorije` | `data`, `layout`, `theme` | `src/pages/CategoriesPage.*` | 812 |
| `favorites` | screen | 1 | `/omiljeni` | `data`, `layout`, `theme` | `src/pages/FavoritesPage.*` | 453 |
| `shopping-list` | screen | 1 | `/kupovina` | `data`, `theme` | `src/pages/ShoppingListPage.*` | 758 |

- Svaki od 23 fajla u `src/` pripada tačno jednoj jedinici.
- `size` je `ceil(znakovi / 4)` po fajlu, sa krajevima linija normalizovanim na `\n` (isto pravilo koristi parser).
- `writes` su relativne u odnosu na `app/`: `src/screens/<id>/` za ekrane, `src/shared/<id>/` za zajedničke jedinice (raspored iz C-ovog šablona).
- `theme` (D-027) prenosi font, veličine i boje sa weba: dobija globalni CSS (`Layout.css` ima pravila za `*`, `body`, `a`, `button`; u njemu je i bočni meni, ali fajl pripada temi, a builder `layout`-a ga i dalje može čitati jer zavisi od teme). Sve ostale jedinice zavise od `theme`; `normalizePlan` to dodaje sam kad tema postoji.
- `layout` zavisi od `data`, jer `FavoriteButton` koristi skladište omiljenih. Sve tri zajedničke jedinice su u talasu 0; red zadataka ih radi redom po `dependsOn` (`theme`, pa `data`, pa `layout`).
- `shopping-list` ne koristi nijednu komponentu, pa zavisi samo od `data` (i od `theme`, kao svi).

## Obaveze (ID-jevi za `Scenario.obligation`)

| Jedinica | Obaveze |
|---|---|
| `recipe-list` | `shows-recipes`, `search-by-name`, `filter-by-category`, `toggle-favorite`, `open-detail` |
| `recipe-detail` | `shows-recipe`, `scale-servings`, `toggle-favorite`, `add-to-shopping-list`, `not-found` |
| `categories` | `pick-category`, `open-recipe` |
| `favorites` | `empty-state` (dodavanje i uklanjanje omiljenih traži recept dodat na listi, pa je u toku `manage-favorites-flow`) |
| `shopping-list` | `empty-state`, `add-item`, `mark-bought`, `clear-bought` |

Opisi obaveza navode tačan tekst sa ekrana, sa podacima iz `examples/mock-api` (fixture `default`). Svaka obaveza se proverava DSL koracima na originalu: posle radnje se neki tekst pojavi ili nestane; nema redosleda ni brojanja; rezultat je na istom ekranu (inače je tok). Zato nema obaveze za sortiranje: „Sortiraj po vremenu“ menja samo redosled, pa je `notPortable` (inbox A → D, G3).

## Namerne razlike (samo `recipe-list`)

- `hiddenBehind`: dugmad kategorija (`Sve kategorije`, `Supe`, `Glavna jela`, `Salate`, `Deserti`) su na telefonu iza dugmeta `Filteri`. Prevodilac testova ubacuje `tap Filteri` pre koraka koji ih koristi.
- `movedTo`: kolona kalorija ide na detalj recepta (`recipe-detail` već prikazuje „520 kcal po porciji“).
- `notPortable`: tooltip sa sastojcima se pojavljuje samo na hover; dugme `Sortiraj po vremenu` menja samo redosled recepata, a test ne može da proveri redosled.

## Tokovi

- `favorite-flow`: `recipe-detail` → `favorites`
- `manage-favorites-flow`: `recipe-list` → `favorites` (dodaj „Sarma“ na listi, vidi je u Omiljenim, ukloni je)
- `open-recipe-flow`: `recipe-list` i `categories` → `recipe-detail` (šta detalj pokaže posle klika na recept)
- `shopping-flow`: `recipe-detail` → `shopping-list`

## Otvoreno

- Navigacija (bočni meni → tabovi na telefonu) zahteva izmenu `src/app/_layout.tsx`, a taj fajl pravi C-ov scaffold. Dok C ne odluči (PD3), `layout.writes` sadrži samo `src/shared/layout/`.
