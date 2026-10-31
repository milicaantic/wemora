---
from: A
to: C
created: 2026-10-31
priority: high
status: open
done:
---
# Gatekeeper proverava nacrt pre `tests.ready`; builder pravi linkove na rute koje ne postoje

## Problem
**1. Gatekeeper ne čeka `tests.ready`.** Tester posle svakog sačuvanog testa upisuje `board().tests` (`src/agents/tester.ts:130`). `hasTests` u `src/agents/gatekeeperParticipant.ts:76` gleda samo da li na tabli ima testova, pa se nacrt proverava čim postoji prvi test, a ne kad tester završi.

Pravi prolaz `output/20261031-022913-todomvc` (TodoMVC, modeli gateway-a):
```
01:30:13  tester-1     tester.saved  add-todo-submit
01:30:32  tester-1     tester.saved  item-count-one
01:30:51  tester-1     tester.saved  item-count-two
01:30:54  tester-1     ... piše 4. test
01:31:09  builder-1    draft.submitted todo-app r1
01:31:09  gatekeeper-1 check_started   ← 3 testa, pokrivaju 2 od 6 obaveza
01:31:14  gatekeeper-1 unit.promoted
01:31:14  conductor    run.finished    ← tester prekinut
```
Posledice:
- `todo-app` je promovisan sa testovima za samo 2 od 6 obaveza (`add-todo`, `item-count`). Testova za filtere, `toggle-complete` i `clear-completed` nema.
- `coverage` je `null` (tester je upisuje na tablu tek na kraju), pa je status uvek `partial` i u izveštaju piše „elementi nisu izmereni“.
- Isto se desilo u prolazu `20261031-022711-todomvc` (2 testa).

**2. Builder pravi linkove na nepostojeće rute.** Original koristi `HashRouter` sa rutom `*` i čita filter iz putanje (`#/active`, `#/completed`). Plan ima jedan ekran `todo-app` (`route: "*"` → `/`), pa aplikacija ima samo `src/app/index.tsx`. Builder je u `Footer.tsx` i `index.tsx` napravio `<Link href="/active">` i `<Link href="/completed">`. Te rute ne postoje, pa klik vodi na „Unmatched route“. Ekran pritom čita `filter` iz `useLocalSearchParams`, a njega niko ne postavlja. Builder ne može ni da doda rutu, jer sme da piše samo u `src/screens/todo-app/`. Kapije ovo nisu uhvatile jer testa za filtere nema (tačka 1).

## Predlog
1. U `gatekeeperParticipant.ts` čuvati skup ekrana za koje je stigao `tests.ready`. `hasTests` neka gleda taj skup, ne `board().tests`. Ostaje isto: na `tests.missing` ekran se proverava bez testova.
2. Test za ovo: tester sačuva test na tablu, ali još ne pošalje `tests.ready`, pa stigne `draft.submitted`. Gatekeeper mora da čeka.
3. U prompt buildera (`src/agents/prompts/builder.md`): „Ne praviš nove rute. Linkovi idu samo na rute iz `routeMap`. Filteri i pogledi unutar istog ekrana su stanje ekrana (`useState`) ili search parametar iste rute (`/?filter=active`).“

## Gotovo kad
- `npm test` prolazi, sa novim testom iz tačke 2.
- `npm run migrate -- examples/todomvc --original-url http://localhost:7002 --budget 5`: u `run.jsonl` `gatekeeper.check_started` za `todo-app` dolazi posle `tests.ready`, a `results/todo-app.json` ima `coverage` različit od `null`.
- Filteri Active i Completed rade u `npx expo start --web`, ili kapija 5 pada na njima i builder dobija grešku u rundi 2.

## Odgovor
