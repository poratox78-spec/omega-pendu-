# 🔎 AUDIT BASELINE — signalement « la base a peut-être bougé »

> **Statut : AUDIT FAIT (2026-06-20).** ① Winrate (§0) : **pas de régression** (banc frais). ② Structure statique (§7) :
> flux/toggles/archi **byte-identiques** 6f9fe61↔HEAD, **aucune dérive**. ③ **Désactivation dynamique (§8) :
> CONTAMINATION CONFIRMÉE en usage INTERACTIF** (reset dur voie/substrat · résidu d'apprentissage), **pré-existante**,
> **banc immunisé** → Rem avait raison. Correctif à décider (§8.5).
> Doctrine concernée : **R66** (« baseline byte-identique au repos », CLAUDE.md §1 · DICTEE_ROADMAP §24 · REPRISE_MOTEUR §69).

## 0. RÉSULTAT DE L'AUDIT (mesuré, A/B `6f9fe61` 83k vs HEAD 155k, **même harnais figé**)
**Conclusion : le changement de lexique (83k→155k) est WINRATE-INERTE ; le code moteur est BYTE-IDENTIQUE. Pas de régression.**

| Test (mesuré headless) | 83k (`6f9fe61`) | 155k (HEAD) | Lecture |
|---|---|---|---|
| **Code moteur** (diff JS hors lexique) | — | — | **0 ligne moteur changée** ; les 17 lignes qui diffèrent sont **toutes** du panneau correcteur/dictée (`vdc-`/`vdd-`, additif/évolutif), **jamais le hot-path pendu** → **R66 respecté** |
| **Bench in-lex** (5 graines, n=400, `O.pick`) | **10,00 %** · err/p 4,91 | **10,30 %** · err/p 4,91 | écart **dans le bruit** (par graine : +1,0/−0,8/+2,0/+0,8/−1,5) ; err/p **identique** |
| **Mêmes mots FIXES communs** (400, len 7-20) | **9,8 %** | **9,8 %** | **identique** → le devineur ne change pas sur des mots donnés |
| **Mots NOUVEAUX** (400, OOV-83k / in-lex-155k) | **12,5 %** | **12,5 %** | **identique** → savoir un mot « in-lex » vs « OOV » ne change PAS le winrate au config par défaut |
| **Composition lexique** | 83 605 mots | 155 493 (**83k ⊂ 155k**, +71 888) | **superset pur, rien supprimé** ; le 155k inclut des mots courts/fonctionnels que le 83k filtrait |

**Ce qui change réellement, et pourquoi tu as pu voir « des résultats différents »** :
- `_omega_pickWords(n,seed)` **échantillonne dans le lexique** → à graine égale, le 155k tire un **mix de mots différent**
  (composition + 71 888 nouveaux). Donc un `node evo/fitness_harness.js` brut **affiche un nombre légèrement différent**
  (10,0 → 10,3 %) parce qu'il **teste d'autres mots**, **pas** parce que le moteur a changé. C'est **cosmétique**.
- **Fenêtre cassée** : entre `d5a7efe` (ajout du bloc speller `text/plain`) et `3ff98c1` (« fix harnais evo »), le banc
  **plantait** (SyntaxError : il évaluait le bloc données comme du JS). Le `3ff98c1` ne fait que **réparer le banc**
  (exclusion des blocs données) — **n'altère pas l'eval du moteur**. Si tu as lancé le banc dans cette fenêtre tu avais
  un **crash**, pas un chiffre → autre source possible de « plus les mêmes résultats ».

**Réserve honnête** : tout ceci est mesuré au **config par défaut** (modules cognitifs au repos) et sur le **bench in-lex** +
un proxy OOV (« mots nouveaux »). Le **bench Trexquant OOV officiel** (bouton « 🎯 », 6 erreurs, dict externe) **n'a pas été
rejoué headless** ici — mais le code moteur étant byte-identique et le devineur inerte au lexique (12,5 %=12,5 % in-lex vs OOV),
une régression Trexquant est **peu probable**. À rejouer si tu veux fermer ce point à 100 %.

**Décision** : **ne rien « réparer »** — il n'y a rien à réparer. Le passage 155k (commit `9d3763c`, « base lexicale
COMPLÈTE ») est **intentionnel, non destructif (superset), winrate-inerte**. Garder le 155k.

