# AUDIT COMPLET — code OMEGA-Ω (bugs · conflits · flux · architecture) — 2026-06-20

> Audit **transverse et exhaustif** de TOUT le code du dépôt, mené région par région
> (7 auditeurs parallèles) sur le **code réel** (pas seulement les docs). Complète et
> actualise `AUDIT_OMEGA.md` (cognitif, 17/06) et `AUDIT_STRUCTUREL.md` (moteur, 17/06),
> qui **ne couvraient pas** le code ajouté depuis (panneaux Décompose/Correcteur, suite
> Python `decompose`/`p2g`/`build_*`, harnais `evo/`).
>
> **Méthode** : blocs `<script>` du monolithe extraits en `/tmp` (interdit de lire les
> 5 Mo en direct, CLAUDE.md), `node --check` + runs réels seedés ; scripts Python
> exécutés et chiffres comparés aux docs ; harnais `evo/` lancés ; ancrage **par nom de
> fonction** (les n° de ligne du monolithe dérivent). **Lecture seule — aucun fichier de
> production modifié.** Sévérité : 🔴 corriger · 🟠 important · 🟡 dette/hygiène · 🟢 sain (vérifié).
>
> **Convention de ligne** : pour le moteur, `ligne_originale = ligne_/tmp/eng1.js + 1439`.

---

## 0. Topographie réelle du code (la carte)

`app/omega-pendu.html` = **11 509 lignes**, dont :

| Région | Lignes orig | Extrait | Contenu |
|---|---|---|---|
| `<style>` + HTML/UI | 1–1438 | — | feuille de style, panneaux, 42 toggles |
| **LEXIQUE gz (EXCLU)** | **731** | — | `<script type=text/plain id=lex4-data-gz>` ~4,6 Mo base64+gzip |
| **Moteur — script 1** | 1439–9929 | `/tmp/eng1.js` (8489 l) | substrat HDC, voies ortho/phon, OS, M1–M5, miroirs, M_S, declares, NEO, benches, dictée lexicale, toggles UI |
| **vdc-lex (EXCLU)** | **9931** | — | `<script type=application/json id=vdc-lex>` 90 Ko (cgram_hf embarqué) |
| **Moteur — script 2** | 9932–11416 | `/tmp/eng2.js` (1483 l) | IIFE **dictée diagnostique + correcteur dys** |
| **Moteur — script 3** | 11418–11506 | `/tmp/eng3.js` (87 l) | IIFE **panneau Décompose** (script séparé) |

Hors monolithe : **dictée Python** (16 fichiers, 2405 l), **harnais evo** (12 JS + 1 py, ~1454 l),
**omega-key** (app 3449 l + relais 71 l).

**Statut d'exécution (vérifié) :** 🟢 les 3 blocs JS `node --check` OK ; moteur chargé
headless (83 605 mots, gz async `DecompressionStream` sous Node 20/22) ; **13 harnais evo
EXIT 0** ; tous les scripts Python reproduisent leurs chiffres ; **0 marqueur de conflit git**.
*Rien n'est cassé en exécution* — les findings ci-dessous sont des défauts de qualité/correction,
pas des pannes.

---

## 1. Synthèse exécutive

**Le code est sain sur ses garde-fous mécaniques** : discipline OFF-inerte réelle (les flags
gardent des *blocs*, pas des *sorties* → baseline byte-identique au repos), RNG seedable et
déterminisme du moteur de jeu, finitude *fail-loud* (sauf **un** chemin, cf. 🟠 B6), frontière
montant/descendant propre et cheat-free, IIFE dictée étanche, durcissements omega-key intacts,
split train/test Python étanche, parité JS↔Python du levier grammaire fidèle, **tous les chiffres
des docs reproduits au run réel**.

**Aucun 🔴 « crash » ni 🔴 XSS exploitable** dans le build courant : la faille XSS historique
(`AUDIT_STRUCTUREL §S1`) **est corrigée** (échappement présent), même si affaibli (🟠 B1). Le seul
🔴 est d'**inclusivité** (accessibilité dys manquante). Les défauts réels sont **doctrinaux**
(scoreur cognitif = pile de marginales, pas une jointe ; baseline = agrégat historique),
**de surface** (tissu cicatriciel, code mort, ~500 globaux, `eval` toggles, duplication),
**de robustesse** (gardes manquantes sur le chemin bPC, catch muets bench), et **de doc périmée**
(D2 obsolète, headlines de chiffres).

