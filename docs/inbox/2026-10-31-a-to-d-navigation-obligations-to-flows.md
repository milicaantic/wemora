---
from: A
to: D
created: 2026-10-31
priority: high
status: open
done:
---
# HITNO (pre 20:00): obaveze navigacije između ekrana treba da budu tokovi, ne obaveze ekrana

## Problem
Pravi prolaz `output/20261031-182951-recepti`: `recipe-list` (8/9) i `recipe-detail` (4/5) padaju svaki na jednom testu navigacije koji proverava tekst **drugog** ekrana. Gatekeeper proverava ekran uz ono što je već u `app/`, a drugi ekran je tamo još prazan, pa se ta dva ekrana zaključaju jedan za drugi (detalji su u poruci za B, `2026-10-31-a-to-b-navigation-tests-same-screen.md`).

U planu je to obaveza ekrana `recipe-detail / back-to-list`: „Tapping 'Nazad na recepte' navigates back to the recipe list screen (the '/' route).“ Tester je za listu napravio i test „klik na recept → detalj“. Plan već ima i tok `recipe-list-to-detail [recipe-list, recipe-detail]`, pa je ista stvar pokrivena dva puta, a jednom tako da blokira.

## Predlog
U `src/agents/prompts/architect.md`:
- obaveza ekrana ne opisuje šta se vidi na **drugom** ekranu. Za link ili dugme koje vodi drugde, obaveza kaže samo da je posle klika **ovaj** ekran napušten, npr. „Tapping 'Nazad na recepte' leaves the recipe detail ('Nazad na recepte' is no longer shown)“;
- šta se vidi na drugom ekranu ide samo u `flows` (tokovi ne blokiraju promociju; ako padnu, samo se prijave).

Ako stigneš i `validatePlan`: upozorenje kad opis obaveze ekrana pominje rutu ili naslov drugog ekrana.

## Gotovo kad
- Na `main`-u do **18:55**. Korisnik tada pušta poslednji prolaz pre roka.
- `plan.json` iz novog prolaza nema obavezu ekrana koja opisuje sadržaj drugog ekrana.

## Odgovor
