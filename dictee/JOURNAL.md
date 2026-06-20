# Dictée diagnostique — Journal

> Journal de bord (entrée la plus récente en haut) pour ne pas se perdre ni refaire deux fois.
> Voir aussi : `../DICTEE_ROADMAP.md` (plan), `README.md` (données), `../docs/MEMOIRE.html` (moteur OMEGA).

---

## 2026-06-20 — VOLET LLM démarré (correcteur, opt-in en ligne) — 1re brique

Les 3 fronts butent — **mesuré** — sur le CONTEXTE (correcteur : did-you-mean falsifié ; décodeur : g2p-sur-typo ;
trexquant : morpho = 0 Δ sur n-gram). Conclusion de Rem actée : **le levier partout = le LLM**. On démarre par le
**correcteur** (douleur réelle).

**Plafond démontré** (moi = LLM) sur la phrase qui mettait les règles à zéro : « je sui dan le voiture, et j'est
bouliées mais lunettes » → **« Je suis dans la voiture, et j'ai oublié mes lunettes. »** = **6/6** corrections (sui→suis,
dan→dans, le→la voiture, j'est→j'ai, bouliées→oublié, mais→mes) **contre 0/6 pour les règles**. Le plafond est réel.

**Faisabilité env** : égress vers les API LLM **ouvert** (api.anthropic.com/openai joignables, ≠ Drive/HF bloqués) ;
**aucune clé embarquée** utilisable → l'**utilisateur apporte sa clé**. ⇒ approche **hybride opt-in EN LIGNE**.

**Doctrine / vie privée** : le correcteur dys promet « hors-ligne, aucune donnée envoyée ». Le LLM **casse** cette
promesse → la 1re brique est **OFF par défaut**, **opt-in explicite** (pas de clé = aucun appel réseau, vérifié), pour
un futur mode UI **déclaré** (consentement).

**1re brique livrée** : `dictee/llm_correcteur.py` — le **prompt dys** soigné (conservateur : corrige sans reformuler,
sortie JSON `{corrige, fautes:[{ecrit,correct,famille}]}`) + appel endpoint **OpenAI-compatible** (env `LLM_API_URL/
LLM_API_KEY/LLM_MODEL`) + harnais **`--eval`** (récall + **FP cardinal sur le `good`** du GEC, à comparer aux règles
`eval_gec.py`). Non câblé dans l'app, pas en CI (dépend clé/réseau).
**Suite** : (1) mesurer récall/FP réel du LLM sur le GEC (avec clé) ; (2) intégration app = panneau opt-in + consentement,
LLM en **surcouche du FLAG** (les règles restent la base hors-ligne) ; (3) arbitrer le modèle (qualité × coût × local).

**MAJ — plafond mesuré (1) + intégration app (2) faites :**
- **Plafond** (Claude Opus = correcteur, échantillon GEC : 30 correctes + 16 fautives) : **récall ~total** (genre/accord/
  conjugaison/élision/typo = les familles où les règles font 0), **FP ≈ 1/30** (souvent défendable ; **découverte : le
  gold GEC contient des fautes** — ex. « l'orthographe ancien » → ancienne — donc le FP est *sous-estimé contre ce gold*).
  Verdict : à qualité forte, volet **massivement justifié** ; seul risque = sur-correction (faible, modèle fort + prompt strict).
- **Intégration app** : panneau 🩹 Correcteur, section **« 🤖 IA (en ligne, opt-in) »** — checkbox OFF par défaut +
  avertissement vie privée + clé/endpoint/modèle saisis dans l'UI (localStorage, jamais committé) + bouton **« ✨ Corriger
  avec l'IA »** (pas d'appel à chaque frappe = coût maîtrisé). Sortie : phrase corrigée (« appliquer tout ») + fautes
  cliquables par mot, **par-dessus** les soulignements hors-ligne (les règles restent la base ; aucun `fetch` sans opt-in
  explicite). Bloc compile (CI `new Function`), parité + speller intacts. Appel **OpenAI-compatible** (miroir de
  `dictee/llm_correcteur.py`). **Reste (3)** : arbitrer le modèle bon-marché (FP réel via `--eval`, avec clé).

---

## 2026-06-20 — TREXQUANT : la MORPHO/décompose n'aide pas l'OOV (FALSIFIÉ) — réponse à la thèse §1.8

Rem : « décompose préparé pour le mode trexquant, voir si utile ». Mesuré (`evo/trexq_morpho_probe.py`, standalone,
OOV par construction : test retiré du train, morpho apprise sur le train seul) — réponse à la **thèse ouverte
AUDIT §1.8** (« la cognition/structure ajoute-t-elle un Δ AU-DESSUS du substrat n-gram ? »).

| variante (winrate OOV, 500 mots held-out) | % |
|---|---|
| **A — n-gram de lettres seul (le substrat §1.7)** | **69,4** |
| n-gram + morpho (affixes de `morpho.json`) ×1 | 69,4 (bruit) |
| n-gram + morpho ×4 / ×12 | 67,8 / 65,8 (**dégrade**) |
| morpho **seule** | 22,6 |

**Verdict : FALSIFIÉ — la morpho n'ajoute aucun Δ** (au mieux +0 ; poids fort → ça empire ; seule = faible). **Cause** :
le n-gram capte **déjà** la structure d'affixes (forward = préfixes, backward = suffixes) → la morpho explicite est
**redondante**. Conforme §1.8 et au motif déjà falsifié (C léger/lourd = parité avec le substrat) : **le levier OOV
au-delà du n-gram est le CONTEXTE (LLM), pas la décomposition**. La morpho/décompose **reste utile pour la DICTÉE**
(diagnostic dys, route lexicale du décomposeur) — pas pour le pendu OOV. Sonde gardée (assert : la falsification doit
rester vraie). Cohérent avec la conclusion de Rem : *« c'est notre limite partout → LLM »* (trexquant, décodeur, correcteur).

---

## 2026-06-20 — Cas durs classe A : route PHONÈME réelle — ne bat pas la baseline (g2p-sur-typo non fiable)

Suite de la classe A (`doi→doigt`, `pié→pied` : le bon mot n'est pas candidat par `phon_key` crue). Tenté la **route
phonème réelle** : indexer le lexique par son **vrai SAMPA** (`phono_homophones.json`, committé) + dériver le phonème
du typo via **g2p** (`decompose.sublexical_phon`), puis préférer le candidat dont le SAMPA = g2p(input). Mécanique
testée : « un accent doit préserver le son » (démoter `pie` si son SAMPA ≠ g2p(`pié`), promouvoir `pied`).

**En principe, ça marche** : g2p(`pié`)=/pje/ = `pied` (/pje/) **≠** `pie` (/pi/) → désambiguïsé. La route isole aussi
correctement les **vraies ambiguïtés** (`doi`=/dwa/ = dois/doit/doigt ; `tan`/`balon`/`voudrai` = vrais homophones du
voisin) → ne pas deviner = FP=0 respecté.

**Mais sur le GEC (le juge), 5 variantes mesurées — AUCUNE ne bat la baseline** : recall **7/13** inchangé, et la
**confiance AUTO chute (2→0)**. Les cas « gagnés » (`pié→pied`) **ne sont pas dans le corpus** → j'optimisais des
**anecdotes**, pas la mesure (piège doctrine §1/§6.4).
- **Cause racine = g2p-sur-typo non fiable** : drop du `e` muet (`cafe`→/kaf/ ≠ café /kafe/), du schwa (`fenetre`
  `fnEtR` vs `f°nEtR`), qualités vocaliques (`telefon` vs `telefOn`). → exiger un match phonétique **démote les
  restaurations d'accent AUTO légitimes** (café/fenêtre = la feature FP=0 la plus précieuse).
- Tentatives de sauvetage mesurées et épuisées : préfixe-tolérant (récupère café mais pas fenêtre), rival = edit-1
  seulement, **normalisation de notation** (`°`/`E`/`O`) → **réintroduit des collisions** (`pié→pieu`).

**Verdict (barrière de mérite §6.4)** : ne bat pas la baseline → **NON câblé**. `pié→pied` est résoluble *en principe*
mais bloqué par la **qualité de g2p sur les mots mal orthographiés**. Le vrai fix (ouvert) : embarquer le **phonème
réel par mot** (rebuild `speller-lex` avec `2_Phono` de Lexique4) **+ un g2p aligné sur cette notation** — exige
Lexique4, et même là la fiabilité g2p-sur-typo reste la question ouverte. Cohérent avec le plafond « sans-contexte »
des deux classes (cf. entrée did-you-mean).

---

## 2026-06-20 — « DID YOU MEAN » fréquence : FALSIFIÉ (mesuré, jonction 7 classe vrai-mot)

Reprise de la piste laissée ouverte par le stress-test : corriger un **vrai mot rare** (que le speller ne touche pas,
`balon`/`tan`/`voudrai`) vers un voisin **plus fréquent**, gardé FLAG, FP chiffré sur le GEC. Mesuré sur le **lexique
embarqué** (`speller-lex-gz`, sans Lexique4) + 98 paires GEC — `dictee/didyoumean_probe.py`.

**Diagnostic des cas durs (dump des candidats) — DEUX classes distinctes :**
- **Classe A** (`doi→doigt`, `mangont→mangeons`) : le bon mot **n'est même pas candidat** (distance-2 ET clé phon
  différente à cause des lettres muettes : `doigt`=`dvag` ≠ `doi`=`dva`). Le re-ranking ne peut rien. → relève d'une
  **clé phonétique sachant les finales muettes** (route phon), PAS du « did you mean ». Piste séparée, ouverte.
