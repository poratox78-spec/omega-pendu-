# État des lieux du correcteur dys — 22/08/2026, confronté à la littérature

> Pause après la campagne qualité (#545→#554). Ce document répond à trois questions : **où on en est**,
> **ce que la littérature dit de ce qu'on fait**, et **ce que ça change aux chantiers ouverts**.
> Règle appliquée partout ici : un chiffre venu d'un papier est une *hypothèse à vérifier sur nos données*,
> pas un résultat. Deux pistes de la littérature ont ainsi été **rejetées après mesure** (§4).

## 1. Où on en est (mesuré sur `data_local/dys_reel` — 1 726 paires ⚠️ **dont 92,7 % de SONDES**, cf. §3bis)

| | valeur |
|---|---|
| mots erronés | 6,9 % |
| non-mots | 16,0 % |
| erreurs produisant un **vrai mot** | 34 % |
| non-mots promus avec la **bonne** graphie | 793 |
| non-mots promus avec la **MAUVAISE** | 216 |
| `orthographe auto` (précision) | 91,5 % |
| FP à l'échelle (UD, 2 500 phrases correctes) | **1,44 %** |
| gardes locales | dev.sh **69/69** |

⚠️ **Lire ces absolus avec §3bis** : le corpus est à 92,7 % des sondes à faute unique et ne contient que
**6 vraies dictées**. Les deltas avant/après sont valides ; les absolus ne se généralisent pas au dys réel.

Acquis structurant de la campagne : **le poison n'est pas le non-mot, c'est la réparation fausse.**
Un non-mot laissé visible coûte 6 points de précision à la grammaire (91 → 85 %) ; **mal réparé il en
coûte 36** (91 → 55 %), parce qu'il est promu au rang de mot connu et hérite de la confiance pleine.

## 2. Ce que la littérature CONFIRME

**Bodard (2020), JEP-TALN-RÉCITAL** — analyse de corpus dyslexiques **français**, même objectif que nous
(« guider le développement de modules de correction orthographique »).

| Ce qu'ils mesurent | Ce qu'on fait |
|---|---|
| **58,7 %** des formes erronées ont la **même phonétique** que la cible (**67,1 %** en voyelles simplifiées) | route phonétique = pilier du speller ✔ |
| gain à **simplifier les voyelles** (fusionner /e/-/ɛ/, /o/-/ɔ/, /ø/-/œ/-/ə/, /ɛ̃/-/œ̃/) | `phon_key` le fait déjà — et on a **mesuré-réfuté** l'IPA fidèle (85 % contre 67 % de collision typo↔correct). **Convergence indépendante** ✔ |
| erreurs les plus fréquentes : **phonétisation 27,25 %** + **accord genre/nombre/conjugaison 26,81 %** = plus de la moitié | nos deux plus gros investissements ✔ |
| formes les plus souvent erronées : *très, peut, à, après, ils, ont, c'est, ce, au, est* | exactement les règles qu'on a écrites (a/à, ce/se, est/et, on/ont, peu/peut) ✔ |
| **72,3 %** des formes erronées ont ≥1 mot de contexte erroné (fenêtre ±2) | notre « ancre polluée » — **le même phénomène, publié en 2020** ✔ |
| homophones **11,28 %**, majuscule **3,14 %**, segmentation **6,35 %** | couverts (règles, majuscule, élision/soudure) ✔ |

**Littérature anglophone** : les erreurs en **mot réel** (« form » pour « from ») sont ~20 % des fautes dys
et **les correcteurs courants ne les détectent pas** — c'est précisément le trou que notre couche grammaire
existe pour boucher.

**Recommandation pédagogique convergente** : l'élève doit **analyser** les suggestions plutôt que les
accepter d'un clic. C'est l'architecture rouge/orange + stade + remédiation, pas un choix esthétique.

## 3ter. ⚠️⚠️ CORRECTION MAJEURE — ce n'est PAS une convergence : **c'est le MÊME corpus**

En lisant la notice de `data_local/dys_reel/corpus_dys/README.txt` : *« corpus communiqué par Laetitia
Branciard de la **FFDys** »* (7 textes, adolescent) et *« Cécile Péguin, **Plateforme Dys de l'ASEI** »*
(71 textes, adultes). Ce sont **exactement les deux corpus analysés par Bodard (2020)**.

**Vérifié, pas supposé** : les **15** formes erronées citées en exemple dans le papier sont toutes dans nos
fichiers — `disgetif`, `meiu`, `setoufle`, `mayeur`, `Qustion`, `aprle`, `situiation`, `réusite`,
`comerse`, `ducou`, `rendévous`, `lafrique`, `oré`, `nalé`, `fesé`.

⇒ **La « convergence indépendante » annoncée en §3bis n'existe pas.** Nos chiffres ressemblent aux leurs
parce que ce sont les mêmes données. Je l'avais présenté comme une validation externe : **c'était faux**.

**Ce que ça apporte quand même, et c'est beaucoup** : les statistiques publiées de Bodard **décrivent notre
propre corpus**, annoté avec un gold que nous n'avons pas. Elles ne valident pas notre moteur — elles nous
donnent la vérité terrain des **72 textes que nous n'exploitons pas**.

### Ce que nous avons vraiment sous la main

Les **78 textes sont dans le dépôt**, mais en `_raw.txt` **sans aucun corrigé** : seules les 6 dictées ont
un gold (le texte dicté est connu). D'où les « 6 paires ». Les 72 autres restent mesurables pour tout ce
qui **ne demande pas de référence** — le taux de **non-mots** en est un :

| genre | textes | mots | non-mots |
|---|---|---|---|
| corpus1 (adolescent, scolaire) | 7 | 3 128 | **26,2 %** |
| Dictée | 6 | 335 | 21,8 % |
| Expression libre | 32 | 1 497 | 16,0 % |
| Expression écrite dirigée | 33 | 2 063 | 15,4 % |
| **TOTAL réel** | **78** | **7 023** | **20,6 %** |

À comparer aux **16,0 %** du mélange que nous mesurions : le texte dys réel est **plus dur**, et les
dictées ne sont pas le genre le plus facile sur cet axe (21,8 %).

### ⚠️ Biais de mesure dans NOTRE juge

`dys_precision_probe.eq` **normalise les accents** (`norm()` retire les diacritiques). Or l'accent est une
famille d'erreurs dys majeure, que Bodard compte. Notre taux de mots fautifs est donc **sous-évalué par
construction** :

| | juge actuel | juge strict | écart (accents/élisions) |
|---|---|---|---|
| 6 dictées | 13,1 % | **17,1 %** | 4,0 pts |
| sondes | 5,4 % | 6,2 % | 0,8 pt |
| généré | 13,3 % | 16,9 % | 3,6 pts |

⇒ **toutes les comparaisons de pourcentages à la littérature (§3, §3bis) étaient biaisées à la baisse.**
La tolérance aux accents reste **justifiée pour juger une correction** (on ne veut pas compter « mere »
comme une faute que le correcteur devrait corriger) mais elle **ne doit pas servir à décrire le corpus**.

## 3bis. ⚠️ CORRECTION (même jour) — ce n'est pas « notre corpus est trop facile », c'est **un mélange mal étiqueté**

La section 3 ci-dessous a été écrite en comparant la littérature au **mélange** `data_local/dys_reel`.
En ouvrant les fichiers (`corpus_profile_probe.py`), il s'avère que ce mélange est à **92,7 % des SONDES à
faute unique** (`faiblesses.jsonl` : 200 par famille × 8) et ne contient que **6 vraies dictées** (0,3 %).

| axe | **RÉEL (6 dictées)** | littérature | sondes | généré |
|---|---|---|---|---|
| distance d'édition 1 | **60,5 %** | 58,8 % | 71,0 % | 68,1 % |
| distance ≥2 | **39,5 %** | 41,2 % | 29,0 % | 31,9 % |
| 1ʳᵉ lettre fausse | **18,6 %** | 10,9 % | 4,8 % | 8,0 % |
| erreurs en vrai mot | **48,8 %** | 53 % | 31,2 % | 38,3 % |
| mots fautifs | **12,8 %** | ~33 % | 5,4 % | 13,2 % |

**Sur la FORME des erreurs, nos vraies dictées convergent avec la littérature.** Ce sont les **sondes** qui
sont atypiques — faute isolée, première lettre presque jamais touchée. (La densité reste sous la
littérature, mais celle-ci varie énormément : Antoine 2019 **55 %**, Pedler **20 %**, Rello **15 %**.)

Conséquences :
1. Les mesures **avant/après** de la campagne restent **valides** (même corpus des deux côtés).
2. Les **absolus** (« ortho auto 91,5 % », « 793 promus ») décrivent surtout la tenue du moteur sur des
   fautes **isolées**. Ne pas les généraliser à la population cible.
3. ⚠️ **RÉTRACTATION de la rétractation** : « `dys_gen.py` met ~2× trop de fautes » était faux, mais la
   correction de §3 l'était aussi. Mesure directe : **généré 13,2 % contre RÉEL 12,8 %** — le générateur
   est **bien calibré en densité**. Le biais **×29 sur les déterminants** reste, lui, à vérifier.
4. **Le vrai manque n'est pas un meilleur générateur, c'est du texte dys réel** : 6 dictées, 335 mots.
   C'est la validation terrain (orthophonistes) déjà inscrite au plan qui débloque tout le reste.

## 3. Ce que la littérature semblait corriger — lecture initiale, faussée par le mélange (conservée pour l'historique)

Sur **tous** les axes mesurables, notre corpus privé est plus doux que les corpus dyslexiques publiés :

| | littérature FR (Bodard 2020) | **notre corpus** |
|---|---|---|
| mots erronés | ~33 % | **6,9 %** |
| formes à distance d'édition ≥2 | 41,2 % | **30,3 %** |
| 1ʳᵉ lettre fausse | 10,9 % | **6,2 %** |
| erreurs produisant un vrai mot | 53 % | **34 %** |
| erreurs par mot | 1,4 | — |

Conséquences, à assumer :

1. **Nos chiffres sont optimistes** par rapport à la population cible. « 91,5 % » et « FP 1,44 % » sont
   mesurés sur un texte plus propre que ce qu'un scripteur dyslexique produit réellement.
2. ⚠️ *(voir §3bis : cette lecture est elle-même corrigée — le générateur est bien calibré.)* **La conclusion « `dys_gen.py` met ~2× trop de fautes » est à revoir.** Elle était
   mesurée **contre notre corpus** (13,1 % de mots fautifs contre 6,9 %). Contre la littérature (~33 %),
   c'est le **générateur qui est le plus proche du réel**, et notre corpus qui est atypique. Le biais
   ×29 sur les **déterminants** reste, lui, un vrai biais de forme. **À trancher par une mesure**, pas par
   arbitrage : nos deux populations diffèrent peut-être (âge, dictée vs écrit spontané, aide à la saisie).

## 4. Pistes de la littérature ÉVALUÉES ET REJETÉES sur nos données

- **Initiale phonétique au lieu d'initiale orthographique.** Le papier note 10,9 % de premières lettres
  fausses mais **<4 %** de premières lettres *phonétiquement* fausses — donc la garde « même initiale
  orthographique » du speller (`_cands`) semblerait écarter ~7 % de cas récupérables.
  **Mesuré chez nous : elle écarte 6,2 % des formes erronées, dont 5,5 % ont AUSSI l'initiale phonétique
  fausse → gain maximal 0,7 %.** Ne vaut pas le code. *Piste fermée.*
- **« Préférer le candidat qui n'invente aucune lettre »** (phénoménologie dys : on inverse/omet/double ce
  qu'on a écrit). Implémentée proprement, gagnait `belu`→*bleu*… et coûtait **11 bonnes corrections pour
  3 mauvaises évitées**. *Falsifiée (#554), ne pas refaire.*

## 5. LanguageTool — ce qu'on apprend de leur architecture

Leur `ConfusionProbabilityRule` utilise un **facteur** : de combien le mot **présent dans le texte** doit
être préféré à l'alternative. Points saillants :

- plage utilisée : **10 à 10 000 000** ; un facteur de **1 produit des fausses alertes** ;
- ils choisissent le facteur avec un évaluateur dédié (`ConfusionRuleEvaluator`) qui imprime précision et
  rappel, et **préfèrent explicitement la précision** : seuils minimaux **0,995** (mots fréquents),
  **0,99** (autres) ;
- la plupart des paires de confusion sont **désactivées par défaut** pour la qualité ;
- limite assumée : ils ne détectent pas les confusions dont un membre fait plusieurs tokens.

**Ce que ça dit de notre chantier n°1.** Notre garde de dominance ≫20× a la **même forme** que leur facteur
— mais avec une différence décisive : **leur comparaison est CONTEXTUELLE (n-gram), la nôtre est une
fréquence NUE.** C'est pour ça que `parvis` (0,15) ne peut pas battre `parties` (23,7) sur `parvies`, alors
même qu'il a la bonne priorité *et* le bon phon-match : hors contexte, il n'a aucun argument.

⇒ **Le chantier n°1 n'est donc pas « baisser le seuil de 20× »** (ce qui échangerait des junks contre des
faux positifs), **mais donner du contexte à la comparaison.** Le dépôt a déjà ce qu'il faut (n-gram
§1.7 arbitré OS, POS-tagger 155k, `noun-post`) — doctrine §5 : réutiliser avant d'ajouter.
Et leur seuil de précision (0,99–0,995) est le repère externe à viser.

