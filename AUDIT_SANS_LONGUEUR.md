# AUDIT — pendu SANS LONGUEUR (03/11/2026, approfondi le jour même sur rappel de Rem)

> **Objectif fixé par Rem** : un nouveau mode où la machine joue **sans connaître la longueur du mot**.
> Mode **normal** (mot in-lexique), **pas OOV**. Le chantier vit dans la **copie** `app/omega-pendu-sans-longueur.html`
> (octets identiques à l'original au départ, SHA256 vérifié) — l'original ne bouge pas.
>
> **Cadre posé par Rem (à ne pas perdre)** : le pendu **ne connaît pas le mot** (doctrine « cognition > oracle »,
> garde cheat-free `evo/ci_smoke.js` en CI) ; **aucun résultat n'est pérenne sans toute la machinerie** à la
> **config de référence** (CFG de `ci_smoke.js` / `applyReferenceConfig`), pas à la config défaut (= baseline R66
> tous modules OFF, qui ne mesure rien du produit). Et : **un audit de surface ne suffit pas** — celui-ci lit le
> corps des fonctions, pas la carte.
>
> ⚠️ Les numéros de ligne dérivent (main avance) : tout est ancré par NOM DE FONCTION, re-localiser par Grep.

## 1. Le modèle de feedback du mode (fixé par Rem, ex. INFLAMMABLE)

Chaque lettre proposée révèle **toutes ses occurrences**, mais en **positions relatives** : la machine connaît
le **schéma** entre la première et la dernière lettre révélée (E puis A → `A??A??E`), jamais la longueur du
préfixe/suffixe cachés. Contrainte induite : **aucune case inconnue** (intérieure ou aux bords) **ne contient une
lettre déjà proposée** — sinon elle serait révélée. Perdu à 6 erreurs (inchangé, `penduEvaluate`).

## 2. Chiffres d'étalonnage (03/11/2026 — relancer les commandes, ne pas recopier)

- **Information du feedback** (oracle lexical, `evo/pendu_sans_longueur_probe.js`, 155 493 mots, seed 12345,
  300 parties) : AVEC longueur 100,0 % win (1,11 err/partie) · SANS longueur **98,0 %** (1,50). Le mode est
  gagnable en principe ; l'oracle N'EST PAS le pendu (il scanne le lexique ; le moteur ne connaît pas le mot).
- **Moteur complet AVEC longueur** (`node evo/ci_smoke.js`, config réf., in-lexique K=1, warmup 120 / test 60,
  graines 12345+777, mots 7–12) : cognition seule **93,3 %** · +NEO **99,2 %**. Protocoles différents de
  l'oracle (mots 7–15, sans warmup) : unifier avant toute comparaison chiffrée.

## 2bis. J1 LIVRÉ (03/11/2026) — la couture, mesurée

La couture est posée dans la copie (`M_SANS_LONGUEUR_ENABLED`, défaut OFF) : fenêtre de board virtuel
dans `omegaStep` — le trio (`currentWord`, `revealedMask`, `_revealedLetters`) devient le schéma relatif
pour tout le montant (`_slVirtualBoard`), restauré avant `penduEvaluate` ; fenêtre vérifiée sans `return`.
Mesure (`node evo/sans_longueur_bench.js`, protocole ci_smoke, graines 12345+777) :

| Condition (copie) | Win | Par graine |
|---|---|---|
| board réel, cognition seule | 93,3 % | 96,7 · 90,0 |
| board réel, +NEO | 99,2 % | 98,3 · 100,0 |
| SANS longueur, cognition seule | **37,5 %** | 41,7 · 33,3 |
| SANS longueur, +NEO | **37,5 %** | 41,7 · 33,3 |

- **Inertie OFF prouvée** : la copie mode OFF = l'original, graine par graine (bench `APP=app/omega-pendu.html`).
- **NEO = 0 apport en mode ON** (parties identiques) — conforme au census : recall bloqué par son gate de
  longueur, assemblé muet (`wp.get(schéma)` = undefined, banc honnête), cohortes sur la mauvaise longueur.
- 37,5 % est le PLANCHER J1 (machinerie non adaptée) que J2–J5 doivent remonter ; le plafond d'information
  est 98 % (oracle, §2).

### Progression des jonctions (mode ON, protocole ci_smoke ; relancer `node evo/sans_longueur_bench.js`)

| Jonction (03/11/2026) | cognition seule | +NEO config réf. | note |
|---|---|---|---|
| J1 couture (2 graines) | 37,5 % | 37,5 % | NEO muet |
| J2 cohorte flottante (2 graines) | **92,5 %** | 92,5 % | M4_phon nourri ; assemblé encore muet |
| J3 assemblé board-dérivé (4 graines) | 91,7 % [93,3·91,7·90,0·91,7] | **93,3 %** [86,7·96,7·96,7·93,3] | +NEO > cognition sur 3/4 graines (à 2 graines c'était ambigu : 91,7 vs 92,5 — règle pré-enregistrée, tranché à 4) |
| J4 OS-arb : n-gram relatif ⟷ cohorte flottante (4 graines) | 91,7 % (inchangé ✓) | **95,0 %** [98,3·90,0·98,3·93,3] | seuil pré-enregistré ≥93,3 tenu ; l'arbitrage récupère la graine 12345 (86,7→98,3) |
| J5a recall re-ancré (4 graines) | 91,7 % | 95,0 % (parties identiques à J4) | **gardé pour CORRECTION, pas pour gain** : l'ancien gate (`longueur candidat == empan`) compare des grandeurs incomparables ; le re-ancrage (projection du schéma par décalage, banc dans son repère) TIRE (12 tirs/180 parties, diag `_neoDbg`) mais à effet net nul — l'OS-arb aurait proposé pareil |
| J5b re-perception M1_d (4 graines) | **87,1 % — FALSIFIÉ** [90,0·88,3·86,7·83,3] | 95,0 % | ré-init des producteurs au décalage d'ancre : 4/4 graines en recul — la mémoire EMA désalignée porte plus de signal que le coût du désalignement. REVERTÉ (retour 91,7/95,0 revérifié à l'identique). Ne pas re-tenter sans idée neuve |
| J6 M4_phon pré-première-lettre (4 graines) | **88,3 % — FALSIFIÉ** [91,7·93,3·86,7·81,7] | 95,0 % (parties identiques) | ouvrir M4_phon sur la cohorte PLEINE avant la première lettre juste : neutre machine complète (les declares préemptent), cognition seule −3,4 pts (3/4 graines) — le choix J2 (muet) est CONFIRMÉ par la mesure. REVERTÉ (identité revérifiée), note dans le code |
| — ancienne référence board réel (4 graines, CFG ci_smoke pure) | 93,8 % | 99,6 % | ⚠ chiffre au « MOT ENTENDU » (assemblé NEO lit wp.get du mot caché, le 🟠 du census CODE_MAP §3) — ne plus le citer comme référence du chantier |
| — **référence board réel CHEAT-FREE** (4 graines, directive Rem 04/11) | 93,8 % | **96,3 %** [98,3·96,7·96,7·93,3] | le bench pose désormais `M_NEO_PHON_COHORT_ENABLED=true` sur les conditions +NEO : personne n'entend le mot. No-op en mode (voies déjà forcées → chiffres J1→J6 comparables). **Écart réel du mode : −2,1 pts cognition · −1,3 pt +NEO** (et par graine : 1 perdue, 1 gagnée, 2 égales) |

**Bilan J1→J6** : sans connaître la longueur, le moteur complet joue à **95,0 %** contre **96,3 %** pour la
référence cheat-free avec longueur (directive Rem 04/11 : personne n'entend le mot — l'ancien 99,6 % était
au « mot entendu ») et 37,5 % machinerie non adaptée. Le prix de la longueur seule ≈ **1,3 pt**. Pistes
restantes, non engagées : la JOINTE phon-cohorte en mode (J7, en cours), le brouillard pondéré par la
distribution des longueurs de la cohorte (J8, en cours). J6 (M4_phon pré-première-lettre) : falsifié,
voir la table.

**UI du mode — LIVRÉE (04/11/2026)** : interrupteur dans le panneau de config (toggle-item
`M_SANS_LONGUEUR_ENABLED`, `ui_toggle`) + case à cocher dans le panneau de jeu + panneau « CE QUE LA
MACHINE VOIT » : schéma relatif (bords de brouillard `⋯`), nombre de mots compatibles, distribution des
longueurs possibles (histogramme, vraie longueur marquée côté SPECTATEUR — la machine ne la lit pas).
Script séparé en fin de page, lecture seule du moteur (`_slVirtualBoard` + `_slCompatible`, cache propre
à resserrement monotone — jamais `_slCohort()` du moteur, son cache mono-entrée lui appartient).
Inertie prouvée : bench avant/après l'UI **identique ligne à ligne** (4 conditions) ; en headless le DOM
est un stub et `setInterval` neutralisé → le bloc ne fait rien.

## 3. Census PROFOND — qui lit la longueur/les positions absolues, corps des fonctions lus

Le montant reçoit le board par `cStep(currentWord, revealedMask)` et les declares lisent les mêmes globals.
`startNewGame` taille `revealedMask` à `MAX_WORD_LEN` fixe (robuste). `penduEvaluate` est côté JEU (connaît le
mot, légitime). Census à la **config de référence** (CFG ci_smoke ; « déf. » = défaut fichier, hors CFG) :

### 3.1 Ce qui SURVIT tel quel au board relatif (lu dans le corps, pas supposé)
| Fonction | Réf. | Preuve |
|---|---|---|
| `M1_phon_step` | ON | somme **sans position** des substrats des lettres révélées (sac de lettres), L2-normée |
| `M2_phon_step` → `M5_phon_step`, `M_S_v07` | ON | ne lisent que `M1_phon.output` (40D) et des scores lettre |
| `M2_d_step` | ON | ne lit que `M1_d.output` (grille 4×4 sur les dims LDIM, pas sur le mot) |
| `M3_d` (bPC) + readout `cLetterScore` | ON | lit M1/M2.output + reward — hérite, ne lit pas le board |
| `M4_d_step` / `M5_d_step` | ON | scores lettre ; `currentWord` seulement sous `L01_A2` (OFF) et `M_IG_SELECT` (OFF) |
| OS (`M_OS_v07_step`), miroirs descendants, `endCurrentGame` | ON | signaux agrégés / apprentissage post-décision (mot complet légitime) |
| `startNewGame`, `penduEvaluate`, budget 6 erreurs | — | côté jeu, inchangés |

### 3.2 Ce qui CASSE, et comment précisément
| Site | Réf. | Ce que le corps fait VRAIMENT | Casse sans longueur |
|---|---|---|---|
| `M4_phon_step` (cohorte phon) | ON | `len_idx[wlen]` puis match positionnel absolu (`w.m.length !== wlen` → skip ; `revMask[p]`) + prior `w.p` | cohorte par longueur → **cohorte flottante** (schéma posable à ≥1 décalage) |
| `_neoCohortMasks` (masques par position) | ON (`M_NEO_COHORT`) | `_neoWBL[L]` + match absolu + exclusion des lettres absentes | masques à re-définir **sur les cases du schéma** (l'union des alignements donne le masque par case) |
| **NEO recall** (`_emrg_bind`/`_emrg_recall`) | ON | bind HRR `shift(lettre, p_absolu+1)` du board ; banc appris post-partie en positions absolues ; gate `_nrc.w.length === currentWord.length` + match positionnel | **doublement cassé** : (a) test d'égalité de longueur impossible ; (b) le bind d'un board relatif ne s'aligne plus avec le banc absolu → recall muet ou faux. Re-ancrage à concevoir, ou OFF dans le mode v1 (mesurer la perte) |
| **NEO assemblé** | ON | `_al = align(currentWord, wp.get(currentWord), revealedMask)` = **« mot entendu »** : le SON du mot entier | le nombre de phonèmes borne la longueur → **fuite de longueur par le son**, incohérent avec le mode. Bascule `M_NEO_PHON_COHORT` (board-dérivé)… |
| `_neoPhonCohort` / `_neoPhonCohortDist` | déf. OFF | …qui lisent `_neoWBL[L]` + match absolu | même refonte que la cohorte flottante |
| `_neoLetterNgramDist` (+ gap-aware) | déf. OFF | tables indexées **`L\|p\|contexte`** (`NG.tri[L+'\|'+p+'\|'+lc+'\|'+rc]`, `NG.uni[L+'\|'+p]`, gap `L\|p\|d\|c`) | **PAS longueur-agnostique** (l'audit de surface disait le contraire — faux). Le mode exige des tables **ré-agrégées par contexte seul** (bi/trigrammes relatifs, distance bornée — l'idée de Rem) ; et au bord du schéma, **pas de marqueur de frontière** : bord de schéma ≠ frontière de mot |
| `M1_d_step` (socle perception) | ON | re-bind chaque tick `shift(lettre, p_absolu+phase)` des positions révélées, mémoire EMA | sur board relatif dont l'ancre se déplace (schéma étendu à gauche), les binds précédents pointent d'anciennes positions → bruit transitoire. ~1 tick/coup : la décroissance EMA corrige lentement. À mesurer (placebo) ; option re-init des producteurs au décalage d'ancre |
| `updateCvPattern` (A1), `computeLex4LetterScores` (A2), DUAL `_DECL2.declare`, `WORD_DECLARE`, `_neoHeavyCDist`, NEO muette | OFF | positions absolues / `len_idx[wlen]` / `Qr[L−1−p]` | sans objet en réf. — à adapter LE JOUR où réactivés (la muette est déjà relative dans ses clés `φ\|offset\|voisins`) |
| `OS_game_start` | — | publie `{word, len}` ; census : **aucun lecteur au montant** | le mode ne publie pas `len` (et pas `word`) |

### 3.3 Les trois pièges que l'audit de surface avait manqués (leçon)
1. **n-gram** : clés `longueur|position` → « survit tel quel » était FAUX ; il faut de nouvelles agrégations relatives.
2. **recall VSA** : désalignement banc (absolu, appris post-partie) ⟷ board (relatif, au montant) + gate d'égalité de longueur.
3. **« mot entendu »** : le son du mot entier fuit la longueur — l'assemblé de la config réf. est incompatible avec le mode tel quel.

## 4. Plan de câblage — une jonction à la fois (§4 doctrine), tout OFF-inerte (R66), dans la COPIE

Toggle maître `M_SANS_LONGUEUR_ENABLED` (défaut OFF ⇒ comportement byte-identique).

- **J1 — la couture (seam) du board virtuel.** Un seul point de substitution : ce que le montant voit.
  Board = le schéma courant (empan premier→dernier révélé ; vide avant la première lettre juste), masque =
  cases lettrées du schéma ; `len` n'existe plus côté machine. Ancre = première lettre révélée ; quand le schéma
  s'étend à gauche, décision de design : re-perception assumée (EMA) ou re-init M1_d — tranché par MESURE.
- **J2 — cohorte flottante partagée.** UN helper (la `compatible()` de la sonde : schéma posable à ≥1 décalage,
  aucune lettre proposée hors fenêtre) sert les 4 consommateurs vivants : `M4_phon_step`, `_neoCohortMasks`,
  `_neoPhonCohort`, `_neoPhonCohortDist`. Il rend aussi la **distribution des longueurs** candidates (demande de
  Rem, affichable UI). Cheat-free : lexique + révélé + ratés, jamais le mot.
- **J3 — assemblé sans « mot entendu ».** Dans le mode : `M_NEO_PHON_COHORT` ON (son board-dérivé sur cohorte
  flottante). Recall : OFF au v1 (le re-ancrage est un chantier à part) — la perte est MESURÉE, pas supposée.
- **J4 — n-gram relatif (l'idée bi/trigrammes de Rem).** Nouvelles tables agrégées par contexte seul
  (`tri[gauche|droite]`, `bi[gauche]`, `bi[droite]`, gap `[d|contexte]`), construites du lexique entier, sans
  marqueur de frontière aux bords du schéma. Nouvelle voie sublexicale du mode, mesurée seule puis arbitrée OS.
- **J5 — perception relative (M1_d, recall re-ancré).** Le plus délicat, en dernier, avec **placebo**
  (`evo/pendu_paired_ab.js` — leçon ETAT.md : ~200 parties/3 000 basculent dès qu'on touche au chemin numérique).
- **Mesure à chaque jonction** : protocole `ci_smoke` adapté au mode (in-lexique K=1, warmup 120 / test 60,
  graines 12345+777), moteur config réf. L'oracle (§2) donne le plafond d'information, PAS la cible.

## 5. Garde-fous

- **Jamais** comparer le mode au harnais config défaut (baseline OFF) — c'est sous-estimer la machine.
- **Jamais** présenter le chiffre de l'oracle comme un résultat du pendu.
- La copie reste **hors précache SW** (liste blanche CORE, vérifié) et **hors nav** (la sonde
  `pages_atteignables_probe` ne scanne que la racine et `en/`, vérifié).
- Les règles du jeu (6 erreurs, toutes occurrences révélées) ne changent pas : seul le **savoir** de la machine change.
