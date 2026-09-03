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
  lexique. Écarte les graphies plausibles au son mais improbables à l'œil (`oiso`, `waso`).
- **(c) lexicalité** `[graphie ∈ lexique]` — bonus si la graphie **est un vrai mot** (β=3). Lève
  l'essentiel : `oiso/veres` (non-mots) tombent sous `oiseau/vers`. Pour la dys, proposer de **vrais
  mots** est exactement le bon comportement (et reste cheat-free : on ne lit jamais la cible).

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
| + prior ortho croisé | 14,4 % | 36,3 % | 46,9 % | 60,4 % |
| **+ lexicalité (β=3)** | **26,7 %** | **64,1 %** | **73,2 %** | **77,1 %** |

- **La lexicalité est le gros levier** : top-1 ×2,2 (14→27 %), top-5 +26 pts (47→73 %) — mesuré.
- **Plafond intrinsèque** : 2,32 homophones Lexique/mot → le top-1 ne **peut pas** atteindre 100 %
  (ver/vert/verre partagent le son ; le top-k est la bonne métrique).
- **Position finale** (eau/ent/muettes) dans le contexte → gain majeur (top-10 39→58 % avant le prior).
- **Garde-fous** : /o/→`eau`✓ · /wazo/→`oiseau`✓ (rang 1) · /Sa/→`chat`✓ · /bato/→`bateau`✓ · /mEz§/→`maison`✓
  · /vER/→`vers,ver,verres,vert,verre` (les 5 homophones réels en tête).

## Dette de réutilisation assumée (§A2 — honnêteté d'audit)
Le **moteur pendu a déjà** une cognition phono→ortho que je n'avais pas inventoriée avant de coder p2g :
- **`L2[phonème]→graphème`** : table phonème→graphème **apprise en jouant** (voie assemblée NEO), mesurée **+5,28 pts OOV**.
- **`_neoCRS`** : jointe son×ortho `Σ_φ P(φ|cohorte)·P(lettre|φ,contexte)` — **+2,2 pts** vs argmax.
- **`_neoDeclareOSmix`** (M_NEO_OS_ARB) : **mélange convexe** sublexical⟷lexical `(1−μ)·sub+μ·lex` (+2,0).

p2g n'est **pas** une duplication inutile (tâche **différente** : mot entier, dictée, hors-board, top-k mesuré ;
le moteur fait du **par-lettre** sur le board du pendu), mais le bon prochain pas serait de **réutiliser `L2`**
comme prior d'émission plutôt que ma seule table apprise. (Le moteur tourne en JS dans la closure : non
extractible en l'état ; comparaison directe = jonction future.)

## Audit honnête (§6)
- ✅ **Vraie jointe §3** : distributions molles, marginalisation des alignements, **triple croisement**
  son×ortho×lexicalité mesuré net-positif (top-1 12→27 %, top-5 45→73 %).
- ⚠️ **Plafond restant** top-1 ~27 % = essentiellement l'**homophonie** (2,3 mots/son) : le top-5 (73 %) est
  la métrique utile pour la dys (proposer une courte liste). Reste à départager les vrais homophones.
- ⏳ **Leviers suivants** (chacun mesuré seul) : **fréquence lexicale** pour départager les homophones
  (ver≫vert? selon contexte), conditionner sur la **morphologie** (suffixes -er/-é/-ent via `morpho.json`),
  réutiliser **`L2`** du moteur, et **branchement dictée** (proposer les graphies à l'élève sur un son).

## Licence
Dérive de **Lexique 4** (New et al., 2026) → **CC BY-SA 4.0** (comme `phono_homophones.json`, `cgram_*`).

## État au 03/09/2026 — remesuré, et une fausse bonne idée écartée

Même protocole (held-out, `seed=42`, test=4000), tables régénérées par la batterie du jour :

| | top-1 | top-3 | top-5 | top-10 |
|---|---|---|---|---|
| émission seule | 12,8 % | 35,8 % | 47,6 % | 62,0 % |
| + prior ortho croisé | 15,2 % | 37,9 % | 49,8 % | 64,4 % |
| **+ lexicalité (β=3)** | **28,4 %** | **67,7 %** | **77,0 %** | **81,0 %** |

**Question de Rem** : l'augmentation du lexique (speller 155 467 → 705 653 formes, Morphalou) doit-elle mettre à
jour les tables du g2p/p2g ? Réponse mesurée : **non**, pour deux raisons distinctes.
- La **vérité-terrain** (alignement g2p, émission p2g) reste Lexique 4 (`phono_homophones.json`) : la phonétique
  Morphalou n'est exacte qu'à 82,4 % et son mélange faisait chuter l'exact de 52,4 % à 39,2 % (mesuré le 24/08) ;
  elle reste un repli de `decompose()` seulement.
- La **lexicalité** (β=3, « la graphie est un vrai mot ») avec TOUT le speller au lieu des seuls mots à homophones
  Lexique : top-1 28,4 → 27,1 %, top-3 67,7 → 65,8 %, top-5 77,0 → 75,7 %, top-10 81,0 → 80,9 %. Plus de vrais mots
  = plus de graphies concurrentes récompensées pour le même son ; la vraie recule. Le prior doit rester étroit.
Les tables elles-mêmes (`g2p_tables.json` extrait de l'app, `g2p_corrections.json`, `p2g_table.json`) sont
régénérées à chaque batterie : elles ne peuvent pas être périmées par rapport au moteur.
