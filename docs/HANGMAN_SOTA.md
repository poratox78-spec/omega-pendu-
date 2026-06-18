# Pendu — les VRAIES règles des solveurs (état de l'art) & repère pour OMEGA

> Recherche multi-sources (2026-06-18) sur les algorithmes réellement utilisés par les solveurs de pendu, pour
> **benchmarker OMEGA en VRAI hors-lexique** (après la découverte de la fuite `_neoWBL` : le « 97 % OOV » était de
> l'in-lexique déguisé — cf. `AUDIT_OMEGA §1.6.1`).
> **Méthode** : 5 angles de recherche web en parallèle + recoupement. Confiance notée par item.
> **Fiabilité** : le setup Trexquant et les chiffres 18 %/95 %/99 % sont du **texte officiel ou mesurés** (haute
> confiance) ; les winrates GitHub (55/60/68 %) sont **auto-déclarés, non audités** → ordres de grandeur.

## 0. La clé : DEUX régimes à ne jamais confondre
- **IN-DICTIONNAIRE** (le mot cible est dans la liste du solveur) → le filtrage de cohorte suffit → **>95 %**.
  Quasi résolu, peu informatif. C'est le mode « oracle ».
- **HORS-VOCABULAIRE / OOV** (le mot n'est PAS dans la liste) → il faut généraliser la structure **sous-lexicale** →
  **~50–68 %** au mieux. C'est le vrai problème, et ce que le benchmark **Trexquant impose** (test sur dico *disjoint*).

> **Le chiffre décisif** : un **même** modèle n-gram gagne **65 % sur mots vus → 50 % sur mots neufs**. La falaise
> seen→unseen *est* le jeu. (joe.cat / mattgalarneau)

## 1. Les règles réelles, par importance

### 1.1 Filtrage de cohorte (LA règle de base) — in-dictionnaire
Garder les mots du dico qui matchent : **longueur + lettres révélées à leur position + sans les lettres déjà fausses**.
Jouer **la lettre présente dans le plus de mots-candidats restants**. Quand il reste ~2 candidats, **basculer sur le
mot entier** (par fréquence). Sources : sharkfeeder, endeavors/HangmanAI, Arongil/Hangman-Solver.

### 1.2 Fréquence par INCIDENCE DE MOTS, conditionnée à la longueur (≠ fréquence du texte)
Classer les lettres par **fraction de mots qui la contiennent** : **S dans 60,13 % des mots, T dans 48,23 %** (alors
que E domine en texte courant). Meilleure 1re lettre **par longueur** : **1–4→A · 5→S · 6–12→E · 13+→I**. La fréquence
brute surévalue une lettre positionnellement biaisée (S file en fin de mot → révèle peu = **fréquence ≠ information**).
Source : DataGenetics « A Better Hangman Strategy ».

### 1.3 Gain d'information (entropie) vs glouton « plus de candidats »
Deux objectifs distincts (minimiser l'incertitude restante `H=Σ -p·log2 p` vs minimiser le risque d'erreur immédiat),
mais sur un vrai dico **quasi identiques** — et le **glouton gagne même légèrement** : **95,12 % vs ~94,6 %** à 6
erreurs ; **98,86 % vs 98,79 %** à 9 erreurs (233 615 mots). L'entropie « dépense » des essais pour désambiguïser plus
vite → perd un peu plus de parties. Sources : datarazzi (mesure tête-à-tête), dazkins, Wolfram (McLoone, origine du glouton).

### 1.4 Modèles n-grams / Markov de lettres — LE cheval de bataille OOV
N-grams ordre **1→5**, **interpolation + backoff** (ex. trigramme 0,6 / bigramme 0,3 / unigramme 0,1), construits par
**longueur + position** depuis le dico d'entraînement. Cutoff à 5 (au-delà = chaînes de sous-séquences). Décision =
argmax de la proba pondérée sommée sur toutes les positions vides. **Généralisent en OOV** car ils modélisent les
**sous-séquences de lettres**, pas les mots entiers. Erreurs moyennes mesurées : aléatoire **16,7** → unigramme **10,5**
→ bigramme **8,6** → trigramme+lissage **8,1**. Sources : ZavierYang, mattgalarneau, Aditya-dom.

### 1.5 Neural (LSTM / BiLSTM / Transformer) + RL
- **LSTM** (encodage one-hot du mot masqué + vecteur lettres-essayées → LSTM → Dense(26)) : **62,0 %** sur 11 226 mots
  WordNet held-out. (Azure/Hangman)
- **n-gram + BiLSTM hybride** (n-gram tôt, BiLSTM quand ~50 % révélé) : **~68 %** (Trexquant, 1000 parties). (Scribd)
- **RL déployé** : **>60 %**. (Aditya-dom)
- **LLM** : papier 2026 « LLMs Can't Play Hangman » — les LLM échouent **sans mémoire de travail externe** pour
  suivre l'état du jeu. (arXiv 2601.06973, thèse confirmée, chiffres non vérifiés)

## 2. Chiffres de référence (à graver)

| Régime | Méthode | Winrate | Note |
|---|---|---|---|
| In-dico, 6 erreurs | cohorte gloutonne | **95,1 %** | datarazzi, 233 615 mots |
| In-dico, 9 erreurs | cohorte gloutonne | **98,9 %** | datarazzi |
| In-dico | DP quasi-optimal | **~96,3 %** | ~1,74 faux/partie (sharkfeeder, 1 source) |
| In-dico, 1M tests | cohorte + fréquence | **98,56 %** | endeavors/HangmanAI |
| In-dico, **3 erreurs seulement** | fréquence | **24 %** | le budget d'erreurs domine tout |
| **OOV** baseline Trexquant | fréquence globale | **~18 %** | texte officiel (→ ~20 % en conditionnel) |
| **OOV** mots neufs | n-gram 1–5 | **~50 %** | mattgalarneau (65 % vus → 50 % neufs) |
| **OOV** Trexquant | LSTM / hybride / RL | **~62–68 %** | Azure 62 %, hybride 68 %, RL >60 % |

**Setup Trexquant (officiel, verbatim multi-sources)** : **~250k entraînement, ~250k test DISJOINT**, *« les mots
testés N'APPARAISSENT PAS dans le dictionnaire fourni »*, **6 erreurs**, **1000 parties** via API, autre dictionnaire
**interdit** (revue de code). C'est exactement la condition OOV.

**Théorie** : le pendu standard (non adversarial) est **optimisable par programmation dynamique** (états = cohorte ×
vies restantes). Seul le **« Evil Hangman »** (le maître peut changer de mot tant que cohérent) est **prouvé difficile**
(réductions à Dominating Set / Membership). Source : Barbay & Subercaseaux, *The Computational Complexity of Evil
Hangman*, FUN 2021 (arXiv:2003.10000).

## 3. Ce que ça dit d'OMEGA (sans détour)
1. **Le ~97 % "OOV" d'OMEGA = le régime in-dictionnaire standard** (95–99 % pour *n'importe quel* filtrage de
   cohorte) — **et** la cohorte lisait la réponse (`_neoWBL` non purgé). Ni exceptionnel, ni honnête. La littérature
   confirme : >95 % in-dico est **banal**.
2. **Le vrai OOV d'OMEGA ~33 % est SOUS le plancher réaliste (~50 %)** d'un simple n-gram. C'est l'écart honnête à
   combler : la voie sublexicale d'OMEGA généralise **moins bien** qu'un modèle n-gram de base.
3. **La barre à viser** en OOV : **~50 %** (n-gram seul) → **~62–68 %** (n-gram+BiLSTM/RL). Le levier est le **modèle
   sous-lexical** (n-grams/contexte appris par longueur+position+backoff), pas la cohorte lexicale.
4. **Toujours préciser le budget d'erreurs** : à 3 erreurs, même les bons solveurs tombent à ~24 %. Un winrate sans
   le budget ne veut rien dire.
5. **Cohérent avec la doctrine du repo** (`evo/PHRASE_HANGMAN_PROBE.md`, « cognition > oracle ») : la valeur est dans
   la **généralisation OOV**, pas dans le lookup de cohorte (= l'oracle).

## 4. Sources
**Officiel / mesuré (haute confiance)**
- [Playing Hangman — datarazzi](https://datarazzi.wordpress.com/2011/07/19/playing-hangman/) — 95,1 % (6 err) / 98,9 % (9 err) ; glouton vs entropie ; 233 615 mots
- [A Better Hangman Strategy — DataGenetics](http://datagenetics.com/blog/april12012/index.html) — incidence-mots, 1re lettre par longueur, S=60,13 %/T=48,23 % ([miroir Neatorama](https://www.neatorama.com/2012/03/29/a-better-hangman-strategy/))
- [Azure/Hangman — LSTM](https://github.com/Azure/Hangman) — 62,0 % sur 11 226 mots held-out
- [The Computational Complexity of Evil Hangman — arXiv:2003.10000 (FUN 2021)](https://arxiv.org/abs/2003.10000)
- Trexquant (texte officiel, reproduit) : [whosquant/hangman](https://github.com/whosquant/hangman), [rakshit176](https://github.com/rakshit176/Trexquant-Hangman-Challenge-), [aghalandar/Hangman_solution](https://github.com/aghalandar/Hangman_solution) — 250k/250k disjoint, 6 err, 1000 parties, baseline ~18 %

**Implémentations / blogs (confiance moyenne, winrates auto-déclarés)**
- [mattgalarneau/Hangman-NLP](https://github.com/mattgalarneau/Hangman-NLP) & [joe.cat/hangman](https://joe.cat/hangman/) — n-gram 1–5 ; **65 % vus / 50 % neufs** (la falaise OOV)
- [ZavierYang/N-gram-model-for-Hangman-game](https://github.com/ZavierYang/N-gram-model-for-Hangman-game) — interpolation 0,6/0,3/0,1 ; erreurs 16,7→8,1
- [endeavors/HangmanAI](https://github.com/endeavors/HangmanAI) — 98,56 % in-dico (1M tests)
- [sharkfeeder — Possibly Optimal Hangman](http://www.sharkfeeder.com/hangman/) — DP ~96,3 %, ~1,74 faux (1 source)
- [dazkins — Solving Hangman With Information Theory](https://dazkins.com/blog/solving-hangman-with-information-theory)
- [Wolfram — 25 Best Hangman Words (McLoone)](https://blog.wolfram.com/2010/08/13/25-best-hangman-words/)
- Trexquant submissions : [ShashwatKartikey](https://github.com/ShashwatKartikey/Hangman-Challenge) 55 % · [Aditya-dom](https://github.com/Aditya-dom/trexquant_Hangman) >60 % RL · [Ayushkumarsingh09](https://github.com/Ayushkumarsingh09/Hangman-Game) >50 % · [hybride n-gram+BiLSTM (Scribd)](https://www.scribd.com/document/939673107/Implementation-Details) ~68 %
- Principe de généralisation sous-mot : [Sennrich et al., Subword Units, arXiv:1508.07909](https://arxiv.org/pdf/1508.07909)
- [« LLMs Can't Play Hangman… » arXiv:2601.06973](https://arxiv.org/abs/2601.06973) (thèse confirmée, chiffres non vérifiés)
