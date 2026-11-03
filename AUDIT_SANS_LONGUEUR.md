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
