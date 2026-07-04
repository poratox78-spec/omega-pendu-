# OMEGA-Ω — CODE_MAP : wiki orienté code du moteur (pendu)

> **Carte du code** de `app/omega-pendu.html` (monolithe ~12 900 lignes (07/2026), ~244 fonctions, ~45 toggles whitelistés).
> But : savoir **ce qui triche / ne triche pas par site**, **le sens des voies** (qui lit la sortie de qui), **comment
> les toggles sont câblés aux fonctions**, et à quoi sert chaque fonction. Complète les audits (qui pointent des
> *findings*) par une *cartographie*. Établi 2026-06-19 (4 cartographies de code croisées).
> **Audit d'ancrage 2026-06-20** : chaque claim falsifiable re-vérifié contre le source — 32/32 ancres de fonction,
> 10/10 declares, 7/7 réfs toggles §6, lignes de décl. §7, formule OS (l.3818-3827), `_neoDeclareOSmix` α=β découplé
> (l.6402-6406), poids co-décideurs (0,7/0,3 M4_d · 0,5 hub · 0,20 readout · 0,3 phonGraph · 0,1 M1_m), M1_d révélé-seul
> (l.4128). Corrigés : census `wp.get` (§3, 5 sites), boot (§1, `M_S_ENABLED` const), `M2_m`→OS_diss (§4.2), caveat bPC M4_d.
>
> ⚠️ **Numéros de ligne** : indicatifs (le fichier a dérivé de +30 à +120 lignes). Les utiliser comme **ancrage
> relatif** ; re-localiser par `Grep` du nom de fonction avant toute édition.
> Docs liés : `AUDIT_OMEGA.md` (mesures), `docs/CONFIG_TOGGLES.md` (preset + triche par toggle), `docs/COGNITION_DESIGN.md`.

---

## 1. Vue d'ensemble

- **Un seul `<script>`** non encapsulé : ~500 globaux top-level (`let`/`const`/`function`). Pas de modules.
- **Au boot, le seul *levier togglable* ON est `M4_PHON_USE_P_ENABLED`** (rapport §6) — mais la **baseline cognitive
  tourne quand même** : pipeline `cStep` M1_d→M5_d + hub `M_S` (`M_S_ENABLED` est un `const = true`, l.1610, assert I40
  l.7588). Ce qui défaut-OFF = les **leviers / declares additifs** (R66). La **config de référence** (preset 1-clic
  `applyReferenceConfig`, ~l.9188) allume ~20 toggles cheat-free → **97,5 % in-lex** (K=1).
- **Deux régimes à ne jamais confondre** : in-lexique (cohorte contient le mot, ~97 %) vs OOV/Trexquant (mot retiré
  de `len_index`, généralisation sublexicale).
- **Cinq « voies » coexistent** : (1) ortho montante M*_d, (2) ortho descendante (miroir) M*_m, (3) phon montante
  M*_phon, (4) phon descendante M*_phon_m, (5) la cascade de **declares** (override de lettre). Un **arbitre OS**
  (`M_OS_v07_step`) dose ortho⟷phon.

---

## 2. Le tour de jeu — `omegaStep()` (l.7225)

L'**ordre d'exécution** (= la frontière de triche, cap §43) :

```
omegaStep()  [l.7225]
 │
 ├─ 1. MONTANT (DÉCIDER) — ne lit que les positions RÉVÉLÉES
 │     cStep(currentWord, revealedMask)  [l.6645]
 │       M1_d_step → M2_d_step → M3_d_step → M_S_step → M4_d_step → M5_d_step
 │     omega_voiePhon_OS_tick(...)  [l.3970]   (voie phon shadow + override OS si M_OS_V07)
 │
 ├─ 2. DECLARES (override de la lettre)  [~l.7300-7448]   ← cascade last-writer-wins (§5)
 │     WORD → BPC → DUAL → ÉMERGENT → NEO(...)
 │
 ├─ 3. penduEvaluate(proposed)  [l.7035]   ← joue la lettre, révèle, calcule result
 │     ───────────  ⟂ FRONTIÈRE  ───────────   (avant = révélé seul ; après = mot complet légitime)
 │
 ├─ 4. DESCENDANT ORTHO (APPRENDRE)  [~l.7466]
 │     M5_m_step(result) → M4_m_step → M3_m_step → M2_m_step → M1_m_step
 │
 ├─ 5. DESCENDANT PHON (si M_PHON_FEEDBACK)  [~l.7474]
 │     M5_phon_m_step → M4_phon_m_step → M3_phon_m_step → M2_phon_m_step → M1_phon_m_step
 │
 └─ 6. OS.step()  [~l.7516]   (dialectique, après miroirs frais)
```

