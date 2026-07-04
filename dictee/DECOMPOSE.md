# Décomposeur de mots « à la Lexique 4 » — `decompose.py`

> *Lit et apprend des mots, les décompose comme dans Lexique 4* — **double voie** (SON **et** ORTHO),
> sur la machinerie OMEGA existante. Sous-projet **dictée**. OFF du moteur pendu (R66 : aucun couplage).

## Ce que c'est
Un outil qui prend un mot (ou un texte) et en produit une fiche de décomposition de type **Lexique 4** :
graphèmes, phonèmes (SAMPA + IPA), syllabes (son **et** ortho), structure CV, nombre de lettres/phonèmes/
syllabes, catégorie grammaticale, genre, nombre, nombre d'homophones — **et il l'apprend** (lexique
incrémental persistant).

## Réutilisation (doctrine §A2/A4 — la preuve est dans les `import`/appels, pas le discours)
| Brique réutilisée | Rôle |
|---|---|
| `g2p_tables.json` ← **extrait de `app/omega-pendu.html`** par `build_g2p_tables.py` | tables AQUA-PHOTON v3 (route **sublexicale** g→p, hésitation latente §3) — **mêmes** tables que le moteur |
| `phono_homophones.json` (43 580 groupes, clé = phono SAMPA Lexique) | route **lexicale** du SON (exacte) + **nbhomoph** + **vérité-terrain** d'apprentissage |
| `g2p_corrections.json` ← **appris** par `build_g2p_corrections.py` (boucle descendante) | corrige les erreurs systématiques du g2p, par alignement g↔p sur Lexique (TRAIN) |
| `cgram_gender/verbs/adj.json` (dérivés Lexique 4) | route **lexicale** de cgram / genre |
| `morpho.json` ← **décodé d'OMEGA_LEX4** par `build_morpho.py` (champs `md`/`mb` Lexique 4) | route **lexicale** de la **MORPHOLOGIE** (base + affixes) ; 20 523 mots |
| `diag_sentence.deacc / toks / norm` | tokenisation + normaliseur de surface (imports directs) |

