# Chantier anglais — état mesuré, garde-fous, ordre de travail

> Établi le **31/08/2026**, à la réouverture du chantier par Rem. Feuille de route qu'il a fixée :
> ① correcteur anglais sur le SITE, au plus près du niveau français → ② saisie vocale anglaise avec
> ponctuation + couche FP=0 → ③ extension anglaise, **si et seulement si ① et ② tiennent**.
>
> ⚠️ **La contrainte qui commande tout, énoncée par Rem** : « je vais me reposer entièrement sur toi
> pour l'anglais, je pourrais introduire des erreurs ». Rem est dys et francophone : en français il
> est le juge, il voit immédiatement une correction absurde. **En anglais ce juge disparaît.**
> Tout ce qui suit est conçu pour être vérifiable **sans savoir l'anglais**.
>
> Principe de travail posé par Rem : **prendre ce qui est libre plutôt que réinventer** — plus de
> travail = plus d'occasions de se tromper. Filtre de licence en §6.
>
> Mesures faites sur `main @fc7f09a`, arbre propre, 12 bancs anglais réellement exécutés.

---

## 1. L'état réel — meilleur que prévu sur la précision, faible sur la couverture

**Ce qui va bien.** Les briques sont là et **commitées** (3,42 Mo) : lexique **199 673** surfaces,
**92 660** lemmes fléchis, 5 549 homophones, g2p (63 SEG / 89 COND), POS-HMM, n-grammes.
**Rien ne manque côté données livrées.**

| mesure | valeur | lecture |
|---|---:|---|
| rappel speller EN (2 886 fautes Wikipédia) | **80,5 %** | ce n'est pas un prototype |
| rouges sur texte édité (PUD+GUM, 176 893 tokens) | **9** (0,0051 %) | très précis |
| rouges confirmés par un annotateur (JFLEG) | **190 / 203 = 93,6 %** | ce qu'il affirme est juste |
| **couverture** des corrections d'annotateurs (JFLEG) | **7,9 %** | 🔴 **le vrai retard** |
| mauvaise cible (WRONG) | 446 (16,3 %) | à ventiler par palier |
| **AUTO_WRONG** (rouges faux) | **2** | 🔴 **FP=0 est violé** |
| tagger EN / FR | **90,7 %** / ~95 % | goulot pour toute grammaire |
| chunker de GN | 82,3 % | idem |
| règles EN / FR | **53** / **82** | rapport 1 à 1,7 |

Les 2 rouges faux : `definatly→defiantly` (attendu *definitely*), `welcame→welcome` (attendu
*welcomed*).

Les familles **jamais vues** (0 rouge, 0 orange) sur JFLEG : mot en trop (716), mot oublié (608),
article oublié (222), article en trop (180), prépositions (~380 cumulés).

---

## 2. 🔴 Le vrai danger n'est pas une règle manquante : **les bancs ne savent pas échouer**

Trois défauts trouvés dans les gardes elles-mêmes. C'est **plus grave** que le retard fonctionnel,
parce que c'est ce qui laisserait passer mes erreurs sans que personne les voie.

**① L'auto-désactivation silencieuse.** `dictee/homophone_en_probe.py:261` :
`ok = (hitR + hitO == len(CASES)) and (red_fp is None or red_fp <= 55)`.
Corpus absent → `red_fp is None` → **le contrôle PASSE**. En intégration continue, les corpus sont
dans `data_local/` (gitignoré) : **8 sondes anglaises sur 12 ne tournent pas**, et le garde FP=0
se déclare vert sans avoir rien mesuré.

**② L'oracle auto-écrit.** Ce même `--check` asserte `hitR + hitO == len(CASES)`, où `CASES` est une
liste de cas **écrite à la main par l'auteur des règles**. Le « 32/32 » est **tautologique** :
l'oracle et le moteur ont le même auteur. C'est le défaut de fond.

