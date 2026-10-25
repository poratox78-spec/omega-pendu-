# Inventaire du correcteur

Écrit par `node dictee/inventaire_correcteur.js` à partir du code (liste n° 27, audit du 13/10/2026) — ne pas éditer à la main ;
`--check` (dev.sh, CI) refuse un inventaire en retard sur le moteur. Le routage complet des conseils est gardé par `dictee/textes_probe.js`.

## En chiffres

- Chaîne des règles de grammaire (`CRULES`, extension ≡ app) : **104** entrées, **78** noms affichés ; rouge : 64 · rouge avec un cas orange posé par la règle : 16 · rouge ou orange selon le sous-cas : 12 · orange : 12.
- Moteur Python : débranché de dev.sh et de la CI le 22/10/2026 (ligne 25b) — la chaîne n'est plus comparée ; la parité directe app ≡ extension la garde (`dictee/parity_app_ext.js`).
- Noms posés hors de la chaîne côté extension (orthographe, typographie, oranges) : **47**.
- Tables chargées : 11 (le chargeur unique `extension/charger_node.js` les charge toutes pour les bancs).

## Règles de grammaire, dans l'ordre de la chaîne

La « famille » est celle du conseil affiché (`famRegle` / `flagsToFacts`) ; « sans conseil » = famille sans texte d'explication, voulu
(ponctuation, style, répétition). Les tables sont repérées dans le source (lecture directe ou par une fonction appelée).

