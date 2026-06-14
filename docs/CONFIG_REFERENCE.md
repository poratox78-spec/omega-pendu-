# OMEGA-Ω — Configuration de référence (cognition CHEAT-FREE)

> Config optimale **sans triche**. **Sources qui font foi** : `notes/NEO-changelog.md`,
> `notes/NEO-brique-par-brique.md`, `notes/NEO-muette-croisement.md` (relevé de mesure NEO) +
> `docs/rapport-mode-emploi.html` §8.3 (cognition) / §17 (NEO).
> Doctrine : « cognition > oracle » — aucun module ne lit le mot caché hors positions révélées.

## Résultat mesuré qui fait foi (harnais déterministe, 4 graines × 120, K séparés)
| Régime | base (cognition seule) | + NEO (R+A+Cohorte) |
|---|---|---|
| K=1 (généralisation, mots distincts) | 91,46 % | **97,50 % ±0,59** |
| K=3 (vocab répété ×3) | 93,75 % | **98,82 % ±0,38** |

Cheat-free, **niveau du declare manuel** (~98,8 %). Plafond oracle (exclu par doctrine) = 98,7 %.
*(Muette + trigger = neutres : Δ ≈ 0 → optionnels.)*

## ON — Déclareur NEO (panneau « Declare NEO ») — **config recommandée mesurée**
- `M_DECLARE_NEO_ENABLED`   (maître)
- `M_NEO_RECALL_ENABLED`    (voie adressée : recall VSA, board **révélé** + banc)
- `M_NEO_ASSEMBLED_ENABLED` (voie assemblée phon→ortho **masquée**)
- `M_NEO_COHORT_ENABLED`    (filtre cohorte **board-derived**)
- `M_NEO_MUTE_ENABLED` = **OFF** · `M_NEO_TRIGGER_ENABLED` = **OFF** (optionnels, neutres)
- Seuils (défauts mesurés) : `M_DECLARE_NEO_CONF = 0,75` · `M_DECLARE_NEO_RECALL_MARGIN = 0,20`
  (si muette/trigger : `M_NEO_MUTE_CONF = 0,85`, `M_NEO_TRIGGER_GAP = 0,005`)

## ON — Cognition (panneau « L01 ENHANCEMENTS ») — preset §8.3
`L01_A4_M4M_DECOMP` · `L01_A5_M2M_POSITIONAL` · `L01_A6_OS_CONCEPT_ARBITRAGE` ·
`M_VOIE_PHON` · `M_OS_V07` · `M4_PHON_USE_P` · `M_SUBSTRAT_ORTHO_PURE` · `M_PHON_FEEDBACK` ·
`M_BPC_M3D` · `M_BPC_READOUT_COUPLE` · `M_PHON_READOUT_COUPLE` · `M_PHON_CONCEPT_BIND` ·
`M_OS_LEARNING` (+ ses 4 gardes)  — `M_OS_LEARNING_ONLINE` **OFF** (mesuré sans gain + dérive)

> ⚠️ **Réserve honnête** : la base *cognition* a **deux variantes documentées** qui diffèrent :
> §8.3 (ci-dessus, voie phon ON) vs la fonction de bench `baseCfg()` **dans le code** (voie phon OFF,
> `L01_B2_MOBIUS` ON) — cette dernière sert au bench **hors-lexique** (ortho seul). À trancher par mesure
> si on veut LA base unique. Le **déclareur NEO ci-dessus, lui, fait foi** (notes + §17).

## OFF — Triche grise (NE PAS activer)
`L01_A1_M2_ORTHO` · `L01_A2_M4_LEX4` (injecte la fréquence du dictionnaire dans le scoring-lettre) · `L01_A3_M5M_WORDLEX4`
> Les laisser OFF = ce qui rend la config **cheat-free**. (Le panneau « DICTÉE · oracle lexical » = oracle aussi → OFF.)

