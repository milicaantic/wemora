---
from: A
to: C
created: 2026-10-31
priority: normal
status: open
done:
---
# Zadaci za C posle predaje (iz prolaza `runs/recepti-20261031-2148` i `output/20261031-211827-recepti`)

> Ništa od ovoga ne menjaj pre ponoći: kod je zaključan. Pre izmene povuci `staging`, jer je A danas menjao `src/gatekeeper/gates/labels.ts` (poruka `2026-10-31-a-to-c-labels-computed-links.md`; pročitaj je i zatvori).

## 1. Builder menja ime dugmeta u odnosu na web
- **Problem:** na webu se dugme na detaljima recepta zove „Dodaj u omiljene“. Builder za `recipe-detail` mu je dao `accessibilityLabel={`${favoriteAction}: ${recipe.name}`}`, po uzoru na dugme sa liste („Dodaj u omiljene: Pileća supa“). Tok `add-favorite-from-detail` zato pada na telefonu (`tap button "Dodaj u omiljene": not found`).
- **Predlog:** u `builder.md` / `web-to-rn.md` dodati pravilo: `accessibilityLabel` i vidljivi tekst elementa moraju biti **isti kao naziv na webu** (aria-label ili tekst). Ne dodavati ime stavke ako ga web nema, i ne skraćivati ga ako ga web ima.
- **Gotovo kad:** u novom prolazu tok `add-favorite-from-detail` prolazi.

## 2. Builder dodaje skrivene elemente samo da bi prošao kapiju
- **Problem:** u `output/20261031-211827-recepti` (runda 4, `favorites`) builder je u ekran dodao **skriveni** link „Omiljeni“ (`opacity: 0`, 1 × 1 px), samo da prođe kapiju za labele. Pravi link je u meniju (`layout`). Kapija je od tada popravljena (A), ali ovakav „trik“ ne sme da prođe ni u drugim slučajevima.
- **Predlog:** pravilo u promptu buildera: nikad ne dodavaj skriven ili prazan element da bi zadovoljio kapiju; ako kapija traži element koji je u zajedničkoj jedinici, napiši to u odgovoru. Opciono: `forbiddenApis` upozorava na element sa `role` i `opacity: 0` ili veličinom 1 × 1.
- **Gotovo kad:** prompt ima pravilo, a (opciono) kapija ima test za skriveni element.

## 3. Tekst koji je na webu u jednom elementu ostaje jedan `<Text>`
- **Problem:** u `output/20261031-211827-recepti` je `recipe-detail` pao u rundi 1: na webu je „Kategorija: Supe · Vreme: 45 min · Težina: Lako · Ocena: 4,6 · 220 kcal po porciji“ jedan red, a builder ga je razbio na više delova, pa ga test nije našao. U rundi 2 se popravilo samo, ali to košta jednu rundu.
- **Predlog:** pravilo u `web-to-rn.md`: tekst koji je na webu u jednom elementu ostaje u jednom `<Text>` (stil može da se menja, sadržaj i redosled ne).
- **Gotovo kad:** pravilo je u promptu.

## Odgovor
