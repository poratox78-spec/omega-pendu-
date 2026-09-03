# ÉTAT — OMEGA (généré)

> ⚠️ **FICHIER GÉNÉRÉ** par `python3 dictee/etat_gen.py` — ne pas éditer à la main
> (toute édition sera écrasée et fait rougir `python3 dictee/etat_gen.py --check`).
> Sources machine : `dictee/metriques_probe.js` (registre unique des chiffres que le
> site affirme) · `dev.sh` (garde-fous `run`/`runsh`, miroir CI gardé par
> `ci_parity_probe`) · `dictee/etat_chantiers.json` (chantiers — le seul maillon curé).

## 1. Les chiffres que le site affirme — 8 métriques au registre unique

| valeur | mesure | provenance | sonde |
|---:|---|---|---|
| 694 949 | prior de ponctuation — phrases FR du modèle texte (PR#399) | locale | `dictee/ponct_prior_dictee_probe.js` |
| 48 653 | mesure du « ? » texte-seul — 145 marques dont 79 fausses (PR#403) | constat | `dictee/proso_probe.js` |
| 15 353 | flood EN édité PUD+GUM — règles anglaises (REGLES_EN) | locale | `dictee/fp_en_propre_probe.js` |
| 14 450 | UD FR complet (14 450 phrases correctes) — FP=0 du correcteur | locale | `dictee/fp_scale_probe.py` |
| 11 304 | phrases écrites par des humains — précision/rappel du speller | locale | `dictee/ponct_double_route_probe.js` |
| 2 500 | UD 2 500 (échantillon encyclopédique) — FP à l'échelle + tagger | ci | `dictee/fp_scale_probe.py` |
| 630 500 | corpus d'entraînement du corps mou B2 (UD + exemples Wiktionnaire, held-out fp_scale exclu) | locale | `dictee/b2_data.py` |
| 18 556 | banc FP de la greffe sait/s'est — phrases correctes UD 14 450 + held-out 4 106 (cadre : 1 seule occurrence) | locale | `dictee/greffe_sais_probe.py` |

Portées : **ci** = re-vérifié à chaque CI · **locale** = reproductible en local · **constat** = mesuré une fois, daté. Le détail (pages, notes) vit dans le registre lui-même.

## 2. Garde-fous actifs — 86 contrôles dans `dev.sh` (= CI, parité gardée)

| # | contrôle | commande |
|---:|---|---|
| 1 | diag phrases | `python3 dictee/diag_sentence.py` |
| 2 | dictée SENT (app==json, 0 FP) | `python3 dictee/sentences_parity.py` |
| 3 | correcteur (batterie FP=0) | `python3 dictee/correcteur_probe.py` |
| 4 | mover impératif (réf Python == cas) | `python3 dictee/imperative_clitics.py` |
| 5 | garde j'est être/avoir (recall --check) | `python3 dictee/recall_probe.py --check` |
| 6 | FP à l'échelle (UD 2500, garde régression) | `python3 dictee/fp_scale_probe.py --check` |
| 7 | Genre perdu par la désaccentuation (rappel 217, FP=0) | `python3 dictee/gender_coll_probe.py --check` |
| 8 | FP speller à l'échelle (ortho affirmatif UD 2500, garde régression) | `node dictee/speller_fp_scale_probe.js --check` |
| 9 | held-out vocab neuf | `python3 dictee/eval_externe.py` |
| 10 | boucle descendante (genre) | `python3 dictee/descending_probe.py` |
| 11 | did-you-mean FALSIFIÉ | `python3 dictee/didyoumean_probe.py` |
| 12 | tables g2p (depuis l'app) | `python3 dictee/build_g2p_tables.py` |
| 13 | morpho md/mb (depuis l'app) | `python3 dictee/build_morpho.py` |
| 14 | correction g2p (train) | `python3 dictee/build_g2p_corrections.py` |
| 15 | décomposeur (held-out) | `python3 dictee/decompose.py --measure` |
| 16 | p2g build | `python3 dictee/build_p2g.py` |
| 17 | p2g mesure (held-out) | `python3 dictee/p2g.py --measure` |
| 18 | régression décompo+p2g | `python3 dictee/test_decompose.py` |
| 19 | décompo 3 voies (corpus) | `python3 dictee/decompose_corpus.py --show` |
| 20 | clôture paradigme conj | `python3 dictee/close_conj_paradigm.py --check` |
| 21 | POS-tagger 155k (build_pos) | `python3 dictee/build_pos.py` |
| 22 | assets extension (build) | `python3 extension/build_assets.py` |
| 23 | syntaxe bloc dictée+correcteur (app) | `"node -e \"const fs=require('fs');const h=fs.readFileSync('app/omega-pendu.html','utf8');const i=…` |
| 24 | syntaxe bloc Décompose (app) | `"node -e \"const fs=require('fs');const h=fs.readFileSync('app/omega-pendu.html','utf8');const i=…` |
| 25 | parité correcteur APP↔Python | `node dictee/parity_corr.js` |
| 26 | parité POS-tagger HMM (Py==ext==app) | `node dictee/parity_pos.js` |
| 27 | speller app (décompresse+FP0) | `node dictee/test_speller_app.js` |
| 28 | vigilance accord sujet-verbe (orange mid-phrase) | `node dictee/test_sv_vigilance.js` |
| 29 | sonde SUJET vs or UD nsubj (précision quand répond ≥90 % ; SAUTÉ sans /tmp/udfr) | `python3 dictee/sujet_probe.py` |
| 30 | benchmark dys réel (messy: rappel+FP+mauvaises corr.) | `node dictee/messy_probe.js --check` |
| 31 | census vigilance dys (aucune orange juste perdue) | `python3 dictee/vig_census_probe.py` |
| 32 | précision par famille sur texte dys (rouge/orange mesurés) | `python3 dictee/dys_precision_probe.py` |
| 33 | assets extension câblés (aucun asset livré-mais-muet) | `node extension/assets_wired_probe.js` |
| 34 | angle mort ÉLISION (différentiel l'X vs cet/cette X) | `node dictee/elision_probe.js --check` |
| 35 | mover impératif (parité app==ext + corrections + FP0) | `node dictee/imp_probe.js --check` |
| 36 | parité extension dys-core↔Py | `node extension/parity_core.js` |
| 37 | police de son (fraîcheur bloc app + clitiques≡Py + texte intact) | `node police/parity_son.js` |
| 38 | parité OS-sujet 3 moteurs (accord verbe orange) | `node dictee/parity_os.js` |
| 39 | parité ces/ses 3 moteurs (vigilance-enseignante) | `node dictee/parity_cesses.js` |
| 40 | parité genre à clé partagée 3 moteurs (âme/amé, affaire/affairé) | `node dictee/parity_gender_coll.js` |
| 41 | parité DICTÉE Python↔JS (diag_sentence.py == diagnoseSentence, 1300+ cas) | `node dictee/parity_diag.js` |
| 42 | speller ext ≡ app (vigilance comprise) | `node extension/test_speller.js` |
| 43 | parité SPELLER Python↔JS (suggestion, auto+flag) | `python3 dictee/parity_speller.py` |
| 44 | syntaxe extension (5 fichiers) | `"node --check extension/dys-core.js && node --check extension/content.js && node --check extensio…` |
| 45 | correcteur standalone | `node dictee/correcteur.js` |
| 46 | correcteur AUTONOME (bake, 3 mondes) | `node dictee/bake_probe.js --check` |
| 47 | outil d'édition (pièges monolithe) | `python tools/omega_edit.py` |
| 48 | Double-Sens (table + règle d'équité) | `node dictee/sens_probe.js --check` |
| 49 | ponctuation vocale (règles BDL + parité site/extension) | `node dictee/proso_probe.js` |
| 50 | typographie ROUGE (espaces autour de , et . + parité) | `node dictee/typo_probe.js` |
| 51 | miroir PONCTUATION app↔extension (5 blocs miroités à la main) | `node dictee/miroir_ponct_probe.js` |
| 52 | détection de QUESTION (précision ET rappel, banc UD+réel) | `node dictee/question_bench.js` |
| 53 | parité OCTET du moteur vocal (site==extension) | `node dictee/voix_parite_probe.js` |
| 54 | audit structurel vocal (4000 dictées, chaînage+conflits) | `node dictee/voix_struct_probe.js` |
| 55 | correcteur AUTONOME (bake) | `"D=\$(mktemp -d); T=\"\$D/c.standalone.js\"; TW=\$(cygpath -m \"\$T\" 2>/dev/null \|\| echo \"\$T\"…` |
| 56 | smoke moteur (cheat-free+NEO) | `node evo/ci_smoke.js` |
| 57 | scrabidon — moteur plateau | `node dictee/scrabidon_probe.js` |
| 58 | EN speller (recall CASES + FP casse) | `python3 dictee/speller_en_probe.py --check` |
| 59 | EN homophones (recall CASES 14/14, RED=vraies fautes) | `python3 dictee/homophone_en_probe.py --check` |
| 60 | EN moteur JS correcteur (parité CASES) | `node dictee/corrector_en.js --check` |
| 61 | EN règles branchées dans la page (+ tokeniseur) | `node dictee/en_page_wiring_probe.js` |
| 62 | SITE toutes les pages atteignables depuis l'accueil (FR + EN) | `node dictee/pages_atteignables_probe.js` |
| 63 | SITE sitemap == pages (noindex exclues, zh/ hors périmètre) | `node dictee/sitemap_probe.js` |
| 64 | moteur de calcul (2 copies + poses + refus + câblage page) | `node dictee/calc_dys_probe.js` |
| 65 | SITE chiffres de mesure affichés = registre unique (anti-dérive) | `node dictee/metriques_probe.js` |
| 66 | SITE icônes : glyphe tracé + matricielles non vides | `python3 dictee/icones_probe.py` |
| 67 | UI aucune copie n'annonce un succès qu'elle ignore | `node dictee/presse_papier_probe.js` |
| 68 | répétition espacée (planificateur Leitner, bloc pur du monolithe) | `node dictee/srs_probe.js` |
| 69 | navigateur RÉEL (Chrome pilote la page, marques lues dans le DOM) | `node dictee/navigateur_probe.js --check` |
| 70 | EXTENSION dans Chrome (paquet réel, assets par chrome.runtime.getURL) | `node extension/navigateur_ext_probe.js --check` |
| 71 | précision par famille AU PRODUIT (extension réelle dans Chrome) | `python3 dictee/dys_precision_probe.py --navigateur` |
| 72 | résiduel : tokens CORRECTS détruits (FP=0, plafond dur, corpus local) | `node dictee/residual_audit.js --check` |
| 73 | collisions d’accent : JSON == app == extension (non_verbe_acc) | `python3 dictee/build_non_verbe_acc.py --check` |
| 74 | lots Morphalou du speller : TSV commités bien formés (morph_na, morph_ver.gz) | `python3 dictee/build_morph_lex.py --check` |
| 75 | paquet de données ouvertes du site (omega-lexiques.zip == sources, NOTICE comprise) | `python3 build_lexiques.py --check` |
| 76 | icônes extension FRAÎCHES (== icon-512.png, exigées par le Store) | `python3 extension/build_icons.py --check` |
| 77 | zip extension FRAIS (octets == sources) | `python3 extension/build_zip.py --check` |
| 78 | pack police OMEGA Dys FRAIS (octets == police/) | `python3 police/build_pack.py --check` |
| 79 | complément Word (planificateur, texte jamais altéré) | `node word/test_son_word.js` |
| 80 | clone anglais FRAIS (app EN == build(app FR)) | `python3 dictee/build_pendu_en.py --check` |
| 81 | prénoms : 3 copies identiques + contenu | `python3 dictee/prenoms_probe.py` |
| 82 | service worker (version+empreinte, précache, purge) | `node dictee/sw_probe.js` |
| 83 | docs de pilotage (CLAUDE.md : budget mots, lignes-fleuves, doublons DOCTRINE) | `python3 dictee/docs_probe.py` |
| 84 | ETAT.md FRAIS (généré == 3 sources machine) | `python3 dictee/etat_gen.py --check` |
| 85 | parité dev.sh ↔ ci.yml (anti-dérive) | `python3 dictee/ci_parity_probe.py` |
| 86 | omega-key crypto (entropie + gel listes + KAT Double Ratchet) | `node omega-key/test_crypto.js` |

## 3. Chantiers (source curée : `dictee/etat_chantiers.json`)

### Fermés par la mesure — 6

- **Fermer les boucles du pendu (Möbius phon/ortho, co-décision descendante)** — réfuté chiffré — tous les effets mesurés (−0,73 à +0,87 pt) sont sous le plancher de bruit établi par un PLACEBO (~200 parties sur 3 000 basculent dès qu'on touche au chemin numérique) ; ne pas re-tenter sans idée neuve, et tout A/B du moteur doit embarquer un placebo _(JOURNAL 2026-09-03 · PR #653 · outil commité evo/pendu_paired_ab.js)_
- **Canal GROUPE du pendu (modèle 170 poids)** — construit, mesuré, falsifié au produit — hook laissé OFF-inerte _(PR #617)_
- **Speller : formes « connues mais jamais candidates » (Morphalou)** — 3 lots livrés et mesurés au moteur réel (40 034 puis 81 042 puis 384 869 formes verbales — dernier lot), TSV commités gardés par build_morph_lex --check _(PR #641 · #642 · #643)_
- **FP=0 violé en production (« La foule attendait » → attendaient)** — réparé à la source ; depuis, la batterie « FP=0 » rend un vrai code de sortie, le bake autonome est gardé sur l'accord, et dev.sh affiche la sortie des verts suspects au lieu de la jeter _(PR #619 · #633 · #624 · #620)_
- **Ponctuation dys : virgule proposée, point final manquant, « ? » applicable d'un clic** — livré (39 % des productions dys réelles n'avaient AUCUNE règle de point final) et gardé — la détection de QUESTION est dans la batterie, rappel gardé autant que précision _(PR #628-#631 · #645-#648 · sonde dictee/question_bench.js)_
- **Collisions d'accent (« adhérent » n'est pas « adhèrent »)** — 16 mots courants cessent d'être pris pour des verbes ; les 3 copies (JSON == app == extension) sont gardées _(PR #640 · garde dictee/build_non_verbe_acc.py --check)_

### Ouverts — 9

- **Remise en ordre des documents de pilotage (ce chantier)** — Tri intégré le 03/09/2026 : CLAUDE.md ramené à un sommaire (986 mots, docs_probe VERT), histoire migrée au JOURNAL (manifeste « rien de perdu » dans le PR), DOCTRINE actée (R1-R65 perdues), docs_probe + etat_gen --check câblés dev.sh + CI ; reste à Rem la relecture du nouveau sommaire _(plan du 24/08 · dictee/docs_probe.py · dictee/etat_gen.py)_
- **Publication Chrome Web Store** — 0.6.2 téléversée par Rem le 03/09/2026 (revue Google en cours) ; 0.6.3 prête (manifest bumpé, zip --store régénéré), téléversement quand Rem décide d'une nouvelle revue — un numéro remis à Rem est brûlé _(extension/STORE.md · PR #651 · #655)_
- **Accord verbe à vérifier (vigilance orange)** — 2 lots livrés — le parseur de sujet d'abord, puis la FORME avant le NOMBRE (faire semi-auxiliaire, s'est + forme finie, gérondif, gardes de sujet), 3 moteurs à parité _(PR #652 · #654)_
- **Chantier anglais (site → voix → extension conditionnelle)** — réouvert le 31/08 par Rem, feuille de route fixée ; état mesuré : bonne précision, couverture faible ; contrainte cardinale = tout doit être vérifiable sans savoir l'anglais (Rem n'y est plus le juge) _(CHANTIER_ANGLAIS.md · PR #618)_
- **Dominance ≫20× du speller** — cause de « parvies »→parties identifiée (la garde écrase le phon-match dès que le bon mot est rare) ; le chantier = donner du CONTEXTE (comme LanguageTool), pas baisser le seuil — mesurer d'abord les deux populations (mot rare vs bruit lexical) _(CLAUDE.md/JOURNAL 2026-08-22 et 23)_
- **Les 442 mots soulignés sans suggestion** — 38,5 % des fautes non réparées sont vues mais sans proposition — y proposer quelque chose ne coûte aucun risque de FP (orange = au clic) ; levier identifié, non traité _(CLAUDE.md 2026-08-23 (mesure « l'orange est-il là pour les 75 % ratés ? »))_
- **Dette : _cmp non transitif** — reproductible ≠ bien défini ; la reformulation « gardes par candidat » a été mesurée et rejetée (−2 réparations pour 0 casse évitée) — dette nommée, faible priorité _(CLAUDE.md 2026-08-23 (§5quater))_
- **Complément Word (police de son)** — planificateur testé sous Node (306 morceaux) et volet vérifié hors Word — jamais essayé dans Word réel, premier essai terrain à faire _(word/ · garde word/test_son_word.js)_
- **Validation terrain orthophonistes** — vraies copies dys externes à obtenir — valide ET nourrit la boucle descendante ; la fiche imprimable existe (validation_terrain.html) _(CLAUDE.md (audit projet ⏳) · dictee/build_validation_sheet.py)_
