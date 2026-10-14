# Planul de marketing Lapdle (10 oct – 8 nov 2026, cu privire până în ianuarie)

Scris pe 10 octombrie 2026, ziua 5 de la lansare. Folosește skill-urile
marketing-plan (structura AARRR), social, referrals, analytics, seo-audit,
community-marketing și launch. Înlocuiește vechiul plan social (șters din repo). Folosește ce e
bun din planul lui Rares („Social Growth Plan”, cu corecturile de mai jos) și
din `GROWTH_AUDIT.md`.

**Cum se citește:**
- **[V]** = verificat (în cod, pe site sau pe profilurile publice, pe 10 oct).
- **[I]** = ipoteză de testat.
- Nicio cifră de trafic nu e inventată. Unde lipsesc date, scrie „necunoscut”,
  iar §11 spune de unde le iau.

---

## 0. Situația pe 10 octombrie

| Ce | Starea | |
|---|---|---|
| Site | Live din 6 oct. Paginile jocurilor au titlu, text și canonical proprii. Sursele vizitelor (`?ref=`, `utm_*`) se măsoară, la fel distribuirile și provocările „beat my lap”. | [V] |
| Google | Lapdle nu apare încă la căutarea „lapdle racing line game”. Domeniul e verificat pentru Search Console (înregistrarea DNS `google-site-verification` există); sitemap-ul și indexarea sunt de verificat. | [V] |
| YouTube @lapdle | 2 Shorts: trailerul (12 vizualizări) și „When would you brake? 346 km/h into Monza turn one” (1 vizualizare). Descrierea are link. | [V] |
| TikTok @lapdle | 0 urmăritori, 2 like-uri, bio pus, **fără link spre site** [V]. Trailerul are 3 vizualizări, clipul cu gameplay 75 (cifre de la tine). Primul semnal, încă slab: **gameplay-ul bate trailerul**. | [V] |
| Instagram @_lapdle_ | 0 urmăritori, 2 postări, **0 vizualizări pe ambele** (de la tine). Bio corect, cu link `?ref=instagram`. Totuși, 3 vizitatori au venit de pe Instagram, deci linkul funcționează. | [V] |
| Reddit | **Nu există cont.** Multe subreddit-uri filtrează conturile noi, fără karma. | |
| Plausible (public: plausible.io/lapdle.com) | Ultimele 28 de zile: **24 de vizitatori unici, 30 de vizite**, 2,4 pagini pe vizită, 3 min 51 s pe vizită. Surse: direct 17, Google 3, Instagram 3, Facebook 1. **10 vizitatori au început un joc (42%)**. Configurate doar goals-urile `Visit` și `Game started`; restul evenimentelor și proprietățile (inclusiv revenirea) nu apar încă. Cifrele includ și vizitele noastre. | [V] |
| Bani și echipă | 0 € buget. AdSense în așteptare. **Doi oameni, cu responsabilități egale** (tu și Rares: site, rețele, tot). Timpul disponibil nu e stabilit. | |
| Concurență | Jocuri zilnice de trivia (Sportdle și altele), Track Bender, DrawRace 2 (iOS, 2011) și, nou găsit, **Apex Line** pe itch.io: desenezi traiectoria cu mouse-ul, în browser. | [V] |

**Interpretare:** 0 urmăritori și câteva vizualizări în prima săptămână e
normal pentru conturi noi, fără istoric. Nu e un semnal despre joc. Rețelele
sociale cresc lent; primii jucători reali vin, de regulă, din comunități și
din grupurile de prieteni. Planul e construit pe asta.

---

## 1. Rezumat

**Obiectivul pe 30 de zile:** să aflăm dacă oamenii care încearcă Lapdle **revin a doua zi**. Abia apoi contează să aducem mulți. Măsura principală: **jucători pe zi** (vizitatori unici cu `Game started`).

