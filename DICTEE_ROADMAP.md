# Roadmap — DICTÉE DIAGNOSTIQUE (sur le moteur OMEGA-Ω)

> Outil de **dictée française à diagnostic d'erreur**, fondé sur la **double route** d'OMEGA
> (lexicale = mémoire/homophones · sublexicale = assemblage son→lettre). Visée : **dys / troubles
> de l'écrit** (école, soutien, orthophonie en n°1). Document vivant — on ajuste à chaque jalon.

## ÉTAT (2026-06-30) — AUDIT FP=0 à l'échelle (corpus UD) & re-tiering rouge↔vert

Premier **vrai** test FP=0 : `correct()` sur **14 450 phrases correctes** d'UD (`# text` de `ud_fr_gsd-train.conllu` — tout flag = un FP). Verdict : le correcteur n'était **pas FP=0 à l'échelle** (**4,70 %**). Les batteries de 30–95 phrases ne pouvaient pas le voir. Deux fixes :
- **Régression éliminée** (mes 2 dernières règles) : `aux mal orthographié` **241→0 FP** (« ne »→a, « le »→a : distance ≤2 vers a/as/ai/es → mots-outils courts. Corrigé : mot ≥3 lettres, cibles longues ≥4, distance ≤1, stoplist avec/avant) ; `majuscule` **180→35** (initiales « L. casei », ellipses `..`, décimales → flag `cap`, garde initiale, abrév. latines).
- **Re-tiering rouge→vert** (classification manuelle de ~100 flags : **~82 % = vrais FP**, concentrés sur les homophones purs qui firent sur le mot correct fréquent — « a été »→à, conjonction « mais »→mes) : **a/à, on/ont, son/sont, mais/mes, et/est, ce/se, peu** descendus en **VIGILANCE verte** (dépendants du sens → impossibles en rouge FP=0). é/er durci (garde noms-en-é : marché/traité/combiné, **50→22**), accord-SV durci (garde aux+participe : « auraient tenté », **15→10**). Gardés rouges : accord pluriel nom (majoritairement de vraies fautes), genre, leur/leurs.

**Résultat : ROUGE 4,70 %→0,92 % (Py) / 0,89 % (JS) | VERT homophones ~1,2 %.** 3 moteurs, parité app⊆Py & ext⊆Py OK, `recall_probe --check` OK. `VRULES`/`vigilance()` (Python), `VRULES`/`vigHomo`/`_vigHomo` (JS). Voir mémoire `corrector-fp0-at-scale`.

## ÉTAT (2026-06-30) — ponctuation, majuscule & run-on (sens/contexte)

