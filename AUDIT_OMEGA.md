# Audit structurel — moteur OMEGA-Ω (pendu) — 2026-06-15

Audit **du moteur cognitif** (`app/omega-pendu.html`), distinct de l'audit monorepo (`AUDIT_PROJET.md`).
Méthode : lecture **du code** (pas seulement des docs `docs/MEMOIRE.html` / `docs/rapport-mode-emploi.html`) ; chaque point « vérifié » renvoie à une ligne. Doctrine de référence : **cap §43 (cognition > oracle)** + **R66 (mesurer/falsifier avant de garder ; OFF-inerte)**.

---

## 0. Cadre doctrinal vérifié — la double voie (à ne pas confondre)

Deux axes **orthogonaux** :

- **Axe 1 — double ROUTE de lecture (DRC, Coltheart)** : voie **orthographique** (`M*_d`) ∥ voie **phonologique** (`M*_phon`), arbitrées par l'**OS** (`w(r) = −r/(1+r)`).
- **Axe 2 — double BOUCLE par voie (Möbius L01)** : **ascendante** (montante : perçoit→décide) et **descendante** (miroir : résultat→corrige/apprend).

### La règle d'or (cap §43) et son ancrage dans le code
| | Ascendante (montante) | Descendante (miroir) |
|---|---|---|
| Rôle | **décide** la lettre | **apprend**, ne décide pas |
| Accès au mot caché | **positions révélées seules** | **mot complet permis** (le « professeur », wake-sleep) |
| Lire la réponse | **triche dure** | **légitime** |

**Frontière physique dans `omegaStep` :** le bloc décision (montant) calcule `_cogProposed` en **révélé seul**, les declares peuvent override, **puis `penduEvaluate` joue la lettre (≈ ligne 7197)**, **et seulement ENSUITE** « PHASE 2 — Cercle miroir activé » (≈ ligne 7203) tourne avec le résultat. **Montant avant, descendant après.**

- Montante ortho : `cStep`(6343) → `M1_d_step`(4022) → `M2_d_step`(4117) → `M3_d_step`(4232) → `M_S_step`(5669) → `M4_d_step`(4729) → `M5_d_step`(4849).
- Montante phon + arbitre : `omega_voiePhon_OS_tick`(3903) + `M_OS_v07_step`(3747).
- Descendante ortho (5 étages) : `M5_m_step`(5238) → `M4_m_step`(5287) → `M3_m_step`(5421, **seul étage qui écrit `conceptCells`**) → `M2_m_step`(5499) → `M1_m_step`(5565, co-décide M5 ; poids 0,0 en baseline).
- Descendante phon : **tronquée** — `M5_phon_m_step`(3809)/`M4_phon_m_step`(3821) effectifs, `M3_phon_m_step`(3840) observationnel.
- Apprentissage descendant des declares : `endCurrentGame`(6894) — banc recall, g2p (`learnExp`), table muette jointe (tous post-partie, mot complet légitime).

> **Conséquence de cadrage.** Lire `currentWord` dans la voie **descendante** (post-partie) n'est **jamais** un finding. Seule la lecture d'une propriété de la réponse dans la voie **montante** (à la décision) est sensible.

---

## 1. Vérification ciblée — `currentWord` dans NEO

Demande : la session précédente avait garanti que `currentWord` n'était « plus utilisé » dans NEO. **Garantie partiellement fausse.**

| Voie NEO | Ligne | Lecture | Verdict |
|---|---|---|---|
| Recall (1) | 7148, 7151 | `currentWord.charAt(p)` **si `revealedMask[p]`** | ✅ révélé seul |
| Muette (3) | 7172, 7173 | voisins `charAt(p±1)` **si révélés** | ✅ révélé seul |
| **Assemblé (2)** | **7157** (ancien 7134) | **`wp.get(currentWord)` = PHONOLOGIE du mot caché**, à la **décision** (montant) | ⚠️ prémisse « mot entendu » |
| Compteurs diag | 7153, 7164, 7185 | `currentWord.indexOf(...)` sous `_neoDbg` (absent du build) | ✅ inerte |

**Vrai dans la garantie :** l'apprentissage de la table g2p est passé sur `learnExp`(6071) qui **ne crédite que les positions révélées** ; et `align`(6064) remplace tout graphème **masqué** par `UNI` → **aucun graphème caché n'est lu**. La doctrine ortho tient.

**Faux dans la garantie :** la route **assemblée** (plus gros contributeur du declare, **+5,28 pts** K=1) lit toujours `wp.get(currentWord)` à la décision (7157) pour récupérer **le son** du mot cible, puis score les positions non révélées via `L2[phonème]`. Ce n'est pas un graphème caché, mais **c'est une propriété du mot caché (sa prononciation), exploitée dans la voie montante**. Légitime **uniquement** sous la prémisse `M4_PHON_USE_P` « le mot est entendu ».

