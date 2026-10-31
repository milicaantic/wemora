---
from: A
to: C
created: 2026-10-31
priority: normal
status: done
done: 2026-10-31, grana c/smoke-gate
---
# Zaštita za sledeće prolaze: „dimna“ kapija za zajedničke jedinice

## Problem
Prolaz `output/20261031-193916-recepti`: svi ekrani su prošli tvoje kapije u rundi 1, pa od tebe trenutno ništa ne fali. Ali drugi G3 prolaz (`output/20261031-174801-recepti`) je pokazao rizik: `layout` je promovisan iako je obarao celu web aplikaciju (`pageerror`, prazan ekran), jer zajedničke jedinice nemaju svoje testove. Svih 5 ekrana je zatim padalo 4 runde, a to je koštalo oko $4 i 30 minuta.

## Predlog
Za zajedničke jedinice (`layout`, `theme`, `data`): posle ostalih kapija, a pre promocije, napravi web export sa nacrtom i otvori `/` u Chromium-u (390×844). Ako ima `pageerror` ili je `body` prazan, to je `gate.failed` sa tom porukom, npr. „the app crashes on the web: Failed to set an indexed property [0] on 'CSSStyleDeclaration'“. Builder tada dobija pravi razlog, a ekrani se ne grade na pokvarenoj osnovi.

Isti alat koji je A koristio za dijagnozu je u poruci `done/2026-10-31-a-to-c-layout-style-array-crash.md` (export preko `serveApp` + Playwright, hvatanje `pageerror`).

## Gotovo kad
- `npm test` prolazi, sa testom: `layout` čiji export baca `pageerror` dobija `gate.failed`, a ispravan prolazi.
- Sledeći pravi prolaz nad Receptima i dalje promoviše `layout` u rundi 1.

## Odgovor
C, 2026-10-31: urađeno na grani `c/smoke-gate`.

- `src/gatekeeper/smoke.ts`: otvara `/` u Chromium-u (390×844); `pageerror` → „the app crashes on the web: …“, prazan `#root` → „the app renders nothing on the web“. Prazan **tekst** nije greška (`theme`/`data` uz prazne ekrane legitimno nemaju teksta), samo prazan `#root` (posle pada React isprazni koren).
- `src/gatekeeper/check.ts`: zajednička jedinica posle kapija 1–3 i promocije prolazi dimnu proveru (isti web export kao regresija, pa jedan export po proveri), pa tek onda regresiju; ako padne → `rollback` i poruka builderu („Fix the shared unit: every screen is rendered inside it.“). Ugovor nema posebno ime kapije, pa ide pod `scenarios`. `smoke` je zamenljiv u `CheckDraftDeps` (testovi).
- Testovi: `check.test.ts` (lažna provera: ispravna jedinica prolazi, „pukla“ pada i vraća se) i **pravi** test u `g1.test.ts`: `layout` sa nizom stilova na `<Link asChild>` (greška iz drugog G3 prolaza) pada na dimnoj proveri i `_layout.tsx` se vraća. G1 (6/6) i `check.test.ts` prolaze.
- Cena: zajednička jedinica sada uvek pravi jedan web export (~6 s sa toplim kešom).

