# Wemora — plan projekta

**JigJoy × NTP Novi Sad Hackathon, 30–31. oktobar 2026 · kategorija Freestyle · verzija 4**

**Wemora:** migracija web → mobilna aplikacija koja dokazuje da radi.

> **Šta je novo u verziji 4:** projekat se zove Wemora. Arhitektura je jedan paket sa pet slojeva (detalji i vlasništvo u `docs/tim-plan.md`). Mozaik 4.1.0. Novi odeljci: kako UI testovi rade na webu i na Androidu, šta kad web nije prilagođen telefonu, i pravila pokrivenosti i statusa ("bez testova nema zelenog").
>
> **Verzija 3:** broj analizatora, buildera i testera nije fiksan, nego ga računa Conductor. **Verzija 2:** analizatori, arhitekta, builderi i testeri koji rade istovremeno, talasi, povezani ekrani, testovi toka, test sabotaže.

---

## 1. Rešenje ukratko

**Šta pravimo:** CLI alat `wemora`. On uzima React web aplikaciju (SPA sa React Routerom) i pravi Expo (React Native) aplikaciju, ekran po ekran. Za svaki ekran **izvršnim testovima dokazuje** da se mobilna verzija ponaša isto kao original.

**Ključni zaokret:** proizvod nije generisani kod nego dokaz.

- Testovi ponašanja (scenariji) izvode se iz **pokrenutog originala**.
- Scenario važi tek kad prođe na originalu i padne na praznom ekranu.
- Agenti koji pišu mobilni kod nikad ne pišu niti menjaju testove.
- Konačnu ocenu daje običan kod, a ne AI.
- Svaki ekran se završava u jednom od jasnih stanja: dokazan, delimično dokazan, nedokazan ili neuspeo, uz tačan razlog.

**Kako je organizovan posao:**

1. **Analiza:** jedan ili više analizatora (zavisno od veličine projekta) istovremeno čitaju svoj deo aplikacije.
2. **Plan:** arhitekta spaja njihove izveštaje u jedan plan.
3. **Pravljenje i testovi istovremeno:** builderi prave mobilne ekrane, a testeri u isto vreme pišu testove gledajući originalnu web aplikaciju.
4. **Provera:** Gatekeeper (običan kod) pušta testove i u aplikaciju prima samo ekrane koji prolaze.

Koliko analizatora, buildera i testera radi određuje Conductor (običan kod) iz veličine projekta: za mali projekat po jedan, za veliki više. Broj se menja i u toku rada.

**Kome služi:** React timovima, frilenserima i agencijama koji imaju web aplikaciju i klijenta koji traži mobilnu. Danas imaju dva izbora:

- "Wrapper" (Capacitor/PWA), koji nije prava mobilna aplikacija.
- AI generator koji daje uverljiv kod bez dokaza da radi.

**Glavni slučaj upotrebe je web aplikacija koja nije prilagođena telefonu.** Wemora ne smanjuje web stranicu, nego pravi svaki ekran iznova za telefon i dokazuje da se ponaša isto.

**Zašto je pogodno za hakaton:**

- Ekrani su prirodno nezavisne jedinice, pa paralelni agenti donose stvarno ubrzanje, a ne kozmetičko.
- Rezultat je merljiv: matrica ekran × scenario sa prošlo/palo.
- Žiri može sam da pokrene `npm run verify` nad priloženim rezultatom, **bez API ključa**.

**Kategorija:** Freestyle. Bodovanje je korisnost i originalnost 30, upotreba Mozaika (paralelni agenti, deljeno stanje) 30, "radi iz README-a" 25 i README 15. Žiri ocenjuje repo, a demo je opcion, pa je reproduktivnost važnija od šoua.

---

## 2. Kritička analiza

### 2.1 Izvodljivost za dva dana

Opšta verzija, "bilo koja web aplikacija → mobilna", nije izvodljiva. Expo-ovo zvanično uputstvo za migraciju eksplicitno kaže da ne postoji transpiler, nego da se ide ekran po ekran. Jedan programer je opisao da mu je prelazak web → iOS uz AI trajao oko 30 dana. AI je davao prvi nacrt tačan oko 80%, ali je grešio u navigaciji i platformskim stvarima. Izvodljivo je samo uz **uzak ulazni profil**, opisan u odeljku 7.

### 2.2 Šta već postoji i po čemu se razlikujemo

| Rešenje | Šta radi | Šta mu fali |
|---|---|---|
| Capacitor / PWA | Pakuje web u mobilnu ljusku | Nije native i nema migracije |
| RapidNative | Od URL-a ili repoa pravi Expo projekat, uz pregled na telefonu i izvoz za $199 | Nema automatske provere ponašanja |
| Expo skill `web-to-native` (MIT) | Uputstvo za coding agenta: lista ekrana, DOM ljuska, postepena zamena, ručno poređenje originala i native verzije | Uputstvo je, a ne sistem koji meri |
| Claude Code, Cursor | Prepisuju kod na zahtev | Verifikacija zavisi od čoveka |
| **Baro** (JigJoy) | Opšti "software factory" na Mozaiku: ugovor, paralelne priče, kapije, vlasništvo nad fajlovima | Ne zna ništa o ekvivalentnosti dve aplikacije |

