# TodoMVC React: poreklo

Ovo je druga ulazna aplikacija za Wemoru: aplikacija koju **nismo mi napisali**, da migracija ne bi bila podešena za naš primer.

| | |
|---|---|
| Izvor | https://github.com/tastejs/todomvc, folder `examples/react` |
| Commit | `ff43b02e59dfa604386bb382034b2cd07c2bcd8a` (2026-05-02) |
| Preuzeto | 2026-10-30 |
| Licenca | MIT, `LICENSE.md` (kopija `license.md` iz korena repoa TodoMVC) |

## Izmene u odnosu na original

**Nema izmena koda.** `src/`, `public/`, `package.json`, `package-lock.json`, `webpack.*.js`, `.eslintrc`, `.gitignore` i `readme.md` su kopirani bajt za bajt. Nije kopiran `dist/` (gotov build iz originala); pravi se lokalno sa `npm run build`, a root `.gitignore` ga ne pušta u git.

## Pokretanje

```bash
cd examples/todomvc
npm ci
npm run build      # webpack → dist/
npm run serve      # http-server nad dist/ na http://localhost:7002
```

`npm run dev` pokreće webpack dev server (podrazumevano port 8080) i sam otvara browser. Za automatske provere koristi `build` + `serve`, jer je port fiksan.

Napomena: `readme.md` iz originala kaže „React 17.0.2“, ali `package.json` koristi React 19.

## Šta je u aplikaciji (za parser i testere)

- **Stek:** React 19, `react-router-dom` 7, JavaScript (`.js`/`.jsx`), webpack 5, CSS iz paketa `todomvc-app-css` i `todomvc-common` + `src/todo/app.css`. Ukupno 298 linija JS/JSX.
- **Rute:** `HashRouter` sa **jednom rutom `path="*"`** → `App` (`src/todo/app.jsx`). Ulaz je `src/index.js`.
- **Filteri nisu posebne rute:** linkovi `#/`, `#/active`, `#/completed` menjaju `useLocation().pathname`, a `Main` i `Footer` filtriraju listu. Za Wemoru je to jedan ekran.
- **Stanje:** `useReducer` u `App`. **Nema `localStorage`, `fetch` ni API-ja**, pa se zadaci gube posle osvežavanja stranice.
- **Očekivani rezultat `parseApp`:** jedna ruta `*` sa fajlom `src/todo/app.jsx` i fajlovima `app.css`, `reducer.js`, `constants.js` i `components/*.jsx`; `src/index.js` je zajednički (ulaz). Uvozi iz paketa (`todomvc-app-css/index.css`) se ne računaju.

### Interaktivni elementi i pristupačna imena

| Element | Pristupačno ime | Napomena za testove |
|---|---|---|
| Polje za novi zadatak | `New Todo Input` (`aria-label`), placeholder „What needs to be done?“ | **Zadatak se dodaje samo tasterom Enter; nema dugmeta.** |
| Checkbox „označi sve“ | `Toggle All Input` (`<label for>`) | vidljiv tek kad postoji bar jedan zadatak |
| Checkbox po zadatku | **nema imena** (samo `data-testid="todo-item-toggle"`) | ne može se tapnuti po imenu |
| Dugme za brisanje po zadatku | `Delete todo` (isto za svaki zadatak) | vidi se samo na **hover** (CSS), ime nije jedinstveno |
| Izmena zadatka | dvoklik na tekst → polje `Edit todo` | **dvoklik**, nema ga u DSL-u |
| Filteri | linkovi `All`, `Active`, `Completed` | menjaju hash adresu |
| Brisanje završenih | dugme `Clear completed` | vidljivo tek kad postoji završen zadatak |
| Brojač | tekst „N items left!“ / „1 item left!“ | |

**Otvoreno pitanje za tim:** DSL (`src/contracts/scenario.ts`) nema korak za pritisak tastera, pa test ne može da doda zadatak. Bez toga TodoMVC ne može da ima nijedan smislen test. Detalji su u `docs/status/d.md`.
