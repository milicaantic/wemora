// serveApp: statički web export aplikacije (D-006) na slobodnom lokalnom portu.
// Export ide u privremeni folder (ne u app/); close() gasi server i briše ga.
import { execFile } from "node:child_process"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { readFile, stat } from "node:fs/promises"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { extname, join, resolve, sep } from "node:path"
import { promisify } from "node:util"
import type { ServeApp, ServedApp } from "../contracts"

const run = promisify(execFile)

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
}

export const serveApp: ServeApp = async (appDir) => {
  const cli = join(appDir, "node_modules/expo/bin/cli")
  if (!existsSync(cli)) throw new Error(`Nema Expo CLI u "${cli}". Pokreni "npm install" u templates/expo.`)

  const out = mkdtempSync(join(tmpdir(), "wemora-web-"))
  try {
    // Nikad --clear: keš drži export na ~6 s (D-006).
    await run(process.execPath, [cli, "export", "--platform", "web", "--output-dir", out], {
      cwd: appDir,
      env: { ...process.env, CI: "1", EXPO_NO_TELEMETRY: "1" },
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch (e) {
    rmSync(out, { recursive: true, force: true })
    const err = e as { stdout?: string; stderr?: string }
    const log = `${err.stdout ?? ""}\n${err.stderr ?? ""}`.trim().split("\n").slice(-20).join("\n")
    throw new Error(`Web export aplikacije nije uspeo:\n${log}`)
  }

  const served = await serveStatic(out)
  return {
    url: served.url,
    close: async () => {
      await served.close()
      rmSync(out, { recursive: true, force: true })
    },
  }
}

/**
 * Statički server sa SPA rezervom (putanja bez ekstenzije → index.html).
 * Isto radi B-ov scenarios/serve.ts; preći na njega kad ga B izveze iz scenarios/index.ts.
 */
async function serveStatic(dir: string): Promise<ServedApp> {
  const root = resolve(dir)
  const server = createServer((req, res) => {
    void reply(root, req.url ?? "/").then(({ status, type, body }) => {
      res.writeHead(status, { "content-type": type })
      res.end(body)
    })
  })
  await new Promise<void>((ok, fail) => {
    server.once("error", fail)
    server.listen(0, "127.0.0.1", () => ok())
  })
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((ok) => {
        server.closeAllConnections()
        server.close(() => ok())
      }),
  }
}

type Reply = { status: number; type: string; body: Buffer | string }

async function reply(root: string, url: string): Promise<Reply> {
  let pathname: string
  try {
    pathname = decodeURIComponent(new URL(url, "http://x").pathname)
  } catch {
    return { status: 400, type: "text/plain", body: "bad url" }
  }
  const file = join(root, pathname)
  if (file !== root && !file.startsWith(root + sep)) return { status: 403, type: "text/plain", body: "forbidden" }
  const isFile = (p: string) => stat(p).then((s) => s.isFile(), () => false)
  const send = async (p: string): Promise<Reply> => ({
    status: 200,
    type: MIME[extname(p).toLowerCase()] ?? "application/octet-stream",
    body: await readFile(p),
  })
  if (await isFile(file)) return send(file)
  const index = join(root, "index.html")
  if (!extname(pathname) && (await isFile(index))) return send(index)
  return { status: 404, type: "text/plain", body: "not found" }
}
