# Inventaire du correcteur

Écrit par `node dictee/inventaire_correcteur.js` à partir du code (liste n° 27, audit du 13/10/2026) — ne pas éditer à la main ;
`--check` (dev.sh, CI) refuse un inventaire en retard sur le moteur. Le routage complet des conseils est gardé par `dictee/textes_probe.js`.

## En chiffres

- Chaîne des règles de grammaire (`CRULES`, extension ≡ app) : **224** entrées, **91** noms affichés ; rouge : 77 · rouge avec un cas orange posé par la règle : 46 · rouge ou orange selon le sous-cas : 44 · orange : 57.
- Moteur Python : débranché de dev.sh et de la CI le 22/10/2026 (ligne 25b) — la chaîne n'est plus comparée ; la parité directe app ≡ extension la garde (`dictee/parity_app_ext.js`).
- Noms posés hors de la chaîne côté extension (orthographe, typographie, oranges) : **52**.
- Tables chargées : 11 (le chargeur unique `extension/charger_node.js` les charge toutes pour les bancs).

## Règles de grammaire, dans l'ordre de la chaîne

La « famille » est celle du conseil affiché (`famRegle` / `flagsToFacts`) ; « sans conseil » = famille sans texte d'explication, voulu
(ponctuation, style, répétition). Les tables sont repérées dans le source (lecture directe ou par une fonction appelée).

