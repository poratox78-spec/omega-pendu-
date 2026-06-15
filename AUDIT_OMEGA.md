# Audit structurel — moteur OMEGA-Ω (pendu) — 2026-06-15

Audit **du moteur cognitif** (`app/omega-pendu.html`), distinct de l'audit monorepo (`AUDIT_PROJET.md`).
Méthode : lecture **du code** (pas seulement des docs `docs/MEMOIRE.html` / `docs/rapport-mode-emploi.html`) ; chaque point « vérifié » renvoie à une ligne. Doctrine de référence : **cap §43 (cognition > oracle)** + **R66 (mesurer/falsifier avant de garder ; OFF-inerte)**.

---

## 0. Cadre doctrinal vérifié — la double voie (à ne pas confondre)

Deux axes **orthogonaux** :

- **Axe 1 — double ROUTE de lecture (DRC, Coltheart)** : voie **orthographique** (`M*_d`) ∥ voie **phonologique** (`M*_phon`), arbitrées par l'**OS** (`w(r) = −r/(1+r)`).
- **Axe 2 — double BOUCLE par voie (Möbius L01)** : **ascendante** (montante : perçoit→décide) et **descendante** (miroir : résultat→corrige/apprend).

### La règle d'or (cap §43) et son ancrage dans le code
| | Ascendante (montante) | Descendante (miroir) |
|---|---|---|
| Rôle | **décide** la lettre | **apprend**, ne décide pas |
| Accès au mot caché | **positions révélées seules** | **mot complet permis** (le « professeur », wake-sleep) |
| Lire la réponse | **triche dure** | **légitime** |

**Frontière physique dans `omegaStep` :** le bloc décision (montant) calcule `_cogProposed` en **révélé seul**, les declares peuvent override, **puis `penduEvaluate` joue la lettre (≈ ligne 7197)**, **et seulement ENSUITE** « PHASE 2 — Cercle miroir activé » (≈ ligne 7203) tourne avec le résultat. **Montant avant, descendant après.**

- Montante ortho : `cStep`(6343) → `M1_d_step`(4022) → `M2_d_step`(4117) → `M3_d_step`(4232) → `M_S_step`(5669) → `M4_d_step`(4729) → `M5_d_step`(4849).
- Montante phon + arbitre : `omega_voiePhon_OS_tick`(3903) + `M_OS_v07_step`(3747).
- Descendante ortho (5 étages) : `M5_m_step`(5238) → `M4_m_step`(5287) → `M3_m_step`(5421, **seul étage qui écrit `conceptCells`**) → `M2_m_step`(5499) → `M1_m_step`(5565, co-décide M5 ; poids 0,0 en baseline).
- Descendante phon : **tronquée** — `M5_phon_m_step`(3809)/`M4_phon_m_step`(3821) effectifs, `M3_phon_m_step`(3840) observationnel.
- Apprentissage descendant des declares : `endCurrentGame`(6894) — banc recall, g2p (`learnExp`), table muette jointe (tous post-partie, mot complet légitime).

> **Conséquence de cadrage.** Lire `currentWord` dans la voie **descendante** (post-partie) n'est **jamais** un finding. Seule la lecture d'une propriété de la réponse dans la voie **montante** (à la décision) est sensible.

---

## 1. Vérification ciblée — `currentWord` dans NEO

Demande : la session précédente avait garanti que `currentWord` n'était « plus utilisé » dans NEO. **Garantie partiellement fausse.**

| Voie NEO | Ligne | Lecture | Verdict |
|---|---|---|---|
| Recall (1) | 7148, 7151 | `currentWord.charAt(p)` **si `revealedMask[p]`** | ✅ révélé seul |
| Muette (3) | 7172, 7173 | voisins `charAt(p±1)` **si révélés** | ✅ révélé seul |
| **Assemblé (2)** | **7157** (ancien 7134) | **`wp.get(currentWord)` = PHONOLOGIE du mot caché**, à la **décision** (montant) | ⚠️ prémisse « mot entendu » |
| Compteurs diag | 7153, 7164, 7185 | `currentWord.indexOf(...)` sous `_neoDbg` (absent du build) | ✅ inerte |

**Vrai dans la garantie :** l'apprentissage de la table g2p est passé sur `learnExp`(6071) qui **ne crédite que les positions révélées** ; et `align`(6064) remplace tout graphème **masqué** par `UNI` → **aucun graphème caché n'est lu**. La doctrine ortho tient.

