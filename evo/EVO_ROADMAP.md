# Roadmap — OMEGA apprend à coder : auto-copie & croisement de générations

> Vision (Rem) : OMEGA **se copie** (reconstruit du code qui tourne) → deux instances **communiquent**,
> font émerger **leur propre code**, fabriquent **une nouvelle version d'OMEGA** → celle-ci recommunique
> avec la **précédente**, en recrée une autre → à partir de là, on **croise les générations**.
> Doctrine R66 : mesure d'abord, falsifie, OFF-inerte, **une brique à la fois**.

## Cadrage
- **Tâche = COPIER** (reconstruction / autoencodage), pas deviner. Fit le substrat **bPC/M3_d** (autoencodeur
  à codage prédictif), et **contourne l'absence de phonologie** du code (copier n'a pas besoin de la 2ᵉ route).
  > ⚠️ **Révisé par la mesure (voir État)** : (a) le bon substrat de copie est le **HDC/VSA 1024D** (`_emrg_bind`), *pas* le
  > goulot M3_d 12-cellules ; (b) une **2ᵉ route AIDE** — le « phon du code » = la **structure syntaxique**, et la croiser
  > (×) avec la surface remonte la fidélité. L'hypothèse « copier n'a pas besoin de 2ᵉ route » est donc **fausse**, mesuré.
