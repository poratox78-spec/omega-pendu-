# OMEGA v0.07 — Reconnexion M3_d via le banc recall : FALSIFIÉ (R66)

Date 03/06/2026. Direction Rem. Harnais headless déterministe. Build remis **phase46 propre** (rien gardé).

## Objet
PISTES #1 : « loger le banc recall DANS M3_d » pour redonner un rôle au concept + régler B1.

## Vérification de l'existant (avant tout code)
- bPC M3_d encode déjà depuis **`M1_d.output` (riche)** — le fix du checkpoint EST dans le build (« encoder depuis M1, pas M2 »).
- **Sonde mesurée** (config Rem, burn-in 60 parties, 40 mots @50%) : cellules concept **quasi-collapsées** — cross-mot cosine **0,9479**, argmax = **1 cellule domine 35/39**, 9/12 jamais dominantes. → 12 cellules ne couvrent pas l'espace des mots (mur de capacité Kanerva/DBPC, confirmé).
- Banc (`_emrgBank`) = **Map externe exacte** (recall 100 % sur vécu), séparée de M3_d.
- Sous bPC, `M3_d.output` est **mis à 0** (découplé) → ne contribue rien à M_S.
- Le banc n'alimente **que** l'override declare ; `M_PHON_CONCEPT_BIND` (bind révélé) est côté phon, buffer séparé. → **le pivot n'existait pas.**

## Pivot testé (fondé sur la sonde)
Stocker le banc dans 12 cellules = aggraverait le collapse + tuerait le recall. Donc pivot : **`M3_d.output` ← code recall normalisé du banc** (systèmes complémentaires : Map = épisodique exact, M3_d = readout concept), board-déclenché (révélé seul, cheat-free), normalisé (**B1 réglé dans le chemin**), gated, OFF-inerte, falsifiable via `M3_D_BYPASS`.

## Mesure (R66) — net-négatif partout
Config cognition (sans NEO, banc peuplé via `M_EMERGENT_DECLARE`), 3 graines × 100.
- Sous ON : `M3_d.output` non-nul 3,4 % des ticks (mécanisme fonctionnel).

| | OFF | ON | Δ |
|---|---|---|---|
| K=1 (marge 0,20) | 91,00 % | 89,67 % | **−1,33** |
| K=3 (marge 0,20) | 96,56 % | 96,00 % | **−0,56** |
| K=1 marge 0,35 / 0,50 / 0,65 | 91,00 % | 89,00 % | **−2,00** (pire) |

## Verdict
**Falsifié.** Injecter le mot rappelé comme concept dans M4_d **contamine le scoring-lettre** (biaise vers les lettres du mot rappelé — faux sur mot neuf, où le board matche un mot proche mais incorrect). Resserrer la marge **empire** (les tirs confiants mais faux pèsent plus). 

Par la règle additive (**garder seulement si apport ON**) : **reverté**, build = phase46 propre.

## Leçons
- Le recall épisodique est **optimalement placé dans l'override declare** (NEO recall, +1,76, propre) ; le chemin **concept→M4** est le mauvais endroit (diffus, contaminant).
- M3_d (12 cellules) est **capacité-limité** ; aucune reconnexion via le banc ne contourne ce mur dans le chemin M_S/M4.
- **B1** reste inerte (output=0 sous bPC) — sans danger, toujours ouvert mais sans urgence (le chemin qui l'activait est falsifié).
- Ne pas reproposer « loger le banc dans M3_d » : mesuré négatif.
