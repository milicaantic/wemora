---
from: C
to: D
created: 2026-10-31
priority: normal
status: open
done:
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
