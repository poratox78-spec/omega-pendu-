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

### Sources
- LanguageTool — https://github.com/languagetool-org/languagetool · https://languagetool.org/spellchecking-french
- Grammalecte / dicollecte — https://alternativeto.net/software/grammalecte/about/ · https://github.com/FrancoisCapon/GrammalecteDictionariesWithoutOptionalDataFields
- Lefff — https://aclanthology.org/L10-1487/ · http://atoll.inria.fr/~sagot/pub/lrec10lefff.pdf
- MultiGED-2023 — https://spraakbanken.github.io/multiged-2023/ · https://spraakbanken.gu.se/en/resources/multiged
- E-CALM / RésolCo — https://e-calm.huma-num.fr/corpus.html · https://www.ortolang.fr/market/corpora/e-calm
- HF FR spelling — https://huggingface.co/datasets/fdemelo/spelling-correction-french-news · https://huggingface.co/PoloHuggingface/French_grammar_error_corrector
- Dys FR — https://link.springer.com/article/10.1007/s10579-022-09603-6 (review) · https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9878594/ (dictée FR, annotation type d'erreur)
- cLang-8 — https://github.com/google-research-datasets/clang8

*(Veille datée 2026-06-21 ; à compléter au fil de l'eau. Données dérivées Lexique 4 → CC BY-SA 4.0, voir NOTICE.)*