| # | règle | extension / app | Python | palier | famille du conseil | tables lues |
|---|---|---|---|---|---|---|
| 1 | élision inversée | `rDeselide` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | segmentation | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 2 | être (ête) | `rEteEtre` | `—` | rouge, orange dans un cas posé par la règle | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 3 | accord grammatical (é/er) | `rEer` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 4 | accord grammatical (é/er) | `rAInfE` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post |
| 5 | -e/-é (participe) | `rEPpl` | `—` | rouge | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 6 | participe après auxiliaire | `rAuxImparfait` | `—` | rouge | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 7 | participe après être à vérifier | `rEPplVig` | `—` | orange | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 8 | participe après être à vérifier | `rEtreFini` | `—` | orange | participe | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller) |
| 9 | accord participe | `rPpEtre` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 10 | accord participe (COD avoir) | `rPpAvoirCod` | `—` | rouge | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM, genre accentué |
| 11 | accord participe (dont) | `rPpAvoirDont` | `—` | rouge | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 12 | accord adjectif | `rAdjAttr` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM, prénoms, genre accentué |
| 13 | accord adjectif épithète | `rAdjEpithet` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM |
| 14 | accord adjectif épithète | `rAdjEpithetCoord` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, genre accentué |
| 15 | accord adjectif épithète | `rAdjGeo` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM |
| 16 | accord adjectif antéposé | `rQuelque` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post |
| 17 | accord adjectif épithète | `rAdjNumber` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM |
| 18 | accord participe épithète | `rPpEpithetNum` | `—` | rouge | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM, genre accentué |
| 19 | accord adjectif épithète | `rAdjAux` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM |
| 20 | accord participe épithète | `rPpEpithetFem` | `—` | rouge | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM, genre accentué |
| 21 | terminaison -er/-é/-ez/-ai | `rFlexionEr` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 22 | infinitif de but | `rInfBut` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 23 | impératif | `rImperatif` | `—` | rouge | personne | vdc-lex (conjugaison, genre, pluriels) |
| 24 | son/sont | `rSon` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 25 | on/ont | `rOn` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 26 | leur/leurs | `rLeur` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, genre accentué |
| 27 | a/à | `rA` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms |
| 28 | et/est | `rEt` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post, étiqueteur HMM |
| 29 | est/et (proposition) | `rEstEtClause` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM |
| 30 | peu/peux/peut | `rPeu` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), étiqueteur HMM |
| 31 | sujet je | `rJeSubject` | `—` | rouge | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 32 | sais/sait | `rSais` | `—` | rouge | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 33 | ce/se | `rCe` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, genre accentué |
| 34 | des/dès | `rDesDes` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 35 | c'est/s'est | `rCestSest` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 36 | c'est/s'est | `rCesSest` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), étiqueteur HMM |
| 37 | ça/sa | `rCaSa` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post |
| 38 | ou/où | `rOuOu` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 39 | met/mais | `rMetMais` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM |
| 40 | mai/mais | `rMaiMais` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 41 | mais/mes | `rMais` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post |
| 42 | élision fusionnée | `rElisionFusionnee` | `—` | rouge | segmentation | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 43 | du/de | `rDuDe` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 44 | du/dû | `rDuDu` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 45 | sur/sûr | `rSurSur` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 46 | la/là | `rLaLa` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 47 | guère/guerre | `rGuere` | `—` | rouge | homophone_lex | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 48 | vit/vie | `rSaVit` | `—` | rouge | homophone_lex | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 49 | j'est/j'ai | `rJest` | `—` | rouge | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 50 | c'ai/c'est | `rCai` | `—` | rouge | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 51 | élision | `rElide` | `—` | rouge | segmentation | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 52 | accord sujet-verbe | `rAccordSV` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 53 | accord sujet-verbe | `rLestJe155` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 54 | accord sujet-verbe | `rIlIls` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 55 | accord sujet-verbe | `rAccordSVrecover` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 56 | accord sujet-verbe | `rAccordSVnounEt` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 57 | accord sujet-verbe | `rAccordSVnounElid` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 58 | accord sujet-verbe | `rAisAit` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM, prénoms, genre accentué |
| 59 | accord sujet-verbe | `rAiAit` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 60 | accord sujet-verbe | `rAccordSVquant` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), étiqueteur HMM |
| 61 | accord sujet-verbe | `rAccordSVrelatif161` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), étiqueteur HMM |
| 62 | accord sujet-verbe | `rAccordSVcoord` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), étiqueteur HMM, prénoms |
| 63 | accord sujet-verbe | `rAccordSVinfinitif` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), étiqueteur HMM |
| 64 | accord sujet-verbe | `rPostpose` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM, prénoms, genre accentué |
| 65 | accord sujet-verbe | `rAccordVerbCoord` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 66 | accord sujet-verbe | `rAccordRelObj` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM, prénoms, genre accentué |
| 67 | accord sujet-verbe | `rAccordIncise` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM |
| 68 | genre déterminant | `rDetGenre` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 69 | accord tout | `rTout` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post, genre accentué |
| 70 | infinitif après pronom sujet à vérifier | `rPronInf` | `—` | orange | personne | vdc-lex (conjugaison, genre, pluriels) |
| 71 | accord adjectif antéposé | `rAdjAntePl` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, genre accentué |
| 72 | accord adjectif antéposé | `rAdjAnteGenre` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 73 | nom féminin en -ée | `rFemEe` | `—` | rouge | muette | — |
| 74 | accord pluriel nom | `rNounPlural` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post, genre accentué |
| 75 | accord singulier nom | `rNounSing` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 76 | usage être/avoir | `rAuxUsage` | `—` | rouge | personne | vdc-lex (conjugaison, genre, pluriels) |
| 77 | aux mal orthographié | `rAuxMisspell` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | surface | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 78 | accent (âge) | `rAgeAcc` | `—` | rouge | accent | — |
| 79 | étais après c'/s' | `rCetaitEtait` | `—` | rouge | personne | — |
| 80 | participe après avoir | `rAvoirFini` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | participe | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller) |
| 81 | participe après s'est | `rEtreInfEr` | `—` | rouge | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, genre accentué |
| 82 | négation | `rNegNe` | `—` | rouge | segmentation | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 83 | si + conditionnel | `rSiCond` | `—` | rouge, orange dans un cas posé par la règle | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 84 | quel que soit | `rQuelQue` | `—` | rouge | segmentation | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 85 | qu'il (élision) | `rQuiPron` | `—` | rouge, orange dans un cas posé par la règle | segmentation | — |
| 86 | que/dont | `rQueDont` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM |
| 87 | qui/que | `rQuiQue` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM |
| 88 | près/prêt | `rPresPret` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | dictionnaire (speller), étiqueteur HMM |
| 89 | cher/chez | `rCherChez` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 90 | davantage | `rDavantage` | `—` | rouge, orange dans un cas posé par la règle | segmentation | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller) |
| 91 | conditionnel à vérifier | `rCondSi` | `—` | orange | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 92 | temps du verbe à vérifier | `rTempsProtase` | `—` | orange | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 93 | impératif à vérifier | `rImperatifSeul` | `—` | orange | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM |
| 94 | subjonctif à vérifier | `rSubjonctif` | `—` | orange | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 95 | mot-outil à vérifier | `rHomophoneMo` | `—` | orange | homophone_gram | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller) |
| 96 | petit mot après le sujet à vérifier | `rApresSujet` | `—` | orange | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 97 | expression figée à vérifier | `rFige` | `—` | orange | homophone_gram | vdc-lex (conjugaison, genre, pluriels) |
| 98 | mot soudé à vérifier | `rSoude` | `—` | orange | segmentation | vdc-lex (conjugaison, genre, pluriels) |
| 99 | plutôt / plus tôt à vérifier | `rPlutot` | `—` | orange | segmentation | vdc-lex (conjugaison, genre, pluriels) |
| 100 | adjectif en -ant/-ent | `rAntAdj` | `—` | rouge, orange dans un cas posé par la règle | homophone_lex | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM |
| 101 | vingt/cent | `rVingtCent` | `—` | rouge | accord | — |
| 102 | personne du verbe | `rVousIrr` | `—` | rouge | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 103 | personne du verbe | `sujFlexVig` | `—` | rouge, orange dans un cas posé par la règle | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM, prénoms, genre accentué |
| 104 | majuscule | `rCapital` | `—` | rouge | majuscule | — |