**Trei pariuri, în ordinea asta:**
1. **Comunitățile:** Show HN **joi 15 octombrie**, apoi Reddit din **marți 20** (contul trebuie creat și încălzit întâi), plus grupurile de prieteni. Cea mai rapidă sursă de primii 100–500 de jucători reali [I].
2. **Bucla de distribuire** (grila colorată și „beat my lap”). Fiecare jucător aduce alți jucători; deja măsurată.
3. **Clipuri scurte cu gameplay real, zilnic, pe 3 platforme.** O investiție care se adună în timp. Nu le judecăm înainte de ~15 clipuri.

**Două weekenduri de cursă** dau ritmul: Austin (sâmbătă 24 oct) și Interlagos (sâmbătă 7 nov). În ambele, Daily Quali e circuitul cursei [V].

**Ce nu facem acum:** reclame plătite, X, video lung pe YouTube, Discord propriu, mai multe limbi. Le reevaluăm la revizia din 8 noiembrie.

---

## 2. Cadrul strategic

- **Ce este:** jocul zilnic de curse în care **conduci, nu ghicești**. Alegi traiectoria, fizica dă timpul, la fel pentru toți [V].
- **Pentru cine, în ordinea priorității** (din `apps/web/PRODUCT.md`):
  1. fanul de weekend de cursă;
  2. sim racer-ul fără volan la îndemână;
  3. jucătorul de jocuri zilnice;
  4. curiosul tehnic, util pentru Hacker News.
- **Poarta „mărimea problemei × frecvență”:** problema e mică (plictiseală, nevoia unui test scurt de pricepere), dar zilnică. Asta e cadranul **obicei**: se poate răspândi ușor, dar se pierde la fel de ușor. **Retenția e riscul principal**, nu achiziția.
- **Poziționare față de Apex Line și Track Bender:** ei au mecanica, nu au ritualul. Diferența Lapdle e combinația: o provocare pe zi, aceeași pentru toți, plus feedback pe fiecare viraj, plus o grilă de distribuit.
- **Tonul:** ca un fan care se pricepe, de pe zidul boxelor. Scurt, concret, cu cifre („apexul târziu a salvat 0,31 s”). Fără „amazing racing action”.
- **Reguli fixe:**
  - Niciun nume de serie, echipă sau pilot în textele noastre, nicio imagine de la transmisii, nicio livrea.
  - În bio sau în clipul fixat: „Independent fan game, not affiliated with any racing series”.
  - Conținutul AI e etichetat ca AI.

---

## 3. Diagnostic: ce merge și ce nu

| Zona | Stare | Ce facem |
|---|---|---|
| Măsurarea | Bună: sursele, distribuirile și provocările ajung în Plausible [V]. | Goals și proprietăți adăugate în Plausible (dacă nu e făcut deja) |
| Distribuirea în rețele | Pornită: 4 clipuri, toate cu tracțiune aproape zero (normal la început) | Ritm de 5 clipuri pe săptămână, formate cu întrebare + reveal |
| TikTok | Fără link spre site, deci nu aduce vizite direct | Încearcă trecerea la **Business** și vezi dacă apare câmpul Website. Altfel, „link on our Instagram” / „search lapdle” |
| Comunitățile | Pregătite (drafturi în `LAUNCH_PLAN.md`), neîncepute | Încălzirea contului de Reddit, apoi lansare din 15 oct |
| Căutare | Neindexat | Search Console + sitemap, apoi răbdare (luni, nu zile) |
| Revenirea | Mecanisme în joc (seria de zile, contorul x/5, numărătoarea, instalare) [V]; niciun canal de reamintire | Story zilnic pe Instagram ca reamintire; reamintire în aplicație, decizie în §12 |
| Planul lui Rares | Bun pe partea video, cu câteva erori (vezi mai jos) | Folosim brief-urile lui video, corectate |