**Faux dans la garantie :** la route **assemblée** (plus gros contributeur du declare, **+5,28 pts** K=1) lit toujours `wp.get(currentWord)` à la décision (7157) pour récupérer **le son** du mot cible, puis score les positions non révélées via `L2[phonème]`. Ce n'est pas un graphème caché, mais **c'est une propriété du mot caché (sa prononciation), exploitée dans la voie montante**. Légitime **uniquement** sous la prémisse `M4_PHON_USE_P` « le mot est entendu ».

**Donc :** le **97,5 % « cheat-free » repose sur la lecture du SON du mot cible**. À communiquer comme **« in-lexique, mot entendu »**. Repères sans prémisse : hors-lexique phon→ortho **70,7 %**, ortho pur OOV **22 %**.

**Options (objectif « g2p sans `currentWord` ») :**
1. Garder `wp.get(currentWord)` = assumer la prémisse « dictée / mot entendu » + **afficher le régime**. *(recommandé ; cohérent avec le pivot dictée)*
2. Dériver le son du **cohort board** (consensus des prononciations compatibles) → réellement board-only. **Implémenté + corrigé (garde de pureté) — §1.1 : parité vrai-son in-lexique (97 %), coût OOV ~7,5 pts. Le −18,8 initial était un bug d'implémentation (override confiant-mais-faux), pas le concept.**
3. Couper la route assemblée au pendu → −5,28, ~92 % 100 % board-only.

### 1.1 Option 2 implémentée + MESURÉE (R66) — `M_NEO_PHON_COHORT_ENABLED`

Option 2 codée en **OFF-inerte** (toggle `M_NEO_PHON_COHORT_ENABLED`, défaut OFF → baseline byte-identique). Quand ON, la source de `_al` **partagée par l'assemblée ET la muette** (subtilité : les deux lisaient le même son via `wp.get`, la muette n'était donc pas une voie propre) devient le **consensus phonémique de la cohorte board-compatible** (`_neoPhonCohort()`, mots de même longueur matchant le révélé) — plus aucune lecture du son du mot caché. Modèle fidèle du joueur humain qui « sonne » ce qu'il voit (`_AU` → /o/ → EAU, inféré du lexique, pas entendu).

**Mesure** (bench Trexquant hors-lexique, 80 test / 300 warmup, budget 6, headless via `evo` loader ; en UI = bouton « 🎯 Trexquant », 3 conditions + Δ) :

| Condition (OOV) | graine 12345 | graine 777 |
|---|---|---|
| phon→ortho · son du MOT (`wp.get`) | 73,8 % | 58,8 % |
| phon→ortho · son **cohort-board** | 55,0 % | 40,0 % |
| ortho seul | 18,8 % | 22,5 % |
| **Δ cohort − son-mot** | **−18,8** | **−18,8** |

Les chiffres ci-dessus (cohort-board 55,0/40,0 %, Δ −18,8) sont ceux de la **première implémentation SANS garde** — et c'était un **BUG**, pas le concept.

**Diagnostic (instrumenté `_neoDbg`).** Tôt dans la partie la cohorte fait des milliers de mots → le consensus est lavé, l'argmax sort un phonème faible, mais `L2[phonème]` pique quand même → l'assemblée **override la cognition avec une lettre confiante mais fausse**. In-lexique, config optimale : OFF tire 413 fois à **97,8 %** ; ON-sans-garde tire **665** fois à **60,5 %**. D'où la chute (−18,8 OOV ; −13 à −21 in-lexique). **OFF-inerte vérifié** (OFF = baseline 97 % intact, aucun bug hors-toggle).

**Fix (R66) — garde de pureté** `M_NEO_PHON_COHORT_PURITY` (défaut **0,5**) : ne retenir un phonème consensus que si ≥ cette fraction de la cohorte s'accorde (sinon `'_'` → l'assemblée passe la main à la cognition). Élimine l'override confiant-mais-faux. Mesure **post-garde** :

| Cadre | vrai son (`wp.get`) | cohort-board + garde 0,5 | coût réel |
|---|---|---|---|
| in-lexique (config optimale) | 97,0 % | **97,0 %** | **~0 (parité)** |
| hors-lexique (OOV, bench 80/300) | 73,8 % | **66,3 %** | **~7,5 pts** |

