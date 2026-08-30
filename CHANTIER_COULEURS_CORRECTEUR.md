# Chantier — surlignage du correcteur × police de son (SITE)

> Établi le **30/08/2026**, à la demande de Rem : « l'utilisation des surlignements dans la
> correction et de ses couleurs, utilisées en même temps que la police syllabes et la police son,
> rend difficilement visibles les mots ».
>
> ~~**Rien n'est encore livré.**~~ **RÉALISÉ le 30/08/2026** (branche `couleurs-correcteur`), après
> contre-vérification du dossier par 3 agents (« ne le prends pas pour acquis ») : **21/24
> affirmations exactes au chiffre près** (les 24 contrastes recalculés indépendamment), 3 imprécisions
> sans effet sur le plan — ① `body.son-actif .vdc-bad` = (0,2,1), pas (0,3,1) (la parade (0,4,1)
> reste la bonne) ; ② les hex « variantes sombres de l'extension » cités en §7 sont les puces de
> l'aide au nombre (`.cp0-2`), pas les fonds du correcteur (les bons : `#1d2329`/`#17281c` — la
> conclusion « extension hors périmètre » tient) ; ③ la règle dictée est ligne 27921, pas 27920.
>
> **Mesuré dans le navigateur après implémentation (§6 complet, A→E)** : muette **8,52** · syllabe
> **9,04** (sombre) ; **5,19** minimum en clair — les 4 thèmes ≥ 4,5 via les vrais boutons. Survol :
> pastel legacy revenu, texte #111, variantes claires forcées. Sélection : 4,99/5,30. Falsification :
> bloc retiré en live → min **1,18** = la sonde vire au rouge. Police éteinte : fonds legacy exacts
> dans les 4 thèmes, clic à travers les spans OK, curseur préservé (« LesX », offset 4).
>
> **Trois écarts au plan, tous mesurés** : ① `::selection` doit AUSSI viser `#vdc-in *::selection`
> (les lettres habillées sont des spans enfants — la règle du dossier seule était morte à l'arrivée) ;
> ② au survol, la muette doit gagner sur la syllabe (ordre calqué sur `.son-syl.son-mute` de
> `son_ui.js:22`) ; ③ **verdict isDarkBg PÉRIMÉ à la bascule de thème** (mesuré : min 2,01 en clair
> après bascule, réparé à la frappe suivante) → observer de classes `dys-*` sur `body` dans
> `son_ui.js` : ré-habillage automatique, 2,01 → 5,19 sans frappe.
>
> Périmètre : **le correcteur du SITE** (`app/omega-pendu.html`). Pas l'extension — voir §7.

---

## 1. Le défaut, mesuré

Trois systèmes se disputent la même lettre dans `#vdc-in` :

| système | ce qu'il code | par quel canal |
|---|---|---|
| correcteur | il y a une faute ici, et de quelle catégorie | **fond** (aplat pastel) |
| police de son | voisé / sourd | graisse |
| police de son | lettre **muette** | **couleur du texte** |
| syllabes | alternance des syllabes **impaires** | **couleur du texte** |

Mesuré dans la page, thème sombre (le **défaut** de l'app), police de son et syllabes actives :

| lettre dans une correction | contraste | seuil 4,5 |
|---|---:|---|
| normale | 12,66 | ✓ |
| **muette** | **1,43** | ✗ |
| muette, mode daltonien | **1,69** | ✗ |

## 2. La cause

`isDarkBg()` (`police/son_ui.js:44-53`) est appelé **une seule fois par passe, sur le conteneur**
(`:119`) — jamais par segment. Il voit `#vdc-in` (sombre, `#10161d`), pose `son-on-dark` sur
**toutes** les lettres, et leur donne les teintes claires. Or les lettres d'un mot corrigé ne sont
pas sur l'éditeur : elles sont sur un aplat **pastel clair** — `#f6b6b6` / `#bcd6f5` / `#ffdd94` /
`#c9efd0`, **identiques en thème sombre** (`app:27930`).

L'app gère pourtant déjà le cas pour le texte normal : `body.dys-dark .vdc-bad{color:#111}`
(`app:27932`) force le noir sur les marques, d'où le 12,66. **La police de son écrase cette
décision**, et elle seule.

Faits d'architecture établis (lecture de code + navigateur) :

- **Une seule couche.** `#vdc-render` est du **CSS mort** : 3 règles, aucun élément créé.
  Le surlignage est écrit dans l'`innerHTML` de `#vdc-in` (`app:28525`).
- Les `span[data-son]` naissent **à l'intérieur** des `.vdc-bad` (TreeWalker + `replaceChild`).
- L'habillage est toujours **postérieur** au surlignage (MutationObserver, `son_ui.js:236`).
- Les syllabes ne colorent que les **impaires** ; les paires héritent de la couleur ambiante.

## 3. ⛔ Ce qu'il ne faut PAS faire — le réflexe évident est mesuré inefficace

**« Réparer `isDarkBg` pour qu'il décide par segment »** ne résout rien. Avec la **bonne** variante
claire appliquée sur chaque pastel :

| encre | `#f6b6b6` | `#bcd6f5` | `#ffdd94` | `#c9efd0` | `#fce6cf` (cb) |
|---|---:|---:|---:|---:|---:|
| muette `#a34700` | 3,55 | 4,07 | 4,63 | 4,84 | 5,02 |
| syllabe `#0072b2` | **3,03** | **3,48** | **3,96** | **4,13** | **4,29** |

Le bleu Okabe-Ito ne passe sur **aucun** des cinq pastels. On écrirait du JS pour aller de 1,43 à
3,03 : d'illisible à illisible.

**Le théorème** : les contrastes se **multiplient** — `C(zone,son) = C(zone,fond) × C(fond,son)`.
Sur une dynamique de 21, on ne paie pas deux fois. Deux signaux de couleur sur le même mot ⇒ il faut
en **déplacer un de canal**, pas retoucher les valeurs.

## 4. La solution retenue — canaux disjoints

Quand la police de son est allumée, le correcteur **libère le canal fond** et redescend sur le
**trait**. L'encre de son retombe alors sur le fond de la zone, le seul que `isDarkBg` mesure déjà
correctement.

| | sombre `#10161d` | clair `#fff` |
|---|---:|---:|
| muette | **8,52** | **6,07** |
| syllabe | **9,04** | **5,19** |

Quatre sur quatre au-dessus de 4,5, **sans toucher à `isDarkBg`**.

Répartition visée, un signal = un canal :

- **voisement** → graisse (3 faces OMEGA Dys, déjà en place ; seul canal qui survit en noir et blanc)
- **muette + syllabe** → couleur du texte (seul canal qui distingue lettre par lettre)
- **il y a une correction, et son étendue** → trait sous la ligne de base
- **catégorie** → **motif** du trait (plein / ondulé / tirets / double), doublé de sa couleur
- **cliquable, je le vise** → fond, devenu **transitoire** : survol et focus seulement

⭐ **C'est gaté.** Police de son éteinte — le cas par défaut — le rendu est **identique au pixel
près**. Le mode ne s'active que si l'utilisateur allume 🔡.

## 5. À faire, dans l'ordre

### 5.1 `police/son_ui.js` — 2 lignes, aucune couleur touchée

- dans `setOn()` (`:150-155`), après l'écriture du `localStorage` :
  `try{document.body.classList.toggle('son-actif', on);}catch(e){}`
- la même ligne juste avant `controls.forEach(...)` (`:241`) — **l'initialisation ne passe pas par
  `setOn()`**, l'état restauré doit poser la classe aussi.
- `setSyl()` n'a rien à faire : allumer les syllabes rallume déjà la police de son.

⚠️ **La source est `police/son_ui.js`**, l'app en reçoit une copie générée. Après édition :
`python police/inject_fonts.py`. Éditer la copie dans l'app = modification perdue au prochain build.

### 5.2 `app/omega-pendu.html` — bloc CSS

⚠️ **Le CSS de l'app est une chaîne JS concaténée** (`+'…'`). Chaque règle est un `+'…'`, apostrophes
échappées. Y coller du CSS brut avec des retours à la ligne laisse la chaîne non terminée et
**invalide tout le bloc de style** (symptôme : plus aucune règle `.vdc-*` ne s'applique).

Insérer **après** la ligne 27936 (`body.dys-dark.dys-cb .vdc-bad{…}`) et avant `#vdc-cardpop` :

1. **Libérer le fond et la graisse** — `body.son-actif .vdc-bad, body.son-actif .vdc-on` :
   `background:transparent`, `border-bottom:0`, `border-radius:0`, `padding:0`,
   `font-weight:inherit`, `text-decoration:underline`, `thickness:4px`, `offset:3px`,
   `skip-ink:none`, `color:#b02020`.
2. **La catégorie sur le motif** — `.vdc-orth` → `wavy` `#1b5c86` · `.vdc-vig` → `dashed` `#c8760a`
   · `.vdc-on` → `double` `#1f7a3d`. Couleurs = celles des `border-bottom` actuels, **aucune teinte
   nouvelle**.
3. 🔴 **LA LIGNE À NE PAS OUBLIER** — `body.son-actif.dys-dark .vdc-bad, …​.vdc-on{color:inherit}`.
   Sans elle, le `color:#111` de `app:27932` s'applique au mot entier sur la zone sombre :
   **1,04**, invisible, **dans le thème par défaut**. C'est ce qui tue la solution naïve.
4. **Trait en thème sombre** — reprendre les **pastels** au lieu des saturés :
   `#b02020` sur `#10161d` ne donne que **2,66** (seuil 3,0) alors que `#f6b6b6` donne **10,64**.
   La palette ne change pas, **son rôle change** : de remplissage à trait.
5. **Le fond revient au survol / focus** — `:hover`, `:focus-visible`, valeurs actuelles inchangées.
6. **Corollaire du survol** — pendant le survol le pastel est clair dans les 4 thèmes : forcer la
   variante « fond clair » des couleurs son sur le mot survolé (spécificité 0,4,1 > 0,2,0).
   C'est la seule ligne qui corrige, **en CSS**, le verdict pris une fois pour tout le conteneur.

### 5.3 Les trois pièges à traiter en même temps

- 🔴 **`::selection` n'a ni variante sombre ni daltonienne** (`app:27877`,
  `background:#8ec5ff`). Le pastel retiré, **la sélection devient le seul fond local** :
  `#6cc0f0` dessus = **1,11**, `#f0a04b` = **1,18**. Dans un `contenteditable` où l'on sélectionne
  en permanence, c'est un bug **intermittent** — le pire pour un dys, qui ne pourra pas le
  reproduire pour le signaler. Ajouter `body.dys-dark #vdc-in::selection{background:#26405c}`
  (mesuré : muette 4,99 · syllabe 5,30).
- 🔴 **Spécificité** — `body.son-actif .vdc-bad` = (0,3,1) **perd** contre
  `body.dys-dark.dys-cb .vdc-bad.vdc-orth` = (0,4,1) : en **sombre + daltonien**, le fond bleu
  survit. Énumérer les classes pour monter à (0,4,1), et concaténer **après** 27936.
  ⛔ Ne pas régler ça à coups de `!important`.
- **Le texte d'aide** (`app:27951`) dit « surlignées **sur ton texte** » — devient faux dans ce mode.
  Son propre commentaire l'exige : « si le fonctionnement change, ce texte change aussi ».

## 6. Vérifications — dans le navigateur, dans cet ordre

**Principe** : les mesures précédentes se sont trompées de couche. On remonte **depuis le span**,
jamais depuis le conteneur.

**A — le banc existe-t-il ?**
`localStorage.clear()` puis recharger → `body.classList.contains('dys-dark') === true` (thème par
défaut). `getElementById('vdc-render') === null`. Ouvrir 🩹 Correcteur → les boutons `vdc-son` et
`vdc-syl` existent — s'ils manquent, `son_ui.js` a **bailé en silence** (`:12`) et toute sonde
serait verte pour la mauvaise raison.

**B — le conflit est-il dans le DOM ?**
Texte < 4 000 caractères (au-delà : abstention **sans signal**), attendre > 400 ms.
🔴 `document.querySelectorAll('#vdc-in .vdc-bad span[data-son]').length > 0` — **si c'est 0, tout ce
dossier est faux**. Puis : un `.son-mute` dans un `.vdc-bad` doit avoir `son-on-dark` **alors que**
son parent peint un pastel clair : **c'est le bug en une assertion**.

**C — mesurer au bon endroit.**
Pour chaque span : `color` du span, et fond = **premier ancêtre opaque en partant de
`sp.parentElement`**. 🔴 La sonde doit **imprimer `bgEl.className`** : pour un span dans un
`.vdc-bad`, ce doit être le `.vdc-bad`. Si elle annonce `vdc-in`, **c'est la sonde qui est fausse**.
Contraste **WCAG avec linéarisation sRGB** — surtout pas la formule brute d'`isDarkBg`.

**D — les états invisibles à `getComputedStyle`.**
Survol (`forcePseudoState`). Sélection réelle + **lecture du pixel** sous une glyphe muette — seule
mesure immunisée contre l'erreur de couche. Les **4 thèmes**, en cliquant `#vdc-theme` et `#vdc-cb`,
jamais en posant les classes à la main.

**E — falsification et non-régression.**
🔴 **Retirer le bloc `body.son-actif` et relancer : la sonde DOIT virer au rouge.** Verte sans le
correctif, elle ne prouve rien. Police de son éteinte : fonds strictement égaux à `#f6b6b6` /
`#bcd6f5` / `#ffdd94` / `#c9efd0` dans les 4 thèmes. Clic toujours fonctionnel malgré les spans
interposés. Curseur préservé. `parity_son.js` et `parity_diag` verts.

## 7. Périmètre — ce qui n'est PAS couvert

- **L'extension n'est pas concernée.** Ses fonds de surlignage ont de vraies variantes sombres
  (`#12283d`, `#14301f`, `#3a2a12`) : la police de son y reçoit le bon verdict, il n'y a pas de
  conflit. (PR#608 y a traité un **autre** défaut : le stabylo de l'encadré « texte corrigé »
  contrastait 1,15 avec son fond.)
- **La dictée n'est pas couverte** : `body.dys-dark #vdd-fb .vdd-fact *{color:#1a1a1a!important}`
  (`app:27920`) écrase déjà la muette. **Défaut distinct** — ne pas annoncer « réglé partout ».
- `app/omega-pendu-en.html` porte les mêmes classes : même bloc à répliquer **si** on y touche.
  L'anglais est parqué, donc à laisser tel quel par défaut.

## 8. Le risque à trancher par Rem, pas par le calcul

**Un aplat se repère plus vite qu'un trait en vision périphérique**, surtout pour un lecteur dys qui
balaie. Le contraste ne mesure pas la saillance. Si le repérage se dégrade à l'usage, la solution
tombe — et c'est un verdict d'usage, pas de chiffre.

Autres réserves honnêtes : `text-decoration-thickness` est souvent ignoré sur `wavy` (prévoir un
repli `border-bottom`) ; sur tactile il n'y a pas de survol, donc le retour « ce mot est cliquable »
disparaît ; trois motifs voisins (pointillé, tirets, plein) sont à départager à l'œil dans les
4 thèmes.
