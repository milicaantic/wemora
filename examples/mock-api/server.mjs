// Mock API shared by the web original and the Expo app (docs/architecture.md §11).
// Both apps read the same data, so a difference on screen means a difference in behavior.
// No dependencies: only node:* modules.
//
//   node server.mjs            start the server (MOCK_API_PORT, default 3000)
//   node server.mjs --check    validate every fixture and exit
import { createServer } from "node:http"
import { readFileSync, readdirSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures")
const DIFFICULTIES = ["Lako", "Srednje", "Teško"]
const MAX_BODY_BYTES = 10_000

// Fixtures

/** Loads and validates every fixtures/*.json file. Throws with all problems listed. */
export function loadFixtures(dir = FIXTURES_DIR) {
  const fixtures = {}
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort()
  for (const file of files) {
    const name = basename(file, ".json")
    let data
    try {
      data = JSON.parse(readFileSync(join(dir, file), "utf8"))
    } catch (error) {
      throw new Error(`fixture "${name}" is not valid JSON: ${error.message}`)
    }
    const errors = validateFixture(data)
    if (errors.length > 0) {
      throw new Error(`fixture "${name}" is invalid:\n  - ${errors.join("\n  - ")}`)
    }
    fixtures[name] = data
  }
  if (!fixtures.default) throw new Error(`no fixtures/default.json in ${dir}`)
  return fixtures
}

const isText = (v) => typeof v === "string" && v.trim().length > 0
const isPositiveInt = (v) => Number.isInteger(v) && v > 0

/** Returns a list of problems; empty means the fixture is valid. */
export function validateFixture(data) {
  const errors = []
  if (!data || typeof data !== "object" || !Array.isArray(data.categories) || !Array.isArray(data.recipes)) {
    return ["expected an object with arrays `categories` and `recipes`"]
  }

  const categoryIds = new Set()
  for (const [i, c] of data.categories.entries()) {
    const at = `categories[${i}]`
    if (!isText(c?.id) || !/^[a-z0-9][a-z0-9-]*$/.test(c.id)) errors.push(`${at}.id must be kebab-case`)
    if (!isText(c?.name)) errors.push(`${at}.name is required`)
    if (categoryIds.has(c?.id)) errors.push(`${at}.id "${c.id}" is duplicated`)
    categoryIds.add(c?.id)
  }

  const recipeIds = new Set()
  for (const [i, r] of data.recipes.entries()) {
    const at = `recipes[${i}]`
    if (!isText(r?.id)) errors.push(`${at}.id is required`)
    if (recipeIds.has(r?.id)) errors.push(`${at}.id "${r.id}" is duplicated`)
    recipeIds.add(r?.id)
    if (!isText(r?.name)) errors.push(`${at}.name is required`)
    if (!categoryIds.has(r?.categoryId)) errors.push(`${at}.categoryId "${r?.categoryId}" is not a category`)
    if (!isPositiveInt(r?.timeMin)) errors.push(`${at}.timeMin must be a positive integer`)
    if (!DIFFICULTIES.includes(r?.difficulty)) errors.push(`${at}.difficulty must be one of ${DIFFICULTIES.join(", ")}`)
    if (!isPositiveInt(r?.servings)) errors.push(`${at}.servings must be a positive integer`)
    if (!Number.isInteger(r?.calories) || r.calories < 0) errors.push(`${at}.calories must be a non-negative integer`)
    if (typeof r?.rating !== "number" || r.rating < 1 || r.rating > 5) errors.push(`${at}.rating must be between 1 and 5`)
    if (!Array.isArray(r?.ingredients) || r.ingredients.length === 0) {
      errors.push(`${at}.ingredients must be a non-empty array`)
    } else {
      for (const [j, g] of r.ingredients.entries()) {
        if (!isText(g?.name) || typeof g?.amount !== "number" || g.amount <= 0 || !isText(g?.unit)) {
          errors.push(`${at}.ingredients[${j}] needs name, amount > 0 and unit`)
        }
      }
    }
    if (!Array.isArray(r?.steps) || r.steps.length === 0 || !r.steps.every(isText)) {
      errors.push(`${at}.steps must be a non-empty array of strings`)
    }
  }

  // Tests check visible text (expectVisible / expectNotVisible). If one name contains another,
  // "Sarma is not visible" could fail because of a different recipe, so names must not overlap.
  const names = [
    ...data.recipes.map((r) => ({ kind: "recipe", name: r?.name })),
    ...data.categories.map((c) => ({ kind: "category", name: c?.name })),
  ].filter((n) => isText(n.name))
  for (const a of names) {
    for (const b of names) {
      if (a === b) continue
      if (b.name.toLowerCase().includes(a.name.toLowerCase())) {
        errors.push(`${a.kind} name "${a.name}" is contained in ${b.kind} name "${b.name}"`)
      }
    }
  }
  return errors
}

// HTTP

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

function send(res, status, body) {
  res.writeHead(status, {
    ...CORS_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  })
  res.end(JSON.stringify(body))
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on("data", (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error("request body too large"))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8")
      if (text.trim() === "") return resolve({})
      try {
        resolve(JSON.parse(text))
      } catch {
        reject(new Error("request body is not valid JSON"))
      }
    })
    req.on("error", reject)
  })
}

