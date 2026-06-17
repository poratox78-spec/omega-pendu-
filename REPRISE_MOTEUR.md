# REPRISE — chantiers moteur OMEGA-Ω (handoff pour une nouvelle conversation)

> But de ce document : qu'une **nouvelle session** reprenne le **moteur cognitif** (`app/omega-pendu.html`)
> sans repartir de zéro ni refaire des impasses déjà mesurées. Daté **2026-06-17**, branche
> `claude/stoic-knuth-5mt7sr` (PR #6). Le chantier dictée et le dossier Lexique 4 sont **hors scope ici**
> (voir `dictee/` et `dossier-lexique4/`).

---

## 0. À FAIRE EN PREMIER (non négociable)

1. **Lire `DOCTRINE.md` INTÉGRALEMENT** (pas en diagonale). C'est la loi du projet. Points qui régissent tout :
   §0 clause de service cognitif (la performance est un indicateur, pas une fin) · §1 falsifiabilité/mesure
   (déterminisme seedé, in-lexique ET OOV **séparés**, non-reproductible = nul) · §3 **croiser = jointe**
   `Σ_φ P(φ|p)·P(lettre|φ,contexte)` (jamais somme/produit/argmax) · §4.1 **une jonction à la fois** ·
   §4.4 l'humain juge la direction · §5 **anti-fainéantise** (inventaire + réutiliser l'existant, lire avant de coder) ·
   §6 audit honnête (défaut = pas terminé ; preuve = sortie réelle + mesure, pas description) · R66 (OFF-inerte,
   débranchable) · R67 (diagnostic en lecture seule).
2. **Lire en entier** : `docs/MEMOIRE.html`, `docs/rapport-mode-emploi.html` (§4 OS `w(r)`, §6 croiser, §8.3 config,
   §12 état/limites, §17 declares NEO), `AUDIT_OMEGA.md` (audit cognitif), `AUDIT_STRUCTUREL.md` (audit code intégral),
   `docs/CONFIG_REFERENCE.md`. « J'ai tout lu » doit être **vrai et vérifiable (cite les §)**.
3. **Cadre cap §43** : la voie **montante** décide en **révélé seul** ; la voie **descendante** apprend
   **après** la partie (mot complet légitime). Lire `currentWord` au-delà du révélé **dans le montant** = triche.

---

## 1. État actuel (ce qui est FAIT — ne pas redéfaire)

- **Dossier Lexique 4 / C. Pallier** : courrier + mémoire + rapport + app + NOTICE → `dossier-lexique4/` + zip envoyé.
- **Audit structurel intégral** du fichier (hors lexique) : `AUDIT_STRUCTUREL.md` (1 🔴 · 8 🟠 · 11 🟡 · 11 🟢).
- **Têtes d'affiche corrigées** : XSS dictée (échappement saisie élève) · catch muets `_trexq_*` (log) ·
  `_omega_trexquant_bench` restaure l'état (R67) · désync `M_BPC_DECLARE_CONF` (0,60→0,95) · `eSleepReplay` morte supprimée ·
  accessibilité des 38 toggles (role/aria/clavier — cible dys) · CSS `.status-pill`/`.meta` restauré ·
  `ALLOWED_TOGGLES` dédupliquée · **bouton « ⚙️ Config optimale »** (preset cheat-free 1-clic, le boot reste OFF-inerte).
- **Doctrine §3 (#1) assumée** : le scoreur cognitif **arbitre des routes** (OS = mélange convexe ; M5_d = enrichissements
  additifs/multiplicatifs) ; la **vraie jointe `Σ_φ` n'existe que dans le declare NEO** (et y est correcte). Documenté mémoire §6.