| # | règle | extension / app | Python | palier | famille du conseil | tables lues |
|---|---|---|---|---|---|---|
| 1 | homophone à vérifier | `rPron540` | `—` | orange | homophone_lex | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 2 | accord participe (COD avoir) | `rPpNom460` | `—` | rouge | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post, genre accentué |
| 3 | élision inversée | `rDeselide` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | segmentation | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 4 | être (ête) | `rEteEtre` | `—` | rouge, orange dans un cas posé par la règle | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 5 | accord grammatical (é/er) | `rEer` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 6 | accord grammatical (é/er) | `rAInfE` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post |
| 7 | accord grammatical (é/er) | `rPrepClPpl170` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 8 | -e/-é (participe) | `rEPpl` | `—` | rouge | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 9 | participe après auxiliaire | `rAuxImparfait` | `—` | rouge | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 10 | participe après être à vérifier | `rEPplVig` | `—` | orange | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 11 | participe après être à vérifier | `rEtreFini` | `—` | orange | participe | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller) |
| 12 | accord participe | `rPpEtre` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 13 | accord participe (COD avoir) | `rPpAvoirCod` | `—` | rouge, orange dans un cas posé par la règle | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, genre accentué |
| 14 | accord participe (COD avoir) | `rPpQuel259` | `—` | rouge | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 15 | accord participe (dont) | `rPpAvoirDont` | `—` | rouge | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 16 | accord adjectif | `rAdjAttr` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 17 | accord adjectif épithète | `rAdjEpithet` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, genre accentué |
| 18 | accord adjectif épithète | `rAdjEpithetCoord` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, genre accentué |
| 19 | accord adjectif épithète | `rAdjGeo` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 20 | accord adjectif antéposé | `rQuelque` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post |
| 21 | accord adjectif épithète | `rAdjNumber` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 22 | accord participe épithète | `rPpEpithetNum` | `—` | rouge, orange dans un cas posé par la règle | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, genre accentué |
| 23 | accord adjectif épithète | `rAdjAux` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 24 | accord participe épithète | `rPpEpithetFem` | `—` | rouge, orange dans un cas posé par la règle | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, genre accentué |
| 25 | terminaison -er/-é/-ez/-ai | `rFlexionEr` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 26 | infinitif de but | `rInfBut` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 27 | impératif | `rImperatif` | `—` | rouge | personne | vdc-lex (conjugaison, genre, pluriels) |
| 28 | son/sont | `rSon` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 29 | on/ont | `rOn` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 30 | leur/leurs | `rLeur` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, genre accentué |
| 31 | a/à | `rA` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms |
| 32 | et/est | `rEt` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post, étiqueteur HMM |
| 33 | est/et (proposition) | `rEstEtClause` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 34 | peu/peux/peut | `rPeu` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post, étiqueteur HMM |
| 35 | sujet je | `rJeSubject` | `—` | rouge | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 36 | sais/sait | `rSais` | `—` | rouge | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 37 | ce/se | `rCe` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, genre accentué |
| 38 | des/dès | `rDesDes` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 39 | c'est/s'est | `rCestSest` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 40 | c'est/s'est | `rCesSest` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post, étiqueteur HMM |
| 41 | ça/sa | `rCaSa` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post |
| 42 | ou/où | `rOuOu` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 43 | met/mais | `rMetMais` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 44 | mai/mais | `rMaiMais` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 45 | mais/mes | `rMais` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post |
| 46 | élision fusionnée | `rElisionFusionnee` | `—` | rouge | segmentation | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 47 | du/de | `rDuDe` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 48 | du/dû | `rDuDu` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 49 | sur/sûr | `rSurSur` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 50 | la/là | `rLaLa` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 51 | guère/guerre | `rGuere` | `—` | rouge | homophone_lex | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 52 | vit/vie | `rSaVit` | `—` | rouge | homophone_lex | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 53 | j'est/j'ai | `rJest` | `—` | rouge, orange dans un cas posé par la règle | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 54 | c'ai/c'est | `rCai` | `—` | rouge | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 55 | élision | `rElide` | `—` | rouge | segmentation | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 56 | a/à | `rASecond322` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post, étiqueteur HMM |
| 57 | accord verbe à vérifier | `rForme327` | `—` | orange | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 58 | accord pluriel à vérifier | `rPlQuant313` | `—` | orange | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, genre accentué |
| 59 | accord pluriel à vérifier | `rPpPl313` | `—` | orange | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, genre accentué |
| 60 | accord sujet-verbe | `rAccordSV` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 61 | accord sujet-verbe | `rLestJe155` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 62 | accord sujet-verbe | `rIlIls` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 63 | il y a | `rIlYa203` | `—` | rouge | segmentation | — |
| 64 | et/est | `rEstSecond301` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post, étiqueteur HMM |
| 65 | et/est | `rEtGn301` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post, étiqueteur HMM, prénoms |
| 66 | son/sont | `rSon301` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), noun-post |
| 67 | la/là | `rLa301` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post, étiqueteur HMM, prénoms |
| 68 | a/à | `rA301` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post, étiqueteur HMM |
| 69 | ou/où | `rOu301` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), noun-post |
| 70 | ce/se | `rCe301` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post, étiqueteur HMM, prénoms |
| 71 | c'est/s'est | `rCest301` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post |
| 72 | homophone à vérifier | `rPetits301` | `—` | orange | homophone_lex | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms |
| 73 | participe après avoir | `rAvoirIrr311` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | participe | — |
| 74 | accord adjectif à vérifier | `rAttr314` | `—` | orange | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 75 | accord pluriel à vérifier | `rCoordPl315` | `—` | orange | accord | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post, étiqueteur HMM |
| 76 | accord pluriel à vérifier | `rAdvNum315` | `—` | orange | accord | dictionnaire (speller), noun-post, étiqueteur HMM |
| 77 | accord adjectif à vérifier | `rAnte315` | `—` | orange | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 78 | accord participe à vérifier | `rPpGenre316` | `—` | orange | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 79 | accord pluriel à vérifier | `rDet317` | `—` | orange | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post, genre accentué |
| 80 | genre déterminant | `rUn317` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post |
| 81 | accord verbe à vérifier | `rSV318` | `—` | orange | accord | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post, étiqueteur HMM, prénoms |
| 82 | participe après avoir | `rAvoir319` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | participe | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post |
| 83 | homophone à vérifier | `rFige320` | `—` | orange | homophone_lex | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), prénoms |
| 84 | homophone à vérifier | `rSon321` | `—` | orange | homophone_lex | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 85 | homophone à vérifier | `rLot322` | `—` | orange | homophone_lex | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 86 | accord pluriel à vérifier | `rAcc323` | `—` | orange | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, genre accentué |
| 87 | et/est | `rEtEst325` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post, étiqueteur HMM |
| 88 | homophone à vérifier | `rLot325` | `—` | orange | homophone_lex | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post |
| 89 | accord pluriel à vérifier | `rLot326` | `—` | orange | accord | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post, étiqueteur HMM |
| 90 | accord pluriel à vérifier | `rCoord327` | `—` | orange | accord | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post, étiqueteur HMM |
| 91 | homophone à vérifier | `rLot327` | `—` | orange | homophone_lex | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post |
| 92 | accord participe à vérifier | `rSeNom299` | `—` | orange | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 93 | et/est | `rEtNom299` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), noun-post |
| 94 | accord participe à vérifier | `rQuiEst299` | `—` | orange | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, genre accentué |
| 95 | participe après avoir | `rEus299` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 96 | mot-outil à vérifier | `rTant299` | `—` | orange | homophone_gram | — |
| 97 | accord adjectif antéposé | `rLequel299` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), genre accentué |
| 98 | accord adjectif antéposé | `rQuelNom299` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, genre accentué |
| 99 | accord adjectif antéposé | `rPetits299` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post |
| 100 | accent manquant | `rDemi299` | `—` | rouge | accent | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 101 | accord adjectif antéposé | `rDeAdj299` | `—` | rouge, orange dans un cas posé par la règle | accord | noun-post |
| 102 | accord tout | `rToutFem299` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels) |
| 103 | accord verbe à vérifier | `rQuantDe295` | `—` | orange | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post |
| 104 | homophone à vérifier | `rPendant295` | `—` | orange | homophone_lex | vdc-lex (conjugaison, genre, pluriels) |
| 105 | personne du verbe à vérifier | `rPsSansT295` | `—` | orange | personne | vdc-lex (conjugaison, genre, pluriels) |
| 106 | accord participe à vérifier | `rSeCod295` | `—` | orange | participe | — |
| 107 | impératif à vérifier | `rFermeTete295` | `—` | orange | personne | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post, étiqueteur HMM |
| 108 | accord pluriel à vérifier | `rPlAdj295` | `—` | orange | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, genre accentué |
| 109 | homophone à vérifier | `rQuelle295` | `—` | orange | homophone_lex | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post, genre accentué |
| 110 | du/dû | `rDuDuA295` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 111 | accord grammatical (é/er) | `rPrepIrr295` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | accord | — |
| 112 | subjonctif à vérifier | `rQuoiqu295` | `—` | orange | personne | vdc-lex (conjugaison, genre, pluriels) |
| 113 | c'est/s'est | `rSestCest270` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels) |
| 114 | c'est/s'est | `rCestSest271` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 115 | la/là | `rLaLa272` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), prénoms |
| 116 | sur/sûr | `rSurDet273` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 117 | mot-outil à vérifier | `rOuAu274` | `—` | orange | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 118 | homophone à vérifier | `rSoit275` | `—` | orange | homophone_lex | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 119 | personne du verbe | `rPenseTu276` | `—` | rouge | personne | vdc-lex (conjugaison, genre, pluriels) |
| 120 | accord participe | `rPpEtreInv277` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 121 | accord pluriel à vérifier | `rSuper278` | `—` | orange | accord | vdc-lex (conjugaison, genre, pluriels) |
| 122 | accord participe à vérifier | `rEtant279` | `—` | orange | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, genre accentué |
| 123 | forme en -ant à vérifier | `rAnts281` | `—` | orange | participe | vdc-lex (conjugaison, genre, pluriels), noun-post |
| 124 | impératif à vérifier | `rImperNe282` | `—` | orange | personne | vdc-lex (conjugaison, genre, pluriels) |
| 125 | impératif à vérifier | `rImperSeul283` | `—` | orange | personne | vdc-lex (conjugaison, genre, pluriels) |
| 126 | accord adjectif à vérifier | `rCherFort284` | `—` | orange | accord | — |
| 127 | pluriel du nom composé | `rComp285` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 128 | négation | `rNeOublie286` | `—` | rouge, orange dans un cas posé par la règle | segmentation | vdc-lex (conjugaison, genre, pluriels) |
| 129 | a/à | `rAaccent287` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | prénoms |
| 130 | son/sont | `rSon288` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post |
| 131 | ce/se | `rSeDoit289` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | — |
| 132 | ou/où | `rOuPar290` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | dictionnaire (speller), noun-post, étiqueteur HMM |
| 133 | a/à | `rAInf368` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post, étiqueteur HMM |
| 134 | accord grammatical (é/er) | `rAInfPp368` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | accord | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post, étiqueteur HMM |
| 135 | accord participe | `rModEtre364` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 136 | accord pluriel à vérifier | `rChers359` | `—` | orange | accord | dictionnaire (speller), noun-post, étiqueteur HMM |
| 137 | accord participe | `rTousPp359` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 138 | accord participe | `rVenezPp359` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 139 | impératif à vérifier | `rDite359` | `—` | orange | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 140 | ou/où | `rOuNombre360` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 141 | a/à | `rAInf358` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post, étiqueteur HMM |
| 142 | ou/où | `rOuDe354` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 143 | ça/sa | `rSaAdj354` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 144 | a/à | `rAHeure354` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), noun-post |
| 145 | a/à | `rAPp354` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post, étiqueteur HMM |
| 146 | accord participe | `rAPpPart354` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 147 | c'est/s'est | `rCestAnime354` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), prénoms |
| 148 | que/dont | `rCeDonc290` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 149 | accord grammatical (é/er) | `rQuoiPp290` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | accord | vdc-lex (conjugaison, genre, pluriels) |
| 150 | participe après avoir | `rAuxIr290` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | participe | — |
| 151 | accord sujet-verbe | `rFormes265` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 152 | peu/peux/peut | `rPeuEtre242` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 153 | mot-outil à vérifier | `rHors244` | `—` | orange | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 154 | nôtre/vôtre | `rNotre245` | `—` | rouge | accent | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post |
| 155 | déterminant devant voyelle | `rDetVoy246` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post |
| 156 | accord adjectif antéposé | `rTel247` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 157 | homophone à vérifier | `rFois248` | `—` | orange | homophone_lex | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 158 | accent manquant | `rGrace249` | `—` | rouge, orange dans un cas posé par la règle | accent | — |
| 159 | accent manquant | `rCote249` | `—` | rouge | accent | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 160 | accord singulier nom | `rModeEmploi350` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 161 | accord participe | `rQuePrevu353` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 162 | accord participe | `rPpTronq353` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 163 | accent manquant | `rVoila249` | `—` | rouge | accent | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 164 | accent manquant | `rFaites249` | `—` | rouge | accent | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 165 | qu'il (élision) | `rSil250` | `—` | rouge | segmentation | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 166 | vingt/cent | `rMille251` | `—` | rouge, orange dans un cas posé par la règle | accord | — |
| 167 | passé simple (sans accent) | `rPasseSimple204` | `—` | rouge | accent | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 168 | accord sujet-verbe | `rAccordSVrecover` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 169 | accord participe | `rPpEpi487` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, genre accentué |
| 170 | accord sujet-verbe | `rAccordSVnounEt` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 171 | accord sujet-verbe | `rAccordSVnounElid` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 172 | accord sujet-verbe | `rAisAit` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 173 | accord sujet-verbe | `rAiAit` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 174 | accord sujet-verbe | `rAccordSVquant` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post, étiqueteur HMM |
| 175 | accord sujet-verbe | `rAccordSVrelatif161` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post, étiqueteur HMM |
| 176 | accord sujet-verbe | `rAccordSVcoord` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post, étiqueteur HMM, prénoms |
| 177 | accord sujet-verbe | `rAccordSVinfinitif` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post, étiqueteur HMM |
| 178 | accord sujet-verbe | `rPostpose` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 179 | accord sujet-verbe | `rAccordVerbCoord` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 180 | accord sujet-verbe | `rAccordRelObj` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 181 | accord sujet-verbe | `rAccordIncise` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 182 | genre déterminant | `rDetGenre` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, genre accentué |
| 183 | accord tout | `rTout` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, genre accentué |
| 184 | infinitif après pronom sujet à vérifier | `rPronInf` | `—` | orange | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 185 | accord adjectif antéposé | `rAdjAntePl` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, genre accentué |
| 186 | accord adjectif antéposé | `rAdjAnteGenre` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 187 | nom féminin en -ée | `rFemEe` | `—` | rouge | muette | prénoms |
| 188 | accord pluriel nom | `rNounPlural` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post, genre accentué |
| 189 | accord singulier nom | `rNounSing` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 190 | usage être/avoir | `rAuxUsage` | `—` | rouge | personne | vdc-lex (conjugaison, genre, pluriels) |
| 191 | aux mal orthographié | `rAuxMisspell` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | surface | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 192 | accent (âge) | `rAgeAcc` | `—` | rouge | accent | — |
| 193 | étais après c'/s' | `rCetaitEtait` | `—` | rouge | personne | — |
| 194 | participe après avoir | `rAvoirFini` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | participe | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller) |
| 195 | participe après s'est | `rEtreInfEr` | `—` | rouge, orange dans un cas posé par la règle | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post, genre accentué |
| 196 | négation | `rNegNe` | `—` | rouge | segmentation | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 197 | si + conditionnel | `rSiCond` | `—` | rouge, orange dans un cas posé par la règle | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 198 | quel que soit | `rQuelQue` | `—` | rouge | segmentation | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 199 | qu'il (élision) | `rQuiPron` | `—` | rouge, orange dans un cas posé par la règle | segmentation | — |
| 200 | que/dont | `rQueDont` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 201 | qui/que | `rQuiQue` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 202 | près/prêt | `rPresPret` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | dictionnaire (speller), noun-post, étiqueteur HMM |
| 203 | expression figée à vérifier | `rFairePartie206` | `—` | orange | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 204 | participe après avoir | `rAvoirPus206` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | participe | — |
| 205 | cher/chez | `rCherChez` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 206 | davantage | `rDavantage` | `—` | rouge, orange dans un cas posé par la règle | segmentation | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller) |
| 207 | conditionnel à vérifier | `rCondSi` | `—` | orange | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 208 | temps du verbe à vérifier | `rTempsProtase` | `—` | orange | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 209 | impératif à vérifier | `rImperatifSeul` | `—` | orange | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 210 | subjonctif à vérifier | `rSubjonctif` | `—` | orange | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 211 | mot-outil à vérifier | `rHomophoneMo` | `—` | orange | homophone_gram | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post, étiqueteur HMM |
| 212 | petit mot après le sujet à vérifier | `rApresSujet` | `—` | orange | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 213 | expression figée à vérifier | `rFige` | `—` | orange | homophone_gram | vdc-lex (conjugaison, genre, pluriels), noun-post |
| 214 | mot soudé à vérifier | `rSoude` | `—` | orange | segmentation | vdc-lex (conjugaison, genre, pluriels) |
| 215 | plutôt / plus tôt à vérifier | `rPlutot` | `—` | orange | segmentation | vdc-lex (conjugaison, genre, pluriels) |
| 216 | adjectif en -ant/-ent | `rAntAdj` | `—` | rouge, orange dans un cas posé par la règle | homophone_lex | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 217 | vingt/cent | `rVingtCent` | `—` | rouge | accord | noun-post |
| 218 | personne du verbe | `rVousIrr` | `—` | rouge | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 219 | personne du verbe | `rIlsIrr525` | `—` | rouge | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 220 | personne du verbe | `sujFlexVig` | `—` | rouge, orange dans un cas posé par la règle | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 221 | accord adjectif épithète | `rAdjCoordApp500` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 222 | participe après avoir | `rPpCoordAv498` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 223 | participe après être à vérifier | `rPpCoordEt498` | `—` | orange | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 224 | majuscule | `rCapital` | `—` | rouge | majuscule | — |