// The list omits `steps`; the detail endpoint returns the whole recipe.
const toListItem = ({ steps, ...rest }) => rest

/**
 * Creates the server without starting it.
 * `fixture` is the startup fixture; POST /__reset returns to it.
 */
export function createMockApi({ fixtures, fixture = "default", delayMs = 0, log = () => {} }) {
  if (!fixtures[fixture]) throw new Error(`unknown fixture "${fixture}"; known: ${Object.keys(fixtures).join(", ")}`)
  const initial = fixture
  let active = fixture
  const data = () => fixtures[active]

  async function handle(req, res) {
    const url = new URL(req.url ?? "/", "http://localhost")
    const path = url.pathname.replace(/\/+$/, "") || "/"
    const method = req.method ?? "GET"
    log(`${method} ${path} [${active}]`)

    if (method === "OPTIONS") {
      res.writeHead(204, CORS_HEADERS)
      return res.end()
    }

    // Control routes for tests (Scenario.apiFixture).
    if (path === "/__health") {
      if (method !== "GET") return send(res, 405, { error: "method not allowed" })
      return send(res, 200, { ok: true, fixture: active, fixtures: Object.keys(fixtures).sort() })
    }
    if (path === "/__fixture") {
      if (method !== "POST") return send(res, 405, { error: "method not allowed" })
      const body = await readJsonBody(req)
      if (typeof body?.name !== "string" || !fixtures[body.name]) {
        return send(res, 400, { error: `unknown fixture "${body?.name}"`, fixtures: Object.keys(fixtures).sort() })
      }
      active = body.name
      return send(res, 200, { fixture: active })
    }
    if (path === "/__reset") {
      if (method !== "POST") return send(res, 405, { error: "method not allowed" })
      active = initial
      return send(res, 200, { fixture: active })
    }

    // Data routes, read-only.
    if (path.startsWith("/api/")) {
      if (method !== "GET") return send(res, 405, { error: "method not allowed" })
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))
      if (path === "/api/categories") return send(res, 200, data().categories)
      if (path === "/api/recipes") return send(res, 200, data().recipes.map(toListItem))
      const match = /^\/api\/recipes\/([^/]+)$/.exec(path)
      if (match) {
        const id = decodeURIComponent(match[1])
        const recipe = data().recipes.find((r) => r.id === id)
        return recipe ? send(res, 200, recipe) : send(res, 404, { error: "not found" })
      }
    }
    return send(res, 404, { error: "not found" })
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((error) => {
      if (!res.headersSent) send(res, 400, { error: error.message })
      else res.end()
    })
  })
  return { server, activeFixture: () => active }
}

// CLI

function main(argv) {
  let fixtures
  try {
    fixtures = loadFixtures()
  } catch (error) {
    console.error(`mock-api: ${error.message}`)
    return 1
  }

  if (argv.includes("--check")) {
    for (const [name, f] of Object.entries(fixtures)) {
      console.log(`ok  ${name}: ${f.categories.length} categories, ${f.recipes.length} recipes`)
    }
    return 0
  }

  const port = Number(process.env.MOCK_API_PORT ?? 3000)
  const host = process.env.MOCK_API_HOST || undefined
  const delayMs = Number(process.env.MOCK_API_DELAY_MS ?? 0)
  const fixture = process.env.MOCK_API_FIXTURE ?? "default"
  const quiet = process.env.MOCK_API_QUIET === "1"

  let api
  try {
    api = createMockApi({ fixtures, fixture, delayMs, log: quiet ? () => {} : (line) => console.log(line) })
  } catch (error) {
    console.error(`mock-api: ${error.message}`)
    return 1
  }
  api.server.on("error", (error) => {
    console.error(`mock-api: ${error.message}`)
    process.exit(1)
  })
  api.server.listen(port, host, () => {
    console.log(`mock-api: http://localhost:${port} (fixture "${fixture}", fixtures: ${Object.keys(fixtures).join(", ")})`)
  })
  const stop = () => api.server.close(() => process.exit(0))
  process.on("SIGINT", stop)
  process.on("SIGTERM", stop)
  return undefined
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const code = main(process.argv.slice(2))
  if (code !== undefined) process.exitCode = code
}