- **Classe B** (`balon→ballon`, `tan→tant`, `voudrai→voudrais`) : input = **vrai mot** (faible freq) → speller renvoie
  `None`. Le voisin fréquent EST candidat. C'est la cible « did you mean ».

**Mesure classe B → FALSIFIÉ.** Aucun réglage n'atteint **FP=0** :
- large (rare<seuil × dominant) : **8→58 FP** / 98 correctes pour **0→3 corrections** / 152 erreurs vrai-mot GEC.
- stricte (edit-1 + phon-**identique** + dominant) : **3→10 FP** pour **0→1 correction**.
- FP irréductibles = vrais mots rares à voisin fréquent phon-identique (`vainc→vain`, `coll→cool`, `absorbeur→absorber`,
  `croît→crois`) — **indissociables d'un typo sans contexte**. Et `voudrai` (futur correct « je voudrai ») = un seuil
  fréquence corrigerait du **juste**. *Nuance* : la stricte corrige bien `balon→ballon` et laisse `tan`/`voudrai`, mais
  les 3 FP tuent le cardinal.
→ **Conforme à la doctrine** (POS/contexte-naïf déjà falsifié) : la classe vrai-mot exige un **modèle de CONTEXTE**
(LLM-grade) ; le C lourd transformer est déjà falsifié (CLAUDE.md). **Ne pas câbler.** Sonde `didyoumean_probe.py` gardée
(assert : la falsification doit RESTER vraie). Détail : `CORRECTEUR.md` (§ FALSIFIÉ did-you-mean).

---

## 2026-06-20 — Réintègre `mb` (base morpho) dans le lexique embarqué + fix harnais evo

> Soulevé par Rem après la consolidation : « build_morpho régénère un morpho.json dégradé, alors que le lexique
> est intégré à omega-pendu — vérifier. » Vérifié → cause trouvée → corrigé.

