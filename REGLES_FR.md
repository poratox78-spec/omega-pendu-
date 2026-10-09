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
| accord | `**Marie** est venu ce matin.` | venue — ⚠️ l'accord par PRÉNOM est livré, il ne tire pas ici → réparé le jour même (#596 : la garde « DET après participe » exemptée des compléments de temps) ; tire en AUTO depuis, revérifié 03/09 |
| segmentation | `**Ducou** je suis parti.` | du coup |
| accent | `Le **the** est **brulant**.` | thé / brûlant |
| conjugaison | `Nous **somme** partis.` | sommes |

⚠️ Les homophones muets ci-dessus (`et/est`, `son/sont`, `ces/s'est`, `peut/peu`, `mais/mes`) ont
tous une règle au registre : elles ne se déclenchent pas **dans ces contextes-là**. C'est un travail
de gardes, pas de règles manquantes — à instruire cas par cas avant de toucher quoi que ce soit.
**Fait (revérifié 03/09/2026, dys-core + assets réels)** : quatre des cinq ont été instruits et
livrés dans la foulée — `et/est` #597 (§🔧 ci-dessous), `son/sont` nominal #600 (§🔁), `peut/peu` et
`mais/mes` #601 ; les phrases du tableau tirent en AUTO. Restent muets : `ces/s'est` (« Il ces
trompe ») et le cas PRONOM « Il son partis tot. ».

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