Baro je najvažniji nalaz. Žiri (osnivači JigJoy-a) je već napravio opštu fabriku sa paralelnim agentima i kapijama. Generička fabrika za mobilni kod bila bi lošiji Baro. Originalnost mora biti **domenska**: automatski izveden dokaz da se dve aplikacije ponašaju isto.

### 2.3 Šta opravdava više agenata

- **Analizatori (1–4, po veličini projekta):** velika aplikacija ne staje u kontekst jednog agenta. Kad se podeli po modulima, svaki analizator čita samo svoj deo. Mala aplikacija dobija samo jednog analizatora, jer podela tu ne donosi ništa.
- **Arhitekta (uvek 1):** neko mora da vidi celu sliku: šta je zajedničko, kako su ekrani povezani i kojim redom se radi.
- **Builderi (1–6, po broju ekrana):** ekrani su nezavisne jedinice, pa se prave paralelno.
- **Testeri (oko pola broja buildera):** pišu testove iz originala, nezavisno od buildera. Tester ne vidi mobilni kod, a builder ne sme da menja testove, pa builder ne može da "namesti" prolaz.
- **Preklapanje rada:** testeri rade nad originalom dok builderi pišu mobilni kod, pa niko nikog ne čeka.

### 2.4 Najrizičniji delovi

- Da li RN-web izlaz može da se proveri istim Playwright selektorima kao original.
- Da li jedan pokvaren ekran ruši zajednički Metro server.
- Kvalitet porta jeftinim modelom.
- Da li arhitekta dobro spaja izveštaje više analizatora.
- Mozaik: neuhvaćena greška API poziva ruši ceo proces (odeljak 5.7).

### 2.5 Pouzdan demo i bez pune automatike

- Sistem nikad ne tvrdi više nego što je dokazao.
- U repou je priložen pun izlaz jednog prolaza sa izveštajem (`runs/`).
- Postoji i snimak kao rezerva.

### 2.6 Kontrola troškova

Jeftin model po defaultu, a skuplji samo za arhitektu i kao eskalacija. Postoji tvrdi limit budžeta u sopstvenom inference runner-u, svež kontekst za svaki zadatak, i razvoj orkestracije na mock modelu za $0.

### 2.7 Kako dokazati da radi

- Scenariji se validiraju na originalu i moraju da padnu na praznom ekranu.
- Provera pre i posle radnje: provera iz testa mora da padne pre radnje, a da prođe posle.
- Obavezna pokrivenost: obaveze iz plana i svi interaktivni elementi originala (odeljak 4.6).
- Kapije su determinističke: tsc, zabranjeni web API-ji, Android bundle i scenariji.
- **Test sabotaže:** namerno se pokvari jedan već migrirani ekran (npr. obriše se kod pretrage) i pusti `verify`. Mora da padne.
- Provera ne koristi AI, pa je žiri može ponoviti.
- Izveštaj pokazuje i **šta nije pokriveno** i koje su **namerne razlike** u odnosu na original.

---

## 3. Arhitektura

### 3.1 Pet slojeva

```
┌─────────────────────────────────────────────────────────┐
│ 5. CLI            wemora migrate | verify | sabotage    │  cli.ts
├─────────────────────────────────────────────────────────┤
│ 4. Orkestracija   Conductor: red zadataka, talasi,      │  orchestration/
│                   broj agenata, timeout                 │
├─────────────────────────────────────────────────────────┤
│ 3. Agenti         Mozaik učesnici: analizator, arhitekta│  agents/
│                   tester, builder, Gatekeeper-učesnik   │
├─────────────────────────────────────────────────────────┤
│ 2. Domen          obične funkcije, bez Mozaika i AI-ja: │  analysis/ scenarios/
│                   parser, DSL, kapije, scaffold, izveštaj│ gatekeeper/ scaffold/ report/ verify/
├─────────────────────────────────────────────────────────┤
│ 1. Osnova         contracts/ (tipovi) + core/ (runtime, │  contracts/ core/
│                   stanje, runner, log, config)          │
└─────────────────────────────────────────────────────────┘
```

**Pravila:**

1. Sloj sme da uvozi samo iz slojeva ispod sebe.
2. **Domen ne zna za Mozaik.** `parseApp()`, `runScenarios()` i `checkDraft()` su obične funkcije koje primaju fajlove i vraćaju rezultate. Zato `verify` radi bez API ključa. Ovo pravilo proverava skripta u `npm run build`.
3. Agenti su tanki omotači: prompt, alati i reakcije na događaje. Pravi posao rade funkcije iz domena.
4. Samo `core/runtime.ts` poziva `defineRuntime`.
5. Događaji nose ID-jeve, a podaci su na tabli i na disku.

Struktura repoa, vlasništvo foldera i raspored rada su u `docs/tim-plan.md`.

### 3.2 Tok jednog prolaza

![Slika 1. Arhitektura: tri faze, AI agenti (plavo) i obični kod (sivo)](img/fig1_arhitektura.png)

1. **Faza 1: analiza (1–4 analizatora istovremeno).** Deterministički parser (ts-morph/Babel) izvuče listu ruta, fajlova i upotrebu web API-ja i izmeri veličinu koda. Conductor iz toga odredi broj analizatora (odeljak 5.2) i podeli aplikaciju na toliko delova. Svaki analizator čita samo svoj deo i piše izveštaj u **istom obliku** (JSON šema). Primer za jedan ekran:

    > **Ekran: Lista narudžbina** (`/narudzbine`) — tabela narudžbina, filter po statusu i pretraga. Podatke uzima sa `GET /api/orders`. Koristi komponente `Tabela`, `Dugme`, `StatusBedž`. Klik na red vodi na `/narudzbine/[id]`. Problem za mobilni: tabela sa 8 kolona neće stati na telefon.

