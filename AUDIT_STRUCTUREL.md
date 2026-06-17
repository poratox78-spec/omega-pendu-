# Audit structurel profond — `app/omega-pendu.html` (hors lexique) — 2026-06-17

Audit **structurel intégral** du fichier monolithe (le moteur), **lexique exclu** (la ligne 724 = bloc
`<script type="text/plain" id="lex4-data-gz">`, ~5 Mo base64, jamais lue). Méthode : lecture réelle du
code en **6 régions** auditées en parallèle, chacune sur la grille DOCTRINE (§1 falsifiabilité/asserts/OFF,
§1.7 pas de try/catch muet, §3 jointe, §3.4 cheat-free, R66/R67). Complète et approfondit `AUDIT_OMEGA.md`
(audit cognitif) ; **lecture seule — aucune modification du moteur.**

> Convention sévérité : 🔴 à corriger · 🟠 important · 🟡 dette/hygiène · 🟢 sain (vérifié).
> Rappel cadrage : un défaut sur un module **OFF par défaut** n'affecte pas la **baseline mesurée** (byte-identique
> au repos) — il pèse sur la maintenabilité, la lisibilité ou la pureté doctrinale, pas sur les chiffres.

---

## 0. Topographie du fichier (11 330 lignes)

| Région | Lignes | Contenu |
|---|---|---|
| `<style>` | 10–718 | feuille de style (708 l.) |
| HTML `<body>` / UI | 726–1425 | header, 3 panneaux instrument, **38 toggles**, panneau dictée, debug legacy |
| **LEXIQUE (EXCLU)** | **724** | 1 ligne base64 gzip ~5 Mo |
| **Moteur — script 1** | 1426–9958 | substrat HRR, voies ortho/phon, OS, M1–M5, miroirs, M_S, declares, apprentissage, benches, dictée lexicale, **système de toggles UI** |
| **Moteur — script 2** | 9960–11327 | **IIFE dictée diagnostique** « ✍️ Dictée diag » (30 phrases + portage JS de `diag_sentence.py` + UI/localStorage) |

**Volumétrie code** : ~10 k lignes JS. Script 1 = **~500 symboles globaux top-level** (179 `let`, 141 `const`,
2 `var`, 174 `function`) dans le scope global de la page (aucune encapsulation). Script 2 = **tout encapsulé en IIFE**.

---

## 1. Synthèse exécutive

