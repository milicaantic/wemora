# Status: osoba A
Faza: F0
Poslednja izmena: 2026-10-30

## Gotovo (spojeno u main)
- `docs/tasks/a.md`: plan zadataka A0–A19 i pitanja za tim
- A0.0: `zod` 4.6.7, `vitest` 5.0.5, `tsconfig.json`, `vitest.config.ts` (PR #1)
- A0: `src/contracts/` (`scenario`, `difference`, `types`, `state`, `events`, `api`, `index`) i 11 testova u `contracts.test.ts` (PR #1)
- A1: skripte u `package.json`, `.env.example`, `.gitignore` (`output/`, lični Claude fajlovi), `docs/decisions.md`, privremeni `src/cli.ts`, ovaj fajl (PR #1)

## Gotovo, čeka review i spajanje (grana `skeleton`)
- A2: `scripts/check-layers.ts` (7 pravila, 10 testova), uključen u `npm run build`; odluka D-004 (`.ts` umesto `.sh`, posredna provera Mozaika u domenu)
- A3: `index.ts` u `analysis`, `report`, `scenarios`, `verify`, `scaffold` i `gatekeeper`; svaka funkcija ima tip iz `contracts/api.ts` i baca „not implemented“

## U radu
- ništa

## Sledeće
- PR grane `skeleton` (A2 + A3), pa kapija G0 na čistom klonu
- posle G0: A4 (`core/config.ts`)

## Mockovi koje koristim
- `src/cli.ts` samo javlja „not implemented“, a pravi CLI stiže u A11 i A18
- domenski `index.ts` (A3) su prazni potpisi koje vlasnici (B, C, D) popunjavaju u F1

## Čeka odluku tima
- review ugovora: B (`scenario.ts`, `ScenarioResult`, `Coverage`), C (`GateResult`, `UnitResult`, potpisi iz P16), D (`ParsedApp`, `AnalyzerReport`, `Plan`, `SplitParts`)
- pitanja P1–P18 u `docs/tasks/a.md`; P1 i P2 su zapisani kao predlozi D-002 i D-003 u `docs/decisions.md`; P3 i P14 su rešeni kroz D-004
- usklađivanje `architecture.md` §2, `CLAUDE.md` i `tim-plan.md` sa D-004 (`check-layers.ts`)

## Blokira me
- ništa
