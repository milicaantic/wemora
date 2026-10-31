# Status: osoba C
Faza: F2 (moj deo gotov), čeka kapiju G2

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
- popravke posle pravog prolaza (A-ova analiza), grana `c/popravka`:
  - **Gatekeeper čeka događaj `tests.ready`** (ili `tests.missing`), a ne „ima li testova na tabli“: tester upisuje testove jedan po jedan, pa je provera kretala sa nepotpunim skupom (3 od 5) i prolaz se završavao pre filtera i „Clear completed“. Proveren redosled u `migrate:mock`: `tests.ready` → `check_started`, `todo-list` proven sa 5/5.
  - **prompt buildera:** builder ne pravi rute; filteri i podstranice u okviru ekrana (`#/active`, `?filter=`) su `useState` ili search parametar na istoj ruti; linkovi samo na postojeće rute. Zadatak buildera sada sadrži spisak mobilnih ruta iz `routeMap`.
- C3.1 regresija nad pravom aplikacijom: grana `c/regression-real` (lokalno, čeka push)
- C3.3 testovi toka: čeka odluku tima

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
