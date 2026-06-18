# Dictée diagnostique — Journal

> Journal de bord (entrée la plus récente en haut) pour ne pas se perdre ni refaire deux fois.
> Voir aussi : `../DICTEE_ROADMAP.md` (plan), `README.md` (données), `../docs/MEMOIRE.html` (moteur OMEGA).

---

## 2026-06-18 — Lexique4 reçu → route LEXICALE de la grammaire (verbes + GENRE)

Rem a fourni le `Lexique4.tsv` (33 Mo) → `build_cgram.py` génère deux ressources dérivées (CC BY-SA) :
- `cgram_verbs.json` (**12 415** formes verbales, col. 5_Cgram=VER) → `vlike` (couverture verbale complète).
  *Mesuré* : FP=0 ; sur le jeu-témoin contrived 21/24 (vs 22/24 liste blanche) car les **homographes nom+verbe**
  (livre/porte/trouve…) passent pour verbes → leçon = croiser avec le contexte (jointe §3), pas drapeau brut.
- `cgram_gender.json` (**53 050** noms à genre NON ambigu ; 186 ambigus écartés : tour, livre…) → **route lexicale
  du GENRE** : `lexical_gender(T,i)` lit le genre du nom-tête quand le déterminant ne le marque pas (leur/notre/des).

`diag_sentence` : branche genre = `governor_gender(T,i) or lexical_gender(T,i)`. **Mesuré : 3/3** sur déterminant
neutre (« Leur grande maison » → maison f → grande ; « Notre petite voiture » → f ; « Leur chien noir » → m) —
là où on **s'abstenait** avant. Familles **100 %** + toutes les mesures précédentes **intactes** (la route lexicale
n'ajoute que des décisions, jamais ne change un diagnostic correct). FP-safe (noms ambigus écartés du lexique).

C'est la **moitié « route lexicale »** de la double voie (`GRAMMAIRE_DOUBLE_VOIE.md`). Reste : la moitié
« boucle descendante » (apprendre depuis les cibles de dictée) et le port app (sous-ensemble haute-fréquence).

---

## 2026-06-18 — Direction CORRECTEUR dys : probe « détecter + corriger SANS corrigé » (0 faux positif)

