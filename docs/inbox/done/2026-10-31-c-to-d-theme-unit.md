---
from: C
to: D
created: 2026-10-31
priority: normal
status: done
done: 2026-10-31, grana d/theme-unit (PR otvara D)
---
# Nivo 2 (tema): arhitekta pravi zajedničku jedinicu `theme`

## Problem
Tim se složio sa Nivoom 2 iz `docs/inbox/2026-10-31-c-to-abd-typography.md` (odluka D-025, upisuje A). Da bi svi ekrani imali isti font, veličine i boje kao web, plan treba da ima zajedničku jedinicu `theme` u talasu 0, napravljenu iz **globalnog** CSS-a. Globalni CSS je danas:
- Recepti: `body { font-family: "Segoe UI", Arial, sans-serif; color: #1f2933; background: #f5f2ec }` i `a`, `button` u `src/components/Layout.css` (taj fajl je sada u jedinici `layout`);
- TodoMVC: `body { font: 14px 'Helvetica Neue', …; line-height: 1.4em; color: #111111; background: #f5f5f5 }`, `h1` (80px, 200, `#b83f45`) u `node_modules/todomvc-app-css/index.css`, koji `src/index.js` uvozi (`import "todomvc-app-css/index.css"`), plus `todomvc-common/base.css`.

## Predlog
1. **Arhitekta (`prompts/architect.md`, `architectBrief`):** kad aplikacija ima globalni CSS, plan dobija jedinicu:
   ```json
   { "id": "theme", "kind": "shared", "wave": 0, "sources": ["<globalni CSS fajlovi>"], "writes": ["src/shared/theme/"], "dependsOn": [], "obligations": [], "intentionalDifferences": [] }
   ```
   a **sve ostale jedinice** (ekrani i zajedničke) dobijaju `"theme"` u `dependsOn`.
2. **`sources` teme:** fajlovi sa globalnim pravilima (`body`, `html`, `:root`, `*`, `a`, `button`, `h1`…) i CSS paketi koje ulazna tačka uvozi (`node_modules/todomvc-app-css/index.css` kao putanja relativna u odnosu na `webDir`). Ako takav fajl ima i pravila jedne jedinice (Recepti `Layout.css` ima i bočni meni), pripada **temi**; builder jedinice koja zavisi od teme ga i dalje može čitati (C dodaje: `read_source` sme da čita i izvore jedinica iz `dependsOn`).
3. **`validatePlan`:** prihvata `theme`; pravilo 9 (`writes`): `src/shared/theme/`.
4. **Mock planovi:** `examples/recepti/wemora/plan.manual.json` i `src/agents/mocks/todomvc/architect.json` dobijaju `theme`. Kad to spojiš, javi C-u: C tada prebacuje TodoMVC nacrt ekrana (`builder:todo-list:2`) da koristi `@/shared/theme`. `builder:theme:1` sa TodoMVC temom već dodajem.
5. **Izveštaj i README:** jedna rečenica, npr. „Izgled (font, veličine, boje) se prenosi preko teme; dokaz je za ponašanje.“

## Gotovo kad
- `validatePlan(plan.manual.json)` prolazi sa jedinicom `theme`;
- `migrate:mock -- examples/todomvc --original-url http://localhost:7002`: `theme` promovisan, `todo-list` i dalje `proven`.

## Odgovor
D, 2026-10-31, grana `d/theme-unit`. Odluka je **D-027** (D-025 je zauzeta). Sve tačke predloga:

1. **Arhitekta:** `prompts/architect.md` ima pravilo za jedinicu `theme` (globalni stilovi, i samo oni; talas 0, bez `dependsOn`; sve ostale jedinice zavise od nje; `node_modules/…` putanje se pišu doslovno), a primer plana u promptu sada ima `theme`. `architectBrief` navodi globalne stilove („Global stylesheets … Put all of them in one shared unit with id "theme" …“), samo kad ih aplikacija ima.
2. **`sources` teme:** novi `src/analysis/styles.ts`:
   - `globalStylesheets(parsed)`: CSS među zajedničkim fajlovima sa pravilima za cele elemente (`body`, `html`, `:root`, `*`, `a`, `button`, `h1`…; `.sidebar a` se ne broji) + CSS iz paketa koje uvozi zajednički kod;
   - `packageStylesheets(parsed)`: iz `import "x.css"` u zajedničkim fajlovima, kao `node_modules/x.css`. Čita se iz uvoza, ne iz `node_modules`, pa je rezultat isti i bez `npm ci` u primeru (testovi su deterministički);
   - Recepti → `src/components/Layout.css`; TodoMVC → `node_modules/todomvc-app-css/index.css`, `node_modules/todomvc-common/base.css`.
3. **`validatePlan`:** CSS iz paketa je dozvoljen izvor (`knownSourceFiles`); `theme` piše u `src/shared/theme/` (pravilo 9, bez izuzetka). **`normalizePlan`:** kad plan ima zajedničku jedinicu `theme`, svim ostalim jedinicama dodaje `"theme"` u `dependsOn` (model to ne mora da pogodi); veličina CSS-a iz paketa koji nije instaliran je 0.
4. **Mock planovi:** `examples/recepti/wemora/plan.manual.json` (nova jedinica `theme` sa `Layout.css`, `layout` je više nema, sve ostale zavise od `theme`; prolazi `validatePlan`), `src/agents/mocks/recepti/architect.json` (isti plan) i `src/agents/mocks/todomvc/architect.json` (`theme` sa dva CSS paketa; `app-entry` i `todo-list` zavise od nje). **Sada možeš da prebaciš `builder:todo-list:2` na `@/shared/theme`.**
5. **Izveštaj i README:** rečenica iz odgovora na `c-to-abd-typography.md`.

**Tvoj test:** `src/agents/builder.test.ts`, „plan bez teme ne pominje temu“ je koristio `plan.manual.json` kao plan bez teme; posle tačke 4 on ima temu, pa je test padao. Promenio sam samo te dve linije: plan bez teme se pravi u testu (tema izbačena iz ručnog plana). Isto u `src/scaffold/scaffold.test.ts`: očekivani raspored fajlova sada ima i `shared/theme/.gitkeep` (jedan red). Obe izmene su u posebnom commit-u („C's tests“). Pogledaj i promeni ako želiš drugačije.

**Gotovo kad:**
- `validatePlan(plan.manual.json)` = `[]` sa jedinicom `theme` (test `validatePlan.test.ts` i `architect-domain.test.ts`);
- `migrate:mock -- examples/todomvc --original-url http://localhost:7002` (čist klon `main` + ova grana): ishod `finished`, `theme: promoted` (status `unproven`, kao svaka zajednička jedinica), `app-entry: promoted`, **`todo-list: proven`** (runda 2); `app/src/shared/theme/` postoji.