`toks()` jetait la ponctuation et les règles minusculaient → correcteur aveugle aux frontières. Nouvelle **couche segments** (`_segInfo` : drapeaux début-de-phrase après `.!?`, borne de proposition `,;:`, trait d'union), parité 3 moteurs :
- **A — contexte borné** : `_subject_before`/`svSubject` s'arrête à une borne → le sujet (être/avoir, accord) ne traverse plus un `.`/`,` (réduit les FP).
- **B — majuscule (rouge, FP=0)** : mot minuscule **après `.!?`** → capitale (« il pleut. **demain** »→Demain). **Jamais le 1er token** (fragment) — exigence du garde `recall_probe`. Filtre `correct()` relâché pour la casse seule. Garde abréviations (« M. dupont »).
- **C — run-on (vert, vigilance)** : 2 propositions `pronom+verbe` collées sans séparateur (« il mange il dort ») → signale « ponctuation manquante ? » sans imposer (le sens en dépend → dissocié du rouge, comme tu l'as demandé). Conservateur : anti-inversion (`dit-il`), anti-coordination/relative (`et il`, `qu'il`), verbes finis requis + accord. Mesuré : détection ✓, **0 FP** (inversion/dislocation/relative/mono-proposition évités, 0/30 corpus). `runon_positions` (Python) / `_runonSet`/`runonText` (JS).

## ÉTAT (2026-06-30) — refonte être/avoir (faute dys n°1)

Deux nouvelles règles **FP=0**, en **parité 3 moteurs** (Python réf → monolithe → extension), pour les fautes être/avoir (les verbes les plus fréquents) :
- **`rAuxUsage` — confusion d'usage être↔avoir** : « il **est** faim »→« il a faim », « il **a** allé »→« il est allé », « on **est** 10 ans »→« on a », « ils **ont** restés »→« sont ». FP=0 par **listes fermées** (idiomes d'avoir : faim/soif/raison/tort/envie/besoin/peur/sommeil ; participes de verbes intransitifs d'être : allé/venu/parti/resté/né/mort/devenu… ; âge). On ne swappe **que** là où un seul auxiliaire est possible ; **abstention** sinon → jamais de swap à l'aveugle.
- **`rAuxMisspell` — auxiliaire mal orthographié** : « vous **ete** »→êtes, « nous **avon** »→avons, « vous **ave** »→avez, « nous **étion** »→étions. Distance d'édition ≤2 vers la forme accordée, garde `FULL_AUX` (toutes les formes valides tous temps — « aurait » intact), abstention si ambigu être↔avoir.
- Sujet **pronom net** requis (`svSubject`, bornes de proposition) ; **`je` différé** (élision j'ai) ; nous/vous gérés. Mesuré : usage 12/12, ortho 4/5 ; **0 FP** (« il est mort/resté », « j'ai été », « il a eu peur », « elle aurait préféré » intacts). Tests : `evo/aux_port_test.js`, batteries dans `correcteur_probe.py`.

## ÉTAT (2026-06-30) — couche verte « vigilance »

Le correcteur a désormais **deux niveaux**. **Rouge** = corrections **FP=0** (inchangé, parité `flags ⊆ Python` app + extension). **🟢 Vert** = *vigilance* sur les mots **confusables** (homophones + paronymes, **~80 groupes** curés depuis Lexique 4, CC BY-SA) : survol = possibilités + sens. Il **n'affirme pas** de faute → **hors FP=0**, donc le signal distributionnel (sens) y sert enfin — **ordonner/atténuer, jamais trancher** (mesuré : confidemment faux sur « une *paire* de lunettes » → on **signale**, on ne corrige pas). Mineurs de candidats : `build_confusables_auto.py`, `paronyme_miner.py` (auto trop bruité → **curation**). Source unique : `build_confusables.js` → `embed_confusables.js` (monolithe) + `build_assets.py` (extension). *Antériorité : LanguageTool (LGPL, incompatible) & Merci-App (proprio) → rien emprunté, tout maison (Lexique).* **Glosses (sens)** : curés (concis) sinon **auto-Wiktionnaire** (CC BY-SA, compatible — `build_glosses_wiktionnaire.py`, API par lots + cache) → un ajout de confusable sans gloss manuel est rempli automatiquement.

## ÉTAT (2026-06-24) — où on en est

Les **3 étapes** de la feuille de route sont faites ; l'oracle de saisie a été **fondu dans le correcteur**, et une
**boucle d'apprentissage** ferme le cycle *diagnostic → pratique → re-mesure*.
- ✅ **Étape 1 — Bescherelle** : table de conjugaison complète (`build_cgram.py` : ind. présent/imparfait, participes
  exclus, `CONJ_STOP`) injectée dans l'app + l'extension. FP batterie **2,17 %** (≤ baseline).
- ✅ **Étape 2 — fautes de frappe** : speller multi-édit (`ortografe→orthographe`), garde longueur + même initiale, FP=0.
- ✅ **Étape 3 — pendu-oracle** : oracle de saisie **double voie** bâti sur le moteur (`evo/saisie_oracle.js` :
  lexicale cohorte+Damerau+n-gram, sublexicale `_neoNG`, autocomplete gap-aware `_neoLetterNgramDist` — gardé en
  **labo/mesure**), puis **fondu dans le correcteur** comme **COMPLÉTION temps-réel** (app « 🩹 Correcteur » +
  extension), car le correcteur EST déjà l'aide-frappe (correction + accents en direct). Accents restaurés via le
  speller embarqué (OMEGA_LEX4 est déaccentué).
- ✅ **Boucle d'apprentissage** (app) : **profil dys unifié** (`DysProfile` : dictée = taux supervisé par famille +
  correcteur = tally erreurs de rédaction) → **sélection de mots adaptative** dans la dictée (tirage pondéré, **seuil
  de variété** 45 % libre, anti-répétition) → **courbe de progrès** (taux par famille + sparkline). Le **pendu reste
  hors boucle** (deviner des lettres ≠ écrire ; il joue sans accents → erreur de catégorie).
- ✅ **Garanties** : `dev.sh` **26/26**, **parité 3 moteurs** (Python `correcteur_probe.py` ↔ app ↔ extension
  `dys-core.js`), **FP=0** cardinal, R66 OFF-inerte, contraste UI (lisibilité dys).
- ⏳ **Limite assumée** : l'efficacité *pédagogique* de la boucle (pratique ciblée vs aléatoire fait-elle baisser
  l'erreur plus vite ?) n'est **pas encore mesurée** — prochaine falsification (§1). Profil **app-only** (sandbox de
  stockage ≠ extension). Détail chronologique : `dictee/JOURNAL.md` (suites 1 → 10).

## ÉTAT (2026-06-18) — jalon précédent
- ✅ **Dictée de phrases** (`diag_sentence.py`) : familles **100 %** ; intégrée app (« ✍️ Dictée diag »).
- ✅ **Levier grammaire** : sujet-verbe (gouverneur identifié sur **94 %** des accords verbaux du *diagnostic* `diag_sentence.py` ; le *correcteur*, lui = **11/11 held-out vocab neuf, FP=0** — deux mesures distinctes, pas un écart), sujet à distance, participe (être / avoir+COD antéposé), **genre du GN** (déterminant + **route lexicale** `lexical_gender`), homographes nom/verbe, **stades développementaux**.
- ✅ **Correcteur dys** (`correcteur_probe.py` + app « 🩹 Correcteur ») : détecte+corrige **sans corrigé**, **0 FP** ; 22/24 in-corpus, **12/15 held-out** (vocabulaire neuf). UI clic-pour-corriger + stade.
- ✅ **Lexique4 reçu** → `build_cgram.py` : verbes (12 415) + genre (53 050) + **sous-ensemble HF embarqué** dans l'app.
- ✅ **Grammaire double voie** (`GRAMMAIRE_DOUBLE_VOIE.md`) : route lexicale (cgram) + boucle **descendante** (apprend le lexique de genre, 100 % préc., FP=0, *data-bound*).
- ✅ **Accord en genre — chiffré sur UD réel** (`dictee/gender_probe_ud.py`, 355 k mots, genre/POS gold) : genre **déterminant** (actif) = **FP 0,09/1000** (FP-sûr) · **recall 67 %** (rate les noms homographes de verbes — abstention FP-safe assumée). Genre **adjectif** (désactivé, `rule_genre_adj`) = **3,37 FP/1000** → justifié. **Un POS-tagger n'en ôterait que ~48 %** (→ 1,76/1000, encore ~20× le déterminant) : l'accord adjectival exige la **PORTÉE** (nom-tête, étendue d'accord) = du **parsing**, pas qu'un tagger. → affine « en attente d'un tagger ».
- ✅ **Déterminant — CÂBLÉ (3 moteurs, parité OK)** : garde verbe-homographe levée (`P(VERB)<ε` retiré), `P(NOUN)≥τ` gardé — un mot après un déterminant à fort P(NOM) est un NOM même s'il est verbe-homographe. **recall 67 → 73 %**, FP **0,09 → 0,10/1000** (+2 sur 355 k). Vérifié : `parity_corr.js` (app ⊆ Py) + `parity_core.js` (ext ⊆ Py) OK · **FP=0 batterie préservé (0/30, 0/40)** · garde recall OK. (`gender_levers_ud.py`)
- 🔧 **Adjectif — option mesurée, NON câblée (décision)** :
  Une portée serrée (nom-tête immédiat pur + genre connu + **déterminant qui corrobore le genre**) ramène le FP **3,37 → 0,19/1000** (÷18), précis sur son périmètre mais **étroit** (≈ 494 cas / 355 k → couverture faible). Activable comme sous-ensemble FP-safe (« une voiture bleu→bleue ») ; le large reste = parsing. *Laissé désactivé (trop peu de valeur vs complexité).*
- ❌ **FALSIFIÉ** : pendu de phrases comme levier winrate (`evo/PHRASE_HANGMAN_PROBE.md`) — banc, pas débouché.
- ⏳ **Prochain goulot = DONNÉES** : vraies copies corrigées (orthophonistes / corpus en ligne `fetch_gec_corpus.py`) → valident le correcteur ET nourrissent la boucle descendante.

## Pourquoi cette direction (rappel décision)
- La **force mesurée** d'OMEGA est **phon→ortho** (70 % hors-lexique, 97-98 % en lexique) — la dictée *est* cette tâche.
- Son **profil de défaite est une signature de dyslexie phonologique** (§11.2 mémoire : 96 % des défaites = paire phonétiquement proche ; **58 % voisée/sourde** P/B, T/D, K/G, F/V, S/Z).
- La **dictée existe déjà à moitié** : routes lexicale (`M_DICTEE_LEXICAL`) et sublexicale (`M_DICTEE_SUBLEXICAL`, EM phonème→graphème) dans `app/omega-pendu.html`.
- Les **accents sont récupérables** : surface ASCII (NFD), mais le **SAMPA `p` porte la distinction** (é=/e/, è/ê=/E/) via `PHON_TO_LETTERS` + prior `M4_PHON_USE_P`.

## Principes (hérités d'OMEGA, non négociables)
1. **Mesure d'abord** : chaque ajout = un effet *mesurable* sur un jeu de test étiqueté, jamais « ça semble marcher ».
2. **OFF-inerte / falsification R66** : rien ne dégrade le pendu ; toute brique est OFF par défaut, baseline byte-identique au repos, gardée seulement si l'apport ON est mesuré.
3. **Isolation** : prototypage sur copies jetables ; le build n'est pas modifié sans validation.
4. **Une jonction à la fois** : tester l'**utilité** avant de scaler. Roadmap > improvisation.
5. **Distinguer cognition vs oracle** : la route sublexicale (généralise) est le cœur ; la lexicale (mémoire/homophones) est un *complément assumé*, pas la performance.

---

## Phase 0 — Cadrage & métriques *(AVANT tout code)*
But : savoir ce qu'on mesure et sur quoi, sinon tout Δ est du bruit.
- [ ] 0.1 **Cible & périmètre V1** : confirmer « dys / troubles de l'écrit » ; périmètre = mots FR courants (pas seulement ≥7 lettres).
- [ ] 0.2 **Jeu de test étiqueté** : ~200-300 mots avec, pour chacun, les **types d'erreurs attendus** (accent é/è, voisée/sourde, homophone, lettre muette, régularisation). Source : Lexique4 (déjà inliné) + sélection manuelle des pièges.
- [ ] 0.3 **Métriques définies** :
  - moteur : % mots phon→ortho corrects **avec accents** (in-lexique / hors-lexique séparés) ;
  - diagnostic : **taux de bonne classification** du type de faute sur le jeu 0.2.
- [x] 0.4 **Décision « hors cadre pendu » — TRANCHÉE (Lexique4 complet en main, 188 863 mots, 37 col.)** :
  `1_Mot` = orthographe **accentuée** → accent = lookup en lexique ; **30 774 mots < 7 lettres (16 %)** dispo →
  V1 assume **mots courts + accents**. Colonnes bonus exploitables : `24_NbHomoph` (homophones, 71,8 %),
  `15_NbLettres`/`16_NbPhons` (muettes), `33_Preval`+`11_FreqOrtho`+`26_SyllNb` (difficulté), `30-32` (morpho),
  `2_Phono` SAMPA + `3_Phono_IPA`.
- [ ] 0.5 **Harnais déterministe** réutilisé (omegaRand seedé) pour reproductibilité.
- [ ] 0.6 **Sous-ensemble accentué** : régénérer la table inliné (comme l'actuelle, mais en gardant `1_Mot` accentué
  + colonnes utiles) — le `.tsv` 34 Mo reste hors-repo (trop gros), seul le sous-ensemble est embarqué.

## Phase 1 — Accents *(simplifiée : data confirmée)*
But : écrire les accents. **En lexique = lookup `1_Mot`** (trivial). Reconstruction **uniquement hors-lexique**.
- [ ] 1.1 **En lexique** : sortie accentuée = lookup direct dans `1_Mot` (rien à reconstruire).
- [ ] 1.2 **Hors lexique** : enrichir `PHON_TO_LETTERS` pour émettre les graphèmes accentués depuis le SAMPA :
  /e/→é, /ɛ/(E)→è/ê, /o/→ô (selon contexte), ç via /s/ devant e/i, etc. (table dérivée, mesurée).
- [ ] 1.3 **Mesure** : % de ré-accentuation correcte hors-lexique (jeu 0.2).
- [ ] 1.4 **Falsification R66** : OFF = comportement ASCII actuel **inchangé** (pendu intact) ; ON = gain mesuré, sinon reverte.

## Phase 2 — Boucle dictée réelle *(entrée apprenant)*
But : passer de « OMEGA s'auto-dicte » à « l'élève écrit, on corrige ».
- [ ] 2.1 **UI dictée** : déclencher un mot (afficher l'invite), **champ de saisie**, validation.
- [ ] 2.2 **Comparaison** saisie ↔ cible, **lettre + accent**, correct/incorrect basique (pas encore de diagnostic).
- [ ] 2.3 **Sélection des mots** graduée (longueur, fréquence, pièges) depuis Lexique4.

## Phase 3 — Diagnostic d'erreur par double route *(le cœur de valeur)*
But : classer **pourquoi** c'est faux, l'atout que personne d'autre n'a.
- [ ] 3.1 **Classifieur d'erreur** par type :
  - **accent** (bonne lettre, mauvais diacritique → é/è) — via Phase 1 ;
  - **voisée/sourde** (P/B, T/D, K/G, F/V, S/Z) — liste du mémoire §11.2 + levier `M_PHON_CORRECTION` (α=0,10/β=0,05) à activer/mesurer ;
  - **homophone / lexicale** (mot homophone existant → *ver/vert/verre*) — via route lexicale (`omega_dicteeLexical` renvoie déjà les homophones) ;
  - **régularisation phonétique** (graphie plausible au son mais fausse) — via route sublexicale ;
  - **lettre muette** (finale non prononcée).
- [ ] 3.2 **Mesure** : taux de bonne classification sur le jeu 0.2. Falsifiable.
- [ ] 3.3 Réutilise tel quel : les 2 routes existantes + la table accents (Phase 1).

## Phase 4 — Restitution pédagogique *(feedback dys)*
But : transformer le diagnostic en aide compréhensible.
- [ ] 4.1 **Messages par type** : « tu l'as écrit comme ça sonne — ici /ɛ/ s'écrit *è* » · « confusion sourde-sonore *p↔b* » · « homophone : *vert / ver / verre* ».
- [ ] 4.2 **Profil d'apprenant** : suivi des erreurs par type dans le temps (où il bute).
- [ ] 4.3 **Mode entraînement ciblé** : redonner des mots du type le plus raté.

## Phase 5 — Audio & accessibilité
- [ ] 5.1 **TTS** : dicter le mot à voix haute (le SAMPA est là ; mapper vers une voix navigateur).
- [ ] 5.2 **(parqué) Braille / malvoyant** : modalité d'E/S sur un **autre axe** (visuel) — à brancher seulement après la V1 dys, car OMEGA n'y apporte pas son atout distinctif.

## Phase 6 — Validation & contenu
- [ ] 6.1 **Listes graduées** par difficulté / piège.
- [ ] 6.2 **Validation utilisateurs** (école / orthophoniste) si possible — l'utilité réelle, pas qu'un chiffre.

---

## Ordre conseillé (impact × effort)
**0 → 1 → 2 → 3** d'abord (le moteur accentué + la boucle + le diagnostic = la valeur).
**4** ensuite (pédagogie). **5-6** quand le cœur est prouvé.

## Ce qu'on RÉUTILISE vs ce qu'on AJOUTE
| Réutilisé tel quel | À ajouter |
|---|---|
| Route lexicale + homophones (`omega_dicteeLexical`) | Restitution accents (table enrichie, Ph.1) |
| Route sublexicale EM phon→graphème (`omega_subTrain/Decode`) | Boucle de saisie apprenant (Ph.2) |
| Prior phono `M4_PHON_USE_P` + `PHON_TO_LETTERS` | Classifieur de type d'erreur (Ph.3) |
| Lexique4 inliné (phon, fréquence, morpho) | Feedback pédagogique + profil (Ph.4) |
| Harnais déterministe (omegaRand) | TTS (Ph.5) |
| Levier `M_PHON_CORRECTION` (voisée/sourde) | Jeux de mots gradués + validation (Ph.6) |

## Risques / limites connus (à garder en tête)
- Décodage sublexical **glouton** (meilleur chunk par phonème, sans contexte) → erreurs ; à muscler (contexte / morphologie).
- `qualité` plafonnée ~0,80 et voisée/sourde non résolue côté pendu → le diagnostic doit savoir afficher l'incertitude.
- Sortir du cadre pendu (≥7 ASCII) demande de gérer mots courts + diacritiques proprement.