### ⚠️ DÉJÀ FALSIFIÉ — NE PAS REFAIRE (mesuré, consigné)
| Piste | Résultat | Source |
|---|---|---|
| M3_d comme magasin épisodique (banc) ×2 | net-négatif ; mur de capacité 12 cellules (AUC 0,64) | MEMOIRE §8.1, rapport §12 |
| Croisement cross-modal au concept M3_d (`M_BPC_CROSSMODAL`) | **−3,0** (contamine le concept) | AUDIT_OMEGA §1.4 |
| Morpho distance-de-fin / backoff dense | −1,0 / +0,3 (bruit) | AUDIT_OMEGA §1.2 |
| Jointe **au niveau mot** (produit Σ_p) | −2,3 (compose le bruit) | AUDIT_OMEGA §1.5 |
| Fréquence croisée **au phonème** | −4,3 (la fréquence est un signal de mot) | AUDIT_OMEGA §1.5 |
| Arbitrage OS au declare — balayage **(α,β)** | **ne bat pas DUAL** (neutre 96,8 < DUAL 97,3 ; biais lexical dégrade) → **CLOS** | AUDIT_OMEGA §1.6 (17/06) |
| Apprendre θ / trigger en ligne par winrate (SPSA) | gradient **plat** (effet sous le quantum) | MEMOIRE §8.3, rapport §17.6 |

> **Conséquence** : le résidu cheat-free (~2-3 pts sous le « mot entendu ») vit dans l'**ambiguïté de la cohorte**
> (mots durs), **pas** dans la table phon→lettre ni dans le petit latent M3_d. Tout nouveau levier doit en tenir compte.

---

## 2. Le cadre — deux axes orthogonaux (à ne JAMAIS confondre)

- **Axe 1 — double ROUTE de lecture (DRC, Coltheart 2001)** : voie **orthographique** (`M*_d`) ∥ voie **phonologique**
  (`M*_phon`, SAMPA depuis `w.p`), arbitrées par l'**OS** `w(r) = −r/(1+r)`, `μ = r^α/(β+r^α)` (`r` = force phon/ortho).
  θ appris **réglé lecture** (α≈1,13, β≈0,65).
- **Axe 2 — double BOUCLE par voie (Möbius L01)** : **ascendante** (perçoit→décide, révélé seul) et **descendante /
  miroir** (résultat→apprend, mot complet post-partie). Ortho : miroir **complet** (5 étages). Phon : miroir **tronqué**.
- **Substrat HDC** : hyperdimensionnel (HRR/VSA, Plate 1995 ; Kanerva 2009), **concept 1024D (SDIM)** / **lexical 512D (LDIM)**.
- **Le moteur réel** (audit) : scoreur cognitif **modeste** (~90 %) + **forte cascade de declares** (+7 pts → 97,5 %).
  La force pendu = **phon→ortho** (épellation, declare assemblé). La voie phon **cognition** = **ortho→phon** (lecture).

---

## 3. NOUVEAUX OBJECTIFS (chantiers ouverts) — bien expliqués

