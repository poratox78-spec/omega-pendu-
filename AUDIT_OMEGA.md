# Audit structurel — moteur OMEGA-Ω (pendu) — 2026-06-15

Audit **du moteur cognitif** (`app/omega-pendu.html`), distinct de l'audit monorepo (`CLAUDE.md`).
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
- Descendante ortho (5 étages) : `M5_m_step`(5252) → `M4_m_step`(5301) → `M3_m_step`(5435, **seul étage qui écrit `conceptCells`**) → `M2_m_step`(5513) → `M1_m_step`(5579, co-décide M5 ; **poids 0,1** — F198, *pas* 0,0 ; cf §1.4/D2).
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

**Morpho jonction #2 (backoff DENSE depuis le lexique) — NET-NEUTRE / bruit (R66, §6.4) — 2026-06-16.** Leçon de #1 : la cause de l'échec = **données creuses** de `_neoCRS` à warmup 200 (pas le type de contexte) ; et le `g2p` de `_DECL2` sort en **IPA** ≠ **SAMPA** de la voie assemblée NEO (ne se clavent pas sans couche de conversion). Tenté (toggle `M_NEO_MORPHO`, OFF-inerte) : quand la cellule jointe apprise est creuse, **backoff vers une table `phonème|G|D` DENSE construite une fois depuis tout le lexique** (via `align`/SAMPA, mêmes clés/backoffs que `_neoCRS`) au lieu du `L2` plat marginal — cheat-free (savoir phonotactique général, comme `L2` ; jamais `currentWord`). Mesuré K=1, 4 graines (warmup 200 / test 100, config `CONFIG_TOGGLES.md` épinglée) : jointe **bigramme 95,0 %** [97,97,97,89] vs **+morpho dense 95,3 %** [97,95,99,90] → Δ moyen **+0,3** mais **[+0,0, −2,0, +2,0, +1,0]** (perd à la graine 777) = **dans le bruit** (SE ≈ ±2 à N=100). Diagnostic : le résidu de la voie cohorte n'est **pas** dans le backoff (la jointe décide surtout là où elle a du signal ; les vraies pertes — ex. graine 99 à **89‑90 %** alors que le son‑lu fait 98 — viennent de l'**ambiguïté cohorte** sur des mots durs, pas du choix `L2`‑vs‑dense). **Reverté** (app + mode de mesure ; barrière de mérite non franchie, pas de cimetière). **Conclusion morpho :** le levier du résidu cheat-free est la **puissance/qualité de la cohorte** (et les graines dures), pas un raffinement du backoff phonème→lettre. La piste SEG‑contenu reste non testée (exigerait une couche IPA↔SAMPA), mais ce négatif suggère un ROI faible tant que le résidu vit dans la cohorte, pas dans la table phon→graphe.

### 1.3 Reproduction indépendante (R66, §1.2 falsifiabilité / §6.3 preuve) — 2026-06-16

Les chiffres §1.1/§1.2 venaient de la session précédente (inaccessible). Doctrine : *« un résultat non reproductible est nul »*. **Rejoué de façon déterministe** par un harnais headless dédié — `evo/ab_cohort.js` — qui **miroite le protocole du bench embarqué `_omega_trexquant_bench`** (même `baseCfg`, warmup/test, RNG LCG seedé, filtrage OOV) et pilote le **vrai** code de décision (`startNewGame`/`omegaStep`), via un pont `evalIn` ajouté à `evo/fitness_harness.js` (lecture/écriture des toggles par référence ; baseline non modifiée). Rejouable :
`node evo/ab_cohort.js oov 300 80 12345,777` · `node evo/ab_cohort.js inlex 200 100 12345,777,2024,99`.

**§1.1 (OOV, warmup 300 / test 80).** Reproduction **exacte** à la graine 12345 :

| OOV | graine 12345 | graine 777 | moyenne |
|---|---|---|---|
| son-lu (`wp.get`) | 73,8 % | 60,0 % | 66,9 % |
| cohorte argmax + garde 0,5 | **66,3 %** | 53,8 % | 60,0 % |
| **Δ coût d'honnêteté** | **−7,5** | −6,2 | **−6,9** |

→ confirme le coût OOV **~7 pts** (claim ~7,5). Le 73,8 / 66,3 à la graine 12345 est **identique au tableau §1.1** : le miroir de config est fidèle.

**§1.2 (in-lexique K=1, warmup 200 / test 100, 4 graines).** Le son-lu reproduit **98,0 % pile** (= réf §1.2), ce qui valide la config de base. La jointe :

| in-lexique K=1 | 12345 | 777 | 2024 | 99 | moyenne |
|---|---|---|---|---|---|
| réf son-lu (triche pendu) | 96 | 99 | 99 | 98 | **98,0 %** |
| cohorte **argmax** | 93 | 94 | 94 | 89 | 92,5 % |
| cohorte **JOINTE @0,30** | 97 | 97 | 97 | 89 | **95,0 %** |
| **Δ JOINTE − argmax** | +4 | +3 | +3 | **+0** | **+2,5** |

**Verdict reproduit (honnête).** Le cœur tient : la **jointe bat l'argmax de +2,5 pts en moyenne** (claim +2,2) et **n'est jamais en-dessous** — *« croiser = jointe »* (doctrine §3) confirmé sur le harnais déterministe. **Nuance** : sur ce jeu de graines, le strict *« à chaque graine »* devient **3 victoires + 1 égalité** (graine 99 : 89 = 89) ; et l'écart résiduel à la triche est **−3,0 pts** (le −1,5 du §1.2 était optimiste — dépend du pool de mots). Rien n'infirme l'adoption (jointe ≥ argmax partout, gratuit en pureté), mais les bornes honnêtes sont **+2,5 / jamais-sous / résiduel −3** sur graines {12345,777,2024,99}.

> Tout reste **OFF par défaut** (baseline byte-identique). La reproduction n'a **pas** modifié le moteur ; elle ajoute un harnais (`evo/`) et cette sous-section.

### 1.4 Audit des deux voies descendantes (miroir) — lecture **du code** (2026-06-17)

Méthode : lecture des fonctions miroir + traçage des **consommateurs réels** (qui *lit* l'état produit ?), pas seulement des appels. Distinction clé : *appelé* ≠ *effectif*. Une fonction qui écrit un buffer que **personne ne lit** est du code vivant mais inerte.

**Voie ortho descendante** — appelée **sans garde** dans `omegaStep` (7290-7294 : socle, pas un toggle).

| Étage | Ligne | Écrit | Consommateur réel | Effectif ? |
|---|---|---|---|---|
| `M5_m_step` | 5252 | `M5_m.output{letter,reward}` + canal M5 | tous les étages sous lui | ✅ source |
| `M4_m_step` | 5301 | `M4_m.letterPenalty` (homéo + reward + floor + tanh) | `M1_m` (5585) | ✅ |
| `M3_m_step` | 5435 | **anti-Hebbian sur `conceptCells`** (seul étage miroir qui écrit le hub, 5467/5486) ; `M3_m.output` | hub M_S (5714, poids 0,5) + `OS_diss` (2076) | ⚠️ effet winrate **~+0,3 non-signif.** (révision F207, 5443-5445) |
| `M2_m_step` | 5513 | `M2_m.zonePenalty` (+ A5 cvPattern positionnel) ; `M2_m.output` | canal M2 + `OS_diss` (2060) **seulement** | ⚠️ pèse sur la dissonance structurelle, **pas sur le scoring-lettre** |
| `M1_m_step` | 5579 | `M1_m.letterScore = 1−penalty` ; canal `M_BOUCLE` | **co-décide M5 (5140-5153, NON gardé)** + source COUCHE_A (4996) ; `M_BOUCLE`→M1_d (4043) seulement si B2 Möbius ON (OFF) | ✅ **co-décideur vif à 0,1** |

**Voie phon descendante** — gardée par `M_PHON_FEEDBACK_ENABLED` (7297 ; préset ✔ en config de référence).

| Étage | Ligne | Écrit | Consommateur | Statut réel |
|---|---|---|---|---|
| `M5_phon_m_step` | 3823 | `M5_phon_m.output{letter,reward}` | étages sous lui | ✅ source |
| `M4_phon_m_step` | 3835 | `M4_phon_m.letterPenalty` | **lu en 3590** (biais lettre M4_phon ascendant) | ✅ **effectif** |
| `M3_phon_m_step` | 3854 | `lastDominantCell` | aucun | 🔵 **observationnel** — n'écrit PAS le hub (l'effondrerait, commenté 3867-3871 : normes→0, ortho −7 pts) |
| `M2_phon_m_step` | 3879 | `M2_phon_m.zonePenalty` | **aucun** (init 2768 + écriture seules) | ⚫ **dormant** (« NEW polyvalence A », appelé sans lecteur) |
| `M1_phon_m_step` | 3902 | `M1_phon_m.letterScore` | **aucun** (init 2769 + écriture seules) | ⚫ **dormant** |

**Cheat-free.** Les deux voies sont **descendantes = post-résultat** → lire le mot complet est légitime (cap §43, le « professeur »). `M2_m`/`M2_phon_m` lisent `currentWord.length` (5540, 3889) — longueur seule, descendant → aucune fuite montante.

#### Deux dérives doc↔code tranchées par le code

- **D1 — S4 résolu (rapport §5.2 périmé).** Le rapport affirme `M2_phon_m`/`M1_phon_m` « jamais construits ». **Faux** : ils existent (3879, 3902) **et sont appelés** (7301-7302). Nuance honnête : *construits + appelés mais sans consommateur* → inertes en **effet**, pas en **exécution**. Vérité de la voie phon : **effectif s'arrête à `M4_phon_m`** (lu en 3590) · `M3` observationnel · `M2`/`M1` **mort-nés** (candidats S3, ou à brancher si on muscle la voie phon — rapport §12).
- **D2 — dérive nouvelle, plus sérieuse (audit §0 + rapport §5.3 périmés).** Les deux affirment « `M1_m` co-décide M5, **poids 0,0 en baseline** ». **Faux dans le code courant** : `M5_D_M1_M_WEIGHT = 0.1` (ligne 1604, F198 « rebranchement M1_m »), **gardé par un assert** (7418 : `=== 0.1`), appliqué **sans toggle** (5149 : `score *= (1 − W + ls·W)`). Donc la voie ortho descendante **influence vraiment la décision montante** à 0,1, à chaque coup — pas inerte. Seul le schéma §5.2 du rapport hedgeait à demi (« 0,0 en baseline v7 ; ~0,1 ultérieurement ») ; la table de constantes §5.3 et l'audit §0 étaient stale à 0,0. **Corrigé (2026-06-17)** : rapport §5.2/§5.3/§16.2 + audit §0 portent désormais **0,1 (F198)** ; D1 (rapport §5.2 « jamais construits ») corrigé en « construits + appelés, sans consommateur ».

#### Ancrage littérature (DRC / IA / HRR) — revue faite (2026-06-17)

Le mapping voies descendantes ↔ routes DRC tranche le sens des deux dérives :

- **Miroir ortho ↔ voie lexicale (activation interactive, McClelland & Rumelhart 1981).** L'IA a un **feedback top-down mot→lettre** qui « excite les lettres du mot, inhibe les autres » = l'effet de supériorité du mot = **de la discrimination de lettres**. Donc `M1_m` co-décidant à 0,1 (D2) est **légitime au sens DRC**, pas une entorse de fond ; le vrai défaut est qu'il est **non débranchable** (faille R66) et qu'il **n'a jamais été mesuré seul**.
- **Miroir phon ↔ voie sublexicale (GPC).** La GPC de DRC est **série, feedforward, sans feedback**. Brancher `M2_phon_m`/`M1_phon_m` comme co-décideurs serait **anti-DRC** → leur « utilité » n'est pas dans la décision (candidats hygiène S3, ou rôle non-décisionnel type cleanup HRR).
- **HRR (Plate ; resonator Frady 2020).** Le bind est une **mémoire associative clé→valeur**, pas un moteur de prédiction de lettres (cf. mémoire §6 : 19 % vs 64 %). Confirme : ne pas câbler les dormants phon en scoring-lettre.

> **Chantier ouvert (R66, non tranché).** (1) `M1_m` : poser un toggle débranchable + mesurer son Δ seul (K=1, 4 graines) — ferme la faille R66 et teste si le feedback IA gagne ses 0,1. (2) `bPC readout` (0,20) : ablation/repurpose (le concept porte la *longueur*, pas la lettre — audit §3). (3) Dormants phon : trancher (supprimer vs cleanup). **Ordre choisi (Rem, 16/06→17/06) : corriger les docs d'abord (fait), puis arbitrer les jonctions.**

#### 1.4.1 — Jonction M1_m mesurée (R66) — 2026-06-17 · FALSIFIÉE (n'gagne pas ses 0,1)

