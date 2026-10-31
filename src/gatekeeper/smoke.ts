// „Dimna“ provera za zajedničke jedinice (A → C): zajednička jedinica nema svoje testove, pa bez ovoga
// `layout` koji obara celu web aplikaciju prođe kapije i svi ekrani zatim padaju. Otvara `/` i gleda
// da li stranica baci grešku ili ostane bez ikakvog prikaza (React posle pada isprazni #root).
import { chromium } from "playwright"
import { PHONE } from "./check"

export type SmokeResult = { ok: true } | { ok: false; message: string }
export type Smoke = (url: string) => Promise<SmokeResult>

export const smoke: Smoke = async (url) => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: PHONE })
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]!))
    await page.goto(`${url}/`, { waitUntil: "load" })
    await page.waitForTimeout(2500)
    if (errors.length > 0) return { ok: false, message: `the app crashes on the web: ${errors[0]}` }
    // izraz se izvršava u browseru; root tsconfig nema DOM tipove, pa ide kao tekst
    const rendered = await page.evaluate<boolean>('(document.getElementById("root")?.childElementCount ?? 0) > 0')
    if (!rendered) return { ok: false, message: "the app renders nothing on the web (empty page at /)" }
    return { ok: true }
  } finally {
    await browser.close()
  }
}
