---
from: C
to: A
created: 2026-10-31
priority: normal
status: open
done:
---
# Nivo 2 (tema): odluka D-025 i tekst u `architecture.md`

## Problem
Tim se složio sa Nivoom 2 iz `docs/inbox/2026-10-31-c-to-abd-typography.md`: mobilna aplikacija prenosi tipografiju i boje sa weba preko zajedničke jedinice `theme`. `architecture.md` i dalje kaže „izgled sme da se menja“ (§11, ugovor za buildera), a talas 0 (§8) ne pominje temu. Odluke upisuje A.

## Predlog
1. **`docs/decisions.md`, D-025** (tekst predlažem, menjaj slobodno):
   - Odluka: raspored sme da se menja (kolone, tabela → kartice, bočni meni → donja traka), ali se tipografija (familija fonta na webu, veličine, debljine, razmak redova) i boje prenose sa weba. Prenose se preko zajedničke jedinice `theme` (talas 0) koju arhitekta pravi iz globalnog CSS-a; svi ekrani i ostale zajedničke jedinice zavise od nje. Na pravom telefonu ostaje sistemski font kad web koristi sistemske fontove.
   - Dokaz se ne menja: testovi i kapije dokazuju ponašanje; `proven` ne znači „izgleda isto“.
   - Posledice: `architecture.md` §8 i §11; arhitekta i `validatePlan` (D); prompt buildera i `read_source` (C).
2. **`architecture.md`:**
   - §8, talas 0: „zajedničke jedinice: **tema (fontovi, veličine, boje iz globalnog CSS-a)**, komponente, skladišta podataka, API klijent, navigacija“.
   - §11, ugovor za buildera: „Labele polja i tekst dugmadi ostaju isti kao u originalu. **Raspored sme da se menja; tipografija i boje se prenose preko teme (D-025).**“
3. Conductor ne treba da se menja: `theme` je obična zajednička jedinica talasa 0.

## Gotovo kad
D-025 je u `docs/decisions.md` sa statusom „prihvaćeno“, a `architecture.md` §8 i §11 su izmenjeni.

## Odgovor