2. **Faza 2: arhitekta spaja sve u plan.** Arhitekta dobije sve izveštaje i:
    - pronađe šta je **zajedničko** (komponente, skladište podataka, meni), da se pravi jednom i prvo;
    - napravi **mapu adresa** za sve ekrane;
    - odredi **zavisnosti** (npr. "Detalj narudžbine" koristi podatke o kupcu);
    - za svaki ekran napiše **obaveze** (šta mora da se testira) i **namerne razlike** za telefon (odeljak 4.5);
    - podeli posao u **talase** (odeljak 5.4).

    Ulaz koji nije podržan, na primer Next.js, odbija se odmah sa jasnom porukom. Kod proverava plan: svaka ruta iz parsera je u planu i nijedan fajl nema dva vlasnika.

3. **Scaffold.** Deterministički, bez AI-ja. Expo Router projekat iz zamrznutog šablona, sa jednom rutom za svaki web ekran i praznim ekranom u svakoj.

4. **Faza 3: pravljenje i testovi istovremeno.** Conductor odredi broj buildera i testera za trenutni talas i pokreće ih iz reda zadataka.

5. **Provera i promocija.** Builder radi u svom staging folderu. Gatekeeper proverava i "promoviše" ekran u živu aplikaciju, jedan po jedan. Posle svake promocije ponovo pušta testove već promovisanih ekrana kao regresiju, i vraća izmenu ako nešto pukne.

6. **Izveštaj** (HTML) i komanda `verify` za nezavisnu proveru.

### 3.3 Izlaz na disku i vlasništvo

```
output/<run-id>/
├── plan.json                 arhitekta
├── analysis/<deo>.json       analizatori
├── tests/<ekran>.json        validirani scenariji (testeri)
├── staging/<builder>/        nacrti (builderi pišu SAMO ovde)
├── app/                      živa Expo aplikacija (SAMO Gatekeeper piše ovde)
├── results/<ekran>.json      GateResult i ScenarioResult
├── run.jsonl                 svi događaji sa vremenom
└── report.html               izveštaj
```

Sve što agenti razmenjuju je i na tabli (`MigrationState`) i na disku, pa izveštaj i `verify` rade i posle prolaza. OwnershipGuard (Mozaik interception) odbija svaki upis van dozvoljene putanje pre nego što se desi.

---

## 4. Testovi: kako se dokazuje da radi

### 4.1 Scenario DSL

Testovi se zapisuju kao mali JSON sa ograničenim skupom koraka, validiran zod-om:

```json
{
  "id": "narudzbine-pretraga",
  "unitId": "lista-narudzbina",
  "obligation": "pretraga",
  "steps": [
    { "goto": "/narudzbine" },
    { "fill": { "label": "Pretraga", "value": "Petar" } },
    { "expectVisible": { "text": "#1042" } },
    { "expectNotVisible": { "text": "#1043" } }
  ]
}
```

| Korak | Značenje |
|---|---|
| `goto` | Idi na ekran |
| `tap {role, name}` | Tapni element te vrste sa tim imenom, npr. dugme "Sačuvaj" |
| `tap {text}` | Tapni element na kome piše taj tekst |
| `fill {label, value}` | U polje sa tom labelom upiši vrednost |
| `expectVisible` | Proveri da se to vidi |
| `expectNotVisible` | Proveri da se to ne vidi |

Umesto "ima ih tačno 4" tester zapisuje koje stavke moraju da se vide, a koje ne. Tako se korak lako prevodi i za Android, gde Maestro nema jednostavno brojanje.

### 4.2 Kako tester piše testove i kako rade na Androidu

Ovo **nisu testovi za REST API**, nego UI testovi: test radi isto što i korisnik (tapne, ukuca, skroluje) i proverava šta se pojavilo na ekranu.

**Šta tester radi:** dobije ekran i alat koji upravlja pravim browserom (Playwright) nad originalnom web aplikacijom.

1. Otvori stranicu i dobije listu elemenata koje korisnik vidi (ARIA snapshot): šta je dugme, šta polje, šta lista, i kako se zove.
2. Isproba nešto, npr. izabere status "Poslato", i vidi šta se promenilo.
3. Zapiše test u neutralnom JSON obliku (odeljak 4.1), bez HTML-a i bez Playwright koda.
4. Odmah ga pusti: mora da prođe na originalu i da padne na praznom ekranu, uz proveru pre i posle radnje.

**Zašto isti test radi i na Androidu:** test ne opisuje kod, nego ono što korisnik vidi i radi: "polje sa nazivom Pretraga", "tekst #1042". To postoji na obe platforme, samo je drugačije napravljeno:

| Korak testa | Web original | Mobilna aplikacija |
|---|---|---|
| Polje "Pretraga" | `<input aria-label="Pretraga">` | `<TextInput accessibilityLabel="Pretraga">` |
| Tekst "#1042" | `<td>#1042</td>` | `<Text>#1042</Text>` |
| Dugme "Sačuvaj" | `<button>Sačuvaj</button>` | `<Pressable><Text>Sačuvaj</Text></Pressable>` |