Toggle `M5_D_M1_M_ENABLED` posé (défaut **ON** = baseline byte-identique ; court-circuit `true` sur les 2 blocs de co-décision en `cStep`). Ferme la faille R66 (M1_m était le seul co-décideur non gardé). Harnais : `evo/ab_m1m.js` (réutilise `loadEngine`/`evalIn` + protocole `pickSets` de `ab_cohort.js`), in-lexique K=1, warmup 200 / test 100, 4 graines {12345,777,2024,99}, ON vs OFF apparié.

| Config | M1_m ON (0,1) | M1_m OFF (0,0) | Δ ON−OFF | par graine |
|---|---|---|---|---|
| cognition seule (declares OFF, isole M1_m) | 88,5 % | 89,8 % | **−1,3** | [−8, +4, −4, +3] (2 gains / 2 pertes, σ≈±8) |
| référence (+NEO, config qui ship) | 98,0 % | 98,0 % | **+0,0** | [+1, −1, 0, 0] (égalité) |

**Verdict.** M1_m à 0,1 **ne bat OFF nulle part** : égalité franche en référence (les declares NEO lavent le tweak per-lettre), neutre-à-négatif en cognition pure (−1,3, dans le bruit). La légitimité DRC de principe (feedback top-down mot→lettre, effet de supériorité du mot) **ne se traduit en aucun gain mesuré** → **falsifié** au sens §6.4 (barrière de mérite). Le toggle laisse les deux défauts réversibles (R66). Rejouable : `node evo/ab_m1m.js both 200 100 12345,777,2024,99`.

**POURQUOI (mécanisme prouvé — `evo/diag_m1m.js`, R67 lecture seule).** Un Δ sans cause ne vaut rien (§1). Diagnostic instrumenté de ce que `M1_m.letterScore` porte au moment de décider (cognition, warmup 200 / test 80) :

| Mesure | M1_m | Référence (prior fréquence brut 1−letterTarget) |
|---|---|---|
| GAP discrimination in-word − out-word | **+0,0216** | **+0,0229** (≈ identique) |
| corr( M1_m tick0 , prior fréquence ) | **0,999** | — |
| variance de `letterScore[l]` **entre mots** (tick 0) | **9,8·10⁻⁶ ≈ 0** | — |

Lecture : (a) M1_m **ne discrimine le mot qu'à hauteur de la fréquence brute** (gap identique au prior) ; (b) `M1_m.letterScore` **EST** le prior de fréquence global (corr 0,999) ; (c) c'est un **vecteur global** — mêmes 26 valeurs quel que soit le mot (variance ~10⁻⁵), **zéro info spécifique au mot**. Deux causes-racines, exactement la thèse « connexions + sens des flux » :

1. **Redondance.** M1_m réinjecte une **fréquence-lettre globale** déjà portée par M4_d natif (30 %, rapport §5.1) → double comptage → bruit → Δ ≤ 0.
2. **Déconnexion du miroir (le fond).** Origine : `M1_m.letterScore = 1 − M4_m.letterPenalty`, et `letterPenalty` homéostate vers `letterTarget` = **prior de fréquence inverse** (init 2904-2921, assert 7811-7816). Surtout : `M1_m_step`(5579) **ne lit que** `M4_m.letterPenalty` + `M5_m` (récompense scalaire) — **jamais `M3_m` (concept) ni `M2_m` (position)**. La « cascade descendante » M5_m→M4_m→M3_m→M2_m→M1_m est un **ordre d'appel, pas un flux de données** : 3 prises **parallèles** sur la même récompense. **Le concept (M3_m) n'atteint jamais la décision-lettre.** M1_m « hérite » donc d'un signal plat ; aucun réglage de poids ne peut le sauver tant que la **connexion concept→lettre** (et le sens du flux, p.ex. phon→ortho) n'est pas posée.

→ **Conséquence pour la décision de défaut.** Le débat ON/OFF est secondaire (les deux ~égaux) ; le vrai sujet est **en amont** : (i) le concept M3_d/M3_m discrimine-t-il les lettres, ou est-il lui-même un détecteur de longueur (S2) ? (ii) faut-il **câbler** la correction concept/position → lettre (et dans quel sens, ortho↔phon) ? Prochain pas instrumenté : mesurer si `M3_m`/`M2_m` portent un signal **spécifique au mot** (sinon recâbler M1_m ne sert à rien — la racine serait le concept, audit §3 prédiction-masquée).

#### 1.4.2 — Diag amont (concept/position) + statut documenté — 2026-06-17 · H2 CONFIRMÉE

Diagnostic `evo/diag_mirror.js` (R67, cognition, warmup 200 / test 80) — le concept/position portent-ils un signal **spécifique au mot** (H1) ou sont-ils **globaux/longueur** (H2) ?

| Mesure | Résultat | Lecture |
|---|---|---|
| (A) cellules concept vivantes | **7/12** ; cellule **#10 domine 79 %** | 1 concept pour presque tout |
| (B) test détecteur de longueur | **1 cellule modale (#10) sur 6 longueurs** (56–87 %) | signature **détecteur de longueur** |
| (C) `M3_d.output` norme | **0,000** | sous bPC le concept ne passe pas par `M3_d.output` (découplé) |
| (D) `M2_m.zonePenalty` variance inter-mots | **2,1·10⁻⁶ ≈ 0** | position **globale** aussi |

**Verdict : H2.** Concept et position sont **globaux/longueur**, pas spécifiques au mot. **Recâbler M1_m←M3_m/M2_m ne propagerait rien** — la racine est le **mur de capacité des 12 cellules** (S2/§3), pas la connexion de M1_m.

**Déjà documenté + solution essayée/falsifiée (réponse « appliquée ou non ») :**
- `notes/MOTEUR_HISTORIQUE.md §E` (03/06) mesurait déjà le collapse (cross-mot cosine **0,9479**, 1 cellule 35/39, 9/12 mortes ; `M3_d.output=0` sous bPC). Mes chiffres le **reproduisent**.
- Solution tentée = **câbler concept→M4** (le mot rappelé injecté comme concept dans le scoring) → **FALSIFIÉE −1,33**, *« contamine le scoring-lettre… le chemin concept→M4 est le mauvais endroit. Ne pas reproposer. »* **Revertée, non appliquée.**
- Principe Rem documenté (`notes/MOTEUR_HISTORIQUE.md §C-D`) = celui de cette session : *« si ça ne rend pas au système, on a mal câblé, pas l'approche »* ; la fix-câblage qui a marché là = le **trigger** (gate sur l'incertitude cognition) → rend la brique **neutre**, pas un levier.
- **Non essayé** : prédiction-masquée des 12 cellules (audit §3) — mais **même mur de capacité** (AUC familiarité 0,64 à K=12). Le flux qui marche est documenté : **phon→ortho** (assemblé +5,28) et **declare** (recall +1,76), pas concept→lettre.

→ **Bilan jonction M1_m.** Mécanisme prouvé + amont diagnostiqué + littérature interne croisée : M1_m ne peut pas gagner ses 0,1 (prior fréquence redondant) **et** la « réparation par connexion » est un **cul-de-sac documenté** (concept global + concept→scoring falsifié). Le toggle R66 reste l'acquis net (débranchable + mesuré).

**DÉCIDÉ (Rem, 2026-06-17) : défaut `M5_D_M1_M_ENABLED = false`** (OFF). Justifié par le *mécanisme* (pas un Δ bruité) : OFF est plus simple et égal-ou-meilleur (réf égalité, cognition +1,3). Le toggle reste (ON réactivable pour A/B). (b) prédiction-masquée §3 = écartée court-terme (même mur de capacité) ; (c) **prochaine jonction = sens du flux phon→ortho** (la force mesurée, +5,28 assemblé) — instrumenter la voie phon descendante (dont les dormants M2/M1_phon_m du §1.4).

#### 1.4.3 — Sens du flux : le miroir PHON descendant porte un signal spécifique au mot (≠ ortho) — 2026-06-17

**Bug de harnais corrigé d'abord (honnêteté §1.7 « pas de null muet »).** Les buffers de la voie phon (`M4_phon_m.letterPenalty`…) ne sont alloués **que si `M_VOIE_PHON_ENABLED` est vrai à `initOmegaGlobals`** (app `if(M_VOIE_PHON_ENABLED)` ~2768). Or `evo/*` faisait `init()` **puis** config → voie phon **inerte** (buffers null). Un 1er `diag_phonm` a affiché `0,0000`/`0` = **artefact null**, *retiré*. Corrigé : config **avant** init (+ garde dure anti-null). ⚠️ **Implication** : `ab_m1m`/`ab_cohort` tournaient voie phon **inerte** — la mesure M1_m (ortho, buffers inconditionnels) **tient**, mais les bases « cognition »/« référence » citées étaient **ortho+NEO sans voie phon active** ; les reproductions §1.3 sont à re-vérifier avec init correct (séparé).

**Mesure contrôlée (voie phon active, cognition, warmup 200 / test 80).** Score-lettre = `1 − letterPenalty` (sens de consommation 3590). Contrôle = gap de la **fréquence** (`1 − M4_m.letterTarget`) sur la même pondération in/out :

| Miroir descendant | GAP brut (in−out) | GAP fréquence (contrôle) | **GAP NET** | variance inter-mots |
|---|---|---|---|---|
| **ortho `M1_m`** (§1.4.1) | +0,0216 | +0,0229 | **≈ 0** (pur fréquence → mort) | ~1·10⁻⁵ |
| **phon `M4_phon_m`** | +0,0497 | +0,0222 | **+0,0276** | 1,53·10⁻³ |

Robuste 3 graines : GAP NET = **+0,028 / +0,020 / +0,028** (12345/777/2024), variance 1,5–1,8·10⁻³.

**Verdict (tranche la thèse « sens des flux »).** Le miroir **ortho** descendant ne porte que de la fréquence (mort, M1_m) ; le miroir **phon** descendant porte un signal **spécifique au mot, au-delà de la fréquence** (+0,02–0,03). **C'est la confirmation que la direction phon→ortho porte un signal là où l'ortho n'en porte pas** (cohérent assemblé +5,28, mémoire). Nuances honnêtes : (i) `M4_phon_m` est **déjà consommé** (3590) quand la voie phon est active → le signal est déjà partiellement utilisé ; (ii) le bug d'init impose de re-mesurer les A/B voie-phon avec init correct (fait, §1.4.4). Outil : `evo/diag_phonm.js`.

**(a) MESURÉ — le signal phon descendant ne se traduit PAS en winrate (`evo/ab_phonfb.js`, 2026-06-17).** A/B `M_PHON_FEEDBACK` ON vs OFF, voie phon active (init corrigé), cognition, in-lex K=1, warmup 200 / test 100, 8 graines : **ON 91,4 % · OFF 91,8 % · Δ −0,4** · par graine `[+2,−1,+1,−6,−1,+1,+2,−1]` (4 gains / 4 pertes). **Le signal +0,028 existe (discrimination réelle) mais est winrate-inert** — comme M1_m. Le routage actuel (biais multiplicatif 3590) ne le convertit pas en victoires (cognition + OS tranchent déjà la lettre sans lui). → réveiller les dormants `M2/M1_phon_m` est *a fortiori* peu prometteur (l'effectif `M4_phon_m` n'aide déjà pas).

#### 1.4.4 — Dette d'intégrité : repro §1.2/§1.3 (jointe) re-mesurée voie phon ACTIVE → l'avantage DISPARAÎT — 2026-06-17

Conséquence directe du bug §1.4.3, traitée avant tout nouveau chantier (« b puis a », Rem). `ab_cohort.js` corrigé (config avant init + garde anti-inerte). Repro **in-lexique K=1**, warmup 200 / test 100, **8 graines** {12345,777,2024,99,2025,7,314,1000}, voie phon **réellement active** (selfTests OK) :

| condition | moyenne 8 graines | §1.3 documenté (voie phon **inerte**) |
|---|---|---|
| son-lu (triche) | 98,5 % | 98,0 % |
| cohorte **argmax** | **95,3 %** | 92,5 % |
| cohorte **jointe** @0,30 | **94,9 %** | 95,0 % |
| **Δ jointe − argmax** | **−0,4 pt** (3 gains / 2 nuls / 3 pertes) | **+2,5 (jamais sous)** |

Δ par graine : `[+0,+3,+1,−4,+0,−3,+1,−1]`. **La voie phon active fait surtout monter l'argmax (92,5→95,3), ce qui efface l'avantage de la jointe.**

