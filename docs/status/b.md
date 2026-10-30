# Status: osoba B
Faza: F0
Poslednja izmena: 2026-10-30

## Gotovo (spojeno u main)
- ništa

## Gotovo, čeka commit (grana `b`)
- `docs/tasks/b.md`: plan zadataka B0–B16 i pitanja za tim
- folderi `src/scenarios/mocks/`, `src/verify/mocks/`, `src/agents/prompts/`, `scripts/` (sa `.gitkeep`)
- B0: review ugovora za moj deo (`scenario.ts`, `difference.ts`, `ScenarioResult`, `InteractiveElement`, `Coverage`, B-ovi potpisi u `api.ts`). Tipovi su u redu; A je dobio 3 tražene izmene (ispod). Potvrđujem D-001, D-002 i D-003.
- B1: `playwright@1.64.1` (biblioteka, tačno pinovana, odobreno u chatu) u `package.json`/`package-lock.json`. Posle `npm ci` svako pokreće `npx playwright install chromium`. Ručna provera: Chromium 156 se pokreće, viewport 390×844, `getByLabel` i `ariaSnapshot()` rade.
- Napomena: zavisnost ide u isti commit sa docs fajlovima na grani `b`, a ne u poseban PR `b/deps` (tim-plan §2.5), po dogovoru.

## U radu
- ništa

## Sledeće
- B2 + B3: prevodilac DSL → Playwright i `runScenarios()` (PR `b/compiler-runner`), čim A spoji `skeleton` (prazan `src/scenarios/index.ts`)
- `examples/recepti` još ne postoji (D, F1); pokrećem ga kad stigne

## Mockovi koje koristim
- nema

## Čeka odluku tima
- A: komentar za `ScenarioResult.failedStep` (indeks u `steps`; pad u `setup` → bez `failedStep`, `error` počinje sa `setup:`)
- A: zajednička šema za `tests/<unitId>.json` (niz `Scenario`), jer je čitaju tester, Gatekeeper i `verify`
- A: URL originala i mock-api-ja u `RunConfig` ili drugom ugovoru (b.md Q8); blokira F2, ne F1
- D: mehanizam za `apiFixture` i reset `examples/mock-api` između puštanja (b.md Q1); blokira deo B3/B4

## Blokira me
- ništa
