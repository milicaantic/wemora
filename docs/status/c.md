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
- C2.3 `checkDraft`: gotovo na grani `c/check-draft`, čeka PR
  - `src/gatekeeper/check.ts`: ekran → kapije 1–4 → promote → kapija 5 (`runScenarios`, 390×844, namerne razlike jedinice) → regresija (testovi svih već promovisanih jedinica) → rollback ako 5 ili regresija padne; zajednička jedinica → kapije 1–3 → promote → regresija
  - nacrt se privremeno ubacuje pre kapije 5, pa jedan web export nad istim `app/` (topao keš) služi i kapiji 5 i regresiji; rollback vraća `app/` tačno
  - ekran bez testova ulazi kao nedokazan (C3.2); regresija javlja `brokenTests`
  - spisak promovisanih jedinica (za regresiju) čuva Gatekeeper u memoriji, u okviru prolaza
  - testovi: lažni `runScenarios` (7 slučajeva) + G1 test sada ide kroz pravi `checkDraft`
  - usput (D-015): builder koristi `OwnershipGuard` sa listom (`layout` sme i `app/_layout.tsx`); `roundsExhausted` izbačen iz testova statusa
- C2.4 Gatekeeper-učesnik: gotovo na grani `c/gatekeeper-participant` (napravljena od `c/check-draft`), čeka PR
  - `src/agents/gatekeeperParticipant.ts`: `createGatekeeper(id) → Participant` (`createHuman`, handleri po `event.type`)
  - `draft.submitted` → red čekanja, nacrti jedan po jedan; ekran bez testova čeka `tests.ready`, posle `testsWaitTimeoutMs` → `gate.failed` (bez promocije; „posle drugog timeouta kao unproven“ je C3.2)
  - rezultat: tabla + `results/<unitId>.json` (`UnitResult`), pa `gate.failed { unitId, round }` ili `unit.promoted { unitId }`; status promovisanog ekrana iz `computeStatus`
  - **za A:** u `src/orchestration/agents.ts` zameniti `gatekeeper: notYet(...)` sa `gatekeeper: createGatekeeper` (uvoz iz `../agents/gatekeeperParticipant`)
- sledeće: integracija (`npm run migrate:mock -- examples/todomvc`), čeka A12 i jedan ID ekrana za TodoMVC (D)

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
