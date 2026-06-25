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

## Correcteur dys & grammaire à double voie
- **Levier grammaire** (dans `diag_sentence.py`) : accord en contexte (sujet-verbe, sujet à distance, participe être/avoir+COD, **genre du GN** + route lexicale `lexical_gender`), homographes nom/verbe, **stades développementaux**.
- **Correcteur** : `correcteur_probe.py` (détecte+corrige les homophones grammaticaux **sans corrigé**, 0 FP) ; panneau app « 🩹 Correcteur » (clic-pour-corriger + stade). Détail : `CORRECTEUR.md`.
- **Lexique4 → cgram** : `build_cgram.py` génère `cgram_verbs.json` / `cgram_gender.json` / `cgram_hf.json` (embarqué app). Régénérer : `python3 dictee/build_cgram.py` (attend `/tmp/lex4/Lexique4.tsv`).
- **Double voie** : `GRAMMAIRE_DOUBLE_VOIE.md` (route lexicale × sublexicale, boucle montante × descendante `descending_probe.py`). Held-out : `eval_externe.py` ; loader corpus en ligne : `fetch_gec_corpus.py`.
- **Décomposeur « à la Lexique 4 »** : `decompose.py` (+ `DECOMPOSE.md`) — lit/apprend des mots et les décompose en **SON · ORTHO · MORPHO** (double voie). Sublexical = `g2p()` extrait (`build_g2p_tables.py`) + SEG enrichi + correction apprise (`build_g2p_corrections.py`) ; lexical = `phono_homophones.json` + `cgram_*` + `morpho.json` (`build_morpho.py`). Apprend = `learned_lex.json` (FP=0). Mesuré **held-out** : sublexical **52,4 % exact / 89,5 % phonémique** (seed 42, test=4000). Lancer : `python3 dictee/decompose.py --demo`.
- **Décompo parallèle 3 voies** : `decompose_corpus.py` — ORTHO ∥ PHON ∥ GRAMMAIRE (cgram/genre/nombre/morpho + rôle en contexte) ; lit le corpus réel `corpus_gec_fr.jsonl` et enrichit la base (rôles grammaticaux stockés). `--show` = aperçu lecture seule.
- **Cognition phono→ortho** : `p2g.py` (+ `P2G.md`) — l'inverse (son→écriture), jointe §3 (émission × prior ortho × lexicalité). Mesuré held-out : top-1 27 % · top-5 73 %. Lancer : `python3 dictee/p2g.py --mot oiseau`.

## Validation terrain (vraies copies dys)
- `build_validation_sheet.py` → génère `validation_terrain.html` : fiche imprimable (protocole anonymisé · feuille examinateur avec grille de relevé expert↔outil · feuille élève en lignes vierges · synthèse + taux d'accord). Régénérer : `python3 dictee/build_validation_sheet.py`, puis ouvrir l'HTML au navigateur (Ctrl+P pour imprimer/PDF). Sert à **mesurer l'accord** entre le diagnostic automatique et le jugement de l'orthophoniste (doctrine §4 : le juge est humain).

---

## Audit (2026-06-14) — findings & résolution

> Consolidé ici depuis l'ancien `AUDIT.md`. L'étiquette « terminée » était prématurée ; la plupart des findings sont **fermés** depuis (cf. `JOURNAL.md`).

| Sévérité | Finding | Statut |
|---|---|---|
| 🔴 CRITIQUE | **Mots isolés mal posés** : 522/620 mots ont ≥1 homophone (surtout flexionnels) → au son seul, l'élève ne peut pas choisir la graphie ; l'outil pénalise une graphie valide. | **FERMÉ** → bascule au **cadre PHRASES** (le contexte rend homophones/accords gradables). |
| 🟠 HAUT | **Dyslexie de surface** non détectée (*bato→bateau*, plausible mais faux). | **FERMÉ** → normaliseur phonétique `norm()` (surface 17/17). |
| 🟠 HAUT | **Divergence** `diagnostic.py` (5 cat) ≠ app (7 cat) ; inversion/ajout non validés sur jeu étiqueté. | **Superseded** (cadre mot-isolé `legacy/`) → moteur de référence unique `diag_sentence.py`. |
| 🟡 MOYEN | **Mesure circulaire** (erreurs synthétisées) ; pas de données réelles. | **Partiel** : held-out vocab neuf + 98 phrases GEC réelles (correcteur FP=0) ; **validation terrain orthophonistes = risque ouvert n°1**. |
| 🟡 MOYEN | Casse non normalisée ; pas de remédiation. | **FERMÉ** : remédiation (profil + rejeu ciblé) livrée. |
| 🟢 BAS | Message accent figé. | mineur. |

## Falsifié — M3_d ne désambiguïse PAS les homophones (2026-06-13, design)

> Consolidé ici depuis l'ancien `EXP_M3D_FALSIFIE.md`. Résultat négatif instructif (doctrine §6 ; mémoire §8).

Hypothèse (Rem) : le concept M3_d, orphelin dans le pendu, trouverait une utilité en désambiguïsant les homophones du diagnostic. **Verdict : falsifié au design — ne pas construire.**
- **Vérif code** : `M3_d_step()` encode depuis `M1_d.output` (perception **orthographique**) + option `M1_phon` (articulatoire) ; autoencodeur bPC sur le pattern ortho/son. **Aucune entrée sémantique / contexte / lexicale.**
- **Pourquoi ça falsifie** : (1) **mauvais signal** — homophones = même son ; l'ortho (seul signal discriminant de M3_d) est justement la **sortie cherchée** ; fed le son, M3_d produit le **même concept** pour *ver/vert/verre* → ne peut pas trancher, et aucun canal de contexte. (2) **Pas de problème réel** — en dictée le mot cible est **connu** ; l'ambiguïté (ex. *battu↔battus*) se gère en **multi-étiquette** (feedback plus riche), pas un défaut.
- **Conséquence** : désambiguïser le sens exigerait un **signal externe** (contexte de phrase / petit LM) = la raison d'être de la **dictée de PHRASES** (le contexte, pas M3_d). Valeur intacte : **91,3 %** de diagnostic exact sans M3_d, les ~9 % d'ambigus = feedback multi-étiquette.

---

## Licence des données
Données dérivées de **Lexique 4** — à citer :
> New, B., Pallier, C., Schalchli, G., Bourgin, J., & Gimenes, M. (2026). *Lexique 4: A major upgrade of the « Lexique » French lexical database.* Behavior Research Methods, 58(5), 140. — lexique.org

Licence : **CC BY-SA 4.0** (Attribution — Partage dans les mêmes conditions). Les fichiers dérivés ici (`sentences.json`, `phono_homophones.json`, `legacy/test_set.tsv`, `legacy/word_pool.json`) sont donc aussi sous **CC BY-SA 4.0**.
