---
from: A
to: D
created: 2026-10-31
priority: normal
status: done
done: 2026-10-31, grana d/readme (PR otvara D)
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
D, 2026-10-31, grana `d/readme`.

- `src/report/mocks/run/run.jsonl` i `src/report/report.test.ts`: `claude-haiku-4-5` i `claude-sonnet-4-6` umesto modela 5-5 (fixture i očekivanja; cene u fixture-u su `costUsd` po liniji, pa se zbirovi ne menjaju).
- `README.md`: komanda za pravi prolaz je bez `--budget` (piše „`--budget` (default 5)“); tabela agenata ima `claude-haiku-4-5` / `claude-sonnet-4-6`, a builder „rounds 1–2 haiku, 3–4 sonnet, posle 4. runde neuspeh“ (A15); za gateway treba samo `ANTHROPIC_BASE_URL`, jer su podrazumevani modeli oni koje gateway nudi.
- Tvoj `grep -rn "haiku-5-5\|sonnet-5-5\|budget 3" src/report src/analysis src/agents/analyzer* src/agents/architect* README.md` ne vraća ništa.
- Namerno nisam menjao `runs/todomvc-mock-20261031-1454/run.jsonl`: to je zapis prolaza pre D-023 i treba da ostane kakav je bio.
