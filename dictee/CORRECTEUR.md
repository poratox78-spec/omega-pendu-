# Correcteur dys (semi-direct) — direction & probe de faisabilité

> ⚠️ **REQUALIFICATION « FP=0 » (mesuré 2026-06-21/22).** Le « FP=0 » de ce correcteur valait sur les **batteries
> curées** (30 phrases + 98 GEC, courtes/simples). Mesuré sur **16 342 vraies phrases correctes** (UD French),
> le taux de faux positifs réel était **6,0 %**, ramené à **2,35 %** par 5 lots de durcissement + un **POS-tagger
> 155k** (réutilise le lexique embarqué du pendu), tous **FP-safe = abstention pure** (`dictee/fp_stress_test.py` ;
> détail `JOURNAL.md`). **Formulation correcte : « FP=0 sur batterie ; ~2,5 % sur français encyclopédique réel,
> en baisse »** (le domaine *dys* — phrases courtes — est plus bas, mais pas 0).

> Idée (Rem) : une fois le levier d'accord en place, en faire un **correcteur orthographique dys** « semi-direct ».
> Recadrage clé : le correcteur **roule sur le moteur de DICTÉE** (`diag_sentence.py`), pas sur le pendu — il traite
> donc **toutes les longueurs** (le `MIN_WORD_LEN=7` du pendu ne s'applique pas), et vit dans le **régime mot-court**
> où l'accord paie (cf. `evo/PHRASE_HANGMAN_PROBE.md` : le pendu nous a servi de banc, pas de débouché).

## Ce qui distingue ce correcteur (≠ Antidote/Grammalecte/LanguageTool)
Il **détecte + corrige + situe l'erreur dans un STADE développemental** (phono → alphabétique → lexical →
morphosyntaxique) pour la **remédiation dys**. Angle pédagogique, cible n°1 du projet — pas « encore un correcteur ».

## Intégration SANS l'app (sans UI/DOM) — empreinte vérifiée
Le moteur (grammaire + orthographe + hybride) s'intègre ailleurs **sans le jeu, sans l'UI, sans le DOM** :
- **Python** : déjà standalone — `from speller_probe import Speller; Speller().correct_text(t)` et `import correcteur_probe`.
- **JS, liée à l'app** : `dictee/correcteur.js` — `const c = await require('./dictee/correcteur').create(); c.correct(t)`.
  Réutilise le monolithe comme **source unique** (extrait la tranche moteur, bouchon DOM minimal) → zéro drift.
- **JS, autonome (HTML non requis)** : `node dictee/build_correcteur.js` bake moteur + lexiques dans **un seul
  fichier** (`correcteur.standalone.js`, ~2,5 Mo) → `const C=require('./correcteur.standalone.js'); await C.init(); C.correct(t)`.
- **Empreinte mesurée** : 48 Ko de code + **2,11 Mo de données** (grammaire `cgram_hf` 1,55 Mo + orthographe
  `speller-lex` 0,56 Mo). **PAS besoin** du lexique moteur du pendu (`lex4-data-gz`, 5,52 Mo) ni du code du jeu →
  intégration **2,16 Mo** vs app 8,25 Mo. Runtime : `DecompressionStream/atob/Blob/Response` (Node ≥18 / navigateur).
- API : `correct(t)` (fusion) · `grammar(t)` (règles seules) · `spell(t)` (orthographe seule) → `[{i,word,sugg,name,tier}]`.

