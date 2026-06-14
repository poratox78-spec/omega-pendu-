# Audit dictée diagnostique — 2026-06-14 (honnête, mesuré)

Constat : l'étiquette « terminée » était prématurée. Findings rangés par sévérité, avec preuves.

## 🔴 CRITIQUE — dictée de mots ISOLÉS mal posée pour 84 % des mots
- **522/620 mots du pool ont ≥1 homophone** (surtout flexionnels : *accroche/accroches/accrochent* = /akʁɔʃ/).
- En isolé, l'élève **ne peut pas** choisir la bonne graphie au son seul → l'outil pénalise une graphie **valide**.
- C'est la famille **morphosyntaxique/sémantique** : elle **exige le contexte (phrases)**.
- **Fix** : soit (a) mode isolé qui **accepte toute la famille d'homophones** comme correcte (et retire la notion d'« erreur homophone » sans contexte), soit (b) **dictée de phrases** (la vraie solution, gère accords + homophones), soit (c) pool restreint aux mots sans homophone (≈16 % → trop petit).

## 🟠 HAUT — dyslexie de SURFACE non détectée
- *bato→bateau* (plausible phonétiquement mais faux) = catégorie **« autre »**. Or c'est **la** signature de la dyslexie de surface.
- **Fix** : détecter « graphie phonologiquement plausible » (nécessite la phono de la tentative → règles graphème→phonème, ou comparer au phon cible).

## 🟠 HAUT — divergence module mesuré ≠ intégré
- `diagnostic.py` (mesuré 99,8 %) = 5 catégories ; app = 7 (inversion, ajout en plus).
- `test_set.tsv` **ne couvre pas** inversion/ajout (0 cas) → ces catégories sont **non validées** sur jeu étiqueté.
- **Fix** : source unique de la logique ; étendre `test_set` aux nouvelles catégories ; re-mesurer.

## 🟡 MOYEN
- **Mesure circulaire** : erreurs synthétisées = transformations détectées → rappel **surestimé**. Aucune donnée d'élève réel.
  **Fix** : corpus d'erreurs réelles (ou au moins synthèse indépendante du détecteur) ; mesurer précision ET rappel.
- **Casse non normalisée** : *Chat←chat* → « autre ». **Fix** : comparer en normalisant la casse.
- **Pas de remédiation/progression** : diagnostic one-shot ; la recherche insiste sur l'intervention ciblée (rejouer la famille d'erreurs ratée, espacement).

## 🟢 BAS
- Message accent figé « é/è/ê » même pour ç/à/ô (inexact mais détection OK).

## Ce que « finir » veut dire (priorisé)
1. **Trancher le cadre** : dictée de **phrases** (recommandé) OU mode isolé qui accepte les familles d'homophones. ← décision n°1, tout en dépend.
2. **Réconcilier** diagnostic.py ↔ app (logique unique) + étendre `test_set` (inversion/ajout) + re-mesurer.
3. **Ajouter la détection « surface/plausible »** (règles graphème→phonème).
4. **Fixes** casse + message accent.
5. **Boucle de remédiation** (cibler la catégorie la plus ratée).
6. **Validation** moins circulaire / données réelles.
