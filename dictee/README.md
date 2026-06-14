# Dictée diagnostique — données de test (Phase 0)

`test_set.tsv` — jeu de **300 mots étiquetés** pour mesurer le classifieur d'erreur (cf. `../DICTEE_ROADMAP.md`).
Construit depuis **Lexique4** (188 863 mots ; le `.tsv` de 34 Mo reste **hors-repo**, trop gros).
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

## Application : `dictee_app.html` (autonome)
Outil de **dictée diagnostique** prêt à l'emploi (un seul fichier, ouvrir au navigateur) :
- **620 mots gradués** (facile/moyen/difficile) inlinés (`word_pool.json`), dérivés de Lexique 4 — chaque mot a sa phono, son IPA et sa **famille d'homophones**.
- **Dictée vocale** (synthèse vocale fr-FR du navigateur), saisie élève, **diagnostic multi-étiquette** + feedback dys (accent / sourde-sonore / muette / homophone), correction révélée.
- Build : pool généré depuis `Lexique4.tsv` (seed=42, freq≥3, 260/220/140 par difficulté).

## Index & résultats (finaux)
- `phono_homophones.json` — index homophones **PLEIN** (43 580 groupes, sans filtre fréquence).
- `diagnostic.py` re-mesuré : **rappel global 99,8 %** — accent/voisée-sourde/muette **100 %**, **homophone 98,6 %** (avant index compact : 58,6 %).
