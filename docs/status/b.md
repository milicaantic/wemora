# Status: osoba B
Faza: F1
Poslednja izmena: 2026-10-30

## Gotovo (spojeno u main)
- F0 (PR #3): `docs/tasks/b.md`, folderi, B0 (review ugovora, potvrda D-001–D-003), B1 (`playwright@1.64.1`)

## Gotovo, čeka PR (grana `b/compiler-runner`)
- B2 `scenarios/compile.ts`: DSL → lista akcija sa indeksom DSL koraka; uslovni `reveal` iz `hiddenBehind` (pre `tap`, `fill` i `expectVisible`); korak nad `notPortable` elementom je greška.
- B3 `scenarios/run.ts`: `runScenarios()` (izvoz kroz `index.ts`) — jedan Chromium po pozivu, nov kontekst po scenariju, `setup` pa `steps`, nikad ne baca. `createRunScenarios(settings)` za testove sa kraćim vremenima. Skrol do elementa za virtualizovane liste.
- B3 `scenarios/serve.ts`: `serveStatic(dir)` preko `node:http` (SPA fallback, zaštita od `..`), za testove i kasnije `verify`.
- Testovi: `compile.test.ts` (6), `run.test.ts` (11, pravi Chromium nad `mocks/static/`), `serve.test.ts` (4). Stabilni u 3 uzastopna puštanja.

## Odluke koje sam doneo u B2/B3 (čekaju potvrdu tima)
- `failedStep` = indeks u `steps`; pad u `setup` nema `failedStep`, a `error` počinje sa `setup: step N:` (predlog iz B0, ugovor još nema komentar).
- Poklapanje (b.md Q2): uloga+ime, labela i `tap {text}` tačno i samo među vidljivim elementima (više poklapanja → greška); `expectVisible`/`expectNotVisible` traže podniz bez obzira na velika slova.
- Vremenski limiti su konstante u `run.ts` (korak 5 s, navigacija 15 s) dok ne dobiju mesto u `core/config.ts` (b.md Q20).

## U radu
- ništa

## Sledeće
- B4 `validateScenario()` + 3 ručna scenarija za Recepte (PR `b/validate-setup`)
- `examples/recepti` još ne postoji (D, F1); pokrećem ga kad stigne

## Mockovi koje koristim
- `src/scenarios/mocks/static/` (strana sa pretragom, filterom iza dugmeta „Filteri“ i virtualizovana lista) umesto pravih aplikacija, samo u testovima
- `apiFixture` se prenosi, ali se ne primenjuje dok D ne odgovori na Q1

## Čeka odluku tima
- A: komentar za `ScenarioResult.failedStep` (indeks u `steps`; pad u `setup` → bez `failedStep`, `error` počinje sa `setup:`)
- A: zajednička šema za `tests/<unitId>.json` (niz `Scenario`), jer je čitaju tester, Gatekeeper i `verify`
- A: URL originala i mock-api-ja u `RunConfig` ili drugom ugovoru (b.md Q8); blokira F2, ne F1
- D: mehanizam za `apiFixture` i reset `examples/mock-api` između puštanja (b.md Q1); blokira deo B3/B4

## Blokira me
- ništa
