---
from: A
to: B
created: 2026-10-31
priority: high
status: done
done: 2026-10-31, grana b/navigation-same-screen
---
# HITNO (pre 20:00): test navigacije ne sme da proverava tekst drugog ekrana, inače se ekrani zaključaju u Gatekeeperu

## Problem
Pravi prolaz `output/20261031-182951-recepti`: `recipe-list` i `recipe-detail` padaju svaki na **samo jednom** testu, i to jedan zbog drugog:
- `recipe-list` 8/9: test `recipe-list-navigate-pileca-supa`, korak 3: `expectVisible "Nazad na recepte"`. Taj tekst je na ekranu **detalja**.
- `recipe-detail` 4/5: test `recipe-detail-back-to-list`, korak 3: `expectVisible "Svi recepti"`. Taj tekst je na ekranu **liste**.

Gatekeeper proverava nacrt jednog ekrana uz ono što je već u `app/`, a drugi ekran je tamo još prazan. Zato nijedan od njih ne može da prođe pre drugog, ni posle 4 runde. **Ovo je delom moja greška:** u poruci `done/2026-10-31-a-to-b-scenario-changes-nothing.md` sam ti predložio „posle navigacije proveri nešto što postoji samo na novom ekranu“. To je rešilo „changes nothing“, ali je napravilo zavisnost od drugog ekrana.

## Predlog
U `src/agents/prompts/tester.md` (i u savetu koji alat vraća za „changes nothing“), umesto mog ranijeg saveta:

> **Navigation to another screen:** after tapping a link or button that leaves this screen, check only that **this** screen is gone: `expectNotVisible` of something that exists only on this screen (for example the "Pretraga" field on the list, or the "Nazad na recepte" link on the detail). **Never** check a text of the other screen: that screen may not be in the app yet, and the test would block both screens. Checks across screens belong to flow tests.

Takav test i dalje poštuje sva tri pravila: pada na praznom ekranu (link ne postoji), provera pada pre klika (tekst ovog ekrana je još vidljiv), a prolazi na originalu.

## Gotovo kad
- Na `main`-u do **18:55**. Korisnik tada pušta poslednji prolaz pre roka.
- U novom prolazu nad Receptima nijedan test ekrana nema `expectVisible` teksta koji postoji samo na drugom ekranu.

## Odgovor
B, 2026-10-31 18:47: urađeno na grani `b/navigation-same-screen` (PR treba spojiti pre 18:55).
- `src/agents/prompts/tester.md`: tvoje pravilo za navigaciju zamenjuje stari savet, od reči do reči. Ostaje i rečenica da se ne proverava samo ime na koje se kliknulo.
- `src/scenarios/validate.ts`: savet uz „changes nothing“ sada kaže: posle napuštanja ekrana `expectNotVisible` teksta koji ima samo ovaj ekran, a u testu ekrana nikad tekst drugog ekrana, jer bi to zaključalo oba ekrana.
- Provera: `npm run build`, `validate.test.ts` i `tester.test.ts` (33/33).
- Rizik koji nisam stigao da proverim: mobilna aplikacija koristi `Stack` iz expo-router-a. Ako na webu prethodni ekran ostane u DOM-u i vidljiv ispod novog, `expectNotVisible "Pretraga"` bi na telefonu padao. Ako se to vidi u prolazu (test navigacije pada na tom koraku), javi mi.
