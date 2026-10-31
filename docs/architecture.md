# Wemora — arhitektura

Ovo je **globalni opis sistema za agente koji pišu kod**. Pravila čitanja:

- Struktura i ponašanje sistema: **ovaj fajl**. Tačni oblici podataka: **`src/contracts/`** (kod pobeđuje tekst). Tvoji zadaci: `docs/tasks/<ja>.md`.
- Ako se zadatak ne slaže sa ovim fajlom ili sa `src/contracts/`, **stani i reci šta se ne slaže**. Ne rešavaj sam.
- Promene ovog fajla idu kroz zapis u `docs/decisions.md` i granu koju spaja A.
- Zašto je nešto ovako: `docs/wemora-plan.md`. Mozaik API: `.claude/rules/mozaik.md`.

---

## 1. Šta sistem radi

**Ulaz:** React SPA (React Router 6/7, obični CSS ili CSS moduli, hooks/Context, `fetch`, `localStorage`).
**Izlaz:** Expo SDK 58 aplikacija (Expo Router) + izveštaj koji za svaki ekran kaže da li je **dokazano** da se ponaša isto kao original.
**Dokaz:** UI testovi napisani iz pokrenutog originala, pušteni nad mobilnom verzijom. Ocenu daje običan kod, nikad AI.

## 2. Slojevi

| Sloj | Folderi | Sme da uvozi |
|---|---|---|
| 5 CLI | `src/cli.ts` | sve ispod |
| 4 Orkestracija | `src/orchestration/` | agents, domen, core, contracts |
| 3 Agenti | `src/agents/` | domen, core, contracts, `@mozaik-ai/core` |
| 2 Domen | `src/analysis/`, `scenarios/`, `gatekeeper/`, `scaffold/`, `report/`, `verify/` | core, ali samo fajlovi koji ne zavise od Mozaika (`config.ts`, `log.ts`), contracts, drugi domen **samo preko njegovog `index.ts`** |
| 1 Osnova | `src/contracts/`, `src/core/` | contracts: ništa; core: contracts, `@mozaik-ai/core` (samo `runtime.ts`, `state.ts`, `runner.ts`) |

**Zabranjeno:** domen uvozi `@mozaik-ai/core`, `src/agents/` ili `src/orchestration/`, direktno ili preko drugih fajlova (npr. domen → `core/runner.ts` → Mozaik). Proverava `scripts/check-layers.ts` u `npm run build` (D-004).

## 3. Komponente

| Komponenta | Vrsta | Folder | Vlasnik | Ulaz | Izlaz |
|---|---|---|---|---|---|
| Parser | domen | `analysis/` | D | putanja web projekta | `ParsedApp`: rute, fajlovi, tokeni, web API-ji, jedan deo; podelu na N delova pravi `splitParts(parsed, n)` (D-010) |
| Analizator | AI agent | `agents/analyzer.ts` | D | jedan deo `ParsedApp` | `AnalyzerReport[]` (po ekranu) |
| Arhitekta | AI agent | `agents/architect.ts` | D | svi `AnalyzerReport` + `ParsedApp` | `Plan` |
| validatePlan | domen | `analysis/` | D | `Plan`, `ParsedApp` | lista grešaka (prazna = ok) |
| Scaffold | domen | `scaffold/` | C | `Plan` | Expo projekat u `app/` sa praznim ekranima |
| Tester | AI agent | `agents/tester.ts` | B | jedna jedinica + URL originala | validirani `Scenario[]` |
| Builder | AI agent | `agents/builder.ts` | C | jedna jedinica + izvorni fajlovi + greška prethodne runde | kod u `staging/` |
| Gatekeeper | domen + učesnik | `gatekeeper/`, `agents/gatekeeperParticipant.ts` | C | jedinica, runda, nacrt, testovi, `webDir` (`CheckDraftInput`, D-015) | `GateResult`, promocija, `ScreenStatus` |
| Conductor | orkestracija | `orchestration/` | A | tabla + događaji | pokretanje/gašenje agenata, dodela jedinica |
| BudgetedRunner | osnova | `core/runner.ts` | A | `InferenceInput` | `InferenceOutput`, nikad izuzetak |
| Izveštaj | domen | `report/` | D | `output/<run-id>/` | `report.html` |
| Verify | domen | `verify/` | B | `output/<run-id>/` ili `runs/<x>/` | prolaz/pad svih scenarija, bez AI-ja |

