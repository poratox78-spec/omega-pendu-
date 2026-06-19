# Mémoire & cognition — ce qu'il faut pour GÉNÉRALISER + solutions, mappé à OMEGA

> Revue littérature (2026-06-19) demandée par Rem après le diagnostic OOV : *« OMEGA ne gagne ni par mémorisation
> ni par apprentissage-par-jeu — vrai problème ; check littérature mémoire/cognition + solutions probables (dont
> localStorage, ml5.js) ».* Méthode : recherche multi-angles (CLS · hub sémantique · codage prédictif · mémoire
> séquentielle/associative · JS pratique). ⚠️ `WebFetch` 403 toute la session → citations via extraits de recherche
> (paraphrase-fidèle, claims solides) ; le volet VSA vient du domaine établi (non re-fetch cette session).

## Thèse unificatrice (les 5 angles convergent)
**Généraliser = AGRÉGER lentement la structure d'un corpus dans des poids/stats réutilisables** (néocortex / modèle de
contexte). **Mémoriser = stocker vite des instances** (hippocampe / k-NN / mémoire associative). Les deux sont
**complémentaires et séparés à dessein**. OMEGA gagne (un peu) par **mémorisation + oracle**, presque rien par
**agrégation cognitive** → d'où ~11 % OOV de la cognition vs ~57-66 % d'un n-gram (agrégation). **Le levier est
l'agrégation de structure**, pas la mémoire d'instances ni la récompense-par-partie.

## 1. Complementary Learning Systems (McClelland 1995 · Kumaran/Hassabis/McClelland 2016)
- Deux systèmes : **hippocampe** = rapide, *pattern-separated*, stocke les **instances** ; **néocortex** = lent,
  représentations *chevauchantes*, **extrait la structure statistique** et généralise.
- *« Sparse, pattern-separated representations … support recall, but do NOT allow the extraction of statistical
  structure »* → une mémoire **k-NN ne généralise pas** (c'est l'hippocampe).
- La généralisation émerge *« if learning of each item is gradual and interleaved with learning about other items »*
  → **agrégation lente entrelacée** sur le corpus. Un pas rapide/séquentiel = **interférence catastrophique**
  (McCloskey & Cohen 1989).
- **Consolidation/replay** : l'hippocampe *replay* les épisodes pour entraîner hors-ligne le cortex (l'entrelacement).
  Raccourci ingénierie = **précalculer les stats du corpus** = « ce que le cortex aurait extrait ».
- **MAPPING OMEGA** : le **recall (`_emrgBank`) = hippocampe** (instances). Il **manque le cortex** = des poids lents
  agrégés. Le **n-gram pré-calculé = le cortex substitué**. (Et c'est déjà le paradigme gagnant du correcteur dys :
  cgram/conjugaison = stats du corpus.)

## 2. Hub sémantique « hub-and-spoke » (Patterson/Nestor/Rogers 2007 · Lambon Ralph 2017)
- Un **hub transmodal** généralise en **distillant la structure de similarité partagée** à travers des **spokes
  RICHES et structurés** — pas en stockant des exemplaires.
- Un hub nourri d'**un seul signal faible/global** *n'a rien à distiller* → pas de concept généralisable.
- **MAPPING OMEGA** : `M3_d` (12 cellules) / `M_S` (hub) reçoivent un **concept global/longueur** (§1.4.2) → *rien à
  distiller* → ~11 %. Prescription : donner au hub des **spokes contextuels riches** (n-grams de lettres, voisins
  phon, cgram, contexte local).

## 3. Codage prédictif (Rao & Ballard 1999 · Friston 2010 · Clark 2013)
- Le cerveau = machine à **prédiction hiérarchique** : le **descendant porte des PRÉDICTIONS**, le **montant porte
  l'ERREUR de prédiction** résiduelle. Apprentissage **dense, auto-supervisé** : chaque entrée enseigne P(entrée|contexte).
- Une **récompense rare** ne peut PAS enseigner la conditionnelle P(suivant|contexte) (pas de structure du « pourquoi »).
- **MAPPING OMEGA** : c'est exactement la **doctrine §3 (jointe Σ_φ P(φ|p)·P(lettre|φ,contexte))**, et le contraire de
  l'**apprentissage-par-partie** (récompense rare). Le descendant d'OMEGA réinjecte des **priors globaux**
  (letterPenalty/zonePenalty), jamais une **prédiction contextuelle** → §1.8.1.

## 4. Mémoire séquentielle & associative (Bengio 2003 · Hopfield · Ramsauer 2020 · Khandelwal 2020)
- **n-gram → RNN/LSTM → Transformer** : le neuronal apprend des **représentations distribuées** → *« une séquence
  jamais vue reçoit une proba élevée si faite de mots similaires »* → **généralise** à l'inédit. PTB perplexité :
  **KN5-gram ~141 → LSTM/Transformer-XL ~55** (le saut comptage→appris).
- **Hopfield classique** : capacité **≈ 0,138·N** patterns ; **récupère du stocké** (mémorisation), pas de généralisation.
- **Hopfield moderne (Ramsauer 2020)** : capacité **exponentielle**, récupération en 1 pas, et **l'update = l'ATTENTION
  des transformers** → **attention = récupération de mémoire associative**.
