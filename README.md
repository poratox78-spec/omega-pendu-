# OMEGA-Ω — Une architecture cognitive pour le pendu français

> *Comment une machine peut jouer au pendu en **raisonnant** plutôt qu'en **lisant la réponse**.*
>
> *A cognitive architecture that plays French Hangman by reasoning, not by dictionary lookup.*

OMEGA-Ω est un moteur de pendu français (mots ≥ 7 lettres) bâti non comme un chercheur de
dictionnaire, mais comme une **architecture cognitive** sous une contrainte fondatrice —
**« cognition > oracle »** : aucun module ne lit le mot caché ailleurs qu'aux positions révélées.

## Résultat en un coup d'œil

| Régime | Réussite | Note |
|---|---|---|
| Cognition cheat-free seule | ~90 % | sans lire le dictionnaire pour scorer une lettre |
| **+ déclaration émergente (NEO)**, in-lexique | **97,5 % – 98,8 %** | au niveau des meilleurs solveurs lexicaux |
| Hors-lexique (façon Trexquant), phon→ortho | **~70 %** | au niveau des bons solveurs, le mot étant *entendu* |
| Hors-lexique, ortho seul | ~22 % | faiblesse réelle : généralisation sous-lexicale |
| Plafond oracle (lexique complet) | 98,7 % | la cible *exclue* par doctrine |

La contribution n'est **pas** un record de winrate (les solveurs lexicaux égalent le score
in-lexique) — c'est une **méthode** : mesurer avant de croire, falsifier avant de garder,
distinguer la cognition de l'oracle ; et une cartographie de ce qui généralise (la séquence
phon→ortho) et de ce qui se heurte à des murs (la capacité du concept).

## Lancer l'application

Ouvrir **`app/omega-pendu.html`** dans n'importe quel navigateur. Application monolithique
autonome (code + lexique inlinés), aucun serveur, aucune dépendance.

- **▶ Start** lance une partie (mot saisi, ou aléatoire si vide).
- Le panneau de bascules compose la configuration cognitive (voies ortho/phon, OS, bPC, déclarations…).
- **🎯 Mode Trexquant (hors-lexique)** : quand il est ON, chaque nouvelle partie retire le mot tiré
  du dictionnaire interne (cohorte et recall aveugles) → on regarde OMEGA résoudre du **vrai mot neuf**
  par généralisation phon→ortho. Lexique restauré au tour suivant.
- Panneau **Bench → 🎯 Trexquant** : mesure le taux de réussite hors-lexique sur un lot de mots.

## Documents

- **`docs/MEMOIRE.html`** — le mémoire de recherche & d'ingénierie (thèse, architecture, méthode,
  résultats positifs **et** négatifs, travaux liés, références). *Le document à lire / publier.*
- **`docs/rapport-mode-emploi.html`** — le rapport de référence & mode d'emploi (interrupteurs,
  régimes, cadre anti-triche, état & limites).
- **`notes/`** — notes de session sourcées : système NEO (changelog, décomposition brique-par-brique,
  croisement de la voie muette) et le résultat négatif documenté (reconnexion M3_d falsifiée).

## Doctrine & méthode

- **Cap §43 (cognition > oracle)** : les modules cognitifs ne lisent `currentWord` qu'aux positions
  révélées (sens montant = décider). L'apprentissage post-partie (sens descendant) voit le mot complet.
- **Lexique** : interdit dans le scoring-lettre ; autorisé pour le *DECLARE par cohorte* (board-dérivé)
  et l'apprentissage post-partie. Les interrupteurs `A1/A2/A3` (injection de fréquence lexicale) sont OFF.
- **R66** : aucun module activé par défaut sans test de falsification (bypass + statistiques appariées,
  multi-graines, harnais déterministe).

## Architecture (résumé)

Double pipeline en Möbius sur un substrat **hyperdimensionnel** (HRR/VSA, 1024D concept / 512D lexical) ;
cinq niveaux montants M1→M5 ; **double route** orthographique + phonologique (SAMPA) arbitrée par un OS ;
concept M3_d en **codage prédictif bidirectionnel** ; déclarations émergentes (recall / assemblé phon→ortho /
cohorte). Détails dans le mémoire.

## Références

1. Coltheart, M., Rastle, K., Perry, C., Langdon, R., & Ziegler, J. (2001). *DRC: A Dual Route Cascaded Model of Visual Word Recognition and Reading Aloud.* Psychological Review, 108(1), 204–256.
2. Frady, E. P., Kent, S. J., Olshausen, B. A., & Sommer, F. T. (2020). *Resonator Networks…* Neural Computation, 32(12).
3. Kanerva, P. (2009). *Hyperdimensional Computing…* Cognitive Computation, 1(2), 139–159.
4. McClelland, J. L., McNaughton, B. L., & O'Reilly, R. C. (1995). *Why There Are Complementary Learning Systems in the Hippocampus and Neocortex.* Psychological Review, 102(3), 419–457.
5. Plate, T. A. (1995). *Holographic Reduced Representations.* IEEE Transactions on Neural Networks, 6(3), 623–641.
6. Qiu, S., Bhattacharyya, S., Coyle, D., & Dora, S. (2025). *Deep Predictive Coding with Bi-directional Propagation for Classification and Reconstruction.* Neural Networks, 191, 107785.

## Crédits

Direction et conception : **Rem**. Assistance d'ingénierie et rédaction : **Claude (Anthropic)**.

## Licence (double licence)

Ce projet combine du **code** et des **données lexicales tierces**, qui ne sont **pas** sous le même régime.

### Code — MIT
Le code source (auteur : **Rem**, © 2026) est sous licence **MIT** — voir [`LICENSE`](LICENSE).
Réutilisable librement, y compris commercialement, **pris séparément du lexique**.

### Données lexicales — CC BY-NC
La base lexicale française embarquée dans `app/omega-pendu.html` provient de **Lexique** ([lexique.org](https://www.lexique.org))
et est sous licence **Creative Commons Attribution – Pas d'Utilisation Commerciale (CC BY-NC)**. Deux obligations :

- **Attribution obligatoire** — citer les auteurs et le lien :
  > New, B., Pallier, C., Brysbaert, M., & Ferrand, L. (2004). *Lexique 2: A New French Lexical Database.*
  > Behavior Research Methods, Instruments, & Computers, 36(3), 516-524. — [lexique.org](https://www.lexique.org)
- **Pas d'usage commercial** — publication open source / recherche (p. ex. sur GitHub) **OK** ; vente ou
  intégration dans un produit/service commercial **interdite**.

### Œuvre combinée
Tant que le lexique reste embarqué, `app/omega-pendu.html` est une **œuvre combinée** soumise dans son
ensemble à la clause **non commerciale** et à l'**attribution** ci-dessus. Détails dans le fichier [`NOTICE`](NOTICE).

> ⚠️ Ne pas placer une licence MIT/Apache « globale » sur le dépôt : cela prétendrait autoriser l'usage
> commercial de l'ensemble, ce qui contredit le **NC** des données lexicales.

---
*Instantané au 03/06/2026 · build phase47 (moteur cognitif phase46).*