**Verdict corrigé :** le vrai coût d'honnêteté est **~0 in-lexique, ~7,5 pts OOV** — *pas* −18,8 (c'était le bug). L'estimation ≈78 % était optimiste, mais la pureté pendu n'est **pas** chère une fois la garde posée. Avec la garde, le cohort-board est une **option pendu-pur viable** (cheat-free, perte minime). Décision : **dictée / mot-entendu → `wp.get`** (gratuit, légitime sous prémisse) ; **pendu pur → cohort-board + garde** (cheat-free, parité in-lexique, ~7,5 pts OOV). Toggle **OFF par défaut**, rien adopté en config de référence sans arbitrage explicite.

### 1.2 Jointe son×ortho — la cohorte FAITE PROPREMENT (R66, mesuré)

L'argmax du §1.1 était **fainéant** : il jette la distribution de phonème ET le contexte ortho. La doctrine (mémoire §6/§17.3) impose **croiser = jointe** `P(lettre | phonème, contexte)`, pas argmax ni produit. Implémenté (`M_NEO_PHON_COHORT_JOINTE`, OFF-inerte) :
- `_neoCRS` : table jointe **sonore** `phonème|G|D` (+backoffs), apprise **descendant** (mirror de `_neoCR` muette, ligne ~6938) ;
- `_neoPhonCohortDist()` : distribution phonème **molle** de la cohorte board (pas argmax) ;
- décision : `Σ_φ Pcoh(φ|p) · CRsonore[φ | voisins révélés]`, backoff L2 marginal. Seuil propre `M_NEO_PHON_COHORT_JOINTE_CONF = 0,30`.

**Mesure (in-lexique K=1, warmup 200 / test 100 mots distincts, 4 graines) :**

| Cheat-free | winrate moyen | par graine |
|---|---|---|
| cohorte **argmax** (§1.1) | 94,3 % | [95, 94, 95, 93] |
| cohorte **JOINTE @0,30** | **96,5 %** | [96, 96, 97, 97] |
| *(réf son-lu, triche pendu)* | *98,0 %* | *[98, 98, 99, 97]* |

**Verdict :** la jointe bat l'argmax de **+2,2 pts, à chaque graine** (jamais en-dessous), cheat-free, et **réduit l'écart à la version qui triche de −3,7 à −1,5 pt**. Le « croiser = jointe » de la doctrine, mesuré et confirmé. Adopté comme **voie cheat-free recommandée** (toggle OFF par défaut, conf 0,30 réglable en UI).

**Morpho jonction #1 (distance-de-fin) — FALSIFIÉ (R66, §6.4 barrière de mérite).** Tenté : ajouter `e` = distance-de-fin au contexte de la jointe (`_neoCRS`, clés `φ|eE|G|D`, `φ|eE|D` prepended). Mesuré K=1, 4 graines (warmup 200 / test 100) : jointe **+morpho 96,0 %** vs jointe **bigramme 97,0 %** (−1,0 pt, perd dans 3/4 graines). Cause : `e` **fragmente `_neoCRS`** (cellules trop creuses à warmup 200 → estimations bruitées) et reste un **proxy grossier** (ne capte pas le *contenu* du suffixe). **Reverté** (pas de cimetière). Piste morpho suivante (jonction séparée) : contexte = **suffixe révélé / segment AQUA `SEG`** (le contenu, pas la distance).

---

## 2. Findings structurels (par sévérité)

### 🟠 S1 — Le chemin de décision réel ≠ le récit architectural *(vérifié)*
Les **derniers ~7 pts** (90→97,5) viennent **entièrement de la cascade de declares** (`WORD_DECLARE → BPC_DECLARE → DECLARE_DUAL → EMERGENT → NEO`, 7080–7189) : recall **+1,76**, assemblé **+5,28**, cohorte **+0,5**. Le **concept M3_d, le miroir Möbius, le hub M_S** portent la base cognitive ~90 % mais **rien** du saut declare. Structurellement : *scoreur cognitif modeste + forte cascade de déclaration*. À assumer dans la communication.

### 🟠 S2 — M2_d/M3_d dominés par la longueur *(vérifié)*
- `M3_d_step`:4241 — fix `« encoder depuis M1 (riche), pas M2 (lave) »` → **M2_d lessivé** (ne code que la longueur).
- bPC = autoencodeur de **reconstruction** (4273, `w += LR·a·(m2 − m2hat)`) sur entrée dominée par la longueur, goulot **12 cellules** → effondrement de modes (7/12 mortes).
- `M3_d.output` **norme non bornée** (~8, point fixe Hebbian α/α=8 ; 6383), rustine `normalizeInPlace`.
→ Le concept est **structurellement un détecteur de longueur**, pas un discriminateur de lettres (cause-racine de son inertie ; cf. §3).