**Règle d'or** : tout ce qui s'exécute **avant `penduEvaluate`** décide → ne doit lire que `revealedMask[p]` ;
tout ce qui s'exécute **après** apprend → peut lire le mot complet (le « professeur », wake-sleep). `endCurrentGame`
(l.7128) fait l'apprentissage descendant des declares (banc, g2p, tables jointes), post-partie.

---

## 3. La frontière de TRICHE — carte par site d'accès

**Critère unique** : pour décider une lettre, le code lit-il le mot caché (positions non révélées, ou le son du mot
entier `wp.get(currentWord)`) ? **Oui → triche.** Catégories :
- 🟢 **propre** : ne lit que le révélé + `len_index` (honnête OOV).
- 🔵 **cheat-free non-défaut** : cohorte board-dérivée (`_neoWBL` corrigé depuis `len_index`).
- 🟠 **« mot entendu »** : lit le SON du mot entier (`wp.get`) — triche au pendu pur, légitime en dictée.
- 🔴 **béquille grise** : injecte la fréquence du dico dans le scoring-lettre (A1/A2/A3).

### Les sites lisant le SON du mot entier (`wp.get`) — census exhaustif (5)
> Seuls **3** écrivent littéralement `wp.get(currentWord)` (7138/7368/7402). S4/S5 lisent `wp.get(word)`, où `word`
> **est** `currentWord` passé par l'appelant (l.7137 : `if (M_NEO_G2P_EXP_ENABLED) learnExp(currentWord,…) else learn(currentWord)`).

| Site | Ligne ~ | Contexte | Montant/Descendant | Statut |
|---|---|---|---|---|
| S1 | 7138 | `endCurrentGame` — apprentissage table muette jointe | **descendant** | 🟢 légitime |
| S2 | 7368 | `M_EMERGENT_ASSEMBLED` — décision (assemblé phon→ortho) | **montant** | 🟠 mot-entendu |
| S3 | 7402 | `M_NEO_ASSEMBLED` — décision (défaut) | **montant** | 🟠 (→ 🟢 si `M_NEO_PHON_COHORT` ON) |
| S4 | 6141 | `learnExp(word,…)` — g2p révélé-seul (branche EXP) | **descendant** | 🟢 légitime |
| S5 | 6139 | `learn(word)` — g2p (branche non-EXP, sœur de S4) | **descendant** | 🟢 légitime |

→ **Seuls S2/S3 (7368/7402) sont au montant** ⇒ le 97,5 % cheat-free repose sur la prémisse « mot entendu » **tant
que** `M_NEO_PHON_COHORT` est OFF ; ON, l'assemblé NEO passe au son **board-dérivé** (`_neoPhonCohort`, 🟢 intégral).
S1/S4/S5 sont des lectures d'**apprentissage** (post-décision, wake-sleep) → légitimes même au pendu pur.

### Autres sites à connaître
- **A1/A2/A3** (🔴) : `L01_A2_M4_LEX4` injecte la fréquence du dico dans le scoring-lettre (`computeLex4LetterScores`,
  M4_d) ; `A1` = cvPattern révélé (socle) ; `A3` = réinjecte le mot Lex4 au **miroir M5_m** (descendant). OFF en réf.
- **`M4_PHON_USE_P`** (🟢, *à ne pas confondre avec S2/S3*) : M4_phon mélange un prior phonétique depuis le champ
  `p`/SAMPA **des candidats du cohort** (propriété des candidats compatibles, **pas** `wp.get(currentWord)`). Lit
  `OMEGA_LEX4.words[i].p` en itérant le cohort, jamais le son du mot caché → **propre** (prior lexical-phon).
- **Cohorte** : `_neoEnsureWBL()` (l.6291) bâtit l'index cohorte depuis **`len_index`** (respecte les retraits
  Trexquant). C'était l'ancienne **fuite** (`words[]`, §1.6.1) — corrigé.