## Noms posés hors de la chaîne (extension)

Orthographe, typographie, mots inconnus, et les oranges posées après la chaîne. « Python » = fichier où le nom apparaît.

| nom | occurrences | palier | famille du conseil | dans la chaîne Python | Python |
|---|---|---|---|---|---|
| abréviation | 1 | selon la couche | style (sans conseil) | — | — |
| accord adjectif à vérifier | 1 | orange | accord | — | — |
| accord du participe après avoir à vérifier | 1 | orange | participe | — | correcteur_probe.py |
| accord du verbe au sujet nominal à vérifier | 1 | orange | accord | — | correcteur_probe.py |
| accord genre à vérifier | 1 | orange | accord | — | — |
| accord participe à vérifier | 4 | orange | participe | — | — |
| accord pluriel à vérifier | 2 | orange | accord | — | — |
| accord sujet-verbe à vérifier | 1 | orange | accord | — | — |
| accord verbe à vérifier | 2 | orange | accord | — | — |
| anglicisme | 2 | selon la couche | style (sans conseil) | — | — |
| auxiliaire manquant à vérifier | 1 | orange | participe | — | correcteur_probe.py |
| c'est/ces à vérifier | 2 | orange | homophone_gram | — | correcteur_probe.py |
| ces/ses à vérifier | 1 | orange | homophone_gram | — | — |
| conjugaison après je à vérifier | 1 | orange | personne | — | — |
| contraction | 1 | selon la couche | contraction (sans conseil) | — | — |
| élision | 7 | selon la couche | segmentation | — | correcteur_probe.py |
| espace après la virgule | 1 | selon la couche | ponctuation (sans conseil) | — | — |
| espace avant la ponctuation | 1 | selon la couche | ponctuation (sans conseil) | — | — |
| espace double | 1 | selon la couche | ponctuation (sans conseil) | — | — |
| espacement | 1 | selon la couche | ponctuation (sans conseil) | — | — |
| forme en -ant à vérifier | 1 | orange | participe | — | — |
| genre de la personne qui écrit | 1 | selon la couche | participe | — | — |
| homophone à vérifier | 3 | orange | homophone_lex | — | — |
| impératif (pronom) | 1 | selon la couche | segmentation | — | — |
| infinitif après semi-auxiliaire à vérifier | 1 | orange | personne | — | correcteur_probe.py |
| j'est/j'ai à vérifier | 1 | orange | personne | — | correcteur_probe.py |
| majuscule initiale à vérifier | 1 | orange | majuscule | — | — |
| mot coupé | 1 | selon la couche | ponctuation (sans conseil) | — | — |
| mot inconnu | 3 | selon la couche | surface | — | — |
| nombre | 1 | selon la couche | style (sans conseil) | — | correcteur_probe.py |
| nombre du déterminant à vérifier | 1 | orange | accord | — | correcteur_probe.py |
| on/ont après un sujet pluriel à vérifier | 1 | orange | homophone_gram | — | correcteur_probe.py |
| orthographe | 1 | selon la couche | surface | — | — |
| ou/où à vérifier | 1 | orange | homophone_gram | — | — |
| participe présent après « en » à vérifier | 1 | orange | participe | — | — |
| personne du verbe à vérifier | 1 | orange | personne | — | correcteur_probe.py |
| personne du verbe par le son à vérifier | 1 | orange | personne | — | — |
| pléonasme | 1 | selon la couche | style (sans conseil) | — | — |
| pluriel par le son à vérifier | 1 | orange | accord | — | correcteur_probe.py |
| point d'interrogation | 2 | selon la couche | ponctuation (sans conseil) | — | — |
| point final | 1 | selon la couche | ponctuation (sans conseil) | — | — |
| répétition | 1 | selon la couche | repetition (sans conseil) | — | — |
| sait/s'est à vérifier | 1 | orange | homophone_gram | — | — |
| trait d'union | 2 | selon la couche | ponctuation (sans conseil) | — | — |
| typographie | 3 | selon la couche | style (sans conseil) | — | — |
| virgule | 1 | selon la couche | ponctuation (sans conseil) | — | — |
| virgule doublée | 1 | selon la couche | ponctuation (sans conseil) | — | — |

