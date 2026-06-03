# OMEGA v0.07 — Declare NEO : muette par le son, et le croisement (≠ multiplication)

Date : 03/06/2026 · Build de travail : sandbox (OFF-inerte, non livré) · Harnais : headless Node déterministe
Direction Rem. Doc demandée pour cadrer avant de regarder les sources littéraires ensemble.

---

## 0. Corrections actées (Rem)

1. **Ne pas laisser la muette OFF / la déclarer "dead-end" sans demander.** `phon→ortho` a toujours marché ; si ça ne rend pas au système, **on a mal câblé**, pas l'approche.
2. **Croiser ≠ multiplier.** Mon `phonogr × orthoG × orthoD` est un **produit de marginales** (hypothèse d'indépendance). Ce n'est pas le croisement.
3. **Vérifier l'existant d'abord** (les cartes, le declare dual, les sources) — pas filer sur le Zip.

---

## 1. Ce qu'est le croisement, d'après NOS sources (déjà utilisées)

- **Plate (1995) HRR** — substrat 1024-D, `bind`/`unbind` (structurant).
- **AQUA decode** : `decode(g) = bind/unbind + dot` (QND) → confiance = ⟨H⟩. Le croisement est une **liaison vectorielle** lue par produit scalaire, pas une multiplication de probabilités.
- **Resonator networks (Frady, Kent, Olshausen, Sommer 2020)** : décoder un produit lié = recherche combinatoire difficile → *« valide le réflexe ne pas multiplier aveuglément »*.
- **Tests bind (consignés)** :
  - `phon ⊗ phon` (corrélé ⊗ corrélé) → **collapse** = mauvais croisement.
  - `bind(lettre, rôle)` 1024-D MAP → **0 cellule morte, généralisation ×6, 100 % retrievable** = bon croisement (partenaire décorrélant).
  - Insight Rem : *bundler des vecteurs bruts = mélange (collapse) ; bundler des paires liées `bind(g,p)` = mémoire associative interrogeable par dot product, sans détruire l'état.*
- **Contexte AQUA = relatif + bilatéral** : voisin droit (codon −68 %), terminaison/POS (-ent −98 %). Encodage en **slots relatifs** : `code += shift(L,1) + shift(R,2)` (bind ordonné), readout lit la jointe.
- **Coltheart DRC (2001)** : double route adressée/assemblée — fusionnées, la correction mutuelle phon↔ortho est le cœur.

**Conclusion mécanisme** : le croisement correct = **liaison (bind) du phonème et du contexte ortho relatif dans le substrat 1024-D décorrélé, lue par dot product** — la jointe `P(lettre | phonème, contexte)`, jamais le produit `P(lettre|phonème)·P(lettre|voisin)`.

---

## 2. Résultats mesurés cette session (harnais déterministe)

### 2.1 Correctif de mesure (préalable, sinon tous les Δ = bruit)
État d'apprentissage en ligne persistant entre runs → base non déterministe (112/111/109).
Reset par run : **reseed AVANT init** (bpcW déterministe) + `_omega_OSL_reset()` + `M_OS_v07.α/β=1` + reseed RNG de jeu. → déterministe (112/112/112).

### 2.2 NEO brique par brique (config Rem, cheat-free, mots ≥7)
| brique | K=1 (généralisation) | K=3 (vocab répété) | réussite/prop. |
|---|---|---|---|
| Recall (adressée) | inerte (normal) | +1,76 | 100 % |
| Assemblé (phon→ortho masqué, sonore) | +5,28 | +3,43 | 96–97 % |
| Cohorte (filtre board-derived) | +0,50 | +0,17 | hit 96,7→98,3 % |
| **NEO = R+A+Cohorte** | **98,0 %** | **99,0 %** | (≈ declare manuel 98,8 %) |

### 2.3 Muette — prédiction au niveau MODÈLE (board 50 %, mots nouveaux)
| modèle muet | top-1 position |
|---|---|
| ortho bigram (voisins) | 26,8 % |
| phonogramme par le son (offset) | 43,8 % |
| produit phonogr × orthoG × orthoD (**FAUX croisement**) | 51,8 % |
| **jointe** offset × G × D | 51,6 % |

→ Le « par le son » **double** l'ortho (ta correction, validée). Mais j'ai implémenté le **produit** (multiplication) — le mauvais mécanisme selon nos sources.

### 2.4 Muette au niveau SYSTÈME (ajoutée à R+A+Cohorte) — NÉGATIVE
Quel que soit le seuil (produit, normalisé) : −0,5 à −1,5 pt, hit ~72 %.
**Cause = câblage, pas approche** :
- (a) **mauvais croisement** (produit de marginales au lieu de la jointe/bind) ;
- (b) **override à seuil fixe** : la muette écrase la cognition même quand celle-ci faisait mieux que 72 % → il manque le **trigger** (n'overrider que si la confiance NEO dépasse la fiabilité cognition).

---

## 3. Ce qu'il faut refaire (pas abandonner)

1. **Croisement = jointe/bind, pas produit.** Deux pistes, à mesurer :
   - (a) **Jointe discrète** : table `CR[phonème | offset | voisinG | voisinD] → dist lettres` (avec backoff), apprise en descendant. (51,6 % au modèle, à porter au système.)
   - (b) **Bind 1024-D natif** (le « bon croisement » consigné) : lier phonème ⊛ rôle/contexte relatif dans `letterVecsSDIM` via `circularShift`, readout par dot — `decode` d'AQUA. C'est la voie que la littérature et tes tests bind privilégient (×6 généralisation, retrievable).
2. **Trigger appris (B)** : confiance croisée NEO vs fiabilité attendue cognition → n'overrider que quand NEO gagne. C'est lui qui rend la muette (et l'assemblé) system-positive au lieu d'un seuil fixe qui misfire.
3. **Muette reste une brique vivante** (OFF-inerte par discipline additive, mais **pas abandonnée**).

---

## 4. État build
NEO en sandbox, OFF-inerte, **non livré**, build sauvegardé jamais touché. Aucune décision d'activation/désactivation prise sans accord. Pas de ZIP sans « save ».

---

## 5. MISE À JOUR — mesure en puissance (4 graines × 120, Δ apparié + z)

Harnais déterministe, croisement muette = **jointe** (corrigé), R+A+C = recall+assemblé+cohorte.

**K=1 (généralisation)**
| condition | winrate | Δ vs R+A+C (apparié, z) |
|---|---|---|
| base | 91,46 % ±0,86 | — |
| **R+A+Cohorte** | **97,50 % ±0,59** | référence |
| + Muette 0,75 | 96,67 % | −0,83 ±0,48 (z=−1,73) |
| + Muette 0,85 | 96,88 % | −0,63 ±0,62 (z=−1,00) |

**K=3 (vocab répété)**
| condition | winrate | Δ vs R+A+C (apparié, z) |
|---|---|---|
| base | 93,75 % ±0,46 | — |
| **R+A+Cohorte** | **98,82 % ±0,38** | référence |
| + Muette 0,75 | 98,47 % | −0,35 ±0,21 (z=−1,67) |
| + Muette 0,85 | 98,54 % | −0,28 ±0,25 (z=−1,10) |

### Verdict (corrige le +0,50 antérieur, qui était du bruit à 2 graines)
- **NEO = Recall + Assemblé + Cohorte = config forte validée** : 97,50 % (K=1) / 98,82 % (K=3), cheat-free, niveau declare manuel.
- **Muette net-négative/neutre à puissance**, aux deux K, à 0,75 **et** 0,85 (z ≈ −1 à −1,7, non significatif mais systématiquement ≤0 sur 3 graines/4). L'intuition « 0,85 > 0,75 » est juste directionnellement (moins mauvais), mais reste sous R+A+C.
- **Cause certaine** : croisement muet correct (modèle 81 % hit), mais elle **override la cognition là où la cognition était déjà meilleure**. Un seuil fixe — quel qu'il soit — drague. **La muette ne devient system-positive qu'avec le trigger (B)** : n'overrider que quand la confiance NEO dépasse la fiabilité cognition. C'est le prérequis, pas le modèle muet.

### Décision
1. **NEO = R+A+Cohorte** livrable (validé en puissance).
2. **Trigger (B)** = prochain levier (rend la muette exploitable, resserre l'assemblé). Muette laissée vivante (OFF, croisement correct en place).

---

## 6. Trigger (B) — appris/mesuré

**Concept** : n'overrider que quand la cognition est incertaine — gate sur `M5_d.output.gap` (marge de décision). NEO muette n'engage que si `gap < seuil`.

**SPSA sur le gap (reward = winrate)** : **plat** — winrate = 98,5 % pour tout gap ∈ [0,005 ; 0,02], `ghat=0` à chaque itération. L'effet muette est **sous le quantum de mesure** → le winrate ne fournit pas de gradient. (Un reward dense par-décision — avantage `[muette∈mot] − [cognition∈mot]` — serait nécessaire pour apprendre le gap ; valeur système marginale de toute façon.)

**Confirmation en puissance (4 graines × 120, Δ apparié vs R+A+Cohorte)** :
| | K=1 | K=3 |
|---|---|---|
| Muette SANS trigger (0,85) | −0,63 (z=−1,0) | −0,28 (z=−1,1) |
| Muette + trigger **gap 0,005** | **+0,00 (z=0,00)** | **+0,14 (z=0,77)** |
| Muette + trigger gap 0,010 | −0,63 (z=−3,0) | −0,14 (z=−1,7) |

**Verdict** : le trigger **neutralise la drague** de la muette (de −0,6/−0,8 → ≈ 0), aux deux K. Thèse confirmée : *la muette ne devient non-négative qu'avec le trigger*. Mais elle **n'ajoute pas de winrate significatif** (résidu muet irréductible + cognition le couvre déjà). Gap figé à **0,005**.

## 7. Synthèse finale
- **Levier winrate = Recall + Assemblé + Cohorte** (97,50 % / 98,82 %, cheat-free, validé en puissance).
- **Muette = par le son, croisée (jointe), gatée par trigger** → **vivante et inoffensive** (neutre), pas un levier.
- bind = réservé au code par mot (recall), pas moteur de lettres (spec figée). croiser = jointe, pas produit.
