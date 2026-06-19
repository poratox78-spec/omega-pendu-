# Cognition & mémoire — littérature, état M3_d, et design d'un organe (consolidé)

> **Consolidation (2026-06-19)** de `MEMOIRE_COGNITION_LIT.md` (revue littérature) + `ORGANE_COGNITION_DESIGN.md`
> (état M3_d + candidats de design). Commandé par Rem après le diagnostic OOV (« OMEGA ne gagne ni par mémorisation
> ni par apprentissage-par-jeu »). Méthode = **recherche d'abord**, mesurer avant de bâtir (doctrine §1/§4).
> Chiffres canoniques : `AUDIT_OMEGA.md §1.7-§1.12`.

---

# PARTIE I — Ce qu'il faut pour GÉNÉRALISER (revue littérature)

## Thèse unificatrice (les angles convergent)
**Généraliser = AGRÉGER lentement la structure d'un corpus dans des poids/stats réutilisables** (néocortex / modèle
de contexte). **Mémoriser = stocker vite des instances** (hippocampe / k-NN / mémoire associative). Les deux sont
**complémentaires et séparés à dessein**. OMEGA gagne (un peu) par **mémorisation + oracle**, presque rien par
**agrégation cognitive** → ~11 % OOV de la cognition seule vs ~57-66 % d'un n-gram (agrégation). **Le levier est
l'agrégation de structure**, pas la mémoire d'instances ni la récompense-par-partie.

## 1. Complementary Learning Systems (McClelland 1995 ; Kumaran/Hassabis/McClelland 2016)
Hippocampe = rapide, *pattern-separated*, stocke les **instances** ; néocortex = lent, représentations chevauchantes,
**extrait la structure statistique** et généralise. Une mémoire **k-NN ne généralise pas** (c'est l'hippocampe). La
généralisation émerge *« if learning is gradual and interleaved »* (agrégation lente entrelacée) ; un pas rapide/
séquentiel = **interférence catastrophique** (McCloskey & Cohen 1989). Consolidation/replay = l'hippocampe entraîne
hors-ligne le cortex ; **raccourci ingénierie = précalculer les stats du corpus** (« ce que le cortex aurait extrait »).
→ **OMEGA** : recall (`_emrgBank`) = **hippocampe** (instances) ; il **manque le cortex** = poids lents agrégés ; le
**n-gram pré-calculé = le cortex substitué** (déjà le paradigme gagnant du correcteur dys : cgram/conjugaison).

## 2. Hub sémantique « hub-and-spoke » (Patterson 2007 ; Lambon Ralph 2017 ; Rogers 2004)
Un **hub transmodal** généralise en **distillant la structure de similarité** à travers des **spokes RICHES** — pas en
stockant des exemplaires. Un hub nourri d'un **signal global pauvre** *n'a rien à distiller*. → **OMEGA** : `M3_d`
(12 cellules) / `M_S` reçoivent un **concept global/longueur** (§1.4.2) → rien à distiller → ~11 %. **Prescription :
spokes contextuels riches** (n-grams de lettres, voisins phon, cgram, contexte local).

## 3. Codage prédictif (Rao & Ballard 1999 ; Friston 2010 ; Clark 2013)
Cerveau = prédiction hiérarchique : **descendant = prédictions**, **montant = erreur** résiduelle ; apprentissage
**dense, auto-supervisé** (chaque entrée enseigne P(entrée|contexte)). Une **récompense rare** ne peut PAS enseigner la
conditionnelle. → c'est la **doctrine §3 (jointe `Σ_φ P(φ|p)·P(lettre|φ,contexte)`)**, le contraire de l'apprentissage-
par-partie. Le descendant d'OMEGA réinjecte des **priors globaux** (letterPenalty/zonePenalty), jamais une prédiction
contextuelle (§1.8.1).

## 4. Mémoire séquentielle & associative (Bengio 2003 ; Hopfield ; Ramsauer 2020 ; Khandelwal 2020)
**n-gram → RNN/LSTM → Transformer** : le neuronal apprend des **représentations distribuées** → généralise à l'inédit
(PTB : KN5-gram ~141 ppl → LSTM/Transformer-XL ~55, le saut comptage→appris). **Hopfield classique** : capacité ≈0,138·N,
récupère du stocké (mémorise). **Hopfield moderne** (Ramsauer 2020) : capacité exponentielle, et **l'update = l'ATTENTION
des transformers** (attention = récupération de mémoire associative). **kNN-LM** (Khandelwal 2020) : le k-NN aide le
long-tail mais **échoue en OOD** ; c'est le **modèle appris** qui porte la généralisation. → **OMEGA** : prédire une
lettre sur un mot **inédit = OOD** → la récupération d'instances échoue ; il faut un **modèle de contexte agrégé**
(n-gram, ou petit RNN/attention).