**Décompte** : **1 🔴 · ~14 🟠 · ~22 🟡 · nombreux 🟢 vérifiés.** Aucun finding ne touche la
**baseline mesurée du pendu** (tous OFF-inerte au repos ou hors chemin de décision), **sauf**
la lecture du son du mot (régime « mot entendu », déjà documenté).

---

## 2. BUGS

### 2.1 Sécurité / inclusivité (panneaux app — cible dys)
- **🔴 Accessibilité absente (eng2.js / eng3.js).** Zones de feedback `#vdd-fb` (dictée),
  `#vdc-out` (correcteur), `#vdk-prev` (décompose) remplies par `innerHTML` **sans
  `aria-live="polite"`** → un lecteur d'écran **n'annonce pas** le diagnostic/correction. Aucun
  `role`/`aria-*` dans eng2/eng3. De plus `.vdc-bad` (mot corrigeable) = `<span onclick>` **non
  focusable clavier** (pas de `tabindex`/`role=button`/`keydown`) → la correction au clic est
  **inaccessible au clavier**. *Critique vu la cible n°1 « dys »* (souvent co-usagers de synthèse
  vocale / lecteur d'écran). Impact : inclusivité, pas baseline.
- **🟠 B1 — `esc()` redéfini (eng2.js:1413).** Deux `function esc` dans le **même scope IIFE** :
  ligne 1341 échappe `& < > " '` (5 car., correct) ; ligne 1413 (bloc correcteur) n'échappe que
  `& < > "` — **l'apostrophe `'` n'est plus échappée**. Par hoisting, la 2ᵉ écrase la 1ʳᵉ **pour
  tout le panneau dictée** (qui croyait utiliser la version 5-car.). **Pas d'XSS exploitable**
  (saisie élève réinjectée en *contexte texte*, `< > & "` échappés bloquent l'évasion) mais
  **régression silencieuse de robustesse** + duplication. *Fix : une seule `esc` 5-car.*
- **🟠 B2 — `say()` (eng2.js:1394) : `try/catch{}` muet sans feature-detection.** Si
  `speechSynthesis` (Web Speech) est absent ou la voix `fr-FR` indisponible, le bouton « 🔊 Dicter »
  **échoue en silence total** — aucun message, aucun repli texte. La dictée orale est la fonction
  *centrale* du panneau et la cible dys en dépend. *Fix : `if('speechSynthesis' in window)` + repli.*

### 2.2 Robustesse du moteur (script 1)
- **🟠 B3 — `_omega_trexquant_bench` ne restaure pas en `finally` + ne fige pas tous les toggles
  (eng1.js:7853-7883 ≈ orig 9292).** `restore()` est appelé en fin de `try` **et** dans `catch`,
  mais **pas de `finally`** (pattern fragile, `AUDIT_STRUCTUREL §R1` confirmé). De plus le snapshot
  omet `M_LEARN_FROM_COGNITION_ENABLED` (lu pendant `play()`, eng1.js:5857), `M_DECLARE_DUAL`,
  params NEO-JOINTE/OS-ARB → la **mesure trexquant peut dépendre de l'état UI antérieur** (R67).
- **🟠 B4 — `_trexq_restore`/`_trexq_removeWord` (eng1.js:7820/7827 ≈ orig 9259/9266) : catch muet
  sur mutation de `len_index`.** `console.error` **sans** `ui_log('ERROR')` (`§E1`). Pire :
  `_trexqRemoved=null` est exécuté **inconditionnellement** après le splice → si le splice de
  restauration échoue (catch avalé), **le mot retiré est définitivement perdu du `len_index`** et la
  cohorte/recall reste amputée **en silence** pour la session. Module OFF par défaut → hygiène tant
  que `M_TREXQUANT_MODE` reste OFF. *Fix : `ui_log` + ne nuller `_trexqRemoved` qu'après réinsertion.*
- **🟠 B5 — chemin bPC readout sans garde de finitude (eng1.js:2898 ≈ orig 4337).**
  `cLetterScore[l] = Σ a_c·rwR[l][c]` est **couplé à la décision** (`M5_d_step`, eng1.js:3509,
  couplage 0,20) mais **aucun `Number.isFinite`/`throw [FATAL]`** ne garde `cLetterScore`, `a[c]`,
  ni la matrice `rwR` — alors que `M_OS_v07_step`, `M4_phon_step`, `M5_phon_step` **throw** sur
  non-fini. C'est **le seul chemin décisionnel non fail-loud**. Couplé à :
- **🟢 B6 — `bpcW` Hebbian « non borné » → FALSIFIÉ par la mesure (eng1.js:2880).**
  `w[i] += LR·ac·(m2[i]-m2hat[i])` : aucun clamp ni normalisation (le commentaire reconnaît la
  dérive « vers 2000+ parties »). `M_BPC_R_DECAY` borne `rwR` mais **rien** ne borne `bpcW` →
  `‖bpcW‖` *pourrait* dériver → `a[c]` exploser → `cLetterScore` non borné.
  **MESURÉ (2026-06-20, R67, config réf., 2500 parties seed 12345)** : `‖bpcW‖` **NE diverge PAS** —
  s'auto-stabilise à **~1,1** (0,67 → ~1,1, **plat dès ~900 parties, inchangé jusqu'à 2400**),
  activations bornées (< 0,7). Cause : l'objectif est une **reconstruction** (`m2−m2hat` s'annule
  quand l'autoencodeur converge), **pas du Hebbian pur** → naturellement **auto-régularisant**.
  → **Borner `bpcW` est INUTILE** (un cap serait inerte, ou distordrait la représentation convergée) ;
  la garde **fail-loud (B5 / fix #4)** suffit comme filet contre un NaN hypothétique. La crainte
  « dérive sur 2000+ parties » d'`AUDIT_OMEGA §S2` est **non réalisée en pratique** (mesure : `/tmp/diag_bpcw.js`).
- **🟡 B7 — `omegaRand` fallback `Math.random()` (eng1.js:946 ≈ orig 2385).** Jamais déclenché en
  pratique (`initOmegaGlobals` pose toujours `_omegaRng`), mais le claim « tout `Math.random`
  non-seedé supprimé » reste inexact (`§R2`). Tout appel à `omegaRand` **avant** init = non
  déterministe silencieux.
- **🟡 B8 — `M5_d_step` suppose `filtered` trié (eng1.js:3766).** `maxScore=filtered[0].score`
  pour stabiliser le softmax, mais les readouts bPC/IG *ajoutent* aux scores **sans re-trier** → la
  soustraction-du-max est rompue si ON (bénin : scores bornés, pas d'overflow).
- **🟡 B9 — bloc A/B : init lazy via `omegaRand` hors init (eng1.js:2951).** La consommation du
  flux RNG dépend du **tick d'activation** du toggle AB → deux runs qui togglent AB à des moments
  différents divergent (OFF par défaut → baseline non touchée).

### 2.3 Harnais de mesure (evo/)
- **🟠 B10 — `diag_bpc.js:73` : verdict signé à l'envers.** La condition utilise
  `Math.abs(gapNet)` → imprime « porte un signal au-delà de la fréquence (spécifique au mot) »
  **même quand `gapNet` est nettement négatif** (run réel : `GAP brut +0.0007 · GAP NET −0.0212 →
  porte un signal`). Le **chiffre** est juste ; seul le **verdict** ment → risque qu'un relecteur
  conclue à tort que le readout concept porte du signal-mot (menace l'interprétation de
  `AUDIT_OMEGA §3`). *Fix : tester `gapNet > seuil` signé, pas `abs`.* **C'est le seul correctif
  evo nécessaire à la validité scientifique** — tout le reste des harnais est mesure-valide
  (cf. §4 Flux).

### 2.4 Suite Python dictée
- **🟠 B11 — `correcteur_probe.py` CASES (L226 ≡ L241) : cas de test dupliqué à l'identique.**
  `("On mange ensemble","On","Ont","on/ont")` deux fois → les « 24 témoins » = **23 distincts**,
  `on/ont` compté 5/5 dont une redite → gonfle artificiellement dénominateur et couverture.
- **🟡 B12 — builders qui écrasent un asset versionné sans garde.** `build_g2p_tables.py`,
  `build_morpho.py`, `build_p2g.py`, `build_g2p_corrections.py` **réécrivent** leur `.json` commité
  à chaque run (vérifié byte-identique aujourd'hui via `git status` propre, mais un env modifié —
  `P2G_MIN`, `MIN_SUPPORT`… — altère silencieusement un asset commité). De plus `decompose.py
  --demo/--read` et `decompose_corpus.py` (sans `--show`) **écrivent `learned_lex.json`** sans
  confirmation (« démo » présentée comme inoffensive a un effet de bord d'écriture). *Fix :
  `--dry-run` / message + ne pas persister depuis `--demo`.*
- **🟡 B13 — listes éditées-main non dédupliquées** : `correcteur_probe.py::COMMON_VERBS` (`vais`
  ×2), `MODAL` (`vais` ×2) — sans effet (set) mais signale une maintenance manuelle fragile.

### 2.5 omega-key (défauts de code vérifiables — *réserves crypto non certifiées*)
- **🟠 B14 — clé HMAC tout-à-zéro sur le chemin PBKDF2/BPUF (okey.js:1957 et :1865).**
  `deriveSharedKey` pose `_keyMaterial.hmac = new Uint8Array(32)` (**32 octets de zéros
  constants**) ; seul le chemin *seed* dérive une vraie clé HMAC (HKDF). Or `decryptMsg` active la
  « défense HMAC indépendante » dès que `hmac.length===32` (toujours vrai) et logue « HMAC vérifié
  (authentique) » → sur le mode AES-GCM standard d'une clé **passphrase** (le plus utilisé), ce HMAC
  est calculé avec une **clé publique connue (zéros)** : il **n'authentifie rien**. **Pas de fuite
  de confidentialité** (AES-GCM garde son tag GCM, sûr) mais l'affirmation « auth cryptographique
  distincte » est **fausse**. *Fix : dériver la clé HMAC par HKDF, ou retirer la couche trompeuse.*
- **🟡 B15 — relais : fenêtre `since` (omega-relay.ts:60-67).** Le curseur client avance à
  `data.now` (horloge serveur fixée **après** le scan KV) → un message POSTé concurremment pendant
  le scan peut être **perdu silencieusement** (`ts < since`). Rare, atténué TTL 1h + dédup `mid`.
  *Fix : recouvrement `since = now − marge`.*

---

## 3. CONFLITS

### 3.1 Doc ↔ code (dérive)
- **🟢 Dérive de lignes quantifiée et bénigne** : `orig = eng1.js + 1439`. **Tous** les findings de
  `AUDIT_OMEGA`/`AUDIT_STRUCTUREL` restent localisables ; aucun n'est devenu faux (sauf D2 ci-dessous).
- **🟡 C1 — `AUDIT_OMEGA §1.4/D2` OBSOLÈTE.** Le finding « `M1_m` co-décideur vif **non
  débranchable** à 0,1 » **ne tient plus** : le code courant garde la co-décision par
  `M5_D_M1_M_ENABLED` (**défaut `false`**, eng1.js:195/3592/3736 — décision `AUDIT_OMEGA §1.4.2`).
  Reste seulement un **assert cosmétique** figeant le poids à 0,1 (eng1.js:5998). → **mettre la doc
  à jour** (le « 0,0 baseline » périmé ET le « 0,1 non débranchable » périmé).
- **🟡 C2 — `ab_m1m.js` en-tête périmé** : « défaut ON / M1_m co-décide à 0,1 » alors que le build
  a `false`. La **mesure Δ reste correcte** (les deux bras sont posés explicitement), seule la
  description de la baseline ment.
- **🟠 C3 — `CORRECTEUR.md` headline « 22/24 » ≠ run par défaut du repo « 21/24 ».** Le 22/24 est le
  chemin *liste-blanche* ; avec `cgram_verbs.json` présent (cas par défaut, fichier commité), `vlike`
  bascule sur cgram → **21/24** (exactement ce que le bas du même doc explique : les homographes
  nom+verbe trompent `ce/se`). Cohérent mais le **headline induit en erreur**. *Fix : aligner le
  headline (« 21/24 cgram / 22/24 liste blanche »).*
- **🟡 C4 — `CONFIG_REFERENCE.md` « 39 toggles » vs 42 réels** (les 3 bleus cheat-free
  `M_NEO_PHON_COHORT`/`_JOINTE`/`M_NEO_OS_ARB` cités en prose, absents de l'énumération). Déjà noté
  `AUDIT_STRUCTUREL §4`, toujours vrai.
- **🟢 omega-key — aucune régression des durcissements** (doctrine CLAUDE.md respectée) : MD5
  conforme, sel 96 bits (`genSalt`), avertissement sel par défaut, anti-rejeu `_recvSeen`, écho par
  le chiffré émis (`_relaySent`) et non par `id`. Doc §3.4 cohérente (header 73 o).
- **🟢 Python — tous les chiffres docs reproduits au run réel** (cf. tableau §6).

### 3.2 Parité JS↔Python (livrable clé)
- **🟢 Levier grammaire porté fidèlement** : `governorNumber`/`governor_number` (skipPP),
  `isVerb`/`is_verb` (`VERB_FORMS`/`VERB_SUF`/`NOTVERB` identiques), `isParticiple`+`PART_FORMS`,
  `findAux`/`find_aux`, `governorGender`/`governor_gender` (`GEN_DET`), `findCodAntepose`,
  `stageOfFact`/`stage_of_fact` (`FAM2STAGE`), `norm`/`deacc`/`toks`, `accordType`, `align`
  (Levenshtein, même back-trace/tie-break) — **vérifiés constante par constante, identiques**.
- **🟠 C5 — `lexicalGender` : couverture divergente (eng2.js:1425 vs `diag_sentence.py:70`).** La
  version JS lit `GENDER_MAP` (**sous-ensemble haute-fréquence** embarqué `#vdc-lex`), le Python lit
  `cgram_gender.json` **complet (53 050 noms)**. → le diagnostic d'accord en **genre** « route
  lexicale » **décide moins** dans l'app que dans `diag_sentence.py` (diverge sur tout nom hors-HF).
  Cohérent avec l'embarqué HF mais **non signalé comme écart de parité**. *Fix : documenter la
  limite.* (Ordre des branches gauche/droite aussi légèrement différent, effet marginal.)
- **🟢 `rule_genre_adj` non branchée des deux côtés** (Python la définit mais ne la met pas dans
  `RULES`, « FP-insûr » ; JS ne la porte pas) → parité par omission cohérente. Divergence `'ça'`
  dans les sujets = **cosmétique sans effet** (`deacc('ça')='ca'` déjà présent dans les deux listes).

### 3.3 Logique / doctrine §3
- **🟠 C6 — Cascade declares « le dernier confiant écrase », ordre de priorité IMPLICITE
  (eng1.js:5725-5852).** 7 `if` séquentiels réassignent `proposed` sans garde inter-familles
  (WORD→BPC→DUAL→ÉMERGENT→NEO ; à l'intérieur de NEO, `_neoDone` ordonne recall>OS-arb>assemblé>muette).
  Mesuré **optimum** (`AUDIT_OMEGA §1.6`, chantier clos) donc conflit **assumé**, mais l'ordre reste
  purement textuel (hygiène : à rendre explicite).
- **🟠 C7 — §3 « croiser = jointe » : le scoreur cognitif empile des marginales.** `M5_d_step`
  superpose **7 enrichissements additifs/multiplicatifs** (IG, readout bPC, readout phon, phonGraph,
  M_S, position-aware, puis M1_m **multiplicatif**) — exactement le *pattern* que §3.1 déconseille,
  **au niveau lettre**. L'OS `M_OS_v07_step` fait un **mélange convexe** `(1−μ)·ortho+μ·phon`
  (arbitrage de routes DRC, *race model*, **légitime** — pas une marginalisation). La **vraie jointe**
  `Σ_φ P(φ|p)·P(lettre|φ,ctx)` n'existe que dans le **declare NEO** (`_neoCRS`, vérifiée correcte).
  → **conflit de vocabulaire assumé/documenté** (mémoire §6), pas un bug ; à garder cadré (l'OS
  *arbitre*, il ne *marginalise* pas).
- **🟢 Frontière cheat-free intacte.** `_cogProposed` figé **avant** les declares (eng1.js:5721) ;
  seule lecture du mot caché au montant = `wp.get(currentWord)` = **son** (régime « mot entendu »,
  encodé honnêtement orange/vert par le toggle `M_NEO_PHON_COHORT`) ; tout le reste gardé par
  `revealedMask`. Apprentissage = post-partie (`endCurrentGame`), mot complet légitime.

---

## 4. FLUX

### 4.1 Flux de décision du pendu (bout en bout, ancré)
1. **Perception** `omegaStep → cStep(currentWord, revealedMask)` → M1_d (révélé seul) → M2_d.
2. **Cognition** : M3_d (bPC : `M3_d.output=0`, écrit `cLetterScore`) → M_S (**skippé** sous bPC) →
   M4_d (cosine concept + fréquence-lettre) → M5_d (softmax). **Étage qui atteint réellement la
   lettre = M4_d + `cLetterScore` (couplage 0,20)** ; le reste (M_S, phonGraph, M1_m, position-aware)
   est gardé OFF/skippé en config de référence.
3. **Gel cheat-free** : `const _cogProposed = proposed` (eng1.js:5721), **avant** tout declare.
4. **Cascade declares** (override, *après* M5_d, *avant* `penduEvaluate`) : WORD→BPC→DUAL→ÉMERGENT→NEO.
   **C'est ici le saut +7 pts** (`AUDIT_OMEGA §S1`), pas dans le concept.
5. **Évaluation** `penduEvaluate(proposed)` (mute `revealedMask`/`alreadyTried`).
6. **Miroir PHASE 2** (descendant), **après** l'évaluation.
7. **Apprentissage descendant** `endCurrentGame` post-partie (banc `_emrgBank`, g2p `learnExp`,
   `_neoCR`/`_neoCRS` via `wp.get` — mot complet légitime).

- **🟠 F1 — M2_d entièrement court-circuité sous bPC (config de référence).** Le chemin bPC encode
  depuis `M1_d.output` (`// encoder depuis M1 riche, pas M2 lave`) → tout le « chapeau mexicain » de
  `M2_d_step` (décodage zones + excitation/inhibition + EMA + re-encodage + normalize + publish D2,
  ~75 l.) est **recalculé chaque tick sans nourrir aucune décision**. Étend `AUDIT_OMEGA §S2` :
  M2_d n'est pas seulement *lessivé*, il est **débranché** du scoring en config réf. Impact : perf
  (cycles brûlés), baseline-chiffre inchangée.
- **F2 — Cascade descendante = ordre d'appel, PAS flux de données.** `M1_m_step` ne lit que
  `M4_m` + `M5_m`, **jamais** `M3_m` (concept) ni `M2_m` (position) → le concept **n'atteint jamais
  la décision-lettre par le miroir**. Aucun étage descendant n'atteint la décision en config défaut
  (`M5_D_M1_M_ENABLED=false`). Confirme `AUDIT_OMEGA §1.4`.
- **F3 — Voie phon** : montante arbitrée par OS ; descendante `M4_phon_m` **effectif** (lu par
  M4_phon ascendant), `M3_phon_m` **observationnel**, `M2_phon_m`/`M1_phon_m` **dormants** (écrits,
  **jamais lus**). Confirme `AUDIT_STRUCTUREL §V2`.

### 4.2 Flux des panneaux app (étanchéité)
- **🟢 eng2 (dictée+correcteur) totalement découplé** du moteur : aucune référence à
  `currentWord`/`OMEGA_LEX4`/`omegaStep`/`M3_d` (sauf le mot dans un commentaire). localStorage
  strictement `vdd_*`/`vdc_*`/`vdk_*`, **sans collision**. R67 respecté.
- **🟠 F4 — eng3 (Décompose) lit 2 globals du moteur** : `_DECL2.g2p()` et `OMEGA_LEX4.words`. C'est
  **lecture seule**, feature-detecté (`if(typeof _DECL2==='undefined')return;` → inerte sans moteur),
  n'altère jamais l'état moteur → **conforme R66/R67 dans l'esprit**, mais la consigne « ne référencer
  aucun global moteur » est **techniquement violée par eng3** (par design documenté). À acter : eng3
  est *couplé en lecture*, eng2 *totalement découplé*.

### 4.3 Pipeline de données Python
```
Lexique4.tsv (HORS-REPO /tmp/lex4) ──build_cgram──► cgram_{verbs,gender,adj,hf}.json
app/omega-pendu.html ──build_g2p_tables──► g2p_tables.json ; ──build_morpho──► morpho.json
phono_homophones.json ──[inversion W2P]──► route lexicale du SON
   inlex_split(seed=42, 0.8/0.2) ──► TRAIN(91 218) ⟂ TEST(22 805)   [overlap=0 VÉRIFIÉ]
       TRAIN ──build_g2p_corrections──► g2p_corrections.json (667 règles)
       TRAIN ──build_p2g──────────────► p2g_table.json
       TEST[:4000] ──decompose/p2g --measure──► chiffres HELD-OUT
   diag_sentence (cœur) ◄ correcteur_probe ◄ eval_externe (corpus_externe disjoint)
   descending_probe (genre) ;  decompose ──learn──► learned_lex.json (NON versionné, FP=0)
```
- **🟢 Étanchéité train/test confirmée mesurée** (overlap=0, même seed=42 partout, tables apprises
  sur TRAIN et mesurées sur TEST). **Pas de fuite.**
- **🟢 JSON requis** = `g2p_tables.json` (exit si absent) ; **tout le reste a un repli inerte**
  (`correcteur`→liste blanche, `diag`→déterminant seul). **Boucle descendante FP-safe** (`lex`
  jamais écrasé par `sublex`, gardé par `test_decompose`).

### 4.4 Flux omega-key
`chatSend → window.encryptMsg (DR/FS/std) → relaySend POST → KV (expireIn 1h) → relayPoll GET
?since → anti-rejeu _recvSeen → window.decryptMsg → bulle _esc()`. **🟢 La bulle est échappée**
(`_esc`, contexte texte → pas d'XSS pair-malveillant). **Fuite de clair** = `localStorage
omega_key_chat_v1` (fil en clair, **documenté** §7) ; le relais ne voit **que** du chiffré.

---

## 5. ARCHITECTURE

- **🟠 A1 — Le concept M3_d est un latent de FORME/longueur** ; sa seule porte vers la décision est
  le **readout `cLetterScore`** (`reward·a`, +3,4 cheat-free mesuré). La « cascade descendante »
  M5_m→…→M1_m est un **ordre d'appel, pas un flux** (F2). Confirme `AUDIT_OMEGA §S2/§3.1/§1.4.1`.
- **🟠 A2 — Bloc d'instrumentation A/B ~230 l. dans le hot-path `M3_d_step` (eng1.js:2944-3173).**
  7 « bras », AUC online, burn-in 1000, ~40 accumulateurs ; **pure mesure** (ne pilote aucune
  décision) mais **exécutée chaque tick** si `M_PHON_READOUT_AB` ON (dont un bras `lookupLex4Word`).
  `M3_d_step` ≈ **490 lignes** mêle 3 responsabilités (concept bPC + readout phon + banc A/B). `§V3`.
- **🟠 A3 — Surcharge combinatoire `M5_d_step`** : 7 sources d'enrichissement gardées chacune par un
  toggle + re-tris conditionnels ; **47+ flags** ; peu de présets réellement mesurés (`§S5`).
- **🟠 A4 — « Baseline » = agrégat historique (`§D3`).** ~9 modules **ON jamais re-tranchés par
  mesure** : `M4_M_HOMEO_V2`, `M4_M_CONTEXTUAL`, `M4_M_OS_MOD`, `OS_SLEEP_DECAY`, `OS_GAP_RELATIVE`,
  `M_S`, `F75_DAMASIO`, `M5_D_PHONGRAPH`, `M4_PHON_USE_P` — plusieurs avec doc interne admettant un
  effet **nul/non mesuré** (F75, OS_sleep_decay). Pureté §1.6, pas les chiffres.
- **🟠 A5 — `_OSL` forward-ref ~5 600 lignes (usage eng1.js:2363, déclaration `var` eng1.js:7968).**
  `TypeError` latent si l'online est activé pendant l'init top-level (masqué par le gate OFF). `§G3`.
- **🟡 A6 — `OS.step` couplage caché + branche `relax` morte.** Lit 6+ modules par sondes
  `typeof X!=='undefined'` (dépend de l'ordre d'allocation) ; `relax` (slope<−0,001) **jamais
  déclenché** (slope ∈ [0 ; 0,004]). F203/F204 = correctifs empilés sur un signal reconnu inutile. `§G2`.
- **🟡 A7 — Projection LDIM→SDIM bijective (eng1.js:3206) : permutation déterministe = gain d'info
  nul** (`gcd(433,512)=1`, commentaire R42-#9 honnête). Dette doctrinale (chemin Hebbian OFF en réf.).
- **🟡 A8 — Code mort / dormant** : `pairConv` « transitoire, retiré Jour 6' » jamais retiré ;
  `M2_phon_m`/`M1_phon_m` dormants ; `bpcW_phon`/`_m2hat` alloués inconditionnellement (cross-modal
  OFF/falsifié) ; constantes `REVEAL_LETTERS/GAMES_PER_CONDITION/…` (`[OUVERT R59]`) ; WebRTC
  omega-key (~220 l. mortes pour le chat). `eSleepReplay` déjà supprimée (`§V1` résolu).
- **🟡 A9 — Duplication** : `esc`/`$` 3× (dont B1) ; **boucle de jeu réimplémentée ×5** (`§V5`,
  `ALLOWED_TOGGLES` lui est désormais 1 const) ; **harnais evo : `pickSets`/`CFG`/`runCond` recopiés
  8-10×** → **surface d'erreur n°1 pour de FUTURS chiffres** (une dérive du moteur doit être patchée
  10×). `fitness_harness.js` devrait exporter `pickSets/resetAndInit/applyRefConfig` factorisés.
- **🟡 A10 — `eval(name+' = '+val)` pour les toggles (`§G1`)** : **non exploitable** (whitelist
  `ALLOWED_TOGGLES` avant tout `eval`, valeur = booléen), anti-pattern **forcé** par l'absence de
  namespace (~500 globaux top-level). Réparable par une `Map<string,{get,set}>`.
- **🟢 Sain (vérifié)** : RNG seedable propre (`makeMulberry32`, reseed avant init → `bpcW`
  déterministe) ; finitude *fail-loud* généralisée (sauf B5) ; IIFE dictée étanche (`§I1`) ;
  `_neoDeclareOSmix` save/restore α=β=1 (découplé du θ lecture) ; discipline OFF-inerte
  structurellement crédible ; CC BY-SA présent 3× ; **réutilisation §A2 réelle** côté Python
  (imports, pas de copies) ; `test_decompose.py` garde asserts + seuils held-out (régression).

---

## 6. Vérification : chiffres docs vs runs réels (reproductibilité)

| Mesure | Doc | Run réel | Verdict |
|---|---|---|---|
| diag familles / surface | 100 % / 17/17 | 100 % / 17/17 | 🟢 |
| diag gouverneur / sujet-verbe | 84 % / 94 % | 138/164 / 31/33 | 🟢 |
| correcteur in-corpus | 22/24 (liste blanche) | **21/24** (cgram, défaut repo) | 🟠 headline (C3) |
| correcteur FP / held-out | 0 / 12/15 | 0/24 / 12/15, FP 0 | 🟢 |
| decompose sublexical held-out | 52,4 % / 89,5 % | 52,35 % / 89,49 % | 🟢 |
| p2g top-1/3/5 | 26,7 / 64,1 / 73,2 | 26,7 / 64,1 / 73,2 | 🟢 |
| descending genre / FP | 100 % / 0 | 26/26 / 0 | 🟢 |
| compress factorisé | 17× | 17,0× | 🟢 |
| test_decompose | 21 asserts | 21 asserts OK | 🟢 |
| harnais evo (13) | — | **tous EXIT 0** | 🟢 |
| omega-key MD5 / durcissements | v0.17 | conformes | 🟢 |

---

## 7. CI & régression
- **🟠 CI1 — `ci.yml` ne garde PAS le moteur.** 13 étapes Python dictée + 2 vérifs de syntaxe des
  blocs app, mais **aucun harnais Node seedé n'assert le winrate** (cognition ≥ 90 % / +NEO ≥ 97 %).
  C'est le **« risque #1 »** (`AUDIT_STRUCTUREL §S3`, reco #8) — **toujours ouvert** : une régression
  silencieuse du scoreur passerait la CI. *Fix : un smoke `node` qui assert 2-3 chiffres clés.*
- 🟢 `.gitignore` correct (`learned_lex.json` ignoré, absent). `test_decompose.py` garde la
  régression Python (asserts + seuils).

---

## 8. Priorisation (impact × effort) — tout falsifiable, baseline OFF-inerte préservée

| # | Action | Sévérité | Effort |
|---|---|---|---|
| 1 | **Accessibilité dys** : `aria-live` sur `#vdd-fb`/`#vdc-out`/`#vdk-prev` + `tabindex`/`role`/`keydown` sur `.vdc-bad` | 🔴 | moyen |
| 2 | **`esc` unique 5-car.** (dédupliquer, restaurer `'`) + **feature-detect `speechSynthesis`** avec repli | 🟠 | faible |
| 3 | **`diag_bpc.js:73`** : verdict signé (pas `abs`) — *validité scientifique* | 🟠 | trivial |
| 4 | **bPC fail-loud** : garde finitude `cLetterScore` ✅ **fait** (fix #4) · borner `bpcW` = **falsifié par mesure** (ne diverge pas — B6) → abandonné | 🟢 | — |
| 5 | **Bench trexquant R67** : restore en `finally` + figer `M_LEARN_FROM_COGNITION` ; `_trexq_restore` : `ui_log` + ne nuller `_trexqRemoved` qu'après réinsertion | 🟠 | faible |
| 6 | **omega-key HMAC** : vraie clé HKDF sur PBKDF2/BPUF, ou retirer la couche trompeuse | 🟠 | faible |
| 7 | **Docs** : D2 obsolète (M1_m débranché), headline `22/24→21/24`, `lexicalGender` HF≠cgram, `CONFIG_REFERENCE` 39→42 | 🟠 | faible |
| 8 | **CI anti-régression moteur** ✅ **fait** (`evo/ci_smoke.js` : assert cognition ≥ 84 / +NEO ≥ 93, dans `ci.yml`) | 🟢 | — |
| 9 | **Builders Python** : `--dry-run`/garde ; `decompose.py` corriger le cas dupliqué + démo non-persistante | 🟡 | faible |
| 10 | **Hygiène** : retirer `pairConv`/dormants/code mort ; factoriser le protocole `evo/` ; `eval`→Map ; expliciter l'ordre de cascade | 🟡 | moyen |

> Aucune de ces actions n'est requise pour la **correction du moteur** (baseline OFF-inerte
> intacte) sauf #1 (inclusivité) et #4/#5 (robustesse sous activation). Les autres servent la
> maintenabilité, la pureté doctrinale, l'inclusivité et la **validité des mesures futures**.
> **Audit en lecture seule — aucun fichier de production modifié.**
