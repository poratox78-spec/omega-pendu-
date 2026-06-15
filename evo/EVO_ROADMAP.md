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
- ⏳ **Prochain** : (a) exposer la **config de référence** (~90 %) dans le harnais ; (b) définir le **mécanisme de copie**
  (ce qu'on branche sur bPC) + 1ʳᵉ **mesure de fidélité** ; (c) jalon **quine**.
- Le reste (P2/P3) attend P1 prouvée — sinon on empile du non-mesuré.