**Bilan** : le moteur est **structurellement sain sur ses garde-fous** (OFF-inerte réel — les flags gardent des
*blocs*, pas des *sorties* ; asserts de finitude *fail-loud* ; déterminisme seedé du moteur de jeu ; frontière
montant/descendant propre ; montant cheat-free ; licence CC BY-SA présente). Les défauts sont **doctrinaux** (le
scoreur cognitif ne croise pas par *jointe* ; la « baseline » inclut des modules jamais re-tranchés par mesure),
**de surface** (tissu cicatriciel / code mort « Jour 6' » jamais retiré, ~500 globaux, `eval` pour les toggles),
et **un vrai bug de sécurité local** dans la dictée (XSS DOM via saisie élève).

Décompte : **1 🔴 · 8 🟠 · 11 🟡 · 11 🟢**. Aucun défaut ne touche la baseline mesurée (tous OFF-inerte au repos),
**sauf** la lecture du son du mot (régime « mot entendu », déjà documenté) et la désync d'un défaut UI.

> **MAJ 2026-06-17 — corrigés** (commits sur `claude/stoic-knuth-5mt7sr`, moteur de décision byte-identique) :
> **🔴 S1** XSS dictée (échappement saisie élève) · **🟠 E1/R1/U1** catch muets + restauration trexquant (R67) + désync `bpc-declare-conf` · **#1** jointe documentée/assumée (mémoire §6) · **#2** arbitrage OS-arb (α,β) mesuré → **clos** (cascade+DUAL = optimum) · **🟡 V1** `eSleepReplay` supprimée · **🟡 U2** accessibilité des 38 toggles (role/tabindex/aria-checked/clavier) · **🟡 U3** CSS `.status-pill`/`.meta` restauré (contrastes sous-AA **restent** à traiter) · **🟡 V5** `ALLOWED_TOGGLES` dédupliquée (1 constante ; la boucle de jeu ×5 **reste**).
> **Différés (refontes mesurées / risquées)** : `pairConv` (entrelacé OS.step + asserts + métriques → refonte mesurée), `eval`→Map (dispatcher critique, déjà whitelisté), projection SDIM bijective (hot-path M3_d, à mesurer), factorisation boucle de jeu ×5 (outils de mesure), trancher modules socle ON (§D3, à mesurer), renumérotation lignes AUDIT_OMEGA, CI anti-régression.

---

## 2. Findings consolidés (par thème)

### 2.1 Sécurité

**🔴 S1 — XSS DOM : saisie élève réinjectée en `innerHTML` non échappée.** `diagnoseSentence` construit
`msg:'« '+s+' » → …'` avec `s` = token brut tapé par l'élève (L11283), puis `check()` fait
`$('vdd-fb').innerHTML = html` (L11319) sans escaping. Un élève (ou un copier-coller) qui saisit
`<img src=x onerror=…>` exécute du JS. Surface **locale** (pas de backend, pas d'exfiltration directe), mais
pour un outil destiné à des élèves **dys** potentiellement partagé, c'est le défaut le plus concret. *Fix :*
échapper (`textContent` ou entités) la saisie avant injection. Mêmes `innerHTML` interpolant des **données
lexique** (8540/8594/8708 : `w.p`, `w.m`) = risque faible (données embarquées contrôlées) mais à assainir aussi.

### 2.2 Doctrine §3 — croiser = jointe

**🟠 D1 — Le scoreur cognitif combine des marginales, pas une jointe.** L'OS arbitre par **mélange convexe
scalaire** `out[l] = (1−μ)·ortho[l] + μ·phon[l]`, `μ=r^α/(β+r^α)` (L3785) — c'est un arbitrage de **routes**
DRC (axe 1, *race model*), légitime comme tel, **mais pas** la marginalisation `Σ_φ P(φ|p)·P(lettre|φ,ctx)`
de §3.2. M5_d empile en plus **5 enrichissements additifs/multiplicatifs** re-triés séparément (phonScore L5066,
M_S L5091, P1 L5132, IG L4901, readout couplé L4924, puis modulation **multiplicative** M1_m L5160) — exactement
le *pattern* « sommer/multiplier des marginales » que §3.1 déconseille, **au niveau lettre**. **→ Documenté/assumé (17/06)** : mémoire §6 clarifie que la jointe `Σ_φ` est un mécanisme **délibéré du declare** (où elle paie), le scoreur cognitif étant un **arbitrage de routes** (légitime) ; une jointe *dans* la cognition (concept M3_d) a été **falsifiée** (−3,0). *À assumer* (cohérent
AUDIT_OMEGA §S1 « scoreur cognitif modeste ») : la doctrine §3 n'est pleinement honorée **que** dans le declare NEO.

**🟢 D2 — La jointe per-lettre du declare NEO est correcte (§3.2).** Bloc assemblée/muette (L7291–7300, 7309–7326) :
`_sc[x] += _w·(_cj[x]/_sj)` avec `_w = Pcoh(φ|p)`, sur la table sonore `_neoCRS` (backoff voisins révélés),
backoff `L2` marginal — **vraie marginalisation sur le latent φ, pas argmax**. `_DECL2.declare` (DUAL) fait un
**produit de marginales niveau mot** `log f + wO·ortho + wP·phon` (L6321) = modèle de mot naïf-Bayes
(cohort-model), pas un croisement per-lettre → conforme à la doctrine telle qu'arbitrée (§1.5).

### 2.3 Doctrine §1.6 — défaut OFF / la « baseline »

**🟠 D3 — La « baseline » inclut ~8 modules socle ON par défaut, jamais re-tranchés par mesure.** Sont **ON** à la
déclaration : `M4_M_HOMEO_V2`, `M4_M_CONTEXTUAL`, `M4_M_OS_MOD`, `OS_SLEEP_DECAY`, `OS_GAP_RELATIVE`, `M_S`,
`F75_DAMASIO`, `M5_D_PHONGRAPH`, `M4_PHON_USE_P` (L1521–1789). Plusieurs ont une doc interne admettant un effet
**nul ou non mesuré** (F75, OS_sleep_decay). La discipline OFF-inerte *mécanique* est réelle (cf. D9), mais la
règle « rien ne s'allume sans décision mesurée » est entamée : la baseline est un **agrégat historique**, pas un
minimum prouvé. (Cohérent AUDIT_OMEGA §S5.)

**🟡 D4 — 2 sous-flags NEO ON par défaut.** `M_NEO_RECALL_ENABLED=true`, `M_NEO_ASSEMBLED_ENABLED=true` (L6109–6110).
La **baseline globale reste OFF** (gate parent `M_DECLARE_NEO_ENABLED=false`, bloc 7266 gardé), mais dès qu'on
allume NEO, recall+assemblée sont ON sans décision explicite — et l'assemblée lit le son du mot (cf. C1).

### 2.4 Cheat-free / lecture de `currentWord`

**🟢 C0 — Le montant est cheat-free.** Recensement exhaustif (6 régions) : **toutes** les lectures de `currentWord`
dans la voie montante sont **bornées au révélé** (`if (revealedMask[p])` avant tout `charAt`/`charCodeAt`),
sauf C1. Les compteurs `_neoDbg` (L7275/7280/7307/7328) sont **inertes** (`typeof _neoDbg!=='undefined'`, absent
du build). L'apprentissage descendant (`endCurrentGame` L7016–7032 : `wp.get`, `align`, voisins) lit le mot
complet **post-partie** → légitime (§43). Frontière confirmée : `_cogProposed` figé révélé-seul (L7201) →
declares override → `penduEvaluate` (L7340) → **PHASE 2 miroir** (L7350) **après**.

**🟠 C1 — Lecture du SON du mot caché à la décision montante (« mot entendu »).** `wp.get(currentWord)` =
prononciation SAMPA du mot cible, en **L7256** (émergent assemblé) et **L7286** (NEO assemblée, branche défaut),
puis `align(currentWord, ph, revealedMask)` (positions non révélées masquées en `UNI`). Ce n'est pas un graphème
caché, mais **une propriété du mot caché exploitée au montant** → légitime **uniquement** sous prémisse « dictée /
mot entendu ». Sortie cheat-free intégrale = `M_NEO_PHON_COHORT_ENABLED` (son board-dérivé), **OFF par défaut**.
*Déjà documenté* (AUDIT_OMEGA §1, rapport §17.5 « orange ») — **confirmé en code**, toujours actif quand NEO/émergent ON.

**🟡 C2 — Oracle structurel léger omniprésent : `currentWord.length`.** Tous les declares (L7212/7224/7236/7245)
et la cohorte indexent le lexique **par longueur du mot caché**. La longueur est une **info publique au pendu** →
toléré, mais c'est une dépendance structurelle au mot-cible à connaître.

### 2.5 Arbitrage des declares

**🟠 A1 — Cascade « le dernier confiant écrase », sans arbitrage inter-voies.** 7 blocs `if` séquentiels
réassignent la même variable `proposed` (WORD_DECLARE 7205 → BPC 7219 → DUAL 7231 → ÉMERGENT 7242/7253 →
NEO 7266). Aucune garde **entre familles** : si plusieurs toggles sont ON, le dernier de l'ordre textuel gagne
mécaniquement. (À l'intérieur de NEO, un flag `_neoDone` ordonne recall>OS-arb>assemblée>muette.) C'est l'écart à
la DRC interactive noté AUDIT_OMEGA §1.6 — **confirmé** ; fragile car l'ordre de priorité est purement implicite.
**→ Mesuré / clos (17/06)** : l'arbitrage interactif `M_NEO_OS_ARB` a reçu ses **propres (α,β) mesurés** (balayage, AUDIT_OMEGA §1.6) — **aucun (α,β) ne bat DUAL** (neutre 96,8 < DUAL 97,3 ; biaiser lexical *dégrade*) → **cascade + DUAL = optimum mesuré**, pas de refonte. Reste à clarifier (hygiène, non mesuré) : rendre l'ordre de priorité **explicite**.

### 2.6 Code mort, vestigial, doublons (tissu cicatriciel — §S3)

**🟠 V1 — `eSleepReplay` (L6756–6810, ~55 l.) : morte, jamais appelée** (auto-documentée ; `_sleepReplayCount`
jamais relu ; remplacée par `M_S_sleep_replay`). Vrai code mort à retirer.

**🟡 V2 — Étages miroir phon appelés mais sans consommateur.** `M2_phon_m_step`/`M1_phon_m_step` (déf. 3890/3913,
**appelés** 7361/7362 sous `M_PHON_FEEDBACK_ENABLED`) écrivent `zonePenalty`/`letterScore` que **personne ne lit**
(grep : seules écritures). `M3_phon_m_step` est observationnel par conception (3878). Brûlent des cycles pour rien
quand le feedback phon est ON. **Corrige AUDIT_OMEGA §S4** : pas « jamais construits » ni « non câblés », mais
**câblés-en-appel, sorties mortes** ; et `M4_phon_m` **est**, lui, réellement consommé (3601).

**🟡 V3 — Bloc d'instrumentation A/B dans le hot-path `M3_d_step` (~230 l., L4361–4591).** Gardé
`M_PHON_READOUT_AB_ENABLED` (OFF) ; 7 « bras », AUC online, burn-in 1000. Pure mesure (ne pilote aucune décision)
mais énorme surface lue à chaque tick quand ON, dont un bras lisant la classe grammaticale `lookupLex4Word(currentWord)`
(oracle de mesure, exclu des arbitrages).

**🟡 V4 — Vestiges « transitoire / Jour 6' » jamais retirés.** `pairConv` « transitoire, sera retiré Jour 6' »
survit (L6515/5677/7728/8235). Projection SDIM `tile+mirror` reconnue **bijection sans gain d'info** (4612).
`pickLetterPhonGraph` « à retirer » (6912/7190). Constantes mortes `REVEAL_LETTERS/GAMES_PER_CONDITION/…` (1980–1983),
`L01_A2_LEX4_URL` « MORT » gardée pour un assert (1903/7584). Codes `F177..F212`/`R40..R59` truffent les commentaires.

**🟡 V5 — Doublons de logique.** Boucle de jeu seedée réimplémentée **5×** (9253/9329/9387/9770 + variante).
`ALLOWED_TOGGLES` (42 entrées) **dupliqué verbatim** 2× (L8886/8936 ; commentaire périmé « 7 noms »).
Jointe sublexicale copiée-collée entre `_neoDeclareOSmix` (6196–6204) et le bloc inline d'`omegaStep` (7292–7300).
g2p batch `_emrg_initG2P` (6056) en doublon de l'online `_emrg_initOnline`. Helpers cosinus locaux `_pbCos`/`_cosLDIM`/`_cosSDIM`
redondants avec `cosineSim` global. Portage `diag_sentence.py`→JS (script 2) = doublon **assumé** mais sans test de parité.

### 2.7 Gestion d'erreurs (§1.7)

**🟠 E1 — ~7 `try/catch` muets, dont 2 sur des mutations d'état.** Les plus graves : `_trexq_restore`/`_trexq_removeWord`
(L9294/9301, `}catch(e){}`) **mutent `OMEGA_LEX4.len_index`** — si la restauration du lexique échoue en silence,
la cohorte/recall reste amputée **sans alerte**. Aussi : `ui_applyOSLParams` (9602), `ui_initToggles` (8913, commentaire
trompeur : `name` est déjà whitelisté → un throw = vraie incohérence à faire remonter), et la dictée (11311/11314/11319/11324).
À comparer aux catches voisins **corrects** qui loguent via `ui_log`/`console.error` (9081/9183/9618/9802…) → discipline incohérente.

**🟢 E2 — Le chemin de décision et les loaders sont fail-loud.** Self-tests phon/OS *throw* à l'init (2792–2799) ;
finitude (NaN/Inf) gardée par `throw [FATAL]` dans chaque sortie de module (3615/3707/3791…) ; `loadOmegaLex4`
re-throw en FATAL (5826). Aucun catch muet **dans la voie de décision**.

### 2.8 Reproductibilité / R67

**🟠 R1 — `_omega_trexquant_bench` ne restaure pas l'état qu'il observe (R67).** Son `restore()` (9314–9319) remet
les toggles + `len_index`, mais **pas** `initOmegaGlobals()`, ni `_omegaSeed`/`_omegaRng`, ni `M_OS_v07.α/β`
(écrasés à 1/1). À la sortie le moteur reste « chaud » (concept/banc/eWeights de la dernière condition), RNG avancé,
θ=(1,1). Tous les **autres** benches restaurent en `finally` (9572/9674/9741/9782) — celui-ci est l'exception qui
viole « un diagnostic n'écrit jamais dans l'état observé » (mitigé : l'humain reclique « Nouvelle partie »).

**🟡 R2 — Reproductibilité partielle ; le claim « phase46 a supprimé tout `Math.random` non seedé » est inexact.**
Le **moteur de jeu** et les **benches winrate** sont seedés (reseed `makeMulberry32(seed)` avant de jouer ; in-lex/OOV
**proprement séparés** dans le bench Trexquant, D11). **Mais** : (a) fallback `Math.random` subsiste si `_omegaRng`
est null (L2366) ; (b) la dictée IIFE utilise `Math.random` (L11312) ; (c) les bancs **BIND** (`_pbAvgCos` 2000 tirages,
`phonBind_run` 600) et `ui_startGame` appellent `omegaRand()` **sans reseed local** → mesures BIND non reproductibles
run-à-run. Acceptable hors-fitness, mais à ne pas présenter comme « tout déterministe ».

### 2.9 Structure / design

**🟡 G1 — ~500 globaux top-level (script 1), zéro encapsulation → `eval` forcé pour les toggles.** `ui_toggle`/`ui_initToggles`
mutent les `let` top-level via `eval(name+' = '+val)` (L8914/8966/8970) — **non exploitable** (whitelist `ALLOWED_TOGGLES`
vérifiée avant ; valeur = booléen calculé ; noms = `dataset.toggle` du DOM statique), mais c'est un anti-pattern **forcé**
par l'absence de namespace (les `let` ne sont pas sur `window` en strict mode). Réparable par une `Map<string,{get,set}>`.
Contraste net avec le script 2 (IIFE étanche).

**🟡 G2 — Couplage caché dans `OS.step()`.** Lit l'état mutable de 6+ modules par sondes `typeof X!=='undefined'`
(L2059–2231), sans paramètre → dépend de l'ordre d'allocation global. La branche `relax` (2207) est **morte de fait**
(le commentaire admet `slope` jamais négatif en runtime). F179/F203/F204 = 3 correctifs empilés sur un signal reconnu inutile.

**🟡 G3 — `_OSL` référencé (L3781) ~5 600 lignes avant sa déclaration `var` (L9436).** Forward-ref module-scope :
fonctionne car appelé au runtime, mais TypeError si `M_OS_v07_step` était invoquée pendant l'init top-level (masqué par le
gate online OFF). Fragilité d'ordre.

### 2.10 UI / accessibilité

**🟠 U1 — Désync valeur par défaut UI↔moteur.** Champ `bpc-declare-conf` `value="0.95"` (L1129) vs `M_BPC_DECLARE_CONF=0.60`
(L1824) : au chargement, **l'UI affiche 0,95 alors que le moteur tourne à 0,60** (l'`oninput` ne se déclenche pas au boot).
L'affichage ment sur l'état réel. (Les autres champs sont cohérents.)

**🟡 U2 — Accessibilité absente sur les 38 toggles + le jeu.** Les `.toggle-item` sont des `<div onclick>` sans
`role="switch"`/`aria-checked`/`tabindex` → inatteignables au clavier / lecteur d'écran (le `*:focus-visible` ne s'applique
jamais). Le SVG potence et `.word-display` n'ont ni `role`/`aria-label` ni `aria-live` (les révélations ne sont pas annoncées).
**Incohérent** avec le panneau dictée qui utilise de vraies `<input type=checkbox>` — et **critique vu la cible n°1 « dys »**.

**🟡 U3 — CSS perdu : `.status-pill` / `.meta` jamais définis** (référencés L1349/1343, écrits par le JS 8186). Le pill d'état
moteur et la barre meta s'affichent **sans style**. + contrastes `--fg-mute #6e7681` sur fond sombre à 8–9px **sous le seuil
WCAG AA 4.5:1** (descriptions de toggles, labels d'histogramme) — pénalisant pour la cible dys.

**🟡 U4 — Web Speech sans feature-detection ni message d'échec** (L11311, `catch(e){}`). Si `speechSynthesis` indisponible,
le bouton « 🔊 Dicter » ne fait rien **en silence** — trou UX pour une dictée dys qui dépend de l'audio.

**🟢 U5 — Couplage UI↔JS sain.** Les ~30 handlers `onclick`/`onchange` pointent **tous** vers des fonctions existantes
(aucun orphelin) ; les globaux mutés par `oninput` sont tous `let` (réassignables). Repères couleur `cfg-*` (4 catégories)
présents — manquants seulement sur le panneau dictée et le toggle Declare BPC.

### 2.11 Isolation du sous-projet dictée

**🟢 I1 — IIFE dictée réellement étanche (R66/R67).** Script 2 entièrement encapsulé `(function(){…})()` ; ne référence
**aucun** global du moteur (`currentWord`/`OMEGA_LEX4`/`omegaStep`… absents, sauf le mot « M3_d » dans un commentaire).
Effets de bord limités au DOM (bouton/overlay) et à localStorage **namespacé `vdd_*`** (4 clés, aucune collision). Le
diagnostic **n'écrit jamais dans l'état du moteur** (R67). Baseline pendu byte-inerte (retirer le bloc suffit). Risque résiduel
mineur : données localStorage non versionnées (pas de migration de schéma).

---

## 3. Recensements transverses (fichier entier, hors L724)

| Scan | Résultat | Verdict |
|---|---|---|
| **`Math.random` non seedé** | L2366 (fallback `omegaRand` si `_omegaRng` null), L11312 (dictée). Moteur de jeu = `omegaRand()` seedé. | 🟢 moteur OK / 🟡 fallback + UI + bancs BIND non reseedés (R2) |
| **`try/catch` muets** | ~7 : **9294/9301** (mutent le lexique), 9602, 8913, 11311/11314/11319/11324 | 🟠 §1.7 (E1) |
| **`eval(`** | 3 (8914/8966/8970) muter les toggles `let` ; whitelist `ALLOWED_TOGGLES` | 🟡 non exploitable, anti-pattern (G1) |
| **`innerHTML =`** | 18 ; données lexique (8540/8594/8708…) + **saisie élève (11319)** | 🔴 saisie élève (S1) / 🟡 lexique |
| **Dette `Jour 6'`/transitoire** | ~13 marqueurs ; **0** TODO/FIXME formel | 🟡 dette en jargon « Jour 6' », jamais tenue (V4, §S3) |
| **Licence Lexique 4 / CC BY-SA** | présente **3×** (L720, 9964, 11301 visible UI) | 🟢 conforme CLAUDE.md / NOTICE |
| **Globaux top-level (script 1)** | ~500 (179 `let`, 141 `const`, 2 `var`, 174 `function`) | 🟡 espace de noms massif (G1) |
| **Toggles UI ↔ `ALLOWED_TOGGLES`** | bijection exacte (42 ≡ 42) | 🟢 (mais doc dit « 39 », cf. §4) |

---

## 4. Réconciliation avec `AUDIT_OMEGA.md` et `CONFIG_REFERENCE.md`

**🟡 Dérive de numérotation à corriger dans AUDIT_OMEGA.** Les pointeurs de lignes ont dérivé de **+50 à +120**.
Vraies lignes mesurées : `cStep` = **6465** (et non 6343 — qui est `computeLex4LetterScores`), `M_S_step` = 5694,
`penduEvaluate` = 6923, `startNewGame` = 6956, `endCurrentGame` = **7016** (≠ 6894), `omegaStep` = **7113** (≠ 7080),
`_cogProposed` figé = 7201, `penduEvaluate` joué = 7340, PHASE 2 miroir = 7350, bloc declares = **7205–7332**,
`pairConv` transitoire = **6515** (≠ 6393). Le recensement NEO §1 (7148/7157/7172) → réels **7268/7286/7315**.

**Claims AUDIT_OMEGA testés → tous CONFIRMÉS sauf une imprécision** : §1 (currentWord NEO), §1.4 (cascade sans jointe
inter-voies, n'utilise ni M_S ni branches descendantes), §1.5 (DUAL produit niveau-mot), §1.6 (cascade « dernier confiant
écrase » + `_neoDeclareOSmix` force α=β=1), §S1 (saut declare), §S2 (bPC reconstruction, encoder depuis M1, `M3_D_BYPASS`),
§S3 (`pairConv` vestigial), §S5 (flags gardent des blocs), §0 (montant révélé-seul, descendant après). **Imprécision à
corriger : §S4** — `M2_phon_m`/`M1_phon_m` ne sont pas « jamais construits / non câblés », ils sont **appelés mais leurs
sorties n'ont aucun consommateur** ; et `M4_phon_m` **est** consommé (3601). *(NB : §S2 « rustine normalizeInPlace sur
M3_d.output » non retrouvée — le normalize est sur `M3_m.output` 5508 ; la non-bornitude réelle est sur `cLetterScore`,
offset défensif 6006.)*

**🟡 `CONFIG_REFERENCE.md` périmé sur le compte de toggles.** Il énumère **« 39 toggles »** ; le code en expose **42**
dans l'UI — les 3 « bleus » cheat-free (`M_NEO_PHON_COHORT_ENABLED`, `M_NEO_PHON_COHORT_JOINTE`, `M_NEO_OS_ARB`) sont dans
le code (decl. 6120/6123/6125, UI 1237/1244/1251, ALLOWED 8908) mais **absents de l'énumération** (cités en prose seulement).
Aucun toggle listé n'est inexistant. 3 toggles orphelins d'UI (modifiables source seulement, voulus) : `M_BPC_CROSSMODAL`
(falsifié §1.4), `M_HRR_CROSSMODAL`, `M_S_DUAL` (prototype, `const`).

---

## 5. Priorisation (impact × effort), tout falsifiable

| # | Action | Impact | Effort | Sévérité |
|---|---|---|---|---|
| 1 | **Échapper la saisie élève** avant `innerHTML` (S1) — `textContent`/entités | sécurité | faible | 🔴 |
| 2 | **Retirer le code mort** : `eSleepReplay` (V1), `pairConv` (V4), constantes mortes | maintenabilité | faible | 🟠 |
| 3 | **Faire remonter les catch muets** qui mutent le lexique (E1, 9294/9301) sous `ui_log('ERROR')` | robustesse | faible | 🟠 |
| 4 | **`_omega_trexquant_bench` : restaurer l'état** en `finally` (initOmegaGlobals + seed + θ) comme ses pairs (R1) | repro/R67 | faible | 🟠 |
| 5 | **Corriger la désync** `bpc-declare-conf` (U1) ; init UI ← valeurs moteur au boot | exactitude | faible | 🟠 |
| 6 | **Mettre à jour les docs** : renuméroter AUDIT_OMEGA (+50/+120), corriger §S4, passer CONFIG_REFERENCE à « 42 » (§4) | doc↔code | faible | 🟡 |
| 7 | **Accessibilité** : `role=switch`/`aria`/clavier sur les toggles + `aria-live` sur le jeu (U2), contrastes (U3) — *cible dys* | inclusivité | moyen | 🟡 |
| 8 | **CI anti-régression** : un smoke seedé qui *assert* cognition seule ≥ 90 % et +NEO ≥ 97 % (le risque #1 §S3 : aucun test ne garde le winrate) | régression | moyen | 🟡 |
| 9 | **Factoriser** : 1 seule `ALLOWED_TOGGLES`, 1 seule boucle de jeu, 1 seule jointe sublexicale (V5) ; remplacer `eval` par une Map (G1) | dette | moyen | 🟡 |
| 10 | **Trancher les modules socle ON** (D3) : mesurer F75/OS_sleep_decay/… puis OFF si nuls (doctrine §1.6) | pureté | moyen | 🟠 |

> Aucune de ces actions n'est requise pour la **correction** du moteur (baseline OFF-inerte intacte) sauf #1 (sécurité)
> et #5 (exactitude d'affichage). Les autres servent la **maintenabilité, la pureté doctrinale et l'inclusivité**.
> Audit en lecture seule : **le moteur n'a pas été modifié.**