Isti JSON se prevodi za tri izvršioca:

- **Playwright nad originalom:** potvrđuje da je test tačan.
- **Playwright nad Expo web verzijom** (react-native-web): brza provera dok builder popravlja, traje sekunde.
- **Maestro na Android emulatoru (opciono):** dokaz na pravom Androidu. Sporije, pa ide za gotove ekrane.

```yaml
- tapOn: "Pretraga"
- inputText: "Petar"
- assertVisible: "#1042"
- assertNotVisible: "#1043"
```

**Ugovor za buildera:** elementi zadržavaju **ista imena** kao na webu (labele polja, tekst dugmadi). Izgled sme da menja, imena ne.

### 4.3 Šta se poredi, a šta ne

**Izgled se ne poredi, i to je namerno.** Na telefonu ekran treba da izgleda drugačije: tabela postaje lista kartica, bočni meni postaje donja navigacija, filteri idu u padajući meni.

- ✓ **Proverava se:** isti podaci se vide, iste akcije postoje, ista akcija daje isti rezultat.
- ✗ **Ne proverava se:** boje, pozicije, veličine, fontovi, pikseli.

U izveštaju mogu da stoje snimci ekrana weba i telefona jedan pored drugog, da čovek pogleda izgled. To nije deo automatske ocene.

### 4.4 Testovi ekrana i testovi toka

- **Testovi ekrana** proveravaju jedan ekran sam za sebe. Počinju direktno na tom ekranu, sa unapred ubačenim podacima (`seed`), npr. "otvori `/omiljeni` kad su u skladištu recepti 3 i 7". Zato builder može da proverava svoj ekran iako ekrani od kojih zavisi još nisu gotovi.
- **Testovi toka** prelaze preko više ekrana, npr. "otvori recept → dodaj u omiljene → idi na Omiljene → recept je tu". Svaki ima listu ekrana od kojih zavisi, a Gatekeeper ga pušta tek kad su svi ti ekrani promovisani.

### 4.5 Kad web nije prilagođen telefonu

Tester pušta original u desktop veličini (npr. 1280×800), tamo gde original radi kako treba. Builder pravi novi raspored za telefon (npr. 390×844). Komplikacije i rešenja:

| Problem | Primer | Rešenje |
|---|---|---|
| Nešto je sakriveno na telefonu | Filteri su iza dugmeta "Filteri" | Arhitekta to zapiše u planu. Kad se test pušta na telefonu, prevodilac sam ubaci korak "tapni Filteri". Tester i dalje piše test iz originala. |
| Sadržaj je dugačak | Lista od 50 stavki | Pre provere se automatski skroluje do elementa (Playwright to radi sam, Maestro ima `scrollUntilVisible`) |
| Jedan web ekran postaje dva | Lista i detalj su na webu jedan pored drugog | Test proverava rezultat, ne adresu: "posle tapa na #1042 vidi se adresa kupca" |
| Na telefonu se vidi manje podataka | Tabela ima 8 kolona, kartica 3 | Arhitekta odredi šta ostaje u listi, a šta prelazi na detalj. Tester proverava email kupca na detalju. |

**Ograničenje:** u ovim slučajevima izvor istine je original plus plan arhitekte sa **namernim razlikama**. Ako ih ima previše, dokaz slabi. Zato svaka namerna razlika mora da se vidi u izveštaju, npr. "Lista narudžbina: 2 namerne razlike (filter iza dugmeta, email na detalju)".

Stvari koje postoje samo na webu (hover, desni klik, prečice na tastaturi, prevlačenje mišem) arhitekta označi kao "nije prenosivo" ili predloži zamenu (dugi pritisak umesto desnog klika). Aplikacije koje se skoro cele sastoje od takvih stvari (tabele kao Excel, editori) nisu dobar kandidat.

### 4.6 Pokrivenost i statusi: bez testova nema zelenog

Ekran sa nula testova bi "prošao sve testove", jer nema nijednog koji može da padne. Zato važe pravila, i sva ih sprovodi običan kod:

1. **Bez testova nema zelenog.** Ako testova nema, Gatekeeper čeka. Posle timeouta Conductor daje zadatak drugom testeru. Ako ni tada nema testova, ekran ulazi u aplikaciju (da aplikacija bude kompletna), ali sa statusom **nedokazan**.
2. **Šta mora da se testira ne odlučuje tester.** Obaveze dolaze iz plana arhitekte (npr. prikaz liste, filter, pretraga, klik na detalj). Uz to, program iz ARIA snapshota originala izvuče sve interaktivne elemente (dugmad, polja, linkove), i **svaki mora biti korišćen u bar jednom testu** ili označen kao "nije prenosivo".
3. **Testovi moraju da proveravaju ponašanje.** Provera iz testa mora da padne pre radnje, a da prođe posle. Ako prolazi i pre radnje, radnja ništa ne menja i test se odbija.
4. **Builder ne može da utiče na testove.** Ne sme da piše u folder sa testovima (OwnershipGuard) i ne zna kakvi su testovi dok ne dobije prvu grešku.

| Status | Kada | Boja u izveštaju |
|---|---|---|
| Dokazan | Sve obaveze i svi elementi pokriveni, svi testovi prolaze | zelena |
| Delimično dokazan | Svi postojeći testovi prolaze, ali pokrivenost nije potpuna | žuta |
| Nedokazan | Nema validiranih testova | siva |
| Neuspeo | Testovi postoje, a ekran ih ne prolazi ni posle eskalacije | crvena |

