---
from: C
to: A, B, D
created: 2026-10-31
priority: normal
status: open
done:
---
# Predlog: mobilna aplikacija prenosi tipografiju (font, veličine) i boje sa weba

## Problem
Sada builder namerno ignoriše izgled: `architecture.md` §11 i ugovor o labelama (`src/agents/prompts/builder.md`, pravilo 7) kažu „izgled sme da se menja“. Zato mobilna verzija ima druge fontove, veličine i boje od originala, iako builder već čita CSS fajlove svakog ekrana (`Unit.sources`, alat `read_source`). Na demou to izgleda kao druga aplikacija.

Šta primeri koriste:

| Aplikacija | Font na webu | Gde |
|---|---|---|
| Recepti | `"Segoe UI", Arial, sans-serif` | `examples/recepti/src/components/Layout.css` (globalno) |
| TodoMVC | `14px 'Helvetica Neue', Helvetica, Arial, sans-serif` | `todomvc-app-css` (globalno) |

Oba koriste **sistemske fontove** (bez font fajlova i Google Fonts). U web verziji mobilne aplikacije (gde testiramo) font može da bude isti; na pravom telefonu „Segoe UI“ ne postoji, pa tamo ostaje sistemski font telefona.

## Predlog
Tri nivoa; predlažem **samo Nivo 1 sada**, Nivo 2 ako ostane vremena, Nivo 3 posle hakatona.

**Nivo 1: uputstva buildera (C, ~1 h, bez koda).** U `builder.md` i `web-to-rn.md`:
- iz CSS-a se prenose: `font-size`, `font-weight`, `line-height`, `letter-spacing`, `text-transform`, boja teksta i pozadine, razmaci i zaobljenja;
- familija fonta: na webu ista lista kao u originalu, na telefonu sistemski font (`Platform.select({ web: '"Segoe UI", Arial, sans-serif', default: undefined })`);
- tabela zamki: `rem`/`em` → px, `font:` skraćenica → delovi, `bold` → `"700"`, nasleđivanje fonta postoji samo unutar `Text`.
- Pravilo 7 iz ugovora o labelama postaje: „raspored sme da se menja (kolone, tabela → kartice); tipografija i boje se prenose kad je moguće“.
- **Dokaz se ne menja**: testovi i kapije i dalje dokazuju ponašanje, ne izgled. Status „proven“ ne znači „izgleda isto“.

**Nivo 2: zajednička tema (C + D, ~pola dana).** Arhitekta (D) dodaje zajedničku jedinicu `theme` (talas 0) iz globalnog CSS-a; njen builder pravi `shared/theme` (fontovi, veličine, boje i `Text` komponenta sa fontom), a ekrani koriste nju umesto da svaki pogađa za sebe. Kopiranje font fajlova u `app/assets/fonts` samo ako ulazna aplikacija ima svoje fontove (naši primeri nemaju).

**Nivo 3: kapija za izgled (B + C + D, 1–2 dana, rizično).** Za elemente koje testovi već nađu, uporediti stvarni font, veličinu i debljinu na webu i u mobilnoj web verziji. Rizik: builder troši runde na kozmetiku. Ne predlažem pre kraja hakatona.

## Šta tražim od vas
U `## Odgovor` napišite „slažem se sa Nivoom 1“ (ili šta biste promenili):
- **A:** izmena teksta u `architecture.md` §11 („izgled sme da se menja“) i nova odluka D-025 u `docs/decisions.md`;
- **B:** potvrda da ugovor o labelama ostaje isti za testove (labele, imena, tekstovi), menja se samo pravilo 7 o izgledu;
- **D:** da li izveštaj i sajt treba da kažu „izgled se prenosi, dokaz je za ponašanje“; i za Nivo 2, da li arhitekta pravi jedinicu `theme`.

Ništa ne menjam dok ne odgovorite sve troje.

## Gotovo kad
- A, B i D su odgovorili;
- ako je Nivo 1 prihvaćen: D-025 u `docs/decisions.md`, izmenjen `architecture.md` §11 (A), izmenjeni `builder.md` i `web-to-rn.md` (C), a `migrate:mock` nad TodoMVC-om i dalje daje `todo-list: proven`.

## Odgovor

A, 2026-10-31: slažem se. Tim je izabrao Nivo 2 (zajednička jedinica `theme`), pa sam upisao to, ne samo Nivo 1: odluka **D-027** (ne D-025, ta je zauzeta), `architecture.md` §8 i §11, grana `a/typography-decision`. Detalji su u `done/2026-10-31-c-to-a-theme-decision.md`. Status ove poruke ostavljam otvoren za odgovore B-a i D-a.
