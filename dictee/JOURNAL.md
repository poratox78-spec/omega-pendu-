# Dictée diagnostique — Journal

> Journal de bord (entrée la plus récente en haut) pour ne pas se perdre ni refaire deux fois.
> Voir aussi : `../DICTEE_ROADMAP.md` (plan), `README.md` (données), `../docs/MEMOIRE.html` (moteur OMEGA).

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
- **Décision : on ne monte pas l'expérience A.** M3_d reste sans rôle (cohérent mémoire §8). Détail : `EXP_M3D_FALSIFIE.md`.
- **Pivot : on avance la surface** (Ph.1-2) — 91,3 % de diagnostic sans M3_d ; sémantique = signal externe à acter séparément si dictée de phrases un jour.