- **`align(m, ph, mask)`** : aux positions **non révélées**, émet une distribution **uniforme** (jamais le graphème
  caché) → l'assemblé masqué ne fuit pas l'orthographe cachée.

---

## 4. Les VOIES et leur SENS (qui lit la sortie de qui)

> Principe : *appelé ≠ effectif*. Une fonction qui écrit un buffer que **personne ne lit** est inerte.

### 4.1 Voie ortho MONTANTE (décider) — `cStep` (l.6645)
| Étage | Ligne | Rôle | Lit | Écrit | Consommateur réel | Triche |
|---|---|---|---|---|---|---|
| `M1_d_step` | 4089 | perception : lie position×lettre révélée (HRR, 5 sous-cerveaux, LDIM 512) | currentWord aux positions révélées, `letterVecs`, (M1_m si Möbius) | `M1_d.output` | M2_d_step | 🟢 |
| `M2_d_step` | 4184 | spatialise en 16 zones (chapeau mexicain) — **lave le signe → ne code que la longueur** | M1_d.output | `M2_d.output`, zones | M3_d_step | 🟢 |
| `M3_d_step` | 4299 | concept 12 cellules (bPC autoencodeur OU Hebbian) | M2_d/M1_d.output | `M3_d.output`, `cLetterScore`, conceptCells | M_S, M4_d, M5_d (cLetterScore) | 🟢 (voir 4.3) |
| `M4_d_step` | 4799 | candidats = cos(concept,letterVecs)×**0,7** (`M4_D_W_COSINE`) + freq×**0,3** (`M4_D_W_FREQ`) (+A2 si ON). ⚠️ **sous bPC** (réf.) : `wCos→0,3` (l.4866) **et** concept=`M3_d.output`=0 → terme cos **nul** → M4_d devient *freq-seul* ; le concept rentre via `cLetterScore`@M5_d (§4.3) | M3_d.output, `letterVecs`, LETTER_FREQ | `M4_d.output` (top-K) | M5_d_step | 🟢 (🔴 si A2) |
| `M5_d_step` | 4919 | décision softmax (température adaptative) + co-décideurs | M4_d candidates, `alreadyTried`, M_S, phonGraphMap, M1_m, cLetterScore | `M5_d.output` {letter,gap} | omegaStep (proposed) | 🟢 |

### 4.2 Voie ortho DESCENDANTE (miroir, apprendre) — après `penduEvaluate`
| Étage | Ligne | Écrit | Consommateur réel | Effectif ? |
|---|---|---|---|---|
| `M5_m_step` | 5308 | reward {HIT +1/MISS −0,5/WIN +2/LOSE −1} | tous les étages sous lui | ✅ source |
| `M4_m_step` | 5357 | `letterPenalty[26]` (homéostasie vers la **fréquence inverse**) | M1_m + OS_diss (canal c, l.2152) | ✅ |
| `M3_m_step` | 5491 | **anti-Hebbian sur conceptCells** (seul miroir qui écrit le concept) | hub M_S (poids 0,5) + OS_diss (canal b, l.2129) | ⚠️ effet winrate ~0 |
| `M2_m_step` | 5569 | `zonePenalty[16]` (+ écrit `M2_m.output`) | **OS_diss (canal a, l.2113)** — *pas* « personne » | 🔵 observationnel |
| `M1_m_step` | 5635 | `letterScore = 1 − penalty` (≈ **prior de fréquence**, corr 0,999) | M5_d **si `M5_D_M1_M_ENABLED`** (poids 0,1) | ⚠️ co-décideur, **falsifié → défaut OFF** (§1.4.1) |

→ **Aucune voie descendante ne convertit en winrate** (le signal gagnant est *ascendant* : assemblé +5,28, recall
+1,76, via le declare). `M1_m.output` est inerte (seul `M1_m.letterScore` est lu) ; `M2_m.output`/`M3_m.output`/
`M4_m.letterPenalty` ne nourrissent que la **télémétrie OS_diss** (`OS.step`, l.2101, calculée 1×/100 ticks → quasi
jamais dans une partie de ~6-26 coups) — donc winrate-inertes mais **lues**, pas « personne ». `M1_m` co-décide à 0,1
(si `M5_D_M1_M_ENABLED`) mais ne porte que la fréquence.