**Corecturi aplicate din planul lui Rares:**
- Bio-ul de Instagram avea 169 de caractere (limita e 150), iar cel de X 166 (limita 160).
- Linkul `/practice/suzuka` nu există. Cel corect: `/?play=practice&track=suzuka` sau `/circuits/suzuka`.
- Clasament săptămânal nu există.
- La ploaie, mașina nu „iese în decor”, e doar mai lentă.
- Harta e 2D, nu 3D.
- Show HN se postează marți–joi, nu vineri–sâmbătă.
- „Returning visitors” nu există în Plausible; folosim `Visit` cu `last_played=yesterday`.
- Volumul de lucru era subestimat (6–7 h pe săptămână pentru ~15 h de muncă).

---

## 4. Achiziție: cum ajung oamenii la Lapdle

| Canal | Rolul | Ritm până pe 8 nov | Link |
|---|---|---|---|
| Grupuri de prieteni | Primii jucători, cu încredere | Grila ta, de 2–3 ori pe săptămână, în grupuri diferite | link din share |
| Reddit | Primele sute de jucători [I] | Cont nou azi, încălzit până pe 19; apoi o postare pe zi, din 20 oct | `?utm_source=reddit&utm_campaign=launch&utm_content=<sub>` |
| Hacker News (Show HN) | Publicul tehnic, link-uri și bloguri [I] | O singură dată: **joi 15 oct**, 15:00–17:00 ora României | `?utm_source=hn` |
| TikTok, Reels, Shorts | Investiție pe termen lung | **5 clipuri pe săptămână**, același clip pe toate trei | `?ref=tiktok` / `instagram` / `youtube` |
| Story Instagram | Reamintire pentru cei care te urmăresc deja | Zilnic, 2 minute | `?ref=ig-story` |
| Directoare de jocuri | Trafic mic, dar constant | 6–12 listări în săptămâna 22–28 oct (textul e în `LAUNCH_PLAN.md`) | `?ref=<director>` |
| Creatori mici de sim racing | O singură mențiune poate aduce mult [I] | 10–15 mesaje personale în săptămâna cu Austin | `?ref=<creator>` |
| Google | Investiție lentă | Search Console acum; ghidurile de circuit există deja | |

**Contul de Reddit:** creați-l azi. Dacă unul dintre voi are deja un cont mai
vechi, folosiți-l pe acela; un cont vechi cu activitate trece mai ușor de
filtre. De azi până pe 19: 3–5 comentarii utile pe zi în r/simracing,
r/WebGames și r/F1Technical, fără link. Citiți regulile fiecărui subreddit
înainte să postați (vechime minimă, karma, zile de autopromovare) și
răspundeți 2 ore după fiecare postare.

| Zi | Unde | Unghiul | Circuitul zilei |
|---|---|---|---|
| Joi 15 | **Show HN** (15:00–17:00 ora României) | motorul determinist | Hungaroring |
| Mar 20 | r/WebGames | jocul în sine | Monza, ploaie |
| Mie 21 | r/simracing | „pentru zilele fără rig” | Silverstone |
| Joi 22 | r/F1Technical, doar dacă regulile permit | modelul fizic | Imola |
| Sâm 24 | r/formula1, doar dacă regulile permit, sau r/IndieGaming | proiect de fan, ziua cu Austin | Austin |
| Lun 26 | r/SideProject | povestea construcției | Barcelona, low downforce |

Dacă un subreddit vă respinge din cauza vechimii contului, îl mutați după 8
noiembrie. Nu postați același text în mai multe locuri în aceeași zi.

**Ce sărim:** reclame plătite (fără buget, și ar aduce jucători plătiți, nu organici), X, Facebook, LinkedIn și video lung pe YouTube, până la revizie.

---

## 5. Activare: de la prima vizită la primul tur

Ce există [V]:
- Primul tur se poate porni imediat.
- Paginile jocurilor au propriul text.
- Cine vine dintr-o provocare e trimis la Daily Quali.

De verificat în Plausible după lansarea din 15 oct:

| Etapa | Cum se măsoară |
|---|---|
| Vizită → joc început | Vizitatori unici cu `Game started` ÷ vizitatori, pe sursă |
| Joc început → terminat | `Game finished` ÷ `Game started`, pe joc |
| Provocare deschisă → condusă | `Challenge raced` ÷ `Challenge opened` |

