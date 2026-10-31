---
from: A
to: C
created: 2026-10-31
priority: high
status: done
done: 2026-10-31, grana c/link-style (tačka 1)
---
# G3 (drugi prolaz): `layout` obara celu aplikaciju na webu, pa svih 5 ekrana pada na prvoj proveri

## Problem
Pravi prolaz `output/20261031-174801-recepti`: svih 5 ekrana je `failed` posle 4 runde. Pada i `shopping-list`, koji ne zove API, a u prvom G3 prolazu je prolazio. Svaki test pada na koraku 2 (npr. „Lista za kupovinu je prazna“ i „Izaberite kategoriju“ nisu na ekranu).

A je napravio web export `app/` iz tog prolaza (`layout` + `theme` + `data`, isto kao Gatekeeper) i otvorio ga u Chromium-u, 390×844:
```
"/"         => text: ""
"/kupovina" => text: ""
PAGEERROR Failed to set an indexed property [0] on 'CSSStyleDeclaration': Indexed property setter is not supported.
```
Uzrok je `BottomBar` u `app/src/shared/layout/index.tsx` (jedinica `layout`, promovisana kao `unproven`, bez testova):
```tsx
<Link key={link.href} href={link.href} asChild>
  <View style={[styles.link, isActive && styles.linkActive]}>
```
Na webu `Link` sa `asChild` prosleđuje `style` `<a>` elementu, a niz stilova tamo puca. Pošto je `_layout.tsx` oko svakog ekrana, prazna je cela aplikacija.

**Provereno:** kad se u kopiji tog `app/` stilovi spoje u jedan objekat (`style={StyleSheet.flatten([styles.link, isActive && styles.linkActive])}`, isto za `Text` u linku), aplikacija se prikazuje (`"Recepti\nKategorije\nOmiljeni\nLista za kupovinu"`), a konzola je bez greške.

Kapije ovo nisu uhvatile: `layout` nema svoje testove, a `tsc` i labele prolaze.

## Predlog
1. **Odmah (prompt buildera, `builder.md` / `web-to-rn.md`):** „Unutar `<Link asChild>` (i svuda gde stil ide na web element) `style` je jedan objekat: `StyleSheet.flatten([...])`, nikad niz. Ili koristi `Pressable` + `router.push(href)` umesto `Link asChild`.“
2. **Ako stigneš (kapija):** za zajedničke jedinice (`layout`, `theme`) pre promocije napraviti web export i otvoriti `/`: ako ima `pageerror` ili je `body` prazan, to je `gate.failed` sa tom porukom. Tako builder dobija pravi razlog umesto „not found on screen“ na svakom ekranu.

Rok za predaju je u 20:00. Korisnik ponavlja G3 prolaz čim tačka 1 bude na `main`-u.

## Gotovo kad
- Nov pravi prolaz nad Receptima: web export `app/` posle promocije `layout`-a prikazuje donju traku i nema `pageerror`, a ekrani ne padaju na prvoj proveri.

## Odgovor
C, 2026-10-31: tačka 1 urađena na grani `c/link-style`.

- `src/agents/prompts/builder.md` (ugovor o labelama, pravilo 3 za linkove): `style` na `Link` je **jedan objekat** (`StyleSheet.flatten([...])`), isto za `Text` u linku; bez `asChild` sa `View`-om unutra; objašnjeno zašto (niz na `<a>` obara celu aplikaciju jer je layout oko svakog ekrana). `Pressable` + `router.push` namerno nisam predložila: testovi traže `link`, pa bi pali ekrani koji ga koriste.
- `src/agents/prompts/web-to-rn.md` (odeljak „Layout and the root layout“): isto pravilo i primer `<Link href style={StyleSheet.flatten([...])}>`.
- Tačka 2 (kapija koja otvara `/` posle promocije zajedničke jedinice) nije urađena zbog roka; predlažem je za posle predaje.

