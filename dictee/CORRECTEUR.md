# Correcteur dys (semi-direct) — direction & probe de faisabilité

> Idée (Rem) : une fois le levier d'accord en place, en faire un **correcteur orthographique dys** « semi-direct ».
> Recadrage clé : le correcteur **roule sur le moteur de DICTÉE** (`diag_sentence.py`), pas sur le pendu — il traite
> donc **toutes les longueurs** (le `MIN_WORD_LEN=7` du pendu ne s'applique pas), et vit dans le **régime mot-court**
> où l'accord paie (cf. `evo/PHRASE_HANGMAN_PROBE.md` : le pendu nous a servi de banc, pas de débouché).

## Ce qui distingue ce correcteur (≠ Antidote/Grammalecte/LanguageTool)
Il **détecte + corrige + situe l'erreur dans un STADE développemental** (phono → alphabétique → lexical →
morphosyntaxique) pour la **remédiation dys**. Angle pédagogique, cible n°1 du projet — pas « encore un correcteur ».

## Le seul vrai inconnu, mesuré : détecter/corriger SANS corrigé
La dictée connaît la cible ; un correcteur non → il doit **inférer l'intention**. Probe : `dictee/correcteur_probe.py`
(`python3 dictee/correcteur_probe.py`). Pour chaque homophone grammatical, une règle `decide(T,i)` tranche la bonne
forme via le contexte (voisins, POS, accord — réutilise `diag_sentence`). Le correcteur **flague** si tapé ≠ décidé
et **propose** la forme décidée.

