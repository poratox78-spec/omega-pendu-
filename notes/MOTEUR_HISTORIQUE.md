# OMEGA moteur — HISTORIQUE consolidé des notes (NEO, muette, M3_d, cheat)

> **Archive consolidée** des 5 notes `notes/` antérieures (NEO-brique-par-brique, NEO-changelog,
> NEO-muette-croisement, M3D-reconnexion-FALSIFIE, AUDIT_CHEAT_apprentissage_g2p), regroupées le
> 2026-06-19. **Les chiffres CANONIQUES à jour vivent dans `AUDIT_OMEGA.md`** ; ce fichier garde la
> genèse et les résultats falsifiés (doctrine §6 : pas de cimetière, on consigne les négatifs).
> Date d'origine du travail : 03-14/06/2026. Tout OFF-inerte, baseline byte-identique.

---

## A. Méthodologie — le correctif de déterminisme (préalable à toute mesure)

La config Rem (apprentissage en ligne + bPC) rendait **la base non déterministe** entre runs d'un même
process (même graine : 112/111/109 victoires) → **tous les Δ mesurés ainsi étaient du bruit**. Causes : état
persistant non réinitialisé par `initOmegaGlobals` — `_OSL` (θ en ligne), `M_OS_v07.alpha/beta` (cible θ),
`M3_d.bpcW` (semé par le RNG résiduel du run précédent).

**Correctif harnais, par run** (toujours appliqué depuis) :
```
_omegaSeed=sd; _omegaRng=makeMulberry32(sd); initOmegaGlobals();   // reseed AVANT init → bpcW déterministe
if (_omega_OSL_reset) _omega_OSL_reset();                          // reset θ en ligne
M_OS_v07.alpha=1; M_OS_v07.beta=1;                                 // reset cible de déploiement θ
_omegaRng=makeMulberry32(sd);                                      // RNG de jeu aligné
```
→ déterminisme rétabli (112/112/112). C'est la base des harnais `evo/*` (cf. `AUDIT_OMEGA §1.3`).

---

## B. Declare NEO — brique par brique (cheat-free, émergent, additif)

NEO = nouveau declare **additif** (`M_DECLARE_NEO_ENABLED`, OFF par défaut), **sans modifier les 5 declares
existants**. Doctrine : montant = révélé seul (cap §43) ; descendant = post-partie ; `w.p` (prononciation) =
entrée légitime ; align **masqué** (positions cachées → émission uniforme, aucun graphème caché) ; cohorte
**board-dérivée** (lexique autorisé pour DECLARE, jamais pour le scoring-lettre). bPC M3_d peut être ON ; NEO
**n'est pas** `M_BPC_DECLARE`.

| Brique | rôle | apport | verdict |
|---|---|---|---|
| **Recall** (adressée) | reconnaît un mot vécu (VSA, board révélé + banc) | +0,00 K=1 (inerte sur mot neuf) · **+1,76 K=3** · 100 % sur vécu | **ON** |
| **Assemblé** (phon→ortho masqué) | décode positions sonores via `L2[phonème]` | **+5,28 K=1** / +3,43 K=3 · hit 96-97 % | **ON** |
| **Cohorte** (filtre board-derived) | n'autorise une lettre que si ≥1 mot board-compatible la porte | +0,50 K=1 · hit 96,7→**98,3 %** | **ON** (le bon levier) |
| **Muette** (par le son) | positions sans phonème, croisée (jointe) | ~0 / −0,28 seul → neutre avec trigger | OFF (cf. §D) |
| **Trigger** | n'engage que si cognition incertaine (`gap` faible) | gate | OFF (cf. §D) |

**CANONIQUE (4 graines × 120, harnais déterministe, Δ apparié) — NEO = Recall + Assemblé + Cohorte :**
- **K=1 : 97,50 % ±0,59** (base 91,46) · **K=3 : 98,82 % ±0,38** (base 93,75) — niveau declare manuel, cheat-free.

> ⚠️ *Supersession* : la 1re mesure « 92→98 % K=1 » (2 graines, NEO-brique-par-brique) était **optimiste/bruitée** ;
> le chiffre robuste est **97,50 %** (4 graines). Plus tard adopté : **DUAL** (modèle de mot, +1,8 → 99,8 % mot-entendu
> / +2,5 → 97,3 % sans currentWord) — voir `AUDIT_OMEGA §1.5`.

UI : 6 toggles NEO (maître + recall/assemblé/cohorte/muette/trigger) + paramètres (`NEO_CONF` 0,75, `RECALL_MARGIN`
0,20, `MUTE_CONF` 0,85, `TRIGGER_GAP` 0,005). Tous OFF-inerte, baseline byte-identique vérifiée.

---

## C. Croiser = JOINTE, pas produit ni somme (le mécanisme, sourcé)