---
<details><summary>Mémo d'origine (signalement + plan, conservé)</summary>


## 1. Le signalement (Rem, 2026-06-20)
> « on a un problème sur notre base à ne pas toucher, elle l'a été. Je n'ai **peut-être** plus les mêmes résultats —
> et je dis bien **peut-être**, alors n'invente pas. Depuis **décompose** et un **ajustement trexquant**. Va falloir
> un **audit structurel profond**. »

À retenir tel quel : (a) la base a **peut-être** été modifiée ; (b) les résultats sont **peut-être** différents
(**non mesuré**) ; (c) fenêtre suspecte = travail **décompose** + **ajustement trexquant** ; (d) **ne pas inventer**.

## 2. Faits VÉRIFIABLES (git — non interprétés)
- Le **bloc lexique du moteur** embarqué dans l'app — `<script type="text/plain" id="lex4-data-gz">`
  (`app/omega-pendu.html`, ~ligne 731, **une seule ligne ~5 Mo gzip+base64**) — a été **modifié 2 fois** dans la fenêtre :
  - **`9d3763c`** (2026-06-20 03:43) « moteur: base lexicale COMPLÈTE embarquée (**83 605 → 155 493 mots**) » — `app` : 1 ligne changée (= le bloc lexique).
  - **`3ff98c1`** (2026-06-20 10:57) « moteur: réintègre **mb** (base morpho) dans le lexique embarqué + **fix harnais evo** » — `app` : 1 ligne (le bloc), **+ `evo/fitness_harness.js` + `evo/measure_lex_bylen.js` + `dictee/morpho.json`**.
- **Mécanique de mesure** : `evo/fitness_harness.js` lit le lexique **depuis `lex4-data-gz`** (ligne 17) et **tire les mots de test ET la connaissance du devineur de ce même lexique** (`O.pick(n,seed)`, ligne 53). ⇒ **changer le lexique embarqué change mécaniquement le résultat du banc** (jeu de test + savoir du solveur). Ce n'est pas une spéculation, c'est la chaîne de dépendance.
- **Dernière baseline « propre » connue** (avant le 1er changement de lexique) : **`6f9fe61`** (parent de `9d3763c`).
- **Sonde trexquant** `dd3a4e4` (2026-06-20 12:36) « trexquant : la morpho/décompose n'aide pas l'OOV (FALSIFIÉ) » = **read-only** (sonde de falsification, `evo/trexq_morpho_probe.py`) — ne touche pas la base. L'« ajustement trexquant » évoqué pointe **plus probablement** vers le **« fix harnais evo » de `3ff98c1`** (le banc Trexquant tourne sur ce harnais).
- Chronologie : le passage 83k→155k (`9d3763c`, 03:43) précède de peu le 1er commit décompose (`0e03bf2`, 04:03) — **même session de travail**. La formulation « depuis décompose » est donc approximativement juste (même fenêtre).

## 3. Hypothèse n°1 — à VÉRIFIER, **pas** conclue
Le **changement du lexique embarqué** (83k→155k puis réintégration `mb`) est le **candidat le plus probable** au
changement de résultats : le banc lit ce lexique pour le test **et** pour le solveur. **Plausibilité mécanique : haute.
Mesure : AUCUNE faite ici.** Ne pas conclure avant l'A/B.

Sous-hypothèses possibles (non mesurées) :
- (a) le 155k est une **nouvelle baseline volontaire** (le message `9d3763c` dit « base lexicale COMPLÈTE » → intention apparente), mais **l'impact winrate n'a pas été A/B mesuré** à l'époque ;
- (b) le **harnais** lui-même (`3ff98c1` : exclusion des blocs `text/plain` speller, cf. SyntaxError corrigée) a **changé la sémantique de mesure** → comparer à **harnais constant** ;
- (c) la **logique moteur** (hot-path) a bougé indépendamment du lexique → à exclure par `git diff` (cf. §4).

