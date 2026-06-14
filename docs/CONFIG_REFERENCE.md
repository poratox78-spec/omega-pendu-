# OMEGA-Ω — Configuration de référence (cognition CHEAT-FREE)

> Config optimale **sans triche**, **re-mesurée sur le code courant** (14/06/2026).
> Doctrine : « cognition > oracle » — aucun module ne lit le mot caché hors positions révélées.
> Aussi dans `docs/rapport-mode-emploi.html` §8.3.

## Win rate mesuré (in-lexique, graine 12345, 120 mots, warmup 150)
| Config | Win rate |
|---|---|
| défaut (tout OFF) | 5,0 % |
| référence **sans** NEO | 91,7 % |
| **référence + NEO** ⟵ optimal | **99,2 %** |

Cohérent avec le mémoire (cognition seule ~90 % ; +NEO 97,5 % K=1 / 98,8 % K=3, cf. §17).
Plafond oracle (exclu par doctrine) = 98,7 %.

## ON — Cognition (panneau « L01 ENHANCEMENTS »)
- `L01_A4_M4M_DECOMP_ENABLED`        (A4 · décomposition descendante)
- `L01_A5_M2M_POSITIONAL_ENABLED`    (A5 · correction positionnelle)
- `L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED` (A6 · arbitrage conceptuel OS)
- `M_VOIE_PHON_ENABLED`              (φ · voie phonologique SAMPA)
- `M_OS_V07_ENABLED`                 (⊕ · OS v07 pilote la décision)
- `M4_PHON_USE_P_ENABLED`            (⇄ · croisement prior phonétique)
- `M_SUBSTRAT_ORTHO_PURE_ENABLED`    (⊙ · substrat ortho pur)
- `M_PHON_FEEDBACK_ENABLED`          (φ↓ · retour descendant phon)
- `M_BPC_M3D_ENABLED`                (concept bPC M3_d)
- `M_BPC_READOUT_COUPLE_ENABLED`     (couplage readout-récompense)
- `M_PHON_READOUT_COUPLE_ENABLED`    (couplage readout phon)
- `M_PHON_CONCEPT_BIND_ENABLED`      (readout phon sur concept lié)
- `M_OS_LEARNING_ENABLED`            (θ · apprentissage OS) + ses 4 gardes :
  `M_OS_LEARNING_GUARD_1_BOUNDED`, `..._2_ANALYTIC_AUDIT`, `..._3_MDL_REGUL`, `..._4_COHERENCE`
- `M_OS_LEARNING_ONLINE_ENABLED`     (θ online · SPSA en ligne)

## ON — Déclareur NEO, cheat-free (panneau « Declare NEO »)
- `M_DECLARE_NEO_ENABLED`            (🧩 maître)
- `M_NEO_RECALL_ENABLED`             (recall VSA depuis le board RÉVÉLÉ + banc)
- `M_NEO_ASSEMBLED_ENABLED`          (assemblé phon→ortho, MASQUÉ)
- `M_NEO_COHORT_ENABLED`             (filtre cohorte board-derived)
- `M_EMERGENT_DECLARE_ENABLED`
- paramètre `NEO_CONF = 0,60`

## OFF — Triche grise (NE PAS activer)
- `L01_A1_M2_ORTHO_ENABLED`   (A1)
- `L01_A2_M4_LEX4_ENABLED`    (A2 · filtre lexical = injecte la fréquence du dictionnaire dans le scoring-lettre)
- `L01_A3_M5M_WORDLEX4_ENABLED` (A3)
> Ces trois injectent la connaissance lexicale dans le **scoring des lettres** → c'est lire la
> réponse (« oracle »). Les laisser OFF est ce qui rend la config **cheat-free**.
> NB : le panneau « DICTÉE · oracle lexical » de l'app est aussi un oracle → hors config pendu, OFF.

## À MESURER / optionnel (non requis pour 99,2 %)
`L01_B2_MOBIUS_ENABLED`, `M_IG_SELECT_ENABLED`, `M_IG_PSUCCESS_ENABLED`, `M_NEO_MUTE_ENABLED`, `M_NEO_TRIGGER_ENABLED`

## Pourquoi c'est « sans triche »
1. **A1/A2/A3 OFF** → aucune fréquence lexicale dans le scoring-lettre (sens montant).
2. **NEO cheat-free par construction** : recall lié au **révélé** seul ; assemblé **masqué** (ne lit aucun graphème caché) ; cohorte **board-dérivée**. Les déclarations ne lisent jamais le mot caché.
3. Apprentissage (θ, readouts) = **descendant**, post-décision, légitime.