> Règle commune : **OFF-inerte** (défaut OFF, baseline byte-identique) · **mesurer K=1, in-lex ET OOV séparés,
> ≥4 graines** · **barrière de mérite §6.4** (gardé seulement s'il bat la baseline à chaque graine) · **une jonction
> à la fois** · harnais prêt : `evo/ab_cohort.js` (+ `evo/fitness_harness.js` `loadEngine`/`evalIn`).

### 3.1 — Les **vraies** doubles voies DRC (axe 1, niveau cognition)
**Contexte.** L'arbitrage des *declares* (niveau mot) est **clos** (§1.6 : OS-arb ne bat pas DUAL). Ce qui **reste
ouvert** est l'axe 1 au **niveau cognition** : aujourd'hui l'OS combine ortho⟷phon par **mélange convexe scalaire**
(`out = (1−μ)·ortho + μ·phon`), **pas** une intégration interactive type DRC (activation relative, compétition).
De plus la voie phon cognition n'a qu'**un sens** (ortho→phon, lecture) ; la direction phon→ortho ne vit que dans le declare.
**Hypothèse falsifiable.** Une intégration DRC plus fidèle (compétition/feedback entre routes au niveau lettre, ou une
route phon→ortho **cognitive** distincte du declare) réduit-elle les défaites phon (signature voisée/sourde 58 %) ?
**Garde-fous** : forme `w(r)` = design non dérivé (rapport §4) ; **conflit de sens des voies** (un arbitrage hérité du
θ de *lecture* appliqué à une décision *épellation* = biais — cf. §1.6) ; mesurer in-lex **et** OOV (c'est en OOV que
la sublexicale doit porter). **Prérequis lecture** : MEMOIRE §4/§11.2, rapport §4/§11.2, AUDIT_OMEGA §0/§1.6.

### 3.2 — **M3_d** : prédiction masquée (la piste réservée « du début de conversation »)
**Contexte.** Le concept (12 cellules, bPC) est **structurellement un détecteur de longueur** : entraîné par
**reconstruction** (objectif génératif) sur une entrée **dominée par la longueur** → readout-reward sans signal
discriminant → contribution plate (AUDIT_OMEGA §S2, §3). En mode bPC sa sortie est même **zéroée** (découplée du scoring).
**Hypothèse falsifiable (neuve, ≠ essais passés).** Remplacer l'objectif de reconstruction par une **prédiction masquée
self-supervised** : entraîner les 12 cellules à **prédire la lettre d'une position révélée à partir des AUTRES positions
révélées** (révélé→révélé = montant-légal, cheat-free). Pression discriminative **alignée sur la tâche** ; le goulot
devrait encoder la co-occurrence lettre/phonotactique (≈ la « couche morphologique » de MEMOIRE §10).
**Protocole R66** (contrôle = `M3_D_BYPASS` **existant**) : (1) AUC présent/absent de `cLetterScore` actuel = baseline ;
(2) ré-entraîner masked-prediction, re-mesurer l'AUC ; (3) si AUC ↑ **et** couplage utile en config pleine → M3_d devient
contributeur ; si AUC plat → **mur 12 cellules confirmé, on clôt** (la familiarité reste dans le banc). **Soit ça marche,
soit ça ferme l'incertitude par la mesure.** **Prérequis** : AUDIT_OMEGA §2 (S2)/§3, MEMOIRE §8.1, rapport §12.
**Ne pas refaire** : loger le banc épisodique dans M3_d (falsifié ×2) ; croiser au concept (cross-modal −3,0).

### 3.3 — Le miroir **P2 / Möbius** largement débranché (axe 2)
**Contexte.** Le cercle **miroir descendant** est conçu (P1 direct, P2 miroir) mais **P2 et les modules miroir étendus
sont débranchés** (rapport §4.1/§12). Côté phon, le miroir est **tronqué** : l'audit a montré que `M2_phon_m_step` /
`M1_phon_m_step` **sont appelés mais leurs sorties (`zonePenalty`/`letterScore`) n'ont AUCUN consommateur**
(AUDIT_STRUCTUREL §V2) — « branchement consommateur viendra en étape B », jamais venue. `M3_phon_m_step` est observationnel.
**Hypothèse falsifiable.** Brancher **progressivement** le miroir descendant (d'abord brancher un consommateur réel des
sorties phon mortes ; ou activer un étage P2) **apporte-t-il** un gain mesuré — **après** avoir vérifié l'**inertie OFF**
(byte-identique éteint) ? **Garde-fous** : c'est de l'**apprentissage** (descendant) — légitime post-partie ; ne pas le
laisser piloter la décision montante ; une jonction à la fois (un étage à la fois). **Prérequis** : MEMOIRE §10 (« P2/Möbius »),
rapport §4.1/§5.2/§12, AUDIT_STRUCTUREL §2.6 (V2) + §S4. **Réconcilier la doc** : §S4 dit « M2/M1_phon_m jamais construits » —
**faux**, ils existent et sont appelés (sorties mortes) ; corriger en « câblés-mais-sans-consommateur ».

### 3.4 — Le **substrat HDC** (réglages héréditaires)
**Contexte (MEMOIRE §10 + rapport §12 + audit).** Deux dettes structurelles du substrat :
- **Hebbian non borné** : `α_Hebb/α_decay = 8` → la norme de `M3_d.output` dérive (point fixe ~8), rustines de
  normalisation. **Borner** et mesurer la stabilité de la norme sur 2000 parties.
- **Projection LDIM→SDIM bijective** : l'« expansion » hash `tile+mirror` est une **permutation bijective déterministe**
  → **gain d'information nul** (AUDIT_STRUCTUREL §V4, rapport §12, R42-#9). Tester une **random projection**
  (Achlioptas 2003) vs le retrait, mesurer le gain d'info réel.
**Hypothèse falsifiable.** Borner le Hebbian / corriger la projection **améliore-t-il** la discriminabilité du concept
(donc 3.2) sans régresser la baseline ? **Garde-fous** : ces réglages touchent le hot-path → OFF-inerte + A/B strict ;
lié à 3.2 (un substrat sain est un prérequis d'un M3_d utile). **Prérequis** : MEMOIRE §4.1/§10, rapport §5.3/§12.

---

## 4. Ordre recommandé & dépendances

1. **3.2 (M3_d masked-prediction)** — le plus **falsifiable et borné** (contrôle `M3_D_BYPASS` + AUC). Verdict binaire :
   contributeur, ou on clôt. **Commencer par là.**
2. **3.4 (substrat HDC)** — prérequis qualité de 3.2 (un concept sur un substrat sain). Peut se mener en parallèle conceptuel
   mais **mesurer séparément** (une jonction à la fois).
3. **3.3 (miroir P2)** — gros effort, gain incertain ; brancher **un étage** à la fois, inertie OFF d'abord.
4. **3.1 (DRC cognition)** — le plus ambitieux/diffus ; cadrer une hypothèse **étroite et mesurable** avant de toucher au
   hot-path (sinon on casse la baseline). **Arbitrage humain requis sur la direction (§4.4).**

---

## 5. Outils, repères, conventions

- **Config optimale cheat-free** : bouton **« ⚙️ Config optimale »** dans l'app (preset §8.3), ou `docs/CONFIG_REFERENCE.md`
  (23 ON). Au boot tout est OFF (~2,6 %). Régime mesuré : **97,5 % (K=1) / 98,8 % (K=3)** in-lexique ;
  **~97,3 %** « sans currentWord » (cohorte board + jointe) ; OOV phon→ortho ~70 %, ortho pur ~22 %.
- **Harnais déterministe** : `node evo/ab_cohort.js <mode> 200 100 12345,777,2024,99`
  (modes : `inlex`/`oov`/`dual`/`dualncw`/`xmodal`/`arb`/`arbsweep`). Le pont `evalIn` dans `evo/fitness_harness.js`
  lit/écrit les toggles `let` **par référence** (baseline non modifiée). Bench embarqué : bouton « 🎯 Trexquant ».
- **Falsification M3_d** : toggle `M3_D_BYPASS_ENABLED` (existe) coupe le concept (cLetterScore=0 + output→null vers M_S).
- **⚠️ Numéros de ligne** : **non fiables** (AUDIT_OMEGA a dérivé +50/+120, et les éditions récentes ont décalé encore).
  **Référencer par NOM de fonction** et `grep`, pas par ligne. Fonctions clés : `omegaStep`, `cStep`, `M3_d_step`,
  `M_OS_v07_step`, `_neoDeclareOSmix`, `_DECL2.declare`, `endCurrentGame`, `omega_voiePhon_OS_tick`, `M*_phon_m_step`,
  `applyReferenceConfig`, `ui_toggle`/`ui_initToggles` (`ALLOWED_TOGGLES`).
- **Discipline d'édition** : ne jamais éditer la **ligne 724** (lexique base64 ~5 Mo) ; vérifier la syntaxe en extrayant les
  2 blocs `<script>` moteur et `node --check`. Commit/push systématique (mémoire durable — la session cloud subit des rollbacks).
- **Git** : dépôt `poratox78-spec/omega-pendu-`, branche `claude/stoic-knuth-5mt7sr`, PR #6 (draft).

---

## 6. En une phrase
Le declare cheat-free et son arbitrage sont **clos par la mesure** ; les chantiers ouverts sont **cognitifs et structurels** —
rendre **M3_d discriminant** (prédiction masquée, 3.2), **assainir le substrat HDC** (3.4), **brancher le miroir P2**
(3.3), et n'aborder la **DRC interactive cognition** (3.1) qu'avec une hypothèse étroite et mesurée. Mesurer avant de croire,
falsifier avant de garder, une jonction à la fois.