**Restent ouverts** — ⚠️ la liste d'origine (26/08) était périmée le jour même : les livraisons
#599-#601 sont tombées après sa rédaction. Re-mesurée le 03/09/2026 sur main@995b956 (référence
Python + dys-core chargé de ses assets réels). **LIVRÉS** : `sait`→s'est #599 (« Le train sait
arrete » → s'est AUTO) · `son/sont` à sujet nominal #600 · `peut/peu` et `mais/mes` #601 (« Il y a
peut de monde »→peu, « Mais amis sont venus »→Mes, AUTO) · `afreuses` rend désormais **affreuses**
(orange — la correction fausse « affreux » a disparu). **TOUJOURS OUVERTS** : `ces/s'est` (« Il ces
trompe de chemin » muet) · `son/sont` à sujet PRONOM (« Il son partis tot » muet — seul le nominal
est livré) · `Ducou`→du coup · `Nous somme`→sommes (somme = nom valide, invisible au speller) ·
`sertin`→serein au lieu de *certain* et `tar`→tarte au lieu de *tard* (mauvais candidats, désormais
en orange) · « La foret est sombre » → toujours La→Le (orange) au lieu de foret→forêt.
**FERMÉ PAR CHOIX** : `the`→thé — « the » est dans la stop-liste anglaise `_SPELL_KEEP` du produit
(ni corrigé ni « mot inconnu », anti-FP sur le FR citant l'anglais). La divergence Py↔JS constatée
le 03/09 (la référence corrigeait the→thé en AUTO) **n'existe plus depuis le 04/09** : `SPELL_KEEP`
est porté dans `speller_probe.py` (même liste, même position dans la chaîne), coût mesuré nul —
gold pipeline 402/19 strictement identique ; les 3 « justes » perdues au mélange étaient 2 FP réels
sur titres anglais (« Turn the Tide », « clerk of the chamber ») comptés justes par le juge
accent-normalisant + 1 vrai « the »=thé français, invisible au pipeline pour la même raison. Quant à
« brulant » : c'est un mot du lexique (réforme 1990) — l'attente brulant→brûlant était caduque.

### 🟠 Comblés le même jour (3 trous trouvés par le crible des explications)
| règle | exemple | FP mesurés |
|---|---|---|
| personne du verbe | `je fini`→finis · `tu a`→as · `il faut que tu fini`→**finisses** | 0 / 25 752 formes correctes · 0 / UD 2500 |
| infinitif après semi-auxiliaire | `je vais mange`→manger · `je dois fini`→finir | 0 / 35 556 couples corrects · 0 / UD ; **29/09/2026** : 4 faux positifs mesurés fermés, une garde chacun (« fait » nom ou locution, sigle en gouverneur, participe ACCORDÉ après un auxiliaire — le causatif est invariable —, déterminant + nom dominant) ; les 5 prises des corpus dys restent ; suggestion ré-accentuée (« il va réussi » → réussir, plus reussir) |
| on/ont après sujet pluriel | `Les enfants on mange`→ont | 0 / UD · 0 / corpus dys |

### 🐞 FP ROUGE réparé (violation du FP=0, présente en production)
`Dans ses carnets **on** voit bien.` — français correct — devenait « ses carnets **ONT**
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
| mot inconnu → signalement | 🟠 | jamais imposé ; **29/09/2026** : un PRÉNOM de la table (8 730) écrit en minuscule reçoit le prénom (« enzo » → Enzo ?) avant un mot du dictionnaire — sauf si le dictionnaire propose un mot à UNE édition (« dee » → de). Gold dys +7 bonnes suggestions, 0 perdue sur les corpus réels (EcriScol, frgec), 1 sur le corpus de fautes GÉNÉRÉES (« unai » → Unai au lieu de « une ») ; précision au produit (Chrome) 46,9 → 48,2 % ; UD 14 450 : 0 marque, 2 suggestions changées |
| élision manquante/inversée (c est→c'est, j'mange→je mange) | 🔴 | 2 règles + listes closes unifiées ; **29/09/2026 (catalogue des muets, lot A)** : deux élisions fusionnées qui forment un mot CONNU — « on na jamais » → n'a, « ce né pas » → n'est, « tu né plus » → n'es (devant une négation seulement ; « il est né pas loin » : rien). Gold dys 12, UD 0 |
| majuscule initiale / nom propre | 🟠 + 🔴 | page correcteur seulement (politique) ; **29/09/2026 (lot A)** : nom de LIEU sans ambiguïté écrit en minuscule → capitale, en rouge (japon, l'europe, pyrénées… ; liste fermée : « suisse » et « paris » exclus, mesuré sur UD). Gold dys 16, UD 0 ; **30/09/2026** : et les MARQUES / SIGLES sans ambiguïté (liste fermée de 27 formes : consoles, plateformes, sigles — ogm, sncf, onu… ; « internet », « cd », « sms », « usa », « google » exclus ; une marque à une lettre de « sont », entre deux pluriels, reste « sont »). Gold dys +13, UD 0 |
| **trous du lexique** (désarçonnaient, belle-sœur, exclamassent) | 🟡 | mesuré : 22 formes verbales rares / 1 059 « inconnus » sur UD ; **chantier lexique unifié, pas de génération mécanique** (abeillier→abeilliaient réfuté) |

## 2. HOMOPHONES GRAMMATICAUX (LT : « Confusion d'homonymes et paronymes »)

| phénomène | état | note |
|---|---|---|
| a/à · et/est · son/sont · on/ont · ce/se · ça/sa · du/dû · du/de · sur/sûr · la/là · leur/leurs · mais/mes · met/mais · mai/mais · des/dès · peu/peux/peut · sais/sait · c'est/s'est · j'est/j'ai · c'ai/c'est | 🔴 | le cœur du correcteur ; FP=0 à l'échelle, gardé CI |
| a/à devant un INFINITIF, là où « a » ne peut pas être l'auxiliaire | 🟠 LIVRÉ (2026-09-29, catalogue des muets) | après une négation (« n'as pas a te plaindre »), après un nom qui appelle « à » (du mal, de la peine, une difficulté…), après un verbe collé à un pronom élidé (« m'occupe a »), après sujet + verbe (« elle continu a ») ; voie nouvelle de rA / rule_a_aa, jouée seulement si la logique existante se tait, ORANGE ; les règles -er/-é qui la consultent ne rendent plus leur participe rouge faux. Produit : 5 « à » justes de plus sur le gold, 4 rouges faux retirés ou ramenés en orange, 0 perte ; UD : 1 marque (faute du corpus). + « je né jamais » → n'ai (n'est, rouge faux de #823) |
| « cette » mal écrit : séte, sete, cète, sétte → cette / cet ; « set » → cette après un mot-outil, devant un nom | 🟠 LIVRÉ (2026-09-30, catalogue et 2e catalogue) | orthographe en contexte : « séte » recevait « été » (mot faux) ; cet devant un nom masculin à voyelle ; « Sète » (capitale) et « sète » exclus ; « set » anglais gardé derrière un déterminant ou un adjectif (le quatrième set). Gold +7, UD 0 |
| déterminant écrit avec « é » : té, dé, mé, lé + nom → tes, des, mes, les (pluriel) ; « dé » → de (adjectif, singulier, quantité), dès (le, les, que, lors) ; « lé » + singulier → le | 🟠 LIVRÉ (2026-09-30, catalogue des muets) | orthographe en contexte : sans déterminant devant (le té, un dé, un lé sont des noms), pas après un pronom ou un clitique ; le NOMBRE du mot suivant choisit (accent parasite « dé belles robes » → de, vu par la sonde de précision sur le corpus généré) ; « lé » seulement devant un nom connu, rien devant un invariable ; l'accord singulier ne lit plus « lé » comme « le » (« lé enfants » → enfant, rouge faux). Gold +3, UD 0 (formes absentes) |
| a/à après VERBE + ADVERBE (« il parle souvent a ses amis ») et dans l'INTERVALLE « de 10 hectares a 20 hectares » | 🟠 LIVRÉ (2026-09-30, catalogue des muets) | 6e et 7e structures de la voie nouvelle de rA / rule_a_aa, ORANGE ; gardes : participe après « a » (« a longtemps été », seul emploi d'avoir sur UD 14 450), nom confiant avant l'adverbe, relative sujet en « ce que / celui qui », nom commun nu après « a » (« au » attendu) ; intervalle lu par le canal des chiffres (_SEG.dig : un chiffre après « de », un autre après « a »). Produit : gold +5 « à » justes, 0 fausse, frgec +3 ; UD 0 |
| a/à dans une LOCUTION PRÉPOSITIVE écrite avec « a » : à cause de, à partir de, à l'intérieur de, à part, à ne pas / jamais / plus, à qui après un nom, suite à et grâce à sans déterminant | 🟠 LIVRÉ (2026-09-30, catalogue des muets) | 5e structure de la voie nouvelle de rA / rule_a_aa, ORANGE : l'auxiliaire avoir n'entre pas dans ces locutions (UD 14 450 : aucun emploi). Gardes : « il y en a qui », « la suite a montré » (déterminant devant), « Grace » prénom. Produit : gold +11 « à » justes, ecriscol +5, frgec +4 (justes, absents du corrigé) ; UD 0 ; « les cours a partir du… » ne reçoit plus « ont » en rouge |
| et/est : sujet nominal + « et » + PARTICIPE ; « est voilà » ; « est » + adverbe de liaison + nouvelle proposition | 🟠 LIVRÉ (2026-09-29, catalogue des muets) | « le chat et parti ce matin » → est : voie nouvelle de rEt / rule_et_est, jouée seulement si la logique existante se tait, ORANGE (la branche nominale n'acceptait qu'un adjectif). Gardes, chacune née d'un cas mesuré : le participe ne se lit pas aussi comme un verbe conjugué (« … et un grenier et fait cent mètres »), il n'est pas surtout un nom (« un ami et associé »), pas de participe plus tôt dans la proposition, pas de mois juste avant (une date n'est pas un sujet), aucun verbe conjugué dans la proposition. « est voilà » → et, « est aussi elle a ri » → et (rEstEtClause / rule_est_et_clause, déjà orange) ; « est/et (proposition) » rejoint les règles du voisin orange. Produit : 3 justes de plus sur le gold, 0 fausse sur les 3 corpus dys, UD 14 450 : 0 marque. Silence assumé : participe homographe d'un présent (« le livre et écrit »). |
| orthographe des mots ÉLIDÉS inconnus (« l'aupital », « s'inkiète ») | 🟠 LIVRÉ (2026-09-29, catalogue des muets) | l'étage d'élision de spellToken / spell_token jetait tout candidat à plus d'une édition (« faux ami ») et le repli « mot inconnu » refusait l'apostrophe : la forme nue recevait le bon mot en orange, la forme élidée RIEN. Quand le reste est inconnu : candidat distant → orange ; rien → « mot inconnu » orange sur le reste, préfixe gardé ; « l' » collé à tort (« l'entement ») → la soudure si elle est au lexique. Gardes : reste connu, majuscule (nom propre possible : « L'Atalaya »), reste à consonne (« N'golo » n'est pas une élision). Produit : +14 bons mots en orange sur les 3 corpus dys (gold 9) ; UD 14 450 : 38 oranges « mot inconnu » de plus (822 déjà sur les mots nus, mêmes mots rares ; 9 sont de vraies fautes du corpus). |
| accents muets sur des mots fréquents : « ca », « foret », « pole », « media » | 🟠 LIVRÉ (2026-09-29, catalogue des muets) | ces formes sans accent existent aussi (ou se lisent autrement hors contexte) : le correcteur d'orthographe se taisait. ORANGE, jamais rouge (liste fermée _AFIX_VIG) : « ca » → ça (le circa « ca 1850 » existe) ; « foret » → forêt sauf après un déterminant masculin (« le foret » est l'outil) ; « pole », « media » → pôle, média après un déterminant français, sauf composé anglais (pole position, pole dance, mot suivant inconnu ou en -ing : « media planning »). Minuscules seulement (« Ca » = calcium). Produit : gold +9 bons mots, EcriScol +1, frgec +2 ; UD 14 450 : 1 marque, une vraie faute du corpus. |
| élision fusionnée : « s' » et « c' » seulement devant une suite possible ; « jen » après un déterminant | 🔴→ LIVRÉ (2026-09-29, 2e catalogue : les rouges faux) | la règle découpait un mot inconnu en préfixe + reste d'une liste fermée, cherchée SANS accent mais recopiée telle qu'écrite : « séte » devenait « s'éte », « seu » → « s'eu », en ROUGE. « s' » ne précède que être, il(s), en ; « c' » que être et en (_FUS_SC). « jen » après un déterminant est le nom « gens », pas « j'en ». Produit : 9 rouges faux du gold retirés (8 deviennent une orange du correcteur d'orthographe, 1 un silence), 0 ailleurs, UD 0. |
| passé simple irrégulier : « vous durent partir » → dûtes, « vous prîmes » → prîtes, « il prîmes » → prit | 🔴 LIVRÉ (2026-10-09) | la table des lectures est indexée sans accent : « prîmes » s'y lisait primer (« il prîmes » → « prime », « ils prîmes » → « priment », en rouge). `_psLect` ≡ `_ps_lect` : forme AVEC circonflexe (â, î, û) → sa case exacte du passé simple complété ; sans accent, abstention de l'homographe sauf devant un infinitif gouverné par un modal (« durent partir » = devoir). Gold, 3 corpus, UD : 0 marque changée ; couverture vous 98,0 → 98,5 %. Reste : « vous durent » seul (durez ou dûtes ?). |
| « il est fier de » → plus « fié » ; « il est boulanger » → orange ; « elle ces mariée » sans « mariées » | 🟠 LIVRÉ (2026-10-09) | ÊTRE + mot en -er passait au participe en rouge (`rEer`, `rFlexionEr`, accord du participe) : UD, 6 corrections de cette forme, toutes fausses. `_etreAttrEr` ≡ `_etre_attr_er` : lecture ADJECTIF (fier) → silence, sauf pronominal (« s'est fier » → fié) ; mot surtout NOM (P(NOM) ≥ 0,5 : boulanger, conseiller, boucher) → orange, car « le tuyau est boucher » → bouché existe aussi. Et « ces » corrigé en s'est n'est plus un déterminant pour les pluriels (`rCesSest` à côté de `cesCestVig`). Gold 0 ; 3 corpus : 2 rouges → orange, 1 rouge faux retiré ; UD : 2 rouges faux retirés, 2 → orange. |
| « Ont mange ensemble » → on, sans « mangé » ; « les filles en ont profite » : « ont » reste | 🔴 LIVRÉ (2026-10-09) | deux rouges se contredisaient : `rOn` ≡ `rule_on_ont` lisait « on mange » (pas de sujet), `rEPpl` ≡ `rule_e_ppl` lisait l'auxiliaire « Ont » → « mangé » ; appliqués ensemble : « on mangé ». En tête de proposition (début, ponctuation, ou après et / quand / mais… : `_ON_INTRO`), quand on/ont lit « on », le participe se tait. Et un clitique (en, y, les…) entre le sujet et « ont » ne coupe plus le sujet : « les filles en ont profite » donnait « ont » → on en rouge. Vu en relisant la batterie Python rejouée sur le produit ; gold, 3 corpus et UD 14 450 : 0 marque changée (configuration absente). |
| « chère lui », « chere moi » → chez | 🔴 LIVRÉ (2026-10-04) | `rCherChez` ≡ `rule_cher_chez` ne lisait que « cher » ; la forme féminine ou sans accent devant un pronom tonique restait muette, et « chere » recevait même « chère » en rouge de l'orthographe. Étendue à cher / chère / chere / chers / chères ; gardes vues sur phrases inventées (le « cher » de main les ratait aussi) : intensif avant (« très cher lui aussi ») et trait d'union après (« cher lui-même ») = l'adjectif. Gold dys : 1 mot faux devenu juste ; 3 corpus et UD 14 450 : 0 autre marque. |
| le verbe au PRÉSENT après un « à » gouverné : « il commence a mange » → manger, « elle continue à travaille » → travailler | 🔴 LIVRÉ (2026-10-04) | avant, `rEPpl` lisait ce « a » comme avoir et proposait le PARTICIPE en rouge pendant que la règle a/à rendait « à » : deux rouges qui écrivaient ensemble « à mangé », faux ; et avec « à » déjà écrit, rien. `rAInfE` ≡ `rule_a_inf_e`, placée avant `rEPpl` : le « a » qui suit un verbe de `_A_INF_GOUV` (commencer, continuer, apprendre, réussir…) est la préposition, et la forme en -e devient l'infinitif (radical accentué par le lexique : « lève » → lever). Gardes : mot bien écrit, verbe du 1er groupe, pas un NOM d'abord (« passer à table »). Gold dys : 1 mot faux devenu juste ; 3 corpus : rien d'autre ; UD 14 450 : 0 marque. |
| « CE » devant un VERBE sans pronom sujet avant : « elle sort et ce promène », « il veut ce reposer » → se | 🟠 LIVRÉ (2026-10-04) | `rCe` ≡ `rule_ce_se` ne disait « se » qu'après un pronom sujet (« il ce lave ») ou devant un verbe que `vlike` reconnaissait. « ce » ne détermine qu'un NOM : devant une forme que le lexique ne connaît QUE comme verbe (POS accent-exact du speller : « promène », « perd », « reposer »), c'est le réfléchi ; devant un nom FÉMININ qui est aussi un verbe (« ce pose »), seulement si l'étiqueteur y lit le verbe (« ce » masculin ne peut pas en être le déterminant). Gardes : être / pouvoir / devoir / sembler (« ce doit être »), « pour ce faire », ponctuation ou chiffre entre (UD : notation d'échecs « Ce4 »), voyelle ou h (ce serait « s' »), paire -eille / -eil (« ce réveille » peut être « ce réveil »), préposition avant (« dans ce » = déterminant) sauf pour / à / de / sans / par devant un infinitif. Orange (famille ce/se). Gold dys : 4 fautes muettes → bon mot en orange ; 3 corpus : 7 de plus, toutes justes (3 que le corrigé avait laissées) ; UD 14 450 : 0 marque. |
| « plusieurs maison », « quelques jour », « divers objet », « aux lettre » → PLURIEL (nom et adjectif antéposé) | 🔴 LIVRÉ (2026-10-04) | la table LARGE de `PLURAL_DET` (aux, plusieurs, quelques, certains, quels…), posée le 30/06/2026 pour son/sont, était MORTE dans les DEUX moteurs : la déclaration d'origine, plus bas dans le fichier, la réécrasait au chargement (JS : `var` relu dans la même portée ; Python : réaffectation à l'import) — produit identique à l'octet sans elle, retirée. `_PL_DET_X` ≡ miroir Python, lue par `rNounPlural` et `rAdjAntePl` seulement : quelques, divers, diverses (déterminants) ; plusieurs, certains, certaines (aussi pronoms : veto verbal du nom gardé, adjectif accordé seulement si un nom suit — UD « Certains même qui… ») ; « aux », qui SE DIT comme « au » : il ne prouve le pluriel que devant un mot FÉMININ (« au » est masculin) ou à VOYELLE (« au » y devient « à l' ») — UD « pains aux chocolat », « médaille d'or aux salon » : là, c'est le déterminant qui est faux ; « quelques chose / part » laissé (c'est « quelque » qui est faux). Gold dys : 2 fautes muettes réparées en rouge ; 3 corpus dys : 1 faute de plus que le corrigé avait laissée, 3 oranges devenues rouges (vraies fautes), 2 mots faux devenus justes ; UD 14 450 : 2 marques, deux vraies fautes du texte d'UD. |
| GENRE de l'adjectif ANTÉPOSÉ : « une grand maison » → grande, « la petit fille » → petite, « un belle arbre » → bel | 🔴 LIVRÉ (2026-10-04) | la règle sœur du NOMBRE (`rAdjAntePl`, « les autre enfants ») n'avait pas son pendant en genre : tout était muet. `rAdjAnteGenre` ≡ `rule_adj_ante_genre` : déterminant au genre SÛR (la, une, cette, ma, ta, sa | le, un, ce) + adjectif de la classe fermée + NOM au genre connu, étiqueté nom, D'ACCORD avec le déterminant (double ancre ; « le petite maison » : rien) → l'adjectif prend ce genre (bel / nouvel / vieil devant voyelle). Gardes : trait d'union, ponctuation, « grand » des anciens composés (grand route, grand mère, à grand peine). Gold dys : 3 fautes muettes réparées en rouge ; 3 corpus : 2 de plus que le corrigé avait laissées ; UD 14 450 : 2 marques, deux vraies fautes du texte d'UD (« la meilleur agence », « la petit ville »). |
| le verbe après « à » et après un infinitif : « il apprend à nagé » → nager (le « à » reste), « pouvoir invité », « savoir écouté », « aller rangé », « a dû porté », « j'aime m'habillé » → l'infinitif | 🔴 LIVRÉ (2026-10-04) | ① la règle a/à changeait en « a » un « à » ÉCRIT suivi d'un participe, même derrière un verbe qui appelle « à » + infinitif (« apprend à nagé » → « a », ROUGE ; sur UD : « mettre à mort ») — liste FERMÉE de lemmes (_A_INF_GOUV) lus sur la conjugaison ; un nom n'en est pas un (« l'aide à été », « le reste à été » : avoir) ; après une relative (« ce qu'il dit à fait rire »), « a » reste proposé. ② `rEer` ≡ `rule_e_er` : après un modal à l'INFINITIF dans un contexte verbal (_eerMinfV : verbe conjugué, préposition, adverbe, clitique, et/ou, début de phrase), la garde « nom homographe » (faite pour « de + nom ») ne s'applique plus — l'étiqueteur tranche, un déterminant qui suit prouve le verbe ; « dû/du » après avoir est un modal (_eerDu) ; un modal collé à son pronom élidé compte (« j'aime »). La branche modale exige ce contexte verbal : « il a un grand pouvoir caché » devenait « cacher » en ROUGE. Gold dys : 4 fautes muettes réparées en rouge ; 3 corpus : 0 marque fausse ; UD 14 450 : 1 rouge faux retiré, 0 marque nouvelle. |
| adjectif après un nom de pays, de continent, de région (« la Chine entier » → entière, « l'Europe occidental » → occidentale) ; « quelque » + nom pluriel → « quelques » | 🔴 LIVRÉ (2026-10-04) | deux accords qui restaient MUETS : `rAdjEpithet` écarte tout nom propre (genre inconnu) — `rAdjGeo` ≡ `rule_adj_geo` lit le genre dans une liste fermée (_GEO_G), au singulier, seulement si le lieu porte son article (« de France », « duc de Bourgogne » : l'adjectif peut porter sur le 1er nom — UD l'a montré) ; `rQuelque` ≡ `rule_quelque` : jamais devant un nombre (« quelque 300 voitures » = environ), ni devant « fois », ni si le nom n'a pas de singulier (« quelque temps »). Gold dys : 3 fautes muettes réparées en rouge ; 3 corpus : 1 de plus (que le corrigé avait laissée) ; UD 14 450 : 2 marques, deux vraies fautes du texte d'UD (« quelque véhicules », « quelque étudiants »). |
| « ça / cela / ceci » + verbe à la 1re ou 2e personne (« ça vas mieux » → va, « cela pourrais marcher » → pourrait) | 🟠 LIVRÉ (2026-10-04) | le chercheur de sujet de la personne du verbe (`_sujetFlexion` ≡ `_sujet_flexion`) ne connaissait que les pronoms personnels et le groupe nominal ; « ça », « cela », « ceci » (et « ca », la cédille oubliée) sont désormais un sujet de 3e personne du singulier, au palier du sujet nominal (orange). Casse lue telle qu'écrite : « CA », un sigle, n'en est pas un (« trois joueurs du CA partent »). Gold dys : 1 faute muette réparée, 0 ailleurs sur les 3 corpus ; UD 14 450 : 0 marque. Réfutés en chemin (mesurés) : un nom qui a aussi une lecture verbale (« la voiture ») comme sujet — 8 fausses alertes sur UD ; les verbes « modaux » devant un infinitif après un sujet nominal — 0 gain, 3 fausses alertes. Au passage : planchers de la batterie Python remontés à 223/239 (à 155, 68 cas pouvaient se perdre sans rougir). |
| élision fusionnée : les suites permises PAR PRÉFIXE aussi après j', n', qu', d', l' | 🔴→ LIVRÉ (2026-10-04) | la liste commune des suites (verbes, pronoms, articles, noms vocaliques usuels) laissait passer des élisions IMPOSSIBLES, écrites en ROUGE : « qu'es », « l'en », « d'est », « l'ils » sur les corpus dys, « J'on », « J'amie » (prénoms en tête de phrase) sur UD. j' et n' : un verbe ou « en » ; qu' : un pronom, un article, « en », un verbe ; d' : un nom, un article, « elle », « en », « été », « être » ; l' : un nom, un article, « on », un verbe, « été », « être » (_FUS_SC, 3 moteurs ≡ Python). 3 corpus dys : 6 rouges faux retirés (5 deviennent le bon mot en orange, 1 reste faux mais orange), 0 juste perdu ; UD 14 450 : 2 rouges faux retirés, 0 marque nouvelle. Au passage : les SILENCES ATTENDUS de la batterie Python (MUETS) font désormais échouer `--check` (ils ne faisaient que s'imprimer). |
| clé phonétique du correcteur d'orthographe : un e muet ÉCRIT final garde la consonne qui le précède | 🔧 LIVRÉ (2026-09-30, 2e catalogue : le tri des candidats) | phonKey / phon_key retirait en boucle e, t puis s : « cette » avait une clé VIDE, partagée avec « sais », « ai », « ce » (312 formes du lexique ; 923 mots fréquents à clé d'un seul caractère) — le tri croyait homophones des mots qui ne sonnent pas pareil. Désormais « -es » se lit « -e » et un e muet final garde sa consonne (cette = set, fête = fêtes = fet, reste = rest) ; sinon la boucle d'origine (mangé = mangez = mangeait). Et entre un singulier et un pluriel homophones, le -s ÉCRIT départage avant la fréquence (« afreuses » → affreuses). Et un rival qui n'est que le mot écrit amputé de sa première lettre n'écrase pas un homophone (« aprise » : « prise » écrasait « apprise » ; la chaîne rend « appris »). Produit : 141 marques devenues justes, 23 cassées sur les 3 corpus dys (gold +12, frgec +101) ; UD 14 450 : aucune marque nouvelle ni perdue (90 suggestions changées sur des mots rares déjà signalés). |
| clé phonétique : « ou » ≠ « u » ; finales audibles -ès, -et, -êt, -aient | 🔧 LIVRÉ (2026-09-30, 2e catalogue : le tri des candidats) | la clé confondait « ou » (/u/) et « u » (/y/) : « tou » avait la clé de « tu » (proposé, le plus fréquent) et non celle de « tout », « cur » celle de « cours » et non de « cure ». « ou » a maintenant sa classe propre. Et quand le mot écrit finit par « é », les finales audibles préférées comptent aussi -ès, -et, -êt, -aient (/ɛ/) : « apré » → après (et non la coquille « aprés » du lexique), « succé » → succès, « foué » → fouet. Produit : 19 fausses devenues justes, 0 juste perdue sur les 3 corpus dys ; UD 14 450 : aucune marque nouvelle ni perdue (23 suggestions changées sur des mots rares déjà signalés) ; census des oranges justes 359 → 363 (une perdue : « loui » → lui, où le dys a justement écrit « ou » pour /y/). |
| « mot inconnu » : l'accent seul d'abord (« eclairait » → éclairait, plus « éclair ») | 🔧 LIVRÉ (2026-09-30, 2e catalogue : le tri des candidats) | le tri principal (spellTokenCore) classe la forme qui ne diffère que par les accents en tête, mais n'y propose rien sous 1/M : « éclairait » (0,2/M) tombait dans le repli « mot inconnu », où « éclair », homophone 41 fois plus fréquent, gagnait. Le repli classe maintenant l'accent seul d'abord — seulement si le mot écrit n'a AUCUN accent (le dys pose aussi des accents faux : « apré » → âpre serait faux), et sauf si un rival à UNE édition est ≥ 20 fois plus fréquent (« apre » → après, « lee » → le, « gallerie » → galerie). Mesuré sans les gardes : accent seul toujours d'abord, 5 bons mots perdus sur le gold seul (« apré » → âpre, « éta » → êta) ; mot sans accent seulement, 10 sur les 3 corpus (âpre, lée, gallérie, ché…). Mesuré : 44 suggestions deviennent le mot exact du gold, 1 perd (« echarpes » → écharpes, le gold met le singulier) ; UD 14 450 : aucune marque changée ; census inchangé. |
| genre du déterminant CONTREDIT par l'orange du nom (« la foret » → le, alors que « forêt » est proposé) | 🔧 LIVRÉ (2026-09-30, 2e catalogue : les mots justes touchés) | le genre du déterminant lisait le nom tel qu'écrit : « foret » (l'outil) est masculin, « pole » a le genre d'un autre mot — mais l'orthographe propose au même endroit, en orange, « forêt » ou « pôle », dont le genre s'accorde avec le déterminant écrit. Deux oranges qui se contredisent valent moins qu'une : relue avec la correction orange du nom (étape du voisin orange de diagnoseAll), la marque du déterminant se retire — seulement si le genre du nom corrigé est connu et égal à celui du déterminant. Mesuré : 4 marques retirées sur des déterminants justes du gold, 0 ailleurs, 0 bonne marque perdue ; UD 14 450 : aucune marque changée. Miroir Python dys_pipeline_probe.pyramide. |
| gérondif « en + -ent » en milieu de phrase (« en chantent » → chantant) | 🟠 LIVRÉ (2026-09-30, catalogue des muets) | le participe présent après « en » (orange, gerondifVig) ne tirait qu'en tête de segment ou après « tout » ; en milieu de phrase, « en » + forme en -ent restait muet, ou une règle sujet-verbe corrigeait le verbe en ROUGE (« en chantent » → chante). Il tire maintenant aussi devant une 3e pluriel écrite exactement, quand la lecture clitique est impossible : le mot d'avant n'est ni un sujet possible (pronom, quantifieur, nombre, mot au pluriel, nom propre) ni une conjonction, aucun pronom sujet ne suit (« pourquoi en parlent-ils »), le tagger n'y lit ni adjectif ni nom (« en excellent état »). Tous les groupes : le participe se forme sur le radical du « nous » — ce qui répare aussi « mangant », « commencant » (lemme désaccentué) en mangeant, commençant. Et aucune règle sujet-verbe ne corrige alors le verbe (garde centrale ; miroir Python _gerondif). Mesuré : 4 marques devenues justes, 0 juste perdue sur les 3 corpus dys ; UD 14 450 : aucune marque changée ; un premier essai (tous groupes aussi en tête de phrase) faisait 20 fausses alertes UD, presque toutes « En fait, … » → faisant. |
| élision manquante : la forme pleine devant voyelle (« je ai », « que il », « le arbre », « de eau », « ne a », « si il ») | 🔧 LIVRÉ (2026-09-30, catalogue des muets) | seule l'apostrophe remplacée par une espace (« c est », « qu il ») était vue ; la forme pleine restait muette partout. Étape « élision-espace » de spellText (flag, JS ; la référence Python n'a pas cette étape, la garde de palier ignore les marques à deux mots). Gardes, chacune née d'une mesure : écart blanc (« le 12 avril »), pas après un trait d'union (« prends-le avec toi »), voyelle seulement (h, y exclus : pas de table du h aspiré), clitique sans majuscule hors début de phrase (titres anglais), ni et/ou, ni oui/onze/ouate ; le/la/de : ni un/une, ni en/au, ni mot rare, ni pluriel après le/la ; je/ne/me/te/se devant un verbe ; pas devant un pronom sujet sauf après que/si (« la il » = là) ; « se étais » laissé à la règle du « je » mal écrit (→ j'étais). Mesuré : gold +9 ; EcriScol 3 et frgec 17 vraies élisions que ces golds ne corrigent pas ; UD 14 450 : 12 marques, toutes sur du texte fautif (5 vraies élisions manquantes du corpus, 7 phrases où UD a perdu un nombre ou un mot). |
| « ma / ta / jais » + participe masculin → m'a / t'a / j'ai (« il ta donné », « jais pris ») | 🟠 LIVRÉ (2026-09-30, catalogue des muets) | le possessif « ma/ta » (féminin) ne précède jamais un participe masculin, « jais » (la pierre) jamais un participe : l'apostrophe manque. Orange, étape élision-espace (JS). Gardes : participe écrit au masculin (« ma vue », « ma pensée » exclus), pas un nom féminin (« ma santé »), pas un mot qui est aussi un nom (P(NOM) ≥ 0,3 : « raconter ma mort », vu sur UD), « jais » ni après de/du/le (« noir de jais »). Mesuré : gold +2, 0 ailleurs sur les 3 corpus dys ; UD 14 450 : aucune marque. |
| ces/ses | 🟠/🟢 | carte enseignante (l'auteur tranche) |
| « ces/ses » pour « c'est » (« ses dans la boîte », « ces une recette », « ces vrai que ») | 🟠 LIVRÉ (2026-09-30, catalogue des muets) | un déterminant pluriel ne précède ni un autre déterminant, ni une préposition, une conjonction, « que », un infinitif, ni un adjectif ou un participe seul suivi d'un non-nom : c'est « c'est », en orange (famille « c'est/ces à vérifier », avant le modèle ces/ses qui ne proposait que l'un ou l'autre). Gardes : ponctuation ou trait d'union après ces/ses, nom propre, mot surtout nom, préposition + nom au pluriel (« ces sous groupes »). Derrière ce « ces », l'adjectif antéposé (qui écrivait « vrais » en ROUGE) et les oranges de pluriel se taisent. Mesuré : gold +6 « c'est » justes, 1 orange fausse retirée, 0 perte sur les 3 corpus dys ; UD 14 450 : aucune marque changée. Miroir Python _ces_cest. |
| ou/où | 🟠 LIVRÉ (2026-08-25) | **la famille la plus DENSE du corpus dys : 11 vraies fautes sur 23 occurrences de « ou » (48 %)**, lues une par une. 3 cadres à 0 FP sur 121 phrases UD correctes : ① « ou »+PRONOM SUJET ② nom de LIEU/TEMPS **déterminé** + « ou » + proposition à verbe ③ inversion « ou »+forme verbale+pronom. 7/11 trouvées. ⛔ REFUSÉS chiffrés : « ou »+verbe conjugué (14 FP — homographes nom/verbe : « rapide ou COURT », « le catch ou LUTTE ») · tête de proposition+verbe, LE seul cas de LanguageTool (2 FP pour +1) · le sens inverse « où »→« ou » (trop lâche). 📎 Les 3 contre-exemples de LT (« est ou était », « soudés ou est fixé », « Manger ou être mangé ») ne déclenchent RIEN chez nous : LT vaut mieux comme fournisseur de contre-exemples que de règles |
| quel/quelle (genre) | 🔴 | via accord adjectival |
| homophones lexicaux (vert/verre/vers, sceau/seau/sot) | ⛔→🟢 | indécidable sans sémantique ; couche verte « homophone à vérifier » sur liste |
| homophones nom / verbe en -ail/-aille, -eil/-eille, -el/-elle, -oi/-oie, -ui/-uie, -ai/-aie (« le travaille » → travail, « je travail » → travaille) | 🟠 LIVRÉ (2026-09-30, catalogue des muets) | un déterminant masculin ne précède pas une forme SEULEMENT verbale dont le nom masculin de même son est attesté ; un pronom sujet (clitiques permis entre les deux) ne précède pas un NOM sans lecture verbale dont la forme du verbe au présent est attestée (« tu » → -s). Orange « homophone à vérifier » (chaîne vigAt, JS). Garde née d'UD et de frgec : « le/leur » est pronom après un sujet, un clitique, un nom ou un prénom (« je le conseille », « le roi le renvoie », « Paul le rappelle »). Mesuré : gold +7, 0 ailleurs ; UD 14 450 : aucune marque (la première version en faisait 4). |
| près de / prêt de | 🟠 LIVRÉ (2026-08-12) | prêt/prêts sûrs ; prête/prêtes exigent une copule avant (« elle prête de l'argent » = verbe) ; clitique+infinitif exclu par POS |
| cher / chez | 🔴 LIVRÉ (2026-09-29, lot A du catalogue des muets) | « cher moi », « cher lui » → chez : devant un pronom TONIQUE, « cher » n'a jamais sa place. « cher le… » reste muet (« un cadeau cher le jour de Noël »). Gold dys 5, UD 0 |
| davantage / d'avantage(s) | 🟠 LIVRÉ (2026-08-12) | fin de proposition ou devant « que » seulement ; « pas d'avantage » (lecture nominale) exclu |
| quelque soit / quel que soit | 🔴 LIVRÉ (2026-08-12) | accord quel/quelle/quels/quelles par le verbe et le déterminant suivant ; 0 tir/14 450 UD |
| ce qui il / ce qu'il | 🔴+🟠 LIVRÉ (2026-08-12) | « ce qui il »→rouge (jamais correct) ; autres « qui+pronom »→orange ; gardes préposition (« avec qui il »), verbes de savoir (« je sais qui il est »), majuscule |

## 3. ACCORDS (LT : « Grammaire »)

| phénomène | état | note |
|---|---|---|
| sujet-verbe (13 fonctions : noms, pronoms, coordination, relative-objet, incise, postposé, quantifieurs…) | 🔴+🟠 | rouge sur cadres sûrs ; OS-sujet en vigilance sur le résiduel ; sujet postposé SINGULIER réparé (PR#472) |
| déterminant↔nom (nombre, les deux sens) | 🔴 | un seul sens par désaccord (PR#467) ; élidés exclus (PR#473) |
| déterminant pluriel + mot au singulier que la règle du nom laisse passer : homographe d'un verbe (« des plante »), MAUVAIS homophone (« les mure » → murs, pas « mures ») | 🟠 | « pluriel par le son à vérifier » (28/09/2026, `rule_pluriel_son` / `plurielSonVig`) : la grammaire dit la FORME, l'index phonétique du speller (SP.PHON) dit le MOT — même initiale, même consonne finale audible, marqué -s/-x, nom d'abord. Gold dys (produit en Node) : 24 pluriels muets → 5 ; 0 orange sur un mot juste ; UD 14 450 : 4 oranges, toutes sur de vraies fautes d'UD. Jamais : « les » pronom devant un verbe, infinitif, nombre, préfixe, nom propre qui continue |
| orange de pluriel (« accord pluriel à vérifier ») sur un INFINITIF | ✅ CORRIGÉ (2026-09-29) | « les juger » → jugers, « mieux vaut les oublier » → oubliers, « ces [se] reposer calmement » → reposers, calmements : derrière les/ces/ses, un infinitif dans le groupe (pronom « les », « ces » pour « se ») coupe l'accord. UD 14 450 : **20 fausses oranges en moins**, 0 en plus ; gold dys : 3 |
| nom au singulier après un nombre EN CHIFFRES (« 40 pommier ») | 🟠 LIVRÉ (2026-09-29, catalogue des muets) | orange de pluriel, canal `_SEG.num` (valeur de l'entier seul qui précède le mot) ; ≥ 2, jamais une année (1000-2100), une date (« le 25 mars »), une adresse (« 42 boulevard »), une unité (« 4 min »), un numéro (« saison 5 épisode »). UD : +2 vraies fautes du corpus, fausses alertes à l'équilibre (+2 / −2) ; gold : +1 |
| **le voisin orange** : une règle de grammaire lit la correction ORANGE de l'orthographe sur le mot voisin | 🟠 LIVRÉ (2026-09-29, lot B1 du catalogue) | `diagnoseAll` (JS) / `pyramide` (Python) relisent la phrase avec les corrections orange ; a/à, ou/où, élision fusionnée, -er/-é seulement (décident sur la NATURE du voisin) ; ce qu'elles trouvent en plus est ORANGE, et le rouge -er → -é qui lisait « a » comme avoir redevient orange — sauf quand le voisin dit « à » : ce -é se RETIRE (2026-10-03 : « une dificultée a parler » proposait « à » ET « parlé », qui se contredisent ; 1 seule paire de ce genre sur 28 772 textes dys + UD). Gold 674 → 667 muettes ; UD 0 marque |
| déterminant↔nom (genre) | 🔴 | table genre désaccentuée (PR#450→453) |
| participe avec être (+ prénoms) | 🔴 | 8 729 prénoms (PR#460) ; « du » SANS accent est l'article, jamais le participe « dû » (« ils sont du côté des perdants » → dus, « elles sont du même avis » → dues : ROUGES FAUX appliqués d'office jusqu'au 28/09/2026) ; locution « partie prenante » invariable (« elles sont partie prenante » → parties, rouge faux, même date) |
| **genre de la personne qui écrit** : « je suis allé / allée », « je me suis trompé / trompée », « je suis content / contente » | 🟠 LIVRÉ (2026-10-01, réglage décidé par Rem) | réglage « J'écris : sans préciser / au féminin / au masculin » (panneau de l'extension, page du correcteur du site) ; **sans réglage, rien ne change** ; réglé, le mot du cadre « je (ne) (me) + être » prend le genre du réglage, TOUJOURS en orange (l'information vient du réglage, pas du texte : un dialogue, une dictée, un texte écrit pour quelqu'un d'autre font parler un autre « je ») ; silences : « je me suis » + verbe à complément indirect (demandé, dit, permis, plu…), complément d'objet après (« coupé le doigt »), fait/vu/laissé + infinitif, guillemets, ligne de dialogue, ponctuation entre « je » et le mot, adjectif suivi d'un nom, adverbe (mal, fort) ; `auteurSugg` + `auteurPasse` (3 moteurs JS) ≡ `auteur_sugg` + `pyramide` (Python) ; gold, genre lu dans 19 textes : 7 muettes → 0, 5 mots faux → justes, 0 mot juste touché ; UD : 25 oranges au féminin, 27 au masculin, toutes sur un accord qui dépend du genre de qui écrit ; revue de littérature : `dictee/LITTERATURE_GENRE_ET_SENS.md` (Antidote a le même réglage) |
| participe avec avoir + COD antéposé (que) | 🔴 | rule_pp_avoir_cod |
| participe épithète · adjectif attribut/épithète | 🔴 | via tagger + _adj_head ; le GENRE du nom-tête se lit d'abord dans la table des COLLISIONS D'ACCENT puis dans GENDER_PURE (18/09/2026 : « le marché provençale » était muet — « marché »/« marche » partagent la clé sans accent). ⚠️ jamais la table accentuée BRUTE : mesurée, elle donne « f » aux noms épicènes et fabrique 8 rouges faux sur 14 450 phrases correctes ; couleurs tirées d'un nom INVARIABLES (« orange », « marron » ajoutés à `_INVAR_COLOR` le 28/09/2026 : « les rideaux sont orange », « des chemises orange » → oranges en ROUGE — paire de lexique orange/orangée, et « orange » dans la liste épicène, retiré à la source dans `build_epicene.py`) |
| attribut après un être AUDIBLEMENT pluriel (sont, étaient, furent, seront) : adjectif hors paire de genre ou lu VERBE par le tagger (« sont exploitable », « seront insolent »), participe irrégulier (« sont prise », « sont due ») | 🟠 | « accord adjectif à vérifier » / « accord participe à vérifier » (28/09/2026, `attributPlVig`, extension de `participeEtreVig` — JS seul, comme elle) : la marque du NOMBRE seule, genre écrit gardé ; sujet sûrement féminin (elles, groupe nominal féminin) → féminin ; « ils » + forme féminine → rien ; « êtes » exclu (vous de politesse). Gold dys après un être pluriel : fautes d'accord muettes **7 → 2** (les 2 restantes ont un « sont » mal écrit), 4 bons mots au clic, 1 nombre juste mais genre faux (« couvert » → couverts, gold couvertes : sujet derrière une relative), 0 marque sur les 22 mots justes. UD 14 450 : **+7 oranges, 6 sur de vraies fautes d'UD** (« les prix sont très raisonnable », « le service sont excellent »…), 1 sur une mention (« sont inférieur à, égal… »). Pièges gardés : bien sûr, mal, juste, même, sur, du, se + être, nombres, couleurs, épithète d'un nom qui suit |
| adjectif épithète, FÉMININ EN TROP sur un nom masculin (« le marché provençale ») | 🟠 | `genreAdjVig` / « accord genre à vérifier » : `_adj_estem` range toute forme en -e parmi les épicènes, donc les règles ROUGES savent ajouter un féminin, jamais en retirer — l'orange le propose. Articles simples + contractés (au/aux) depuis le 18/09/2026 |
| accord « tout » | 🔴 | règle dédiée (« tout étonnées » correctement laissé) |
| **participes invariables (fait/vu/laissé + infinitif, se sont succédé)** | 🟡 | pas de règle POSITIVE ; pronominal exclu des accords — ⚠️ SAUF avec un sujet nominal parsé, jusqu'au 28/09/2026 : « les enfants se sont succédé » → succédés (orange). Depuis : « se » COMPLÉMENT INDIRECT (verbes de `_PP_COD_STOP` : succéder, parler, plaire, nuire, sourire…) → participe invariable, rien |
| **accord SURNUMÉRAIRE après avoir, sans antécédent** (« elles ont mangés », « j'ai mangée ») | 🟡 | MESURÉ MUET dans Chrome le 08/09/2026 (10 phrases fautives, 10 silences). Le retrait d'accord n'existe qu'après le relatif « dont » (`rule_pp_avoir_dont`, 13 verbes) ; la connaissance « invariable avec avoir » n'est écrite que dans l'explicateur de DICTÉE, qui connaît déjà le texte de référence et ne détecte rien |
| vingt/cent (quatre-vingts, deux cents) | 🔴 LIVRÉ (2026-08-12) | nom PLURIEL exigé après (tue dates/ordinaux) ; millésime « mille neuf cent » exclu ; le seul tir UD était une vraie faute (« deux cent salariés ») |
| **adjectifs de couleur composés** | 🟡 | invariables simples couverts (listes) ; composés (« bleu foncé ») non signalés — mais jamais cassés |

## 4. CONJUGAISON

| phénomène | état | note |
|---|---|---|
| -é/-er/-ez/-ai (aux, modaux, « à », clitiques, causatif) | 🔴 | famille la plus travaillée |
| -é / -er quand un PRONOM, un adverbe ou « étant / une fois » sépare le verbe de ce qui le gouverne | 🔴 LIVRÉ (2026-10-03, catalogue des muets) | préposition qui gouverne un infinitif (de, à, pour, sans, par — jamais dans, sur, chez) ou modal + 1-2 pronoms + participe → infinitif (« de nous aidé » → aider, « par se levé » → lever, « doit m'aidé » → m'aider) ; modal à l'infinitif, sauf après un déterminant (« le pouvoir délégué ») ; « étant », « une fois » et l'auxiliaire avoir suivi d'adverbes → participe (« une fois rentrer » → rentré, « a tout de même doubler » → doublé) ; gardes : le / la / les sont aussi des déterminants (le mot ne doit être un nom pour aucune table : « sur la facilité »), « l' » collé exclu (« dans l'encadré »), « quant à lui », « à » désaccentué n'est pas « a » ; et « difficile à réparé » ne change plus « à » en « a » ROUGE (liste fermée d'adjectifs qui se construisent avec « à + infinitif » : c'est le verbe qui devient *réparer*) ; `rEer` / `_rAbase` (3 moteurs) ≡ `rule_e_er` / `_rule_a_aa_base` ; gold 588 → 582 muettes, 3 corpus dys +9 justes et 1 « à → a » faux retiré, 0 perte ; UD : 1 vraie faute d'UD corrigée, 0 marque sur un mot juste |
| « a » → « à » devant un VERBE : avoir + groupe nominal OBJET (« j'ai un livre a terminer », « il y a du travail a faire »), nom en -té écrit -ée (« une facilitée a dessiner ») ; et l'orthographe ne prend plus « à » pour l'auxiliaire « a » | 🟠 LIVRÉ (2026-10-03, catalogue des muets) | le groupe nominal qui suit AVOIR est son objet : le « a » d'après ne peut pas être un 2e auxiliaire → « à » en ORANGE, le verbe reste (avant : participe ROUGE « terminé », ou « ont » proposé) ; gardes : ponctuation, que / qui / et, pronom sujet, participe dans le groupe, « il y a » + durée, « un livre DE cuisine » remonte au déterminant ; `_aaObjAvoir` (3 moteurs) ≡ `_aa_obj_avoir`, `_AA_NOM` lit aussi -ée. Orthographe : « participe après auxiliaire » ne lit plus « à » comme « a » (« il apprend à rentrre » donnait « rentré » puis « à » → « a » ROUGE), ni un mot à « l' » / « d' » collé comme un participe (« il a l'âje » → l'âge) ; `spellTokenCore` ≡ `speller_probe`. 3 corpus dys : 1 « à » juste de plus, 1 verbe juste au lieu d'un participe faux, 1 « à → a » ROUGE faux retiré, 0 perte ; UD 14 450 : 0 marque |
| -é / -er après AVOIR avec « n' » ou « j' » collé (« il n'a pas manger », « je n'ai rien manger », « il n'a manger que du pain ») | 🔴 LIVRÉ (2026-10-03, apostrophes) | le « n' » collé cachait l'auxiliaire : `rEer` ≡ `rule_e_er` lit le mot sans « n' » / « j' » (avoir seulement : « ce n'est + infinitif » est juste ; l' / m' / t' laissés de côté — le participe peut s'accorder avec ce pronom, « il m'a aidée ») ; « rien » se saute comme un adverbe. 3 corpus dys : 1 juste de plus, 1 juste que le gold avait oubliée, 1 double faute (« noyer » pour « nettoyé ») qui reçoit « noyé » ; UD 14 450 : 1 vraie faute d'UD corrigée, 0 marque sur un mot juste |
| APOSTROPHE OUBLIÉE, le petit mot collé au suivant : fins COURTES (« il sest levé » → s'est, « il nest pas » → n'est, « je taime » → t'aime) et négation (« on narête pas » → n'arrête) | 🟠 LIVRÉ (2026-10-04, apostrophes) | la route d'élision collée de l'orthographe exigeait un reste de 5 lettres (« tai-chi » → t'ai) : A, liste FERMÉE de fins courtes par préfixe (flag ; « jai / nai / na » restent à « élision fusionnée », en rouge) ; B, après le décollage existant (qui garde les restes connus) : « n » + voyelle suivi de pas / plus / jamais / rien / guère / point, reste mal écrit → « n' » + verbe CONJUGUÉ de même son, accordé au pronom sujet (ORANGE). `spellTokenCore` (3 moteurs) ≡ `speller_probe`. 3 corpus dys : 2 mots faux deviennent justes, 0 perte ; UD 14 450 : 0 marque |
| « il la vu » → l'a vu ; « je lai vu » → l'ai vu ; « tu mas fait » → m'as fait (apostrophe oubliée, mot collé qui EXISTE) | 🟠 LIVRÉ (2026-10-04, apostrophes) | couche d'élision (3 moteurs ; pas de miroir Python, comme « ma / ta ») : « la » après un pronom sujet, « qui » ou « ne », « lai » après « je », « mas » après « tu », devant un participe masculin → ORANGE, mêmes gardes que « ma / ta » ; et `rFemEe` ≡ `rule_fem_ee` se tait quand « la / sa » suit un pronom sujet (« il la vu » recevait « vue » en ROUGE : « la » y est un PRONOM). 0 changement sur les corpus (la forme n'y est pas), UD 0 |
| « t'as / t'es / t'auras » (tu as / es / auras, écrit familier) comme auxiliaire : « t'as finis ton travail » → fini, « t'as manger » → mangé, « t'es aller » → allé ; et « javais » → j'avais | 🔴🟠 LIVRÉ (2026-10-04, apostrophes) | « t'as » n'est jamais « te » + as (« te » a un autre sujet devant) : `rEer` ≡ `rule_e_er` le lit comme auxiliaire ; `ppAvoirSurnumVig` ≡ son miroir ne l'exclut plus avec « t'a » (« il t'a vue » : le participe peut s'accorder avec « te » — exclusion gardée) ; « javais » (entrée parasite du lexique) dans `_APOS_FIX`. 0 changement sur les corpus et UD pour « t'as » (l'écrit familier n'y est pas) ; gold : « javais » réparé |
| Pluriel après un nombre en CHIFFRES, encore muet : « pour 5 euro », « 20 hectare », « 10 minute », « 3 kilo », « il mesure 2 mètre » | 🟠 LIVRÉ (2026-10-04) | `pluralVig` (3 moteurs ; règle sans miroir Python) : l'étiqueteur ne voit pas le chiffre et tague le nom PROPN → un mot en minuscule que NOUN_POST donne pour nom commun est accepté ; lecture verbale (« minute ») tranchée par NOUN_POST ; la garde « le nombre numérote le nom d'avant » (saison 5 épisode) ne lit plus « il MESURE 2 mètre » ; le silencieux appris (plTaisCarte, entraîné sur des déterminants) ne juge plus cette branche. Gardes : composé (« kilo-octets »), date (« le 25 maie »), année (« vers 405 »), locution (« grâce au »). Et une garde MORTE dans l'app : `NOUN_POST.get` n'existe pas là (objet, pas Map) — « saison 5 épisode » n'y était jamais protégé ; accès tolérant. Gold +2 ; 3 corpus dys +1 juste, 1 fausse orange retirée, 0 perte ; UD 14 450 : 2 marques orange |
| ce/se : « il ce lave » → se (juste après un pronom sujet, « ce » n'est jamais un déterminant) | 🟠 LIVRÉ (2026-10-04, homophones) | `rCe` ≡ `rule_ce_se` : le mot suivant peut être un verbe → « se », même s'il est aussi un nom (lave, porte, marche) ; gardes : ponctuation, nom de temps (« il ce matin »). 0 changement sur les corpus et UD |
| est → et quand il RELIE deux sujets : « le pain est le beurre sont sur la table », « le chat est le chien jouent » | 🟠 LIVRÉ (2026-10-04, homophones) | `_rEstEtCoord` ≡ `_rule_est_et_coord` : nom + est + (dét. singulier + nom | nom propre) + verbe conjugué au PLURIEL seulement — ce pluriel ne peut venir que de la coordination ; ORANGE ; la vigilance du sujet nominal (`sujFlexVig` ≡ `rule_sujet_flexion_nom`) ne propose plus « jouent → joue » en face ; 💡 dédié (« le verbe … est au pluriel : deux sujets, reliés par « et » »). 0 changement sur les corpus et UD |
| Conseils et 💡 des homophones avec le SON et le SENS (repères de Rem) : et se dit « é » (il relie), est se dit « è » (être : un état), ai se dit « è » (avoir : la possession), son va devant un nom (mon), se devant un verbe (il se lave), ce montre (ce chien, c'est) | 📝 LIVRÉ (2026-10-04) | `_HPROBE` (et/est, son/sont, et ce/se qui reçoit sa phrase-test « me »), REMED « j'est / j'ai » ; couche partagée app ≡ extension ; mode d'emploi : l'exemple « ce » reçoit son 💡 |
| infinitif de but après mouvement | 🔴 | PR#469 |
| impératif (-s euphonique, irréguliers) | 🔴 | |
| usage être/avoir | 🔴 | données complétées 2026-08-12 : familles tombé/parvenu/intervenu/survenu/redevenu + reparties (flood UD=0) ; garde COD « il a tombé la veste » |
| auxiliaire mal orthographié (ête) | 🔴 + 🟠 | **29/09/2026 (lot A)** : « il été content » → était, « j'été » → j'étais, en ORANGE (« il a été » est aussi possible) ; jamais « ça été » (= ça a été), jamais l'inversion (« a-t-elle été »). Gold dys 3, UD 0 |
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
| participe après avoir (« elle a grandit ») | 🔴 LIVRÉ (2026-08-20) | avoir + forme FINIE -it/-is jamais-participe dont la troncature EST un participe (grandit→grandi, finit→fini). Garde décisive : le participe tronqué doit EXISTER. 1 tir/16 950 = vraie faute UD (« il a réagit ») **Étendue le 28/09/2026** (« la même chose pour ont », Rem) : la consonne finale muette ÉCHANGÉE, même son, même fait — fais → fait, mit → mis, prit → pris, dis → dit, écris → écrit, conduis → conduit, dut → dû, voulut → voulu ; « était » → été ; après l'infinitif et le participe présent aussi (« d'avoir fais », « ayant mit ») ; eux → eu et prix → pris en ORANGE (homophones hors verbe ; jamais après « a » seul sauf « eux » + déterminant). UD 14 450 : +3 tirs, 3 vraies fautes d'UD (« la pose a était parfaite », « j'ai fais appel », « m'a permit »). Pièges gardés : participe accordé (« les tableaux que tu as vus »), relative (« tout ce qu'il a était à elle »), sigle (« la C2A était »), ancre créée par une autre correction (« nai » → « n'ai » : l'auxiliaire est relu tel que l'auteur l'a écrit, canal `_SEG.raw`). |
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
   ⚠️ *Vérifié dans Chrome le 08/09/2026* : « il a tombé » tire (`a`→`est`), « ils ont retournés »
   NON — et c'est VOULU : `retourner` est aussi transitif (« j'ai retourné la crêpe »), il ne peut
   donc pas entrer dans `AUX_ETRE_PP`, qui n'accepte que les intransitifs purs (FP=0 par liste
   fermée). C'est l'EXEMPLE de cette ligne qui est mauvais, pas la règle.
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
