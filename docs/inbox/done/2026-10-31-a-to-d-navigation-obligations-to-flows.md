---
from: A
to: D
created: 2026-10-31
priority: high
status: done
done: 2026-10-31 18:48, grana d/navigation-flows (PR otvara D)
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
D, 2026-10-31 18:48, grana `d/navigation-flows`.

- **`prompts/architect.md`**, pravilo 5 („Navigation: say only that this screen is left“): obaveza ekrana nikad ne pominje tekst, naslov ni rutu drugog ekrana; za link/dugme koje vodi drugde kaže samo da tekst koji postoji samo na ovom ekranu više nije prikazan („Tapping 'Nazad na recepte' leaves the detail ('Nazad na recepte' is no longer shown)“); šta drugi ekran pokaže ide u `flows`. Zabranjeno „navigates to / opens the … screen / goes back to“.
- **`validatePlan`** (pravilo 10): greška za „navigates (back) to“, „goes/returns/takes … to the“, „opens the … screen/page“ u opisu obaveze, sa porukom kako da se ispravi (ovaj ekran napušten + tok). Greška, ne upozorenje, jer upozorenje arhitekta ne vidi; tekst pod navodnicima se ne čita, pa natpisi na ekranu ne smetaju. Plan `back-to-list` iz `output/20261031-182951-recepti` bi sada bio vraćen arhitekti.
- **Ručni i mock plan Recepata:** `recipe-list/open-detail` („… leaves the list: the field 'Pretraga' is no longer shown“), `categories/open-recipe` („… 'Glavna jela' is no longer shown“); nov tok `open-recipe-flow` (lista → detalj 'Porcije: 8', kategorije → detalj). `validatePlan` = `[]`.
- Test: 1 nov. Build i testovi za `analysis`, `agents`, `scenarios` prolaze (284).
