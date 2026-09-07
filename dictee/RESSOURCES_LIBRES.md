# Ressources libres — correcteur orthographique & grammatical (veille)

> But : recenser **données + code + lexiques LIBRES** réutilisables pour notre correcteur dys FR.
> Cadre projet (non négociable) : **garde-fou FP=0** · **hors-ligne** · données **CC BY-SA 4.0** + code **MIT**
> (⚠️ donc attention aux licences **copyleft fort** type GPL : on peut *étudier* l'approche, pas *copier* le code).
> On a déjà : **Lexique 4** (CC BY-SA 4.0) + dérivés `cgram_*`, `phono_homophones`, speller embarqué.
> ⚙️ **Égress en session cloud BLOQUÉ** pour HuggingFace / ORTOLANG / NCBI (403/allowlist) → les `⬇ local` se tirent en local.

---

## 1. DONNÉES — le goulot n°1 (vraies copies corrigées FR → boucle descendante + validation FP=0)

| Ressource | Quoi | Pertinence dys | Licence / accès |
|---|---|---|---|
| **E-CALM / RésolCo** (ORTOLANG) | ~**4 500 textes scolaires** FR (primaire→université) + brouillons, **tapés et annotés** (erreurs) | ⭐ la plus juste : vrais écrits d'apprenants FR, annotés | ORTOLANG (licence académique à confirmer) · `⬇ local` (ortolang.fr/market/corpora/e-calm) |
| **Lang-8 / cLang-8** (sous-ensemble FR) + `juancavallotti/multilingual-gec` (~67k FR) | vraies corrections L2 (paires source↔corrigé) | volume réel ; déjà repéré (`fetch_gec_corpus.py`, `corpus_externe.json`) | recherche/usage · `⬇ local` (HF bloqué en session) |
| **fdemelo/spelling-correction-french-news** (HF) | **49,1k** paires, corruptions **synthétiques** (concat, swap de lettres, voisins AZERTY) sur corpus news Leipzig | utile **speller** (pas dys, domaine news, synthétique) | HF · `⬇ local` |
| **MultiGED-2023** (Språkbanken) | détection d'erreur token-level multilingue | ❌ **FR ABSENT** (cs/en/de/it/sv) → pas utilisable FR | CC (mais pas de FR) |
| Études dys FR : Daigle (2016, *Dyslexia*), review LRE 2022 « Spelling errors made by people with dyslexia », plateforme **dictée FR** (PMC9878594) | **typologies** d'erreurs (phono/morpho/visuo-ortho/lexical) + méthodo d'annotation | valident notre **taxonomie de familles** et le cadre dictée→type d'erreur | articles (HAL/ORTOLANG ; corpora pas toujours ouverts) |

→ **Notre infra prête à les ingérer** : `fetch_gec_corpus.py` (loader), `eval_externe.py` (held-out FP), `descending_probe.py` (apprend genre/POS depuis l'usage). Il manque juste **l'égress** (à faire en local).

## 2. CODE / OUTILS — apprendre, comparer, réutiliser avec prudence licence

| Projet | Quoi | Réutilisable pour nous | Licence |
|---|---|---|---|
| **Grammalecte** | correcteur **grammaire+ortho FR**, **JS pur, hors-ligne, sans serveur** (= notre contrainte exacte), conjugueur ~8 000 verbes, moteur de **règles** | ⭐ cousin le plus proche → **étudier l'approche/les règles d'accord** (banc de comparaison). ⚠️ **moteur GPL-3.0** → **ne pas copier le code** dans notre MIT | GPL-3.0 / MPL-2.0 / LGPL-2.1 |
| **dicollecte** (dico de Grammalecte) | dictionnaire **Hunspell FR** (.dic/.aff) | lexique ortho alternatif/complément | **MPL-2.0** (copyleft fichier, usable avec obligations) |
| **LanguageTool** | correcteur 25+ langues, **règles + n-gram**, FR | source de **connaissance de règles** (accords, confusions) | **LGPL-2.1** (compatible, prudence si on lie du code) |
| **Hunspell** | moteur ortho + affixes | spell+suggest générique (on a déjà notre speller Lexique) | LGPL/GPL/MPL |
| Neural FR : `fdemelo/t5-base-spell-correction-fr`, `PoloHuggingface/French_grammar_error_corrector`, `instacorrect` | seq2seq FR | **réf/benchmark seulement** (pas hors-ligne léger, pas FP=0) | variées (HF) |

## 3. LEXIQUES — compléter `cgram_*` (combler les gaps de couverture, license-aware)

| Lexique | Quoi | Pour nous | Licence |
|---|---|---|---|
| **Lefff** (Sagot, INRIA) | lexique **morphosyntaxique** FR large couverture (formes fléchies + POS + cadres) | candidat pour **étendre POS/genre/conjugaison** au-delà du sous-ensemble HF (gap genre déterminant, etc.) | **LGPL-LR** (ressource linguistique, attribution) |
| **Morphalou** (CNRTL/ORTOLANG) | morphologie flexionnelle FR | idem (vérifier licence) | ORTOLANG (à confirmer) |
| **GLAWI** | dico machine dérivé du Wiktionnaire FR | définitions/flexions | à confirmer (Wiktionnaire = CC BY-SA) |
| **Lexique 4** *(déjà embarqué)* | phono SAMPA, cgram, genre, nombre, homophones, fréquence | notre source actuelle | **CC BY-SA 4.0** |

## 4. Lecture pour NOUS (priorisé — §6 honnête)

1. **Données = le vrai levier** (cf. roadmap). Cibler **E-CALM** (le plus *dys/scolaire FR*) + **Lang-8 FR** (volume) → les tirer **en local** (égress) → nourrir `descending_probe` (auto-enrichissement genre/POS) et **valider FP=0 sur du réel** (≠ synthétique). Le synthétique `fdemelo` sert surtout le **speller**.
2. **Grammalecte = banc de comparaison + carte de règles** : mesurer notre correcteur *contre* lui sur un même corpus (où on est plus précis / il couvre plus), et s'inspirer de ses **règles d'accord** — **sans copier le code GPL** (frontière licence claire).
3. **Lefff (LGPL-LR)** = candidat pour combler les **gaps de couverture** (genre déterminant, conjugaison hors-HF) sans dépendre du seul sous-ensemble Lexique HF — **sous réserve de compat licence** avec notre redistribution (LGPL-LR ≠ CC BY-SA : à arbitrer avant intégration des données).
4. **Garde-fou transverse** : toute donnée/lexique externe intégré doit **préserver FP=0** (mesuré sur batterie + held-out) et **être cité** (NOTICE) avec sa licence.

---

## 5. Mesures réalisées (2026-06-21, session cloud)

> Égress de la session : **seul GitHub est ouvert** (raw 200) ; **HF / ORTOLANG / INRIA / PyPI / NCBI = bloqués (403)**.
> Donc tout ce qui vit sur GitHub a pu être tiré et mesuré ici ; le reste (E-CALM/Lang-8/HF) reste **à faire en local**.

**(1) Données — FP=0 sur du réel confirmé.** `eval_gec.py` sur les **98 paires GEC réelles** (`corpus_gec_fr.jsonl`,
déjà en repo) : **0 faux positif** sur les 98 phrases correctes — y compris **après la clôture de paradigme** (+2076
formes). Volume supplémentaire (E-CALM ~4500 écrits scolaires, Lang-8 FR) = à tirer **en local** (ORTOLANG/HF bloqués).

**(2) Banc Grammalecte** (`dictee/bench_grammalecte.py`, outil externe GPL **lancé** pas copié). Build hors-ligne OK
depuis le mirror GitHub `Pofilo/grammalecte` (recette dans l'en-tête du script ; le dict DAWG compile, thésaurus stubé).
Sur les 98 paires :

| | touche au CORRECT | flague le FAUTIF |
|---|---|---|
| Grammalecte (large, inclut typo/style) | **62/98** | 80/98 |
| **Notre correcteur** (FP=0 cardinal) | **0/98** | 22/98 |

→ chiffre notre **positionnement dys** : Grammalecte couvre plus (recall) mais **touche souvent au juste** ; nous =
périmètre étroit mais **PRÉCISION (FP=0)** + **stade développemental**. *(Caveat : le 62/98 inclut typo/apostrophes/style,
pas que de la vraie grammaire — comparaison indicative.)*

**(3) Lefff — gain de couverture mesuré** (`dictee/eval_lefff_coverage.py`, données Lefff hors-repo). Noms genrés
non ambigus : **Lefff 78 033** vs cgram full 53 050 (HF embarqué 46 712). **+37 187 noms** que notre cgram complet n'a
pas, et **accord 99,3 %** avec nous sur l'intersection (40 846). → Lefff comblerait largement le gap **genre déterminant**
(route lexicale du nom-tête) de façon fiable. ⚠️ **Intégration = arbitrage licence** (LGPL-LR ≠ CC BY-SA redistribution).

**Outils livrés (reproductibles, absence-safe = exit 0 sans données → CI-safe)** : `bench_grammalecte.py`,
`eval_lefff_coverage.py`. Les deux **lisent** des ressources externes (GPL/LGPL-LR) sans les **embarquer** → pas
d'entorse licence ; ils **mesurent**, on décide ensuite.

---

### Sources
- LanguageTool — https://github.com/languagetool-org/languagetool · https://languagetool.org/spellchecking-french
- Grammalecte / dicollecte — https://alternativeto.net/software/grammalecte/about/ · https://github.com/FrancoisCapon/GrammalecteDictionariesWithoutOptionalDataFields
- Lefff — https://aclanthology.org/L10-1487/ · http://atoll.inria.fr/~sagot/pub/lrec10lefff.pdf
- MultiGED-2023 — https://spraakbanken.github.io/multiged-2023/ · https://spraakbanken.gu.se/en/resources/multiged
- E-CALM / RésolCo — https://e-calm.huma-num.fr/corpus.html · https://www.ortolang.fr/market/corpora/e-calm
- HF FR spelling — https://huggingface.co/datasets/fdemelo/spelling-correction-french-news · https://huggingface.co/PoloHuggingface/French_grammar_error_corrector
- Dys FR — https://link.springer.com/article/10.1007/s10579-022-09603-6 (review) · https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9878594/ (dictée FR, annotation type d'erreur)
- cLang-8 — https://github.com/google-research-datasets/clang8

---

## 6. Veille 2026-09-07 — « des dictées avec fautes corrigées », dys ou pas

> Question posée : trouver des **copies avec la correction alignée** (pas seulement des copies fautives).
> Tout ce qui suit a été **tiré et mesuré** depuis cette machine (l'égress ORTOLANG/HF/Kaggle est ouvert
> en local, contrairement à la session cloud du §5). Chiffres verbatim, jamais de mémoire.

### 6.1 Ce qui est exploitable TOUT DE SUITE

| Ressource | Ce qu'on en tire | Mesuré ici | Licence / accès |
|---|---|---|---|
| **French_GEC** (45 M paires, révisions Wikipédia FR) | gisement de vraies fautes **en phrase** | sur 30 Mio de `chunk_0` = **71 580 paires** : 4 524 identiques (6,3 %), 21 876 à un seul mot changé (30,6 %), **2 436 paires « faute typique »** (source hors lexique → cible dans le lexique) = **3,40 % des paires lues**, dont **1 184 de même clé phonétique** (48,6 %) → ordre de **1,5 M** sur les 45 M | **CC BY-SA 4.0** (source Kaggle `isakbiderre/french-gec-dataset` ; miroir HF `FrancophonIA/French_GEC`, 20 CSV, chunk_0 = 1,3 Go). Sans compte. Loader : `dictee/fetch_frgec_pairs.py` |
| **ECRISCOL** (copies de 2NDE, projet CLESTHIA, dans le dépôt E-CALM) | **la seule vraie correction alignée trouvée** : notation `<produit>_<normalisé>` dans les fichiers `ANNOTATIONS/*.txt` | **955 paires dans 63 copies** (~15/copie) récupérées de la partie lisible : `déja`→`déjà`, `commencait`→`commençait`, `appercevoir`→`apercevoir`, `rempli`→`remplis`, `énervé`→`énervée`, **`marché`→`marcher`, `monté`→`monter`** (la famille -é/-er, cible n°1) | ⚠️ voir 6.3 : l'archive déposée est **tronquée** |
| `akufeldt/fr-gec-dataset` (HF) | corruptions **synthétiques ÉTIQUETÉES par famille** (`GenderDeterminerDestroyer`, `PersonVerbDisagreement`, `ApostropheChanger`, `RandomTypo`…) | 59 850 train / 3 325 dev / 3 325 test ; colonne `modified` préfixée `fix grammar: ` (à retirer) | pas de licence déclarée ; sans compte |

### 6.2 Les dictées, elles, existent — mais derrière un compte

**Scoledit** (LIDILEM, Grenoble) est le seul corpus FR trouvé qui contienne de **vraies dictées** :
dictée en juin au CP (2014), puis au CE1 (2015) — six mots (`patin, pâtisson, capuchon, récréation,
charitable, magnifique`) et deux phrases — sur la même cohorte, avec un **aligneur forme produite ↔
forme normalisée** (Wolfarth, Brissaud & Ponton 2018). Les pages `dictees.php` et `recherche.php` de
`scoledit.org` **renvoient le formulaire de connexion** (vérifié) : la couche normalisée n'est pas
publique. Compte gratuit sur demande — `claude.ponton [@] univ-grenoble-alpes.fr`. **C'est la
démarche à faire** si on veut de la dictée corrigée en volume.

### 6.3 Falsifié / à ne pas refaire (mesuré le 07/09/2026)

- **E-CALM v2 ne contient AUCUNE correction.** Arbre complet tiré (`repository.ortolang.fr/api/content/`,
  navigable sans compte) : **2 078 fichiers XML**, CP→3e, **461 066 mots** de corps de texte
  (Scoledit 337×5, Resolco 393). Comptage des balises TEI de correction `<corr|reg|choice|sic>` :
  **0 fichier sur 2 078**. Seuls `<mod>`, `<add>`, `<gap>` sont là = les ratures de l'élève.
  Le *Guide de transcription v1.8* le dit d'ailleurs : transcription « pseudo-diplomatique », et
  « les temps suivants (commentaires de l'enseignant, corrections par l'élève…) seront traités
  ultérieurement ». → **E-CALM = corpus de fautes SANS gold.** Licence des fichiers : CC BY-NC-SA 3.0 FR
  (l'attribut `target` du TEI pointe pourtant `by-sa/3.0` — incohérence à signaler).
- **`ECRISCOL.zip` du dépôt ORTOLANG est tronqué à la source.** `Content-Length` = 112 197 632 octets
  = **exactement 107 Mio** ; un `Range` au-delà rend **416** → rien de plus n'existe côté serveur.
  L'archive n'a **aucun répertoire central** (0 signature `PK`, 0 EOCD) et seulement
  **94 en-têtes locaux** : illisible par `unzip`, récupérable seulement en marchant les en-têtes.
  Identique dans `e-calm/v2` et `e-calm/latest` (même `Last-Modified`). → **écrire aux déposants**
  (CLESTHIA / ORTOLANG) : c'est là que sont les 955 paires × N classes.
- **MultiGEC-2025 : toujours pas de français** (12 langues : cs, en, et, de, el, is, it, lv, ru, sl,
  sv, uk). Le §1 le disait pour MultiGED-2023 ; l'édition 2025 ne change rien.
- **Corpus d'apprenants ORTOLANG (`captur-fle` 120 essais, `ceaal2` 292 textes)** : les erreurs sont
  conservées mais « le corpus n'est pas annoté » — **pas de gold**, et CC BY-NC-ND 3.0 (pas de dérivé).

### 6.4 Ce que ça change pour nous

Le vrai manque n'est pas « des textes fautifs » — il y en a partout (461 066 mots rien qu'en E-CALM) —
c'est **la correction alignée**. Trois pistes, dans cet ordre de coût :
1. `fetch_frgec_pairs.py` tourne déjà : ~1,5 M de paires candidates, licence compatible, **en phrase**.
   À TRIER (le filtre laisse passer `pinde`→`macédoine`) : c'est un gisement, jamais un gold.
2. Un mail à Scoledit (dictées alignées) et un mail aux déposants d'ECRISCOL (archive cassée).
3. E-CALM sans gold reste utile pour ce qu'il est : de l'écrit d'élève RÉEL pour observer les
   **silences** du correcteur — pas pour mesurer FP=0, qui exige du texte juste.

### Sources (§6)
- French_GEC — https://www.kaggle.com/datasets/isakbiderre/french-gec-dataset · https://huggingface.co/datasets/FrancophonIA/French_GEC
- E-CALM (arbre navigable, sans compte) — https://repository.ortolang.fr/api/content/e-calm/latest/ · guide : `Guides/Guide de transcription v1.8.pdf`
- Scoledit — http://scoledit.org/scoledit/ (dictées + recherche = compte requis) · dépôt : https://repository.ortolang.fr/api/content/scoledit/latest/
- MultiGEC-2025 — https://spraakbanken.gu.se/en/compsla/multigec-2025 · https://aclanthology.org/2025.nlp4call-1.1/
- HF — https://huggingface.co/datasets/akufeldt/fr-gec-dataset · https://huggingface.co/datasets/datasets-CNRS/captur-fle · https://huggingface.co/datasets/datasets-CNRS/ceaal2

*(Veille 2026-09-07. Rappel §4 : toute donnée intégrée doit préserver FP=0 et être citée dans `NOTICE`.)*

---

*(Veille datée 2026-06-21 ; à compléter au fil de l'eau. Données dérivées Lexique 4 → CC BY-SA 4.0, voir NOTICE.)*
