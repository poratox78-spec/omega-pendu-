# 🔎 AUDIT BASELINE — signalement « la base a peut-être bougé » (À FAIRE PLUS TARD)

> **Statut : OUVERT · NON CONFIRMÉ · à auditer plus tard.** Mémo de documentation, pas un diagnostic clos.
> **Ne rien « réparer » sans mesure A/B.** Ne pas toucher la base pendant l'instruction.
> Doctrine concernée : **R66** (« baseline byte-identique au repos », CLAUDE.md §1 · DICTEE_ROADMAP §24 · REPRISE_MOTEUR §69).

## 1. Le signalement (Rem, 2026-06-20)
> « on a un problème sur notre base à ne pas toucher, elle l'a été. Je n'ai **peut-être** plus les mêmes résultats —
> et je dis bien **peut-être**, alors n'invente pas. Depuis **décompose** et un **ajustement trexquant**. Va falloir
> un **audit structurel profond**. »

À retenir tel quel : (a) la base a **peut-être** été modifiée ; (b) les résultats sont **peut-être** différents
(**non mesuré**) ; (c) fenêtre suspecte = travail **décompose** + **ajustement trexquant** ; (d) **ne pas inventer**.

## 2. Faits VÉRIFIABLES (git — non interprétés)
- Le **bloc lexique du moteur** embarqué dans l'app — `<script type="text/plain" id="lex4-data-gz">`
  (`app/omega-pendu.html`, ~ligne 731, **une seule ligne ~5 Mo gzip+base64**) — a été **modifié 2 fois** dans la fenêtre :
  - **`9d3763c`** (2026-06-20 03:43) « moteur: base lexicale COMPLÈTE embarquée (**83 605 → 155 493 mots**) » — `app` : 1 ligne changée (= le bloc lexique).
  - **`3ff98c1`** (2026-06-20 10:57) « moteur: réintègre **mb** (base morpho) dans le lexique embarqué + **fix harnais evo** » — `app` : 1 ligne (le bloc), **+ `evo/fitness_harness.js` + `evo/measure_lex_bylen.js` + `dictee/morpho.json`**.
- **Mécanique de mesure** : `evo/fitness_harness.js` lit le lexique **depuis `lex4-data-gz`** (ligne 17) et **tire les mots de test ET la connaissance du devineur de ce même lexique** (`O.pick(n,seed)`, ligne 53). ⇒ **changer le lexique embarqué change mécaniquement le résultat du banc** (jeu de test + savoir du solveur). Ce n'est pas une spéculation, c'est la chaîne de dépendance.
- **Dernière baseline « propre » connue** (avant le 1er changement de lexique) : **`6f9fe61`** (parent de `9d3763c`).
- **Sonde trexquant** `dd3a4e4` (2026-06-20 12:36) « trexquant : la morpho/décompose n'aide pas l'OOV (FALSIFIÉ) » = **read-only** (sonde de falsification, `evo/trexq_morpho_probe.py`) — ne touche pas la base. L'« ajustement trexquant » évoqué pointe **plus probablement** vers le **« fix harnais evo » de `3ff98c1`** (le banc Trexquant tourne sur ce harnais).
- Chronologie : le passage 83k→155k (`9d3763c`, 03:43) précède de peu le 1er commit décompose (`0e03bf2`, 04:03) — **même session de travail**. La formulation « depuis décompose » est donc approximativement juste (même fenêtre).

## 3. Hypothèse n°1 — à VÉRIFIER, **pas** conclue
Le **changement du lexique embarqué** (83k→155k puis réintégration `mb`) est le **candidat le plus probable** au
changement de résultats : le banc lit ce lexique pour le test **et** pour le solveur. **Plausibilité mécanique : haute.
Mesure : AUCUNE faite ici.** Ne pas conclure avant l'A/B.

Sous-hypothèses possibles (non mesurées) :
- (a) le 155k est une **nouvelle baseline volontaire** (le message `9d3763c` dit « base lexicale COMPLÈTE » → intention apparente), mais **l'impact winrate n'a pas été A/B mesuré** à l'époque ;
- (b) le **harnais** lui-même (`3ff98c1` : exclusion des blocs `text/plain` speller, cf. SyntaxError corrigée) a **changé la sémantique de mesure** → comparer à **harnais constant** ;
- (c) la **logique moteur** (hot-path) a bougé indépendamment du lexique → à exclure par `git diff` (cf. §4).

## 4. Plan de l'AUDIT PROFOND (pour plus tard — ne pas exécuter à la légère)
1. **A/B winrate baseline** (le test cardinal) :
   - `git worktree` sur **`6f9fe61`** (baseline propre) vs **HEAD** ;
   - `node evo/fitness_harness.js <seed> <n>` avec **mêmes graines** et **même harnais** (⚠️ le harnais a changé en `3ff98c1` : pour un A/B honnête, fixer **un** harnais — p.ex. copier le `fitness_harness.js` courant dans les deux worktrees — sinon on mélange « changement lexique » et « changement harnais ») ;
   - comparer winrate **in-lex ET OOV séparés**, **≥4 graines** (protocole R66).
2. **R66 byte-identity du CODE moteur (hors donnée)** : `git diff 6f9fe61 HEAD -- app/omega-pendu.html` en **excluant la ligne `lex4-data-gz`** (et les blocs lexiques speller/gdet/vdc ajoutés) → confirmer que **seule la DONNÉE a changé, pas la logique**. Si du code moteur a bougé hors toggles OFF → violation R66 à traiter.
3. **Intentionnalité** : retrouver dans `JOURNAL`/`AUDIT_OMEGA.md` si le passage 155k a été **décidé comme baseline** (et non effet de bord). Le commit `3ff98c1` documente la réintégration `mb` — relire son entrée journal.
4. **Mesure harnais** : vérifier que l'exclusion des blocs `text/plain` (speller-lex etc.) dans `fitness_harness.js`/`measure_lex_bylen.js` ne **fausse pas** la sélection des mots ni le décodage du lexique moteur.

## 5. Garde-fous (pour celui qui fera l'audit)
- ⛔ **Ne PAS revenir au 83k « pour réparer » sans A/B** : le 155k est peut-être **meilleur**. Mesurer d'abord, décider ensuite.
- ⛔ **Ne pas toucher la base** (`lex4-data-gz`, hot-path moteur) pendant l'instruction ; travailler en **worktree** isolé.
- ✅ Tout passe par **fitness_harness** (in-lex/OOV séparés, ≥4 graines, barrière de mérite §6.4) + bouton **« 🎯 Trexquant »** de l'app.
- ✅ Conclure **par la mesure**, pas par l'intuition. Si rien ne régresse → fermer ce mémo en notant l'A/B.

## 6. Pointeurs
- Base : `app/omega-pendu.html` (bloc `lex4-data-gz` ~L731). Banc : `evo/fitness_harness.js`, `evo/measure_lex_bylen.js`.
- Audit moteur existant : `AUDIT_OMEGA.md` · reprise : `REPRISE_MOTEUR.md` · SOTA/baseline Trexquant ~18 % OOV : `docs/HANGMAN_SOTA.md`.
- Commits clés : `6f9fe61` (avant) · `9d3763c` (83k→155k) · `3ff98c1` (mb + harnais) · `dd3a4e4` (sonde trexquant, read-only).
