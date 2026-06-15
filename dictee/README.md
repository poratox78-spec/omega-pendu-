# Dictée diagnostique — données de test (Phase 0)

`test_set.tsv` — jeu de **300 mots étiquetés** pour mesurer le classifieur d'erreur (cf. `../DICTEE_ROADMAP.md`).
Construit depuis **Lexique 4** (188 863 mots ; le `.tsv` de 34 Mo reste **hors-repo**, trop gros).
Reproductible : `seed=42`, script `build_testset.py` (logique ci-dessous).

## Colonnes
`mot` (orthographe accentuée) · `phono` (SAMPA) · `ipa` · `cgram` · `nblettres` · `nbphons` ·
`syll` · `freq` (FreqOrtho /M) · `preval` (% connaissance) · `difficulte` (facile/moyen/difficile) ·
`labels` (catégories d'erreur, multi, séparées par `;`) · `homophones` · `confus_vs` (paire minimale voisée/sourde).

## Étiquettes (dérivées des colonnes Lexique4, pas à la main)
- **homophone** — un autre mot a le **même `phono`** (famille listée dans `homophones`). *ver/vert/verre.*
- **voisee_sourde** — il existe une **vraie paire minimale** par swap voisée/sourde (p·b, t·d, k·g, f·v, s·z, ʃ·ʒ) → `confus_vs`. *La signature dys du mémoire (58 % des défaites).* 
- **accent** — le mot contient **é/è/ê** (choix d'accent = piège de dictée).
- **muette** — **≥2 lettres muettes** (`nblettres − nbphons ≥ 2`), resserré pour rester discriminant.
- *(sans label = contrôle : mot fréquent, écriture proche du son.)*

## Composition
300 mots, catégories principales équilibrées (homophone 70 · voisée/sourde 60 · accent 70 · muette 70 · contrôle 30),
gradués en difficulté via `preval`+`freq`. Multi-étiquettes possibles par mot.

## Limites (v1)
- `muette` reste fréquent (le français est riche en lettres muettes) — discriminant mais pas rare.
- Pas encore d'erreur « régularisation » étiquetée (graphie plausible mais fausse) — à ajouter si besoin.

---

## Application : intégrée dans `app/omega-pendu.html` (fichier UNIQUE)
La dictée diagnostique est un **panneau additif** du fichier OMEGA unique (bouton « ✍️ Dictée diag », bas-droite).
**OFF-inerte** (IIFE, ne touche pas le moteur pendu — doctrine R66). Contenu :
- **620 mots gradués** (Lexique 4) inlinés (`word_pool.json`) avec phono/IPA/famille d'homophones,
- **dictée vocale** (synthèse fr-FR), saisie, **diagnostic multi-étiquette** + feedback dys, correction révélée.
- Catégories **fondées sur la typologie dysorthographique** (phono/lexical-surface/sémantique) :
  **accent · voisée-sourde · inversion · muette · ajout · homophone** (morphosyntaxique/accords = extension *phrases*).
- Diagnostic JS testé 8/8 (identique à `diagnostic.py` + nouvelles catégories).


## Index & résultats (finaux)
- `phono_homophones.json` — index homophones **PLEIN** (43 580 groupes, sans filtre fréquence).
- `diagnostic.py` re-mesuré : **rappel global 99,8 %** — accent/voisée-sourde/muette **100 %**, **homophone 98,6 %** (avant index compact : 58,6 %).

> **MAJ 2026-06-14 — cadre = DICTÉE DE PHRASES** (audit : la dictée de mots isolés est mal posée pour 84 % des mots à cause des homophones/accords). Le moteur de référence est `diag_sentence.py` (corpus `sentences.json`), intégré dans `app/omega-pendu.html` (panneau « ✍️ Dictée diag », mode phrases). Les fichiers mot-isolé (`diagnostic.py`, `test_set.tsv`, `word_pool.json`) sont **legacy**.

## Licence des données
Données dérivées de **Lexique 4** — à citer :
> New, B., Pallier, C., Schalchli, G., Bourgin, J., & Gimenes, M. (2026). *Lexique 4: A major upgrade of the « Lexique » French lexical database.* Behavior Research Methods, 58(5), 140. — lexique.org

Licence : **CC BY-SA 4.0** (Attribution — Partage dans les mêmes conditions). Les fichiers dérivés ici (`sentences.json`, `phono_homophones.json`, `legacy/test_set.tsv`, `legacy/word_pool.json`) sont donc aussi sous **CC BY-SA 4.0**.