Primer u izveštaju: "Lista narudžbina: 4/4 obaveze, 6/7 elemenata (nedostaje 'Izvezi CSV'), 2 namerne razlike → delimično dokazan".

### 4.7 Ograničenja

- **Isti podaci.** Obe aplikacije moraju da čitaju iste podatke (isti `mock-api` ili isti `seed`). Inače razlika u broju stavki ne znači grešku.
- **Android je spor.** Builder popravlja kod uz brzu proveru u browseru, a Android provera ide za gotove ekrane.
- **Pretpostavka za Spike A:** Maestro na Androidu pronalazi elemente po `accessibilityLabel` i vidljivom tekstu. Ako ne pronalazi, rezervno rešenje je `testID` sa istim imenom na svakom bitnom elementu.

---

## 5. Agenti i paralelni rad

### 5.1 Sastav: 4 vrste AI agenata i 2 deterministička učesnika

| Učesnik | Vrsta | Broj | Šta radi | Šta predaje i kome |
|---|---|---|---|---|
| Analizator | AI (Haiku 4.5) | 1–4, po veličini koda | Čita svoj deo aplikacije | Izveštaj u istom formatu → arhitekti |
| Arhitekta | AI (Sonnet 4.6) | uvek 1 | Spaja izveštaje u plan: zajedničko, adrese, zavisnosti, obaveze, namerne razlike, talasi | Plan na tablu → Conductoru (`plan.ready`) |
| Tester | AI (Haiku 4.5) | oko pola broja buildera | Za ekrane iz reda isproba original i piše testove, pa ih odmah proveri | Validirani testovi → Gatekeeperu (`tests.ready`) |
| Builder | AI (Haiku 4.5 → Sonnet 4.6) | 1–6, po broju ekrana u talasu | Piše mobilnu verziju u svom staging folderu i popravlja greške | Kod → Gatekeeperu (`draft.submitted`) |
| Conductor | Običan kod | 1 | Računa broj agenata, pokreće i gasi ih, vodi red zadataka, eskalira model, vodi timeoute | Zadatke → testerima i builderima |
| Gatekeeper | Običan kod | 1 | Kapije, pokrivenost, statusi, promocija jedan po jedan, regresija, rollback, testovi toka | Grešku → builderu, ili ekran → u `app/` |

**Zašto su Conductor i Gatekeeper običan kod, a ne AI:**

- **AI sudija može da se prevari:** builder može da napiše uverljiv kod koji ne radi, a AI kritičar kaže "izgleda dobro". tsc i testovi se ne mogu ubediti.
- **To je poenta projekta:** prodajemo dokaz, a ne mišljenje.
- **Žiri može da ponovi proveru:** `verify` daje isti rezultat svaki put, bez API ključa.
- **Cena i brzina:** provera se pušta desetine puta po prolazu, a kao kod je besplatna i traje sekunde.
- **Raspored je jednostavna logika.**

**Zašto testeri pišu testove, a ne sude:** AI koji čita kod i kaže da li je dobar je nepouzdan. AI koji piše testove iz originala, a običan kod ih pušta, daje proveru koja se ne može izmanipulisati.

### 5.2 Koliko agenata: računa Conductor, dinamički

Arhitekta je uvek jedan. Ostale brojeve računa **Conductor običnim kodom**, iz veličine projekta koju izmeri parser:

| Agent | Pravilo | Zašto |
|---|---|---|
| Analizatori | 1 na svakih ~60k tokena koda, najmanje 1, najviše 4 | Jedan analizator treba da pročita svoj deo bez preteranog konteksta |
| Builderi | Koliko ima spremnih ekrana u trenutnom talasu, najviše 4–6 | Nema smisla imati više buildera nego ekrana |
| Testeri | Pola broja buildera, zaokruženo naviše | Pisanje testova je brže od pravljenja ekrana |

Gornje granice postavljaju limit API poziva, RAM i budžet, i podesive su (`--max-builders`, `--max-testers`).

| Projekat | Analizatori | Arhitekta | Builderi | Testeri |
|---|---|---|---|---|
| TodoMVC (1 ekran, ~336 linija) | 1 | 1 | 1 | 1 |
| Recepti (5 ekrana) | 1 | 1 | 4 | 2 |
| Admin panel (40 ekrana) | 3–4 | 1 | 4–6 | 2–3 |

**Zašto pravila u kodu, a ne AI procena:** pravilo je predvidljivo, besplatno i lako se objasni žiriju.

**Prilagođavanje u toku rada.** Conductor sve vreme gleda tablu:

- **Testeri zaostaju** (ekrani bez testova, builderi čekaju): doda se još jedan tester.
- **Builderi nemaju posla** (sledeći talas čeka zavisnosti): suvišni builderi se gase.
- **Budžet se približava limitu** ili API vraća 429: smanjuje se paralelnost.
- Broj se menja najviše jednom u minutu, da ne bude "klackanja".

U Mozaiku se ovo radi sa `join` i `leave` (runtime objavljuje `participant.joined` i `participant.left`). Novi builder je nova instanca `createAgent`. Gasi se samo agent bez aktivne petlje (posle `model.answer`). Prilagodljivost (adaptivity) je jedna od tri osobine koje Mozaik dokumentacija ističe.

