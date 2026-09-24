# CHANTIER SEO — faire CLIQUER, pas seulement apparaître

> Demande de Rem, 18/09/2026 : *« prépare un plan réfléchi pour optimiser les clics dans Google
> avec le SEO, c'est de pire en pire — je le ferai pas avant 15 jours »*.
>
> ⚠️ **Rien n'est à faire avant le 02/10/2026.** Le nom de site a changé le 17/09 et Rem a demandé
> le calme : on mesure ce changement-là d'abord. Toucher maintenant rendrait les deux effets
> inséparables. Ce document est le plan, pas un ordre de marche.

---

## 0. L'ÉTAT MESURÉ — Search Console, 3 mois (03/07 → 16/09/2026)

**Total : 44 clics · 815 impressions · CTR 5,4 % · position moyenne 11,1.**
La courbe monte en impressions (jusqu'à ~45/jour mi-septembre) et reste plate en clics (0-4/jour).
C'est exactement ce que Rem décrit : **on apparaît de plus en plus, on est cliqué pareil.**

### Les pages (triées par impressions)

| page | clics | impr. | CTR | position |
|---|---:|---:|---:|---:|
| `/` | 35 | 420 | 8,3 % | 4,2 |
| `/en/docs/rapport-mode-emploi` | **0** | 102 | 0 % | 13,1 |
| `/pendable` | 6 | 99 | 6,1 % | 13,9 |
| `/docs/rapport-mode-emploi` | **0** | 87 | 0 % | **3,8** |
| `/recherche` | **0** | 77 | 0 % | **3,2** |
| `/docs/MEMOIRE` | **0** | 61 | 0 % | **2,9** |
| `/correcteur` | 1 | 54 | **1,9 %** | **3,9** |
| `/saisie-vocale` | **0** | 51 | 0 % | 17,2 |
| `/en/` | 1 | 41 | 2,4 % | 8,4 |
| `/en/recherche` | **0** | 38 | 0 % | 6,9 |

*(Les lignes ne s'additionnent pas au total : Search Console déduplique par propriété d'un côté,
par page de l'autre. On lit chaque ligne pour elle-même, jamais la somme.)*

### Les requêtes visibles (19 au total ; le reste est anonymisé par Google)

| requête | clics | impr. | CTR | position |
|---|---:|---:|---:|---:|
| solveur pendu | 2 | 92 | 2,2 % | **6,0** |
| triche pendu | 0 | 20 | 0 % | **5,8** |
| solveur de pendu | 0 | 15 | 0 % | **4,7** |
| pendu triche | 0 | 13 | 0 % | **5,3** |
| saisie audio | 0 | 7 | 0 % | 64,1 |
| pendu en ligne | 0 | 7 | 0 % | 73,4 |
| saisie vocale | 0 | 6 | 0 % | 47,5 |

**Indexation : 32 pages indexées.** Ce n'est pas un problème d'indexation.

---


## 0 bis. RELEVÉ DE RÉFÉRENCE — lu le 24/09/2026 (J-0 du BLOC 1)

C'est la **ligne de base** annoncée au calendrier : tout ce qui suit se lira contre elle.
Search Console, **03/07 → 21/09/2026** (Google a deux à trois jours de retard).

**Total : 46 clics · 889 impressions · CTR 5,2 % · position moyenne 10,5.**

Contre le relevé du plan (03/07 → 16/09 : 44 · 815 · 5,4 % · 11,1) : **+74 impressions,
+2 clics, et le CTR qui BAISSE encore**. Cinq jours de plus n'ont pas infléchi la courbe —
c'est exactement le constat qui a ouvert ce chantier, et il tient.

| page | clics | impr. |
|---|---:|---:|
| `/` | 36 | 457 |
| `/pendable` | 6 | 112 |
| `/correcteur-outil` | 2 | 46 |
| `/correcteur` | 1 | 61 |
| `/en/` | 1 | 44 |
| `/dictee` | 1 | 22 |
| `/scrabidon` | 1 | 8 |
| `/docs/rapport-mode-emploi` | **0** | **116** |
| `/en/docs/rapport-mode-emploi` | **0** | **108** |
| `/recherche` | **0** | **100** |

*(39 pages au total ; les dix premières sont triées par clics. Les lignes ne s'additionnent
pas au total — Search Console déduplique par propriété d'un côté, par page de l'autre.)*

| requête | clics | impr. |
|---|---:|---:|
| solveur pendu | **2** | 95 |
| triche pendu | 0 | 20 |
| solveur de pendu | 0 | 15 |
| pendu triche | 0 | 13 |
| saisie audio | 0 | 7 |
| pendu en ligne | 0 | 7 |
| saisie vocale | 0 | 6 |
| jeux de mots double sens | 0 | 3 |
| omega crypt | 0 | 3 |
| jeux de mots à double sens | 0 | 2 |

*(20 requêtes visibles ; le reste est anonymisé par Google. **Une seule requête apporte des
clics**, et c'est « solveur pendu » — 2 clics sur 95 impressions, soit 2,1 %.)*

### ✅ La condition de départ est VÉRIFIÉE — les robots sont repassés

Rem : « les bots sont passés ». Contrôlé dans le rapport d'indexation, pas cru sur parole :
le motif **« Détectée, actuellement non indexée » est à 0, validation « Réussi »** — c'était
lui qui retenait 4 pages le 14/09 (« le robot n'est pas repassé »). **33 pages dans l'index.**
La fenêtre de calme du 17/09 a donc fait son travail : le BLOC 1 peut partir.

### ⚠️ Deux entrées parasites dans les sitemaps — décision de Rem

Le rapport Sitemaps en liste trois, dont deux qui n'auraient jamais dû y être :

| entrée | état | quoi |
|---|---|---|
| `/sitemap.xml` | ✅ lu le 17/09, 34 pages | le vrai |
| `/correcteu/sitemap.xml` | ❌ « Impossible de récupérer » | **faute de frappe** (`correcteu`), envoyée le 12/07 |
| `/correcteur` | ❌ « 1 erreur » | une **page** envoyée comme sitemap, le 04/07 |

Elles ne coûtent aucun classement : Google ignore ce qu'il ne peut pas lire. Mais elles
salissent le rapport, et l'une d'elles est réessayée (dernière lecture : 21/09). Les retirer
est une action **dans la console** : c'est à Rem, je ne touche pas à la propriété.

### ⚠️ Pourquoi le BLOC 2 NE PART PAS avec le BLOC 1

Le travail préparé le 19/09 mélangeait les deux dans un seul commit. Séparés ici, et voici
le chiffre qui l'impose : `/docs/rapport-mode-emploi` (116), `/en/docs/rapport-mode-emploi`
(108) et `/recherche` (100) font **324 impressions pour zéro clic** — 36 % de tout ce que le
site reçoit. Les passer en `noindex` ferait mécaniquement monter le CTR du site de **5,2 %**
à **8,1 %** (46 ÷ 565) **sans un seul clic de plus**.

Livrés ensemble, on lirait ce bond et on en créditerait les titres. On mesurerait une
soustraction en croyant mesurer une amélioration. Le BLOC 2 part donc plus tard, seul, et
sa réussite se lira sur les **clics** et sur le CTR **des pages produit**, jamais sur la
moyenne du site.

## 1. DIAGNOSTIC — six constats, par impact mesuré

### ① Google RÉÉCRIT nos titres, et le mot cherché disparaît de la ligne bleue

Mesuré en lisant la vraie page de résultats (`site:omegapendu.com`) :

| page | notre `<title>` | ce que Google AFFICHE |
|---|---|---|
| `/correcteur` | Correcteur dyslexie gratuit & hors-ligne — qui ne corrige jamais à tort (88 car.) | **« Un correcteur qui ne te corrige jamais à tort. »** — c'est le H1 |
| `/recherche` | Linguistique française & traitement du langage — modèle double route, dyslexie (93) | **« modèle double route, dyslexie \| OMEGA-Ω »** — un bout, qui commence en minuscule |
| `/evolution` | Évolution d'un solveur de pendu — un collectif qui se copie, communique… (99) | **« Un collectif qui se copie, communique, et évolue. »** |
| `/en/` | (long) | **« reasons instead of reading the answer \| OMEGA-Ω »** — milieu de phrase |

Sur `/correcteur` — **position 3,9, CTR 1,9 %** — la ligne bleue ne contient ni « dyslexie », ni
« gratuit », ni « correcteur d'orthographe ». Quelqu'un qui balaie la page de résultats ne voit
aucun mot de sa recherche. C'est la cause la plus directe, et la moins chère à réparer.

**Le mécanisme** : nos titres font 77 à 99 caractères — Google en affiche environ 60. Quand le
titre est trop long, en trois morceaux (`A — B | C`) et écrit comme un slogan, Google va chercher
ailleurs (le H1, un intertitre) ce qu'il juge plus représentatif. Nos H1 sont eux aussi des
slogans (« Un correcteur d'écriture pour la dyslexie — qui cherche à ne jamais souligner un mot
juste. », 95 caractères sur l'accueil).

### ② 225 impressions, 0 clic, en position 3 — sur nos documents INTERNES

`/docs/rapport-mode-emploi` (3,8), `/recherche` (3,2), `/docs/MEMOIRE` (2,9) : trois pages de
rapport, très bien classées, **jamais cliquées en deux mois et demi**. Plus `/en/docs/…`
(102 impressions, 0 clic).

Deux conséquences, pas une :
- elles écrasent le CTR moyen du site (5,4 %) — c'est le signal que Google lit ;
- elles disent à Google **de quoi ce site parle** : de la documentation, pas d'un outil.

### ③ La famille « pendu » est la seule qui a du volume — et notre produit refuse son mot-clé

140 impressions sur *solveur pendu · solveur de pendu · triche pendu · pendu triche*, en
**position 4,7 à 6,0** (page 1), pour **2 clics**. Sur la vraie page de résultats « solveur pendu » :

- un **Aperçu IA** répond en haut (« Comment utiliser un solveur de pendu ? »), en citant dCode ;
- les concurrents titrent exactement l'intention : *« Solveur du Jeu Pendu — Solution/Triche en
  Ligne »* (dCode), *« Solveur de Pendu en ligne (Aide & Triche) »* (TrouveMot) ;
- nous titrons l'accueil *« OMEGA Pendu — correcteur dys, dictée, saisie vocale et jeu du pendu »* :
  le mot cherché arrive en 9ᵉ position du titre, derrière trois produits qui ne sont pas l'objet
  de la recherche.

⚠️ **Conflit à trancher, pas à contourner** : deux de ces quatre requêtes contiennent « triche »,
et OMEGA est *cheat-free* par construction — c'est un choix documenté du moteur. On peut
honnêtement répondre à l'intention (« il devine, il ne triche pas ») ; on ne peut pas promettre la
triche. Tant que ce n'est pas tranché, ces 33 impressions ne se convertiront pas.

### ④ Sur « correcteur dyslexie », la page 1 n'est pas faite de produits, mais de LISTES

Relevé sur `correcteur orthographe dyslexie gratuit` : poppins.io, AAD France, Glaaster
(« 19 Logiciels Dyslexie »), Antidote, Reverso, Dyslogiciel, dysclick.fr (« Les Meilleurs
Correcteurs… pour DYS »), Merci App, Académie d'Amiens. **Neuf résultats, presque tous des
comparatifs ou des pages institutionnelles.** Aucun n'est un correcteur qu'on utilise sur place.

Conclusion mesurée : sur cette requête, du code ne nous fera pas entrer. **Y entrer, c'est être
CITÉ dans ces listes.** C'est un travail hors-site, pas un travail de balises.

### ⑤ Aucune de nos pages produit n'a UNE SEULE requête nommable

Mesuré en filtrant le rapport page par page (`&page=!https://omegapendu.com/…`) :

| page filtrée | impressions | position | requêtes nommées par Google |
|---|---:|---:|---|
| `/correcteur` | 54 | 3,9 | **aucune** |
| `/recherche` | 77 | 3,2 | **aucune** |
| `/docs/rapport-mode-emploi` | 87 | 3,8 | **aucune** |

« Aucune donnée » ne veut pas dire zéro requête : Search Console **masque** les requêtes trop
rares. Ces pages sont donc trouvées par une longue traîne de formulations vues une ou deux fois,
jamais par une requête qui revient. Les 19 requêtes nommées du site (≈ 180 impressions) sont
presque toutes accrochées à l'**accueil**.

Trois conséquences, et c'est le constat le plus lourd du document :
- **Google ne sait pas de quoi ce site est l'outil.** 815 impressions éparpillées sur des centaines
  de formulations uniques, c'est la signature d'un site qu'on croise, pas d'un site qu'on cherche.
- Ça explique le CTR de `/correcteur` (1,9 % en position 3,9) mieux que le titre seul : chaque
  impression est une recherche DIFFÉRENTE et très précise, qu'aucun titre générique ne peut viser
  toutes.
- **Le Lot A reste juste, mais son gain est incertain sur cette page** : mettre les mots de tête
  (« correcteur », « dyslexie », « gratuit ») dans la ligne bleue est le meilleur pari, parce que
  la tête est ce que la plupart des variantes longues contiennent — mais ça se vérifiera à la
  mesure, pas à la logique. À dire tel quel dans le relevé de J+28.

### ⑥ Le plafond arithmétique — à dire avant de dépenser du temps

815 impressions par trimestre. Même en portant chaque page à un très bon CTR, le plafond est de
l'ordre de **80 à 120 clics par trimestre** au lieu de 44. C'est un gain réel, mais **la croissance
ne viendra pas du CTR** : elle viendra d'apparaître sur des requêtes qui existent. Le plan tient
donc deux voies séparées, et les mesure séparément.

---

## 2. LE PLAN — cinq lots, un à la fois

### VOIE 1 — rendre cliquable ce qui est déjà affiché (plafond ×2-3, risque faible)

#### Lot A — des titres que Google gardera *(le premier, le moins cher)*

Règle, appliquée à toutes les pages du sitemap :
- `<title>` **≤ 60 caractères**, le mot cherché **en premier**, la marque à la fin ou absente ;
- le **H1 dit la même chose que le titre** — sinon Google préfère le H1, c'est le mécanisme mesuré ;
- `meta description` **110-155 caractères** (aujourd'hui : 136 à 263 ; tout ce qui dépasse 155 est
  invisible), une phrase qui dit ce qu'on FAIT sur la page, pas ce que le produit EST.

Propositions — le principe compte plus que les mots :

| page | aujourd'hui | proposé |
|---|---:|---|
| `/correcteur` | 88 | `Correcteur dyslexie gratuit et hors-ligne \| OMEGA` (48) |
| `/correcteur-outil` | 85 | `Correcteur dys en ligne, plein écran \| OMEGA` (43) |
| `/dictee` | 77 | `Dictée dys en ligne, lue à voix haute \| OMEGA` (44) |
| `/pendable` | 83 | `Jeu du pendu en ligne, gratuit et sans pub \| OMEGA` (49) |
| `/recherche` | 93 | `Dyslexie et double route : ce qu'on a mesuré \| OMEGA` (51) |
| `/` | 79 | `Correcteur dys gratuit et hors-ligne \| OMEGA Pendu` (50) |

**Garde à poser dans le même lot** — sinon ça dérive en trois semaines : étendre
`dictee/sitemap_probe.js` — échec si un `<title>` dépasse 60 caractères, si une `description` sort
de 110-155, ou si le H1 d'une page produit ne reprend aucun mot de son titre.
Falsification : rallonger un titre d'un caractère au-dessus du seuil doit faire rougir la sonde.

**Mesure** : CTR de `/correcteur`, `/correcteur-outil`, `/dictee`, `/pendable` à J+28, comparé aux
28 jours précédents. Le succès est **le clic**, pas l'impression.

#### Lot B — sortir de l'index ce qui ne peut pas être cliqué

`/docs/rapport-mode-emploi`, `/docs/MEMOIRE`, `/en/docs/rapport-mode-emploi` : **`noindex`**, et
retrait du sitemap dans le même commit — la sonde sitemap exige déjà cette cohérence (une page
déclarée ne doit pas porter `noindex`). Elles restent en ligne et accessibles par leurs liens : on
cesse seulement de les proposer à des gens qui ne les cliquent jamais.

`/recherche` : **à ne PAS mettre en noindex**, et à ne pas alléger non plus — voir l'encadré qui
lui est consacré au §2 bis. Elle relève du seul Lot A (titre, H1, description). Sa question ouverte
reste : quelle recherche l'amène en position 3,2 ? Mesuré le 19/09, Google n'en nomme AUCUNE.

⚠️ **Effet attendu, à annoncer AVANT de mesurer** : les impressions vont BAISSER (environ −225) et
le CTR moyen va monter. Une baisse d'impressions n'est donc pas une régression ici ; si on oublie
de le dire, on lira le tableau à l'envers dans un mois.

#### Lot C — la famille pendu, honnêtement

1. **Trancher le mot « triche »** (décision de Rem, pas la mienne) : soit une page qui répond à
   l'intention sans mentir — *« Solveur de pendu : il devine, il ne triche pas »*, avec le solveur
   réellement utilisable en haut de page — soit on laisse ces requêtes partir.
2. `/pendable` est en **position 13,9** avec 99 impressions : c'est la seule page où gagner des
   places vaut plus que gagner du CTR. Passer de 14 à 8 doublerait ses impressions utiles.
3. Le **solveur** doit être en haut de page, utilisable en trois secondes, sans explication
   préalable : c'est ce que font dCode et TrouveMot, et c'est ce que l'Aperçu IA ne peut pas faire
   à leur place.

### VOIE 2 — apparaître sur des requêtes qui existent (le vrai levier, plus lent)

#### Lot D — ouvrir un espace de requêtes, mesuré avant d'écrire

*C'est ce lot que le constat ⑤ rend prioritaire : tant qu'aucune page n'est trouvée par une
requête qui REVIENT, le site n'a pas d'adresse dans Google, seulement des rencontres.*

Les « Recherches associées » relevées sur les deux pages de résultats donnent des intentions
RÉELLES, observées, qu'aucune de nos pages ne sert :

| espace « dys » | espace « pendu » |
|---|---|
| Correcteur d'orthographe pour dyslexique gratuit | Mot difficile pendu 10 lettres |
| Transformer un texte pour dyslexique en ligne | Mot difficile pendu 15 lettres |
| Logiciel dyslexie texte couleur | Aide pendu |
| Logiciel dyslexie adulte | Jeux de mots pendu |

Deux de ces intentions sont **exactement** ce que le moteur sait faire, et qu'aucune page ne dit :
- *« transformer un texte pour dyslexique en ligne »* → la police dys, les syllabes en couleur, la
  police de son : tout existe, aucune page ne le dit avec ces mots-là ;
- *« mot difficile pendu 10 / 15 lettres »* → notre lexique et notre moteur répondent directement.
  C'est une page-outil, pas un article.

**Méthode, avant d'écrire une ligne** : pour chaque intention candidate, relever la page de
résultats réelle — qui est là, est-ce une liste ou un outil, y a-t-il un Aperçu IA qui mange la
réponse — et ne garder que celles où **un outil** est ce que Google montre. Une page écrite pour
une requête où Google ne montre que des comparatifs est du temps perdu : c'est le constat ④.

#### ✅ Relevé fait le 19/09 — trois intentions sur quatre sont ouvertes

| intention | ce que Google montre en page 1 | verdict |
|---|---|---|
| **transformer un texte pour dyslexique en ligne** | **#1 LireCouleur (un OUTIL)**, Coloritext (un OUTIL), BlogPéda, Académie de Lyon, un « Top 10 » dysclick. Aperçu IA qui nomme LireCouleur, Coloritext, Cantoo Scribe | **OUVERTE** — les outils y rangent |
| **logiciel dyslexie texte couleur** | **#1 LireCouleur, #2 Coloritext**, Colorization, Dys-Vocal, Éducation nationale (Primàbord), académies | **OUVERTE, encore plus nettement** |
| **mot difficile pendu 10 lettres** | mot-pendu.com, jeudupendu.com (« 10 000 mots durs par nombre de lettres »), idees-gages, le-jeu-du-pendu, Reddit, un *gist* GitHub — **que des listes de mots** | **OUVERTE, et la concurrence est mince** |
| correcteur orthographe dyslexie gratuit | comparatifs tiers uniquement | **FERMÉE** (constat ④) |

#### 🎯 Et le plus important : **le produit existe déjà, la page manque**

Ce que font LireCouleur et Coloritext, qui occupent les deux premières places : *colorer les
syllabes, colorer les phonèmes, griser les lettres muettes, élargir les espacements.*

**C'est exactement la police de son et le découpage en syllabes d'OMEGA** — déjà écrits, déjà
mesurés, déjà en ligne dans le correcteur, l'extension et la page anglaise. Et la **police OMEGA
Dys** est téléchargeable sur `/donnees` — la page que Rem a tenu à garder au menu le 18/09.

Le trou n'est donc pas un trou de produit, c'est un trou de FORMULATION : `/donnees` s'annonce
« Lexiques français ouverts & POS-tagger » (pour développeurs), et la police de son est une
*option* à l'intérieur du correcteur. **Aucune page ne dit : « colle ton texte, il ressort avec les
syllabes en couleur et les lettres muettes grisées ».**

C'est la page la plus prometteuse à écrire de tout ce document : la demande est démontrée, les
outils y rangent, et il n'y a rien à construire — seulement à nommer.

⚠️ **Sur « mot difficile pendu N lettres »** : la famille entière existe (4, 5, 7, 10, 12, 15, 20,
30 lettres, vu dans les recherches associées). Tentation : huit pages gabarit. **Non** — ce serait
exactement la page-passerelle mince que Google sanctionne, et le contraire de ce que dit le §4.
**Une seule page-outil** avec un choix de longueur, adossée à notre lexique (705 653 formes, le
meilleur de cette page de résultats).

#### Lot E — hors-site : être dans les listes *(le seul levier qui déplace vraiment la voie 2)*

Les pages qui occupent la page 1 sur « correcteur dyslexie » sont des comparatifs tenus par des
tiers : dysclick.fr, poppins.io, glaaster.com, merci-app, et des pages d'académies. **Un outil
gratuit, open source, sans compte et sans traqueur est exactement ce qu'ils citent.** Ce n'est pas
du code : c'est écrire à ces sites, et se rendre visible là où les familles et les orthophonistes
cherchent (associations dys, forums, groupes d'enseignants).

⚠️ Rien de tout cela ne part sans Rem : c'est son nom, son projet, son ton. Je peux préparer les
textes, pas les envoyer.

---

## 2 bis. ÉPURER LE SITE — question de Rem, 19/09/2026

> *« peut-être épurer un peu le site ? »*

L'instinct est juste, et il répond au constat ⑤ : **un site qui offre douze choses n'est l'outil
de rien.** Mais « épurer » recouvre trois gestes de risque très différent, et un quatrième qu'il
ne faut pas faire. Mesuré : poids réel en mots (scripts exclus) contre clics sur 3 mois.

| page | mots | clics | ce que j'en fais |
|---|---:|---:|---|
| `/recherche` | **5 091** | **0** | **on n'y touche pas** — voir l'encadré dédié |
| `/arbitrage` | 1 222 | 0 | laisser — atteignable depuis Recherche seulement |
| `/correcteur` | 1 198 | 1 | **fusionner** avec `/correcteur-outil` |
| `/index` | 1 071 | **35** | ne pas casser : c'est 80 % des clics du site |
| `/dictee` | 1 004 | 1 | **fusionner** avec `/dictee-outil` |
| `/confidentialite` | 838 | 0 | laisser — page légale, 0 clic est normal |
| `/evolution` | 789 | 0 | laisser |
| `/donnees` | 648 | 0 | laisser — tranché par Rem le 18/09 |
| `/omega-key` | 544 | 0 | laisser |
| `/correcteur-outil` | 440 | 2 | **fusionner** |
| `/dictee-outil` | 299 | 1 | **fusionner** |
| `/pendable` | 271 | **6** | laisser — 2ᵉ poste de clics du site |
| `/toile` | **72** | 0 | **noindex** (niveau 1) |

### Niveau 1 — épurer ce que GOOGLE voit (aucun effet sur les visiteurs)

C'est le Lot B, plus une page qu'on n'avait pas regardée : **`/toile`** — 72 mots, aucune
`meta description`, un titre de 31 caractères, 0 clic. ⚠️ Elle n'est PAS orpheline : c'est la vue
**plein écran** d'une figure déjà intégrée en `iframe` dans `/recherche` (section « La toile du
correcteur »). Elle n'a donc pas de contenu propre, et `/recherche` est sa vraie adresse — mais elle
est déclarée au sitemap comme une page à part entière.

Et c'est un MOTIF, pas un cas isolé : **une vue plein écran d'un contenu qui vit ailleurs ne doit
pas être indexée séparément.** Le motif couvre `/toile` — et c'est exactement le même argument que
la fusion de `/correcteur-outil` au niveau 2, qui est lui aussi un plein-écran d'une `iframe`.

### Niveau 2 — fusionner les doublons *(le geste le plus fort, et le plus structurel)*

**Mesuré : il y a trois URL pour une seule application.** `/correcteur` (page d'explication,
1 198 mots), `/correcteur-outil` (102 lignes : une `iframe` vers `app/omega-pendu.html`, plus le
menu), et l'application elle-même. Idem pour la dictée. Conséquences lues dans la Search Console :

- les deux pages se partagent le signal — `/correcteur` 54 impressions en position 3,9 et
  `/correcteur-outil` 34 en position 4,1, sur le même sujet ;
- **celle que Google classe le mieux est celle qu'on LIT, pas celle dont on SE SERT.**

Proposition : **une seule URL par outil** — `/correcteur` — avec **l'outil en haut**, utilisable
tout de suite, et l'explication en dessous pour qui veut. `/correcteur-outil` redirige (301) vers
elle. Pareil pour `/dictee`. On passe de 4 URL à 2 (8 à 4 avec `/en/`).

C'est aussi ce que font les sites qui gagnent sur « solveur pendu » : l'outil d'abord (constat ③).

⚠️ **Une redirection 301 fait osciller le classement quelques semaines.** Ce lot se fait SEUL, et
il se mesure sur le clic à 28 jours, pas sur la position à 3 jours.

### Niveau 3 — alléger les PAGES PRODUIT *(bon pour les dys ET pour Google)*

`/correcteur` fait **1 198 mots en 6 sections d'argumentation**, alors que son rôle est de faire
ESSAYER. Sur un site dont les visiteurs sont dyslexiques, la longueur n'est pas un détail
esthétique : c'est une barrière.

Cible raisonnable : **500 à 700 mots** par page PRODUIT, l'essentiel au-dessus de la ligne de
flottaison, le reste replié.

### ⚠️ `/recherche` — CE QU'IL NE FAUT PAS EN FAIRE (correction du 19/09)

**J'avais rangé `/recherche` parmi les pages « à alléger ». C'était une erreur de catégorie, et je
la corrige ici plutôt que de la laisser traîner dans un plan.**

Ses 13 sections — la doctrine « mesurer ou rejeter », le pendu comme banc d'essai, la double route
phono↔ortho, la police qui encode le son, **« Ce qu'on a essayé… et rejeté »** — ne sont pas du
remplissage : c'est la colonne vertébrale du projet, et la seule page qui montre que le travail est
réel. La cible « 500-700 mots » s'applique aux pages PRODUIT ; `/recherche` n'en est pas une.

**Son 0 clic n'est pas un échec.** Cette page n'est pas là pour capter du clic, elle est là pour
que celui qui arrive voie sur quoi c'est bâti. La juger au clic serait exactement l'erreur que ce
document reproche au reste : confondre l'indicateur d'une chose avec sa valeur.

Ce qui la concerne vraiment, et c'est tout :
1. **Lot A** — son titre affiché par Google est « modèle double route, dyslexie | OMEGA-Ω », un bout
   de phrase qui commence en minuscule (le `<title>` fait 88 caractères, le H1 « Une architecture
   cognitive de la double route. » ne reprend aucun de ses mots). Un titre court + un H1 qui lui
   répond, et la ligne bleue redevient lisible. **Aucun mot du contenu n'est touché.**
2. **Une PORTE, pas une coupe** — 5 091 mots sans sommaire, pour un lecteur dys, ce n'est pas trop
   long : c'est sans prise. Une entrée de trois lignes en haut (« ce que tu vas trouver ») et un
   sommaire cliquable des 13 sections donnent des points d'appui. **Ça ajoute, ça ne retire rien.**

⛔ Pas de `noindex`, pas de découpe en plusieurs pages, pas de suppression de sections.

### L'ACCUEIL — tri proposé par Rem le 19/09, et mon avis

> Rem : *« dans index je ne mettrais que le correcteur, la dictée, saisie vocale, poser un calcul,
> le pendu, Pendable et données et police, et c'est tout »*.

⚠️ **C'est la page la plus risquée du site à toucher** : 420 impressions, **35 des 44 clics**,
position 4,2. Elle se modifie SEULE, et on mesure avant d'enchaîner.

Ce qu'elle contient aujourd'hui, mesuré : un héros de 107 mots avec **trois** boutons (« Ouvrir le
correcteur », « Voir le pendu jouer », « Jouer au pendu »), puis une liste dite « six outils »
— correcteur, dictée, saisie vocale, **Pendable**, poser un calcul, **Double-Sens** — puis quatre
sections de récit (l'idée, le pendu mesuré, le mode d'emploi, pourquoi c'est rare) et une dernière
qui renvoie vers `/evolution` et `/omega-key`. Ni Scrabidon ni Données n'y figurent.

| l'outil | aujourd'hui sur l'accueil | Rem propose | mon avis |
|---|---|---|---|
| Le correcteur | oui | garder | **oui** — c'est la promesse du site |
| La dictée | oui | garder | **oui** |
| Saisie vocale | oui | garder | **oui** |
| Poser un calcul | oui | garder | **oui** — seule réponse dyscalculie du site |
| Pendable | oui | garder | **oui** — 6 clics, 2ᵉ page du site |
| Double-Sens | oui | **retirer** | **d'accord** — 129 mots, 0 clic, et la règle du jeu ne tient pas en une ligne. Il reste au menu |
| Données & police dys | non | **ajouter** | **oui, mais à part** — ce n'est pas un outil pour qui écrit mal, c'est pour les profs, orthophonistes et développeurs. Une ligne, plus bas, pas dans le même bloc |
| « Le pendu » (le moteur) | oui, 2 boutons dans le héros | garder | **c'est mon seul désaccord** — voir ci-dessous |

> ✅ **TRANCHÉ par Rem le 19/09 : « ok pas le pendu ».** La liste de l'accueil est donc arrêtée —
> **le correcteur · la dictée · la saisie vocale · poser un calcul · Pendable**, puis **Données &
> police dys** à part, plus bas. Double-Sens et Scrabidon restent au menu, pas sur l'accueil. Le
> moteur du pendu n'est plus un produit de l'accueil : il redescend dans le récit.
>
> Conséquence dans le HÉROS, par cohérence : « ▶️ Voir le pendu jouer » est exactement la démo du
> moteur — elle rejoint la section « Le pendu, mesuré ». Le héros garde **« ✍️ Ouvrir le
> correcteur »** en action principale et **« 🎯 Jouer au pendu »** (Pendable) en second rang.

**Le désaccord qui l'a motivé : deux entrées « pendu » en haut de page.** Le héros propose déjà « Voir le pendu
jouer » ET « Jouer au pendu », et la liste ajoute Pendable. Or c'est exactement là que se joue le
constat ⑤ : le visiteur qui arrive de *solveur pendu* (position 6, CTR 2,2 %) veut jouer ou
résoudre, et celui qui arrive de *correcteur dyslexie* ne comprend pas pourquoi un site
d'orthographe s'ouvre sur un jeu. **Deux publics, deux promesses, dans le même écran.**

Ma proposition : **une seule entrée jeu dans la liste — Pendable** ; le moteur du pendu reste sur
la page, mais dans la section de récit « Le pendu, mesuré », là où il explique d'où vient le
correcteur. C'est sa place : il est la PREUVE, pas le produit.

**Et un héros = une action.** Trois boutons qui partent dans trois directions, c'est la page elle-même
qui hésite. Un bouton principal (« Ouvrir le correcteur »), les autres en second rang.

### ⛔ Ce que « épurer » ne doit PAS vouloir dire

Supprimer ce qui n'a pas encore marché. Scrabidon, Double-Sens, Poser un calcul, Saisie vocale,
OMEGA·KEY font 0 clic sur trois mois — **et ce n'est pas une raison de les retirer** : ils ne
coûtent aucun clic aux autres, le menu tient en trois groupes, et un outil sans visiteurs n'est pas
un outil raté, c'est un outil pas encore trouvé. Le 18/09, la page Données est sortie du menu par
un raisonnement de ce genre, et Rem a eu raison de le refuser.

**La règle : on épure ce que GOOGLE voit en trop, et la LONGUEUR de ce qu'on donne à lire. On ne
retire pas un outil du site.**

---

## 3. CALENDRIER ET MÉTHODE

### ⚠️ D'abord, une correction de ce plan par la mesure

J'avais écrit « un lot à la fois, 28 jours entre deux ». **À ce volume, c'est faux pour presque
toutes les pages.** Impressions reçues en 28 jours, et clics qu'on obtiendrait à un très bon CTR
de 8 % :

| page | impressions / 28 j | clics attendus à 8 % | mesurable en un mois ? |
|---|---:|---:|---|
| `/` | **153** | 12,2 | **oui** |
| `/pendable` | 36 | 2,9 | à peine |
| `/recherche` | 28 | 2,2 | non |
| `/correcteur` | **20** | 1,6 | **non** — on ne distingue pas 1 clic de 2 |
| `/correcteur-outil` | 12 | 1,0 | non |
| `/dictee` | **5** | 0,4 | non |

**Seul l'accueil a de quoi se juger en un mois.** Découper le reste en lots de 28 jours ne
mesurerait rien : ce serait un rituel, pas une méthode. La règle corrigée :

- **on groupe les changements qui servent UNE SEULE hypothèse**, même s'ils touchent plusieurs
  pages — c'est l'hypothèse qu'on teste, pas le fichier ;
- **on mesure l'accueil à 28 jours** (il a le volume) et **le reste au trimestre** ;
- pour les pages sans volume, on assume : le changement se justifie par la RAISON (un titre coupé
  en plein milieu est mauvais, même sans chiffre pour le prouver), et on le dit.

### Le calendrier

| quand | bloc | ce qu'on en attend, et comment on le lit |
|---|---|---|
| ~~jusqu'au 02/10~~ **24/09** | rien | fenêtre de mesure du nom de site du 17/09 ; calme demandé par Rem. **Close le 24/09** : Rem constate que les robots sont repassés, vérifié au rapport d'indexation (§0 bis) |
| ~~02/10~~ **24/09 — FAIT** | **relevé de référence** (§0 bis) | clics, impressions, CTR, position — par page ET par requête. C'est la ligne de base de tout le reste |
| ~~02/10~~ **24/09** | **BLOC 1 — « le site dit ce qu'il est »** : accueil épuré (liste arrêtée le 19/09, héros à une action) + titres/H1/descriptions de toutes les pages + la garde de seuils | lu sur l'**accueil à J+28** (153 impressions, ~12 clics attendus : un écart se verra) ; sur les autres pages, au trimestre |
| **~30/10** | **BLOC 2 — niveau 1** : `noindex` des docs et de `/toile`, retrait du sitemap | ⚠️ les impressions BAISSENT d'environ 250, c'est l'effet voulu. Ce qu'on regarde : le CTR moyen du site monte, et les clics ne baissent pas |
| **~27/11** | **BLOC 3 — fusion des doublons** : `/correcteur-outil` → `/correcteur` (l'outil en haut), idem dictée, 301 | une 301 fait osciller le classement quelques semaines : lecture au **trimestre**, jamais à trois jours |
| **sans horloge** | **Lot D** (mesurer les SERP avant d'écrire) et **Lot E** (hors-site) | ce sont les seuls leviers de croissance ; ils ne dépendent d'aucun déploiement |

**Ce qui ne change pas :** la métrique est le **clic**, et le CTR **à position égale** — si la
position bouge, le CTR bouge tout seul et on s'attribuerait le mérite du classement.

**⛔ Pas de demande d'indexation à la Search Console** tant que Rem ne le dit pas (calme demandé le
17/09).

### Ce qu'on peut PRÉPARER sans rien déployer

Fusionner sur `main` = déployer : tout ce qui suit vit donc sur une branche, prêt, non fusionné.

| préparable tout de suite | ce que c'est | risque |
|---|---|---|
| **le BLOC 1 en entier** | l'accueil épuré, les titres courts, la garde de seuils, batterie complète passée | nul — rien n'est fusionné |
| **le BLOC 3** | la page fusionnée (outil en haut), la règle de redirection, sitemap et gardes à jour | nul |
| **Lot D** | relever la SERP réelle de chaque intention candidate (outil ou comparatif ? Aperçu IA ?) et ne garder que celles où Google montre un OUTIL | nul — c'est de la lecture |
| **Lot E** | écrire les messages aux comparatifs (dysclick, poppins, Glaaster, Merci App) et aux associations dys | nul — **Rem les envoie, pas moi** |
| **le relevé de référence** | la procédure exacte du 02/10, pour que la lecture soit comparable | nul |

⛔ **Non préparable** : rien qui suppose de connaître l'effet du nom de site avant le 02/10.

## 4. CE QUE JE NE PROPOSE PAS, ET POURQUOI

| écarté | pourquoi |
|---|---|
| Ajouter des mots-clés dans le texte des pages | Le problème mesuré n'est pas le contenu : nous sommes en position 3 à 6. C'est la ligne bleue qui ne dit pas le bon mot. |
| Multiplier les pages pour « couvrir » des requêtes | 37 pages pour 44 clics. En ajouter diluerait l'exploration ; le constat ② dit que nous avons déjà trop de pages non cliquées. |
| Schema.org partout | Aucune requête mesurée ne déclenche de résultat enrichi. À rouvrir seulement si une page vise un format qui en a un. |
| Backlinks achetés ou échangés | Contraire au projet, et Google les traite comme du spam. Le Lot E est la version honnête, et la seule qui tienne. |
| Toucher au nom de domaine | L'Aperçu IA sur « omega pendu » parle des pendulettes de la marque Omega : la marque est ambiguë. Mais le site est **1ᵉʳ avec des liens de site** sur son propre nom — le nom fonctionne, il ne se change pas pour un inconvénient d'Aperçu IA. |

---

*Rédigé le 19/09/2026. Tous les chiffres viennent de la Search Console (propriété
`sc-domain:omegapendu.com`, 03/07 → 16/09/2026) et de pages de résultats réelles relevées le
19/09. À relire avec un relevé frais avant d'agir : une mesure de trois semaines ne se recopie pas,
elle se refait.*
