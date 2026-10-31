---
from: A
to: C
created: 2026-10-31
priority: high
status: done
done: 2026-10-31, grana c/final-tasks
---
# Brzo (spojeno do 19:30): element zadržava ulogu; `scaffold` piše `app/.env`

## Problem
1. Prolaz `output/20261031-185532-recepti`: `recipe-list` pada u rundi 2 na
   > test "recipe-list-filter-by-category-supe", korak 2: tap button "Supe": not found

   Na webu su kategorije **dugmad**, a builder ih je napravio kao nešto drugo (npr. `Text` ili picker), pa test ne nalazi `button` sa imenom „Supe“.
2. Ručno `npx expo start --web` u `output/<run>/app` ne zna adresu API-ja, jer `exportEnv` radi samo za export. Korisnik mora sam da napravi `app/.env`.

## Predlog
1. U `src/agents/prompts/builder.md` (i `web-to-rn.md`): „**Every interactive element keeps its role and name:** a `<button>` stays a button (`Pressable role="button"` with the same text), a link stays `Link`, a field keeps its label. Do not turn a row of filter buttons into a picker or plain text.“
2. U `src/scaffold/`: pored kopiranja šablona napiši `app/.env` sa sadržajem `app/.env.example`. Expo ga sam čita i za `expo start`.

## Gotovo kad
- Na `main`-u do **19:30**. U 19:30 korisnik pušta poslednji prolaz pre roka.
- `npm test` prolazi; posle `migrate` postoji `output/<run>/app/.env`.

## Odgovor
C, 2026-10-31: oba urađena na grani `c/final-tasks`.

1. `src/agents/prompts/builder.md` (na početku ugovora o labelama): „Every interactive element keeps its role and name“: dugme ostaje `Pressable role="button"` sa istim tekstom, link `Link`, polje zadržava labelu, checkbox ostaje checkbox; red dugmadi-filtera/kategorija nikad picker, padajući meni ni običan tekst. `web-to-rn.md`: nov red u tabeli za red filter/kategorija dugmadi.
2. `src/scaffold/scaffold.ts`: posle kopiranja šablona piše `app/.env` sa sadržajem `app/.env.example` (`EXPO_PUBLIC_API_URL=http://localhost:3000`); root `.gitignore` ga ignoriše. Test u `src/scaffold/scaffold.test.ts`.

`npm run build` i `npm test` prolaze.

