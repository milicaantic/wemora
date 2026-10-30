---
paths:
  - "src/agents/**"
  - "src/core/**"
  - "src/orchestration/**"
  - "src/cli.ts"
---

# Mozaik — pravila za rad (`@mozaik-ai/core@4.1.0`)

Sve ispod je provereno u izvornom kodu objavljenog paketa. **Jedini izvor istine je `node_modules/@mozaik-ai/core/dist/index.d.ts`.** Ako funkcija nije tamo, ne postoji. Ne gledaj GitHub izvor, jer se razlikuje od objavljenog paketa. Ne izmišljaj API.

Domen (`src/analysis`, `scenarios`, `gatekeeper`, `scaffold`, `report`, `verify`) **nikad** ne uvozi `@mozaik-ai/core`.

## Šta paket izvozi (sve ostalo ne postoji)

`defineRuntime`, `RuntimeState`, `Participant`, `Agent`, `Human`, `createAgent`, `createHuman`, `SemanticEvent`, `SituationSpecification`, tipovi `SituationHandler`, `SituationProcessor`, `SituationContext`, `ModelContext`, `ContextItem`, `UserMessageItem`, `DeveloperMessageItem`, `SystemMessageItem`, `ModelMessageItem`, `FunctionCallItem`, `FunctionCallOutputItem`, `ReasoningItem`, `TokenUsage`, `InputTokenDetails`, `OutputTokenDetails`, tipovi `InferenceInput`, `InferenceOutput`, `InferenceRunner`, `InferenceRunnerConfig`, `Endpoint`, `StructuredOutputFormat`, `Tool`, `InterceptionHandler`, `ExecutableTransition`, `LoopTransition`, `LoopStateExecution`, `ExecutableLoopStateId`, `ModelContextRepository`, `AnthropicMessages`, `OpenAIResponses`, `OpenAIChatCompletions`, `GeminiGenerateContent`, `DefaultInferenceRunner`, `supportedModels`, `McpClient`, `McpToolRegistry`, tip `McpServerConfig`, tip `McpToolSpec`.

Tip za alat je `Tool`. `FunctionTool` se ne izvozi po imenu.

## 1. Runtime: jedan po procesu, samo u `src/core/runtime.ts`

`initializeRuntime` baca `"Runtime already initialized"` ako se pozove dvaput. Svi ostali fajlovi uvoze odavde i **nikad** ne pozivaju `defineRuntime`.

```ts
// src/core/runtime.ts — JEDINO mesto
import { defineRuntime } from "@mozaik-ai/core"
import type { MigrationState } from "./state"
export const { initializeRuntime, resolveRuntime, resolveParticipant,
  join, leave, sendMessage, sendEvent, runLoop } = defineRuntime<MigrationState>()

// src/core/state.ts
import { RuntimeState } from "@mozaik-ai/core"
export class MigrationState extends RuntimeState { /* polja table */ }
```

Inicijalizacija sa našim runnerom: `initializeRuntime({ state, inferenceRunnerConfig: { runner } })`. Tabla je `resolveRuntime().state`.

## 2. `runLoop` ne hvata greške: inference ide samo kroz naš runner

`runLoop(agentId, message, inferenceInput, interceptionHandler?)` vraća `void` i pokreće petlju bez `await` i bez `.catch`. **Svaki izuzetak u petlji je neuhvaćen promise i ruši proces.** Izuzetak baca:

- greška API-ja (429, 529, mreža);
- `"Unsupported model: X"` ako ime modela nije registrovano;
- validator ako `InferenceInput` ne odgovara specifikaciji modela;
- `"No transition rule found"` ako odgovor modela nema **ni** poruku **ni** poziv alata (npr. samo reasoning ili odsečen odgovor);
- `"Inference output not found"` u streaming režimu.

Zato `BudgetedRunner` (`src/core/runner.ts`) **nikad ne baca grešku**. Radi retry sa backoff-om, a kad odustane, vraća poruku-grešku tako da se petlja normalno završi:

