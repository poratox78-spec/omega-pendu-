# Audit du correcteur — octobre 2026

Demande de Rem (13/10/2026, paraphrase) : un audit PROFOND du correcteur — liaisons, connexions, lexiques, règles, explications, ce qui
peut rester silencieux — en notant ce qui existe ; regarder les oranges qui peuvent passer en rouge ; rafraîchir la carte du site.
Premier audit : `dictee/AUDIT_CORRECTEUR_2026-09-11.md` (+ `AUDIT_CORRECTEUR.md`, #461).

Ce rapport se remplit lot par lot. Chaque chiffre vient d'une mesure relancée le jour dit ; les phrases citées sont INVENTÉES (vérifiées
contre les corpus) ou viennent d'UD (public).

## 0. Une erreur de mesure, la mienne — et sa garde

Depuis le catalogue des muets (29/09), mes bancs du labo (gold dys, 3 corpus, UD — hors dépôt) ne chargeaient PAS le modèle OS-sujet.
La famille orange « accord verbe à vérifier » était absente de tous mes « 0 changement » des lots de fin septembre à la conjugaison 14.
Seul `./dev.sh` la voyait, par la précision au produit dans Chrome — et un plancher n'attrape qu'une chute d'ensemble, pas chaque cas.

- Garde (labo) : un banc s'arrête si `DYSCORE` expose un `set*` que le banc laisse de côté. Exemptés après vérification :
  `setConfusables` (couche verte `vigText`, hors `diagnoseAll`), `setPonctLm` (panneau vocal), `setAuteur` (réglage, défaut nul).
- Même angle mort dans les sondes COMMITÉES (relevé du 13/10, qui charge quoi) :