**Donc :** le **97,5 % « cheat-free » repose sur la lecture du SON du mot cible**. À communiquer comme **« in-lexique, mot entendu »**. Repères sans prémisse : hors-lexique phon→ortho **70,7 %**, ortho pur OOV **22 %**.

**Options (objectif « g2p sans `currentWord` ») :**
1. Garder `wp.get(currentWord)` = assumer la prémisse « dictée / mot entendu » + **afficher le régime**. *(recommandé ; cohérent avec le pivot dictée)*
2. Dériver le son du **cohort board** (consensus des prononciations compatibles) → réellement board-only. **Implémenté + corrigé (garde de pureté) — §1.1 : parité vrai-son in-lexique (97 %), coût OOV ~7,5 pts. Le −18,8 initial était un bug d'implémentation (override confiant-mais-faux), pas le concept.**
3. Couper la route assemblée au pendu → −5,28, ~92 % 100 % board-only.

### 1.1 Option 2 implémentée + MESURÉE (R66) — `M_NEO_PHON_COHORT_ENABLED`

Option 2 codée en **OFF-inerte** (toggle `M_NEO_PHON_COHORT_ENABLED`, défaut OFF → baseline byte-identique). Quand ON, la source de `_al` **partagée par l'assemblée ET la muette** (subtilité : les deux lisaient le même son via `wp.get`, la muette n'était donc pas une voie propre) devient le **consensus phonémique de la cohorte board-compatible** (`_neoPhonCohort()`, mots de même longueur matchant le révélé) — plus aucune lecture du son du mot caché. Modèle fidèle du joueur humain qui « sonne » ce qu'il voit (`_AU` → /o/ → EAU, inféré du lexique, pas entendu).

**Mesure** (bench Trexquant hors-lexique, 80 test / 300 warmup, budget 6, headless via `evo` loader ; en UI = bouton « 🎯 Trexquant », 3 conditions + Δ) :

| Condition (OOV) | graine 12345 | graine 777 |
|---|---|---|
| phon→ortho · son du MOT (`wp.get`) | 73,8 % | 58,8 % |
| phon→ortho · son **cohort-board** | 55,0 % | 40,0 % |
| ortho seul | 18,8 % | 22,5 % |
| **Δ cohort − son-mot** | **−18,8** | **−18,8** |

Les chiffres ci-dessus (cohort-board 55,0/40,0 %, Δ −18,8) sont ceux de la **première implémentation SANS garde** — et c'était un **BUG**, pas le concept.

**Diagnostic (instrumenté `_neoDbg`).** Tôt dans la partie la cohorte fait des milliers de mots → le consensus est lavé, l'argmax sort un phonème faible, mais `L2[phonème]` pique quand même → l'assemblée **override la cognition avec une lettre confiante mais fausse**. In-lexique, config optimale : OFF tire 413 fois à **97,8 %** ; ON-sans-garde tire **665** fois à **60,5 %**. D'où la chute (−18,8 OOV ; −13 à −21 in-lexique). **OFF-inerte vérifié** (OFF = baseline 97 % intact, aucun bug hors-toggle).

**Fix (R66) — garde de pureté** `M_NEO_PHON_COHORT_PURITY` (défaut **0,5**) : ne retenir un phonème consensus que si ≥ cette fraction de la cohorte s'accorde (sinon `'_'` → l'assemblée passe la main à la cognition). Élimine l'override confiant-mais-faux. Mesure **post-garde** :

| Cadre | vrai son (`wp.get`) | cohort-board + garde 0,5 | coût réel |
|---|---|---|---|
| in-lexique (config optimale) | 97,0 % | **97,0 %** | **~0 (parité)** |
| hors-lexique (OOV, bench 80/300) | 73,8 % | **66,3 %** | **~7,5 pts** |

**Verdict corrigé :** le vrai coût d'honnêteté est **~0 in-lexique, ~7,5 pts OOV** — *pas* −18,8 (c'était le bug). L'estimation ≈78 % était optimiste, mais la pureté pendu n'est **pas** chère une fois la garde posée. Avec la garde, le cohort-board est une **option pendu-pur viable** (cheat-free, perte minime). Décision : **dictée / mot-entendu → `wp.get`** (gratuit, légitime sous prémisse) ; **pendu pur → cohort-board + garde** (cheat-free, parité in-lexique, ~7,5 pts OOV). Toggle **OFF par défaut**, rien adopté en config de référence sans arbitrage explicite.

### 1.2 Jointe son×ortho — la cohorte FAITE PROPREMENT (R66, mesuré)

L'argmax du §1.1 était **fainéant** : il jette la distribution de phonème ET le contexte ortho. La doctrine (mémoire §6/§17.3) impose **croiser = jointe** `P(lettre | phonème, contexte)`, pas argmax ni produit. Implémenté (`M_NEO_PHON_COHORT_JOINTE`, OFF-inerte) :
- `_neoCRS` : table jointe **sonore** `phonème|G|D` (+backoffs), apprise **descendant** (mirror de `_neoCR` muette, ligne ~6938) ;
- `_neoPhonCohortDist()` : distribution phonème **molle** de la cohorte board (pas argmax) ;
- décision : `Σ_φ Pcoh(φ|p) · CRsonore[φ | voisins révélés]`, backoff L2 marginal. Seuil propre `M_NEO_PHON_COHORT_JOINTE_CONF = 0,30`.

