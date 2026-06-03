# OMEGA v0.07 phase46 — Declare NEO (cheat-free, émergent, croisé)

Fichier : `OMEGA_v0_07_phase46_declare_neo.html` · MD5 `4e16b7a2577b4d0660b87cb5266134f2` · 16515350 o
Base : phase45. **Additif, OFF-inerte (baseline byte-identique), aucun des 5 declares existants modifié.**

## Ce qui est ajouté
Un **nouveau declare NEO** (toggle maître + sous-briques + trigger), tout OFF par défaut.

| flag | défaut | rôle |
|---|---|---|
| `M_DECLARE_NEO_ENABLED` | false | maître NEO |
| `M_NEO_RECALL_ENABLED` | true | voie adressée (recall VSA, board révélé + banc) |
| `M_NEO_ASSEMBLED_ENABLED` | true | voie assemblée phon→ortho masquée (sonore, `L2[phonème]`) |
| `M_NEO_COHORT_ENABLED` | false | filtre cohorte board-derived (lexique autorisé pour DECLARE) |
| `M_NEO_MUTE_ENABLED` | false | muette PAR LE SON, **croisée (jointe)** phonème-tête×offset×voisins |
| `M_NEO_TRIGGER_ENABLED` | false | n'engage la muette que si cognition incertaine (`M5_d.output.gap` faible) |
| `M_DECLARE_NEO_CONF` | 0.75 | seuil assemblé |
| `M_DECLARE_NEO_RECALL_MARGIN` | 0.20 | marge recall |
| `M_NEO_MUTE_CONF` | 0.85 | seuil muette |
| `M_NEO_TRIGGER_GAP` | 0.005 | seuil gap cognition pour le trigger |

Inclus aussi (sessions précédentes) : Fix#1 (RNG `omegaRand` reproductible), `M3_D_BYPASS_ENABLED` (diagnostic R66).

## Doctrine respectée
- Montant = décider sur révélé seul (cap §43) ; descendant = apprendre post-partie.
- `w.p` = entrée légitime ; align **masqué** (pas de graphème caché).
- **croiser = jointe, pas produit** ; `bind` réservé au code par mot (recall), pas moteur de lettres (spec figée).
- bPC M3_d peut être ON ; NEO **n'est pas** `M_BPC_DECLARE`.

## Config recommandée (mesurée)
Maître ON + recall + assemblé + cohorte (muette+trigger optionnels, neutres).

## Résultats (harnais déterministe, 4 graines × 120, Δ apparié)
- **R+A+Cohorte** : K=1 **97,50 % ±0,59** (base 91,46) · K=3 **98,82 % ±0,38** (base 93,75) — niveau declare manuel, cheat-free.
- Muette+trigger (gap 0,005) : neutre (Δ +0,00 K=1 z=0 ; +0,14 K=3 z=0,77) — vivante, ne drague plus.

## Notes
- Build sauvegardé d'origine non touché. Pas de ZIP (livraison fichier seul).
- Détails méthode + mesures : `OMEGA_v0_07_NEO_muette_croisement_03062026.md`.

## UI (mise à jour)
6 toggles NEO ajoutés au panneau (après les declares émergents), format standard `toggle-item` + `onclick="ui_toggle(this)"`, et flags inscrits dans les **2** listes `ALLOWED_TOGGLES` :
`M_DECLARE_NEO_ENABLED` (maître), `M_NEO_RECALL_ENABLED`, `M_NEO_ASSEMBLED_ENABLED`, `M_NEO_COHORT_ENABLED`, `M_NEO_MUTE_ENABLED`, `M_NEO_TRIGGER_ENABLED`.
Tout pilotable depuis la console (lecture seule respectée). Paramètres numériques (`M_DECLARE_NEO_CONF`, `M_NEO_MUTE_CONF`, `M_NEO_TRIGGER_GAP`, `M_DECLARE_NEO_RECALL_MARGIN`) restent en defauts mesurés (éditables en code ; dis-moi si tu veux un panneau de réglages).
Build re-vérifié : script parse, 37 toggles, OFF-inerte préservé.
