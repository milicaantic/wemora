# Zadaci: osoba C — Gatekeeper i mobilna aplikacija

> **Za agenta (Claude Code):** radiš za osobu C. Na početku sesije pročitaj `CLAUDE.md`, `docs/architecture.md` (§7, §8, §10, §12, §14), ovaj fajl i `docs/status/c.md`. Za Mozaik API čitaj `.claude/rules/mozaik.md` i `node_modules/@mozaik-ai/core/dist/index.d.ts`, ništa drugo. Radi **samo** korak koji ti kažem (npr. „radimo C1.3“). Kad završiš korak: pusti `npm run build && npm test`, štikliraj kriterijume ovde i ažuriraj `docs/status/c.md`.
>
> **Ako se ovaj fajl ne slaže sa `docs/architecture.md` ili `src/contracts/`, važe oni. Stani i reci šta se ne slaže.**

## Moji folderi (samo ovde pišem)

- `src/gatekeeper/`
- `src/scaffold/`
- `templates/expo/`
- `src/agents/builder.ts`
- `src/agents/gatekeeperParticipant.ts`
- `src/agents/prompts/builder.md`, `src/agents/prompts/web-to-rn.md`
- `docs/status/c.md`; `docs/decisions.md` samo za moje odluke (Spike A, export)

**Ne diram:** `src/contracts/` (izmenu tražim od A), `src/scenarios/` (B), `src/core/` i `src/orchestration/` (A), `src/analysis/` i `examples/` (D), `package.json` (samo kroz poseban mali PR).

**Kad mi treba tuđi deo koji još ne postoji:** mock u `src/gatekeeper/mocks/` ili `src/scaffold/mocks/`, i zapis u `docs/status/c.md` pod „Mockovi“.

## Šta ja dajem drugima (javni API, izvozi samo `index.ts`)

| Funkcija | Ko je koristi |
|---|---|
| `scaffold(plan, outDir)` | A (Conductor posle `plan.ready`), B (placeholder = „prazan ekran“) |
| `checkDraft(unitId, draftDir, tests)` → `GateResult[]` | builder (`check_draft`, kapije 1–4), Gatekeeper-učesnik (sve kapije) |
| `promote(unitId, draftDir)`, `rollback(unitId)` | Gatekeeper-učesnik |
| `serveApp(appDir)` → URL | B (`runScenarios` nad mobilnom verzijom), `verify` |
| `computeStatus(...)` → `ScreenStatus` | izveštaj (D), `verify` (B) |

Tačni potpisi su u `src/contracts/`. Ako ih tamo nema, tražim od A da ih doda.

## Ko mi radi review

Moje PR-ove gleda **B**. Ja gledam PR-ove od **A** i **B**. Review: najviše 10 minuta. Ako ne stigne za 15 minuta, spajam sama.

## Pre svakog PR-a

- [ ] `git pull --rebase origin main`
- [ ] `npm run build` (tsc + provera slojeva) zeleno
- [ ] `npm test` zeleno, bez mreže i bez pravog modela
- [ ] `docs/status/c.md` ažuriran
- [ ] grana `c/<opis>`, commit `<folder>: opis` (npr. `gatekeeper: forbidden apis gate`)

---

## F0 — Temelj

### C0.1 Expo šablon
**Cilj:** zamrznut Expo SDK 58 projekat (Expo Router, TypeScript) u `templates/expo/`, iz koga scaffold pravi svaku mobilnu aplikaciju.
**Gotovo kada:**
- [x] `templates/expo/` ima svoj `package.json` i radi `npm install` u njemu
- [x] `npx expo export --platform web` u `templates/expo/` uspeva
- [x] u šablonu postoji `src/app/`, `src/screens/`, `src/shared/` (raspored iz architecture §7)
- [x] API adresa se čita iz `EXPO_PUBLIC_API_URL`
- [x] `node_modules` i build izlaz šablona su u `.gitignore`

### Kapija G0 (proverava A) — moj deo
- [ ] `templates/expo/` pravi web export na čistom klonu

---

