# 📌 POST-IT — Correcteur dys : état avant « IA embarquée / petits modèles de langage »

> Synthèse rapide (2026-06-20). Détail mesuré : `dictee/JOURNAL.md` · `dictee/CORRECTEUR.md`. PR #9 (`claude/cool-curie-ctnvhi`).

## 🎯 OBJECTIF — recadré (le plus important, ne pas dériver)
**Le moteur de correction est un CONSOMMABLE interchangeable. NOTRE cognition dys est LE PRODUIT.**
On ne devient PAS « un wrapper Grammalecte/LLM ». Un moteur externe **complète** (et remplace les *règles* = la corvée faible), il **ne remplace jamais notre travail**.

```
   [ MOTEUR de correction ]  ← interchangeable, COMPLÉMENT, le meilleur dispo
       règles maison      = plancher FP=0, universel, dans le 8 Mo (la corvée, remplaçable)
       Grammalecte        = upgrade hors-ligne GRATUIT (gros rappel) ← brancher en 1er
       LLM / modèle local = plafond CONTEXTE (cloud opt-in / Ollama / WebLLM / Chrome Nano)
                    │  produit des erreurs (offsets, suggestions, FAMILLE)
                    ▼
   [ NOTRE COUCHE DYS ]  ← LE PRODUIT, jamais remplacé, agnostique au moteur
       erreur → FAMILLE → STADE développemental → REMÉDIATION ciblée   (modèle double-route OMEGA)
```
**La colle** = mapper la sortie de n'importe quel moteur vers **nos familles/stades** (le prompt LLM sort déjà une `famille` ; Grammalecte a des rule-ids mappables).
**Conséquence** : on **arrête de grinder le rappel des règles** (commodité) ; on **branche le meilleur moteur** ; on **investit notre énergie sur la couche dys** (familles→stades→remédiation), là où on est **seuls**.

## ✅ FAIT (mesuré + poussé)
| Brique | État | Chiffre clé |
|---|---|---|
| **Règles hors-ligne** (grammaire + ortho) | livré | **FP=0** mais **rappel faible** sur vrai dys (mesuré **0/6** sur « je sui dan le voiture… ») |
| **3 pistes « sans contexte »** | **FALSIFIÉES** (sondes + CI) | did-you-mean fréquence · route phonème (g2p-sur-typo) · morpho→trexquant OOV (réponse à la thèse §1.8) |
| **Plafond LLM** | mesuré (modèle fort) | **récall ~total · FP≈1/30** (et le gold GEC contient lui-même des fautes) |
| **LLM opt-in EN LIGNE** | **câblé dans l'app** | OFF par défaut · clé dans l'UI · surcouche des soulignements · marche aussi avec un **endpoint local (Ollama)** |
| **Grammalecte évalué** | faisable | FOSS, **JS pur hors-ligne FR** · +3-5 Mo · API offsets/suggestions **idéale** · mono-fichier préservable |

## ⏳ EN ATTENTE DE TOI (décisions)
1. **Grammalecte** : OK pour sa **GPL-3.0** (copyleft → app devient GPL) ? Sinon repli permissif **Hunspell + nlprule**. → puis : vérif licence + **PoC** (taille/perf réelles).
2. **Règles maison « agressives »** : genre `voiture→la` mesuré = **1 FP/98 GEC** (presque propre). On pousse nous-mêmes, ou on laisse Grammalecte faire ce boulot ?
3. **IA embarquée / petits LM** : **évalué — viable, pas éliminé.** 2 voies hors-ligne : Chrome **Gemini Nano** (Proofreader/Prompt API, zéro download, Chrome-only) · **WebLLM** (modèle 0,5-1,5 Go, multi-navigateur, ~drop-in dans notre couche IA car OpenAI-compatible). Reste à **mesurer la qualité FR + le FP** d'un petit modèle (≠ embarquable dans le 8 Mo : modèle fourni navigateur ou téléchargé).

## 🧭 La carte mentale (mesurée, pas supposée)
- **Limite partout = le CONTEXTE** (3 falsifications : did-you-mean, phonème, morpho-trexquant).
- **Moteur = consommable** (cf. 🎯 OBJECTIF) : règles plancher → Grammalecte (gratuit hors-ligne) → LLM/local (contexte).
- **Notre travail = la couche dys** (famille→stade→remédiation), agnostique au moteur. **C'est ÇA qu'on développe.**

## 📍 Où c'est
PR #9 `claude/cool-curie-ctnvhi`, tête **`4774787`**, CI verte. Tout est committé/poussé.