**Verdict.** Le « +2,5 / jamais en-dessous » du §1.2/§1.3 (qui justifiait l'adoption de la **jointe cheat-free**) était un **artefact du harnais voie-phon-inerte**. Voie phon active : **jointe ≈ argmax** (−0,4, perd 3/8). **L'adoption de la jointe est à rouvrir.** Bornes honnêtes : (a) **affecté** = repros headless in-lexique (§1.2/§1.3) ; **OOV §1.1 non affecté** (CFG_OOV met la voie phon OFF volontairement) ; (b) ça **n'infirme pas le principe** doctrinal « croiser = jointe » (§3) — seulement *cette preuve empirique* ; (c) le **bench in-page** (UI) ré-init la voie phon au toggle → potentiellement OK, c'est la **mesure headless** qui était fausse. Rejouable : `node evo/ab_cohort.js inlex 200 100 12345,777,2024,99,2025,7,314,1000`.

> ⚠️ **Marqueur sur §1.1/§1.2/§1.3** : les chiffres in-lexique de ces sous-sections (et la conclusion « jointe adoptée ») ont été obtenus **voie phon inerte** (bug §1.4.3). À relire à la lumière de §1.4.4. L'OOV (§1.1) reste valide.

#### Bilan §1.4 — les voies descendantes (miroir) : motif unique

Investigation lancée sur l'intuition Rem « M1_m/M3_m mal connectés, problème de connexions et de sens des flux ». Mesuré, bout à bout :

1. **Miroir ortho `M1_m`** (0,1) : prior de fréquence global, redondant, **winrate-inert** → défaut **OFF** (§1.4.1).
2. **Concept/position `M3_m`/`M2_m`** : globaux/détecteurs de longueur (1 cellule = 79 %) ; réparation concept→M4 **déjà falsifiée** (−1,33, §1.4.2).
3. **Miroir phon `M4_phon_m`** : porte un vrai signal **spécifique au mot** (+0,028, ≠ ortho) **mais winrate-inert** dans le routage actuel (§1.4.3 + (a) §1.4.3).
4. **Bonus** : la correction du bug d'init a montré que l'**adoption de la jointe** reposait sur un harnais voie-phon-inerte → **à rouvrir** (§1.4.4).

**Motif unique (cohérent avec la doctrine et les notes) :** *aucune des voies descendantes ne convertit en winrate, quelle que soit la direction.* Le signal qui gagne est **ascendant** — assemblé phon→ortho (+5,28) et recall (+1,76), via le **declare**, pas via la correction descendante (cf. `MOTEUR_HISTORIQUE §E` : « le chemin concept→M4 est le mauvais endroit »). La thèse « sens des flux » de Rem est **validée et bornée** : la bonne direction *porte* bien plus de signal côté phon, mais c'est l'**ascendant** (décode), pas le **descendant** (miroir), qui fait gagner. Conséquence : les dormants `M2/M1_phon_m` = **hygiène S3** (pas de levier attendu) ; chantier winrate = côté **ascendant/declare** (déjà la force d'OMEGA).

---
### 1.4·b (fil declare, ex-PR #6) Le declare cheat-free ne croise pas les deux routes — et croiser AU concept (M3_d) dégrade (R66) — 2026-06-16

**Vérifié (code).** Le declare NEO (7210-7248) combine ses voies en **cascade « soit l'un soit l'autre »** : recall → SINON assemblé (phon→ortho) → SINON muette (ortho-contexte). **Pas de jointe entre voies**, et **une seule direction** (phon→ortho ; aucune voie ortho→phon). Il **n'utilise ni le hub concept `M_S`** (fusion amodale M3_ortho+M3_phon, 1771/5062) **ni les branches descendantes** (`M3_phon_m_step` renforce les `conceptCells` partagées, 3854) — il court-circuite le croisement par le concept, *la* mécanique OMEGA. (La cognition **par-lettre**, elle, croise bien via `M_S`/OS `w(r)` — c'est le ~98 % de base.)

**Testé (R66).** Réveil du croisement dormant `M_BPC_CROSSMODAL` (M3_d perçoit `M1_d ⊕ M1_phon`, hub-and-spoke Rogers 2004, bPC descendant ; poids `bpcW_phon` alloués mais OFF, 2827). Mesuré K=1, 4 graines (config `CONFIG_TOGGLES` épinglée, régime son-lu) :

| | 12345 | 777 | 2024 | 99 | moy. |
|---|---|---|---|---|---|
| config réf. (cross-modal OFF) | 96 | 99 | 99 | 98 | **98,0 %** |
| + CROSS-MODAL ON | 95 | 95 | 97 | 93 | **95,0 %** |
| Δ | −1 | −4 | −2 | −5 | **−3,0** |

→ **net −3,0, perd aux 4 graines = falsifié** (un smoke N=25/1 graine donnait +4 — bruit). Croiser les deux routes **au concept 12 cellules** le **contamine** — cohérent avec le mur de capacité (§3, mémoire §8.1) et la falsification « banc dans M3_d ». La cognition croise déjà via `M_S`/OS ; en rajouter au concept sur-contamine.

**Acquis convergent.** Trois leviers pour pousser le declare cheat-free ce cycle — morpho distance (#1), morpho backoff dense (#2, §1.2), croisement cross-modal (#1.4) — **tous net-négatif/bruit**. Le résidu cheat-free (~2-3 pts sous le son-lu) ne vit **ni** dans la table phon→lettre **ni** dans le concept M3_d : il est dans l'**ambiguïté cohorte** (mots durs), et le croisement *utile* est **déjà** capté par `M_S`/OS au niveau lettre. Mesure reproductible : `node evo/ab_cohort.js xmodal 200 100 12345,777,2024,99`.

### 1.5 Pousser le declare cheat-free SANS currentWord — exploration complète (R66) — 2026-06-16

Question : combler le trou du declare **sans aucune lecture de `currentWord`** (cohorte-jointe seule = **94,8 %** vs son-lu/«mot entendu» 98,0 %, K=1 4 graines). Comparaison **DUAL (`_DECL2`, niveau mot, freq×ortho×phon) vs NEO** (per-lettre, sans fréquence) : NEO **n'exploite ni la fréquence ni un posterior-mot** — c'est ce qui manquait. Tous les variants mesurés (in-lexique K=1, warmup 200/test 100, config `CONFIG_TOGGLES` épinglée) :

| Variant ajouté à la cohorte-jointe (sans CW) | Δ moy. | par graine | doctrine | verdict |
|---|---|---|---|---|
| **DUAL complet** (freq + ortho + phon, additif) | **+2,5** | [+3,+0,+1,+6] | §3.1-*pattern* (produit de marginales, **niveau mot**) | **stable, jamais en-dessous → seul gain robuste** |
| DUAL **fréquence seule** (wO=wP=0) | +1,3 | [+3,−1,+0,+3] | propre (prior fréquence) | positif **mais bruité** (perd 1 graine) |
| **jointe-mot** (freq × vraisemblance jointe propre, §3.2) | **−2,3** | [−1,−4,−4,+0] | propre | **échoue** : le produit Σ_p de la jointe *compose* le bruit, engage le mauvais mot MAP |
| freq croisée au **phonème** (`Pcoh` pondérée) | −4,3 | [−2,−7,−4,−4] | propre | échoue : la fréquence est un signal de *mot*, pas de phonème |

*(Régime « mot entendu » : DUAL complet donne **+1,8 → 99,8 %**, [+4,+0,+1,+2].)*

**Conclusion (honnête).** Le seul gain robuste vient de **DUAL** : un **modèle de mot** (prior fréquence × plausibilités intrinsèques ortho/phon du mot, par produit). Décomposé : ~moitié fréquence (propre mais bruitée), ~moitié ortho/phon (qui *stabilise*). **Aucun variant doctrinalement pur n'égale le +2,5** — la jointe, excellente *par lettre* (adoptée §1.2), est mauvaise *multipliée sur le mot*. Le « produit » de DUAL est le *pattern* que §3.1 déconseille, mais (a) au niveau **mot-declare** (≠ croisement per-lettre visé par §3.1/§3.2), (b) c'est de la **reconnaissance in-lexique** (la cohorte contient le vrai mot → s'effondre en OOV, non mesuré ici). 

**Statut : DUAL ADOPTÉ (arbitrage humain, 16/06/2026, §0/§4.4)** — option (c). `M_DECLARE_DUAL` passe **ON dans la config de référence cheat-free** (`docs/CONFIG_TOGGLES.md`, MAJ 16/06) : +1,8 → 99,8 % mot-entendu / +2,5 → 97,3 % sans-currentWord, stable, cheat-free, declare niveau-mot (pas d'entorse §3.1, qui vise le per-lettre). Défaut moteur **OFF** (baseline byte-identique ; activé dans le preset). *(Alternatives écartées : (b) fréquence-seule +1,3 bruité ; (d) base 94,8.)* Repro : `node evo/ab_cohort.js dual|dualncw 200 100 12345,777,2024,99`.
**Reste honnête (non clos) :** l'effet **OOV (Trexquant)** de DUAL n'est **pas mesuré** — DUAL étant de la reconnaissance in-lexique, on attend ~0 en OOV ; à vérifier avant tout chiffre hors-lexique.

### 1.6 Lecture à la lumière de la littérature — et chantier futur : l'arbitrage des deux voies (R66) — 2026-06-16

Confrontation des résultats §1.1–§1.5 aux sources du projet (MEMOIRE §11t/§13, rapport §14). But : **fonder le prochain chantier**, pas pavoiser. *(Épistémique du mémoire : une concordance n'est pas une preuve ; on distingue lien fort et analogie.)*

**Concordances fortes (mesuré ↔ source) :**
- **DUAL = le *cohort model* (Marslen-Wilson & Welsh 1978).** DUAL *est* la cohorte board-compatible pondérée par la **fréquence** = reconnaissance lexicale. Mesuré : la fréquence au niveau **mot** aide (+1,3) mais au niveau **phonème** nuit (−4,3, §1.5) → la reconnaissance est lexicale, pas phonémique-position. Conforme au modèle.
- **DUAL + NEO = les deux voies de la DRC (Coltheart et al. 2001).** Lexicale (recall/DUAL : reconnaître le mot) ∥ sublexicale (assemblé/jointe : assembler par phonème). « Les combiner bat chacune » (§1.5) = la thèse double-route. Le caveat OOV s'y inscrit : hors-lexique la voie lexicale s'effondre (cohorte sans le mot), la sublexicale doit porter — prédiction DRC directe.
- **M3_d cross-modal qui dégrade (−3,0, §1.4) = CLS (McClelland, McNaughton & O'Reilly 1995).** Le petit latent sémantique (12 cellules, blueprint DBPC, Qiu et al. 2025) ne peut absorber une charge cross-modale/épisodique sans se contaminer — séparation hippocampe/néocortex. Re-confirme §8.1 du mémoire de façon indépendante.

**Tensions / analogies à ne pas surinterpréter :**
- **Notre combinaison est plus grossière que la DRC.** DRC = deux voies **arbitrées en interaction** (activation relative) ; nous = **cascade à priorité fixe** (recall → DUAL → jointe ; le dernier confiant écrase). L'arbitrage fin (OS `w(r)=−r/(1+r)`, rapport §4) n'existe qu'au niveau **lettre**, pas entre les déclares. **C'est l'écart au modèle — et le chantier ci-dessous.**
- Le *cohort model* est **auditif** (entrée phonétique incrémentale) ; on l'applique à un board **écrit**. L'analogie (rétrécissement de l'ensemble compatible) tient, la modalité diffère.
- Lien **resonator (Frady et al. 2020)** ↔ échec de la jointe-mot (−2,3, le produit Σ_p compose le bruit) : **analogique** (Frady factorise des produits VSA liés, pas des vraisemblances par position). Éclairage, pas preuve. Recoupe §3.1 (« ne pas multiplier des marginales »).

---

#### Chantier futur — **arbitrage des deux voies du declare** (≈ croisement OS au niveau declare)

**Constat (§1.5 + DRC).** Le declare cheat-free combine voie **lexicale** (recall/DUAL) et voie **sublexicale** (jointe) par **cascade à priorité fixe**. Ce n'est pas l'arbitrage interactif DRC, où l'intégration pondère par la **fiabilité/activation relative** des routes.

**Hypothèse falsifiable.** Remplacer la cascade par un **arbitrage par fiabilité relative** lexical⟷sublexical — à l'image de l'OS `w(r)=−r/(1+r)` qui arbitre déjà ortho⟷phon **au niveau lettre** — mais porté au **niveau declare**. C'est le **croisement OS réservé**. Confiances **board-dérivées** : marge du posterior cohorte (lexical) vs marge de la jointe (sublexical) ; aucune lecture de `currentWord`.

**Pourquoi ça pourrait payer.** (a) La cascade laisse une voie *confiante-mais-fausse* écraser l'autre (pattern d'échec §1.1) ; pondérer par la fiabilité **mesurée dans le régime courant** l'évite. (b) Bascule gracieuse vers la sublexicale quand la cohorte lexicale est peu fiable (OOV / mots durs) — exactement la prédiction DRC, et l'angle mort actuel (OOV).

**Protocole R66 (reprenable).**
1. Contrôle = cascade actuelle (baseline).
2. Variante = gate d'arbitrage par fiabilité relative (nouveau toggle **OFF-inerte**, confiances board-dérivées).
3. Mesurer K=1, 4 graines, **in-lexique ET OOV séparément** (doctrine §1 : ne jamais les confondre ; c'est en OOV que l'arbitrage devrait le plus aider).
4. Barrière de mérite §6.4 : gardé seulement si ≥ baseline **à chaque graine** et moyenne > 0, dans ≥ 1 régime, **sans régresser l'autre**.

**Garde-fous (mesurés — ne pas réapprendre à la dure).**
- La forme `w(r)` est un **choix de design**, non dérivé (rapport §4 note) — l'étendre aux declares en hérite ; la traiter comme paramètre à mesurer.
- **Apprendre le poids d'arbitrage en ligne par le winrate = plat** (SPSA : §8.3 mémoire ; trigger gap, notes NEO §6 — gradient nul, effet sous le quantum). → fixer le poids par **mesure** (constante, comme θ batch), ne pas l'apprendre en ligne.
- **Une jonction à la fois** (§4.1) : chantier **séparé** de l'adoption DUAL ; ne pas fusionner. Cheat-free strict.

**Pré-requis de lecture (A3) avant de coder :** rapport §4 (OS `w(r)`) · §17 (declares NEO) · MEMOIRE §6 (croiser = jointe) · §8.2-8.3 (l'arbitrage par **seuil fixe** drague ; le trigger appris a échoué) · le présent §1.5/§1.6. Harnais prêt : `evo/ab_cohort.js` (ajouter un mode `arb`).

#### Résultat mesuré (16/06) — l'arbitrage OS MARCHE vs base, mais ne bat pas DUAL

Prototypé `M_NEO_OS_ARB` (OFF-inerte) : mélange convexe sublexical (jointe) ⟷ lexical (cohorte-fréquence) via `M_OS_v07_step` réutilisé. Mesuré in-lexique K=1, 4 graines (tri-critère) :

| sans currentWord | winrate | err/partie | coups/partie |
|---|---|---|---|
| cohorte-jointe (cascade, base) | 94,8 % | 2,13 | 8,18 |
| + DUAL (cascade) | **97,3 %** | **1,80** | **7,88** |
| + ARBITRAGE OS | 96,8 % | 1,89 | 7,95 |

**Verdict.** L'arbitrage OS **bat la base** (+2,0 winrate, jamais en-dessous, moins de coups/erreurs) → le mécanisme est **validé** (hypothèse §1.6 confirmée). Mais il **ne bat pas DUAL** (−0,5 winrate, +0,09 err, +0,07 coups — dans le bruit, mais DUAL marginalement devant **sur les 3 critères**) → barrière §6.4 non franchie contre l'incumbent. **Décision (arbitrage humain 16/06) : DUAL reste adopté ; OS-arb gardé OFF-inerte comme alternative propre documentée** (plus fidèle DRC + ~2× plus rapide en wall-clock, mais pas meilleur sur la fitness). UI à câbler pour test manuel.

#### ⚠️ Conflit de SENS des voies (trouvé en confrontant code + intuition Rem) — garde-fou

La voie phon de la **cognition** est **ortho→phon** (`M1_phon_step(cw, rev)` sonorise les **lettres révélées**, cap §43 — direction *lecture*), et l'OS `M_OS_v07_step` qui l'arbitre a un θ appris **réglé pour la lecture** (α≈1,13, β≈0,65). Le **declare/assemblé**, lui, est **phon→ortho** (épellation — la force pendu). Les deux directions coexistent (DRC bidirectionnelle), **mais** un arbitrage OS au niveau declare qui **hériterait du θ de lecture** appliquerait un biais *ortho→phon* à une décision *phon→ortho* = **conflit de sens**. **Corrigé dans le prototype** : `_neoDeclareOSmix` force `α=β=1` (forme analytique neutre, save/restore), **découplé** du θ cognition. **Garde-fou pour la suite : l'arbitrage declare doit avoir son PROPRE (α,β) mesuré, jamais celui de la lecture.**

#### Résultat du balayage (α,β) — CHANTIER CLOS par la mesure (R66, §6.4) — 2026-06-17

Garde-fou ci-dessus levé : `M_NEO_OS_ARB_ALPHA`/`M_NEO_OS_ARB_BETA` ajoutés (OFF-inerte, défaut 1/1 = byte-identique ; `_neoDeclareOSmix` les lit). Balayage in-lexique K=1, 4 graines (warmup 200 / test 100, `node evo/ab_cohort.js arbsweep 200 100 12345,777,2024,99`) :

| sans `currentWord` | winrate | err/p | coups/p | vs DUAL (par graine) |
|---|---|---|---|---|
| **DUAL (incumbent)** | **97,3 %** | **1,79** | **7,86** | — |
| cascade jointe (base) | 95,0 % | 2,08 | 8,14 | −2,3 |
| OS-arb α1 β1 (neutre) | 96,8 % | 1,89 | 7,95 | **−0,5** [−1, 0, 0, −1] |
| OS-arb α1 β0,5 (+lexical) | 96,5 % | 1,90 | 7,96 | **−0,8** [−1, 0, −1, −1] |
| OS-arb α2 β0,5 (+lex. raide) | 96,0 % | 1,89 | 7,95 | **−1,3** [−1, 0, −1, −3] |

**Sanity** : le neutre (1,1) reproduit **96,8 %** pile (= §1.6 ci-dessus) → plomberie (α,β) validée. **Verdict (barrière §6.4) : aucun (α,β) ne bat DUAL, et biaiser vers la voie lexicale (β<1) *dégrade*** (96,5/96,0 < 96,8). L'hypothèse « pencher lexical → rejoindre DUAL » est **falsifiée** : le mélange convexe **par lettre** (`Σ` pondéré de la distribution-lettre cohorte) ne réplique pas la reconnaissance **MAP par mot** de DUAL — ce sont deux mécanismes de niveaux différents. **Le levier (α,β) propre est clos : la cascade + DUAL reste l'optimum mesuré.** Les params restent OFF-inerte (alternative DRC documentée, ~2× plus rapide, mais non meilleure). Plus rien à mesurer côté arbitrage des declares.

### 1.6.1 — ⛔ RÉTRACTÉ : les chiffres "OOV/Trexquant" étaient FAUX (fuite cohorte `_neoWBL`) — 2026-06-18

> **CE QUI SUIT (table + verdict) EST FALSIFIÉ. Conservé barré pour mémoire honnête (§6).** La cause : un **bug de
> fuite** trouvé en auditant (challenge de Rem « 97 % OOV impossible, le système triche » — il avait raison).

**Bug (`omega-pendu.html` _neoWBL).** La cohorte NEO (`_neoCohortMasks`, `_neoPhonCohort`, `_neoPhonCohortDist`,
donc l'assemblé/jointe/**OS-arb**/muette) lit un cache `_neoWBL` **bâti une fois depuis `OMEGA_LEX4.words[]`** et
**jamais invalidé**. Or Trexquant (`_trexq_removeWord`) et le harnais (`ab_cohort` `filtered`) ne retirent le mot
que du **`len_index`**. Donc le mot "retiré" **restait dans la cohorte** → le declare voyait la réponse. Le
"hors-lexique" était en réalité **in-lexique déguisé**.

**Preuve (mesurée, même protocole, cohorte reconstruite SANS les mots-test) :**
| régime | cohorte "telle quelle" (fuite) | VRAI OOV (cohorte sans mot-test) |
|---|---|---|
| config cohorte-jointe + OS-arb | **98,3 % / 95,0 %** (≈ le "97 %") | **33,3 % / 33,3 %** |
→ **fuite ≈ 62-65 pts.** Le **vrai OOV est ~33 %** (sous les repères SOTA 50-68 %) : la généralisation **sublexicale
pure** d'OMEGA est **faible**, pas exceptionnelle. ~~« OS-arb 96,7 % OOV, optimum hors-lexique, +24 pts »~~ = **artefact de la fuite**.

**Corrigé (2026-06-18).** `_neoEnsureWBL()` bâtit l'index cohorte depuis **`len_index`** (respecte les retraits) +
invalidation du cache (changement de référence ; `_trexq_*` annulent `_neoWBL`). **In-lexique inchangé** (len_index
plein = mêmes mots) ; Trexquant aveugle enfin vraiment la cohorte.

**Conséquence sur l'audit.** TOUT chiffre "OOV/Trexquant cheat-free" antérieur à ce fix est **suspect** : §1.1
(« cohort-board OOV ~78-85 %, coût ~7,5 pts »), §1.5 (« cohorte-jointe seule 94,8 % » — *in-lexique*, OK), et la MAJ
Trexquant de `CONFIG_TOGGLES`. À **re-mesurer** avec le fix avant tout chiffre OOV. Le in-lexique (§1.6, DUAL/OS-arb
~96-99 %) n'est **pas** touché (cohorte pleine = comportement voulu en jeu normal).

<details><summary>Table falsifiée (archive)</summary>

| OOV (Trexquant) — ❌ FAUX | winrate | err | coups |
|---|---|---|---|
| cohorte-jointe | 72,5 % | 3,16 | 9,21 |
| + DUAL | 75,0 % | 3,30 | 9,28 |
| + OS-arb | 96,7 % | 2,00 | 8,12 |
</details>

### 1.7 — Pourquoi le VRAI OOV est bas — et le FIX (n-gram de lettres, +16 pts) — 2026-06-18

Question de Rem : « avec bigrammes/trigrammes + cognition, l'hybride DEVRAIT faire mieux. Trouve pourquoi. »
Et : « lexique ≠ mot » (le lexique porte des stats sous-lexicales, pas que des mots entiers). Mesuré (moteur corrigé
`_neoWBL`, VRAI OOV). ⚠️ Les chiffres test=60×2 (N=120) se sont révélés **bruités** ; les chiffres **robustes = N=400
(4 graines × test 100)**.

| condition (VRAI OOV) | winrate | coups | N |
|---|---|---|---|
| **baseline n-gram TRIVIAL** (positionnel uni/bi/tri, **pré-calculé du lexique**, mots-test exclus) | **57,5 %** | — | 120 |
| OMEGA hybride (voie phon + cognition + NEO) — **robuste** | **50,0 %** [57,55,46,42] | 9,4 | **400** |
| OMEGA **hybride + n-gram de lettres ON (le FIX)** — **robuste** | **66,0 %** [73,63,65,63] | **9,2** | **400** |
| OMEGA cognition SEULE (declares OFF) | **~8 %** | 10,2 | 120 |

**Diagnostic (mécanisme, §1) — le signal EST dans le lexique (n-gram 57,5–66 %), OMEGA le sous-exploite :**
1. **Stats sous-lexicales apprises DU JEU, pas du lexique.** `_neoCR`/`_neoCRS`/g2p sont remis à `{}` à l'init et
   remplis **post-partie** (≈200 mots au warmup) — vs un n-gram qui pré-calcule sur ~250k mots.
2. **Médiation par PHONÈMES** (son→phonème→graphème) = un saut lossy ; le n-gram reste en espace LETTRES (ce qu'EST
   l'orthographe du lexique).
3. **La cognition ne généralise pas en sous-lexical** (~8 % seule) — concept/position = détecteurs globaux/longueur
   (§1.4.2). Les ~50 % de l'hybride viennent de la **cohorte-jointe (agrégation de voisins du lexique)**, PAS de la cognition.
**⚠️ DEUX hypothèses RETRACTÉES (honnêteté §6 — petit-N over-read).**
- (a) « **recall** (mémorisation k-NN) tue la généralisation » : **FAUX**. recall OFF ≈ recall ON (30,8/21,7 vs 32,5/23,3).
- (b) « **plus de données = pire** » (warmup 200→1500) : **NON CONFIRMÉ = bruit**. À w1500, **full = jointe OFF =
  θ OFF = 23,3 % IDENTIQUE à la décimale** → aucun composant (jointe/θ/recall) n'est attribuable ; et le baseline w200
  vaut **50 %** à N=400 (pas 32,5 %) avec une variance graine énorme [42-57]. Le « 32→23 » comparait des **jeux-test
  différents** à petit-N. Donc : **pas de dégradation réelle démontrée.** Le vrai problème n'est PAS une dégradation —
  c'est que **la cognition ne généralise pas du tout (8 %) ; seule l'agrégation gagne.**

**FIX livré (`M_NEO_LETTER_NGRAM`, OFF-inerte, R66).** `_neoEnsureNG()`/`_neoLetterNgram()` : n-gram positionnel de
lettres (backoff tri→bi→uni) **pré-calculé depuis `len_index`** (respecte Trexquant ; cheat-free : board révélé +
stats agrégées du lexique, jamais `currentWord` ; 1 mot/250k = non récupérable). Branché dans la cascade declare.
**Mesuré N=400 : 50,0 → 66,0 % OOV (+16 pts, GAGNE à chaque graine), moins de coups (9,4→9,2)**, au-dessus du baseline
trivial (57,5 %) et dans/au-dessus de la bande SOTA (cf. `docs/HANGMAN_SOTA.md`). **Le levier = AGRÉGATION (n-gram du
lexique), pas mémorisation ni apprentissage-par-jeu.**

---

### 1.8 — LE VRAI PROBLÈME (Rem) : « le pendu n'est qu'une mesure ; OMEGA ne gagne ni par mémorisation ni par apprentissage-par-jeu » — 2026-06-18

Recadrage de Rem : le n-gram **corrige la MESURE** (pendu OOV 50→66 %) mais **par AGRÉGATION** (statistiques pré-calculées
du lexique) — c'est un **substrat/oracle**, PAS la cognition d'OMEGA. Le résultat de fond, sur la seule mesure chiffrée :
**rien dans la cognition ni dans l'apprentissage-par-jeu d'OMEGA ne généralise** ; seules gagnent la **recherche
lexicale** (cohorte/oracle) et l'**agrégation** (n-gram). La thèse « cognition > oracle » est donc **fausse aujourd'hui**.

**CAUSE (le pourquoi, mécanisme — mesuré + lecture du code).** Généraliser ici = **agréger** la structure contexte→lettre
du lexique. OMEGA apprend par **récompense-par-partie (RL) + mémoire (recall)** sur ~200 parties, via un goulot de 12
cellules, sans chemin concept→lettre. Trois causes emboîtées :
1. **Paradigme.** Compter une fois le lexique (n-gram) = 57,5 % ; apprendre en jouant (cognition seule) = 8 %.
   L'apprentissage-par-jeu n'accumule pas la distribution ; il part de 0 et voit ~200 mots (`_neoCR/_neoCRS/g2p`
   remplis post-partie), au lieu des ~250k du lexique. **Mauvais paradigme pour la généralisation.**
2. **Capacité.** 12 cellules-concept ne peuvent pas porter les milliers de régularités contexte→lettre (§1.4.2 / S2 :
   concept & position = détecteurs globaux/longueur, variance par-mot ≈ 0).
3. **Câblage.** Le concept **n'atteint jamais** la décision-lettre (§1.4 : prises parallèles sur la récompense ; M1_m =
   prior de fréquence corr 0,999). Même appris, le concept ne peut pas influencer le choix de lettre.

**SOLUTION (proposée).** *Geste clé : désintriquer 3 choses confondues.*
- **ORACLE** = lire la réponse (cohorte AVEC le mot, `wp.get`) → triche, à bannir.
- **AGRÉGATION** = stats GÉNÉRALES du lexique (n-gram contexte→lettre) → **PAS une triche** (savoir général, comme
  l'orthographe intériorisée d'un lecteur). → doit être le **SUBSTRAT**.
- **COGNITION** = la valeur AJOUTÉE par-dessus le substrat (les mots atypiques que la statistique rate).

→ La thèse devient **« la cognition ajoute-t-elle un Δ par-dessus le bon substrat statistique ? »** (falsifiable).
Étapes, ordre logique :
1. **Adopter l'agrégation comme substrat, bien faite** (« *lire* le lexique, pas *jouer* ») : bâtir les représentations
   contexte→lettre (et phonème→lettre) par **un passage sur tout le lexique**, pas par récompense. Reste de
   l'apprentissage (modèles prédictifs internes), bon paradigme. Le n-gram livré en est l'instance minimale ; étendre :
   **semer `_neoCRS`/g2p** par cette agrégation one-pass (lettres + phonèmes) puis raffiner par jeu si Δ>0.
2. **Mesurer le Δ de la cognition PAR-DESSUS le substrat n-gram** (~66 %). Δ≈0 → verdict honnête (la cognition n'aide
   pas sur cette mesure) ; Δ>0 → la valeur cognitive est là (mots durs). C'est le **vrai test de la thèse du projet**.
3. **Si la cognition doit ajouter** → attaquer **capacité + câblage** (§3) : substrat > 12 cellules encodant le contexte
   sous-lexical, et **câbler concept→lettre**. On saurait *si ça vaut le coup* grâce au Δ de l'étape 2.

**Cohérence projet :** le **correcteur dys** gagne déjà par **agrégation** (cgram, table de conjugaison = comptage du
lexique ; FP=0) ; la double-voie dictée = lexicale (agrégation) × sublexicale (règles). **L'agrégation est déjà le
paradigme gagnant côté dictée ; seul le moteur pendu était resté sur l'apprentissage-par-jeu.** Leçon transverse :
**OMEGA généralise par AGRÉGATION DE STRUCTURE, pas par récompense ni mémoire.**

**Décision en attente (Rem) :** (1) défaut du n-gram (le brancher en config OOV/Trexquant ? le croiser avec la
cohorte-jointe via OS-arb plutôt qu'en cascade ?) ; (2) étape 2 (mesurer Δ cognition sur substrat) ; (3) si oui, §3
(capacité/câblage).

#### 1.8.1 — A (Δ cognition, mesuré FAIR) + B (défaut OOV) — 2026-06-18
**A — la cognition ne contribue pas, même double-voie pleinement engagée.** Garde-fou de Rem : « tu as peut-être
sous-estimé les doubles voies ; les voies descendantes ne participent pas directement à la décision ; OS sans
double-voie ne marche pas ». Re-testé **fair** (vrai OOV, test 100×2) :

| cognition seule (vrai OOV) | winrate |
|---|---|
| REF (M1_m co-décision OFF) | 10,5 % |
| + M1_m ON (descendant ortho→décision branché) | 11,0 % |
| + M1_m ON + voie phon poussée | 11,0 % |
| **MAXIMALE** : double-voie ortho COMPLÈTE (M4_m letterPenalty + M2_m zonePenalty + M1_m letterScore + **Möbius B2**) + phon (M4_phon_m feedback + readout + bind) + **OS arbitre**, 0 declare, 0 n-gram (3 graines) | **10,7 %** |

→ Garde-fou de Rem (« test partiel : que phon + que M1_m ; la vraie double-voie ortho+phon + OS qui arbitre »).
**Re-mesuré MAXIMAL** (tout le descendant qui EXISTE + Möbius + OS) = **10,7 %**, identique au partiel. **Donc pas une
sous-estimation du test** : la cognition complète plafonne à ~11 % OOV.

**POURQUOI (architecture, d'après les schémas double-voie) :** le descendant **ne réinjecte que des PRIORS GLOBAUX**,
jamais des **conditionnels contextuels** (P(lettre | voisins révélés) = le signal n-gram) :
- M4_m `letterPenalty` = homéostasie vers la fréquence inverse (global) ; M2_m `zonePenalty` = positionnel (global) ;
  M1_m `letterScore` = prior de fréquence (corr 0,999, §1.4.1) — **trois priors globaux, zéro contexte**.
- Le **miroir phon est TRONQUÉ par construction** (schéma) : `M2_phon_m`/`M1_phon_m` **jamais construits**,
  `M3_phon_m` **observationnel** (lit le hub, n'écrit pas) ; seul `M4_phon_m` letterPenalty réinjecte → la voie qui
  *pourrait* porter le contexte **phonotactique** est coupée.
- Le concept M3 (12 cellules ortho / 1024D phon) = détecteur **global/longueur** (§1.4.2 / S2).
→ **Aucun chemin descendant ne porte le conditionnel contexte→lettre** que la généralisation exige. D'où ~11 %, et
d'où la nécessité d'un **mécanisme d'agrégation SÉPARÉ** (n-gram). **C (si un jour)** = construire un descendant qui
porte le **contextuel** (compléter le miroir phon `M2/M1_phon_m` pour le phonotactique, ou réinjecter un conditionnel
appris), PAS juste élargir M3.

**B — n-gram = voie OOV-only, branchée.** Le n-gram **écrase la cohorte en in-lexique** (il ignore que le mot EST là)
→ à n'activer **qu'en OOV/Trexquant**. **Mesuré in-lexique : OFF 97,5 % → ON 69,5 %** (le n-gram générique remplace
la cohorte qui a le mot) → **OFF en jeu normal, obligatoire**. Livré : voie `M_NEO_LETTER_NGRAM` recommandée ON pour
Trexquant/OOV (CONFIG_TOGGLES), et **ajoutée au bench Trexquant in-app** (4e ligne « n-gram de lettres »). Pas de
croisement OS-arb nécessaire (A montre que rien n'ajoute au n-gram → cascade simple suffit ; OS-arb resterait utile
seulement si une 2e voie apportait un Δ, ce qui n'est pas le cas ici).

**C reporté (cadrage Rem) :** ne PAS reconstruire la capacité de M3_d ; **garder M3_d tel quel** et confier la
mémorisation/agrégation à un **mécanisme séparé** (le substrat n-gram EST ce mécanisme). Le câblage concept→lettre
(§3) reste la frontière si un jour on veut que la *cognition* ajoute un Δ — mais A dit que ça n'urge pas.

#### 1.8.2 — Carte sémantique (M_S / phonGraphMap) : trouvée, reconnectée, MESURÉE insuffisante — 2026-06-18
Rem : « on a perdu la carte sémantique construite par la cognition, vérifier ; et surtout : suffisant ? »
**Inventaire (§5, ce qui EXISTE) :**
- **`phonGraphMap[26][SDIM]`** : carte apprise lettre↔contexte (F online + L2 vers substrat), **co-décideur actif**
  (poids 0,3, `cosine(currentPhonState, phonGraphMap[l])`). **Pas sous-pondérée** (peut dominer le natif 0,05-0,15).
- **`M_S`** (6e cerveau Sense/Semantic/Shared, Patterson 2007) : fusionne M1-M5, `M_S_ENABLED=true`. **= la carte sémantique.**
- **`M2_phon_m`/`M1_phon_m`** : existent, stepés (3918/3941), **DORMANTS** (non consommés). Portent zonePenalty/letterScore = **priors globaux**.

**La carte est PERDUE par un mécanisme précis** : bPC (`M_BPC_M3D`, config réf.) **zéroe `M3_d.output`** (4625, découplage)
→ `currentPhonState = M3_d.output` (6585) **= 0** → le co-décideur phonGraphMap fait `cosine(0,·)=0` (**mort**), et M_S
fusionne vers 0 **et** est *sauté* sous bPC (5110). Donc sous bPC, **toute la carte reçoit un vecteur-contexte nul**.

**Mesuré (reconnexion par toggle, bPC OFF → carte vivante) :**
| cognition MAX (vrai OOV, N=300) | winrate |
|---|---|
| bPC ON (carte morte, currentPhonState≈0) | 10,7 % |
| **bPC OFF (carte VIVANTE : phonGraphMap + M_S actifs)** | **12,0 %** [11,11,14] |

→ **+1,3 pt = bruit. La carte, même vivante, n'est PAS suffisante.** Pourquoi : phonGraphMap et M_S sont bâtis sur le
**concept M3_d = détecteur global/longueur** (§1.4.2) → ils encodent la longueur, pas le **contexte-lettre** (le signal
n-gram). **Décision : on N'implémente PAS le fix de dérive M_S** (measure-before-build : le candidat le plus fort donne
déjà ~0). M2/M1_phon_m = priors globaux → prédits ~0 (cf. ortho M2_m/M1_m, §1.4.1 Δ≈0), non câblés. Möbius (B2) était
**déjà ON** dans le test → sans effet.

**Verdict consolidé** : reconnecter les pièces existantes (carte M_S, miroir phon, phonGraphMap) **ne suffit pas** —
toutes vivent sur un concept global/longueur. Le vrai C = **que le concept M3_d encode le contexte-lettre** (capacité +
nature de la représentation), pas un re-câblage. Confirme §1.8 par la mesure : le levier OOV est l'**agrégation**
(n-gram), pas la cognition ni sa carte.

---

### 1.9 — FIX livré (A+B) : le n-gram agrégé branché comme VOIE SUBLEXICALE de l'arbitrage OS — 2026-06-19

Rem : « go code » — décision approuvée : *le n-gram agrégé, branché comme voie sublexicale dans l'arbitrage OS
(pondéré par fiabilité), structurellement natif, meilleur dans les deux régimes sans switch manuel.*

**Le problème de la cascade n-gram (§1.7).** `M_NEO_LETTER_NGRAM` est un **either/or** : si le n-gram tire une lettre,
il **court-circuite** la cohorte board. Conséquence mesurée : il **gagne l'OOV** (+pts) mais **sacrifie l'in-lexique**
(62 % vs 96 % de la cohorte). On ne veut pas choisir : l'in-lex doit rester ~97 %, l'OOV monter à ~60 %.

**Le fix (R66, OFF-inerte) — `M_NEO_OS_ARB_NGRAM`.** Au lieu d'un either/or, on **fusionne** deux voies dans
`_neoDeclareOSmix` via l'OS déjà prouvé (`M_OS_v07_step`, mélange convexe pondéré par fiabilité μ=r^α/(β+r^α)) :
- **voie SUBLEXICALE = n-gram agrégé** (`_neoLetterNgramDist`, refactor commun avec `_neoLetterNgram`) — généralise,
- **voie LEXICALE = cohorte board pondérée fréquence** (inchangée) — précise quand le mot est connu.
La **fiabilité = le piqué (max) de chaque distribution**. In-lexique la cohorte converge → piquée → elle gagne ;
OOV la cohorte se vide / s'aplatit → le n-gram gagne. **La bascule est automatique, par régime, sans switch.** Le mode
n-gram ne dépend plus de la cohorte phon (gate élargie `M_NEO_OS_ARB && (M_NEO_PHON_COHORT_ENABLED || M_NEO_OS_ARB_NGRAM)`)
et ne **bail plus** si la cohorte phon est vide (le cas OOV où le n-gram doit décider).

**Mesuré (3 graines d'échantillon, N=400 mots 7-12 lettres, `/tmp/measure_osng.js`) :**

| voie sublexicale | IN-LEXIQUE | OOV (mot retiré du len_index) |
|---|---|---|
| jointe phon-cohorte (OS arb, défaut) | 96,0 / 96,3 / 97,0 | 30,5 / 27,3 / 30,8 |
| n-gram **CASCADE** (either/or, §1.7) | 62,0 / 59,5 / 64,0 | 59,0 / 56,0 / 62,0 |
| **n-gram VOIE OS (le fix)** | **97,0 / 96,3 / 98,8** | **60,8 / 52,0 / 63,0** |

→ **Meilleur ou à égalité dans les DEUX régimes**, config unique : in-lex ≈ jointe (≫ cascade), OOV ≈ cascade (≫ jointe).
La voie OS **récupère** le winrate in-lex de la cohorte ET le winrate OOV du n-gram. C'est A (mesurer le substrat
agrégé) **et** B (le câbler par défaut pour l'OOV via la fiabilité) en un seul mécanisme structurellement natif.

**Coûts / honnêteté (§6).** (1) α,β défaut **1/1** (forme neutre) — aucune sur-optimisation ; un balayage β>1 pourrait
grappiller l'OOV mais on garde le neutre mesurable. (2) Build de la table n-gram = **~440 ms lazy, une fois/session**
(29 k clés, ~6 Mo en mémoire), voie **OFF par défaut** → **persistance IndexedDB jugée prématurée** : 440 ms paresseux
ne justifient pas une couche async de sérialisation de 29 k Float64Array (et 6 Mo > 5 Mo de localStorage). IndexedDB
**reste le bon foyer SI** la table grossit ou devient *apprise* (le futur « C »). (3) Exposé via le **bench Trexquant**
(5e ligne « n-gram ARBITRÉ OS ») — le bench ne mesure que l'OOV, donc la parité in-lex vient du script ci-dessus.
(4) Baseline byte-identique vérifiée : tous les nouveaux flags OFF → fitness défaut inchangé (10 %, 9,3 coups).

**Reste (déféré, le vrai C cognitif §1.8.2)** : que le **concept M3_d encode le contexte-lettre** (spokes contextuels
riches + erreur de prédiction entrelacée), mesuré **au-dessus** du substrat n-gram. Le n-gram OS est la **rampe d'accès** :
il fournit le plancher d'agrégation contre lequel juger tout gain cognitif futur.

---

### 1.10 — C livré : 1er levier cognitif qui BAT le substrat n-gram (gap-aware) — 2026-06-19

Rem : « enchaîne C ». Objectif (lit. + §1.8.2) : une représentation qui **généralise AU-DESSUS** du n-gram, mesurée.
Méthode doctrine : **mesurer la place de C avant de bâtir** (§1), **une jonction** (§4), **réutiliser l'existant** (§5).

**Étape 1 — la place de C (ablation d'ordre, OOV, N=400, 2 graines).** uni 31-38 % → +bi 49-52 % → +tri 61-63 %
(monotone, gros pas). Le contexte paie fort. Couverture des positions cachées (~40 % révélé) : **tri seulement 12,5 %
dispo**, **~40 % retombent à l'unigramme**. → place réelle pour généraliser le contexte.

**Étape 2 — DEUX hypothèses cognitives FALSIFIÉES (mesuré, négatifs nets, confirment §1.8.2) :**
- **Lissage par le SUBSTRAT** (réutiliser la représentation-lettre apprise, `letterVecsSDIM`, comme noyau de
  similarité pour combler les contextes rares) → **NUIT** (top-1 36,0 % → 34,6/32,3/24,5 % quand τ monte). La
  représentation de la cognition encode des **traits forme/phon**, **pas** « prédit une lettre suivante similaire ».
  *C'est exactement le diagnostic §1.8.2 : la carte cognitive est du mauvais TYPE de structure.*
- **Pooling POSITION-RELATIVE** (suffixe/préfixe poolé sur longueurs, abstraction morphologique) → **légèrement pire**
  (53,8 → 50,5 %), **rescousse ~0 %**. Cause : les 2 voisins révélés, le trigramme absolu **manque <0,6 %** du temps —
  donc **pas un mur de sparsité lexicale**.

**Étape 3 — le VRAI mur = état-de-jeu, et le fix qui MARCHE (gap-aware).** Reframe par la mesure : le n-gram ne lisait
que les voisins **immédiats** (p±1), or **42-54 % des positions cachées n'ont AUCUN voisin immédiat** (mesuré) → chute à
l'unigramme alors que le board révèle des lettres **plus loin** (p±2..4) **ignorées**. Fix `M_NEO_NGRAM_GAP` : utilise le
**plus proche voisin révélé à distance 1..4** (garde le trigramme JOINT quand les 2 adjacents sont là ; sinon produit des
marginales à distance ; backoff uni). Prototype held-out : **+1,3 à +2,9 pts top-1**, robuste.

**Mesuré WINRATE (voie n-gram arbitrée OS, gap OFF→ON, N=400, 3 graines) :**

| régime | gap OFF | **gap ON (C)** |
|---|---|---|
| OOV | 60,8 / 62,8 / 52,0 | **63,3 / 64,8 / 54,0** (**+2,5 / +2,0 / +2,0**) |
| in-lex | 97,0 / 98,8 / 96,3 | 97,5 / 98,3 / 96,8 (±0,5 = bruit) |

→ **+2 pts OOV robustes, coût in-lex nul.** **Premier levier cognitif mesuré au-dessus du plancher d'agrégation**
(OOV ~63-65 %, dans la bande SOTA 65-68 %). Honnêteté (§6) : c'est une **agrégation plus riche** (n-gram utilisant plus
de contexte du board), **pas** encore une représentation distribuée APPRISE — mais c'est bien « le concept encode PLUS
de contexte », et c'est ce que les hypothèses « réutiliser la carte existante » (substrat, relatif) ont **échoué** à
faire. Coût build : ~1 s lazy/session (10 k clés d=2..4), voie OFF par défaut (R66, baseline byte-identique vérifiée :
fitness défaut 10 %/9,3 inchangé). Bench Trexquant : 6e ligne « + GAP-AWARE (C) ».

**Reste (le C *appris*, plus profond)** : une représentation **distribuée apprise par erreur de prédiction** sur le
contexte complet du board (lettres non-adjacentes incluses) — au-delà de ce que capte le n-gram gap-aware. C'est le seul
chemin restant pour aller vers la borne SOTA, et c'est là que la **persistance IndexedDB** de poids appris deviendrait
justifiée (cf. §1.9). À mesurer **au-dessus** des ~63-65 % du gap-aware.

---

### 1.11 — C APPRIS attaqué → le C *léger* appris est FALSIFIÉ (le n-gram gap-aware est le plafond pratique) — 2026-06-19

Rem : « attaque ce C appris ». Fait : sonde `evo/learned_c_probe.js` — une représentation **apprise par prédiction
masquée** (codage prédictif + CLS) utilisant **tout le contexte révélé** (non-adjacents inclus), vs le n-gram gap-aware
(§1.10), sur états de jeu **identiques** (held-out OOV, top-1, 2 graines).

**Quatre variantes testées, TOUTES perdent contre gap-aware (mesuré) :**

| méthode | rev .3 / .4 / .5 (graine 99887) | nature |
|---|---|---|
| **gap-aware (le moteur §1.10)** | **30,3 / 32,2 / 35,0** | counts, nearest revealed neighbor L×R |
| GATE-appris (reliabilité/distance, ~8 params) | 27,9 / 30,1 / 32,9 | **appris** (produit d'experts pondéré) |
| POE-all (tous les voisins) | 28,7 / 29,8 / 32,6 | counts, produit d'experts |
| maxent log-linéaire (features de décalage) | 21,9 / 23,4 / 25,7 | **appris**, additif |

(Robuste graine 271828 : gap 27,5/30,7/33,8 > GATE 24,6/27,7/31,7 > POE > maxent. Plus d'epochs **empire** le maxent.)

**Pourquoi (cause mesurée, pas hypothèse).** Le **plus proche voisin révélé domine** ; **combiner plus de cues NUIT** :
- les lettres révélées sont **CORRÉLÉES** → l'indépendance (produit/somme) **sur-compte** et amplifie les erreurs ;
- les cues **lointains sont non-informatifs** — le GATE l'**apprend tout seul** : α(d) = **0,71 / 0,33 / 0,04 / 0 / 0…**
  (la fiabilité s'effondre après d=2). Optimalement gaté, l'appris **converge vers** « utilise le plus proche » =
  gap-aware, sans le dépasser. L'additif (maxent) est pire encore (dilue le cue fort par les faibles).

**Verdict (§6).** Le **C léger appris est falsifié** — c'est le 3e/4e/5e candidat cognitif tombé (après substrat-lissage
§1.10, position-relative §1.10, et ici maxent/GATE/POE). Le **gap-aware est le plafond pratique de la famille n-gram**
(OOV ~63-65 %, déjà dans la bande SOTA 65-68 %). **Battre gap exige un modèle des CORRÉLATIONS entre lettres révélées**
= attention/RNN (Hopfield moderne = attention, lit. §4) — **lourd, opaque, entraînement hors-ligne**, contre la doctrine
« cognition > oracle » (léger/interprétable) et pour seulement **~3-5 pts** jusqu'à la borne SOTA. **Décision : NE PAS
bâtir** le réseau lourd sans arbitrage explicite de Rem (mesure-avant-bâtir : le gain ne paie pas le coût/l'opacité).
C'est là — et seulement là — qu'une **persistance IndexedDB** de poids appris serait justifiée.

**Synthèse du chantier OOV/C** : agrégation (n-gram, §1.7) → arbitrage OS auto par fiabilité (§1.9) → gap-aware =
1er gain cognitif réel (§1.10, +2 OOV) → C appris léger falsifié (§1.11). La thèse « cognition > oracle » tient pour
l'**usage plus riche du contexte** (gap-aware), **pas** pour une représentation distribuée apprise *légère* ; le seul
au-delà est neuronal-lourd, déféré.

---

### 1.12 — C NEURONAL LOURD attaqué (arbitrage Rem « go ») : le transformer profond REJOINT le n-gram, ne le bat pas (encore) — 2026-06-19

Rem a autorisé le C lourd déféré au §1.11. Construit `evo/heavy_c_probe.js` : un **transformer** (cross-attention
query→contexte révélé, multi-têtes + FFN résiduel, profondeur `NLAYERS`), entraîné par **prédiction masquée** sur le
lexique, comparé au **gap-aware** (§1.10) sur le **même** held-out OOV top-1 que `learned_c_probe.js` (§5 réutilisation).
Gradient **validé par différences finies** (err rel < 1e-5, NL=1..3). Optimisation : **mini-batch** (gradient moyenné +
clip global) indispensable — le pas-par-mot stagne (lr bas) ou diverge (lr haut) ; profondeur ≥ 2 exige lr abaissé
(0,008→0,006) faute de LayerNorm.

**Trajectoire mesurée (held-out OOV top-1, rev 0,3/0,4/0,5, graine 99887), Δ vs gap-aware :**

| modèle | Δ (moy.) | lecture |
|---|---|---|
| attention 1 tête | ≈ **−12** | ≈ moyenne molle, sous-capacité |
| 1 bloc (MHA+FFN), 20k mots | ≈ **−6** | l'architecture ferme la moitié |
| 1 bloc, **plein lexique 83k** | ≈ **−6,7** | **data inutile → capacité-bound, pas data-bound** |
| 2 blocs (stable, lr 0,008) | ≈ **−2,2** | la **PROFONDEUR** est le levier |
| **3 blocs + 40k, lr 0,006** | ≈ **−0,3** | **parité** : 29,4/32,1/34,1 vs gap 29,8/32,5/34,2 |
| **4 blocs + 40k, lr 0,004, 3 graines** | ≈ **0 (bruit)** | **pas de franchissement robuste** (cf. test ci-dessous) |

**Verdict (§6.4 barrière de mérite).** Chaque marche de profondeur ~**divise l'écart par deux** (−12 → −6 → −2,2 → −0,3).
À 3 blocs le transformer **REJOINT** le n-gram de comptes mais **ne le bat pas** (Δ encore < 0, marginal). Le gap-aware
reste **non battu** par un modèle appris à ce budget — et il est **gratuit** (zéro entraînement/poids, instantané) là où
le transformer coûte ~40 k poids à embarquer + un forward par décision + persistance IndexedDB.

**Lecture honnête (§0 ; §1.11 confirmé empiriquement).** §1.11 prédisait « ~3-5 pts jusqu'à SOTA via attention lourde,
déféré car le gain ne paie pas l'opacité ». Mesuré : l'attention lourde **converge vers** le n-gram (≈ parité), elle ne
le dépasse pas franchement ; franchir Δ > 0 **robuste** (multi-graines, pas une) exigerait encore (4+ blocs, plein
lexique, `d` plus grand, LayerNorm/warmup), pour un gain **marginal** (~+0,5-1 pt top-1) au prix d'un modèle **opaque +
persistant**. C'est le compromis que §0 (« la performance est un indicateur, pas une fin ») et la thèse « cognition >
oracle = léger/interprétable » déconseillent **sans arbitrage explicite**.

#### Test du franchissement (4 blocs, 3 graines) — TRANCHÉ : pas de franchissement robuste — 2026-06-19

Arbitrage Rem : « prouver le franchissement, mesure seule » (pas de câblage). 4 blocs, 40k mots, lr 0,004, 18 epochs,
3 graines {99887, 12345, 777} — entraînements stables (aucune divergence). Δ = C-lourd − gap-aware :

| Δ par graine | rev 0,3 | rev 0,4 | rev 0,5 |
|---|---|---|---|
| 99887 | −0,99 | −0,50 | +1,37 |
| 12345 | −1,41 | +1,78 | +1,65 |
| 777   | **+0,46** | **−0,81** | **−0,33** |
| **moyenne** | −0,65 | +0,16 | +0,90 |
| graines positives | 1/3 | 1/3 | 2/3 |

**Verdict (§6.4) : NON franchi.** Les 2 premières graines suggéraient un gain en contexte riche (rev ≥ 0,4), **mais la
3ᵉ (777) inverse le motif** (positive au clairsemé, négative au riche). Les Δ oscillent de ±1,4 autour de zéro selon
graine/régime = **bruit** (SE seed-to-seed ≈ ±1 pt). **Aucun régime n'est positif sur les 3 graines** ; la moyenne est
≈ 0. La barrière de mérite (« ≥ baseline à *chaque* graine, moyenne > 0 ») **n'est pas atteinte**. → Le C lourd 4 blocs
est **mesuré équivalent au n-gram de comptes, pas supérieur**.

#### Test WINRATE à CONFIG OPTIMALE (vrai moteur) — la critique « tests caducs : top-1/masques/hors-pipeline » traitée — 2026-06-19

Critique de Rem (juste, doctrine §1 « sur le jeu réel, pas un proxy ») : le top-1 sur masques aléatoires hors-pipeline
est caduc. Test refait **valide** : C lourd câblé comme **voie sublexicale de `_neoDeclareOSmix`** (flag `M_NEO_C_HEAVY`,
remplace le n-gram ; **parité moteur↔sonde vérifiée EXACTE**, `evo/heavy_c_parity.js`), **config optimale** de référence
(`evo/heavy_c_winrate.js`, mêmes CFG que `ab_cohort`), **winrate sur vraies parties**, in-lex ET OOV séparés, 3 graines
(C entraîné 4 blocs/40k, masques aléatoires) :

| régime | voie gap-aware | voie C lourd | Δ (C−gap) | §6.4 |
|---|---|---|---|---|
| in-lexique | 97,1 % | 97,5 % | +0,4 (+2,5/0/−1,3) | NON (bruit — cohorte domine, voie sublex. ~inerte) |
| **OOV** | **58,3 %** | **57,1 %** | **−1,3** (+2,5/−5,0/−1,3) | **NON (perd 2/3 graines)** |

→ Sur la **vraie métrique** (winrate, pipeline complet, config optimale), le C lourd **ne bat pas** le gap-aware (OOV
−1,3 moy, perd 2/3 graines ; in-lex = bruit). Le proxy top-1 ne mentait pas, mais c'est maintenant établi sur le winrate.

#### Levier « entraîner sur de VRAIES parties » (10⁴ parties, critique #1 de Rem) — testé, RECUL net — 2026-06-19

Dernier levier non épuisé : entraîner le C sur la **vraie distribution d'états de jeu** (révélation stratégique), pas des
masques aléatoires. `evo/harvest_states.js` : self-play OOV à config optimale, masks réels enregistrés, **mots de test
exclus (anti-fuite)**. Récolte : 5 000 parties → **36 356 états réels / 5 299 mots distincts** (le self-play à config
optimale est lent, ~1,6 s/partie → couverture lexicale limitée). C réentraîné dessus (4 blocs, parité moteur vérifiée),
re-test winrate à config optimale, mêmes 3 graines :

| C entraîné sur… | mots distincts | OOV : voie C | Δ (C−gap) | §6.4 |
|---|---|---|---|---|
| masques aléatoires | 40 000 | 57,1 % | −1,3 (perd 2/3) | NON |
| **états réels** | **5 299** | **43,8 %** | **−14,6 (−15/−8,8/−20, perd 3/3)** | **NON (RECUL)** |

**Diagnostic (mécanisme).** Le réalisme des masks **n'aide pas** ; la **couverture lexicale réduite** (5 299 vs 40 000)
fait **sur-apprendre** un vocabulaire étroit → généralisation OOV effondrée. Pour l'OOV, ce qui compte est la **couverture
sous-lexicale** (beaucoup de mots), pas la distribution de révélation. Restaurer la couverture en gardant des masks réels
exigerait ~40k+ parties harvestées (~17 h au débit actuel) — et, au mieux, ne **rejoindrait** que la parité du random-mask
(le C converge vers le n-gram quelle que soit l'entrée). Levier épuisé.

**Conclusion (§0, §1.11 confirmé empiriquement).** L'attention lourde **converge vers** le gap-aware (parité dans le
bruit, du 3 blocs au 4 blocs ×3 graines, **confirmée au winrate à config optimale** ; l'entraînement sur états réels la
**dégrade** par manque de couverture) **sans le dépasser de façon fiable**. Le n-gram gap-aware (gratuit, zéro poids,
interprétable, déjà câblé) reste le **plancher d'agrégation ET le plafond pratique**. **Décision : ne RIEN câbler** — pas
de `_neoHeavyCDist()`, pas d'IndexedDB. Le coût (≈40k poids embarqués + forward/décision + persistance + opacité) ne se
justifie pas pour un gain mesuré nul-dans-le-bruit. Aller au-delà = SOTA-scale hors-ligne (gros modèle, LayerNorm/warmup,
beaucoup de compute) pour ~3-5 pts top-1 au mieux — non justifié par la doctrine « cognition > oracle = léger/interprétable »
tant que la mesure ne montre pas un Δ robuste. Sonde rejouable : `node evo/heavy_c_probe.js [graine] [trainN] [epochs]
[d] [lr]` (env `HEADS`/`LAYERS`/`BATCH`/`CLIP`). **Baseline moteur byte-identique : rien n'a été modifié dans
`app/omega-pendu.html` (chantier 100 % en sonde `evo/`).**

---

## 2. Findings structurels (par sévérité)

### 🟠 S1 — Le chemin de décision réel ≠ le récit architectural *(vérifié)*
Les **derniers ~7 pts** (90→97,5) viennent **entièrement de la cascade de declares** (`WORD_DECLARE → BPC_DECLARE → DECLARE_DUAL → EMERGENT → NEO`, 7080–7189) : recall **+1,76**, assemblé **+5,28**, cohorte **+0,5**. Le **concept M3_d, le miroir Möbius, le hub M_S** portent la base cognitive ~90 % mais **rien** du saut declare. Structurellement : *scoreur cognitif modeste + forte cascade de déclaration*. À assumer dans la communication.

### 🟠 S2 — M2_d/M3_d dominés par la longueur *(vérifié)*
- `M3_d_step`:4241 — fix `« encoder depuis M1 (riche), pas M2 (lave) »` → **M2_d lessivé** (ne code que la longueur).
- bPC = autoencodeur de **reconstruction** (4273, `w += LR·a·(m2 − m2hat)`) sur entrée dominée par la longueur, goulot **12 cellules** → effondrement de modes (7/12 mortes).
- `M3_d.output` **norme non bornée** (~8, point fixe Hebbian α/α=8 ; 6383), rustine `normalizeInPlace`.
→ Les **cellules** sont **structurellement un détecteur de longueur**, pas un discriminateur de lettres. **MAIS** (maj §3.1/§3.2) le **readout-récompense** `cLetterScore` (matrice 26×12, apprise `reward·a`) **extrait quand même** un signal lettre **spécifique au mot** depuis ce code de forme → **+0,128 discrimination, +3,4 winrate cheat-free**. Donc « inertie » ne vaut que pour les *cellules/hub* ; le *readout* n'est **pas** inerte. Cf. §3.1.

### 🟡 S3 — Tissu cicatriciel & code vestigial *(vérifié)*
Monolithe ~11 k lignes + lexique, **87 fonctions** entrelacées, commentaires = historique de patchs (`R41-#1..#11`, `F177/F198/F169`). Exemple : `cStep` étape (5) `pairConv` marqué **« transitoire, sera retiré Jour 6' »** (6393) — jamais retiré. Édition via extraction `/tmp`. **Aucun test ne garde le comportement** (la CI ne teste que la dictée) → risque #1 de régression silencieuse. *Reco : un harnais headless seedé en CI qui `assert` cognition seule ≥ 90 % et +NEO ≥ 97 %.*

### 🟡 S4 — Dérive doc↔code (miroir phon) — **RÉSOLU §1.4/D1**
La doc dit `M2_phon_m`/`M1_phon_m` « jamais construits » ; l'inventaire montre `M2_phon_m_step`(3879) et `M1_phon_m_step`(3902) **existent**. **Tranché (§1.4) :** ils existent **et sont appelés** (7301-7302) mais **sans consommateur** (zonePenalty/letterScore lus nulle part) → *vivants en exécution, inertes en effet*. Doc rapport §5.2 périmée. C'est bien là que se loge le code mort (candidat nettoyage S3, ou à brancher). **§1.4/D2** ajoute une dérive sœur plus sérieuse : `M5_D_M1_M_WEIGHT` n'est pas 0,0 mais **0,1** (co-décideur ortho vif).

### 🟢 S5 — Discipline OFF-inerte réelle *(vérifié)*
Chaque brique derrière un flag (`if (M_S_ENABLED)`, `if (M_BPC_M3D_ENABLED && M3_d.bpcW)`, `if (m3Ok)`…) ; le toggle **`M3_D_BYPASS` existe** (4292). La baseline-byte-identique est **structurellement crédible** (les flags gardent des blocs, ne patchent pas des sorties). Coût : espace de config combinatoire de 47 flags, peu de présets réellement mesurés.

### 🟡 S6 — Puissance statistique mince
Le 97,5 % = 4 graines × 120 = **480 parties** ; R66 recommande ≥ 200 × 4. Plusieurs Δ pivots sont des mesures uniques. Directions crédibles, marges fragiles (±0,59).

---

## 3. M3_d — PEUT-ÊTRE UTILE (hors winrate) : reclassement §0 + diagnostic + piste

**⚠️ Reclassement (Rem, 2026-06-17) — la doctrine §0 prime sur le winrate.** Tout ce qui suit (et le rapport §12 « chantier clos ») jugeait M3_d à l'aune du **winrate du pendu**. Or le pendu n'est qu'un **banc d'essai** ; le système est un **modèle cognitif** (clause §0 : *la performance est un indicateur, pas une fin*). **Conclusion révisée : M3_d n'est ni « mort » ni « à clore » — il est *winrate-inert* (mesuré, solide) MAIS PEUT-ÊTRE UTILE hors-winrate**, à juger sur la **fidélité cognitive** et son rôle dans la **dictée**.
- *Solide (inchangé)* : M3_d code surtout la **forme/longueur** (S2 ; diag `evo/diag_mirror.js` : cellule #10 = 79 %) ; **aucune entrée sens/contexte** (dictee/README.md (§ Falsifié M3_d)) → **latent de FORME, pas de sens** ; banc→scoring-lettre falsifié (−1,33, §1.4.2).
- *Rouvert (§0)* : (1) **fidélité structurelle** — M3_d *est* la couche-concept du modèle double-route/triangle (hub-and-spoke Rogers/Patterson) ; le retirer briserait la fidélité → §0 mandate de le garder. (2) **dictée** — un latent de **forme** = candidat **signal de stade précoce** (Ferreiro pré-syllabique/syllabique : préserver la silhouette/longueur du mot, *KAP*→canapé) ; le *défaut* « ne voit que la forme » devient un *signal*. (3) **familiarité** faible (AUC 0,64→0,98), bornée (le banc fait mieux).
- *Garde §1 (anti-hype)* : « peut-être utile » n'est **pas** « utile ». Il faut un **effet mesurable sur la bonne tâche** (la **dictée**, pas le pendu). Tant que non mesuré là → statut = **hypothèse vivante**, pas chantier clos. (Frontière : utilité possible = **forme/morpho**, jamais sémantique/homophone — déjà falsifié.)

**Déjà falsifié (ne pas refaire) :** loger le banc épisodique dans M3_d (mur de capacité 12 cellules) ; coupler le readout reward en config pleine (nuit, A2 redondant).

**Diagnostic neuf — ⚠️ EN PARTIE INFIRMÉ par §3.1/§3.2 (2026-06-17).** Hypothèse initiale : les cellules entraînées par **reconstruction** (4273) sur une entrée **dominée par la longueur** → forme, pas discrimination de lettres → *« le readout n'aurait alors aucun signal discriminant → contribution plate »*. **FAUX, mesuré** : le readout `cLetterScore` **discrimine +0,128 et rapporte +3,4 cheat-free** (§3.1) — il **extrait** des corrélations forme→lettre depuis le code de forme via son apprentissage **pondéré-activation** (`reward·a`, §3.2). « Contribution plate » ne valait qu'**en config pleine avec A2** (oracle redondant). Donc l'argument « objectif mal aligné → il faut la prédiction-masquée » est **affaibli** : le readout fait déjà le travail. La prédiction-masquée (ci-dessous) reste une piste pour *améliorer les cellules*, pas un prérequis pour rendre M3_d utile.

**Piste (hypothèse, OFF-inerte, cheat-free) :** remplacer l'objectif de reconstruction par une **prédiction masquée** self-supervised : entraîner les 12 cellules à **prédire la lettre d'une position révélée à partir des autres positions révélées** (révélé→révélé, donc montant-légal). Pression discriminative alignée sur la tâche ; le goulot doit encoder la co-occurrence lettre/phonotactique = la « couche morphologique » de la roadmap §10.

**Protocole R66 (contrôle = `M3_D_BYPASS` existant) :**
1. AUC présent/absent de `cLetterScore` actuel (reconstruction) = baseline.
2. Ré-entraîner sur masked-prediction, re-mesurer l'AUC.
3. Si AUC ↑ **et** couplage utile **en config pleine** → M3_d devient contributeur. Si AUC plat → mur 12 cellules confirmé pour le **rôle winrate** seulement (la familiarité reste dans le banc) — **on clôt le rôle *winrate*, PAS le rôle cognitif/dictée** (§0 ; cf. reclassement ci-dessus).

Soit ça marche, soit ça ferme l'incertitude par la mesure.

### 3.1 — Audit structurel + test de bPC (M_BPC_M3D) et de `cLetterScore` — 2026-06-17

**Structure (lecture code).** Config réf. (bPC ON), `M3_d_step`(4267) :
- encode `a_c = relu(bpcW_c · M1_d.output)` (depuis **M1**, pas M2), décode tied, MAJ par **erreur de reconstruction** (`bpcW += LR·a·(m1−m̂)`) ;
- **readout récompense** `rwR[lettre] += LR·reward·a` (reward = +1 si une position s'est révélée depuis le tick précédent, sinon −1) → `cLetterScore[l] = Σ a_c·rwR[l][c]` ;
- **`M3_d.output` explicitement remis à 0 (4596)** → le concept **ne nourrit PAS le hub M_S** sous bPC (« perception ≠ prédiction lexicale »). Seule sortie décision = `cLetterScore` (couplage 0,20).
- Chemin Hebbian (bPC OFF, 4601+) : projection LDIM→SDIM **bijective** (aucune info nouvelle, R42-#9), écrit `conceptCells`+`M3_d.output`→hub. **OFF en réf.** → l'argument « fidélité = concept nourrit le hub » (§3 reclassement) ne vaut que bPC OFF ; sous bPC le lien concept→hub est **coupé volontairement**.

**Test (R67, voie phon active, cognition, warmup 200/test 80, 3 graines) :**

| Mesure | 12345 | 777 | 2024 | lecture |
|---|---|---|---|---|
| (R) reconstruction `‖m1−m̂‖/‖m1‖` | 0,757 | 0,781 | 0,762 | autoencodeur **partiel/lossy** (~0,77) |
| (C) cellules vivantes · dominante | 9/12 · #4 51 % | 8/12 · #1 26 % | 8/12 · #10 45 % | code **concentré** (1 cellule plurale, cellule variable selon init) · modale par longueur → **forme** |
| (S) `cLetterScore` **GAP NET** (− fréquence) | **+0,128** | **+0,127** | **+0,131** | **fort signal spécifique au mot** (~6× la fréquence) |

**Verdict — l'inverse de M1_m.** Les *cellules* bPC codent surtout la **forme/longueur** (reconstruction partielle, 1 cellule plurale, modale par longueur), MAIS le **readout-récompense `cLetterScore` discrimine fortement les lettres DU MOT** (+0,128 net, robuste) : le readout extrait des corrélations **forme→lettre spécifiques au mot** depuis un code pourtant formel. → M3_d-via-bPC **n'est pas mort même par la discrimination** — c'est le **plus fort signal concept→lettre** mesuré (vs M1_m ≈ fréquence ; M4_phon_m +0,028). Renforce le reclassement §0 : de *peut-être utile* à *porte un vrai signal*, et **déjà câblé** (couplage 0,20). Outil : `evo/diag_bpc.js`.

**Test winrate FAIT (`evo/ab_bpcr.js`, 8 graines, cognition cheat-free sans A2, in-lex K=1).** `M_BPC_READOUT_COUPLE` ON vs OFF : **ON 91,4 % / OFF 88,0 % → Δ +3,4** · par graine `[+3,+3,+8,+5,0,0,+7,+1]` = **6 gains / 2 nuls / 0 perte (jamais sous zéro)**. → `cLetterScore` **CONVERTIT en winrate** — l'**inverse** de M1_m (−1,3) et M4_phon_m (−0,4) — et **reproduit le « +2 à +3 en config dépouillée »** du rapport. Reste vrai (rapport, non re-mesuré ici) : **redondant/nuit avec A2** (oracle lexical, exclu par doctrine) → c'est un **lever cheat-free réel**, pas un lever en config-pleine-triche.

> **Conséquence — double correction du vieux verdict M3_d.** « M3_d détecteur de longueur **inutile** / chantier clos » était faux pour **deux** raisons : (1) mauvais étalon (winrate du pendu vs §0) ; (2) le « contribution plate » se mesurait **en config pleine AVEC A2** (oracle redondant). En **cheat-free**, le concept (via bPC readout) **rapporte +3,4** et c'est l'un des **rares leviers cognitifs cheat-free qui marchent**. Les *cellules* restent un code de **forme** (réutilisable côté dictée, §0) ; le *readout* est un **contributeur winrate prouvé**. M3_d n'est PAS mort.

### 3.2 — (b) Pourquoi `rwR` (readout) gagne là où `letterPenalty` (miroirs) échoue — 2026-06-17

Décomposition mesurée (`evo/diag_rwr.js`, voie phon active, 3 graines) du GAP in−out de `cLetterScore` : **RÉEL** (`a·rwR`, conditionnel) vs **PLAT** (`mean(a)·Σ_c rwR[l]`, marginal — pattern d'activation supprimé) vs **FRÉQUENCE**.

| GAP in−out | 12345 | 777 | 2024 |
|---|---|---|---|
| RÉEL (conditionnel) | +0,150 | +0,149 | +0,153 |
| PLAT (marginal rwR) | +0,109 | +0,101 | +0,096 |
| FRÉQUENCE (réf) | +0,022 | +0,022 | +0,023 |
| part conditionnelle (réel − plat) | +0,041 | +0,048 | +0,058 |

**Deux causes (pas une) :**
1. **Marginal non-ancré à la fréquence (~2/3 du gain : +0,087 au-dessus de la fréquence).** `rwR` accumule la récompense par lettre avec **décroissance vers 0** (`rwR += LR·reward·a`, `×(1−R_DECAY)`) → il apprend « les lettres qui apparaissent **et gagnent** ». `M4_m.letterPenalty` (M1_m) est au contraire **homéostasé vers une cible de FRÉQUENCE** (`M4_m_step` 5340 : `lp += (letterTarget−lp)·rate` ; plancher = letterTarget) → son signal appris est **continuellement relavé vers la fréquence** (d'où corr 0,999, §1.4.1). **C'est l'homéostasie-fréquence qui tue M1_m**, pas seulement le fait d'être marginal.
2. **Conditionnement sur la forme (~1/3 : +0,041).** `rwR` est une **matrice 26×12** → `cLetterScore = a·rwR[l]` conditionne sur le **pattern d'activation** (la forme du mot) = `P(lettre | forme)`. `letterPenalty` (vecteur 26) ne peut exprimer que `P(lettre)`. C'est la doctrine §3 (conditionnel/jointe > marginale) **au niveau du mécanisme**.

**Bilan (b) :** M1_m cumule **deux handicaps** — marginal **ET** ancré-fréquence ; `rwR` n'a **aucun** des deux. Piste : un miroir ortho **sans homéostasie-fréquence** récupérerait-il le +0,087 ?

#### 3.2.1 — Test « M1_m sans homéostasie » — FALSIFIÉ (2026-06-17)

Toggle `M4_M_HOMEO_V2_ENABLED` passé `const`→`let` (défaut true byte-identique) pour A/B. Mesure (`evo/diag_m1m_homeo.js`, voie phon active, 3 graines) du GAP NET de `M1_m.letterScore`, ancre-fréquence ON vs OFF (baseline decay→0) :

| | 12345 | 777 | 2024 |
|---|---|---|---|
| HOMEO_V2 **ON** (ancré fréquence) | −0,000 | −0,000 | −0,000 |
| HOMEO_V2 **OFF** (un-ancré decay→0) | **−0,026** | **−0,027** | **−0,026** |

**Résultat : l'inverse de l'attendu.** Un-ancrer M1_m ne donne **pas** +0,087, il donne **−0,026** (discrimination *négative*). L'ancre-fréquence **aidait** (gardait M1_m ≈ fréquence, ~0) ; la retirer **empire**.

**Correction de ma décomposition §3.2 (honnêteté §6).** Le « PLAT +0,087 » de rwR (`mean(a)·Σ_c rwR[l]`) **n'est PAS un marginal par-lettre pur** : `Σ_c rwR[l][c]` agrège un apprentissage **pondéré par l'activation** (`rwR += reward·a[c]`) → il encode **déjà de la forme**. Un vrai signal par-lettre (M1_m un-ancré = compteur de ratés brut, **sans pondération-forme**) sur-pénalise les lettres rares *du mot courant* → négatif. **La vraie cause du succès de rwR n'est donc PAS « non-ancré + conditionné »** mais **« apprentissage pondéré-forme à la source » (`reward·a`), irréductible à toute règle par-lettre** (ancrée ou non). **Conséquence : M1_m (structure 26) ne peut PAS être ressuscité — il faut la matrice (forme). Piste close.** (`M4_M_HOMEO_V2_ENABLED` reste `let`, défaut ON ; OFF mesuré pire → ne pas adopter.)

---

## 4. Synthèse priorisée
1. **Communication** : toujours afficher le régime (« 97,5 % in-lexique, mot entendu » ; repères sans prémisse 70,7 % / 22 %).
2. **g2p** : trancher l'une des 3 options (recommandé : 1 + libellé de régime ; ou 2 pour la pureté pendu — **coût réel après garde : ~0 in-lexique / ~7,5 pts OOV, §1.1**). Option 2 codée OFF-inerte + garde de pureté (`M_NEO_PHON_COHORT_ENABLED` / `_PURITY`).
3. **CI** : harnais seedé gardant 2-3 chiffres clés (anti-régression du monolithe).
4. **M3_d** : *ne pas* enterrer sur le winrate (§0, cf. §3 reclassement) — **peut-être utile** comme latent de **forme** côté **dictée** (signal de stade précoce) ; rôle à **mesurer là**. Côté pendu (winrate seul) : masked-prediction ou `M3_D_BYPASS`+AUC.
5. **Hygiène** : retirer le vestigial (`pairConv`…), réconcilier la doc miroir phon.

*Tous les points laissent la baseline OFF-inerte (byte-identique au repos). Aucune action de cet audit n'a modifié le moteur.*