**③ La parité compare des totaux, pas des décisions.** `dictee/parity_en.js` incrémente `jsAuto` /
`jsRed` puis compare les sommes. « JS 69 vs PY 68 » peut recouvrir **40 divergences qui s'annulent**.
Le pendant français (`parity_diag.js`) compare cas par cas. Et cette parité est **rompue**
(homophone JS 53 vs PY 46 ; POS 326 divergences / 9 323 tokens) **et hors CI** — la référence Python
a **14 règles de retard** sur le JS livré : elle ne décrit plus le produit.

> **Conséquence** : toute règle anglaise écrite aujourd'hui serait **non mesurée par construction**,
> et le resterait en silence.

---

## 3. Les garde-fous — vérifiables sans savoir l'anglais

### 3.1 Règle fondatrice

> **Aucune liste de cas écrite à la main ne peut servir de PREUVE pour un palier ROUGE.**
> Elle ne vaut que comme test de non-régression.

Toute justification de rouge vient d'une donnée **extérieure au dépôt et antérieure à la règle** :
alignement JFLEG `src ↔ ref0..3` (direction humaine de la correction) · UD GUM + PUD (gold non écrit
par moi) · `wiki_misspell` (paires curées) · AGID (flexion attestée, liste fermée auditable) ·
SUBTLEX (attestation quantitative).

### 3.2 Quatre rôles de corpus, non interchangeables

**Témoin muet** — anglais correct, le moteur doit s'y taire en rouge : GUM + PUD **+ les 6 004
références JFLEG**. ⭐ Ces références sont déjà sur disque et **personne ne s'en sert** : c'est du
texte de la même population que les fautes, donc le seul corpus qui piège une règle calibrée
« pour apprenants » qui déborde. · **Confirmation** — JFLEG `src` + ses 4 références : chaque rouge
classé automatiquement *confirmé / infirmé / non vérifiable*. · **Tir** — EWT, 178 k tokens de web
brut : la règle se déclenche-t-elle dans la vraie vie ? · **Régression** — les `CASES` existantes,
dégradées à ce seul rang.

### 3.3 Passage au ROUGE — six conditions **cumulatives**

| | condition | seuil |
|---|---|---|
| R1 | déclencheur présent dans le témoin | ≥ 200 occurrences du contexte, sinon **mesure impossible → ORANGE d'office** |
| R2 | FP sur le témoin muet | **0** |
| R3 | tir réel | ≥ 1 sur EWT **et** ≥ 1 sur JFLEG `src` |
| R4 | confirmation externe | ≥ 20 tirs classés, ≥ 90 % confirmés, **0 infirmé** |
| R5 | parité JS ≡ Python | **décision par décision**, pas en totaux |
| R6 | test du miroir (§3.4) | le mutant inverse est **tué** |

Un échec → **ORANGE**. Échec de R3 partout → **la règle n'est pas livrée** (précédent français :
21 règles sur 55 ne tiraient nulle part).

**Plafond global** : le nombre total de rouges sur le témoin muet **ne doit jamais augmenter** d'une
PR à l'autre. Une règle qui « ne coûte qu'un FP » est refusée comme les autres.

### 3.4 ⭐ Le cas dangereux : une règle **plausible mais fausse**, muette sur le contrôle

C'est exactement ce que ni Rem ni moi ne pouvons voir. Trois instruments, tous mécaniques.

**Le test du miroir — l'instrument central.** Pour chaque règle rouge, générer le mutant qui
**échange la source et la cible**, puis exiger :

> le mutant inverse doit produire **≥ 1 FP sur le témoin** ou **≥ 1 « infirmé » sur JFLEG**.

Si écrire la règle **à l'envers** passe les bancs aussi bien qu'à l'endroit, alors **aucun banc ne
distingue le vrai du faux** : la règle n'est pas prouvée, quelle que soit sa plausibilité. Elle
repasse en orange jusqu'à ce qu'un banc sache les séparer. C'est « mesurer, jamais affirmer »
traduit mécaniquement pour une langue que personne ici ne lit.

