# OMEGA-Ω — mémoire projet (pour Claude Code local)

> Lis ce fichier en entier au démarrage. Il oriente sur le dépôt et **le chantier actif (dictée)**.
> Docs de fond : `docs/MEMOIRE.html`, `docs/rapport-mode-emploi.html` (§18 = dictée). Plan : `DICTEE_ROADMAP.md`.
> Journal le plus à jour : `dictee/JOURNAL.md`. Audit transverse : `AUDIT_PROJET.md`.

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
- **Remédiation** (app, localStorage) : profil d'erreurs par famille + **rejeu ciblé** sur la famille la plus ratée + historique élève + réglages dys (police lisible, vitesse de dictée).
- `dictee/legacy/` — ancien cadre **mot-isolé** (`diagnostic.py`, `diag_baseline.py`, `test_set.tsv`, `word_pool.json`, `build_testset.py`) : **superseded**, gardé pour historique (chemins relatifs cassés).
- Docs dictée : `dictee/README.md`, `dictee/JOURNAL.md`, `dictee/AUDIT.md`, `dictee/EXP_M3D_FALSIFIE.md`.

## Décisions clés (ne pas re-débattre)
- **Cible n°1 = dys / troubles de l'écrit.** **Cadre = phrases** (mots isolés = mal posés : 84 % ont des homophones).
- Pourquoi dictée : **phon→ortho = force mesurée** d'OMEGA ; **profil de défaite = signature dyslexie phon** (rapport §11.2 : 58 % voisée/sourde).
- **FALSIFIÉ — NE PAS REFAIRE** : M3_d ne peut pas désambiguïser les homophones (encode ortho/son, **aucune entrée sens/contexte**) ; et en dictée le contexte de la phrase suffit. Voir `dictee/EXP_M3D_FALSIFIE.md`.

## Audit projet (AUDIT_PROJET.md) — correctifs appliqués
✅ vivarium retiré (vit ailleurs/privé) · legacy dictée isolé · lexique compressé (16→5 Mo) · CI minimale (`.github/workflows/ci.yml`) · banner sécurité omega-key · **citation Lexique 4 complète + CC BY-SA 4.0 partout**.
⏳ Reste : **validation terrain** (vraies copies dys — externe, orthophonistes) ; PR #2 vers `main` en attente (8 commits OMEGA·KEY divergents à arbitrer).

## Données & licence
- `Lexique4.tsv` (34 Mo, 188 863 mots, 37 col. — `1_Mot` accentué, `2_Phono` SAMPA, `24_NbHomoph`…) **hors-repo** (trop gros ; sur Drive de Rem). Sert à **régénérer** index/corpus (scripts l'attendent en `/tmp/lex4/Lexique4.tsv` → adapter le chemin).
- **Licence données = CC BY-SA 4.0** (Attribution + Partage à l'identique). Citer :
  *New, B., Pallier, C., Schalchli, G., Bourgin, J., & Gimenes, M. (2026). Lexique 4… Behavior Research Methods, 58(5), 140.* Nos fichiers dérivés (`sentences.json`, `phono_homophones.json`, `legacy/*`) sont donc aussi **CC BY-SA 4.0**. Détail : `NOTICE`.

## Comment lancer
- `python3 dictee/diag_sentence.py` → mesure le diagnostic de phrases (autonome, pas besoin du lexique 34 Mo).
- `node evo/fitness_harness.js [seed] [n]` → bench fitness du pendu (charge le moteur headless).
- App : ouvrir `app/omega-pendu.html` au navigateur ; bouton « ✍️ Dictée diag » pour la dictée.

## Git
Dépôt `poratox78-spec/omega-pendu-`, branche de travail `claude/replace-repo-content-6jWzn`. CI : `.github/workflows/ci.yml`.
En local : commit/push systématique (mémoire durable — la session cloud subit des rollbacks).