## Tables et qui les lit

« Directement » : les fonctions dont le code nomme une variable de la table (les 8 premières, ordre du fichier).

| table | chargée par | variables | règles de la chaîne qui la lisent | lue directement par |
|---|---|---|---|---|
| vdc-lex (conjugaison, genre, pluriels) | `_applyVdc` | `BCLF` `COMMON_VERBS` `GENDER_MAP` `GENDER_PURE` `ADJP` `CONJ_F` `CONJ_C` `NOUN_PLURAL` | 97 / 104 | `_persDe` `lexicalGender` `_pplRe66` `_isPpl` `vlike` `rEer` `_inf1` `rFlexionEr` … (111) |
| genre relâché | `_applyGenderRelaxed` | `GENDER_PURE` | 80 / 104 | `rEPplVig` `rEPpl` `_cestNomFem` `rCaSa` `rAccordIncise` `rDetGenre` `_tousFem101` `rTout` … (24) |
| dictionnaire (speller) | `_applySpellerTSV` | `SP` | 57 / 104 | `_isPplWideEr` `_canonW` `_emit` `rInfBut` `_spos` `_pplForm` `_infForm` `rAInfE` … (65) |
| noun-post | `_applyNounPost` | `NOUN_POST` | 24 / 104 | `_etreAttrEr` `rOn` `_rAbase` `_aaApresAdverbe` `_rAnouveau` `_rEtNouveau` `rCaSa` `cestCesVig` … (33) |
| étiqueteur HMM | `setPosHmm` | `_HMM` | 44 / 104 | `posTags` |
| modèle OS-sujet | `setOsLm` | `_OSLM` | 0 / 104 | `_osPuni` `_osPfwd` `_osPbwd` `osVerbVig` `complete` |
| prénoms | `_applyPrenoms` | `PRENOMS` | 16 / 104 | `_rAbase` `rAccordSVcoord` `_npSubject` `_tierOf` `spellTokenCore` `_suPrenom` `nomVerbeVig` |
| genre accentué | `_applyGaccLex` | `_GACC` | 24 / 104 | `rEer` `rFlexionEr` `rCe` `_nounGender` `rAdjEpithetCoord` |
| confusables | `setConfusables` | `_CONFW` `_CONFBF` | 0 / 104 | `_vigOne` `vigText` |
| genre de l'auteur (réglage) | `setAuteur` | `_AUTEUR` | 0 / 104 | `getAuteur` `auteurSugg` `auteurPasse` |
| ponctuation vocale | `setPonctLm` | `_PLM` | 0 / 104 | `ponctReady` `ponctDist` |
