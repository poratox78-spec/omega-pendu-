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

## 2. Garde-fous actifs — 89 contrôles dans `dev.sh` (= CI, parité gardée)

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
| 33 | accord de PALIER produit↔référence sur le gold (auto/flag/vigilance/inconnu + hors accord ancré ; SAUTÉ sans corpus dys) | `python3 dictee/palier_gold_probe.py` |
| 34 | assets extension câblés (aucun asset livré-mais-muet) | `node extension/assets_wired_probe.js` |
| 35 | angle mort ÉLISION (différentiel l'X vs cet/cette X) | `node dictee/elision_probe.js --check` |
| 36 | mover impératif (parité app==ext + corrections + FP0) | `node dictee/imp_probe.js --check` |
| 37 | parité extension dys-core↔Py | `node extension/parity_core.js` |
| 38 | police de son (fraîcheur bloc app + clitiques≡Py + texte intact) | `node police/parity_son.js` |
| 39 | parité OS-sujet 3 moteurs (accord verbe orange) | `node dictee/parity_os.js` |
| 40 | parité ces/ses 3 moteurs (vigilance-enseignante) | `node dictee/parity_cesses.js` |
| 41 | parité genre à clé partagée 3 moteurs (âme/amé, affaire/affairé) | `node dictee/parity_gender_coll.js` |
| 42 | parité DICTÉE Python↔JS (diag_sentence.py == diagnoseSentence, 1300+ cas) | `node dictee/parity_diag.js` |
| 43 | speller ext ≡ app (vigilance comprise) | `node extension/test_speller.js` |
| 44 | parité SPELLER Python↔JS (suggestion, auto+flag+inconnu+vigilance) | `python3 dictee/parity_speller.py` |
| 45 | syntaxe extension (5 fichiers) | `"node --check extension/dys-core.js && node --check extension/content.js && node --check extensio…` |
| 46 | correcteur standalone | `node dictee/correcteur.js` |
| 47 | correcteur AUTONOME (bake, 3 mondes) | `node dictee/bake_probe.js --check` |
| 48 | outil d'édition (pièges monolithe) | `python tools/omega_edit.py` |
| 49 | Double-Sens (table + règle d'équité) | `node dictee/sens_probe.js --check` |
| 50 | ponctuation vocale (règles BDL + parité site/extension) | `node dictee/proso_probe.js` |
| 51 | typographie ROUGE (espaces autour de , et . + parité) | `node dictee/typo_probe.js` |
| 52 | miroir PONCTUATION app↔extension (5 blocs miroités à la main) | `node dictee/miroir_ponct_probe.js` |
| 53 | détection de QUESTION (précision ET rappel, banc UD+réel) | `node dictee/question_bench.js` |
| 54 | parité OCTET du moteur vocal (site==extension) | `node dictee/voix_parite_probe.js` |
| 55 | audit structurel vocal (4000 dictées, chaînage+conflits) | `node dictee/voix_struct_probe.js` |
| 56 | correcteur AUTONOME (bake) | `"D=\$(mktemp -d); T=\"\$D/c.standalone.js\"; TW=\$(cygpath -m \"\$T\" 2>/dev/null \|\| echo \"\$T\"…` |
| 57 | smoke moteur (cheat-free+NEO) | `node evo/ci_smoke.js` |
| 58 | scrabidon — moteur plateau | `node dictee/scrabidon_probe.js` |
| 59 | EN speller (recall CASES + FP casse) | `python3 dictee/speller_en_probe.py --check` |
| 60 | EN homophones (recall CASES 14/14, RED=vraies fautes) | `python3 dictee/homophone_en_probe.py --check` |
| 61 | EN moteur JS correcteur (parité CASES) | `node dictee/corrector_en.js --check` |
| 62 | EN règles branchées dans la page (+ tokeniseur) | `node dictee/en_page_wiring_probe.js` |
| 63 | SITE toutes les pages atteignables depuis l'accueil (FR + EN) | `node dictee/pages_atteignables_probe.js` |
| 64 | SITE sitemap == pages (noindex exclues, zh/ hors périmètre) | `node dictee/sitemap_probe.js` |
| 65 | moteur de calcul (2 copies + poses + refus + câblage page) | `node dictee/calc_dys_probe.js` |
| 66 | SITE chiffres de mesure affichés = registre unique (anti-dérive) | `node dictee/metriques_probe.js` |
| 67 | SITE icônes : glyphe tracé + matricielles non vides | `python3 dictee/icones_probe.py` |
| 68 | UI aucune copie n'annonce un succès qu'elle ignore | `node dictee/presse_papier_probe.js` |
| 69 | répétition espacée (planificateur Leitner, bloc pur du monolithe) | `node dictee/srs_probe.js` |
| 70 | navigateur RÉEL (Chrome pilote la page, marques lues dans le DOM) | `node dictee/navigateur_probe.js --check` |
| 71 | A11Y app réelle (aria-live, corrections au clavier, informatifs non tabbables) | `node dictee/a11y_probe.js --check` |
| 72 | EXTENSION dans Chrome (paquet réel, assets par chrome.runtime.getURL) | `node extension/navigateur_ext_probe.js --check` |
| 73 | précision par famille AU PRODUIT (extension réelle dans Chrome) | `python3 dictee/dys_precision_probe.py --navigateur` |
| 74 | résiduel : tokens CORRECTS détruits (FP=0, plafond dur, corpus local) | `node dictee/residual_audit.js --check` |
| 75 | collisions d’accent : JSON == app == extension (non_verbe_acc) | `python3 dictee/build_non_verbe_acc.py --check` |
| 76 | lots Morphalou du speller : TSV commités bien formés (morph_na, morph_ver.gz) | `python3 dictee/build_morph_lex.py --check` |
| 77 | paquet de données ouvertes du site (omega-lexiques.zip == sources, NOTICE comprise) | `python3 build_lexiques.py --check` |
| 78 | icônes extension FRAÎCHES (== icon-512.png, exigées par le Store) | `python3 extension/build_icons.py --check` |
| 79 | icônes du site FRAÎCHES (apple-touch + icon-192 dérivées de icon-512.png) | `python3 build_site_icons.py --check` |
| 80 | zip extension FRAIS (octets == sources) | `python3 extension/build_zip.py --check` |
| 81 | pack police OMEGA Dys FRAIS (octets == police/) | `python3 police/build_pack.py --check` |
| 82 | complément Word (planificateur, texte jamais altéré) | `node word/test_son_word.js` |
| 83 | clone anglais FRAIS (app EN == build(app FR)) | `python3 dictee/build_pendu_en.py --check` |
| 84 | prénoms : 3 copies identiques + contenu | `python3 dictee/prenoms_probe.py` |
| 85 | service worker (version+empreinte, précache, purge) | `node dictee/sw_probe.js` |
| 86 | docs de pilotage (CLAUDE.md : budget mots, lignes-fleuves, doublons DOCTRINE) | `python3 dictee/docs_probe.py` |
| 87 | ETAT.md FRAIS (généré == 3 sources machine) | `python3 dictee/etat_gen.py --check` |
| 88 | parité dev.sh ↔ ci.yml (anti-dérive) | `python3 dictee/ci_parity_probe.py` |
| 89 | omega-key crypto (entropie + gel listes + KAT Double Ratchet) | `node omega-key/test_crypto.js` |

## 3. Chantiers (source curée : `dictee/etat_chantiers.json`)

### Fermés par la mesure — 13

- **Fermer les boucles du pendu (Möbius phon/ortho, co-décision descendante)** — réfuté chiffré — tous les effets mesurés (−0,73 à +0,87 pt) sont sous le plancher de bruit établi par un PLACEBO (~200 parties sur 3 000 basculent dès qu'on touche au chemin numérique) ; ne pas re-tenter sans idée neuve, et tout A/B du moteur doit embarquer un placebo _(JOURNAL 2026-09-03 · PR #653 · outil commité evo/pendu_paired_ab.js)_
- **Canal GROUPE du pendu (modèle 170 poids)** — construit, mesuré, falsifié au produit — hook laissé OFF-inerte _(PR #617)_
- **Speller : formes « connues mais jamais candidates » (Morphalou)** — 3 lots livrés et mesurés au moteur réel (40 034 puis 81 042 puis 384 869 formes verbales — dernier lot), TSV commités gardés par build_morph_lex --check _(PR #641 · #642 · #643)_
- **FP=0 violé en production (« La foule attendait » → attendaient)** — réparé à la source ; depuis, la batterie « FP=0 » rend un vrai code de sortie, le bake autonome est gardé sur l'accord, et dev.sh affiche la sortie des verts suspects au lieu de la jeter _(PR #619 · #633 · #624 · #620)_
- **Ponctuation dys : virgule proposée, point final manquant, « ? » applicable d'un clic** — livré (39 % des productions dys réelles n'avaient AUCUNE règle de point final) et gardé — la détection de QUESTION est dans la batterie, rappel gardé autant que précision _(PR #628-#631 · #645-#648 · sonde dictee/question_bench.js)_
- **Collisions d'accent (« adhérent » n'est pas « adhèrent »)** — 16 mots courants cessent d'être pris pour des verbes ; les 3 copies (JSON == app == extension) sont gardées _(PR #640 · garde dictee/build_non_verbe_acc.py --check)_
- **Dette : _cmp non transitif** — INSTRUITE le 04/09/2026 (enquête lecture-seule) : re-mesurée au 705k — 14/601 corrections sensibles à l'ordre (2,33 %), TOUTES au palier FLAG (0 AUTO), FP UD insensibles, identique au lexique 165k ; le chiffre produit a une bande d'ordre ±1 (402/403/401) ⇒ un ±1 de dys_pipeline_probe entre variantes speller n'est JAMAIS un signal ; 4 constructions invariantes mesurées, canon:F seule qualifiée (402/19 strict) mais gain NUL → pas de câblage ; recette canon:F en réserve au JOURNAL (copeland reproduit la falsification « par le lot » — ne pas re-tenter) _(JOURNAL 2026-09-04 · doctrine #617/#653)_
- **Remise en ordre des documents de pilotage (plan du 24/08)** — SOLDÉ : CLAUDE.md sommaire (989 mots) VALIDÉ par Rem le 04/09 (sauvegarde de l'ancien : notes/CLAUDE_AVANT_TRI_2026-09-03.md) ; histoire au JOURNAL (digests #546-#610 et #611-#655, rien de perdu) ; DOCTRINE actée ; ETAT.md généré ; skill linguistique versionné ; gardes docs_probe + etat_gen --check + a11y_probe + icones élargies en dev.sh/CI _(PR #656 · #657 · #658 · #659 · #660)_
- **Tokeniseur du speller Python ≡ toks du produit (apostrophes) — PORTÉ** — PORTÉ le 07/09/2026 (7e maillon) : `TOK_JS` + `spell_token` (décalque de spellToken, l'étage devant spellTokenCore) ; 12 témoins/12 ≡ produit. Accord de palier 98,3 → 98,8 % (597/604), et les colonnes hors accord passent de 35 référence seule / 20 produit seul à 8 / 1 : l'« angle mort » de parity_speller était surtout un artefact de tokenisation (7 ancres « py — » disparues). Reste, lu un par un : 5 « référence seule » sont une autre FAMILLE côté produit (mot inconnu), 1 majuscule de début de phrase (atStart ≡ premier token du texte), 1 suggestion à deux mots (« a paré »). _(JOURNAL 2026-09-07 · palier_gold_ref.json · parity_speller_ref.json)_
- **Dominance ≫20× du speller (b_slip) — FERMÉ PAR LA MESURE** — Re-mesuré le 07/09/2026 sur la surface complète (référence ≡ produit à 98,4 % de palier, 880 paires) dans un worktree jamais commité : la référence REPRODUIT les casses du port JS de #664 — tres→trés [flag], apres→aprés [flag], gran→gram (batterie §5 rouge). Garde de palier 98,4 → 96,8 % (12 désaccords nouveaux), parité +5 abstentions, pipeline 284 → 286 (+2, dans la bande ±1) / 14 cassés identiques, MUET +3 = des junks appliqués. Il n'y avait PAS d'asymétrie de moteur (4 hypothèses réfutées #664-#667, puis #670/#672/#673 ont comblé la référence). Refusé sur ses effets ; ne pas rouvrir sans idée nouvelle. _(JOURNAL 2026-09-07 (fin) · 2026-09-05 (fin) · 2026-09-04 (soir))_
- **dys_pipeline_probe : colonne « APPLIQUÉ FAUX » — FAIT** — Posée le 07/09/2026 (nuit) : un ROUGE appliqué vers un autre mauvais mot n'est plus rangé en MUET. Sur main : 66 (5,2 % des ratés — MUET 747 → 690, bruit 238 → 229 : ils se cachaient dans les deux) (souhaiterai→souhaitez (gold souhaiterez), travaile→travaille (gold travail), aller→allé (gold allée), le→la (gold les), posibilité→possibilité (gold possibilités) — une bonne part est « bon lemme, mauvaise flexion », sous-famille à séparer). Contrôle positif sous b_slip (worktree détaché) : 69 (+3) (les 3 « muets » de plus mesurés le 07/09 (fin) sous b_slip, dont trés et aprés déjà vus par la garde de palier). _(JOURNAL 2026-09-07 (nuit))_
- **Étapes de spellTokenCore absentes de la référence — TOUTES PORTÉES (série « la référence décrit le produit », #659 → #679)** — Dix maillons, chacun vu rouge avant d'être cru : _SPELL_KEEP #659 · mot inconnu #663 · POS attendu #665 · x final #666 · palier vigilance #670 · contexte-first + DET_G #672 · tokeniseur #673 · OMISSION + _DPAIR #677 · briques de contexte (fenêtre du nombre, invariables, tables de genre) #678 · les six dernières étapes (_AFIX, e muet du futur, soudure à/a+verbe, élongation, _slipMot auto, _aux participe) #679. Accord de palier produit↔référence sur le gold : 92,4 % (05/09) → 100,0 % (880/880, 10/09), même mot 295/295 · 181/181 · 129/129. Le chiffre de référence (286 / 15) décrit le produit au palier près ; il n'est plus une borne. Hors accord réduit à 1 le 10/09 (suite) : atStart aligné (≡ premier token du texte), et « ere » est « la 1ere » traité par le produit en famille « nombre » — la garde le dit désormais (« produit : autre famille »). _(JOURNAL 2026-09-10 · palier_gold_ref.json)_
- **Le « e » muet du futur croyait à des verbes rares — GARDE MESURÉE (3 moteurs)** — Recensé le 11/09/2026 sur tout le dys local + 2 500 UD + 98 GEC : 8 tirs justes (oublirais/oublirait/oublirez, lemme oublier 77/M) contre 2 faux (révérer 0/M, fauter 0,05/M), 0 sur UD. Garde : le verbe reconstruit doit être courant (≥ 1/M) — app, extension et référence à l'identique (omega_edit). Effet : revérrons → reverrons (auto, par l'accent), fautra → faudra proposé ; pipeline 286 / 14 cassés (−1) / 67 appliqués faux (−1) / 244 un-clic (+1) ; accord de palier 100 % inchangé. Premier chantier de moteur mesuré avec le juge aligné. _(JOURNAL 2026-09-11 · dys-core.js l.2955 · app l.27433)_

### Ouverts — 8

- **AUDIT correcteur du 11/09 (vrai Chrome) : textes d'explication faux/absents, une fausse orange, silences classés** — 24 phrases (12 classiques, 12 « stupides ») dans le vrai Chrome : 39 flags, FP=0, produit ≡ référence. À corriger dans l'ordre : ① TEXTES — REMED.accord sert « mordre » sur un nom (clé→clés), ctxHint muet sur -er/-é, c'est/s'est générique, gouverneur « ma » pour « huit heure », accent é/è servi pour un circonflexe, apostrophe classée accent ; ② « Ma mere » → Mon (fausse orange : `mere` NOM m 6,66/M dans Lexique4, mère 630/M) → recenser puis _AFIX ; ③ aujourd'hui (forme figée à apostrophe) ; ④ répétition « que qu'elle » à travers l'élision ; ⑤ silences par fréquence : accord à distance, bon lemme/mauvaise flexion, a→à devant tout/mes, sa→ça, ma→m'a, au→aux, peut-être ; ⑥ instrument : pyramide ignore la casse seule. Rapport : dictee/AUDIT_CORRECTEUR_2026-09-11.md. _(dictee/AUDIT_CORRECTEUR_2026-09-11.md · JOURNAL 2026-09-11 (soir))_
- **Publication Chrome Web Store** — 0.6.2 téléversée par Rem le 03/09/2026, puis 0.6.3 téléversée le 04/09/2026 (revue Google en cours) — un numéro remis à Rem est brûlé : bumper le manifest avant tout nouveau paquet _(extension/STORE.md · PR #651 · #655)_
- **Accord verbe à vérifier (vigilance orange)** — 2 lots livrés — le parseur de sujet d'abord, puis la FORME avant le NOMBRE (faire semi-auxiliaire, s'est + forme finie, gérondif, gardes de sujet), 3 moteurs à parité. Consigne Rem 04/09 : continuer au fil des situations, la PRIORITÉ va au palier ROUGE (FP=0) _(PR #652 · #654)_
- **Chantier anglais (site → voix → extension conditionnelle)** — réouvert le 31/08 par Rem, feuille de route fixée ; état mesuré : bonne précision, couverture faible ; contrainte cardinale = tout doit être vérifiable sans savoir l'anglais (Rem n'y est plus le juge) _(CHANTIER_ANGLAIS.md · PR #618)_
- **Les 442 mots soulignés sans suggestion** — ÉQUIPÉS par #663 (04/09/2026) : S6 élision + S4 clé phonétique d=1 dans la voie '' de spellUnknown, 3 moteurs + port Python du palier « mot inconnu » — rattrapables en un clic 109 → 142 à la pose. Ce qui reste sans suggestion est mesuré par dys_pipeline_probe (30 au 05/09) ; le mur est le MUET, pas le souligné nu. _(CLAUDE.md 2026-08-23 (mesure « l'orange est-il là pour les 75 % ratés ? ») · #663)_
- **Complément Word (police de son)** — planificateur testé sous Node (306 morceaux) et volet vérifié hors Word — jamais essayé dans Word réel, premier essai terrain à faire _(word/ · garde word/test_son_word.js)_
- **Validation terrain orthophonistes** — EN SUSPENS (décision Rem 04/09 : compliqué à obtenir) — vraies copies dys externes ; valide ET nourrit la boucle descendante ; la fiche imprimable existe (validation_terrain.html) _(CLAUDE.md (audit projet ⏳) · dictee/build_validation_sheet.py)_
- **Les 68 appliqués FAUX : 37 sont « bon lemme, mauvaise flexion »** — Mesuré le 10/09/2026 (sous-colonne de dys_pipeline_probe, tables du produit) : 37 / 68 rouges appliqués vers un autre mauvais mot sont la bonne FORME du mauvais mot manquée (souhaiterai→souhaitez / souhaiterez, prise→prisent / prises, posibilité→possibilité / possibilités). Un raté d'ACCORD, pas d'orthographe : le speller trouve le lemme, le contexte ne le fléchit pas. Levier nommé, non traité — à mesurer famille par famille (verbe / nom / adjectif) avant toute règle. _(JOURNAL 2026-09-10 (suite))_
