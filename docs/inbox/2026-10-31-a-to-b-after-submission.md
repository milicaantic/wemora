---
from: A
to: B
created: 2026-10-31
priority: normal
status: open
done:
---
# Zadaci za B posle predaje (iz prolaza `runs/recepti-20261031-2148`)

> Ništa od ovoga ne menjaj pre ponoći: kod je zaključan, a predati prolaz je napravljen sa sadašnjim kodom. Pre izmene povuci `staging`, jer je A danas menjao `run.ts`, `interactive.ts`, `tester.ts`, `tester.md` i `flowBrief` (poruke `2026-10-31-a-to-b-flow-tester.md` i `2026-10-31-a-to-b-runner-wait-after-tap.md`; pročitaj ih i zatvori).

## 1. Ekran sa parametrom u ruti nema pokrivenost elemenata (najvažnije)
- **Problem:** `recipe-detail` (`/recepti/:id`) je `proven` sa „0/0 elemenata“. `openablePath` vraća `null` za rutu sa `:id`, pa tester ne pokreće `extractInteractive` i ekran nema spisak elemenata. Zato nijedan test ekrana nije kliknuo dugme „Dodaj u omiljene“. Grešku buildera (drugo ime dugmeta na mobilnom) uhvatio je tek tok `add-favorite-from-detail`, koji pada.
- **Predlog:** za rutu sa parametrima otvori ekran sa pravom vrednošću, npr. prvi link na tu rutu sa ekrana liste (`/recepti/1`) ili vrednost iz prvog sačuvanog testa koji radi `goto` na nju, pa izvuci elemente sa te strane.
- **Gotovo kad:** `recipe-detail` u novom prolazu ima pokrivenost elemenata veću od 0/0, a dugme za omiljene je u nekom testu ekrana.

## 2. `try_scenario` troši 92 % vremena testera
- **Problem:** 780 od 845 s rada alata testera je `try_scenario` (prosečno 20 s, najviše 51 s). Probni scenariji (pravilo 3) i prazan ekran (pravilo 2) **moraju da padnu**, a svaki pad čeka ceo `stepTimeoutMs` (5 s), plus grace i do 20 skrolovanja.
- **Predlog, od najbezbednijeg:**
  1. U `validate.ts` prekini probe jedne akcije čim jedna varijanta padne: akcija je tada dokazana, pa ostale varijante ne treba pokretati.
  2. Kraći timeout za korake koji treba da padnu (probni scenariji i prazan ekran), npr. 2 s, bez skrolovanja. Posle A-ove izmene runner čeka da se mreža smiri posle svake akcije, pa je kraći timeout bezbedniji nego ranije.
  3. Paralelne probe u više browser konteksta, ali tek ako mock-api ne deli stanje između njih.
- **Gotovo kad:** prosečan `try_scenario` je ispod 10 s, a `validate.test.ts` prolazi.

## 3. Test ekrana ne sme klikom na meni da ode na drugi ekran
- **Problem:** `scenarioProblem` odbija `goto` na drugi ekran, ali ne i `tap` na link iz menija koji vodi tamo. U prolazu `20261031-211827` testovi `favorites-*` su u `setup`-u kliknuli „Recepti“, dodali omiljeni recept na listi i vratili se na „Omiljeni“. Takav test prolazi samo ako je `recipe-list` već u aplikaciji, pa ekrani mogu da blokiraju jedan drugog.
- **Predlog:** u testu ekrana odbiti `tap` na `link` čiji je naziv neki od linkova menija (iz `layout`) ili čiji je cilj druga ruta. U poruci modelu uputiti na test toka.
- **Gotovo kad:** novi test u `scenarios/tester.test.ts` pokazuje da je takav scenario odbijen sa jasnim razlogom.

## Odgovor