**Stabilité sur les références humaines.** `corriger(référence)` doit être vide en rouge sur les
6 004 références. Une règle de direction fausse propose presque toujours la transformation inverse
sur du texte déjà correct : elle se trahit là.

**Asymétrie d'attestation.** Dans du texte édité, la **cible** doit être plus attestée que la
**source**, dans le contexte de la règle. Ratio < 1 → refus du rouge. Comptage pur, zéro jugement
de langue.

**⚠️ Ce qui n'est couvert par personne** : une règle juste sur l'anglais **édité** et fausse sur la
cible **dys**. Le registre témoin n'est pas le registre cible. À écrire noir sur blanc, et à ne
jamais maquiller.

### 3.5 Falsifier les bancs eux-mêmes

Un banc vert ne prouve rien tant qu'on n'a pas prouvé qu'il **sait devenir rouge**. Précédent vécu :
la sonde de la calculette testait les valeurs stockées et restait verte pendant que l'affichage
montrait −1. → `en_mutants_probe.js` : N mutations mécaniques (vider une table, retirer une garde,
inverser une règle, ne pas charger `pos_hmm_en.json`). **100 % des mutants doivent être tués** ;
tout survivant est publié.

---

## 4. L'ordre de travail — on ne construit rien avant de pouvoir le mesurer

⭐ **Les lots 1 à 4 ne contiennent pas une ligne d'anglais.** Ils sont donc intégralement
vérifiables par Rem.

| lot | contenu | critère de succès |
|---|---|---|
| **1** | **Rendre les bancs capables d'échouer** : supprimer `red_fp is None or` et son jumeau ; corpus témoin committé (licence à valider) ; `OMEGA_ALLOW_SKIP` explicite, jamais implicite | les 5 `--check` **échouent** quand on retire le corpus |
| **2** | **Parité décision par décision, en CI** ; diagnostiquer les ruptures 69/68 et 53/46 ; `parity_pos_en` en CI | 0 divergence sur 178 k tokens ; `exit 1` en CI |
| **3** | **Registre des règles + banc de tir** ; ventiler les 446 WRONG en AUTO_WRONG (viole FP=0) vs FLAG_WRONG (doute→orange, conforme) | AUTO_WRONG → **0** ; chaque règle a sa ligne ; les règles muettes sont nommées |
| **4** | **Falsification** : mutants, journal doré, banc navigateur réel EN | 100 % des mutants tués |
| — | *…et seulement après, on a le droit d'écrire une règle anglaise* | |
| **5** | Le câblé-mais-muet, tranché par la mesure | voir ⚠️ ci-dessous |
| **6** | Couverture **au moteur** (pas sur la table) : % de tokens connus / à clé phon / à fréquence | dit si le rappel plafonne par le lexique ou par les règles |
| **7** | Nouvelles règles, une par une, sous R1–R6 | occasions **comptées** avant d'écrire une ligne |
| **8** | Goulot POS / chunker | tagger 90,7 → ≥ 94 % ; GN 82,3 → ≥ 90 % |
| **9** | Rappel dys anglophone | voir §5 |

### ⛔ Ce qu'il ne faut PAS faire en premier

**Écrire des règles anglaises** — la parité est rompue et le garde FP s'auto-désactive : toute règle
ajoutée aujourd'hui est non mesurée, silencieusement.

**Brancher `homophones_en.json` (5 549 entrées)** — le motif « livré mais jamais chargé » donne envie
d'un gain gratuit. C'est un **index de collisions**, pas une liste de confusions :
`confusables_en.json` (111, seuil de séparabilité 10) existe précisément parce que le brut ne marche
pas. Le brancher produirait des FP massifs qu'aucun banc actuel ne verrait.

**Attaquer le chunker / l'accord nominal** — le plus gros, le plus lent, et **3 réfutations
chiffrées** disent qu'il ne rendra rien avant que le tagger monte.

**« Améliorer » le 80,5 %** — ce chiffre décrit le moteur **Python**, qui a 14 règles de retard sur
le produit. Optimiser une référence qui diverge du produit, c'est rejouer le piège de PR#578.

