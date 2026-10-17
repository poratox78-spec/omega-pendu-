# Inventaire du correcteur

Écrit par `node dictee/inventaire_correcteur.js` à partir du code (liste n° 27, audit du 13/10/2026) — ne pas éditer à la main ;
`--check` (dev.sh, CI) refuse un inventaire en retard sur le moteur. Le routage complet des conseils est gardé par `dictee/textes_probe.js`.

## En chiffres

- Chaîne des règles de grammaire (`CRULES`, extension ≡ app) : **103** entrées, **78** noms affichés ; rouge : 67 · rouge avec un cas orange posé par la règle : 12 · rouge ou orange selon le sous-cas : 12 · orange : 12.
- Moteur Python (`correcteur_probe.RULES`) : **113** entrées — les 103 de la chaîne, dans le même ordre, et 10 oranges que l'extension pose hors de la chaîne. Ordre identique, sauf : « infinitif après pronom sujet à vérifier » (orange ; le Python la pose en fin de chaîne, l'extension après « accord tout »).
- Noms posés hors de la chaîne côté extension (orthographe, typographie, oranges) : **47**.
- Tables chargées : 11 (le chargeur unique `extension/charger_node.js` les charge toutes pour les bancs).

## Règles de grammaire, dans l'ordre de la chaîne

La « famille » est celle du conseil affiché (`famRegle` / `flagsToFacts`) ; « sans conseil » = famille sans texte d'explication, voulu
(ponctuation, style, répétition). Les tables sont repérées dans le source (lecture directe ou par une fonction appelée).

