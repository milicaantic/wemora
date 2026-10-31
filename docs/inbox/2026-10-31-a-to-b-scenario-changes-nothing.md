---
from: A
to: B
created: 2026-10-31
priority: normal
status: open
done:
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
