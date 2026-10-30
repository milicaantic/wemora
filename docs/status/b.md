# Status: osoba B
Faza: F1
Poslednja izmena: 2026-10-30

## Gotovo (spojeno u main)
- F0 (PR #3): `docs/tasks/b.md`, folderi, B0 (review ugovora, potvrda D-001–D-003), B1 (`playwright@1.64.1`)
- B2 + B3 (PR #7): `scenarios/compile.ts`, `run.ts` (`runScenarios`), `serve.ts` (`serveStatic`)
- B4 + B5 (PR #11): `validate.ts` (`validateScenario`), `interactive.ts` (`extractInteractive`), `mocks/blank/`, 3 ručna scenarija za Recepte u `mocks/recepti/` (ručno provereni nad Receptima), popravka `expectNotVisible` dok se ekran učitava

## Gotovo, čeka PR (grana `b/interactive-coverage`)
- B6 `scenarios/coverage.ts`: `computeCoverage()` (izvoz kroz `index.ts`). Obaveze pokrivene po `scenario.obligation`; element je pokriven ako ga koristi `tap` ili `fill` (i u `setup`), po istom pravilu poklapanja kao izvršilac (`compile.ts` sada izvozi `actedOn`, `toTarget`, `sameElement`). `notPortable` elementi nikad nisu „missing“. Svaki element je u tačno jednoj od tri liste. Scenariji drugih jedinica se ne računaju; `movedTo` još ne utiče (Q6).
- Testovi: `coverage.test.ts` (3), uključujući D-ov plan za Recepte i elemente koje je B5 izvukao iz pokrenutih Recepata. Ceo repo: 123 testa.
- B7 (G1, ručno, bez PR-a): **ceo put bez AI-ja radi.** Scenario `shopping-list/add-item`:
  1. prolazi `validateScenario` (original: pokrenuti Recepti; prazan ekran: RN placeholder kao iz scaffolda, Expo web export);
  2. prolazi nad ručno napisanim RN ekranom (`TextInput accessibilityLabel`, `Pressable role="button"`, `role="list"`), Expo web export, 390×844;
  3. pada nad placeholderom sa porukom `fill field labelled "Namirnica": not found on screen within 5000 ms`;
  4. `computeCoverage` za `shopping-list`: 1/4 obaveze, 2/2 elementa.
  - **Napomena:** C-ov `serveApp()` još nije spojen, pa je umesto njega korišćen isti put po D-006 (`expo export --platform web` + moj `serveStatic`). Kad C spoji `serveApp`, proveru treba ponoviti sa njim. RN ekran je bio u privremenom folderu, ne u repou.

## Odluke (B4/B5, dogovoreno sa B; tim još treba da potvrdi)
- **Pravilo 3** (`architecture.md` §11): za svaku radnju (`tap`/`fill`) iza koje slede provere, **bar jedna** od tih provera mora da padne kad se pusti pre radnje. Doslovno čitanje („svaka provera“) odbija i primer iz `wemora-plan.md` §4.1. Radnje su samo `tap` i `fill`, ne `goto`. Treba zapis u `docs/decisions.md`.
- **Pravilo 2**: nad praznim ekranom se pušta samo `steps` (bez `setup`), u 390×844, bez `reveal`. Pad već na `goto` znači da se prazan ekran ne učitava, pa se scenario ne prihvata.
- **B5, ponovljeni redovi**: od redova tabele/liste (`row`, `listitem`) računaju se samo elementi prvog reda koji ih ima. Tester u promptu (B8) dobija pravilo „za liste koristi prvu stavku“.
- **B5, meni**: ako stranica ima `main`, elementi se uzimaju samo iz njega; zajednički meni ne ulazi u pokrivenost ekrana.
- Iz B2/B3 i dalje važe: `failedStep` = indeks u `steps` (pad u `setup` → bez `failedStep`, `error` počinje sa `setup: step N:`); poklapanje teksta po b.md Q2; vremenski limiti su konstante u `run.ts` (Q20).

## U radu
- ništa

## Sledeće
- F1 je za B završen. Posle G1: B8 agent tester (F2), čim A spoji `agents/_shared/` (A8) i `MockRunner` (A7)
- ponoviti B7 sa C-ovim `serveApp()` kad bude spojen

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
