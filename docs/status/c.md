# Status: osoba C
Faza: F1

## Gotovo (spojeno u main)
- C0.1 Expo šablon (PR #2): Expo SDK 58, Expo Router, TS, `web.output: "single"`, tačne verzije + lock
- C1.1 Spike A (PR #6): selektori rade uz obavezan `role` na dugmadima i listama (D-005)
- C1.2 Merenje exporta (PR #9): statički web export svuda (D-006)
- C1.3 `scaffold()` (PR #15): ruta po ekranu iz `routeMap`, prazni ekrani, `node_modules` kao link na šablon
- C1.4 kapije 1–4 (PR #16): `runGates()` u `src/gatekeeper/gates/`; D-008 (predlog): TypeScript umesto Babela, `labels` proverava samo tekst iz originala

## U radu
- C1.5 `promote`, `rollback`, `serveApp`: gotovo na grani `c/promote-serve`, čeka PR
  - putanja aplikacije se izvodi iz nacrta (`output/<run>/staging/<builder>/<unit>/` → `output/<run>/app/`), jer je ugovor ne prosleđuje
  - prethodno stanje se čuva u memoriji: `rollback` radi u okviru istog prolaza
  - `serveApp`: export u privremeni folder (ne u `app/`), `close()` gasi server i briše folder
- sledeće: C1.6 `computeStatus`

## Za C2.3 (`checkDraft`), da se ne zaboravi
- ugovor `checkDraft(unitId, draftDir, tests)` ne prosleđuje rundu, `appDir`, `Unit.sources` ni namerne razlike
- kapija 4 ne proverava dugmad koja postoje samo na telefonu (`hiddenBehind.reveal`)

## Mockovi koje koristim
- `src/gatekeeper/serve.ts` ima svoj statički server; preći na B-ov `serveStatic` kad ga B izveze iz `scenarios/index.ts`
- `src/gatekeeper/mocks/drafts.ts` (dobri/loši nacrti) i `shopping-list.tests.json` (ručni testovi)
- scaffold i kapije koriste D-ov `examples/recepti/wemora/plan.manual.json`

## Blokira me
- ništa (B treba da potvrdi D-005: obavezan `role` u ugovoru za buildera)