## F1 — Moj deo radi sam (bez AI-ja i bez Mozaika)

### C1.1 Spike A — NAJVAŽNIJE, prvo
**Cilj:** dokazati da Playwright nalazi RN elemente na Expo web verziji istim selektorima kao na webu.
**Šta:** jedan ručno napisan Expo ekran: `TextInput` sa `accessibilityLabel="Pretraga"`, dugme (`Pressable` + `Text`), lista od par stavki. Mala Playwright skripta proveri `getByLabel("Pretraga")`, `getByRole("button", { name })`, `getByText`, i `role="listitem"`.
**Gotovo kada:**
- [x] rezultat za svaki selektor zapisan u `docs/decisions.md` (radi / ne radi / kako)
- [x] ako nešto **ne radi**: odmah poruka timu → prelazimo na `testID` ugovor (B menja kompajler) — nije potrebno: sve radi uz `role`, poruka timu o obaveznom `role` (D-005)
- [x] usput zabeleženo: šta se desi na dev serveru kad jedan ekran ima grešku (ruši li ceo Metro)
- [x] usput zabeleženo: radi li `expo export --platform android` bez uređaja (za kapiju 6)
**PR:** `c/spike-a` (samo `docs/decisions.md` i primer)

### C1.2 Merenje exporta
**Gotovo kada:**
- [x] izmereno koliko traje `expo export --platform web` za šablon
- [x] odluka u `docs/decisions.md`: ako je preko ~30 s → Gatekeeper koristi Metro dev server nad `app/`, a statički export samo `verify`; inače statički export svuda

### C1.3 `scaffold/`
**Cilj:** `scaffold(plan, outDir)` iz plana napravi Expo aplikaciju sa praznim ekranima.
**Šta:** kopira šablon u `outDir/app/`; za svaki ekran jedna Expo Router ruta u `app/src/app/…` (po `routeMap`); placeholder u `app/src/screens/<unitId>/`; prazni `app/src/shared/<unitId>/` za zajedničke jedinice.
**Mock:** ručno napisan `plan.json` za Recepte u `src/scaffold/mocks/` (5 ekrana + zajedničke jedinice).
**Gotovo kada:**
- [x] test: nad mock planom nastaje tačan raspored fajlova
- [x] placeholder ekran nema nijednu labelu/tekst koji bi test mogao da nađe (B ga koristi kao „prazan ekran“)
- [x] ručno: aplikacija iz mock plana se pokreće i rute se otvaraju
**PR:** `c/scaffold`

### C1.4 Kapije 1–4 (`gatekeeper/gates/`), tačno ovim redom
1. `parse` — Babel parsira sve fajlove nacrta
2. `forbiddenApis` — nema `div`, `span`, `window`, `document`, `localStorage`, `react-dom`, `react-router-dom`
3. `tsc` — nacrt + `app/` bez grešaka tipova
4. `labels` — svaka labela i tekst iz testova jedinice postoji u kodu nacrta

**Pravilo:** prva kapija koja padne vraća grešku. Poruka mora da bude **razumljiva builderu** (koji fajl, koja linija, šta tačno fali, npr. „nema elementa sa accessibilityLabel 'Pretraga'“).
**Mock:** dobri i loši fixture fajlovi u `src/gatekeeper/mocks/`, ručno napisan testovi JSON za `labels`.
**Gotovo kada:**
- [x] za svaku kapiju test: dobar fixture prolazi, loš pada **baš na toj kapiji** sa jasnom porukom
- [x] domen ne uvozi `@mozaik-ai/core` (`npm run build` to proverava)
- [ ] opciono, kasnije: kapija 6 `androidExport`
**PR:** `c/gates`

### C1.5 `promote`, `rollback`, `serveApp`
**Šta:** `promote(unitId, draftDir)` kopira `staging/<builderId>/<unitId>/` u `app/src/` (isti raspored) i čuva prethodnu verziju; `rollback(unitId)` je vraća. `serveApp(appDir)` → URL, po odluci iz C1.2.
**Gotovo kada:**
- [x] test: promote pa rollback vraća **tačno** prethodne fajlove
- [x] `serveApp` vraća URL na kome se otvara aplikacija; zna da se ugasi (bez visećih procesa)
**PR:** `c/promote-serve`