**Faire confiance aux `CASES` verts** — tautologiques, même auteur que le moteur.

**Commencer par la voix (étape ②)** — elle hériterait de tous les défauts de ①, plus la ponctuation.

---

## 5. Le rappel dys anglophone — irréductible, à ne pas maquiller

Il n'y aura **pas** de corpus dys anglais : protection des données, et pas d'accès de terrain. Le
corpus français existe par une relation réelle (FFDys / Plateforme Dys de l'ASEI, privé, non
redistribuable) et parce que **Rem est lui-même dys et écrit en français**. Les deux canaux sont
fermés en anglais.

⭐ **Mais cela n'empêche pas de construire** — c'est le recadrage de Rem, et il est juste. La
validation française tient sur **deux jambes** qu'il ne faut pas confondre :

- **FP=0 se mesure sur du texte CORRECT.** Aucun corpus dys requis. Déjà transposable, EWT/GUM/PUD
  sont là. Et c'est la jambe **la plus importante** pour un dys : ne jamais corrompre ce qui était
  juste.
- **Le rappel sur fautes réelles** est la seule jambe qui demandait le corpus.

Ce qu'on perd vraiment : la **fréquence** des familles — quelles familles sont à la fois faibles et
fréquentes, ce qui a piloté toute la priorisation française — et le **census**. C'est une perte de
**ciblage**, pas de faisabilité.

Trois voies pour un rappel dys approché, aucune ne donne un chiffre comparable au 70 % français :
(a) un générateur de fautes dys anglaises depuis la **phonologie** (le g2p existe) → rappel
**relatif**, bon pour comparer deux versions, **jamais absolu** ; (b) un sous-ensemble phonétique de
`wiki_misspell` ; (c) demander si un corpus apparié est atteignable.

⛔ **Interdit : présenter un chiffre JFLEG comme un rappel dys.** JFLEG est un corpus d'apprenants,
pas de dyslexiques.

---

## 6. Réutiliser plutôt que réinventer — le filtre de licence

Principe de Rem : **prendre ce qui est libre**. Et c'est un garde-fou, pas de la paresse : une
ressource déjà relue par des anglophones est plus sûre que des règles que j'écrirais seul.

**OMEGA est sous licence MIT** (`LICENSE`, © 2026 Rem). Donc :

- ✅ **Code absorbable** : MIT · BSD · Apache 2.0 · ISC · CC0 · domaine public — attribution, et c'est tout.
- ⛔ **Code interdit** : **GPL et AGPL** — contamineraient le dépôt entier.
- ⚠️ **LGPL** : le projet livre un HTML unique et une extension, tout est **embarqué** — pas de lien
  dynamique à invoquer. À traiter comme interdite pour le code. Précédent : LanguageTool est LGPL →
  **lire la liste des phénomènes, jamais importer le XML**.
- ✅ **Données en CC BY-SA** : acceptées, précédent établi (Lexique 4, kaikki, UD-GSD, Wikipedia).

⭐ Distinction opératoire : on peut **lire** une ressource GPL pour en tirer une **liste de
phénomènes** — une idée n'est pas copiable — mais on ne peut ni importer son code ni ses tables.

---

## 7. Les trois premières choses

**① Réécrire `parity_en.js` en comparaison décision par décision**, et sortir la liste réelle des
divergences. Zéro anglais requis. Répond à la seule question qui conditionne tout le reste : **les
chiffres Python décrivent-ils le produit livré, oui ou non ?**

**② Supprimer les auto-désactivations** (`homophone_en_probe.py:261` et son jumeau speller) et poser
la baseline locale des 5 bancs. Aujourd'hui on ne connaît pas l'état de départ — on connaît un état
vert qui n'a rien mesuré.

**③ Ajouter les 6 004 références JFLEG au témoin muet**, et ventiler les 446 WRONG par palier. Les
références sont déjà sur disque et inutilisées ; c'est le corpus qui piège les règles de **direction
fausse**, la seule pathologie que ni Rem ni moi ne pouvons voir à l'œil.