## Pourquoi « sans triche »
1. **A1/A2/A3 OFF** → aucune fréquence lexicale dans le scoring-lettre (sens montant).
2. **NEO cheat-free par construction** : recall lié au **révélé** seul ; assemblé **masqué** ; cohorte **board-dérivée** → aucune déclaration ne lit le mot caché.
3. Apprentissage (θ, readouts, banc, g2p) = **descendant**, post-décision → légitime.

## Configuration EXACTE des 38 toggles (énumération complète)

| # | Toggle | État | Note |
|---|---|---|---|
| 1 | `L01_A1_M2_ORTHO_ENABLED` | OFF | triche grise (béquille lexicale) |
| 2 | `L01_A2_M4_LEX4_ENABLED` | OFF | triche grise — fréquence dico dans le scoring-lettre |
| 3 | `L01_A3_M5M_WORDLEX4_ENABLED` | OFF | triche grise |
| 4 | `L01_A4_M4M_DECOMP_ENABLED` | **ON** | décomposition descendante |
| 5 | `L01_A5_M2M_POSITIONAL_ENABLED` | **ON** | correction positionnelle descendante |
| 6 | `L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED` | **ON** | arbitrage conceptuel OS |
| 7 | `L01_B2_MOBIUS_ENABLED` | OFF | à mesurer (non requis) |
| 8 | `M_VOIE_PHON_ENABLED` | **ON** | voie phonologique (SAMPA) |
| 9 | `M_OS_V07_ENABLED` | **ON** | OS v07 pilote la décision |
| 10 | `M4_PHON_USE_P_ENABLED` | **ON** | croisement prior phonétique |
| 11 | `M_SUBSTRAT_ORTHO_PURE_ENABLED` | **ON** | substrat ortho pur |
| 12 | `M_PHON_FEEDBACK_ENABLED` | **ON** | retour descendant phon |
| 13 | `M_WORD_DECLARE_ENABLED` | OFF | ancien declare (remplacé par NEO) |
| 14 | `M_IG_SELECT_ENABLED` | OFF | à mesurer (InfoGain) |
| 15 | `M_IG_PSUCCESS_ENABLED` | OFF | à mesurer (requiert InfoGain) |
| 16 | `M_BPC_M3D_ENABLED` | **ON** | concept bPC M3_d |
| 17 | `M_BPC_READOUT_COUPLE_ENABLED` | **ON** | couplage readout-récompense |
| 18 | `M_PHON_READOUT_COUPLE_ENABLED` | **ON** | couplage readout phon |
| 19 | `M_PHON_CONCEPT_BIND_ENABLED` | **ON** | readout phon sur concept lié |
| 20 | `M_BPC_DECLARE_ENABLED` | OFF | declare BPC (≠ NEO) |
| 21 | `M_DECLARE_DUAL_ENABLED` | OFF | ancien declare |
| 22 | `M_LEARN_FROM_COGNITION_ENABLED` | OFF | non requis |
| 23 | `M_OS_LEARNING_ENABLED` | **ON** | apprentissage OS (θ) |
| 24 | `M_OS_LEARNING_GUARD_1_BOUNDED` | **ON** | garde θ 1 |
| 25 | `M_OS_LEARNING_GUARD_2_ANALYTIC_AUDIT` | **ON** | garde θ 2 |
| 26 | `M_OS_LEARNING_GUARD_3_MDL_REGUL` | **ON** | garde θ 3 |
| 27 | `M_OS_LEARNING_GUARD_4_COHERENCE` | **ON** | garde θ 4 |
| 28 | `M_OS_LEARNING_ONLINE_ENABLED` | OFF | mesuré : aucun gain (98,1 vs 98,3 %) + dérive de session → OFF |
| 29 | `M_EMERGENT_DECLARE_ENABLED` | OFF | declare émergent (hors config NEO recommandée) |
| 30 | `M_EMERGENT_ASSEMBLED_ENABLED` | OFF |  |
| 31 | `M_EMERGENT_G2P_ONLINE` | OFF |  |
| 32 | `M_DECLARE_NEO_ENABLED` | **ON** | NEO maître |
| 33 | `M_NEO_RECALL_ENABLED` | **ON** | NEO recall (board révélé + banc) |
| 34 | `M_NEO_ASSEMBLED_ENABLED` | **ON** | NEO assemblé phon→ortho masqué |
| 35 | `M_NEO_COHORT_ENABLED` | **ON** | NEO cohorte board-derived |
| 36 | `M_NEO_MUTE_ENABLED` | OFF | optionnel (neutre) |
| 37 | `M_NEO_TRIGGER_ENABLED` | OFF | optionnel (neutre) |
| 38 | `M_TREXQUANT_MODE_ENABLED` | OFF | mode test hors-lexique uniquement |

