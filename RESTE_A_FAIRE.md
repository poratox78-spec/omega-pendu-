# Ce qui reste — point d'entrée unique

> Écrit le 2026-09-08 à la demande de Rem : « j'ai trop de conversations séparées, je veux repartir
> sur une seule ». Ce fichier ne DUPLIQUE rien — il dit **par quoi commencer**, **avec quelle
> commande**, et **combien ça coûte quand c'est mesuré**. Le détail chiffré vit ailleurs :
>
> | Où | Quoi |
> |---|---|
> | `ETAT.md` | l'état **généré** — 8 métriques, 91 garde-fous, 31 chantiers fermés / **18 ouverts** |
> | `dictee/etat_chantiers.json` | la **source curée** des chantiers (seul fichier éditable de la chaîne ; après édition : `python3 dictee/etat_gen.py`) |
> | `dictee/JOURNAL.md` | l'histoire datée : chaque mesure, chaque falsification |
> | `CLAUDE.md` + `DOCTRINE.md` | les règles du jeu |
>
> ⚠️ **Aucun chiffre de ce fichier ne doit être recopié ailleurs de mémoire.** Relancer la sonde.

---

## 0. Où en est le produit, en une ligne

Le chiffre de référence se relance en une commande — c'est LUI qui pilote, jamais une mesure par couche :

```bash
OMEGA_DYS_DATA=… LEX4=… python3 dictee/dys_pipeline_probe.py
```

Et depuis le 08/09 le juge n'est plus prisonnier du corpus dys — même sonde, autres corpus :

```bash
OMEGA_GOLD=gold_ecriscol_norme.jsonl python3 dictee/dys_pipeline_probe.py   # copies de 2NDE
OMEGA_GOLD=gold_frgec_norme.jsonl    python3 dictee/dys_pipeline_probe.py   # Wikipédia, à l'échelle
```

Dernière mesure (08/09/2026, base `#700`) — **ces trois lignes ne s'additionnent pas**, densité de
fautes et qualité du corrigé diffèrent :

| gold | textes | mots alignés | réparés | un clic | **cassés** |
|---|---|---|---|---|---|
| `gold_claude` (dys réel, privé) | 72 | 6 217 | 314 (20,4 %) | 252 | **14 (0,30 %)** |
| `gold_ecriscol_norme` (2NDE) | 467 | 3 747 | 58 (14,6 %) | 42 | **13 (0,39 %)** |
| `gold_frgec_norme` (Wikipédia) | 13 783 | **293 753** | 1 737 (20,8 %) | 2 235 | **463 (0,16 %)** |