**Mesure (in-lexique K=1, warmup 200 / test 100 mots distincts, 4 graines) :**

| Cheat-free | winrate moyen | par graine |
|---|---|---|
| cohorte **argmax** (§1.1) | 94,3 % | [95, 94, 95, 93] |
| cohorte **JOINTE @0,30** | **96,5 %** | [96, 96, 97, 97] |
| *(réf son-lu, triche pendu)* | *98,0 %* | *[98, 98, 99, 97]* |

**Verdict :** la jointe bat l'argmax de **+2,2 pts, à chaque graine** (jamais en-dessous), cheat-free, et **réduit l'écart à la version qui triche de −3,7 à −1,5 pt**. Le « croiser = jointe » de la doctrine, mesuré et confirmé. Adopté comme **voie cheat-free recommandée** (toggle OFF par défaut, conf 0,30 réglable en UI).

**Morpho jonction #1 (distance-de-fin) — FALSIFIÉ (R66, §6.4 barrière de mérite).** Tenté : ajouter `e` = distance-de-fin au contexte de la jointe (`_neoCRS`, clés `φ|eE|G|D`, `φ|eE|D` prepended). Mesuré K=1, 4 graines (warmup 200 / test 100) : jointe **+morpho 96,0 %** vs jointe **bigramme 97,0 %** (−1,0 pt, perd dans 3/4 graines). Cause : `e` **fragmente `_neoCRS`** (cellules trop creuses à warmup 200 → estimations bruitées) et reste un **proxy grossier** (ne capte pas le *contenu* du suffixe). **Reverté** (pas de cimetière). Piste morpho suivante (jonction séparée) : contexte = **suffixe révélé / segment AQUA `SEG`** (le contenu, pas la distance).

**Morpho jonction #2 (backoff DENSE depuis le lexique) — NET-NEUTRE / bruit (R66, §6.4) — 2026-06-16.** Leçon de #1 : la cause de l'échec = **données creuses** de `_neoCRS` à warmup 200 (pas le type de contexte) ; et le `g2p` de `_DECL2` sort en **IPA** ≠ **SAMPA** de la voie assemblée NEO (ne se clavent pas sans couche de conversion). Tenté (toggle `M_NEO_MORPHO`, OFF-inerte) : quand la cellule jointe apprise est creuse, **backoff vers une table `phonème|G|D` DENSE construite une fois depuis tout le lexique** (via `align`/SAMPA, mêmes clés/backoffs que `_neoCRS`) au lieu du `L2` plat marginal — cheat-free (savoir phonotactique général, comme `L2` ; jamais `currentWord`). Mesuré K=1, 4 graines (warmup 200 / test 100, config `CONFIG_REFERENCE.md` épinglée) : jointe **bigramme 95,0 %** [97,97,97,89] vs **+morpho dense 95,3 %** [97,95,99,90] → Δ moyen **+0,3** mais **[+0,0, −2,0, +2,0, +1,0]** (perd à la graine 777) = **dans le bruit** (SE ≈ ±2 à N=100). Diagnostic : le résidu de la voie cohorte n'est **pas** dans le backoff (la jointe décide surtout là où elle a du signal ; les vraies pertes — ex. graine 99 à **89‑90 %** alors que le son‑lu fait 98 — viennent de l'**ambiguïté cohorte** sur des mots durs, pas du choix `L2`‑vs‑dense). **Reverté** (app + mode de mesure ; barrière de mérite non franchie, pas de cimetière). **Conclusion morpho :** le levier du résidu cheat-free est la **puissance/qualité de la cohorte** (et les graines dures), pas un raffinement du backoff phonème→lettre. La piste SEG‑contenu reste non testée (exigerait une couche IPA↔SAMPA), mais ce négatif suggère un ROI faible tant que le résidu vit dans la cohorte, pas dans la table phon→graphe.

### 1.3 Reproduction indépendante (R66, §1.2 falsifiabilité / §6.3 preuve) — 2026-06-16

Les chiffres §1.1/§1.2 venaient de la session précédente (inaccessible). Doctrine : *« un résultat non reproductible est nul »*. **Rejoué de façon déterministe** par un harnais headless dédié — `evo/ab_cohort.js` — qui **miroite le protocole du bench embarqué `_omega_trexquant_bench`** (même `baseCfg`, warmup/test, RNG LCG seedé, filtrage OOV) et pilote le **vrai** code de décision (`startNewGame`/`omegaStep`), via un pont `evalIn` ajouté à `evo/fitness_harness.js` (lecture/écriture des toggles par référence ; baseline non modifiée). Rejouable :
`node evo/ab_cohort.js oov 300 80 12345,777` · `node evo/ab_cohort.js inlex 200 100 12345,777,2024,99`.