### 🟡 S3 — Tissu cicatriciel & code vestigial *(vérifié)*
Monolithe ~11 k lignes + lexique, **87 fonctions** entrelacées, commentaires = historique de patchs (`R41-#1..#11`, `F177/F198/F169`). Exemple : `cStep` étape (5) `pairConv` marqué **« transitoire, sera retiré Jour 6' »** (6393) — jamais retiré. Édition via extraction `/tmp`. **Aucun test ne garde le comportement** (la CI ne teste que la dictée) → risque #1 de régression silencieuse. *Reco : un harnais headless seedé en CI qui `assert` cognition seule ≥ 90 % et +NEO ≥ 97 %.*

### 🟡 S4 — Dérive doc↔code (miroir phon)
La doc dit `M2_phon_m`/`M1_phon_m` « jamais construits » ; l'inventaire montre `M2_phon_m_step`(3865) et `M1_phon_m_step`(3888) **existent**. Soit *existent-mais-non-câblés*, soit doc périmée. À réconcilier (typiquement là que se loge le code mort).

### 🟢 S5 — Discipline OFF-inerte réelle *(vérifié)*
Chaque brique derrière un flag (`if (M_S_ENABLED)`, `if (M_BPC_M3D_ENABLED && M3_d.bpcW)`, `if (m3Ok)`…) ; le toggle **`M3_D_BYPASS` existe** (4292). La baseline-byte-identique est **structurellement crédible** (les flags gardent des blocs, ne patchent pas des sorties). Coût : espace de config combinatoire de 47 flags, peu de présets réellement mesurés.

### 🟡 S6 — Puissance statistique mince
Le 97,5 % = 4 graines × 120 = **480 parties** ; R66 recommande ≥ 200 × 4. Plusieurs Δ pivots sont des mesures uniques. Directions crédibles, marges fragiles (±0,59).

---

## 3. M3_d — diagnostic + piste falsifiable (différente des essais passés)

**Déjà falsifié (ne pas refaire) :** loger le banc épisodique dans M3_d (mur de capacité 12 cellules) ; coupler le readout reward en config pleine (nuit, A2 redondant).

**Diagnostic neuf :** les cellules sont entraînées par **reconstruction** (objectif génératif, 4273) d'une entrée **dominée par la longueur** → elles apprennent la variance dominante (longueur/forme), pas à **discriminer les lettres**. Le readout reward n'a alors aucun signal discriminant → contribution plate. **Objectif mal aligné sur la tâche.**

**Piste (hypothèse, OFF-inerte, cheat-free) :** remplacer l'objectif de reconstruction par une **prédiction masquée** self-supervised : entraîner les 12 cellules à **prédire la lettre d'une position révélée à partir des autres positions révélées** (révélé→révélé, donc montant-légal). Pression discriminative alignée sur la tâche ; le goulot doit encoder la co-occurrence lettre/phonotactique = la « couche morphologique » de la roadmap §10.

**Protocole R66 (contrôle = `M3_D_BYPASS` existant) :**
1. AUC présent/absent de `cLetterScore` actuel (reconstruction) = baseline.
2. Ré-entraîner sur masked-prediction, re-mesurer l'AUC.
3. Si AUC ↑ **et** couplage utile **en config pleine** → M3_d devient contributeur. Si AUC plat → mur 12 cellules confirmé, on **clôt** la question (la familiarité reste dans le banc).

Soit ça marche, soit ça ferme l'incertitude par la mesure.

---

## 4. Synthèse priorisée
1. **Communication** : toujours afficher le régime (« 97,5 % in-lexique, mot entendu » ; repères sans prémisse 70,7 % / 22 %).
2. **g2p** : trancher l'une des 3 options (recommandé : 1 + libellé de régime ; ou 2 pour la pureté pendu — **coût réel après garde : ~0 in-lexique / ~7,5 pts OOV, §1.1**). Option 2 codée OFF-inerte + garde de pureté (`M_NEO_PHON_COHORT_ENABLED` / `_PURITY`).
3. **CI** : harnais seedé gardant 2-3 chiffres clés (anti-régression du monolithe).
4. **M3_d** : tenter la masked-prediction, ou clore par `M3_D_BYPASS` + AUC.
5. **Hygiène** : retirer le vestigial (`pairConv`…), réconcilier la doc miroir phon.

*Tous les points laissent la baseline OFF-inerte (byte-identique au repos). Aucune action de cet audit n'a modifié le moteur.*
