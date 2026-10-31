---
from: A
to: C
created: 2026-10-31
priority: high
status: done
done: 2026-10-31, grana c/api-url
---
# G3: mobilna aplikacija ne zna adresu mock-api-ja (`EXPO_PUBLIC_API_URL` se ne postavlja pri web exportu)

## Problem
Pravi G3 prolaz `output/20261031-164833-recepti` (27 min, $1.62): 4 od 5 ekrana su `failed` u sve 4 runde, a `shopping-list` je `partial`. Padaju tačno ekrani koji čitaju recepte sa API-ja:

| Ekran | Nacrt zove API? | Šta pada (sve 4 runde) |
|---|---|---|
| `recipe-list` | da (`fetch`) | korak 2: polje „Pretraga“ nije na ekranu |
| `recipe-detail` | da | korak 2: link „Nazad na recepte“ nije na ekranu |
| `categories` | da | korak 2: „Izaberite kategoriju“ nije na ekranu |
| `favorites` | da | korak 2: „Nemate omiljenih recepata“ nije na ekranu |
| `shopping-list` | ne | testovi prolaze |

Uzrok:
- Nacrti rade `fetch(`${API_URL}${path}`)` i dok ne dobiju podatke prikazuju „Učitavanje…“ (`staging/builder-2/recipe-list/screens/recipe-list/index.tsx:25`, `:27`, `:60`).
- `API_URL` je `process.env.EXPO_PUBLIC_API_URL ?? ''` (`app/src/shared/config.ts`), a tu promenljivu niko ne postavlja kad `serveApp` pravi web export. U `app/` postoji samo `.env.example` (`EXPO_PUBLIC_API_URL=http://localhost:3000`), a `.env` ne postoji (`grep -rn EXPO_PUBLIC_API_URL src` ne nalazi ništa).
- Zato je `API_URL` prazan, pa `fetch("/api/recipes")` ide na statički server, koji vraća `index.html`. `response.json()` baci grešku i ekran ostane bez sadržaja, pa testovi ne nađu ni statične tekstove.
- Original radi: tester je testove validirao na originalu sa `localhost:3000`, a mock-api je bio pokrenut.
- Builder ovo ne može da popravi, jer poruka kaže samo „not found on screen“. Zato je potrošio 4 runde (2 na Sonnet-u), oko $1 od $1.62.

Zaobilaznica koju korisnik koristi do popravke: `$env:EXPO_PUBLIC_API_URL = "http://localhost:3000"` u terminalu pre `migrate` i `verify`. `serveApp` prosleđuje `process.env` Expo-u (`src/gatekeeper/serve.ts:23`).

## Predlog
Najmanja izmena: `scaffold` kopira `.env.example` šablona u `app/.env`. Expo CLI sam čita `.env` pri exportu, pa to radi i za `verify` nad `runs/`, ako arhiva čuva `app/.env`. Druga mogućnost je da `serveApp` postavi `EXPO_PUBLIC_API_URL` na `http://localhost:3000` kad je nema u okruženju. Ti biraš.

## Gotovo kad
- `migrate` nad Receptima, bez `$env:EXPO_PUBLIC_API_URL` u terminalu, daje `app/.env` (ili ekvivalent) i ekrani koji zovu API dobijaju podatke na telefonu.
- `npm test` prolazi.

## Odgovor
C, 2026-10-31: urađeno na grani `c/api-url`, oba predloga u blažem obliku (bez `app/.env`, jer root `.gitignore` ignoriše `.env`, pa ga arhive u `runs/` ne bi imale):

- **`serveApp`** (`src/gatekeeper/serve.ts`, `exportEnv`): ako `EXPO_PUBLIC_API_URL` nije postavljen, uzima `VITE_API_URL` (istu adresu kao original), a ako ni nje nema, vrednost iz `app/.env.example` (šablon: `http://localhost:3000`). Zadata `EXPO_PUBLIC_API_URL` uvek pobeđuje. Ovo pokriva `migrate`, `verify` i stare arhive u `runs/`, jer i `verify` ide kroz `serveApp`.
- **Šablon** (`templates/expo/src/shared/config.ts`): `API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000"`, isti podrazumevani kao Recepti (`VITE_API_URL ?? "http://localhost:3000"`). Važi i za `npx expo start` ručno.
- **Provereno:**
  - `src/gatekeeper/serve-env.test.ts` (5 testova: zadata adresa, `VITE_API_URL`, `.env.example`, bez ičega);
  - pravi export aplikacije sa **starim** `config.ts` (`?? ''`, kao u arhivi), bez promenljive u okruženju: ekran prikazuje `API=http://localhost:3000`;
  - sa pokrenutim `examples/mock-api`, ekran koji radi `fetch(API_URL + "/api/recipes")` prikazuje „Pileća supa“, „Paradajz čorba“, „Riblja čorba“ umesto „Učitavanje…“.
  - `npm run build` i `npm test` prolaze.
- Zaobilaznica `$env:EXPO_PUBLIC_API_URL` više ne treba. Pravi `migrate` nad Receptima (tvoj „Gotovo kad“) nisam puštala, jer troši budžet; pustite ga vi za G3, uz pokrenut mock-api.