C'est la **grammaire à double voie** (`GRAMMAIRE_DOUBLE_VOIE.md`) appliquée à la *décomposition* :
- **SON** = phono **lexicale** (SAMPA Lexique, exacte) × phono **sublexicale** (g2p, pour l'**OOV**).
- **ORTHO** = découpage en **graphèmes** + **syllabes orthographiques** (alignées sur les noyaux phonologiques).
- **MORPHO** = base + affixes (route **lexicale** `md/mb` de Lexique 4, ex. `portable → port + able [/port(er).able]`)
  × repli **sublexical** par affixes connus (`antibrouillage → anti + brouill + age`). Couverture test :
  ~14 % lexicale, ~54 % sublexicale.

**Validé contre la vérité Lexique** (OMEGA_LEX4 décodé, 64 634 mots) : **nbsyll = 100 %** · CV = convention `cvp` (désaccords = 3 entrées à diacritiques `:`/`'`).

## « Apprend » (boucle descendante, cf. `descending_probe.py` — data-bound, **FP=0**)
`learned_lex.json` grandit à chaque mot lu. Règle cardinale : **une source LEXICALE sûre n'est jamais
écrasée par une prédiction sublexicale** ; `lex` *promeut* `sublex` (montée en sûreté) ; l'usage répété
incrémente `vu`. On lit aussi des **textes** (`--read` / `--read-file`) : le lexique accumule fréquences
et inventaire phonèmes/graphèmes. *(Fichier d'état non versionné — cf. `.gitignore`.)*

## Décomposition PARALLÈLE 3 voies & lecture du corpus réel (`decompose_corpus.py`)
La base **décrit** (ne corrige pas — elle « ne peut pas se tromper »). Chaque mot est décomposé **en
parallèle** sur trois voies, comme Lexique 4 sépare ortho / phono / morpho-grammaire :
- **ORTHO** : graphèmes, syllabes orthographiques, nb de lettres.
- **PHON** : phonèmes SAMPA, syllabes phonologiques, structure CV.
- **GRAMMAIRE** : cgram / genre / nombre / morphologie (mot) **+ RÔLE EN CONTEXTE** (déterminant, verbe,
  préposition, accord/gouverneur) via les leviers descriptifs de `diag_sentence`.

`decompose_corpus.py` **lit le corpus réel** `corpus_gec_fr.jsonl` (98 paires GEC ; on n'utilise que les
phrases **correctes** comme source de mots) et **enrichit la base** : 1487 mots → **770 distincts** (FP=0).
La **grammaire en contexte est STOCKÉE** : `learn_word(role=…)` accumule un compteur de rôles par mot
(`« la »→{déterminant:61}`, `« est »→{verbe:25}`, `« important »→{accord-sg}`), visible dans `--lex`.
`--show` = aperçu parallèle en lecture seule ; `--phrase "…"` = une phrase de ton choix.

## Accents — solution déjà présente (ne pas réinventer)
Doctrine OMEGA (`JOURNAL §153`, `DICTEE_ROADMAP 1.1`, app `PHON_TO_LETTERS`) : **en lexique = lookup** du
mot accentué (`1_Mot`, rien à reconstruire) ; **hors-lexique = le phonème porte l'accent** (é=/e/, è=/ɛ/).
Le décomposeur l'applique déjà (route lexicale = lookup ; overlay g2p é→/e/, ç→/s/) et p2g émet des
graphies **accentuées** apprises du lexique — donc aucun système d'accents à rajouter ici.

## Route sublexicale améliorée (3 leviers mesurés)
1. **SEG enrichi** : la segmentation du moteur (43) est étendue de **8 segments** (`ti, sc, sh, oy, ay, ail, cqu, ueil`) **retenus après mesure** (`ion, ue, oui`… testés et **écartés** car ils dégradent). Le moteur pendu garde son SEG (R66) ; seul le décomposeur l'étend.
2. **Correction apprise (boucle descendante)** : `build_g2p_corrections.py` aligne (DP monotone) le g2p au phono Lexique sur le split TRAIN, apprend `(graphème, contexte)→phonème` (support≥20, pureté≥0,75 ⇒ 667 règles), corrige les erreurs systématiques (o/ɔ, finales…).
3. **Syllabation par règles** (attaque maximale) : `wa-zo`, `na-sj§`, `che → S°-vo` ; l'**orthosyll** est calqué sur le phonologique (`oi-seau`, `na-tion`, `beau-coup`).

## Lancer
```
python3 dictee/build_g2p_tables.py          # (1 fois) extrait les tables g2p de l'app
python3 dictee/build_g2p_corrections.py     # (1 fois) apprend la table de correction (TRAIN)
python3 dictee/decompose.py "chevaux"       # décompose un mot (son ET ortho)
python3 dictee/decompose.py --read "Le chat boit du lait."   # lit un texte et APPREND
python3 dictee/decompose.py --read-file texte.txt
python3 dictee/decompose.py --lex           # état du lexique appris
python3 dictee/decompose.py --measure       # harnais falsifiable (in-lexique vs OOV)
python3 dictee/decompose.py --demo
```

Exemple (`chevaux`, OOV de `phono_homophones` → route sublexicale ; cgram via route lexicale) :
```
« chevaux »  (7 lettres)
  ORTHO  graphèmes : ch→S  e→°  v→v  au→o  x→∅
         syllabes  : che-vaux
  SON    phono     : /S°vo/   [IPA ʃəvo]   route sublexicale (g2p, OOV)
         4 phonèmes · 2 syllabe(s) : S°-vo · CV=CVCV
  GRAM   cgram : NOM (lexicale) · genre : masculin · nombre : pluriel · homophones : 0
```

## Mesure (doctrine §1 — falsifiable, **HELD-OUT** in-lexique ⟂ OOV ; `seed=42`, test=4000)

> ⚠️ **Portée de la « route lexicale » du son** (audit 07/2026) : `W2P` ne couvre que les mots présents dans
> `phono_homophones` (c.-à-d. AYANT des homophones) — la mesure « in-lexique » est donc tirée de cette
> population-là, pas du lexique entier. Les chiffres restent exacts pour ce qu'ils mesurent ; ne pas les
> généraliser à « tout mot du lexique ».
Route **sublexicale** confrontée à la vérité-terrain (phono Lexique), **table de correction apprise sur
le split TRAIN, mesurée sur le split TEST** (pas de fuite) :

| étage | phono exact | fidélité phonémique | nbphons exact |
|---|---|---|---|
| (1) g2p moteur brut (SEG=43) | 48,6 % | 88,4 % | 76,0 % |
| (2) + SEG enrichi (+8 segments) | 50,9 % | 89,1 % | 77,0 % |
| **(3) + correction apprise (boucle descendante)** | **52,4 %** | **89,5 %** | 77,6 % |

- **Δ total = +3,7 points** d'exactitude (et +1,1 de fidélité phonémique), entièrement **mesuré en held-out**.
- **Ablation accents** (sur l'étage 3) : l'overlay (é→/e/, ç→/s/…) vaut **+0,5 pt** (le g2p de l'app, pensé
  pour le pendu ASCII, rendait `?` sur les accents — l'overlay est appliqué **côté décomposeur**, moteur intact).
- **OOV** (tenu séparé, §1.3) : 100 % produisent un phono ; pas de vérité-terrain → couverture/confiance
  seulement (confiance moyenne ≈ 0,68).
- **Garde-fous** (§1.5) : `chat→Sa`, `cheval→S°val`, `oiseau→wazo`, `examen→Egzam5`, **`nation→nasj§`** (OK).

## Audit honnête (§6) — ce qui marche / ce qui reste
- ✅ **Route lexicale** du son exacte par construction (mot connu → phono Lexique + nbhomoph corrects).
  ✅ **Décompo graphèmes/syllabes(son+ortho)/CV** + **cgram/genre** lexicaux. ✅ **Apprend** (FP=0) mesuré.
  ✅ **3 leviers sublexicaux** (SEG enrichi · correction apprise · syllabation par règles) **mesurés net-positifs**.
- ⚠️ **Route sublexicale = 52 % exact / 89,5 % phonémique** (held-out) : plafond restant du g2p heuristique.
  Erreurs résiduelles : `o/ɔ` non systématisé, schwa final isolé, contextes rares hors-règles.
- ⚠️ **Le panneau app n'a PAS encore ces 3 leviers** : il garde le `_DECL2.g2p` brut (engine SEG, sans
  correction) en sublexical + la route lexicale `OMEGA_LEX4` (exacte, ≥7 lettres). Parité app = jonction à venir
  (la table de correction est liée à la segmentation enrichie : il faut porter SEG_EXTRA dans le panneau).
- ✅ **Compressibilité** mesurée (section ci-dessous : 7,9× gzip, 17× factorisé). ✅ **Cognition
  phono→ortho** (jointe §3, croisement son×ortho) livrée : `p2g.py` / `dictee/P2G.md`.

## Compressibilité de la base (mesuré — `compress_probe.py`)
La base de décomposition « va être riche » → **est-elle compressible ? Oui, fortement** (n=50 000 mots) :

| représentation | taille | o/mot | ratio |
|---|---|---|---|
| JSON brut minifié | 8,7 Mo | 178 | 1× |
| gzip -9 | 1,1 Mo | 22,6 | 7,9× |
| **factorisé (colonnes) + gzip** | 512 Ko | 10,5 | **17×** |

- Le layout **factorisé** (colonnes `phono | cv | cgram…`) double le gain vs dict par-mot (gzip exploite la redondance).
- **51 % des phonos in-lexique sont reconstructibles par le g2p amélioré** → ne stocker que les **irréguliers**
  (lexique d'exceptions = logique double-voie : les règles couvrent le régulier). Entropie 4,63 bits/phonème.
- Embed app possible via le **même gzip+base64** que `OMEGA_LEX4` (bloc `lex4-data-gz`, `DecompressionStream`).

## Licence
Dérive de **Lexique 4** (New et al., 2026 ; *Behavior Research Methods* 58(5), 140) → **CC BY-SA 4.0**
(comme `phono_homophones.json`, `cgram_*.json`). `g2p_tables.json` provient du moteur OMEGA (briques PHON).
