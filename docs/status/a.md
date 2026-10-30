# Status: osoba A
Faza: F0
Poslednja izmena: 2026-10-30

## Gotovo (spojeno u main)
- `docs/tasks/a.md`: plan zadataka A0–A19 i pitanja za tim

## Gotovo, čeka review i spajanje (grana `a/core`)
- A0.0: `zod` 4.6.7, `vitest` 5.0.5, `tsconfig.json`, `vitest.config.ts`
- A0: `src/contracts/` (`scenario`, `difference`, `types`, `state`, `events`, `api`, `index`) i 11 testova u `contracts.test.ts`
- A1: skripte u `package.json`, `.env.example`, `.gitignore` (`output/`, lični Claude fajlovi), `docs/decisions.md`, privremeni `src/cli.ts`, ovaj fajl

## U radu
- ništa

## Sledeće
- A2: `scripts/check-layers.sh` (prvo odgovor na P14: Git Bash na Windowsu)
- A3: prazni `index.ts` u domenskim folderima, sa potpisima iz `contracts/api.ts`
- kapija G0

## Mockovi koje koristim
- `src/cli.ts` samo javlja „not implemented“, a pravi CLI stiže u A11 i A18

## Čeka odluku tima
- review ugovora: B (`scenario.ts`, `ScenarioResult`, `Coverage`), C (`GateResult`, `UnitResult`, potpisi iz P16), D (`ParsedApp`, `AnalyzerReport`, `Plan`, `SplitParts`)
- pitanja P1–P18 u `docs/tasks/a.md`; P1 i P2 su zapisani kao predlozi D-002 i D-003 u `docs/decisions.md`

## Blokira me
- ništa
