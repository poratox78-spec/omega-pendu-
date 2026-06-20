# OMEGA-Ω — mémoire projet (pour Claude Code local)

> Lis ce fichier en entier au démarrage. Il oriente sur le dépôt et **le chantier actif (dictée)**.
> **⚖️ DOCTRINE PRIORITAIRE — lire AVANT de coder : `DOCTRINE.md`** (cap §43 consolidé : §0 clause de service · §1 falsifiabilité/mesure · §2 R66/R67 · §3 doctrine probabiliste = jointe `Σ_φ P(φ|p)·P(lettre|φ,contexte)`, pas argmax · §4 une jonction à la fois · **§5 anti-fainéantise** (inventaire+réutiliser l'existant) · §6 audit honnête « défaut = pas terminé »).
> Docs de fond : `docs/MEMOIRE.html`, `docs/rapport-mode-emploi.html` (§18 = dictée). Plan : `DICTEE_ROADMAP.md`.
> Journal le plus à jour : `dictee/JOURNAL.md`. Audit transverse : `AUDIT_PROJET.md` · audit moteur : `AUDIT_OMEGA.md`.
>
> ⛔ **NE JAMAIS lire en entier dans le contexte** (sature la fenêtre → compactage permanent / « reprise » à chaque message) : `app/omega-pendu.html` (~5 Mo, ~1,3 M tokens), `dictee/phono_homophones.json` (~2,1 Mo sur 1 ligne), `Lexique4.tsv` (34 Mo). **Méthode obligatoire** : `Grep` pour localiser, puis `Read` avec `offset`/`limit` sur la **plage utile uniquement** ; les gros JSON/TSV se **traitent par script** (ex. `python3 dictee/diag_sentence.py`), jamais en lecture directe.

## Ce dépôt contient 4 choses
1. **OMEGA-Ω** — moteur cognitif de **pendu français** (`app/omega-pendu.html`, monolithique). Doctrine **« cognition > oracle »** + **R66** (mesurer/falsifier avant de garder ; tout module OFF par défaut, baseline byte-identique). Détails : `docs/MEMOIRE.html` + `docs/rapport-mode-emploi.html`.
   - ⚠️ Le lexique embarqué est **compressé** : bloc `<script type="text/plain" id="lex4-data-gz">` (gzip+base64) ; `loadOmegaLex4()` est **async** et décompresse via `DecompressionStream` (navigateur ≥ 2023). Fichier ~5 Mo.
2. **`omega-key/`** — messagerie chiffrée (projet dérivé, **non audité crypto**). Pas le focus.
3. **`evo/`** — workstream exploratoire : *OMEGA apprend à coder* (se copie ; le pendu = test de fitness lexicographique win→erreurs→temps). Harnais headless : `evo/fitness_harness.js`. Plan : `evo/EVO_ROADMAP.md`.
4. **`dictee/`** — **SOUS-PROJET ACTIF** : *dictée diagnostique* (cible **dys / troubles de l'écrit**) sur la **double route** d'OMEGA.

## Chantier actif = dictée. ÉTAT ACTUEL : DICTÉE DE PHRASES
Cadre tranché (audit) : **dictée de phrases** (le contexte rend homophones ET accords gradables, **sans M3_d**). Intégrée dans `app/omega-pendu.html` en **panneau additif OFF-inerte** (IIFE, bouton « ✍️ Dictée diag »).
- `dictee/diag_sentence.py` — **moteur de diagnostic de référence** : aligne (Levenshtein) cible/élève, diagnostique chaque mot. Familles : **accent · voisée-sourde · inversion · muette · ajout · homophone · accord · surface · omission · mot-en-trop**. `is_accord` = diff flexionnelle vs homophone lexical ; `norm()` = normaliseur phonétique pour la **surface** (leson→leçon). **Mesuré (synthétique) : 100 %/famille, surface 17/17.**
- `dictee/sentences.json` — 30 phrases graduées (10/10/10) + `traps` (familles exerçables) + familles d'homophones par mot.
- `dictee/phono_homophones.json` — index homophones **PLEIN** (43 580 groupes, ~2,1 Mo, sans filtre freq).
- **Levier GRAMMAIRE** (dans `diag_sentence.py`) : accord **en contexte** — sujet-verbe (94 %), sujet à distance (`skip_pp`), participe passé (être / avoir+**COD antéposé**), **genre du GN** (`governor_gender` + **route lexicale** `lexical_gender`), désambiguïsation homographes nom/verbe. Stades développementaux (Ferreiro/Berliocchi) : phonologique→alphabétique→lexical→morphosyntaxique.
- **CORRECTEUR DYS** (`dictee/correcteur_probe.py` + panneau app « 🩹 Correcteur ») : détecte **et corrige** les homophones grammaticaux **sans corrigé** (a/à, son/sont, on/ont, leur/leurs, -é/-er, peu/peux/peut, ce/se, et/est). **0 faux positif** ; 22/24 (in-corpus), 12/15 (held-out vocabulaire neuf). UI semi-directe : clic = applique la correction + **stade**. Détail : `dictee/CORRECTEUR.md`.
- **Lexique4 reçu** → `dictee/build_cgram.py` génère (dérivés CC BY-SA) : `cgram_verbs.json` (12 415 verbes), `cgram_gender.json` (53 050 noms genrés non ambigus), `cgram_hf.json` (sous-ensemble HF **embarqué dans l'app**, bloc `<script id="vdc-lex">`). C'est la **route lexicale** de la grammaire à double voie.
- **Grammaire à double voie** (`dictee/GRAMMAIRE_DOUBLE_VOIE.md`) : route lexicale (cgram) × sublexicale (règles) + boucle montante (décider) × **descendante** (`descending_probe.py` : apprend le lexique de genre depuis l'usage, **100 % préc., FP=0, data-bound**).
- **DÉCOMPOSEUR « à la Lexique 4 »** (`dictee/decompose.py` + `dictee/DECOMPOSE.md`) : lit/apprend des mots, les décompose en **SON et ORTHO** (double voie). Route **sublexicale** = `g2p()` de l'app **extrait** en `g2p_tables.json` (`build_g2p_tables.py`, source unique) ; route **lexicale** = `phono_homophones.json` (phono SAMPA + nbhomoph) + `cgram_*`. **Apprend** = lexique incrémental `learned_lex.json` (boucle descendante, **FP=0**, non versionné). Mesuré (seed 42, n=3000, in-lexique⟂OOV) : sublexical **46 % exact / 88 % phonémique** (overlay accents : mots accentués 0→50 %) ; lexical exact par construction.
- **Validation** : `validation_terrain.html` (`build_validation_sheet.py`, fiche imprimable orthophonistes) — valide ET **nourrit la boucle descendante**. Held-out : `corpus_externe.json`/`eval_externe.py`. Loader corpus en ligne : `fetch_gec_corpus.py` (égress HF bloqué en session cloud).
- **Remédiation** (app, localStorage) : profil d'erreurs par famille + **rejeu ciblé** sur la famille la plus ratée + historique élève + réglages dys (police lisible, vitesse de dictée).
- `dictee/legacy/` — ancien cadre **mot-isolé** : **superseded**, gardé pour historique (chemins relatifs cassés).
- Docs dictée : `dictee/README.md`, `dictee/JOURNAL.md`, `dictee/CORRECTEUR.md`, `dictee/GRAMMAIRE_DOUBLE_VOIE.md`, `dictee/AUDIT.md`, `dictee/EXP_M3D_FALSIFIE.md`. Pendu-de-phrases (banc) : `evo/PHRASE_HANGMAN_PROBE.md`.

## Décisions clés (ne pas re-débattre)
- **Cible n°1 = dys / troubles de l'écrit.** **Cadre = phrases** (mots isolés = mal posés : 84 % ont des homophones).
- Pourquoi dictée : **phon→ortho = force mesurée** d'OMEGA ; **profil de défaite = signature dyslexie phon** (rapport §11.2 : 58 % voisée/sourde).
- **Débouché applicatif = CORRECTEUR DYS** (détecte+corrige+situe le stade). Il roule sur le moteur de **dictée**, pas sur le pendu → toutes longueurs, régime mot-court (où l'accord paie). Garde-fou cardinal : **FP = 0**.
- **FALSIFIÉ — NE PAS REFAIRE** : (a) M3_d ne désambiguïse pas les homophones (aucune entrée sens/contexte) — `dictee/EXP_M3D_FALSIFIE.md` ; (b) **pendu de phrases** comme levier winrate : le partage de lettres fuit les fins → la valeur est dans la *déclaration*, mesurée marginale sur le moteur ≥7 — `evo/PHRASE_HANGMAN_PROBE.md`. *Nuance* : le **readout bPC** de M3_d (cLetterScore) est « peut-être utile » (+3,4, cheat-free) — `AUDIT_OMEGA.md` §3.

## Audit projet (AUDIT_PROJET.md) — correctifs appliqués
✅ vivarium retiré · legacy dictée isolé · lexique compressé (16→5 Mo) · CI (`.github/workflows/ci.yml`) · banner sécurité omega-key · **citation Lexique 4 complète + CC BY-SA 4.0 partout**.
⏳ Reste : **validation terrain** (vraies copies dys — externe, orthophonistes ; ou corpus en ligne via `fetch_gec_corpus.py` une fois l'égress ouvert) — elle valide ET nourrit la boucle descendante ; PR #2 vers `main` en attente (8 commits OMEGA·KEY divergents à arbitrer).

## Données & licence
- `Lexique4.tsv` (33 Mo, 188 863 mots, 37 col. — `1_Mot`, `2_Phono`, `5_Cgram`, `7_Genre`, `8_Nombre`, `24_NbHomoph`…) **hors-repo** (sur Drive de Rem ; fourni en session → `/tmp/lex4/Lexique4.tsv`). Sert à **régénérer** index/corpus (`build_cgram.py`, etc.).
- **Licence données = CC BY-SA 4.0**. Citer : *New, B., Pallier, C., Schalchli, G., Bourgin, J., & Gimenes, M. (2026). Lexique 4… Behavior Research Methods, 58(5), 140.* Fichiers dérivés (donc aussi **CC BY-SA 4.0**) : `sentences.json`, `phono_homophones.json`, `cgram_verbs.json`, `cgram_gender.json`, `cgram_hf.json`, `corpus_externe.json`, `legacy/*`. Détail : `NOTICE`.

## Comment lancer
- `python3 dictee/diag_sentence.py` → diagnostic de phrases + levier grammaire (autonome ; charge cgram si présent).
- `python3 dictee/correcteur_probe.py` · `eval_externe.py` · `descending_probe.py` → mesures correcteur / held-out / boucle descendante.
- `python3 dictee/build_cgram.py` → régénère cgram_* (attend `/tmp/lex4/Lexique4.tsv`).
- `python3 dictee/build_g2p_tables.py` → extrait les tables g2p de l'app · `python3 dictee/decompose.py "mot" | --read "texte" | --lex | --measure | --demo` → décompose (son/ortho) + apprend.
- `node evo/fitness_harness.js [seed] [n]` → bench fitness pendu · `node evo/phrase_engine_bench.js` → mode phrase moteur.
- App : ouvrir `app/omega-pendu.html` ; boutons « ✍️ Dictée diag » et « 🩹 Correcteur ».

## Git
Dépôt `poratox78-spec/omega-pendu-`, branche de travail **`claude/cool-curie-ctnvhi`** (PR #7 vers `main`, draft). CI : `.github/workflows/ci.yml`.
En local : commit/push systématique (mémoire durable — la session cloud subit des rollbacks).