```ts
import { ModelMessageItem, type InferenceRunner, type InferenceInput, type InferenceOutput } from "@mozaik-ai/core"

const fail = (why: string): InferenceOutput =>
  ({ items: [ModelMessageItem.rehydrate({ text: `__WEMORA_ERROR__ ${why}` })], tokenUsage: undefined, rowResponse: null })

async run(input: InferenceInput): Promise<InferenceOutput> {
  // retry → ako i dalje ne uspe: return fail(...)
  // ako output nema ni "message" ni "function_call": dodaj fail("empty output") u items
}
```

`src/core/safety.ts` dodatno registruje `process.on("unhandledRejection")` kao poslednju liniju odbrane. Ne koristi `streaming: true` za agente.

## 3. Modeli

- `claude-haiku-5-5` **nije** u `supportedModels`. Registruje se samo u `src/core/runner.ts`:
  ```ts
  import { supportedModels, AnthropicMessages } from "@mozaik-ai/core"
  const h45 = supportedModels.find(m => m.specification.name === "claude-haiku-4-5")!
  export const models = [...supportedModels,
    { endpoint: new AnthropicMessages(), specification: { ...h45.specification, name: "claude-haiku-5-5" } }]
  ```
- Koristimo `claude-haiku-5-5` (osnovni) i `claude-sonnet-5-5` (arhitekta, eskalacija). Imena modela su konstante u `src/core/config.ts`, ne stringovi rasuti po kodu.
- `AnthropicMessages` bez konfiguracije čita `ANTHROPIC_API_KEY` iz okruženja.
- **Uvek postavi `maxOutputTokens`** (mapira se na `max_tokens`).
- Anthropic mapper **ne radi prompt caching**. Ne računaj na njega.

## 4. Agenti: jedan agent, jedna aktivna petlja, svež kontekst za svaki zadatak

`createAgent({ name, capabilities, instruction, tools, handlers })` stavlja `instruction` u memoriju agenta. Ta memorija (`agent.getMemory().getContext()`) **raste na mestu** sa svakom petljom. Dve istovremene petlje nad istim kontekstom bi se pomešale.

Pravila:

- Za svaki zadatak napravi **svež** `ModelContext` i u njega sam stavi prompt. Ne koristi `agent.getMemory().getContext()` za rad.
- Svaki builder i tester je **zasebna instanca** `createAgent`. Jedan agent nikad nema dve aktivne petlje.
- Pomoćna funkcija za ovo je u `src/agents/_shared/`. Koristi nju, ne pravi svoju.

```ts
import { ModelContext, DeveloperMessageItem } from "@mozaik-ai/core"
import { runLoop } from "../core/runtime"

const context = ModelContext.create().addContextItem(DeveloperMessageItem.create(prompt))
runLoop(agent.getId(), taskMessage, {
  model: MODELS.default, maxOutputTokens: 8000, context, tools: agent.getTools(),
  // structuredOutput: { name: "plan", schema: jsonSchema, strict: true }  ← kad treba JSON
}, guard)
```

Kad tražiš JSON od modela (`structuredOutput`), odgovor stiže kao tekst u `ModelMessageItem.content.text`. **Uvek ga parsiraj i proveri zod šemom iz `src/contracts/`.** Ako ne prođe, vrati modelu grešku i probaj ponovo, najviše 2 puta.

## 5. Alati

```ts
import type { Tool } from "@mozaik-ai/core"

export const writeFile: Tool = {
  type: "function",
  name: "write_file",
  description: "Write a file inside your staging folder.",
  parameters: { type: "object", additionalProperties: false, required: ["path", "content"],
    properties: { path: { type: "string" }, content: { type: "string" } } },
  strict: true,
  invoke: async ({ path, content }) => { /* poziva funkciju iz domena */ return "ok" },
}
```

- `invoke` dobija već parsirane argumente. Vraća string ili objekat (objekat se pretvara u JSON).
- Izuzetak u `invoke` se hvata i modelu se vraća kao `"Error calling tool: ..."`. To je u redu za petlju popravki, ali poruka greške mora biti korisna modelu.
- Nepoznat alat vraća `Error: unknown tool "X"`.
- **U jednom koraku izvršava se samo PRVI poziv alata**, a ostali iz istog odgovora se odbacuju. U promptu napiši: "Call one tool at a time."
- Alat je tanak: posao radi funkcija iz domena. Bez logike u `invoke`.

## 6. Događaji i handleri

