# Passer en LOCAL — guide de démarrage

Tout le projet tourne **sans rien installer d'autre** que Python et Node. Pas de `pip install`, pas de
`npm install` (aucune dépendance externe). Le cœur (correcteur, parités, app, extension) marche **sans**
le gros `Lexique4.tsv` — celui-ci ne sert qu'à *régénérer* des assets.

## 1. Prérequis
- **Python ≥ 3.8** (`python3 --version`) — stdlib uniquement.
- **Node ≥ 18** (`node --version`) — natif (le `DecompressionStream` des parités exige Node 18+).
- **Un navigateur récent** (Chrome/Edge/Firefox ≥ 2023) pour ouvrir l'app.
- **Chrome/Edge** pour charger l'extension (Manifest V3).
- **git**.

> Windows : utilise **WSL** ou **Git Bash** pour lancer `./dev.sh` (script bash). Mac/Linux : direct.

## 2. Cloner et se placer sur la bonne branche
La branche de travail unique (PR #9, tout consolidé) est **`claude/cool-curie-ctnvhi`**.

```bash
git clone https://github.com/poratox78-spec/omega-pendu-.git
cd omega-pendu-
git checkout claude/cool-curie-ctnvhi
```
(SSH : `git clone git@github.com:poratox78-spec/omega-pendu-.git`)

## 3. Vérifier que tout marche (1 commande)
```bash
./dev.sh           # rejoue les 25 checks de la CI ; « ✅ TOUT VERT » = bon
./dev.sh -q        # résumé seulement
```
`dev.sh` est le **miroir exact** de `.github/workflows/ci.yml` : vert en local = vert en CI.
*(Les étapes `build_*` régénèrent des fichiers suivis — un `git status` peut montrer des diffs de
mtime sur des `.gz`, sans conséquence : `git checkout -- <fichier>` pour nettoyer.)*

## 4. Ouvrir l'application
```bash
# Mac
open app/omega-pendu.html
# Linux
xdg-open app/omega-pendu.html
# Windows
start app/omega-pendu.html
```
Ou double-clic. C'est un **fichier unique autonome** (lexique embarqué compressé). Boutons en bas :
**✍️ Dictée diag**, **🩹 Correcteur** (réglages 🌗 thème / 🎨 daltonien / 🔤 police dys), **🔤 Décompose**.

## 5. Charger l'extension Chrome (correcteur dans n'importe quel champ)
1. `chrome://extensions`
2. Active **Mode développeur** (en haut à droite).
3. **Charger l'extension non empaquetée** → sélectionne le dossier **`extension/`**.
4. La barre flottante apparaît dans les champs de saisie ; clic = corrige.

## 6. Boucle de dev quotidienne
```bash
# … tu modifies du code …
./dev.sh                      # tout doit rester vert (FP=0 + parités app≡Python≡extension)
git add -A && git commit -m "…"
git push                      # → branche claude/cool-curie-ctnvhi (PR #9). CI re-tourne.
```
- On reste sur **une seule branche** : `claude/cool-curie-ctnvhi`.
- Garde-fou cardinal : `dictee/correcteur_probe.py` doit finir **sans erreur** (batterie dys **FP=0**) et
  les parités (`parity_corr.js`, `parity_core.js`) **vertes**.

## 7. (Optionnel) Régénérer les assets / lancer les sondes de recherche
Seulement si tu veux régénérer les lexiques dérivés ou mesurer le taux de faux positifs.

- **Lexique 4** (33 Mo, hors-repo, sur ton Drive) : place-le à `/tmp/lex4/Lexique4.tsv`
  (ou exporte `LEX4=/chemin/vers/Lexique4.tsv`).
  ```bash
  LEX4=/tmp/lex4/Lexique4.tsv python3 dictee/build_noun_post.py   # posterior pluriel/genre
  python3 dictee/build_cgram.py                                   # cgram_* (verbes/genre/conj)
  ```
- **Mesure du taux de FP réel** (corpus UD French) :
  ```bash
  git clone --depth 1 https://github.com/UniversalDependencies/UD_French-GSD /tmp/udfr
  UDFR=/tmp/udfr python3 dictee/fp_stress_test.py                 # ventilation des FP par règle
  LEX4=/tmp/lex4/Lexique4.tsv UDFR=/tmp/udfr python3 dictee/pyramide_probe.py   # sonde §3
  ```

## Repères
- **Mémoire projet** : `CLAUDE.md` (à lire en entier au démarrage). Journal : `dictee/JOURNAL.md`.
- **Doctrine** : `DOCTRINE.md`. Détail correcteur : `dictee/CORRECTEUR.md`.
- ⛔ **Ne jamais ouvrir en entier** dans un éditeur/IA : `app/omega-pendu.html` (~5 Mo),
  `dictee/phono_homophones.json`, `Lexique4.tsv` — saturent ; les traiter par script/grep ciblé.