### Idée (Rem) → recadrage
Faire du levier d'accord un **correcteur orthographique dys semi-direct**. Recadrage : le correcteur roule sur le
moteur de **dictée** (pas le pendu) → toutes longueurs, régime mot-court (où l'accord paie). Le pendu de phrases
a été un **banc de mesure** (falsifié comme débouché winrate), pas l'application. Angle unique : détecte + corrige
**+ situe le STADE** (remédiation dys), ce qu'aucun correcteur grand public ne fait.

### Le seul inconnu, mesuré (`dictee/correcteur_probe.py`)
La dictée connaît la cible ; un correcteur doit **inférer l'intention**. Règles `decide(T,i)` par homophone
grammatical (réutilise `diag_sentence`), détection ET correction faites ensemble (« sinon on le fait deux fois »).
- **Faux positifs sur 30 phrases correctes : 0** (condition n°1 : ne pas corriger du texte juste).
- **Détection + correction : 13/16** ; **9/9** sur `-é/-er`, `son/sont`, `leur/leurs`.
- 3 manques (`a/à`, `et/est`, `on/ont` présent) = `is_verb` est un stub de 32 formes du corpus (ignore « mange »…).
  Mécanisme, pas échec d'architecture : un lexique POS (Lexique4 `cgram`) les lève et scale.
- Bug attrapé en route : un FP `sont→son` quand un adjectif s'intercale (« fleurs rouges sont ») → règle son/sont
  recadrée sur le mot **précédent** (verbe/prép/conj → possessif ; sujet → verbe) → 0 FP.

### Verdict
Cœur du correcteur validé sur l'existant, **0 faux positif**. Suite : élargir `is_verb` (cgram), couche typo
(non-mot via voisins), UI semi-directe (réutiliser le panneau dictée, OFF-inerte R66). Détail : `dictee/CORRECTEUR.md`.

---

## 2026-06-18 — Validation terrain : fiche imprimable (le juge est humain, §4)

### Quoi
Le levier grammaire « classe fermée » a épuisé ce que le corpus de 30 phrases permet de **mesurer en synthétique**.
Prochaine étape du plan = **C, validation terrain** (vraies copies dys, orthophonistes) : c'est le vrai juge (doctrine §4).
Livrable : un **support imprimable** pour faire passer la dictée et **mesurer l'accord outil↔expert**.

- `dictee/build_validation_sheet.py` — générateur (réutilise `sentences.json` + `FAM2STAGE`/`STAGE_ORDER` de `diag_sentence.py`,
  doctrine §5 : pas de duplication des données). Régénérable.
- `dictee/validation_terrain.html` — fiche autonome, 3 feuilles (sauts de page) :
  1. **Protocole + métadonnées élève** (anonymisé, consignes, aide-mémoire familles/stades).
  2. **Feuille EXAMINATEUR** : 30 phrases à dicter + grille de relevé par mot fauté
     (mot cible · écrit élève · **famille expert** · stade · **famille outil** · **accord ?**) → mesure directe du taux d'accord.
  3. **Feuille ÉLÈVE** : lignes vierges numérotées, police lisible dys — **sans le texte cible** (c'est une dictée).
  4. **Synthèse** : profil de stade (expert vs outil) + calcul du **taux d'accord** = validation/falsification du diagnostic.

### Conception (pourquoi cette forme)
- Diagnostic expert **en aveugle** d'abord, comparaison à l'outil ensuite → le taux d'accord n'est pas biaisé.
- Cible interne = 100 %/famille (synthétique) ; un écart terrain pointe la famille à revoir (donnée actionnable, §1 falsifiable).
- Pas de moteur PDF dans l'env → l'HTML s'imprime au navigateur (Ctrl+P). Données : Lexique 4, CC BY-SA 4.0.

---

## 2026-06-18 — Levier grammaire : participe passé avec AVOIR, le COD antéposé

### Quoi
La dernière règle d'accord « dure » du français : le participe avec *avoir* s'accorde avec le **COD
quand il est ANTÉPOSÉ** (« la pomme **qu'**il a cueilli**e** ») et reste **invariable** sinon (« il a cueilli des pommes »).

- `find_cod_antepose(T,idx)` : cherche un relatif **« que / qu' »** à gauche du participe (fenêtre courte) ;
  l'antécédent = le GN avant le relatif → genre/nombre via `governor_gender` + `governor_number`.
  Renvoie `(antécédent, genre|None, nombre|None)`, ou `None` (→ invariable).
- Branche *avoir* de `diagnose_sentence` : accord avec le COD antéposé si relatif, sinon « invariable, COD placé après ».
  ⚠️ Le tokeniseur garde l'élision : `qu'il` est **un seul token** → on teste `== 'que'` **ou** `startswith("qu'")`.

### Mesuré (`python3 dictee/diag_sentence.py`)
- Familles **100 %** · participe détecté **7/7** inchangés.
- Démos COD (synthétiques — le corpus n'a que des COD postposés, cf. phrases 14/18) :
  - « La pomme **qu'**il a cueillie » → COD antéposé « pomme » (f, sg) → accord ✓
  - « Les fleurs **qu'**elle a cueillies » → COD antéposé « fleurs » (genre None car « les » ne marque pas le genre, pl) → accord ✓
  - « Elle a cueilli des pommes rouges » → **invariable** (COD placé après) ✓
- Honnêteté : avec « les » le genre n'est pas porté par le déterminant → on accorde en **nombre** seul (le genre est lexical, hors moteur sans lexique).

### App (port vérifié)
`findCodAntepose` porté dans l'IIFE dictée ; branche *avoir* enrichie. Parité JS↔Python sur les 3 cas (`['pomme','f','sg']` / `['fleurs',null,'pl']` / `null`). CI verte.

---

## 2026-06-18 — Levier grammaire : chaîne du GN, l'accord en GENRE

### Quoi
Quatrième pièce du levier grammaire (après sujet-verbe, sujet à distance, participe passé) :
**l'accord en genre dans le groupe nominal** — l'erreur dys classique « une robe **vert** ».

- `GEN_DET` : déterminants **genrés** (le/un/ce/cet/mon/ton/son/au/du = m · la/une/cette/ma/ta/sa = f). Classe fermée, fiable sans POS.
- `governor_gender(T,idx)` : remonte au déterminant genré le plus proche à gauche → `(mot,'m'|'f')`.
  **Abstention** si on croise un déterminant non-genré (les/des/leur) ou un pronom (on a quitté le GN).
- Branche GN de `diagnose_sentence` : quand `accord_type=='genre'` (et pas un verbe), on diagnostique le genre
  (« accord en genre : « une » féminin → accorder « verte ») au lieu du nombre.

### Mesuré (`python3 dictee/diag_sentence.py`)
- Familles **100 %** inchangées · gouverneur identifié sur erreur d'accord **82 %→84 %** (138/164 : les accords en genre trouvent maintenant leur gouverneur genré).
- **Chaîne du GN — genre : 7/7** quand un déterminant genré gouverne ; **abstention 6/6** quand il n'y en a pas
  (pronom « Il/tu », « leur tour » non genré, début de phrase). *Le « 7/13 » naïf cachait 6 abstentions correctes :
  il n'y a pas de genre à accorder sans déterminant genré — un Δ sans le pourquoi ne vaut rien.*
- Démo synthétique « Elle porte une robe vert(e) » → gouverneur genre = `('une','f')` : **skippe le pronom « Elle »**
  (le genre vient du déterminant du GN, pas du sujet).

### App (port vérifié)
`governorGender` + `GEN_DET` + `accordType` portés dans l'IIFE dictée (OFF-inerte, R66 baseline intacte).
Parité JS↔Python vérifiée sur 5 phrases + accordType (genre/nombre/verbal) : identique. CI (python + compile du bloc) OK.

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
- **Décision : on ne monte pas l'expérience A.** M3_d reste sans rôle **sémantique/homophone** (pas d'entrée sens/contexte) — c'est le rôle *sémantique* qui est nul, **pas M3_d globalement** : côté pendu, son readout `cLetterScore` est utile (+3,4 cheat-free, `AUDIT_OMEGA §3.1`, maj 17/06). Détail : `EXP_M3D_FALSIFIE.md`.
- **Pivot : on avance la surface** (Ph.1-2) — 91,3 % de diagnostic sans M3_d ; sémantique = signal externe à acter séparément si dictée de phrases un jour.

---

## 2026-06-13 (suite 3) — Module de diagnostic multi-étiquette livré

- `diagnostic.py` : `diagnose(cible, tentative[, phono])` → **liste de faits + feedback français** (accent, voisée/sourde, muette, homophone, autre). Multi-étiquette.
- `phono_homophones.json` : index compact (4994 groupes, ~197 Ko, mots freq≥1) pour détecter les homophones **sans** le lexique 34 Mo.
- **Mesuré sur `test_set.tsv` (415 cas) : rappel 93 %.** accent / voisée-sourde / muette = **100 %**. **Homophone = 58,6 %** — borné par la couverture de l'index compact (les homophones rares sont filtrés). Couverture pleine = lexique entier, dispo **en local**.
- Phase 1 accents : en lexique = la cible vient accentuée (rien à faire) ; détection d'erreur d'accent = 100 %. Reconstruction OOV (enrichir `PHON_TO_LETTERS`) = route app, **déférée au local**.
- Exemples de feedback validés (ex. « amenée ← amenèe » → accent ; « admettons ← admetton » → muette « s »).
- Reste (local/app) : UI de saisie (Ph.2), reconstruction accents OOV, couverture homophone pleine.

---

## 2026-06-14 — Partie dyslexie TERMINÉE (app + index plein)

- **Index homophones PLEIN** régénéré depuis Lexique4 (43 580 groupes, 2,1 Mo, sans filtre freq) → item 1 réglé.
- `diagnostic.py` re-mesuré : **rappel global 99,8 %** (homophone **58,6 % → 98,6 %**, accent/voisée-sourde/muette 100 %).
- **`dictee_app.html`** : application de dictée diagnostique **autonome** (un seul HTML) — 620 mots gradués (`word_pool.json`, dérivés Lexique 4), **dictée vocale** (TTS fr-FR), saisie, **diagnostic multi-étiquette + feedback dys**, correction révélée. Diagnostic JS porté de `diagnostic.py` (testé 6/6, identique).
- Reconstruction accents OOV : **non nécessaire** pour la dictée (les mots dictés viennent du lexique → accentués). Item clos.
- **État : le cœur dyslexie est complet et utilisable.** Reste optionnel : dictée de PHRASES (signal sémantique externe), polissage UI, validation terrain (orthophonistes).

---

## 2026-06-14 (suite) — Intégration FICHIER UNIQUE + recherche dyslexie + catégories enrichies

- **Recherche dyslexie multi-sources** (Tous à l'école, Happydys, Upbility, Lexidys, Cairn) : confirme la **double route** (dyslexie phonologique vs surface) et la **typologie en 4 familles** (phono / lexicale-surface / sémantique / morphosyntaxique). Profil voisée/sourde validé.
- **Catégories enrichies** selon la grille : ajout de **inversion** et **ajout** (famille phonologique), en plus de accent/voisée-sourde/muette/homophone. Morphosyntaxique (accords) noté comme **extension phrases** (mots isolés insuffisants).
- **Correction demandée par Rem : UN SEUL FICHIER.** La dictée est désormais un **panneau additif intégré dans `app/omega-pendu.html`** (IIFE, OFF-inerte, bouton « ✍️ Dictée diag »). Le fichier séparé `dictee_app.html` est **supprimé**.
- Diagnostic JS re-testé **8/8** (dont inversion + ajout) depuis le fichier injecté.

---

## 2026-06-14 (suite 2) — Cadre A choisi : DICTÉE DE PHRASES (brick mesuré)

- Décision Rem : **dictée de phrases** (le contexte = la phrase cible rend homophones ET accords gradables, **sans M3_d**).
- `dictee/sentences.json` : **30 phrases graduées** (10/10/10) + familles d'homophones par mot (depuis l'index plein).
- `dictee/diag_sentence.py` : tokenise → **aligne** (Levenshtein mots) → diagnostique chaque mot (accent/voisée-sourde/inversion/muette/ajout/homophone/**accord**/omission/mot_en_trop). `is_accord` distingue **accord** (diff flexionnelle s/e/t/x/n) vs **homophone lexical** (ver/verre).
- **Mesuré (30 phrases) : rappel accent/accord/homophone/omission = 100 %.** Casse gérée (comparaisons lower). Gain clé : **accords détectés** via contexte.
- Reste : porter dans le fichier unique (remplacer le mode mot-isolé), détecter la **surface/plausible** (leson→leçon), réconcilier diagnostic.py.

---

## 2026-06-14 (suite 3) — Dictée de PHRASES intégrée dans le fichier unique

- `app/omega-pendu.html` : le panneau « ✍️ Dictée diag » passe en **mode PHRASES** (remplace le mot-isolé). Dicte la phrase (TTS fr-FR), l'élève la retape, **feedback par mot** dont **accords** (contexte). Toujours OFF-inerte (IIFE).
- Logique JS portée de `diag_sentence.py` (align Levenshtein + diagWord + isAccord). Vérifiée depuis le fichier : accord/accent/correct OK.
- **Divergence audit résolue côté cadre** : la référence est désormais la **dictée de phrases** (`diag_sentence.py` = moteur Python de référence ; l'app = portage). `diagnostic.py`/`test_set.tsv`/`word_pool.json` = **legacy mot-isolé** (gardés pour historique + l'équipe Lexique).
- **Reste de l'audit** : (1) détecter la **surface/plausible** (leson→leçon → « autre » ; nécessite graphème→phonème) ; (2) **validation moins circulaire** / données réelles ; (3) **boucle de remédiation** (rejouer la famille la plus ratée) ; (4) message accent générique (ç/à/ô).

---

## 2026-06-14 (suite 4) — Détection SURFACE/plausible (audit HAUT #2 réglé)

- Ajout d'un **normaliseur phonétique** `norm()` (ph→f, ç→s, c doux→s, eau/au→o, ai/ei→e, qu→k, doubles consonnes, finales muettes…) : si la graphie élève **normalise comme la cible** mais s'écrit autrement → étiquette **surface** (au lieu de « autre »).
- Couvre la **dyslexie de surface** : *leson→leçon*, *bateau→bato*, *photo→foto*, *question→kestion*, *frèzes→fraises*.
- Limites honnêtes : *femme* (em→/a/ irrégulier), nasales — non couverts.
- Intégré dans `diag_sentence.py` **et** l'app (fichier unique). **Mesuré : surface 17/17 = 100 %, zéro régression** (accent/accord/homophone/omission toujours 100 %).
- **Scorecard audit** : 🔴 isolé ✅ · divergence ✅ · casse ✅ · **surface ✅** · reste : validation moins circulaire, boucle de remédiation, message accent générique.

---

## 2026-06-14 (suite 5) — Boucle de REMÉDIATION (audit item réglé)

- Phrases **taguées** (`sentences.json` : champ `traps`) avec les familles qu'elles peuvent exercer (depuis le lexique) : accent/accord/homophone/voisée-sourde/muette.
- App (fichier unique) : **profil d'erreurs persistant** (localStorage `vdd_profile`, compteur par famille) + **sélection ciblée** : 65 % du temps, la phrase suivante exerce la **famille la plus ratée** (« on travaille : accord »). Affichage du profil + bouton réinitialiser.
- Le diagnostic ne fait plus que constater : il **oriente l'entraînement** (intervention, comme le préconise la recherche). Bloc app **compile sans erreur de syntaxe**.
- (Remédiation = logique UI/session, app-only ; `diag_sentence.py` reste le moteur de diagnostic de référence.)

---

## 2026-06-14 (suite 6) — Audit projet : correctifs appliqués

- **1** vivarium **retiré** du repo (vit ailleurs/privé). **3** legacy mot-isolé → `dictee/legacy/`. **2** banner sécurité en tête de `omega-key/README`. **5** CI minimale (`.github/workflows/ci.yml` : mesure `diag_sentence` + syntaxe bloc dictée) + README monorepo.
- **4 Compression du lexique** : `app/omega-pendu.html` **16 Mo → 5 Mo**. Le bloc `application/json` (15,5 Mo) devient `text/plain` **gzip+base64** (3,4 Mo gz) ; `loadOmegaLex4` (déjà `async`) décompresse via `DecompressionStream`. **Vérifié headless : 83 605 mots décompressés + parties jouées** → moteur intact (OFF-inerte, R66). Harnais evo mis à jour (gz + async).

---

## 2026-06-17 — Diagnostic DÉVELOPPEMENTAL par stade (Ferreiro/Berliocchi)

- **Apport** : lecture du mémoire Berliocchi (2022, conscience phonologique / entrée dans l'écrit) → les familles d'erreurs ne sont pas une liste plate, elles révèlent un **stade** (genèse de l'écriture, Ferreiro). Ajout d'une couche **développementale** sur `diag_sentence.py` (additif, réutilise `diag_word` ; familles toujours 100 %).
- **Mapping** (4 bandes, du plus amont au plus avancé — la GRAMMAIRE est l'apex) :
  - **phonologique** (voisée-sourde · inversion · ajout) → le SON mal perçu/segmenté (conscience phonémique ; l'axe dyslexie-phono d'OMEGA) ;
  - **alphabétique** (surface · accent) → écrit « comme ça sonne », pas l'ortho conventionnelle ;
  - **lexical** (muette · homophone) → orthographe du MOT (lettres muettes lexicales, homophone lexical) ;
  - **morphosyntaxique** (accord) → **GRAMMAIRE** : accords genre/nombre/verbal, sans indice sonore — **le palier le plus tardif = le prochain gros levier**.
- **Fonctions** : `stage_of_fact(types)` (par mot, le stade le plus AVANCÉ l'emporte → la famille spécifique prime sur le détecteur structurel `ajout/muette` co-déclenché ; un « élèves→élève » tagué muette+accord monte ainsi en **morphosyntaxique** = bien diagnostiqué « grammaire ») ; `developmental_diagnosis(facts)` → stade = **bande la plus en amont où il bute** + message.
- **Graine du levier grammaire** : `accord_type(t,s)` → **nombre / genre / verbal** (heuristique SANS POS). Démo : « répète→répètent » = accord **verbal** (sujet-verbe), « élève→élèves » = **nombre**.
- **Mesuré** : élèves « purs » par stade → **4/4 bien placés** (phono/alpha/lexical/morphosyntaxique). Familles toujours 100 %, additif (réutilise `diag_word`).
- **Lien cognition** (session moteur) : cohérent avec l'audit M3_d — les **cellules-concept = latent de FORME** = candidat signal de **stade précoce** (pré-syllabique/syllabique).
- **PROCHAIN GROS LEVIER = la grammaire** (morphosyntaxe), maintenant posée comme apex : il faudra la **catégorie grammaticale (POS)** + l'**accord à distance** (sujet-verbe, participe passé, chaîne d'accords du GN) — `accord_type` n'en est que la graine sans POS. C'est là que le contexte de la phrase (raison d'être de la dictée de PHRASES) paie le plus.
- **Reste aussi** : porter dans l'app (panneau affiche encore les familles seules) ; grain syllabe (Berliocchi : syllabe→rime→phonème) ; axe **temporel/rythmique** non couvert (OMEGA segmental) — limite honnête.

---

## 2026-06-17 (suite) — Levier GRAMMAIRE : 1ʳᵉ jonction (accord sujet-verbe en contexte)

- **Démarrage du gros levier grammaire** (posé apex à l'entrée précédente). Astuce §5 : le **nombre** se lit sur les **mots-outils en classe fermée** (déterminants `le/les…`, pronoms `il/ils…`) → pas besoin de taguer tous les mots ni de Lexique4-full (hors-repo ; le lexique embarqué n'a ni POS ni les mots courts).
- `governor_number(T, idx)` : remonte au **gouverneur** d'accord (pronom sujet / déterminant le plus proche à gauche) → son **nombre**. `diagnose_sentence` enrichit toute erreur d'accord : `grammaire` = **sujet-verbe** (si `accord_type='verbal'`) ou **groupe nominal**, + le gouverneur et le message (« accord sujet-verbe : « Les » pl → accorder « répètent » »). C'est ici que le **contexte de la phrase paie** (raison d'être de la dictée de PHRASES).
- **Mesuré (30 phrases)** : gouverneur identifié sur **82 %** des erreurs d'accord ; **accord sujet-verbe détecté sur 93 %** des accords verbaux. Familles 100 %, 4/4 stades, additif.
- **Limites honnêtes** : heuristique sujet = plus-proche-déterminant/pronom à gauche (OK en SVO, pas tous les cas — sujet nom propre, sujet à distance, inversion) ; `genre -e` vs `verbal -e` toujours ambigu sans **POS** ; participe passé, chaîne complète du GN, accord à longue distance = **suite du levier**.
- **Suite du levier grammaire** : POS (catégorie grammaticale) pour lever l'ambiguïté genre/verbal et le sujet réel ; participe passé ; accords du GN multi-mots ; porter dans l'app.

---

## 2026-06-17 (suite 2) — Levier grammaire : POS-contexte (désambiguïsation nom/verbe)

- **Continuation du levier grammaire.** Constat données : `lit`, `porte`, `court`, `calme`, `vend` sont **nom ET verbe** selon la phrase (« le lit » nom / « papa lit » verbe) → un POS plat est faux, il faut le **contexte**. C'est la substance grammaticale.
- **POS-contexte léger** (`is_verb(T,idx)`) : lexique de **formes verbales** du corpus + règle « précédé d'un déterminant → nom, pas verbe ». Pas besoin de POS complet ni de Lexique4 (hors-repo).
- **Effet** : `accord_type` désambiguïse enfin **genre -e vs verbal -e** (le verbe prime via le contexte) ; le label **sujet-verbe vs groupe-nominal** repose sur `is_verb` (contexte), plus sur le suffixe.
- **Mesuré** : désambiguïsation homographes nom/verbe **5/5** (`lit@0`=nom, `lit@4`=verbe, `verre@2`=nom, `porte@12`=verbe, `calme@26`=verbe) ; gouverneur 82 %, accord sujet-verbe **94 %**. Familles 100 %, 4/4 stades.
- **Limites / suite** : lexique verbal **du corpus** (ne scale pas → un tagger ou Lexique4-`cgram` pour un corpus plus grand) ; sujet = plus-proche-gouverneur-gauche (rate le sujet à distance avec PP intercalé) ; **participe passé** (accord avec être/avoir) = prochaine jonction grammaire ; portage app.

---

## 2026-06-17 (suite 3) — Grammaire : participe passé + sujet à distance + scaling

- **(1) Participe passé** : `is_participle` + `find_aux` → accord **avec être** (= sujet) vs **avec avoir** (invariable sauf COD antéposé). Message dédié (« participe passé avec être : accord avec le sujet « X » pl »). **Mesuré 7/7** participes du corpus détectés.
- **(2) Sujet à distance** : `governor_number(..., skip_pp=True)` saute les déterminants de **groupe prépositionnel** pour un verbe/participe-être → trouve le **vrai sujet**. Démo : « Les vers **de la terre** creusent » → sans skip = « la » (sg, faux) ; skip_pp = « Les » (pl, vrai sujet **et bon nombre**).
- **(3) Scaling POS** : repli **morphologique** sous le lexique corpus (`VERB_SUF` = -ons/-ez/-aient/-ait/-èrent/-irent/-issent, **pas** -ent trop ambigu ; stoplist adverbes). is_verb marche au-delà des 30 phrases pour les formes conjuguées claires. Limite honnête : pour un grand corpus → tagger ou Lexique4-`cgram`.
- **État** : familles 100 %, 4/4 stades, homographes 5/5, gouverneur 82 %, sujet-verbe 94 %, participe 7/7. Tout additif, moteur de référence `diag_sentence.py`.
- **Reste = (4) portage app** (en cours) : faire remonter stade + grammaire dans le panneau « ✍️ Dictée diag ».

---

## 2026-06-17 (suite 4) — Portage APP : stade + grammaire dans le panneau dictée (point 4)

- **Porté dans `app/omega-pendu.html`** (bloc IIFE « ✍️ Dictée diag », OFF-inerte) le levier complet : `NUM_DET/NUM_PRON/PREP`, `governorNumber(skip_pp)`, `VERB_FORMS`+repli morpho `isVerb`, `AUX_*`/`PART_FORMS`/`isParticiple`/`findAux`, stades `STAGE_*`/`stageOfFact`/`developmental`. `diagnoseSentence` enrichit chaque erreur d'accord avec `fact.gram` (relation grammaticale).
- **UI** : sous chaque faute d'accord, une sous-ligne « → accord sujet-verbe : « Les » pluriel → accorder « répètent » » (ou GN, ou participe passé être/avoir) ; et un encart **« Stade : … »** (phonologique→morphosyntaxique) avec message pédagogique. (L'app montre la *relation* grammaticale, pas le tag nombre/genre — plus actionnable.)
- **Vérifié** : CI syntaxe (`new Function`) OK ; **parité Python** testée sur les helpers portés — homographes nom/verbe 5/5, gouverneur+skip_pp, participe/findAux, `developmental` → mêmes résultats que `diag_sentence.py`. Aucune référence pendante. Baseline pendu intacte (additif IIFE).
- **Les 4 points enchaînés livrés** : (1) participe passé, (2) sujet à distance, (3) scaling morpho, (4) portage app.
- **Suite** : grammaire — accord du GN multi-mots (déterminant-nom-adjectifs en chaîne), participe passé avec COD antéposé, vrai tagger/Lexique4-`cgram` pour scaler le corpus ; validation terrain (orthophonistes).
