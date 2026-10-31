---
from: A
to: D
created: 2026-10-31
priority: normal
status: open
done:
---
# Izmene A-a u tvojim fajlovima danas, i zadaci za D posle predaje

> Ništa ne menjaj pre ponoći: kod je zaključan. Pre izmene povuci `staging`.

## Šta je A danas menjao kod tebe (uz korisnikovo odobrenje, pregledaj)
- `src/analysis/validatePlan.ts` (`de4111a`): pravilo za navigaciju je suženo. Odbija samo obavezu koja vodi na **drugi** ekran, stranu ili listu, a ne obavezu koja otvara sopstvenu rutu (npr. „Navigating to a non-existent recipe (/recepti/9999)…“). Test u `validatePlan.test.ts`.
- `src/agents/architect.ts` (`ea3f57b`): `salvagePlan`. Kad i posle poslednjeg pokušaja `validatePlan` odbija samo obaveze (druge ekrane, stanje sa drugog ekrana) ili `movedTo` razlike, plan se prihvata bez njih, a log dobija `plan.salvaged` sa spiskom izbačenog. Svaka druga greška i dalje znači `plan.failed`. Test u `architect.test.ts`.
- `README.md` i `docs/img/`: sve pokazuje na novi prolaz `runs/recepti-20261031-2148` (4/5 proven, 6/7 tokova, 14 min, $0.88). Tri slike su napravljene iz novog izveštaja, a stari `runs/recepti-20261031-1829` je obrisan. Otvorena poruka `2026-10-31-a-to-d-readme-restructure.md` i dalje važi.

## Zadaci posle predaje

### 1. Obaveza koju podaci ne mogu da pokažu
- **Problem:** `categories` je `partial` samo zbog obaveze `empty-category` („kategorija bez recepata“). U `examples/mock-api/fixtures/default.json` svaka kategorija ima 3 recepta, pa prazna kategorija ne postoji i tester je 3 puta pao na originalu.
- **Predlog:** analizator ili arhitekta dobija kratak pregled podataka (broj stavki po kategoriji ili prve stavke iz API-ja), pa ne pravi obavezu za stanje koje podaci ne mogu da pokažu. Druga opcija je da se takva obaveza označi u planu kao „zavisi od podataka“, a izveštaj je ne računa u `partial`.
- **Gotovo kad:** novi prolaz nad Receptima nema obavezu `empty-category` ili je ona jasno označena.

### 2. Izveštaj da pokaže tokove uz ekrane
- **Problem:** `favorites` je `proven` sa samo 1 obavezom (prazno stanje), jer je `validatePlan` ponašanje „dodaj i ukloni omiljeni“ premestio u tokove (`add-favorite-from-list`, `remove-favorite`, `favorites-to-detail`; svi prolaze). Ko gleda samo karticu ekrana, vidi tanak dokaz.
- **Predlog:** na kartici ekrana u `report.html` dodati red „Tokovi kroz ovaj ekran: 3/3 prolaze“ sa linkom na deo o tokovima.
- **Gotovo kad:** kartica `favorites` u izveštaju pokazuje svoje tokove.

### 3. Engleski tekst u pravilima `validatePlan`
- **Napomena:** pravila za navigaciju i stanje sa drugog ekrana prepoznaju engleske formulacije arhitekte. Na drugoj aplikaciji mogu da propuste ili lažno upozore, pa je `salvagePlan` zato rezerva. Ako stigneš, dodaj testove sa još nekoliko formulacija (npr. „opens the list“, „after adding on the list“).

## Odgovor
