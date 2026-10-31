---
from: A
to: C
created: 2026-10-31
priority: normal
status: open
done:
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