U izveštaju piše koliko je agenata pokrenuto i zašto, npr. "5 ekrana → 1 analizator, 4 buildera, 2 testera; u 6. minutu dodat tester jer je red bez testova narastao na 3".

### 5.3 Kako testovi nastaju u isto vreme dok se pravi kod

**Ključna stvar: test opisuje kako originalna web aplikacija radi, a originalna aplikacija već postoji.** Tester ne mora da čeka novi mobilni ekran. Otvori postojeću web stranicu, isproba je i zapiše šta mora da važi. U isto vreme builder pravi mobilnu verziju istog ekrana.

**Poređenje:** praviš kopiju kuće. Dok majstori grade novu kuću, inspektor obilazi **staru** i pravi listu: "3 sobe, kuhinja levo od ulaza, vrata kupatila se zaključavaju". Kad majstori završe, lista ih već čeka.

![Slika 2. Jedan ekran, minut po minut: tester i builder kreću istovremeno](img/fig3_jedan_ekran.png)

| Minut | Tester (nad originalnom web aplikacijom) | Builder (mobilna verzija) |
|---|---|---|
| 0 | Otvori `/narudzbine` i vidi tabelu, filter i pretragu | Čita web kod ekrana i plan |
| 1 | Isproba filter: izabere "Poslato", ostanu 4 narudžbine | Piše mobilni ekran, tabelu pretvara u listu kartica |
| 2 | Zapiše test 1 | Piše dalje |
| 3 | Test 1: original ✓, prazan ekran ✗, pre/posle ✓. Test važi. | Dodaje filter i pretragu |
| 4 | Piše test 2: pretraga "Petar" → vidi se #1042 | Završava prvu verziju |
| 5 | Test 2 validiran i sačuvan | **Preda kod.** Testovi ga već čekaju. |
| 6 | | Rezultat: filter ✓, pretraga ✗ (nema polja sa labelom "Pretraga") |
| 7 | | Popravi i preda ponovo: oba testa prolaze ✓, ekran se promoviše |

**Zašto ne testirati posle pravljenja:**

1. **Gubi se vreme:** prvo pravljenje, pa pisanje testova, umesto oba u isto vreme.
2. **Testovi bi bili pristrasni:** tester bi gledao novi ekran i opisao kako *on* radi. Ako je builder zaboravio pretragu, tester je ne bi ni testirao.

### 5.4 Talasi i red zadataka

Primer za admin panel prodavnice sa 40 ekrana:

```
Talas 0: zajedničko — komponente (Tabela, Dugme...), skladište podataka, meni
Talas 1: ekrani bez zavisnosti — liste, podešavanja (≈25 ekrana)
Talas 2: ekrani koji zavise od drugih — detalji, forme za izmenu (≈15 ekrana)
```

- Testeri kreću čim arhitekta završi plan, dok builderi još rade Talas 0, pa su obično ispred buildera.
- Kad builder završi ekran, odmah uzima sledeći iz reda.
- Ekran iz Talasa 2 kreće čim su gotovi ekrani i podaci od kojih zavisi.

![Slika 3. Konkurentni rad na 40 ekrana sa 3 analizatora, 4 buildera i 2 testera (ilustrativna simulacija)](img/fig2_konkurentnost.png)

Slika 3 je simulacija sa izmišljenim trajanjima (3–5,5 min po ekranu, trećina ekrana treba popravku, ~8% eskalaciju), a ne merenje. U simulaciji sav rad redom traje oko 272 minuta, a paralelno oko 67, što je ubrzanje oko 4 puta. Pravi broj meri izveštaj posle prvog stvarnog prolaza.

### 5.5 Kad su ekrani povezani

| Veza | Primer | Rešenje |
|---|---|---|
| Navigacija | Na "Listi" tapneš recept, ode se na "Detalj" | Plan unapred definiše adrese (`/recept/[id]`). Builder "Liste" zna samo adresu. |
| Zajednički podaci | "Dodaj u omiljene" na Detalju menja ekran "Omiljeni" | Zajednički sloj za podatke sa fiksnim funkcijama (`addToFavorites(id)`, `getFavorites()`) pravi se u Talasu 0 |
| Ponašanje preko više ekrana | "Dodaj u omiljene → Omiljeni → recept je tu" | Testovi toka (odeljak 4.4) |
| Previše povezani "ekrani" | Modal koji postoji samo unutar drugog ekrana | Arhitekta ih spaja u jednu jedinicu posla |

Ako je aplikacija jako isprepletana, biće manje nezavisnih jedinica i manje ubrzanja. Izveštaj to pokazuje kroz meru ubrzanja.

### 5.6 Koordinacija u Mozaiku

Agenti ne pričaju direktno jedni sa drugima, nego preko **table** (`MigrationState extends RuntimeState`: plan, izveštaji, red zadataka, statusi, mapa vlasništva, testovi, knjiga troškova) i **događaja** koji nose samo ID-jeve:

| Događaj | Ko šalje | Ko reaguje |
|---|---|---|
| `analysis.done` (×N) | Svaki analizator | Arhitekta kreće tek kad su stigli **svi** izveštaji |
| `plan.ready` | Arhitekta | Conductor pravi red zadataka i pokreće testere i Talas 0 |
| `tests.ready` | Tester (za jedan ekran) | Gatekeeper beleži da ekran može da se proverava |
| `draft.submitted` | Builder | Gatekeeper pokreće kapije |
| `gate.failed` | Gatekeeper | Conductor vraća zadatak istom builderu sa greškom, ili eskalira model |
| `unit.promoted` | Gatekeeper | Conductor oslobađa zavisne ekrane iz sledećeg talasa |
| `budget.exceeded` | Runner | Conductor zaustavlja nove zadatke i smanjuje paralelnost |
| `participant.joined` / `participant.left` | Mozaik runtime | Izveštaj beleži kad je koji agent pokrenut i ugašen |

