# Perfect Season: traducerea mecanicilor 38-0 în F1

Observații făcute la 18 noiembrie 2026 pe [jocul 38-0](https://38-0.app/game?new=true), [descrierea draftului](https://38-0.app/football-draft-game), [simulator](https://38-0.app/season-simulator) și [pagina principală](https://38-0.app/). Am parcurs configurarea, un spin și lista de jucători în browser. Pentru rezultatul complet și modurile multiplayer mă bazez pe descrierile publice; nu pretind că am jucat un sezon complet acolo. **Statusul de mai jos se referă numai la branchul local Lapdle**, care nu este publicat.

| Observat în 38-0 | Traducere pentru Perfect Season | Status local |
| --- | --- | --- |
| Formations, alese înainte de draft și apoi blocate | Filosofia mașinii: Balanced, Low drag sau High grip, cu avantaje diferite pe circuite | Implementat ca alegere inițială și efect asupra timpului |
| Easy / Normal / Hard: 3 / 1 / 0 rerolluri; Hard ascunde ratingurile | Aceleași niveluri de risc pentru a construi un garaj bun | Implementat |
| Ratings vizibile sau ascunse | Ratingurile pieselor și piloților pot fi ascunse pentru un draft „blind” | Implementat |
| Squad First / Position First | Constructor–sezon înainte de rol sau rol înainte de constructor–sezon | Implementat |
| Season / Prime pentru ratingul jucătorului | Pilotul este evaluat în sezonul tras la sorți sau la cel mai bun rating din cariera inclusă în date | Implementat pentru piloți; modulele mașinii rămân legate de sezonul tras |
| Era: all-time, 2000s+, 2010s+, modern și interval de ani | Aceleași preseturi și două slidere pentru sezoanele 1992–2025 | Implementat |
| Spin pe un club și sezon real, apoi alegi un jucător din lot | Spin pe un constructor și sezon real; alegi un pilot ori un capitol de performanță | Implementat cu 376 constructor–sezoane din F1DB |
| XI de 11 roluri într-o formație | Garaj de șapte roluri: doi piloți, șasiu, unitate de putere, calificări, ritm de cursă, fiabilitate | Implementat. Ratingurile sunt estimări Lapdle din clasări, victorii, pole-uri și tururi; nu sunt ratinguri oficiale sau măsurători directe ale pieselor |
| Sortare după rating, poziție sau nume; reroll după spin | Sortezi după rating, rol sau nume; poți folosi rerollurile rămase | Implementat |
| Simulează 38 de meciuri; rezultat, puncte și ținta 38-0 | Simulează 12 curse pe circuitele Lapdle; W/L, timp, puncte, clasament de zece constructori și ținta 12-0 | Implementat local, cu modelul de tur Lapdle ca bază și cu ratingul draftului aplicat explicit; cele nouă echipe adverse sunt fictive și determinate de seed |
| January Transfer Window, eveniment la mijlocul sezonului | Upgrade opțional după șase curse: power unit, aero sau fiabilitate | Implementat; alegerea îmbunătățește jumătatea a doua |
| Managers/Gaffers pentru poveste | Pit wall sau team principal care schimbă strategia și povestea sezonului | De proiectat: F1DB nu oferă un registru consistent al managerilor, deci nu inventăm nume și ratinguri istorice |
| European Nights după clasarea sus | O provocare postsezon pe alte circuite sau un „Champions Tour” | De proiectat după ce sezonul principal este validat |
| One-Club XI, International Tournaments, alte moduri secundare | One Constructor Team, campionate istorice pe ere, provocări de circuit | Provocarea One Constructor este implementată ca filtru de draft; celelalte moduri secundare rămân de proiectat |
| Multiplayer live, leaderboard, sign-in și favorite | Draft live cu un prieten, clasament 12-0, cont opțional și echipe salvate | Necesită flux online, reguli de moderare și validare server; nu intră în prototipul local |
| Share al rezultatului și invitația de a-l depăși | Share text cu W/L, grilă de 12 rezultate și cei doi piloți | Implementat. Același seed pentru un challenge verificabil rămâne de adăugat |

## Limite înainte de publicare

1. Ratingurile trebuie calibrate în playtest: cât de des se obțin 12–0, cât contează fiecare rol și dacă alegerile sunt explicabile. Simularea cu rating maxim a arătat 12–0 pentru 10 seeduri testate, dar asta nu măsoară dificultatea draftului real.
2. Campionatul are zece constructori și punctaj de cursă, dar cele nouă echipe adverse sunt fictive, nu o reproducere a unui sezon istoric. Timpii lor sunt calculați din același timp de bază, ratinguri fixe și variație deterministă.
3. Datele istorice vin din [F1DB v2026.17.0](https://github.com/f1db/f1db), CC BY 4.0. Calificări, race pace și fiabilitate sunt interpretări ale rezultatelor constructorului din sezon, nu fișe tehnice ale pieselor.
4. Fluxurile sociale online cer backend și testarea abuzului; pot fi construite separat după feedbackul asupra draftului local.

## Racing Context: indicii vizuale, brainstorming

Am jucat [Contextinho](https://playfootball.games/en-us/contextinho/) în browser: după o ghicire apare rangul, iar bara colorată are lungime mai mare când ești mai aproape. Verde indică foarte aproape, portocaliu o zonă intermediară, roz o ghicire depărtată. Lapdle are acum o bară de proximitate verde/galben/portocaliu/roșu și ordonează ghicirile după rang.

| Idee vizuală | Ce arată | Efort / risc |
| --- | --- | --- |
| **Career fingerprint** (prototip implementat local) | Un SVG mic dezvăluie perioada activă după 4 ghiciri, numărul de echipe după 8 și starts/wins/titles după 12 | Toți cei 352 de piloți au datele necesare; foarte ușor pe telefon și fără fișiere media externe. Se poate rafina după feedback. |
| Portret în trepte | Fotografia pilotului începe acoperită și se limpezește după ghiciri | Foarte intuitiv, dar trebuie selectată și verificată individual licența fiecărei fotografii, cu atribuirea autorului și o soluție pentru piloții fără imagine. [Wikimedia Commons explică cerințele de reutilizare](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia/licenses). |
| Clip scurt de carieră | Un montaj cu indicii despre era, țări și circuite | Bun pentru marketing și reveal, dar video în joc adaugă greutate și poate divulga răspunsul. Filmările oficiale de cursă cer drepturi; o animație proprie din date ar fi varianta sigură. |

Prima idee poate fi încercată deja în previewul local. Un portret verificat poate fi adăugat la ecranul de rezultat pentru o selecție limitată de piloți, apoi extins numai când avem acoperire și licențe clare. Video-ul se potrivește mai bine la share decât la fiecare ghicire.