| sonde | tables du produit chargées | manque |
|---|---|---|
| `extension/parity_core.js` | lex, prénoms, noun-post, HMM, genre accentué | **OS-sujet** |
| `dictee/parity_corr.js` (app) | lex embarqué | **OS-sujet** (et le reste vient des blocs de l'app) |
| `dictee/textes_probe.js` | lex, prénoms, noun-post, HMM, genre acc., confusables | **OS-sujet** |
| `dictee/casses_au_produit.js` | lex, prénoms, noun-post, HMM | genre accentué, **OS-sujet** |
| `dictee/recall_probe.js` | lex, noun-post | prénoms, HMM, genre acc., **OS-sujet** |
| `dictee/parity_os.js` | tout ce qui touche rouge/orange | — (seul banc complet) |
| `dictee/navigateur_probe.js`, `a11y_probe.js`, `dys_precision_probe --navigateur` | le vrai produit dans Chrome | — |

- **Corrigé (liste n° 25, #952)** : `extension/charger_node.js` charge le moteur avec exactement les tables de l'extension ;
  `extension/chargeur_probe.js` (dev.sh + CI) échoue si l'extension charge une table qu'il ignore, ou si un banc Node charge le moteur à
  la main sans écrire pourquoi. Les bancs « au produit » y passent ; les autres déclarent leur raison.

## 1. Famille « accord verbe à vérifier » (vigilance OS-sujet) — re-mesurée modèle chargé

- 28/09 → conjugaison 14 : +8 marques inutiles (corpus), +10 (UD), 0 juste. Cause : des passés simples devenus lisibles par la table
  complète, décidés par les seuls voisins (R1-R3 : le mot à nombre le plus proche) alors que le modèle de langue (R4) n'entend AUCUNE des
  deux formes (R4 = 0,50).
- Précision réelle de la famille (3 corpus, avant correctif) : 2 justes (route relative) sur ~188 marques ; route « voisins » : 0 juste.
- Corrigé (lot 14) : modèle muet + voisins seuls → silence ; −57 inutiles corpus, −41 UD, 0 juste perdue.
- Corrigé (conjugaison 15) : l'inverse — voisins muets, le modèle de langue seul → silence ; −20 inutiles corpus, −15 UD, 0 juste
  perdue. Rejeté : la même garde sur la route relative (elle perdait les 2 seules vraies prises du gold — dégoûte, délimite, toutes deux
  décidées par l'antécédent seul ; ma première étiquette « modèle parle » pour cette route était fausse, la route n'a que 2 voix).
- Trou noté : le déterminant élidé « d'autres », « d'anciens » n'est pas lu comme pluriel par les voisins (R1-R3).
- **Reste pour décision de Rem** : la route « voisins » quand toutes ses voix parlent — 0 vraie juste sur 3 corpus ; sur UD elle
  attrape quelques vraies fautes d'UD (« Aucun d'eux ne seront » → sera, « La plus ancienne mention … proviennent » → provient). Liste
  des cas à regarder ensemble avant de trancher (doctrine : décider sur la liste, pas sur un %).

## 2. Oranges réfutées par le bout de chaîne — corrigé (lot 14)

Le bout de chaîne applique la suggestion d'une orange et relance les règles rouges ; quand le rouge ramenait la suggestion au mot ÉCRIT,
l'orange restait affichée avec « → le même mot » (« Certains pensent que la course est trop dure » → « pensent → pensent »). Ancien
(présent le 28/09) ; ~13 marques corpus + 10 UD ; le juge les comptait JUSTES (suggestion == corrigé). Retirées.

## 3. Lexiques déconnectés (table de conjugaison ↔ dictionnaire d'orthographe)

- 1 998 formes conjuguées distinctes de la table (Morphalou) sont absentes du dictionnaire d'orthographe. Ce n'est PAS un oubli :
  ~1 400 tombent sous le filtre anti-masquage de `build_morph_lex.py` (aucun ajout à une lettre d'un mot fréquent, sinon « dess »
  deviendrait valide) ; la plupart des autres ont une jumelle accentuée (« tu achemines » / « acheminés ») — les accepter masquerait
  l'accent oublié, faute dys majeure. La fréquence y DÉPARTAGE deux lectures de la même forme : conforme à la doctrine.
  Le défaut réel est l'ÉTIQUETTE : un verbe valide reçoit « mot inconnu » (« rissole » → rissolé). À revoir : « à vérifier », pas
  « inconnu ».
- 638 formes conjuguées distinctes n'ont pas de lecture verbe dans le dictionnaire. 354 sont des noms dont la lecture verbale est
  marginale (posterior P(verbe) < 1 % : crise, article) — normal. Candidates réelles : ~110 homographes dont la part verbale dépasse
  1 % (peuples, câbles, espaces) et ~130 sans posterior, dont des erreurs du lexique (« dictâmes », « plombâtes » notés nom).
  Effet vu : « mes cousins procrastine » → procrastines (pluriel de nom), « les voisins de mon oncle procrastine » muet. CHAÎNE
  vérifiée : le tagger n'apprend que 16 033 mots d'UD (98,9 % des formes de la table lui sont inconnues) ; pour les autres il lit un
  lexique dérivé du dictionnaire (build_pos.py) — « procrastine » y est nom → étiqueté ADJ → la règle sujet-verbe se tait. Lot à
  mesurer : la lecture V pour les formes de la table que le posterior n'exclut pas.

## 3 bis. La table et son index ne disent pas tout à fait la même chose

L'index des lectures `f` (ce que lit `svReads`) et la table `c` (lemme → temps → case → forme, ce que lisent les règles qui proposent
une forme) divergent : 13 592 clés que `c` produit n'ont pas de lecture dans `f` (« accusèrent », « accusâmes » : le passé simple déjà
en table avant la conjugaison 14 n'a jamais reçu sa lecture — `complete_conj_morphalou.py` saute une case déjà remplie, `f` compris),
et 13 183 entrées de `f` diffèrent de ce que `c` dérive. Depuis la table compacte, ces écarts sont ÉCRITS (`fd`, `fo`) : la liste à
trier existe. Trié (conjugaison 15) : 13 552 OUBLIS, tout le passé simple au pluriel — rendus lisibles (`lire_cases`) ; 3 352
subjonctifs imparfaits sur une clé déjà prise et 24 autres exclusions voulues — gardés.

## 4. Dettes connues

- 9 régressions d'orthographe affichées à chaque dev.sh depuis #568 (`vig_census_ref.json`). **Liste n° 24 (#952)** : 2 réparées
  (prison, civile — le contexte de nombre de l'orthographe débordait d'un groupe à l'autre). Les 7 restantes (tèrs, sines, soucehs,
  êrcite, préférrées, sonn, séris) ont chacune leur cause ; elles restent affichées.

