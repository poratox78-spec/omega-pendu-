# Audit projet — dépôt `omega-pendu-` (2026-06-14)

Audit transverse, rangé par sévérité, avec preuves. Branche : `claude/replace-repo-content-6jWzn`.

## Vue d'ensemble — c'est un MONOREPO de 5 projets
| Projet | Dossier | État |
|---|---|---|
| OMEGA-Ω pendu | `app/` (+`docs/`,`notes/`) | **mûr** (mémoire+rapport, doctrine R66) |
| Dictée dys | `dictee/` | **récent, audité** (phrases + diagnostic + remédiation) |
| OMEGA apprend à coder | `evo/` | **embryon** (harnais fitness mesuré) |
| OMEGA·KEY (messagerie chiffrée) | `omega-key/` | autonome, **sécurité-sensible** |
| VIVARIUM (jeu) | `vivarium/` | committé mais **hors-doc & probablement périmé** |

Le nom « omega-pendu » ne reflète plus le contenu. Tout vit sur **une branche jamais mergée** : `main` est **35 commits en arrière** (n'a ni dictée, ni evo, ni le travail récent). `.git` = 28 Mo.

## 🟠 Structure & cohérence
- **Monorepo non assumé** : `README` ne cite que pendu+omega-key ; `CLAUDE.md` liste 4 projets (**oublie vivarium**) ; `vivarium/` est committé (12 fichiers) mais **non documenté** → orphelin.
- **Branche unique jamais mergée** (`main..HEAD` = 35 commits) : le contenu réel n'existe que sur la branche de travail. Poussé sur origin (donc sauvé), mais conceptuellement fragile.
- **Reco** : assumer le monorepo (README chapeau + CLAUDE.md listant les 5) **ou** séparer (vivarium est voulu privé/local → le sortir).

## 🟠 OMEGA pendu (app) — monolithe à 97 % de données
- `app/omega-pendu.html` = **16 Mo dont 15,5 Mo (97 %) = lexique JSON inliné** ; ~540 Ko de code réel (+ dictée).
- Conséquences : **lourd à charger/éditer/diff** (edits faits via Python), `.git` gonflé.
- Le moteur pendu reste **mûr et documenté** ; la dictée ajoutée en **IIFE OFF-inerte ne touche pas la baseline** ✓.
- **Reco** : externaliser le lexique (data chargée à part) ou le compresser ; sinon assumer le coût.

## 🟠 OMEGA·KEY — sécurité non auditée indépendamment
- Crypto (AES-GCM-256, Double Ratchet, passphrases, relais). Durcissements committés (PBKDF2, anti-rejeu). **Un disclaimer existe** dans le README/app.
- **Aucune revue cryptographique indépendante.** **Reco** : ne pas l'employer pour de vrais secrets sans audit pro ; garder l'avertissement bien visible. (Hors de ma capacité à garantir la sécurité.)

## 🟡 Dictée — legacy/cruft (source de vérité ambiguë)
- Cadre actif = **phrases** (`diag_sentence.py` + app). Mais 6 fichiers **legacy mot-isolé** subsistent : `diagnostic.py`, `diag_baseline.py`, `diag_baseline_results.md`, `test_set.tsv`, `word_pool.json`, `build_testset.py`.
- **Reco** : isoler dans `dictee/legacy/` (ou supprimer), garder `test_set.tsv` étiqueté (utile à l'équipe Lexique). Validation encore **synthétique/circulaire** → données réelles requises (externe).

## 🟡 VIVARIUM — committé mais périmé + hors-doc
- 12 fichiers committés. Or le travail récent (base `fe0f774d`, etc.) s'est fait **en local/uploads** → la copie du repo est **probablement périmée**, et vivarium est voulu **privé/local**.
- **Reco** : le **retirer du repo** (cohérent) **ou** le resynchroniser ; ne pas laisser une copie périmée.

## 🟡 Process — pas de tests/CI
- **Aucune CI**, pas de suite de tests dédiée (vérifs ad-hoc en Node ; les scripts `dictee/*.py` font office de mesures).
- Doc **fragmentée** (≥8 roadmaps/journaux/mémoires) ; `CLAUDE.md` = index mais incomplet.
- **Reco** : un dossier `tests/` + un workflow CI minimal (au moins : les scripts de mesure dictée + un check de syntaxe du bloc app).

## 🟢 Points sains
- **Tout est committé/poussé** → durable contre les rollbacks cloud (la leçon clé du projet).
- **Doctrine R66 / OFF-inerte** respectée (la dictée n'altère pas le pendu ; baseline intacte).
- **Journaux détaillés**, résultats négatifs documentés (`EXP_M3D_FALSIFIE`, `M3D-reconnexion-FALSIFIE`) — culture scientifique saine.

## Recommandations priorisées
1. **Trancher VIVARIUM** (retirer du repo ou resync) + **mettre CLAUDE.md/README à jour** (assumer le monorepo, lister les 5).
2. **OMEGA·KEY** : avertissement sécurité visible + revue crypto avant tout usage réel.
3. **Dictée** : isoler le legacy ; viser une validation sur **données réelles**.
4. **app** : décider du sort du lexique (97 % de données) — externaliser/compresser.
5. **(option)** merger la branche vers `main` (ou clarifier la stratégie de branche) ; ajouter tests + CI minimal.