**§1.1 (OOV, warmup 300 / test 80).** Reproduction **exacte** à la graine 12345 :

| OOV | graine 12345 | graine 777 | moyenne |
|---|---|---|---|
| son-lu (`wp.get`) | 73,8 % | 60,0 % | 66,9 % |
| cohorte argmax + garde 0,5 | **66,3 %** | 53,8 % | 60,0 % |
| **Δ coût d'honnêteté** | **−7,5** | −6,2 | **−6,9** |

→ confirme le coût OOV **~7 pts** (claim ~7,5). Le 73,8 / 66,3 à la graine 12345 est **identique au tableau §1.1** : le miroir de config est fidèle.

**§1.2 (in-lexique K=1, warmup 200 / test 100, 4 graines).** Le son-lu reproduit **98,0 % pile** (= réf §1.2), ce qui valide la config de base. La jointe :

| in-lexique K=1 | 12345 | 777 | 2024 | 99 | moyenne |
|---|---|---|---|---|---|
| réf son-lu (triche pendu) | 96 | 99 | 99 | 98 | **98,0 %** |
| cohorte **argmax** | 93 | 94 | 94 | 89 | 92,5 % |
| cohorte **JOINTE @0,30** | 97 | 97 | 97 | 89 | **95,0 %** |
| **Δ JOINTE − argmax** | +4 | +3 | +3 | **+0** | **+2,5** |

**Verdict reproduit (honnête).** Le cœur tient : la **jointe bat l'argmax de +2,5 pts en moyenne** (claim +2,2) et **n'est jamais en-dessous** — *« croiser = jointe »* (doctrine §3) confirmé sur le harnais déterministe. **Nuance** : sur ce jeu de graines, le strict *« à chaque graine »* devient **3 victoires + 1 égalité** (graine 99 : 89 = 89) ; et l'écart résiduel à la triche est **−3,0 pts** (le −1,5 du §1.2 était optimiste — dépend du pool de mots). Rien n'infirme l'adoption (jointe ≥ argmax partout, gratuit en pureté), mais les bornes honnêtes sont **+2,5 / jamais-sous / résiduel −3** sur graines {12345,777,2024,99}.

> Tout reste **OFF par défaut** (baseline byte-identique). La reproduction n'a **pas** modifié le moteur ; elle ajoute un harnais (`evo/`) et cette sous-section.

### 1.4 Le declare cheat-free ne croise pas les deux routes — et croiser AU concept (M3_d) dégrade (R66) — 2026-06-16

**Vérifié (code).** Le declare NEO (7210-7248) combine ses voies en **cascade « soit l'un soit l'autre »** : recall → SINON assemblé (phon→ortho) → SINON muette (ortho-contexte). **Pas de jointe entre voies**, et **une seule direction** (phon→ortho ; aucune voie ortho→phon). Il **n'utilise ni le hub concept `M_S`** (fusion amodale M3_ortho+M3_phon, 1771/5062) **ni les branches descendantes** (`M3_phon_m_step` renforce les `conceptCells` partagées, 3854) — il court-circuite le croisement par le concept, *la* mécanique OMEGA. (La cognition **par-lettre**, elle, croise bien via `M_S`/OS `w(r)` — c'est le ~98 % de base.)

**Testé (R66).** Réveil du croisement dormant `M_BPC_CROSSMODAL` (M3_d perçoit `M1_d ⊕ M1_phon`, hub-and-spoke Rogers 2004, bPC descendant ; poids `bpcW_phon` alloués mais OFF, 2827). Mesuré K=1, 4 graines (config `CONFIG_REFERENCE` épinglée, régime son-lu) :

| | 12345 | 777 | 2024 | 99 | moy. |
|---|---|---|---|---|---|
| config réf. (cross-modal OFF) | 96 | 99 | 99 | 98 | **98,0 %** |
| + CROSS-MODAL ON | 95 | 95 | 97 | 93 | **95,0 %** |
| Δ | −1 | −4 | −2 | −5 | **−3,0** |

→ **net −3,0, perd aux 4 graines = falsifié** (un smoke N=25/1 graine donnait +4 — bruit). Croiser les deux routes **au concept 12 cellules** le **contamine** — cohérent avec le mur de capacité (§3, mémoire §8.1) et la falsification « banc dans M3_d ». La cognition croise déjà via `M_S`/OS ; en rajouter au concept sur-contamine.