## Couche ORTHOGRAPHIQUE (non-mots / accents / typos / phonétique) — temps réel
Au-delà des règles grammaticales : un vrai correcteur orthographique qui corrige les **non-mots** (formes absentes
du lexique). Hybride, dans l'app (panneau « 🩹 Correcteur », debounce 350 ms = temps réel) :
- **Couche ortho** (`dictee/speller_probe.py` ; miroir JS dans l'app) : pour un non-mot, cherche le meilleur
  candidat dans le lexique COMPLET — **restauration d'accents** (deacc→accentué) + **distance d'édition 1** +
  **route PHONÉTIQUE** (clé `phon_key` : ph→f, ç→s, qu→k, finales muettes… ; cible dys = fautes phonologiques).
  Classement : accent d'abord, puis **match phonétique**, puis fréquence.
- **2 niveaux de confiance** (choix produit : auto-corriger le sûr) :
  - **AUTO** (remplace seul) : restauration d'accent NON ambiguë + dominante (≥3 lettres). Toujours **même
    longueur** → curseur préservé. Ex. `fenetre→fenêtre`, `derniere→dernière`. **FP=0 mesuré** (cardinal : change
    le texte en silence).
  - **FLAG** (souligne bleu, clic) : candidat plausible incertain. Ex. `leson→leçon`, `gato→gâteau`,
    `téléfone→téléphone`, `Lannée→l'année`. FP FLAG = mots rares/OOV/noms propres → non destructif.
- **Abstention** : mot valide (→ couche grammaire), nom propre (majuscule hors début), néologisme sans voisin.
- **Embarqué** : bloc `speller-lex-gz` (92 743 formes accentuées + freq, gzip+base64 0,56 Mo, décompressé via
  DecompressionStream). Généré par `dictee/build_speller_lex.py`. Le moteur JS = miroir exact du Python.
- **Mesuré** (vrai corpus GEC, 98 phrases) : **AUTO FP=0/98** ; non-mots corrigés exactement **58 %** ;
  FLAG-FP=12 (OOV/rares, non destructif). Vérifié headless (`dictee/test_speller_app.js`, en CI).
- **HYBRIDE (fait)** : la **voie grammaire désambiguïse les candidats du speller** par accord genre/nombre du
  contexte (déterminant/nom-tête proche, en sautant les copules est/sont/semble) + **bascule de paire d'adjectif**
  (`cgram_adj`). Résultat : `fote→faute`, `gross→grosse`, `premiere→premier`, `blanch→blanche` (le genre du
  contexte tranche), sans casser l'AUTO accent. Accord = bonus (jamais pénalité). Câblé Python **et** app (champ
  embarqué `a` = paires adjectif), parité vérifiée. AUTO FP=0 préservé.

## Le seul vrai inconnu, mesuré : détecter/corriger SANS corrigé
La dictée connaît la cible ; un correcteur non → il doit **inférer l'intention**. Probe : `dictee/correcteur_probe.py`
(`python3 dictee/correcteur_probe.py`). Pour chaque homophone grammatical, une règle `decide(T,i)` tranche la bonne
forme via le contexte (voisins, POS, accord — réutilise `diag_sentence`). Le correcteur **flague** si tapé ≠ décidé
et **propose** la forme décidée.

