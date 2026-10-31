---
from: A
to: D
created: 2026-10-31
priority: normal
status: open
done:
---
# Novi događaji za izveštaj: broj agenata i razlog (A14, D-021)

## Problem
`tim-plan.md` F3 (D, tačka 1) traži da izveštaj prikaže „broj agenata i razlog“. Od A14 (grana `a/scaling`) Conductor više nema fiksni tim (1/2/1), nego broj računa po formulama iz `architecture.md` §9 i menja ga tokom prolaza. Svaka promena je u `run.jsonl`:

```json
{"agent":"conductor","event":"agents.rescaled","data":{"analyzers":1,"builders":0,"testers":0,"reason":"2986 tokens → 1 analyzer(s)"}}
{"agent":"conductor","event":"agents.rescaled","data":{"analyzers":1,"builders":1,"testers":1,"from":{"builders":0,"testers":0},"reason":"1 ready + 0 busy → 1 builder(s) (max 4), 1 tester(s) (max 2)"}}
{"agent":"conductor","event":"agent.stopped","data":{"id":"builder-2","kind":"builder"}}
```

- Prva `agents.rescaled` linija je uvek broj analizatora, na početku prolaza.
- Sledeće linije su builderi i testeri. `from` je broj pre promene.
- `reason` je tekst za čoveka. Kad zauzet agent ne može da se ugasi, dobija nastavak, npr. `; 1 busy builder(s) stay`.
- `agent.stopped` se loguje kad se slobodan agent ugasi. Pokretanje je i dalje `agent.started { id, kind }`.

Primer iz mock prolaza: `output/20261031-142739-todomvc/run.jsonl`.

## Predlog
U izveštaju, sekcija „Agenti“: vremenska linija promena (vreme, builderi/testeri, razlog) i najveći broj buildera i testera u prolazu. Ako ti trebaju druga imena ili polja, javi pre spajanja `a/scaling`.

## Gotovo kad
- `report.html` za prolaz sa `agents.rescaled` prikazuje broj agenata kroz vreme i razlog svake promene.

## Odgovor
