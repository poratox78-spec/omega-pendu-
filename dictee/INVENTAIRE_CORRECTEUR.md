# Inventaire du correcteur

Écrit par `node dictee/inventaire_correcteur.js` à partir du code (liste n° 27, audit du 13/10/2026) — ne pas éditer à la main ;
`--check` (dev.sh, CI) refuse un inventaire en retard sur le moteur. Le routage complet des conseils est gardé par `dictee/textes_probe.js`.

## En chiffres

- Chaîne des règles de grammaire (`CRULES`, extension ≡ app) : **167** entrées, **91** noms affichés ; rouge : 78 · rouge avec un cas orange posé par la règle : 33 · rouge ou orange selon le sous-cas : 22 · orange : 34.
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
| 5 | accord grammatical (é/er) | `rPrepClPpl170` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms |
| 6 | -e/-é (participe) | `rEPpl` | `—` | rouge | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 7 | participe après auxiliaire | `rAuxImparfait` | `—` | rouge | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 8 | participe après être à vérifier | `rEPplVig` | `—` | orange | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 9 | participe après être à vérifier | `rEtreFini` | `—` | orange | participe | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller) |
| 10 | accord participe | `rPpEtre` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 11 | accord participe (COD avoir) | `rPpAvoirCod` | `—` | rouge | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM, genre accentué |
| 12 | accord participe (COD avoir) | `rPpQuel259` | `—` | rouge | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 13 | accord participe (dont) | `rPpAvoirDont` | `—` | rouge | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 14 | accord adjectif | `rAdjAttr` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM, prénoms, genre accentué |
| 15 | accord adjectif épithète | `rAdjEpithet` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM |
| 16 | accord adjectif épithète | `rAdjEpithetCoord` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, genre accentué |
| 17 | accord adjectif épithète | `rAdjGeo` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM |
| 18 | accord adjectif antéposé | `rQuelque` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post |
| 19 | accord adjectif épithète | `rAdjNumber` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM |
| 20 | accord participe épithète | `rPpEpithetNum` | `—` | rouge, orange dans un cas posé par la règle | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM, genre accentué |
| 21 | accord adjectif épithète | `rAdjAux` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM |
| 22 | accord participe épithète | `rPpEpithetFem` | `—` | rouge, orange dans un cas posé par la règle | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM, genre accentué |
| 23 | terminaison -er/-é/-ez/-ai | `rFlexionEr` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 24 | infinitif de but | `rInfBut` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 25 | impératif | `rImperatif` | `—` | rouge | personne | vdc-lex (conjugaison, genre, pluriels) |
| 26 | son/sont | `rSon` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 27 | on/ont | `rOn` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 28 | leur/leurs | `rLeur` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, genre accentué |
| 29 | a/à | `rA` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms |
| 30 | et/est | `rEt` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post, étiqueteur HMM |
| 31 | est/et (proposition) | `rEstEtClause` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM |
| 32 | peu/peux/peut | `rPeu` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), étiqueteur HMM |
| 33 | sujet je | `rJeSubject` | `—` | rouge | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 34 | sais/sait | `rSais` | `—` | rouge | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 35 | ce/se | `rCe` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, genre accentué |
| 36 | des/dès | `rDesDes` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 37 | c'est/s'est | `rCestSest` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 38 | c'est/s'est | `rCesSest` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), étiqueteur HMM |
| 39 | ça/sa | `rCaSa` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post |
| 40 | ou/où | `rOuOu` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM |
| 41 | met/mais | `rMetMais` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM |
| 42 | mai/mais | `rMaiMais` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 43 | mais/mes | `rMais` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post |
| 44 | élision fusionnée | `rElisionFusionnee` | `—` | rouge | segmentation | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 45 | du/de | `rDuDe` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 46 | du/dû | `rDuDu` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 47 | sur/sûr | `rSurSur` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 48 | la/là | `rLaLa` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 49 | guère/guerre | `rGuere` | `—` | rouge | homophone_lex | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 50 | vit/vie | `rSaVit` | `—` | rouge | homophone_lex | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 51 | j'est/j'ai | `rJest` | `—` | rouge, orange dans un cas posé par la règle | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 52 | c'ai/c'est | `rCai` | `—` | rouge | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 53 | élision | `rElide` | `—` | rouge | segmentation | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 54 | accord sujet-verbe | `rAccordSV` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 55 | accord sujet-verbe | `rLestJe155` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 56 | accord sujet-verbe | `rIlIls` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 57 | il y a | `rIlYa203` | `—` | rouge | segmentation | — |
| 58 | accord participe à vérifier | `rSeNom299` | `—` | orange | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM, prénoms, genre accentué |
| 59 | et/est | `rEtNom299` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), noun-post |
| 60 | accord participe à vérifier | `rQuiEst299` | `—` | orange | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, genre accentué |
| 61 | participe après avoir | `rEus299` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 62 | mot-outil à vérifier | `rTant299` | `—` | orange | homophone_gram | — |
| 63 | accord adjectif antéposé | `rLequel299` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), genre accentué |
| 64 | accord adjectif antéposé | `rQuelNom299` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, genre accentué |
| 65 | accord adjectif antéposé | `rPetits299` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post |
| 66 | accent manquant | `rDemi299` | `—` | rouge | accent | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 67 | accord adjectif antéposé | `rDeAdj299` | `—` | rouge, orange dans un cas posé par la règle | accord | noun-post |
| 68 | accord tout | `rToutFem299` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels) |
| 69 | accord verbe à vérifier | `rQuantDe295` | `—` | orange | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post |
| 70 | homophone à vérifier | `rPendant295` | `—` | orange | homophone_lex | vdc-lex (conjugaison, genre, pluriels) |
| 71 | personne du verbe à vérifier | `rPsSansT295` | `—` | orange | personne | vdc-lex (conjugaison, genre, pluriels) |
| 72 | accord participe à vérifier | `rSeCod295` | `—` | orange | participe | — |
| 73 | impératif à vérifier | `rFermeTete295` | `—` | orange | personne | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), noun-post, étiqueteur HMM |
| 74 | accord pluriel à vérifier | `rPlAdj295` | `—` | orange | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, genre accentué |
| 75 | homophone à vérifier | `rQuelle295` | `—` | orange | homophone_lex | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post, genre accentué |
| 76 | du/dû | `rDuDuA295` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM, prénoms, genre accentué |
| 77 | accord grammatical (é/er) | `rPrepIrr295` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | accord | — |
| 78 | subjonctif à vérifier | `rQuoiqu295` | `—` | orange | personne | vdc-lex (conjugaison, genre, pluriels) |
| 79 | c'est/s'est | `rSestCest270` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels) |
| 80 | c'est/s'est | `rCestSest271` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 81 | la/là | `rLaLa272` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), prénoms |
| 82 | sur/sûr | `rSurDet273` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 83 | mot-outil à vérifier | `rOuAu274` | `—` | orange | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 84 | homophone à vérifier | `rSoit275` | `—` | orange | homophone_lex | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 85 | trait d'union (-t-) | `rPenseTu276` | `—` | rouge | segmentation | vdc-lex (conjugaison, genre, pluriels) |
| 86 | accord participe | `rPpEtreInv277` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 87 | accord pluriel à vérifier | `rSuper278` | `—` | orange | accord | vdc-lex (conjugaison, genre, pluriels) |
| 88 | accord participe à vérifier | `rEtant279` | `—` | orange | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, genre accentué |
| 89 | forme en -ant à vérifier | `rAnts281` | `—` | orange | participe | vdc-lex (conjugaison, genre, pluriels), noun-post |
| 90 | impératif à vérifier | `rImperNe282` | `—` | orange | personne | vdc-lex (conjugaison, genre, pluriels) |
| 91 | impératif à vérifier | `rImperSeul283` | `—` | orange | personne | vdc-lex (conjugaison, genre, pluriels) |
| 92 | accord adjectif à vérifier | `rCherFort284` | `—` | orange | accord | — |
| 93 | trait d'union (-t-) | `rComp285` | `—` | rouge | segmentation | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 94 | négation | `rNeOublie286` | `—` | rouge, orange dans un cas posé par la règle | segmentation | vdc-lex (conjugaison, genre, pluriels) |
| 95 | a/à | `rAaccent287` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | prénoms |
| 96 | son/sont | `rSon288` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post |
| 97 | ce/se | `rSeDoit289` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | — |
| 98 | ou/où | `rOuPar290` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | dictionnaire (speller), étiqueteur HMM |
| 99 | que/dont | `rCeDonc290` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 100 | accord grammatical (é/er) | `rQuoiPp290` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | accord | vdc-lex (conjugaison, genre, pluriels) |
| 101 | participe après avoir | `rAuxIr290` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | participe | — |
| 102 | accord sujet-verbe | `rFormes265` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 103 | peu/peux/peut | `rPeuEtre242` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 104 | mot-outil à vérifier | `rHors244` | `—` | orange | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 105 | nôtre/vôtre | `rNotre245` | `—` | rouge | accent | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 106 | déterminant devant voyelle | `rDetVoy246` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post |
| 107 | accord adjectif antéposé | `rTel247` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 108 | homophone à vérifier | `rFois248` | `—` | orange | homophone_lex | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 109 | accent manquant | `rGrace249` | `—` | rouge, orange dans un cas posé par la règle | accent | — |
| 110 | accent manquant | `rCote249` | `—` | rouge | accent | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 111 | accent manquant | `rVoila249` | `—` | rouge | accent | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 112 | accent manquant | `rFaites249` | `—` | rouge | accent | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 113 | qu'il (élision) | `rSil250` | `—` | rouge | segmentation | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 114 | vingt/cent | `rMille251` | `—` | rouge, orange dans un cas posé par la règle | accord | — |
| 115 | passé simple (sans accent) | `rPasseSimple204` | `—` | rouge | accent | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 116 | accord sujet-verbe | `rAccordSVrecover` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 117 | accord sujet-verbe | `rAccordSVnounEt` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 118 | accord sujet-verbe | `rAccordSVnounElid` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 119 | accord sujet-verbe | `rAisAit` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM, prénoms, genre accentué |
| 120 | accord sujet-verbe | `rAiAit` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 121 | accord sujet-verbe | `rAccordSVquant` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), étiqueteur HMM |
| 122 | accord sujet-verbe | `rAccordSVrelatif161` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), étiqueteur HMM |
| 123 | accord sujet-verbe | `rAccordSVcoord` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), étiqueteur HMM, prénoms |
| 124 | accord sujet-verbe | `rAccordSVinfinitif` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller), étiqueteur HMM |
| 125 | accord sujet-verbe | `rPostpose` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM, prénoms, genre accentué |
| 126 | accord sujet-verbe | `rAccordVerbCoord` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 127 | accord sujet-verbe | `rAccordRelObj` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM, prénoms, genre accentué |
| 128 | accord sujet-verbe | `rAccordIncise` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM |
| 129 | genre déterminant | `rDetGenre` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 130 | accord tout | `rTout` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, genre accentué |
| 131 | infinitif après pronom sujet à vérifier | `rPronInf` | `—` | orange | personne | vdc-lex (conjugaison, genre, pluriels) |
| 132 | accord adjectif antéposé | `rAdjAntePl` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, genre accentué |
| 133 | accord adjectif antéposé | `rAdjAnteGenre` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 134 | nom féminin en -ée | `rFemEe` | `—` | rouge | muette | prénoms |
| 135 | accord pluriel nom | `rNounPlural` | `—` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post, genre accentué |
| 136 | accord singulier nom | `rNounSing` | `—` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM |
| 137 | usage être/avoir | `rAuxUsage` | `—` | rouge | personne | vdc-lex (conjugaison, genre, pluriels) |
| 138 | aux mal orthographié | `rAuxMisspell` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | surface | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 139 | accent (âge) | `rAgeAcc` | `—` | rouge | accent | — |
| 140 | étais après c'/s' | `rCetaitEtait` | `—` | rouge | personne | — |
| 141 | participe après avoir | `rAvoirFini` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | participe | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller) |
| 142 | participe après s'est | `rEtreInfEr` | `—` | rouge | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, genre accentué |
| 143 | négation | `rNegNe` | `—` | rouge | segmentation | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 144 | si + conditionnel | `rSiCond` | `—` | rouge, orange dans un cas posé par la règle | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 145 | quel que soit | `rQuelQue` | `—` | rouge | segmentation | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 146 | qu'il (élision) | `rQuiPron` | `—` | rouge, orange dans un cas posé par la règle | segmentation | — |
| 147 | que/dont | `rQueDont` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM |
| 148 | qui/que | `rQuiQue` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM |
| 149 | près/prêt | `rPresPret` | `—` | rouge, orange dans un cas posé par la règle | homophone_gram | dictionnaire (speller), étiqueteur HMM |
| 150 | expression figée à vérifier | `rFairePartie206` | `—` | orange | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 151 | participe après avoir | `rAvoirPus206` | `—` | rouge ou orange (sous-cas mesuré, _tierOf) | participe | — |
| 152 | cher/chez | `rCherChez` | `—` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 153 | davantage | `rDavantage` | `—` | rouge, orange dans un cas posé par la règle | segmentation | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller) |
| 154 | conditionnel à vérifier | `rCondSi` | `—` | orange | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 155 | temps du verbe à vérifier | `rTempsProtase` | `—` | orange | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 156 | impératif à vérifier | `rImperatifSeul` | `—` | orange | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM |
| 157 | subjonctif à vérifier | `rSubjonctif` | `—` | orange | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 158 | mot-outil à vérifier | `rHomophoneMo` | `—` | orange | homophone_gram | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller) |
| 159 | petit mot après le sujet à vérifier | `rApresSujet` | `—` | orange | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 160 | expression figée à vérifier | `rFige` | `—` | orange | homophone_gram | vdc-lex (conjugaison, genre, pluriels) |
| 161 | mot soudé à vérifier | `rSoude` | `—` | orange | segmentation | vdc-lex (conjugaison, genre, pluriels) |
| 162 | plutôt / plus tôt à vérifier | `rPlutot` | `—` | orange | segmentation | vdc-lex (conjugaison, genre, pluriels) |
| 163 | adjectif en -ant/-ent | `rAntAdj` | `—` | rouge, orange dans un cas posé par la règle | homophone_lex | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM |
| 164 | vingt/cent | `rVingtCent` | `—` | rouge | accord | noun-post |
| 165 | personne du verbe | `rVousIrr` | `—` | rouge | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 166 | personne du verbe | `sujFlexVig` | `—` | rouge, orange dans un cas posé par la règle | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 167 | majuscule | `rCapital` | `—` | rouge | majuscule | — |

