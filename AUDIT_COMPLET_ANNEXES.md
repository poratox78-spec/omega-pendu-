# AUDIT COMPLET — ANNEXES (rapports détaillés par région) — 2026-06-20

> Preuves brutes des auditeurs parallèles, préservées durablement (les transcripts vivaient
> dans `/tmp`, éphémères). La **synthèse consolidée** est `AUDIT_COMPLET.md` ; ce fichier garde
> le détail ligne-à-ligne de chaque région. **omega-key est volontairement exclu** (hors focus
> du projet, cf. CLAUDE.md). Convention moteur : `ligne_originale = ligne_/tmp/eng1.js + 1439`.
>
> Régions : **A** moteur substrat/M1/M2 · **B** moteur M3/M4/M5/OS/phon/miroirs · **C** moteur
> declares/omegaStep/benches/UI · **D** panneaux app dictée/correcteur/décompose · **E** suite
> Python dictée · **F** harnais evo. Lecture seule — aucun fichier de production modifié.

---

# Annexe A — Moteur région 1 : `/tmp/eng1.js` 1–3050 (toggles, RNG, substrat HRR/HDC, voie phon M1–M3, M1_d/M2_d/M3_d, OS échafaudage)

**Résumé** : région globalement saine sur ses garde-fous mécaniques (OFF-inerte réel, asserts de finitude *fail-loud*, RNG seedable), mais grevée d'un bloc d'instrumentation A/B de ~230 lignes dans le hot-path `M3_d_step`, d'un échafaudage OS dialectique dont une branche est morte de fait, d'un M2_d intégralement court-circuité quand le bPC est ON (config de référence), et de plusieurs défauts ON jamais re-tranchés par mesure.