### Résultat (détection ET correction, faite une seule fois) — après étape 1 (couverture élargie)
- **Faux positifs sur 30 phrases CORRECTES : 0** ✅ (condition n°1 : ne pas « corriger » du texte juste).
- **Détection + correction : 22/24** témoins (était 13/16 avant l'élargissement verbal).

| confusion | fp | détection | correction |
|---|---|---|---|
| `-é/-er` (mangé/manger) | 0/3 | 3/3 | 3/3 |
| `son/sont` | 0/3 | 3/3 | 3/3 |
| `leur/leurs` | 0/3 | 3/3 | 3/3 |
| `on/ont` | 0/5 | 5/5 | 5/5 |
| `a/à` | 0/3 | 3/3 | 3/3 |
| `peu/peux/peut` | 0/3 | 3/3 | 3/3 |
| `et/est` | 0/2 | 1/2 | 1/2 |
| `ce/se` | 0/2 | 1/2 | 1/2 |

### Étape 1 : couverture verbale élargie SANS le lexique 34 Mo
`is_verb` du levier dictée est un stub de 32 formes du corpus (il ignore « mange », « va »…). On l'a doublé d'une
**liste blanche de formes verbales fréquentes** (exactes → 0 FP par sur-généralisation) : `vlike()`. Ça débloque
`a/à`, `on/ont`, `peu/peux/peut` **sans** le lexique. Restent partiels : `et/est` (seule la direction `et→est` est
sûre ; `est→et` exige détecter un parallélisme de noms, sémantique) et `ce/se` (couverture pronominale limitée).
**Lexique4 `cgram` (étape 3)** remplacera la liste blanche → couverture verbale complète + scaling hors-corpus.

## Verdict
Le cœur du correcteur (détecter + corriger sans corrigé) **marche, avec 0 faux positif** sur les confusions à
discriminateur propre. C'est constructible **sur l'existant** (levier d'accord + `phono_homophones.json`), sans le
lexique 34 Mo (nécessaire seulement pour la couche « typo / non-mot » et pour élargir `is_verb`).

## Accord en genre dans le CORRECTEUR — tenté, mesuré FP-insûr, NON branché (§6)
Pour donner « le genre » au correcteur, on a généré les paires adjectivales (`cgram_adj.json`, 16 755 : vert↔verte…)
et une règle `rule_genre_adj`. **Mesure** : sans garde → **3 FP** sur le corpus correct (« maîtresse »/« écrit »
pris pour adjectifs ; « rouges » pris pour nom-tête). Avec garde « adjectif pur » (≠ verbe ≠ nom) → **détection 0/3**
car *presque toutes* les formes adjectivales sont aussi des NOMS dans Lexique4 (blanche/noire = notes, grande, vert…).
**Conclusion** : l'accord en genre dans le correcteur exige un **POS en contexte (tagger)**, pas la seule appartenance
lexicale → règle **non branchée** (FP=0 cardinal). La route lexicale du genre **reste** dans le DIAGNOSTIC
(`diag_sentence.lexical_gender`, mesurée 3/3) où elle ne se déclenche que sur une erreur d'accord déjà détectée.
`cgram_adj.json` est conservé comme **asset** pour un futur correcteur à tagger.

## Validation sur VRAI corpus (Rem, 98 paires GEC FR) — FP 0 après durcissement
Corpus réel fourni (`dictee/corpus_gec_fr.jsonl`, hors-repo) → `dictee/eval_gec.py`. **Test cardinal = faux positifs
sur les 98 phrases CORRECTES** (texte Wikipédia réel, multi-clauses).
- 1re passe : **11 FP** (0,11/phrase) → le « 0 FP » synthétique était optimiste, le réel l'a **falsifié**.
- Mécanismes trouvés : (a) `deacc("à")=="a"` collisionnait avec l'auxiliaire *a* (→ « à décider » lu « a décidé ») ;
  (b) cgram (12 k) contient des **homographes courts** de mots-outils (« ne », « le »…) → `vlike` mordait ;
  (c) `PART_FORMS` stub rate les vrais participes (« incarné ») → `on/ont` ; tokens contractés (« l'été »).
- Durcissement : à/a distingués (token original), `VLIKE_STOP` (mots-outils exclus de la détection verbale), tokens
  apostrophés ignorés en -é/-er, `on/ont` détecte le participe par suffixe, et surtout **les règles ambiguës
  (`son/sont`, `ce/se`, `et/est`) ABSTIENNENT au lieu de deviner** (un correcteur ne doit pas toucher au juste).
- Résultat : **FP 11 → 0 / 98** (Python ET app, parité vérifiée). Coût : −2 détections in-corpus (22→20), −1 held-out
  (12→11) sur des témoins ambigus — échange assumé (FP=0 est cardinal).
- **Périmètre vs réel** : sur ces 98 paires, **1 seule** erreur tombe dans les 8 confusions du correcteur (le reste =
  genre du déterminant un/une, nombre, ordre des mots, mots manquants, typos — **hors périmètre**). Honnête : le
  correcteur est **FP-safe sur du réel** mais **couvre une petite part** des erreurs réelles → la couche large
  (genre déterminant, nombre, typo) reste à faire et exige un POS/tagger.

## Validation indépendante (held-out) & collecte en ligne
- **Held-out** (`corpus_externe.json` + `eval_externe.py`) : 15 phrases à **vocabulaire neuf** (distinct du corpus
  et des témoins), confusions choisies d'après les erreurs FR documentées comme fréquentes. → **12/15 détection+correction,
  **0 faux positif** : les règles **généralisent** (elles sont contextuelles, pas mémorisées) et cgram porte la
  couverture verbale au-delà du corpus. *(A révélé un vrai bug `son/sont` — règle passée de `is_verb` stub à `vlike` cgram.)*
- **Collecte en ligne** : sources ouvertes repérées — `juancavallotti/multilingual-gec` (~67 k phrases FR),
  GitHub Typo Corpus, Lang-8. Loader prêt : `fetch_gec_corpus.py`. ⚠️ Dans la session cloud, l'égress vers
  `datasets-server.huggingface.co` est **bloqué** (allowlist) → le loader tourne là où l'égress l'autorise.

## Suite (jonctions) — état
1. ✅ **Plus de règles + couverture verbale élargie** (étape 1) : liste blanche `vlike` + peu/peux/peut, ce/se → 22/24, 0 FP.
2. ✅ **UI semi-directe** (étape 2) : bouton « 🩹 Correcteur » dans l'app — colle ton texte, souligne les fautes
   (survol = correction), liste + **stade**, correction en semi-direct (débounce). OFF-inerte, R66. Parité JS↔Python vérifiée.
3. ✅ **Lexique4 `cgram`** (étape 3, **fait**) : lexique reçu → `build_cgram.py` → `cgram_verbs.json` (**12 415 formes
   verbales**, freq≥0.5), chargé automatiquement par `vlike` (sinon repli liste blanche).
   **Mesuré** : couverture verbale complète pour le **texte réel** (la liste blanche en raterait des milliers) ;
   FP toujours **0**. MAIS sur le jeu-témoin contrived : 21/24 (vs 22/24 liste blanche) car cgram fait passer les
   **homographes nom+verbe** (livre, porte, trouve, calme, lit…) pour des verbes → trompe la règle faible `ce/se`.
   **Leçon (= design double-voie)** : la route lexicale cgram doit être **croisée avec le contexte (jointe §3)**, pas
   utilisée comme drapeau « est-un-verbe » brut. L'app garde la liste blanche compacte ; le probe Python utilise cgram.
   **Vrai gisement non exploité : les colonnes `7_Genre` / `8_Nombre`** → une route lexicale du GENRE (accord
   nom/adjectif) qu'on ne sait PAS faire aujourd'hui (on n'infère le genre que via le déterminant).
3b. ✅ **Port APP des lexiques** : `build_cgram.py` émet aussi `cgram_hf.json` (sous-ensemble haute-fréquence,
   freq≥5 : **3454 verbes + 4178 noms genrés**, 88 Ko), embarqué dans l'app via un bloc `<script type="application/json"
   id="vdc-lex">` lu par l'IIFE → `vlike` (couverture verbale) + `lexicalGender` (route lexicale du genre dans le
   diagnostic navigateur). Repli liste blanche si le bloc est absent. FP corpus = 0. CI verte ; harnais `evo/` mis à
   jour pour ignorer les blocs `application/json`.
4. ⬜ **Couche typo** : mot hors-lexique → plus proches voisins (édition + phon) → fautes non-homophones (nécessite le lexique).
5. ⬜ **Double voie grammaire** (ascendante/descendante) : voir `DICTEE_ROADMAP.md` / discussion en cours.