### C1.6 `computeStatus`
**Šta:** po tabeli iz architecture §10: `proven` / `partial` / `unproven` / `failed`.
**Gotovo kada:**
- [x] test za sva 4 statusa
- [x] test: **nula testova nikad nije `proven`**
**PR:** može uz `c/gates` ili zaseban

### Kapija G1 (proverava D) — moj deo
- [x] Spike A odlučen i zapisan
- [x] `scaffold()` nad mock planom za Recepte pravi aplikaciju koja se servira
- [x] ručno napisan dobar ekran prolazi sve 4 kapije; loš pada na tačnoj
- [ ] **prvi zajednički test sa B:** B-ov scenario pušten preko mog `serveApp()` nad ručno napisanim RN ekranom prolazi
- [x] `docs/status/c.md` ažuriran

> **Ovde prvi put vidiš mobilnu aplikaciju u browseru** (ručni ekran preko `serveApp`). Mozaik još ne vidiš — tvoj F1 je namerno bez njega.

---

## F2 — Agenti: builder i Gatekeeper-učesnik

Zavisi od A: `runtime` (`runLoop`, `sendEvent`), `freshContext()`, `OwnershipGuard`, pomoćnik za alate. Ako još nisu spojeni, radi prompt i alate nad mockom i zabeleži u status.

### C2.1 Promptovi
**Šta:** `prompts/builder.md` (uloga, pravila, ugovor o labelama: **labele polja i tekst dugmadi ostaju isti kao na webu, izgled sme da se menja**) i `prompts/web-to-rn.md` (tabela mapiranja web → RN: `div`→`View`, `input`→`TextInput` sa `accessibilityLabel`, `button`→`Pressable`+`Text`, tabela→lista kartica, `localStorage`→zajednički store iz talasa 0, `Link`→Expo Router…).
**Gotovo kada:**
- [ ] B je pogledao ugovor o labelama i slaže se sa njim

### C2.2 `agents/builder.ts`
**Alati:**
- `read_source` — izvorni web fajlovi jedinice, samo čitanje
- `read_app` — trenutni `app/`, samo čitanje
- `write_file` — sa `OwnershipGuard` samo u `staging/<builderId>/<unitId>/`
- `check_draft` — kapije 1–4 (brza provera)
- `submit_draft` → `draft.submitted { unitId, round }`

**Builder nema nijedan alat za testove.** Model: Haiku 5.5 (runde 1–2), Sonnet 5.5 (3–4, F3). Svaka runda svež kontekst: prompt + izvor + trenutni kod + poslednja greška.
**Gotovo kada:**
- [ ] test: upis van `staging/<builderId>/<unitId>/` je odbijen (guard)
- [ ] test: builder ne može da pročita `tests/`
- [ ] 2–3 primera odgovora buildera za MockRunner (za `migrate:mock` nad TodoMVC-om), predati A
**PR:** `c/builder`

### C2.3 `gatekeeper/index.ts` — `checkDraft` ceo put
**Redosled:** kapije 1–4 → kapija 5 `scenarios` (B-ov `runScenarios()` nad Expo web buildom sa nacrtom, viewport 390×844) → `promote` u `app/` → regresija (testovi svih već promovisanih jedinica) → `rollback` ako regresija padne.
**Zajedničke jedinice (talas 0):** samo kapije 1–3 (i opciono 6), bez UI testova.
**Gotovo kada:**
- [ ] vraća `GateResult[]` sa porukom koju builder razume; kod regresije i listu pokvarenih testova
- [ ] test sa mockom `runScenarios` (dok B ne spoji pravi)

