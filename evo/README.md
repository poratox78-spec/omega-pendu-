# evo/ — OMEGA apprend à coder (auto-copie & générations)

Workstream **exploratoire**. OMEGA ne *devine* plus (pendu) : il **copie** (reconstruit) du code,
et le **pendu devient le test de sélection**. Plan complet : `EVO_ROADMAP.md`.

## `fitness_harness.js` — l'instrument de mesure (keystone Phase 1)
Charge le moteur du pendu **headless** depuis `../app/omega-pendu.html` (JS + lexique inliné),
joue N parties **seedées**, renvoie le **tri-critère** et compare deux versions **lexicographiquement**.

```bash
node evo/fitness_harness.js [seed] [n]      # ex: node evo/fitness_harness.js 12345 30
```
API : `const {runBench, fitterLex, loadEngine} = require('./evo/fitness_harness.js')`
- `runBench({seed,n,repeats})` → `{winrate, erreurs, coups, ms}` (déterministe ; `ms` = min sur `repeats`).
- `fitterLex(cand, parent)` → `+1` meilleur / `-1` pire / `0` équivalent, **lexicographique** :
  **(1) plancher win rate** → **(2) min erreurs** → **(3) min temps**.

Mesuré (config défaut, seed 12345, 30 mots) : win 10 % · err 5,00 · coups 9,30 · ~94 ms. **Déterministe** (2 runs identiques).

## Notes
- **Config défaut = flags OFF** (win ~10 %). Pour la config de référence cheat-free (~90 %, §8.3 du rapport),
  il faut exposer/activer les flags → paramètre à câbler. Pour *comparer une copie à son parent*, peu importe
  la valeur absolue : ce qui compte = **même mesure + déterminisme** (acquis).
- **Temps** : sensible au matériel → toujours `repeats>1` + valeur relative (jamais une mesure isolée).
- Le lexique 15,9 Mo est **inliné dans `app/omega-pendu.html`** (déjà au repo) → harnais **autonome**, rien à uploader.
