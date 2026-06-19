# Design — un organe de cognition/mémoire en COMPLÉMENT de la base (recherche d'abord)

> Commandé par Rem (2026-06-19) : *« on a fait ces recherches pour construire autre chose en complément à la base…
> effectuer les recherches manquantes pour construire un autre organe de cognition/mémoire, surtout qu'on ne connaît
> pas l'état de M3_d ».* Choix : **Recherche d'abord** → ce doc livre l'analyse + une reco mesurable, AVANT de bâtir.
> Fond : `docs/MEMOIRE_COGNITION_LIT.md` (revue CLS/hub-and-spoke/codage prédictif/VSA) · `AUDIT_OMEGA.md §1.7-1.11`.

## 0. État de M3_d (la question directe de Rem) — FACTUEL + MESURÉ
- **Je n'ai pas touché M3_d.** Les 3 commits du chantier OOV/C ne modifient **aucune** ligne de M3_d / `cLetterScore`
  / `bpcW` / hub `M_S` (vérifié `git diff`). M3_d est **byte-identique** à avant.
- **Le nouvel organe (cortex n-gram/gap) n'utilise PAS M3_d** : `_neoDeclareOSmix` / `_neoLetterNgramDist` / gap lisent
  les tables n-gram, la cohorte board, `_neoCRS`, le substrat phon L2 — **jamais** `M3_d`, `conceptCells`,
  `currentPhonState`.
- **Preuve par bypass** (voie n-gram gap-aware OS, N=400) : winrate **identique** M3_d actif vs `M3_D_BYPASS` (concept
  muet) — **OOV 63,5 / 63,5 % · in-lex 97,5 / 97,5 %**. ⇒ Dans cette config, M3_d **tourne mais sa sortie est jetée**
  (override de cascade ; sous bPC `M3_d.output` est déjà zéroé). « Utiliser M3_d pour cette MAJ » : **on ne l'utilise pas**.
- **Rôle vivant restant de M3_d** : (a) `cLetterScore` dans la **base in-lex SANS** l'organe NEO (+3,4 cheat-free, §3.1) ;
  (b) hypothèse **signal de stade dictée** (latent de FORME, §3) — **non mesurée**, hors pendu.

→ **Verdict M3_d** : winrate-inerte (re-confirmé). Ce n'est PAS le bon « hub » (spoke pauvre = longueur, §1.8.2). Il ne
faut **ni** construire le nouvel organe dessus, **ni** le laisser dans le chemin de décision comme s'il décidait.

## 1. Contraintes dures (ce que la MESURE a déjà tranché — ne pas re-litiger)
| Brique | Statut mesuré | Conséquence design |
|---|---|---|
| Cortex agrégé (n-gram + **gap-aware**, §1.7/1.9/1.10) | généralise : OOV ~63-65 % (bande SOTA), in-lex ~97 % | **l'organe de généralisation EXISTE** ; indépendant de M3_d |
| Cognition M3_d / double-route | ~11 % OOV seule ; winrate-inerte | **pas** le levier ; à sortir de la décision |
| C *léger* appris (maxent/GATE/POE, §1.11) | tous < gap-aware | **falsifié** ; le plus proche voisin domine |
| Mémoire / recall (`_emrgBank`, hippocampe) | recall OFF ≈ ON sur le pendu | **inerte sur le pendu** (chaque mot 1×) ; utile hors-pendu |
| Décision globale | **cascade d'overrides** (last-writer-wins, 7263-7346) | ad hoc, non principiel → candidat n°1 à remplacer |

## 2. Littérature (revue précédente + apport neuf MoE, égress rouvert 2026-06-19)
- **CLS** (McClelland 1995 ; Kumaran 2016) : **cortex** (agrège, généralise) + **hippocampe** (instances, mémorise),
  **séparés & complémentaires**. → on a le cortex ; l'hippocampe est inerte *sur le pendu*.
- **Hub-and-spoke** (Patterson 2007 ; Lambon Ralph 2017) : le hub généralise en **distillant des spokes RICHES**. Un hub
  nourri d'un signal pauvre n'a **rien à distiller** → l'échec exact de M3_d (spoke = longueur). **Prescription : des
  spokes riches.** Or nos **voies de décision** (cortex, cohorte, recall, base) **SONT** des spokes riches.
- **Codage prédictif** (Rao&Ballard 1999 ; Friston 2010) : descendant = **prédictions**, montant = **erreur** ; appris
  **dense, auto-supervisé**. → un hub doit s'entraîner par **erreur de prédiction** (quelle voie avait raison), pas par
  récompense-par-partie.