## Noms posés hors de la chaîne (extension)

Orthographe, typographie, mots inconnus, et les oranges posées après la chaîne. « Python » = fichier où le nom apparaît.

| nom | occurrences | palier | famille du conseil | dans la chaîne Python | Python |
|---|---|---|---|---|---|
| abréviation | 1 | selon la couche | style (sans conseil) | — | — |
| accord adjectif à vérifier | 2 | orange | accord | — | — |
| accord du participe après avoir à vérifier | 1 | orange | participe | — | correcteur_probe.py |
| accord du verbe au sujet nominal à vérifier | 1 | orange | accord | — | correcteur_probe.py |
| accord genre à vérifier | 2 | orange | accord | — | — |
| accord participe à vérifier | 6 | orange | participe | — | — |
| accord pluriel à vérifier | 3 | orange | accord | — | — |
| accord sujet-verbe à vérifier | 1 | orange | accord | — | — |
| accord verbe à vérifier | 2 | orange | accord | — | — |
| anglicisme | 2 | selon la couche | style (sans conseil) | — | — |
| auxiliaire manquant à vérifier | 1 | orange | participe | — | correcteur_probe.py |
| c'est/ces à vérifier | 2 | orange | homophone_gram | — | correcteur_probe.py |
| ces/ses à vérifier | 1 | orange | homophone_gram | — | — |
| conjugaison après je à vérifier | 1 | orange | personne | — | — |
| contraction | 1 | selon la couche | contraction (sans conseil) | — | — |
| élision | 8 | selon la couche | segmentation | — | correcteur_probe.py |
| espace après la virgule | 1 | selon la couche | ponctuation (sans conseil) | — | — |
| espace avant la ponctuation | 1 | selon la couche | ponctuation (sans conseil) | — | — |
| espace double | 1 | selon la couche | ponctuation (sans conseil) | — | — |
| espacement | 1 | selon la couche | ponctuation (sans conseil) | — | — |
| forme en -ant à vérifier | 1 | orange | participe | — | — |
| genre de la personne qui écrit | 1 | selon la couche | participe | — | — |
| homophone à vérifier | 4 | orange | homophone_lex | — | — |
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
| vdc-lex (conjugaison, genre, pluriels) | `_applyVdc` | `BCLF` `COMMON_VERBS` `GENDER_MAP` `GENDER_PURE` `ADJP` `CONJ_F` `CONJ_C` `NOUN_PLURAL` | 147 / 167 | `_persDe` `lexicalGender` `_pplRe66` `_isPpl` `vlike` `rEer` `_inf1` `_ppOuAdj195` … (135) |
| genre relâché | `_applyGenderRelaxed` | `GENDER_PURE` | 115 / 167 | `rEPplVig` `rEPpl` `_cestNomFem` `rCaSa` `rDetVoy246` `rAccordIncise` `rDetGenre` `_tousFem101` … (25) |
| dictionnaire (speller) | `_applySpellerTSV` | `SP` | 68 / 167 | `_isPplWideEr` `_canonW` `_emit` `_eerVerbeRare188` `rInfBut` `_spos` `_pplForm` `_infForm` … (70) |
| noun-post | `_applyNounPost` | `NOUN_POST` | 37 / 167 | `_etreAttrEr` `_eerVerbeRare188` `rOn` `_rAbase` `_aaApresAdverbe` `_rAnouveau` `_rEtNouveau` `rCaSa` … (36) |
| étiqueteur HMM | `setPosHmm` | `_HMM` | 52 / 167 | `posTags` |
| modèle OS-sujet | `setOsLm` | `_OSLM` | 0 / 167 | `_osPuni` `_osPfwd` `_osPbwd` `osVerbVig` `complete` |
| prénoms | `_applyPrenoms` | `PRENOMS` | 22 / 167 | `_rAbase` `_sujLa272` `rAaccent287` `rAccordSVcoord` `_npSubject` `_tierOf` `spellTokenCore` `_suPrenom` … (9) |
| genre accentué | `_applyGaccLex` | `_GACC` | 32 / 167 | `rEer` `rFlexionEr` `rCe` `_nounGender` `rAdjEpithetCoord` `apposVig262` |
| confusables | `setConfusables` | `_CONFW` `_CONFBF` | 0 / 167 | `_vigOne` `vigText` |
| genre de l'auteur (réglage) | `setAuteur` | `_AUTEUR` | 0 / 167 | `getAuteur` `auteurSugg` `auteurPasse` |
| ponctuation vocale | `setPonctLm` | `_PLM` | 0 / 167 | `ponctReady` `ponctDist` |
