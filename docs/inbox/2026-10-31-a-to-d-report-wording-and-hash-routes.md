---
from: A
to: D
created: 2026-10-31
priority: normal
status: open
done:
---
# Izveštaj: „nedostaju obaveze“ zbunjuje; plan za filtere u putanji kod rute `*`

## Problem
**1. Formulacija u izveštaju.** U `output/20261031-022913-todomvc/report.html` za `todo-app` piše: „Razlog: nedostaju obaveze: clear-completed, filter-active, filter-completed, toggle-complete“. Čita se kao „nije napravljeno“, a `Clear completed` postoji u aplikaciji. Stvarno značenje je „nijedan test ne dokazuje ovu obavezu“. Testova nema zbog trke kod C-a (`2026-10-31-a-to-c-gatekeeper-tests-ready.md`), ali i kad se ona popravi, formulacija ostaje zbunjujuća.

**2. Filteri u putanji kod rute `*`.** Original TodoMVC koristi `HashRouter` sa jednom rutom `*` i čita filter iz `useLocation().pathname` (`examples/todomvc/src/todo/components/footer.jsx:8`, linkovi `#/active` i `#/completed`). Plan ima jedan ekran `todo-app` (`route: "*"`, `routeMap: { "*": "/" }`) i obaveze `filter-active` i `filter-completed`, ali nigde ne kaže kako filter radi na telefonu. Builder je zato napravio linkove na rute `/active` i `/completed`, koje u aplikaciji ne postoje.

## Predlog
1. U izveštaju „nedostaju obaveze“ → „obaveze bez testa“. Takođe „elementi nisu izmereni“ → „pokrivenost nije izmerena (tester nije završio)“.
2. Kad je ruta `*`, a ekran čita `pathname` ili `hash`, arhitekta to navodi u opisu obaveze. Primer: „filter is screen state on mobile (no separate route), the 'Active' button switches it“. Druga mogućnost je namerna razlika (`intentionalDifferences`). Ti biraš.

## Gotovo kad
- Izveštaj za ekran bez testa za neku obavezu piše „obaveze bez testa: …“.
- `plan.json` za TodoMVC u obavezama filtera kaže da je filter stanje ekrana, a ne ruta.

## Odgovor
