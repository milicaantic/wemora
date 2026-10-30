# Ručni plan za Recepte

`plan.manual.json` je ručno napisan `Plan` (`src/contracts/types.ts`) za `examples/recepti`. Pravi plan pravi agent arhitekta tokom `migrate`. Ovaj fajl služi kao:

- **fixture za C:** `scaffold()` u kapiji G1 (`docs/tim-plan.md` §5);
- **izvor ID-jeva obaveza za B:** `Scenario.obligation` je `Obligation.id` iz ovog plana, a `Scenario.unitId` je `id` jedinice;
- **očekivanje za D:** test za `validatePlan` (D8) i poređenje sa planom arhitekte (D16);
- **primer** za prompt arhitekte.

Prolazi `PlanSchema`. Kad stigne `validatePlan`, proverava se i nad pravim `parseApp("examples/recepti")`.

## Jedinice

| Jedinica | Vrsta | Talas | Ruta | Zavisi od | Izvorni fajlovi | Tokeni |
|---|---|---|---|---|---|---|
| `data` | shared | 0 | — | — | `src/api/*`, `src/store/*`, `src/format.ts` | 1445 |
| `layout` | shared | 0 | — | `data` | `src/App.tsx`, `src/main.tsx`, `src/components/*` | 1194 |
| `recipe-list` | screen | 1 | `/` | `data`, `layout` | `src/pages/RecipeListPage.*` | 1390 |
| `recipe-detail` | screen | 1 | `/recepti/:id` | `data`, `layout` | `src/pages/RecipeDetailPage.*` | 1043 |
| `categories` | screen | 1 | `/kategorije` | `data`, `layout` | `src/pages/CategoriesPage.*` | 812 |
| `favorites` | screen | 1 | `/omiljeni` | `data`, `layout` | `src/pages/FavoritesPage.*` | 453 |
| `shopping-list` | screen | 1 | `/kupovina` | `data` | `src/pages/ShoppingListPage.*` | 758 |

- Svaki od 23 fajla u `src/` pripada tačno jednoj jedinici.
- `size` je `ceil(znakovi / 4)` po fajlu, sa krajevima linija normalizovanim na `\n` (isto pravilo koristi parser).
- `writes` su relativne u odnosu na `app/`: `src/screens/<id>/` za ekrane, `src/shared/<id>/` za zajedničke jedinice (raspored iz C-ovog šablona).
- `layout` zavisi od `data`, jer `FavoriteButton` koristi skladište omiljenih. Obe su u talasu 0; red zadataka ih radi redom po `dependsOn`.
- `shopping-list` ne koristi nijednu komponentu, pa zavisi samo od `data`.

## Obaveze (ID-jevi za `Scenario.obligation`)

| Jedinica | Obaveze |
|---|---|
| `recipe-list` | `shows-recipes`, `search-by-name`, `filter-by-category`, `sort-by-time`, `toggle-favorite`, `open-detail` |
| `recipe-detail` | `shows-recipe`, `scale-servings`, `toggle-favorite`, `add-to-shopping-list`, `not-found` |
| `categories` | `pick-category`, `open-recipe` |
| `favorites` | `empty-state`, `shows-favorites`, `remove-favorite` |
| `shopping-list` | `empty-state`, `add-item`, `mark-bought`, `clear-bought` |

Opisi obaveza navode tačan tekst sa ekrana, sa podacima iz `examples/mock-api` (fixture `default`).

## Namerne razlike (samo `recipe-list`)

- `hiddenBehind`: dugmad kategorija (`Sve kategorije`, `Supe`, `Glavna jela`, `Salate`, `Deserti`) su na telefonu iza dugmeta `Filteri`. Prevodilac testova ubacuje `tap Filteri` pre koraka koji ih koristi.
- `movedTo`: kolona kalorija ide na detalj recepta (`recipe-detail` već prikazuje „520 kcal po porciji“).
- `notPortable`: tooltip sa sastojcima se pojavljuje samo na hover.

## Tokovi

- `favorite-flow`: `recipe-detail` → `favorites`
- `shopping-flow`: `recipe-detail` → `shopping-list`

## Otvoreno

- Navigacija (bočni meni → tabovi na telefonu) zahteva izmenu `src/app/_layout.tsx`, a taj fajl pravi C-ov scaffold. Dok C ne odluči (PD3), `layout.writes` sadrži samo `src/shared/layout/`.
