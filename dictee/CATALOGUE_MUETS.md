# Catalogue des fautes encore muettes — correcteur dys (29/09/2026)

> **La demande de Rem (28/09/2026)** : mesurer et cataloguer, de façon organisée et écrite, toutes les fautes que le correcteur
> laisse encore passer sans rien dire ; pour chacune, la remédiation possible ; appliquer le possible, mettre de côté ce qui paraît
> impossible — et en parler ensemble, parce que rien n'est impossible.

Ce document est la **liste de travail**. Chaque groupe porte un effectif mesuré, sa cause tracée, sa remédiation et un verdict.
Quand un groupe est traité, sa ligne passe à ✅ avec le numéro de PR et le nouvel effectif mesuré.

## Comment c'est mesuré

- **Corpus** : le gold dys réel (72 productions, ~6 600 mots, privé — `data_local/dys_reel/gold_claude.jsonl`, annoté par Claude, pas
  par un expert). Ce document ne cite que des **effectifs** et des **paires de mots isolés**, jamais une phrase, jamais un nom propre.
- **Le produit** : `extension/dys-core.js` (pipeline `diagnoseAll`, mêmes fichiers que l'extension), état `main` + #822. Chaque mot
  écrit est aligné sur le mot attendu par l'aligneur du juge officiel (`dys_precision_probe.align`) ; élision tolérée comme le juge
  (« j'ai » ≡ « ai »), **accents et majuscules exigés** ; mots marqués ambigus dans le gold exclus.
- **Outils** (labo, privés) : `data_local/pendu_labo/catalogue/` — `dump_positions_tout.py` (alignement) → `produit_tout.js`
  (le produit) → `catalogue.py` (familles × sort) → `mecanismes.py` → `remediation.py` (ce tableau). Pour remesurer après une PR,
  relancer les cinq étages dans cet ordre.

## Le bilan

| ce que le produit fait d'une faute | 29/09, départ | aujourd'hui (lots A, B1, prénoms, a + infinitif, et/est, élidés, accents, élision fusionnée, clé phonétique, ou ≠ u, gérondif, élision manquante, ces/ses → c'est, ma/ta/jais, nom/verbe, gardes ce/se et tout, locutions a → à, peu/peut, a → à après adverbe et dans l'intervalle, marques et sigles, formes soudées, déterminants écrits avec é, « cette » mal écrit, initiale et dominance, forme du verbe, a / à devant un verbe, avoir élidé, apostrophe oubliée, t'as / javais, pluriel après chiffres, forme du mot inconnu, ça/cela sujet, lieu + adjectif, quelque, verbe après à / infinitif, genre de l'adjectif antéposé, déterminants pluriels de plus, ce + verbe, présent après « à », chère → chez, quantité + de, petits mots sans leur lettre muette, « ont été » + participe, personne du verbe par le son) |
|---|---|---|
| réparée en rouge | 554 (27,5 %) | **636** (31,6 %) |
| bon mot proposé en orange | 356 (17,7 %) | **513** (25,5 %) |
| mot FAUX proposé | 373 (18,5 %) | **305** (15,2 %) |
| soulignée sans mot proposé | 18 (0,9 %) | 23 (1,1 %) |
| **muette** | **711** (35,3 %) | **535** (26,6 %) |
| **total** | **2 012** | 2 012 |

Et dans l'autre sens : **57 mots justes touchés** au départ (36 en rouge, 21 en orange), **52** aujourd'hui (36 / 16, recompté le 04/10/2026 — le rouge de plus : « soiété », coquille laissée par le gold ; 4 oranges de genre du déterminant
retirées le 30/09, voir ci-dessous ; +3 depuis, artefacts des marques d'élision à deux mots, comparées mot à mot) — voir plus
bas, à auditer un par un.

## Les 711 muettes, par remédiation

Verdicts : **A** faisable maintenant (fait structurel, extension de l'existant) · **B** à mesurer (l'existant se tait pour une garde,
ou il faut un modèle) · **C** impossible avec le texte seul, à discuter · **D** pas une faute (le gold est trop strict).

### A — faisable maintenant (62)

| groupe | n | paires | cause | remédiation | statut |
|---|---|---|---|---|---|
| élision « n' » | 15 | na→n'a ×9 · né→n'est ×4 · non→n'ont | « na », « né », « non » sont des mots connus : le correcteur d'orthographe se tait, la règle d'élision fusionnée ne connaît que jai, quil, leau… | « na » / « né » devant une négation → n'a, n'est, n'es (après « tu ») | ✅ **12 réparées** (lot A) ; UD 0 tir. « na » + verbe après « on » : le gold attend « a » (« on a » ≡ « on n'a » à l'oreille) — rien |
| lieu en minuscule | 16 | japon→Japon ×12 · pyrénées · l'europe · d'afrique | « japon » existe en minuscule (le papier), le correcteur ne touche pas aux mots connus | liste fermée de lieux sans ambiguïté → capitale (« suisse », « paris » exclus : l'adjectif, les paris) | ✅ **16 réparées** (dont « france ») ; UD 0 tir |
| nom au singulier après un nombre en chiffres | 9 | hectare→hectares ×3 · heure→heures ×2 · euro→euros | la règle du nombre ne lit que les nombres écrits en lettres (deux, trois) | nombre en chiffres ≥ 2 (hors année, date, adresse, unité, numéro) + nom au singulier → pluriel, en ORANGE | ✅ orange de pluriel (JS), nouveau canal `_SEG.num` (la valeur de l'entier) ; gold : 1 bon mot de plus ; UD : +2 vraies fautes d'UD (« 60 euro la nuit », « pour 20 personne »), fausses alertes à l'équilibre (+2 « 350 000 koku », « 4 année » ; −2 anciennes : « 25 mai » → mais, « épisode ») |
| cher → chez | 7 | cher→chez ×7 | « cher » est un vrai mot | « cher » + pronom tonique (moi, toi, lui, eux…) → chez | ✅ **5 réparées** ; UD 0 tir. « cher le… » (2) → lot B (« un cadeau cher le jour de Noël » est juste) |
| genre du déterminant | 6 | un→une ×4 · cet→cette | la règle existe (« un voiture » → une, vérifié) ; ici une garde se tait | tracer la garde, cas par cas | → lot B : le NOM qui suit est lui-même mal écrit (le nom est hors lexique : foto, sécuriter, troisieme) — il faut son orthographe avant son genre |
| « été » pour « était » après un sujet | 5 | été→était ×3 · été→étais ×2 | « il été » sans auxiliaire n'est jamais correct, aucune règle ne le lit | sujet + été → était / étais, en ORANGE (« il a été » aussi possible) ; « j'été » → j'étais | ✅ **3 en orange** ; UD 0 tir |
| au / aux | 4 | au→aux ×4 | « au » + nom pluriel : pas de règle | au + nom au pluriel → aux | ⛔ → lot B : même en ne gardant que les formes seulement plurielles, 10 tirs sur UD (« au départ », « au 15 mars ») |

Trouvé dans les mots justes touchés et ajouté au lot : l'orange de pluriel proposait « cultivers », « acheters », « sainements » (un
infinitif derrière « les » pronom ou « ces » écrit pour « se », et l'adverbe qui suit). ✅ Corrigé : derrière les/ces/ses, un infinitif
dans le groupe coupe l'accord — **3 sur le gold, et 20 fausses oranges de moins sur UD** (« les juger » → jugers, « mieux vaut les
oublier » → oubliers…).

### B1 — le VOISIN ORANGE ✅ (29/09/2026)

Mesure transversale : **130 des 674 muettes** avaient un voisin que l'orthographe signale en ORANGE (« il commanse a
pleurer ») — la grammaire ne voyait que le mot brut, inconnu. `diagnoseAll` relit maintenant la phrase avec ces corrections orange ;
ce que la grammaire y trouve en plus, sur un autre mot, est proposé en orange, et seulement pour les 4 règles qui décident sur la
NATURE du voisin (a/à, ou/où, élision fusionnée, -er/-é). **674 → 667 muettes, +7 bons mots, 1 mot juste touché ; UD : 0 marque.**
Exclus après mesure : genre du déterminant et accord sujet-verbe (1 bon mot pour 6 justes touchés ou faux : la forme corrigée du
voisin change le genre ou la personne), épithète (2 fausses sur UD, mots étrangers). Quand le voisin conclut « à », le rouge -er → -é
du mot suivant (qui lisait « a » comme avoir : « il commanse a pleurer » → pleuré) redevient orange.

Vu en chemin, pour le catalogue des **mots faux proposés** : « on continu a chanter » → chanté, « je m'occupe a nettoyer » →
nettoyé, « elle a de la peine a chanter » → chanté (phrases inventées, même construction que 3 cas du gold), en ROUGE — le « a »
y est lu comme avoir ; les constructions « commencer à », « avoir du mal / de la peine à », « prêt à » sont le prochain chantier a → à. ✅ **Fermé le 29/09** : « à » en orange là où « a » ne
peut pas être l'auxiliaire (négation, nom qui appelle « à », verbe + pronom élidé, sujet + verbe) — 5 « à » justes de plus, 4 rouges
faux retirés ou ramenés en orange, 0 perte.

### B — à mesurer (513)

| groupe | n | paires | ce qu'il faut regarder |
|---|---|---|---|
| a → à | 52 ✅ locutions prépositives, verbe + adverbe, intervalle « de 10 … a 20 » (30/09) : 15 en orange ; avoir + groupe nominal objet + a + verbe (03/10 : « j'ai un livre a terminer ») : 1 de plus | a→à ×52 | la règle rouge en répare autant (53) ; le reste n'a pas d'ancre sûre (recensement du 14/09 : le voisin est souvent fautif lui-même). Piste : une orange « carte » comme ces/ses, avec son seuil, mesurée sur UD et le gold |
| homophones grammaticaux | 60 ✅ se qu'elle, se sont + dét., à tout les ; peu → peut après cela (30/09) | et→est ×12 · est→et ×11 · se→ce ×6 · son→sont ×6 · ce→se ×5 · tout→tous ×3 · peu→peut ×3 | les règles existent ; lire les gardes qui se taisent, **et/est d'abord (23)**. ✅ 29/09 : **3 de plus en orange** (sujet nominal + participe, « est voilà », « est » + adverbe + nouvelle proposition), 0 fausse, UD 0 ; restent 20 : deux fautes à la fois (déterminant ou pronom mal écrit, participe écrit à l'infinitif) ou le sens (« est » + groupe nominal + verbe) |
| forme du verbe (-er / -é / -ait) | 48 | arriver→arrivé ×2 · énerver→énervé ×2 · priver→privée ×2 · rouler→roulé | règles existantes muettes : auxiliaire lui-même mal écrit (« na », « jais »), verbe absent du lexique verbal (« ravager »), garde a/à — ✅ **6 réparées le 03/10** (la règle enjambe les pronoms, « étant », « une fois », les adverbes après avoir) ; restent surtout les verbes derrière une AUTRE faute (« et » pour est, « son » pour sont) |
| élisions et apostrophes (autres) | 39 ✅ élision manquante, ces/ses → c'est, ma/ta/jais + participe (30/09) | ses→c'est ×3 · que→qu'il ×3 · jais→j'ai ×2 · ma→m'a ×2 · ces→c'est ×2 | motifs par préfixe : ses/ces + participe → c'est ; ma + participe → m'a ; jais / javais → j'ai / j'avais |
| nombre du nom | 60 | prise→prises ×2 · espace→espaces ×2 · tomate→tomates · pied→pieds · voiture→voitures | après « de » (beaucoup de, des tonnes de : 7) et après d'autres gouverneurs (53) : noms homographes d'un verbe, gouverneur loin |
| accord de l'adjectif | 43 | austral→australe ×4 · chimique→chimiques ×4 · mondial→mondiale ×2 · majeur→majeure ×2 · quelque→quelques ×2 | épithète séparé de son nom, genre du nom inconnu, adjectif lu comme verbe |
| terminaisons homophones (autres) | 66 | mure→murs ×3 · voire→voir ×2 · soi→soit ×2 · foie→fois | finales muettes entre deux mots différents : il faut le contexte grammatical, cas par cas |
| accord sujet-verbe | 28 | avances→avancent · mange→mangent · utilises→utilisent · voulais→voulait · vas→va | silences connus : sujet loin, inversion, relative, incise |
| mots inconnus non signalés | 28 ✅ élidés (29/09) | s'arette→s'arrête · p'apareille→l'appareil · s'asoire→s'asseoir · em→e ×2 | le correcteur d'orthographe saute les mots ÉLIDÉS inconnus (14) et les mots inconnus à MAJUSCULE en milieu de texte (7) ; 7 mots hors dictionnaire acceptés |
| homophones nom / verbe | 25 ✅ -ail/-aille, -eil/-eille… (30/09) | travaille→travail ×4 · rappel→rappelle · appel→appelle · party→parti ×3 · plastic→plastique ×3 | déterminant + forme verbale → nom (« le travaille ») ; sujet + nom → verbe (« je travail ») ; mots anglais acceptés |
| majuscule après ! ? … | 25 | je→Je ×5 · ce→Ce ×3 · le→Le ×3 | le produit ne met la majuscule qu'après un POINT (mesuré ~100 % de faux sur OQLF/BDL après ! ? …) ; à remesurer sur texte dys |
| accents | 31 ✅ ca, foret, pole, media en orange (29/09) | la→là ×5 · ca→ça ×3 · ou→où ×3 · media→média ×3 · pole→pôle ×2 · foret→forêt ×2 | mot-outil (là, ça, où, dû, sûr, dès : 15) ; mot connu sans son accent (16 : même mécanisme que « mere » → mère, `_AFIX_MIN`) |
| autres majuscules (prénoms, sigles, mois) | 8 ✅ sigles et marques (30/09) | d'ogm→d'OGM · Avril→avril | prénoms homographes de mots communs, sigles en minuscules, un mois écrit avec une majuscule |

### C — impossible avec le texte seul : à discuter ensemble (134)

| groupe | n | paires | pourquoi | pistes pour que ça devienne possible |
|---|---|---|---|---|
| vrai mot à la place d'un autre (son différent) | 93 | plus→plupart ×3 · que→qui ×2 · en→on ×2 · place→plage ×2 · mois→moins ×2 | un vrai mot, mal choisi : le son ne le trahit pas, il faut le sens | quelques structures à creuser (que→qui sans sujet, en→on + verbe) ; le reste : un juge qui lit le sens (modèle léger local, comme le juge s'est/sait) |
| homophone de sens | 30 | an→en ×2 · pano→panneau ×2 · publique→public ×2 · industriel→industrielle ×2 · pin→pain | même son, deux mots : seul le sens tranche | même piste (juge de sens) ; les accords de genre (publique, industriel) relèvent du groupe adjectif |
| genre de l'AUTEUR | 7 | allée→allé · partie→parti · réveillé→réveillée · préparé→préparée | « je suis allé / allée » : le genre de celui ou celle qui écrit n'est pas dans le texte | ✅ **réglage LIVRÉ le 01/10/2026** (« J'écris : sans préciser / au féminin / au masculin », orange) : avec le genre de chaque texte lu dans le gold, les 7 → 0, et 5 mots faux de plus deviennent justes ; sans réglage, rien ne change (le décompte de ce catalogue reste celui du défaut) — cf. `LITTERATURE_GENRE_ET_SENS.md` |
| début de phrase sans ponctuation | 4 | le→Le · pour→Pour | l'auteur n'a pas mis de point : on ne sait pas où la phrase commence | la ponctuation (hors sujet dys, acté par Rem) ; ou le détecteur de phrases collées (run-on) |

### D — pas une faute (2)

`entrainement`, `gout` : orthographe rectifiée de 1990, correcte. Le gold est trop strict ici ; rien à faire côté correcteur.

## Mots justes touchés (57) — à auditer

36 en rouge, 21 en orange. Ce qu'on y voit : des mots **ajoutés** (élision « l' »/« d' », négation « ne » : le gold ne corrige que
l'orthographe, il n'ajoute pas le « ne » oublié), des **genres de déterminant** retournés (la → le ×3, le → la ×2), l'orange de
pluriel sur un infinitif ou un adverbe (voir lot A), et quelques accords sujet-verbe. Chacun est à relire : un rouge sur un mot juste
est la seule colonne qui viole la doctrine FP=0.

✅ 30/09 : les genres de déterminant retournés par un nom MAL ÉCRIT (« la foret » → le, « le pole » → la) — l'orthographe proposait au
même endroit « forêt » / « pôle », qui s'accordent avec le déterminant écrit : la marque du déterminant se retire (4 oranges, 0 ailleurs,
UD sans changement). Reste « la » devant un verbe mal écrit, lu comme un nom.

## Ordre de travail

1. **Lot A** (62 + les 3 oranges fausses) : une PR par groupe ou par petits paquets, chacune mesurée (gold, UD, précision au produit).
2. **Les deux gros gisements** : a → à (52) et et/est (23) — mesurer d'abord, orange d'abord. (et/est : 3 de plus le 29/09, 20 restent.)
3. **Le correcteur d'orthographe qui saute** (28) et les **accents** (31).
4. **Les silences de grammaire** (forme du verbe, nombre du nom, adjectif, sujet-verbe : ~180) — tracer les gardes, étendre l'existant.
5. **Lot C** : décidé avec Rem le 01/10/2026 — le **réglage du genre** est à faire (« j'écris au féminin / au masculin / je ne précise
   pas », orange, rien en dialogue) ; le **juge de sens** et le réglage ont leur revue de littérature : `LITTERATURE_GENRE_ET_SENS.md`
   (seuil par paire et par sens, précision ≥ 0,99 sur du français correct, tables distillées pour l'extension) ; la ponctuation reste
   hors sujet dys. « il serai » → *sera* (futur), choix de Rem.

Les fautes où le produit propose un **mot faux** : le second catalogue, ci-dessous.

## Le 2e catalogue : les mots FAUX proposés (29/09/2026)

Même méthode. Le produit propose un mot, mais pas celui qu'attend le gold. Le pire cas est le **rouge** : la faute est remplacée
d'office par une autre. Mesuré après les lots ci-dessus : **316**, dont **37 en rouge** (47 avant le premier lot), 38 « flag » (dont 2 artefacts
d'alignement de l'élision à deux mots, 30/09), 241 en orange (dont 2 du même artefact, ma/ta/jais).

| rouges faux, par règle (avant le premier lot) | n | cause | statut |
|---|---|---|---|
| orthographe | 15 | l'accent est bien restauré, mais le gold attend une autre flexion ou une élision | à lire : souvent « bon lemme » |
| élision fusionnée | 9 | reste d'une liste fermée cherché sans accent, recopié tel quel (« s'éte ») ; « jen » = gens | ✅ 29/09 : 9 retirés |
| élision fusionnée, après j', n', qu', d', l' (hors gold) | 6 | la liste COMMUNE des suites servait pour tous les préfixes : « qu'es », « l'ils », « d'est » (et « J'on » sur UD) | ✅ 04/10 : une liste par préfixe — 6 retirés sur les corpus dys, 2 sur UD |
| -e/-é (participe) | 4 | la forme en -e lue comme participe (le nom ou le présent était voulu) | à mesurer |
| accord sujet-verbe | 4 | sujet ou verbe lui-même mal écrit ; « en + -ent » lu comme verbe fini (gérondif) | ✅ 30/09 : le gérondif (« en disent » → disant, orange) ; restent 3 |
| pluriel du nom | 4 | le nom mal écrit est pluralisé tel quel | ⛔ garde « pluriel attesté » réfutée (1 retiré, 1 juste cassé) |
| terminaison -er/-é, accord é/er | 7 | participe nu là où l'accord est attendu (bon lemme) | à relier à l'accord du participe |
| accord participe, participe après auxiliaire, genre du déterminant | 4 | cas isolés | à lire |

Le plus gros gisement est **orange** : le correcteur d'orthographe propose un candidat, mais pas le bon (tri des candidats :
« séte » → sais au lieu de cette, « eclairait » → éclair). ✅ 30/09, premier lot : la CLÉ phonétique rendait vides des mots comme
« cette », « sais », « ai » (312 formes) — un e muet écrit garde maintenant sa consonne : 17 mots faux de moins sur le gold, 141 marques
devenues justes sur les 3 corpus, UD sans marque nouvelle. ✅ 30/09, deuxième lot : « ou » ≠ « u » dans la clé (« tou » → tout ×5, « cur » → cure) et finales audibles en /ɛ/ (« apré » → après,
pas la coquille « aprés ») : 11 mots faux de moins sur le gold, 19 fausses devenues justes sur les 3 corpus, 0 juste perdue, UD sans
marque nouvelle. ✅ 30/09, troisième lot : « mot inconnu » — l'accent seul d'abord quand le mot écrit n'a aucun accent (« eclairait »
→ éclairait, plus éclair ; un rival à une édition 20 fois plus fréquent garde la main : « apre » → après) : 44 suggestions deviennent
le mot exact sur les 3 corpus, 1 perd, UD sans changement. ✅ 30/09 : « séte » → cette / cet et « set » → cette (orange, en contexte) : 7 de plus.

✅ 04/10 : « mot inconnu » — **le bon mot, pas la bonne FORME**. Recensement d'abord : sur les 313 mots faux, 170 sont « bon lemme, mauvaise
flexion » (singulier au lieu du pluriel, « veux » au lieu de « veut »…), dont 137 posés par l'orthographe ; pour la plupart, le mot
d'avant est lui-même mal écrit (ancre polluée) et ne dit rien de sûr. Le tri de « mot inconnu » choisissait le mot sans regarder
le contexte : la forme choisie s'accorde maintenant au mot juste avant quand celui-ci est sûr — le NOMBRE d'un déterminant (« les kar »
→ cars : forme jumelle exacte +s, -u/+x, -al/-aux) et la PERSONNE d'un sujet (« le facteur veu » → veut : pronom, déterminant + nom,
« l' » + nom ; le même verbe, jamais un participe). 6 mots faux de moins sur le gold ; 25 suggestions deviennent le mot exact sur les
3 corpus (juge strict, accents compris), 0 perdue ; UD : aucune marque en plus ni en moins.