## 5. VSA / HRR / SDM (Plate 1995 ; Kanerva ; Schlegel/Neubert/Protzel 2021)
VSA/HRR = vecteurs distribués + **binding** (convolution circulaire) + **bundling** + similarité (cosinus). Excellents
pour la structure compositionnelle et le **rappel rapide**, **mauvais** pour la **généralisation statistique de
conditionnelles**, et **dégradent sous superposition** (crosstalk ~O(D/log D)). SDM (Kanerva) = mémoire adressable par
contenu, généralise par rayon de similarité, **pas** en apprenant des conditionnelles. → **OMEGA** : le substrat
hyperdimensionnel + recall holographique sont structurellement une **mémoire associative** (bons au binding/rappel,
mauvais pour les conditionnelles).

## 6. JS pratique (persistance & apprentissage navigateur)
- **localStorage** : ~5 Mo/origine, strings, synchrone → **petits scalaires** (profil élève, prefs dys, compteurs).
- **IndexedDB** : asynchrone, transactionnel, quota = % du disque (des GB) → le bon endroit pour **persister une table
  n-gram/cgram** ou des **poids appris** entre sessions.
- **tfjs / ml5 `charRNN`** : RNN caractère, save/load `indexeddb://`, mais **entraînement hors-ligne** (poids chargés
  ensuite) — appris/opaque/lourd.

## Décision littérature — deux chemins, tous deux = AGRÉGATION
| | (a) Stats agrégées PERSISTÉES | (b) Représentation APPRISE |
|---|---|---|
| Quoi | n-gram/cgram pré-calculé, persisté IndexedDB | charRNN/LSTM, ou hub riche + erreur de prédiction |
| Généralise | oui (~57-66 % OOV mesuré) | oui (au-delà de la sparsité n-gram) |
| Coût | quasi nul, exact, interprétable, doctrine | lourd, opaque, hors-ligne |
| Statut | « cortex précalculé » (raccourci replay CLS) | « construire le cortex » (hub riche + codage prédictif) |
| **Reco** | **D'ABORD ça** | seulement si (a) bute sur la sparsité |

---

# PARTIE II — État M3_d & design d'un organe (mesuré)

## 0. État de M3_d — FACTUEL + MESURÉ
- **M3_d non touché** par le chantier OOV/C (byte-identique, `git diff`). Le cortex n-gram/gap **n'utilise PAS** M3_d
  (`_neoDeclareOSmix`/`_neoLetterNgramDist`/gap lisent n-gram + cohorte board + `_neoCRS` + L2, jamais `M3_d`/`conceptCells`).
- **Preuve par bypass** (voie n-gram gap-aware OS, N=400) : winrate **identique** M3_d actif vs `M3_D_BYPASS` —
  **OOV 63,5 / 63,5 % · in-lex 97,5 / 97,5 %**. ⇒ M3_d tourne mais **sa sortie est jetée** (sous bPC `M3_d.output`=0).
- **Rôle vivant restant** : (a) `cLetterScore` dans la base in-lex SANS l'organe NEO (**+3,4 cheat-free**, §3.1) ;
  (b) hypothèse **signal de stade dictée** (latent de FORME, §3) — non mesurée, hors pendu.
→ **M3_d = winrate-inerte** ; pas le bon « hub » (spoke pauvre = longueur, §1.8.2). Ni construire l'organe dessus, ni
le laisser décider.

## 1. Contraintes dures (la mesure a tranché — ne pas re-litiger)
| Brique | Statut mesuré | Conséquence design |
|---|---|---|
| Cortex agrégé (n-gram + gap-aware, §1.7/1.9/1.10) | OOV ~63-65 % (bande SOTA), in-lex ~97 % | **l'organe de généralisation EXISTE**, indépendant de M3_d |
| Cognition M3_d / double-route | ~11 % OOV seule ; winrate-inerte | **pas** le levier ; à sortir de la décision |
| C *léger* appris (maxent/GATE/POE, §1.11) | tous < gap-aware | **falsifié** ; le plus proche voisin domine |
| **C *lourd* appris (transformer, §1.12)** | **parité avec gap-aware** au winrate config optimale (OOV Δ −1,3, perd 2/3 graines) ; entraîné sur états réels = **recul** (couverture) | **falsifié comme franchissement** ; ne pas câbler |
| Mémoire / recall (`_emrgBank`) | recall OFF ≈ ON sur le pendu | inerte sur le pendu ; utile hors-pendu (dictée) |
| Décision globale | **cascade d'overrides** (last-writer-wins) | ad hoc, non principiel → candidat n°1 à remplacer |

## 2. Apport littérature neuf — Mixture/Product of Experts & gating par fiabilité
- **Interpretable MoE (IME)** : experts simples/linéaires → MoE **intrinsèquement interprétable** (compatible « cognition
  > oracle »).
