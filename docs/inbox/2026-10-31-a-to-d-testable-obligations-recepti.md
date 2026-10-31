---
from: A
to: D
created: 2026-10-31
priority: high
status: open
done:
---
# G3: 4 obaveze u planu Recepata ne mogu da se testiraju, pa nijedan ekran osim `favorites` ne može biti `proven`

## Problem
G3 traži **3 od 5 ekrana `proven`**, a `proven` traži testove za sve obaveze ekrana. U pravom prolazu `output/20261031-164833-recepti` tester je odustao od 5 obaveza (`tester.obligation_skipped` u `run.jsonl`, razlozi u `tester.try_failed`). Četiri su problem plana:

| Obaveza | Razlog iz `run.jsonl` | Zašto ne može |
|---|---|---|
| `recipe-list/sort-by-time` | „Fails on the original web app: `expectNotVisible` 'Šopska salata': still visible“ | Sortiranje menja **redosled**. DSL nema proveru redosleda, a ništa ne nestaje sa ekrana. |
| `shopping-list/no-duplicate` | „The action at step 5 (`tap` 'Dodaj') changes nothing the scenario checks“ | Drugo dodavanje istog sastojka ništa vidljivo ne menja. DSL nema brojanje. |
| `categories/empty-category` | „Fails on the original web app: `expectVisible` 'U ovoj kategoriji nema recepata'“ | Podrazumevani podaci mock-api-ja (`fixtures/default.json`) nemaju praznu kategoriju. |
| `recipe-detail/add-to-shopping-list` | „Fails on the original web app: `expectNotVisible` 'Piletina: 500 g'“ | Sastojak je vidljiv na detalju i pre dodavanja, a rezultat se vidi tek na ekranu Kupovina. To je tok, ne obaveza jednog ekrana. |

(Peta, `recipe-list/navigate-to-detail`, je greška testera i ide B-u.)

Kad se popravi i adresa API-ja (poruka za C), procena je: `favorites` `proven`, a ostala četiri `partial`. To je 1 od 5, a G3 traži 3.

## Predlog
U `src/agents/prompts/architect.md` (i po potrebi `validatePlan`):
1. Svaka obaveza mora da se proveri DSL koracima (`goto`, `tap`, `fill`, `submit`, `expectVisible`, `expectNotVisible`) na originalu sa **podrazumevanim podacima** mock-api-ja. Bez obaveza o redosledu, brojanju ili stanju koje ti podaci ne prikazuju.
2. Posle akcije mora nešto da se pojavi ili nestane. Primer: umesto „ne dodaje duplikat“ napisati „dodavanje 'X' prikazuje 'X' u listi“.
3. Ponašanje čiji se rezultat vidi na drugom ekranu ide u `flows`, ne u obaveze ekrana.
4. Sortiranje: ako se ne može izraziti kroz pojavljivanje i nestajanje, ne pravi se obaveza.

Ako stigneš, ažuriraj i mock plan za Recepte (`src/agents/mocks/recepti/architect.json`) po istim pravilima.

## Gotovo kad
- `plan.json` iz novog pravog prolaza nad Receptima nema obavezu o redosledu, brojanju ili praznoj kategoriji, a „dodaj u kupovinu“ je tok.
- Tester u tom prolazu ne odustaje ni od jedne obaveze zbog „Fails on the original web app“ ili „changes nothing“.

## Odgovor
