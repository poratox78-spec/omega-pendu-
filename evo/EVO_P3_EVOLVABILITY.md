# EVO P3 — Évolvabilité & le bon génome d'OMEGA

> **Question (Rem)** : *« L'évolution, c'est des erreurs utiles. Il y a quelque chose qu'on fait mal mais on sait pas quoi.
> Les croisements et alterner, bien fait ? Les gènes correspondent à quoi dans le réel d'OMEGA ? Check littérature. »*

Document de cadrage du chantier P3 (générations). Mesuré sur le moteur, croisé avec la littérature. **Conclusion : le défaut
n'était pas le moteur ni les opérateurs — c'était le NIVEAU DU GÉNOME (la représentation).**

---

## 1. Le constat mesuré (`evo_p3_genome.js` vs `evo_p3_code_evo.js`)

Même moteur, même méthode (spectre de mutation, état remis à zéro entre évals, fitness pendu), **génome différent** :

| Génome muté | 💀 létal | 🔻 délétère | ⚪ neutre | 🔼 **bénéfique** | paysage de fitness |
|---|---|---|---|---|---|
| **tokens du SOURCE** (`cosineSim`) | **75 %** | 3 % | 23 % | **0 %** | brisé — pléiotropie maximale |
| **PARAMÈTRES continus** (seuils/poids) | **0 %** | 13 % | 57 % | **30 %** | lisse — faible pléiotropie |

> Les « erreurs utiles » **n'existent pas** quand on mute le source (0 %), et **réapparaissent à 30 %** quand on mute les
> paramètres. L'évolvabilité dépend de la **représentation**, pas du moteur.

## 2. Le principe (littérature)

- **Évolvabilité = propriété de la carte génotype→phénotype (G→P).** Wagner & Altenberg (1996) : la mutation/recombinaison/
  sélection **n'est pas universellement efficace** pour améliorer des systèmes complexes (programmes, circuits). L'évolvabilité
  exige un G→P **modulaire / à faible pléiotropie** (un gène ne doit pas tout casser). → Le source brut a une pléiotropie
  **maximale** (un token touche tout) = anti-évolvable. C'est *le* piège classique de la programmation génétique.
- **Garder les variants valides.** Grammatical Evolution (O'Neill & Ryan) : évoluer **à travers une grammaire (BNF)** → seuls
  des programmes **syntaxiquement valides** sont produits. Corrige directement le « 75 % létal » du source brut.
- **Évoluer les poids, pas le texte.** Neuroévolution / **NEAT** (Stanley & Miikkulainen) : on fait évoluer les **poids** (et la
  topologie), en complexifiant **sans casser le comportement**. Paysage lisse → erreurs utiles possibles.
- **Réseaux neutres.** Kimura (théorie neutre) ; Banzhaf & Hu (neutralité, robustesse, évolvabilité en GP) : les mutations
  **neutres** (ici 57 %) forment des **réseaux neutres** où une population **dérive** en conservant la fonction — c'est le
  *carburant* de l'évolvabilité (atteindre de nouvelles régions sans perdre la viabilité).

## 3. Les gènes d'OMEGA = ses **paramètres/poids**, pas son source

- **Gènes évolvables** : la config/toggles, **θ=(α,β)** de l'OS, les **poids** M / bPC / readout, les **règles g2p apprises**.
  Faible pléiotropie → paysage lisse → 30 % d'erreurs utiles (mesuré).
- **Le source** = le **programme développemental** (le « corps ») — reproduit **fidèlement** par la copie bPC (P1, quine), pas
  muté au hasard. Si on doit varier du code, ce sera **via une grammaire** (variants toujours valides), pas en éditant le texte.
- **Croisement** : splicer du source détruit les blocs constructifs (pas de modularité) → presque tout casse. Sur un génome de
  **paramètres**, le bon opérateur est un **croisement blend/arithmétique** (`enfant = α·p1 + (1−α)·p2`), qui **préserve** les blocs.

## 4. Verdict sur le chantier P3

- **P3(a)** (gènes = config) était au **BON niveau** → il *trouvait* des erreurs utiles (erreurs 0,175 → 0,113).
- **P3+** (gènes = source) était au **mauvais niveau** → 0 % bénéfique, 75 % létal. « Ce qu'on faisait mal », identifié et mesuré.
- **Lignée propre (`evo_p3_lineage.js`)** : lignée multi-générations **sur le génome param** (croisement **blend** arithmétique +
  mutation gaussienne, sélection tri-critère, état RAZ par éval = indépendance). L'isolation par **process** n'était nécessaire que
  pour les mutations de **source** (un `cosineSim` cassé corrompt `validatePhoneticInit`) ; les **paramètres** ne corrompent pas
  l'init → lignée in-process propre.
  **Résultat mesuré** (8 générations, départ perturbé autour de la référence) : la référence donne err **1,40** / winrate 92,5 % ;
  la lignée **descend** à err **1,163** / winrate **95,0 %** — soit **−0,237 d'erreur SOUS la référence, winrate maintenu (mieux)**.
  ⇒ sur le bon génome, les générations **trouvent une meilleure version** (croisement blend + sélection exploitent les 30 %
  d'erreurs utiles).
- **✓ Validé en HELD-OUT (`evo_p3_holdout.js`)** : le génome gagnant `{conf 0.48, marge 0.25, pén 0.71}` rejoué sur des mots
  **non vus** — **len-7 frais : 95,0 % / err 1,195 vs réf 94,0 % / 1,275** (meilleur), et **len 8-10 (autre distribution) :
  98,5 % / 0,890 vs réf 98,5 % / 0,895** (neutre, ne nuit pas). ⇒ **généralise : vraie meilleure version, pas du tuning local
  au set d'entraînement.** L'amélioration est réelle dans le régime dur (len-7) et inoffensive ailleurs.

## Sources

- **Wagner, G. P. & Altenberg, L. (1996). « Perspective: Complex Adaptations and the Evolution of Evolvability ». *Evolution* 50(3), 967-976.**
  <https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1558-5646.1996.tb02339.x> · PDF : <https://www.sccs.swarthmore.edu/users/08/bblonder/phys120/docs/wagner.pdf>
- **Hu, T. & Banzhaf, W. (2018). « Neutrality, Robustness, and Evolvability in Genetic Programming ». *GPTP*.**
  <http://www.cs.mun.ca/~banzhaf/papers/GPTP_2016_Hu_2017.pdf>
- **O'Neill, M. & Ryan, C. — Grammatical Evolution** (numéro spécial « 25 ans », *Genetic Programming and Evolvable Machines*, 2025).
  <https://link.springer.com/article/10.1007/s10710-025-09512-x>
- **Stanley, K. O. & Miikkulainen, R. (2002). NEAT — Neuroevolution of Augmenting Topologies** (évolution des poids + topologie).
- **Kimura, M. — théorie neutre de l'évolution moléculaire** (réseaux neutres / dérive).