## 4. Plan de l'AUDIT PROFOND (pour plus tard — ne pas exécuter à la légère)
1. **A/B winrate baseline** (le test cardinal) :
   - `git worktree` sur **`6f9fe61`** (baseline propre) vs **HEAD** ;
   - `node evo/fitness_harness.js <seed> <n>` avec **mêmes graines** et **même harnais** (⚠️ le harnais a changé en `3ff98c1` : pour un A/B honnête, fixer **un** harnais — p.ex. copier le `fitness_harness.js` courant dans les deux worktrees — sinon on mélange « changement lexique » et « changement harnais ») ;
   - comparer winrate **in-lex ET OOV séparés**, **≥4 graines** (protocole R66).
2. **R66 byte-identity du CODE moteur (hors donnée)** : `git diff 6f9fe61 HEAD -- app/omega-pendu.html` en **excluant la ligne `lex4-data-gz`** (et les blocs lexiques speller/gdet/vdc ajoutés) → confirmer que **seule la DONNÉE a changé, pas la logique**. Si du code moteur a bougé hors toggles OFF → violation R66 à traiter.
3. **Intentionnalité** : retrouver dans `JOURNAL`/`AUDIT_OMEGA.md` si le passage 155k a été **décidé comme baseline** (et non effet de bord). Le commit `3ff98c1` documente la réintégration `mb` — relire son entrée journal.
4. **Mesure harnais** : vérifier que l'exclusion des blocs `text/plain` (speller-lex etc.) dans `fitness_harness.js`/`measure_lex_bylen.js` ne **fausse pas** la sélection des mots ni le décodage du lexique moteur.

## 5. Garde-fous (pour celui qui fera l'audit)
- ⛔ **Ne PAS revenir au 83k « pour réparer » sans A/B** : le 155k est peut-être **meilleur**. Mesurer d'abord, décider ensuite.
- ⛔ **Ne pas toucher la base** (`lex4-data-gz`, hot-path moteur) pendant l'instruction ; travailler en **worktree** isolé.
- ✅ Tout passe par **fitness_harness** (in-lex/OOV séparés, ≥4 graines, barrière de mérite §6.4) + bouton **« 🎯 Trexquant »** de l'app.
- ✅ Conclure **par la mesure**, pas par l'intuition. Si rien ne régresse → fermer ce mémo en notant l'A/B.

## 6. Pointeurs
- Base : `app/omega-pendu.html` (bloc `lex4-data-gz` ~L731). Banc : `evo/fitness_harness.js`, `evo/measure_lex_bylen.js`.
- Audit moteur existant : `AUDIT_OMEGA.md` · reprise : `REPRISE_MOTEUR.md` · SOTA/baseline Trexquant ~18 % OOV : `docs/HANGMAN_SOTA.md`.
- Commits clés : `6f9fe61` (avant) · `9d3763c` (83k→155k) · `3ff98c1` (mb + harnais) · `dd3a4e4` (sonde trexquant, read-only).

</details>

---

# 7. AUDIT STRUCTUREL COMPLET — flux · tous les toggles · architecture (2026-06-20)