### Résultat (détection ET correction, faite une seule fois) — après étape 1 (couverture élargie)
- **Faux positifs sur 30 phrases CORRECTES : 0** ✅ (condition n°1 : ne pas « corriger » du texte juste).
- **Détection + correction : 21/24** témoins avec `cgram` (défaut du dépôt, le fichier est commité) ;
  **22/24** avec la liste blanche compacte (cf. étape 3) — était 13/16 avant l'élargissement verbal.
  *(L'écart 22→21 vient des homographes nom+verbe que `cgram` fait passer pour verbes — cf. étape 3.)*

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
Le cœur du correcteur (détecter + corriger sans corrigé) **marche, avec 0 faux positif sur batterie** (curée) et
**~2,5 % sur français réel** (UD French, après durcissement — cf. note en tête) sur les confusions à discriminateur propre. C'est constructible **sur l'existant** (levier d'accord + `phono_homophones.json`), sans le
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
Corpus réel fourni (`dictee/corpus_gec_fr.jsonl`, **suivi dans le repo** depuis PR #10 — provenance à confirmer) → `dictee/eval_gec.py`. **Test cardinal = faux positifs
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

## Accord SUJET-VERBE — branché (route lexicale Lexique4 `cgram_conj.json`), FP=0
Recadrage terrain (Rem teste « Les enfant joue… Je doit manger. On ont gagné. ») : le correcteur ne couvrait **que
8 homophones**, or les vraies copies dys ont surtout des **accords**. On a donc ajouté l'**accord sujet-verbe** —
le levier d'accord existait déjà côté DIAGNOSTIC, ici on le retourne en CORRECTION (§5 réutilise l'existant).
- **Donnée** : `9_InfoVER` (mode:temps:personne) + `8_Nombre` de Lexique 4 → table de conjugaison
  `cgram_conj.json` (8 018 formes / 2 404 lemmes ; `build_cgram.py`). `f` = forme→lectures finies (lemme;mt;pers;nb),
  `c` = lemme→temps→slot(« 3s »)→forme. Sous-ensemble HF (présent+imparfait) **embarqué dans l'app**.
- **Règle** `rule_accord_sv` : (1) sujet = **pronom isolé** je/tu/il/elle/on/ils/elles (personne+nombre certains ;
  nous/vous écartés car ambigus avec le clitique objet « il **nous** voit ») ; (2) on flague le verbe **seulement
  si AUCUNE lecture finie n'admet (personne,nombre)** du sujet ; (3) la correction n'est proposée **que si la forme
  suggérée est elle-même confirmée** par la table comme (pers,nombre) du sujet — auto-garde contre le bruit Lexique.
- **Bruit Lexique neutralisé** (sinon FP/mauvaises corrections) : (a) `peux` est tagué nombre=`p` (faux) → pour la
  1re/2e pers. (toujours sing.) on n'exige que la **personne** ; (b) l'**infinitif** porte des tags finis parasites
  (`chanter:ind:pre:2`) → écarté quand forme=lemme ; (c) `8_Nombre` vide fréquent au présent des -er (`travaille`) →
  **nombre déduit de la morphologie** (-ons/-ez=pluriel ; 3e pers. -ent/-ont=ambigu→wildcard ; sinon sing.) ;
  (d) participe mal tagué présent (`joué:ind:pre:1`) → écarté des slots présents.
- **Sujet PRONOM** (`rule_accord_sv`) et **sujet NOM** (`rule_accord_sv_noun`, ajouté après test terrain Rem
  « les enfants joue ») : le sujet-nom couvre le **déterminant pluriel EN TÊTE de phrase** (les/des/ces… → verbe au
  pluriel : « les enfants **joue** »→jouent, « Les oiseaux **chante** »→chantent). **FP=0 sans lexique de noms** :
  en tête, aucun génitif/PP/objet-de-verbe possible à gauche → on évite tous ces pièges (« la préparation **des**
  mahashi », « protéger **les** infrastructures ») ; garde structure = nom-tête toléré (homographe « voitures »),
  tout verbe intercalé après (sous-phrase « les feuilles **tombent**, l'automne est ») → abstention. Direction
  unique sûre = pluriel→3p (singulier→3p écarté : sujet coordonné « le chien **et** le chat mangent »).
- **Mesuré** : témoins 8/8 (5 pronom + 3 nom), held-out **11/11 sur vocabulaire NEUF** (chanter/travailler/regarder/
  inventer/ranger/nettoyer + oiseaux/voitures/fleurs/chiens/nuages) → **généralise**. **Faux positifs : 0** (30
  phrases, 8 témoins SV, **98 phrases réelles GEC**, held-out). Corpus réel : **3/12** accords SV détectés (sujet
  pronom + nom-en-tête ; le reste = sujets-noms en sous-phrase/distance → abstention assumée, FP=0 cardinal).
- **Choix assumé** : on corrige le **verbe** pour qu'il s'accorde au sujet écrit (« il sont »→« il **est** »), pas le
  sujet ; règle explicable, enseignable. **Parité APP↔Python** vérifiée (`parity_corr.js`, en CI ; invariant
  flags-app ⊆ flags-Python : l'app au lexique HF compressé s'abstient sur les verbes rares, jamais de FP propre).
- **Hors portée (honnête)** : « ils **ont** content » n'est PAS flagué — « ont » s'accorde avec « ils » (avoir 3pl) ;
  l'erreur réelle est avoir↔être (sémantique) + « content »→« contents » (accord adjectif) — deux autres chantiers.

## Accord GENRE déterminant→nom (`rule_det_gender`) — la catégorie dominante du réel
- Le **corpus GEC réel** le montre : le genre du déterminant (« un adhésion »→une, « la fondateur »→le, « Ma
  appartement »→Mon) est l'erreur **la plus fréquente** — PR #7/#9 la classaient hors-périmètre. La **complétude**
  de `cgram_gender` (53 050 noms, récupérée du Lexique4 complet) la rend attaquable.
- Mécanique, bornée **FP=0** : déterminant à genre certain (un/une/le/la/ce/cet/cette/mon/ma/ton/ta/son/sa) + **nom
  PUR** juste après → genre(dét)≠genre(nom) → corrige. « Pur » = champ embarqué **`gn`** (genre non ambigu **MOINS
  verbes MOINS adjectifs**, pré-filtré au build avec les lexiques pleins) → écarte le/la pronom-objet (« je le
  vois »), les homographes (« porte »=verbe, « rouge »=adj, « poste »/« tour » ambigus), l'élision (l'). Distinct de
  `rule_genre_adj` (adjectifs), qui reste **NON branchée** (FP-insûre sans POS) — la contrainte déterminant×nom-pur suffit.
- **Mesuré** sur le vrai GEC (98 paires) : **FP=0/98** ; genre déterminant **17/27 détectés+corrigés**. Périmètre
  in-scope 13→40, détection 3→20. **Câblé dans l'app** (JS `rDetGenre`) avec **parité EXACTE** (même `gn`, même
  logique ; 50 phrases, app == Python). vdc-lex porte `gn` (46 712 noms purs).
- **Garde POS-155k (durcissement FP, 2026-06-22)** : sur du **français réel** (UD French), le genre déterminant était
  la catégorie de FP n°1 (« la **droite** », « un **boucher** », « une **garde** » = homographes nom/verbe/adj que
  `gn` ne filtrait pas tous). §5 anti-réinvention : le pendu embarque déjà `OMEGA_LEX4` (155 493 mots, champ `g` =
  cgram, `nbhomog`) → `dictee/build_pos.py` en extrait `cgram_pos.json = {forme:[POS,freq,nbhomog]}` (aucune nouvelle
  dépendance). `rule_det_gender` / `rDetGenre` **abstient** désormais aussi si le mot après le déterminant a
  **POS ≠ NOM** OU **nbhomog > 1**. Effet mesuré : genre déterminant **91 → 61 FP** sur les 16 342 phrases, **recall
  intact** (batterie genre 4/4). **Parité 3 moteurs par construction** (même lexique) : app lit `OMEGA_LEX4` direct ;
  l'extension charge l'asset `pos-abstain.txt.gz` (SET des formes à abstenir, `build_assets.py`) ; `correcteur.js`
  décompresse `lex4-data-gz`. CI : `build_pos.py` avant `build_assets.py`, puis les parités `parity_corr`/`parity_core`.

## FALSIFIÉ — garde-fous NbHomoph/Preval en abstention (ne pas refaire)
Idée écartée : utiliser `24_NbHomoph` / `33_Preval` (récupérés du Lexique) pour **abstenir** et « remplacer les
listes manuelles » (`VLIKE_STOP`). **Falsifié par mesure** :
- **NbHomoph est incompatible** avec ce correcteur : ses déclencheurs SONT des homophones (sont/est/ont/on/a/peut/
  leur/dois/joue… **tous** dans le set NbHomoph≥2) — c'est sa raison d'être. Abstenir sur les homophones **tue
  toutes les règles** (et perdrait 6/20 détections genre-dét) pour **zéro gain** (FP déjà 0).
- **Preval est neutre** : 0 des noms détectés est peu-connu → aucun FP évité, aucune détection perdue.
→ Le FP étant déjà 0, une abstention de plus ne peut que **coûter du rappel**. Données `cgram_guard.json` **gardées
comme artefact** (usage possible dans une future détection de typo/mot-rare), **non câblées** dans le correcteur.

## FALSIFIÉ — « did you mean » fréquence (jonction 7, classe vrai-mot-rare ; ne pas refaire)
Idée (bilan stress-test) : corriger un **vrai mot rare** que le speller ne touche pas (`balon`, `tan`, `voudrai`)
en le ré-ordonnant vers un voisin **plus fréquent** (`ballon`, `tant`, `voudrais`), gardé FLAG, FP chiffré sur le GEC.
**Mesuré (`dictee/didyoumean_probe.py`, lexique embarqué + 98 paires GEC) → FALSIFIÉ** :
- variante **large** (rare<seuil × voisin dominant) : **8→58 FP** / 98 correctes pour **0→3 corrections** / 152 erreurs vrai-mot.
- variante **stricte** (edit-1 + phonétiquement **identique** + dominant) : **3→10 FP** pour **0→1 correction**.
- **Aucun réglage n'atteint FP=0.** Les FP irréductibles sont de **vrais mots rares à voisin fréquent phon-identique**
  (`vainc→vain`, `coll→cool`, `absorbeur→absorber`, `croît→crois`…) — **indissociables d'un typo SANS contexte**. Et
  `voudrai` (= futur correct « je voudrai ») montre qu'un seuil de fréquence corrigerait du **juste**.
→ La classe « vrai-mot-rare » exige un **modèle de CONTEXTE** (LLM-grade) ; le **C lourd transformer est déjà falsifié**
(CLAUDE.md). **Ne pas câbler de règle fréquence.** *Nuance* : la variante stricte corrige `balon→ballon` ET laisse
`tan`/`voudrai` (correctement), mais les 3 FP irréductibles tuent le cardinal FP=0. Sonde gardée (régression : la
falsification doit **rester** vraie). **Classe A** (`doi→doigt`, `mangont→mangeons`) = problème **différent** : le bon mot
n'est même pas candidat (distance-2 + lettres muettes, clé phon `doigt`=`dvag` ≠ `doi`=`dva`) → relève d'une **clé
phonétique** sachant les finales muettes (route phon), pas du « did you mean ».

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
4. ✅ **Accord SUJET-VERBE** (sujet pronom **et** sujet nom-en-tête) : route lexicale `cgram_conj.json` → « Je doit »→dois,
   « On ont »→a, « il sont »→est, « Tu chante »→chantes, **« les enfants joue »→jouent**… **FP=0**, held-out 11/11 (vocab neuf),
   parité app↔Python. Voir section ci-dessus.
5. ⬜ **Accord sujet-verbe à sujet NOM en sous-phrase/distance** (au-delà du déterminant en tête) : exige une vraie
   analyse de la structure (le déterminant-heuristique crée des FP sur génitifs/PP/sujets coordonnés) → reporté.
6. ⬜ **Accord du nom/déterminant** (« Les enfant »→enfants) et **genre** (« une robe vert »→verte) dans le correcteur :
   exigent un POS/tagger en contexte (cf. `rule_genre_adj` mesurée FP-insûre) — restent au DIAGNOSTIC pour l'instant.
7. ⬜ **Couche typo** : mot hors-lexique → plus proches voisins (édition + phon) → fautes non-homophones (nécessite le lexique).
8. ⬜ **Double voie grammaire** (ascendante/descendante) : voir `DICTEE_ROADMAP.md` / discussion en cours.
