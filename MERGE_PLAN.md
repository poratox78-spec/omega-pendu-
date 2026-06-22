# Plan de fusion #9 (correcteur) ⊕ #12 (audit) — sans perte de données

> Audité le 2026-06-22 (`git merge-tree` réel + diffs par fichier). **Les deux PR sont `mergeable_state: clean`
> contre `main`** ; les conflits ci-dessous n'apparaissent QUE pour la 2ᵉ PR mergée (conflit branche↔branche, pas
> contre `main`). Ce fichier est transitoire : à supprimer une fois la fusion faite.

## Contexte
- **#9** `claude/cool-curie-ctnvhi` — correcteur dys (87 fichiers, +7380/−740). Draft.
- **#12** `claude/epic-darwin-tzi6f7` — audit code + correctifs (10 fichiers, +1222/−62). Ready.
- 6 fichiers communs ; **4 conflits réels** (2 s'auto-fusionnent : `dictee/CORRECTEUR.md`, `docs/rapport-mode-emploi.html`).

## Ordre recommandé
**Merger #12 d'abord** (plus petite, ready, audit fondationnel), puis `merge main` dans #9 et résoudre les 4 ci-dessous.

## Résolution des 4 conflits (chacune préserve les deux côtés)

### 1. `.github/workflows/ci.yml` — **UNION**
- #9 ajoute 22 lignes (étapes CI correcteur : `parity_corr`, `test_speller_app`, `build_pos`, `build_assets`,
  `parity_core`, `correcteur.js`, bake…). #12 ajoute 2 lignes (`evo/ci_smoke.js`).
- **Résolution** : garder **les deux** blocs d'étapes. Aucun chevauchement logique. 0 perte.

### 2. `app/omega-pendu.html` — **UNION (régions disjointes)**
- #9 (+601/−62) = panneau « 🩹 Correcteur » + règles (zone ~fin de fichier). #12 (+480/−54) = garde fail-loud
  `cLetterScore` (moteur, script1) + accessibilité panneau dys (`aria-live`, clavier, TTS feature-detect).
- **Résolution** : garder **les deux** — ce sont des régions différentes (moteur/a11y vs panneau correcteur).
  Résoudre hunk par hunk en conservant chaque côté. 0 perte.

### 3. `docs/CONFIG_REFERENCE.md` — **garder la suppression de #9** (rename, pas perte)
- #9 a **renommé/consolidé** `CONFIG_REFERENCE.md` → `docs/CONFIG_TOGGLES.md` (consolidation 19/06 = CONFIG_REFERENCE
  + AUDIT_TOGGLES). #12 a fait une petite modif (39→42 toggles, lignes 40-42) sur l'**ancien** fichier.
- **Vérifié** : `CONFIG_TOGGLES.md` (de #9) documente DÉJÀ les toggles 40-42 (`M_NEO_PHON_COHORT_JOINTE`, `M_NEO_OS_ARB`…)
  avec un statut **plus récent** (« ON preset 20/06 »). La modif de #12 est donc **superseded, pas perdue**.
- **Résolution** : accepter la suppression de `CONFIG_REFERENCE.md` ; `CONFIG_TOGGLES.md` est le successeur. Ignorer
  l'edit de #12 sur le fichier supprimé (son information vit dans CONFIG_TOGGLES.md). 0 perte.

### 4. `evo/fitness_harness.js` — **garder la version #12** (superset)
- #9 (+1/−1) : skip aussi les blocs `text/plain` à l'extraction JS. #12 (+8/−3) : **réécriture robuste** qui skip
  TOUT type non-JS (text/plain, application/json, futurs) via un parse de `type` + flag `isJS`.
- **Résolution** : garder la version **#12** — elle **subsume** la correction de #9 (l'intention « ignorer text/plain »
  est entièrement couverte par `isJS`). 0 perte.

## Garde-fou post-fusion
Après résolution : `node --check app/omega-pendu.html`-équivalent (parités), `python3 dictee/correcteur_probe.py`,
`node dictee/parity_corr.js`, `node extension/parity_core.js`, `node evo/ci_smoke.js`, `node evo/fitness_harness.js`.
La CI (union des étapes #9+#12) couvre tout cela.