## 5bis. Chantier « dominance en contexte » — INVENTAIRE FAIT, ROUTE BLOCKÉE PAR LES DONNÉES

Avant d'écrire quoi que ce soit (doctrine §5), inventaire de ce qui existe déjà pour donner du **contexte** :

| existe déjà | quoi | état |
|---|---|---|
| `dictee/os_subj_lm.json.gz` | LM **bidirectionnel** trigrammes+bigrammes (UD French-GSD), API `p_fwd`/`p_bwd`/**`lsc(w,p2,p1,n1,n2)`** | **EN PRODUCTION**, parité 3 moteurs (`parity_os.js`, bloc `os-lm-gz`) |
| `dictee/pos_hmm.json` | POS-tagger HMM Viterbi ~95 % | en production, 3 moteurs |
| `dictee/build_asr_lm.py` | LM **plus gros** (UD complet + WiCoPaCo), couverture ×240 | **MESURÉ PIRE**, gardé comme recette |
| `dictee/ces_ses_model.json` | modèle contextuel dédié à un couple d'homophones | en production |

**Rien à construire : `lsc()` EST la comparaison contextuelle que réclame la garde de dominance.**
Testé directement sur les cas connus — et le résultat est négatif :

| cas | LM choisit | gold |
|---|---|---|
| `le parvies de l'abbatiale` | *parties* (−8,90 contre −13,78) | **parvis** ✗ |
| `la nuque belu clair` | *beau* (−11,89 contre −12,25) | **bleu** ✗ |
| `trois enfants qui vvient` | *vient* | **vivent** ✗ |
| `Tous less magasins` | **les** ✔ | les |
| `un leson de piano` | **leçon** ✔ | leçon |

**Cause, mesurée** : le LM fait **13 954 unigrammes / 233 614 tokens**. `parvis` y apparaît **2 fois**
contre 40 pour `parties` ; **`nuque` est ABSENT** — le contexte de `belu` n'a donc aucune ancre et `lsc`
**dégénère en `p_uni`**, c'est-à-dire… la fréquence nue qu'on cherchait à fuir.

⇒ **La route contextuelle est bloquée par le VOLUME de données, pas par l'architecture.** LanguageTool
s'appuie sur les n-grammes Google (milliards de tokens) ; nous avons 0,23 M. Et le projet a **déjà tenté**
de grossir le LM (`build_asr_lm.py`, ×240 de couverture) : **mesuré pire**, piège de registre Wikipédia
(« ses fréquences tirent vers père/opposé au lieu de chères/proposer » — *le même piège de fréquence*).

**Conclusion honnête** : le chantier « donner du contexte à la dominance » ne se débloque pas avec les
données du dépôt. Ce n'est pas « il faudrait un n-gram » — on en a un, de la bonne forme, 4 ordres de
grandeur trop petit. Rouvrir ce chantier suppose **un corpus FR massif au bon registre**, arbitrage
explicite (taille embarquée, licence) — pas un ajustement de seuil.

## 5ter. ✅ LE GOLD MANQUANT : je l'ai écrit — et le vrai chiffre du moteur tombe de 14 points

Constat de Rem : *« corrige ce qui n'est pas corrigé, tu fais de la correction. »* Juste — je répétais qu'il
manquait du corrigé en étant capable d'en produire.

**Protocole** (pour que la mesure vaille quelque chose) :
- correction **à la main, en édition minimale** : orthographe, accord, conjugaison, accents, élision,
  segmentation, majuscule de phrase. **Ni style, ni ordre des mots, ni ponctuation ajoutée** ;
- **produit SANS faire tourner le correcteur** sur ces textes — sinon la mesure serait circulaire ;
- **provenance marquée** : `src = "gold_claude/…"`, annotation par Claude, **jamais** un corrigé humain
  expert. Le fichier reste dans `data_local/` (corpus privé FFDys/ASEI, non versionné) ;
- un texte trop dégradé pour être reconstruit honnêtement est **écarté** (`texte4_h35`) ; un token isolé
  que je ne sais pas trancher est **laissé intact et signalé** (`ambig`) plutôt que deviné.

**FAIT : les 72 productions, 6 778 mots** (contre 335 auparavant — ×20) — contre 335 auparavant (les 6 dictées). Contrôle qualité : aucun mot
inconnu ne subsiste dans mon corrigé hors noms propres et artefacts de tokenisation.

### Le moteur, jugé sur du texte dys RÉEL

| | mélange (93 % de sondes) | **texte dys réel** |
|---|---|---|
| orthographe **auto** | 91,5 % | **77,8 %** (21 justes · **0 inutile** · 6 fausses) |
| orthographe **flag** | 69,8 % | **52,4 %** (22 · 2 · 18) |

**−14 points.** Ce que je soupçonnais en découvrant la composition du corpus est confirmé sur données
réelles : *les absolus du projet décrivaient la tenue du moteur sur des fautes isolées.*
Point positif à ne pas perdre : **0 faux positif** en `auto` — la garde cardinale tient sur du texte réel.

**Motif dans les 6 fausses** : `preparer`→*préparer* (gold **préparée**), `reveiller`→*réveiller* (gold
**réveillée**), `gateaux`→*gâteaux* (gold **gâteau**). Le speller **restaure l'accent et laisse la
flexion fausse** — il transforme un non-mot en mot valide mal fléchi, et passe le relais à la grammaire.
C'est exactement la **pyramide** mesurée en §… et son revers (« le poison est la réparation fausse »).

### Profil de ce gold (vs les autres groupes)

| | mots fautifs | d=1 | d≥2 | 1ʳᵉ lettre | **vrai mot** |
|---|---|---|---|---|---|
| **RÉEL corrigé à la main (31)** | **18,3 %** | 77,5 % | 22,5 % | 9,9 % | **72,5 %** |
| RÉEL dictées (6) | 12,8 % | 60,5 % | 39,5 % | 18,6 % | 48,8 % |
| littérature (Bodard) | ~33 % | 58,8 % | 41,2 % | 10,9 % | 53 % |

L'écrit **libre** produit surtout des fautes d'**accord et d'homophone** (mots valides : **72,5 %**), là où
la **dictée** produit des non-mots. Deux genres, deux profils — et c'est la couche **grammaire**, pas le
speller, qui porte l'écrit libre.

### Trouvaille produit, née de la mesure

Plusieurs corrections sont **hors de portée du moteur par construction** : `réveille`→*réveillée*,
`douche`→*douchée*, `aller`→*allée* — « je suis allé » est valide, le correcteur **ne peut pas deviner** que
la scriptrice est une femme. ≤4 % des formes erronées (mon estimateur surcompte). ⇒ **une préférence
utilisateur posée une seule fois** (« j'écris au masculin / au féminin ») les rendrait toutes atteignables.

### ✅ CHIFFRE DÉFINITIF — le moteur sur 67 productions dys réelles (4 459 mots)

| famille | palier | mélange (93 % sondes) | **texte dys RÉEL** |
|---|---|---|---|
| **orthographe** | **auto** | 91,5 % | **75,4 %** — 52 justes · **0 inutile** · 17 fausses |
| **orthographe** | flag | 69,8 % | **50,4 %** — 118 · 14 · 102 |
| accord pluriel du nom | auto | — | **92,3 % / 100 %** (pollué / propre) |
| a/à | auto | — | **100 % / 100 %** |
| majuscule | auto | — | **95,7 % / 100 %** |
| accord sujet-verbe | auto | — | 73,3 % / 80,0 % |
| −é/−er | auto | — | **58,8 % / 75,0 %** |
| accord participe | auto | — | **33,3 %** |
| genre déterminant | vigilance | — | **33,3 %** |

**Ce qui tient** : **zéro faux positif** en `auto` sur 4 459 mots de texte dys réel — la garde cardinale
du projet résiste là où ça compte. Et les règles qui portent le volume (**accord pluriel du nom**, **a/à**,
**majuscule**) sont entre **92 % et 100 %** : l'investissement grammaire est validé sur données réelles.

**Ce qui ne tient pas** : l'**orthographe** perd **16 points** (91,5 → 75,4 %) et le `flag` tombe à 50 %.
Et trois familles décrochent : **−é/−er 59 %**, **accord participe 33 %**, **genre déterminant 33 %**.
Ce sont désormais les cibles, mesurées sur la bonne population.

**Profil du gold produit** (4 459 mots) : **19,9 %** de mots fautifs · d=1 **68,7 %** · d≥2 **31,3 %** ·
1ʳᵉ lettre **11,4 %** (littérature : 10,9 %) · **59,1 %** d'erreurs en vrai mot (littérature : 53 %).
Il se rapproche nettement des repères publiés — bien plus que le mélange (5,4 % / 4,8 % / 31,2 %).

### ✅ CORPUS COMPLET (22/08/2026, fin de journée) — les 72 productions sont corrigées

Les 5 textes les plus dégradés, écartés dans un premier temps, ont été repris : le dialogue de 765 mots,
l'évaluation de géographie de 807 mots, les deux devoirs de 2ndePro et le texte adulte le plus abîmé.
**Aucun texte ne reste sans corrigé.** 14 tokens que je n'ai pas su trancher restent marqués `ambig` et
exclus des mesures — reprocher au moteur de savoir ce que l'annotateur ignore n'aurait pas de sens.

**Contrôle qualité** : les 95 mots « inconnus » restant dans le corrigé sont TOUS des noms propres, des
sigles ou des artefacts de tokenisation (`Harold` ×23, `France` ×13, `Aujourd`, `Bsen`) — aucune faute.

**Le pipeline sur le corpus COMPLET** (72 productions, 6 217 mots alignés) :

| | |
|---|---|
| mots faux au départ | **1 542** |
| **RÉPARÉS** | **398 — 25,8 %** |
| ratés | 1 144 |
| mots justes au départ | 4 675 |
| **⛔ CASSÉS** | **36 — 0,77 %** |

⚠️ **CHIFFRE CORRIGÉ le 22/08 — la première version (22,1 %) était FAUSSE, à cause de la sonde.**
`dys_pipeline_probe` tokenisait avec `[A-Za-zÀ-ÿœŒæÆ']+` alors que le moteur (`CP.toks`) inclut les
apostrophes **typographiques** `’ʼ`. Tout texte contenant « j’ai » décalait l'index, et **32 % des
corrections du speller (188 sur 584) étaient silencieusement abandonnées** — la grammaire travaillait
alors sur des tokens NON nettoyés. Après alignement du tokeniseur : **95,4 %** des corrections
appliquées, réparations **341 → 398**. Deux « casses » n'existaient que dans la sonde (`tres`→`tre` :
le speller corrige `tres`→`très` en AUTO bien avant la grammaire).
**Une sonde fausse est pire qu'une sonde absente** — c'est la troisième fois de la journée.

**Et le corpus converge maintenant avec la littérature**, ce qui valide l'annotation :

| | **notre gold (6 688 mots)** | Bodard 2020 |
|---|---|---|
| mots fautifs | **23,7 %** | 33 % |
| distance d'édition 1 | 63,7 % | 58,8 % |
| distance ≥2 | 36,3 % | 41,2 % |
| 1ʳᵉ lettre fausse | **11,2 %** | **10,9 %** |
| erreurs en vrai mot | **54,8 %** | **53 %** |

Les textes scolaires (corpus1) ont porté le taux de fautes de 19,9 % à 23,7 % : c'est le genre le plus dur,
et il manquait. Première lettre et erreurs en vrai mot tombent désormais **à un demi-point** des repères
publiés — le gold est représentatif, pas seulement volumineux.

### ~~Reste à faire~~ — PÉRIMÉ, conservé pour l'historique du protocole

> ⚠️ **Cette sous-section décrit l'état INTERMÉDIAIRE de l'annotation.** Elle est dépassée par
> « CORPUS COMPLET » ci-dessus : les **72 productions sont annotées** (6 778 mots), y compris les
> 5 textes écartés ici. Gardée parce qu'elle documente les critères d'exclusion appliqués en cours
> de route ; ne pas s'en servir pour un décompte.

**67 des 72** productions sont traitées : toute l'« Expression libre » (31), toute l'« Expression écrite
dirigée » (33) et **3 des 7 textes scolaires**.

**5 textes ÉCARTÉS, et c'est délibéré** — un gold douteux vaut moins que pas de gold :
- `texte4_h35` : trop dégradé pour être reconstruit honnêtement (« j'ai pris la distion de faire un daeu
  qu'il suis lidait resotie ») ;
- `corpus1/texte1_2ndepro` et `texte3_2ndepro` : écriture massivement phonétique **et** passages tronqués
  `[...]` dans la source ;
- `corpus1/texte2_terminale` (807 mots) et `texte7_3e` (765 mots) : reconstructibles mais longs, à faire
  avec le même soin — **prochaine session**.

3 tokens isolés restent **non tranchés** (`degne`, `soutie`, `pine`), laissés intacts et signalés (`ambig`)
plutôt que devinés.

## 5quater. Le moteur n'était pas DÉTERMINISTE — et c'est le classement des candidats, pas la sonde

**Symptôme.** `dys_pipeline_probe.py` rendait 380, 381, 384 ou 385 réparations d'une exécution à l'autre,
sur le même corpus et le même code. J'avais d'abord attribué cet écart à des variantes de garde
(« 381 contre 384 ») : **c'était du bruit, et je l'avais présenté comme un résultat.**

**Cause, à la ligne près.** `speller_probe.edits1` rendait un `set()`. Or le classement des candidats du
speller (`_cmp`) est *pairwise* — le commentaire du code le dit lui-même : les gardes de dominance
(« ≫20× plus fréquent écrase le bonus ») comparent **deux candidats entre eux**. Un tel comparateur
**n'est pas un ordre total** : A ≻ B, B ≻ C, C ≻ A est possible. Le résultat d'un tri dépend alors de
l'**ordre d'entrée** — qui, avec un ensemble, suit le hachage de Python.

**Mesuré** (gold dys, 4 graines de hachage) : **10 des 598 corrections changeaient**, y compris
l'existence même de la correction — `sété` → *fêté* ou rien, `croiyé` → *croisé* ou rien, `annes` →
*anges* ou *années*.

**Ce n'était PAS le produit livré.** Les moteurs JS (`sEdits1`) rendent `Object.keys` = l'ordre de
génération : ils sont déterministes. C'est la **référence Python** qui dérivait — et donc toutes nos
mesures, pas l'app ni l'extension.

**Correctif** : dict à ordre d'insertion au lieu d'un ensemble (mêmes boucles, `ALPHA` = 'a'..'z').
Python est stable sur 4 graines ; la sonde pipeline rend **381 / 24 sur trois passages identiques**.

**⚠️ Ce que le correctif ne fait PAS, vérifié plutôt que supposé.** J'avais écrit qu'il alignait Python
sur JS « par construction ». **Faux** : sur les 9 jetons concernés les deux moteurs divergent encore
(`annes` → *ânes* chez Python, *années* dans l'app ; `fise` → *filé* / *fisc*). La raison est ailleurs —
ils n'ont pas le **même ensemble de candidats** : Python lit `Lexique4.tsv` brut (**165 474** formes après
filtres) quand l'app embarque `speller-lex-gz` = Lexique 4 + Wiktionnaire (**214 685**). Effet mesuré de
cet écart sur le gold : **7 mots justes seulement** (`sœur`, `pyrénées`, `technopôle`, `littorales`,
`raisonnées`, `pnb`, `snk`) — réel, à documenter, mais il n'invalide pas le chiffre de référence.

**Dette laissée ouverte, nommée** : le comparateur reste **non transitif**. Le correctif rend le
résultat *reproductible*, il ne le rend pas *bien défini*. Rendre `_cmp` total (score au lieu de
comparaisons pairwise) est un chantier séparé, à mesurer — les gardes de dominance existent parce
qu'elles gagnent, on ne les retire pas sans preuve.

**Leçon, la cinquième du même genre** : ① le corpus était à 92,7 % des sondes ; ② juger les virgules
contre UD compte faux positive toute virgule facultative ; ③ juger le speller isolément lui reproche le
travail de la grammaire ; ④ la sonde pipeline abandonnait 32 % des corrections (tokeniseur) ; ⑤ **le
moteur de référence n'était pas déterministe**. À chaque fois, réparer l'instrument a immédiatement
révélé de vrais défauts.

## 5quinquies. « une **tré** faible exportation » → un — le posterior LEXICAL ne sait pas OÙ est le mot

**Trouvé en dépouillant les 24 casses du pipeline** (23/08). Deux d'entre elles, au palier **ROUGE**
(appliquées sans rien demander à l'utilisateur), et **présentes dans le produit livré** — vérifié en
chargeant `dys-core.js` avec ses assets, pas seulement dans la référence Python.

| | |
|---|---|
| `régio et a donc une **tré** faible exportation` | `une` → **un** (gold : *une*) |
| `le japon est une **tré** grande puisense` | `une` → **un** (gold : *une*) |

**Pourquoi.** `rule_det_gender` prend par défaut le mot **immédiatement après** le déterminant comme
nom-tête, et le valide au **posterior fréquentiel** `NOUN_POST`. Or `tré` **est un vrai mot français** —
0,038 par million — que la table donne masculin avec P(NOM) = 100 %. La règle a donc accordé `une` sur
`tré` au lieu d'`exportation` (féminin). Le mot correctement écrit, `très` (1 435/M, **37 000× plus
fréquent**), figure bien dans `DET_SKIP` et aurait été sauté ; `tré` n'y est pas.

**Ce n'est PAS une « ancre polluée » au sens courant** : l'ancre est un mot parfaitement connu du
lexique. C'est un troisième chemin qui confirme la mesure de la veille — une primitive d'ancre
**lexicale** globale n'aurait rien vu ici.

**Correctif : ajouter du CONTEXTE, ne baisser aucun seuil.** Le posterior est **lexical** : par
construction il ignore *où* le mot se trouve. Le **tagger HMM**, déjà embarqué dans les trois moteurs,
le sait. C'est la leçon LanguageTool appliquée telle quelle : *donner du contexte plutôt que baisser
un seuil*.

**⚠️ Première version FAUSSE SUR LE PRINCIPE, et c'est une garde du projet qui l'a dit.** J'avais
d'abord exigé que le nom-tête soit **tagué NOUN**. `dev.sh` est tombé sur `gender_coll_probe` :
**rappel 210 → 168**, 42 récupérations perdues. Motif limpide dans les ratés — `ajouté`, `analysé`,
`ajoute` sont tagués **VERB** alors que ce sont des noms au posterior : ma garde punissait les noms
MAL TAGUÉS, c'est-à-dire **exactement ce que le posterior avait été introduit pour rattraper**
(cf. « le POS embarqué est buggé : faute=VER au tag, 99 % NOM en fréquence »). Mauvaise sur le
principe, pas sur le seuil.

**Le vrai discriminant, mesuré en comparant les deux populations** :

| | tag du candidat | ce qui suit |
|---|---|---|
| casses (`une **tré** faible exportation`) | **ADJ** | `faible` ADJ · `exportation` **NOUN** |
| rappels perdus (`Il note une **analysé** ici`) | VERB | `ici` ADV |

⇒ on n'abstient que si le tagger dit « **modifieur** » **ET** désigne un **nom-tête plus à droite**
(NOUN dans les 2 jetons suivants). Vérifié exhaustivement sur les 386 mots de la sonde : rappel
**210 avec et sans la garde — coût nul**.

**Mesuré, 4 moteurs patchés (Python · app FR · app EN · extension)** :

| garde | valeur |
|---|---|
| pipeline dys réel | **381 réparés (INCHANGÉ) · casses 24 → 22** |
| batterie « genre déterminant » | 6/6, FP = 0 (inchangé) |
| `gender_coll_probe` (386 mots à clé partagée) | **rappel 210, identique avec et sans la garde** · FP 0 |
| FP à l'échelle (UD 2 500) | **1,40 % — strictement inchangé**, ventilation identique |
| parité app ↔ Python | OK (336 phrases) |
| parité extension ↔ Python | OK (296 phrases, paliers identiques sur 142 corrections) |

FP à l'échelle inchangé est **attendu** et non un non-résultat : sur du texte correct, tagger et
posterior s'accordent — la garde ne mord que là où le texte est abîmé. Le seul FP de batterie restant
est le connu, préexistant : « La foule impatiente attendait » (collectifs).

**⚠️ Ce qui a été écarté et pourquoi** : une garde de **fréquence** sur le nom-tête (« abstiens-toi si
le nom est 20× plus rare qu'une lecture voisine ») serait le décalque exact de la dominance du speller,
mais elle **n'est pas portable** — la couche grammaire de Python n'a qu'un ENSEMBLE de mots
(`cgram_words.json`), sans fréquences, quand les moteurs JS ont `SP.FREQ`. Elle aurait cassé la parité
ou exigé un nouvel asset. Le tagger était déjà là, dans les trois moteurs (doctrine §5).

## 5sexies. NOMS PROPRES — FERMÉ PAR LA MESURE (23/08), pas par l'absence de source

Le chantier était noté « aucune source locale ⇒ arbitrage licence ». **C'est faux, vérifié** : le dump
kaikki du Wiktionnaire français est dans le dépôt (`data_local/fr/kaikki-frwikt.jsonl`, 3,1 Go) — c'est
lui qui a produit `prenoms_genre.tsv` (8 729 prénoms, DÉJÀ embarqué et chargé par les 3 moteurs) et
`wikt_lex_fr.tsv`. Licence CC BY-SA réglée et citée, précédent déjà livré.

**Ce qui ferme le chantier, c'est le rapport coût/gain — mesuré :**

| | |
|---|---|
| entrées `pos=name`, ≥3 lettres, capitalisées | **134 002** |
| taille | 1 460 Ko brut · **539 Ko gzippés** |
| à embarquer dans | app FR **+** app EN **+** extension |
| gain | **3 casses sur 22** (`provence` ✓ `loire` ✓ `opel` ✓) |
| **non couvert** | `xbox` ✗ · `daeu` ✗ (et `microsoft` ✗) |

⇒ 539 Ko pour **13 %** des casses. Et le détail confirme l'intuition « trop large » : ce qui manque
est exactement la **queue marques/sigles**, non bornée, qu'aucune liste ne fermera. Risque en prime,
non mesuré : 134 000 noms propres en minuscules dans une garde d'abstention, c'est autant d'occasions
de **masquer un vrai typo** qui tomberait sur un toponyme.

**Variante consignée, NON recommandée aujourd'hui** : toponymes français seulement (communes, régions,
fleuves), sans marques ni international — quelques dizaines de Ko, **2 casses sur 22**.

⚠️ **Fermé par la MESURE. Si le sujet revient, l'argument est le coût/gain, pas « on n'a pas de liste ».**

## 6. Chantiers, remis dans l'ordre après cette revue

1. **Dominance ≫20× → comparaison en contexte** (reformulé ci-dessus). Le seul chantier restant dont on
   soit sûr qu'il porte du gain plutôt que du nettoyage.
2. ~~Trancher la question du corpus~~ **TRANCHÉ (§3bis)** : mélange à 92,7 % de sondes, 6 vraies dictées ;
   la forme des erreurs réelles converge avec la littérature ; `dys_gen.py` est bien calibré en densité.
   **Ce qui reste : obtenir du texte dys RÉEL** (validation terrain orthophonistes) — 335 mots, c'est peu.
3. **Remesurer « 77 % des FP ont un voisin abîmé »** sur texte réel. Repère externe désormais disponible :
   **72,3 %** (Bodard) — mais sur un corpus 5× plus fautif que le nôtre.
4. **Drapeau de provenance** : la pyramide efface l'origine du mot (`_Tc[f.i]=f.sugg`) ; aucune règle ne
   distingue un mot écrit d'un mot inventé par le speller.
5. Dettes anciennes : FP des collectifs, docstring non tenue de `rule_accord_sv_noun`, **premier essai
   terrain du complément Word**.

## Sources

- Bodard, J. (2020). *Spécificités des erreurs d'orthographe des personnes dyslexiques : analyse d'un corpus
  de productions écrites.* JEP-TALN-RÉCITAL 2020, vol. 3, p. 15-28.
  <https://jep-taln2020.loria.fr/wp-content/uploads/JEP-TALN-RECITAL-2020_paper_169.pdf>
  (cite Antoine et al. 2019 · Pedler 2007 · Rello et al. 2012 · Sitbon et al. 2007 · Bacquelé 2015)
- Pedler, J. *Computer Correction of Real-word Spelling Errors in Dyslexic Text.*
  <https://www.dcs.bbk.ac.uk/site/assets/files/1025/pedler.pdf>
- Rello, L. et al. *A Spellchecker for Dyslexia.* ASSETS 2015. <https://dl.acm.org/doi/10.1145/2700648.2809850>
- *Spelling errors made by people with dyslexia.* Language Resources and Evaluation.
  <https://link.springer.com/article/10.1007/s10579-022-09603-6>
- LanguageTool — *Adding n-gram data rules.* <https://dev.languagetool.org/adding-n-gram-data-rules.html>