## Noms posés hors de la chaîne (extension)

Orthographe, typographie, mots inconnus, et les oranges posées après la chaîne. « Python » = fichier où le nom apparaît.

| nom | occurrences | palier | famille du conseil | dans la chaîne Python | Python |
|---|---|---|---|---|---|
| abréviation | 1 | selon la couche | style (sans conseil) | — | — |
| accord adjectif à vérifier | 3 | orange | accord | — | — |
| accord du participe après avoir à vérifier | 1 | orange | participe | — | correcteur_probe.py |
| accord du verbe au sujet nominal à vérifier | 1 | orange | accord | — | correcteur_probe.py |
| accord genre à vérifier | 2 | orange | accord | — | — |
| accord participe (pronom complément) | 1 | selon la couche | participe | — | — |
| accord participe à vérifier | 7 | orange | participe | — | — |
| accord participe épithète | 1 | selon la couche | participe | — | correcteur_probe.py |
| accord pluriel à vérifier | 3 | orange | accord | — | — |
| accord sujet-verbe à vérifier | 2 | orange | accord | — | — |
| accord verbe à vérifier | 2 | orange | accord | — | — |
| anglicisme | 2 | selon la couche | style (sans conseil) | — | — |
| auxiliaire manquant à vérifier | 1 | orange | participe | — | correcteur_probe.py |
| c'est/ces à vérifier | 2 | orange | homophone_gram | — | correcteur_probe.py |
| ces/ses à vérifier | 1 | orange | homophone_gram | — | — |
| choix du mot à vérifier | 1 | orange | homophone_lex | — | — |
| conjugaison après je à vérifier | 1 | orange | personne | — | — |
| contraction | 1 | selon la couche | contraction (sans conseil) | — | — |
| élision | 8 | selon la couche | segmentation | — | correcteur_probe.py |
| espace après la virgule | 1 | selon la couche | ponctuation (sans conseil) | — | — |
| espace avant la ponctuation | 1 | selon la couche | ponctuation (sans conseil) | — | — |
| espace double | 1 | selon la couche | ponctuation (sans conseil) | — | — |
| espacement | 1 | selon la couche | ponctuation (sans conseil) | — | — |
| forme en -ant à vérifier | 1 | orange | participe | — | — |
| genre de la personne qui écrit | 1 | selon la couche | participe | — | — |
| homophone à vérifier | 5 | orange | homophone_lex | — | — |
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
| participe après s'est | 1 | selon la couche | participe | — | correcteur_probe.py |
| participe présent après « en » à vérifier | 1 | orange | participe | — | — |
| personne du verbe à vérifier | 1 | orange | personne | — | correcteur_probe.py |
| personne du verbe par le son à vérifier | 1 | orange | personne | — | — |
| pléonasme | 1 | selon la couche | style (sans conseil) | — | — |
| pluriel par le son à vérifier | 1 | orange | accord | — | correcteur_probe.py |
| point d'interrogation | 3 | selon la couche | ponctuation (sans conseil) | — | — |
| point final | 1 | selon la couche | ponctuation (sans conseil) | — | — |
| répétition | 1 | selon la couche | repetition (sans conseil) | — | — |
| sait/s'est à vérifier | 1 | orange | homophone_gram | — | — |
| terminaison -er/-é/-ez/-ai | 2 | selon la couche | accord | — | correcteur_probe.py |
| trait d'union | 2 | selon la couche | ponctuation (sans conseil) | — | — |
| typographie | 3 | selon la couche | style (sans conseil) | — | — |
| virgule | 2 | selon la couche | ponctuation (sans conseil) | — | — |
| virgule doublée | 1 | selon la couche | ponctuation (sans conseil) | — | — |

