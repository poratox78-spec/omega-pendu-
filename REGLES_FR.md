# RÉFÉRENTIEL DES RÈGLES DU FRANÇAIS — et où en est OMEGA (2026-08-11)

Demande de Rem : *« établir une liste de règles complète de grammaire / orthographe / conjugaison
française, croiser avec LanguageTool pour vérification, et voir ce qui nous manque réellement »*.

**Méthode.** ① Taxonomie des phénomènes (structure classique + les 17 catégories publiques de
LanguageTool FR). ② État OMEGA établi en TESTANT le moteur, pas en lisant le code — chaque « ABSENT »
ci-dessous a été vérifié par une phrase déclenchante restée muette. ③ Croisement LT en lecture de
**phénomènes seulement** : LanguageTool est LGPL, on ne lit jamais son XML (doctrine du dépôt).

**Référence LT** : 6 854 règles FR, 17 catégories. ⚠️ Ce chiffre ne se compare pas au nôtre :
la masse LT est faite de paires lexicales une-par-règle (confusions, calques, tours critiqués) et de
style. Notre unité est le PHÉNOMÈNE ; LT tolère les faux positifs, nous non — notre rappel
supplémentaire vit donc dans l'orange, jamais dans un rouge douteux.

Légende : 🔴 corrigé d'office (FP=0 mesuré) · 🟠 proposé (vigilance) · 🟢 couche verte (pédagogie,
jamais imposé) · 🟡 PARTIEL (limite mesurée notée) · ❌ ABSENT (vérifié au moteur) · ⛔ HORS
PÉRIMÈTRE (choix assumé, motivé).

---

## 1. ORTHOGRAPHE LEXICALE (LT : « Faute de frappe possible »)