## 4. Tok jednog prolaza

1. `cli migrate` → `core` napravi `output/<run-id>/`, inicijalizuje runtime i tablu.
2. `parseApp()` → `ParsedApp`. Conductor računa broj analizatora N (§9) i deli rute pozivom `splitParts(parsed, N)` iz `analysis/`.
3. Analizatori rade paralelno → svaki upiše `analysis/<deo>.json` i objavi `analysis.done`.
4. Kad su stigli **svi** `analysis.done` → Conductor pokreće arhitektu → arhitekta pravi `Plan` → `validatePlan()`. Ako ima grešaka, arhitekta dobija listu i ponavlja (najviše 2 puta; zatim šalje `plan.failed`, a Conductor završava prolaz i pravi izveštaj, D-012). Plan se upiše u `plan.json` i objavi se `plan.ready`.
5. `scaffold()` → `app/`.
6. Conductor: red zadataka po talasima. Testeri odmah kreću na ekrane (sve talase), a builderi na talas 0.
7. Tester → validirani testovi u `tests/<unitId>.json` → `tests.ready`.
8. Builder → kod u `staging/` → `draft.submitted`.
9. Gatekeeper → kapije (§10) → `gate.failed` (nazad istom builderu) ili promocija u `app/` → `unit.promoted`.
10. `unit.promoted` → Conductor oslobađa zavisne jedinice i ponovo računa broj agenata. Gatekeeper pušta regresiju i testove toka čije su sve jedinice promovisane.
11. Kraj: sve jedinice imaju konačan status → `buildReport()`.

## 5. Događaji

Imena i payload su u `src/contracts/events.ts`. **Payload nosi samo ID-jeve**, a podaci su na tabli i na disku. Domenske funkcije (npr. `scaffold()`) ne slušaju događaje, nego ih poziva Conductor (D-010).

| Događaj | Šalje | Payload | Reaguje |
|---|---|---|---|
| `analysis.done` | analizator | `{ partId }` | Conductor (kad su stigli svi, pokreće arhitektu) |
| `plan.ready` | arhitekta-učesnik | `{}` | Conductor (poziva `scaffold()`) |
| `plan.failed` | arhitekta-učesnik | `{}` | Conductor (završava prolaz, D-012) |
| `tests.ready` | tester | `{ unitId }` | Gatekeeper |
| `tests.missing` | Conductor | `{ unitId }` | Gatekeeper (promoviše ekran kao `unproven`, D-016) |
| `flow.tests.ready` | tester | `{ flowId }` | Gatekeeper (pušta tok kad su sve jedinice promovisane, D-022) |
| `draft.submitted` | builder | `{ unitId, round }` | Gatekeeper |
| `gate.failed` | Gatekeeper | `{ unitId, round }` | Conductor |
| `unit.promoted` | Gatekeeper | `{ unitId }` | Conductor, Gatekeeper (tokovi) |
| `budget.exceeded` | runner | `{}` | Conductor |
| `participant.joined` / `participant.left` | Mozaik | manifest | log |

## 6. Tabla (`MigrationState`)

Polja (tačan oblik u `src/contracts/state.ts`): `runId`, `parsed`, `reports`, `plan`, `units` (status po jedinici: `waiting | building | submitted | promoted | failed`, runda, model, dodeljeni builder), `tests` (po jedinici), `results`, `coverage`, `statuses`, `flowTests` i `flowResults` (po ID-ju toka, D-022), `agents` (ko je aktivan i na čemu), `ledger` (trošak po agentu), `config`.

## 7. Izlaz na disku i ko gde piše

```
output/<run-id>/
├── plan.json                     arhitekta-učesnik
├── analysis/<partId>.json        analizator
├── tests/<unitId>.json           tester (samo validirani)
├── tests/flows/<flowId>.json     tester (testovi toka, D-022)
├── staging/<builderId>/<unitId>/ builder — SAMO ovde
├── app/                          Gatekeeper i scaffold — SAMO oni
│   └── src/app/…                 Expo Router rute;  src/screens/<unitId>/;  src/shared/<unitId>/
├── results/<unitId>.json         Gatekeeper
├── results/flows/<flowId>.json   Gatekeeper (`FlowResult`, D-022)
├── run.jsonl                     core/log (svi događaji sa vremenom i troškom)
└── report.html                   izveštaj
```