**Cause (≠ ce que je croyais).** Pas un Lexique4 manquant : `build_morpho.py` lit le lexique **embarqué** (`lex4-data-gz`).
Le vrai souci : commit `9d3763c` (PR #9) a re-embarqué le lexique COMPLET (83 605 → **155 493 mots**) via
`build_engine_lex.py` avec `KEEPCOLS` **sans `mb`** (« colonne morpho-base sans consommateur »). Or `mb` **a** un
consommateur : `morpho.json` / route lexicale du décomposeur (**PR #10**, parallèle). Le merge fait se rencontrer
app-sans-`mb` × consommateur-de-`mb` → régénération dégradée (bases vidées, 0 `mb`).

**Fix sans Lexique4 (egress Drive bloqué + connecteur MCP sature le contexte).** La donnée `mb` existait déjà dans
l'app de `main` (19 341 mots). **Transplant** par script : on ajoute le champ `mb` aux entrées du lexique 155 k
**sans réordonner `words`/`len_index`** (→ baseline moteur préservée ; `mb` est un champ que le pendu IGNORE, seul
`build_morpho` le lit). App **+0,13 Mo** (8,32→8,45). `morpho.json` régénéré : **26 918 clés dont 18 227 avec base**
(vs 20 523 committé, vs 0 dégradé) → **plus riche ET cohérent** app↔morpho.

**Non-régression moteur MESURÉE** (`evo/measure_lex_bylen.js`) : 7→97,5 % · 8-9→100 % · 10-12→100 % · 13-15→100 %
= identique à `9d3763c` (≤1 mot sur les 7 = bruit cohorte documenté). `mb` purement additif.

**Bonus — bug pré-existant PR #9 corrigé.** `fitness_harness.js`/`measure_lex_bylen.js` castaient (SyntaxError)
sur le bloc **`speller-lex-gz`** (`text/plain`, donnée base64, ajouté par PR #9, jamais exclu du concat-eval). Fix :
exclure aussi les blocs data `text/plain` (1 ligne/harnais). Prouvé pré-existant (échec identique avant le transplant).
CI complète verte (18 étapes).

---

## 2026-06-20 — Couche SPELLER ortho (AUTO/FLAG) + hybride + genre déterminant + stress-test FP + CONSOLIDATION (rattrapage §6)

> Entrée de rattrapage : le journal s'était arrêté au 18/06 ; cet arc (couche orthographique du correcteur,
> 18→20/06) vivait dans `CORRECTEUR.md` + les commits mais **pas dans le journal** (trou §6). Comblé ici.
> Détail complet : `dictee/CORRECTEUR.md`.

### Couche ORTHOGRAPHIQUE — non-mots (`speller_probe.py` + miroir JS dans l'app)
Au-delà des homophones grammaticaux : un vrai correcteur de **non-mots** (formes absentes du lexique), temps réel
(panneau « 🩹 Correcteur », debounce 350 ms). Candidats = **restauration d'accent** (deacc→accentué, prio 2) +
**edit-1** (prio 1) + **route phonétique** (`phon_key` : ph→f, ç→s, qu→k, finales muettes… ; cible dys, prio 0).
- **2 niveaux** : **AUTO** (remplace seul, accent-only dominant ≥3 lettres, même longueur → curseur préservé,
  `fenetre→fenêtre`) — **cardinal FP=0** ; **FLAG** (souligne, clic) candidat incertain (`leson→leçon`, `gato→gâteau`).
- **Embarqué** : bloc `speller-lex-gz` (92 743 formes accentuées + freq, gzip+base64 0,56 Mo). Miroir JS = exact du Python.
- **Mesuré (GEC 98 phrases)** : **AUTO FP=0/98** ; non-mots corrigés exactement **58 %** ; FLAG-FP=12 (OOV/rares, non destructif).

### HYBRIDE — la voie grammaire désambiguïse les candidats du speller
Accord genre/nombre du contexte (déterminant/nom-tête proche, en sautant les copules) + **bascule de paire
d'adjectif** (`cgram_adj`) → `fote→faute`, `gross→grosse`, `premiere→premier`, `blanch→blanche`. Accord = **bonus
jamais pénalité** (ne casse pas l'AUTO accent). Câblé Python **et** app, parité vérifiée, **AUTO FP=0 préservé**.

### Genre DÉTERMINANT (`rule_det_gender`) — la catégorie dominante du réel
Déterminant à genre certain (un/une/le/la/ce/cet/cette/mon/ma/ton/ta/son/sa) + **nom PUR** juste après (champ `gn` =
genre non ambigu MOINS verbes MOINS adjectifs) → genre(dét)≠genre(nom) → corrige. **GEC : FP=0/98, 17/27 détectés+
corrigés**. Câblé app (`rDetGenre`), parité EXACTE. (≠ `rule_genre_adj` adjectifs, qui reste NON branchée, FP-insûre.)

### Intégration SANS l'app (sans UI/DOM)
`dictee/correcteur.js` (lié à l'app, source unique = monolithe) + `build_correcteur.js` → `correcteur.standalone.js`
(bake, HTML non requis, **2,16 Mo** : 48 Ko code + 2,11 Mo données ; PAS le lexique 5,5 Mo du pendu). En CI.

### STRESS-TEST « les deux » (20/06) — 3 vrais FP corrigés, edit-2 falsifié, élision-espace livrée
- **FP éliminés** (sur texte correct → cardinal FP=0) : (a) **ligature œ** (`cœur→coeur` : normalise œ→oe avant lookup) ;
  (b) **nom propre en tête** (`Nathalie→natalité` BLOQUÉ : mot capitalisé → seule la restauration d'accent autorisée) ;
  (c) **`pome`→paumée** (collision genre nom/adj : `_gender` n'utilise la table adjectif que si POS='A' → garde anti-déacc).
- **(A) edit-distance 2 : FALSIFIÉ par mesure** — 59 ms/mot (injouable temps réel), n'attrape **aucun** cas dur
  (`mangont`/`doi`/`pié` : un candidat distance-1 gagne, le bon mot reste noyé), et ajoute du bruit (FLAG-FP 8→10).
  **Non câblé** (comme les garde-fous NbHomoph/Preval). Trace négatif = R66/§6.4.
- **(B) ÉLISION-ESPACE : livrée** — `c est`→`c'est`, `j ai`→`j'ai`, `qu il`→`qu'il`, `aujourd hui`→`aujourd'hui`.
  Fusion de **2 tokens** (flag `span:2`, renderCorr/applyFix). Détection : lettre d'élision + mot voyelle valide,
  écart purement blanc (apostrophe typographique déjà là → pas de FP). **5/5 élisions, 0 FP, parité OK.** En CI.
- **Cas restants (honnête)** : `balon`/`tan`/`voudrai` = **vrais mots** → le speller n'y touche pas (les corriger =
  « did you mean » contextuel = terrain déjà **falsifié** côté POS naïf, risque FP). `doi→doigt`/`pié→pied`/
  `mangont→mangeons` = distance 2 **+** lettres muettes (clé phon `dwag`≠`dwa`) → exigent un modèle contexte/fréquence
  (ré-ordonner vrai-mot-rare → mot-fréquent-proche) **mesuré contre FP=0 sur le GEC** = jonction 7 de `CORRECTEUR.md`,
  **reportée** (la doctrine §1 interdit de la câbler sans mesure).

### CONSOLIDATION (20/06) — PR #9 synchronisée avec main
- PR #10 (« décomposeur à la Lexique 4 ») mergée dans `main` → PR #9 (correcteur) mergée avec `origin/main` (main
  désormais ancêtre, mergeable proprement). `app/omega-pendu.html` + `CLAUDE.md` auto-mergés (panneaux Décompose et
  Correcteur coexistent). CI = **union** (décompose + correcteur/speller), **vérifiée verte en local** (18 étapes).
- **Corpus GEC réintégré** : PR #9 l'avait sorti du repo (`hors-repo`, provenance à confirmer) ; PR #10 l'a committé
  (`dictee/corpus_gec_fr.jsonl`, 98 paires) → on s'aligne sur l'état canonique de `main`. ⚠️ Provenance/licence du
  corpus **toujours à confirmer** (texte type Wikipédia) — à retirer si besoin. Docs `eval_gec.py`/`CORRECTEUR.md`
  réconciliées (« hors-repo » → « suivi dans le repo »).

---

## 2026-06-18 — LE VRAI PROBLÈME : cognition/apprentissage ne généralisent pas + FIX n-gram (N=400 : 50→66 %) — AUDIT §1.7/§1.8

Suite Rem : « le pendu n'est qu'une MESURE ; OMEGA ne gagne ni par mémorisation ni par apprentissage-par-jeu — vrai
problème, trouve cause + solution ». Mesuré (vrai OOV) :
- baseline n-gram TRIVIAL du lexique = **57,5 %** ; **OMEGA cognition SEULE = ~8 %** → le signal est dans le lexique,
  la cognition ne le capte pas.
- **FIX** `M_NEO_LETTER_NGRAM` (OFF-inerte) : n-gram positionnel de lettres pré-calculé depuis `len_index` (cheat-free,
  respecte Trexquant). **N=400 (4 graines) : hybride 50,0 → 66,0 % (+16 pts, gagne à chaque graine), moins de coups.**
- **CAUSE de fond** : généraliser = **agréger** la structure du lexique. OMEGA apprend par **récompense-par-partie +
  mémoire** (~200 mots vus), goulot 12 cellules, **pas de câblage concept→lettre** (§1.4.2). Mauvais paradigme + capacité + câblage.
- **SOLUTION** : désintriquer ORACLE (lire la réponse, triche) / AGRÉGATION (stats du lexique = substrat légitime) /
  COGNITION (Δ par-dessus). Thèse → « la cognition ajoute-t-elle un Δ au-dessus du substrat n-gram ? ». Étapes : (1) substrat
  agrégé (one-pass lexique, lettres+phonèmes) ; (2) mesurer Δ cognition ; (3) si oui, capacité+câblage (§3). Détail AUDIT §1.8.
- **⚠️ DEUX corrections honnêtes (petit-N over-read)** : (a) « recall tue la généralisation » = FAUX (recall OFF ≈ ON).
  (b) « plus de données = pire » = **bruit, non confirmé** (w1500 full=jointe OFF=θ OFF=23,3 % IDENTIQUE ; baseline w200=50 %
  à N=400). Le vrai problème n'est PAS une dégradation, c'est que la cognition ne généralise pas (8 %).
- Leçon transverse : OMEGA généralise par **AGRÉGATION DE STRUCTURE** (déjà le paradigme gagnant du correcteur dys :
  cgram/conjugaison), pas par récompense ni mémoire. Cf. `docs/HANGMAN_SOTA.md`.

---

## 2026-06-18 — ⛔ FUITE COHORTE trouvée (Rem avait raison) : "97 % OOV" = bidon, vrai OOV ~33 % — CORRIGÉ

Rem : « 97 % Trexquant impossible, le système triche ». **Exact.** Audit du code → bug `_neoWBL` :
- La cohorte NEO (`_neoCohortMasks`/`_neoPhonCohort`/`_neoPhonCohortDist` → assemblé/jointe/**OS-arb**/muette) lit un
  cache `_neoWBL` **bâti une fois depuis `OMEGA_LEX4.words[]`** et **jamais invalidé**. Trexquant (`_trexq_removeWord`)
  et le harnais (`filtered`) ne retirent le mot que du **`len_index`** → le mot "retiré" **restait dans la cohorte**.
- **Preuve** (même protocole, cohorte reconstruite SANS les mots-test) : 98,3/95,0 % (fuite) → **33,3/33,3 %** (vrai OOV).
  Fuite **≈ 62-65 pts**. Le vrai OOV est **~33 %** (sous SOTA 50-68 %) : la généralisation sublexicale pure d'OMEGA
  est **faible**, pas exceptionnelle. Ma §1.6.1 « OS-arb 96,7 % OOV » = **artefact**, **rétractée**.
- **Fix** : `_neoEnsureWBL()` bâtit la cohorte depuis `len_index` (respecte les retraits) + invalide le cache
  (changement de référence ; `_trexq_*` annulent `_neoWBL`). **In-lexique inchangé** ; Trexquant aveugle enfin vraiment.
- **Leçon (doctrine §1/§6)** : un Δ extraordinaire = chercher la fuite, pas pavoiser. Tout chiffre OOV/Trexquant
  antérieur (§1.1, MAJ CONFIG_REFERENCE) est **à re-mesurer**. Le in-lexique (§1.6) n'est pas touché.

---

## 2026-06-18 — Accord sujet-verbe à SUJET-NOM (« les enfants joue »→jouent), FP=0 sans lexique de noms

Test terrain Rem : « les enfants joue dans le jardin et ils ont content » → rien (joue = sujet NOM, hors v1 pronom).
Ajout `rule_accord_sv_noun` (Python + app, parité).
- **Portée sûre** : déterminant PLURIEL (les/des/ces…) **EN TÊTE de phrase** (dk==0) → verbe au pluriel. En tête,
  rien à gauche → aucun génitif/PP/objet-de-verbe → **FP=0 SANS lexique de noms** (donc parité app↔Python parfaite).
- **Itérations FP (cardinal)** : 1res versions = 21 FP/98 corpus (déterminant le plus proche attrapait « des
  institutions », « l'automne est »→« les feuilles », « protéger les infrastructures »). Durci pas à pas
  (exclure « à »≠« a » ; clitique « le chat **les** regarde » ; génitif « des » ; verbe/coordination) puis
  **simplifié en dk==0** (lexicon-free, robuste) → **FP 21→0**. Garde structure : nom-tête toléré (homographe
  « voitures »), verbe intercalé après = sous-phrase → abstention. Direction unique pluriel→3p (singulier→3p écarté :
  « le chien **et** le chat mangent »).
- **Donnée** : corrigé `derive_number` (nombre vide fréquent au présent) → -ent/-ont LONG non -ient = pluriel
  régulier (chantent, dorment) ; -ient/court = ambigu→wildcard (vient/ment) → débloque les slots 3p manquants.
- **Mesuré** : témoins 8/8, held-out **11/11 vocab NEUF**, **FP=0** (30 phrases + 98 GEC réel + held-out). Parité
  app↔Python : invariant **flags-app ⊆ flags-Python** (app au lexique HF s'abstient sur verbes rares, jamais de FP).
- **Honnête** : « ils ont content » non flagué (« ont » s'accorde avec « ils ») ; reste l'erreur avoir↔être
  (sémantique) + accord adjectif — hors portée. Sujet-nom en sous-phrase/distance = reporté (exige une vraie analyse).

---

## 2026-06-18 — ACCORD SUJET-VERBE branché dans le correcteur (route conjugaison Lexique 4), FP=0

Recadrage de Rem (test « Les enfant joue… Je doit manger. On ont gagné. » → rien détecté) : le correcteur ne
couvrait **que 8 homophones**, or ses fautes étaient toutes des **accords**. On retourne le levier d'accord du
DIAGNOSTIC en CORRECTION (§5 réutiliser l'existant), pour l'**accord sujet-verbe à sujet PRONOM**.
- **Donnée** : `9_InfoVER` + `8_Nombre` de Lexique 4 → `cgram_conj.json` (8 018 formes / 2 404 lemmes ;
  `f`=forme→lectures, `c`=lemme→temps→slot→forme). Généré par `build_cgram.py`. Sous-ensemble HF (présent+imparfait)
  embarqué dans l'app (`vdc-lex`, +210 Ko). Probe Python = table complète.
- **Règle** `rule_accord_sv` : sujet = pronom isolé (je/tu/il/elle/on/ils/elles ; nous/vous exclus, ambigus avec le
  clitique objet) ; flague le verbe **si aucune lecture (pers,nombre) du sujet** ; corrige **seulement si** la
  suggestion est elle-même confirmée (pers,nombre) du sujet (auto-garde anti-bruit).
- **Bruit Lexique trouvé & neutralisé** (sinon FP/mauvaises corrections) : `peux`=nombre `p` (faux) → 1re/2e pers.
  jugées sur la **personne seule** ; **infinitif** porte des tags finis parasites (`chanter:ind:pre:2`) → écarté
  (forme=lemme) ; `8_Nombre` **vide** fréquent au présent des -er (`travaille`) → **nombre déduit** (-ons/-ez=pl ;
  3e pers. -ent/-ont=ambigu→wildcard ; sinon sg) ; participe mal tagué présent (`joué:ind:pre:1`) → écarté des slots.
- **Mesuré** : « Je doit »→dois, « On ont »→a, « il sont »→est ✓ ; témoins 5/5 ; **held-out 6/6 sur vocab NEUF**
  (chanter/travailler/regarder/inventer/ranger/nettoyer) → généralise. **FP=0** partout (30+29 témoins, 98 GEC réel,
  held-out). Corpus réel : 2/12 accords SV (les 2 à sujet pronom ; 10 à sujet **nom** = jonction suivante).
- **Parité app↔Python** : `dictee/parity_corr.js` (29 phrases identiques), ajouté en CI. UI : message « Aucune faute
  grammaticale » + périmètre explicite ; intro mentionne l'accord SV.
- **Choix** : on corrige le **verbe** vers le sujet écrit (« il sont »→« il est »), pas le sujet — règle enseignable.

---

## 2026-06-18 — Correcteur validé sur VRAI corpus (Rem) : FP 11 → 0 / 98, durcissement « abstention »

Rem a fourni un vrai corpus GEC FR (98 paires erroné/corrigé, Wikipédia). `dictee/eval_gec.py`.
- **Test cardinal (FP sur phrases CORRECTES réelles)** : 1re passe **11 FP** → le « 0 FP » synthétique était
  **falsifié par le réel** (exactement le risque « validation circulaire » signalé). Mécanismes : `deacc(à)==a`
  (collision avec l'aux *a*), homographes courts du cgram (« ne »→vlike), participes hors stub (« incarné »),
  tokens contractés (« l'été »).
- **Durcissement** : à/a distingués, `VLIKE_STOP` (mots-outils), -é/-er ignore les tokens apostrophés, on/ont
  détecte le participe par suffixe, et les règles ambiguës (son/sont, ce/se, et/est) **s'abstiennent** au lieu de
  deviner. → **FP 11 → 0 / 98** (Python + app, parité vérifiée). Coût : −2 in-corpus (22→20), −1 held-out (12→11).
- **Honnêteté périmètre** : 1 seule des 98 erreurs réelles est dans les 8 confusions du correcteur (le reste = genre
  déterminant un/une, nombre, ordre, mots manquants, typos = hors périmètre). Le correcteur est **FP-safe sur du
  réel** mais **couvre peu** des erreurs réelles → couche large (genre/nombre/typo) = futur, exige un POS/tagger.
- Corpus tiers gitignoré (hors-repo comme Lexique4). Détail : `dictee/CORRECTEUR.md`.

---

## 2026-06-18 — Boucle DESCENDANTE de la grammaire : apprendre le lexique de genre (100 % préc., FP=0, data-bound)

Seconde moitié de la double voie (après la route lexicale). `dictee/descending_probe.py` : la boucle descendante
**apprend** nom→genre depuis les contextes à déterminant genré des phrases correctes (« une table » → f), validé
contre Lexique4.
- **Précision 26/26 = 100 %** · généralisation leave-one-out **1/1** (un seul nom se répète sur 30 phrases →
  recouvrement quasi nul) · détection via genre appris **FP=0**.
- **Verdict** : ça APPREND vraiment (≠ miroirs du pendu, mesurés inertes) et c'est FP-safe, MAIS la valeur vient
  du **VOLUME** — 30 phrases n'apprennent qu'une poignée de noms. Home réel = corpus corrigés (validation terrain) :
  la boucle est le moteur d'**auto-enrichissement** du correcteur (genre/POS/gouverneur→terminaison appris en continu).
- Les deux moitiés de la double voie sont posées et mesurées : route **lexicale** (genre 3/3) + boucle **descendante**
  (100 % préc.). Détail : `GRAMMAIRE_DOUBLE_VOIE.md`.

---

## 2026-06-18 — Lexique4 reçu → route LEXICALE de la grammaire (verbes + GENRE)

Rem a fourni le `Lexique4.tsv` (33 Mo) → `build_cgram.py` génère deux ressources dérivées (CC BY-SA) :
- `cgram_verbs.json` (**12 415** formes verbales, col. 5_Cgram=VER) → `vlike` (couverture verbale complète).
  *Mesuré* : FP=0 ; sur le jeu-témoin contrived 21/24 (vs 22/24 liste blanche) car les **homographes nom+verbe**
  (livre/porte/trouve…) passent pour verbes → leçon = croiser avec le contexte (jointe §3), pas drapeau brut.
- `cgram_gender.json` (**53 050** noms à genre NON ambigu ; 186 ambigus écartés : tour, livre…) → **route lexicale
  du GENRE** : `lexical_gender(T,i)` lit le genre du nom-tête quand le déterminant ne le marque pas (leur/notre/des).

`diag_sentence` : branche genre = `governor_gender(T,i) or lexical_gender(T,i)`. **Mesuré : 3/3** sur déterminant
neutre (« Leur grande maison » → maison f → grande ; « Notre petite voiture » → f ; « Leur chien noir » → m) —
là où on **s'abstenait** avant. Familles **100 %** + toutes les mesures précédentes **intactes** (la route lexicale
n'ajoute que des décisions, jamais ne change un diagnostic correct). FP-safe (noms ambigus écartés du lexique).

C'est la **moitié « route lexicale »** de la double voie (`GRAMMAIRE_DOUBLE_VOIE.md`). Reste : la moitié
« boucle descendante » (apprendre depuis les cibles de dictée) et le port app (sous-ensemble haute-fréquence).

---

## 2026-06-18 — Direction CORRECTEUR dys : probe « détecter + corriger SANS corrigé » (0 faux positif)

### Idée (Rem) → recadrage
Faire du levier d'accord un **correcteur orthographique dys semi-direct**. Recadrage : le correcteur roule sur le
moteur de **dictée** (pas le pendu) → toutes longueurs, régime mot-court (où l'accord paie). Le pendu de phrases
a été un **banc de mesure** (falsifié comme débouché winrate), pas l'application. Angle unique : détecte + corrige
**+ situe le STADE** (remédiation dys), ce qu'aucun correcteur grand public ne fait.

### Le seul inconnu, mesuré (`dictee/correcteur_probe.py`)
La dictée connaît la cible ; un correcteur doit **inférer l'intention**. Règles `decide(T,i)` par homophone
grammatical (réutilise `diag_sentence`), détection ET correction faites ensemble (« sinon on le fait deux fois »).
- **Faux positifs sur 30 phrases correctes : 0** (condition n°1 : ne pas corriger du texte juste).
- **Détection + correction : 13/16** ; **9/9** sur `-é/-er`, `son/sont`, `leur/leurs`.
- 3 manques (`a/à`, `et/est`, `on/ont` présent) = `is_verb` est un stub de 32 formes du corpus (ignore « mange »…).
  Mécanisme, pas échec d'architecture : un lexique POS (Lexique4 `cgram`) les lève et scale.
- Bug attrapé en route : un FP `sont→son` quand un adjectif s'intercale (« fleurs rouges sont ») → règle son/sont
  recadrée sur le mot **précédent** (verbe/prép/conj → possessif ; sujet → verbe) → 0 FP.

### Verdict
Cœur du correcteur validé sur l'existant, **0 faux positif**. Suite : élargir `is_verb` (cgram), couche typo
(non-mot via voisins), UI semi-directe (réutiliser le panneau dictée, OFF-inerte R66). Détail : `dictee/CORRECTEUR.md`.

---

## 2026-06-18 — Validation terrain : fiche imprimable (le juge est humain, §4)

### Quoi
Le levier grammaire « classe fermée » a épuisé ce que le corpus de 30 phrases permet de **mesurer en synthétique**.
Prochaine étape du plan = **C, validation terrain** (vraies copies dys, orthophonistes) : c'est le vrai juge (doctrine §4).
Livrable : un **support imprimable** pour faire passer la dictée et **mesurer l'accord outil↔expert**.

- `dictee/build_validation_sheet.py` — générateur (réutilise `sentences.json` + `FAM2STAGE`/`STAGE_ORDER` de `diag_sentence.py`,
  doctrine §5 : pas de duplication des données). Régénérable.
- `dictee/validation_terrain.html` — fiche autonome, 3 feuilles (sauts de page) :
  1. **Protocole + métadonnées élève** (anonymisé, consignes, aide-mémoire familles/stades).
  2. **Feuille EXAMINATEUR** : 30 phrases à dicter + grille de relevé par mot fauté
     (mot cible · écrit élève · **famille expert** · stade · **famille outil** · **accord ?**) → mesure directe du taux d'accord.
  3. **Feuille ÉLÈVE** : lignes vierges numérotées, police lisible dys — **sans le texte cible** (c'est une dictée).
  4. **Synthèse** : profil de stade (expert vs outil) + calcul du **taux d'accord** = validation/falsification du diagnostic.

### Conception (pourquoi cette forme)
- Diagnostic expert **en aveugle** d'abord, comparaison à l'outil ensuite → le taux d'accord n'est pas biaisé.
- Cible interne = 100 %/famille (synthétique) ; un écart terrain pointe la famille à revoir (donnée actionnable, §1 falsifiable).
- Pas de moteur PDF dans l'env → l'HTML s'imprime au navigateur (Ctrl+P). Données : Lexique 4, CC BY-SA 4.0.

---

## 2026-06-18 — Levier grammaire : participe passé avec AVOIR, le COD antéposé

### Quoi
La dernière règle d'accord « dure » du français : le participe avec *avoir* s'accorde avec le **COD
quand il est ANTÉPOSÉ** (« la pomme **qu'**il a cueilli**e** ») et reste **invariable** sinon (« il a cueilli des pommes »).

- `find_cod_antepose(T,idx)` : cherche un relatif **« que / qu' »** à gauche du participe (fenêtre courte) ;
  l'antécédent = le GN avant le relatif → genre/nombre via `governor_gender` + `governor_number`.
  Renvoie `(antécédent, genre|None, nombre|None)`, ou `None` (→ invariable).
- Branche *avoir* de `diagnose_sentence` : accord avec le COD antéposé si relatif, sinon « invariable, COD placé après ».
  ⚠️ Le tokeniseur garde l'élision : `qu'il` est **un seul token** → on teste `== 'que'` **ou** `startswith("qu'")`.

### Mesuré (`python3 dictee/diag_sentence.py`)
- Familles **100 %** · participe détecté **7/7** inchangés.
- Démos COD (synthétiques — le corpus n'a que des COD postposés, cf. phrases 14/18) :
  - « La pomme **qu'**il a cueillie » → COD antéposé « pomme » (f, sg) → accord ✓
  - « Les fleurs **qu'**elle a cueillies » → COD antéposé « fleurs » (genre None car « les » ne marque pas le genre, pl) → accord ✓
  - « Elle a cueilli des pommes rouges » → **invariable** (COD placé après) ✓
- Honnêteté : avec « les » le genre n'est pas porté par le déterminant → on accorde en **nombre** seul (le genre est lexical, hors moteur sans lexique).

### App (port vérifié)
`findCodAntepose` porté dans l'IIFE dictée ; branche *avoir* enrichie. Parité JS↔Python sur les 3 cas (`['pomme','f','sg']` / `['fleurs',null,'pl']` / `null`). CI verte.

---

## 2026-06-18 — Levier grammaire : chaîne du GN, l'accord en GENRE

### Quoi
Quatrième pièce du levier grammaire (après sujet-verbe, sujet à distance, participe passé) :
**l'accord en genre dans le groupe nominal** — l'erreur dys classique « une robe **vert** ».

- `GEN_DET` : déterminants **genrés** (le/un/ce/cet/mon/ton/son/au/du = m · la/une/cette/ma/ta/sa = f). Classe fermée, fiable sans POS.
- `governor_gender(T,idx)` : remonte au déterminant genré le plus proche à gauche → `(mot,'m'|'f')`.
  **Abstention** si on croise un déterminant non-genré (les/des/leur) ou un pronom (on a quitté le GN).
- Branche GN de `diagnose_sentence` : quand `accord_type=='genre'` (et pas un verbe), on diagnostique le genre
  (« accord en genre : « une » féminin → accorder « verte ») au lieu du nombre.

### Mesuré (`python3 dictee/diag_sentence.py`)
- Familles **100 %** inchangées · gouverneur identifié sur erreur d'accord **82 %→84 %** (138/164 : les accords en genre trouvent maintenant leur gouverneur genré).
- **Chaîne du GN — genre : 7/7** quand un déterminant genré gouverne ; **abstention 6/6** quand il n'y en a pas
  (pronom « Il/tu », « leur tour » non genré, début de phrase). *Le « 7/13 » naïf cachait 6 abstentions correctes :
  il n'y a pas de genre à accorder sans déterminant genré — un Δ sans le pourquoi ne vaut rien.*
- Démo synthétique « Elle porte une robe vert(e) » → gouverneur genre = `('une','f')` : **skippe le pronom « Elle »**
  (le genre vient du déterminant du GN, pas du sujet).

### App (port vérifié)
`governorGender` + `GEN_DET` + `accordType` portés dans l'IIFE dictée (OFF-inerte, R66 baseline intacte).
Parité JS↔Python vérifiée sur 5 phrases + accordType (genre/nombre/verbal) : identique. CI (python + compile du bloc) OK.

---

## 2026-06-13 — Décision de direction + Phase 0 livrée

### Décision
- **Cible n°1 = dys / troubles de l'écrit** (confirmée par Rem). Usage école/soutien/orthophonie.
- **Produit = dictée à diagnostic d'erreur**, bâtie sur la **double route** d'OMEGA.

### Pourquoi la dictée (fondé sur mémoire + rapport)
- La **force mesurée** d'OMEGA est **phon→ortho** (70 % hors-lexique, 97-98 % en lexique) — la dictée *est* cette tâche.
- Le **profil de défaite est une signature de dyslexie phonologique** (mémoire §11.2) : 96 % des défaites = paire phonétiquement proche ; **58 % voisée/sourde** (P/B, T/D, K/G, F/V, S/Z, vecteurs quasi-identiques).
- La **dictée est déjà à moitié implémentée** dans `app/omega-pendu.html` : route **lexicale** (`M_DICTEE_LEXICAL`, mémoire/homophones) + route **sublexicale** (`M_DICTEE_SUBLEXICAL`, EM phonème→graphème, généralise). Ce sont les deux voies du modèle DRC.

### Accents — résolu
- Surface ASCII (corpus inliné = `NFD + ASCII strict`), **mais les accents vivent dans le SAMPA** : é=/e/, è/ê=/E/ → table `PHON_TO_LETTERS` + prior `M4_PHON_USE_P` (seule bascule ON par défaut).
- **Lexique4 complet** : la colonne `1_Mot` est **accentuée** → en lexique, l'accent est un **lookup** (pas de reconstruction). Reconstruction phon→ortho réservée au **hors-lexique**.

### Données — Lexique4 complet (reçu via Drive→zip→upload chat)
- **188 863 mots, 37 colonnes.** `1_Mot` (accentué), `2_Phono` (SAMPA), `3_Phono_IPA`, `24_NbHomoph` (71,8 % ont des homophones), `15_NbLettres`/`16_NbPhons` (muettes), `33_Preval`+`11_FreqOrtho`+`26_SyllNb` (difficulté), `30-32` (morpho).
- **30 774 mots < 7 lettres (16 %)** → mots courts disponibles.
- ⚠️ Le `.tsv` de 34 Mo est **hors-repo** (trop gros) ; vit dans `/tmp/lex4/Lexique4.tsv` (volatile) ou chez Rem. `build_testset.py` attend ce chemin.

### Périmètre tranché (Phase 0.4)
**V1 assume mots courts + accents en sortie** (la source les fournit). Plus de blocage « ≥7 lettres ASCII ».

### Livré (Phase 0)
- `dictee/test_set.tsv` — **300 mots étiquetés** (homophone / voisée-sourde paire minimale / accent / muette ≥2 / contrôle), gradués en difficulté. Étiquetage **dérivé des colonnes** (reproductible, seed=42).
- `dictee/build_testset.py` — script de génération (repro). `dictee/README.md` — schéma + logique.
- Mis à jour + commités : `DICTEE_ROADMAP.md` (Phase 0.4 résolue, Phase 1 simplifiée).

### Limites connues
- `muette` reste fréquent (~61 % ; le français abonde en lettres muettes) — discriminant mais pas rare.
- Pas d'étiquette « régularisation » (graphie plausible mais fausse) — à ajouter au besoin.
- Décodage sublexical glouton (sans contexte) ; qualité moteur plafonnée ~0,80 ; voisée/sourde non résolue côté pendu (levier `M_PHON_CORRECTION` à activer/mesurer).

### Prochain pas
**Classifieur de diagnostic + mesure** sur `test_set.tsv` (doctrine « mesure d'abord ») : générer des erreurs synthétiques par catégorie, faire deviner le type au classifieur, **scorer** la classification → premier chiffre réel avant d'investir dans l'UI (Phases 1-2).

### Infra / contexte
- Travail mené depuis une session **cloud** (Claude Code web) : conteneur **éphémère** (rollbacks), connecteur Drive **cassé** (`requires approval` persistant), repo en scope = `omega-pendu-`.
- Donc : **tout artefact dictée est commité/poussé sur `claude/replace-repo-content-6jWzn`** → durable. Le suivi sérieux gagnerait à passer en **local** (cf. discussion VIVARIUM).

---

## 2026-06-13 (suite) — Baseline diagnostic mesuré + hypothèse M3_d cadrée

- **Baseline du classifieur** (`diag_baseline.py`, surface/phono, sans M3_d) mesuré sur 415 cas : **91,3 % exact**, **8,7 % ambigu**. Détail dans `diag_baseline_results.md`.
- **accent + voisée/sourde = 100 % décidables en surface** (M3_d inutile là).
- **Ambiguïté concentrée sur les homophones (27 %)** → seul le **sens** tranche.
- **Hypothèse M3_d (Rem) cadrée** : le latent sémantique orphelin pourrait enfin servir **à désambiguïser les homophones** — mais **uniquement en contexte** (indécidable sur mot isolé) → **argument pour la dictée de PHRASES**.
- Prochaine expérience falsifiable : un signal sémantique en contexte réduit-il le 27 % d'ambigu homophone ? (OFF-inerte, gardé si Δ mesuré).

---

## 2026-06-13 (suite 2) — Expérience M3_d : FALSIFIÉE au design

- Revue du code : `M3_d_step` encode `M1_d` (ortho) + option `M1_phon` ; **aucune entrée sens/contexte**.
- Donc M3_d **ne peut pas** désambiguïser les homophones (mauvais signal + pas de contexte), ET il n'y a pas de vrai problème (cible connue en dictée ; ambiguïté gérée en **multi-étiquette**).
- **Décision : on ne monte pas l'expérience A.** M3_d reste sans rôle **sémantique/homophone** (pas d'entrée sens/contexte) — c'est le rôle *sémantique* qui est nul, **pas M3_d globalement** : côté pendu, son readout `cLetterScore` est utile (+3,4 cheat-free, `AUDIT_OMEGA §3.1`, maj 17/06). Détail : `EXP_M3D_FALSIFIE.md`.
- **Pivot : on avance la surface** (Ph.1-2) — 91,3 % de diagnostic sans M3_d ; sémantique = signal externe à acter séparément si dictée de phrases un jour.

---

## 2026-06-13 (suite 3) — Module de diagnostic multi-étiquette livré

- `diagnostic.py` : `diagnose(cible, tentative[, phono])` → **liste de faits + feedback français** (accent, voisée/sourde, muette, homophone, autre). Multi-étiquette.
- `phono_homophones.json` : index compact (4994 groupes, ~197 Ko, mots freq≥1) pour détecter les homophones **sans** le lexique 34 Mo.
- **Mesuré sur `test_set.tsv` (415 cas) : rappel 93 %.** accent / voisée-sourde / muette = **100 %**. **Homophone = 58,6 %** — borné par la couverture de l'index compact (les homophones rares sont filtrés). Couverture pleine = lexique entier, dispo **en local**.
- Phase 1 accents : en lexique = la cible vient accentuée (rien à faire) ; détection d'erreur d'accent = 100 %. Reconstruction OOV (enrichir `PHON_TO_LETTERS`) = route app, **déférée au local**.
- Exemples de feedback validés (ex. « amenée ← amenèe » → accent ; « admettons ← admetton » → muette « s »).
- Reste (local/app) : UI de saisie (Ph.2), reconstruction accents OOV, couverture homophone pleine.

---

## 2026-06-14 — Partie dyslexie TERMINÉE (app + index plein)

- **Index homophones PLEIN** régénéré depuis Lexique4 (43 580 groupes, 2,1 Mo, sans filtre freq) → item 1 réglé.
- `diagnostic.py` re-mesuré : **rappel global 99,8 %** (homophone **58,6 % → 98,6 %**, accent/voisée-sourde/muette 100 %).
- **`dictee_app.html`** : application de dictée diagnostique **autonome** (un seul HTML) — 620 mots gradués (`word_pool.json`, dérivés Lexique 4), **dictée vocale** (TTS fr-FR), saisie, **diagnostic multi-étiquette + feedback dys**, correction révélée. Diagnostic JS porté de `diagnostic.py` (testé 6/6, identique).
- Reconstruction accents OOV : **non nécessaire** pour la dictée (les mots dictés viennent du lexique → accentués). Item clos.
- **État : le cœur dyslexie est complet et utilisable.** Reste optionnel : dictée de PHRASES (signal sémantique externe), polissage UI, validation terrain (orthophonistes).

---

## 2026-06-14 (suite) — Intégration FICHIER UNIQUE + recherche dyslexie + catégories enrichies

- **Recherche dyslexie multi-sources** (Tous à l'école, Happydys, Upbility, Lexidys, Cairn) : confirme la **double route** (dyslexie phonologique vs surface) et la **typologie en 4 familles** (phono / lexicale-surface / sémantique / morphosyntaxique). Profil voisée/sourde validé.
- **Catégories enrichies** selon la grille : ajout de **inversion** et **ajout** (famille phonologique), en plus de accent/voisée-sourde/muette/homophone. Morphosyntaxique (accords) noté comme **extension phrases** (mots isolés insuffisants).
- **Correction demandée par Rem : UN SEUL FICHIER.** La dictée est désormais un **panneau additif intégré dans `app/omega-pendu.html`** (IIFE, OFF-inerte, bouton « ✍️ Dictée diag »). Le fichier séparé `dictee_app.html` est **supprimé**.
- Diagnostic JS re-testé **8/8** (dont inversion + ajout) depuis le fichier injecté.

---

## 2026-06-14 (suite 2) — Cadre A choisi : DICTÉE DE PHRASES (brick mesuré)

- Décision Rem : **dictée de phrases** (le contexte = la phrase cible rend homophones ET accords gradables, **sans M3_d**).
- `dictee/sentences.json` : **30 phrases graduées** (10/10/10) + familles d'homophones par mot (depuis l'index plein).
- `dictee/diag_sentence.py` : tokenise → **aligne** (Levenshtein mots) → diagnostique chaque mot (accent/voisée-sourde/inversion/muette/ajout/homophone/**accord**/omission/mot_en_trop). `is_accord` distingue **accord** (diff flexionnelle s/e/t/x/n) vs **homophone lexical** (ver/verre).
- **Mesuré (30 phrases) : rappel accent/accord/homophone/omission = 100 %.** Casse gérée (comparaisons lower). Gain clé : **accords détectés** via contexte.
- Reste : porter dans le fichier unique (remplacer le mode mot-isolé), détecter la **surface/plausible** (leson→leçon), réconcilier diagnostic.py.

---

## 2026-06-14 (suite 3) — Dictée de PHRASES intégrée dans le fichier unique

- `app/omega-pendu.html` : le panneau « ✍️ Dictée diag » passe en **mode PHRASES** (remplace le mot-isolé). Dicte la phrase (TTS fr-FR), l'élève la retape, **feedback par mot** dont **accords** (contexte). Toujours OFF-inerte (IIFE).
- Logique JS portée de `diag_sentence.py` (align Levenshtein + diagWord + isAccord). Vérifiée depuis le fichier : accord/accent/correct OK.
- **Divergence audit résolue côté cadre** : la référence est désormais la **dictée de phrases** (`diag_sentence.py` = moteur Python de référence ; l'app = portage). `diagnostic.py`/`test_set.tsv`/`word_pool.json` = **legacy mot-isolé** (gardés pour historique + l'équipe Lexique).
- **Reste de l'audit** : (1) détecter la **surface/plausible** (leson→leçon → « autre » ; nécessite graphème→phonème) ; (2) **validation moins circulaire** / données réelles ; (3) **boucle de remédiation** (rejouer la famille la plus ratée) ; (4) message accent générique (ç/à/ô).

---

## 2026-06-14 (suite 4) — Détection SURFACE/plausible (audit HAUT #2 réglé)

- Ajout d'un **normaliseur phonétique** `norm()` (ph→f, ç→s, c doux→s, eau/au→o, ai/ei→e, qu→k, doubles consonnes, finales muettes…) : si la graphie élève **normalise comme la cible** mais s'écrit autrement → étiquette **surface** (au lieu de « autre »).
- Couvre la **dyslexie de surface** : *leson→leçon*, *bateau→bato*, *photo→foto*, *question→kestion*, *frèzes→fraises*.
- Limites honnêtes : *femme* (em→/a/ irrégulier), nasales — non couverts.
- Intégré dans `diag_sentence.py` **et** l'app (fichier unique). **Mesuré : surface 17/17 = 100 %, zéro régression** (accent/accord/homophone/omission toujours 100 %).
- **Scorecard audit** : 🔴 isolé ✅ · divergence ✅ · casse ✅ · **surface ✅** · reste : validation moins circulaire, boucle de remédiation, message accent générique.

---

## 2026-06-14 (suite 5) — Boucle de REMÉDIATION (audit item réglé)

- Phrases **taguées** (`sentences.json` : champ `traps`) avec les familles qu'elles peuvent exercer (depuis le lexique) : accent/accord/homophone/voisée-sourde/muette.
- App (fichier unique) : **profil d'erreurs persistant** (localStorage `vdd_profile`, compteur par famille) + **sélection ciblée** : 65 % du temps, la phrase suivante exerce la **famille la plus ratée** (« on travaille : accord »). Affichage du profil + bouton réinitialiser.
- Le diagnostic ne fait plus que constater : il **oriente l'entraînement** (intervention, comme le préconise la recherche). Bloc app **compile sans erreur de syntaxe**.
- (Remédiation = logique UI/session, app-only ; `diag_sentence.py` reste le moteur de diagnostic de référence.)

---

## 2026-06-14 (suite 6) — Audit projet : correctifs appliqués

- **1** vivarium **retiré** du repo (vit ailleurs/privé). **3** legacy mot-isolé → `dictee/legacy/`. **2** banner sécurité en tête de `omega-key/README`. **5** CI minimale (`.github/workflows/ci.yml` : mesure `diag_sentence` + syntaxe bloc dictée) + README monorepo.
- **4 Compression du lexique** : `app/omega-pendu.html` **16 Mo → 5 Mo**. Le bloc `application/json` (15,5 Mo) devient `text/plain` **gzip+base64** (3,4 Mo gz) ; `loadOmegaLex4` (déjà `async`) décompresse via `DecompressionStream`. **Vérifié headless : 83 605 mots décompressés + parties jouées** → moteur intact (OFF-inerte, R66). Harnais evo mis à jour (gz + async).

---

## 2026-06-17 — Diagnostic DÉVELOPPEMENTAL par stade (Ferreiro/Berliocchi)

- **Apport** : lecture du mémoire Berliocchi (2022, conscience phonologique / entrée dans l'écrit) → les familles d'erreurs ne sont pas une liste plate, elles révèlent un **stade** (genèse de l'écriture, Ferreiro). Ajout d'une couche **développementale** sur `diag_sentence.py` (additif, réutilise `diag_word` ; familles toujours 100 %).
- **Mapping** (4 bandes, du plus amont au plus avancé — la GRAMMAIRE est l'apex) :
  - **phonologique** (voisée-sourde · inversion · ajout) → le SON mal perçu/segmenté (conscience phonémique ; l'axe dyslexie-phono d'OMEGA) ;
  - **alphabétique** (surface · accent) → écrit « comme ça sonne », pas l'ortho conventionnelle ;
  - **lexical** (muette · homophone) → orthographe du MOT (lettres muettes lexicales, homophone lexical) ;
  - **morphosyntaxique** (accord) → **GRAMMAIRE** : accords genre/nombre/verbal, sans indice sonore — **le palier le plus tardif = le prochain gros levier**.
- **Fonctions** : `stage_of_fact(types)` (par mot, le stade le plus AVANCÉ l'emporte → la famille spécifique prime sur le détecteur structurel `ajout/muette` co-déclenché ; un « élèves→élève » tagué muette+accord monte ainsi en **morphosyntaxique** = bien diagnostiqué « grammaire ») ; `developmental_diagnosis(facts)` → stade = **bande la plus en amont où il bute** + message.
- **Graine du levier grammaire** : `accord_type(t,s)` → **nombre / genre / verbal** (heuristique SANS POS). Démo : « répète→répètent » = accord **verbal** (sujet-verbe), « élève→élèves » = **nombre**.
- **Mesuré** : élèves « purs » par stade → **4/4 bien placés** (phono/alpha/lexical/morphosyntaxique). Familles toujours 100 %, additif (réutilise `diag_word`).
- **Lien cognition** (session moteur) : cohérent avec l'audit M3_d — les **cellules-concept = latent de FORME** = candidat signal de **stade précoce** (pré-syllabique/syllabique).
- **PROCHAIN GROS LEVIER = la grammaire** (morphosyntaxe), maintenant posée comme apex : il faudra la **catégorie grammaticale (POS)** + l'**accord à distance** (sujet-verbe, participe passé, chaîne d'accords du GN) — `accord_type` n'en est que la graine sans POS. C'est là que le contexte de la phrase (raison d'être de la dictée de PHRASES) paie le plus.
- **Reste aussi** : porter dans l'app (panneau affiche encore les familles seules) ; grain syllabe (Berliocchi : syllabe→rime→phonème) ; axe **temporel/rythmique** non couvert (OMEGA segmental) — limite honnête.

---

## 2026-06-17 (suite) — Levier GRAMMAIRE : 1ʳᵉ jonction (accord sujet-verbe en contexte)

- **Démarrage du gros levier grammaire** (posé apex à l'entrée précédente). Astuce §5 : le **nombre** se lit sur les **mots-outils en classe fermée** (déterminants `le/les…`, pronoms `il/ils…`) → pas besoin de taguer tous les mots ni de Lexique4-full (hors-repo ; le lexique embarqué n'a ni POS ni les mots courts).
- `governor_number(T, idx)` : remonte au **gouverneur** d'accord (pronom sujet / déterminant le plus proche à gauche) → son **nombre**. `diagnose_sentence` enrichit toute erreur d'accord : `grammaire` = **sujet-verbe** (si `accord_type='verbal'`) ou **groupe nominal**, + le gouverneur et le message (« accord sujet-verbe : « Les » pl → accorder « répètent » »). C'est ici que le **contexte de la phrase paie** (raison d'être de la dictée de PHRASES).
- **Mesuré (30 phrases)** : gouverneur identifié sur **82 %** des erreurs d'accord ; **accord sujet-verbe détecté sur 93 %** des accords verbaux. Familles 100 %, 4/4 stades, additif.
- **Limites honnêtes** : heuristique sujet = plus-proche-déterminant/pronom à gauche (OK en SVO, pas tous les cas — sujet nom propre, sujet à distance, inversion) ; `genre -e` vs `verbal -e` toujours ambigu sans **POS** ; participe passé, chaîne complète du GN, accord à longue distance = **suite du levier**.
- **Suite du levier grammaire** : POS (catégorie grammaticale) pour lever l'ambiguïté genre/verbal et le sujet réel ; participe passé ; accords du GN multi-mots ; porter dans l'app.

---

## 2026-06-17 (suite 2) — Levier grammaire : POS-contexte (désambiguïsation nom/verbe)

- **Continuation du levier grammaire.** Constat données : `lit`, `porte`, `court`, `calme`, `vend` sont **nom ET verbe** selon la phrase (« le lit » nom / « papa lit » verbe) → un POS plat est faux, il faut le **contexte**. C'est la substance grammaticale.
- **POS-contexte léger** (`is_verb(T,idx)`) : lexique de **formes verbales** du corpus + règle « précédé d'un déterminant → nom, pas verbe ». Pas besoin de POS complet ni de Lexique4 (hors-repo).
- **Effet** : `accord_type` désambiguïse enfin **genre -e vs verbal -e** (le verbe prime via le contexte) ; le label **sujet-verbe vs groupe-nominal** repose sur `is_verb` (contexte), plus sur le suffixe.
- **Mesuré** : désambiguïsation homographes nom/verbe **5/5** (`lit@0`=nom, `lit@4`=verbe, `verre@2`=nom, `porte@12`=verbe, `calme@26`=verbe) ; gouverneur 82 %, accord sujet-verbe **94 %**. Familles 100 %, 4/4 stades.
- **Limites / suite** : lexique verbal **du corpus** (ne scale pas → un tagger ou Lexique4-`cgram` pour un corpus plus grand) ; sujet = plus-proche-gouverneur-gauche (rate le sujet à distance avec PP intercalé) ; **participe passé** (accord avec être/avoir) = prochaine jonction grammaire ; portage app.

---

## 2026-06-17 (suite 3) — Grammaire : participe passé + sujet à distance + scaling

- **(1) Participe passé** : `is_participle` + `find_aux` → accord **avec être** (= sujet) vs **avec avoir** (invariable sauf COD antéposé). Message dédié (« participe passé avec être : accord avec le sujet « X » pl »). **Mesuré 7/7** participes du corpus détectés.
- **(2) Sujet à distance** : `governor_number(..., skip_pp=True)` saute les déterminants de **groupe prépositionnel** pour un verbe/participe-être → trouve le **vrai sujet**. Démo : « Les vers **de la terre** creusent » → sans skip = « la » (sg, faux) ; skip_pp = « Les » (pl, vrai sujet **et bon nombre**).
- **(3) Scaling POS** : repli **morphologique** sous le lexique corpus (`VERB_SUF` = -ons/-ez/-aient/-ait/-èrent/-irent/-issent, **pas** -ent trop ambigu ; stoplist adverbes). is_verb marche au-delà des 30 phrases pour les formes conjuguées claires. Limite honnête : pour un grand corpus → tagger ou Lexique4-`cgram`.
- **État** : familles 100 %, 4/4 stades, homographes 5/5, gouverneur 82 %, sujet-verbe 94 %, participe 7/7. Tout additif, moteur de référence `diag_sentence.py`.
- **Reste = (4) portage app** (en cours) : faire remonter stade + grammaire dans le panneau « ✍️ Dictée diag ».

---

## 2026-06-17 (suite 4) — Portage APP : stade + grammaire dans le panneau dictée (point 4)

- **Porté dans `app/omega-pendu.html`** (bloc IIFE « ✍️ Dictée diag », OFF-inerte) le levier complet : `NUM_DET/NUM_PRON/PREP`, `governorNumber(skip_pp)`, `VERB_FORMS`+repli morpho `isVerb`, `AUX_*`/`PART_FORMS`/`isParticiple`/`findAux`, stades `STAGE_*`/`stageOfFact`/`developmental`. `diagnoseSentence` enrichit chaque erreur d'accord avec `fact.gram` (relation grammaticale).
- **UI** : sous chaque faute d'accord, une sous-ligne « → accord sujet-verbe : « Les » pluriel → accorder « répètent » » (ou GN, ou participe passé être/avoir) ; et un encart **« Stade : … »** (phonologique→morphosyntaxique) avec message pédagogique. (L'app montre la *relation* grammaticale, pas le tag nombre/genre — plus actionnable.)
- **Vérifié** : CI syntaxe (`new Function`) OK ; **parité Python** testée sur les helpers portés — homographes nom/verbe 5/5, gouverneur+skip_pp, participe/findAux, `developmental` → mêmes résultats que `diag_sentence.py`. Aucune référence pendante. Baseline pendu intacte (additif IIFE).
- **Les 4 points enchaînés livrés** : (1) participe passé, (2) sujet à distance, (3) scaling morpho, (4) portage app.
- **Suite** : grammaire — accord du GN multi-mots (déterminant-nom-adjectifs en chaîne), participe passé avec COD antéposé, vrai tagger/Lexique4-`cgram` pour scaler le corpus ; validation terrain (orthophonistes).
