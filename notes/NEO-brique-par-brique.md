# OMEGA v0.07 — Declare NEO (cheat-free, émergent) — assemblage brique par brique

Date : 03/06/2026 · Build de travail : sandbox (OFF-inerte, non livré) · Harnais : headless Node, déterministe

---

## 0. Cadre

Nouveau declare **additif** (toggle `M_DECLARE_NEO_ENABLED`, OFF par défaut, **baseline byte-identique**),
**sans modifier aucun des 5 declares existants**. Respecte les **voies** (ortho + phon) et les **sens** :
décision **ascendante** = positions révélées seulement (cap §43) ; apprentissage **descendant** = post-partie.
bPC M3_d allumé pour nourrir la cognition, mais NEO **n'est pas** `M_BPC_DECLARE`.

Doctrine cheat-free appliquée : `w.p` (prononciation) = **entrée** proto-langage légitime ; la triche serait
de lire le **graphème caché** — ce que l'alignement évite déjà (`align(m,p,mask)` : positions cachées = émission
uniforme). La cohorte utilise le lexique **dérivé du board** (autorisé pour DECLARE), jamais pour le scoring-lettre.

---

## 1. Le problème descellé en premier : non-déterminisme de la mesure

La config Rem (apprentissage en ligne + bPC) rendait **la base elle-même non déterministe** entre runs d'un même
process (ex. même graine : 112 / 111 / 109 victoires). **Tous les Δ mesurés ainsi étaient du bruit.**

Causes (état persistant non réinitialisé par `initOmegaGlobals`) :
1. `_OSL` (θ en ligne, trajectoire) — persiste entre runs.
2. `M_OS_v07.alpha/beta` (cible de déploiement de θ) — au redémarrage, `_OSL.theta` est ré-amorcé depuis cette valeur dérivée.
3. `M3_d.bpcW` (poids du concept bPC) initialisés par `omegaRand()` **pendant** l'init, donc semés par le RNG résiduel du run précédent.

**Correctif harnais (par run)** :
```
_omegaSeed=sd; _omegaRng=makeMulberry32(sd); initOmegaGlobals();   // reseed AVANT init -> bpcW déterministe
if (_omega_OSL_reset) _omega_OSL_reset();                          // reset θ en ligne
M_OS_v07.alpha=1; M_OS_v07.beta=1;                                 // reset cible de déploiement
_omegaRng=makeMulberry32(sd);                                      // RNG de jeu aligné
```
Résultat : déterminisme rétabli, config bPC complète comprise (112/112/112).
**À vérifier côté app** : des mesures enchaînées sans reset peuvent subir la même contamination.

---

## 2. Brique par brique (harnais déterministe, config Rem, cheat-free)

| Brique | rôle | K=1 (généralisation) | K=3 (vocab répété) | réussite/prop. | verdict |
|---|---|---|---|---|---|
| **Recall** (adressée) | reconnaît un mot vécu (VSA, board révélé + banc) | +0,00 (inerte, normal) | **+1,76** | **100 %** | **ON** |
| **Assemblé** (phon→ortho masqué) | décode positions sonores via `L2[phonème]`, `w.p`=entrée | **+5,28** | +3,43 | 96–97 % | **ON** |
| **Muette** (contexte ortho) | positions sans phonème (`al[p]=EPS`) via voisins révélés | ~0 / −0,28 | ~+0,09 | **69–80 %** | **OFF** (maillon faible) |
| **Cohorte** (filtre board-derived) | n'autorise une lettre que si ≥1 mot compatible la porte là | +0,50 | +0,17 | hit 96,7→**98,3 %** | **ON** (le bon levier) |
| Trigger (confiance seule) | seuil sur la confiance assemblé | headroom faible (hit ~plat 95–96 %) | — | — | inutile seul |

Notes :
- **Muette** : monter le seuil l'empire (la « confiance » ortho n'est pas corrélée à la justesse : conf 0,70 → 20 % hit). À laisser OFF.
- **Trigger confiance** : le hit reste plat quel que soit le seuil → la confiance brute ne trie pas le bon du faux. La **cohorte** fait ce travail bien mieux (élimine les lettres impossibles).

---

## 3. NEO validé = Recall + Assemblé + Cohorte (Muette OFF)

| Régime | base | NEO validé | Δ | détail |
|---|---|---|---|---|
| K=1 (généralisation, mots distincts) | 92,0 % | **98,0 %** | **+6,0** | assemblé 98,3 % hit (cohorte) |
| K=3 (vocab répété ×3) | 94,3 % | **99,0 %** | **+4,7** | recall 100 % + assemblé 99,1 % hit |

NEO atteint/dépasse le **declare manuel (≈98,8 %)**, **cheat-free** (align masqué, `w.p`=entrée, cohorte board-derived),
**additif**, **OFF-inerte**, **sans toucher aux 5 declares**, bPC M3_d ON mais **pas** `M_BPC_DECLARE`.
Cohérence : l'apport de l'assemblé (+5,28) reproduit l'assemblé émergent existant (+5,25) — même mécanisme.

---

## 4. Toggles NEO (tous additifs, OFF-inertes)

- `M_DECLARE_NEO_ENABLED` (maître, OFF) ; sous-briques : `M_NEO_RECALL_ENABLED`, `M_NEO_ASSEMBLED_ENABLED`,
  `M_NEO_MUTE_ENABLED` (OFF), `M_NEO_COHORT_ENABLED`.
- Seuils : `M_DECLARE_NEO_CONF` (assemblé, 0,75), `M_DECLARE_NEO_RECALL_MARGIN` (0,20), `M_NEO_MUTE_CONF`.
- Apprentissage descendant : banc VSA (`_emrgBank`), g2p en ligne (`_emrg_initOnline().learn`), contexte ortho (`_neoOL/_neoOR`) — tous réinitialisés à l'init.
- **Config recommandée** : maître ON + recall + assemblé + cohorte ; muette OFF.

---

## 5. Reste à faire

- **Puissance** : refaire en plus de graines × N (≥ R66 : ~200 parties × 4+ graines), K=1 et K>1 séparés, sur harnais déterministe.
- **Combinatoire** : matrice factorielle NEO × (les 5 declares OFF) pour vérifier la non-additivité.
- Trigger appris seulement si un **signal autre que la confiance brute** (accord recall/assemblé, remplissage board) montre du headroom — la cohorte capte déjà l'essentiel.
- Livraison build + diff **après** validation en puissance et **accord explicite** (pas de ZIP sans commande).