- `sendEvent(event, senderId)` i petlje objavljuju događaj **svim** učesnicima, **uključujući pošiljaoca**. Svaki handler filtrira po `event.type` i, gde treba, `event.producerId !== participant.getId()`.
- **Pošiljalac mora prvo da bude pridružen (`join`).** `sendEvent` i `sendMessage` bacaju `Participant <id> not found` ako `senderId` nije na tabli. Agente pridružuje Conductor pre prvog zadatka, pa agent **ne radi `join` sam**. Naš kod šalje događaje preko `emit()` iz `src/core/runtime.ts`. Pravila za agente su u `src/agents/_shared/handle.ts`.
- Događaj se pravi sa `SemanticEvent.create(type, producerId, payload)`. Imena su iz `src/contracts/events.ts`. **Payload nosi samo ID-jeve** (npr. `{ unitId }`), a podaci su na tabli.
- Petlja sama objavljuje: `message_received.started/completed`, `inference.started/completed`, `inference.stream`, `function_call.started/completed`, `model.answer`, `interception.started/finished`. Payload je original plus `loopId`, a `producerId` je ID agenta.
- **Kraj petlje** je `model.answer` sa `producerId === agentId`. Payload: `{ answer: ModelMessageItem, loopId }`, tekst je `answer.content.text`. Proveri `__WEMORA_ERROR__` prefiks.
- `join`/`leave` objavljuju `participant.joined`/`participant.left` (payload je manifest učesnika).
- `sendMessage(text, senderId)` objavljuje `message.sent` sa payload-om `{ message }`.

```ts
import { SituationSpecification, type SituationHandler, type SituationContext } from "@mozaik-ai/core"

class EventFromOthers extends SituationSpecification {
  constructor(private type: string) { super() }
  isSatisfiedBy({ event, participant }: SituationContext) {
    return event.type === this.type && event.producerId !== participant.getId()
  }
}

export const onPlanReady: SituationHandler = {
  specification: new EventFromOthers(EVENTS.planReady),
  processor: { apply: (ctx) => { void handlePlanReady(ctx).catch(logError) } },
}
```

- **`isSatisfiedBy` nikad ne sme da baci grešku.** Izuzetak se širi kroz `publish` do onoga ko je poslao događaj, često u petlju agenta, i ruši proces.
- **`apply` se ne čeka (`await`).** Async rad u `apply` uvek završi sa `.catch(...)`.
- Objavljivanje je sinhrono. `sendEvent` iz `apply` odmah poziva handlere ostalih, ugnežđeno. Ne pravi lance gde A objavljuje B, a B objavljuje A.
- Deterministički učesnici (Conductor, Gatekeeper-učesnik) prave se sa `createHuman({ name, capabilities, handlers })`.

## 7. Interception: OwnershipGuard

`InterceptionHandler` dobija prelaz pre izvršenja. Za odbijanje poziva alata dodaj poziv i sintetički odgovor u kontekst i vrati prelaz na `"inference"`:

```ts
import { FunctionCallOutputItem, type InterceptionHandler, type ExecutableTransition } from "@mozaik-ai/core"

isSatisfiedBy(t: ExecutableTransition) { return t.nextStateId === "function_call" && /* van dozvoljene putanje */ }
async handle(t: ExecutableTransition): Promise<ExecutableTransition> {
  const { call, inferenceInput } = t.input as any
  inferenceInput.context.addContextItems([call, FunctionCallOutputItem.create(call.callId, "Rejected: ...")])
  return { nextStateId: "inference", input: inferenceInput }
}
```

OwnershipGuard je u `src/agents/_shared/`. Koristi njega, ne pravi novi.

## 8. Mozaik Cloud telemetrija: ne uključivati

- Telemetrija se uključuje ako postoji `MOZAIK_API_KEY` ili `MOZAIK_PROJECT_KEY` u okruženju **ili u `.env` fajlu u radnom folderu**, ili keširani ključ u `~/.mozaik/credentials.json`. Tada šalje događaje, memoriju agenata i alate na `api.app.jigjoy.ai`, bez sakrivanja sadržaja.
- **Ne dodaji te promenljive u `.env`** bez odluke tima.
- Bez ključa, svaki `runLoop` ispiše `mozaik cloud: no API key — telemetry disabled...`. To je očekivano i bezopasno.
