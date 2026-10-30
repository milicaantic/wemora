# mock-api

Mali HTTP server sa podacima za primer **Recepti**. Originalna web aplikacija i Expo aplikacija čitaju **isti** API, pa razlika na ekranu znači razliku u ponašanju, a ne u podacima (`docs/architecture.md` §11). Bez zavisnosti, samo `node:*` moduli.

## Pokretanje

```bash
cd examples/mock-api
npm start            # http://localhost:3000
npm run check        # proveri sve fixture fajlove i izađi (exit 1 ako nešto ne valja)
```

Bez `npm install`, jer nema zavisnosti. Može i iz korena repoa: `node examples/mock-api/server.mjs`.

| Promenljiva | Podrazumevano | Značenje |
|---|---|---|
| `MOCK_API_PORT` | `3000` | port (isti kao `EXPO_PUBLIC_API_URL` u `templates/expo/.env.example`) |
| `MOCK_API_HOST` | sve adrese | npr. `127.0.0.1` |
| `MOCK_API_FIXTURE` | `default` | fixture pri pokretanju; na njega vraća `POST /__reset` |
| `MOCK_API_DELAY_MS` | `0` | veštačko kašnjenje za `/api/*` (provera „Učitavanje…“) |
| `MOCK_API_QUIET` | — | `1` isključuje log zahteva |

Aplikacije čitaju adresu iz `VITE_API_URL` (web) i `EXPO_PUBLIC_API_URL` (Expo), npr. `http://localhost:3000`.

## Rute sa podacima (samo `GET`)

| Ruta | Odgovor |
|---|---|
| `GET /api/categories` | `[{ id, name }]` |
| `GET /api/recipes` | svi recepti, **bez** `steps` |
| `GET /api/recipes/:id` | ceo recept; `404 { "error": "not found" }` ako ne postoji |

Recept: `{ id, name, categoryId, timeMin, difficulty: "Lako" | "Srednje" | "Teško", servings, calories, rating, ingredients: [{ name, amount, unit }], steps: string[] }`. Količine u `ingredients` važe za `servings` porcija.

Podaci su samo za čitanje. Stanje klijenta (omiljeni, lista za kupovinu) je u `localStorage` aplikacije, ne ovde.

## Kontrolne rute za testove (`Scenario.apiFixture`)

| Ruta | Telo | Odgovor |
|---|---|---|
| `GET /__health` | — | `{ ok: true, fixture, fixtures: [...] }` |
| `POST /__fixture` | `{ "name": "empty" }` | `{ fixture }`; `400` za nepoznato ime |
| `POST /__reset` | — | vraća fixture sa kojim je server pokrenut: `{ fixture }` |

Predlog za B (`docs/tasks/b.md`, Q1): `runScenarios` pre svakog scenarija zove `POST /__fixture` sa `scenario.apiFixture ?? "default"`, a posle prolaza `POST /__reset`. Pošto su podaci samo za čitanje, izbor fixture-a je jedino stanje servera, pa dva puštanja zaredom uvek vide iste podatke.

## Fixture fajlovi (`fixtures/*.json`)

| Ime | Sadržaj |
|---|---|
| `default` | 4 kategorije (Supe, Glavna jela, Salate, Deserti), 12 recepata sa ID-jevima `"1"`–`"12"` |
| `empty` | iste kategorije, nijedan recept |

Novi fixture je novi `.json` fajl u `fixtures/`; ime fajla je ime fixture-a. Server ga pri pokretanju proverava i odbija da krene ako nešto ne valja. **Nijedno ime recepta ili kategorije ne sme da sadrži drugo** (npr. „Pita“ i „Pita od jabuka“), jer bi `expectNotVisible: "Pita"` tada pao zbog drugog recepta.
