# Wemora

CLI alat koji uzima React web aplikaciju (SPA sa React Routerom) i pravi Expo (React Native) mobilnu aplikaciju, ekran po ekran. Za svaki ekran **izvršnim testovima dokazuje** da se mobilna verzija ponaša isto kao original. Projekat za JigJoy × NTP Novi Sad Hackathon, kategorija Freestyle, napravljen na Mozaik frameworku.

## Dokumentacija

- `docs/architecture.md`: **pročitaj na početku sesije.** Globalni opis sistema: komponente, tok, događaji, izlaz na disku, kapije, statusi, invarijante.
- `src/contracts/`: tačni oblici podataka. Kod pobeđuje tekst.
- `docs/tasks/<a|b|c|d>.md`: zadaci te osobe, sa ID-jevima i kriterijumom završetka.
- `docs/status/<a|b|c|d>.md`: trenutno stanje (šta je gotovo, šta je mock). Ažurira se sa `/handoff <slovo>`.
- `docs/decisions.md`: **pročitaj pre nego što predložiš promenu arhitekture ili ugovora.**
- `docs/inbox/`: poruke između članova tima (D-019). **Na početku sesije proveri otvorene poruke za svoje slovo** (`to:` i `status: open`) i reci ih korisniku. Format i pravila su u `docs/inbox/README.md`.
- `docs/wemora-plan.md` i `docs/tim-plan.md`: pozadina za ljude (zašto, raspored). Otvori samo kad ti treba "zašto".

Ako se zadatak ne slaže sa `docs/architecture.md` ili `src/contracts/`, **stani i reci šta se ne slaže**. Ne rešavaj sam.

## Arhitektura: 5 slojeva, zavisnosti idu samo nadole

```
5. CLI           src/cli.ts
4. Orkestracija  src/orchestration/      Conductor, red zadataka, talasi, broj agenata
3. Agenti        src/agents/             Mozaik učesnici, tanki omotači
2. Domen         src/analysis/ scenarios/ gatekeeper/ scaffold/ report/ verify/
1. Osnova        src/contracts/ (samo tipovi i šeme) + src/core/ (runtime, stanje, runner, log)
```

- Sloj sme da uvozi samo iz slojeva ispod sebe.
- **Domen (sloj 2) ne sme da uvozi `@mozaik-ai/core`, `agents/` ni `orchestration/`, ni direktno ni preko drugih fajlova** (iz `core/` sme samo `config.ts` i `log.ts`). To proverava `scripts/check-layers.ts` u `npm run build`. Zbog ovog pravila `verify` radi bez API ključa.
- Agenti (sloj 3) sadrže samo prompt, alate i reakcije na događaje. Pravi posao rade funkcije iz domena.
- Domenski moduli se pozivaju samo preko svog `index.ts` i tipova iz `src/contracts/`.

## Vlasništvo foldera

| Ko | Folderi |
|---|---|
| A | `src/contracts/` (vodi), `src/core/`, `src/orchestration/`, `src/agents/_shared/`, `src/cli.ts`, `scripts/check-layers.ts` |
| B | `src/scenarios/`, `src/verify/`, `src/agents/tester.ts`, `scripts/sabotage.ts` |
| C | `src/gatekeeper/`, `src/scaffold/`, `templates/expo/`, `src/agents/builder.ts`, `src/agents/gatekeeperParticipant.ts` |
| D | `src/analysis/`, `src/report/`, `examples/`, `src/agents/analyzer.ts`, `src/agents/architect.ts`, `README.md`, `runs/` |

Promptovi agenata su u `src/agents/prompts/<agent>.md`, i svako je vlasnik prompta svog agenta.

## Pravila za rad

- **Radi samo u folderima osobe za koju radiš.** Ako ti treba nešto iz tuđeg foldera, napravi mock kod sebe (`<folder>/mocks/`) i zabeleži to u svom `docs/status/*.md`.
- **Ne menjaj `src/contracts/`.** Ako ugovor mora da se promeni, stani i reci šta tačno treba promeniti i zašto. Izmena ide kroz granu `contracts/<opis>` koju spaja A.
- Svi tipovi koje delovi razmenjuju dolaze iz `src/contracts/`. Ne pravi svoje kopije tipova.
- Spoljne podatke (JSON od modela, fajlovi sa diska) uvek proveri zod šemom pre upotrebe.
- Ne dodaji npm zavisnosti bez pitanja. Zavisnosti su u jednom `package.json` i dodaju se kroz mali PR.
- Testovi (vitest) ne zovu pravi model ni mrežu. Koristi MockRunner ili mockove.

