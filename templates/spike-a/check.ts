// Spike A: da li Playwright nalazi RN elemente na Expo webu istim selektorima kao na webu.
// Pokretanje iz korena repoa: npx tsx templates/spike-a/check.ts
//
// 1. kopira templates/expo u templates/spike-a/.work i ubacuje screen.tsx kao početnu rutu
// 2. web export + statički server + provera selektora (viewport 390x844)
// 3. dev server (Metro): šta se desi kad jedan ekran ima grešku
// 4. android export bez uređaja
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = resolve(HERE, '../expo');
const WORK = join(HERE, '.work');
const ENV = { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' };

function prepareWork() {
  rmSync(WORK, { recursive: true, force: true });
  cpSync(TEMPLATE, WORK, {
    recursive: true,
    filter: (src) => !/[\\/](node_modules|dist|\.expo)$/.test(src),
  });
  // node_modules se ne kopira (stotine MB), nego se linkuje na šablon.
  symlinkSync(join(TEMPLATE, 'node_modules'), join(WORK, 'node_modules'), 'junction');
  cpSync(join(HERE, 'screen.tsx'), join(WORK, 'src/app/index.tsx'));
}

function timed(cmd: string): { ok: boolean; seconds: number; output: string } {
  const start = Date.now();
  try {
    const output = execSync(cmd, { cwd: WORK, env: ENV, stdio: 'pipe', encoding: 'utf8' });
    return { ok: true, seconds: (Date.now() - start) / 1000, output };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    return { ok: false, seconds: (Date.now() - start) / 1000, output: `${err.stdout ?? ''}\n${err.stderr ?? ''}` };
  }
}

// Statički server sa SPA rezervom: nepoznata putanja vraća index.html.
function serveStatic(dir: string, port: number): Promise<Server> {
  const types: Record<string, string> = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf',
  };
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    let file = join(dir, path);
    if (!file.startsWith(dir) || !existsSync(file) || statSync(file).isDirectory()) file = join(dir, 'index.html');
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(port, () => ok(server)));
}

type Row = { selector: string; variant: string; result: string };

async function check(rows: Row[], selector: string, variant: string, fn: () => Promise<string>) {
  let result: string;
  try {
    result = await fn();
  } catch (e) {
    result = `NE RADI (${(e as Error).message.split('\n')[0]})`;
  }
  rows.push({ selector, variant, result });
}

async function selectorChecks(page: Page): Promise<Row[]> {
  const rows: Row[] = [];
  const t = { timeout: 3000 };
  const lastAction = (name: string) => page.getByText(`Poslednja radnja: ${name}`).waitFor(t);

  await check(rows, 'getByLabel("Pretraga") + fill', 'TextInput accessibilityLabel', async () => {
    const n = await page.getByLabel('Pretraga').count();
    if (n !== 1) return `NE RADI (nađeno ${n})`;
    await page.getByLabel('Pretraga').fill('sarma');
    await page.getByText('Tražite: sarma').waitFor(t);
    return 'RADI (fill menja stanje)';
  });

  for (const [name, variant] of [
    ['Traži', 'Pressable + Text, bez uloge'],
    ['Sačuvaj', 'Pressable role="button"'],
    ['Obriši', 'Pressable accessibilityRole="button"'],
  ] as const) {
    await check(rows, `getByRole("button", { name: "${name}" }) + click`, variant, async () => {
      const n = await page.getByRole('button', { name }).count();
      if (n !== 1) return `NE RADI (nađeno ${n})`;
      await page.getByRole('button', { name }).click();
      await lastAction(name);
      return 'RADI (click okida onPress)';
    });
  }

  await check(rows, 'getByText("Traži") + click', 'Pressable + Text, bez uloge', async () => {
    await page.getByText('Traži', { exact: true }).click();
    await lastAction('Traži');
    return 'RADI (click okida onPress)';
  });

  await check(rows, 'getByText("Kruška")', 'stavka u FlatList', async () => {
    await page.getByText('Kruška').waitFor(t);
    return 'RADI';
  });

  await check(rows, 'getByRole("listitem")', 'FlatList, bez uloga', async () => {
    const n = await page.getByRole('listitem').filter({ hasText: 'Jabuka' }).count();
    return n === 1 ? 'RADI' : `NE RADI (nađeno ${n})`;
  });

  await check(rows, 'getByRole("listitem") / getByRole("list")', 'View role="list" / "listitem"', async () => {
    const items = await page.getByRole('listitem').filter({ hasText: /Supa|Čorba|Paprikaš/ }).count();
    const lists = await page.getByRole('list').count();
    return items === 3 && lists >= 1 ? `RADI (${items} stavke, ${lists} lista)` : `NE RADI (stavki ${items}, lista ${lists})`;
  });

  return rows;
}

