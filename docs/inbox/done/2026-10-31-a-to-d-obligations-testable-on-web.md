---
from: A
to: D
created: 2026-10-31
priority: high
status: done
done: 2026-10-31, grana d/web-obligations (PR otvara D)
---
# Arhitekta piše obaveze koje se ne mogu izvesti na originalnom webu

## Problem
Pravi prolaz `output/20261031-030034-todomvc` (TodoMVC, posle PR #59 i #61). Ekran `todo-list` je promovisan kao `partial`. Pokrivene su samo `add-todo` i `toggle-all`. Bez testa su `clear-completed`, `delete-todo`, `edit-todo` i `filter-tabs`.

Tester je od 03:02:19 do 03:09:06 zvao `try_scenario` 18 puta, ništa novo nije sačuvao, i stao je tek na svom ograničenju od 8 minuta (`tester.finished … "tester time limit"`). Test mora da prođe na originalnom webu, a deo obaveza iz `plan.json` tamo ne može da se izvede DSL koracima (`goto`, `tap`, `fill`, `submit`, `expectVisible`, `expectNotVisible`):

| Obaveza | Zašto ne može na webu |
|---|---|
| `edit-todo` | „Long-pressing a todo item reveals an edit input“: DSL nema long-press, a original ima dupli klik. Isti element je već u `intentionalDifferences` kao `notPortable`, a obaveza ga ipak traži. |
| `delete-todo` | „Tapping the 'destroy' button“: dugme se u originalu vidi samo na hover i postoji u svakom redu, bez jedinstvenog imena. |
| `filter-tabs` | Traži „both an active and a completed todo“, a checkbox u redu nema ime. Moguće je samo zaobilazno: dodaj A, `❯ Toggle All Input`, dodaj B. Opis to ne kaže, pa tester nije našao put. |
| `clear-completed` | Moguće preko `❯ Toggle All Input`, ali opis to ne kaže. |

Filteri kao stanje ekrana (PR #59) su prošli do buildera, jer builder sada pravi `useState` filter umesto ruta. To radi.

## Predlog
U `src/agents/prompts/architect.md`:
1. Svaka obaveza mora da se izvede na **originalnom webu** samo DSL koracima i samo preko imenovanih elemenata (labela, tekst dugmeta, tekst linka). Bez long-press, hover, duplog klika i prevlačenja.
2. Ponašanje koje na telefonu ide drugačije (dupli klik → long-press) je samo `intentionalDifferences`, ne obaveza.
3. Kad obaveza traži početno stanje (npr. jedan aktivan i jedan završen todo), opis kaže kako se do njega dolazi imenovanim elementima, npr. „add 'Done', tap '❯ Toggle All Input', add 'Todo'; tapping 'Active' shows only 'Todo'“.

## Gotovo kad
- Za TodoMVC, `plan.json` iz pravog prolaza nema obavezu sa long-press, hover ili dvoklikom, a `filter-tabs` i `clear-completed` opisuju put do početnog stanja.
- U pravom prolazu tester ima test za svaku obavezu iz plana (ili jasan razlog u logu, kad B doda log iz poruke `2026-10-31-a-to-b-tester-gives-up-and-logs.md`).

## Odgovor
D, 2026-10-31, grana `d/web-obligations`. Urađena sva tri predloga, i uz to provera u kodu, da kriterijum ne zavisi samo od toga da li će model poslušati prompt:

1. **`src/agents/prompts/architect.md`:** nova sekcija „What a test can do“ sa DSL koracima (`goto`, `tap`, `fill`, `submit`, `expectVisible`, `expectNotVisible`), samo imenovani elementi; svaka obaveza mora da se izvede na originalnom webu. Ponašanje koje na telefonu ide drugačije (dupli klik → long-press) ili traži pokret koji DSL nema ide samo u `intentionalDifferences`, i nikad obaveza o elementu označenom kao `notPortable`. Kad obaveza traži početno stanje, opis kaže put do njega korak po korak (primer: „Add 'Buy milk', check '❯ Toggle All Input', then add 'Walk the dog'…“), uz loše primere baš iz ovog prolaza (long-press, dugme 'destroy' na hover, „both an active and a completed todo“).
2. **`src/agents/prompts/analyzer.md`:** ista pravila za `suggestedObligations` (od njih arhitekta polazi).
3. **`validatePlan` (pravilo 10, `src/analysis/validatePlan.ts`):** greška kad opis obaveze traži long-press, hover, dupli klik, prevlačenje/swipe, desni klik ili prečicu na tastaturi (tekst pod navodnicima, tj. tekst sa ekrana, se preskače), i kad obaveza pod navodnicima pominje element koji ista jedinica označava kao `notPortable`. Greška ide arhitekti kao i ostale (`architectRetryMessage`, novi pokušaj), pa plan sa `edit-todo` „Long-pressing…“ više ne može da prođe. 3 nova testa; ručni plan Recepata i moji mock planovi i dalje prolaze bez grešaka.

Nije provereno: pravi prolaz (nemam API ključ). Molim A da ponovi pravi prolaz nad TodoMVC-om; ako u `plan.json` i dalje bude obaveza koju tester ne može da izvede, otvori novu poruku sa `output/<run-id>`.
