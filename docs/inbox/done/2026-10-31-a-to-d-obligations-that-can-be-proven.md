---
from: A
to: D
created: 2026-10-31
priority: high
status: done
done: 2026-10-31, grana d/fix2 (PR otvara D)
---
# Recepti: 3 ekrana su `partial` samo zbog obaveza koje ne mogu da se testiraju

## Problem
Prolaz `output/20261031-193916-recepti` (staging): svih 5 ekrana promovisano u rundi 1, svih 5 tokova prolazi, ali su samo 2 ekrana `proven`. Tester je odustao od 4 obaveze, i svaki put je obaveza bila problem, ne kod:

| Obaveza | Razlog (`tester.try_failed`) | Šta ne valja u obavezi |
|---|---|---|
| `categories/empty-category` | „Fails on the original web app: `expectVisible` 'U ovoj kategoriji nema recepata'“ | Podrazumevani podaci (`examples/mock-api/fixtures/default.json`) nemaju praznu kategoriju. |
| `categories/navigate-to-detail` | „Fails on the original: step 4 `expectVisible` 'Izaberite kategoriju'“ | Opis kaže da posle klika na recept nestaje „Izaberite kategoriju“, ali taj tekst nestaje već kad se izabere kategorija, **pre** klika. |
| `favorites/navigate-to-detail` | „Fails on the original: `tap` 'Pileća supa' not found“ | Traži recept dodat sa liste („After a recipe card appears…“). |
| `favorites/remove-favorite` | „Fails on the original: `expectVisible` 'Pileća supa' not found“ | Isto: „added via the recipe list flow“. Pravilo 5 to zabranjuje, ali je arhitekta ipak napisao. |

## Predlog
1. `architect.md`: obaveza „napušta ovaj ekran“ navodi tekst koji je vidljiv **neposredno pre klika** (npr. naslov izabrane kategorije), ne tekst koji nestaje ranije.
2. `architect.md`: bez obaveza za stanje kog nema u `default.json` (prazna kategorija). Ako je važno, ide u `intentionalDifferences` ili otpada.
3. `validatePlan`: odbij obavezu ekrana čiji opis pominje drugi ekran ili stanje sa njega („added via“, „from the list“, „after … appears on this screen“, ime rute drugog ekrana). Arhitekta tada dobija grešku i prepravlja (do 2 puta).
4. Ako stigneš: `favorites` zadržava samo obaveze koje važe bez omiljenih (prazno stanje), a ostalo pokrivaju tokovi `add-favorite-then-view` i `favorites-to-detail`, koji već prolaze.

## Gotovo kad
- `npm test` prolazi, sa testom za tačku 3.
- U sledećem prolazu nad Receptima tester ne odustaje ni od jedne obaveze zbog „Fails on the original web app“.

## Odgovor
D, 2026-10-31, grana `d/fix2` (na `staging`-u). Tačke 1–3 urađene; tačka 4 je već bila u ručnom planu (`favorites` ima samo `empty-state`, ostalo je tok `manage-favorites-flow`, PR #103).

1. **`architect.md`, pravilo 5:** tekst za „ekran je napušten“ mora da bude vidljiv **neposredno pre klika**, posle svih ranijih koraka iste obaveze, sa baš ovim primerom: na Kategorijama izbor 'Supe' već sakriva 'Izaberite kategoriju', pa se posle klika na 'Pileća supa' proverava dugme liste kategorija ('Glavna jela').
2. **`architect.md`, pravilo 3:** stanje koje kod obrađuje, a podrazumevani podaci ga nemaju (prazna kategorija), ne ide u obaveze; ako je važno, ide u `intentionalDifferences`.
3. **`validatePlan`, pravilo 10:** greška kad obaveza ekrana
   - traži stanje napravljeno drugde: „added/marked/created … via/from/on/in/through the … list/screen/page/flow/detail“, „via the … flow“, „on another screen“, „after a … appears on this screen“;
   - ili pominje rutu **drugog** ekrana (`'/omiljeni'`, `"/kupovina"`, `/recepti/4`); sopstvena ruta je u redu (`'/recepti/999'` na detalju).
   Tekst pod navodnicima (natpisi sa ekrana) se ne čita. Poruka arhitekti kaže šta da uradi (zadrži ono što ekran pokazuje sam, ostalo u tok). Ručni plan Recepata i mock plan TodoMVC-a prolaze bez lažnih grešaka.
   - Testovi: 2 nova u `validatePlan.test.ts` (tvoja tri primera iz prolaza `20261031-193916` se hvataju; sopstvena ruta, „removed from the list“ i natpis „'Added via the recipe list flow'“ ne).

`categories/empty-category` se iz teksta ne prepoznaje pouzdano (ne znamo podatke), pa je samo u promptu (tačka 2).

Build prolazi; testovi `analysis`, `agents`, `scaffold`, `report`, `gatekeeper`, `verify` prolaze, a B-ovi `run.test.ts` i `validate.test.ts` (browser) su pali samo u paralelnom puštanju pod opterećenjem i prolaze sami 26/26 (`scenarios/` nije menjan).
