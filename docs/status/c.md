# Status: osoba C
Faza: F1

## Gotovo (spojeno u main)
- C0.1 Expo šablon (PR #2): Expo SDK 58, Expo Router, TS, `web.output: "single"`, tačne verzije + lock

## U radu
- C1.1 Spike A: gotovo na grani `c/spike-a`, čeka PR i potvrdu B za D-005
  - selektori rade, ali builder mora da piše `role="button"` / `role="list"` / `role="listitem"`
  - primer i skripta: `templates/spike-a/` (`npx tsx templates/spike-a/check.ts`)

## Mockovi koje koristim
- nema

## Blokira me
- ništa (B treba da pogleda D-005: obavezan `role` u ugovoru za buildera)