## BUGS
- **🟡 omegaRand (L946 → orig 2385)** — fallback `Math.random()` non-seedé subsiste. `if (_omegaRng) return _omegaRng(); return Math.random();`. En init normal `_omegaRng` est toujours posé (L1261, `_omegaSeed=12345`), donc le fallback ne se déclenche jamais en pratique ; mais le claim « tout `Math.random` non-seedé supprimé » reste inexact. Tout consommateur appelant `omegaRand` AVANT `initOmegaGlobals()` part en non-déterministe silencieux. Confirme **R2(a)** d'AUDIT_STRUCTUREL (situé L2366 → c'est L946 ici, +1439). Impact : hygiène/repro, baseline OK.
- **🟡 M3_d_step / chemin A/B (L2951, L2960 → orig 4390, 4399)** — init lazy de poids via `omegaRand()` hors `initOmegaGlobals`. Les matrices `_abWmel/_abWbind/_abWctx` sont allouées et remplies `(omegaRand()-0.5)*0.1` au **premier tick** où `M_PHON_READOUT_AB_ENABLED` est ON, pas à l'init. Le RNG est seedé donc reproductible *à activation constante*, mais la **consommation du flux RNG dépend du tick d'activation** → deux runs qui togglent AB à des moments différents divergent. Module OFF par défaut → baseline non touchée ; dette de repro si on mesure AB.
- **🟢 circularShiftInPlace (L1000 → orig 2439)** — try/finally correct. Le flag `_shiftBufInUse` est libéré en `finally` même si la boucle lève (Fix R40-#2 réel). Garde de réentrance + garde `out===vec` actives sous `DEBUG`. Vérifié sain.
- **🟢 Finitude fail-loud généralisée.** `buildPhonSubstratV07` (L1764), `M1_phon_step` (L1801), `M2_phon_step` (L1883), `M3_phon_step` (L1950), `M_S_v07_step` (L2009), `M_OS_v07_step` (L2373), init `letterVecs` (L1341) : chaque sortie throw `[FATAL]` sur NaN/Inf. `M2_d_step` (L2790) et `M3_d_step` (L3309) dégradent en `console.warn`+early-return au lieu de throw (intentionnel : un tick NaN ne tue pas la partie). Cohérent E2 de l'audit.
- **🟢 M_OS_v07_step (L2354 → orig 3793)** — formule μ bornée et testée. `r=sigPhon/((sigOrtho||0)+1e-9)`, `μ=r^α/(β+r^α+1e-12)` ; `M_OS_v07_selfTest` (L2382) prouve les 3 limites r→0/r→∞/r=1. Division protégée. Sain.

## CONFLITS
- **🟠 `_OSL` — forward-ref de ~5 600 lignes** (usage L2363 → orig 3802 ; déclaration `var _OSL` L7968 → orig 9407). `M_OS_v07_step` lit `_OSL.init`/`_OSL.muSum` etc. `var`-hoisting rend `_OSL` `undefined` (pas ReferenceError) jusqu'à L7968 ; le code est protégé par `if (M_OS_LEARNING_ONLINE_ENABLED && _OSL.init ...)` — mais `M_OS_LEARNING_ONLINE_ENABLED` est OFF par défaut, donc `_OSL.init` (accès propriété sur `undefined`) n'est jamais évalué AVANT la déclaration. Si quelqu'un active l'online ET que `M_OS_v07_step` tourne pendant l'init top-level (avant L7968), `_OSL.init` lève `TypeError`. **Confirme G3** (qui pointait L3781/L9436 ; vraies lignes orig 3802/9407, dérive ~+21). Fragilité d'ordre ; baseline OK (online OFF).
- **🟠 Défauts ON jamais re-tranchés — la « baseline » est un agrégat historique.** Sont ON à la déclaration : `M4_M_HOMEO_V2_ENABLED` (L95, `let`), `M4_M_CONTEXTUAL_ENABLED` (L106), `M4_M_OS_MOD_ENABLED` (L114), `OS_SLEEP_DECAY_ENABLED` (L122), `OS_GAP_RELATIVE_ENABLED` (L129), `M_S_ENABLED` (L150), `F75_DAMASIO_ENABLED` (L168), `M5_D_PHONGRAPH_ENABLED` (L207), `M4_PHON_USE_P_ENABLED` (L369). Plusieurs ont une doc interne admettant un effet **nul/non mesuré** (OS_sleep_decay « relax jamais déclenché F181 » L781 ; F75 « effet perf nul démontré » §1166). **Confirme D3**. Impact : pureté doctrinale §1.6, pas les chiffres.
- **🟡 doc↔code — CONFIG_REFERENCE compte « 39 toggles », le code en a plus.** Les 3 toggles « bleus » cheat-free (`M_NEO_PHON_COHORT_ENABLED` L4706, `M_NEO_PHON_COHORT_JOINTE` L4709, `M_NEO_OS_ARB` L4711) sont absents de l'énumération CONFIG (cités en prose §104). Doc périmée, pas un bug.
- **🟡 Incohérence de surface des `*_ENABLED_DEFAULT`.** Plusieurs toggles ont un doublet `const X_ENABLED_DEFAULT=false` + `let X_ENABLED=false` (L329/330, L343/344, L355/356, L441/442, L467/468, L480/481, L505/506, L515/516, L523/524, L534/535, L543/544). Le `_DEFAULT` n'est consommé que comme « référence documentation ». Duplication de constante = dette ; aucune divergence de valeur (tous concordent à `false`).
- **🟢 `M_BPC_DECLARE_CONF=0.95` (L404)** — désync U1 résolue (commentaire documente l'alignement sur l'UI « sweet 0,95 »). Vérifié.

## FLUX
**Chemin montant ortho (config réf., bPC ON)** : `cStep(currentWord, revealedMask)` (L5053) → `M1_d_step` (L2629, positions **révélées** uniquement, L2669) → `M2_d_step` (L2724, Mexican-hat, produit `M2_d.output`) → `M3_d_step` (L2839).
- **🟠 M2_d_step entièrement court-circuité quand bPC ON (L2848 → orig 4287).** Le chemin bPC fait `const m2src = M1_d.output ? M1_d.output : spatialVec` avec commentaire `// FIX: encoder depuis M1 (riche), pas M2 (lave)`. Consommateurs de `M2_d.output` : (a) `OS.step` dissonance L656 — **branche morte de fait** ; (b) chemin Hebbian original M3_d L2845 — **non emprunté** quand bPC ON ; (c) métriques UI L6920. **Conséquence** : sous config de référence, tout le Mexican-hat de `M2_d_step` (~75 l.) est recalculé chaque tick **sans nourrir aucune décision**. Étend **S2 d'AUDIT_OMEGA** : M2_d n'est pas seulement lessivé, il est **débranché** du scoring. Impact : perf (cycles brûlés) + pureté ; baseline-chiffre inchangée.
- **🟢 Cheat-free montant préservé dans tout le chemin bPC.** Le score `cLetterScore` (L2898) = `a[c]·rwR[l][c]` où `a[c]` vient de `m2src=M1_d.output` (perception révélée-aware) et `rwR` appris par **reward** (descendant, L2893). Aucune lecture du mot caché ne le nourrit. Les lectures du mot complet (`inW` L3079, `inHid` L3131, bind `melCode/bindCode` L2985-2987) sont **toutes** confinées dans `if (M_PHON_READOUT_AB_ENABLED && …)` (L2944, **OFF**), uniquement pour des **métriques AUC** (vérité-terrain jamais réinjectée). Le bind `M_PHON_CONCEPT_BIND` (L2913-2924, OFF) est revealed-aware (`if(revealedMask && !revealedMask[bp]) continue`). Confirme **C0**.

**Voie phon (shadow, `M_VOIE_PHON_ENABLED` OFF par défaut)** : `omega_voiePhon_OS_tick(m4dOutput, cw, rev, tried)` (L2510) → `M1_phon_step` (révélé-aware, L1789) → `M2_phon_step` → `M3_phon_step` → `M_S_v07_step` → `M4_phon_step` → `M5_phon_step` → si `M_OS_V07_ENABLED` : `M_OS_v07_step(M5_d.letterScores, M5_d.signal, M5_phon.output, sigPhon)`.
- **🟡 Couplage caché : la voie phon lit `M5_d.letterScores` et `M5_d.signal` (L2522-2523)** — propriétés non déclarées sur `M5_d` (L1076 ne déclare que `{temperature, output}`). Dépend de l'ordre `M5_d_step` avant `omega_voiePhon_OS_tick` ; fallback null-safe présent. Couplage implicite ; OFF par défaut.

**Échafaudage OS (`OS.step`, L641 → orig 2080)** :
- **🟡 Couplage caché + branche `relax` morte (confirme G2).** `OS.step` lit l'état mutable de 6+ modules par sondes `typeof X!=='undefined'` (M2_m/M3_m/M4_m L653/669/692, pairConv/M5_d L705/709) sans paramètre → dépend de l'ordre d'allocation global. La modulation `OS_mod` (L776-794) publie `tighten: slope>0.001 / relax: slope<-0.001` ; le commentaire L781 documente `slope range [0.000, 0.00411] — JAMAIS NÉGATIF en runtime` → **`relax` ne se déclenche jamais**. F203/F204 = 2 correctifs empilés sur un signal dont le seul consommateur effectif est `_getOSModFactor` (L2827) lu par M3_d Hebbian (L3247, non emprunté sous bPC) et M4_m.

## ARCHITECTURE
- **🟠 Bloc d'instrumentation A/B ~230 l. dans le hot-path `M3_d_step` (L2944–3173 → orig 4383–4612).** 7 « bras » (mél/lié/ctx/pos/lexical/bindCond/mix), AUC online, burn-in 1000 ticks, ~40 accumulateurs `M3_phon._abSum*`. Pure **mesure**, gardé `M_PHON_READOUT_AB_ENABLED` (OFF). Quand ON : surface énorme lue chaque tick, dont un bras `lookupLex4Word(currentWord)` (L2975) et `M4_phon_step` (L3069). **Confirme V3**. `M3_d_step` mélange 3 responsabilités (concept bPC ortho + readout phon + banc A/B) en ~490 lignes.
- **🟡 Projection SDIM `tile+mirror` = bijection sans gain d'info (L3206 → orig 4645).** `sdimVec[i]=spatialVec[((i*0x9E3779B1)|0)&(LDIM-1)]*0.7` ; commentaire R42-#9 reconnaît `gcd(433,512)=1` → permutation déterministe, « NE FOURNIT PAS d'information nouvelle ». Dette doctrinale (chemin Hebbian OFF en réf.).
- **🟡 Code mort / dormant alloué.** `M3_d.bpcW_phon` (init L1421-1426) alloué inconditionnellement mais utilisé seulement si `M_BPC_CROSSMODAL_ENABLED` (OFF, falsifié §1.4). `M3_d._mphat`/`_m2hat` (L1427-1428) idem. Constantes `REVEAL_LETTERS/GAMES_PER_CONDITION/RUNS_PER_CONDITION/N_PROTOCOLS` (L562-565) `[OUVERT R59]` jamais consommées. `_pubsubGet`/`attachOmegaSubscribers` (L907-933) inertes (`PUBSUB_ENABLED=false`).
- **🟡 Churn GC** : `M2_phon_step`/`M3_phon_step`/`M1_phon_step`/`M_S_v07_step`/`M_OS_v07_step` allouent un `new Float32Array` par tick (pas de buffer réutilisé). Hygiène perf quand voie phon ON.
- **🟢 RNG seedable propre (L935-949).** `makeMulberry32` (uint32 forcé, Stafford 2015) ; `_omegaRng` reset en tête de `initOmegaGlobals` (L1261) AVANT toute consommation. Déterminisme garanti.
- **🟢 `initOmegaGlobals` (L1256)** — ordre d'init cohérent, resets explicites (`_recentGames`/`OS._dissHistory`/`_emrgBank`/`_neoCR*` L1295-1297 ; `M4_d.output`/`M5_d.output` L1468-1469). Self-tests phon throw à l'init si voie ON. Bien construit.
- **🟡 Mismatch paramètre/global dans les self-tests** : les smokes appellent `cStep('TESTING', revealedMask)` (L6328/6346/…) mais `M3_d_step` lit la **globale** `currentWord` — en runtime normal les deux coïncident ; dans les smokes le concept peut travailler sur un `currentWord` ≠ `'TESTING'`. N'affecte que la pertinence des smokes.

**Bilan région** : 0 🔴, ~6 🟠, ~12 🟡, ~6 🟢. Aucun finding ne touche la baseline mesurée. Les findings G1/G2/G3/R2/S2/projection-bijective des audits existants **tiennent** dans le code courant (dérive +1439).

---

# Annexe B — Moteur région 2 : M3_d/M4_d/M5_d/OS/voie-phon/miroirs (`/tmp/eng1.js` 2839–6150 ≈ orig 4278–7589)

**Résumé** : région saine en exécution et disciplinée OFF-inerte, mais le flux montant réel est un *empilement additif/multiplicatif* de readouts dans M5_d (entorse §3.1, non une jointe), le concept M3_d n'atteint la décision que par `cLetterScore` (sortie-vecteur volontairement nulle, hub découplé), les readouts bPC/AB n'ont **aucune garde de finitude** ni de borne sur `rwR`, et toute la voie phon descendante M2/M1_phon_m reste morte — confirmant AUDIT_OMEGA §1.4/§3.1/S2.

## BUGS
- **🟠 `M3_d_step` (readout bPC, L2898 / cLetterScore L2897-2899) — sortie décisionnelle sans garde de finitude.** `cLetterScore[l] = Σ a_c·rwR[l][c]` est écrit puis **couplé à la décision** dans `M5_d_step` L3509 (`filtered[i].score += M_BPC_COUPLE_W * M3_d.cLetterScore[li]`). Aucun `Number.isFinite`/`throw [FATAL]` ne garde `cLetterScore`, `a[c]` (L2866), ni `rwR` (L2893). À comparer : `M_OS_v07_step` (L2373-2375), `M4_phon_step` (L2197), `M5_phon_step` (L2289-2291) **throw** sur non-fini. Doctrine « finitude : sorties gardées par throw si NaN/Inf » : **violée sur tout le chemin bPC/readout** (la sortie qui *atteint la décision-lettre*).
- **🟠 `M3_d_step` (bPC update, L2880-2881) — poids autoencodeur `bpcW`/`bpcW_phon` non bornés.** `w[i] += M_BPC_LR * ac * (m2[i] - m2hat[i])` : pur Hebbian/delta-rule, **aucune normalisation ni clamp**. `M_BPC_R_DECAY` (L2893) borne `rwR` mais **rien** ne borne `bpcW`. Sur longue session (commentaire L421 reconnaît la dérive « vers 2000+ parties »), `‖bpcW‖` peut dériver → `a[c]` explose → `cLetterScore` non borné. Confirme `AUDIT_OMEGA S2` côté bPC et **sans la rustine `normalizeInPlace`** qui existe sur le chemin Hebbian (L3316/5090-5100).
- **🟡 `M3_d_step` (Hebbian classique, L3256 + decay L3299)** — point fixe `|cell| ≈ α/α` géré seulement en aval. Norme non bornée à 1 ; corrigée hors fonction par `normalizeInPlace(currentPhonState)` (cStep L5100, commentaire R41-#11 L5091 documentant `|cell|≈8`). `M4_d_step` L3360 calcule `normC` à la volée → absorbe l'échelle (pas un bug fonctionnel, fragilité documentée).
- **🟡 `M5_d_step` (L3766)** — `maxScore = filtered[0].score` suppose `filtered` trié, mais le couplage readout bPC/phon (L3506-3518) et IG (L3478-3493) **ajoutent aux scores sans re-trier**. Si ON et changent le top1, la « stabilité par soustraction du max » est rompue (bénin : scores bornés, pas d'overflow).
- **🟢 `M4_phon_step` (L2106)** — lecture `currentWord.charAt(p)` correctement gardée (`if (revealedMask[p])`). Le seul accès « propriété du mot caché » est `w.p` (SAMPA), pas `currentWord` (régime « mot entendu »). Cheat-free montant strict.

## CONFLITS (doctrine / docs)
- **🟠 §3 jointe — `M5_d_step` empile des enrichissements ADDITIFS et MULTIPLICATIFS, pas une marginalisation.** Pile séquentielle : IG additif (L3486-3488), readout bPC additif (L3509), readout phon additif (L3516), phonGraph additif (L3651), M_S additif (L3676), position-aware additif (L3717), **puis M1_m multiplicatif** (L3745 : `score *= (1 - W + ls·W)`). C'est le « pattern §3.1 déconseillé ». La *vraie* jointe n'existe que (a) dans l'OS `M_OS_v07_step` (mélange convexe, L2367) et (b) dans le declare NEO (`_neoDeclareOSmix` L4812 / jointe `_neoCRS` L5818). **Entorse §3 assumée au niveau lettre** (cohérent `AUDIT_OMEGA S1`).
- **🟠 `M_OS_v07_step` (L2367) — mélange CONVEXE (arbitrage de routes), PAS une marginalisation §3.** `out[l] = (1-μ)·so + μ·sp`, `μ=r^α/(β+r^α)`, `r=signalPhon/signalOrtho` (L2358-2367). **Arbitrage de fiabilité relative** (legit DRC, race model). À ne pas confondre avec « croiser = jointe ». Pas un bug ; conflit de vocabulaire à cadrer (l'OS *arbitre*, il ne *marginalise* pas).
- **🟡 `M5_D_M1_M_WEIGHT` (L189=0.1) vs `M5_D_M1_M_ENABLED` (L195=false)** — co-décideur M1_m gardé ET neutralisé par défaut. `AUDIT_OMEGA §1.4/D2` (« M1_m co-décidant à 0,1 sans toggle ») **corrigé dans le code** : les 2 blocs de co-décision (L3592, L3736) sont gardés `if (M5_D_M1_M_ENABLED …)`, défaut `false` (L195). **MAIS** l'assert smoke (L5998 : `M5_D_M1_M_WEIGHT === 0.1`) verrouille le *poids* à 0,1 — incohérence cosmétique. **Le finding D2 ne tient plus** ; doc à mettre à jour.
- **🟡 `M3_d_step` (L3179)** — `M3_d.output` mis à 0 sous bPC : hub M_S découplé. `for (…) M3_d.output[i] = 0` sous bPC → la source 1 de `M_S_step` (L4303-4307) fusionne un vecteur nul, raison pour laquelle M5_d/M4_phon skippent le biais M_S quand bPC ON (L3579/3664). Conforme `AUDIT §3` (C). Le récit « le concept nourrit le hub » ne vaut **que bPC OFF** (jamais en config réf.).
- **🟢 Dérive de lignes doc↔code — réelle mais sans contradiction.** M3_d_step orig 4278 = /tmp 2839 ✓, M_OS_v07 orig 3793 = /tmp 2354 ✓. Findings S1/S2/S3/§1.4/§3.1 **tiennent**.

## FLUX (qui écrit quoi, qui le lit, quel étage atteint la décision)
**Montant ortho (décision-lettre)** — `cStep` L5053 : `M1_d_step`(L2629, écrit D1) → `M2_d_step`(L2724, D2, lessivé en longueur) → `M3_d_step`(L2839 ; bPC ON : `M3_d.output=0`, écrit `cLetterScore`) → `M_S_step`(L4279 ; **skippé en lecture** par M5_d sous bPC) → `M4_d_step`(L3339, cosine concept + freq → top-K D4 ; sous bPC `wCos=M4_D_W_COSINE_BPC`) → `M5_d_step`(L3459, softmax). **Étage qui atteint réellement la lettre** : M4_d (cosine+freq) + `cLetterScore` (couplage 0,20, L3509).

**Override declare** (`omegaStep` L5722-5852, *après* M5_d, *avant* `penduEvaluate` L5860) : cascade priorité-fixe WORD→BPC→DUAL→ÉMERGENT→ASSEMBLED→NEO. C'est **là** le saut +7 pts (AUDIT S1). `_cogProposed` figé L5721.

**Descendant ortho** (`omegaStep` L5870-5874, socle sans toggle) : `M5_m_step`(L3848, reward) → `M4_m_step`(L3897, `letterPenalty` homéostasé vers `letterTarget`=fréquence) → `M3_m_step`(L4031, anti-Hebb sur `conceptCells`, écrit le hub L4063) → `M2_m_step`(L4109, `zonePenalty`) → `M1_m_step`(L4175, `letterScore`). **Consommateurs réels** : `M4_m.letterPenalty` lu par `M1_m` (L4181) ; `M1_m.letterScore` lu par M5_d **uniquement si `M5_D_M1_M_ENABLED`** (OFF) ; `M2_m.zonePenalty`→`M2_m.output` lu **seulement par OS_diss** (L651-656), pas par le scoring ; `M3_m.output` lu par M_S (L4311, poids 0,5). **Aucun étage descendant n'atteint la décision-lettre en config défaut.**

**Voie phon** (`omega_voiePhon_OS_tick` L2510, gardée `M_VOIE_PHON_ENABLED`) : montante `M1_phon→…→M5_phon`, arbitrée par `M_OS_v07_step` (L2528). Descendante phon (L5877-5883) : `M5_phon_m→M4_phon_m`(effectif, lu en M4_phon_step L2183-2188) → `M3_phon_m`(observationnel, L2447, n'écrit pas le hub, commentaire L2460) → **`M2_phon_m`(L2472) / `M1_phon_m`(L2495) : écrits, JAMAIS lus**. Confirme `AUDIT_STRUCTUREL V2`. Le readout phon `M3_phon.cLetterScore` (L2937) n'atteint la décision que via `M_PHON_READOUT_COUPLE_ENABLED` (OFF).

**État mort / buffers écrits-jamais-lus** : tout le bloc **AB readout** M3_d_step L2944-3173 (`_csMel/_csBind/_csPos/_csCtx`, `discMel/…`, `_abPerGame`, `_mixW`, `rwR_mel/bind/pos/ctx/bindCond`, AUC) — pure instrumentation, ~230 lignes vivantes-en-exécution inertes-en-effet, exécutées à **chaque tick** dès `M_PHON_READOUT_AB_ENABLED` ON (coût perf : 3 bPC propres + 5 readouts POS + régression dense L3061). `M2_phon_m.zonePenalty`/`M1_phon_m.letterScore` dormants. `decodeLetterAtPosition` (L4226) lu seulement si `M5_D_POSITION_AWARE_ENABLED` (OFF). `pairConv` (cStep L5103-5131) « transitoire, retiré Jour 6' » jamais retiré.

## ARCHITECTURE
- **🟠 Le concept M3_d est un *latent de forme/longueur* (S2 confirmé) ; sa seule porte vers la décision est `rwR` readout.** M2_d lessivé (L2848 « encoder depuis M1, pas M2 »), goulot 12 cellules, reconstruction lossy. `M3_d.output→hub` coupé sous bPC (L3179). Seul `cLetterScore` (matrice 26×12, `reward·a`) extrait un signal lettre (AUDIT §3.1 : +0,128, +3,4 winrate cheat-free). La « cascade descendante » M5_m→…→M1_m est un **ordre d'appel, pas un flux de données** (§1.4.1 prouvé : M1_m ne lit ni M3_m ni M2_m, seulement M4_m+M5_m).
- **🟠 Surcharge combinatoire / tissu cicatriciel.** M5_d_step empile **7 sources** d'enrichissement gardées chacune par un toggle + re-tris conditionnels. M3_d_step contient **deux moteurs** (Hebbian classique L3186-3324 *et* bPC L2847-3183) plus le bloc AB (~230 l). Espace de config = 47+ flags. **Risque #1** : aucun test ne garde le comportement montant.
- **🟡 `_neoDeclareOSmix` (L4777-4818)** — bon exemple de découplage : réutilise `M_OS_v07_step` mais **save/restore** `(α,β)` propres au declare (L4810-4814) pour éviter le « conflit de sens » (θ de lecture appliqué à un declare). Architecture saine, OFF-inerte (`M_NEO_OS_ARB` défaut false).
- **🟡 `M_S_step` (L4279)** — hub amodal réel mais dual/sleep ajoute de la complexité non gardée. Sous bPC, source 1 = vecteur nul → `M_S.output` dérive (M5_d/M4_phon skippent le biais M_S). Hub **architecturalement central mais décisionnellement marginal** en config réf.

**Confrontation finale** : AUDIT_OMEGA §1.4/§3.1/§3.2/S1/S2/S3/S5 **tiennent intégralement**. AUDIT_STRUCTUREL D1 **confirmé** (M2/M1_phon_m construits+appelés sans consommateur) ; **D2 obsolète** (M1_m gardé par `M5_D_M1_M_ENABLED=false`) ; V2 (miroirs phon morts) **confirmé**.

---

# Annexe C — Moteur région 3 : cascade declares + apprentissage descendant + benches + dictée + toggles (`/tmp/eng1.js` 4519–8489)

**Résumé** : la frontière cheat-free du montant est correcte (`_cogProposed` figé avant declares ; révélé-seul), mais la cascade reste un « dernier confiant écrase » non hiérarchisé ; **3 risques R66/R67 réels** (bench trexquant : restore hors-`finally`, `M_LEARN_FROM_COGNITION` non sauvegardé, restore len_index pendant le jeu UI) ; l'`innerHTML` dictée injecte `w.p`/`w.m` (données lexique, non saisie utilisateur → 🟢). Les findings AUDIT_OMEGA/AUDIT_STRUCTUREL **tiennent tous**, dérive de lignes systématique.

## FLUX DE DÉCISION (bout en bout, ancré)
1. **Perception** `omegaStep:5668` → `cStep(currentWord, revealedMask)` : pipeline M1_d→M5_d (montant ne voit que le révélé + fréquence lexicale **si A1/A2/A3 ON**, OFF par défaut).
2. **Cognition** `:5700-5712` : `proposed = M5_d.output.letter` si frais, sinon fallback `pickLetterPhonGraph`. Voie phon OS override `:5717-5720`.
3. **Gel cheat-free** `:5721` `const _cogProposed = proposed;` — **figé AVANT tout declare**. ✅
4. **Cascade declares** `:5725-5852` (7 blocs `if`, chacun écrase `proposed`) : WORD_DECLARE → BPC_DECLARE → DUAL `_DECL2.declare` → ÉMERGENT recall → ÉMERGENT assemblé → NEO (recall / OS-arb / assemblé+muette).
5. **Évaluation** `:5860` `penduEvaluate(proposed)` (mute `alreadyTried`/`revealedMask`/`currentLetter`).
6. **Miroir PHASE 2** `:5870-5883` APRÈS evaluate. Reward = `_mResult` = justesse **cognitive** (`_cogHit`) si override, sinon résultat joué.
7. **Apprentissage descendant** `endCurrentGame:5536-5552` post-partie : banc `_emrgBank`, g2p `learn`/`learnExp`, table muette `_neoCR`/sonore `_neoCRS` via `wp.get(currentWord)` (mot complet légitime post-partie).

## BUGS
- **🟠 B1 — `_omega_trexquant_bench` ne sauvegarde/restaure PAS `M_LEARN_FROM_COGNITION_ENABLED` ni les params NEO-JOINTE/OS-ARB.** Snapshot `S` (`:7835-7841`) et `restore()`(`:7842-7851`) couvrent ~30 toggles mais omettent `M_LEARN_FROM_COGNITION_ENABLED`, `M_NEO_PHON_COHORT_JOINTE`, `M_NEO_OS_ARB`, `M_NEO_G2P_EXP_*`, `M_DECLARE_DUAL_ENABLED`+confs, `M_NEO_MUTE_CONF`. `M_LEARN_FROM_COGNITION_ENABLED` est lu dans `omegaStep:5857` pendant `play()` mais jamais figé → si ON, le bench mesure un comportement différent de la baseline annoncée. Mesure trexquant non reproductible selon l'état UI antérieur (résidu **R1**).
- **🟠 B2 — restore du bench trexquant hors `finally` (R1 confirmé).** `:7853-7883` : `restore()` appelé à la fin du `try` (`:7876`) **et** dans le `catch` (`:7883`), **pas de `finally`**. Risque résiduel = pattern fragile (recommandation #4 toujours ouverte).
- **🟠 B3 — `_trexq_restore`/`_trexq_removeWord` : catch muet sur mutation du lexique (E1).** `:7820`/`:7827` : `console.error` mais **pas de `ui_log('ERROR')`**. Si `splice` échoue, `len_index` reste amputé sans alerte → cohorte/recall aveugles silencieusement. `ui_startGame:7573` appelle `_trexq_restore()` à chaque démarrage : un échec laisse le lexique corrompu **de façon persistante** (et `_trexqRemoved=null` ligne 7821 exécuté **même en cas d'échec** → mot retiré perdu). Module OFF par défaut → hygiène tant que `M_TREXQUANT_MODE` OFF.
- **🟡 B4 — `_trexqRemoved=null` inconditionnel dans `_trexq_restore` (`:7821`).** Si le splice de restauration (`:7820`) lance avant réinsertion, le catch avale, puis `:7821` efface la trace → mot jamais réinséré et perdu. Devrait n'effacer qu'après réinsertion réussie.
- **🟡 B5 — `omega_subDecode:7108` argmax pur (`if (v > bv)`)** — viole §3 jointe (argmax, pas marginalisation). Module OFF/diagnostic → hygiène doctrinale.

## CONFLITS
- **🟠 C1 — Cascade « le dernier confiant écrase » sans arbitrage inter-voies (A1 confirmé).** `omegaStep:5725-5852` : 7 `if` séquentiels, ordre **implicite** = ordre textuel WORD(5725) < BPC(5739) < DUAL(5751) < ÉMERGENT-recall(5762) < ÉMERGENT-assemblé(5773) < NEO(5786). Dans NEO, sous-cascade `_neoDone` (recall:5789 → OS-arb:5798 → assemblé:5808 → muette:5829). Entre blocs top-level, **aucun garde**. Mesuré « optimum » (`AUDIT_OMEGA §1.6` clos) mais ordre non-explicite (hygiène).
- **🟠 C2 — NEO assemblé/muette/cohorte lisent `currentWord` au montant (C1 d'AUDIT_STRUCTUREL).** `:5806` `const _ph = _G.wp.get(currentWord)` (son du mot = « mot entendu ») quand `M_NEO_PHON_COHORT_ENABLED=false` ; `:5805` bascule sur `_neoPhonCohort()` (board-dérivé, cheat-free) quand cohorte ON. La couleur orange/vert (`ui_syncAssembledColor:7449`) encode honnêtement la frontière. Autres lectures de `currentWord` (`:5732,5742,5756,…`) toutes gardées par `revealedMask[p]` ou utilisées comme **longueur** (C2, 🟡).
- **🟡 C3 — `_neoDeclareOSmix` force α=β=1 par mutation globale temporaire de `M_OS_v07`.** `:4810-4814` : sauvegarde `(_o,_r,_m,_a,_b)`, écrit `M_OS_v07.alpha=M_NEO_OS_ARB_ALPHA`, appelle `M_OS_v07_step`, **restaure**. Découplage du θ correct et documenté. Risque : si `M_OS_v07_step` jette entre `:4811` et `:4814`, l'état OS reste pollué (pas de `try/finally`). Module OFF. La jointe `_neoCRS` `:4787-4792` est une **vraie marginalisation** `Σ_φ Pcoh(φ)·CR[...]/Σ` (pas argmax/produit). Conforme §3.
- **🟡 C4 — désync defaults vs CONFIG_REFERENCE : aucune désync réelle.** `applyReferenceConfig:7594-7598` active 23 toggles, cohérent avec `CONFIG_REFERENCE.md`. `M_BPC_DECLARE_CONF=0.95` aligné (corrige l'ancien §U1). **U1 résolu.**

## ARCHITECTURE / SÉCURITÉ / R66
- **🟢 SEC1 — Pas de XSS dans cette région.** Tous les `innerHTML` 6000–8489 (`:6816,6826,6841,…,8445`) interpolent des **données moteur/lexique** (`w.p`, `w.m`, scores, logs `ui_log`), **jamais la saisie élève** (le §S1 d'AUDIT_STRUCTUREL concerne le panneau dictée, ailleurs). `ui_startGame:7533` lit `input.value` mais ne le ré-injecte pas en HTML (validé A-Z `:5501-5505`).
- **🟡 G1 — `eval(name+' = '+newValue)` pour les toggles (confirmé, non exploitable).** `ui_toggle:7468,7472`, `ui_initToggles:7436`, `applyReferenceConfig:7599`. `name` gardé par `ALLOWED_TOGGLES.indexOf(name)===-1` AVANT tout `eval`, `newValue` = boolean calculé. Anti-pattern sûr (recommandation #9 Map ouverte).
- **🟢 V5 — `ALLOWED_TOGGLES` est UNE seule constante (`:7406`), pas dupliquée.** Le doublon §V5 visait la **boucle de jeu ×5** (`play:7861`, `_omega_runCondition:7915-7932`, `omega_warmupTest`), qui **subsiste** (dette réelle hors-baseline).
- **🟢 R66-2 — `M_DICTEE_LEXICAL` = oracle bien isolé.** `omega_dicteeLexical:7039` = lookup pur `_dicteeIdx.get(phon)`, gardé par `M_DICTEE_LEXICAL_ENABLED=false`, aucun appel depuis `omegaStep`/cascade → n'altère jamais la baseline.
- **🟢 R66-3 — `_neoDbg` inerte.** Tous les usages (`:5795,5800,5827,5848`) gardés `if (typeof _neoDbg !== 'undefined')` ; `_neoDbg` non défini → compteurs morts = baseline byte-identique.
- **🟡 R66-4 — `_omega_runCondition` mute `M_VOIE_PHON_ENABLED`/`M_OS_V07_ENABLED`/`_omega_forceOrthoOnly` (`:7901-7903`) sans restore** → le caller doit restaurer ; risque R67 modéré (dépend du caller).

## VÉRIFICATION DES CLAIMS DOC (dérive de lignes)
Les n° AUDIT_STRUCTUREL (8914, 9294, 9314…) valent eng1.js +~1440 ; les n° AUDIT_OMEGA (7210) valent eng1.js +~1400. Aucun finding doc n'est devenu faux ; tous restent localisables : §1 currentWord NEO (`omegaStep:5806`), §1.4 cascade plate, §1.5 DUAL produit niveau-mot (`_DECL2.declare:4895-4916`), §1.6 cascade « dernier confiant », §C0/C1/C2, §E1 (`:7820,7827`), §R1 (`:7853-7883` pas de finally), §G1 (`:7468,7472`), §V5 résolu (1 const). §S1 XSS = hors-script-1.

**Priorités** (toutes hors-baseline, modules OFF par défaut) : B1/B2 (R67 bench → restore en `finally` + figer `M_LEARN_FROM_COGNITION`), B3/B4 (`_trexq_restore` : `ui_log('ERROR')` + ne nuller `_trexqRemoved` qu'après réinsertion), C1 (ordre de cascade explicite).

---

# Annexe D — Panneaux additifs app : dictée+correcteur (`/tmp/eng2.js`) / décompose (`/tmp/eng3.js`)

**Résumé** : architecture OFF-inerte globalement saine (IIFE, localStorage namespacé `vdd_*`/`vdc_*`/`vdk_*`, sans collision) ; une **redéfinition de `esc()`** qui dégrade l'échappement du panneau dictée, des **try/catch muets sur `speechSynthesis`**, **2 divergences de parité JS↔Python** + **1 divergence structurelle assumée** (eng3 lit les globals moteur, contrairement à eng2). Parité du levier grammaire : conforme. Le panneau Décompose confirme l'écart documenté avec `decompose.py`. *(ligne N de eng2.js = orig 9932+N ; eng3.js = orig 11418+N)*

## BUGS
- **🟠 `esc` redéfini (eng2.js:1413) — la 2ᵉ définition écrase la 1ʳᵉ pour TOUT le fichier.** L1341 : `esc` échappe `& < > " '` (5 car., correct). L1413 (bloc correcteur) : `function esc(s)` redéclaré n'échappe que `& < > "` — **l'apostrophe `'` n'est plus échappée**. Par hoisting, la 2ᵉ écrase la 1ʳᵉ dans tout le scope IIFE, y compris le panneau **dictée** (L1342-1403). Comme les conteneurs sont du contenu HTML (pas des attributs), `'` non échappé n'ouvre pas de vecteur d'évasion direct → **pas de XSS exploitable**, mais **régression silencieuse de robustesse** + duplication.
- **🟠 `say` (eng2.js:1394) — `try/catch` muet sans feature-detection de `speechSynthesis`.** `try{speechSynthesis.cancel();...speechSynthesis.speak(u);}catch(e){}` : sur un navigateur sans Web Speech API (ou voix `fr-FR` absente), le bouton « 🔊 Dicter » échoue en silence total. Aucun `if('speechSynthesis' in window)` ni fallback. Impact accessibilité élevé.
- **🟡 `pick`/`say` (eng2.js:1394-1395)** — `Math.random()` ×2 (choix famille focus + choix phrase). Hors-fitness, acceptable, **à noter** (déterminisme requis seulement pour les bancs).
- **🟡 `governorNumber`/`isVerb` (eng2.js:1321,1324) — `qu'il` un seul token.** `toks()` (`/[A-Za-zÀ-ÿ']+/g`) capture l'apostrophe ⇒ `qu'il`, `l'eau`, `d'eau` un seul token. `findCodAntepose` (1332) teste `w.slice(0,3)==="qu'"` — OK ; mais `governorNumber`/`governorGender` ne voient jamais le déterminant fusionné dans une élision. **Identique côté Python** (parité préservée) — limite partagée, pas un bug de portage.
- **🟡 `rOn`/`rule_on_ont`** — `isParticiple(T,i+1)` peut lire hors-borne, **géré** (`isParticiple` garde `idx>=0 && idx<T.length`). Aucun accès tableau hors-borne non gardé trouvé.

## CONFLITS (parité JS↔Python — livrable clé)
**Conformes (logique identique, vérifiée constante par constante)** : `norm` (1282↔py98), `deacc`, `toks`, `subseq`, `isAccord`/`is_accord`, `accordType`/`accord_type`, `align` (Levenshtein, même back-trace/tie-break), `governorNumber`/`governor_number` (skipPP idem), `isVerb`/`is_verb` (VERB_FORMS, VERB_SUF, NOTVERB identiques), `isParticiple`+`PART_FORMS`, `findAux`/`find_aux` (même portée), `governorGender`/`governor_gender` (GEN_DET identique), `findCodAntepose`, `stageOfFact`/`stage_of_fact` (STAGE_FAM↔FAM2STAGE), les listes `NUM_DET`/`NUM_PRON`/`PREP`/`AUX_ETRE`/`AUX_AVOIR`. **Levier grammaire porté fidèlement.**

**Divergences :**
- **🟠 CONFLIT — `lexicalGender` : couverture différente (eng2.js:1425 vs py:70).** La version JS de `lexicalGender` lit `GENDER_MAP` (issu de `#vdc-lex`, **sous-ensemble HF embarqué**), **pas** `GENDER_LEX`/cgram_gender.json complet (53 050 noms) du Python. La route lexicale du genre JS opère donc sur un sous-ensemble ⇒ le diagnostic d'accord en genre **divergera** sur tout nom hors-HF. Documenté implicitement mais **non signalé comme écart de parité** ; impact : le panneau app décide moins d'accords-genre que `diag_sentence.py`. (Ordre des branches gauche/droite aussi légèrement différent.)
- **🟡 CONFLIT mineur — `rA`/`rEt` : liste de sujets sans `'ça'` (eng2.js:1438-1439 vs py:132,141).** Python inclut `'ça'` ; JS non. **Sans effet réel** : `cprev`/`prev` renvoient la forme désaccentuée, `ça`→`ca` présent dans les deux listes. À noter pour cohérence du source.
- **🟡 CONFLIT assumé — `rule_genre_adj` (py:186) absente du JS.** Le Python la définit mais **ne la branche pas** dans `RULES` (« FP-insûr »). Le JS `CRULES` ne porte pas ces règles → même comportement effectif (8 règles : é/er, son/sont, on/ont, leur/leurs, a/à, et/est, peu, ce/se). Parité par omission cohérente.
- **🟢 `developmental` / `accordType`** — résultats identiques (vérifiés).

## FLUX
- **🟢 Étanchéité IIFE — eng2.js : CONFORME.** Aucune référence à `currentWord`/`OMEGA_LEX4`/`omegaStep`/`M3_d` (seul `M3_d` dans un **commentaire** ligne 2). Effets de bord = DOM + `localStorage` strictement `vdd_*`/`vdc_*`/`vdk_*`. R67 respecté.
- **🟠 Étanchéité IIFE — eng3.js : ÉCART STRUCTUREL assumé.** Contrairement à eng2, `eng3.js` **lit deux globals du moteur** : `_DECL2.g2p()` (route sublexicale, ligne 8/16) et `OMEGA_LEX4.words` (route lexicale, ligne 29). **Lecture seule**, feature-detecté (`if(typeof _DECL2==='undefined'...)return;` ligne 8 ⇒ inerte sans moteur), n'altère jamais l'état moteur. **Conforme R66/R67 dans l'esprit** mais la consigne « ne référencer aucun global moteur » est **techniquement violée par eng3** (par design documenté).
- **🟢 localStorage : pas de collision.** eng2 = `vdd_profile`/`vdd_rate`/`vdd_hist`/`vdd_lisible` (le correcteur n'écrit RIEN en storage — `vdc-lis` non persisté) ; eng3 = `vdk_lex`. Aucune clé partagée. 🟡 incohérence UX mineure : `vdc-lis` non persisté contrairement à `vdd-lisible`.
- **Flux dictée** : `pick()`→`say()` (TTS) → saisie `vdd-ans` → `check()` → `diagnoseSentence()` → rendu + maj `PROF`/`HIST` + `developmental()`. `answered` empêche le double-scoring. `focusFam()` (rejeu ciblé, proba 0.65).
- **Flux correcteur** : `input` (debounce 350 ms) → `correctText()` (8 règles, **première qui matche gagne** via `break`, idem Python `break` L213) → `renderCorr()` → clic `.vdc-bad` → `applyFix()`. Index alignés (regex identique, `_flags` régénéré à chaque `runCorr`).

## ARCHITECTURE / doublons
- **🟢 eng3 « zéro adjacence » : VÉRIFIÉ.** `<script>`/IIFE séparé (en-tête ligne 1 revendique « SCRIPT SÉPARÉ »). Redéfinit son propre `esc`/`$` localement, namespace `vdk-*`. Isolation correcte.
- **🟠 Duplication `esc`/`$` à travers les 3 panneaux.** `esc` 3× (eng2:1341, eng2:1413, eng3:12), `$` 2× (eng2:1391, eng3:13). Les deux `esc` d'eng2 dans le même scope = le bug 🟠 ci-dessus.
- **🟢 Panneau Décompose vs `decompose.py` : écart documenté CONFIRMÉ.** `eng3.decompose()` (15-25) : `_DECL2.g2p()` brut → overlay accents → `ipa2sampa` → syllabation **par règle simple** (`sylls()`, « ≤1 consonne entre noyaux ») + CV. Il **n'a PAS** les 3 leviers de `decompose.py` : pas de SEG enrichi (8 segments), pas de correction apprise (667 règles), pas de syllabation attaque-maximale. La doc `DECOMPOSE.md` est **exacte** (panneau = g2p moteur brut + overlay, qualité inférieure au script). Route lexicale (OMEGA_LEX4 `w.p`/`md`/`mb`/`old`/`pld`) bien câblée. `learn()` (ligne 33) garantit FP=0 (`'lex'` jamais écrasé).
- **🟡 Réutilisation correcte** : `developmental()` appelé par les deux panneaux (dictée 1401, correcteur 1474) ; `COL`/`LBL`/`STAGE_*` partagés (même scope). Pas de fonction orpheline dans eng2.

## ACCESSIBILITÉ (cible dys)
- **🟢** Saisies = vrais éléments natifs : `<textarea id="vdd-ans">` (1387), `<textarea id="vdc-in">` (1462), `<textarea id="vdk-in">` (76), tous `autocomplete/autocorrect/autocapitalize=off spellcheck=false`. Boutons `min-height:44px`. Option « Police lisible (dys) » + réglage vitesse TTS.
- **🔴 Manque `aria-live`.** Les zones `#vdd-fb`, `#vdc-out`, `#vdk-prev` remplies par `innerHTML` **sans `aria-live="polite"`** ⇒ un lecteur d'écran **n'annonce pas** le diagnostic/correction. Aucun `role`/`aria-*` dans tout eng2/eng3. Impact élevé.
- **🟡** Le bouton TTS muet en silence (bug `say`) aggrave l'accessibilité.
- **🟡** `.vdc-bad` (mot corrigeable) = `<span>` cliquable **non focusable au clavier** (pas de `tabindex`/`role=button`/`keydown`) ⇒ correction « clic » inaccessible au clavier.

**Priorités** : (1) dédupliquer `esc` et restaurer `'` (eng2:1413), (2) feature-detecter `speechSynthesis` avec repli (eng2:1394), (3) `aria-live` + `tabindex`/`role` sur `.vdc-bad`, (4) acter l'écart `lexicalGender` HF vs cgram complet.

---

# Annexe E — Suite Python du sous-projet dictée

**Résumé** : architecture saine, doctrine §1 respectée (split train/test étanche seed=42, FP=0 tenu, in-lexique⟂OOV séparés), réutilisation §A2 réelle (imports, pas de copies) ; tous les chiffres docs reproductibles sauf un (22/24 = liste-blanche vs 21/24 = défaut cgram, **déjà documenté**) ; bugs réels = mineurs (1 cas-test dupliqué, 3 builders qui écrasent des assets, quelques chemins en dur). Aucune fuite de données, aucun faux positif.

## Chiffres annoncés (doc) vs mesurés (run réel)
| Mesure | Doc | Run réel | Verdict |
|---|---|---|---|
| diag familles / surface | 100 % / 17/17 | 100 %, surface 17/17 | 🟢 |
| diag gouverneur accord | 84 % | 138/164 = 84 % | 🟢 |
| diag sujet-verbe | 94 % | 31/33 = 94 % | 🟢 |
| correcteur in-corpus | **22/24** (headline) | **21/24** (cgram) | 🟠 (voir CONFLITS-1) |
| correcteur FP / held-out | 0 / 12/15 | 0/24 / 12/15, fp 0 | 🟢 |
| decompose sublexical exact / phonémique | 52,4 % / 89,5 % | 52,35 % / 89,49 % | 🟢 |
| decompose étage (1) brut | 48,6 % / 88,4 % | 48,62 % / 88,38 % | 🟢 |
| p2g top-1/3/5 | 26,7 / 64,1 / 73,2 | 26,7 / 64,1 / 73,2 | 🟢 |
| descending genre / FP | 26/26 = 100 % / 0 | 26/26 / 0 | 🟢 |
| compress factorisé / reconstructible | 17× / ~½ | 17,0× / 51 % | 🟢 |
| test_decompose | 21 asserts OK | 21 asserts OK | 🟢 |

## BUGS
- **🟠 `correcteur_probe.py::CASES` (L226 et L241) — cas de test dupliqué à l'identique** : `("On mange ensemble","On","Ont","on/ont")` deux fois → « 24 témoins » = 23 distincts ; `on/ont` compté 5/5 dont une redite. Gonfle artificiellement dénominateur et couverture.
- **🟡 `build_g2p_tables.py`/`build_morpho.py`/`build_p2g.py`/`build_g2p_corrections.py` — écrasent leur asset de sortie sans garde ni `--dry-run`.** `build_g2p_tables.py` lancé en audit a regénéré `g2p_tables.json` (vérifié byte-identique, `git status` propre), mais « lancer = réécrire un fichier versionné » est un piège (un env modifié `P2G_MIN`/`MIN_SUPPORT` altère silencieusement un asset commité).
- **🟡 `decompose.py::read_text` (L383)/`main` (L519,525)/`demo` (L541)** — `--read`, `--read-file`, `--demo` **écrivent `learned_lex.json`** (non versionné) sans flag de confirmation : `--demo` présenté comme inoffensif a un effet de bord. (`--measure` = read-only, vérifié.)
- **🟡 `correcteur_probe.py::COMMON_VERBS` (L32-52)** — `vais` ×2 (L37, L39) ; idem `MODAL` (L25-27). Sans effet (set), signale une liste éditée-main non dédupliquée.
- **🟢 `diag_sentence.py::is_accord` (L117-122)** — robuste (chaîne identique → False ; `chat/chats`→True ; `élève/eleve`→False). **🟢 `decompose.py::_legal_onset` (L179-183)** cohérent SAMPA. **🟢 Chemins en dur** `LEX_PATH='/tmp/lex4/Lexique4.tsv'` gardés (override + exit 1 propre si absent). Pas de mutable par défaut, pas de comparaison float fragile, NFD/NFC géré par `deacc`.

## CONFLITS
1. **🟠 doc 22/24 vs run 21/24** (`CORRECTEUR.md` L20 headline vs L71). Le 22/24 = chemin **liste-blanche** ; avec `cgram_verbs.json` présent (défaut repo), `vlike` bascule sur cgram → **21/24** (exactement L71 : « 21/24 vs 22/24 liste blanche car cgram fait passer les homographes nom+verbe »). **Cohérent mais headline trompeur.** Recommandation : aligner le headline.
2. **🟢 `is_verb` (diag) vs `vlike` (correcteur)** — divergence **intentionnelle et documentée** (`vlike` étend `is_verb`). Le 21 vs 22 en découle.
3. **🟢 Pas de duplication de code** `norm`/`deacc`/`toks` : `decompose.py` (L31) et `correcteur_probe.py` (L20) **importent** depuis `diag_sentence` ; `p2g.py` importe `decompose`. Réutilisation §A2 réelle (vérifiée par les `import`). Seul `build_cgram.py` (L26) redéfinit son `deacc` local — acceptable (standalone).
4. **🟢 `et/est` 1/2, `ce/se` 0/2** — limites assumées des règles (FP-safe prime sur le rappel ; `ce/se` nécessite un vrai POS), pas des conflits.

## FLUX (pipeline)
```
Lexique4.tsv (HORS-REPO /tmp/lex4) ──build_cgram──► cgram_{verbs,gender,adj,hf}.json
app/omega-pendu.html ──build_g2p_tables──► g2p_tables.json ; ──build_morpho──► morpho.json
phono_homophones.json ──[W2P inversion]──► route lexicale du SON
   inlex_split(42, 0.8/0.2) ──► TRAIN(91 218) ⟂ TEST(22 805)  [overlap=0 VÉRIFIÉ]
       TRAIN ──build_g2p_corrections(cap 80k)──► g2p_corrections.json (667 règles)
       TRAIN ──build_p2g(cap 120k→91 218)──────► p2g_table.json (2119 clés)
       TEST[:4000] ──decompose/p2g --measure──► chiffres held-out
   diag_sentence ◄ correcteur_probe ◄ eval_externe (corpus_externe disjoint)
   descending_probe (genre) ; decompose/decompose_corpus ──learn──► learned_lex.json (NON versionné)
```
- **🟢 Étanchéité train/test confirmée mesurée** : train∩test=0, déterministe, même seed partout, `test[:4000]∩train=0`. Tables apprises sur TRAIN mesurées sur TEST → **pas de fuite**.
- **JSON requis** = `g2p_tables.json` (`sys.exit` si absent) ; **reste = repli inerte** (`_load_json(default)` ; correcteur→liste blanche ; diag→déterminant seul). Robuste.
- **🟢 Boucle descendante FP-safe** : `learned_lex.json` non versionné (absent après audit), `learn_word` ne laisse jamais `sublex` écraser `lex` (test_decompose L42-43) ; `descending_probe` écarte l'ambigu → FP=0 mesuré.
- **🟡 `corpus_gec_fr.jsonl` (20 Ko)** alimente `decompose_corpus.py` qui **écrit `learned_lex.json` par défaut** (pas de `--show`).

## ARCHITECTURE
- **🟢 Réutilisation §A2 réelle** : `correcteur`/`decompose`/`descending`/`decompose_corpus`/`eval_externe`/`build_*corrections`/`build_p2g`/`compress` importent tous `diag_sentence` ou `decompose`. Pas de réinvention. `build_g2p_tables` recopie verbatim les tables de l'app (réextraction byte-identique).
- **🟢 Régression gardée** : `test_decompose.py` asserte invariants (g2p, nbsyll, morpho, FP=0) **+ seuils held-out** (exact ≥50 %, p2g top-5 ≥65 %) → dégradation fait échouer la CI. 🟡 mesure sur `test[:1500]`/`sample[:800]` (échantillons réduits, seuils < mesure pleine — sain).
- **🟢 Gestion d'erreur builders sans TSV** : `build_cgram.py` exit 1 propre ; `build_morpho`/`build_g2p_tables` testent la présence de l'app. Aucun crash non gardé.
- **🟡 Conventions** : `_lev`/`align`/`align_chunks` = 3 implémentations Levenshtein/DP justifiées (mots vs chars vs partition). **🟡 CC BY-SA** : citation présente dans `build_cgram.py`/`build_validation_sheet.py` ; `morpho.json`/`g2p_*.json`/`p2g_table.json` n'ont pas de NOTICE inline (le NOTICE global couvre).

---

# Annexe F — Harnais de mesure `evo/`

**Résumé** : les 13 harnais `evo/` **TOURNENT TOUS** sur le code courant (aucun symbole cassé) et leur validité de mesure est globalement **SOLIDE** — ordre config↔init correct, reseed avant init, reset θ/`_OSL`/banques NEO par condition, in-lex/OOV correctement filtrés, warmup/test disjoints. Les défauts trouvés sont des bugs d'INTERPRÉTATION/affichage de diagnostics (verdict signé à l'envers) et de doc périmée, pas des bugs qui falsifient un winrate cité.

## BUGS (validité de mesure)
- **🟠 `diag_bpc.js` (ligne 73) — verdict (S) faux sur GAP NET négatif.** La condition `Math.abs(gapNet) < 0.02*Math.abs(gapFreq)+0.003` utilise `abs()`, donc un GAP brut quasi nul (+0.0007) avec un GAP NET fortement NÉGATIF (−0.0212) imprime « porte un signal AU-DELÀ de la fréquence (spécifique au mot) » — conclusion INVERSE de la réalité. Preuve : `node evo/diag_bpc.js 20 10 12345` → `GAP brut +0.0007 · GAP NET -0.0212 → porte un signal AU-DELÀ`. La lecture correcte (cf. `diag_rwr` : réel +0.0007 ≈ plat +0.0005 ≈ 0) est que cLetterScore ≈ fréquence. **Menace** : un relecteur de `diag_bpc` à petit/moyen N conclut à tort que le concept readout porte du signal-mot (menace l'interprétation de `AUDIT_OMEGA §3`). À corriger : `gapNet > seuil` (signé), pas `abs`. **C'est le seul correctif evo nécessaire à la validité scientifique.** (Le chiffre brut imprimé reste juste ; seule la phrase de verdict ment.)
- **🟢 diag_bpc/diag_phonm/diag_m1m_homeo — sensibilité au N small.** À warmup 20 les GAP varient de signe ; ce n'est pas un bug du harnais (défauts = 200/80), juste un rappel que les verdicts auto sont fragiles à petit N. Aucune claim d'audit n'utilise ces petits N.

## CONFLITS
- **🟢 Extraction moteur — JSON ignoré, gz async OK (vérifié, conforme).** `loadEngine` (fitness_harness.js l.17-18) capture `lex4-data-gz` (type `text/plain`) dans `lex` et fait `continue` sur l'unique bloc `application/json` (`vdc-lex`). Décompression gz async via `await O.loadLex()`/`DecompressionStream` réussit sous Node 22 (`[Lex4] Embedded chargé : 83605 mots`). Doc « gz+async » exacte.
- **🟢 Protocole `ab_cohort` ≡ bench in-page `_omega_trexquant_bench` (vérifié identique).** Même `valid` (7..12, `/^[A-Z]+$/`), même LCG (`*1664525+1013904223`), même Fisher-Yates, même `test=slice(0,testN)`/`train=slice(testN,…)`, même `filtered` (retrait du `testSet` de chaque bucket `len_index`). Les fonctions de décision lisent `OMEGA_LEX4.len_index` → le retrait OOV ampute réellement la route lexicale. **Mesure OOV §1.1 reproductible et propre.**
- **🟡 ab_m1m.js (en-tête l.2) — doc périmée.** « Toggle `M5_D_M1_M_ENABLED` ajouté (défaut ON) » alors que l'engin le déclare `false` (`/tmp/eng1.js` l.195). Le harnais pose les deux bras explicitement → **la mesure Δ reste correcte**, mais l'affirmation « défaut ON » décrit une baseline qui n'est plus celle du build.

## FLUX (contamination appariée)
Trace `ab_cohort.js::runCond` : (a) `loadEngine` une fois ; (b) `ev(CFG)` AVANT init ; (c) `_omegaSeed=seed; _omegaRng=makeMulberry32(seed); initOmegaGlobals()` puis `_omega_OSL_reset()` + `M_OS_v07.alpha=beta=1` ; (d) `ev(CFG)` ré-appliqué (défensif) + garde anti-inerte ; (e) warmup lexique plein, test lexique filtré (OOV) ; (f) `LEX.len_index=origLI` restauré en sortie.
- **🟢 Reseed AVANT init = `bpcW` déterministe (vérifié).** `initOmegaGlobals` fait `_omegaRng=makeMulberry32(_omegaSeed)` (l.1261) PUIS remplit `bpcW`/`bpcW_phon` via `omegaRand()` (l.1416/1424). `_omegaSeed` posé avant init dans TOUS les harnais → `bpcW` reproductible (exigence §1 satisfaite). Picker `_omega_pickWords` utilise `makeMulberry32(seed+777)` (RNG seedé séparé), pas `Math.random`.
- **🟢 Pas de fuite d'état entre conditions appariées.** `initOmegaGlobals` ré-alloue `_emrgBank`/`_neoCR`/`_neoCRS`/`_emrgOG`/`_recentGames` ; `_omega_OSL_reset` purge `_OSL` ; `α/β` remis à (1,1). Tous les toggles pilotés ré-écrits via `${!!flag}` à chaque condition → un flag `true` en cond N ne survit pas en cond N+1.
- **🟢 Warmup/test disjoints.** `test=slice(0,testN)`, `train=slice(testN,testN+warmupN)` : indices disjoints. L'apprentissage descendant NEO écrit en FIN de partie (mot de test n'apprend de lui-même qu'après avoir été joué — légitime, identique aux deux bras).
- **🟢 `evalIn` par référence, baseline non altérée (preuve empirique).** Δ non nuls selon le toggle (ARGMAX 90,0 % vs JOINTE 96,7 %) → preuve que `eval(c)` écrit les `let` du moteur par référence. Seule clé exportée = `__O`.

## ARCHITECTURE
- **🟡 Duplication massive de `pickSets`/CFG/`runCond` (8-10 fichiers).** Le bloc `valid 7..12 + LCG + Fisher-Yates`, les `CFG_*` (~25 toggles copiés), la séquence `config→init→reseed→OSL_reset→α/β=1→re-config→garde anti-inerte`, et `play()` recopiés quasi à l'identique dans `ab_cohort/ab_m1m/ab_bpcr/ab_phonfb/diag_m1m/diag_mirror/diag_bpc/diag_rwr/diag_phonm/diag_m1m_homeo`. **Risque réel** : une dérive du moteur doit être patchée 10× ; un oubli = un harnais qui mesure faux en silence. `fitness_harness.js` devrait aussi exporter `pickSets(seed,{warmupN,testN})`, `applyRefConfig(ev)`, `resetAndInit(ev,seed)` factorisés. **Surface d'erreur n°1 pour de FUTURS chiffres.**
- **🟢 `loadEngine`/`evalIn` robustes** (Proxy stub DOM complet ; `setTimeout`/`localStorage`/`AudioContext` mockés ; Node 22). **`phrase_hangman_probe.py` autonome** (réutilise `dictee/diag_sentence` sans toucher au moteur JS ; EXIT 0 — le `EXIT=1` observé = SIGPIPE de `head`). **`phrase_engine_bench.js`** : deux passes = deux `loadEngine` indépendants (pas de fuite OFF↔ON), hook `_omega_accordPriorFn` OFF-inerte par défaut (gardé l.4572) → baseline byte-identique.
- **🟢 Cohérence des seeds par défaut.** `12345,777,2024,99` (inlex), `12345,777` (oov), `fitness` 12345. `_omega_pickWords` (fitness, `len≤15`, échantillonnage avec remise) ≠ `pickSets` (A/B, `len≤12`, permutation sans remise miroir du bench in-page) — intentionnel et documenté ; à savoir : **les mots de `fitness_harness` ≠ ceux des A/B** (ne pas comparer leurs winrates).

**Statut exécution** : `fitness_harness` ✔, `ab_cohort` (inlex) ✔, `ab_m1m` ✔, `ab_bpcr`/`ab_phonfb` ✔, `phrase_engine_bench` ✔, `phrase_hangman_probe` ✔, `diag_bpc/m1m/mirror/phonm/rwr/m1m_homeo` ✔ — **tous EXIT 0**. Le seul correctif pour la validité scientifique = **diag_bpc.js l.73**. Le reste = dette de doc (`ab_m1m`) + dette d'archi (factoriser le protocole dupliqué).
