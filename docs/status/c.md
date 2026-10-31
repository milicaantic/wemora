# Status: osoba C
Faza: F3

## Gotovo (spojeno u main)
### F0–F1
- C0.1 Expo šablon (PR #2): Expo SDK 58, Expo Router, TS, `web.output: "single"`, tačne verzije + lock; AsyncStorage 2.2.0 (PR #32); Metro keš po aplikaciji (D-009, PR #22)
- C1.1 Spike A (PR #6): selektori rade uz obavezan `role` na dugmadima i listama (D-005, prihvaćeno)
- C1.2 merenje exporta (PR #9): statički web export svuda (D-006)
- C1.3 `scaffold()` (PR #15): ruta po ekranu iz `routeMap`, prazni ekrani, `node_modules` kao link na šablon
- C1.4 kapije 1–4 (PR #16): `runGates()` u `src/gatekeeper/gates/`; D-008 (prihvaćeno): TypeScript umesto Babela, `labels` proverava samo tekst iz originala
- C1.5 `promote`, `rollback`, `serveApp` (PR #18, #21): `appDir` iz rasporeda foldera, prethodno stanje u memoriji, export u privremeni folder, B-ov `serveStatic`
- C1.6 `computeStatus` (PR #19); `roundsExhausted` izbačen iz mojih testova (D-015)
- G1 zajednički test sa B (PR #22): `src/gatekeeper/g1.test.ts`, sada kroz pravi `checkDraft`

### F2
- C2.1 promptovi (PR #33, dopuna #48): `builder.md` (ugovor o labelama, uklj. checkbox i `Link`), `web-to-rn.md`
- C2.2 builder (PR #37, #39): `src/agents/builder.ts`, `OwnershipGuard` sa listom putanja (D-015); prekinuta runda ne šalje nacrt (D-016)
- C2.3 `checkDraft` (PR #44): kapije 1–4 → promote → kapija 5 → regresija → rollback; zajednička jedinica: kapije 1–3 → promote → regresija
- C2.4 Gatekeeper-učesnik (PR #47, #48): red čekanja, `tests.missing` → `unproven` (D-016), zakasneli nacrti se ignorišu; A ga je povezao u CLI (PR #49)
- MockRunner za TodoMVC (PR #52): `src/agents/mocks/todomvc/builder.json` sa `app-entry` i `todo-list` (ID potvrdio D, PR #50)
- **integracija:** `npm run migrate:mock -- examples/todomvc --original-url http://localhost:7002` završava sa `finished`: `app-entry` promovisan (unproven), `todo-list` runda 1 `gate.failed` („`<div>` ne postoji u React Native, koristi `<View>`“), runda 2 promovisan (partial); u `run.jsonl` nema odbijenih ni zalutalih upisa buildera; `report.html` prikazuje statuse

## U radu
- C3.3 testovi toka (C deo): gotovo na grani `c/flow-tests`, čeka PR
  - `src/gatekeeper/flow.ts`: `checkFlow` → aplikacija (390×844) + testovi toka sa namernim razlikama svih jedinica toka → `FlowResult`; test bez rezultata = pao
  - Gatekeeper-učesnik: sluša `flow.tests.ready`; kad su sve jedinice toka promovisane, tok ide u **isti red** kao nacrti (bez preklapanja nad `app/`), tačno jednom; rezultat u `flowResults` i `results/flows/<flowId>.json`; tok koji pada ne vraća ekrane i ne šalje događaj (D-022)
  - testovi: 5 za `checkFlow`, 3 za učesnika (tok ne kreće pre promocije, kreće jednom, pad ne vraća ekrane)
  - ceo tok u prolazu čeka B (tester piše testove toka, inbox) i A (`a/flow-dispatch`)
- C3.1 (PR #65) i popravke posle pravog prolaza (PR #61) su spojeni
- G3: `verify` (B, PR #67) koristi moj `serveApp`

- sajt projekta (PR #77): statička stranica bez build alata, podeljena (grana `c/site-split`): `site/index.html` (sadržaj), `site/css/` (`tokens`, `base`, `hero`, `sections`, `responsive`), `site/js/copy.js`; folder `site/` nije ničiji po vlasništvu, tim treba da odluči ko ga vodi i da li ide na GitHub Pages

- `results/<unitId>.json` sada ima rezultat svakog testa (`scenarios`), status iz pravih rezultata (D → C, grana `c/results-scenarios`)

## Čeka druge (za G2)
- A: spojiti `contracts/submit` (B) pa `c/submit-prompt` (C)
- prolaz sa pravim modelom (`--budget 1`): treba `ANTHROPIC_API_KEY` (kod C ga nema)

## Sledeće (F3)
- C3.1 regresija i rollback nad pravim prolazom sa više ekrana (Recepti); kod i testovi već postoje (C2.3)
- C3.2 statusi: većinom urađeno u C2.4 (`results/<unitId>.json`, `unproven` posle `tests.missing`, `report.html`); ostaje provera nad Receptima
- C3.3 testovi toka (`Flow`), samo ako je sve ostalo zeleno
- C3.4 kapija 6 `androidExport`, opciono

## Mockovi koje koristim
- `src/gatekeeper/mocks/drafts.ts` (dobri/loši nacrti) i `shopping-list.tests.json` (ručni testovi)
- scaffold, kapije i `checkDraft` testovi koriste D-ov `examples/recepti/wemora/plan.manual.json`

## Blokira me
- ništa
