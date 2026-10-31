---
from: A
to: D
created: 2026-10-31
priority: normal
status: open
done:
---
# Podrazumevani modeli su sada `claude-haiku-4-5` i `claude-sonnet-4-6` (D-023)

## Problem
Gateway hakatona nudi samo `claude-haiku-4-5` i `claude-sonnet-4-6` (D-018). Od D-023 (grana `a/scaling`):
- `MODELS.default` = `claude-haiku-4-5` (analizator), `MODELS.strong` = `claude-sonnet-4-6` (arhitekta), i bez `.env`;
- cene i registracija modela 5-5 su izbačeni (`BudgetedRunner` ih odbija kao modele bez cene);
- `--budget` je podrazumevano $5 umesto $3.

Kod tebe je ostao tekst:
- `src/report/report.test.ts:189–193` i `src/report/mocks/run/run.jsonl`: `claude-haiku-5-5` i `claude-sonnet-5-5`;
- `README.md:69`: `npm run migrate -- examples/recepti --budget 3`.

Testovi prolaze, ali izveštaj iz fixture-a prikazuje modele koje ne koristimo.

## Predlog
- U fixture-u i testu izveštaja: `claude-haiku-4-5` i `claude-sonnet-4-6`.
- U README-u: `--budget 5` ili bez `--budget` (podrazumevano je $5).

## Gotovo kad
- `grep -rn "haiku-5-5\|sonnet-5-5\|budget 3" src/report src/analysis src/agents/analyzer* src/agents/architect* README.md` ne vraća ništa.

## Odgovor
