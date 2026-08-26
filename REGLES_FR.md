# RÉFÉRENTIEL DES RÈGLES DU FRANÇAIS — et où en est OMEGA (2026-08-11)

Demande de Rem : *« établir une liste de règles complète de grammaire / orthographe / conjugaison
française, croiser avec LanguageTool pour vérification, et voir ce qui nous manque réellement »*.

**Méthode.** ① Taxonomie des phénomènes (structure classique + les 17 catégories publiques de
LanguageTool FR). ② État OMEGA établi en TESTANT le moteur, pas en lisant le code — chaque « ABSENT »
ci-dessous a été vérifié par une phrase déclenchante restée muette. ③ Croisement LT en lecture de
**phénomènes seulement** : LanguageTool est LGPL, on ne lit jamais son XML (doctrine du dépôt).

**Référence LT** : 6 854 règles FR, 17 catégories. ⚠️ Ce chiffre ne se compare pas au nôtre :
la masse LT est faite de paires lexicales une-par-règle (confusions, calques, tours critiqués) et de
style. Notre unité est le PHÉNOMÈNE ; LT tolère les faux positifs, nous non — notre rappel
supplémentaire vit donc dans l'orange, jamais dans un rouge douteux.

Légende : 🔴 corrigé d'office (FP=0 mesuré) · 🟠 proposé (vigilance) · 🟢 couche verte (pédagogie,
jamais imposé) · 🟡 PARTIEL (limite mesurée notée) · ❌ ABSENT (vérifié au moteur) · ⛔ HORS
PÉRIMÈTRE (choix assumé, motivé).

---

## 0-bis. BALAYAGE DU 26/08/2026 — ce qui reste, mesuré DANS LE NAVIGATEUR

> Demande de Rem : *« fais des tests conséquents voir si encore des manquants »*.

**Méthode, et le piège qu'elle évite.** Un premier balayage a été lancé sur la référence Python
(`correcteur_probe.py`) : il rendait 42 « muets » sur 84 fautes. **Chiffre FAUX** — la référence
Python ne porte que la GRAMMAIRE ; le speller (orthographe, graphèmes, accents), l'élision et la
typographie vivent ailleurs. C'est exactement le piège du *moteur à moitié chargé*. Tout ce qui suit
est donc mesuré dans **l'app réelle pilotée par Chrome**, et les défauts ont été **reconfirmés sur
omegapendu.com** pour être sûr qu'ils ne venaient pas du travail en cours.

### ✅ Ce qui répond bien (échantillon de 20 fautes d'orthographe/graphème)
`fenetre→fenêtre` · `ellle→elle` · `fote→faute` · `dehor→dehors` · `chapo→chapeau` ·
`monagne→montagne` · `jmaais→jamais` · `batiment→bâtiment` · `beacoup→beaucoup` ·
`patiance→patience` · `pome→pomme` · `apeler→appeler` · `manje→mangé` · `trés→très` ·
`echarpe→écharpe` · `preferé→préféré` · `lhopital→l'hôpital` · `dargent→d'argent` · `c est→c'est`

### ⛔ CORRECTIONS FAUSSES (pire qu'un manque : le correcteur affirme une erreur)
| écrit | proposé | attendu | note |
|---|---|---|---|
| `afreuses` | **affreux** | affreuses | perd le féminin pluriel |
| `sertin` | **serein** | certain | mauvais candidat phonétique |
| `tar` | **tarte** | tard | mot inconnu → candidat plus long, pas la lettre muette |
| `La foret est sombre` | **La → Le** | foret → forêt | *foret* (outil) est masculin : le moteur corrige le DÉTERMINANT au lieu du nom accentué |

### ❌ MUETS confirmés (rien ne se déclenche)
| famille | phrase | attendu |
|---|---|---|
| homophone | `Ce chien **et** tres gentil.` | est |
| homophone | `Il **son** partis tot.` | sont |
| homophone | `Il **ces** trompe de chemin.` | s'est |
| homophone | `Il y a **peut** de monde.` | peu |
| homophone | `**Mais** amis sont venus.` | Mes |
| accord | `**Marie** est venu ce matin.` | venue — ⚠️ l'accord par PRÉNOM est livré, il ne tire pas ici |
| segmentation | `**Ducou** je suis parti.` | du coup |
| accent | `Le **the** est **brulant**.` | thé / brûlant |
| conjugaison | `Nous **somme** partis.` | sommes |

⚠️ Les homophones muets ci-dessus (`et/est`, `son/sont`, `ces/s'est`, `peut/peu`, `mais/mes`) ont
tous une règle au registre : elles ne se déclenchent pas **dans ces contextes-là**. C'est un travail
de gardes, pas de règles manquantes — à instruire cas par cas avant de toucher quoi que ce soit.

### 🔧 Suite du balayage — instruits le 26/08/2026

**✅ `et/est` avec SUJET NOMINAL — livré.** « Ce chien et gentil. » était muet : la règle exigeait un
sujet PRONOM (garde motivée, « le roi, et … » → FP). Élargie au seul cas sans doute : déterminant +
nom avant, adjectif après. **Quatre gardes, chacune née d'un FP mesuré sur UD 2500** — préposition
contractée après « et » (« et **aux** Contes ») · attribut suivi d'un déterminant (« et bien sûr **la**
Vierge » = énumération) · **un verbe conjugué déjà dans la proposition** (« …**sont** le norrois **et**
l'anglais », la garde décisive) · graphie désaccentuée étiquetée PROPN par le tagger (« frere »).
Après gardes : **0 tir sur UD 2500**, FP à l'échelle **1,40 %** (ligne de base exacte), census dys
**301/301** inchangé. ⚠️ Rappel ajouté sur le corpus dys réel : **0** — le témoin attrapait déjà ses
6 cas, tous à sujet pronom. Gardé quand même : coût nul, et la fréquence corpus priorise un
chantier, elle ne refuse pas un sens de règle.

**⛔ `tar`→tarte, `nor`→non, `bor`→bore — TENTÉ ET RETIRÉ, mesuré.** Cause identifiée : la route sûre
du speller exige `length>=4`, donc les mots de TROIS lettres tombent au repli orange ; et la
préférence homophone du repli ne les rattrape pas parce que **le g2p prononce la consonne finale**
(`phonKey('nord') ≠ phonKey('nor')`). Correctif tenté dans le repli (préférence de rang + génération
« saisie + une consonne muette ») : il réparait `nor→nord` mais **le census a répondu −3** — 4 oranges
JUSTES perdues pour 1 gagnée, et c'étaient des ACCENTS sur du vrai texte dys (`endemique→endémique`,
`lègislature→législature`, `prêcession→précession`, `emé→aimé`). La préférence « finale muette »
passait devant l'audibilité. **Retiré.** Le vrai correctif est dans le g2p — chantier gelé.

### 🔁 `son/sont` devant ADJECTIF PLURIEL (26/08/2026)

`Les chiens son gentils`, `Les enfants son contents`, `Mes amis son malades` étaient MUETS : la règle
excluait les adjectifs, **et c'était mesuré** (« son ancienne équipe », « son style, » = possessif +
nom homographe d'adjectif).

