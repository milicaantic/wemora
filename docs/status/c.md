# Status: osoba C
Faza: F1

## Gotovo (spojeno u main)
- C0.1 Expo šablon (PR #2): Expo SDK 58, Expo Router, TS, `web.output: "single"`, tačne verzije + lock
- C1.1 Spike A (PR #6): selektori rade uz obavezan `role` na dugmadima i listama (D-005)
- C1.2 Merenje exporta (PR #9): statički web export svuda (D-006)

## U radu
- C1.3 `scaffold()`: na grani `c/scaffold` (pushovano), čeka PR
- C1.4 kapije 1–4: gotovo na grani `c/gates` (napravljena od `c/scaffold`), čeka PR
  - `src/gatekeeper/gates/`: `runGates()` pušta parse → forbiddenApis → tsc → labels, staje na prvoj grešci
  - odluka D-008 (predlog): TypeScript umesto Babela; `labels` proverava samo tekst koji postoji u originalu
  - testovi kapija 3–4 traže `npm install` u `templates/expo` (inače se preskaču); traju ~25 s
- sledeće: C1.5 `promote`, `rollback`, `serveApp`

## Mockovi koje koristim
- `src/gatekeeper/mocks/drafts.ts` (dobri/loši nacrti) i `shopping-list.tests.json` (ručni testovi)
- scaffold i kapije koriste D-ov `examples/recepti/wemora/plan.manual.json`

## Blokira me
- ništa (B treba da potvrdi D-005: obavezan `role` u ugovoru za buildera)
