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

## 1. DIAGNOSTIC — cinq constats, par impact mesuré

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

### ⑤ Le plafond arithmétique — à dire avant de dépenser du temps

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

`/recherche` : **à ne PAS mettre en noindex** — c'est une vraie page publique, elle porte la
crédibilité du projet. Elle relève du Lot A (titre, H1, description). Sa vraie question est :
quelle recherche l'amène en position 3,2 ? À instruire avant de décider.

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

#### Lot E — hors-site : être dans les listes *(le seul levier qui déplace vraiment la voie 2)*

Les pages qui occupent la page 1 sur « correcteur dyslexie » sont des comparatifs tenus par des
tiers : dysclick.fr, poppins.io, glaaster.com, merci-app, et des pages d'académies. **Un outil
gratuit, open source, sans compte et sans traqueur est exactement ce qu'ils citent.** Ce n'est pas
du code : c'est écrire à ces sites, et se rendre visible là où les familles et les orthophonistes
cherchent (associations dys, forums, groupes d'enseignants).

⚠️ Rien de tout cela ne part sans Rem : c'est son nom, son projet, son ton. Je peux préparer les
textes, pas les envoyer.

---

## 3. CALENDRIER ET MÉTHODE

| quand | quoi |
|---|---|
| jusqu'au **02/10** | **on ne touche à rien** — on mesure l'effet du nom de site du 17/09 |
| 02/10 | relevé complet : clics, impressions, CTR, position, par page ET par requête |
| 02/10 → J+28 | **Lot A** seul (titres, H1, descriptions, garde) |
| +28 j | relevé, puis **Lot B** seul (noindex des docs) |
| +28 j | relevé, puis **Lot C** |
| en parallèle, sans horloge | **Lot D** (mesurer les pages de résultats avant d'écrire) et **Lot E** (hors-site) |

**Trois règles de mesure**, sans lesquelles ce plan ne vaut rien :
1. **un lot à la fois**, 28 jours entre deux — sinon aucun effet n'est attribuable ;
2. **la métrique est le CLIC**, et le CTR à position égale. L'impression peut monter pendant que
   tout se dégrade : c'est précisément ce qui se passe depuis juillet ;
3. **on compare à position égale.** Si la position bouge, le CTR bouge tout seul, et on
   s'attribuerait un mérite qui vient du classement.

**⛔ Pas de demande d'indexation à la Search Console** tant que Rem ne le dit pas (calme demandé le
17/09).

---

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