⛔ **1re tentative INSUFFISANTE — le tagger.** Exiger `tg[i+1] == 'ADJ'` marchait pour `gentils` et
`chers` mais PAS pour `contents` ni `malades`, étiquetés NOUN. Raison instructive : **le contexte du
tagger est empoisonné par la faute elle-même** — il voit « son », en déduit un déterminant, donc lit
un nom derrière.

✅ **Ce qui a marché — un FAIT STRUCTUREL que la faute ne peut pas corrompre** : le possessif « son »
est TOUJOURS suivi d'un nom SINGULIER. Un mot marqué pluriel derrière lui exclut le possessif —
sauf si son -s/-x n'est pas une marque de pluriel (`son fils`, `son corps`, `son prix`), d'où la
liste des INVARIABLES, celle-là même ajoutée le matin pour le bug de `prix`.

13/13 · **excédent INCHANGÉ à 36 flags** sur les 2 500 phrases correctes (zéro ajouté) · FP à
l'échelle 1,40 % · parité 3 moteurs. Explication : `son/sont` fait partie des noms routés vers la
famille homophone, la carte donne donc le test de substitution (« essaie "mon" à la place »).

### 🔤 `sait`→`s'est`, et LE BUG DES EXPLICATIONS (26/08/2026)

**Règle livrée.** `rule_sais` portait en commentaire : « il/on + sait reste AMBIGU (sait vs s'est) →
non couvert ici ». Vrai en général — **mais pas devant un PARTICIPE** : *savoir* ne prend jamais un
participe passé pour complément. `Le train sait arrêté`, `il sait levé`, `elle sait trompée` ne
peuvent être que « s'est » ; `il sait nager` (infinitif) et `il sait la réponse` (nom) restent du
savoir. 11/11, FP à l'échelle 1,40 % (ligne de base).
⛔ Première garde REFUSÉE : `VERB_LEX` pour écarter les infinitifs — elle bloquait TOUT, cette table
contient aussi `nager` et `compter`. Le bon test est `_is_infinitive`.
⛔ RÉGRESSION QUE J'AVAIS CRÉÉE, corrigée ici : `savoir` était dans mes semi-auxiliaires, donc
`Le train sait arrete` recevait « sait **arrêter** » — une proposition FAUSSE sur une vraie faute.
Retiré : « je sais nager » n'a jamais eu besoin de la règle, l'infinitif y est déjà correct.

**⭐⭐ LE BUG DE FOND — LES HEURISTIQUES DE FORME PASSAIENT AVANT LE NOM DE LA RÈGLE.**
Trouvé DEUX FOIS le même jour, dans deux familles, parce que Rem a demandé de vérifier les
explications après chaque correctif :

| correction | famille attribuée | ce que la carte enseignait | la vérité |
|---|---|---|---|
| `arrive`→`arrivé` | **accent** (désaccentués identiques) | « e→é, dis-le à voix haute, é ferme è ouvre » | participe après auxiliaire |
| `sait`→`s'est` | **segmentation** (apostrophe dans la suggestion) | « l'article est élidé, il faut l'apostrophe » | homophone grammatical |

Dans les deux cas la correction était JUSTE et l'explication FAUSSE — elle enseignait autre chose que
la faute. Pour un dys, c'est possiblement pire qu'une correction manquée.
⇒ `_corrFam` teste désormais le NOM de la règle AVANT toute heuristique de forme, pour la famille
`participe` et pour les homophones grammaticaux. Nouvelle famille `participe` avec son conseil, et
forme d'épreuve `sait`→« savait » ajoutée à la table de substitution.

### 🩹 Panel Chrome du 26/08/2026 — 3 défauts graves, corrigés

Panel de **37 phrases neuves** dans l'app pilotée par Chrome, sur des familles non balayées.
Bien répondu : `leurs livre`↔`leur affaires` · `ce qu'il **ce** passe`→se · `Je **sait**`→sais ·
`**Ca** voiture`→Sa · `**Ou** est-ce`→où · `**Donne moi**`→Donne-moi · `Les **zamis**`→amis ·
`il fait beau. **demain il** pleuvra.`→Demain/Il · `**Le le** chat`→répétition.

**① PARTICIPE APRÈS « ÊTRE » — corrigé.** `Il a fixe`→fixé marchait ; `Il est arrive`, `Il est
tombe` étaient MUETS. L'exclusion d'ÊTRE était DÉLIBÉRÉE et chiffrée (« après ÊTRE une forme en -e
est presque toujours un ADJECTIF ; ÊTRE apportait l'essentiel des 70 FP »). Rouverte sur une **liste
FERMÉE** de verbes conjugués avec être : aucun des 4 FP historiques n'en fait partie, ils sont exclus
*par construction*. Il fallait aussi lever la garde des noms homographes (`la tombe`, `le reste`,
`la passe` bloquaient 4 cas sur 5) — après « est », un nom NU est impossible. Accord depuis le
pronom sujet : `Elle est arriv**ée**`, `Ils sont tomb**és**`, `Elles sont rest**ées**`.
⛔ Refusés avant : le TAGGER (rend VERB sur `seche` et `celebre` → 2 FP sur 4 passaient) et `ADJ_LEX`
(17 257 entrées, contient `fatigue`, `arrive`, `fixe` : ne discrimine rien).

**② COD ANTÉPOSÉ — c'était une ERREUR DE MESURE, et le vrai défaut était à côté.** Avec l'apostrophe
la règle corrigeait déjà (`que j'ai cueilli`→cueillies). J'avais écrit `j ai`. Mais **sans
apostrophe elle devenait MUETTE** — et c'est exactement ainsi qu'un dys écrit. Elle les tolère
maintenant : `que **j ai** cueilli`→cueillies, `**qu il** a ecrit`→écrite.

**③ ORANGE FAUX `est`→`sont` — une ligne.** `Le prix est fixe par la loi.` (correct) proposait
« Le prix **SONT** fixé ». Dans `_num_at` :
`return 'p' if (NUM_DET.get(F[k-1]) == 'pl' or deacc(F[k]).endswith(('s','x'))) else 's'`
— le `-x` de **prix** écrasait le déterminant `Le`, pourtant sans ambiguïté. La liste des
INVARIABLES existait déjà, elle n'était pas consultée ici. `Les enfants mange`→mangent tire toujours.

**Coût mesuré des trois : ZÉRO.** FP à l'échelle **1,40 %** (35/2500, ligne de base exacte) à chaque
étape · census **301/301** · parité correcteur (app ⊆ Python) · parité dictée 1 309/1 309 ·
**parité OS 3 moteurs 25/25/25**.

**Restent ouverts** : `sait`→s'est (« le train sait arrêté ») · `the`→thé · `Ducou`→du coup ·
`son/sont`, `ces/s'est`, `peut/peu`, `mais/mes` à sujet nominal (même travail que `et/est`) ·
`afreuses`→affreux et `sertin`→serein.

### 🟠 Comblés le même jour (3 trous trouvés par le crible des explications)
| règle | exemple | FP mesurés |
|---|---|---|
| personne du verbe | `je fini`→finis · `tu a`→as · `il faut que tu fini`→**finisses** | 0 / 25 752 formes correctes · 0 / UD 2500 |
| infinitif après semi-auxiliaire | `je vais mange`→manger · `je dois fini`→finir | 0 / 35 556 couples corrects · 0 / UD |
| on/ont après sujet pluriel | `Les enfants on mange`→ont | 0 / UD · 0 / corpus dys |

### 🐞 FP ROUGE réparé (violation du FP=0, présente en production)
`Dans ses statistiques **on** voit bien.` — français correct — devenait « ses statistiques **ONT**
voit bien », **appliqué d'office**. La règle ne demandait qu'un pluriel juste avant « on » sans
vérifier que c'était le SUJET (ici il est dans un groupe prépositionnel). Deux FP jumeaux trouvés
ensuite par la batterie de parité : `les endroits **où** on va coûte cher`, `les auteurs **dont** on
cite les livres` — les relatives `où`/`dont` ouvrent une proposition dont « on » est le sujet.

---

## 1. ORTHOGRAPHE LEXICALE (LT : « Faute de frappe possible »)

| phénomène | état | où / limite |
|---|---|---|
| non-mot → candidat (édit-1, contexte POS/genre/nombre) | 🔴/🟠 | speller ; rouge = routes sûres seulement |
| restauration d'accent (fenetre→fenêtre) | 🔴 | route affirmative historique |
| glissement moteur (jmaais, grannd — 1 candidat + désordre/redoublement) | 🔴 | PR#464, FP=0/14 450 |
| élongation (ellle→elle) | 🔴 | cas issus du corpus dys réel (PR#466) |
| lettre finale muette (dehor→dehors) | 🔴 | préfixe commun + s/x |
| omission interne (afreuses→affreuses) | 🔴 | sous-suite + même initiale + plus proche |
| ligature œ/æ | 🔴 | normalisation partagée, banc dédié |
| mot inconnu → signalement | 🟠 | jamais imposé |
| élision manquante/inversée (c est→c'est, j'mange→je mange) | 🔴 | 2 règles + listes closes unifiées |
| majuscule initiale / nom propre | 🟠 | page correcteur seulement (politique) |
| **trous du lexique** (désarçonnaient, belle-sœur, exclamassent) | 🟡 | mesuré : 22 formes verbales rares / 1 059 « inconnus » sur UD ; **chantier lexique unifié, pas de génération mécanique** (abeillier→abeilliaient réfuté) |

## 2. HOMOPHONES GRAMMATICAUX (LT : « Confusion d'homonymes et paronymes »)

| phénomène | état | note |
|---|---|---|
| a/à · et/est · son/sont · on/ont · ce/se · ça/sa · du/dû · du/de · sur/sûr · la/là · leur/leurs · mais/mes · met/mais · mai/mais · des/dès · peu/peux/peut · sais/sait · c'est/s'est · j'est/j'ai · c'ai/c'est | 🔴 | le cœur du correcteur ; FP=0 à l'échelle, gardé CI |
| ces/ses | 🟠/🟢 | carte enseignante (l'auteur tranche) |
| ou/où | 🟠 LIVRÉ (2026-08-25) | **la famille la plus DENSE du corpus dys : 11 vraies fautes sur 23 occurrences de « ou » (48 %)**, lues une par une. 3 cadres à 0 FP sur 121 phrases UD correctes : ① « ou »+PRONOM SUJET ② nom de LIEU/TEMPS **déterminé** + « ou » + proposition à verbe ③ inversion « ou »+forme verbale+pronom. 7/11 trouvées. ⛔ REFUSÉS chiffrés : « ou »+verbe conjugué (14 FP — homographes nom/verbe : « insolent ou VIOLENT », « le catch ou LUTTE ») · tête de proposition+verbe, LE seul cas de LanguageTool (2 FP pour +1) · le sens inverse « où »→« ou » (trop lâche). 📎 Les 3 contre-exemples de LT (« est ou était », « soudés ou est fixé », « Manger ou être mangé ») ne déclenchent RIEN chez nous : LT vaut mieux comme fournisseur de contre-exemples que de règles |
| quel/quelle (genre) | 🔴 | via accord adjectival |
| homophones lexicaux (vert/verre/vers, sceau/seau/sot) | ⛔→🟢 | indécidable sans sémantique ; couche verte « homophone à vérifier » sur liste |
| près de / prêt de | 🟠 LIVRÉ (2026-08-12) | prêt/prêts sûrs ; prête/prêtes exigent une copule avant (« elle prête de l'argent » = verbe) ; clitique+infinitif exclu par POS |
| davantage / d'avantage(s) | 🟠 LIVRÉ (2026-08-12) | fin de proposition ou devant « que » seulement ; « pas d'avantage » (lecture nominale) exclu |
| quelque soit / quel que soit | 🔴 LIVRÉ (2026-08-12) | accord quel/quelle/quels/quelles par le verbe et le déterminant suivant ; 0 tir/14 450 UD |
| ce qui il / ce qu'il | 🔴+🟠 LIVRÉ (2026-08-12) | « ce qui il »→rouge (jamais correct) ; autres « qui+pronom »→orange ; gardes préposition (« avec qui il »), verbes de savoir (« je sais qui il est »), majuscule |

## 3. ACCORDS (LT : « Grammaire »)

| phénomène | état | note |
|---|---|---|
| sujet-verbe (13 fonctions : noms, pronoms, coordination, relative-objet, incise, postposé, quantifieurs…) | 🔴+🟠 | rouge sur cadres sûrs ; OS-sujet en vigilance sur le résiduel ; sujet postposé SINGULIER réparé (PR#472) |
| déterminant↔nom (nombre, les deux sens) | 🔴 | un seul sens par désaccord (PR#467) ; élidés exclus (PR#473) |
| déterminant↔nom (genre) | 🔴 | table genre désaccentuée (PR#450→453) |
| participe avec être (+ prénoms) | 🔴 | 8 729 prénoms (PR#460) |
| participe avec avoir + COD antéposé (que) | 🔴 | rule_pp_avoir_cod |
| participe épithète · adjectif attribut/épithète | 🔴 | via tagger + _adj_head |
| accord « tout » | 🔴 | règle dédiée (« tout étonnées » correctement laissé) |
| **participes invariables (fait/vu/laissé + infinitif, se sont succédé)** | 🟡 | pas de règle POSITIVE, mais pronominal exclu des accords → silencieux, pas faux |
| vingt/cent (quatre-vingts, deux cents) | 🔴 LIVRÉ (2026-08-12) | nom PLURIEL exigé après (tue dates/ordinaux) ; millésime « mille neuf cent » exclu ; le seul tir UD était une vraie faute (« deux cent salariés ») |
| **adjectifs de couleur composés** | 🟡 | invariables simples couverts (listes) ; composés (« bleu foncé ») non signalés — mais jamais cassés |

## 4. CONJUGAISON

| phénomène | état | note |
|---|---|---|
| -é/-er/-ez/-ai (aux, modaux, « à », clitiques, causatif) | 🔴 | famille la plus travaillée |
| infinitif de but après mouvement | 🔴 | PR#469 |
| impératif (-s euphonique, irréguliers) | 🔴 | |
| usage être/avoir | 🔴 | données complétées 2026-08-12 : familles tombé/parvenu/intervenu/survenu/redevenu + reparties (flood UD=0) ; garde COD « il a tombé la veste » |
| auxiliaire mal orthographié (ête) | 🔴 | |
| futur 1ʳᵉ pers. avec marqueur temporel (je mangerai demain) | 🟡 | exige un marqueur explicite |
| futur/conditionnel -rai/-rais hors marqueur | ⛔ REPORTÉ chiffré (2026-08-12) | 9 « je …-rais » corrects sur UD (conditionnel de politesse) pour 0 occasion au corpus dys → tout signalement hors marqueur inflige de l'orange sans rappel démontré |
| si + conditionnel (si j'aurais) | 🔴 LIVRÉ (2026-08-12) | protase seulement (tête de proposition) ; interrogation indirecte exclue (« je ne sais pas si je serais ») ; 0 tir/14 450 UD, 1 occasion dys confirmée gold |
| **concordance des temps / subjonctif (bien que c'est)** | ❌ vérifié | conjonctions à liste fermée → candidat 🟠 |
| participe présent vs adj. verbal (fatiguant/fatigant) | 🟠 LIVRÉ (2026-08-12) | 11 paires ; position adjectivale (dét/copule/adverbe, ou NOM+fin de proposition) ; gérondif « en le précédant » exclu ; le seul tir UD était une vraie faute (« le plus influant ») |
| conjugaisons rares absentes du lexique (imparfait 3pl : 70 % des -er) | 🟡 | impact réel mesuré faible (22/1 059) ; lexique unifié |

## 5. SYNTAXE (LT : « Grammaire », « Concordances », « Élision »)

| phénomène | état | note |
|---|---|---|
| élision (46 listes fermées) | 🔴 | cécité volontaire = protectrice (mémoire dédiée) |
| mot coupé — cadre aux+préfixe+participe (« il a sur estimé ») | 🔴 LIVRÉ (2026-08-21, span:2) | sur/sous/contre/entre après un auxiliaire, devant un participe : une préposition n'existe pas là → composé coupé quasi certain ; cible trait d'abord (sous-estimé) puis soudure (surestimé). 0 tir/16 950. Cadre DET+préfixe RÉFUTÉ chiffré (« la contre culture » légitime ×3) + garde rOn : « ils ont contre attaqué » ne devient plus « on » |
| frame s'est : priorité sur l'accord (« il sais trompé ») | 🔴 LIVRÉ (2026-08-21) | gardes miroir dans _svFinish/rAccordSV/rFlexionEr : [il/elle/on]+sais/sait+PARTICIPE → les rouges accord/terminaison SE TAISENT, l'orange saisVig parle. Conflit lu à la carto : le moteur écrivait « il sait tromper » (rFlexionEr→cascade). Coût 0 sur correct (1 seul site UD, accord déjà juste) |
| saisVig -u + sujets nominaux ces (« Paul ces blessé ») | 🔴🟠 LIVRÉ (2026-08-21) | liste _SAIS_PPU (perdu/vu/connu… 36 formes) partagée ; rCesSest branche NOMINALE (NOUN/PROPN devant, « été » exclu — être n'est pas pronominal, les 4 tirs du flood étaient « cet été ») ; rEtreInfEr accorde par le GENRE DU NOM sujet (« la voisine s'est marier »→mariée). Floods 16 950 : 0 FP |
| mot coupé — fusion bien/mal (« bien veillante ») | 🔴 LIVRÉ (2026-08-20, span:2) | soudure au lexique + B RARE seul (les légitimes « bien fait », « mal intentionnés », « bien être » ont un B fréquent — 9 FP lus au flood naïf) + soudure ≥ 4× B. 0 tir/16 950. Généralisation à d'autres préfixes = à mesurer |
| sait/s'est devant PARTICIPE (« il sais trompé ») | 🟠 LIVRÉ (2026-08-20, vigilance) | [il/elle/on]+sais/sait+participe réel → « s'est ? » ; l'INFINITIF reste hors-jeu (« elle sait marier les saveurs » légitime) = mur sémantique assumé. Modèle NB réfuté chiffré : 29 « sait » dans UD → il promptait sur « sait nager ». 0 tir/16 950 |
| « ces/cet » après pronom sujet → s'est (« elle ces marier ») | 🔴 LIVRÉ (2026-08-20) | un déterminant ne suit jamais un sujet nu ; s'est proposé devant MATIÈRE VERBALE seulement (participe ou infinitif -er connu) — « elle, ces amis… » hors-jeu. La CASCADE compose : ces→s'est → marier→marié(e) (rEtreInfEr, accord au sujet immédiat elle→ée). 0 tir/16 950. « sais/sait » NON traité (« elle sait marier les saveurs » légitime = mur sémantique assumé) |
| participe épithète féminin-singulier (« une femme cultivé ») | 🔴 LIVRÉ (2026-08-20) | sœur de la plurielle : DET f-sg + NOM f + participe -é/-i (marques MUETTES) ; gardes « fois », coordination dans le GN, ADP généralisée en i-3 (« le sommet SUR la biodiversité organisé ») ; PAS de garde après-virgule (« cultivé, bienveillante » : l'accord vaut). Flood 16 950 : 3 tirs = 3 vraies fautes du corpus |
| « e » muet du futur/conditionnel (« t'oublirais ») | 🔴 LIVRÉ (2026-08-20) | non-mot en r+terminaison dont stem+er est un verbe des tables → réinsérer le e muet (oublirais→oublierais) ; AUDIBILITÉ : le R entendu écarte l'imparfait « oubliais » (distance 1 aussi) ; radical ≥ 4 (« tetra »→tetera = l'unique tir) ; vit dans spellTokenCore → l'élision est déballée (l'oublirais) . 0 tir/16 950 |
| accent réel-mot « age » → « âge » | 🔴 LIVRÉ (2026-08-20, audit rappel dys PR#505) | « age » est CONNU du lexique (pièce de charrue) → le canal accent se taisait. Contexte déterminant exigé (l'/d' élidé, son/mon/un…), minuscule STRICT (« l'Age d'Or » titre = l'unique tir du flood 16 950). ×5 sur les 6 dictées ASEI |
| « c'/s' + étais » → était | 🔴 LIVRÉ (2026-08-20) | après c'/s' (= ce/se), la 1re personne n'existe pas ; le speller rendait « c'étais » (accent restauré, personne gardée). 0 tir/16 950 |
| participe après avoir (« elle a grandit ») | 🔴 LIVRÉ (2026-08-20) | avoir + forme FINIE -it/-is jamais-participe dont la troncature EST un participe (grandit→grandi, finit→fini). Garde décisive : le participe tronqué doit EXISTER. 1 tir/16 950 = vraie faute UD (« il a réagit ») |
| participe après s'est (« s'est marier ») | 🔴 LIVRÉ (2026-08-20) | s'est/s'était + infinitif -er connu des tables → é (le participe régulier existe par morphologie). v1 réfléchi SEUL ; « est/sont + -er » attendra sa mesure. 0 tir/16 950 |
| négation « n' » manquante (on a pas) | 🔴 LIVRÉ (2026-08-12) | cadre : sujet-pronom + verbe à VOYELLE + négateur, PLUS formes élidées (c'est pas→ce n'est pas, j'ai jamais→je n'ai jamais, il y a pas→il n'y a pas, t'as rien→tu n'as rien). « plus » exclu (comparatif, 8 FP/10 au proto), « pas mal » exclu (locution). 5 tirs/14 450 UD = 5 vraies fautes orales du corpus → rouge sur tout le cadre |
| que/dont (la chose que j'ai besoin) | 🟠 LIVRÉ (2026-08-12) | gouverneurs besoin/envie/peur/honte (parle/doute exclus : transitifs légitimes) ; antécédent NOMINAL exigé (complétive « je crois que j'ai besoin » exclue) ; « besoin DE » présent → silence |
| run-on (ponctuation manquante entre propositions) | 🟢 | couche verte |
| pronoms relatifs composés (lequel/laquelle) | ❌ | rare chez le dys, FP-risqué → non prioritaire |

## 6. TYPOGRAPHIE & PONCTUATION (LT : « Typographie », « Ponctuation », « Majuscules »)

| phénomène | état | note |
|---|---|---|
| espace avant . et , · espace manquant après , · espace double · virgule doublée | 🔴 | appliqués depuis PR#468 |
| points de suspension → … · guillemets droits → « » | 🟠 | préférence, jamais imposée |
| espaces françaises avant : ; ! ? | 🟡 | tolérées (pas signalées) — choix : ne pas harceler |
| parenthèses/guillemets non appariés | ⛔ RÉFUTÉ chiffré (2026-08-12) | 317 orphelins/14 450 phrases UD CORRECTES (citations multi-phrases, incises fermantes seules, translittérations, énumérations) ; corpus dys : 5 orphelins bruts et **5 aussi dans les golds** → les correcteurs humains n'en ferment aucune, rappel confirmé = 0. Signaler = fatigue pure. La conversion guillemets droits → « » (🟠, gardes pouces/chiffres) existe déjà et suffit |
| majuscule de phrase | 🟠 | page correcteur seulement |

## 7. LEXIQUE & USAGE (LT : « Anglicismes », « Pléonasmes », « Répétitions », « Calques », « Style », « Archaïsmes », « Régionalismes », « Marques », « Tours critiqués »)

| catégorie LT | état | note |
|---|---|---|
| Répétitions (il il) | 🔴 | span 2 |
| Anglicismes | 🟢 | liste close de NON-MOTS seulement (checker→vérifier) ; les homographes FR (réaliser, supporter) exclus — mesurés floodants |
| Pléonasmes (monter en haut) | 🟢 | couche verte |
| Calques · Style · Archaïsmes · Régionalismes · Marques · Tours critiqués | ⛔ | **hors périmètre assumé** : ce n'est pas de la faute, c'est du style ; la population dys n'a rien à y gagner et tout à perdre en fatigue de signalement |

---

## CE QUI NOUS MANQUE RÉELLEMENT — priorisé pour le dys (audibilité × fréquence × FP-risque)

1. **Négation « n' » manquante** (« on a pas », « il faut pas ») — le n' est quasi inaudible à l'oral
   (exactement le profil « le dys écrit ce qu'il entend »), très fréquent, cadre fermé. Rouge
   possible après « on » (« on a » ambigu zéro), orange ailleurs (registre oral voulu dans un chat).
2. **si + conditionnel** (« si j'aurais su ») — liste fermée, faute scolaire archétypale, FP≈0 par
   construction.
3. **quelque soit → quel que soit** — motif fermé, rouge possible.
4. **que/dont** (« la chose que j'ai besoin ») — gouverneurs en liste fermée, orange.
5. **ce qui il → ce qu'il** — élision obligatoire, rouge possible.
6. **-rai/-rais** (futur/conditionnel) — le -s est muet, donc dys-pertinent ; mais hors marqueur
   temporel c'est un choix sémantique → orange, et à mesurer sérieusement avant de livrer.
7. **près de / prêt de · davantage/d'avantage · fatigant/fatiguant · vingt/cent** — paires et motifs
   fermés, orange, petit volume chacun.
8. **Compléter la liste des participes à être** (« il a tombé », « ils ont retournés ») — la
   règle existe, la DONNÉE manque ; même diagnostic que les prénoms (PR#460).
9. ~~Parenthèses/guillemets non appariés~~ — RÉFUTÉ par la mesure (voir §6) : le non-apparié est presque toujours légitime en français réel, et le gold dys n'en corrige aucun.

**Bilan du chantier 2026-08-12 (items 1-8)** : 1, 2, 3, 5, 7, 8 LIVRÉS (rouge quand le cadre le
permet), 4 LIVRÉ en orange, 6 REPORTÉ avec chiffre (9 conditionnels corrects floodés sur UD pour
0 occasion dys). Mesure finale AU MOTEUR : 7 tirs sur 14 450 phrases UD, TOUS étant de vraies
fautes du corpus (négation orale ×5, « le plus influant », « deux cent salariés ») → FP réel = 0.
Item 9 RÉFUTÉ chiffré le même jour (317 orphelins légitimes/14 450 UD ; golds dys : 0 fermeture) → la liste 1-9 est CLOSE.

Chaque candidat suit la discipline du dépôt : compter les OCCASIONS dans le corpus dys d'abord,
mesurer le flood sur UD ensuite, gardes CI des deux sens, et vérité navigateur avant merge.

## Ce que LT a en masse et qu'on ne veut PAS

Style, tours critiqués, calques, archaïsmes, régionalismes, marques : des milliers de règles qui
tolèrent le faux positif. Notre contrat est inverse (FP=0 sur l'affirmatif) et notre utilisateur est
dys : chaque signalement non indispensable est de la fatigue. Le différentiel de compte (6 854 vs
~60 phénomènes) est un choix, pas un retard.

## La GREFFE juge-aval (2026-08-21, PR#517-518+) — le premier organe non mécanique

Le mur assumé de `saisVig` — « [il/elle/on] sait + INFINITIF » exige la sémantique — est couvert
par un JUGE de perplexité : le char-transformer maison B2 (14 M int8, 100 % nos données UD+wikt,
WebGPU zéro dépendance, opt-in 15 Mo, tout local). Doctrine stricte du juge-AVAL : le squelette
détecte le cadre et fabrique les DEUX candidates (« sait marier » / « s'est mariée » accordée) ;
le juge COMPARE, ne produit jamais. Orange span 2, marge τ=0.01, jamais imposée. Garde miroir :
quand le juge a tranché « s'est », l'accord SV se tait (sinon il ressuscitait « sais→sait » — le
renforcement de la mauvaise lecture, vu sur ASEI texte4). Mesures (dictee/greffe_sais_probe.py) :
cas réel ASEI tranché ✓ (Δ=+0.065), rappel held-out 7/7, cadre quasi inexistant en correct
(1/18 556 phrases — le cadre lui-même est un signal dys). Parité navigateur : b2_web_probe.js
(|Δ|=0.00000/31 chaînes + bout-en-bout app). Le piège « Elle sait marier les saveurs » reste muet.

### L'ARBITRE général des vigilances (chantier symbiose n°1, 2026-08-21)

Le même juge B2, étendu de UN cadre à TOUTES les oranges à suggestion : chaque vigilance est
jugée (candidat = texte avec la suggestion appliquée) et si l'ÉCRIT gagne par marge (τ=0.01),
l'orange est de la fatigue que le contexte dément → elle se TAIT. Mesures (arbitre_vig_dump.js +
arbitre_vig_probe.py, pipeline réel) : sur 16 950 phrases correctes, 2 507 oranges → 33 % tues
(accord pluriel : 68 % — « le 25 août »→« aoûts » ; ces/ses : 4 %, le mur référentiel confirmé) ;
sur 613 textes dys appariés, 693 oranges classées : **293/294 justes GARDÉES**, 95 % des
pointeuses gardées, 34 % de la fatigue tue. La doctrine « chaque signalement non indispensable
est de la fatigue » gagne son organe. Opt-in (le juge), cache par texte, bout-en-bout au banc
navigateur (l'orange apparaît puis se tait).

### Vigilance-perplexité OUVERTE : RÉFUTÉE — et le cadre fermé qui en survit (2026-08-21)

L'idée « le mou signale "quelque chose cloche" sans dire quoi » est RÉFUTÉE chiffrée
(perplex_omission_probe, 900 phrases trouées vs 900 intactes held-out) : à TOUT seuil de
surprise, trouées et intactes déclenchent au même taux (91/93 %, 68/69, 39/42) — le max de
surprise d'une phrase intacte est distribué comme celui d'une trouée ; localisation argmax 21 %.
Un char-LM ne porte pas de détecteur d'omission ouvert. CE QUI SURVIT : le cadre FERMÉ —
l'AUXILIAIRE MANQUANT ([pronom]+participe sans aux, les 2 omissions réelles du corpus dys sont
« manque a », le moteur y était MUET). greffe_aux_probe : rappel 127/127 (100 %) à τ=0.01,
cadre 17/4 106 sur correct held-out ET les 3 « FP » sont de VRAIES fautes résiduelles du côté
corrigé du corpus (« Il servi aussi de lieu ») — le juge a trouvé des fautes dans notre gold.
« Elle grandi » → orange « a grandi » (être/avoir selon ETRE_PP), branchée au juge opt-in,
bout-en-bout navigateur vert. La leçon (2e fois, après sait/s'est) : le mou ne juge bien que
les candidats que le squelette fabrique — jamais l'ouvert.

### DISTILLATION INVERSE mou→squelette : la carte « pluriel-tais » (chantier symbiose n°3, 2026-08-21)

Première re-cristallisation : la compétence du juge sur la famille « accord pluriel à vérifier »
(la plus grosse fatigue, tue à ~2/3 par le juge) devient une CARTE logistique locale embarquée
(traits : mots voisins déaccentués + polarité du déterminant + nombre + verbe pluriel à droite),
active pour TOUS — sans opt-in, sans téléchargement. La leçon d'entraînement qui a tout changé :
la carte v1 (étiquettes du juge sur du correct seulement) MENAÇAIT les justes (« Les
propriétaire » p=0.53) car « déterminant pluriel + nom singulier » n'existe PAS en texte correct
— le squelette a dû GÉNÉRER 6 000 justes par construction (pluriels corrects singularisés dont
l'orange re-tire) pour que la carte apprenne à les garder. Mesure finale (held-out disjoint de
tout entraînement, artefact élagué évalué tel que baké) : **19/19 oranges justes dys GARDÉES**
(seuil 0.9, plus proche menacée p=0.79), ~53 % de la fatigue tue (fp_scale 120/228, dys 19/31).
Miroir app+extension (plTaisCarte), python sans producteur pluralVig. Le juge opt-in reste
au-dessus et en tait davantage. Bancs : distill_pluriel_dump.js + distill_pluriel.py ;
bout-en-bout navigateur : « le 25 août » ne montre plus jamais « aoûts », pipeline SYNC.

### Distillation, familles 2-4 : SV bakée, genre et ou/où REFUSÉES chiffrées (2026-08-21)

Même recette que pluriel-tais sur les 3 familles restantes (distill_vig_dump.js : corrupteurs
±« nt », −e, ou↔où AUTO-VALIDÉS — la corruption n'est un juste que si l'orange re-tire avec la
sugg d'origine ; distill_vig.py). Leçon de rigueur : les portes v1 étaient CREUSES (« justes dys
0/0 = sûr » ne teste rien) → portes durcies : sécurité TESTABLE (justes dys 100 % ET justes
GÉNÉRÉES held-out ≥99,5 %) ET rendement RÉEL (≥5 oranges tues sur held-out). Verdicts :
· **sv BAKÉE** (seuil 0.5) : justes générées 614/614 gardées, ~27 % de la famille tue (4/22
  fp_scale + 2/8 dys) — modeste et sûr, 35 Ko.
· **genre REFUSÉE** : 61 exemples, 0 juste générable (corrupteur −e muet), rendement nul (0/4).
· **ou/où REFUSÉE** : rendement nul sur held-out (fp_scale : 0 orange de la famille) et 78/79
  justes générées à 0.5 (<99,5 %).
Ces familles restent au JUGE opt-in (l'arbitre les tait déjà à l'exécution — « se trouvent des
poteaux » au banc navigateur). La distillation n'a de sens que sur les familles à VOLUME :
pluriel (744) oui ; genre (11) et ou/où (10) n'avaient rien à re-cristalliser.

### « Ganglions partout » : 2 candidats de plus tentés et REFUSÉS, un bug d'outillage trouvé (2026-08-22)

Demande de Rem, en digression : généraliser le motif « ganglion » (carte distillée qui tait la
fatigue AVANT que le juge B2 ne soit réveillé) au plus de familles possible. Repris depuis le
classement par volume de fausses alertes sur texte correct (UD 14 450, mesuré ce soir) :
« majuscule initiale » (101-2 653 selon corpus) et « ces/ses » (40-773) étaient les seuls
candidats à volume réel qui n'avaient jamais été tentés (genre/ou/où refusés ci-dessus ; le reste
≤6 occurrences, trop rare pour généraliser sans risque).
· **maj REFUSÉE** : 7 796 exemples, seuil 0.5-0.95, fatigue dys tue au mieux 1/15, fp_scale 2/34
  → rendement nul. La règle est déjà quasi déterministe (elle ne tire QUE si le tout premier
  caractère du texte est minuscule) : il n'y a presque pas de fatigue à apprendre à taire — le
  volume mesuré est en grande partie du signal LÉGITIME (fragments de phrase du treebank), pas
  du bruit.
· **ces/ses REFUSÉE** : 1 907 exemples, rendement nul sur held-out (0/22 fp_scale à tout seuil).
  `_cesScore` (le modèle déjà en place) tranche déjà l'essentiel ; ce qui reste dépend souvent du
  discours (possession vs désignation), hors de portée d'un contexte local à quelques tokens.
Bilan sur les 5 familles testées avec cette méthode : **2/5 seulement passent la barre** (pluriel,
SV) — la méthode ne généralise pas automatiquement, elle généralise SEULEMENT là où la règle de
base produit un vrai volume de fausses alertes discriminables localement.

**Bug d'outillage trouvé en cours de route** : re-lancer `distill_vig.py` sur une famille DÉJÀ
shippée (SV) l'auto-censure — la collecte tourne à travers le moteur ACTUEL, qui contient déjà la
carte SV, donc les cas qu'elle tait sont invisibles à son propre ré-entraînement (fatigue dys
tombée à 0/5, rendement artificiellement nul). Deux fixes : (1) `distill_vig.py` FUSIONNE
désormais avec le registre existant au lieu de l'écraser — une famille qui ne re-bake pas
aujourd'hui garde son entrée committée, avec un avertissement explicite au lieu d'un silence
dangereux ; (2) trouvé en creusant `arbitre_vig_dump.js`/`distill_vig_dump.js` n'appelaient JAMAIS
`spell(t, true)` — `capital=true` est pourtant le réglage RÉEL de `_computeCorrs` en production
depuis toujours. Sans lui, « majuscule initiale à vérifier » n'existait simplement pas pour ces
deux outils, y compris le CENSUS : corrigé, ré-ancré (**297 → 302 justes, aucune perte**, ce
correcteur applique déjà 5 majuscules que le census ne voyait pas). Bug de MESURE, pas de moteur —
zéro changement de comportement en production.

## ENQUÊTE sur les 22 fautes dys non-corrigées (demande de Rem, 2026-08-21) + GARDE CENSUS (64ᵉ)

**La garde d'abord** : le duo dump+census est outillé — `vig_census_probe.py` (64ᵉ check, batterie
ET ci.yml, SAUTÉ en CI corpus absent) re-joue le pipeline sur le dys apparié, classe chaque
orange contre le gold et compare aux effectifs committés (`vig_census_ref.json` : justes 294,
pointeuses 238 — des NOMBRES, jamais le corpus). Une juste perdue = batterie rouge avec la liste.

**L'enquête, écart par écart** (audit re-joué = 62 %/15 % IDENTIQUE à la clôture ; les 22
restantes lues une à une au moteur) :
· 4 = BRUIT D'ALIGNEMENT (bien↔cultivée sur les fusions « bienveillante » — l'engin corrige
  bien, l'aligneur croise) ; 1 = choix de temps du gold (jaimè→j'aime vs J'aimais).
· 4 « l'oublirais »→l'oublierai : le speller répare l'orthographe, le gold veut le FUTUR après
  « je ne … jamais » — le conditionnel est aussi grammatical ; frontière assumée.
· 2 = RÉSOLUES PAR LE JUGE opt-in (sais→s'est + marier→mariée, texte4) mais INVISIBLES aux
  harnais Node (pas de WebGPU) — prouvées par b2_web_probe ; noté dans la référence du census.
· RÉPARABLES à cadre fermé (le chantier suivant) :
  1. « la guère » : DET + guère (adverbe) → guerre — jamais correct, rouge candidat.
  2. « de petit tuyaux souterrain » : adj ↔ nom pluriel NON-AMBIGU (-aux/-eaux) désaccordés.
  3. « cultivé ET bien veillante » : rPpEpithetFem s'arrête à la virgule (texte2 corrigé) mais
     PAS à la coordination « et » (texte3 muet) — extension de règle.
  4. « elle c'est marié » : c'est→s'est corrigé mais le participe reste masculin — l'accord
     après s'est (pronominal) n'est pas chaîné ; orange candidate (COD antéposé = piège connu).
  5. « J'aimer beaucoup » : l'élision j' court-circuite rFlexionEr (garde apostrophe) — orange
     « conjuguer après je » candidate.
  6. « sa vit » → vie : possessif + forme uniquement verbale, homophone nominal — paire
     confusable à ajouter.
  7. « uen » → un (au lieu d'une maison) : le candidat DÉTERMINANT doit s'accorder au genre du
     nom suivant (la contrainte lexicale DOMINE la fréquence — doctrine aide-frappe).
  8. « àeu / àfinit » : soudure à+verbe → « a eu / a fini » (le speller propose « as »).

### Réparables 1-3 LIVRÉS (groupe rouge, 2026-08-21) — rappel dys 62→68 %, ratées 15→9 %

Trois règles nées de l'enquête des 22, mesurées au flood DIFFÉRENTIEL (ancien moteur vs nouveau
sur 16 950 phrases correctes — seuls les tirs NOUVEAUX comptent ; v1 : 3 FP lus → resserrés →
**0 nouveau / 0 perdu**) :
· `rGuere` (rouge) : DET + « guère » (adverbe) → guerre — 0 tir sur correct, texte2 corrigé.
· `rAdjAux` (rouge) : adjectif singulier ADJACENT à un nom pluriel NON-AMBIGU en -aux/-eaux
  (« de petit tuyaux souterrain » → petits, souterrains). Resserrages mesurés : tête au-delà du
  « de » (« le nombre de niveaux total » — l'adj modifie nombre), interrogatifs quel(le)(s),
  anglicismes invariables (hardcore…). Candidat vérifié au lexique (+s/+x).
· `rPpEpithetFem` : l'abstention-coordination est LEVÉE seulement si la sœur coordonnée est déjà
  marquée féminin (« cultivé ET bien veillante » → cultivée) — les couleurs composées (« une jupe
  bleu et vert ») restent protégées. 0 FP au différentiel.
Parité 3 moteurs, batterie 64/64 (census : aucune orange juste perdue). Restent de l'enquête :
accord après s'est (orange), j'+inf (orange), vit/vie (confusable), genre du déterminant dans
les candidats speller (uen→une), soudure à+verbe (àeu→a eu).

### Réparables 4-6 LIVRÉS (2026-08-21) — rappel dys 68→70 %, ratées 9→5 %

· `rSaVit` (rouge ×3) : sa/ma/ta + « vit » (forme uniquement verbale) → vie ; « il la vit
  partir » exclu (pronom objet + passé simple). Différentiel : 0 tir sur correct.
· `sestPpVig` (orange app+ext) : « elle s'est marié » → mariée ? Le PRONOMINAL reste orange à
  vie (COI invariables dit/permis/demandé…, participe+infinitif « s'est vu confier », COD
  postposé « s'est acheté une robe » → gardes fermées ; + « se donner » attrapé au flood :
  1 seule orange sur 16 950). Le cadre accepte « c'est » (la vigilance tourne AVANT la cascade
  c'est→s'est). ⭐ Census : la nouvelle orange juste de texte3 a fait tirer la garde « MIEUX »
  → référence ré-ancrée 295 justes (le système fonctionne dans les deux sens).
· `jInfVig` (orange app+ext) : « J'aimer beaucoup » → j'aime ? (l'élision exige une forme
  conjuguée ; le TEMPS voulu est inconnu — gold imparfait — donc jamais rouge). 0 orange sur
  16 950. ⭐ Piège payé : lire T[i-1] avant le garde i<2 = TypeError sur le 1er token.
Restent de l'enquête : 7-8 côté speller (genre du déterminant dans les candidats « uen »→une ;
soudure à+verbe « àeu »→a eu).

### Réparables 7-8 LIVRÉS — L'ENQUÊTE DES 22 EST CLOSE (2026-08-21)

· Soudure à/a+VERBE (speller, vigilance) : « àeu »→« a eu », « àfinit »→« a finit » (la grammaire
  accorde fini en cascade). Gardes : le reste doit être une forme CONJUGUÉE/participe — jamais un
  infinitif (« atendre »=attendre) — et le REDOUBLEMENT prime (« aporté »→apporté, régression
  attrapée par le banc au premier essai).
· Genre du déterminant (speller) : le genre du NOM SUIVANT domine la fréquence (doctrine
  aide-frappe ②) — « dans uen maison »→une, « uen homme »→un conservé. Posé aux DEUX voies
  (noyau + best-effort spellUnknown — c'est la seconde qui répondait, trouvé aux traces) ; le
  jumeau est accepté par anagramme (la transposition n'est pas dans edits1) ; la table POS est
  CLAIRSEMÉE (« maison » sans entrée) → sGender pur seul.
BILAN DE L'ENQUÊTE : 8 réparables/8 livrés (4 rouges, 3 oranges, 2 speller) ; le census a tiré
« MIEUX » deux fois (295→297 justes, ré-ancré) ; corpus réel : CORRIGÉES 41→46/66 (70 %),
vigilance juste 5, RATÉES 10→3 (5 %). Les non-réparés sont classés avec leur cause : bruit
d'alignement (4), choix de temps du gold (1), frontière conditionnel/futur assumée (4), juge
opt-in invisible aux harnais Node (2, prouvés au banc navigateur).

## CROISEMENT « Excuse My French » (excusemyfrench.org, 2026-08-21) — 58 notions passées AU MOTEUR

Site open source d'Onur Çelebi (générateur d'exercices, code AGPL-3.0 = JAMAIS importable ;
contenu CC BY-SA 4.0, ~150 Ko faits main). Croisement fait au COMPORTEMENT : une faute dys
plausible par notion, dans nos 3 moteurs. **20 rouges · 1 orange · 4 silences attendus ·
12 non couverts.** Hors périmètre : vocabulaire, compréhension, ordre des mots, dates.

Non couverts, classés (pré-estimation FP = cadre compté sur 16 950 phrases correctes) :
1. « il mangeai » → mangeait (il/elle/on + forme en -ai) — **0 occurrence sur correct** : rouge
   candidat, cadre fermé (rule_ais_ait ne prend que -ais).
2. « le film qui j'ai vu » → que (qui + pronom sujet) — 46/16 950 mais TOUS derrière une
   préposition (« avec qui il ») : rouge candidat avec garde « pas de préposition avant qui ».
3. « je mange de le pain » → du / « à le marché » → au — 67/16 950, TOUS « de le + INFINITIF »
   (« de le visiter ») : rouge candidat avec garde tagger NOM après.
4. « je vais jamais / je vois rien / il connaît personne » (négation sans ne) — 4/16 950,
   noms (« la personne ») : rouge candidat après gardes (déterminant avant rien/personne ;
   « à jamais », « si jamais »). Extension naturelle de rNegNe (qui ne prend que « pas »).
5. « je le ai vu » → l'ai (élision obligatoire clitique + auxiliaire) — cadre à resserrer
   (le/la/me/te/se + ai/as/a/est/avais…), à compter avant.
6. « un pomme » → une : rule_det_gender MUET car « pomme » est absent de GENDER_PURE (collision
   désaccentuée avec « pommé ») et hors du sous-ensemble curé GENDER_ACC_COLL — famille de trou
   CONNUE (cf. bases-genre-desaccentuees) ; « un poire »→une passe. Mesurer l'extension.
7. « il faut que tu viens » → viennes (subjonctif déclencheurs) — 0 occurrence du cadre sur
   correct ; orange candidate, faible volume.
8. « la fille que je parle » → dont : _QDONT_GOUV = {besoin, envie, honte, peur} seulement ;
   « parler de » est AMBIGU (« la langue que je parle » correct) → frontière, orange au mieux.
Frontières assumées : futur/conditionnel (« je mangerais demain »), concordance du discours
indirect, impératif sans trait d'union (« mange le » : « le » article possible).

**Croisement ② — leur dictée « note ce qui a été entendu »** (silentNumberPair : mange/mangent
inaudible, vend/vendent audible, liaison et auxiliaire disqualifient). Chez nous, diag_word
étiquette « mange pour mangent » **« muette »** (stade LEXICAL, orthographe du mot) — identique
à « vend pour vendent » qui, lui, s'entend. Le type « accord » n'est posé que si la forme est
dans la FAMILLE curée du mot (famille.json, 114 entrées : mangent absent). Idée à reprendre
(idée ✅, code ⛔) : détecter la paire de nombre INAUDIBLE (terminaison -e/-ent, -t/-ent hors
liaison et hors auxiliaire) → type « accord (marque muette) », stade MORPHOSYNTAXIQUE, message
« ça ne s'entend pas : c'est l'accord qui le dit ». À MESURER au banc diag avant (déplacement
de stade, pas de recalibrage de seuils — cf. dictee-calibration-audit).
Autres idées notées (sans code) : niveau déclaré = PLANCHER (la maîtrise prouve ce qu'on sait,
jamais ce qu'on ne sait pas) ; graphe de 58 notions avec prérequis/confondues-avec ; SRS plafonné.

### Réparables du croisement Excuse My French — LIVRÉS (2026-08-21)

Dans l'ordre logique demandé, au flood DIFFÉRENTIEL (ancien vs nouveau moteur, 16 950 correctes) :
· `rAiAit` (rouge ×3) : « hier il mangeai » → mangeait (il/elle/on + -ai, hors -rai). 0 tir.
· `rQuiQue` (rouge ×3) : « le film qui j'ai vu » → que — RESTREINT à je/j'/tu après lecture du
  flood v1 : nous/vous sont des clitiques OBJET (« la personne qui vous accueille », 13 FP lus).
  Garde : pas de préposition avant qui (« avec qui il »), antécédent NOM/PROPN.
· `rNegNe` ÉTENDU (×3) : verbe FINI et plus seulement l'auxiliaire (« je vais jamais », « je vois
  rien », « il connaît personne » → ne/n') ; « plus » reste exclu (comparatif). Gardes nées du
  flood : négation capitalisée = phrase suivante (« allaite.. Rien n'est »), frontière _SEG.
  Les tirs restants sur le corpus sont de VRAIES fautes de registre oral (« on connait pas
  davantage », « je suis pas encore allé ») — même verdict que le chantier n' (PR#477).
· Fusions SPELLER (élision-espace, app+ext, proposées span 2) : « de le pain »→du, « à le
  marché »→au, « de les »→des (garde : NOM au tagger ET aucune finale d'infinitif -er/-ir/-re/-oir
  — le tagger prenait « transporter/définir/haïr » pour des noms, 13 FP lus) ; « qui il »→qu'il
  (garde préposition). Flood : 1 tir/16 950 = « qu il » sans apostrophe, vraie faute du corpus.
· DICTÉE (diag_sentence + jumeau app) : une paire de NOMBRE VERBALE hors famille curée
  (« ils mange » pour « ils mangent », sujet pronom) est désormais un ACCORD (stade
  morphosyntaxique) et non une « lettre muette » (lexical) ; la nuance AUDIBLE/INAUDIBLE est
  portée (« marque MUETTE : ça ne s'entend pas, c'est l'accord qui le dit » pour -e/-ent, -t/-ent
  à radical vocalique ; vend/vendent = accord audible ; liaison possible = pas de mention).
  Banc diag : chiffres IDENTIQUES à la baseline (accord 331/331, gouverneur 96 %, SV 97 %).
  Idée Excuse My French (silentNumberPair), réimplémentée, pas copiée.
Contrainte apprise : les règles Python ne rendent qu'UN token (pas de span 2) et la parité
app⊆Python l'exige → les fusions à deux tokens vivent dans le speller (app+ext), jamais en CRULES.
Non faits (classés) : « un pomme » (donnée GENDER_PURE, collision pommé — mesurer l'extension du
sous-ensemble curé), élision clitique+aux, subjonctif (orange, 0 cadre), que/dont-parler (frontière).
