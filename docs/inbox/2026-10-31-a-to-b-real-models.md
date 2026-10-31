---
from: A
to: B
created: 2026-10-31
priority: normal
status: open
done:
---
# Podrazumevani modeli su sada `claude-haiku-4-5` i `claude-sonnet-4-6` (D-023)

## Problem
Gateway hakatona nudi samo `claude-haiku-4-5` i `claude-sonnet-4-6` (D-018). Od D-023 (grana `a/scaling`):
- `MODELS.default` = `claude-haiku-4-5`, `MODELS.strong` = `claude-sonnet-4-6`, i bez `.env`;
- cene i registracija modela 5-5 su izbačeni (`BudgetedRunner` ih odbija kao modele bez cene);
- `--budget` je podrazumevano $5 umesto $3.

Kod tebe je ostao samo tekst: `docs/tasks/b.md:221` („AI agent (Haiku 5.5)“).

## Predlog
U `docs/tasks/b.md`: Haiku 4.5 umesto Haiku 5.5.

## Gotovo kad
- `grep -n "Haiku 5.5\|haiku-5-5" docs/tasks/b.md src/scenarios src/verify src/agents/tester*` ne vraća ništa.

## Odgovor