### 5.7 Mozaik detalji (provereno u paketu 4.1.0)

Objavljeni paketi 4.1.0 i 4.2.0 su bajt za bajt isti. Izvor istine je `node_modules/@mozaik-ai/core/dist/index.d.ts`, a ne GitHub (`main` grana ima drugačiju unutrašnju strukturu).

- `defineRuntime<T>()` vraća `initializeRuntime`, `resolveRuntime`, `resolveParticipant`, `join`, `leave`, `sendMessage`, `sendEvent` i `runLoop`. **`initializeRuntime` baca grešku ako se pozove dvaput**, pa runtime pravi samo `core/runtime.ts`.
- **`runLoop` vraća `void` i pokreće petlju bez `await` i bez `.catch`.** Greška API-ja postaje neuhvaćen promise i ruši Node proces. Rešenje: sopstveni runner preko `inferenceRunnerConfig.runner`, sa retry-jem, koji nikad ne baca grešku, plus `process.on("unhandledRejection")`.
- **Greške alata se hvataju** i vraćaju modelu kao tekst ("Error calling tool: …"). To je dobro za petlju popravki.
- **U jednom koraku izvršava se samo prvi function call.** Paralelizam dolazi od više agenata.
- **Memorija agenta raste na mestu.** Dve istovremene petlje na istom agentu bi pomešale kontekst. Pravilo: jedan agent, jedna aktivna petlja, svež `ModelContext` za svaki zadatak, svaki builder je zasebna instanca `createAgent`.
- **Svaki događaj ide svim učesnicima,** uključujući `inference.stream`. Handleri filtriraju po `type` i `producerId`. Kraj petlje je `model.answer` od tog agenta.
- **Interception može da zameni poziv alata** sintetičkim odgovorom (obrazac iz primera `human-in-the-loop`). Koristi se za OwnershipGuard.
- **Modeli:** koristimo `claude-haiku-4-5` i `claude-sonnet-4-6`, jedine koje nudi gateway hakatona. Oba su na ugrađenoj listi, pa se ništa ne dodaje ručno (D-023).
- **Anthropic mapper ne postavlja `cache_control`.** `max_tokens` se uzima iz `maxOutputTokens`, pa ga uvek postavi.
- **Mozaik Cloud telemetrija** se uključuje sa `MOZAIK_API_KEY` i šalje događaje petlje, uključujući memoriju agenta, na JigJoy-ev server. Ne postavljati bez odluke tima.
- **Deterministički učesnik** može biti podklasa `Participant` ili `createHuman` sa handlerima.

### 5.8 Skica koda (samo provereni API)

```ts
// src/core/runner.ts
import { supportedModels, type InferenceRunner } from "@mozaik-ai/core"

export const models = [...supportedModels]   // claude-haiku-4-5 i claude-sonnet-4-6 su ugrađeni

export class BudgetedRunner implements InferenceRunner {
  async run(input) {               // retry + obračun tokenUsage → $ + tvrdi limit
    const m = models.find(x => x.specification.name === input.model)!
    return withRetry(() => m.endpoint.infer(input))
  }
  stream(input) { return models.find(x => x.specification.name === input.model)!.endpoint.stream(input) as any }
}

// src/agents/_shared/ownership-guard.ts
import { FunctionCallOutputItem, type InterceptionHandler, type ExecutableTransition } from "@mozaik-ai/core"

export class OwnershipGuard implements InterceptionHandler {
  constructor(private prefix: string) {}
  isSatisfiedBy(t: ExecutableTransition) {
    return t.nextStateId === "function_call" && t.input.call.name === "write_file"
      && !JSON.parse(t.input.call.args).path.startsWith(this.prefix)
  }
  async handle(t: ExecutableTransition): Promise<ExecutableTransition> {
    const { call, inferenceInput } = t.input as any
    inferenceInput.context.addContextItems([call,
      FunctionCallOutputItem.create(call.callId, `Rejected: you may only write in ${this.prefix}`)])
    return { nextStateId: "inference", input: inferenceInput }
  }
}

// src/agents/builder.ts — pokretanje sa svežim kontekstom
import { ModelContext, DeveloperMessageItem } from "@mozaik-ai/core"
import { runLoop } from "../core/runtime"

const ctx = ModelContext.create().addContextItem(DeveloperMessageItem.create(BUILDER_PROMPT))
runLoop(builder.getId(), task, { model: MODELS.default, maxOutputTokens: 8000,
  context: ctx, tools: builder.getTools() }, new OwnershipGuard(`staging/${builderId}/`))
```

Ovo je skica, ne kod za kopiranje. Tipove proveri u editoru.

---

## 6. Tehnologije i trošak

