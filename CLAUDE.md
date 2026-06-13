# OMEGA-Ω — mémoire projet (pour Claude Code local)

> Lis ce fichier en entier au démarrage. Il oriente sur le dépôt et **le chantier actif (dictée)**.
> Docs de fond : `docs/MEMOIRE.html`, `docs/rapport-mode-emploi.html`. Plan dictée : `DICTEE_ROADMAP.md`.
> Journal dictée (le plus à jour) : `dictee/JOURNAL.md`.

## Ce dépôt contient 3 choses
1. **OMEGA-Ω** — moteur cognitif de **pendu français** (`app/omega-pendu.html`, monolithique : code + lexique inlinés). Doctrine **« cognition > oracle »** + **R66** (mesurer/falsifier avant de garder ; tout module OFF par défaut, baseline byte-identique au repos). Détails : `docs/MEMOIRE.html` + `docs/rapport-mode-emploi.html`.
2. **`omega-key/`** — messagerie chiffrée (projet dérivé). Pas le focus.
3. **`dictee/`** — **SOUS-PROJET ACTIF** : *dictée diagnostique* (cible **dys / troubles de l'écrit**) bâtie sur la **double route** phon↔ortho d'OMEGA.

## Chantier actif = dictée. Déjà fait & commité (depuis une session cloud)
- `DICTEE_ROADMAP.md` — plan en 7 phases (doctrine R66).
- `dictee/test_set.tsv` — **300 mots étiquetés** (homophone / voisée-sourde paire minimale / accent / muette / contrôle) + `build_testset.py` (repro, seed=42) + `README.md`.
- `dictee/diag_baseline.py` — baseline diagnostic : **91,3 % exact, 8,7 % ambigu** (`diag_baseline_results.md`).
- `dictee/diagnostic.py` — **module multi-étiquette + feedback FR** : `diagnose(cible, tentative[, phono])`. **Rappel 93 %** (accent/voisée-sourde/muette = 100 %, homophone 58,6 %).
- `dictee/phono_homophones.json` — index homophones compact (mots freq≥1) pour détecter les homophones sans le lexique 34 Mo.
- `dictee/JOURNAL.md` — journal de bord. `dictee/EXP_M3D_FALSIFIE.md` — résultat négatif (voir ci-dessous).

## Décisions clés (ne pas re-débattre)
- **Cible n°1 = dys / troubles de l'écrit** (école/soutien).
- Pourquoi dictée : **phon→ortho est la force mesurée** d'OMEGA, et son **profil de défaite = signature de dyslexie phonologique** (mémoire §11.2 : 58 % voisée/sourde).
- **Accents** : surface ASCII, mais l'accent **vit dans le SAMPA** (é=/e/, è/ê=/E/ ; `PHON_TO_LETTERS` + `M4_PHON_USE_P`). Lexique complet : `1_Mot` accentué → en lexique l'accent est un **lookup**.
- **Périmètre** : mots courts + accents assumés.
- **FALSIFIÉ — NE PAS REFAIRE** : M3_d **ne peut pas** désambiguïser les homophones (il encode `M1_d` ortho + option `M1_phon`, **aucune entrée sens/contexte**). Et il n'y a pas de vrai problème (cible connue → feedback multi-étiquette). Voir `dictee/EXP_M3D_FALSIFIE.md`.

## À FAIRE en local (ordre conseillé)
1. **Couverture homophone pleine** : régénérer `dictee/phono_homophones.json` depuis le **Lexique4 complet** (sans filtre freq) → fait monter le rappel homophone (>58,6 %).
2. **Reconstruction accents hors-lexique** : enrichir `PHON_TO_LETTERS` dans `app/omega-pendu.html` pour émettre é/è/ê/ô/ç depuis le SAMPA (/e/→é, /E/→è/ê…). **R66 : OFF-inerte** — ne pas casser le pendu ; mesurer l'apport avant de garder.
3. **UI dictée (Phase 2)** : écran de saisie élève + **dicter** (TTS depuis `2_Phono`/`3_Phono_IPA`) + porter la logique de `diagnostic.py` dans l'app + afficher le **feedback multi-étiquette**.
4. *(optionnel)* **dictée de PHRASES** : seul cadre où un signal **sémantique externe** (embeddings/contexte) aurait du sens — M3_d n'y suffit pas (cf. falsification).

## Données
Le **`Lexique4.tsv`** (34 Mo, 188 863 mots, 37 col. — `1_Mot` accentué, `2_Phono` SAMPA, `3_Phono_IPA`, `24_NbHomoph`, `15_NbLettres`/`16_NbPhons`, `33_Preval`…) **n'est PAS dans le repo** (trop gros). Rem l'a (Drive). `build_testset.py` l'attend en `/tmp/lex4/Lexique4.tsv` → **adapter le chemin** en local.

## Comment lancer
- `python3 dictee/diagnostic.py` → mesure le module (autonome, pas besoin du lexique).
- `python3 dictee/diag_baseline.py` → baseline + taux d'ambiguïté.
- `python3 dictee/build_testset.py` → régénère le jeu de test (**nécessite** le `.tsv`).
- App pendu : ouvrir `app/omega-pendu.html` dans un navigateur.

## Git
Le dépôt est `poratox78-spec/omega-pendu-` (branche de travail `claude/replace-repo-content-6jWzn`).
En local : commit/push systématique (c'est la mémoire durable — la session cloud, elle, subit des rollbacks).
