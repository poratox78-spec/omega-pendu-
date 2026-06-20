# 📌 POST-IT — Correcteur dys : état avant « IA embarquée / petits modèles de langage »

> Synthèse rapide (2026-06-20). Détail mesuré : `dictee/JOURNAL.md` · `dictee/CORRECTEUR.md`. PR #9 (`claude/cool-curie-ctnvhi`).

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
3. **IA embarquée / petits LM** (WebLLM, modèle local en navigateur) = **le prochain sujet, pas encore touché**.

## 🧭 La carte mentale (mesurée, pas supposée)
- **Limite partout = le CONTEXTE.** Tout ce qui est *sans contexte* plafonne (3 falsifications le prouvent).
- **Hors-ligne gratuit** : nos règles → **Grammalecte** (beaucoup plus complet) = le socle.
- **Contexte** : LLM **opt-in en ligne** (fait) OU **local** (Ollama / futur WebLLM embarqué = sujet suivant).
- **Notre valeur ajoutée unique** (à garder par-dessus n'importe quel moteur) : **stade développemental dys + remédiation ciblée**.

## 📍 Où c'est
PR #9 `claude/cool-curie-ctnvhi`, tête **`4774787`**, CI verte. Tout est committé/poussé.
