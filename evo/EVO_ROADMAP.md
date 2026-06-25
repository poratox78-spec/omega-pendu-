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
- ⚠️ **Conséquence design (mesurée, pas supposée)** : une copie *fidèle* (« code équivalent qui tourne ») exige err→~0.
  Le concept 12-cellules (readout couplé 0,20, lossy *par design*) **ne peut pas être le copieur tel quel**. Brique suivante
  **avant** de câbler le mécanisme de copie : **fidélité vs `N_CONCEPT_CELLS`** (combien de cellules pour franchir 0,5 puis
  0,2 ?), sinon un **autoencodeur de copie dédié** (hors du concept cognitif).
- ⏳ **Reste** : (a) exposer la config de référence (~90 %) dans le harnais ; (c) jalon **quine** — *gated* derrière la capacité.
- P2/P3 attendent P1 prouvée — sinon on empile du non-mesuré.
