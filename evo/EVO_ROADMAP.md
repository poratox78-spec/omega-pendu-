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
  len 11 **45→70-82 %**, len 13 **47-55→62-75 %**, len 15 **23-38→50-55 %**, len 18 **20-30→45-57 %**, len 22 **0-25→62 %** ;
  lettres +1-5 pts. Les pics de crosstalk diffèrent entre routes → le croisement les annule. ⇒ « **ni addition ni
  multiplication, c'est un croisement** » : *mesuré*.
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
  (6,16 bits/token) — **PLANCHER** (la vraie pyramide = AST/grammaire fait bien plus ; la dictée = 51 % sur tâche plus dure).
- ⚠️ **Reframe du mécanisme de copie** : ce n'est PAS un bundle VSA de la ligne (mon erreur) — c'est **décomposer (pyramide)
  → régénérer le régulier par règles + stocker l'irrégulier compressé**. Le VSA ne sert qu'au **résidu irrégulier**, à son étage.
- ✅ **P1 (e) — décomposeur HIÉRARCHIQUE (pyramide + double voie)** : `evo_p1_hier.js`, sur le propre code d'OMEGA (arbre
  d'imbrication, profondeur max 9). **Squelette grammatical** (mots-clés+symboles) = **60,8 %** des tokens de contenu ;
  **identifiants 7,2× dédup** (14 296 occ → 1 995 uniques, route lexicale = stocker 1 fois + références) ; **feuilles uniques
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
  90,5 %** ; résidu ordre-5 = **9,5 %** (gzip 15,8 Ko vs 43,6 brut). ⇒ **OMEGA se copie pour de vrai par prédiction+erreur**,
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
- ✅ **P2 (a) — CRUX ÉTABLI & MESURÉ : le pendu référentiel PAIE la communication** : `evo_p2_referential.js`. A voit le mot,
  « souffle » k lettres à B (canal = k symboles), B (moteur, cognition seule = marge) joue. Mesuré (150 mots len 8-12) :
  **89,3 % (k=0) → 94,7 → 96,0 %** [A aléatoire] · **→ 98,7 → 100 %** [A malin = lettres rares]. (1) **communiquer PAIE**
  (winrate ↑ avec la bande, sanity monotone ✅) ; (2) **le CONTENU compte** (malin > aléa **+4 pts** à bande égale) ⇒ un
  **encodage optimal à APPRENDRE** = le gradient qui fait émerger un langage. *C'était LE crux de P2 (« quelle tâche paie ») — répondu.*
- ⏳ **Prochaine brique P2** : A **APPREND** quoi envoyer (protocole émergent) — optimiser l'encodage du canal limité par le
  reward partagé (winrate de B). Puis **P3** (générations, croisement).
- ⏳ **Reste P1** (mineur) : config de référence (~90 %) dans le harnais ; prédicteur **hiérarchique** (optimisation du résidu).