| # | règle | extension / app | Python | palier | famille du conseil | tables lues |
|---|---|---|---|---|---|---|
| 1 | élision inversée | `rDeselide` | `rule_deselide` | rouge ou orange (sous-cas mesuré, _tierOf) | segmentation | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 2 | être (ête) | `rEteEtre` | `rule_ete_etre` | rouge, orange dans un cas posé par la règle | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 3 | accord grammatical (é/er) | `rEer` | `rule_e_er` | rouge ou orange (sous-cas mesuré, _tierOf) | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 4 | accord grammatical (é/er) | `rAInfE` | `rule_a_inf_e` | rouge ou orange (sous-cas mesuré, _tierOf) | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post |
| 5 | -e/-é (participe) | `rEPpl` | `rule_e_ppl` | rouge | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 6 | participe après auxiliaire | `rAuxImparfait` | `rule_aux_imparfait` | rouge | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 7 | participe après être à vérifier | `rEPplVig` | `rule_e_ppl_vig` | orange | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 8 | participe après être à vérifier | `rEtreFini` | `rule_etre_fini` | orange | participe | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller) |
| 9 | accord participe | `rPpEtre` | `rule_pp_etre` | rouge ou orange (sous-cas mesuré, _tierOf) | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 10 | accord participe (COD avoir) | `rPpAvoirCod` | `rule_pp_avoir_cod` | rouge | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, étiqueteur HMM, genre accentué |
| 11 | accord participe (dont) | `rPpAvoirDont` | `rule_pp_avoir_dont` | rouge | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 12 | accord adjectif | `rAdjAttr` | `rule_adj_attr` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, étiqueteur HMM, prénoms, genre accentué |
| 13 | accord adjectif épithète | `rAdjEpithet` | `rule_adj_epithet` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, étiqueteur HMM |
| 14 | accord adjectif épithète | `rAdjEpithetCoord` | `rule_adj_epithet_coord` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post, étiqueteur HMM, genre accentué |
| 15 | accord adjectif épithète | `rAdjGeo` | `rule_adj_geo` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, étiqueteur HMM |
| 16 | accord adjectif antéposé | `rQuelque` | `rule_quelque` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post |
| 17 | accord adjectif épithète | `rAdjNumber` | `rule_adj_number` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, étiqueteur HMM |
| 18 | accord participe épithète | `rPpEpithetNum` | `rule_pp_epithet_number` | rouge | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM, genre accentué |
| 19 | accord adjectif épithète | `rAdjAux` | `rule_adj_aux` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM |
| 20 | accord participe épithète | `rPpEpithetFem` | `rule_pp_epithet_fem` | rouge | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, étiqueteur HMM, genre accentué |
| 21 | terminaison -er/-é/-ez/-ai | `rFlexionEr` | `rule_flexion_er` | rouge ou orange (sous-cas mesuré, _tierOf) | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 22 | infinitif de but | `rInfBut` | `rule_inf_but` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 23 | impératif | `rImperatif` | `rule_imperatif` | rouge | personne | vdc-lex (conjugaison, genre, pluriels) |
| 24 | son/sont | `rSon` | `rule_son_sont` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 25 | on/ont | `rOn` | `rule_on_ont` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 26 | leur/leurs | `rLeur` | `rule_leur_leurs` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, genre accentué |
| 27 | a/à | `rA` | `rule_a_aa` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms |
| 28 | et/est | `rEt` | `rule_et_est` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), noun-post, étiqueteur HMM |
| 29 | est/et (proposition) | `rEstEtClause` | `rule_est_et_clause` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, étiqueteur HMM |
| 30 | peu/peux/peut | `rPeu` | `rule_peu` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), étiqueteur HMM |
| 31 | sujet je | `rJeSubject` | `rule_je_subject` | rouge | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 32 | sais/sait | `rSais` | `rule_sais` | rouge | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 33 | ce/se | `rCe` | `rule_ce_se` | rouge ou orange (sous-cas mesuré, _tierOf) | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, genre accentué |
| 34 | des/dès | `rDesDes` | `rule_des_des` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 35 | c'est/s'est | `rCestSest` | `rule_cest_sest` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 36 | c'est/s'est | `rCesSest` | `rule_ces_sest` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), étiqueteur HMM |
| 37 | ça/sa | `rCaSa` | `rule_ca_sa` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post |
| 38 | ou/où | `rOuOu` | `rule_ou_ou` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 39 | met/mais | `rMetMais` | `rule_met_mais` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM |
| 40 | mai/mais | `rMaiMais` | `rule_mai_mais` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 41 | mais/mes | `rMais` | `rule_mais_mes` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post |
| 42 | élision fusionnée | `rElisionFusionnee` | `rule_elision_fusionnee` | rouge | segmentation | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 43 | du/de | `rDuDe` | `rule_du_de` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 44 | du/dû | `rDuDu` | `rule_du_du` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 45 | sur/sûr | `rSurSur` | `rule_sur_sur` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 46 | la/là | `rLaLa` | `rule_la_la` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 47 | guère/guerre | `rGuere` | `rule_guere` | rouge | homophone_lex | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 48 | vit/vie | `rSaVit` | `rule_sa_vit` | rouge | homophone_lex | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 49 | j'est/j'ai | `rJest` | `rule_jest` | rouge | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 50 | c'ai/c'est | `rCai` | `rule_cai` | rouge | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 51 | élision | `rElide` | `rule_elide` | rouge | segmentation | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 52 | accord sujet-verbe | `rAccordSV` | `rule_accord_sv` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 53 | accord sujet-verbe | `rIlIls` | `rule_il_ils` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 54 | accord sujet-verbe | `rAccordSVrecover` | `rule_accord_sv_recover` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 55 | accord sujet-verbe | `rAccordSVnoun` | `rule_accord_sv_noun` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 56 | accord sujet-verbe | `rAccordSVnounElid` | `rule_accord_sv_noun_elid` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 57 | accord sujet-verbe | `rAisAit` | `rule_ais_ait` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, étiqueteur HMM, prénoms, genre accentué |
| 58 | accord sujet-verbe | `rAiAit` | `rule_ai_ait` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 59 | accord sujet-verbe | `rAccordSVquant` | `rule_accord_sv_quant` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), étiqueteur HMM |
| 60 | accord sujet-verbe | `rAccordSVrelatif` | `rule_accord_sv_relatif` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), étiqueteur HMM |
| 61 | accord sujet-verbe | `rAccordSVcoord` | `rule_accord_sv_coord` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), étiqueteur HMM |
| 62 | accord sujet-verbe | `rAccordSVinfinitif` | `rule_accord_sv_infinitif` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), étiqueteur HMM |
| 63 | accord sujet-verbe | `rPostpose` | `rule_accord_postpose` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, étiqueteur HMM, prénoms, genre accentué |
| 64 | accord sujet-verbe | `rAccordVerbCoord` | `rule_accord_verb_coord` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), noun-post, étiqueteur HMM, prénoms, genre accentué |
| 65 | accord sujet-verbe | `rAccordRelObj` | `rule_accord_rel_obj` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, étiqueteur HMM, prénoms, genre accentué |
| 66 | accord sujet-verbe | `rAccordIncise` | `rule_accord_incise` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, étiqueteur HMM |
| 67 | genre déterminant | `rDetGenre` | `rule_det_gender` | rouge ou orange (sous-cas mesuré, _tierOf) | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post, étiqueteur HMM |
| 68 | accord tout | `rTout` | `rule_tout_det` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post |
| 69 | infinitif après pronom sujet à vérifier | `rPronInf` | `rule_pron_inf` | orange | personne | vdc-lex (conjugaison, genre, pluriels) |
| 70 | accord adjectif antéposé | `rAdjAntePl` | `rule_adj_ante_plural` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post, étiqueteur HMM, genre accentué |
| 71 | accord adjectif antéposé | `rAdjAnteGenre` | `rule_adj_ante_genre` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, étiqueteur HMM |
| 72 | nom féminin en -ée | `rFemEe` | `rule_fem_ee` | rouge | muette | — |
| 73 | accord pluriel nom | `rNounPlural` | `rule_noun_plural` | rouge | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post, genre accentué |
| 74 | accord singulier nom | `rNounSing` | `rule_noun_singular` | rouge, orange dans un cas posé par la règle | accord | vdc-lex (conjugaison, genre, pluriels), genre relâché, noun-post, étiqueteur HMM |
| 75 | usage être/avoir | `rAuxUsage` | `rule_aux_usage` | rouge | personne | vdc-lex (conjugaison, genre, pluriels) |
| 76 | aux mal orthographié | `rAuxMisspell` | `rule_aux_misspell` | rouge ou orange (sous-cas mesuré, _tierOf) | surface | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller) |
| 77 | accent (âge) | `rAgeAcc` | `rule_age_accent` | rouge | accent | — |
| 78 | étais après c'/s' | `rCetaitEtait` | `rule_cetait_etait` | rouge | personne | — |
| 79 | participe après avoir | `rAvoirFini` | `rule_avoir_fini` | rouge ou orange (sous-cas mesuré, _tierOf) | participe | vdc-lex (conjugaison, genre, pluriels) |
| 80 | participe après s'est | `rEtreInfEr` | `rule_etre_inf_er` | rouge | participe | vdc-lex (conjugaison, genre, pluriels), genre relâché, genre accentué |
| 81 | négation | `rNegNe` | `rule_neg_ne` | rouge | segmentation | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 82 | si + conditionnel | `rSiCond` | `rule_si_cond` | rouge, orange dans un cas posé par la règle | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 83 | quel que soit | `rQuelQue` | `rule_quel_que` | rouge | segmentation | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 84 | qu'il (élision) | `rQuiPron` | `rule_qui_pron` | rouge, orange dans un cas posé par la règle | segmentation | — |
| 85 | que/dont | `rQueDont` | `rule_que_dont` | rouge, orange dans un cas posé par la règle | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, étiqueteur HMM |
| 86 | qui/que | `rQuiQue` | `rule_qui_que` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché, étiqueteur HMM |
| 87 | près/prêt | `rPresPret` | `rule_pres_pret` | rouge, orange dans un cas posé par la règle | homophone_gram | étiqueteur HMM |
| 88 | cher/chez | `rCherChez` | `rule_cher_chez` | rouge | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 89 | davantage | `rDavantage` | `rule_davantage` | rouge, orange dans un cas posé par la règle | segmentation | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller) |
| 90 | conditionnel à vérifier | `rCondSi` | `rule_cond_si` | orange | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 91 | temps du verbe à vérifier | `rTempsProtase` | `rule_temps_protase` | orange | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 92 | impératif à vérifier | `rImperatifSeul` | `rule_imperatif_seul` | orange | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 93 | subjonctif à vérifier | `rSubjonctif` | `rule_subjonctif` | orange | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 94 | mot-outil à vérifier | `rHomophoneMo` | `rule_homophone_mo` | orange | homophone_gram | vdc-lex (conjugaison, genre, pluriels), dictionnaire (speller) |
| 95 | petit mot après le sujet à vérifier | `rApresSujet` | `rule_apres_sujet` | orange | homophone_gram | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 96 | expression figée à vérifier | `rFige` | `rule_fige` | orange | homophone_gram | vdc-lex (conjugaison, genre, pluriels) |
| 97 | mot soudé à vérifier | `rSoude` | `rule_soude` | orange | segmentation | vdc-lex (conjugaison, genre, pluriels) |
| 98 | plutôt / plus tôt à vérifier | `rPlutot` | `rule_plutot` | orange | segmentation | vdc-lex (conjugaison, genre, pluriels) |
| 99 | adjectif en -ant/-ent | `rAntAdj` | `rule_ant_adj` | rouge, orange dans un cas posé par la règle | homophone_lex | vdc-lex (conjugaison, genre, pluriels), genre relâché, étiqueteur HMM |
| 100 | vingt/cent | `rVingtCent` | `rule_vingt_cent` | rouge | accord | — |
| 101 | personne du verbe | `rVousIrr` | `rule_vous_irr` | rouge | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché |
| 102 | personne du verbe | `sujFlexVig` | `rule_sujet_flexion` | rouge, orange dans un cas posé par la règle | personne | vdc-lex (conjugaison, genre, pluriels), genre relâché, dictionnaire (speller), étiqueteur HMM, prénoms, genre accentué |
| 103 | majuscule | `rCapital` | `rule_capital` | rouge | majuscule | — |

