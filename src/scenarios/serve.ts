import { readFile, stat } from "node:fs/promises"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import path from "node:path"
import type { ServedApp } from "../contracts"

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
}

type Reply = { status: number; type: string; body: Buffer | string }

/** Serves a static folder on a free local port. Paths without a file extension fall back to index.html (SPA routing). */
export async function serveStatic(dir: string): Promise<ServedApp> {
  const root = path.resolve(dir)
  const server = createServer((req, res) => {
    void reply(root, req.url ?? "/")
      .catch((err: unknown): Reply => ({ status: 500, type: "text/plain", body: String(err) }))
      .then(({ status, type, body }) => {
        res.writeHead(status, { "content-type": type })
        res.end(body)
      })
  })
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => resolve())
  })
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        // Browsers keep connections alive; without this close() waits for them.
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
}

async function reply(root: string, url: string): Promise<Reply> {
  let pathname: string
  try {
    pathname = decodeURIComponent(new URL(url, "http://localhost").pathname)
  } catch {
    return { status: 400, type: "text/plain", body: "bad url" }
  }
  const file = path.join(root, pathname)
  if (file !== root && !file.startsWith(root + path.sep)) return { status: 403, type: "text/plain", body: "forbidden" }

  if (await isFile(file)) return send(file)
  const index = path.join(root, "index.html")
  if (!path.extname(pathname) && (await isFile(index))) return send(index)
  return { status: 404, type: "text/plain", body: "not found" }
}

async function send(file: string): Promise<Reply> {
  const type = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream"
  return { status: 200, type, body: await readFile(file) }
}

async function isFile(file: string): Promise<boolean> {
  return stat(file).then((s) => s.isFile(), () => false)
}
