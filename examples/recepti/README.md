# Recepti

Glavna ulazna aplikacija za Wemoru: React SPA sa 5 ekrana, **namerno napravljena samo za desktop** (bočni meni, široka tabela, dve kolone jedna pored druge, hover, fiksne širine). Tako se vidi prava transformacija desktop ekrana u mobilni, a ne smanjivanje stranice.

Stek je u okviru ulaznog profila (`docs/architecture.md` §1): React 18, React Router 6 (ugnežđene deklarativne rute), Vite, TypeScript, obični CSS, hooks, `fetch` i `localStorage`.

## Pokretanje

Prvo mock-api (podaci), u posebnom terminalu:

```bash
cd examples/mock-api
npm start                 # http://localhost:3000
```

Zatim aplikacija:

```bash
cd examples/recepti
npm ci
npm run dev               # http://localhost:5173
```

Za proveru kao u testovima: `npm run build && npm run preview` (isti port 5173, `strictPort`). Adresa API-ja dolazi iz `VITE_API_URL`, a podrazumevano je `http://localhost:3000`. Pošto Vite tu vrednost ugrađuje u build, posle promene adrese pokreni `npm run build` ponovo.

## Ekrani

| Ruta | Ekran | Desktop-only osobina | Interaktivni elementi (tačna pristupačna imena) |
|---|---|---|---|
| `/` | Svi recepti | tabela sa 8 kolona; **hover** na redu prikazuje `tooltip` sa sastojcima | polje `Pretraga` (po nazivu, bez obzira na velika slova); grupa `Kategorija` sa dugmadima `Sve kategorije`, `Supe`, `Glavna jela`, `Salate`, `Deserti`; dugme `Sortiraj po vremenu`; link sa nazivom recepta; dugme `Dodaj u omiljene: <naziv>` / `Ukloni iz omiljenih: <naziv>`. Prazno: „Nema recepata za zadatu pretragu“ |
| `/recepti/:id` | Detalj recepta | sastojci i priprema u **dve kolone** | link `Nazad na recepte`; dugme `Dodaj u omiljene` / `Ukloni iz omiljenih`; `Smanji porcije` (min 1) i `Povećaj porcije`, tekst „Porcije: N“, količine se skaliraju (npr. „Mleveno meso: 1125 g“); `Dodaj sastojke u listu za kupovinu` → „Sastojci su dodati u listu za kupovinu“. Nepostojeći ID: „Recept nije pronađen“ |
| `/kategorije` | Kategorije | **lista i detalj jedan pored drugog** | dugme po kategoriji (`Supe`…); posle izbora desno naslov i linkovi recepata. Pre izbora: „Izaberite kategoriju“ |
| `/omiljeni` | Omiljeni recepti | mreža kartica u 3 kolone | link na recept, dugme `Ukloni iz omiljenih: <naziv>`. Prazno: „Nemate omiljenih recepata“ |
| `/kupovina` | Lista za kupovinu | tabela | polje `Namirnica`, dugme `Dodaj` (radi i Enter), checkbox po stavci sa imenom stavke, tekst „Kupljeno: X od Y“, dugme `Obriši kupljene`. Prazno: „Lista za kupovinu je prazna“ |

Bočni meni ima linkove `Recepti`, `Kategorije`, `Omiljeni` i `Lista za kupovinu`.

## Pravila koja aplikacija poštuje (zbog testova)

- **Svako dugme, polje i link ima pristupačno ime, i nijedno ime se ne ponavlja na istom ekranu.** Zato dugme za omiljene u tabeli ima ime `Dodaj u omiljene: Sarma`, a ne samo zvezdicu.
- **Nema `<select>`.** DSL testova nema korak za izbor iz padajuće liste, pa je filter kategorija grupa dugmadi.
- Svaka radnja ima dugme. Enter u polju `Namirnica` je samo prečica, a ne jedini način (za razliku od TodoMVC-a).
- Brojevi su formatirani fiksno, bez `Intl` (ocena „4,6“, količina „1125“), da web i telefon prikažu isti tekst.
- Omiljeni (`recepti.favorites`) i lista za kupovinu (`recepti.shopping`) su u `localStorage` i preživljavaju osvežavanje. Testovi ih pripremaju kroz UI (`setup` koraci), ne upisom u skladište.
- Dok se podaci učitavaju: „Učitavanje…“. Kad API ne radi: „Greška pri učitavanju podataka“.

## Struktura

```
src/main.tsx, App.tsx          ulaz i rute (Layout je roditeljska ruta, nije ekran)
src/api/                       client.ts (fetch ka mock-api), useAsync.ts
src/store/                     localStore.ts, favorites.ts, shoppingList.ts
src/components/                Layout, Sidebar, FavoriteButton, Status (zajedničko)
src/format.ts                  formatiranje brojeva (zajedničko)
src/pages/<Ekran>.tsx + .css   po jedan fajl i stil za svaki ekran
```