- **APPORT NEUF — Mixture/Product of Experts & gating par fiabilité :**
  - **Interpretable MoE (IME, 2022)** : quand les experts sont **simples/linéaires**, le MoE est **intrinsèquement
    interprétable** (l'explication = le calcul exact). → nos voies sont déjà simples/interprétables ⇒ un hub MoE reste
    lisible (≠ boîte noire ⇒ compatible doctrine « cognition > oracle »).
  - **Gating par INCERTITUDE (MoGU, 2025)** : dériver le gating de la **confiance interne des experts**, pas d'un module
    auxiliaire. → c'est **exactement** ce que fait déjà l'`M_OS_v07` (fiabilité = piqué/confiance de chaque voie). Notre
    arbitrage OS est donc une **brique MoE-par-incertitude** validée ; le **manque** = l'**apprendre** et l'étendre à
    **N voies** (l'OS n'arbitre que 2).

**Convergence** : la littérature pointe toute vers le **hub d'arbitrage appris, gaté par fiabilité, à experts
interprétables** — le « hub-and-spoke fait correctement », là où M3_d a échoué.

## 3. Candidats d'organe (évalués)
**(A) Hub d'arbitrage appris (cognition).** Spokes = les voies réelles (cortex n-gram/gap, cohorte, recall, base) ;
le hub **apprend** à les pondérer par **fiabilité/incertitude** (généralise l'OS à N voies, entraîné par erreur de
prédiction « quelle voie était correcte »). Remplace la cascade last-writer-wins.
- *Pour* : hub-and-spoke + MoE-incertitude + codage prédictif **tous alignés** ; experts interprétables (IME) ⇒ lisible ;
  **winrate mesurable** vs cascade ; c'est le vrai « organe de cognition » que M3_d n'est pas.
- *Contre/risque* : la cascade marche déjà bien (97,5 % in-lex) → le gain peut être **marginal** ; **doit être mesuré**
  pour battre la cascade, sinon on garde la cascade (R66/§1).

**(B) Organe mémoire / hippocampe (CLS) propre.** Mémoire épisodique séparée du cortex.
- *Pour* : complète la **paire CLS** ; sert la mémoire **inter-parties** + le **modèle de l'apprenant** (dictée).
- *Contre* : **inerte sur le winrate pendu** (mesuré) ; le besoin « mémoire de l'apprenant » est **déjà** servi par le
  localStorage du correcteur/dictée. Valeur réelle limitée et **hors pendu**.

**(C) Sortir M3_d + formaliser le cortex (hygiène).** Retirer M3_d du chemin de **décision** (gardé seulement comme
candidat **signal de stade dictée**, à mesurer) ; nommer le cortex n-gram/gap comme **organe de 1re classe**.
- *Pour* : honnêteté architecturale (M3_d prouvé inerte) ; **risque nul** (byte-identique en winrate) ; clarifie « le
  complément ». *Contre* : pas un « nouvel » organe — c'est du nettoyage (mais **prérequis sain** à A).

**(D) Organe neuronal lourd (attention/corrélations).** Le seul au-delà du gap-aware (§1.11) pour ~3-5 pts SOTA.
- *Contre* : lourd, opaque, entraînement hors-ligne — **contre doctrine**, gain marginal. **Déféré** (déjà tranché §1.11).

## 4. Recommandation (mesurable, doctrine R66/§1/§4)
1. **D'abord (C) — hygiène, risque nul** : sortir M3_d du chemin de décision (flag, OFF-inerte) et **mesurer** que le
   winrate est inchangé (attendu : oui, cf. bypass). Donne une **base propre** où le « complément » est explicite.
2. **Puis (A) — le nouvel organe, derrière flag, MESURÉ** : un **hub d'arbitrage appris** à experts = voies, gaté par
   **fiabilité/incertitude** (réutilise la forme OS prouvée ; experts interprétables ⇒ lisible), entraîné par **erreur
   de prédiction** (cheat-free : « la voie qui pointait la bonne lettre »). **Critère d'adoption** : bat la cascade
   last-writer-wins sur winrate **et** coups, in-lex **et** OOV, ≥3 graines. Sinon → **falsifié**, on garde la cascade.
3. **(B) mémoire** : **déférée** (inerte sur le pendu ; besoin apprenant déjà couvert). À rouvrir si la cible bascule du
   pendu vers un usage **multi-session/dictée** explicite.
4. **(D) neuronal lourd** : **déféré** (§1.11), seulement sur arbitrage explicite de Rem.

**Le « C cognitif » honnête de ce système n'est donc pas un détecteur-concept (M3_d) ni un réseau lourd, mais un HUB
D'ARBITRAGE qui distille des spokes riches (les voies) par fiabilité apprise** — exactement la prescription
hub-and-spoke + MoE-incertitude, et la seule piste « cognition > oracle » encore ouverte qui soit légère, interprétable
et mesurable au-dessus du plancher cortex.

## 5. Point de décision (à Rem)
Le doc est livré. **Prochaine action proposée** : (1) hygiène C [sortir M3_d de la décision, mesurer = inchangé], puis
(2) prototyper le **hub d'arbitrage appris** hors-app (comme `evo/learned_c_probe.js`) et **mesurer vs cascade** avant
tout câblage. Dis « go » pour enchaîner, ou réoriente (A seul / B / autre cible).

## Sources (apport neuf MoE/gating)
- Interpretable Mixture of Experts — https://arxiv.org/abs/2206.02107
- MoGU: Mixture-of-Gaussians with Uncertainty-based Gating for Time Series Forecasting — https://arxiv.org/pdf/2510.07459
- Mixture of Experts Made Intrinsically Interpretable — https://arxiv.org/html/2503.07639v1
- (fond CLS / hub-and-spoke / codage prédictif : voir `docs/MEMOIRE_COGNITION_LIT.md`)
