# Status: osoba D
Faza: F0
Poslednja izmena: 2026-10-30

## Gotovo (spojeno u main)
- ništa još

## Gotovo, čeka spajanje
- D0: review ugovora za moj deo (`ParsedApp`, `AnalysisPart`, `AnalyzerReport`, `Obligation`, `Unit`, `Flow`, `Plan`, `ParseApp`, `SplitParts`, `ValidatePlan`, `BuildReport`). Tipovi odgovaraju mom planu; promena ugovora ne treba. Nalazi su ispod.

- D1: `examples/todomvc`, React primer iz `tastejs/todomvc` (commit `ff43b02`, MIT), bez izmena koda. `npm ci && npm run build && npm run serve` radi na portu 7002. Poreklo, pokretanje i lista interaktivnih elemenata su u `examples/todomvc/SOURCE.md`.
- D2: ovaj fajl

## U radu
- ništa

## Sledeće
- D3: `examples/mock-api`, D4: `examples/recepti` (posle G0)

## Mockovi koje koristim
- nijedan

## Čeka odluku tima
- **TodoMVC i DSL (B, A): nema koraka za taster Enter.** U TodoMVC-u se zadatak dodaje samo tasterom Enter u polju `New Todo Input`; dugme ne postoji. DSL ima `fill`, ali ne i pritisak tastera, pa nijedan test ne može da doda zadatak, a bez zadataka se ne vidi ništa drugo (lista, filteri, brojač). To ugrožava stavku G2 „bar 1 ekran dokazan na TodoMVC-u“. Mogućnosti: (a) nov DSL korak, npr. `{ submit: { label } }` (Enter u polju; na RN `onSubmitEditing`), što je promena ugovora; (b) B-ov kompajler posle svakog `fill` pritisne Enter, što menja značenje `fill` i može da pošalje formu tamo gde ne treba. Predlažem (a). Ostale prepreke iz TodoMVC-a: checkbox zadatka nema ime, „Delete todo“ se vidi samo na hover i nije jedinstveno, izmena je na dvoklik. To arhitekta beleži kao `notPortable`/`hiddenBehind`.
- **Structured output i Anthropic (A, `runStructured` u A8).** Mozaik šalje šemu Anthropicu bez izmena (`output_config.format`). `z.toJSONSchema(PlanSchema)` sadrži ključeve koje Anthropic ne podržava: `minLength` (20×), `minimum`/`maximum` (iz `.int()`), `oneOf` (namerne razlike), `minItems: 2` (`Flow.unitIds`) i `additionalProperties: {type: string}` + `propertyNames` (`routeMap`). Šema analizatora ima `minLength` (3×). Predlog: `runStructured` pre slanja čisti JSON Schemu (briše `minLength`, `maxLength`, `minimum`, `maximum`, `propertyNames`, `$schema`, `minItems > 1`; `oneOf` → `anyOf`), a zod proverava odgovor posle, kao i do sada. Ugovori se ne menjaju.
- **`routeMap` od modela (moje, D13/D14).** Arhitekta ne vraća `routeMap`: šema za model je `PlanSchema.omit({ routeMap: true })`, a `routeMap` računa kod (`expoRouteFor`). Tako nema `additionalProperties` koji nije `false`.
- **`writes` (C).** Test ugovora koristi `src/screens/<id>/`, dakle putanje relativne u odnosu na `app/`. Tako radim `validatePlan` i `normalizePlan`, osim ako C kaže drugačije.
- **`Unit.id` kao ime foldera.** `UnitSchema` traži samo `min(1)`. `validatePlan` proverava `^[a-z0-9][a-z0-9-]*$`, pa ugovor ne mora da se menja.
- **Neuspeo plan (A, PD2).** Nema događaja za „arhitekta nije uspela posle 3 pokušaja“. Predlog: `plan.failed {}` ili timeout u Conductoru uz `plan.errors.json`.
- Odgovori na P4 (`splitParts`) i P5 (Conductor čeka sve `analysis.done`) iz `docs/tasks/a.md`: slažem se sa predlozima.

## Blokira me
- ništa
