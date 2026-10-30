# Status: osoba C
Faza: F1

## Gotovo (spojeno u main)
- C0.1 Expo šablon (PR #2): Expo SDK 58, Expo Router, TS, `web.output: "single"`, tačne verzije + lock
- C1.1 Spike A (PR #6): selektori rade uz obavezan `role` na dugmadima i listama (D-005)

## U radu
- C1.2 Merenje exporta: gotovo na grani `c/export-measure`, čeka PR
  - odluka D-006: statički web export svuda (~6 s posle izmene jednog ekrana, ~50 s prvi put)
  - skripta: `npx tsx templates/spike-a/measure.ts`
- sledeće: C1.3 `scaffold/`

## Mockovi koje koristim
- nema

## Blokira me
- ništa (B treba da potvrdi D-005: obavezan `role` u ugovoru za buildera)
