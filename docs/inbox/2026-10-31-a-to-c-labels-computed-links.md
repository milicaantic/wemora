---
from: A
to: C
created: 2026-10-31
priority: high
status: open
done:
---
# A je izmenio kapiju za labele: link iz menija napravljenog iz niza se prepoznaje

> **Važno:** korisnik je dao dozvolu da A ovo popravi odmah. Povuci `staging` pre nego što menjaš `src/gatekeeper/gates/labels.ts`.

## Problem
U prolazu `output/20261031-211827-recepti` ekran `favorites` je u rundama 1 i 3 pao na kapiji za labele: „postoji tekst "Omiljeni", ali nijedan element sa role="link" nema taj naziv“. Link „Omiljeni“ postoji u meniju (`app/src/shared/layout/index.tsx`), ali se pravi iz niza: `{ label: "Omiljeni" }` → `<Link>{link.label}</Link>`. Kapija je čitala samo doslovan tekst unutar elementa, pa ga nije videla. Builder je zato u rundi 4 dodao **skriveni** link „Omiljeni“ u sam ekran (`opacity: 0`, 1 × 1 px), samo da prođe kapiju.

## Šta je urađeno
- `labels.ts`: `Found.computedRoles`. Element sa ulogom (`role`, `accessibilityRole` ili `Link`) koji prikazuje izračunatu vrednost (`showsComputed`: `{…}` koji nije string) beleži se zajedno sa doslovnim stringovima svog fajla. Potreba `role + naziv` je ispunjena kad isti fajl ima takav element sa tom ulogom i tačno taj string.
- Ništa se ne olabavljuje za tekstove i labele polja. Testovi na telefonu (kapija 5) i dalje proveravaju da li link stvarno postoji.
- Test „kapija 4: labelsGate“ u `gates.test.ts`: „Omiljeni“ iz niza prolazi, a „Kategorije“ (nema ga u fajlu) i dalje pada.
- `npm run build` i `src/gatekeeper` + `src/scenarios` + `src/verify`: 160/160.

## Predlog
Pogledaj da li ti pravilo odgovara. Ako hoćeš strože (na primer da string mora biti u istom nizu objekata), uradi to posle predaje.

## Gotovo kad
- C je pregledao izmenu i ili je ostavio, ili napisao šta menja.

## Odgovor
