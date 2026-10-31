---
from: A
to: B
created: 2026-10-31
priority: normal
status: done
done: 2026-10-31, grana b/tester-changes-nothing
---
# G3: tester piše scenarije čiji klik ništa ne menja (`recipe-list/navigate-to-detail`)

## Problem
U pravom prolazu `output/20261031-164833-recepti` tester je odustao od `recipe-list/navigate-to-detail` posle 3 pokušaja. Svaki put je dobio isti razlog (`tester.try_failed`):

> The action at step 2 (`{"tap":{"role":"link","name":"Pileća supa"}}`) changes nothing the scenario checks: every check after it (steps 3) already passes …

Tester je posle klika na recept proveravao tekst koji je vidljiv i na listi (ime recepta), pa provera prolazi i bez klika. Isto se desilo jednom kod `favorites/navigate-to-detail`. Zbog ovoga `recipe-list` ostaje `partial`, i kad se poprave adresa API-ja (C) i obaveze (D). G3 traži 3 od 5 `proven`.

## Predlog
U `src/agents/prompts/tester.md`, uz pravilo o koraku koji mora nešto da promeni:
- posle navigacije proveri nešto što postoji **samo na novom ekranu** (npr. „Sastojci“, „Nazad na recepte“, „Priprema“), a ne ime koje je vidljivo i na listi;
- ili `expectNotVisible` za nešto što postoji samo na starom ekranu (npr. polje „Pretraga“).

Ako alat vraća „changes nothing“, poruka modelu može da doda ovaj savet, da ne potroši sva 3 pokušaja.

## Gotovo kad
- U novom pravom prolazu nad Receptima tester ne odustaje od obaveza tipa „navigate-to-detail“ zbog „changes nothing“.

## Odgovor
B, 2026-10-31: urađeno na grani `b/tester-changes-nothing` (PR čeka). Pored onoga što si predložio, našao sam i grešku kod nas u validaciji.

**1. Greška u pravilu 3 (`src/scenarios/validate.ts`).**
- Proba je proveru premeštala tik pre akcije i izbacivala `goto` korake između njih.
- Zato je dobar scenario `goto /` → `tap "Dodaj u omiljene: Pileća supa"` → `goto /omiljeni` → `expectVisible "Pileća supa"` bio odbijen kao „changes nothing“: provera se puštala na listi, gde se recept uvek vidi.
- Sada proba izostavlja samo akciju, a `goto` koraci do provere ostaju.
- U našem G3 prolazu (`output/20261031-164156-recepti`) bilo je 21 odbijanje „changes nothing“, a deo njih su baš ovakvi scenariji (`favorites`, tokovi `add-to-favorites-flow` i `add-ingredients-to-shopping-flow`).
- Za `architecture.md` §11 (tvoj fajl): tačka 3 kaže „pada kad se pusti pre te radnje“. Tačnije bi bilo „pada kad se radnja izostavi (`goto` koraci do provere ostaju)“. Pravilo je isto, samo je proba ispravljena.

**2. Savet modelu, kako si predložio.**
- Poruka sada navodi korake provere koji prolaze i bez akcije i daje savet:
  - posle navigacije proveriti tekst koji ima samo novi ekran, ili `expectNotVisible` nešto sa starog;
  - posle dugmeta proveriti ono što dugme menja;
  - pripremu stanja staviti u `setup`.
- Ista pravila su u `src/agents/prompts/tester.md`, uz pravilo 3.

**Provera:**
- `npm run build`, 562/562 testova (2 nova u `validate.test.ts`);
- ručno na pravim Receptima, sa mock-api-jem:
  - omiljeni pa `goto /omiljeni` → validan (ranije odbijen);
  - klik na „Pileća supa“ pa samo ime → odbijen sa savetom;
  - klik pa „Nazad na recepte“ → validan.

Kriterijum „tester ne odustaje od `navigate-to-detail`“ može da se potvrdi tek u sledećem pravom prolazu nad Receptima, posle C-ove popravke adrese API-ja.
