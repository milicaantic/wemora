# Status: osoba C
Faza: F1

## Gotovo (spojeno u main)
- C0.1 Expo šablon (PR #2): Expo SDK 58, Expo Router, TS, `web.output: "single"`, tačne verzije + lock
- C1.1 Spike A (PR #6): selektori rade uz obavezan `role` na dugmadima i listama (D-005)
- C1.2 Merenje exporta (PR #9): statički web export svuda (D-006)
- C1.3 `scaffold()` (PR #15): ruta po ekranu iz `routeMap`, prazni ekrani, `node_modules` kao link na šablon
- C1.5 `promote`, `rollback`, `serveApp` (PR #18): putanja aplikacije iz rasporeda foldera, prethodno stanje u memoriji, export u privremeni folder
- C1.6 `computeStatus` (PR #19); **za A:** `roundsExhausted` ne menja status
- `serveApp` koristi B-ov `serveStatic` (PR #21)
- C1.4 kapije 1–4 (PR #16): `runGates()` u `src/gatekeeper/gates/`; D-008 (predlog): TypeScript umesto Babela, `labels` proverava samo tekst iz originala

## U radu
- Kapija G1, zajednički test sa B: gotovo na grani `c/g1-joint-test`, čeka PR
  - `src/gatekeeper/g1.test.ts`: scaffold Recepti → ručni ekran liste za kupovinu prolazi kapije 1–4 → promote → `serveApp` → B-ov `add-item.json` preko `runScenarios` (390×844) prolazi; nad praznim ekranom pada
  - nađen i popravljen bug (D-009): zajednički Metro keš je davao aplikaciju bez ruta; sada svaka aplikacija ima svoj keš (`templates/expo/metro.config.js`)
  - `npm test` sada traje ~2,5 min (jedan hladan export)
- sledeće: F2 (C2.1 promptovi), posle kapije G1

## Za C2.3 (`checkDraft`), da se ne zaboravi
- ugovor `checkDraft(unitId, draftDir, tests)` ne prosleđuje rundu, `appDir`, `Unit.sources` ni namerne razlike
- kapija 4 ne proverava dugmad koja postoje samo na telefonu (`hiddenBehind.reveal`)

## Mockovi koje koristim
- `src/gatekeeper/mocks/drafts.ts` (dobri/loši nacrti) i `shopping-list.tests.json` (ručni testovi)
- scaffold i kapije koriste D-ov `examples/recepti/wemora/plan.manual.json`

## Blokira me
- ništa (B treba da potvrdi D-005: obavezan `role` u ugovoru za buildera)