Correction doctrinale de Rem : un produit `phonogr × orthoG × orthoD` est un **produit de marginales** (hypothèse
d'indépendance) — **ce n'est PAS le croisement**. Le croisement correct = **jointe** `P(lettre | phonème, contexte)`,
ou son équivalent vectoriel : **bind** (liaison HRR 1024-D) du phonème et du contexte ortho relatif, lu par produit
scalaire. Sources : Plate (1995, HRR) ; **Resonator networks** (Frady et al. 2020 : « ne pas multiplier aveuglément ») ;
DRC (Coltheart 2001, double route fusionnée). Tests bind consignés : `phon ⊗ phon` (corrélé) → **collapse** (mauvais) ;
`bind(lettre, rôle)` 1024-D → 0 cellule morte, ×6 généralisation, 100 % retrievable (bon — partenaire décorrélant).
**Le bind est une mémoire associative par-mot (recall), PAS un moteur de prédiction de lettres** (spec figée : 19 % vs
64 % EM en dictionnaire global — mur de capacité).

**Mesuré au niveau MODÈLE** (muette, board 50 %, mots neufs, top-1 position) :

| modèle | top-1 |
|---|---|
| ortho bigram (voisins) | 26,8 % |
| phonogramme par le son (offset) | 43,8 % |
| **produit** phonogr×orthoG×orthoD (FAUX croisement) | 51,8 % |
| **jointe** offset × G × D (bon mécanisme) | 51,6 % |

→ Le « par le son » **double** l'ortho ; le produit coïncide numériquement avec la jointe **mais reste le mauvais
mécanisme** (composera le bruit ailleurs). La jointe est la forme canonique (cf. mémoire §6, `AUDIT_OMEGA §1.2`).

---

## D. Muette + trigger — vivante mais inoffensive (pas un levier)

Ajoutée à R+A+Cohorte, la muette est **net-négative à seuil fixe** (override la cognition même quand celle-ci faisait
mieux) : K=1 −0,63/−0,83 (z≈−1 à −1,7), K=3 −0,28/−0,35, systématiquement ≤0 sur 4 graines. Cause = **câblage** (override
à seuil fixe), pas l'approche.

**Trigger (B)** = n'overrider que si la cognition est incertaine (gate sur `M5_d.output.gap`) :

| | K=1 | K=3 |
|---|---|---|
| Muette sans trigger (0,85) | −0,63 (z=−1,0) | −0,28 (z=−1,1) |
| Muette + trigger **gap 0,005** | **+0,00 (z=0,0)** | **+0,14 (z=0,8)** |
| Muette + trigger gap 0,010 | −0,63 | −0,14 |

**Verdict** : le trigger **neutralise la drague** (−0,6/−0,8 → ≈0) mais n'ajoute **pas** de winrate (résidu muet
irréductible, déjà couvert par la cognition). **SPSA sur le gap = plat** (winrate constant → gradient nul ; l'effet est
sous le quantum de mesure). Muette **vivante et inoffensive**, OFF, gap figé 0,005. Pas un levier.

---

## E. Reconnexion M3_d via le banc recall — FALSIFIÉ (R66)

> ⚠️ **Périmètre.** Falsifié ici = **une voie précise** (loger le banc épisodique dans M3_d / réinjecter le concept dans
> le scoring-lettre via M4). **PAS « M3_d est inutile »** : son **readout-récompense `cLetterScore`** rapporte **+3,4 pts
> cheat-free** (8 graines, jamais sous 0 ; `AUDIT_OMEGA §3.1`). M3_d est un **contributeur réel** hors-A2.

Sonde (config Rem) : cellules concept **quasi-collapsées** — cross-mot cosine **0,9479**, 1 cellule domine 35/39,
9/12 jamais dominantes → 12 cellules ne couvrent pas l'espace (mur de capacité Kanerva/DBPC). Banc = Map externe exacte
(recall 100 %), séparée de M3_d. Sous bPC, `M3_d.output` = 0 (découplé).

**Mesure** (cognition, 3 graines × 100) — injecter le mot rappelé comme concept dans M4_d :

| | OFF | ON | Δ |
|---|---|---|---|
| K=1 (marge 0,20) | 91,00 % | 89,67 % | **−1,33** |
| K=3 (marge 0,20) | 96,56 % | 96,00 % | −0,56 |
| K=1 marge 0,35-0,65 | 91,00 % | 89,00 % | **−2,00** (pire) |

**Verdict : falsifié.** Le concept rappelé **contamine le scoring-lettre** (biais vers les lettres du mot rappelé,
faux sur mot neuf) ; resserrer la marge **empire**. **Reverté.** Leçon : le recall épisodique est **optimalement placé
dans l'override declare** (NEO recall, +1,76, propre) ; le chemin **concept→M4 est le mauvais endroit**. Ne pas reproposer.

---

## F. Audit triche — apprentissage en ligne & g2p « appris en jouant » : CHEAT-FREE

Question (cap §43) : l'apprentissage et le g2p « appris en jouant » lisent-ils le mot caché pour **décider** ?
Lecture du code (`app/omega-pendu.html`) :
- `M_EMERGENT_G2P_ONLINE` : `learn(currentWord)` appelé **dans `endCurrentGame()`** → **descendant** (après décision).
  Lit `wp.get(word)` = phonologie (entrée légitime « mot entendu »), aligne phon→graphème post-partie.
- À l'inférence : `align(currentWord, ph, revealedMask)` → positions non révélées = distribution **UNIFORME** (jamais
  de graphème caché) ; propositions seulement aux positions révélées, depuis la table **L2 apprise**.
- Recall NEO : `_emrg_bind(currentWord, revealedMask)` (révélé seul) ; mot rappelé = banc des parties passées.
- `M_OS_LEARNING_ONLINE` : apprend du **résultat** (gagné/perdu), pas du mot ; descendant (OFF pour la dérive, pas la triche).

**Verdict : tout l'apprentissage est descendant ; à la décision l'alignement est masqué → cheat-free, conforme cap §43**
(cohérent mémoire §8.4 : le test décisif = ce qui est lu à l'inférence).

---

*Pour l'état courant et les chiffres canoniques : `AUDIT_OMEGA.md`. Pour la config/toggles : `docs/CONFIG_TOGGLES.md`.
Pour la littérature cognitive et le design du C : `docs/COGNITION_DESIGN.md`.*
