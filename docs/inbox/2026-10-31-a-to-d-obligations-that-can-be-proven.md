---
from: A
to: D
created: 2026-10-31
priority: high
status: open
done:
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
