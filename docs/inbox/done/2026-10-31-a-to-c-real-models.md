---
from: A
to: C
created: 2026-10-31
priority: normal
status: done
done: 2026-10-31, grana c/real-models
---
# Podrazumevani modeli su sada `claude-haiku-4-5` i `claude-sonnet-4-6` (D-023)

## Problem
Gateway hakatona nudi samo `claude-haiku-4-5` i `claude-sonnet-4-6` (D-018). Od D-023 (grana `a/scaling`):
- `MODELS.default` = `claude-haiku-4-5` (builder runde 1–2), `MODELS.strong` = `claude-sonnet-4-6` (runde 3–4), i bez `.env`;
- cene i registracija modela 5-5 su izbačeni (`BudgetedRunner` ih odbija kao modele bez cene);
- `--budget` je podrazumevano $5 umesto $3.

Kod tebe je `claude-haiku-5-5` ostao samo kao tekst. Testovi prolaze, jer `MockRunner` ne proverava model:
- `src/agents/builder.test.ts`: 9× `model: "claude-haiku-5-5"`;
- `docs/tasks/c.md:146`: „Model: Haiku 5.5 (runde 1–2), Sonnet 5.5 (3–4, F3)“.

## Predlog
- U `builder.test.ts`: `model: MODELS.default` (i `MODELS.strong` za rundu 3) iz `src/core/config.ts`.
- U `docs/tasks/c.md`: Haiku 4.5 (runde 1–2), Sonnet 4.6 (3–4).

## Gotovo kad
- `grep -n "haiku-5-5\|Haiku 5.5\|Sonnet 5.5" src/agents/builder* src/gatekeeper src/scaffold docs/tasks/c.md` ne vraća ništa.

## Odgovor
C, 2026-10-31: urađeno na grani `c/real-models`.

- `src/agents/builder.test.ts`: svih 9 mesta sada koristi `modelForRound(<runda>)` iz `src/core/config.ts` umesto teksta `"claude-haiku-5-5"`, pa test prati D-023 i svaku buduću promenu modela (runda 3 → `MODELS.strong`).
- `docs/tasks/c.md`: „Haiku 4.5 (runde 1–2), Sonnet 4.6 (3–4)“, uz napomenu na D-023 i `modelForRound`.
- Builder sam ne bira model: koristi `task.model` koji šalje Conductor, pa u `src/agents/builder.ts` nije bilo šta da se menja.
- Provera iz „Gotovo kad“ (`grep -n "haiku-5-5\|Haiku 5.5\|Sonnet 5.5" src/agents/builder* src/gatekeeper src/scaffold docs/tasks/c.md`) ne vraća ništa; `npm run build` i `builder.test.ts` (12/12) prolaze.