## 5. Coûts et livraison

- La table complète a porté trois fichiers au-delà de 25 Mio : ./dev.sh vert, mais le site ne se déployait plus (Cloudflare Pages,
  limite par fichier). Corrigé par la table compacte (`dictee/conj_io.py`) : 12-14 Mio par fichier, app ≈ 15 Mo, zip 6,3 Mo.
  Garde : `dictee/taille_fichiers_probe.py` (dev.sh + CI).
- Coût restant de la table complète : +44 Mo de mémoire (249 → 293 Mo) par onglet où tourne le correcteur ; ~0,8 s de recalcul de
  l'index au chargement, fait par tranches dans l'extension (jamais plus de ~150 ms d'affilée).

## 6. Inventaire par script (liste n° 27)

`dictee/inventaire_correcteur.js` écrit `dictee/INVENTAIRE_CORRECTEUR.md` à partir du code, et `--check` (dev.sh, CI) refuse un
inventaire en retard. Ce qu'il a établi le 15/10/2026 :
- la chaîne des règles de grammaire : 103 entrées, 78 noms affichés, identique dans l'extension et l'app (mêmes fonctions, même ordre) ;
- le moteur Python a les 103 dans le même ordre, sauf UNE règle déplacée (« infinitif après pronom sujet à vérifier », orange : en fin
  de chaîne côté Python, après « accord tout » côté extension) — nommée dans le script, qui échoue si une autre dérive ou si celle-ci
  revient à sa place ; plus 10 oranges que l'extension pose hors de la chaîne ;
- paliers : 67 rouges, 12 rouges avec un cas orange posé par la règle, 12 rouges ou orange selon le sous-cas mesuré, 12 oranges ;
- chaque nom de règle a une famille de conseil par son nom ; ponctuation, style et répétition n'ont pas de conseil, voulu ;
- les 11 tables et qui les lit : la table de conjugaison et de genre (vdc-lex) est lue par 96 règles sur 103, l'étiqueteur par 43, le
  dictionnaire par 28, le posterior des noms par 23, le genre accentué par 21, les prénoms par 12 ; le modèle OS-sujet, les confusables,
  le réglage d'auteur et la ponctuation vocale ne servent à aucune règle de la chaîne (ils servent les oranges OS, la couche verte,
  le réglage « j'écris au féminin » et le panneau vocal).

## 7. La liste unique (13-15/10/2026)

Une seule liste numérotée (constats sur de vrais textes + cet audit), traitée dans l'ordre, une ligne fusionnée avant la suivante ;
chaque ligne : la famille autour de l'exemple, la cause, trois moteurs, des tests inventés qui échouent sur le moteur d'avant, la
mesure produit ancien contre nouveau (3 corpus dys + UD 14 450).
- Fusionnées : #946 (11, 13, 14), #947 (16, 1c), #948 (12), #949 (17), #950 (18, 19, 20, 1d), #951 (21, 22, 23), #952 (24, 25, 26) ;
  avant elles, les lignes 1 à 6. Avec ce rapport : 1e (noms composés « machine à laver »), 5b (l'accent écrit gardé, les métiers après
  « est », 88 coquilles en « -è » du dictionnaire), 27 (l'inventaire ci-dessus).
- Oranges → rouge (ligne 26) : la voie nouvelle a/à seulement (27 tirs, 27 justes ; 25 rouges, 2 oranges après la suite). Restent
  orange, faute d'effectif : c'est/ces (8/8), élision inversée (5/5) ; ou/où (15 tirs sur UD).
- Attendent une décision de Rem : la route « voisins » de l'accord verbe (ligne 8), le Wiktionnaire récent (lignes 7 et 10), le
  retrait du moteur Python (25b).

## À venir

- Carte du site (`toile.html`, ligne 28) : Morphalou, règles de mode et de temps, impératif, explications, OS-sujet, chargeur unique.
- Silences : catalogue des muets par famille, couverture de la conjugaison, sondages de phrases inventées.