Staging folder ima isti raspored kao `app/src/`, pa je promocija kopiranje. OwnershipGuard odbija svaki upis van dozvoljene putanje.

## 8. Plan i jedinica posla

`Plan = { units: Unit[], flows: Flow[], routeMap }`.

`Unit` (tačno u `contracts/types.ts`): `id`, `kind: "shared" | "screen"`, `wave`, `route?`, `sources` (izvorni web fajlovi, samo za čitanje), `writes` (putanje u `app/src/` koje jedinica sme da menja), `dependsOn` (ID-jevi jedinica), `obligations` (šta mora da se testira), `intentionalDifferences`, `size` (tokeni).

- **Talas 0** su zajedničke jedinice: komponente, skladišta podataka, API klijent, navigacija. Ekrani zavise samo od njih, a ne jedni od drugih, jer se povezuju preko adresa iz `routeMap`.
- **Talas 2+** postoji samo kad ekran zavisi od koda druge jedinice-ekrana.
- Svaki izvorni fajl pripada najviše jednoj jedinici. Svaka ruta iz parsera je u planu.
- Modal ili deo koji postoji samo unutar drugog ekrana spaja se sa tim ekranom u istu jedinicu.

**Namerne razlike** su strukturisane (`contracts/difference.ts`), nikad slobodan tekst:

| `kind` | Značenje | Šta radi prevodilac testova za telefon |
|---|---|---|
| `hiddenBehind` | element je iza drugog elementa (`reveal`) | ubaci korak `reveal` pre koraka koji koristi element |
| `movedTo` | podatak je prebačen na drugu jedinicu | testovi za taj podatak pripadaju toj jedinici |
| `notPortable` | ne postoji na telefonu (hover, desni klik) | element se ne računa u pokrivenost i ne testira se |

## 9. Conductor

**Broj agenata** (vrednosti su u `core/config.ts`):

- analizatori = `clamp(ceil(totalTokens / 60_000), 1, 4)`
- builderi = `min(spremne jedinice + zauzeti builderi, maxBuilders)`, najmanje 1 (D-021), podrazumevano `maxBuilders = 4`
- testeri = `max(1, ceil(builderi / 2))`, najviše `maxTesters`
- arhitekta = 1
- Broj se menja najviše jednom u minutu. Gasi se samo agent bez aktivne petlje. Promena odbijena unutar tog minuta računa se ponovo kad minut istekne. Svaka promena ide u `run.jsonl` kao `agents.rescaled` (sa razlogom), a ugašen agent kao `agent.stopped` (D-021).

**Izbor sledeće jedinice za buildera:**
1. sve `dependsOn` su promovisane;
2. testovi već postoje;
3. više tokova zavisi od nje;
4. veća pre manje.

Testeri uzimaju jedinice istim redom.

**Runde i eskalacija:** runde 1–2 na `MODELS.default` (`claude-haiku-4-5`), runde 3–4 na `MODELS.strong` (`claude-sonnet-4-6`) (D-023). Posle 4. neuspele runde jedinica je `failed`. Isti builder radi sve runde jedne jedinice, svaku sa svežim kontekstom (prompt + izvor + trenutni kod + poslednja greška).

**Timeouti (podrazumevano):** builder 10 min po rundi, tester 8 min po jedinici. Gatekeeper čeka testove 10 min, zatim Conductor dodeljuje jedinicu drugom testeru. Posle drugog isteka ekran se promoviše kao `nedokazan`. Tačno ponašanje je u D-016: Conductor prekida agenta (`cancel`); istek buildera je neuspela runda; posle drugog isteka testova Conductor šalje `tests.missing`; događaji iz ranije runde se ignorišu.

**429 i budžet (A16, D-024):** na svaki 429 ili 529 Conductor spušta granicu buildera za 1 (najmanje 1), najviše jednom u `DEFAULTS.rateLimitCooldownMs` (60 s). Novi 429 u tom vremenu znači još jedan korak dole kad vreme istekne, a mirno vreme vraća jednog buildera, do `--max-builders` (`rate.limited` i `rate.recovered` u logu). Na `budget.exceeded` nema novih zadataka ni novih rundi. Jedinice koje se grade odmah su `failed` („budget exceeded“), a njihovi agenti se prekidaju, jer bi im runner odbio svaki sledeći poziv. Predati nacrti se i dalje proveravaju, a Gatekeeper dobija `tests.missing` za ekrane čiji testovi neće stići. Ako budžet nestane pre plana, arhitekta se ne pokreće. Ishod prolaza je tada `budget.exceeded`.