- **Unité = caractère.** Critère de copie = **« code équivalent qui tourne »** (vérifié par comportement, pas byte-identique).
- **Langage = JavaScript** (OMEGA vit déjà en JS dans le navigateur → il peut **exécuter** ce qu'il copie → reward réel).

## Fitness = le PENDU comme test, LEXICOGRAPHIQUE
Réutilise le banc déterministe existant. Une copie/génération est valide si elle **tourne** ET :
1. **win rate** ≥ parent − ε  *(plancher : ne pas régresser)*
2. puis **min erreurs/partie**  *(efficacité cognitive — il y a de la marge, contrairement au win rate qui plafonne ~97-98 %)*
3. puis **min temps/partie**  *(efficacité du code — pousse vers du code plus court/rapide)*
Garde-fous : win rate = **contrainte dure d'abord** (sinon une copie « rapide » qui triche gagne) ; **graines fixes** ;
**temps relatif + multi-runs**. → implémenté dans `fitness_harness.js` (`fitterLex`).

## Phases (gated : on ne passe à la suivante qu'une fois la précédente mesurée)
- **P1 — se copie** *(en cours)* : reconstruire du code (caractère) qui **passe le pendu** (fitness ≥ parent).
  Jalon **quine** : reproduire **un bout de son propre code** en gardant le pendu.
- **P2 — communiquent** : 2 instances + **tâche coopérative récompensée** → **protocole émergent** → fabriquent
  une nouvelle version d'OMEGA. *Crux à définir : quelle tâche **paie** la communication (sinon pas de langage).*
- **P3 — générations** : nouvelle version ↔ précédente → recrée → **croisement** (réutilise `recordGene/breed/crossW`).
  *Crux : la **pression de progrès** = erreurs/temps/code plus court (le win rate n'a plus de marge).*

## Limite connue (mémoire §8.1)
Copier **fidèlement** tape dans le **mur de capacité** du concept (AUC familiarité 0,64 à 12 cellules ; K≈N pour stocker
à l'identique). Mesure clé de P1 : **jusqu'où la reconstruction tient** (longueur ? imbrication ? identifiants ?).

## État
- ✅ **P1 keystone** : `fitness_harness.js` — instrument réel, **headless, déterministe, tri-critère**, sur le vrai moteur.
- ✅ **P1 (b) — 1ʳᵉ mesure de fidélité** : `evo_p1_fidelity.js` (2 graines {12345,777}, lecture seule, OFF-inerte). Verdict :
  le substrat de copie **bPC (12 cellules) apprend en ligne** (‖bpcW‖ 2,27→2,79) mais **plafonne à ~0,65-0,75 d'erreur
  relative de reconstruction ‖m1−m̂‖/‖m1‖, PLATE de len 7→15**. Donc **pas un mur de *longueur* mais un plafond de
  *fidélité*** : 12 cellules gardent le *gist*, perdent ~⅔ du signal exact, à toute longueur. **Δ rote test−train ≈ +0,035**
  (petit) ⇒ ce qu'il garde est **structurel, pas par cœur**. Précise la §8.1 : le mur de capacité est un *ceiling*, pas une dérive en longueur.
- ✅ **P1 (b-bis) — copie sur le BON substrat (résolu, Rem avait raison)** : `evo_p1_vsa_copy.js` (2 graines, primitives
  RÉELLES du moteur). La capacité de copie n'est **pas** dans le concept 12-cellules mais dans le **HDC/VSA 1024D** :
  OMEGA encode déjà une séquence en hypervecteur via **`_emrg_bind`** (chaque lettre liée à sa position par `circularShift`,
  bundle normalisé). Décodé (unbind `circularShiftInverse` + cleanup cosine sur `letterVecsSDIM`), il donne **~95 % de
  lettres exactes, PLAT de len 7→22** (vs ~⅓ pour le concept) ; **mot exact** 83-85 %@7 → ~50 %@12 → ~30 %@15 → →0 @22.
  ⇒ le « plafond » de (b) mesurait la **mauvaise couche** (goulot cognitif) ; la capacité était déjà là, dans M1/substrat 1024D.
- ⚠️ **Limite restante = crosstalk VSA** (bundling additif), pas un plafond de substrat : l'erreur est la superposition,
  qui croît avec la longueur. Pour une copie *fidèle* (« code qui tourne » = mot exact ~100 %), brique suivante : **battre le
  crosstalk** — décodage **itératif / résonateur** (resonator network), **chunking** des longues séquences, ou **rappel
  adressable** (`_emrg_recall` : exact pour les items déjà au banc, avec marge mesurée).
- ✅ **P1 (b-ter) — le CROISEMENT bat l'addition (doctrine « OMEGA est un ensemble », Rem)** : `evo_p1_cross.js` (2 graines).
  Décoder **deux routes de liage indépendantes** (shift ×1 et ×7) puis **conjuguer** leurs posteriors par position
  (croisement = *intersection des contraintes*, **≠ ajouter du bundle**) relève le **mot exact** massivement :
  len 11 **45→70-82 %**, len 13 **47-55→62-75 %**, len 15 **23-38→50-55 %**, len 18 **20-30→45-57 %** ; *(len 22 : n=8, trop peu — non concluant)*.
  lettres +1-5 pts. Les pics de crosstalk diffèrent entre routes → le croisement les annule. ⇒ « **ni addition ni
  multiplication, c'est un croisement** » : *mesuré*.
  ⚠️ **Robustesse multi-graines (sweep nuit, `EVO_ROBUSTNESS.md`)** : le gain du croisement est **SEED-DÉPENDANT** — net sur
  2024/7 (+20 à +35 pts), mais **quasi nul sur seed 99** (routes pas assez indépendantes ce coup-là). À présenter comme un
  **gain conditionnel à l'indépendance des routes**, *pas* garanti. (Le principe addition≠croisement tient ; le *chiffre* de gain, non universel.)
- ✅ **P1 (c) — PIVOT VERS LE CODE** : `evo_p1_code.js` (2 graines). On arrête de polir le mot (proxy non-transférable) ; on
  copie du **vrai code** style-moteur. Équivalent phon/ortho **défini** : **surface** (caractère⊗position) × **structure**
  (classe syntaxique de la position = le « phon » du code, indépendant de l'orthographe des identifiants). Mesuré :
  - **code court (≤~50 car) : copie parfaite** (surface seule ~99-100 %) — *mieux* que les mots, car codebook `randomHRR`
    **orthogonal** vs lettres volontairement confusables (`letterVecsSDIM`).
  - **code long (107-120 car) : surface seule chute à ~72-80 %** → le bundle 1024D **sature au-delà de ~80-100 car**.
  - **croisement surface×structure : +9 pts caractères (83→92 %)**, +3-4 lignes exactes ⇒ une **2ᵉ route AIDE** (révise le
    Cadrage « copier n'a pas besoin de 2ᵉ route », qui était faux).
  - **MULTIPLY ≥ ADD** constant sur les lignes dures (92,5 vs 92,1 %) → « **multiplier pour copier** » confirmé (marge petite
    car la route structure est grossière = classe de caractère ; une vraie route token l'élargirait).
- ✅ **P1 (d) — la PYRAMIDE, pas la ligne (réflexion dictée, Rem)** : `evo_p1_pyramid.js`. DECOMPOSE.md = hiérarchie
  (graphèmes→syllabes→morphèmes) + **double voie** : les **règles** (sublexical) régénèrent le **régulier**, on ne **stocke
  que l'irrégulier** (mesuré dictée : 51 % phonos reconstructibles, 4,63 bits/ph, **17× factorisé**). ⇒ mon bundle
  char⊗position était une **LIGNE** (stockage plat K≈N = *le mur §8.1*). **La pyramide ne stocke que les exceptions → dissout
  le mur.** Première mesure côté code (propre code evo/, held-out) : une règle **grossière ordre-2** régénère déjà **30 %**
  (≈6 bits/token) — **PLANCHER** (la vraie pyramide = AST/grammaire fait bien plus ; la dictée = 51 % sur tâche plus dure).
- ⚠️ **Reframe du mécanisme de copie** : ce n'est PAS un bundle VSA de la ligne (mon erreur) — c'est **décomposer (pyramide)
  → régénérer le régulier par règles + stocker l'irrégulier compressé**. Le VSA ne sert qu'au **résidu irrégulier**, à son étage.
- ✅ **P1 (e) — décomposeur HIÉRARCHIQUE (pyramide + double voie)** : `evo_p1_hier.js`, sur le propre code d'OMEGA (arbre
  d'imbrication, profondeur max 9). **Squelette grammatical** (mots-clés+symboles) = **60,8 %** des tokens de contenu ;
  **identifiants ~7× dédup** (route lexicale = stocker 1 fois + références) ; **feuilles uniques
  irréductibles = 6,0 %**. gzip (compression auto conservatrice) = **3,6×**. ⇒ **le mur K≈N était l'artefact du stockage
  plat** : on stocke ~6 % de feuilles + recall, le reste = grammaire. Logique dictée (51 % / 17×), transposée au code.
  *Honnêteté* : 60,8 % = la *part* structurelle (la grammaire donne la forme, le symbole exact coûte qq bits) ; le chiffre
  atteignable « automatique » est le gzip 3,6× — un modèle qui *connaît* la grammaire JS ferait mieux.
- ✅ **M3_d RÉSOLU (Rem avait raison)** : la doc `docs/COGNITION_DESIGN.md` (commandée par Rem après le diag OOV) tranche —
  M3_d reçoit un **« concept global/longueur » (§1.4.2)**, « **spoke pauvre = longueur** » (§1.8.2), **winrate-inerte**
  (« M3_d tourne mais sa sortie est jetée » ; bypass = winrate identique), prescription **« ni construire dessus ni le
  laisser décider »**. Donc « M3_d = longueur » = juste, et on **ne bâtit PAS** la copie sur M3_d. (Mon `diag_bpc` voyait la
  spécialisation longueur faible/floue → c'est cohérent : spoke pauvre.)
- ✅ **P1 (f) — RÉGÉNÉRATEUR par CODAGE PRÉDICTIF (bPC), reconstruction VÉRIFIÉE exacte** : `evo_p1_predcode.js`. Doc §3
  (Rao&Ballard/Friston) : descendant = **prédictions**, montant = **erreur résiduelle**. Prédicteur **contextuel ordre-k**
  (le bPC « fait correctement » prescrit ; **hors M3_d**) ; on n'encode que les **miss** ; on **reconstruit** et on **vérifie
  l'identité exacte**. Résultat (propre code d'OMEGA, **lossless ✅ tous ordres**) : régénéré **ordre-2 61,5 % → ordre-5
  90,5 %** ; résidu ordre-5 = **9,5 %** (gzip du résidu ≈ 0,4× le brut). ⇒ **OMEGA se copie pour de vrai par prédiction+erreur**,
  pas en stockant la ligne. Compromis résidu↔grammaire (contextes) = **MDL** (garde §3 du moteur).
- ✅ **P1 (g) — JALON QUINE VÉRIFIÉ** : `evo_p1_quine.js`. OMEGA lit le source de ses propres fonctions (`toString`), les
  **recopie par codage prédictif** (bPC ordre-6, **hors M3_d**), les **ré-instancie avec leur CLÔTURE** (deps + globals
  `DEBUG` + état `_shiftBuf` + `SDIM`), et elles **tournent à l'identique** sur entrées aléatoires (`cosineSim`, `normalize`,
  `circularShift`, `circularShiftInverse` : byte-exact ✅ + comportement ✅). **Leçon** : une fonction runnable = un **nœud du
  graphe d'appel + sa clôture** (la pyramide), pas une ligne — copier l'unité = copier sa clôture.
- ✅ **P1 « se copie » PROUVÉ au niveau fonction** : reconstruction lossless (prédire+erreur) + exécution vérifiée. Le mur
  §8.1 (K≈N) était l'artefact du stockage plat ; bPC + clôture (pyramide) le résolvent — **sans M3_d**, conforme à la doc.
- ✅ **P1 (h) — frontière MODULE/AST TRANCHÉE (autonomie) + interface AUTO-DÉCOUVERTE** : `evo_p1_module.js` (graphe de deps →
  clusters cohésifs : modules de **17/7/7/3/2 fn**) + `evo_p1_quine.js` amélioré. **Décision** : unité de copie = **MODULE**
  (cluster, calculé du graphe — robuste) **+ INTERFACE** (symboles externes). **Aucun parser statique dispo** (acorn/esprima/
  babel absents) → l'AST-lite **sur-compte** (fuite de scope, mesurée) ; l'interface EXACTE se **capture au RUNTIME** (catch
  « X is not defined » → fournir depuis le moteur → réessayer). Le quine la **découvre seul** : interface de la clôture
  `circularShift` = **`{ DEBUG, _shiftBuf }`** (byte-exact ✅ + comportement ✅). ⇒ copie **bornée** (module + interface observée),
  pas l'explosion de clôture du monolithe. *C'est la pyramide au niveau module.*
- ✅ **P1 (i) — QUINE GRANDEUR RÉELLE VÉRIFIÉ** : `evo_p1_realquine.js`. OMEGA recopie **5 fonctions de DÉCISION** (`cosineSim`,
  `circularShift`×3, `normalize` — exercées par concept-bind/readout pendant le jeu) par bPC (**byte-exact ✅**), les **patche
  dans le moteur vivant**, et le pendu **rejoue à fitness identique : winrate 93,3 % → 93,3 %**. Contrôle de **falsification** :
  `cosineSim` corrompue (négation) → **winrate 90 % (CHANGE)** ⇒ les fonctions recopiées sont **réellement sur le chemin de
  décision** (test non vide). ⇒ **P1 « se copie » prouvé grandeur réelle**, sur du code de décision, dans le pendu vivant.
- ✅ **P1 « SE COPIE » ESSENTIELLEMENT COMPLET** : (b)→(i) — substrat VSA 1024D · croisement · pyramide · bPC (prédire+résidu) ·
  quine fonction · frontière module + interface runtime · quine grandeur réelle (fitness préservé, falsifié). **Le mur §8.1 dissous.**
  ⚠️ **Nuance honnête (audit 27/06)** : le lossless = **prédiction LÀ OÙ ELLE MARCHE + résidu mémorisé sinon**. Sur les fonctions courtes
  (`circularShift`, `circularShiftInverse`), le prédicteur ordre-6 a **hit ≈ 0** (`p1_capture.json`) → elles sont reconstruites **~100 % par
  résidu verbatim**, pas « par prédiction ». Le byte-exact tient (c'est mesuré), mais « se copie PAR PRÉDICTION » ne vaut vraiment que pour
  `cosineSim`/`normalize` (hit 16-20 %). À dire tel quel : *copie fidèle = prédire ce qui est régulier, stocker le reste*.
- ✅ **P2 (a) — CRUX ÉTABLI & MESURÉ : le pendu référentiel PAIE la communication** : `evo_p2_referential.js`. A voit le mot,
  « souffle » k lettres à B (canal = k symboles), B (moteur, cognition seule = marge) joue. Mesuré (150 mots len 8-12) :
  **89,3 % (k=0) → 94,7 → 96,0 %** [A aléatoire] · **→ 98,7 → 100 %** [A malin = lettres rares]. (1) **communiquer PAIE**
  (winrate ↑ avec la bande, sanity monotone ✅) ; (2) **le CONTENU compte** (malin > aléa **+4 pts** à bande égale) ⇒ un
  **encodage optimal à APPRENDRE** = le gradient qui fait émerger un langage. *C'était LE crux de P2 (« quelle tâche paie ») — répondu.*
- ✅ **P2 (b) — PROTOCOLE ÉMERGENT : un langage émerge du REWARD SEUL** : `evo_p2_emergent.js`. A part de `value=0`, explore,
  apprend par **reward contrastif** (gain marginal = gagné-avec − gagné-sans) quoi envoyer. Résultat : winrate B **90,6 % → 97,5 %**
  (epochs), held-out **96,7 %** (vs 94,7 % aléatoire, plafond 98,7 %). **Un code utile a émergé, jamais soufflé** — A envoie des
  consonnes informatives (`UGMCZL`). *Nuance honnête* : A converge vers le **modérément rare (apprenable)**, pas le rarissime
  (`WKJXYQ`, trop sparse → crédit non fiable, rho 0,15 **attendu**) ; le bon critère = le **winrate**, pas la corrélation à un
  optimum injoignable. ⇒ **« inventer son langage » démontré, ancré dans la tâche.**
- ✅ **P2 (b+) — RAFFINEMENT : politique RELATIVE AU MOT → PLAFOND ATTEINT** : `evo_p2_emergent2.js`. Le learner global (b)
  plafonnait à 96,7 % car une value **par lettre** ne capte pas « envoie la rare DU MOT ». Politique par **rang de rareté**
  (relative au mot) + **softmax anti-lock-in** (1ʳᵉ version argmax se verrouillait sur un rang sous-optimal → diagnostiqué →
  corrigé) : A apprend `value[rang 0]=40 ≫ autres` = « envoie la plus rare du mot », **éval held-out 98,7 % = le plafond P2(a)**.
  ⇒ le plateau n'était **pas** un échec d'apprentissage mais une **limite de classe de politique** ; la bonne représentation
  atteint l'optimum. *(Honnête : 1ʳᵉ tentative argmax 94,7 % — verrouillage — avant le fix softmax.)*
- ✅ **P3 (a) — GÉNÉRATIONS & CROISEMENT (sélection mesurée)** : `evo_p3_generations.js`. Population de « versions » (génomes =
  params de cognition) sélectionnée par la **fitness tri-critère** (`fitterLex` : plancher winrate → min erreurs → min temps),
  **croisée** (crossover + mutation) sur 7 générations, mots len-7 (durs). Résultat : winrate **saturé à 100 %** (« plus de
  marge » — *exactement le crux roadmap*) → la pression **bascule sur les erreurs** : **0,175 → 0,113 erreur/partie** (−0,062),
  par croisement. ⇒ **les générations améliorent la fitness via la 2ᵉ clé lexicographique** quand le winrate plafonne. La boucle
  *se-copie → versions → sélection → croisement* tourne.
- ✅ **P3+ — ÉVOLUTION DU CODE (spectre de mutation mesuré)** : `evo_p3_code_evo.js`. Boucle darwinienne sur le VRAI code :
  reproduction = copie **bPC** (byte-exacte, quine) · variation = **mutation/croisement du source** d'une fonction de décision
  (`cosineSim`) · sélection = **pendu**. Spectre de 40 mutations (état RAZ entre évals → indépendantes) : **75 % létales · 3 %
  délétères · 23 % neutres (silencieuses) · 0 % bénéfiques** ⇒ la fitness pendu est un **vrai filtre sélectif sur le code**
  (78 % dégradent ; 0 bénéfique = moteur déjà tuné ; 23 % silencieux = carburant de dérive neutre, ≈ mutations synonymes).
  *Limite honnête (mesurée)* : une **lignée multi-générations en moteur vivant se contamine** (NaN dans l'état persistant ;
  `validatePhoneticInit` utilise `cosineSim` ; le ré-init ne récupère pas) → évolution fidèle exige une **isolation par variant
  (process séparé)** ; le spectre (reset par mutant) est fiable, la lignée cumulée non. *(2 artefacts attrapés : 20 % bénéfique
  fantôme par contamination, puis lignée à 8,3 % — retirés par honnêteté.)*
- 🔑 **P3 — LE BON GÉNOME (Rem : « les gènes correspondent à quoi dans le réel d'OMEGA ? ») + littérature** : `evo_p3_genome.js`.
  Contre-épreuve **mesurée** — même moteur/méthode, génome = **paramètres continus** (perturbation gaussienne d'un seuil/poids) :
  **0 % létal · 13 % délétère · 57 % neutre · 30 % BÉNÉFIQUE** ; vs génome = **tokens du source** (P3+) : **75 % létal · 0 %
  bénéfique**. ⇒ **l'évolvabilité dépend de la carte génotype→phénotype (la *représentation*), pas du moteur** — exactement
  **Wagner & Altenberg (1996)** (modularité / faible pléiotropie ; « mutation pas universellement efficace sur les programmes »).
  **Les gènes d'OMEGA = ses PARAMÈTRES/POIDS** (config, θ=α/β, poids M/bPC/readout, règles g2p appris), **PAS son source**
  (brittle = piège GP classique). Le source = le *programme développemental* (reproduit par bPC) ; les gènes évolvables = les
  params (cf. **NEAT** évolue les poids ; **Grammatical Evolution** garde le code syntaxiquement valide). Les **57 % neutres =
  réseaux neutres** (Kimura ; Banzhaf) = carburant de la dérive/évolvabilité. ⇒ **P3(a) (gènes config) était au BON niveau ;
  P3+ (source) au mauvais** — « ce qu'on faisait mal » identifié et mesuré. Croisement : splicer du source détruit les blocs
  (pas de modularité) → croisement **blend/uniforme sur le génome param** (modulaire) est le bon opérateur. Littérature + sources
  documentées dans **`evo/EVO_P3_EVOLVABILITY.md`** (Wagner & Altenberg, Banzhaf/Hu, Grammatical Evolution, NEAT, Kimura).
- ✅ **P3 (b) — LIGNÉE PROPRE sur le bon génome** : `evo_p3_lineage.js`. Lignée 8 générations sur le génome **param** (croisement
  **blend** + mutation gaussienne, sélection tri-critère, état RAZ = indépendance ; pas d'isolation process car les params ne
  corrompent pas l'init). Résultat : réf err **1,40** / 92,5 % → lignée err **1,163** / **95,0 %** = **−0,237 err SOUS la réf,
  winrate maintenu** ⇒ les générations **trouvent une meilleure version** (les 30 % d'erreurs utiles exploitées). **✓ HELD-OUT
  validé** (`evo_p3_holdout.js`) : meilleur sur len-7 **non vus** (95,0 % / 1,195 vs réf 94,0 % / 1,275), neutre sur len 8-10
  (autre distrib) → **généralise, pas du tuning local**. C'est « inventer une meilleure version d'OMEGA », **proprement, sur le bon génome.**
- 🔹 **Illustration compacte du croisement (`evo_generations.js`)** : deux versions (génomes params) **combinent leurs gènes**, le **pendu
  juge** l'enfant — une mini-démo *one-shot* (1 seed) de l'opérateur de P3. ⚠️ **Le résultat RIGOUREUX de P3 reste la LIGNÉE P3(b)** (8 gén,
  held-out validé, ci-dessus) ; cette démo n'en est qu'une vue courte, et son « champion 97 % vs réf 96 % » **1-seed** est à lire comme tel
  (le stress-test ci-dessous montre qu'il ne tient pas multi-seed — c'est une borne d'ampleur, pas un nouveau record).
  *Note de cadrage (Rem)* : le thread **O1** (vote / routeur / cascade) est une étude de **coordination**, **à côté de l'A→Z** (P1→P2→P3) — un
  **objectif futur** (backlog), pas une brique d'EVO démontrée. (J'avais confondu *fitness* et *tâche* en voulant brancher de vraies versions
  pour « voter des coups » — O1 n'est pas la ligne `se copie → communiquent → générations`.)

- 🔬 **STRESS-TEST des AMPLEURS (2026-06-26 — Rem : « muscler les preuves avant le visuel » ; `evo_p3_robust.js`, `evo_o1_robust.js`)** —
  *précise l'A→Z démontré (Bilan + audit ci-dessous), ne le falsifie pas :*
  - **P3 in-lex — on ne dépasse pas une réf DÉJÀ TUNÉE (plafond), mais la lignée tient.** Croisement *one-shot* de parents aléatoires vs réf
    tunée (6 seeds, held-out 80) = **match nul** (Δwinrate ≈ 0, Δerr ≈ 0). ⚠️ **N'infirme PAS la lignée P3(b)** (qui part d'une version *faible*,
    err 1,40 → 1,163, held-out ✅) : au plafond in-lex (~97 %) il n'y a pas de marge pour battre une bonne réf, mais l'**évolution depuis un point
    faible marche** (mesuré, P3(b)). Les deux sont vrais — c'est une **borne d'ampleur**, pas une falsification. Le « 97 vs 96 » 1-seed d'`evo_generations` était optimiste.
  - **O1 (backlog, PAS l'A→Z) — la division ne généralise pas.** Routeur K=80 fixe, **300 mots × 6 seeds** : équipe **−2,95 pt vs monolithe,
    0/6** (le « 72,5 % > 67,5 % » était sur-appris sur 80 mots). O1 reste un **proxy** (heuristiques, jamais `omegaStep`) et un **objectif futur** —
    honnêtement négatif **pour le backlog**, sans toucher à EVO (P1/P2/P3).
  - **Ce que ça change vraiment** : l'A→Z (P1 ✅ se copie, P2 ✅ communiquent, P3 ✅ générations) **tient** ; ce stress-test **borne les ampleurs
    in-lex** (modestes, plafond ~97 %) et **écarte le backlog O1**. Le **vrai relief** est ailleurs → l'OOV ci-dessous.

- ✅ **EXTENSION OOV de P3 — l'évolution EN GRAND, là où il reste de la marge (2026-06-26 — idée de Rem : « chercher l'évolution où il reste
  du JEU » ; `evo_oov_*.js`)** : même mécanisme que P3 (sélection sur le génome param, le pendu juge), mais en **hors-lexique** (Trexquant) où
  OMEGA n'est **PAS au plafond** (~55-66 %) → le génome **a de la prise**. *D'abord* le bon terrain : la config OOV optimale est
  **`OS_ARB` seul** (~63 %, le gap-aware **dégradait** ici ; pointeur toggles de Rem). *Puis* le levier : **`M_NEO_OS_ARB_CONF`** — monter le seuil
  de l'arbitrage sublexical fait **défférer les guesses peu sûrs** (au lieu de les jouer). **Mesure HORS ÉCHANTILLON** (valeur 0,30 choisie sur
  seed 12345, testée sur **5 autres seeds**) : **+14 pt en moyenne, 5/5 seeds out-of-sample**, **~57 % → ~71 %** (réf → évolué ; `evo_oov_evolve.js`,
  `oov_capture.json`). **Le gain d'évolution le plus NET mesuré du projet** (P3 dans le régime à marge). **✓ in-lex NEUTRE** (le gain OOV ne coûte rien :
  `evo_oov_pareto.js` 3 seeds → in-lex +1,3 ; capture 1 seed → −0,8 ; soit **≈ 0**). ⚠️ *Caveat* : l'absolu (~71 % à 5 seeds ; **gros N 2 seeds = ~74 %**)
  **dépasse la bande SOTA (65-68 %)** sur petits échantillons → **à confirmer sur gros N / œil externe**. Le **gain relatif (+14, robuste) est solide**.
  *(Nuance audit : `arbConf=0,30` n'est PAS l'optimum du sweep — `0,15` fait 75,8 % vs 75,0 % à seed 12345 ; le balayage fin reste à faire.)*
  ⟵ **La leçon** : l'évolution se voit là où il y a de la MARGE (OOV), pas au plafond (in-lex saturé). Les deux instincts de Rem (muscler + viser l'OOV) étaient justes.
- ⏳ **Reste P1** (mineur) : config de référence (~90 %) dans le harnais ; prédicteur **hiérarchique** (optimisation du résidu).
- ✓ **Suite OOV (gros N fait)** : 350 mots × 2 seeds → l'absolu **TIENT** (~74 %, ne régresse pas). ⏳ reste : balayer arbConf 0,30→0,60 (optimum ?) ; œil externe sur l'absolu vs SOTA.

---

## Bilan (sessions juin 2026) — la vision démontrée bout-à-bout
**P1 se copie** ✅ (bPC prédire+résidu, quine fonction/module/grandeur-réelle, fitness préservé+falsifié, mur §8.1 dissous) ·
**P2 communiquent** ✅ (le pendu référentiel paie la communication ; protocole **émergent** : A invente un code du reward seul) ·
**P3 générations** ✅ (sélection tri-critère + croisement améliorent la fitness de génération en génération). Reste : raffinements
(politique relative au mot, variation par code bPC réel, prédicteur hiérarchique). *Tout mesuré, commité, honnête (y compris les
erreurs de couche corrigées et le premier learner P2 qui échouait).*

> **Stress-test + extension (26/06, Rem)** — *ne remet pas en cause l'A→Z, le précise* : les ampleurs **in-lex** sont **modestes**
> (plafond ~97 %, gains sur la 2ᵉ clé/erreurs) et le **backlog O1 (groupe) ne généralise pas** (proxy, falsifié hors échantillon).
> **Mais** l'évolution P3 donne un **gain NET en hors-lexique** — gène `M_NEO_OS_ARB_CONF`, **+14 pt OOV** (5 seeds out-of-sample), in-lex ≈ 0 —
> *là où il reste de la marge*. ⇒ **l'A→Z tient ; son plus haut relief est en OOV.** (Détail : bloc « stress-test » + « extension OOV » de l'État.)

> **Audit indépendant (06/2026)** — re-run des 13 briques EVO et comparaison aux chiffres de cette roadmap : **fidèle, aucun
> surclamage** ; tous les chiffres-titres reproduisent (souvent à la décimale). Corrigés depuis : quelques **absolus périmés**
> (le corpus evo/ a grossi → rendus en ratios/%), `bits/token 6,16→~6`, et le **croisement len-22 (n=8)** clarifié comme
> *seed-bruité, non concluant*. Raffinement P2+ ajouté (plafond 98,7 % atteint).

> **Sweep robustesse multi-graines (nuit 25→26/06, `evo/EVO_ROBUSTNESS.md`)** — **CI 27/27 ✅** (sans même le quirk bake) ;
> 4/4 briques déterministes (quine, bon-génome, lignée, held-out) tiennent leur verdict ; `evo_p1_code`/`evo_p1_fidelity`
> **stables** sur toutes les graines. **À nuancer** : le **mot exact aux grandes longueurs** (copie VSA brute) et surtout le
> **gain du croisement** sont **partiellement seed-dépendants** (seed 99 les abaisse). Les claims *structurels* tiennent ; les
> *chiffres de mot-exact long isolés* ne sont pas garantis — ne pas les citer hors contexte.

---

## Objectifs futurs (backlog — ⛔ NON faits, planifiés ; à mesurer avant de croire)

### 🆕 O1 — TRAVAIL DE GROUPE / objectif commun (Rem)
Passer des **2 instances** de P2 (pendu référentiel) à un **GROUPE** (N>2) qui coopère vers un **but partagé** : spécialisation de
rôles, **division du travail**, résolution collective, consensus/vote. Construit sur P2 (langage émergent) + P3 (générations qui
produisent des **versions spécialisées** susceptibles de coopérer).
- **Crux (comme P2)** : quelle tâche **récompense la COOPÉRATION** — qu'un seul agent ne résout pas, mais que le groupe oui ?
  (ex. problème trop dur en solo → division ; ou agrégation/vote qui bat le meilleur individu). Sans pression coopérative, pas de groupe.
- **Première brique mesurable** : 1 tâche où la perf du groupe > meilleur solo (sinon le groupe est inutile), puis émergence de rôles.
  ✓ **BASE posée (`evo_o1_group.js`)** : roster d'agents divers (score-lettre sur le vrai lexique) + **vote d'ensemble** (softmax) + mesure **groupe-vs-solo**. Mesuré (pendu len-7, budget serré) : le **groupe de 4 agents FORTS & divers = 70,0 %** vs **meilleur solo 68,3 %** → **la coopération PAIE (crux franchi)**, *modestement* (+1 mot/60, à robustifier sur plus d'agents/graines). **Nuance clé** : le groupe COMPLET (avec 2 agents faibles) retombe à 68,3 % — la coopération *naïve* est tirée vers le bas par les faibles.
  ✓ **Étape 1 — arbitrage par FIABILITÉ (faite)** : mécanisme affiné par la mesure — le bon réglage est de **GATER l'incompétent**
  (auto, par track-record : winrate ≥ seuil) puis **poids ÉGAL** entre compétents → groupe complet **70 %** > meilleur solo
  (drag corrigé ET diversité gardée). Le poids *proportionnel* au winrate, lui, sur-concentre sur le meilleur (68,3 %, perd la
  diversité). ⇒ c'est l'**arbitrage-par-fiabilité que l'OS d'OMEGA fait déjà**.
  ✓ **Étape 2 — DIVISION DU TRAVAIL (faite, `evo_o1_roles.js`)** : des spécialistes par PHASE + un **routeur** (par taille de
  cohorte) : **ouvreur** (positionnel/fréquence) tôt, **finisseur** (cohorte) tard. Mesuré (len-7, budget serré) : l'**équipe =
  72,5 %** > **meilleur monolithe 67,5 %** (+5 pts/4 mots), gain **robuste sur la plage K=20→150**. Le point-clé : l'**ouvreur
  seul = 2,5 %** (inutile isolé) mais **précieux dans l'équipe** — il couvre l'ouverture que la cohorte rate. *C'est la vraie
  division : chaque rôle résout une phase que l'autre échoue.*
  ✓ **Point 3 — COORDINATION ÉMERGENTE (`evo_o1_emergent.js`)** : la société d'agents apprend, **du seul reward**, un protocole de
  routage par phase (contexte = taille de cohorte) — le « langage » de P2 appliqué au groupe d'O1. **Le REWARD fait tout** :
  — reward **MYOPE** (« lettre correcte ? » par coup) → **66 %** : apprend la fiabilité mais **pas** la division (aveugle à la valeur
  *séquentielle* de l'ouvreur), même **pire** que le monolithe ;
  — reward au niveau **PARTIE** (gagné/perdu, crédité aux routages utilisés, REINFORCE+baseline) → **72,5 %** : **bat le monolithe
  (71 %) et ÉGALE le routeur câblé (72,5 %)** — mais **appris, pas codé**.
  ⇒ le premier « échec » du point 3 était un **artefact de mauvais objectif** (j'optimisais « toucher des lettres », pas « gagner ») ;
  avec l'**issue de partie**, la coordination émergente **rejoint le hand-design**. **L'intégration O1+P2+P3 tient** (versions diverses
  + société + protocole *appris*) et le bon signal = **l'issue de PARTIE**. *(Bug attrapé : `g.add` oublié → boucle infinie ; corrigé.)*
- ✓ **Bonus — JOUER EN CASCADE (`evo_o1_cascade.js`)** : les agents en chaîne de priorité (façon *cascade des declares* d'OMEGA :
  le 1er confiant tranche, sinon il cède). Mesuré : **65 % < monolithe 67,5 %** — *échoue*. POURQUOI : la cascade cède à l'ouvreur
  dès que la cohorte n'est pas nette, mais l'ouvreur n'est bon **que très tôt** ; la confiance par *top-fraction* n'isole pas ce régime.
- 🔑 **Synthèse O1 — 3 mécanismes de coordination, et LA leçon** : VOTE (ensemble, groupe>solo modeste) · ROUTEUR (gate par **taille
  de cohorte**, 72,5 %) · CASCADE (chaîne de confiance, 65 % — **échoue**) · COORDINATEUR APPRIS (**reward-partie**, 72,5 %, émergent).
  **Le *mécanisme* compte moins que le SIGNAL qu'il utilise** : taille-de-cohorte et issue-de-partie sont *bons* ; correction-par-coup
  (myope) et top-fraction (cascade) sont *mauvais*. La coordination vaut ce que vaut son signal.
  ⚠️ **CAVEAT (voir MUSCLE TEST plus haut)** : ces chiffres O1 (72,5 % etc.) viennent de **80 mots** et d'un K **sur-appris**. Sur
  **300 mots × 6 seeds**, l'avantage de division **disparaît** (équipe −2,95 pt vs monolithe, 0/6). À ne PAS présenter comme un gain établi.
- ✅ **Suite O1 — FAITE (`evo_o1_real.js`, 200 mots × 3 graines, vrai `omegaStep`) — verdict NÉGATIF, instructif.** De vraies versions (génomes de paramètres : conf NEO, recall margin, g2p, toggles cohorte/phon) au lieu des proxys :
  - **(1) Vote pur par coup = non implémentable proprement** : pour faire voter K versions sur un MÊME board il faut forcer l'état ; or forcer `alreadyTried` ne reproduit PAS le « révélé » caché du moteur (sonde : forçage ≠ jeu naturel dès le 2ᵉ coup), et on ne lit pas le monolithe (doctrine). Mécanisme écarté.
  - **(2) En lexique, RIEN à coordonner** : versions compétentes **96-97 %** (ref 96 · cohorte-OFF 97 · conf-bas 97 · g2p 97 · conf-haut 94,8 ; phon-OFF cassé 39), **regroupées sur 2,2 pts** (plafond ~97 %), **désaccord 1er coup ≤ 10 %**. Ni marge ni complémentarité → un groupe **ne peut pas** battre le meilleur solo (97 %). *Confirme AU VRAI MOTEUR la falsification hors-échantillon du proxy (MUSCLE TEST) : le « gain » proxy était un artefact d'agents-jouets faibles & divers.*
  - **(3) La coordination utile est DÉJÀ INTERNE** : le bench OOV natif route entre voies par fiabilité — « **n-gram ARBITRÉ OS — bascule AUTO par régime, in-lex ≈ cohorte** » (+ gap-aware). C'est la division-du-travail-par-routeur, déjà DANS une version. Un groupe externe est **redondant**.
  - ⇒ **O1 (coordination de groupe externe) est SUBSUMÉ par l'architecture** : de vraies versions sont fortes & semblables (pas de complémentarité), et le routage utile est l'arbitrage OS interne. **O1 clos** — la prémisse « groupe > meilleur solo » ne tient pas pour de vraies versions. *(Reste théorique : une tâche hors-pendu où les versions seraient vraiment complémentaires → c'est O2, pas O1.)*
- Littérature à checker : communication émergente multi-agents (Foerster, Lazaridou), MARL coopératif, division du travail / intelligence collective.

### 🆕 O2 — MESURE MULTI-USAGE (autre fitness que le pendu) (Rem)
Le pendu a été **la** fitness unique de tout EVO → risque de **spécialisation pendu**. Évaluer les versions sur une **SUITE de tâches**
(le même substrat cognitif pointé ailleurs) — une version n'est « meilleure » que si elle **progresse sur la suite**, pas juste le pendu.
- **Tâches candidates, déjà présentes dans le repo** : correcteur **dys** (FP=0), **décompo dictée** (`decompose.py`), **copie de
  code** (P1), **complétion** de mots, généralisation **OOV/Trexquant**, **pendu de phrase** (`evo/PHRASE_HANGMAN_PROBE.md`).
- **But** : tester la **généralité cognitive réelle** (cf. discussion « OMEGA global » : le noyau = double-route + arbitrage +
  apprentissage gardé, pointé sur plusieurs canaux). Anti-overfit : la sélection P3 doit optimiser un **vecteur de fitness multi-tâches**, pas un scalaire pendu.
- ✅ **Première brique FAITE (`evo_o2_multitask.js`, vrai `omegaStep`, 2 graines)** : harnais **2 tâches** — pendu **in-lex** (rappel) + **OOV held-out** (généralisation, held-out propre façon bigN qui **HONORE le génome**). *Obstacle mesuré : le bench OOV NATIF `_omega_trexquant_bench` réinitialise la config (cohorte-OFF ne baisse pas la voie cohorte) → inutilisable par génome ; d'où le held-out explicite.* Résultat — la fitness est bien **2-D et les tâches DISSOCIENT** :

  | génome | in-lex | OOV |
  |---|---|---|
  | phon+cohorte (champion in-lex) | 95,0 % | **46,4 %** |
  | OS-arb n-gram | 96,2 % | 73,1 % |
  | OS-arb + gap-aware | 96,1 % | **73,3 %** |
  | phon + OS-arb | **98,8 %** | 70,5 % |

  - **In-lex ~plafond pour tous (95-99 %, discrimine à peine) ; OOV s'étale 46→73 %** — c'est LÀ que les vraies différences sont.
  - Le **« champion in-lex » (phon+cohorte) est un PIÈGE** : correct au pendu, **catastrophique en généralisation (46 %)**.
  - Sélection scalaire « in-lex » → phon+OS-arb (98,8) ; scalaire « OOV » → OS-arb+gap (73,3) : **gagnants DIFFÉRENTS**. Front de **Pareto = 3/4**.
  - ⇒ **un scalaire « pendu in-lex » est AVEUGLE à la généralisation** — exactement le risque « on ne mesure que le pendu ». La sélection P3 **doit** optimiser le **vecteur** (Pareto/pondéré), pas le scalaire. *(Caveat honnête : les absolus OOV ici, 180 mots × 2 graines, sont indicatifs/optimistes sur petit N (cf. bigN) ; le résultat est la DISSOCIATION relative, pas un nouvel absolu OOV.)*
- ✅ **Généralité HORS-FRANÇAIS testée (`evo_o2_crossdomain.js`, 3 graines).** *« Le mécanisme fait-il autre chose que du pendu français, sans le lexique ? »* (Rem). Le moteur est câblé Lex4+phonologie FR → on réimplémente son **substrat** (cohorte + n-gram positionnel = le moteur OOV) **domaine-agnostique**, même tâche de reconstruction, sur **FR** (mots Lex4) vs **CODE** (identifiants des `.js` du repo, jamais le monolithe, pas Lex4) vs **CODE-brouillé** (contrôle : caractères mélangés, structure détruite). Gain du mécanisme sur sa baseline fréquence :

  | domaine | gain mécanisme |
  |---|---|
  | FR | **+7,3** |
  | CODE | **+6,1** |
  | CODE-brouillé | **−1,9** |

  - **Le mécanisme TRANSFÈRE au code presque aussi bien qu'au français**, et son apport **s'effondre à zéro** quand la structure est détruite → ce qui généralise = le **substrat statistique** (exploitation de structure de séquence), **domaine-agnostique**, pas du français.
  - **Ce qui NE transfère PAS** = la **cognition française** (double-route phono↔ortho) : aucun analogue sur du code (pas de son). Le « cœur général » est un **reconstructeur de séquences structurées** ; la part proprement *cognitive* (phonologie) est un spécialiste français qui ne sort pas du français. *(Cohérent avec l'audit : l'OOV est porté par l'agrégation n-gram, pas la cognition pure ≈11 %.)*
- ✅ **Compression (`evo_o2_compression.js`, 3 graines) — « retrouver les absents = PRÉDIRE = COMPRESSER » (Shannon, idée de Rem).** Le substrat (n-gram de caractères) en modèle prédictif → bits/caractère held-out :

  | domaine | ordre-0 (fréquence) | modèle n-gram | structure capturée |
  |---|---|---|---|
  | FR | 3,98 b | 2,97 b | **−1,01 b/car** |
  | CODE | 4,17 b | 3,05 b | **−1,12 b/car** |
  | CODE-brouillé | 4,17 b | 4,41 b | **+0,24 b/car (RIEN)** |

  - Le substrat **compresse le code aussi bien (un peu mieux) que le français**, et **ne compresse RIEN** quand la structure est détruite (il paie même le bruit, +0,24). Version **info-théorique** du test cross-domaine, même verdict : le cœur transférable est un **compresseur de séquences structurées**, domaine-agnostique — *pas* une compréhension. (« Prédire = compresser ».)
- ⏳ **Suite O2** : brancher le vecteur in-lex/OOV sur la **lignée P3** (sélection multi-objectif réelle) ; pour une vraie SUITE multi-usage, ajouter des tâches **hors substrat-séquence** (correcteur dys, décompo dictée, complétion) — chacune son harnais.

### Reportés (déjà identifiés)
- **O3 — Génome plus riche** : évoluer les **poids** bPC/readout, **θ=(α,β)**, **règles g2p apprises** (pas seulement les 3 seuils NEO).
- **O4 — Variation de code par GRAMMAIRE** : **Grammatical Evolution** → muter le source **sans le casser** (vs 75 % létal du source brut, cf. `EVO_P3_EVOLVABILITY.md`).
  ✓ **1ʳᵉ brique (`evo_p3_grammar.js`)** : une grammaire BNF (génome = codons) produit des heuristiques de pendu **100 % valides** vs **75 %** pour la mutation de source brute — *« muter sans casser » démontré*. La sélection converge vers la **bonne heuristique** (la cohorte). *Honnête* : pas de longue pente multi-gén ici (l'optimum « score = cohorte » est simple, atteint dès la gén 0) → reste à élargir l'**espace de features** (où combiner bat un seul signal) pour une vraie courbe évolutive.
- **O5 — Lignée P3 avec isolation par process** : pour évoluer du **code** (pas que des params) en multi-générations sans contamination d'état.
