# Status: osoba C
Faza: F1

## Gotovo (spojeno u main)
- C0.1 Expo šablon (PR #2): Expo SDK 58, Expo Router, TS, `web.output: "single"`, tačne verzije + lock
- C1.1 Spike A (PR #6): selektori rade uz obavezan `role` na dugmadima i listama (D-005)
- C1.2 Merenje exporta (PR #9): statički web export svuda (D-006)

## U radu
- C1.3 `scaffold()`: gotovo na grani `c/scaffold`, čeka PR
  - ruta po ekranu iz `routeMap` (`/recepti/[id]` → `src/app/recepti/[id].tsx`), prazan ekran u `src/screens/<id>/`, prazan `src/shared/<id>/`
  - `node_modules` u aplikaciji je link na `templates/expo/node_modules` (ne kopija)
  - šablon: zaglavlje `Stack`-a sakriveno, da prazan ekran nema tekst (ime rute)
  - ručno provereno: 5 ruta Recepata se otvara, sve prazne
- sledeće: C1.4 kapije 1–4

## Mockovi koje koristim
- nema: test koristi D-ov `examples/recepti/wemora/plan.manual.json`

## Blokira me
- ništa (B treba da potvrdi D-005: obavezan `role` u ugovoru za buildera)
