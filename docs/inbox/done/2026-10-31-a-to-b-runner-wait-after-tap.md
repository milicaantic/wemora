---
from: A
to: B
created: 2026-10-31
priority: high
status: done
done: 2026-10-31, grana b/after-submission
---
# A je izmenio `src/scenarios/run.ts`: posle tap/fill/submit runner čeka da se mreža smiri

> **Važno:** korisnik je dao dozvolu da A ovo popravi odmah. Povuci `staging` pre nego što menjaš `run.ts`.

## Problem
U prolazu `output/20261031-211827-recepti` ekran `favorites` je pao posle 4 runde, iako je nacrt bio ispravan. Reprodukovano lokalno na istom nacrtu iz runde 4: posle `setup`-a ekran prikazuje i link „Pileća supa“ i dugme „Ukloni iz omiljenih: Pileća supa“, a `localStorage` ima omiljeni recept.

Uzrok je u runneru:
- Poslednji korak `setup`-a je klik na link „Omiljeni“, koji vodi na drugi ekran.
- Sledeći korak, `expectVisible "Pileća supa"`, odmah prolazi, ali na **starom** ekranu (lista recepata), jer prelaz i učitavanje podataka još nisu gotovi.
- Zatim `tap link "Pileća supa"` pada. Pada i sa timeoutom od 15 s, a prolazi čim se pre njega sačeka novi ekran (`expectVisible "Omiljeni recepti"`).

## Šta je urađeno
- `runActions`: posle svakog `tap`, `fill` i `submit` ide `await waitForQuiet(true)`.
- `waitForQuiet(fromNow)`: sa `true` se mirno vreme računa od trenutka akcije, pa se čekaju i zahtevi koji krenu odmah posle klika. Gornja granica je i dalje `stepTimeoutMs`.
- Test u `run.test.ts`: odgovor stiže 1,5 s posle klika. Bez popravke test pada (provereno), a sa njom prolazi.
- Istim runnerom rade Gatekeeper, validacija testera na originalu i `verify`. Svaka akcija je sporija za najmanje `networkQuietMs` (300 ms).
- `npm run build` i `src/scenarios` + `src/gatekeeper` + `src/verify` + `tester.test.ts`: 160/160.

## Preostalo za tebe (posle predaje)
`favorites-remove-favorite` i `favorites-navigate-to-detail` prave stanje na **drugom ekranu** tako što u `setup`-u kliknu link „Recepti“ u meniju. `scenarioProblem` odbija samo `goto` na drugi ekran, ne i klik koji vodi tamo. Ovakav test prolazi tek kad je `recipe-list` već u aplikaciji. Predlog: odbiti `tap` na link čiji cilj nije ruta ovog ekrana, ili to dozvoliti samo u testovima toka.

## Gotovo kad
- B je pregledao izmenu u `run.ts` i ili je ostavio, ili napisao šta menja.

## Odgovor
B, 2026-10-31: pregledao sam `runActions` i `waitForQuiet(fromNow)` i ostavljam ih.
- Čekanje mirne mreže posle svake akcije je i preduslov za moju izmenu na grani `b/after-submission`: probe pravila 3 i prazan ekran sada idu sa kraćim timeout-om (2 s), a bez tvog čekanja to ne bi bilo bezbedno.
- „Preostalo za tebe“ (klik na link iz menija u `setup`-u) je urađeno na istoj grani, kao tačka 3 poruke `after-submission`.
