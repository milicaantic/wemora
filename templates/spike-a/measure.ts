// C1.2: koliko traje `expo export --platform web` za šablon.
// Pokretanje iz korena repoa: npx tsx templates/spike-a/measure.ts
//
// Za 1 i za 5 ekrana meri (svaki slučaj RUNS puta):
//   hladno         — prazan keš (`--clear`)
//   toplo          — ponovo, bez izmena
//   toplo + izmena — promenjen jedan ekran (realan slučaj za Gatekeeper)
import { execSync } from 'node:child_process';
import { cpSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RUNS = 3;
const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = resolve(HERE, '../expo');
const WORK = join(HERE, '.work');
const ENV = { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' };

function prepare(screens: number) {
  rmSync(WORK, { recursive: true, force: true });
  cpSync(TEMPLATE, WORK, { recursive: true, filter: (src) => !/[\\/](node_modules|dist|\.expo)$/.test(src) });
  symlinkSync(join(TEMPLATE, 'node_modules'), join(WORK, 'node_modules'), 'junction');
  cpSync(join(HERE, 'screen.tsx'), join(WORK, 'src/app/index.tsx'));
  for (let i = 1; i < screens; i++) cpSync(join(HERE, 'screen.tsx'), join(WORK, `src/app/ekran-${i}.tsx`));
}

function exportSeconds(clear: boolean): number {
  const start = Date.now();
  execSync(`npx expo export --platform web${clear ? ' --clear' : ''}`, { cwd: WORK, env: ENV, stdio: 'pipe' });
  return (Date.now() - start) / 1000;
}

// Prava izmena koda u jednom ekranu, kao kad Gatekeeper promoviše novi nacrt.
let version = 0;
function editOneScreen() {
  const file = join(WORK, 'src/app/index.tsx');
  const code = readFileSync(file, 'utf8').replace(/Poslednja radnja( v\d+)?:/, `Poslednja radnja v${++version}:`);
  writeFileSync(file, code);
}

const fmt = (xs: number[]) => {
  const avg = xs.reduce((a, b) => a + b, 0) / xs.length;
  return `prosek ${avg.toFixed(1).padStart(5)} s  (min ${Math.min(...xs).toFixed(1)}, max ${Math.max(...xs).toFixed(1)})`;
};

const rows: string[] = [];
for (const screens of [1, 5]) {
  prepare(screens);
  const cold: number[] = [];
  const warm: number[] = [];
  const edited: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    cold.push(exportSeconds(true));
    warm.push(exportSeconds(false));
    editOneScreen();
    edited.push(exportSeconds(false));
    console.log(`  ${screens} ekran(a), krug ${i + 1}: hladno ${cold[i].toFixed(1)} s, toplo ${warm[i].toFixed(1)} s, toplo + izmena ${edited[i].toFixed(1)} s`);
  }
  rows.push(`${screens} ekran(a) | hladno         | ${fmt(cold)}`);
  rows.push(`${screens} ekran(a) | toplo          | ${fmt(warm)}`);
  rows.push(`${screens} ekran(a) | toplo + izmena | ${fmt(edited)}`);
}

console.log('\n=== Rezultat ===');
for (const r of rows) console.log('  ' + r);