| Izbor | Zašto |
|---|---|
| Node 22, TypeScript, `tsx`, jedan paket | Bez build koraka i bez podešavanja workspaces |
| `@mozaik-ai/core@4.1.0` (tačno pinovan) | Proveren, identičan 4.2.0 |
| Playwright (Chromium) | Isti izvršilac za original i RN-web. `ariaSnapshot()` daje testerima stablo uloga i imena. |
| Expo SDK 58 + Expo Router | Trenutni `latest` na npm-u. Rutiranje po fajlovima se lako mapira na web rute. Šablon se generiše jednom i čuva u `templates/expo/`. |
| ts-morph ili Babel parser | Lista ruta i fajlova za podelu analize, i statička kapija za zabranjene web API-je |
| zod | Šeme za ugovore, scenarije i sve što dolazi od modela |
| vitest | Testovi domena, bez mreže |
| Claude Haiku 4.5 po defaultu, Sonnet 4.6 za arhitektu i eskalaciju (D-023) | Jedini modeli koje nudi gateway hakatona. Haiku 4.5: $1 ulaz / $5 izlaz po milion tokena. Sonnet 4.6: $3 / $15. |
| Maestro + Android emulator (opciono) | Maestro podržava API nivoe 29, 30, 31, 33 i 34, pa se koristi slika API 34 |
| Lokalni model na GPU-u | **Ne.** Na 12 GB VRAM-a lokalni modeli su nepouzdani za višefajlno pisanje koda i alate. Za besplatan razvoj služi MockRunner. |

### 6.1 Procena troška jednog prolaza

Demo aplikacija Recepti: 5 ekrana i 2 zajednička modula. Ovo je procena, a prvi pravi prolaz je meri.

| Agent | Model | Pretpostavka (zbirno) | Trošak |
|---|---|---|---|
| Analizator ×1 | Haiku 4.5 | ~80k ulaz / 8k izlaz | ~$0.12 |
| Arhitekta | Sonnet 4.6 | ~60k / 10k | ~$0.33 |
| Tester ×2 (5 ekrana + tokovi) | Haiku 4.5 | ~100k / 5k po ekranu | ~$0.63 |
| Builder ×4 (7 jedinica) | Haiku 4.5 | ~150k / 20k po jedinici | ~$1.75 |
| Eskalacija na Sonnet 4.6 | Sonnet 4.6 | ~150k / 20k | ~$0.75 po ekranu |

- Prolaz bez eskalacija košta oko **$2.80**, a sa tri eskalacije oko **$5**, bez uštede od keša. Gateway sam kešira kontekst (D-020), a čitanje iz keša košta 0,1× cene ulaza, pa je stvarni trošak niži. U razvoju i arhitekta može da radi na Haiku 4.5.
- Broj agenata malo utiče na trošak, jer se plaća posao (tokeni), a ne broj agenata.
- Plan budžeta: razvoj na mock-u ($0), jeftini prolazi nad TodoMVC-om i nekoliko punih prolaza nad Receptima (~$3–5 po prolazu).
- Za veliku aplikaciju od 40 ekrana gruba procena je ~$20–30 po prolazu, pre uštede od keša.
- Runner sprovodi tvrd limit po prolazu (`--budget`, podrazumevano $5).

---

## 7. Obim MVP-a

**Ulazni profil koji podržavamo:**

- React 18/19 SPA (Vite, CRA ili webpack) sa React Router 6/7 deklarativnim rutama.
- Obični CSS ili CSS moduli.
- Stanje kroz hooks i Context.
- `fetch` ka JSON-u i `localStorage`.
- Do oko 8 ekrana za demo (arhitektura podržava i više).

**Ulazi u MVP:**

1. `wemora migrate <web-dir> --out <dir> --max-builders 4 --max-testers 2 --budget 3 [--mock]`
2. Analiza sa 1–4 analizatora (po veličini koda) i arhitektom, sa strukturisanim izveštajima i planom.
3. Conductor računa broj agenata po pravilima iz odeljka 5.2.
4. Scaffold, talasi i red zadataka, paralelni builderi i testeri, Gatekeeper sa kapijama (tsc, zabranjeni API-ji, labele, scenariji na RN-web).
5. Validacija testova (original, prazan ekran, pre i posle), pokrivenost i statusi.
6. Testovi ekrana sa `seed` podacima i testovi toka preko više ekrana.
7. Eskalacija modela posle 2 neuspele runde i timeout po jedinici.
8. HTML izveštaj: broj pokrenutih agenata i razlog, matrica pariteta, pokrivenost, namerne razlike, statusi, trošak po agentu, vremenska osa i mera ubrzanja.
9. `wemora verify <out>` pušta sve scenarije bez AI-ja.
10. Test sabotaže (`npm run sabotage`).
11. Dve ulazne aplikacije:
    - **Recepti**, 5 ekrana, **namerno samo za desktop**: bočni meni, široka tabela, lista i detalj jedan pored drugog, hover info, omiljeni u `localStorage`. Tako žiri vidi pravu transformaciju desktop ekrana u mobilni.
    - **TodoMVC React**, aplikacija koju nismo mi napisali, radi poštenja.

**Namerno ne radimo:** Next.js/SSR/RSC, Tailwind/shadcn, CSS-in-JS biblioteke, auth i kolačiće, native API-je (kamera, push), iOS, objavu u prodavnicama, piksel-poređenje, web-only biblioteke (mape, grafikoni).

---

## 8. Plan rada (sažetak)

Detaljna podela po osobama (A/B/C/D), folderima, granama i satima je u `docs/tim-plan.md`. Kontrolne tačke:

---
