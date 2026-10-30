import {
  SituationSpecification,
  type Agent,
  type InterceptionHandler,
  type ModelContext,
  type SituationContext,
  type SituationHandler,
  type StructuredOutputFormat,
  type Tool,
} from "@mozaik-ai/core"
import { z } from "zod"
import { DEFAULTS } from "../../core/config"
import { WEMORA_ERROR, type TaskMeta } from "../../core/runner"
import { resolveRuntime, runLoop } from "../../core/runtime"
import { freshContext } from "./context"
import { toModelSchema } from "./schema"

export type AgentTask = {
  prompt: string
  message: string
  meta: TaskMeta
  model: string
  maxOutputTokens: number
  tools?: Tool[]
  guard?: InterceptionHandler
}

export type TaskResult<T = string> = { ok: true; value: T } | { ok: false; error: string }

// One active loop per agent (mozaik.md §4).
const busy = new WeakSet<Agent>()

export function isAgentBusy(agent: Agent): boolean {
  return busy.has(agent)
}

// Runs one task on a fresh context and resolves with the agent's final answer.
export function runTask(agent: Agent, task: AgentTask): Promise<TaskResult> {
  return exclusive(agent, async () => {
    const context = freshContext(task.prompt, task.meta)
    return toResult(await loopOnce(agent, task.message, context, task))
  })
}

// Like runTask, but asks for JSON matching `schema`. A reply that fails the schema goes back to the
// model with the errors, at most DEFAULTS.maxSchemaRetries times, in the same context.
export function runStructured<T>(agent: Agent, task: AgentTask, schema: z.ZodType<T>): Promise<TaskResult<T>> {
  return exclusive(agent, async () => {
    const context = freshContext(task.prompt, task.meta)
    const format: StructuredOutputFormat = { name: task.meta.kind, schema: toModelSchema(schema), strict: true }
    let message = task.message
    let lastError = ""
    for (let attempt = 0; attempt <= DEFAULTS.maxSchemaRetries; attempt++) {
      const reply = toResult(await loopOnce(agent, message, context, task, format))
      // A runner or API error is not the model's fault, so asking again does not help.
      if (!reply.ok) return reply
      const checked = parseReply(reply.value, schema)
      if (checked.ok) return checked
      lastError = checked.error
      message = `Your previous reply did not match the required JSON schema:\n${checked.error}\nReply again with the complete corrected JSON only.`
    }
    return { ok: false, error: `invalid structured output after ${DEFAULTS.maxSchemaRetries + 1} attempts: ${lastError}` }
  })
}

async function exclusive<T>(agent: Agent, work: () => Promise<TaskResult<T>>): Promise<TaskResult<T>> {
  if (busy.has(agent)) return { ok: false, error: "agent busy" }
  if (!hasJoined(agent)) return { ok: false, error: `agent ${agent.getId()} has not joined the runtime` }
  busy.add(agent)
  try {
    return await work()
  } finally {
    busy.delete(agent)
  }
}

function hasJoined(agent: Agent): boolean {
  try {
    return resolveRuntime().getParticipant(agent.getId()) !== undefined
  } catch {
    return false
  }
}

class OwnAnswer extends SituationSpecification {
  isSatisfiedBy({ event, participant }: SituationContext): boolean {
    return event.type === "model.answer" && event.producerId === participant.getId()
  }
}

// Starts runLoop and waits for this agent's model.answer through a temporary handler.
function loopOnce(
  agent: Agent,
  message: string,
  context: ModelContext,
  task: AgentTask,
  structuredOutput?: StructuredOutputFormat,
): Promise<string> {
  return new Promise((resolve) => {
    const removeHandler = () => agent.setHandlers(agent.getHandlers().filter((h) => h !== handler))
    const handler: SituationHandler = {
      specification: new OwnAnswer(),
      processor: {
        apply: ({ event }) => {
          removeHandler()
          resolve(answerText(event.payload))
        },
      },
    }
    agent.setHandlers([...agent.getHandlers(), handler])
    try {
      runLoop(
        agent.getId(),
        message,
        { model: task.model, maxOutputTokens: task.maxOutputTokens, context, tools: task.tools, structuredOutput },
        task.guard,
      )
    } catch (error) {
      removeHandler()
      resolve(`${WEMORA_ERROR} could not start the loop: ${error instanceof Error ? error.message : String(error)}`)
    }
  })
}

function answerText(payload: unknown): string {
  const text = (payload as { answer?: { content?: { text?: unknown } } } | null)?.answer?.content?.text
  return typeof text === "string" ? text : `${WEMORA_ERROR} model.answer without text`
}

function toResult(text: string): TaskResult {
  return text.startsWith(WEMORA_ERROR) ? { ok: false, error: text.slice(WEMORA_ERROR.length).trim() } : { ok: true, value: text }
}

function parseReply<T>(text: string, schema: z.ZodType<T>): TaskResult<T> {
  const json = text.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "")
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch (error) {
    return { ok: false, error: `not valid JSON (${error instanceof Error ? error.message : String(error)})` }
  }
  const parsed = schema.safeParse(data)
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: z.prettifyError(parsed.error) }
}