| phénomène | état | où / limite |
|---|---|---|
| non-mot → candidat (édit-1, contexte POS/genre/nombre) | 🔴/🟠 | speller ; rouge = routes sûres seulement |
| restauration d'accent (fenetre→fenêtre) | 🔴 | route affirmative historique |
| glissement moteur (jmaais, grannd — 1 candidat + désordre/redoublement) | 🔴 | PR#464, FP=0/14 450 |
| élongation (ellle→elle) | 🔴 | cas issus du corpus dys réel (PR#466) |
| lettre finale muette (dehor→dehors) | 🔴 | préfixe commun + s/x |
| omission interne (afreuses→affreuses) | 🔴 | sous-suite + même initiale + plus proche |
| ligature œ/æ | 🔴 | normalisation partagée, banc dédié |
| mot inconnu → signalement | 🟠 | jamais imposé |
| élision manquante/inversée (c est→c'est, j'mange→je mange) | 🔴 | 2 règles + listes closes unifiées |
| majuscule initiale / nom propre | 🟠 | page correcteur seulement (politique) |
| **trous du lexique** (désarçonnaient, belle-sœur, exclamassent) | 🟡 | mesuré : 22 formes verbales rares / 1 059 « inconnus » sur UD ; **chantier lexique unifié, pas de génération mécanique** (abeillier→abeilliaient réfuté) |

## 2. HOMOPHONES GRAMMATICAUX (LT : « Confusion d'homonymes et paronymes »)

| phénomène | état | note |
|---|---|---|
| a/à · et/est · son/sont · on/ont · ce/se · ça/sa · du/dû · du/de · sur/sûr · la/là · leur/leurs · mais/mes · met/mais · mai/mais · des/dès · peu/peux/peut · sais/sait · c'est/s'est · j'est/j'ai · c'ai/c'est | 🔴 | le cœur du correcteur ; FP=0 à l'échelle, gardé CI |
| ces/ses · ou/où | 🟠/🟢 | carte enseignante (l'auteur tranche) |
| quel/quelle (genre) | 🔴 | via accord adjectival |
| homophones lexicaux (vert/verre/vers, sceau/seau/sot) | ⛔→🟢 | indécidable sans sémantique ; couche verte « homophone à vérifier » sur liste |
| près de / prêt de | 🟠 LIVRÉ (2026-08-12) | prêt/prêts sûrs ; prête/prêtes exigent une copule avant (« elle prête de l'argent » = verbe) ; clitique+infinitif exclu par POS |
| davantage / d'avantage(s) | 🟠 LIVRÉ (2026-08-12) | fin de proposition ou devant « que » seulement ; « pas d'avantage » (lecture nominale) exclu |
| quelque soit / quel que soit | 🔴 LIVRÉ (2026-08-12) | accord quel/quelle/quels/quelles par le verbe et le déterminant suivant ; 0 tir/14 450 UD |
| ce qui il / ce qu'il | 🔴+🟠 LIVRÉ (2026-08-12) | « ce qui il »→rouge (jamais correct) ; autres « qui+pronom »→orange ; gardes préposition (« avec qui il »), verbes de savoir (« je sais qui il est »), majuscule |

## 3. ACCORDS (LT : « Grammaire »)

| phénomène | état | note |
|---|---|---|
| sujet-verbe (13 fonctions : noms, pronoms, coordination, relative-objet, incise, postposé, quantifieurs…) | 🔴+🟠 | rouge sur cadres sûrs ; OS-sujet en vigilance sur le résiduel ; sujet postposé SINGULIER réparé (PR#472) |
| déterminant↔nom (nombre, les deux sens) | 🔴 | un seul sens par désaccord (PR#467) ; élidés exclus (PR#473) |
| déterminant↔nom (genre) | 🔴 | table genre désaccentuée (PR#450→453) |
| participe avec être (+ prénoms) | 🔴 | 8 729 prénoms (PR#460) |
| participe avec avoir + COD antéposé (que) | 🔴 | rule_pp_avoir_cod |
| participe épithète · adjectif attribut/épithète | 🔴 | via tagger + _adj_head |
| accord « tout » | 🔴 | règle dédiée (« tout étonnées » correctement laissé) |
| **participes invariables (fait/vu/laissé + infinitif, se sont succédé)** | 🟡 | pas de règle POSITIVE, mais pronominal exclu des accords → silencieux, pas faux |
| vingt/cent (quatre-vingts, deux cents) | 🔴 LIVRÉ (2026-08-12) | nom PLURIEL exigé après (tue dates/ordinaux) ; millésime « mille neuf cent » exclu ; le seul tir UD était une vraie faute (« deux cent salariés ») |
| **adjectifs de couleur composés** | 🟡 | invariables simples couverts (listes) ; composés (« bleu foncé ») non signalés — mais jamais cassés |

## 4. CONJUGAISON

| phénomène | état | note |
|---|---|---|
| -é/-er/-ez/-ai (aux, modaux, « à », clitiques, causatif) | 🔴 | famille la plus travaillée |
| infinitif de but après mouvement | 🔴 | PR#469 |
| impératif (-s euphonique, irréguliers) | 🔴 | |
| usage être/avoir | 🔴 | données complétées 2026-08-12 : familles tombé/parvenu/intervenu/survenu/redevenu + reparties (flood UD=0) ; garde COD « il a tombé la veste » |
| auxiliaire mal orthographié (ête) | 🔴 | |
| futur 1ʳᵉ pers. avec marqueur temporel (je mangerai demain) | 🟡 | exige un marqueur explicite |
| futur/conditionnel -rai/-rais hors marqueur | ⛔ REPORTÉ chiffré (2026-08-12) | 9 « je …-rais » corrects sur UD (conditionnel de politesse) pour 0 occasion au corpus dys → tout signalement hors marqueur inflige de l'orange sans rappel démontré |
| si + conditionnel (si j'aurais) | 🔴 LIVRÉ (2026-08-12) | protase seulement (tête de proposition) ; interrogation indirecte exclue (« je ne sais pas si je serais ») ; 0 tir/14 450 UD, 1 occasion dys confirmée gold |
| **concordance des temps / subjonctif (bien que c'est)** | ❌ vérifié | conjonctions à liste fermée → candidat 🟠 |
| participe présent vs adj. verbal (fatiguant/fatigant) | 🟠 LIVRÉ (2026-08-12) | 11 paires ; position adjectivale (dét/copule/adverbe, ou NOM+fin de proposition) ; gérondif « en le précédant » exclu ; le seul tir UD était une vraie faute (« le plus influant ») |
| conjugaisons rares absentes du lexique (imparfait 3pl : 70 % des -er) | 🟡 | impact réel mesuré faible (22/1 059) ; lexique unifié |

## 5. SYNTAXE (LT : « Grammaire », « Concordances », « Élision »)

| phénomène | état | note |
|---|---|---|
| élision (46 listes fermées) | 🔴 | cécité volontaire = protectrice (mémoire dédiée) |
| frame s'est : priorité sur l'accord (« il sais trompé ») | 🔴 LIVRÉ (2026-08-21) | gardes miroir dans _svFinish/rAccordSV/rFlexionEr : [il/elle/on]+sais/sait+PARTICIPE → les rouges accord/terminaison SE TAISENT, l'orange saisVig parle. Conflit lu à la carto : le moteur écrivait « il sait tromper » (rFlexionEr→cascade). Coût 0 sur correct (1 seul site UD, accord déjà juste) |
| saisVig -u + sujets nominaux ces (« Paul ces blessé ») | 🔴🟠 LIVRÉ (2026-08-21) | liste _SAIS_PPU (perdu/vu/connu… 36 formes) partagée ; rCesSest branche NOMINALE (NOUN/PROPN devant, « été » exclu — être n'est pas pronominal, les 4 tirs du flood étaient « cet été ») ; rEtreInfEr accorde par le GENRE DU NOM sujet (« la voisine s'est marier »→mariée). Floods 16 950 : 0 FP |
| mot coupé — fusion bien/mal (« bien veillante ») | 🔴 LIVRÉ (2026-08-20, span:2) | soudure au lexique + B RARE seul (les légitimes « bien fait », « mal intentionnés », « bien être » ont un B fréquent — 9 FP lus au flood naïf) + soudure ≥ 4× B. 0 tir/16 950. Généralisation à d'autres préfixes = à mesurer |
| sait/s'est devant PARTICIPE (« il sais trompé ») | 🟠 LIVRÉ (2026-08-20, vigilance) | [il/elle/on]+sais/sait+participe réel → « s'est ? » ; l'INFINITIF reste hors-jeu (« elle sait marier les saveurs » légitime) = mur sémantique assumé. Modèle NB réfuté chiffré : 29 « sait » dans UD → il promptait sur « sait nager ». 0 tir/16 950 |
| « ces/cet » après pronom sujet → s'est (« elle ces marier ») | 🔴 LIVRÉ (2026-08-20) | un déterminant ne suit jamais un sujet nu ; s'est proposé devant MATIÈRE VERBALE seulement (participe ou infinitif -er connu) — « elle, ces amis… » hors-jeu. La CASCADE compose : ces→s'est → marier→marié(e) (rEtreInfEr, accord au sujet immédiat elle→ée). 0 tir/16 950. « sais/sait » NON traité (« elle sait marier les saveurs » légitime = mur sémantique assumé) |
| participe épithète féminin-singulier (« une femme cultivé ») | 🔴 LIVRÉ (2026-08-20) | sœur de la plurielle : DET f-sg + NOM f + participe -é/-i (marques MUETTES) ; gardes « fois », coordination dans le GN, ADP généralisée en i-3 (« le sommet SUR la biodiversité organisé ») ; PAS de garde après-virgule (« cultivé, bienveillante » : l'accord vaut). Flood 16 950 : 3 tirs = 3 vraies fautes du corpus |
| « e » muet du futur/conditionnel (« t'oublirais ») | 🔴 LIVRÉ (2026-08-20) | non-mot en r+terminaison dont stem+er est un verbe des tables → réinsérer le e muet (oublirais→oublierais) ; AUDIBILITÉ : le R entendu écarte l'imparfait « oubliais » (distance 1 aussi) ; radical ≥ 4 (« tetra »→tetera = l'unique tir) ; vit dans spellTokenCore → l'élision est déballée (l'oublirais) . 0 tir/16 950 |
| accent réel-mot « age » → « âge » | 🔴 LIVRÉ (2026-08-20, audit rappel dys PR#505) | « age » est CONNU du lexique (pièce de charrue) → le canal accent se taisait. Contexte déterminant exigé (l'/d' élidé, son/mon/un…), minuscule STRICT (« l'Age d'Or » titre = l'unique tir du flood 16 950). ×5 sur les 6 dictées ASEI |
| « c'/s' + étais » → était | 🔴 LIVRÉ (2026-08-20) | après c'/s' (= ce/se), la 1re personne n'existe pas ; le speller rendait « c'étais » (accent restauré, personne gardée). 0 tir/16 950 |
| participe après avoir (« elle a grandit ») | 🔴 LIVRÉ (2026-08-20) | avoir + forme FINIE -it/-is jamais-participe dont la troncature EST un participe (grandit→grandi, finit→fini). Garde décisive : le participe tronqué doit EXISTER. 1 tir/16 950 = vraie faute UD (« il a réagit ») |
| participe après s'est (« s'est marier ») | 🔴 LIVRÉ (2026-08-20) | s'est/s'était + infinitif -er connu des tables → é (le participe régulier existe par morphologie). v1 réfléchi SEUL ; « est/sont + -er » attendra sa mesure. 0 tir/16 950 |
| négation « n' » manquante (on a pas) | 🔴 LIVRÉ (2026-08-12) | cadre : sujet-pronom + verbe à VOYELLE + négateur, PLUS formes élidées (c'est pas→ce n'est pas, j'ai jamais→je n'ai jamais, il y a pas→il n'y a pas, t'as rien→tu n'as rien). « plus » exclu (comparatif, 8 FP/10 au proto), « pas mal » exclu (locution). 5 tirs/14 450 UD = 5 vraies fautes orales du corpus → rouge sur tout le cadre |
| que/dont (la chose que j'ai besoin) | 🟠 LIVRÉ (2026-08-12) | gouverneurs besoin/envie/peur/honte (parle/doute exclus : transitifs légitimes) ; antécédent NOMINAL exigé (complétive « je crois que j'ai besoin » exclue) ; « besoin DE » présent → silence |
| run-on (ponctuation manquante entre propositions) | 🟢 | couche verte |
| pronoms relatifs composés (lequel/laquelle) | ❌ | rare chez le dys, FP-risqué → non prioritaire |

## 6. TYPOGRAPHIE & PONCTUATION (LT : « Typographie », « Ponctuation », « Majuscules »)

| phénomène | état | note |
|---|---|---|
| espace avant . et , · espace manquant après , · espace double · virgule doublée | 🔴 | appliqués depuis PR#468 |
| points de suspension → … · guillemets droits → « » | 🟠 | préférence, jamais imposée |
| espaces françaises avant : ; ! ? | 🟡 | tolérées (pas signalées) — choix : ne pas harceler |
| parenthèses/guillemets non appariés | ⛔ RÉFUTÉ chiffré (2026-08-12) | 317 orphelins/14 450 phrases UD CORRECTES (citations multi-phrases, incises fermantes seules, translittérations, énumérations) ; corpus dys : 5 orphelins bruts et **5 aussi dans les golds** → les correcteurs humains n'en ferment aucune, rappel confirmé = 0. Signaler = fatigue pure. La conversion guillemets droits → « » (🟠, gardes pouces/chiffres) existe déjà et suffit |
| majuscule de phrase | 🟠 | page correcteur seulement |

## 7. LEXIQUE & USAGE (LT : « Anglicismes », « Pléonasmes », « Répétitions », « Calques », « Style », « Archaïsmes », « Régionalismes », « Marques », « Tours critiqués »)

| catégorie LT | état | note |
|---|---|---|
| Répétitions (il il) | 🔴 | span 2 |
| Anglicismes | 🟢 | liste close de NON-MOTS seulement (checker→vérifier) ; les homographes FR (réaliser, supporter) exclus — mesurés floodants |
| Pléonasmes (monter en haut) | 🟢 | couche verte |
| Calques · Style · Archaïsmes · Régionalismes · Marques · Tours critiqués | ⛔ | **hors périmètre assumé** : ce n'est pas de la faute, c'est du style ; la population dys n'a rien à y gagner et tout à perdre en fatigue de signalement |

---

## CE QUI NOUS MANQUE RÉELLEMENT — priorisé pour le dys (audibilité × fréquence × FP-risque)

1. **Négation « n' » manquante** (« on a pas », « il faut pas ») — le n' est quasi inaudible à l'oral
   (exactement le profil « le dys écrit ce qu'il entend »), très fréquent, cadre fermé. Rouge
   possible après « on » (« on a » ambigu zéro), orange ailleurs (registre oral voulu dans un chat).
2. **si + conditionnel** (« si j'aurais su ») — liste fermée, faute scolaire archétypale, FP≈0 par
   construction.
3. **quelque soit → quel que soit** — motif fermé, rouge possible.
4. **que/dont** (« la chose que j'ai besoin ») — gouverneurs en liste fermée, orange.
5. **ce qui il → ce qu'il** — élision obligatoire, rouge possible.
6. **-rai/-rais** (futur/conditionnel) — le -s est muet, donc dys-pertinent ; mais hors marqueur
   temporel c'est un choix sémantique → orange, et à mesurer sérieusement avant de livrer.
7. **près de / prêt de · davantage/d'avantage · fatigant/fatiguant · vingt/cent** — paires et motifs
   fermés, orange, petit volume chacun.
8. **Compléter la liste des participes à être** (« il a tombé », « ils ont retournés ») — la
   règle existe, la DONNÉE manque ; même diagnostic que les prénoms (PR#460).
9. ~~Parenthèses/guillemets non appariés~~ — RÉFUTÉ par la mesure (voir §6) : le non-apparié est presque toujours légitime en français réel, et le gold dys n'en corrige aucun.

**Bilan du chantier 2026-08-12 (items 1-8)** : 1, 2, 3, 5, 7, 8 LIVRÉS (rouge quand le cadre le
permet), 4 LIVRÉ en orange, 6 REPORTÉ avec chiffre (9 conditionnels corrects floodés sur UD pour
0 occasion dys). Mesure finale AU MOTEUR : 7 tirs sur 14 450 phrases UD, TOUS étant de vraies
fautes du corpus (négation orale ×5, « le plus influant », « deux cent salariés ») → FP réel = 0.
Item 9 RÉFUTÉ chiffré le même jour (317 orphelins légitimes/14 450 UD ; golds dys : 0 fermeture) → la liste 1-9 est CLOSE.

Chaque candidat suit la discipline du dépôt : compter les OCCASIONS dans le corpus dys d'abord,
mesurer le flood sur UD ensuite, gardes CI des deux sens, et vérité navigateur avant merge.

## Ce que LT a en masse et qu'on ne veut PAS

Style, tours critiqués, calques, archaïsmes, régionalismes, marques : des milliers de règles qui
tolèrent le faux positif. Notre contrat est inverse (FP=0 sur l'affirmatif) et notre utilisateur est
dys : chaque signalement non indispensable est de la fatigue. Le différentiel de compte (6 854 vs
~60 phénomènes) est un choix, pas un retard.
