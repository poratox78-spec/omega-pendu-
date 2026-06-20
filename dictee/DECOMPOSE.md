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
| `phono_homophones.json` (43 580 groupes, clé = phono SAMPA Lexique) | route **lexicale** du SON (exacte) + **nbhomoph** |
| `cgram_gender/verbs/adj.json` (dérivés Lexique 4) | route **lexicale** de cgram / genre |
| `diag_sentence.deacc / toks / norm` | tokenisation + normaliseur de surface (imports directs) |

C'est la **grammaire à double voie** (`GRAMMAIRE_DOUBLE_VOIE.md`) appliquée à la *décomposition* :
- **SON** = phono **lexicale** (SAMPA Lexique, exacte) × phono **sublexicale** (g2p, pour l'**OOV**).
- **ORTHO** = découpage en **graphèmes** + **syllabes orthographiques** (alignées sur les noyaux phonologiques).

## « Apprend » (boucle descendante, cf. `descending_probe.py` — data-bound, **FP=0**)
`learned_lex.json` grandit à chaque mot lu. Règle cardinale : **une source LEXICALE sûre n'est jamais
écrasée par une prédiction sublexicale** ; `lex` *promeut* `sublex` (montée en sûreté) ; l'usage répété
incrémente `vu`. On lit aussi des **textes** (`--read` / `--read-file`) : le lexique accumule fréquences
et inventaire phonèmes/graphèmes. *(Fichier d'état non versionné — cf. `.gitignore`.)*

## Lancer
```
python3 dictee/build_g2p_tables.py          # (1 fois) extrait les tables g2p de l'app
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
         syllabes  : chev-aux
  SON    phono     : /S°vo/   [IPA ʃəvo]   route sublexicale (g2p, OOV)
         4 phonèmes · 2 syllabe(s) : S°v-o · CV=CVCV
  GRAM   cgram : NOM (lexicale) · genre : masculin · nombre : pluriel · homophones : 0
```

## Mesure (doctrine §1 — falsifiable, in-lexique ⟂ OOV ; `seed=42`, n=3000)
Route **sublexicale** confrontée à la vérité-terrain (phono Lexique des mots in-lexique) :

| | phono exact | fidélité phonémique | nbphons exact |
|---|---|---|---|
| **avec overlay accents** | **46,4 %** | **88,0 %** | 75,7 % |
| sans overlay (port brut app) | 28,6 % | 81,7 % | 75,7 % |

- **Ablation falsifiable** : l'overlay accents (é→/e/, è→/ɛ/, ç→/s/…) fait passer les mots accentués de
  **0 % → 50 %** d'exactitude (le g2p de l'app, pensé pour le pendu ASCII, rendait `?` sur les accents).
- **OOV** (tenu séparé, §1.3) : 100 % produisent un phono ; pas de vérité-terrain → on ne reporte que
  couverture/confiance (confiance moyenne ≈ 0,67).
- **Garde-fous** (§1.5) : cas connus reproduits (`chat→Sa`, `cheval→S°val`, `oiseau→wazo`, `examen→Egzam5`…).

## Audit honnête (§6) — ce qui marche / ce qui reste
- ✅ **Route lexicale** du son exacte par construction (mot connu → phono Lexique + nbhomoph corrects).
  ✅ **Décompo graphèmes/syllabes/CV** + **cgram/genre** lexicaux opérationnels. ✅ **Apprend** (FP=0) mesuré.
- ⚠️ **Route sublexicale = 46 % exact / 88 % phonémique** : c'est le **plafond du g2p heuristique** repris
  tel quel (port **fidèle**, §A5 — pas d'amélioration silencieuse). Sources d'erreur : `o/ɔ` (observe→`opsERv`),
  `e` muet isolé (`le`→`/l/` au lieu de `/l°/`), digrammes hors `SEG` (`ti`→/sj/ non déclenché : `nation`).
- ⏳ **Pistes** (jonctions futures, chacune mesurée seule) : enrichir `SEG` (ti/sc/ay…), apprendre la
  correspondance IPA→SAMPA par alignement (façon boucle descendante), syllabation par règles (attaque
  maximale) plutôt qu'approchée. La **route lexicale couvrant les mots fréquents**, le sublexical ne sert
  que l'**OOV** — d'où le choix double voie.

## Licence
Dérive de **Lexique 4** (New et al., 2026 ; *Behavior Research Methods* 58(5), 140) → **CC BY-SA 4.0**
(comme `phono_homophones.json`, `cgram_*.json`). `g2p_tables.json` provient du moteur OMEGA (briques PHON).
