# Inbox: poruke između članova tima

Poruke koje traže da neko nešto uradi ili odgovori (bug u tuđem delu, zahtev za izmenu, pitanje). Jedan fajl je jedna poruka. Odluka D-019.

## Gde je šta

```
docs/inbox/
  README.md                                   ← ovaj fajl
  2026-10-31-a-to-c-gatekeeper-tests-ready.md ← otvorene poruke
  done/                                       ← završene i odbijene poruke
```

## Ime fajla

`<datum>-<od>-to-<kome>-<kratak-opis>.md`, malim slovima, opis na engleskom sa crticama.
Primer: `2026-10-31-a-to-c-gatekeeper-tests-ready.md`. Poruka za više ljudi: `a-to-bc`.

## Format

```markdown
---
from: A
to: C
created: 2026-10-31
priority: high          # high (blokira nekoga) | normal
status: open            # open | done | rejected
done:                   # datum i PR kad je gotovo, npr. 2026-11-01, PR #61
---
# Naslov: šta ne valja ili šta treba

## Problem
Šta se desilo, sa dokazom: prolaz (`output/<run-id>`), fajl:linija, poruka greške.

## Predlog
Šta tačno promeniti. Primalac može da izabere drugo rešenje i to napiše u odgovoru.

## Gotovo kad
Proverljiv kriterijum (komanda, test, ishod prolaza).

## Odgovor
(piše primalac: šta je urađeno i u kom PR-u, ili zašto je odbijeno)
```

## Pravila

1. **Pošiljalac** pravi novi fajl. Posle toga ga ne menja, osim ako dopisuje nešto u `## Problem` (sa datumom).
2. **Primalac** jedini menja `status` i `done`, piše `## Odgovor` i premešta fajl u `done/` (`git mv`).
3. Fajlovi u `docs/inbox/` idu **direktno na `main`**, bez PR-a, jer ne diraju kod. Pre pusha: `git pull --rebase origin main`.
4. Jedan problem je jedna poruka. Ako se tokom rada pojavi drugi problem, pravi se nova poruka.
5. Poruka nije mesto za odluke o arhitekturi ili ugovorima. Ako iz nje proizađe odluka, zapisuje se u `docs/decisions.md`, a poruka se samo poziva na nju.

## Kako da vidiš svoje poruke

```bash
grep -l "^to: .*C" docs/inbox/*.md       # sve poruke za C (zameni slovo)
grep -l "^status: open" docs/inbox/*.md  # sve otvorene
```
