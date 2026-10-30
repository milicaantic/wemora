# Status: osoba C
Faza: F2

## Gotovo (spojeno u main)
- C0.1 Expo šablon (PR #2): Expo SDK 58, Expo Router, TS, `web.output: "single"`, tačne verzije + lock
- C1.1 Spike A (PR #6): selektori rade uz obavezan `role` na dugmadima i listama (D-005)
- C1.2 Merenje exporta (PR #9): statički web export svuda (D-006)
- C1.3 `scaffold()` (PR #15): ruta po ekranu iz `routeMap`, prazni ekrani, `node_modules` kao link na šablon
- C1.5 `promote`, `rollback`, `serveApp` (PR #18): putanja aplikacije iz rasporeda foldera, prethodno stanje u memoriji, export u privremeni folder
- C1.6 `computeStatus` (PR #19); **za A:** `roundsExhausted` ne menja status
- `serveApp` koristi B-ov `serveStatic` (PR #21)
- C1.4 kapije 1–4 (PR #16): `runGates()` u `src/gatekeeper/gates/`; D-008 (predlog): TypeScript umesto Babela, `labels` proverava samo tekst iz originala

## U radu
- C2.1 promptovi: spojeno (PR #33); čeka se B-ova potvrda ugovora o labelama
- AsyncStorage u šablonu: PR #32, čeka review
- C2.2 agent builder: gotovo na grani `c/builder`, čeka PR
  - `src/agents/builder.ts`: `createBuilder(id)` → `AgentHandle<BuildTask>`; nacrt u `output/<run>/staging/<builderId>/<unitId>/`; svež kontekst po rundi; alati `read_source`, `read_app` (app sa primenjenim nacrtom), `write_file` (OwnershipGuard), `check_draft` (kapije 1–4, samo poruke), `submit_draft`
  - ako model ne pozove `submit_draft`, nacrt se ipak predaje kad se petlja završi (da Conductor ne čeka timeout)
  - `gatekeeper/index.ts` sada izvozi `runGates` (za `check_draft`)
  - **za A (A12):** MockRunner primeri u `src/agents/mocks/builder.todomvc.json`: `builder:todo-list:1` (fali labela „New Todo Input“), `builder:todo-list:2` (popravka), `builder` (rezervni); ključ `todo-list` preimenovati ako lažni arhitekta koristi drugi ID
  - **za A:** `OwnershipGuard` prima jedan prefiks; jedinica `layout` po PD3 treba i `app/_layout.tsx`. Predlog: `new OwnershipGuard(["shared/layout/", "app/_layout.tsx"])`. Do tada `layout` piše samo u `shared/layout/`.
- sledeće: C2.3 `checkDraft` (čeka `contracts/f1` od A: `unit`, `round`, `webDir`)

## Odgovori C za kraj F1 (rešeno sa moje strane)
- **G1, zajednički test sa B:** spojeno (PR #22), `src/gatekeeper/g1.test.ts`; bug sa rutama popravljen (D-009). Čeka se da D ponovi G1.
- **D-001–D-003 i „contracts: samo zod“ (§2):** ok.
- **Review ugovora (A, P16):** `GateResult` i `UnitResult` su ok. Potpisi:
  - `promote`/`rollback`: rade bez izmene ugovora, `appDir` se izvodi iz `draftDir` (raspored §7). Ok i ovako.
  - `serveApp`: rešeno (`ServedApp` sa `close()`).
  - builderov `check_draft` i Gatekeeper-ov `checkDraft` su **dve funkcije**: `check_draft` = kapije 1–4 (`runGates` iz `gatekeeper/gates/`), `checkDraft` = ceo put (kapije 1–5, promote, regresija, rollback).
  - **traži izmenu u `contracts/f1` (za C2.3):** `checkDraft` treba da dobije `round` (ide u `GateResult`), jedinicu (`Unit`: `sources` za kapiju 4, `intentionalDifferences` za `runScenarios`) i `webDir` (da se `sources` nađu na disku). Predlog: `checkDraft({ unit, round, draftDir, tests, webDir })`.
  - `StatusInput.roundsExhausted` ne menja status (C1.6); predlog: ukloniti.
- **PD3 (navigacija):** zajednička jedinica `layout` sme da menja `src/app/_layout.tsx` (bočni meni → tabovi ili drawer). Scaffold pravi samo početni `_layout.tsx` (Stack bez zaglavlja); ostale rute (`src/app/*`) pravi samo scaffold.
- **PD4 (`writes`):** potvrđeno: putanje relativne u odnosu na `app/`; ekran `src/screens/<id>/`, zajednička `src/shared/<id>/`, a `layout` još i `src/app/_layout.tsx`. Staging ima raspored `app/src/`, pa builder piše u `staging/<builderId>/<unitId>/` + `writes` bez prefiksa `src/` (za OwnershipGuard).
- **PD5 (ko pokreće original):** bez primedbi na predlog (Conductor preko B-ovog `serveOriginal`).
- **PD8 (parser):** Babel ne treba; i D (D-007) i C (D-008) koriste `typescript`.
- **PD7 (jezik):** ok.

## Čeka potvrdu drugih
- D-005 (obavezan `role`): B
- D-008 (kapije TypeScriptom, pravila `forbiddenApis` i `labels`): A, B, D

## Za C2.3 (`checkDraft`), da se ne zaboravi
- ugovor `checkDraft(unitId, draftDir, tests)` ne prosleđuje rundu, `appDir`, `Unit.sources` ni namerne razlike
- kapija 4 ne proverava dugmad koja postoje samo na telefonu (`hiddenBehind.reveal`)

## Mockovi koje koristim
- `src/gatekeeper/mocks/drafts.ts` (dobri/loši nacrti) i `shopping-list.tests.json` (ručni testovi)
- scaffold i kapije koriste D-ov `examples/recepti/wemora/plan.manual.json`

## Blokira me
- ništa (B treba da potvrdi D-005: obavezan `role` u ugovoru za buildera)