## Tables et qui les lit

« Directement » : les fonctions dont le code nomme une variable de la table (les 8 premières, ordre du fichier).

| table | chargée par | variables | règles de la chaîne qui la lisent | lue directement par |
|---|---|---|---|---|
| vdc-lex (conjugaison, genre, pluriels) | `_applyVdc` | `BCLF` `COMMON_VERBS` `GENDER_MAP` `GENDER_PURE` `ADJP` `CONJ_F` `CONJ_C` `NOUN_PLURAL` | 201 / 224 | `_persDe` `lexicalGender` `_pplRe66` `_isPpl` `vlike` `_ppMs460` `_ppNom460` `_ppInf463` … (179) |
| genre relâché | `_applyGenderRelaxed` | `GENDER_PURE` | 149 / 224 | `_nomGN502` `rEPplVig` `rEPpl` `_cestNomFem` `rCaSa` `rDetVoy246` `rPetits301` `rAttr314` … (37) |
| dictionnaire (speller) | `_applySpellerTSV` | `SP` | 110 / 224 | `_isPplWideEr` `_canonW` `_emit` `_eerVerbeRare188` `_eerAuxRare497` `_cand498` `_ppCoord498` `rAdjCoordApp500` … (88) |
| noun-post | `_applyNounPost` | `NOUN_POST` | 116 / 224 | `_etreAttrEr` `_eerVerbeRare188` `_eerAuxRare497` `rOn` `_rAbase` `_aaApresAdverbe` `_rAnouveau` `_rEtNouveau` … (38) |
| étiqueteur HMM | `setPosHmm` | `_HMM` | 89 / 224 | `posTags` |
| modèle OS-sujet | `setOsLm` | `_OSLM` | 0 / 224 | `_osPuni` `_osPfwd` `_osPbwd` `osVerbVig` `complete` |
| prénoms | `_applyPrenoms` | `PRENOMS` | 32 / 224 | `_rAbase` `_sujLa272` `rAaccent287` `rCestAnime354` `_gnTete301` `rSV318` `rFige320` `rAccordSVcoord` … (19) |
| genre accentué | `_applyGaccLex` | `_GACC` | 44 / 224 | `rEer0` `rFlexionEr` `rCe` `_nounGender` `rAdjEpithetCoord` `_twin531` `spellTokenCore` `apposVig262` … (9) |
| confusables | `setConfusables` | `_CONFW` `_CONFBF` | 0 / 224 | `_vigOne` `vigText` |
| genre de l'auteur (réglage) | `setAuteur` | `_AUTEUR` | 0 / 224 | `getAuteur` `auteurSugg` `auteurPasse` |
| ponctuation vocale | `setPonctLm` | `_PLM` | 0 / 224 | `ponctReady` `ponctDist` |
