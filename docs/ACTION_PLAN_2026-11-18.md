# Lapdle: plan de produs și creștere

18 noiembrie 2026. Plan pentru discuție; estimările de efort sunt orientative, iar pragurile de succes se ajustează după măsurarea inițială.

## Stadiul implementării

Prototipurile funcționale pentru Perfect Season simplificat, The Fast Detective și Racing Context sunt în cod. Racing Connections folosește mecanica și progresul vechiului Line-up. Paginile publice și evenimentele Plausible sunt pregătite. Butonul de susținere apare în footer, About și după rezultate numai când proprietarul configurează `VITE_SUPPORT_URL` cu un link HTTPS de checkout. Urmează testarea cu jucători reali, verificarea conversiilor și activarea linkului de plată; nu presupunem că pragurile de acceptare sunt deja atinse.

## Ce arată cercetarea

- [38-0.app](https://38-0.app/story) spune că a pornit ca un joc pentru prieteni, distribuit întâi în WhatsApp, apoi preluat de fani, creatori și cluburi. Pagina sa raporta **5,4 milioane de vizitatori unici și 10,9 milioane de sezoane simulate la 18 iulie 2026**; sunt cifrele autorului, nu trafic verificat independent. Jocul inițial avea o promisiune explicabilă într-o frază: construiești un XI și încerci să câștigi toate cele 38 de meciuri. Challenge-ul comun și multiplayerul au venit după lansare. [Adam Kamal descrie](https://www.linkedin.com/posts/adam-kamal_38-0-build-the-ultimate-english-top-flight-activity-7470757854803652608-iAJw) discuțiile, rezultatele partajate și feedbackul comunității ca parte importantă a creșterii. Nu am găsit un „growth hack” verificat sau o rețetă de promovare publicată de el.
- **38-0-0** este alt produs, cu alt creator. Articolele despre lansarea lui cu AI și Virlo nu descriu 38-0.app și nu trebuie folosite ca dovadă pentru acesta.
- [Contextinho](https://playfootball.games/contextinho/) are ghiciri nelimitate și întoarce rangul de similaritate al fiecărui fotbalist față de răspunsul secret. [Football Connections](https://playfootball.games/football-connections/) cere patru grupuri de câte patru, cu un puzzle comun zilnic.
- Raportul intern [Daily web game growth playbook](../reports/Daily%20web%20game%20growth%20playbook.md) a găsit aproximativ 10–20 de jucători Daily Quali pe zi la momentul analizei, coborâți de la circa 45–63. Acestea sunt cifre istorice, nu baseline-ul de azi. Diagnosticul său: distribuția și share-ul sunt blocajul principal; noi funcții singure nu aduc public.

## Decizia de produs

Lapdle trebuie să aibă **o provocare principală, înțeleasă în câteva secunde**, plus jocuri scurte care aduc utilizatorul înapoi. Daily Quali rămâne jocul distinctiv și profund. Noul Perfect Season trebuie să fie poarta de intrare simplă, cu miză imediată și rezultat ușor de povestit. Nu punem patru jocuri noi simultan în setul zilnic: fiecare lansare trebuie să arate că oamenii o termină, revin și o trimit mai departe.

## Ordinea de lucru

| Etapă | Ce livrăm | Criteriu de acceptare |
| --- | --- | --- |
| 0. Măsurare, 2–3 zile | Citim Plausible pentru start → finish, revenire, share și surse pe fiecare joc; 5–8 persoane care nu cunosc Lapdle joacă pe telefon, fără explicații. Notăm unde se opresc. | Avem baseline și știm ce joc merită locul principal. |
| 1. Donații, 1–2 zile după configurarea contului | „Support Lapdle” discret în footer și pe pagina About, plus un mesaj după jocul terminat, fără întreruperea jocului. Plată unică, sumă aleasă, checkout găzduit, fără stocarea cardurilor în Lapdle. Eveniment pentru clic; ecranul de mulțumire nu promite recompense competitive. | Link funcțional pe mobil; sumă mică testată; identitatea publică a contului verificată de proprietar. |
| 2. Perfect Season simplificat, prototip 4–7 zile | Un „12–0” care se termină în aproximativ 2–3 minute: 12 circuite, **o alegere clară pe etapă** (de exemplu, unul dintre trei setupuri potrivite condițiilor), simulare și verdict imediat. Miza este câte etape câștigi. Ecranul arată de ce setupul a mers sau nu. Sezonul actual cu până la 36 de ture manuale rămâne disponibil pentru cine vrea profunzime. | Primul rezultat în sub 3 minute în playtest; minimum 70% dintre cei care încep termină sezonul în testul mic; 5 din 8 pot explica jocul după prima etapă. |
| 3. The Fast Detective, 3–5 zile | O situație pe zi, **cinci etape cu câte un indiciu** despre viteză, grip, vreme, viraj și traiectorie. După al cincilea indiciu, jucătorul decide dacă mașina poate lua virajul. Primește puncte pentru verdict și bonus dacă estimează cât de aproape este mașina de limita virajului (de exemplu, viteza la apex sau abaterea față de viteza maximă sigură). Reveal scurt, calculat de motorul existent din Make the corner. | Verdictul este determinist și corect; jocul durează 30–60 secunde; scorul de share nu dezvăluie răspunsul. |
| 4. Racing Connections, 1–3 zile | Relansăm **Line-up** sub un nume și o prezentare mai clare; mecanica 4×4, datele F1DB, unică soluție și „one away” există deja. Îmbunătățim explicația, lizibilitatea pe telefon și categoriile care sunt prea obscure. Păstrăm URL-ul vechi prin redirect. | Test cu jucători noi: regulile sunt înțelese fără tutorial lung; nu există puzzle ambiguu în generator. |
| 5. Contextinho de motorsport, 5–10 zile după validarea datelor | Răspuns secret zilnic dintr-un set suficient de mare de piloți sau combinații pilot-sezon; autocomplete, ghiciri nelimitate, rang de similitudine și câteva atribute explicabile după fiecare ghicire. Testăm algoritmul pe răspunsuri cunoscute și verificăm licența datelor. | Rangurile sunt intuitiv utile, nu doar matematic apropiate; cel puțin câteva sute de răspunsuri eligibile; rata de rezolvare și durata sunt măsurate. |
| 6. Distribuție, în fiecare săptămână | Clipuri scurte cu o decizie reală și reveal, rezultat text fără spoiler pentru WhatsApp/Discord, provocări „beat my score”, 10–15 creatori mici de F1/sim-racing abordați personal, postări doar unde regulile comunității permit. | Creștere măsurată a vizitelor din share și a jucătorilor care termină, nu doar views. |

## Donații: alegerea practică

Recomand [Stripe Payment Links](https://stripe.com/payments/payment-links) pentru o pagină „choose your amount” cu checkout găzduit. Este inclus în tarifele standard de procesare, fără server nou pentru Lapdle; tariful exact depinde de țara contului și metodele de plată. [Stripe explică pașii pentru donații](https://support.stripe.com/questions/how-to-accept-donations-through-stripe?locale=en-US). Alternativa rapidă este [Ko-fi](https://help.ko-fi.com/hc/en-us/articles/360013140633-Supporter-payments-FAQ), cu pagină gratuită pentru tips și comisioanele normale PayPal/Stripe. Ko-fi avertizează că [datele afișate pot depinde de contul de plată](https://help.ko-fi.com/hc/en-us/articles/115004001294-What-personal-information-is-shared-on-Ko-fi-as-a-creator). Verificăm numele afișat, descriptorul extrasului și pagina finală înainte de lansare. Donația rămâne voluntară; nu schimbă scoruri, clasamente sau accesul la jocurile principale.

## Feedbackul de produs pe care îl păstrăm în plan

1. **Intrarea este încă grea.** [GAME_PLAN.md](GAME_PLAN.md) a identificat prea multe acțiuni pentru prima tură și lipsa unei lecții foarte scurte. Preseturile de linie și medaliile au fost deja adăugate, dar trebuie testat timpul real până la primul rezultat pe un telefon nou.
2. **Recompensa trebuie să apară repede.** Perfect Season actual cere 12 circuite × maximum 3 ture, deci până la 36 de ture. Noul loop comprimă decizia și verdictul fără să elimine modul complex.
3. **Feedbackul după o greșeală trebuie să fie concret.** Arătăm „de ce a ieșit în decor” sau „de ce setupul a pierdut”, nu numai roșu/verde și un scor.
4. **Performanța pe telefon este o cerință de lansare.** Pentru modurile noi: încărcare progresivă, 3D doar la reveal unde aduce valoare, măsurare pe telefonul conectat; dacă apare lag, reparăm înainte de promovare.
5. **Distribuția trebuie să fie repetabilă.** Share-ul trebuie să funcționeze în text, fără spoiler, cu link direct la jocul relevant. Niciun număr de vizualizări nu înlocuiește jucătorii care termină și revin.

## Gate-uri de decizie

- După 7 zile de Perfect Season simplu: comparăm finish/start, durata, share/finish și revenirea cu versiunea veche. Dacă noul loop nu ajută, iterăm înainte de alte moduri.
- După 7 zile de The Fast Detective: dacă oamenii nu înțeleg cum se decide verdictul, schimbăm indiciile și reveal-ul înainte de a-l pune în setul principal.
- Contextinho este ultima etapă deoarece are cea mai mare dependență de date, calibrare și verificare a licenței. Nu îl accelerăm doar ca să mărim numărul de jocuri.
