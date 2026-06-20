# Cognition Phono→Ortho (p2g) — `p2g.py`

> *« Vu qu'on décompose, on fait l'inverse. »* Le décomposeur fait **ortho→phono** (g2p) ; ici on fait
> **phono→ortho** : donné un **son**, produire la **distribution des orthographes probables**. C'est
> l'inverse, et **le point dur de la dyslexie** (entendre un mot, choisir comment l'écrire — l'ortho
> n'est pas déductible du son : /o/ → o, au, eau, aux, eaux…). Sous-projet **dictée**, OFF du moteur pendu.

## Doctrine §3 — jointe, pas argmax
On NE choisit pas la graphie phonème par phonème (argmax). On **croise deux sources molles** et la
décision émerge de la jointe sur la séquence (beam-search), en **marginalisant la segmentation latente** :

`P(ortho | son) ∝ Σ_segmentations  Π_i  P(graphie_i | morceau-phono_i, contexte) · prior_ortho(ortho)`

- **(a) émission** `P(graphie | morceau-phono, phonème précédent, position finale)` — **route SON**,
  apprise par alignement (`build_p2g.py`, réutilise `decompose.aligned_units` : la **même** machinerie
  d'alignement g↔p que la boucle descendante, §A2).
- **(b) prior orthographique** `P(suite de lettres)` — **route ORTHO**, bigramme de caractères sur le
  lexique. C'est le **croisement** : il écarte les graphies plausibles au son mais improbables à l'œil
  (`oiso`, `waso`) au profit de `oiseau`.

## Lancer
```
python3 dictee/build_p2g.py            # apprend la table d'émission (TRAIN) → p2g_table.json
python3 dictee/p2g.py "wazo"           # un son SAMPA → top orthographes (probas)
python3 dictee/p2g.py --mot oiseau     # phono du mot → ce que la cognition propose
python3 dictee/p2g.py --measure        # held-out top-k + ablation du prior ortho
python3 dictee/p2g.py --demo
```
Exemple `/vER/` (ver · vert · verre) → propose `ver`, `vers`, `verres`… (les homophones, classés).

## Mesure (doctrine §1 — HELD-OUT, `seed=42`, test=4000)
« Donné le SON, la vraie ORTHOGRAPHE du mot est-elle proposée ? » (top-k) :

| | top-1 | top-3 | top-5 | top-10 |
|---|---|---|---|---|
| émission seule | 12,2 % | 34,0 % | 44,6 % | 58,1 % |
| **+ prior ortho croisé** | **14,4 %** | **36,3 %** | **46,9 %** | **60,4 %** |

- **Le croisement ortho paie** (+2,2 pts top-1) — falsifiable, mesuré.
- **Plafond intrinsèque** : 2,32 homophones Lexique/mot en moyenne → le top-1 ne **peut pas** atteindre
  100 % (plusieurs mots partagent le son ; le top-k est la bonne métrique).
- **Position finale** (eau/ent/lettres muettes) ajoutée au contexte → gain majeur vs prev-seul
  (top-10 39 %→58 % avant même le prior).
- **Garde-fous** : /o/→`eau`✓ · /wazo/→`oiseau`✓ · /Sa/→`chat`✓ · /bato/→`bateau`✓ (`maison` juste hors top-6).

## Audit honnête (§6)
- ✅ **Vraie jointe §3** : distributions molles, marginalisation des alignements, **croisement** son×ortho
  mesuré net-positif. ✅ Réutilise l'alignement de la boucle descendante (pas de réécriture).
- ⚠️ **Accuracy modeste** (top-5 47 %) : c'est un **premier** étage de cognition sur une tâche
  intrinsèquement ambiguë (1 son ↔ N graphies). Le top-1 est bridé par l'homophonie (2,3/mot).
- ⏳ **Leviers suivants** (chacun mesuré seul) : contexte plus riche (phonème suivant, longueur, morphologie
  des suffixes -er/-é/-ent), meilleur prior ortho (bigramme→trigramme ou le `orthoScore` du moteur),
  ré-ordonnancement par fréquence lexicale, et **branchement dictée** (proposer les graphies à l'élève).

## Licence
Dérive de **Lexique 4** (New et al., 2026) → **CC BY-SA 4.0** (comme `phono_homophones.json`, `cgram_*`).
