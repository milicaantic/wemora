# Zadaci: osoba A — orkestracija i Mozaik

Ovo su koraci osobe A iz `docs/tim-plan.md` (faze F0–F4), prepisani tako da svaki ima fajlove, potpise, kriterijum završetka i zavisnosti. Struktura sistema je u `docs/architecture.md`, tačni oblici podataka u `src/contracts/` (kod pobeđuje tekst), Mozaik API u `.claude/rules/mozaik.md` i `node_modules/@mozaik-ai/core/dist/index.d.ts`.

> **Stanje na dan 30. 10. 2026:** `src/` još ne postoji. Nema `tsconfig.json`, `zod` ni `vitest`, a `npm test` je placeholder iz `npm init`. Zato je prvi korak **A0: ugovori**. Svi potpisi u ovom fajlu su **predlog** dok A0 ne bude spojen u `main`. Posle toga važi kod u `src/contracts/`, a ovaj fajl se usklađuje sa njim.

**Moji folderi:** `src/contracts/` (vodim), `src/core/`, `src/orchestration/`, `src/agents/_shared/`, `src/cli.ts`, `scripts/check-layers.ts`.

**Pre svakog PR-a:** `git pull --rebase origin main && npm run build && npm test`, plus ažuriran `docs/status/a.md`.

**Oblik zadatka:** *Fajlovi i izvozi* → *Šta radi* → *Gotovo kad* → *Zavisnosti i mock*. Testovi su vitest, bez mreže i bez pravog modela.

## Pregled