### 4.3 M3_d — DEUX chemins exclusifs (`M_BPC_M3D`)
- **bPC ON (réf.)** : encode depuis M1_d, MAJ par erreur de reconstruction ; **`M3_d.output` est mis à 0** (l.~4639,
  découplé → ne nourrit pas le hub) ; le **readout-récompense `cLetterScore[26]`** (`Σ a_c·rwR[l][c]`, appris du reward)
  est **le vrai contributeur** : couplé 0,20 dans M5_d, **+3,4 cheat-free** (§3.1).
- **Hebbian OFF-bPC** : projection LDIM→SDIM, match cosine 12 cellules, `M3_d.output` → hub M_S → co-décide M5_d.
- Les **cellules** codent surtout la **forme/longueur** (1 cellule domine ~79 %) ; le **readout** extrait quand même un
  signal lettre spécifique au mot. *« M3_d inutile »* est faux : c'est le *concept*-hub qui est pauvre, pas le readout.

### 4.4 Voie phon MONTANTE (shadow) — `omega_voiePhon_OS_tick` (l.3970)
Gardée par `M_VOIE_PHON_ENABLED` (substrat phon `PHON_SUBSTRAT_V07` 26×40 construit à l'init).
| Étage | Ligne | Rôle | Consommateur | Triche |
|---|---|---|---|---|
| `M1_phon_step` | 3243 | articulatoire du révélé (40D) | M2_phon | 🟢 |
| `M2_phon_step` | 3315 | complétion attendue + `letterAffinity[26]` | M3_phon, M5_phon | 🟢 |
| `M3_phon_step` | 3397 | concept phon (projection fixe → SDIM) | **M_S_v07** | 🟢 |
| `M4_phon_step` | 3544 | candidats lex phon ; biais top-down M_S_v07 ; prior `w.p` du cohort si `M4_PHON_USE_P` | M5_phon | 🟢 |
| `M5_phon_step` | 3714 | décision phon + `signal` (marge z) | OS | 🟢 |

**Sens** : la voie phon de la cognition est **ortho→phon** (elle *sonorise* les lettres révélées — direction lecture).
Le declare/assemblé est l'inverse, **phon→ortho** (épellation).

### 4.5 Voie phon DESCENDANTE (`M_PHON_FEEDBACK`)
| Étage | Ligne | Écrit | Consommateur | Statut |
|---|---|---|---|---|
| `M5_phon_m_step` | 3876 | reward | étages sous lui | ✅ source |
| `M4_phon_m_step` | 3888 | `letterPenalty[26]` | **M4_phon** (l.3643, biais) | ✅ effectif (mais winrate-inert §1.4.3) |
| `M3_phon_m_step` | 3907 | `lastDominantCell` | **personne** (n'écrit PAS le hub : l'effondrerait) | 🔵 observationnel |
| `M2_phon_m_step` | 3932 | `zonePenalty` | **personne** | ⚫ dormant (« étape B ») |
| `M1_phon_m_step` | 3955 | `letterScore` | **personne** | ⚫ dormant |

### 4.6 Les DEUX hubs (à ne pas confondre)
- **`M_S` (legacy ORTHO, l.5739)** : fusionne `M3_d.output` + `M3_m.output` ; lu par **M5_d** — **mais SAUTÉ sous bPC**
  (M3_d.output=0). `M_S_ENABLED` défaut ON.
- **`M_S_v07` (PHON, l.3444)** : fusionne `M3_phon` + (M3_d si `!M3_D_BYPASS`) ; lu **uniquement par M4_phon** (biais
  top-down). Lié à la voie phon.
- **Les deux sont totalement séparés** (anti-crosstalk). C'est une subtilité que les audits floutent.

### 4.7 L'arbitre OS — `M_OS_v07_step` (l.3814)
Mélange convexe des deux voies : `r = signalPhon/signalOrtho` ; **`μ(r) = r^α / (β + r^α)`** ; `output = (1−μ)·ortho +
μ·phon` (renormalisé L1). θ=(α,β) défaut **1/1** (forme neutre `μ=r/(1+r)`). θ appris seulement si
`M_OS_LEARNING_ONLINE` (SPSA, défaut OFF — dégrade). **Réutilisé** par `_neoDeclareOSmix` (declare) avec son **propre**
(α,β) forcé 1/1 (découplé du θ de lecture — sinon conflit de sens des voies).

### 4.8 phonGraphMap / currentPhonState
`phonGraphMap[26][SDIM]` (l.2609, init depuis `letterVecsSDIM`) = carte lettre↔contexte phon **apprise** (online F +
sleep E2). Co-décideur de M5_d : `cosine(currentPhonState, phonGraphMap[l])` (poids 0,3). `currentPhonState` =
`M3_d.output` (copié en cStep) → **= 0 sous bPC** → ce co-décideur est **mort sous bPC** (cf. §1.8.2). 🟢 (lit un état,
pas le mot).

---

## 5. Les DECLARES — cascade *last-writer-wins* (~l.7300-7448)

L'override du choix de lettre. **Priorité fixe, pas un arbitrage** : le **dernier qui parle gagne**.
```
WORD_DECLARE → BPC_DECLARE → DUAL → ÉMERGENT(recall, assemblé) → NEO( recall → n-gram → OS-arb → assemblé/jointe → muette )
```
- `_neoDone` (dans le bloc NEO) bloque les voies NEO suivantes dès qu'une décide.
- Conséquence : **`DUAL + OS-arb = OS-arb`** (NEO, qui vient après, écrase DUAL).

| Declare | Ligne ~ | Lit pour décider | Triche | Toggle |
|---|---|---|---|---|
| **WORD_DECLARE** | 7317 | motif révélé + ratés → 1 candidat sûr (`len_index`) | 🟢 | `M_WORD_DECLARE_ENABLED` |
| **BPC_DECLARE** | 7331 | `cLetterScore` (M3_d) × freq | 🟢 | `M_BPC_DECLARE_ENABLED` |
| **DUAL** (`_DECL2`) | 7343 | board révélé : freq × ortho-bigramme × phon-g2p (modèle de mot) | 🟢 | `M_DECLARE_DUAL_ENABLED` |
| **ÉMERGENT recall** | 7354 | `_emrg_bind(currentWord, revealedMask)` (révélé) + banc | 🟢 | `M_EMERGENT_DECLARE_ENABLED` |
| **ÉMERGENT assemblé** | 7365 | **`wp.get(currentWord)`** (S2) + align masqué | 🟠 | `M_EMERGENT_ASSEMBLED_ENABLED` |
| **NEO recall** | 7381 | bind révélé + banc | 🟢 | `M_NEO_RECALL_ENABLED` |
| **NEO n-gram** | 7390 | `_neoLetterNgramDist` (stats `len_index`) | 🟢 | `M_NEO_LETTER_NGRAM` |
| **NEO OS-arb** | 7394 | `_neoDeclareOSmix` (l.6362) | 🟢 | `M_NEO_OS_ARB` (+`_NGRAM`) |
| **NEO assemblé/jointe** | 7402 | son **`wp.get`** (S3, défaut 🟠) **ou** `_neoPhonCohort` (🟢) | 🟠/🟢 | `M_NEO_ASSEMBLED_ENABLED` / `M_NEO_PHON_COHORT` |
| **NEO muette** | 7425 | jointe `_neoCR` sur voisins révélés ; gate trigger | 🟢 | `M_NEO_MUTE`/`M_NEO_TRIGGER` |

### `_neoDeclareOSmix()` (l.6362) — l'arbitrage OS du declare
Mélange convexe (réutilise `M_OS_v07_step`, α=β=1) de **2 voies DRC** :
- **sublexicale** = n-gram agrégé (`_neoLetterNgramDist`, si `M_NEO_OS_ARB_NGRAM`) — généralise OOV. La voie peut être
  le **n-gram gap-aware** (`M_NEO_NGRAM_GAP`, plus proche voisin révélé d=1..4) ou le **C lourd** (`_neoHeavyCDist`, si
  `M_NEO_C_HEAVY` — *mesuré parité §1.12, hook OFF-inerte, non câblé*).
- **lexicale** = cohorte board pondérée fréquence.
La **fiabilité** (piqué de chaque distribution) bascule auto par régime : in-lex la cohorte gagne (~97 %), OOV le n-gram
gagne (~60 %). Cheat-free, sans `currentWord`.

---

## 6. Les TOGGLES — câblage (où lu → ce que fait → triche)

> ~45 flags whitelistés dans `ALLOWED_TOGGLES`. Clic UI : `ui_toggle` lit/écrit le `let` par **`eval(name + '=' + val)`**
> (le nom est whitelisté). Réinits spéciales au toggle : `M_VOIE_PHON`/`M_SUBSTRAT_ORTHO_PURE` → `initOmegaGlobals()`
> complet ; `M_OS_LEARNING_ONLINE` → `_omega_OSL_reset()` ; `M_NEO_PHON_COHORT` → recolore assemblé/muette 🟠↔🟢 ;
> `A2` → charge le lexique si absent. Détail preset + statut triche par toggle : `docs/CONFIG_TOGGLES.md`.

**Groupe L01 — voie ortho (montant + miroir), défaut OFF (préset ON sauf A1/A2/A3) :**
| Toggle | Lu où | Fait |
|---|---|---|
| `L01_A1_M2_ORTHO` | cStep ~6650 | cvPattern (voyelles/consonnes révélées) — socle, 🔴 béquille |
| `L01_A2_M4_LEX4` | M4_d ~4827 | filtre cohorte dico + fréquence dans le scoring-lettre — 🔴 |
| `L01_A3_M5M_WORDLEX4` | M5_m ~5335 | réinjecte le mot Lex4 au miroir (descendant) — 🔴 |
| `L01_A4_M4M_DECOMP` | M4_m ~5409 | signal-mot → pénalités lettre (morpho) |
| `L01_A5_M2M_POSITIONAL` | M2_m ~5591 | pénalise les positions C/V en erreur |
| `L01_A6_OS_CONCEPT_ARBITRAGE` | M3_m ~5513 | l'OS arbitre le decay des conceptCells |
| `L01_B2_MOBIUS` | M1_d ~4095 | bouclage M1_m→M1_d (1-tick, poids 0,05) |

**Groupe phon / OS :** `M_VOIE_PHON` (init voie phon), `M_OS_V07` (active l'override OS), `M4_PHON_USE_P` (prior phon
du cohort, 🟢), `M_SUBSTRAT_ORTHO_PURE` (letterVecs one-hot), `M_PHON_FEEDBACK` (miroir phon).
**Groupe bPC :** `M_BPC_M3D` (autoencodeur concept), `M_BPC_READOUT_COUPLE` (injecte `cLetterScore` ×0,20 dans M5_d),
`M_PHON_READOUT_COUPLE`, `M_PHON_CONCEPT_BIND`, `M_BPC_CROSSMODAL` (M3_d perçoit M1_d⊕M1_phon, défaut OFF).
**Groupe θ :** `M_OS_LEARNING` (maître) + 4 gardes (borné/audit/MDL/cohérence) ; `M_OS_LEARNING_ONLINE` (SPSA, OFF).
**Groupe declares :** WORD/BPC/DUAL/ÉMERGENT/NEO (cf. §5).
**Groupe NEO voies OOV :** `M_NEO_LETTER_NGRAM` (cascade), `M_NEO_OS_ARB_NGRAM` (voie sublex OS), `M_NEO_NGRAM_GAP` (C),
`M_NEO_C_HEAVY` (transformer, OFF-inerte non câblé).
**Modes / debug :** `M_TREXQUANT_MODE` (retire le mot du `len_index` → OOV jouable), `M3_D_BYPASS` (mute M3_d, diagnostic R66).

---

## 7. Les STRUCTURES DE DONNÉES

| Structure | Décl. ~ | Construit par | Lu par | Reset init ? | Triche |
|---|---|---|---|---|---|
| `OMEGA_LEX4` `{words[], len_index}` | 1948 | `loadOmegaLex4` (gzip async) | partout ; `len_index` = clé du respect Trexquant | non (chargé 1×) | 🟢 (`len_index`) |
| `_neoWBL` (cohorte par longueur) | 6183 | `_neoEnsureWBL` ← **`len_index`** | cohorte/assemblé/muette/OS-arb | invalidé si `len_index` change ; `_trexq_*` null | 🟢 (corrigé) |
| `_neoNG` `{uni,bl,br,tri,Ld,Rd}` | 6189 | `_neoEnsureNG`/`NGgap` ← `len_index` | `_neoLetterNgramDist` | idem | 🟢 |
| `_neoCR` / `_neoCRS` (jointes phon→lettre) | 6159 | appris **descendant** (post-partie) | muette / jointe son×ortho | `{}` à l'init | 🟢 |
| `_emrgBank` (banc recall VSA) | 6093 | `endCurrentGame` : `bind(currentWord, revealedMask)` | recall NEO/émergent | `new Map()` à l'init | 🟢 (révélé + post-partie) |
| `conceptCells[12][SDIM]` | ~2864 | M3_d_step (Hebbian) / M3_m (anti-Hebb) | M_S, readout | random ±0,1 à l'init | 🟢 |
| `bpcW[12][LDIM]` (+`bpcW_phon`) | ~2873 | M3_d_step (erreur de reconstruction) | encodage concept | init | 🟢 |
| `cLetterScore[26]` | ~2911 | M3_d_step readout (`Σ a·rwR`) | M5_d, BPC_DECLARE | init | 🟢 (appris du reward) |
| `phonGraphMap[26][SDIM]` | 2609 | init ← `letterVecsSDIM` ; appris F/E2 | M5_d co-décideur | init | 🟢 (=0 sous bPC) |
| `letterVecs[26][LDIM]` / `letterVecsSDIM[26][SDIM]` | ~2604 | init (one-hot si `SUBSTRAT_ORTHO_PURE`, sinon HRR) | M1_d, M4_d, phonGraphMap | init | 🟢 |
| `M_OS_v07` `{alpha,beta,r,mu,output}` | 1900 | `M_OS_v07_step` | arbitrage ortho⟷phon + declare | init 1/1 | 🟢 |
| `_neoHeavyC` (poids transformer C) | 6181 | injecté hors-ligne (evo/) | `_neoHeavyCDist` | **null** par défaut (OFF-inerte) | 🟢 |

Aucune n'est persistée (localStorage/IndexedDB) côté moteur ; tout est reconstruit à `initOmegaGlobals` (déterminisme).
Le profil élève **dictée** (panneau séparé) utilise localStorage, hors moteur.

---

## 8. Glossaire des fonctions pivots

| Fonction | Ligne ~ | Rôle | Appelée par |
|---|---|---|---|
| `omegaStep` | 7225 | un tour : montant → declares → jouer → miroirs → OS | boucle de jeu / harnais |
| `cStep` | 6645 | pipeline montant ortho M1→M5 | omegaStep |
| `penduEvaluate` | 7035 | joue la lettre, révèle, calcule result | omegaStep |
| `endCurrentGame` | 7128 | apprentissage descendant des declares (banc, g2p, jointes) | fin de partie |
| `omega_voiePhon_OS_tick` | 3970 | voie phon shadow + override OS | omegaStep (montant) |
| `M_OS_v07_step` | 3814 | mélange convexe ortho⟷phon `μ(r)=r^α/(β+r^α)` | voiePhon_OS_tick, `_neoDeclareOSmix` |
| `M_S_step` / `M_S_v07_step` | 5739 / 3444 | hub ortho legacy / hub phon (séparés) | cStep / voiePhon_OS_tick |
| `_neoDeclareOSmix` | 6362 | arbitrage OS du declare (sublex n-gram ⟷ lex cohorte) | cascade NEO |
| `_neoLetterNgramDist` | 6216 | distribution lettre n-gram (backoff, gap-aware) | OS-mix, argmax n-gram |
| `_neoHeavyCDist` | ~6256 | C lourd (transformer) — voie sublex (OFF-inerte) | OS-mix si `M_NEO_C_HEAVY` |
| `_neoEnsureWBL` / `_neoEnsureNG` | 6291 / 6190 | bâtissent cohorte / n-gram depuis `len_index` | cohorte / n-gram |
| `_emrg_bind` | 6096 | bind VSA du board révélé (recall) | recall NEO/émergent |
| `align` | ~6113 | aligne phon→graphème, masqué aux positions cachées | assemblé |
| `ui_toggle` | ~9053 | bascule un flag whitelisté (`eval`) + réinits | UI |
| `applyReferenceConfig` | ~9188 | preset cheat-free 1-clic (~20 toggles) | bouton UI |

---

*Pour les chiffres mesurés et les falsifications : `AUDIT_OMEGA.md`. Pour le statut triche/preset par toggle :
`docs/CONFIG_TOGGLES.md`. Pour la sécu/UI/hygiène : `AUDIT_STRUCTUREL.md`. Pour la cognition/littérature :
`docs/COGNITION_DESIGN.md`.*