- **Gating par INCERTITUDE (MoGU)** : gating dérivé de la confiance interne des experts — **exactement** ce que fait déjà
  `M_OS_v07` (fiabilité = piqué/confiance de chaque voie). L'arbitrage OS est donc une **brique MoE-incertitude** validée ;
  le **manque** = l'**apprendre** et l'étendre à **N voies** (l'OS n'arbitre que 2).

→ La littérature pointe vers le **hub d'arbitrage appris, gaté par fiabilité, à experts interprétables** — le hub-and-spoke
fait correctement, là où M3_d a échoué.

## 3. Candidats d'organe (évalués)
**(A) Hub d'arbitrage appris.** Spokes = les voies réelles (cortex n-gram/gap, cohorte, recall, base) ; le hub **apprend**
à les pondérer par fiabilité/incertitude (généralise l'OS à N voies, entraîné par erreur de prédiction « quelle voie
était correcte »). Remplace la cascade last-writer-wins. *Pour* : hub-and-spoke + MoE-incertitude + codage prédictif
alignés, experts interprétables, **winrate mesurable** vs cascade. *Risque* : la cascade marche déjà (97,5 % in-lex) → gain
peut-être marginal ; **à mesurer** (sinon on garde la cascade, R66).

**(B) Organe mémoire / hippocampe (CLS).** *Pour* : complète la paire CLS, sert la mémoire inter-parties + le modèle de
l'apprenant (dictée). *Contre* : **inerte sur le winrate pendu** ; le besoin « mémoire apprenant » est déjà servi par le
localStorage du correcteur/dictée. **Déféré** (hors pendu).

**(C) Sortir M3_d + formaliser le cortex (hygiène).** Retirer M3_d du chemin de décision (gardé comme candidat signal de
stade dictée) ; nommer le cortex n-gram/gap organe de 1re classe. *Pour* : honnêteté architecturale, **risque nul**
(byte-identique). *Prérequis sain* à (A).

**(D) Organe neuronal lourd (attention/corrélations).** *Mesuré §1.12* : un transformer profond (cross-attn multi-têtes
+ FFN, grad-checké) **converge vers** le gap-aware mais **ne le bat pas** au winrate config optimale (parité dans le bruit ;
entraînement sur états réels = recul par manque de couverture). **Falsifié comme franchissement** — lourd/opaque pour un
gain nul-dans-le-bruit. **Déféré** (au-delà = SOTA-scale hors-ligne, arbitrage explicite requis).

## 4. Recommandation (mesurable, R66/§1/§4)
1. **(C) hygiène, risque nul** : sortir M3_d du chemin de décision (flag OFF-inerte), mesurer winrate inchangé (attendu : oui).
2. **(A) le nouvel organe, derrière flag, MESURÉ** : hub d'arbitrage appris (experts = voies, gaté par fiabilité, entraîné
   par erreur de prédiction cheat-free). **Critère d'adoption** : bat la cascade sur winrate **et** coups, in-lex **et** OOV,
   ≥3 graines. Sinon → falsifié, on garde la cascade.
3. **(B) mémoire** : déférée (inerte pendu ; à rouvrir si la cible bascule multi-session/dictée).
4. **(D) neuronal lourd** : **mesuré (§1.12), pas de franchissement** → ne pas câbler ; au-delà déféré à arbitrage explicite.

**Le « C cognitif » honnête n'est ni un détecteur-concept (M3_d) ni un réseau lourd (mesuré parité), mais un HUB
D'ARBITRAGE qui distille des spokes riches (les voies) par fiabilité apprise** — la seule piste « cognition > oracle »
encore ouverte qui soit légère, interprétable et mesurable au-dessus du plancher cortex.

---

## Sources
- McClelland, McNaughton & O'Reilly 1995 (*Psychol. Review* 102:419) · Kumaran, Hassabis & McClelland 2016 (*TiCS* 20:512) · McCloskey & Cohen 1989.
- Patterson, Nestor & Rogers 2007 (*NRN* 8:976) · Lambon Ralph et al. 2017 (*NRN* 18:42) · Rogers et al. 2004 (*Psychol. Review* 111:205).
- Rao & Ballard 1999 (*Nat. Neurosci.* 2:79) · Friston 2010 (*NRN* 11:127) · Clark 2013 (*BBS* 36:181).
- Bengio et al. 2003 (*JMLR* 3) · Amit/Gutfreund/Sompolinsky 1985 · Ramsauer et al. 2020 (« Hopfield Networks is All You Need ») · Khandelwal et al. 2020 (kNN-LM).
- Plate 1995 (HRR) · Kanerva 1988/2009 (SDM) · Schlegel/Neubert/Protzel 2021 (VSA survey).
- Interpretable MoE — arxiv 2206.02107 · MoGU (gating par incertitude) — arxiv 2510.07459 · MoE intrinsically interpretable — arxiv 2503.07639.
- MDN Web Storage / IndexedDB · TensorFlow.js / ml5.js `charRNN`.