## Noms posés hors de la chaîne (extension)

Orthographe, typographie, mots inconnus, et les oranges posées après la chaîne. « Python » = fichier où le nom apparaît.

| nom | occurrences | palier | famille du conseil | dans la chaîne Python | Python |
|---|---|---|---|---|---|
| abréviation | 1 | selon la couche | style (sans conseil) | non | — |
| accord adjectif à vérifier | 1 | orange | accord | non | — |
| accord du participe après avoir à vérifier | 1 | orange | participe | oui | correcteur_probe.py |
| accord du verbe au sujet nominal à vérifier | 1 | orange | accord | oui | correcteur_probe.py |
| accord genre à vérifier | 1 | orange | accord | non | — |
| accord participe à vérifier | 4 | orange | participe | non | — |
| accord pluriel à vérifier | 2 | orange | accord | non | — |
| accord sujet-verbe à vérifier | 1 | orange | accord | non | — |
| accord verbe à vérifier | 2 | orange | accord | non | — |
| anglicisme | 2 | selon la couche | style (sans conseil) | non | — |
| auxiliaire manquant à vérifier | 1 | orange | participe | oui | correcteur_probe.py |
| c'est/ces à vérifier | 2 | orange | homophone_gram | oui | correcteur_probe.py |
| ces/ses à vérifier | 1 | orange | homophone_gram | non | — |
| conjugaison après je à vérifier | 1 | orange | personne | non | — |
| contraction | 1 | selon la couche | contraction (sans conseil) | non | — |
| élision | 7 | selon la couche | segmentation | non | correcteur_probe.py |
| espace après la virgule | 1 | selon la couche | ponctuation (sans conseil) | non | — |
| espace avant la ponctuation | 1 | selon la couche | ponctuation (sans conseil) | non | — |
| espace double | 1 | selon la couche | ponctuation (sans conseil) | non | — |
| espacement | 1 | selon la couche | ponctuation (sans conseil) | non | — |
| forme en -ant à vérifier | 1 | orange | participe | non | — |
| genre de la personne qui écrit | 1 | selon la couche | participe | non | — |
| homophone à vérifier | 3 | orange | homophone_lex | non | — |
| impératif (pronom) | 1 | selon la couche | segmentation | non | — |
| infinitif après semi-auxiliaire à vérifier | 1 | orange | personne | oui | correcteur_probe.py |
| j'est/j'ai à vérifier | 1 | orange | personne | oui | correcteur_probe.py |
| majuscule initiale à vérifier | 1 | orange | majuscule | non | — |
| mot coupé | 1 | selon la couche | ponctuation (sans conseil) | non | — |
| mot inconnu | 3 | selon la couche | surface | non | — |
| nombre | 1 | selon la couche | style (sans conseil) | non | correcteur_probe.py |
| nombre du déterminant à vérifier | 1 | orange | accord | oui | correcteur_probe.py |
| on/ont après un sujet pluriel à vérifier | 1 | orange | homophone_gram | oui | correcteur_probe.py |
| orthographe | 1 | selon la couche | surface | non | — |
| ou/où à vérifier | 1 | orange | homophone_gram | non | — |
| participe présent après « en » à vérifier | 1 | orange | participe | non | — |
| personne du verbe à vérifier | 1 | orange | personne | oui | correcteur_probe.py |
| personne du verbe par le son à vérifier | 1 | orange | personne | non | — |
| pléonasme | 1 | selon la couche | style (sans conseil) | non | — |
| pluriel par le son à vérifier | 1 | orange | accord | oui | correcteur_probe.py |
| point d'interrogation | 2 | selon la couche | ponctuation (sans conseil) | non | — |
| point final | 1 | selon la couche | ponctuation (sans conseil) | non | — |
| répétition | 1 | selon la couche | repetition (sans conseil) | non | — |
| sait/s'est à vérifier | 1 | orange | homophone_gram | non | — |
| trait d'union | 1 | selon la couche | ponctuation (sans conseil) | non | — |
| typographie | 3 | selon la couche | style (sans conseil) | non | — |
| virgule | 1 | selon la couche | ponctuation (sans conseil) | non | — |
| virgule doublée | 1 | selon la couche | ponctuation (sans conseil) | non | — |

