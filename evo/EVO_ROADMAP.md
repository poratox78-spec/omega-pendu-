# Roadmap — OMEGA apprend à coder : auto-copie & croisement de générations

> Vision (Rem) : OMEGA **se copie** (reconstruit du code qui tourne) → deux instances **communiquent**,
> font émerger **leur propre code**, fabriquent **une nouvelle version d'OMEGA** → celle-ci recommunique
> avec la **précédente**, en recrée une autre → à partir de là, on **croise les générations**.
> Doctrine R66 : mesure d'abord, falsifie, OFF-inerte, **une brique à la fois**.

## Cadrage
- **Tâche = COPIER** (reconstruction / autoencodage), pas deviner. Fit le substrat **bPC/M3_d** (autoencodeur
  à codage prédictif), et **contourne l'absence de phonologie** du code (copier n'a pas besoin de la 2ᵉ route).
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
- ⏳ **Prochaine brique** : ici les 2 routes sont des permutations **arbitraires**. OMEGA a des routes qui **portent de la
  structure** (phon × ortho × cohorte × voisins = le **vrai jointe** `M_NEO_PHON_COHORT_JOINTE`) → croiser **celles-là**
  (info indépendante *réelle*, pas 2 vues random) devrait viser le mot exact ~100 %. Plus : chunking ≤7 / rappel `_emrg_recall`.
- ⏳ **Reste** : (a) config de référence (~90 %) dans le harnais ; (c) jalon **quine**.
- P2/P3 attendent P1 prouvée — sinon on empile du non-mesuré.
