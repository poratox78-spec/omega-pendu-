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
`M_OS_LEARNING` (+ ses 4 gardes) `M_OS_LEARNING_ONLINE`

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
