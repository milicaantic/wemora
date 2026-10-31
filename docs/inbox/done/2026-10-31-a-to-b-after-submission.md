---
from: A
to: B
created: 2026-10-31
priority: normal
status: done
done: 2026-10-31, grana b/after-submission
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
B, 2026-10-31: sve tri tačke su urađene na grani `b/after-submission`. Grana nije spojena: kod je zaključan do ponoći, a predati prolaz se ne menja.

**1. Ekran sa parametrom u ruti.**
- Tester za rutu kao `/recepti/:id` otvara pravu putanju: prvo iz sačuvanog testa tog ekrana, a ako ga nema, uzima prvi link na tu rutu sa ekrana bez parametara, počev od `/`.
- Novo u `scenarios/interactive.ts`: `findOpenPath` i `linkTargets`. Sa te strane se izvlače elementi i linkovi, a brief kaže „open it at /recepti/1“.
- Ručno na pravim Receptima: nađe `/recepti/1`, a elementi su „Nazad na recepte“, **„Dodaj u omiljene“**, „Smanji porcije“, „Povećaj porcije“ i „Dodaj sastojke u listu za kupovinu“ (ranije 0/0).

**2. Brzina `try_scenario` (`scenarios/validate.ts`, `run.ts`).**
- Prazan ekran i probe pravila 3 idu kroz brži runner (`PROBE_RUNNER_SETTINGS`: korak 2 s, kraće skrolovanje). Pravilo 1 (dva prolaza na originalu) ostaje na normalnom runneru, da spor ali dobar scenario nikad ne bude odbijen.
- Probe se puštaju u rundama: čim jedna varijanta akcije padne, ostale se ne puštaju.
- Redosled je original, pa prazan ekran, pa probe, pa se scenario koji prolazi na praznom ekranu odbija pre ijedne probe.
- Ako browser za probu ne može da se pokrene, scenario se ne prihvata.
- Ručno na pravim Receptima: `search-by-name` 16,0 → 7,7 s, `shopping-list-add-item` 19,5 → 8,5 s, test omiljenih na detalju 18,4 → 7,5 s. Svi su i dalje validni.

**3. Klik na link iz menija.**
- `scenarioProblem` u testu ekrana odbija klik na link koji vodi na drugu rutu: u `setup`-u uvek, a u `steps` osim kao poslednju akciju. Napustiti ekran i proveriti da ga više nema ostaje dozvoljeno.
- Poruka modelu upućuje na test toka. Testovi toka su izuzeti.
- Linkovi i njihove putanje se čitaju sa ekrana originala. Na `/omiljeni`: Recepti → `/`, Kategorije → `/kategorije` i ostali.
- Testovi u `scenarios/tester.test.ts` i `agents/tester.test.ts`.

Provera: `npm run build` prolazi, `npm test` 594/594. Pokrivenost `recipe-detail` i prosečan `try_scenario` vide se u sledećem pravom prolazu.