**Acquis convergent.** Trois leviers pour pousser le declare cheat-free ce cycle — morpho distance (#1), morpho backoff dense (#2, §1.2), croisement cross-modal (#1.4) — **tous net-négatif/bruit**. Le résidu cheat-free (~2-3 pts sous le son-lu) ne vit **ni** dans la table phon→lettre **ni** dans le concept M3_d : il est dans l'**ambiguïté cohorte** (mots durs), et le croisement *utile* est **déjà** capté par `M_S`/OS au niveau lettre. Mesure reproductible : `node evo/ab_cohort.js xmodal 200 100 12345,777,2024,99`.

### 1.5 Pousser le declare cheat-free SANS currentWord — exploration complète (R66) — 2026-06-16

Question : combler le trou du declare **sans aucune lecture de `currentWord`** (cohorte-jointe seule = **94,8 %** vs son-lu/«mot entendu» 98,0 %, K=1 4 graines). Comparaison **DUAL (`_DECL2`, niveau mot, freq×ortho×phon) vs NEO** (per-lettre, sans fréquence) : NEO **n'exploite ni la fréquence ni un posterior-mot** — c'est ce qui manquait. Tous les variants mesurés (in-lexique K=1, warmup 200/test 100, config `CONFIG_REFERENCE` épinglée) :

| Variant ajouté à la cohorte-jointe (sans CW) | Δ moy. | par graine | doctrine | verdict |
|---|---|---|---|---|
| **DUAL complet** (freq + ortho + phon, additif) | **+2,5** | [+3,+0,+1,+6] | §3.1-*pattern* (produit de marginales, **niveau mot**) | **stable, jamais en-dessous → seul gain robuste** |
| DUAL **fréquence seule** (wO=wP=0) | +1,3 | [+3,−1,+0,+3] | propre (prior fréquence) | positif **mais bruité** (perd 1 graine) |
| **jointe-mot** (freq × vraisemblance jointe propre, §3.2) | **−2,3** | [−1,−4,−4,+0] | propre | **échoue** : le produit Σ_p de la jointe *compose* le bruit, engage le mauvais mot MAP |
| freq croisée au **phonème** (`Pcoh` pondérée) | −4,3 | [−2,−7,−4,−4] | propre | échoue : la fréquence est un signal de *mot*, pas de phonème |

*(Régime « mot entendu » : DUAL complet donne **+1,8 → 99,8 %**, [+4,+0,+1,+2].)*

**Conclusion (honnête).** Le seul gain robuste vient de **DUAL** : un **modèle de mot** (prior fréquence × plausibilités intrinsèques ortho/phon du mot, par produit). Décomposé : ~moitié fréquence (propre mais bruitée), ~moitié ortho/phon (qui *stabilise*). **Aucun variant doctrinalement pur n'égale le +2,5** — la jointe, excellente *par lettre* (adoptée §1.2), est mauvaise *multipliée sur le mot*. Le « produit » de DUAL est le *pattern* que §3.1 déconseille, mais (a) au niveau **mot-declare** (≠ croisement per-lettre visé par §3.1/§3.2), (b) c'est de la **reconnaissance in-lexique** (la cohorte contient le vrai mot → s'effondre en OOV, non mesuré ici). 

**Statut : DUAL ADOPTÉ (arbitrage humain, 16/06/2026, §0/§4.4)** — option (c). `M_DECLARE_DUAL` passe **ON dans la config de référence cheat-free** (`docs/CONFIG_REFERENCE.md`, MAJ 16/06) : +1,8 → 99,8 % mot-entendu / +2,5 → 97,3 % sans-currentWord, stable, cheat-free, declare niveau-mot (pas d'entorse §3.1, qui vise le per-lettre). Défaut moteur **OFF** (baseline byte-identique ; activé dans le preset). *(Alternatives écartées : (b) fréquence-seule +1,3 bruité ; (d) base 94,8.)* Repro : `node evo/ab_cohort.js dual|dualncw 200 100 12345,777,2024,99`.
**Reste honnête (non clos) :** l'effet **OOV (Trexquant)** de DUAL n'est **pas mesuré** — DUAL étant de la reconnaissance in-lexique, on attend ~0 en OOV ; à vérifier avant tout chiffre hors-lexique.

### 1.6 Lecture à la lumière de la littérature — et chantier futur : l'arbitrage des deux voies (R66) — 2026-06-16

Confrontation des résultats §1.1–§1.5 aux sources du projet (MEMOIRE §11t/§13, rapport §14). But : **fonder le prochain chantier**, pas pavoiser. *(Épistémique du mémoire : une concordance n'est pas une preuve ; on distingue lien fort et analogie.)*

**Concordances fortes (mesuré ↔ source) :**
- **DUAL = le *cohort model* (Marslen-Wilson & Welsh 1978).** DUAL *est* la cohorte board-compatible pondérée par la **fréquence** = reconnaissance lexicale. Mesuré : la fréquence au niveau **mot** aide (+1,3) mais au niveau **phonème** nuit (−4,3, §1.5) → la reconnaissance est lexicale, pas phonémique-position. Conforme au modèle.
- **DUAL + NEO = les deux voies de la DRC (Coltheart et al. 2001).** Lexicale (recall/DUAL : reconnaître le mot) ∥ sublexicale (assemblé/jointe : assembler par phonème). « Les combiner bat chacune » (§1.5) = la thèse double-route. Le caveat OOV s'y inscrit : hors-lexique la voie lexicale s'effondre (cohorte sans le mot), la sublexicale doit porter — prédiction DRC directe.
- **M3_d cross-modal qui dégrade (−3,0, §1.4) = CLS (McClelland, McNaughton & O'Reilly 1995).** Le petit latent sémantique (12 cellules, blueprint DBPC, Qiu et al. 2025) ne peut absorber une charge cross-modale/épisodique sans se contaminer — séparation hippocampe/néocortex. Re-confirme §8.1 du mémoire de façon indépendante.

**Tensions / analogies à ne pas surinterpréter :**
- **Notre combinaison est plus grossière que la DRC.** DRC = deux voies **arbitrées en interaction** (activation relative) ; nous = **cascade à priorité fixe** (recall → DUAL → jointe ; le dernier confiant écrase). L'arbitrage fin (OS `w(r)=−r/(1+r)`, rapport §4) n'existe qu'au niveau **lettre**, pas entre les déclares. **C'est l'écart au modèle — et le chantier ci-dessous.**
- Le *cohort model* est **auditif** (entrée phonétique incrémentale) ; on l'applique à un board **écrit**. L'analogie (rétrécissement de l'ensemble compatible) tient, la modalité diffère.
- Lien **resonator (Frady et al. 2020)** ↔ échec de la jointe-mot (−2,3, le produit Σ_p compose le bruit) : **analogique** (Frady factorise des produits VSA liés, pas des vraisemblances par position). Éclairage, pas preuve. Recoupe §3.1 (« ne pas multiplier des marginales »).

---

#### Chantier futur — **arbitrage des deux voies du declare** (≈ croisement OS au niveau declare)

**Constat (§1.5 + DRC).** Le declare cheat-free combine voie **lexicale** (recall/DUAL) et voie **sublexicale** (jointe) par **cascade à priorité fixe**. Ce n'est pas l'arbitrage interactif DRC, où l'intégration pondère par la **fiabilité/activation relative** des routes.

**Hypothèse falsifiable.** Remplacer la cascade par un **arbitrage par fiabilité relative** lexical⟷sublexical — à l'image de l'OS `w(r)=−r/(1+r)` qui arbitre déjà ortho⟷phon **au niveau lettre** — mais porté au **niveau declare**. C'est le **croisement OS réservé**. Confiances **board-dérivées** : marge du posterior cohorte (lexical) vs marge de la jointe (sublexical) ; aucune lecture de `currentWord`.

**Pourquoi ça pourrait payer.** (a) La cascade laisse une voie *confiante-mais-fausse* écraser l'autre (pattern d'échec §1.1) ; pondérer par la fiabilité **mesurée dans le régime courant** l'évite. (b) Bascule gracieuse vers la sublexicale quand la cohorte lexicale est peu fiable (OOV / mots durs) — exactement la prédiction DRC, et l'angle mort actuel (OOV).

**Protocole R66 (reprenable).**
1. Contrôle = cascade actuelle (baseline).
2. Variante = gate d'arbitrage par fiabilité relative (nouveau toggle **OFF-inerte**, confiances board-dérivées).
3. Mesurer K=1, 4 graines, **in-lexique ET OOV séparément** (doctrine §1 : ne jamais les confondre ; c'est en OOV que l'arbitrage devrait le plus aider).
4. Barrière de mérite §6.4 : gardé seulement si ≥ baseline **à chaque graine** et moyenne > 0, dans ≥ 1 régime, **sans régresser l'autre**.

**Garde-fous (mesurés — ne pas réapprendre à la dure).**
- La forme `w(r)` est un **choix de design**, non dérivé (rapport §4 note) — l'étendre aux declares en hérite ; la traiter comme paramètre à mesurer.
- **Apprendre le poids d'arbitrage en ligne par le winrate = plat** (SPSA : §8.3 mémoire ; trigger gap, notes NEO §6 — gradient nul, effet sous le quantum). → fixer le poids par **mesure** (constante, comme θ batch), ne pas l'apprendre en ligne.
- **Une jonction à la fois** (§4.1) : chantier **séparé** de l'adoption DUAL ; ne pas fusionner. Cheat-free strict.

**Pré-requis de lecture (A3) avant de coder :** rapport §4 (OS `w(r)`) · §17 (declares NEO) · MEMOIRE §6 (croiser = jointe) · §8.2-8.3 (l'arbitrage par **seuil fixe** drague ; le trigger appris a échoué) · le présent §1.5/§1.6. Harnais prêt : `evo/ab_cohort.js` (ajouter un mode `arb`).

#### Résultat mesuré (16/06) — l'arbitrage OS MARCHE vs base, mais ne bat pas DUAL

Prototypé `M_NEO_OS_ARB` (OFF-inerte) : mélange convexe sublexical (jointe) ⟷ lexical (cohorte-fréquence) via `M_OS_v07_step` réutilisé. Mesuré in-lexique K=1, 4 graines (tri-critère) :

| sans currentWord | winrate | err/partie | coups/partie |
|---|---|---|---|
| cohorte-jointe (cascade, base) | 94,8 % | 2,13 | 8,18 |
| + DUAL (cascade) | **97,3 %** | **1,80** | **7,88** |
| + ARBITRAGE OS | 96,8 % | 1,89 | 7,95 |

**Verdict.** L'arbitrage OS **bat la base** (+2,0 winrate, jamais en-dessous, moins de coups/erreurs) → le mécanisme est **validé** (hypothèse §1.6 confirmée). Mais il **ne bat pas DUAL** (−0,5 winrate, +0,09 err, +0,07 coups — dans le bruit, mais DUAL marginalement devant **sur les 3 critères**) → barrière §6.4 non franchie contre l'incumbent. **Décision (arbitrage humain 16/06) : DUAL reste adopté ; OS-arb gardé OFF-inerte comme alternative propre documentée** (plus fidèle DRC + ~2× plus rapide en wall-clock, mais pas meilleur sur la fitness). UI à câbler pour test manuel.

#### ⚠️ Conflit de SENS des voies (trouvé en confrontant code + intuition Rem) — garde-fou

La voie phon de la **cognition** est **ortho→phon** (`M1_phon_step(cw, rev)` sonorise les **lettres révélées**, cap §43 — direction *lecture*), et l'OS `M_OS_v07_step` qui l'arbitre a un θ appris **réglé pour la lecture** (α≈1,13, β≈0,65). Le **declare/assemblé**, lui, est **phon→ortho** (épellation — la force pendu). Les deux directions coexistent (DRC bidirectionnelle), **mais** un arbitrage OS au niveau declare qui **hériterait du θ de lecture** appliquerait un biais *ortho→phon* à une décision *phon→ortho* = **conflit de sens**. **Corrigé dans le prototype** : `_neoDeclareOSmix` force `α=β=1` (forme analytique neutre, save/restore), **découplé** du θ cognition. **Garde-fou pour la suite : l'arbitrage declare doit avoir son PROPRE (α,β) mesuré, jamais celui de la lecture.**

#### Résultat du balayage (α,β) — CHANTIER CLOS par la mesure (R66, §6.4) — 2026-06-17

Garde-fou ci-dessus levé : `M_NEO_OS_ARB_ALPHA`/`M_NEO_OS_ARB_BETA` ajoutés (OFF-inerte, défaut 1/1 = byte-identique ; `_neoDeclareOSmix` les lit). Balayage in-lexique K=1, 4 graines (warmup 200 / test 100, `node evo/ab_cohort.js arbsweep 200 100 12345,777,2024,99`) :

| sans `currentWord` | winrate | err/p | coups/p | vs DUAL (par graine) |
|---|---|---|---|---|
| **DUAL (incumbent)** | **97,3 %** | **1,79** | **7,86** | — |
| cascade jointe (base) | 95,0 % | 2,08 | 8,14 | −2,3 |
| OS-arb α1 β1 (neutre) | 96,8 % | 1,89 | 7,95 | **−0,5** [−1, 0, 0, −1] |
| OS-arb α1 β0,5 (+lexical) | 96,5 % | 1,90 | 7,96 | **−0,8** [−1, 0, −1, −1] |
| OS-arb α2 β0,5 (+lex. raide) | 96,0 % | 1,89 | 7,95 | **−1,3** [−1, 0, −1, −3] |

**Sanity** : le neutre (1,1) reproduit **96,8 %** pile (= §1.6 ci-dessus) → plomberie (α,β) validée. **Verdict (barrière §6.4) : aucun (α,β) ne bat DUAL, et biaiser vers la voie lexicale (β<1) *dégrade*** (96,5/96,0 < 96,8). L'hypothèse « pencher lexical → rejoindre DUAL » est **falsifiée** : le mélange convexe **par lettre** (`Σ` pondéré de la distribution-lettre cohorte) ne réplique pas la reconnaissance **MAP par mot** de DUAL — ce sont deux mécanismes de niveaux différents. **Le levier (α,β) propre est clos : la cascade + DUAL reste l'optimum mesuré.** Les params restent OFF-inerte (alternative DRC documentée, ~2× plus rapide, mais non meilleure). Plus rien à mesurer côté arbitrage des declares.

---

## 2. Findings structurels (par sévérité)

### 🟠 S1 — Le chemin de décision réel ≠ le récit architectural *(vérifié)*
Les **derniers ~7 pts** (90→97,5) viennent **entièrement de la cascade de declares** (`WORD_DECLARE → BPC_DECLARE → DECLARE_DUAL → EMERGENT → NEO`, 7080–7189) : recall **+1,76**, assemblé **+5,28**, cohorte **+0,5**. Le **concept M3_d, le miroir Möbius, le hub M_S** portent la base cognitive ~90 % mais **rien** du saut declare. Structurellement : *scoreur cognitif modeste + forte cascade de déclaration*. À assumer dans la communication.

### 🟠 S2 — M2_d/M3_d dominés par la longueur *(vérifié)*
- `M3_d_step`:4241 — fix `« encoder depuis M1 (riche), pas M2 (lave) »` → **M2_d lessivé** (ne code que la longueur).
- bPC = autoencodeur de **reconstruction** (4273, `w += LR·a·(m2 − m2hat)`) sur entrée dominée par la longueur, goulot **12 cellules** → effondrement de modes (7/12 mortes).
- `M3_d.output` **norme non bornée** (~8, point fixe Hebbian α/α=8 ; 6383), rustine `normalizeInPlace`.
→ Le concept est **structurellement un détecteur de longueur**, pas un discriminateur de lettres (cause-racine de son inertie ; cf. §3).

### 🟡 S3 — Tissu cicatriciel & code vestigial *(vérifié)*
Monolithe ~11 k lignes + lexique, **87 fonctions** entrelacées, commentaires = historique de patchs (`R41-#1..#11`, `F177/F198/F169`). Exemple : `cStep` étape (5) `pairConv` marqué **« transitoire, sera retiré Jour 6' »** (6393) — jamais retiré. Édition via extraction `/tmp`. **Aucun test ne garde le comportement** (la CI ne teste que la dictée) → risque #1 de régression silencieuse. *Reco : un harnais headless seedé en CI qui `assert` cognition seule ≥ 90 % et +NEO ≥ 97 %.*

### 🟡 S4 — Dérive doc↔code (miroir phon)
La doc dit `M2_phon_m`/`M1_phon_m` « jamais construits » ; l'inventaire montre `M2_phon_m_step`(3865) et `M1_phon_m_step`(3888) **existent**. Soit *existent-mais-non-câblés*, soit doc périmée. À réconcilier (typiquement là que se loge le code mort).

### 🟢 S5 — Discipline OFF-inerte réelle *(vérifié)*
Chaque brique derrière un flag (`if (M_S_ENABLED)`, `if (M_BPC_M3D_ENABLED && M3_d.bpcW)`, `if (m3Ok)`…) ; le toggle **`M3_D_BYPASS` existe** (4292). La baseline-byte-identique est **structurellement crédible** (les flags gardent des blocs, ne patchent pas des sorties). Coût : espace de config combinatoire de 47 flags, peu de présets réellement mesurés.

### 🟡 S6 — Puissance statistique mince
Le 97,5 % = 4 graines × 120 = **480 parties** ; R66 recommande ≥ 200 × 4. Plusieurs Δ pivots sont des mesures uniques. Directions crédibles, marges fragiles (±0,59).

---

## 3. M3_d — diagnostic + piste falsifiable (différente des essais passés)

**Déjà falsifié (ne pas refaire) :** loger le banc épisodique dans M3_d (mur de capacité 12 cellules) ; coupler le readout reward en config pleine (nuit, A2 redondant).

**Diagnostic neuf :** les cellules sont entraînées par **reconstruction** (objectif génératif, 4273) d'une entrée **dominée par la longueur** → elles apprennent la variance dominante (longueur/forme), pas à **discriminer les lettres**. Le readout reward n'a alors aucun signal discriminant → contribution plate. **Objectif mal aligné sur la tâche.**

**Piste (hypothèse, OFF-inerte, cheat-free) :** remplacer l'objectif de reconstruction par une **prédiction masquée** self-supervised : entraîner les 12 cellules à **prédire la lettre d'une position révélée à partir des autres positions révélées** (révélé→révélé, donc montant-légal). Pression discriminative alignée sur la tâche ; le goulot doit encoder la co-occurrence lettre/phonotactique = la « couche morphologique » de la roadmap §10.

**Protocole R66 (contrôle = `M3_D_BYPASS` existant) :**
1. AUC présent/absent de `cLetterScore` actuel (reconstruction) = baseline.
2. Ré-entraîner sur masked-prediction, re-mesurer l'AUC.
3. Si AUC ↑ **et** couplage utile **en config pleine** → M3_d devient contributeur. Si AUC plat → mur 12 cellules confirmé, on **clôt** la question (la familiarité reste dans le banc).

Soit ça marche, soit ça ferme l'incertitude par la mesure.

---

## 4. Synthèse priorisée
1. **Communication** : toujours afficher le régime (« 97,5 % in-lexique, mot entendu » ; repères sans prémisse 70,7 % / 22 %).
2. **g2p** : trancher l'une des 3 options (recommandé : 1 + libellé de régime ; ou 2 pour la pureté pendu — **coût réel après garde : ~0 in-lexique / ~7,5 pts OOV, §1.1**). Option 2 codée OFF-inerte + garde de pureté (`M_NEO_PHON_COHORT_ENABLED` / `_PURITY`).
3. **CI** : harnais seedé gardant 2-3 chiffres clés (anti-régression du monolithe).
4. **M3_d** : tenter la masked-prediction, ou clore par `M3_D_BYPASS` + AUC.
5. **Hygiène** : retirer le vestigial (`pairConv`…), réconcilier la doc miroir phon.

*Tous les points laissent la baseline OFF-inerte (byte-identique au repos). Aucune action de cet audit n'a modifié le moteur.*