**Regulă:** dacă mai puțin de jumătate dintre vizitatorii veniți din Reddit
pornesc un joc [I: pragul se fixează după primele date], prima pagină pierde
oameni. Atunci lucrăm la pagină, nu la mai mult trafic.

Clipurile trimit oamenii direct la ce au văzut. Exemple:
`lapdle.com/braking-point?ref=tiktok`, `lapdle.com/aerial?ref=tiktok`,
`lapdle.com/?play=practice&track=spa&cond=wet&ref=tiktok`.

---

## 6. Retenție: de ce revin a doua zi

În joc există deja [V]: seria de zile, contorul „Today x/5”, numărătoarea
până mâine, aplicația instalabilă, arhiva și semnalarea weekendurilor de cursă.

Ce adăugăm:
1. **Story zilnic pe Instagram:** „Today: Spa, wet. Perfect lap 1:xx.xxx.” cu link. E singurul canal de reamintire până acum.
2. **Grila ta, zilnic:** în Story și, de 2–3 ori pe săptămână, în grupuri.
3. **Weekendurile de cursă:** Austin și Interlagos sunt momentele în care fanii au deja un motiv să revină.
4. **Decizie (§12):** reamintire în aplicație (notificare web pentru aplicația instalată sau un câmp de e-mail), înainte de pauza competițională din decembrie–martie.

**Măsura:** revenirea a doua zi = `Visit` cu `last_played=yesterday` ÷ jucătorii care au terminat un joc zilnic cu o zi înainte. Arată tendința, nu o cifră exactă.

---

## 7. Recomandări: bucla de distribuire

Există și se măsoară [V]: grila colorată, link-ul „Race my best lap” în
rezultatul Quali, etichete pe fiecare link distribuit.

- **Măsuri:** `Share` ÷ `Game finished` (zilnic); vizite din `share-*` și `challenge`.
- **Testul pentru noiembrie** [I]: diferența până la pole în textul distribuit („Silver · +0.84 s to pole”). Schimbare mică de cod, după prima săptămână cu date.
- **Grilele jucătorilor ca sursă de conținut:** din a doua săptămână după lansare, o postare duminicală cu cele mai bune grile primite, cu permisiunea autorilor (ideea 10 a lui Rares).

---

## 8. Venit

Nu e prioritatea în primele 30 de zile. AdSense e în aprobare. Când e aprobat,
se setează cele trei slot-uri în Cloudflare (`docs/ADS.md`). Fără experimente de
monetizare până nu știm dacă oamenii revin (regula din `ROADMAP.md`).

---

## 9. Calendarul (10 oct – 8 nov)

**Volum realist:** cam 1 oră pe zi în medie, plus 2 ore în zilele cu postare pe Reddit. **Responsabili:** Mihai și Rares (egal; împărțiți sarcinile la începutul fiecărei săptămâni), Claude (cod, analiză, revizii).

### Săptămâna 0: pregătire (sâm 10 – mie 14 oct)

| Ce | Cine |
|---|---|
| TikTok: trecerea la Business, verificat dacă apare câmpul Website | Mihai sau Rares |
| Instagram: Settings → Account status (dacă poate fi recomandat), apoi următoarele Reels ca **Trial reels** | Mihai sau Rares |
| În Plausible: goals-urile care lipsesc (`Game finished`, `Daily set done`, `Share`, `Challenge opened`, `Challenge raced`, `Challenge beaten`) și proprietățile din `docs/ANALYTICS.md` | Mihai sau Rares |
| Search Console (domeniul e deja verificat): trimis sitemap-ul, cerere de indexare pentru `/`, `/mystery`, `/braking-point`, `/aerial`; apoi Bing (import din Search Console) | Mihai sau Rares |
| Cont de Reddit (azi) + 3–5 comentarii utile pe zi, fără link | Mihai sau Rares |
| Duminică: înregistrarea a 5 clipuri pentru săptămâna de lansare | Mihai sau Rares |
| Un GIF de 5–10 s cu un tur și culorile virajelor, pentru Reddit | Claude, înregistrat din joc |
| Drafturile Reddit și Show HN finalizate cu cuvintele tale | Mihai și Rares, Claude revizuiește |
| Logo ales: icon, avatar și banner generate din el | Voi alegeți, Claude generează |
| **Mie 14: revizia 1** (cifrele din §10, ca punct de pornire) | Voi + Claude |

