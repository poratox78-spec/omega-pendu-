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
2. Dériver le son du **cohort board** (consensus des prononciations compatibles) → réellement board-only, ≈78 % (tension A2).
3. Couper la route assemblée au pendu → −5,28, ~92 % 100 % board-only.

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
2. **g2p** : trancher l'une des 3 options (recommandé : 1 + libellé de régime ; ou 2 pour la pureté pendu).
3. **CI** : harnais seedé gardant 2-3 chiffres clés (anti-régression du monolithe).
4. **M3_d** : tenter la masked-prediction, ou clore par `M3_D_BYPASS` + AUC.
5. **Hygiène** : retirer le vestigial (`pairConv`…), réconcilier la doc miroir phon.

*Tous les points laissent la baseline OFF-inerte (byte-identique au repos). Aucune action de cet audit n'a modifié le moteur.*