## 10. Gatekeeper

**Kapije, redom** (prva koja padne vraća grešku builderu):
1. `parse`: TypeScript parser čita sve fajlove nacrta (D-008).
2. `forbiddenApis`: u nacrtu nema HTML tagova (svaki JSX tag malim slovom, npr. `div`, `span`, `p`, `button`), `window`, `document`, `localStorage`, `react-dom` ni `react-router-dom` (D-008).
3. `tsc`: nacrt + `app/` bez grešaka tipova.
4. `labels`: svaka labela i tekst iz testova jedinice **koji postoji u originalnom web kodu jedinice** postoji i u kodu nacrta; tekst koji dolazi iz podataka se preskače (D-008). Pravi dokaz ostaje kapija 5.
5. `scenarios`: svi testovi jedinice prolaze nad Expo web buildom.
6. (opciono) `androidExport`: `expo export --platform android` uspeva.

**Promocija** je jedna po jedna: kopiraj u `app/`, pusti testove svih već promovisanih jedinica (regresija). Ako regresija padne, vrati izmenu i pošalji `gate.failed` sa listom pokvarenih testova.

**Zajedničke jedinice** prolaze kapije 1–3 i 6 i nemaju sopstvene UI testove. Dokazuju se kroz ekrane koji ih koriste.

**Status ekrana** (`computeStatus`):

| Status | Uslov |
|---|---|
| `proven` (dokazan) | svi testovi prolaze, sve obaveze pokrivene, svi interaktivni elementi pokriveni ili `notPortable` |
| `partial` (delimično) | svi postojeći testovi prolaze, pokrivenost nepotpuna |
| `unproven` (nedokazan) | nema validiranih testova |
| `failed` (neuspeo) | testovi postoje, a ekran ih ne prolazi posle poslednje runde |

**Nula testova nikad nije `proven`.**

## 11. Testovi

**DSL** (`contracts/scenario.ts`): koraci `goto`, `tap {role,name} | {text}`, `fill {label,value}`, `expectVisible {text}`, `expectNotVisible {text}`. Scenario ima `id`, `unitId`, `obligation`, `setup?` (koraci pre testa), `apiFixture?`, `steps`. Nema brojanja: umesto toga tester navodi šta se vidi, a šta ne.

**Podaci:** originalna i mobilna aplikacija čitaju isti `examples/mock-api` (adresa iz okruženja: `VITE_API_URL` / `EXPO_PUBLIC_API_URL`). Stanje u klijentu (npr. omiljeni) priprema se kroz `setup` korake preko UI-ja, **ne** upisom u skladište, jer se ključevi razlikuju između weba i telefona.

**Validacija testa** (`validateScenario`), mora sve:
1. prolazi nad originalom (2 puta zaredom);
2. pada nad praznim ekranom (placeholder iz scaffold-a);
3. svaka `expect*` provera posle radnje **pada** kad se pusti pre te radnje.

**Izvršioci:** Playwright nad originalom (desktop, 1280×800), Playwright nad Expo web buildom (390×844), opciono Maestro YAML nad Android emulatorom. Za mobilne izvršioce prevodilac ubacuje `reveal` korake iz `hiddenBehind` razlika i skroluje do elementa pre provere.

**Pokrivenost** (`computeCoverage`): obaveze iz plana pokrivene testovima, plus interaktivni elementi originala (iz ARIA snapshota) korišćeni u bar jednom testu, minus `notPortable`.

**Testovi toka** (`Flow`) prelaze više jedinica i puštaju se tek kad su sve promovisane. Test toka je običan `Scenario` sa poljem `flowId`: `unitId` je prva jedinica toka, a `obligation` je ID toka. **Tok koji pada ne vraća nijedan ekran**, jer je svaki već dokazan svojim testovima, a vraćanje bi kvarilo druge tokove. Pad se samo prijavljuje u `results/flows/<flowId>.json` i u izveštaju (D-022).