## Tables et qui les lit

« Directement » : les fonctions dont le code nomme une variable de la table (les 8 premières, ordre du fichier).

| table | chargée par | variables | règles de la chaîne qui la lisent | lue directement par |
|---|---|---|---|---|
| vdc-lex (conjugaison, genre, pluriels) | `_applyVdc` | `BCLF` `COMMON_VERBS` `GENDER_MAP` `GENDER_PURE` `ADJP` `CONJ_F` `CONJ_C` `NOUN_PLURAL` | 96 / 103 | `_persDe` `lexicalGender` `_pplRe66` `_isPpl` `vlike` `rEer` `_inf1` `rImperatif` … (104) |
| genre relâché | `_applyGenderRelaxed` | `GENDER_PURE` | 79 / 103 | `rEPplVig` `rEPpl` `_cestNomFem` `rCaSa` `rAccordIncise` `rDetGenre` `rTout` `rNounSing` … (22) |
| dictionnaire (speller) | `_applySpellerTSV` | `SP` | 28 / 103 | `_isPplWideEr` `_canonW` `_emit` `rInfBut` `_spos` `_pplForm` `_infForm` `rAInfE` … (55) |
| noun-post | `_applyNounPost` | `NOUN_POST` | 23 / 103 | `_etreAttrEr` `rOn` `_rAbase` `_aaApresAdverbe` `_rAnouveau` `_rEtNouveau` `rCaSa` `cestCesVig` … (31) |
| étiqueteur HMM | `setPosHmm` | `_HMM` | 43 / 103 | `posTags` |
| modèle OS-sujet | `setOsLm` | `_OSLM` | 0 / 103 | `_osPuni` `_osPfwd` `_osPbwd` `osVerbVig` `complete` |
| prénoms | `_applyPrenoms` | `PRENOMS` | 15 / 103 | `_rAbase` `_npSubject` `_tierOf` `spellTokenCore` `_suPrenom` `nomVerbeVig` |
| genre accentué | `_applyGaccLex` | `_GACC` | 23 / 103 | `rEer` `rFlexionEr` `rCe` `_nounGender` `rAdjEpithetCoord` |
| confusables | `setConfusables` | `_CONFW` `_CONFBF` | 0 / 103 | `_vigOne` `vigText` |
| genre de l'auteur (réglage) | `setAuteur` | `_AUTEUR` | 0 / 103 | `getAuteur` `auteurSugg` `auteurPasse` |
| ponctuation vocale | `setPonctLm` | `_PLM` | 0 / 103 | `ponctReady` `ponctDist` |