### C2.4 `agents/gatekeeperParticipant.ts`
**Šta:** deterministički učesnik (`createHuman`, handleri filtriraju po `event.type`). Na `draft.submitted` pušta `checkDraft` i šalje `gate.failed { unitId, round }` ili `unit.promoted { unitId }`. Na `tests.ready` beleži da jedinica može da se proverava.
**Pravila:**
- proverava **serijski**, jedan nacrt odjednom (red čekanja)
- **bez testova nema zelenog**: ekran bez testova čeka (timeout iz `core/config.ts`)
- događaji nose samo ID-jeve; rezultat ide u `results/<unitId>.json`
**Gotovo kada:**
- [ ] test nad lažnim događajima: dva nacrta u isto vreme se proveravaju jedan za drugim
- [ ] test: nacrt bez testova ne biva promovisan
**PR:** `c/gatekeeper-participant`

### Integracija (svi)
- [ ] `npm run migrate:mock -- examples/todomvc` prolazi do kraja
- [ ] isto sa pravim modelom (`--budget 1`)

### Kapija G2 (proverava A) — moj deo
- [ ] bar 1 ekran TodoMVC-a „dokazan“ kroz Gatekeeper
- [ ] ručno pokvaren nacrt dobija `gate.failed` sa razumljivom porukom, builder ga popravi u sledećoj rundi
- [ ] u `run.jsonl` nema uspešnih upisa buildera van `staging/`

> **Ovde prvi put vidiš Mozaik:** u terminalu tokom `migrate` — builder piše, Gatekeeper odbija ili promoviše; posle u `run.jsonl` i u `output/<run>/app/`.

---

## F3 — Recepti i dokaz

### C3.1 Regresija i rollback nad pravim prolazom
- [ ] provereno nad prolazom sa više jedinica: kad nova promocija pokvari stari ekran, izmena se vraća i builder dobija listu pokvarenih testova

### C3.2 Statusi u `results/`
- [ ] svaka jedinica dobija `proven / partial / unproven / failed` u `results/<unitId>.json`
- [ ] ekran bez testova posle drugog timeouta ulazi u aplikaciju kao `unproven`
- [ ] povezano sa B-ovim `computeCoverage()` i D-ovim izveštajem

### C3.3 Testovi toka — **samo ako je sve ostalo zeleno**
- [ ] Gatekeeper pušta `Flow` kad su sve njegove jedinice promovisane

### C3.4 Kapija `androidExport` — opciono, poslednje
- [ ] `expo export --platform android` kao kapija 6

### Kapija G3 (proverava B) — moj deo
- [ ] pravi prolaz nad Receptima: bar 3 od 5 ekrana dokazano, ostali imaju tačan razlog
- [ ] `verify` (B) koristi moj `serveApp` / statički build i prolazi bez API ključa

> **Ovde vidiš sve zajedno:** `report.html` (D) sa statusima koje računa tvoj `computeStatus`.

---

## F4 — Stabilizacija

- [ ] popravljam samo greške iz crvenog tima (D) i iz izveštaja, **bez novih funkcija**
- [ ] ako ostane vremena: testovi toka → (A) prilagođavanje broja agenata → (A) eskalacija
- [ ] ako < 4/5 ekrana dokazano → rezervni plan *Wemora Lab*: Gatekeeper i `verify` moraju da rade nad **bilo kojom** mobilnom verzijom (i ručno napisanom)

---

## Kad sam blokirana

| Situacija | Šta radim |
|---|---|
| Spike A ne radi | Odmah poruka timu → `testID` ugovor, zapis u `docs/decisions.md` |
| Nema A-ovog runtime-a / guarda | Mock u svom folderu, radim prompt i alate, zapis u status |
| Nema B-ovog `runScenarios` | Mock koji vraća unapred zadate rezultate |
| Treba mi nova zavisnost (Babel, Playwright…) | Mali PR samo sa `package.json` + lock, poruka timu |
| Ugovor ne odgovara | Stani, napiši u chat šta treba promeniti; A pravi `contracts/<opis>` |
| Faza kasni > 1 h | Izbacujem redom: `androidExport` → testovi toka → regresija |

**Nikad se ne izbacuje:** Gatekeeper sa pravilom „nula testova nikad nije `proven`“.