Les corpus externes se refabriquent depuis zéro (rien de privé n'entre dans le dépôt) :

```bash
LEX4=… python3 dictee/fetch_frgec_pairs.py --mo 40 --chunks 0,1,2,3,4,5
OMEGA_DYS_DATA=… ECRISCOL_ZIP=… python3 dictee/build_gold_externe.py
```

Et un **second** instrument, complémentaire : le juge lit un CORPUS, le Bescherelle ÉNUMÈRE un
paradigme entier dans le vrai Chrome (ce qu'aucun corpus ne peut faire — une case absente du corpus
est invisible ; c'est ainsi que nous/vous sont restés hors de la conjugaison pendant des mois) :

```bash
python3 dictee/bescherelle_gen.py   <in.json> <meta.json>    # 20 verbes × 6 temps × 6 personnes
node    dictee/navigateur_flags_dump.js <in.json> <out.json>  # le VRAI Chrome, extension réelle
python3 dictee/bescherelle_score.py <meta.json> <out.json>    # par TEMPS et par PERSONNE
```

Dernière mesure (08/09/2026, base `#704`, 1 279 phrases) : **640/640 phrases correctes intactes,
0 mot juste cassé** · **565/639 fautes réparées (88,4 %)**. Sur le banc identique au passage
précédent (1 197 phrases) : **507 → 528**, soit 85,2 % → **88,7 %**.

| temps | | | | sujet | |
|---|---:|---:|---|---|---:|
| conditionnel | 119/119 | 100 % | | vous | 93,5 % |
| futur | 115/119 | 96,6 % | | tu | 92,2 % |
| présent | 108/120 | 90,0 % | | ils | 91,8 % |
| imparfait | 107/120 | 89,2 % | | nous | 89,4 % |
| passé simple | 51/59 | 86,4 % | | il | 83,0 % |
| **subjonctif** | **65/102** | **63,7 %** | | je | 80,6 % |

---

## 1. Par quoi commencer — les trois premiers pas, dans cet ordre

### ① La ligature œ/oe dans le juge — le moins cher, le plus rentable
**Prix connu : 36 cassés sur 463 disparaissent, sans toucher au moteur.** `DP.norm` tolère l'accent
et l'élision mais pas la ligature, donc « soeur » → « sœur » est compté CASSÉ alors qu'aucun mot
n'est abîmé. Le correctif tient en une ligne dans `dictee/dys_precision_probe.py`.
⚠️ `gold_claude.jsonl` contient « sœur » : mesurer l'effet sur le chiffre de référence et ré-ancrer
`dys_precision_ref.json` **dans son propre incrément**. C'est de l'INSTRUMENT — avant le moteur.

### ② L'enquête « et » → « est »
**×14 sur du texte correct**, la famille la plus chère du tri des 463 cassés, et **le corpus dys ne
la montrait pas**. À trancher cas par cas AVANT de toucher une règle : une part est du gold
sous-corrigé (le filtre lexical ne voit pas un accord resté faux dans la phrase Wikipédia).
Matière première : `data_local/casses_gold_frgec_norme.tsv`, et
`node dictee/casses_au_produit.js` rejoue chaque cas dans l'**extension réelle** avant toute
conclusion — la référence Python n'est pas le produit.

### ③ Les cinq FP confirmés au produit, un incrément chacun
`cone`→`conne` (l'accent doit gagner : `cône`) · `tracé`→`tracer` après « de » · `mai`→`mais` dans
une date · `Allier`→`Allié` (nom propre) · `grec`→`grecs` en coordination.

### ④ Le SUBJONCTIF — le point bas du paradigme, et **une seule cause**
**26 des 37 ratés, tous en ROUGE.** « Il faut que je disiez » → **« disais »** : la vieille règle
`accord sujet-verbe` décide la première et rend l'**imparfait** au lieu du subjonctif. Elle ne garde
ni le MODE ni le TEMPS de la forme écrite — exactement la forme du chantier « tu irai » → « vas ».
Les 11 ratés restants sont des muets (« il faut que je devions »). Le remède n'est pas une règle de
plus : c'est l'ORDRE, ou la conservation du mode dans la règle qui tire en premier. Matière première :
rejouer le banc ci-dessus et filtrer `tps == 'sub:pre'`.
⚠️ À traiter comme un incrément à part : `accord sujet-verbe` est la famille la plus ancienne et la
plus large ; la sonde de précision au produit la donne déjà à **79,5 %** (31 justes / 5 inutiles /
3 fausses sur 39), soit sous le seuil des 80 % — toucher son ordre se mesure avant, pas après.

---

## 2. Ce qui ne se débloque PAS par du code

- **ECRISCOL** (copies de 2NDE avec la forme produite ET sa forme normalisée) : l'archive déposée
  sur ORTOLANG est **tronquée** — 107 Mio pile, pas de répertoire central, un `Range` au-delà rend
  416. 63 copies récupérées en marchant les en-têtes locaux, sur un dépôt qui en contient beaucoup
  plus → **écrire aux déposants** (CLESTHIA / support ORTOLANG).
- **Scoledit** a de vraies **dictées** (CP juin 2014, CE1 juin 2015 : six mots + deux phrases, même
  cohorte, avec aligneur produit ↔ normalisé) mais tout est derrière un compte gratuit →
  **demander l'accès** (`claude.ponton [@] univ-grenoble-alpes.fr`). Détail : `dictee/RESSOURCES_LIBRES.md` §6.
- **Chrome Web Store** : un numéro de version remis à Google est brûlé — bumper le manifest avant
  tout nouveau paquet (`extension/STORE.md`).
- **Validation terrain orthophonistes** : en suspens, décision de Rem.

---

## 3. Une décision qui t'attend

**Les dates du `JOURNAL.md` ont dérivé.** Des entrées portent « 2026-09-14 » et « 2026-09-16 » alors
que leurs commits datent du **08/09 entre 01:51 et 04:17** (`git log --date=iso`). Résultat : une
entrée datée à l'horloge réelle se retrouve au-dessus d'entrées étiquetées plus tard, et la règle
« entrée la plus récente en haut » devient fausse à la lecture. Deux issues possibles — re-dater les
entrées, ou acter que le JOURNAL suit un calendrier de projet distinct de git. **Ré-dater le texte
d'autrui n'est pas une décision d'assistant** : c'est à toi.

---

## 4. Les 18 chantiers ouverts

Ils sont listés **avec leur état mesuré et leur référence** dans `ETAT.md` (section chantiers),
générée depuis `dictee/etat_chantiers.json`. Ne pas en tenir une deuxième liste ici : elle
divergerait. Pour les voir :

```bash
python3 dictee/etat_gen.py     # régénère ETAT.md depuis la source curée
```

---

## 5. Les pièges qui ont coûté du temps (ne pas les repayer)

- **Une PR mergée n'accepte plus de commits.** Rem merge vite : tout ce qui est poussé après reste
  orphelin sur une branche fermée, invisible dans `gh pr list`. Avant chaque push :
  `git fetch origin && gh pr view <n> --json state,mergedAt`.
- **Le dépôt avance en parallèle.** Une branche vieille de quelques heures peut être en conflit
  (#700 l'a été après quatre merges). Le seul conflit réel était le **binaire** `omega-correcteur-dys.zip` ;
  les sources s'auto-mergent. Résolution : prendre la version d'amont, finir le rebase, **régénérer**
  zip et clone EN, re-mesurer.
- **`dev.sh` sans `fresh` ne régénère ni le zip ni le clone EN** — les deux contrôles « FRAIS »
  rougissent alors en fin de batterie.
- **Un `__pycache__` laissé dans `extension/`** fait REFUSER l'extension par Chrome (les noms
  commençant par `_` sont réservés) : deux gardes navigateur rouges pour une raison qui n'a rien à
  voir avec le code.
- **Le juge change plus souvent que le moteur.** Le chiffre de référence est passé de 402/19 à
  314/14 en une soirée sans que le produit bouge (portage du palier « mot inconnu » dans la
  référence). Ne jamais comparer deux mesures prises sur des bases différentes.
- **Un worktree n'a pas de `data_local/`** : poser `LEX4=` et `OMEGA_DYS_DATA=` explicitement.
- **Porter un correctif, c'est porter la DONNÉE, pas un usage.** La coquille « soulais » de Lexique 4
  était réparée côté Python DANS LA TABLE au chargement, côté JS dans une seule règle — une autre
  règle lisait la table brute et écrivait le non-mot **en rouge dans le produit** (#704). Poser la
  réparation au point que TOUTES les voies de chargement traversent (l'app en a deux : amorce
  synchrone et table asynchrone), et **vérifier l'ordre** : un `var` n'est hoisté qu'en nom, et
  `for (k in undefined)` ne lève rien — une réparation déclarée trop bas ne fait RIEN, sans un mot.
- **`parity_corr` est UNIDIRECTIONNELLE : un moteur MUET la passe.** « Nous allez au parc » a été
  corrigé par la référence et muet dans le produit pendant un jour (#702), garde des modaux portée
  avec un autre test. Le fichier a déjà la parade — les blocs d'EXIGENCE `_PREN`, `_BUT`, `_R8`,
  `_DES`, et depuis le 08/09 `_CONJ` — chacun né d'un silence. **Toute règle portée en JS a besoin de
  son bloc le jour même**, et il se vérifie en remettant le bug.
- **Un TAUX ment quand le banc grandit.** Les tables ayant gagné le passé simple pluriel, la sonde de
  couverture a gagné 156 cas et son taux a BAISSÉ alors que chaque case gagnait. Elle ancre désormais
  aussi le nombre absolu de réussites (#701). Se méfier de tout ratchet posé sur un pourcentage.