- **kNN-LM (Khandelwal 2020)** : le k-NN aide le **long-tail** (ppl 18,65→15,79) MAIS **échoue en OOD** (rien de stocké
  à compléter) ; c'est le **modèle appris** qui porte la généralisation.
- **MAPPING OMEGA** : prédire une lettre depuis les voisins sur un mot **inédit = problème OOD** → la **récupération
  d'instances échoue** (comme Hopfield sans pattern stocké) ; il faut un **modèle de contexte agrégé** (n-gram, ou
  petit RNN/attention).

## 5. VSA / HRR / SDM (Plate 1995 · Kanerva · survey Schlegel/Neubert/Protzel 2021) — domaine établi
- VSA/HRR = vecteurs distribués + **binding** (convolution circulaire) + **bundling** (superposition) + **similarité**
  (cosinus). Excellents pour la **structure compositionnelle** et le **stockage/rappel rapide**.
- **Capacité limitée** : le **crosstalk croît avec le nombre d'items superposés** ; la capacité de bundling/séquence
  est bornée (~O(D/log D) items récupérables avant que le bruit domine) → dégrade sous charge.
- **SDM (Kanerva)** = mémoire associative adressable par contenu ; généralise par **rayon de similarité**, **pas** en
  apprenant des conditionnelles.
- **MAPPING OMEGA** : le **substrat hyperdimensionnel + recall holographique** sont structurellement une **mémoire
  associative** — **bons** au binding/rappel rapide, **mauvais** pour la **généralisation statistique de
  conditionnelles** et **dégradent sous superposition**. Cohérent avec tout le reste. *(À re-citer précisément quand
  WebFetch sera dispo : Plate 1995 HRR ; Frady/Kleyko/Sommer sur la capacité.)*

## 6. JS pratique (MDN · TensorFlow.js · ml5.js) — tes deux pistes
- **localStorage** : ~**5 Mo**/origine, **strings** (JSON), **synchrone** (bloque) → réservé aux **petits scalaires**
  (profil élève, prefs dys, compteurs de session).
- **IndexedDB** : **asynchrone, transactionnel, structuré**, quota **dynamique = % du disque** (Chrome jusqu'à 60 %/
  origine ; des **GB**) → le bon endroit pour **persister la table n-gram/cgram** entre sessions.
- **TensorFlow.js / ml5.js `charRNN`** : RNN caractère, backends WebGL/WASM, save/load via **`indexeddb://`** ; mais
  **entraînement hors-ligne** (Python), poids chargés ensuite. Appris/opaque/lourd.
- **Reco du volet** : **table n-gram pré-calculée dans IndexedDB** (simple, exacte, généralise, ~0 calcul, alignée
  « cognition>oracle ») **>** charRNN (à réserver si la sparsité du n-gram devient un mur).

## DÉCISION (à Rem) — deux chemins cohérents, tous deux = AGRÉGATION
| | (a) Stats agrégées PERSISTÉES | (b) Représentation APPRISE |
|---|---|---|
| Quoi | n-gram/cgram pré-calculé du lexique, persisté **IndexedDB** | charRNN/LSTM (tfjs/ml5) **ou** compléter la cognition (spokes contextuels + erreur de prédiction) |
| Généralise | oui (~57-66 % OOV mesuré) | oui (au-delà de la sparsité n-gram) |
| Coût | quasi nul, exact, interprétable, doctrine | lourd, opaque, entraînement hors-ligne |
| Statut littérature | = « cortex précalculé » / raccourci replay CLS | = « construire le cortex » (hub riche + codage prédictif) |
| **Reco** | **D'ABORD ça** | seulement si (a) bute sur la sparsité |

**Le vrai « C » cognitif** (si un jour) — ce que la littérature prescrit *conjointement* : donner au hub/concept des
**spokes contextuels RICHES** (hub-and-spoke) + l'entraîner par **erreur de prédiction P(lettre|contexte) sur le corpus,
entrelacé** (codage prédictif + CLS), **pas** par récompense-par-partie ni un seul trait global. Mesurer son Δ
**au-dessus** du substrat n-gram (le vrai test de la thèse « cognition > oracle »).

## Sources (principales)
- McClelland, McNaughton & O'Reilly 1995, *Psychol. Review* 102:419 · Kumaran, Hassabis & McClelland 2016, *TiCS*
  20:512 · McCloskey & Cohen 1989 (interférence catastrophique).
- Patterson, Nestor & Rogers 2007, *Nat. Rev. Neurosci.* 8:976 · Lambon Ralph et al. 2017, *NRN* 18:42 · Rogers et al.
  2004, *Psychol. Review* 111:205.
- Rao & Ballard 1999, *Nat. Neurosci.* 2:79 · Friston 2010, *NRN* 11:127 · Clark 2013, *BBS* 36:181.
- Bengio et al. 2003, *JMLR* 3 · Amit/Gutfreund/Sompolinsky 1985 (capacité 0,138N) · Ramsauer et al. 2020 « Hopfield
  Networks is All You Need » · Khandelwal et al. 2020 « Generalization through Memorization » (kNN-LM).
- Plate 1995 (HRR) · Kanerva 1988/2009 (SDM, hyperdim) · Schlegel/Neubert/Protzel 2021 (VSA survey).
- MDN Web Storage / IndexedDB · TensorFlow.js `save_load` · ml5.js `charRNN` / ml5js/training-charRNN.
