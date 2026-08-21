# OMEGA Dys — design de police EN AVEUGLE (figé AVANT lecture de la littérature)

> **Protocole** (doctrine §1 falsifiabilité) : ce document est écrit **sans consulter la littérature
> sur les polices dyslexie** (OpenDyslexic & co non regardées). Il dérive uniquement de ce que le
> projet a **mesuré** (profil d'erreurs dictée/pendu, familles diagnostiques, double route).
> Après le gel de ce doc + génération de la v1, on confronte à la littérature web
> (`LITTERATURE.md`) et on note ce qui est confirmé / infirmé. Le design est donc une
> **prédiction falsifiable**, pas une resucée.

## D'où on part (données internes, pas d'intuition gratuite)

| Mesure interne | Source | Conséquence design |
|---|---|---|
| **58 % des confusions = voisée/sourde** (P/B, T/D, K/G, F/V, S/Z, CH/J) — signature dyslexie phono | rapport §11.2, JOURNAL | La police doit **encoder le trait de voisement** dans la lettre elle-même |
| 96 % des défaites = paire **phonétiquement proche** | rapport §11.2 | Le problème n'est pas la forme des lettres en général, c'est la **discrimination de paires** |
| Famille **inversion** (b/d, u/n, ordre des lettres) dans la typologie diagnostique | diag_sentence, grille dyslexie | **Casser les symétries miroir** : b, d, p, q ne doivent plus être la même forme tournée |
| Famille **muette** (lettres non prononcées) | diag_sentence | La muette est **contextuelle** → pas dans la police, dans la **couche de rendu** (griser via g2p) |
| Famille **accent** (é/è = phonèmes différents /e/ vs /ɛ/) | diag_sentence, PHON_TO_LETTERS | Accents **agrandis et directionnels** : l'accent EST le phonème, il doit être vu |
| L'unité de la double route = le **graphème** (ou, an, ch, gn…), pas la lettre | g2p_tables, decompose | Le **groupement de graphèmes** est contextuel → couche de rendu (arcs sous les digraphes via g2p), ligatures = v2 |
| Familles inversion/ajout = segmentation lettre-à-lettre fragile | typologie | **Espacement élargi** (approches généreuses) : isoler chaque unité pour réduire l'encombrement visuel |

## Principe central (l'idée neuve qu'on teste)

**La police encode un trait ARTICULATOIRE, pas seulement une forme.**

Les paires voisée/sourde sont quasi identiques phonétiquement (« les cordes vocales vibrent ou
pas ») et nos mesures disent que c'est LA confusion dominante. Donc :

- **Consonne VOISÉE** (b, d, g, v, z, j) → tracé **LOURD** (graisse ~105 unités) : le son est
  « plein », les cordes vibrent.
- **Consonne SOURDE** (p, t, c/k/q, f, s, ch) → tracé **LÉGER** (graisse ~70) : le son est un
  « souffle ».
- Toutes les autres lettres (voyelles, l, m, n, r…) → graisse moyenne (~85).

Prédiction falsifiable : la texture du texte devient inégale (coût), mais la paire `b/p`, `v/f`,
`z/s` devient discriminable **d'un coup d'œil**, et le poids visuel devient un **indice de rappel**
du geste articulatoire (multi-sensoriel : je vois lourd → je sens la vibration).

## Décisions par famille d'erreur

1. **Miroirs (inversion)** — chaque membre de b/d/p/q reçoit un marqueur unique :
   - `b` : pied plat (empattement au sol, vers la gauche) — « b a une base ».
   - `d` : sommet de hampe incliné vers la droite (drapeau) — « d regarde à droite ».
   - `p` : empattement en tête de hampe (à gauche, en haut) — « p pend avec son chapeau ».
   - `q` : queue horizontale vers la droite en bas de hampe — « q a une queue ».
   - `u` vs `n` : `u` garde une hampe terminale droite qui descend jusqu'à la ligne (comme en
     cursive), `n` n'en a pas.
   - `i`/`l`/`j` : point du i surdimensionné ; `l` a un petit pied à droite (≠ I majuscule, ≠ 1).
2. **Voisée/sourde** — contraste de graisse (cf. principe central).
3. **Accents** — dessinés ~40 % plus grands que la norme, pente à 45° franche : `é` monte, `è`
   descend, `ê` = chapeau pointu. L'accent porte le phonème (doctrine interne « le phonème porte
   l'accent »), il ne doit jamais être ambigu à taille de lecture.
4. **Muettes / graphèmes** — hors police (contextuels) : la **couche de rendu** de la démo grise
   les muettes et souligne les digraphes d'un arc, en réutilisant la segmentation g2p du projet
   (anti-fainéantise §5 : l'asset existe déjà, `g2p_tables.json`).
5. **Encombrement** — chasse généreuse (side bearings ~70/1000), interligne recommandé ≥ 1.5,
   formes ouvertes monolinéaires sans fioritures, x-height haute (500/1000) pour maximiser la
   surface distinctive des minuscules.

## Ce que la police ne prétend PAS faire

- Elle ne corrige pas l'orthographe (ça, c'est le correcteur).
- Elle ne désambiguïse pas les homophones (falsifié M3_d : il faut du contexte, pas des glyphes).
- Aucune preuve d'efficacité tant que non mesurée sur lecteurs réels — c'est un **prototype
  d'hypothèse**, à confronter (a) à la littérature, (b) à une mesure terrain (orthophonistes,
  même canal que `validation_terrain.html`).

## Livrables v1

- `police/build_font.py` — générateur paramétrique (fontTools) → `OmegaDys-Regular.ttf`.
  Tout est paramètre (graisses par classe, tailles d'accents, chasse) → itérable/mesurable.
- `police/demo.html` — démo : alphabet, paires minimales voisée/sourde, quatuor bdpq,
  phrases de la dictée, comparaison police standard, couche muettes+graphèmes.