**Ugovor za buildera:** labele polja i tekst dugmadi ostaju isti kao u originalu. Izgled sme da se menja. Da bi testovi našli elemente na Expo webu (D-005): dugme je `Pressable role="button"` sa `Text`, lista je `role="list"` sa stavkama `role="listitem"`, a polje je `TextInput accessibilityLabel` sa istom labelom kao na webu.

## 12. AI agenti

| Agent | Model | Alati | Izlaz | Prompt |
|---|---|---|---|---|
| Analizator | haiku-4-5 | `read_file`, `list_files` (samo njegov deo + zajednički fajlovi, samo čitanje) | `AnalyzerReport[]` (structured output) | `prompts/analyzer.md` |
| Arhitekta | sonnet-4-6 | nema | `Plan` (structured output) | `prompts/architect.md` |
| Tester | haiku-4-5 | `aria_snapshot`, `try_scenario`, `save_scenario` | validirani testovi preko `save_scenario` | `prompts/tester.md` |
| Builder | haiku-4-5 → sonnet-4-6 | `read_source`, `read_app`, `write_file`, `check_draft`, `submit_draft` | fajlovi u staging-u | `prompts/builder.md` + `prompts/web-to-rn.md` |

- Modeli u tabeli su oni koje nudi gateway hakatona i podrazumevani su u kodu (D-023). `WEMORA_MODEL_DEFAULT` i `WEMORA_MODEL_STRONG` u `.env` ih menjaju za drugi gateway (D-018).
- Svaki agent je zasebna instanca. Svaki zadatak ima svež kontekst. Jedna aktivna petlja po agentu.
- `save_scenario` prihvata samo scenarije koji prolaze `validateScenario`.
- `check_draft` pušta kapije 1–4 (brza provera), a `submit_draft` objavljuje `draft.submitted`.
- Builder **nema** alat za čitanje ni pisanje testova.
- Sav JSON od modela se proverava zod šemom iz `contracts/`. Pri grešci: najviše 2 ponovna pokušaja.

## 13. CLI

```
wemora migrate <web-dir> [--original-url <url>] [--out output] [--max-builders 4] [--max-testers 2] [--budget 5] [--mock] [--mock-dir <dir>]
wemora verify <run-dir>          # bez API ključa
wemora sabotage <run-dir> <unitId>
wemora archive <run-dir> [--name <name>]
```

`--mock` koristi MockRunner (bez API poziva), sa odgovorima iz `src/agents/mocks/<aplikacija>/` ili `--mock-dir` (D-013). `--budget` je tvrdi limit u dolarima po prolazu. `--original-url` je adresa pokrenutog originala za testera (D-014).

`verify` (B) ponovo pušta sve sačuvane testove završenog prolaza nad web exportom `app/`, bez modela i bez API ključa, ispisuje matricu ekran × test i vraća exit 1 ako bar jedan ekran sa statusom `proven` ili `partial` više ne prolazi. `sabotage` (B) menja jedan promovisan ekran **na mestu**, pa se pušta nad kopijom prolaza (npr. u `runs/`), nikad nad jedinim primerkom. Posle njega `verify` mora da padne baš na tom ekranu. `archive` (D-ov `archiveRun`) kopira završen prolaz u `runs/<name>/` bez `node_modules` i `staging/`, za commit; podrazumevano ime je `<app>-<yyyymmdd>-<hhmm>` iz run-id-ja.

## 14. Invarijante (moraju uvek da važe)

1. Domen ne uvozi Mozaik, agente ni orkestraciju.
2. Samo `core/runtime.ts` poziva `defineRuntime`.
3. BudgetedRunner nikad ne baca izuzetak.
4. Jedan agent, jedna aktivna petlja, svež kontekst po zadatku.
5. Događaji nose samo ID-jeve.
6. Builder piše samo u `staging/<builderId>/<unitId>/`. Samo Gatekeeper i scaffold pišu u `app/`.
7. Builder nikad ne čita niti piše testove.
8. Nula testova nikad nije `proven`.
9. Sav izlaz modela prolazi zod šemu pre upotrebe.
10. `verify` radi bez API ključa i daje isti rezultat svaki put.

## 15. Van obima

Next.js/SSR/RSC, Tailwind/shadcn, CSS-in-JS, auth i kolačići, native API-ji (kamera, push), iOS, objava u prodavnicama, piksel-poređenje, web-only biblioteke (mape, grafikoni).
