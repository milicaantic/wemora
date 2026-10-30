# Wemora — odluke

Ovde se beleži svaka odluka koja menja ili dopunjuje `docs/architecture.md` ili `src/contracts/`, kao i rezultati spike-ova. Pre predloga promene arhitekture ili ugovora pročitaj ovaj fajl.

Novi zapis ide na kraj, sa sledećim brojem. Odluka važi tek kad je status „prihvaćeno“.

## Šablon

```markdown
## D-000: Kratak naslov
- Datum: GGGG-MM-DD
- Ko: A/B/C/D
- Status: predlog | prihvaćeno | odbijeno | zamenjeno sa D-xxx
- Odluka: šta tačno važi od sada.
- Zašto: razlog u 1–3 rečenice.
- Posledice: koji fajlovi ili delovi se menjaju.
```

---

## D-001: `zod` 4 i `vitest` 5 kao osnovne zavisnosti
- Datum: 2026-10-30
- Ko: A
- Status: predlog (čeka potvrdu tima)
- Odluka: `zod@4.6.7` za sve šeme u `src/contracts/`, `vitest@5.0.5` za testove.
- Zašto: zod 4 ima `z.toJSONSchema()`, potreban za Mozaik `structuredOutput`; bez njega treba još jedna biblioteka. Vitest navode `CLAUDE.md` i `tim-plan.md`.
- Posledice: Vitest 5 traži Node ≥ 22.12, a `.nvmrc` sada kaže samo `22`.

## D-002: `zod` je jedini spoljni uvoz u `src/contracts/`
- Datum: 2026-10-30
- Ko: A
- Status: predlog (čeka potvrdu tima; `docs/tasks/a.md`, P1)
- Odluka: `src/contracts/` uvozi samo `zod` i sopstvene fajlove.
- Zašto: `architecture.md` §2 kaže da `contracts/` ne uvozi ništa, a tim-plan F0 traži zod šeme u `contracts/`.
- Posledice: `scripts/check-layers.sh` propušta `zod` u `contracts/`.

## D-003: Oblik table se u ugovorima zove `MigrationStateFields`
- Datum: 2026-10-30
- Ko: A
- Status: predlog (čeka potvrdu tima; `docs/tasks/a.md`, P2)
- Odluka: `src/contracts/state.ts` izvozi `MigrationStateFields`, a `src/core/state.ts` izvozi `class MigrationState extends RuntimeState implements MigrationStateFields`.
- Zašto: `contracts/` ne sme da uvozi Mozaik `RuntimeState`, pa oblik i klasa ne mogu da imaju isto ime.
- Posledice: `architecture.md` §6 i dalje kaže `MigrationState`, što je ime klase u `core/`.

## D-004: Provera slojeva je `scripts/check-layers.ts`, ne `.sh`
- Datum: 2026-10-30
- Ko: A
- Status: prihvaćeno (A; niko u timu nema Git Bash)
- Odluka: provera slojeva je TypeScript skripta koju `npm run build` pokreće preko `tsx`. Domen ne sme da zavisi od `@mozaik-ai/core` ni posredno, preko drugih fajlova.
- Zašto: na Windowsu `npm run build` ide kroz `cmd.exe`, a bez Git Bash-a `bash` ne postoji ili je WSL. Uvoze čita TypeScript (`ts.preProcessFile`), koji je već instaliran, pa nema nove zavisnosti. Posredna provera rešava `docs/tasks/a.md` P3 bez spiska dozvoljenih `core/` fajlova.
- Posledice: `architecture.md` §2, `CLAUDE.md` i `tim-plan.md` još pominju `scripts/check-layers.sh`, pa ih treba uskladiti (A).

## D-005: Spike A — Playwright selektori rade na Expo webu, uz obavezan `role`
- Datum: 2026-10-30
- Ko: C
- Status: predlog (čeka B, jer menja ugovor za buildera)
- Odluka: ostajemo na selektorima po labeli, ulozi i tekstu, **bez** `testID` ugovora. Builder **mora** da stavi `role="button"` na svaki `Pressable` koji je na webu dugme i `role="list"` / `role="listitem"` na liste. Polja dobijaju `accessibilityLabel` sa istom labelom kao na webu.
- Zašto: ručni RN ekran (Expo SDK 58, `react-native-web` 0.21, statički web export, viewport 390×844), provereno skriptom `templates/spike-a/check.ts`:

  | Selektor | RN zapis | Rezultat |
  |---|---|---|
  | `getByLabel("Pretraga")` + `fill` | `TextInput accessibilityLabel="Pretraga"` | radi, `fill` menja stanje |
  | `getByRole("button", { name })` + `click` | `Pressable` + `Text`, **bez uloge** | **ne radi** (renderuje se kao `<div tabindex="0">`) |
  | `getByRole("button", { name })` + `click` | `Pressable role="button"` | radi, okida `onPress` |
  | `getByRole("button", { name })` + `click` | `Pressable accessibilityRole="button"` | radi, okida `onPress` |
  | `getByText("Traži")` + `click` | `Pressable` + `Text`, bez uloge | radi, okida `onPress` |
  | `getByText(...)` | stavka u `FlatList` | radi |
  | `getByRole("listitem")` | `FlatList`, bez uloga | **ne radi** (nema `list`/`listitem` u ARIA stablu) |
  | `getByRole("list")` / `getByRole("listitem")` | `View role="list"` / `View role="listitem"` | radi |

- Posledice:
  - `src/agents/prompts/web-to-rn.md` i `builder.md` (C2.1): `button` → `Pressable role="button"` + `Text`; `ul/li` → `role="list"` / `role="listitem"`; `input` → `TextInput accessibilityLabel`.
  - Kapija 4 `labels` (C1.4) može da proverava i da `Pressable` sa tekstom dugmeta iz testova ima `role="button"`.
  - Expo Router `Stack` prikazuje naziv rute kao naslov (u ARIA stablu: `heading "index"`). Scaffold (C1.3) treba da postavi pravi naslov ili sakrije zaglavlje, da tekst rute ne smeta `getByText`.

### Usputni nalazi
- **Greška pri renderovanju jednog ekrana** (dev server, Metro): ostali ekrani rade, Metro ostaje živ; pokvaren ekran je prazan, greška je u konzoli browsera i u Metro logu (`WARN An error occurred in the <BrokenRender> component`).
- **Sintaksna greška u jednom ekranu ruši celu aplikaciju** na dev serveru: Metro ostaje živ, ali bundle vraća 500, pa ni ispravni ekrani ne rade. Gatekeeper zato mora da pusti kapiju 1 (`parse`) **pre** nego što nacrt dođe u aplikaciju koju Metro služi.
- Sa `CI=1` Metro **ne prati izmene fajlova**: novi fajl se ne vidi bez ponovnog pokretanja. Bitno za C1.2/C1.5 ako se koristi dev server.
- **`expo export --platform android` radi bez uređaja i emulatora** (~16 s sa toplim kešom, ~88 s prvi put). Kapija 6 je izvodljiva.
- Web export šablona + ovog ekrana: ~71 s prvi put (hladan keš).