## Mozaik: obavezno

- Verzija je `@mozaik-ai/core@4.1.0`, tačno pinovana. **Jedini izvor istine za API je `node_modules/@mozaik-ai/core/dist/index.d.ts`.** Ne izmišljaj funkcije i ne gledaj GitHub izvor, jer se razlikuje od objavljenog paketa.
- **Samo `src/core/runtime.ts` poziva `defineRuntime`**, jer runtime sme da se inicijalizuje jednom po procesu. Svi ostali uvoze `runLoop`, `sendEvent`, `join` i `leave` odatle.
- `runLoop` vraća `void` i nema `.catch`: greška API-ja ruši proces. Zato inference ide kroz `BudgetedRunner` (retry, nikad ne baca grešku), a `core/safety.ts` hvata `unhandledRejection`.
- **Jedan agent sme da ima samo jednu aktivnu petlju.** Memorija agenta raste na mestu, pa za svaki zadatak koristi svež `ModelContext` (pomoćna funkcija u `agents/_shared/`).
- Svaki događaj ide **svim** učesnicima, uključujući `inference.stream`. Handleri moraju da filtriraju po `event.type` i `event.producerId`. Kraj petlje je `model.answer` od tog agenta.
- **Događaji nose samo ID-jeve** (npr. `{ unitId }`), a podaci stoje na tabli (`MigrationState`) i na disku.
- U jednom koraku petlje izvršava se samo prvi function call. Paralelizam dolazi od više agenata, ne od više alata.
- Modeli su `claude-haiku-4-5` (osnovni) i `claude-sonnet-4-6` (arhitekta, runde 3–4), oba ugrađena u Mozaik, pa se ništa ne registruje (D-023). Imena su samo u `core/config.ts` (`MODELS`).
- Uvek postavi `maxOutputTokens`. Anthropic mapper ne radi prompt caching, ali gateway hakatona kešira sam: trošak se računa iz `rowResponse.usage` (D-020).
- **Ne postavljaj `MOZAIK_API_KEY`** osim ako tim nije tako odlučio: uključuje slanje događaja i memorije agenata na Mozaik Cloud.

## Izlaz jednog prolaza i vlasništvo nad fajlovima

```
output/<run-id>/
  plan.json  analysis/  tests/<ekran>.json  staging/<builder>/  app/  results/  run.jsonl  report.html
```

- Builder piše **samo** u `staging/<svoj>/`. **Samo Gatekeeper piše u `app/`.** OwnershipGuard (Mozaik interception) to sprovodi.
- Ekran sa nula validiranih testova **nikad nije "dokazan"**. Statusi su: dokazan, delimično dokazan, nedokazan, neuspeo.

## Komande

```bash
npm run build          # tsc --noEmit + provera slojeva
npm test               # vitest, bez mreže
npm run migrate:mock   # ceo tok bez API poziva (MockRunner)
npm run migrate -- examples/recepti
npm run verify -- output/<run-id>
npm run smoke          # ceo tok nad TodoMVC-om
```

`templates/expo/` i `examples/*` imaju svoj `package.json` i svoj `npm install`. Nisu u root `tsconfig`-u i ne proveravaju se sa `npm run build`.

## Konvencije

- TypeScript strict, ESM, Node 22, pokretanje preko `tsx`.
- Imena u kodu i komentari na engleskom, dokumentacija u `docs/` na srpskom.
- Javni API foldera je samo ono što izvozi njegov `index.ts`.

## Git

- Grane: `a/<opis>`, `b/<opis>`, `c/<opis>`, `d/<opis>`, a za ugovore `contracts/<opis>`. Kratkog su veka.
- Commit: `<folder>: opis`, npr. `scenarios: maestro compiler`.
- Pre spajanja: `git pull --rebase origin main`, pa `npm run build`.
- **Nikad ne commit-uj `.env`, `.claude/settings.local.json` ni `CLAUDE.local.md`.**