Clipuri: sâm 10 Austin („Name this circuit from above”), lun 12 Silverstone low downforce, mar 13 Monza („Where would you brake?”).

### Săptămâna 1: lansarea în comunități (joi 15 – mie 21 oct)

- Show HN joi 15; Reddit din marți 20 (tabelul din §4).
- 5 clipuri. Pe 16 (Spa, ploaie): „It rained at Spa. The line moved.”
- Story zilnic, grila ta zilnic.
- **Mie 21: revizia 2.** Care subreddit a adus jucători care au terminat jocuri?

### Săptămâna 2: Austin (joi 22 – mie 28 oct)

- **Vin 23:** clipul „Saturday's circuit is Austin. Practise it now”, cu link `/circuits/austin`.
- **Sâm 24:** clipul cu turul perfect de la Austin și „today's Daily Quali”; Story cu numărătoare până la calificări; postarea pe r/IndieGaming sau r/SideProject.
- 10–15 mesaje personale către creatori mici de sim racing (5–50k urmăritori), fiecare cu link `?ref=<creator>`.
- 6–12 listări în directoare.
- **Mie 28: revizia 3.** A fost sâmbăta cu Austin mai bună decât o zi obișnuită?

### Săptămâna 3: dublăm ce merge (joi 29 oct – mie 4 nov)

- Rămân doar cele 2–3 formate de clip cu cele mai bune rezultate (regula din §10).
- Testul cu diferența până la pole în textul distribuit (Claude, cod).
- **Decizia despre reamintire (§12)**, ca să fie gata înainte de decembrie.

### Săptămâna 4: Interlagos și revizia mare (joi 5 – dum 8 nov)

- **Vin 6:** anunțul „Interlagos this Saturday”.
- **Sâm 7:** turul perfect de la Interlagos; Daily Quali e Interlagos.
- **Dum 8: revizia de 30 de zile** (§10). Hotărâm planul pentru noiembrie–ianuarie: pauza competițională, Perfect Season, „best of 2026”, eventual un test plătit mic.

**Formatele de clip** (detaliate în planul lui Rares, ideile 1–8, cu corecturile din §3):

| Format | Exemplu |
|---|---|
| Where would you brake? | Braking point, o oprire celebră |
| Early vs late apex | Același viraj, trei linii |
| Perfect lap vs real pole | Suzuka: 1:26.089 față de 1:26.983 [V] |
| Worst lap vs best lap | Turul greșit și turul bun, unul lângă altul |
| Pit stop challenge | „Recordul e 1,80 s. Încearcă.” |
| Name the circuit | Mystery sau Aerial view, cu circuitul de ieri, nu cu cel de azi |
| Beat pole | Doar sâmbătă la Austin și Interlagos |
| Rain changes the line | Doar în zilele cu ploaie |

Fiecare clip: circuitul vizibil din prima secundă, prima frază e o întrebare
sau o provocare, 15–30 de secunde, card final „lapdle.com”.

---

## 10. Măsurare și reguli de decizie

**Măsura principală:** jucători pe zi (vizitatori unici cu `Game started`).

| Indicator | Definiție | Sursă |
|---|---|---|
| Jucători pe zi | Vizitatori unici cu `Game started` | Plausible |
| Revenire a doua zi | Vezi §6 | Plausible |
| Rata de distribuire | `Share` ÷ `Game finished` (zilnic) | Plausible |
| Jucători pe sursă | `Game started` filtrat după sursă / `utm` | Plausible |
| Provocări | `Challenge opened` → `raced` → `beaten` | Plausible |
| Clipuri | Cât din clip e urmărit în medie; distribuiri și salvări; vizite pe profil | Statisticile fiecărei aplicații |
| Indexare | Pagini indexate din ~60 | Search Console |