**21 ON / 17 OFF** (online learning passé OFF après mesure). Paramètres NEO : `M_DECLARE_NEO_CONF=0,75`, `M_DECLARE_NEO_RECALL_MARGIN=0,20`.
Résultat mesuré (notes NEO, 4 graines×120) : base 91,5/93,8 → **+NEO 97,50 % (K=1) / 98,82 % (K=3)**, cheat-free.

## Notice UI — config optimale par LIBELLÉ AFFICHÉ (ce qu'on voit dans l'app)

**À ACTIVER (ON) :**
- ☑ A4 · Decomp
- ☑ A5 · Positional
- ☑ A6 · OS Arbitrage
- ☑ φ · Voie Phon
- ☑ φ · OS v07
- ☑ φ · Croisement p
- ☑ φ · Substrat pur
- ☑ φ · Feedback ↓
- ☑ bPC M3_d
- ☑ Couplage readout
- ☑ Couplage readout φ
- ☑ Concept lié φ (étape 2)
- ☑ θ · Apprentissage
- ☑ θ · Garde 1 borné
- ☑ θ · Garde 2 audit
- ☑ θ · Garde 3 MDL
- ☑ θ · Garde 4 cohérence
- ☑ 🧩 Declare NEO · maître
- ☑ 🔁 NEO · recall (adressée)
- ☑ 🧬 NEO · assemblé (phon→ortho)
- ☑ 🎯 NEO · cohorte (filtre board)

**À LAISSER ÉTEINT (OFF) :**
- ☐ θ · Apprentissage EN LIGNE (SPSA)  *(mesuré : aucun gain + dérive de session)*
- ☐ A1 · Orthography
- ☐ A2 · Lexique 4
- ☐ A3 · Word Lex4
- ☐ B2 · Möbius
- ☐ 🎯 Declare mot
- ☐ 🧠 InfoGain
- ☐ IG x P(succès)
- ☐ 🎯 Declare BPC
- ☐ 🦴 Declare DUAL (cheat-free)
- ☐ 🧠 Apprendre depuis la cognition
- ☐ 🦴 Declare émergent · recall
- ☐ 🧬 Declare émergent · phon→ortho
- ☐ 🔤 g2p appris en jouant (online)
- ☐ 🔇 NEO · muette (par le son, croisée)
- ☐ 🎚️ NEO · trigger (cognition incertaine)
- ☐ 🎯 Mode Trexquant (hors-lexique)

Réglages : NEO_CONF 0,75 · RECALL_MARGIN 0,20. → 97,50 % (K=1) / 98,82 % (K=3), cheat-free.

## MAJ mesurée (online) — 14/06/2026
`M_OS_LEARNING_ONLINE` (θ · Apprentissage EN LIGNE) : **OFF**. Mesuré (config optimale, 3 graines, warmup 150) : ON 98,1 % vs OFF 98,3 % (égal) ; ON rend le résultat **dépendant de l'historique de session** (même graine : 99,2 % → 98,3 %). OFF = même score, reproductible. Le master `M_OS_LEARNING` + gardes restent ON.