> Demandé par Rem (« pas convaincu [par l'A/B winrate], audit structurel complet : flux, all toggles, architecture »).
> **Méthode** : extraction du CODE réel (grep/diff sur `app/omega-pendu.html`), confronté à `docs/CONFIG_TOGGLES.md` +
> `docs/CODE_MAP.md`. A/B **structurel** `6f9fe61` (avant fenêtre) vs HEAD. **Verdict : structure intacte, aucune dérive.**

## 7.1 Intégrité structurelle 6f9fe61 ↔ HEAD (le test de dérive)
- **Code moteur** (tout le JS hors blocs données) : **byte-identique** sauf **17 lignes**, **toutes** du panneau
  correcteur/dictée (`vdc-`/`vdd-` : `toks`, `rEer`, `correctText`, `renderCorr`, `applyFix`, `CRULES`, `GENDER_MAP`…) —
  **0 ligne du moteur pendu** (ni `omegaStep`, ni `cStep`, ni les `declare`, ni un toggle).
- **Défauts de toggles** : **73 déclarations** `let/var/const … = true|false` extraites des deux commits → **`diff` VIDE**
  = **aucun défaut de toggle n'a changé**. (Test direct « un module s'est-il allumé tout seul ? » → **non**.)
- ⇒ Le **flux**, les **toggles** et l'**architecture** du moteur sont **identiques** avant/après la fenêtre décompose.
  Les seuls changements de la fenêtre : **donnée lexique** (83k→155k, superset), **panneaux dys additifs**, **extension** (dossier neuf).

## 7.2 Toggles — inventaire complet (46 UI + internes) et défauts au boot (R66)
- **46 toggles exposés UI** (`data-toggle=`), **~73 drapeaux/params** au total. **Quasi tous `= false` au boot.**
- **Défauts `= true`** (vérifiés code) et leur statut R66 :
  | Drapeau `true` au boot | Nature | Baseline byte-identique ? |
  |---|---|---|
  | `M4_PHON_USE_P_ENABLED` | croisement prior phon (champ p) | ✅ exception documentée (CONFIG_TOGGLES §3) |
  | `M_NEO_ASSEMBLED_ENABLED`, `M_NEO_RECALL_ENABLED` | sous-briques NEO | ✅ **inertes** : maître `M_DECLARE_NEO_ENABLED = false` → le bloc NEO ne s'exécute pas |
  | `M_S_ENABLED`, `M4_M_CONTEXTUAL/OS_MOD_ENABLED`, `M5_D_PHONGRAPH_ENABLED`, `M4_M_HOMEO_V2_ENABLED` | **cœur baseline** (const, fusion/M4_m/M5_d), pas des « modules » expérimentaux | ✅ c'est la baseline elle-même (commentaire code : « Défaut true = byte-identique ») |
- **Mécanisme R66 réel = gating par MAÎTRE**, pas « tous les sous-drapeaux à false ». Les chemins expérimentaux (declares,
  voie phon, OS v07, n-gram/gap/heavy-C) sont éteints par leurs **maîtres** (`M_DECLARE_NEO`, `M_DECLARE_DUAL`,
  `M_BPC_M3D`, `M_BPC_DECLARE`, `M_WORD_DECLARE`, `M_VOIE_PHON`, `M_OS_V07`, `M_TREXQUANT_MODE` = **tous OFF**).
- ⚠️ **Écart doc↔code constaté (mineur, non bloquant)** : `CONFIG_TOGGLES.md §3` écrit « tout OFF au boot **sauf
  M4_PHON_USE_P** ». En réalité `M_NEO_ASSEMBLED`/`M_NEO_RECALL` (+ consts cœur) sont `true` mais **inertes par gating**.
  La baseline reste byte-identique ; la phrase du doc est juste **imprécise**. → recommandation : préciser « OFF **ou
  inerte par maître OFF** ».

## 7.3 Flux de décision (vérifié dans `omegaStep`, L7225)
```
omegaStep()
 ├─ cStep(currentWord, revealedMask)        // pipeline ORTHO 5 modules M1_d→M2_d→M3_d→M4_d→M5_d (blueprint §6.6)
 ├─ détecteurs OS (saturation / novelty)
 └─ si gameActive :
     proposed = M5_d.output.letter           // décision cognitive (softmax top-K concept↔lettre + prior fréq)
        └ fallback pickLetterPhonGraph si M5_d non frais
     si M_VOIE_PHON ON :  voie PHON (shadow) ; si M_OS_V07 ON :  OS combine ortho+phon → override proposed
     _cogProposed = proposed                  // lettre cognitive FIGÉE avant tout declare (anti-béquille)
     ── CASCADE DECLARE (chaque bloc GATÉ par son maître, "le dernier qui parle gagne", _neoDone bloque la suite) ──
       Brique1  M_WORD_DECLARE   (OFF) → _omega_declareCandidate / BestCandidate
       Brique1c M_BPC_DECLARE    (OFF, requiert M_BPC_M3D) → _omega_declareBestCandidateBPC
       DUAL     M_DECLARE_DUAL   (OFF) → _DECL2.declare (board-buffer, jamais currentWord)
       ÉMERGENT M_EMERGENT_*     (OFF)
       NEO      M_DECLARE_NEO    (OFF) → recall → n-gram → OS-arb → assemblé → muette  (cascade interne, _neoDone)
```
**Au boot (tous maîtres OFF) : la cascade declare est entièrement éteinte → `proposed` = la lettre cognitive M5_d.**
C'est **la baseline**. Le code de `omegaStep`/`cStep`/des `declare` est **byte-identique** 6f9fe61↔HEAD (cf. §7.1).

## 7.4 Architecture (carte, cf. `docs/CODE_MAP.md`)
- **Double route DRC** : voie **ORTHO** (pipeline `M1_d…M5_d` via `cStep`) ∥ voie **PHON** (SAMPA, `M_VOIE_PHON`) —
  fusionnées par l'**OS v07** (`M_OS_V07`/`M_OS_v07_step`, forme w(r)=r^α/(β+r^α)).
- **Couche DECLARE** (niveau MOT) **par-dessus** la décision-lettre : cascade prioritaire DUAL→émergent→NEO, **additive**,
  **OFF-inerte** par défaut.
- **Lexique** `OMEGA_LEX4` (`words[]` + `len_index`) = **donnée** lue par la cognition lexicale et `_omega_pickWords`
  (cf. §0 : c'est CE bloc qui a grossi 83k→155k, winrate-inerte).
- **Apprentissage** `M_OS_LEARNING` (+ 4 gardes) ON-mais-batch ; `…_ONLINE` OFF (SPSA dégrade, mesuré).

## 7.5 Verdict structurel (statique)
**Aucune dérive structurelle.** Flux, 73 défauts de toggles, et architecture moteur **byte-identiques** 6f9fe61↔HEAD ;
R66 respecté (baseline = cognition pure, declares OFF-inertes par maître). Seuls changements de la fenêtre : **donnée
lexique** (superset, §0), **panneaux dys additifs** (17 lignes, hors moteur), **extension** (dossier neuf). **Rien à
réparer côté structure.** Unique action de suivi (cosmétique, non bloquante) : préciser la phrase « tout OFF au boot » de
`docs/CONFIG_TOGGLES.md §3` (cf. §7.2). **Réserve inchangée** : Trexquant OOV officiel non rejoué headless (§0).

---

# 8. ⚠️ CONTAMINATION D'ÉTAT À LA DÉSACTIVATION — CONFIRMÉE (test dynamique, 2026-06-20)

> Demandé par Rem (« vérifie aussi la **désactivation** des toggles, s'ils se désactivent bien — il y a une
> **contamination** quelque part, c'est sûr »). **Il avait raison.** Le défaut byte-identique au boot (§7) ne prouve PAS
> que **ON→OFF restaure la baseline**. Test dynamique → **deux contaminations réelles, en usage interactif.**

## 8.1 Protocole (déterministe, reproduit à l'identique)
Moteur chargé frais, on capture la **séquence exacte de lettres** jouée sur un set de mots fixe (hash djb2).
Trois états de référence mesurés :
- **cold** (frais, mesure immédiate) = `666f0f81`
- **warm** (frais → joue le set → mesure le set, **rien touché**) = `b1257f00`  ← *jouer SUFFIT à changer l'état : le moteur APPREND en cours de partie.*
- on compare chaque parcours « toggle ON → joue → toggle OFF → mesure » à **warm** (même historique de jeu).

## 8.2 Résultats mesurés (reproduits 2×, déterministes)
| Parcours | hash | vs attendu | Lecture |
|---|---|---|---|
| **flip ON→OFF sans jouer**, les **46 toggles** | tous `666f0f81` | = cold ✅ | le **mécanisme** de bascule est propre (rien construit/laissé si on ne joue pas) |
| `M_VOIE_PHON` seul (ON→joue→OFF) | `666f0f81` | = **cold** ❌ | **RESET DUR** : le toggle appelle `initOmegaGlobals()` (L9097) → **efface tout l'apprentissage de la session** |
| `M_SUBSTRAT_ORTHO_PURE` seul | `666f0f81` | = **cold** ❌ | idem (même branche `initOmegaGlobals`) |
| θ-apprentissage (`M_OS_V07+M_OS_LEARNING+gardes+ONLINE`) | `8d973926` | ≠ warm ❌ | **RÉSIDU** : jouer avec θ ON entraîne les apprenants persistants sur une autre trajectoire ; OFF ne les restaure pas |
| `M_DECLARE_NEO` seul | `286431bf` | ≠ warm ❌ | **RÉSIDU** : le declare NEO change le jeu pendant ON → les apprenants baseline (homéostasie M4_m, rwR…) gardent l'état altéré |

`leftON=[]` partout → les **drapeaux** reviennent bien à `false` ; c'est l'**ÉTAT APPRIS** qui ne revient pas.

## 8.3 Les deux mécanismes (cause racine, vérifiée code)
1. **RESET DUR** — `ui_toggle('M_VOIE_PHON'|'M_SUBSTRAT')` appelle **`initOmegaGlobals()`** (L9095-9101), **à l'activation
   ET à la désactivation**. C'est un **rebuild complet** → il **efface l'apprentissage accumulé** de la session (homéostasie,
   poids reward, θ…). Après avoir basculé ces 2 toggles, le moteur **« oublie » la partie en cours de session** → résultats
   différents pour la « même » config.
2. **RÉSIDU D'APPRENTISSAGE** — le moteur est **session-stateful** : il **apprend en jouant** (déjà visible : cold≠warm).
   Un toggle de *learning/declare* (θ, NEO, bPC readout, g2p online…) change les **coups joués** pendant qu'il est ON →
   les apprenants **toujours-ON** (M4_m homéostasie, rwR) finissent dans un autre état. Le remettre OFF **stoppe sa
   contribution directe mais n'annule pas** l'état déjà appris → la config nominale « tout OFF » ne rejoue PAS comme la baseline.

## 8.4 Portée — IMPORTANT (ce qui est touché, ce qui ne l'est pas)
- ✅ **Le banc `evo/fitness_harness.js` est IMMUNISÉ** : il fait `loadEngine()` **frais à chaque run** → état cold
  déterministe. **C'est pourquoi l'A/B winrate (§0) était propre** et reste valable.
- ❌ **L'usage INTERACTIF (l'app) est touché** : basculer des toggles puis jouer dans **la même session** ne revient pas à
  la baseline. **C'est très probablement la source du « je n'ai plus les mêmes résultats »** ressenti par Rem.
- 🕓 **PRÉ-EXISTANT, pas la fenêtre décompose** : ces deux mécanismes vivent dans du code moteur **byte-identique
  6f9fe61↔HEAD** (§7.1). La contamination **n'a pas été introduite** par le travail lexique/décompose — elle est
  ancienne ; elle a juste été **remarquée maintenant**.

## 8.5 Recommandations
- 🔒 **Mesure reproductible = RECHARGER la page entre deux configs** (jamais comparer en basculant dans une session). Le
  banc le fait déjà ; toute comparaison interactive doit suivre la même règle.
- 🛠️ **Correctif possible (à décider — NE PAS toucher la base sans accord)** : (a) bouton **« 🔄 Reset moteur »**
  (= `initOmegaGlobals()` à la demande, état propre garanti) ; (b) rendre la **désactivation symétrique** (teardown de
  l'état appris) pour les toggles de learning/declare ; (c) a minima **avertir dans l'UI** que changer un toggle après avoir
  joué nécessite un reset. **Choix de Rem requis.**
- 📌 Ce n'est **pas un bug de régression** (rien n'a empiré) mais une **propriété de reproductibilité** : OMEGA est
  **session-stateful** (il apprend en jouant) → « même config » ⇒ « mêmes résultats » **uniquement depuis un chargement frais**.

## 8.6 Verdict global (mémo)
- **Winrate** (§0) : pas de régression (banc frais).
- **Structure statique** (§7) : flux/toggles/archi byte-identiques, aucune dérive.
- **Désactivation dynamique** (§8) : **contamination CONFIRMÉE en interactif** (reset dur voie/substrat · résidu
  d'apprentissage), **pré-existante**, **banc immunisé**. → **Rem avait raison sur la contamination.** Reste à décider
  d'un correctif (8.5).
