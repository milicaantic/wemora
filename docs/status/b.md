# Status: osoba B
Faza: F1
Poslednja izmena: 2026-10-30

## Gotovo (spojeno u main)
- F0 (PR #3): `docs/tasks/b.md`, folderi, B0 (review ugovora, potvrda D-001–D-003), B1 (`playwright@1.64.1`)
- B2 + B3 (PR #7): `scenarios/compile.ts`, `run.ts` (`runScenarios`), `serve.ts` (`serveStatic`)

## Gotovo, čeka PR (grana `b/validate-setup`)
- B4 `scenarios/validate.ts`: `validateScenario()` (izvoz kroz `index.ts`), sa 3 pravila (vidi „Odluke“). `createValidateScenario(run)` za testove. Razlozi odbijanja su pisani za model testera.
- B4 `mocks/blank/index.html`: prazan ekran za F1 (u F2 ga menja placeholder iz C-ovog scaffolda, B9).
- B4 `mocks/recepti/*.json`: 3 ručna scenarija — `recipe-list/search-by-name`, `favorites/shows-favorites` (sa `setup`), `shopping-list/add-item`. **Ručno provereno nad pokrenutim Receptima (G1):** sva 3 prolaze `runScenarios` i `validateScenario`; slabija verzija pretrage (bez provere koja se menja) je odbijena.
- B5 `scenarios/interactive.ts`: `extractInteractive()` iz ARIA snapshota (desktop). Nad Receptima `/` daje 9 elemenata, `/kupovina` 2. (B5 je po dogovoru u ovoj grani, a ne u `b/interactive-coverage` uz B6.)
- B3 popravka u `run.ts`: `expectNotVisible` čeka da mreža utihne (300 ms bez zahteva), jer je inače lažno prolazio dok ekran prikazuje „Učitavanje…“. Nađeno ručnom proverom nad Receptima; dodat test sa zakasnelim podacima.
- `scenarios/viewports.ts`: `DESKTOP` 1280×800, `MOBILE` 390×844.
- Testovi: 59 u celom repou (scenarios 38), stabilni u 3 uzastopna puštanja.

## Odluke (B4/B5, dogovoreno sa B; tim još treba da potvrdi)
- **Pravilo 3** (`architecture.md` §11): za svaku radnju (`tap`/`fill`) iza koje slede provere, **bar jedna** od tih provera mora da padne kad se pusti pre radnje. Doslovno čitanje („svaka provera“) odbija i primer iz `wemora-plan.md` §4.1. Radnje su samo `tap` i `fill`, ne `goto`. Treba zapis u `docs/decisions.md`.
- **Pravilo 2**: nad praznim ekranom se pušta samo `steps` (bez `setup`), u 390×844, bez `reveal`. Pad već na `goto` znači da se prazan ekran ne učitava, pa se scenario ne prihvata.
- **B5, ponovljeni redovi**: od redova tabele/liste (`row`, `listitem`) računaju se samo elementi prvog reda koji ih ima. Tester u promptu (B8) dobija pravilo „za liste koristi prvu stavku“.
- **B5, meni**: ako stranica ima `main`, elementi se uzimaju samo iz njega; zajednički meni ne ulazi u pokrivenost ekrana.
- Iz B2/B3 i dalje važe: `failedStep` = indeks u `steps` (pad u `setup` → bez `failedStep`, `error` počinje sa `setup: step N:`); poklapanje teksta po b.md Q2; vremenski limiti su konstante u `run.ts` (Q20).

## U radu
- ništa

## Sledeće
- B6 `computeCoverage()` (PR `b/interactive-coverage`)
- B7 zajednički test sa C (G1): moj scenario preko C-ovog `serveApp()` nad ručnim RN ekranom

## Mockovi koje koristim
- `src/scenarios/mocks/static/` i `mocks/blank/` umesto pravih aplikacija, samo u testovima
- `apiFixture` se prenosi, ali se ne primenjuje: D je odgovorio (Q1: `POST /__fixture` pre, `POST /__reset` posle), ali `runScenarios` nema adresu mock-api-ja dok A ne reši Q8

## Čeka odluku tima
- A: komentar za `ScenarioResult.failedStep`
- A: zajednička šema za `tests/<unitId>.json` (niz `Scenario`)
- A: URL originala i mock-api-ja u `RunConfig` ili drugom ugovoru (b.md Q8); posle toga uključujem `apiFixture`
- C (D-005, Spike A) čeka B-ovu potvrdu. Predlog: prihvatiti — selektori po labeli, ulozi i tekstu rade uz `role="button"` / `role="list"` / `role="listitem"`, što se slaže sa `run.ts`
- D (TodoMVC, taster Enter): DSL nema korak za Enter, pa se u TodoMVC ne može dodati zadatak. Predlog D: nov korak `{ submit: { label } }` (promena ugovora). Odluka B/A otvorena.

## Blokira me
- ništa
