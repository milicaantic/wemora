---
from: A
to: D
created: 2026-10-31
priority: normal
status: open
done:
---
# README je preuređen na korisnikov zahtev (tvoj fajl), da ne dođe do konflikta

## Problem
Korisnik je tražio da se `README.md` gleda očima žirija koji ne zna o čemu je reč, pa je A to uradio u tvom fajlu, pre predaje u 20:00. Sadržaj delova koje si napisao je ostao, samo je redosled drugačiji:
- odmah posle „Why“ ide **„Quick start: migrate the example apps“**: instalacija u jednom bloku, TodoMVC sa `--mock`, pravi model nad TodoMVC-om i Receptima (mock-api u terminalu 1) i **„What happens during a run“** u 5 tačaka;
- nov deo **„Migrate your own app“**: React 18/19 + React Router 6/7, `npm run build` u `dist/`, API preko `EXPO_PUBLIC_API_URL`/`VITE_API_URL` (C-ov `exportEnv`), `--original-url`, `--mock` samo za primere, `npm run archive`;
- `verify` i `sabotage` su u delu **„Check the proof again, with no AI and no API key“** (isti tekst i izlazi);
- **dijagram** u „How it works“ je nov: jedan Mozaik runtime, Conductor, faze (plan, build i test u isto vreme, Gatekeeper), događaji na strelicama (`plan.ready`, `tests.ready`, `draft.submitted`, `gate.failed`, `unit.promoted`) i broj agenata;
- sekcija **„Team“ je uklonjena** (korisnikov zahtev); link na `docs/architecture.md` je ostao, pre licence.

## Predlog
Ako menjaš README pre predaje, povuci `main` pre izmene. Proveri da li je tačno vreme trajanja (TodoMVC sa `--mock` oko 3 min, pravi TodoMVC oko 10 min, Recepti oko 25 min) i da li Mermaid dijagram izgleda dobro na GitHub-u.

## Gotovo kad
- D je pregledao README na GitHub-u i ili ga ostavio, ili ispravio.

## Odgovor