**Ținte:** se fixează la revizia din 14 oct, pornind de la ce arată
Plausible. Țintele din `LAUNCH_PLAN.md` (300 de jucători pe zi, 30% revenire)
și din planul lui Rares (150 / 20%) sunt aspirații, nu prognoze; păstrăm un
singur set după 14 oct.

**Reguli de decizie:**
- Un format de clip are 6 episoade înainte de a fi judecat. Sub jumătate din media vizualizărilor după 6 episoade: îl oprim.
- O platformă primește ~15 clipuri înainte de a fi judecată.
- Dacă revenirea a doua zi e foarte slabă după 2 săptămâni cu trafic real, oprim efortul pe trafic și reparăm jocul și prima vizită.
- Fiecare subreddit e judecat după jucătorii care au **terminat** un joc, nu după upvote-uri.

**Revizie săptămânală, miercurea, 20 de minute:** cifrele din tabel, cele mai bune 3 și cele mai slabe 3 clipuri, o decizie notată aici.

---

## 11. Ce mai lipsește

Răspunsurile din 10 oct sunt integrate mai sus. Mai rămân:

1. **Plausible:** adăugați goals-urile și proprietățile care lipsesc (Site settings → Goals și Custom properties). Fără ele nu vedem nici revenirea a doua zi, nici distribuirile.
2. **Search Console:** search.google.com/search-console → proprietatea `lapdle.com`. Acolo, **Sitemaps** (trimiteți `https://lapdle.com/sitemap.xml`) și **Pages** (câte pagini sunt indexate).
3. **Instagram:** de ce au clipurile 0 vizualizări. Verificați Account status → „Recommendations” (dacă vreo postare a fost restricționată) și că sunt Reels, nu postări simple.
4. **Timpul pe săptămână:** stabilit la revizia din 14 oct, după prima săptămână de lucru efectiv.

## 12. Decizii deschise

| Decizia | Opțiuni | Până când |
|---|---|---|
| Canal de reamintire | Notificări web (doar aplicația instalată; pe iPhone doar din ecranul principal) / un câmp de e-mail / nimic | 4 nov |
| X (Twitter) | Cont nou acum / după revizie | 8 nov |
| Circuite noi | Mexic, Las Vegas, Qatar, Abu Dhabi ar da conținut pentru weekendurile rămase; costă timp de dezvoltare | 8 nov |
| Pauza competițională (dec–mar) | Perfect Season ca provocare, „best of 2026”, sondaj pentru circuitul următor | 8 nov |
| Țintele | Un singur set, din date | 14 oct |
| Aplicație în magazine | **Play Store:** aplicația web publicată ca aplicație Android (TWA), fără rescriere; taxă unică de cont de dezvoltator și un test închis cu testeri înainte de publicare. **App Store:** cont Apple Developer cu taxă anuală, iar Apple respinge des aplicațiile care sunt doar un site împachetat, deci ar cere funcții native în plus (de exemplu notificări). Regulile ambelor magazine sunt de verificat la zi. Semnale: „is it on playstore?” pe TikTok și „they need to make it an app in the app store” pe YouTube (oct) | 8 nov |

---

## 13. Skill-uri și unelte, pe etape

| Etapa | Skill-uri | Unelte |
|---|---|---|
| Achiziție | social, community-marketing, launch, directory-submissions, video | Reddit, CapCut, Search Console |
| Activare | onboarding, cro | Plausible (`Game started`/`finished`) |
| Retenție | churn-prevention, emails (dacă alegem e-mail) | Story Instagram, notificări web |
| Recomandări | referrals | Etichetele `share-*` și `challenge` |
| Venit | ads (doar după retenție) | AdSense |
| Măsurare | analytics | Plausible, statisticile aplicațiilor |