| ID | Faza | Zadatak | Grana |
|---|---|---|---|
| **A0** | F0 | **Ugovori: modeli, događaji, potpisi** | `a/deps`, `contracts/initial` |
| A1 | F0 | Kostur repoa | `a/skeleton` |
| A2 | F0 | `scripts/check-layers.ts` | `a/skeleton` |
| A3 | F0 | Prazni `index.ts` sa potpisima | `a/skeleton` |
| | | **Kapija G0 (proverava A)** | |
| A4 | F1 | `core/config.ts` | `a/config` |
| A5 | F1 | Tabla i runtime | `a/config` |
| A6 | F1 | Log i safety | `a/config` |
| A7 | F1 | `BudgetedRunner` i `MockRunner` | `a/runner` (PR #20) |
| A8 | F1 | `agents/_shared/` | `a/runner` (PR #20) |
| A9 | F1 | Red zadataka | `a/runner` (PR #20) |
| A10 | F2 | Conductor | `a/conductor` |
| A11 | F2 | `cli migrate` | `a/conductor` |
| A12 | F2 | MockRunner odgovori za TodoMVC | `a/mock-todomvc` |
| A13 | F2 | Timeouti | `a/timeouts` |
| | | **Kapija G2 (proverava A)** | |
| A14 | F3 | Broj agenata po formulama | `a/scaling` |
| A15 | F3 | Eskalacija modela | `a/scaling` |
| A16 | F3 | 429 i `budget.exceeded` | `a/load-control` |
| A17 | F3 | Dodavanje testera u toku rada (opciono) | `a/load-control` |
| A18 | F3 | `cli verify` i `cli sabotage` | `a/cli-verify` |
| A19 | F4 | Stabilizacija | `a/fix-<opis>` |

Brojevi prate redosled rada: A4 nema zavisnosti, a A5–A9 se oslanjaju na prethodne.

**Grane od F2 (2–4 PR-a po fazi, tim-plan §2):** zadaci idu u istu granu kad menjaju iste fajlove i ne čekaju nikoga, a u posebnu kad čekaju tuđi kod ili odluku tima.
- F2: `a/conductor` (A10 + A11, rade nad lažnim agentima) → `a/timeouts` (A13, čeka odluke P9 i P10) → `a/mock-todomvc` (A12, čeka agente B, C i D; integracija za G2).
- F3: `a/scaling` (A14–A17, sve je ponašanje Conductora u istim fajlovima) i `a/cli-verify` (A18, čeka B-ov `verify()`).
- F4: po jedna `a/fix-<opis>` grana po popravci iz crvenog tima.

---

## A0 — Ugovori: modeli, događaji i potpisi

**Cilj:** pre bilo kakvog koda u `core/` i domenu, u `src/contracts/` treba da stoje svi tipovi i zod šeme iz `architecture.md` i potpisi javnih funkcija iz `tim-plan.md` §1. Ceo tim pregleda PR (tim-plan §4, „Svi zajedno“), a spaja ga A.

**Pravila za `src/contracts/`:**
- Uvozi samo `zod` i druge fajlove iz `contracts/` (vidi P1). Bez Mozaika, bez `node:*` i bez logike osim šema.
- Tip koji stiže spolja (od modela ili sa diska) ima zod šemu: `XSchema` i `type X = z.infer<typeof XSchema>`. U blokovima ispod to označava `// + schema`. Tabla i potpisi funkcija su samo TypeScript tipovi.
- Uvozi idu u jednom smeru: `scenario.ts` → `difference.ts` → `types.ts` → `state.ts`, `api.ts`. Kod kružnog uvoza zod šema je u runtime-u `undefined`.
- Oznaka *(predlog)* znači da `architecture.md` ne zadaje to polje ili ime. Vlasnik tog dela ga potvrđuje ili menja na review-u.

### A0.0 Preduslov: alati za ugovore
- **Fajlovi:** `package.json` i `package-lock.json` (zaseban PR `a/deps`, tim-plan §2.5), `tsconfig.json`, `vitest.config.ts`.
- **Šta radi:** dodaje `zod` 4 (dependency) i `vitest` (devDependency), uz skripte `build: tsc --noEmit` i `test: vitest run`. `tsconfig` je `strict` sa `module: ESNext`, `moduleResolution: Bundler` (uvozi bez ekstenzije, kao u primerima iz `mozaik.md`), `noEmit` i `include: ["src"]`, a `templates/` i `examples/` su van njega. Zod 4 zato što ima `z.toJSONSchema()`, koji pravi JSON Schemu za Mozaik `structuredOutput`. Sa zod 3 bi trebala još jedna biblioteka.
- **Gotovo kad:** na čistom klonu prolazi `npm ci && npm run build && npm test` (vitest sa `passWithNoTests: true`).
- **Zavisnosti i mock:** tim u chatu odobri nove pakete pre PR-a (P15).

### A0.1 `src/contracts/scenario.ts`: DSL testova (§11)
```ts
export type TapTarget = { role: string; name: string } | { text: string }      // + schema
export type Step =                                                              // + schema, .strict(), tačno jedan ključ po koraku
  | { goto: string }
  | { tap: TapTarget }
  | { fill: { label: string; value: string } }
  | { submit: { label: string; value: string } }                                // dodao B (D-017, PR #56): fill pa Enter
  | { expectVisible: { text: string } }
  | { expectNotVisible: { text: string } }
export type Scenario = {                                                        // + schema
  id: string; unitId: string; obligation: string                               // obligation = Obligation.id iz plana
  setup?: Step[]; apiFixture?: string; steps: Step[]                           // nema `seed` (P18)
}
```

### A0.2 `src/contracts/difference.ts`: namerne razlike (§8)
```ts
export type ElementRef = TapTarget | { label: string }                                         // + schema (predlog)
export type HiddenBehind = { kind: "hiddenBehind"; element: ElementRef; reveal: TapTarget }     // + schema; prevodilac ubacuje `tap reveal`
export type MovedTo      = { kind: "movedTo"; what: string; toUnit: string }                    // + schema (predlog polja)
export type NotPortable  = { kind: "notPortable"; element: { role: string; name: string }; reason: string } // + schema (predlog polja)
export type IntentionalDifference = HiddenBehind | MovedTo | NotPortable                       // + schema, z.discriminatedUnion("kind")
```

### A0.3 `src/contracts/types.ts`: parser, analiza, plan, rezultati (§3, §8, §10)
```ts
// Parser (D)
export type ParsedRoute  = { path: string; file: string; files: string[]; tokens: number; webApis: string[] }   // + schema (predlog)
export type AnalysisPart = { id: string; routes: string[]; files: string[]; tokens: number }                    // + schema (predlog)
export type ParsedApp    = { webDir: string; routes: ParsedRoute[]; sharedFiles: string[]; totalTokens: number; parts: AnalysisPart[] } // + schema; delovi: P4

// Analizator (D), jedan izveštaj po ekranu
export type AnalyzerReport = {                                                                                   // + schema (predlog)
  partId: string; route: string; screen: string; summary: string
  files: string[]; components: string[]; dataSources: string[]; navigatesTo: string[]
  webApis: string[]; mobileIssues: string[]; suggestedObligations: string[]
}

// Plan (arhitekta, D)
export type Obligation = { id: string; description: string }                                                     // + schema (predlog)
export type Unit = {                                                                                             // + schema, polja tačno iz §8
  id: string; kind: "shared" | "screen"; wave: number; route?: string
  sources: string[]; writes: string[]; dependsOn: string[]
  obligations: Obligation[]; intentionalDifferences: IntentionalDifference[]; size: number                       // size u tokenima
}
export type Flow = { id: string; description: string; unitIds: string[] }                                        // + schema (predlog, P12)
export type Plan = { units: Unit[]; flows: Flow[]; routeMap: Record<string, string> }                           // + schema; routeMap: web putanja → Expo ruta (predlog)

// Provera (B, C)
export type ScreenStatus = "proven" | "partial" | "unproven" | "failed"
export type GateName = "parse" | "forbiddenApis" | "tsc" | "labels" | "scenarios" | "androidExport" | "regression" // "regression" je predlog
export type GateResult = { unitId: string; round: number; gate: GateName; ok: boolean; message: string; brokenTests?: string[] } // + schema
export type ScenarioResult = { scenarioId: string; unitId: string; ok: boolean; failedStep?: number; error?: string; durationMs: number } // + schema (predlog)
export type InteractiveElement = { role: string; name: string }                                                  // + schema (predlog)
export type Coverage = {                                                                                         // + schema (predlog)
  unitId: string
  obligations: { covered: string[]; missing: string[] }
  elements: { covered: InteractiveElement[]; missing: InteractiveElement[]; notPortable: InteractiveElement[] }
}
export type UnitResult = {                                                                                       // + schema; results/<unitId>.json (predlog)
  unitId: string; status: ScreenStatus; rounds: number
  gates: GateResult[]; scenarios: ScenarioResult[]; coverage: Coverage | null; reason?: string
}
```

### A0.4 `src/contracts/state.ts`: oblik table (§6)
```ts
export type UnitStatus = "waiting" | "building" | "submitted" | "promoted" | "failed"
export type UnitState = {
  status: UnitStatus; round: number; model: string | null; builderId: string | null
  testerId: string | null; testAttempts: number                       // predlog, za timeout testova (P9)
}
export type AgentKind = "analyzer" | "architect" | "tester" | "builder" | "gatekeeper" | "conductor"
export type AgentInfo = { id: string; kind: AgentKind; busyWith: string | null; joinedAt: string }
export type LedgerEntry = { agentId: string; calls: number; inputTokens: number; outputTokens: number; usd: number }
export type RunConfig = { webDir: string; runDir: string; maxBuilders: number; maxTesters: number; budgetUsd: number; mock: boolean }

export interface MigrationStateFields {                                // ime: P2
  runId: string
  parsed: ParsedApp | null
  reports: Record<string, AnalyzerReport[]>                            // ključ: partId
  plan: Plan | null
  units: Record<string, UnitState>                                     // ključ: unitId (isto i ispod)
  tests: Record<string, Scenario[]>
  results: Record<string, UnitResult>
  coverage: Record<string, Coverage>
  statuses: Record<string, ScreenStatus>
  agents: Record<string, AgentInfo>                                    // ključ: agentId
  ledger: Record<string, LedgerEntry>
  config: RunConfig
}
```
`Record` umesto `Map`, da se tabla može ispisati kao JSON u log.

Ko piše koje polje (predlog, da dva dela ne pišu isto): Conductor piše `parsed`, `units`, `agents`, `ledger` i `config`; analizator `reports`; arhitekta `plan`; tester `tests`; Gatekeeper `results`, `coverage` i `statuses`.

### A0.5 `src/contracts/events.ts`: događaji (§5)
```ts
export const EVENTS = {
  analysisDone: "analysis.done", planReady: "plan.ready", testsReady: "tests.ready",
  draftSubmitted: "draft.submitted", gateFailed: "gate.failed", unitPromoted: "unit.promoted",
  budgetExceeded: "budget.exceeded",
} as const
export const MOZAIK_EVENTS = { participantJoined: "participant.joined", participantLeft: "participant.left" } as const
export type EventName = (typeof EVENTS)[keyof typeof EVENTS]
export type EventPayloads = {
  "analysis.done": { partId: string }
  "plan.ready": Record<string, never>
  "tests.ready": { unitId: string }
  "draft.submitted": { unitId: string; round: number }
  "gate.failed": { unitId: string; round: number }
  "unit.promoted": { unitId: string }
  "budget.exceeded": Record<string, never>
}
export const EventPayloadSchemas: { [E in EventName]: z.ZodType<EventPayloads[E]> }   // .strict(): samo ID-jevi (invarijanta 5)
```

### A0.6 `src/contracts/api.ts`: potpisi javnih funkcija domena (tim-plan §1) *(predlog imena fajla)*
Svaki domenski `index.ts` izvozi `export const parseApp: ParseApp = …`, pa `tsc` javlja čim se potpis i implementacija raziđu. Argumenti su prepisani iz tim-plan.md, a povratni tipovi koje tim-plan ne navodi su predlog.
```ts
// D: analysis/, report/
export type ParseApp     = (webDir: string) => Promise<ParsedApp>
export type SplitParts   = (parsed: ParsedApp, n: number) => AnalysisPart[]                    // predlog, P4
export type ValidatePlan = (plan: Plan, parsed: ParsedApp) => string[]                         // prazna lista = ok
export type BuildReport  = (runDir: string) => Promise<string>                                 // putanja do report.html

// B: scenarios/, verify/
export type Viewport = { width: number; height: number }
export type RunScenarios       = (baseUrl: string, scenarios: Scenario[], opts: { viewport: Viewport; differences: IntentionalDifference[] }) => Promise<ScenarioResult[]>
export type ValidateScenario   = (originalUrl: string, blankUrl: string, scenario: Scenario) => Promise<{ ok: boolean; reason?: string }>
export type ExtractInteractive = (url: string, route: string) => Promise<InteractiveElement[]>
export type ComputeCoverage    = (unit: Unit, scenarios: Scenario[], interactive: InteractiveElement[]) => Coverage
export type Verify   = (runDir: string) => Promise<{ ok: boolean; results: Record<string, ScenarioResult[]> }>
export type Sabotage = (runDir: string, unitId: string) => Promise<void>

// C: scaffold/, gatekeeper/  (vidi P16)
export type Scaffold      = (plan: Plan, outDir: string) => Promise<void>
export type CheckDraft    = (unitId: string, draftDir: string, tests: Scenario[]) => Promise<GateResult[]>
export type Promote       = (unitId: string, draftDir: string) => Promise<void>
export type Rollback      = (unitId: string) => Promise<void>
export type ServeApp      = (appDir: string) => Promise<{ url: string; close: () => Promise<void> }>
export type ComputeStatus = (input: { tests: Scenario[]; results: ScenarioResult[]; coverage: Coverage | null; roundsExhausted: boolean }) => ScreenStatus
```

### A0.7 `src/contracts/index.ts` i testovi ugovora
- `index.ts` ponovo izvozi sve iz A0.1–A0.6.
- `src/contracts/contracts.test.ts` proverava:
  1. primer scenarija iz `wemora-plan.md` §4.1 prolazi `ScenarioSchema`;
  2. korak `{ "click": … }` i korak sa dva ključa (`goto` i `tap`) padaju;
  3. ručno napisan `Plan` za Recepte (u samom testu: 2 zajedničke jedinice, 5 ekrana) prolazi `PlanSchema`, a `kind: "page"` pada;
  4. sve tri vrste namerne razlike prolaze, a nepoznat `kind` pada;
  5. `EventPayloadSchemas["unit.promoted"]` odbija `{ unitId: "u1", code: "…" }`.

**Gotovo kad (ceo A0):**
- `npm run build && npx vitest run src/contracts` je zeleno;
- `grep -rhoE 'from "[^"]+"' src/contracts | sort -u` prikazuje samo `zod` i `./…`;
- B, C i D su u chatu potvrdili tipove svog dela.

**Zavisnosti i mock:** review od B (`scenario.ts`, `ScenarioResult`, `Coverage`, `InteractiveElement`), C (`GateResult`, `UnitResult`, potpisi za scaffold i Gatekeeper) i D (`ParsedApp`, `AnalyzerReport`, `Plan`, `SplitParts`). Dok traje review, A radi A1 i A2, jer ne zavise od oblika tipova.

---

## F0: Temelj

### A1 — Kostur repoa ✅ 2026-10-30
- **Fajlovi:** `package.json` (skripte), `.env.example`, `.gitignore`, `docs/decisions.md`, `docs/status/a.md`. Nema izvoza.
- **Šta radi:** dodaje skripte iz `CLAUDE.md` (`build`, `test`, `migrate`, `migrate:mock`, `verify`, `sabotage`, `smoke`), koje do A11 i A18 javljaju „not implemented“. `.env.example` sadrži samo `ANTHROPIC_API_KEY=` i komentar da se `MOZAIK_*` ključevi ne dodaju (mozaik.md §8). `.gitignore` dobija `output/`, a `runs/` ostaje u gitu. Pravi prazan `docs/decisions.md` sa šablonom zapisa (datum, odluka, zašto, ko), jer ga C puni već u F1.
- **Gotovo kad:** na čistom klonu prolazi `npm ci && npm run build && npm test`; `git check-ignore output/x` vraća putanju; `grep -E "^MOZAIK" .env.example` ne vraća ništa.
- **Zavisnosti i mock:** A0.0.

### A2 — `scripts/check-layers.ts` ✅ 2026-10-30
Umesto `.sh` je `.ts` preko `tsx`, jer niko u timu nema Git Bash (P14, `docs/decisions.md` D-004).
- **Fajlovi:** `scripts/check-layers.ts`, `scripts/check-layers.test.ts`; u `package.json` skripta postaje `build: tsc --noEmit && tsx scripts/check-layers.ts`.
- **Izvozi:**
  ```ts
  export type Violation = { file: string; line: number; rule: string; message: string }
  export function checkLayers(srcDir: string): Violation[]
  ```
- **Šta radi:** uvoze u `src/` čita TypeScript-ov `ts.preProcessFile` (svi oblici uvoza, bez komentara) i proverava pravila iz §2 i §14:
  1. `layer-order`: sloj uvozi samo slojeve ispod sebe;
  2. `domain-no-mozaik`: domen ne zavisi od `@mozaik-ai/core` ni direktno ni preko drugih fajlova (npr. domen → `core/runner.ts` → Mozaik); time je rešen i P3;
  3. `domain-via-index`: drugi domenski folder se uvozi samo preko njegovog `index.ts`;
  4. `core-mozaik`: u `core/` samo `runtime.ts`, `state.ts` i `runner.ts` uvoze Mozaik (i test fajlovi u `core/`, od A5, jer testovi runtime-a trebaju prave Mozaik učesnike);
  5. `contracts-imports`: `contracts/` uvozi samo `zod` i sopstvene fajlove (testovi i `vitest`);
  6. `single-runtime`: `defineRuntime()` se poziva samo u `core/runtime.ts`;
  7. `unknown-layer`: fajl van poznatih foldera slojeva.

  Za svako kršenje ispisuje `fajl:linija [pravilo] poruka` i vraća exit 1.
- **Gotovo kad:** `npx vitest run scripts` (10 testova, svako pravilo nad privremenim lažnim `src/` i jedan nad pravim `src/`); `npm run build` prolazi; privremeni `import "@mozaik-ai/core"` u `src/scenarios/index.ts` obara `npm run build` sa exit 1 (stavka G0, provereno u PowerShell-u).
- **Zavisnosti i mock:** nema.

### A3 — Prazni `index.ts` sa potpisima ✅ 2026-10-30
- **Fajlovi:** `src/{analysis,scenarios,gatekeeper,scaffold,report,verify}/index.ts`. `src/orchestration/` i `src/agents/_shared/` dobijaju sadržaj tek u A8–A10, pa za njih nema praznih fajlova.
- **Izvozi:** svaki domenski `index.ts` izvozi funkcije svog vlasnika sa tipom iz `contracts/api.ts`, npr. `export const parseApp: ParseApp`.
- **Šta radi:** svaka funkcija baca `new Error("not implemented: <ime>")`. Tako svi od prvog dana uvoze prave potpise, a `tsc` odmah javlja kad se potpis i implementacija raziđu. Posle G0 vlasnik foldera menja telo funkcije, a potpis samo kroz granu `contracts/<opis>`.
- **Gotovo kad:** `npm run build` prolazi, a postoji `index.ts` u svih 6 domenskih foldera (`ls src/*/index.ts`).
- **Zavisnosti i mock:** A0.

### Kapija G0 (proverava A)
Lista je u tim-plan.md §4. A je pušta na čistom klonu, uključujući proveru iz A2 da `check-layers` pada na `import "@mozaik-ai/core"` u `src/scenarios/`.

---

## F1: Delovi rade sami

### A4 — `core/config.ts` ✅ 2026-10-30
- **Fajlovi:** `src/core/config.ts`, `src/core/config.test.ts`.
- **Izvozi:**
  ```ts
  export const MODELS = { default: "claude-haiku-4-5", strong: "claude-sonnet-4-6" }   // D-023; .env ih menja (D-018)
  export type ModelName = (typeof MODELS)[keyof typeof MODELS]
  export const PRICING: Record<ModelName, { inputPerMTok: number; outputPerMTok: number }>
  // haiku-4-5: 1 / 5; sonnet-4-6: 3 / 15 (D-023)
  export const DEFAULTS = {
    maxBuilders: 4, maxTesters: 2, budgetUsd: 5,
    tokensPerAnalyzer: 60_000, maxAnalyzers: 4, maxRounds: 4, escalationRound: 3,
    maxSchemaRetries: 2, maxPlanRetries: 2, rescaleIntervalMs: 60_000,
    builderRoundTimeoutMs: 600_000, testerUnitTimeoutMs: 480_000, testsWaitTimeoutMs: 600_000,
  } as const
  export function analyzerCount(totalTokens: number): number                          // clamp(ceil(t / 60_000), 1, 4)
  export function builderCount(readyUnits: number, busyBuilders: number, maxBuilders: number): number
  export function testerCount(builders: number, maxTesters: number): number            // min(max(1, ceil(b / 2)), maxTesters)
  export function modelForRound(round: number): ModelName                              // 1–2 → default, 3–4 → strong
  export function costUsd(model: string, inputTokens: number, outputTokens: number): number
  ```
- **Šta radi:** sve brojke iz §9 i cene modela su na jednom mestu, kao čiste funkcije bez Mozaika, pa ih sme uvesti i domen (P3). Conductor, runner i timeouti čitaju vrednosti samo odavde, nigde drugde nema brojeva ni imena modela. `costUsd` računa i keširane tokene (D-020).
- **Gotovo kad:** `npx vitest run src/core/config.test.ts`:
  - `analyzerCount`: 0 → 1, 60 000 → 1, 60 001 → 2, 10 000 000 → 4;
  - `builderCount(5, 0, 4)` = 4, `(1, 0, 4)` = 1, `(0, 2, 4)` = 2;
  - `testerCount(4, 2)` = 2, `(1, 2)` = 1, `(0, 2)` = 1;
  - `modelForRound`: 1 i 2 → haiku, 3 i 4 → sonnet, 5 → greška;
  - `costUsd("claude-haiku-4-5", 100_000, 1_000_000)` = 5.1; model bez cene → greška (D-023; prvobitno sa cenama 5-5).
- **Zavisnosti i mock:** nema.

### A5 — Tabla i runtime ✅ 2026-10-30
- **Fajlovi:** `src/core/state.ts`, `src/core/runtime.ts`, `src/core/runtime.test.ts`.
- **Nalaz iz Mozaik izvora:** `sendEvent` (pa i `emit`) baca `Participant <id> not found` ako pošiljalac nije uradio `join`. Conductor, Gatekeeper-učesnik i svaki agent moraju da se pridruže pre prvog događaja. Ako se `emit` poziva u handleru, to mora biti unutar async funkcije sa `.catch`, inače greška stiže do pošiljaoca događaja (mozaik.md §6).
- **Izvozi:**
  ```ts
  // state.ts
  export class MigrationState extends RuntimeState implements MigrationStateFields { /* polja iz contracts/state.ts */ }
  export function createInitialState(runId: string, config: RunConfig): MigrationState
  // runtime.ts, jedino mesto sa defineRuntime
  export const { initializeRuntime, resolveRuntime, resolveParticipant, join, leave, sendMessage, sendEvent, runLoop } = defineRuntime<MigrationState>()
  export function board(): MigrationState                                                        // resolveRuntime().state
  export function emit<E extends EventName>(type: E, payload: EventPayloads[E], senderId: string): void  // SemanticEvent.create + sendEvent
  ```
- **Šta radi:** tabla je jedna instanca `MigrationState` sa poljima iz `contracts/state.ts` i praznim početnim vrednostima (`plan: null`, prazni `Record`-i). `emit` je jedini način na koji naš kod šalje događaj: tip payload-a dolazi iz `EventPayloads`, pa nije moguće poslati podatke umesto ID-jeva. Runtime se inicijalizuje jednom po procesu (A11), sa runnerom iz A7.
- **Gotovo kad:** `npx vitest run src/core/runtime.test.ts`:
  1. `createInitialState` ima svih 12 polja iz §6;
  2. drugi poziv `initializeRuntime` baca `Runtime already initialized`;
  3. `createHuman` učesnik posle `join` dobija događaj poslat sa `emit("unit.promoted", { unitId: "u1" }, "test")`, i to i kad je on sam pošiljalac (mozaik.md §6);
  4. `emit("unit.promoted", { unitId: "u1", code: "x" }, …)` ne prolazi `tsc` (proverava se sa `// @ts-expect-error`).
- **Zavisnosti i mock:** A0. **Rizik:** runtime postoji jednom po procesu, a vitest deli module unutar jednog test fajla. Zato su svi testovi koji trebaju runtime u istom fajlu, ili Conductor dobija `emit`, `join` i `leave` kao parametre (A10).

### A6 — Log i safety ✅ 2026-10-30
- **Fajlovi:** `src/core/log.ts`, `src/core/safety.ts`, `src/core/log.test.ts`.
- **Izvozi:**
  ```ts
  export type LogEntry = { t: string; agent: string; event: string; costUsd?: number; data?: unknown }
  export function initLog(runDir: string): void                 // output/<run>/run.jsonl, pravi folder ako ne postoji
  export function log(entry: Omit<LogEntry, "t">): void          // jedna JSON linija, t = ISO vreme; nikad ne baca
  export function handleUnhandledRejection(reason: unknown): void
  export function installSafety(): void                           // process.on("unhandledRejection") → log + stderr, proces nastavlja
  ```
- **Napomene iz implementacije:** `log` pre `initLog` piše na stderr; podaci koji ne mogu u JSON (kružna referenca) postaju `"[unserializable]"`. `uncaughtException` se namerno ne hvata, jer posle sinhronog pada stanje procesa nije pouzdano. Proces koji preživi neuhvaćenu grešku proveren je i van vitest-a (bez `installSafety` exit 1, sa njim exit 0).
- **Šta radi:** `log` sinhrono dopisuje jednu JSON liniju u `run.jsonl`, pa je redosled linija isti kao redosled događaja (D iz toga crta vremensku osu). Fajl ne uvozi Mozaik, pa ga sme koristiti i domen. `installSafety` je poslednja linija odbrane ako petlja ipak baci grešku.
- **Gotovo kad:** `npx vitest run src/core/log.test.ts` (5 testova):
  1. posle `initLog(tmp)` i dva poziva `log` fajl ima 2 linije, a svaka se parsira kao JSON sa `t`, `agent` i `event`;
  2. kružni podaci i poziv pre `initLog` ne bacaju grešku;
  3. `handleUnhandledRejection` upiše liniju sa `event: "unhandledRejection"`, a `installSafety` dvaput registruje handler samo jednom. Test zove handler direktno, jer bi pravi `unhandledRejection` uhvatio i vitest.
- **Zavisnosti i mock:** nema.

### A7 — `BudgetedRunner` i `MockRunner` ✅ 2026-10-30
**Odstupanja od plana ispod (urađeno ovako):**
- `registerContext(context: ModelContext, meta)` prima sam kontekst, ne `contextId`, i čuva ga u `WeakMap`-u, pa završeni zadaci ne ostaju u memoriji.
- Anthropic SDK već sam radi 2 ponovna pokušaja (429, 5xx, prekid veze), a Mozaik ne dozvoljava da se to isključi. Naš retry je iznad toga: `DEFAULTS.apiRetries = 2`, pauza `apiRetryBaseMs = 5000` × 2^pokušaj. Ne ponavljaju se 400, 401, 403 i 404.
- Model bez cene u `PRICING` se odbija (bez cene budžet ne može da se sprovede), npr. `claude-haiku-4-5`.
- Izvozi se i `errorOutput(reason)` (poruka sa `__WEMORA_ERROR__`) za A8.
- `onUsage`, `onBudgetExceeded` i `onRateLimited` su zaštićeni: ako callback baci grešku, runner je upiše u log i nastavlja.
- Poznato ograničenje: provera budžeta je pre poziva, pa paralelni agenti mogu malo da pređu limit (najviše za cenu poziva koji su već krenuli).
- Testovi (16): uz slučajeve ispod, pravi Mozaik `runLoop` nad `MockRunner`-om poziva alat i završava skriptovanim odgovorom.

- **Fajlovi:** `src/core/runner.ts`, `src/core/runner.test.ts`.
- **Izvozi:**
  ```ts
  export const WEMORA_ERROR = "__WEMORA_ERROR__"
  export const models: typeof supportedModels                        // ugrađeni; oba modela su tu (D-023)
  export type TaskMeta = { agentId: string; kind: AgentKind; taskId?: string; round?: number }
  export function registerContext(contextId: string, meta: TaskMeta): void   // zove ga freshContext (A8)

  export type UsageRecord = { agentId: string | null; model: string; inputTokens: number; outputTokens: number; usd: number }
  export type BudgetedRunnerOptions = {
    budgetUsd: number
    onBudgetExceeded: () => void            // Conductor šalje budget.exceeded
    onUsage?: (u: UsageRecord) => void      // Conductor puni ledger i log
    onRateLimited?: () => void              // A16
    models?: typeof supportedModels         // test ubacuje lažni endpoint
    maxRetries?: number
    sleep?: (ms: number) => Promise<void>   // test ne čeka backoff
  }
  export class BudgetedRunner implements InferenceRunner {
    constructor(opts: BudgetedRunnerOptions)
    run(input: InferenceInput): Promise<InferenceOutput>           // nikad ne baca
    stream(input: InferenceInput): AsyncGenerator<SemanticEvent>   // ne koristimo; grešku vraća kao output
    spentUsd(): number
  }

  export type MockReply = { text: string } | { call: { name: string; args: Record<string, unknown> } } | { json: unknown }
  export type MockFixture = Record<string, MockReply[]>             // ključ: "kind:taskId:round", "kind:taskId" ili "kind"
  export const MockFixtureSchema: z.ZodType<MockFixture>
  export function loadMockFixture(path: string): MockFixture
  export class MockRunner implements InferenceRunner { constructor(fixture: MockFixture); /* run, stream */ }
  ```
- **Šta radi:** `BudgetedRunner` je jedini put do pravog modela. Na 429, 529 i mrežne greške radi retry sa backoff-om, a posle poslednjeg pokušaja vraća poruku `__WEMORA_ERROR__ …` umesto izuzetka. Odgovor bez poruke i bez poziva alata dopunjuje greškom (mozaik.md §2). Pre svakog poziva proverava potrošnju: preko limita ne zove model, vraća grešku i jednom poziva `onBudgetExceeded`. Runner ne zna koji agent zove, pa agenta nalazi preko `context.id`, koji registruje `freshContext`. `ModelContext` zadržava isti `id` kroz celu petlju, što sam proverio u `dist/index.mjs`. `MockRunner` za svaki kontekst vraća odgovore po redu, a za nepoznat ključ ili kraj liste vraća `__WEMORA_ERROR__`, nikad izuzetak.
- **Gotovo kad:** `npx vitest run src/core/runner.test.ts` (lažni endpoint, bez mreže):
  1. 429, 429, pa uspeh → vraća uspeh; endpoint je pozvan 3 puta, a `onRateLimited` 2 puta;
  2. endpoint koji uvek baca → `run` vraća poruku sa `__WEMORA_ERROR__` i ne baca;
  3. odgovor koji ima samo `ReasoningItem` → `items` sadrži poruku `__WEMORA_ERROR__ empty output`;
  4. limit $0.001, a prvi poziv ga premaši → drugi poziv ne stiže do endpointa, a `onBudgetExceeded` je pozvan tačno jednom;
  5. `onUsage` dobija `agentId` iz `registerContext` i `usd` iz `costUsd` (A4);
  6. `models` sadrži `MODELS.default` i `MODELS.strong` (`claude-haiku-4-5`, `claude-sonnet-4-6`);
  7. `MockRunner`: `{ call }` postaje `FunctionCallItem` sa tim imenom i argumentima u JSON-u, `{ json }` postaje tekstualna poruka sa JSON-om, ključ `builder:u1` ima prednost nad `builder`, a nepoznat ključ vraća grešku.
- **Zavisnosti i mock:** A4, A0 (`AgentKind`). Prave odgovore agenata dobijam u A12, a do tada koristim ručne primere u testu.

### A8 — `agents/_shared/` ✅ 2026-10-30
**Odstupanja od plana ispod (urađeno ovako):**
- Fajlovi: `context.ts`, `guards.ts` (`OwnershipGuard`, `CancelGuard`, `composeGuards` zajedno), `schema.ts`, `tools.ts`, `run.ts`, `handle.ts`, `index.ts`, test `shared.test.ts` (25 testova).
- Novo: `toModelSchema(schema)` pravi JSON Schemu iz zod-a i briše ključeve koje Anthropic strict režim ne prima (`$schema`, `minLength`, `maxLength`, `minimum`, `maximum`, `propertyNames`, `minItems > 1`…; `oneOf` → `anyOf`). Koriste ga `runStructured` i `defineTool`; odgovor se i dalje proverava punom zod šemom. Ovo je D-ov predlog iz `docs/status/d.md`.
- `AgentTask.tools` je opciono. `isAgentBusy(agent)` je izvezen, za `AgentHandle.isBusy()`.
- `runTask` odbija agenta koji nije uradio `join`, jer inače ne bi dobio sopstveni `model.answer`.
- Greška runnera ili API-ja (`__WEMORA_ERROR__`) u `runStructured` se ne ponavlja: to nije greška modela.
- `runTask` nema sopstveni timeout; timeoute vodi Conductor preko `CancelGuard`-a (A13).

- **Fajlovi:** `src/agents/_shared/{context,ownershipGuard,cancelGuard,tools,run,handle,index}.ts`, `src/agents/_shared/shared.test.ts`.
- **Izvozi:**
  ```ts
  export function freshContext(prompt: string, meta: TaskMeta): ModelContext
  export class OwnershipGuard implements InterceptionHandler {
    constructor(prefix: string)
    isSatisfiedBy(t: ExecutableTransition): boolean                  // write_file van prefiksa → true; nikad ne baca
    handle(t: ExecutableTransition): Promise<ExecutableTransition>   // "Rejected: you may only write in <prefix>"
  }
  export class CancelGuard implements InterceptionHandler { cancel(reason: string): void /* + isSatisfiedBy, handle */ }
  export function composeGuards(...guards: InterceptionHandler[]): InterceptionHandler   // runLoop prima samo jedan
  export function defineTool<S extends z.ZodObject>(spec: {
    name: string; description: string; args: S; invoke: (args: z.infer<S>) => Promise<string | object>
  }): Tool
  export type AgentTask = { prompt: string; message: string; meta: TaskMeta; model: string; maxOutputTokens: number; tools: Tool[]; guard?: InterceptionHandler }
  export type TaskResult<T = string> = { ok: true; value: T } | { ok: false; error: string }
  export function runTask(agent: Agent, task: AgentTask): Promise<TaskResult>
  export function runStructured<T>(agent: Agent, task: AgentTask, schema: z.ZodType<T>): Promise<TaskResult<T>>

  // handle.ts: interfejs Conductor ↔ agenti (P6)
  export interface AgentHandle<TTask> { id: string; kind: AgentKind; participant: Participant; isBusy(): boolean; assign(task: TTask): void; cancel(reason: string): void }
  export type AnalyzeTask   = { partId: string }
  export type ArchitectTask = { partIds: string[] }
  export type TestTask      = { unitId: string }
  export type BuildTask     = { unitId: string; round: number; model: string; lastError: string | null }
  ```
- **Šta radi:** `freshContext` pravi nov `ModelContext` sa promptom i registruje ga za runner, pa nijedan zadatak ne koristi `agent.getMemory()`. `runTask` pokreće `runLoop` i čeka `model.answer` tog agenta preko privremenog handlera (`getHandlers`/`setHandlers`, filtrira po `type` i `producerId`). Odbija drugi zadatak dok je petlja aktivna. `runStructured` šalje `structuredOutput` napravljen sa `z.toJSONSchema(schema)`, proverava odgovor zod-om i najviše 2 puta vraća modelu grešku. `OwnershipGuard` normalizuje putanju (`..`, `\`) pre poređenja sa prefiksom. `CancelGuard` završava petlju sintetičkim `model_message` na sledećem prelazu; Mozaik proverava interception pre svakog prelaza (`AgentLoop.run` u `index.mjs`).
- **Gotovo kad:** `npx vitest run src/agents/_shared` (`MockRunner` iz A7, bez mreže):
  1. guard sa prefiksom `staging/b1/u1/` propušta `staging/b1/u1/src/screens/u1/A.tsx`, a odbija `app/src/x.tsx`, `staging/b1/u1/../../../app/x`, `staging\b1\u1\..\..\..\app\x`, `staging/b1/u10/x` i `args` koji nisu ispravan JSON;
  2. `runTask` sa skriptom [`write_file` u `app/x`, pa tekst „done“]: `invoke` alata nije pozvan, model dobija „Rejected…“, a rezultat je `{ ok: true, value: "done" }`;
  3. `runStructured` sa skriptom [neispravan JSON, ispravan JSON] vraća `ok` posle jednog ponovnog pokušaja; sa tri neispravna vraća `{ ok: false }` posle tačno 3 poziva modela;
  4. drugi `runTask` na istom agentu dok prvi radi vraća `{ ok: false, error: "agent busy" }`;
  5. `CancelGuard.cancel("timeout")` usred skripte završava petlju sa `__WEMORA_ERROR__ timeout`, bez novih poziva modela;
  6. dva poziva `freshContext` daju različite `id`, a memorija agenta ostaje iste dužine posle `runTask`.
- **Zavisnosti i mock:** A5 (`runLoop`), A7 (`MockRunner`, `registerContext`). `AgentHandle` i tipove zadataka potvrđuju B, C i D (P6); do potvrde ih koriste samo testovi.

### A9 — Red zadataka ✅ 2026-10-30
**Napomene iz implementacije:** jedinica koje nema na tabli računa se kao `waiting`. Kad su pravila §9 izjednačena, odlučuje niži talas, pa ID, da redosled uvek bude isti. `nextForTester` preskače i ekrane koji su već `promoted` ili `failed`. P7 i P8 su urađeni po predlogu i čekaju potvrdu tima. 15 testova.
- **Fajlovi:** `src/orchestration/queue.ts`, `src/orchestration/queue.test.ts`.
- **Izvozi:**
  ```ts
  export type QueueView = Pick<MigrationStateFields, "plan" | "units" | "tests">
  export function readyUnits(view: QueueView): Unit[]                                 // spremne za buildera, sortirane po §9
  export function nextForBuilder(view: QueueView): Unit | undefined
  export function nextForTester(view: QueueView, beingTested: ReadonlySet<string>): Unit | undefined
  export function unlockedBy(view: QueueView, promotedUnitId: string): Unit[]
  export function blockedBy(view: QueueView, failedUnitId: string): Unit[]           // P7
  export function isFinished(view: QueueView): boolean                               // svaka jedinica je promoted ili failed
  ```
- **Šta radi:** čista logika, bez Mozaika i bez vremena: dobija snimak table i kaže šta je sledeće. Builder dobija samo `waiting` jedinicu čije su sve `dependsOn` promovisane, poređane ovim redom: prvo one za koje testovi već postoje, pa one od kojih zavisi više tokova, pa veća `size` pre manje. Tester dobija `screen` jedinice bez testova iz svih talasa (P8).
- **Gotovo kad:** `npx vitest run src/orchestration/queue.test.ts` nad ručnim planom (2 zajedničke jedinice u talasu 0, 5 ekrana u talasu 1, 1 ekran u talasu 2):
  1. na početku `readyUnits` vraća samo talas 0, a `nextForTester` vraća ekrane iz svih talasa;
  2. kad se promovišu obe zajedničke jedinice, `unlockedBy` vraća 5 ekrana talasa 1, ali ne i ekran talasa 2;
  3. ekran sa testovima ide ispred ekrana bez njih; kad oba imaju testove, prednost ima onaj sa više tokova; kad je i broj tokova isti, ide veći `size`;
  4. `blockedBy` za neuspelu zajedničku jedinicu vraća sve ekrane koji od nje zavise, direktno ili posredno;
  5. `isFinished` je `true` tek kad su sve jedinice `promoted` ili `failed`.
- **Zavisnosti i mock:** A0. Ručni plan je u samom testu.

### Kapija G1 (proverava D)
Moja stavka: `npx vitest run src/core src/agents/_shared src/orchestration` je zeleno (red, runner, guard).

---

## F2: Jedan ekran ceo put

### A10 — Conductor ✅ 2026-10-30
**Odstupanja od plana ispod (urađeno ovako):**
- `new Conductor(deps, options?)` bez `config`: Conductor čita `runId` i `config` sa table (`board()`), koju CLI pravi jednom, pa nema dva izvora istine. `options` (broj agenata, broj rundi) su po podrazumevanoj vrednosti `FIXED_TEAM` iz `config.ts` (F2: 1 analizator, 2 buildera, 1 tester, 2 runde).
- `RunSummary` ima `outcome` (`finished | plan.failed | budget.exceeded | error`) i `units` (konačan status jedinica), a nema `spentUsd`: trošak zna runner, pa ga dodaje CLI (A11).
- Nov događaj `plan.failed` (D-012, D-ov PD2).
- Builder ostaje vezan za svoju jedinicu dok ona ne bude `promoted` ili `failed`; tako sve runde radi isti builder. Agenti ne rade `join` sami; radi ga Conductor i vodi mapu Mozaik UUID → agent.
- Na `budget.exceeded` nema novih zadataka; posao koji je već dodeljen se završava, a jedinice koje nisu krenule su `failed` (P11 po predlogu).
- Događaji se obrađuju jedan po jedan, redom, van Mozaik-ovog sinhronog `publish`-a, pa reakcija Conductora ne može da sruši agenta koji je poslao događaj.
- Testovi (10): pravi Mozaik runtime nad lažnim agentima iz `mocks/fakeAgents.ts` (pun prolaz, redosled analize i arhitekte, testeri na sve talase, ponovna runda kod istog buildera, pad sa blokiranjem zavisnih, `plan.failed`, budžet, greška parsera, `run.jsonl` bez `inference.stream`, tabla i učesnici posle prolaza). Bez timeouta (A13) i bez dinamičnog broja agenata (A14).
- **Fajlovi:** `src/orchestration/conductor.ts`, `src/orchestration/eventLogger.ts`, `src/orchestration/index.ts`, `src/orchestration/mocks/fakeAgents.ts`, `src/orchestration/conductor.test.ts`.
- **Izvozi:**
  ```ts
  export type AgentFactories = {
    analyzer(id: string): AgentHandle<AnalyzeTask>      // D
    architect(id: string): AgentHandle<ArchitectTask>   // D
    tester(id: string): AgentHandle<TestTask>           // B
    builder(id: string): AgentHandle<BuildTask>         // C
    gatekeeper(id: string): Participant                 // C; sam reaguje na tests.ready i draft.submitted
  }
  export type ConductorDeps = { parseApp: ParseApp; splitParts: SplitParts; scaffold: Scaffold; buildReport: BuildReport; agents: AgentFactories }
  export type RunSummary = { runId: string; runDir: string; statuses: Record<string, ScreenStatus>; spentUsd: number; reportPath: string | null }
  export class Conductor {
    constructor(config: RunConfig, deps: ConductorDeps)
    run(): Promise<RunSummary>
  }
  export function createEventLogger(): Participant       // svi događaji osim inference.stream → log()
  ```
- **Šta radi:** vodi tok iz §4:
  1. `parseApp` → `splitParts` → analizatori;
  2. kad stignu svi `analysis.done` → arhitekta (P5);
  3. `plan.ready` → `scaffold`, testeri kreću na sve ekrane, a builderi na talas 0;
  4. `gate.failed` → isti builder dobija sledeću rundu sa svežim kontekstom i `lastError` iz `results`;
  5. `unit.promoted` → oslobađa zavisne jedinice i dodeljuje posao.

  Conductor je deterministički učesnik (`createHuman`). Svaka async reakcija se završava sa `.catch(log)`, a `isSatisfiedBy` nikad ne baca. U F2 je broj agenata fiksan (1 analizator, 2 buildera, 1 tester), runde 1–2 idu na Haiku 4.5, a posle toga je jedinica `failed`. Kad `isFinished` vrati `true`, Conductor poziva `buildReport` i vraća `RunSummary`.
- **Gotovo kad:** `npx vitest run src/orchestration/conductor.test.ts`, sa lažnim agentima iz `mocks/fakeAgents.ts` koji posle `assign` šalju očekivani događaj (bez modela):
  1. arhitekta dobija zadatak tek posle poslednjeg `analysis.done`, i to tačno jednom;
  2. posle `plan.ready` je `scaffold` pozvan jednom, tester je dobio ekrane iz svih talasa, a builderi samo talas 0;
  3. posle `gate.failed { unitId, round: 1 }` isti builder dobija `round: 2` i `lastError`; posle druge neuspele runde jedinica je `failed`;
  4. kad se promoviše zajednička jedinica, zavisni ekrani idu slobodnim builderima;
  5. kad su sve jedinice konačne, `buildReport` je pozvan jednom i `run()` se završava;
  6. `run.jsonl` ima liniju za svaki događaj iz §5, a nijednu za `inference.stream`.
- **Zavisnosti i mock:** B (`createTester`), C (`createBuilder`, Gatekeeper-učesnik, `scaffold`), D (`createAnalyzer`, `createArchitect`, `parseApp`, `splitParts`, `buildReport`). Dok čekam koristim `mocks/fakeAgents.ts` (lažni `AgentHandle`-ovi) i lažne domenske funkcije: ručni `ParsedApp` za TodoMVC, `scaffold` koji ništa ne radi i `buildReport` koji upiše prazan HTML. Beležim ih u `docs/status/a.md` i brišem u integraciji F2.

### A11 — `cli migrate` ✅ 2026-10-30
**Odstupanja od plana ispod (urađeno ovako):**
- Logika komande je u `src/orchestration/migrate.ts` (`runMigrate(options, env?, now?)`), a `src/cli.ts` je samo parsiranje i dinamički `import()` u grani `migrate`; `verify` i `sabotage` zato ne učitavaju Mozaik.
- `src/orchestration/agents.ts` (`createAgentFactories`) bira pravog agenta za svaku ulogu. Za sada je pravi samo D-ov analizator; za ostale je zamena koja javlja „agent još ne postoji (vlasnik, zadatak)“, pa prolaz stane sa greškom i ipak napravi izveštaj. Kad vlasnik spoji agenta, zamena postaje jedan `import`.
- Mock odgovori: folder po aplikaciji, jedan fajl po vlasniku agenta (D-013), opcija `--mock-dir`.
- Pravi prolaz traži `ANTHROPIC_API_KEY` (iz `.env`, preko `dotenv`, samo kad nije `--mock`); bez njega izlaz 2 pre nego što se išta napravi.
- U F2 `--max-builders` i `--max-testers` mogu samo da smanje fiksni tim (`FIXED_TEAM`); formule dolaze u A14.
- `onUsage` iz runnera puni `board().ledger` i upisuje `model.usage` sa `costUsd` u `run.jsonl` (za D-ov trošak po agentu). `onBudgetExceeded` zove nov `Conductor.notifyBudgetExceeded()`.
- Izlazni kod: 0 kad su sve jedinice konačne, 1 za ostale ishode, 2 za loš ulaz. Nema `bin` polja u `package.json`, jer bi trebalo build-ovati u JS; pokretanje je `npm run migrate` i `npx tsx src/cli.ts`.
- Provereno pravom komandom nad `examples/todomvc` sa `--mock`: D-ov analizator radi kroz Conductor, upisuje `analysis/part-1.json`, prolaz staje kod arhitekte koji još ne postoji, a `report.html` se pravi. Testovi: 14 za CLI, 3 za `runMigrate` (isti pravi prolaz), 1 za spajanje mock fajlova, 1 za `notifyBudgetExceeded`; `check-layers` sada prepoznaje i `cli.test.ts`.
- **Fajlovi:** `src/cli.ts`, `src/cli.test.ts`; `package.json` (`bin`, skripte `migrate`, `migrate:mock`, `smoke`).
- **Izvozi:**
  ```ts
  export type CliCommand =
    | { cmd: "migrate"; webDir: string; out: string; maxBuilders: number; maxTesters: number; budget: number; mock: boolean }
    | { cmd: "verify"; runDir: string }
    | { cmd: "sabotage"; runDir: string; unitId: string }
  export function parseCliArgs(argv: string[]): CliCommand     // baca UsageError sa porukom za korisnika
  export function main(argv: string[]): Promise<number>        // exit kod
  ```
- **Šta radi:** implementira `wemora migrate <web-dir> [--out output] [--max-builders 4] [--max-testers 2] [--budget 5] [--mock]` (§13). Argumente parsira `parseArgs` iz `node:util`, bez nove zavisnosti. `migrate` pravi `output/<run-id>/`, poziva `installSafety` i `initLog`, inicijalizuje runtime sa `BudgetedRunner`-om (ili `MockRunner`-om uz `--mock`) i pokreće `Conductor`. Mozaik i orkestracija se uvoze dinamički, samo u grani `migrate`, da `verify` ne bi učitavao Mozaik (A18).
- **Gotovo kad:**
  1. `npx vitest run src/cli.test.ts`: podrazumevane vrednosti dolaze iz `DEFAULTS`; `--budget abc` i nepoznata komanda daju `UsageError`; `--mock` se prenosi;
  2. `npx tsx src/cli.ts` bez argumenata ispisuje upotrebu i vraća exit 2;
  3. `grep -nE "^import .*(@mozaik-ai|orchestration|core/runtime)" src/cli.ts` ne vraća ništa.
- **Zavisnosti i mock:** A10. Predlog formata za `run-id`: `<YYYYMMDD-HHmmss>-<ime web foldera>`.

### A12 — MockRunner odgovori za TodoMVC
- **Fajlovi:** `src/core/mocks/todomvc.json` (ili po jedan fajl po agentu, vidi P13). Nema izvoza, podaci prate `MockFixtureSchema`.
- **Šta radi:** unapred zapisani odgovori svih agenata za ceo tok nad `examples/todomvc`, da `migrate:mock` prođe ceo put za $0. A piše kostur fajla, a B, C i D daju po 2–3 odgovora svog agenta (tim-plan F2, A korak 3). Builder za jednu jedinicu namerno prvo preda loš nacrt (ključ `builder:<unitId>:1`), da se vide `gate.failed` i runda 2.
- **Gotovo kad:** `npm run migrate:mock -- examples/todomvc` završava sa exit 0 i pravi `output/<run>/` sa `plan.json`, `analysis/`, `tests/`, `staging/`, `app/`, `results/`, `run.jsonl` i `report.html` (G2). U `run.jsonl` za istu jedinicu postoji `gate.failed`, a posle njega `unit.promoted`.
- **Zavisnosti i mock:** svi agenti i domenske funkcije (B, C, D), `examples/todomvc` (D). Dok čekam, skripta pokriva samo lažne agente iz A10.

### A13 — Timeouti ✅ 2026-10-31
**Odstupanja od plana ispod (urađeno ovako, D-016):**
- `timeouts.ts` ima `Clock`, `realClock` i `Timers` (jedan tajmer po ključu, npr. `tests:<unitId>`, `build:<unitId>`); nema posebne `UnitTimers` klase. Sat se ubacuje kroz `ConductorOptions.clock`; testovi koriste `mocks/manualClock.ts`.
- Jedan Conductorov tajmer za testove (`testsWaitTimeoutMs`, 10 min) umesto dva; testerovih 8 min je B-ov limit unutar petlje.
- Posle `maxTestAttempts` (2) isteka Conductor šalje nov događaj `tests.missing { unitId }`; Gatekeeper tada promoviše ekran kao `unproven`. Ekran koji je istekao ide u red iza ekrana koji još nisu probani (`nextForTester`).
- Istek buildera je neuspela runda (isti put kao `gate.failed`, zajednička `roundFailed`). Zakasneli `draft.submitted`/`gate.failed` iz ranije runde se ignorišu (`event.stale` u logu). Nov zadatak prekinutom agentu ide tek kad `isBusy()` postane `false` (provera na `idleCheckMs`).
- Testovi: 7 novih u `conductor.test.ts` (ponovna dodela posle isteka, `tests.missing` i `unproven`, istek buildera kao runda, pad posle poslednje runde, čekanje da prekinut agent stane, nijedan tajmer ne ostaje kad svi odgovore na vreme, zakasneli nacrt), 1 u `queue.test.ts`, 1 u `contracts.test.ts`. Lažni agenti umeju da „ćute“, a lažni Gatekeeper čeka testove kao pravi.
- **Fajlovi:** `src/orchestration/timeouts.ts`, `src/orchestration/timeouts.test.ts`, izmene u `conductor.ts`.
- **Izvozi:**
  ```ts
  export type Clock = { now(): number; setTimeout(fn: () => void, ms: number): () => void }   // vraća funkciju za otkazivanje
  export class UnitTimers {
    constructor(clock: Clock, limits: Pick<typeof DEFAULTS, "builderRoundTimeoutMs" | "testerUnitTimeoutMs" | "testsWaitTimeoutMs">)
    startBuild(unitId: string, round: number, onTimeout: () => void): void
    startTester(unitId: string, testerId: string, onTimeout: () => void): void
    startTestsWait(unitId: string, onTimeout: () => void): void
    clear(unitId: string): void
  }
  ```
- **Šta radi:** builder ima 10 min po rundi. Kad istekne, Conductor poziva `cancel` na njegovom handle-u (`CancelGuard`, A8) i računa rundu kao neuspelu (P10). Tester ima 8 min po jedinici, posle čega mu se petlja prekida. Ako za jedinicu 10 min nema testova, Conductor je daje drugom testeru i povećava `testAttempts`, a posle drugog isteka ekran ulazi u aplikaciju kao `unproven` (P9). Vreme dolazi iz `Clock`, pa testovi ne čekaju stvarno.
- **Gotovo kad:** `npx vitest run src/orchestration/timeouts.test.ts` sa `vi.useFakeTimers()`:
  1. bez `draft.submitted` 10 min → pozvan je `cancel("timeout")` i builder dobija rundu 2;
  2. bez `tests.ready` 10 min → jedinicu dobija drugi tester (`testerId` se menja) i `testAttempts === 1`; posle još 10 min `testAttempts === 2`, a Gatekeeper je obavešten na način dogovoren u P9;
  3. kad `draft.submitted` stigne pre isteka, `cancel` se ne poziva.
- **Zavisnosti i mock:** odgovori na P9 i P10; C (Gatekeeper promoviše `unproven`). Dok čekam, koristim lažni Gatekeeper iz `mocks/fakeAgents.ts`.

### Korak `submit` u DSL-u ✅ 2026-10-31 — **uradio B** (uz A-ovu dozvolu, grana `contracts/submit`, PR #56)
Zapis je ovde da A ima kontekst; ceo opis je u `docs/decisions.md` (D-017) i `docs/status/b.md`.
- **Ugovor (`src/contracts/`, A-ov folder):** `StepSchema` u `scenario.ts` ima nov korak `{ submit: { label, value } }` (upis u polje pa Enter; na telefonu `TextInput` sa `onSubmitEditing`). Test u `contracts.test.ts`: `submit` sa labelom i vrednošću prolazi, sa dodatnim ključem pada.
- **B-ov deo (stavke 1–6 iz A-ove poruke):** `scenarios/compile.ts` (akcija `submit`; meta kao `fill`, pa ga pokrivenost, `notPortable` i `reveal` vide kao korišćenje polja; nepoznat korak sada obara `tsc` umesto da se tiho izvrši kao `expectNotVisible`), `run.ts` (`fill` pa `press("Enter")`), `validate.ts` (`submit` je radnja za pravilo 3), `prompts/tester.md`, `mocks/todomvc/tester.json` (5 scenarija za svih 5 obaveza `todo-list`). Stavka 6 provereno: Enter u RN `TextInput` na Expo webu okida `onSubmitEditing`. Svih 5 TodoMVC scenarija prolazi `validateScenario` nad pravim TodoMVC-om.
- **Ostaje za A:** D-017 iz „predlog“ u „prihvaćeno“; dopuniti tabelu koraka u `architecture.md` §11 korakom `submit`.
- **Ostaje za C (pre G2):** mock nacrt za `todo-list` u `src/agents/mocks/todomvc/builder.json` mora da prođe nove testove (linkovi „Active“, „Completed“, „All“, polje `New Todo Input` sa `onSubmitEditing`, checkbox „❯ Toggle All Input“, dugme „Clear completed“), a kapija 4 `labels` da proverava i `submit.label`. Dok se to ne uradi, `migrate:mock` nad TodoMVC-om daje `todo-list: failed` (kapija 4 ne nalazi linkove).

### Kapija G2 (proverava A)
Lista je u tim-plan.md §6. A je pušta na čistom `main`-u, redom: `npm run build && npm test`, `npm run migrate:mock -- examples/todomvc`, pa pravi prolaz `npm run migrate -- examples/todomvc --budget 1`. Zatim u `run.jsonl` proverava preklapanje tester/builder, `gate.failed` posle kog builder popravlja nacrt, odsustvo uspešnih upisa van `staging/` i trošak ispod limita. Na kraju commit-uje `runs/todomvc-<vreme>/`.

---

## F3: Recepti i dokaz

### A14 — Broj agenata po formulama
- **Fajlovi:** `src/orchestration/scaling.ts`, `src/orchestration/scaling.test.ts`, izmene u `conductor.ts`.
- **Izvozi:**
  ```ts
  export type AgentCounts = { analyzers: number; builders: number; testers: number; reason: string }
  export function planAgentCounts(input: { totalTokens: number; readyUnits: number; busyBuilders: number; maxBuilders: number; maxTesters: number }): AgentCounts
  export class Rescaler {
    constructor(clock: Clock, intervalMs: number)
    maybeApply(next: AgentCounts, apply: (c: AgentCounts) => void): boolean   // false ako je prošlo manje od intervalMs
  }
  ```
- **Šta radi:** posle `plan.ready` i posle svakog `unit.promoted` Conductor računa broj agenata formulama iz A4 i primenjuje ga preko `join`/`leave`, najviše jednom u minutu. Gasi se samo agent bez aktivne petlje (`!handle.isBusy()`). Razlog ide u log (npr. `5 ready units → 4 builders, 2 testers`), a D ga prikazuje u izveštaju.
- **Gotovo kad:** `npx vitest run src/orchestration/scaling.test.ts`:
  1. ulaz za TodoMVC daje 1/1/1, a za Recepte (5 spremnih jedinica, max 4) 4 buildera i 2 testera;
  2. od dve promene u roku od 60 s primenjuje se samo prva;
  3. zauzet builder se ne gasi ni kad formula traži manje buildera;
  4. `run.jsonl` sadrži liniju `event: "agents.rescaled"` sa razlogom.
- **Zavisnosti i mock:** A10. Ime log stavke treba dogovoriti sa D, jer je izveštaj čita.

### A15 — Eskalacija modela
- **Fajlovi:** `src/orchestration/conductor.ts` (izmena), novi slučajevi u `conductor.test.ts`. Nema novih izvoza, koristi se `modelForRound` iz A4.
- **Šta radi:** runde 3–4 idu na `MODELS.strong` (`claude-sonnet-4-6`), a posle 4. neuspele runde jedinica je `failed`. Isti builder radi sve runde, svaku sa svežim kontekstom, a model runde se upisuje u `units[id].model`.
- **Gotovo kad:** posle četiri `gate.failed` za istu jedinicu modeli rundi su redom haiku, haiku, sonnet, sonnet; `builderId` je isti u sve 4 runde; posle četvrte je `status === "failed"`, a builder je slobodan.
- **Zavisnosti i mock:** C (builder koristi `BuildTask.model`). Dok čekam, koristim lažni builder.

### A16 — 429 i `budget.exceeded`
- **Fajlovi:** `src/orchestration/conductor.ts`, `src/core/runner.ts` (`onRateLimited` postoji od A7).
- **Šta radi:** na `onRateLimited` Conductor smanjuje efektivni `maxBuilders` za 1 (najmanje do 1), na najmanje jedan minut. Na `budget.exceeded` više ne dodeljuje zadatke i čeka da se aktivne petlje završe. Nezavršene jedinice zatvara onako kako se dogovori u P11, pa pravi izveštaj.
- **Gotovo kad:**
  1. test: tri 429 u kratkom roku smanjuju `maxBuilders` sa 4 na 3, nikad ispod 1;
  2. test: posle `budget.exceeded` nema novih `assign` poziva, ali se `run()` ipak završava i zove `buildReport`;
  3. ručno: `npm run migrate -- examples/todomvc --budget 0.01` završava sa izveštajem i `budget.exceeded` u `run.jsonl`, bez pada procesa.
- **Zavisnosti i mock:** P11.

### A17 — Dodavanje testera u toku rada (opciono)
- **Fajlovi:** `src/orchestration/scaling.ts`, `src/orchestration/conductor.ts`.
- **Šta radi:** ako je red ekrana bez testova narastao (prag ide u `DEFAULTS`) dok builderi čekaju, Conductor dodaje testera do `maxTesters` i loguje razlog. Radi se **samo ako je sve ostalo zeleno** (stavka 3 u redosledu izbacivanja).
- **Gotovo kad:** test: 3 ekrana bez testova i builderi koji čekaju → +1 tester, a u `run.jsonl` stoji razlog.
- **Zavisnosti i mock:** A14.

### A18 — `cli verify` i `cli sabotage`
- **Fajlovi:** `src/cli.ts`, `src/cli.test.ts`, `package.json` (`verify`, `sabotage`).
- **Šta radi:** `wemora verify <run-dir>` i `wemora sabotage <run-dir> <unitId>` pozivaju B-ove `verify()` i `sabotage()` preko dinamičkog uvoza, bez runtime-a i bez Mozaika. Exit kod je 0 kad sve prolazi, a 1 kad nešto pada.
- **Gotovo kad:**
  1. `env -u ANTHROPIC_API_KEY npm run verify -- runs/<x>` (Git Bash) ispisuje matricu i vraća 0;
  2. posle `npm run sabotage -- <kopija runa> <unitId>`, `verify` vraća 1 i pada samo na toj jedinici (G3 proverava B);
  3. `npx vitest run src/cli.test.ts`: `main(["verify", dir])` poziva lažni `verify`, a `vi.mock("@mozaik-ai/core")` koji baca pri učitavanju ne obara test.
- **Zavisnosti i mock:** B (`verify`, `sabotage`). Dok čekam, koristim stub iz A3 i lažnu funkciju u testu.

---

## F4: Stabilizacija

### A19 — Popravke
- **Fajlovi:** samo moji folderi, prema issue-ima crvenog tima (D).
- **Šta radi:** popravlja samo greške iz crvenog tima i iz izveštaja, bez novih funkcija. Ako ostane vremena, vraćaju se izbačene stavke obrnutim redom od redosleda izbacivanja (tim-plan §8).
- **Gotovo kad:** prolaze A-ove stavke kapije G4: na čistom klonu po README-u rade `migrate:mock` i `verify`; `git log -p | grep -i "sk-ant"` ne vraća ništa; `.env.example` nema `MOZAIK_*`; `docs/status/a.md` je ažuran.
- **Zavisnosti i mock:** D (issue-i crvenog tima).

---

## Pitanja za tim

Svako pitanje ima predlog, ali se ništa ne menja dok tim ne odluči. Promene arhitekture idu kroz `docs/decisions.md`.

**Ugovori i slojevi**
- **P1. `contracts/` i `zod`.** §2 kaže da `contracts/` ne uvozi ništa, a tim-plan F0 traži zod šeme u `contracts/`. Predlog: `zod` je jedini dozvoljeni spoljni uvoz, i `check-layers.sh` ga propušta.
- **P2. Ime table.** Po §6 tabla se zove `MigrationState`, a oblik joj je u `contracts/state.ts`. Po mozaik.md §1, `MigrationState` je `class … extends RuntimeState` u `core/state.ts`. `contracts/` ne sme da uvozi `RuntimeState`, pa oba ne mogu da se zovu `MigrationState`. Predlog: `contracts/state.ts` izvozi `MigrationStateFields`, a `core/state.ts` izvozi `class MigrationState extends RuntimeState implements MigrationStateFields`.
- **P3. Šta domen sme iz `core/`.** §2 kaže „core (bez runtime-a)“, ali i `core/state.ts` i `core/runner.ts` uvoze Mozaik, pa bi domen preko njih posredno zavisio od Mozaika. `grep` u `check-layers.sh` to ne vidi. Predlog: domen sme da uvozi samo `core/config.ts` i `core/log.ts`.

**Tok i Conductor**
- **P4. Ko deli rute na delove.** Po §3 `ParsedApp` već sadrži podelu, po §4 (korak 2) deli Conductor, a po tim-plan.md (D) parser deli na N koje daje Conductor. Ali N zavisi od `totalTokens`, koje daje tek `parseApp`. Predlog: posebna funkcija `splitParts(parsed, n)` u `analysis/` (D). Conductor računa N, poziva je i upisuje delove u `state.parsed.parts`.
- **P5. Ko čeka sve `analysis.done`.** Po §5 to radi arhitekta, a po tim-plan.md (A, F2) Conductor, koji „kad stignu svi, pokreće arhitektu“. Predlog: Conductor, jer zna N, a arhitekta dobija zadatak kao i ostali agenti.
- **P6. Kako Conductor dodeljuje zadatak agentu.** §5 nema događaj za dodelu. Predlog: direktan poziv `AgentHandle.assign(task)`. Interfejs i tipovi zadataka bi bili u `agents/_shared/` (A), a B, C i D izvoze fabrike svojih agenata koje vraćaju `AgentHandle`.
- **P7. Zavisnici jedinice koja padne.** Jedinice koje zavise od `failed` jedinice (naročito od zajedničke iz talasa 0) nikad ne postaju spremne, pa prolaz nikad ne stiže do „sve jedinice imaju konačan status“ (§4, korak 11). Predlog: Conductor ih označava `failed` sa razlogom „zavisnost X nije uspela“, bez buildera. Treba odlučiti i koji `ScreenStatus` dobijaju: `failed` ili `unproven`.
- **P8. Redosled za testere.** §9 kaže da testeri uzimaju jedinice „istim redom“, ali pravila 1 (zavisnosti promovisane) i 2 (testovi već postoje) nemaju smisla za testera, koji kreće na sve talase odmah. Predlog: tester uzima samo `screen` jedinice bez testova, poređane po pravilima 3 i 4.
- **P9. Timeout testova.** Ne postoji događaj za „istekao timeout“ ni za „dodeljeno drugom testeru“, a za drugi istek treba da znaju i Gatekeeper i Conductor. Predlog: Conductor vodi tajmer i broj pokušaja u `units[id].testAttempts` (novo polje u `UnitState`), a Gatekeeper posle drugog isteka čita tablu i promoviše ekran kao `unproven`. Alternativa je novi događaj, što je promena ugovora.
- **P10. Timeout buildera.** Mozaik petlja ne može da se prekine spolja (`runLoop` vraća `void`). Predlog: `CancelGuard` (interception) završava petlju na sledećem prelazu, a timeout se računa kao neuspela runda. Treba potvrditi da se računa kao runda.
- **P11. Šta posle `budget.exceeded`.** Nije zadato šta biva sa nezavršenim jedinicama i da li se pravi izveštaj. Predlog: nema novih zadataka, aktivne petlje se završavaju (runner im ionako vraća grešku), nezavršene jedinice dobijaju `failed` sa razlogom „budget“, a `buildReport()` se pravi.
- **P12. Testovi toka.** `Scenario` ima `unitId`, a test toka pripada `Flow`-u. Gde se on čuva (`tests/<flowId>.json`?), ko ga piše i kako tačno izgleda `Flow` (predlog: `{ id, description, unitIds }`)?

**Alati i repo**
- **P13. Gde su MockRunner fajlovi.** Predlog za mesto je `src/core/mocks/`, a to je A-ov folder, dok u F2 svako piše odgovore svog agenta. Da li je to izuzetak od vlasništva, ili svako drži svoje odgovore u `<svoj folder>/mocks/`?
- **P14. `check-layers.sh` na Windowsu.** `npm run build` pokreće skripte kroz `cmd.exe`, pa `bash` može biti WSL bash ili ga uopšte nema u PATH-u. Da li svi imaju Git Bash u PATH-u? Alternativa je `scripts/check-layers.ts` preko `tsx`, ali to menja ime iz architecture.md, pa ide kroz `docs/decisions.md`.
- **P15. Zavisnosti.** `package.json` nema `zod`, `vitest`, Playwright ni parser. Treba odobriti `zod` 4 i `vitest` (A0.0). B, C i D da jave svoje: Playwright, kao i Babel ili ts-morph (wemora-plan §6 kaže „ts-morph ili Babel“, a kapija `parse` u §10 kaže Babel).

**Potpisi i dokumenti**
- **P16. C-ovi potpisi iz tim-plan §1 kojima nešto fali.** *Rešeno 2026-10-30 (D-015): `checkDraft({ unit, round, draftDir, tests, webDir })`; `promote`/`rollback` rade bez izmene (C); `serveApp` već ima `close()`.* `promote(unitId, draftDir)` i `rollback(unitId)` ne dobijaju `runDir`/`appDir`, a `serveApp` nema način da ugasi server. Nije jasno ni da li su builderov `check_draft` (kapije 1–4) i Gatekeeper-ov `checkDraft` (sve kapije) ista funkcija ili dve. C treba da potvrdi pre spajanja A0.
- **P17. Folderi u `docs/`.** Postoji folder `docs/statuts/`, a `tim-plan.md` i `CLAUDE.md` koriste `docs/status/`, što je verovatno greška u kucanju. `docs/decisions.md` se pominje, a ne postoji; predlog je da ga napravi A1.
- **P18. Razlike između `wemora-plan.md` i `architecture.md`.** Važi arhitektura, ovde je potrebna samo potvrda:
  - wemora-plan §4.4 pominje `seed` podatke u skladištu, a §11 kaže da se stanje priprema `setup` koracima preko UI-ja. Zato ugovor nema `seed`.
  - wemora-plan §6.1 pominje ukupni limit budžeta u lokalnom fajlu, a architecture.md samo `--budget` po prolazu. Zato A7 radi samo limit po prolazu.