function printTable(rows: Row[]) {
  const w1 = Math.max(...rows.map((r) => r.selector.length));
  const w2 = Math.max(...rows.map((r) => r.variant.length));
  for (const r of rows) console.log(`  ${r.selector.padEnd(w1)} | ${r.variant.padEnd(w2)} | ${r.result}`);
}

// ---------- 2. web export + selektori ----------
async function staticPhase() {
  console.log('\n=== 2. Web export + selektori ===');
  const exp = timed('npx expo export --platform web');
  console.log(`  export: ${exp.ok ? 'uspeo' : 'PAO'} za ${exp.seconds.toFixed(1)} s`);
  if (!exp.ok) return console.log(exp.output.slice(-2000));

  const server = await serveStatic(join(WORK, 'dist'), 8090);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://localhost:8090/');
  await page.getByLabel('Pretraga').or(page.getByText('Tražite:')).first().waitFor({ timeout: 15000 });

  printTable(await selectorChecks(page));
  console.log('\n  ARIA snapshot (ovo Playwright "vidi"):');
  console.log((await page.locator('body').ariaSnapshot()).replace(/^/gm, '    '));
  console.log('\n  HTML dugmeta bez uloge:');
  console.log('    ' + (await page.getByText('Traži', { exact: true }).locator('xpath=..').evaluate((e) => e.outerHTML)).slice(0, 300));

  await browser.close();
  server.close();
}

// ---------- 3. dev server sa pokvarenim ekranima ----------
// Napomena: sa CI=1 Metro NE prati izmene fajlova, pa se pokvaren fajl
// ubacuje pre pokretanja, a za svaki slučaj Metro se pokreće iznova.
async function withMetro(brokenFile: string, label: string) {
  const target = join(WORK, 'src/app', brokenFile);
  cpSync(join(HERE, brokenFile), target);
  let log = '';
  const metro: ChildProcess = spawn('npx', ['expo', 'start', '--web', '--port', '8091'], {
    cwd: WORK, env: ENV, detached: true, stdio: 'pipe',
  });
  metro.stdout?.on('data', (d) => (log += d));
  metro.stderr?.on('data', (d) => (log += d));
  const alive = () => metro.exitCode === null;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let consoleErrors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text().split('\n')[0].slice(0, 160)));
  page.on('pageerror', (e) => consoleErrors.push(e.message.split('\n')[0].slice(0, 160)));
  const visibleText = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 160);
  const errors = () => (consoleErrors.length ? consoleErrors.slice(0, 2).join(' | ') : 'nema');
  const route = '/' + brokenFile.replace('.tsx', '');

  console.log(`  ${label}:`);
  try {
    for (let i = 0; i < 180 && !/Waiting on/.test(log) && alive(); i++) await new Promise((r) => setTimeout(r, 1000));
    consoleErrors = [];
    await page.goto('http://localhost:8091/');
    try {
      await page.getByLabel('Pretraga').waitFor({ timeout: 180000 });
      console.log('     početni (ispravan) ekran: RADI');
    } catch {
      console.log(`     početni (ispravan) ekran: NE RADI, na strani: "${await visibleText()}"`);
    }
    console.log(`     greške u browseru: ${errors()}`);
    consoleErrors = [];
    await page.goto(`http://localhost:8091${route}`);
    await page.waitForTimeout(5000);
    console.log(`     ${route}: na strani "${await visibleText()}"`);
    console.log(`     greške u browseru: ${errors()}`);
    console.log(`     Metro živ: ${alive() ? 'da' : 'NE'}`);
    const metroErr = log.split('\n').find((l) => /error/i.test(l));
    console.log(`     Metro log: ${metroErr ? metroErr.trim().slice(0, 200) : 'bez greške'}`);
  } finally {
    await browser.close();
    if (metro.pid) process.kill(-metro.pid, 'SIGTERM');
    rmSync(target, { force: true });
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function devPhase() {
  console.log('\n=== 3. Dev server (Metro) i pokvaren ekran ===');
  await withMetro('broken-render.tsx', 'a) jedan ekran baca grešku pri renderovanju');
  await withMetro('broken-syntax.tsx', 'b) jedan ekran ima sintaksnu grešku');
}

// ---------- 4. android export ----------
function androidPhase() {
  console.log('\n=== 4. Android export bez uređaja ===');
  const exp = timed('npx expo export --platform android --output-dir dist-android');
  console.log(`  ${exp.ok ? 'uspeo' : 'PAO'} za ${exp.seconds.toFixed(1)} s`);
  if (!exp.ok) console.log(exp.output.slice(-1500));
}

console.log('=== 1. Priprema: kopija šablona u templates/spike-a/.work ===');
mkdirSync(WORK, { recursive: true });
prepareWork();
const only = process.argv[2]; // npr. "dev" za samo treći deo
if (!only || only === 'web') await staticPhase();
if (!only || only === 'dev') await devPhase();
if (!only || only === 'android') androidPhase();
