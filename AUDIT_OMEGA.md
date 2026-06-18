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
- `notes/M3D-reconnexion-FALSIFIE.md` (03/06) mesurait déjà le collapse (cross-mot cosine **0,9479**, 1 cellule 35/39, 9/12 mortes ; `M3_d.output=0` sous bPC). Mes chiffres le **reproduisent**.
- Solution tentée = **câbler concept→M4** (le mot rappelé injecté comme concept dans le scoring) → **FALSIFIÉE −1,33**, *« contamine le scoring-lettre… le chemin concept→M4 est le mauvais endroit. Ne pas reproposer. »* **Revertée, non appliquée.**
- Principe Rem documenté (`notes/NEO-muette-croisement.md`) = celui de cette session : *« si ça ne rend pas au système, on a mal câblé, pas l'approche »* ; la fix-câblage qui a marché là = le **trigger** (gate sur l'incertitude cognition) → rend la brique **neutre**, pas un levier.
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

**Motif unique (cohérent avec la doctrine et les notes) :** *aucune des voies descendantes ne convertit en winrate, quelle que soit la direction.* Le signal qui gagne est **ascendant** — assemblé phon→ortho (+5,28) et recall (+1,76), via le **declare**, pas via la correction descendante (cf. `M3D-reconnexion-FALSIFIE` : « le chemin concept→M4 est le mauvais endroit »). La thèse « sens des flux » de Rem est **validée et bornée** : la bonne direction *porte* bien plus de signal côté phon, mais c'est l'**ascendant** (décode), pas le **descendant** (miroir), qui fait gagner. Conséquence : les dormants `M2/M1_phon_m` = **hygiène S3** (pas de levier attendu) ; chantier winrate = côté **ascendant/declare** (déjà la force d'OMEGA).

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

### 🟡 S4 — Dérive doc↔code (miroir phon) — **RÉSOLU §1.4/D1**
La doc dit `M2_phon_m`/`M1_phon_m` « jamais construits » ; l'inventaire montre `M2_phon_m_step`(3879) et `M1_phon_m_step`(3902) **existent**. **Tranché (§1.4) :** ils existent **et sont appelés** (7301-7302) mais **sans consommateur** (zonePenalty/letterScore lus nulle part) → *vivants en exécution, inertes en effet*. Doc rapport §5.2 périmée. C'est bien là que se loge le code mort (candidat nettoyage S3, ou à brancher). **§1.4/D2** ajoute une dérive sœur plus sérieuse : `M5_D_M1_M_WEIGHT` n'est pas 0,0 mais **0,1** (co-décideur ortho vif).

### 🟢 S5 — Discipline OFF-inerte réelle *(vérifié)*
Chaque brique derrière un flag (`if (M_S_ENABLED)`, `if (M_BPC_M3D_ENABLED && M3_d.bpcW)`, `if (m3Ok)`…) ; le toggle **`M3_D_BYPASS` existe** (4292). La baseline-byte-identique est **structurellement crédible** (les flags gardent des blocs, ne patchent pas des sorties). Coût : espace de config combinatoire de 47 flags, peu de présets réellement mesurés.

### 🟡 S6 — Puissance statistique mince
Le 97,5 % = 4 graines × 120 = **480 parties** ; R66 recommande ≥ 200 × 4. Plusieurs Δ pivots sont des mesures uniques. Directions crédibles, marges fragiles (±0,59).

---

## 3. M3_d — PEUT-ÊTRE UTILE (hors winrate) : reclassement §0 + diagnostic + piste

**⚠️ Reclassement (Rem, 2026-06-17) — la doctrine §0 prime sur le winrate.** Tout ce qui suit (et le rapport §12 « chantier clos ») jugeait M3_d à l'aune du **winrate du pendu**. Or le pendu n'est qu'un **banc d'essai** ; le système est un **modèle cognitif** (clause §0 : *la performance est un indicateur, pas une fin*). **Conclusion révisée : M3_d n'est ni « mort » ni « à clore » — il est *winrate-inert* (mesuré, solide) MAIS PEUT-ÊTRE UTILE hors-winrate**, à juger sur la **fidélité cognitive** et son rôle dans la **dictée**.
- *Solide (inchangé)* : M3_d code surtout la **forme/longueur** (S2 ; diag `evo/diag_mirror.js` : cellule #10 = 79 %) ; **aucune entrée sens/contexte** (EXP_M3D_FALSIFIE) → **latent de FORME, pas de sens** ; banc→scoring-lettre falsifié (−1,33, §1.4.2).
- *Rouvert (§0)* : (1) **fidélité structurelle** — M3_d *est* la couche-concept du modèle double-route/triangle (hub-and-spoke Rogers/Patterson) ; le retirer briserait la fidélité → §0 mandate de le garder. (2) **dictée** — un latent de **forme** = candidat **signal de stade précoce** (Ferreiro pré-syllabique/syllabique : préserver la silhouette/longueur du mot, *KAP*→canapé) ; le *défaut* « ne voit que la forme » devient un *signal*. (3) **familiarité** faible (AUC 0,64→0,98), bornée (le banc fait mieux).
- *Garde §1 (anti-hype)* : « peut-être utile » n'est **pas** « utile ». Il faut un **effet mesurable sur la bonne tâche** (la **dictée**, pas le pendu). Tant que non mesuré là → statut = **hypothèse vivante**, pas chantier clos. (Frontière : utilité possible = **forme/morpho**, jamais sémantique/homophone — déjà falsifié.)

**Déjà falsifié (ne pas refaire) :** loger le banc épisodique dans M3_d (mur de capacité 12 cellules) ; coupler le readout reward en config pleine (nuit, A2 redondant).

**Diagnostic neuf :** les cellules sont entraînées par **reconstruction** (objectif génératif, 4273) d'une entrée **dominée par la longueur** → elles apprennent la variance dominante (longueur/forme), pas à **discriminer les lettres**. Le readout reward n'a alors aucun signal discriminant → contribution plate. **Objectif mal aligné sur la tâche.**

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

**Nuance winrate (discrimination ≠ victoires).** Le rapport documente : couplage readout = **+2 à +3 en config dépouillée**, **redondant/nuit avec A2** (le lexique fournit déjà le prior). A/B `M_BPC_READOUT_COUPLE` ON/OFF en cheat-free = test en cours (`evo/ab_bpcr.js`).

---

## 4. Synthèse priorisée
1. **Communication** : toujours afficher le régime (« 97,5 % in-lexique, mot entendu » ; repères sans prémisse 70,7 % / 22 %).
2. **g2p** : trancher l'une des 3 options (recommandé : 1 + libellé de régime ; ou 2 pour la pureté pendu — **coût réel après garde : ~0 in-lexique / ~7,5 pts OOV, §1.1**). Option 2 codée OFF-inerte + garde de pureté (`M_NEO_PHON_COHORT_ENABLED` / `_PURITY`).
3. **CI** : harnais seedé gardant 2-3 chiffres clés (anti-régression du monolithe).
4. **M3_d** : *ne pas* enterrer sur le winrate (§0, cf. §3 reclassement) — **peut-être utile** comme latent de **forme** côté **dictée** (signal de stade précoce) ; rôle à **mesurer là**. Côté pendu (winrate seul) : masked-prediction ou `M3_D_BYPASS`+AUC.
5. **Hygiène** : retirer le vestigial (`pairConv`…), réconcilier la doc miroir phon.

*Tous les points laissent la baseline OFF-inerte (byte-identique au repos). Aucune action de cet audit n'a modifié le moteur.*
