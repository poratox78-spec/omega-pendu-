# OMEGA-Ω — Config de référence & audit des toggles (consolidé)

> **Consolidation (2026-06-19)** de `CONFIG_REFERENCE.md` (preset cheat-free) + `AUDIT_TOGGLES.md` (matrice de triche).
> Critère doctrinal unique de triche : **le code lit-il le mot caché pour DÉCIDER ?** (lecture pour MESURER = légitime
> R67 ; lecture pour DÉCIDER = triche). Source de vérité du preset UI/CI. Mesures : `AUDIT_OMEGA.md`.

---

## 1. Résultat mesuré qui fait foi (in-lexique, harnais déterministe, 4 graines × 120, K séparés)
| Régime | base (cognition seule) | + NEO (R+A+Cohorte) | + DUAL (adopté) |
|---|---|---|---|
| K=1 (généralisation) | 91,46 % | **97,50 % ±0,59** | **99,8 %** (mot-entendu) / **97,3 %** (sans currentWord) |
| K=3 (vocab répété) | 93,75 % | **98,82 % ±0,38** | — |

Cheat-free, **niveau du declare manuel** (~98,8 %). Plafond oracle (exclu par doctrine) = 98,7 %. Muette+trigger = neutres.

## 2. Les 3 sortes de « triche » (à ne pas confondre)
1. **⛔ Triche dure** — lit `currentWord` aux positions **non révélées**, OU le **son du mot entier** (`wp.get(currentWord)`),
   OU une **cohorte qui contient le mot** censé retiré. → fausse le winrate.
2. **🟠 « Mot entendu »** — lit la **phonologie du mot complet** (`wp.get`). Triche pour le **pendu pur**, **légitime** sous
   la prémisse **dictée** (on a entendu le mot).
3. **🔴 Béquille lexicale (grise)** — injecte la **fréquence du dictionnaire** dans le score-lettre. Ne lit pas la réponse,
   mais « connaît le français » au lieu de l'émerger. Impur pour la doctrine.

🟢 = **propre** : ne lit que le **révélé** (info publique) et/ou itère `len_index` (donc **honnête hors-lexique**).

**Méthode (vérifiée code).** Toute la cognition lexicale (`M4_phon_step`, `_DECL2.declare`, InfoGain) itère
`OMEGA_LEX4.len_index` (respecte les retraits Trexquant) et ne lit `currentWord` qu'aux positions **révélées**. Les caches
`_neoWBL`/`_neoWF` étaient l'**exception** (bâtis depuis `words[]`) → fuite cohorte, **corrigée** (`_neoEnsureWBL`, §1.6.1).

## 3. Tableau unifié des toggles — état de référence + statut triche

| Toggle | État réf | Fonction (1 ligne) | Lit le mot caché ? |
|---|---|---|---|
| `L01_A1_M2_ORTHO` | OFF | perception ortho des lettres révélées (socle ortho). | 🔴 béquille |
| `L01_A2_M4_LEX4` | OFF | filtre dico + score lettres par **fréquence** des candidats. | 🔴 béquille (fréquence dico) |
| `L01_A3_M5M_WORDLEX4` | OFF | réinjecte le **mot entier** (Lex4) en descendant. | 🔴 béquille |
| `L01_A4_M4M_DECOMP` | **ON** | signal-mot → pénalités par lettre (descendant). | 🟢 interne |
| `L01_A5_M2M_POSITIONAL` | **ON** | pondère quelles positions comptent (descendant). | 🟢 interne |
| `L01_A6_OS_CONCEPT_ARBITRAGE` | **ON** | l'OS arbitre entre concepts des voies. | 🟢 interne |
| `L01_B2_MOBIUS` | OFF | couplage croisé ortho↔phon. | 🟢 interne |
| `M5_D_M1_M` | OFF (défaut) | co-décision M1_m = prior de fréquence (0,1). | 🟢 (falsifié §1.4.1) |
| `M_VOIE_PHON` | **ON** | voie phonologique SAMPA (double voie DRC). | 🟢 `len_index` + révélé |
| `M_OS_V07` | **ON** | l'OS v07 combine ortho+phon et pilote. | 🟢 interne |
| `M4_PHON_USE_P` | **ON** | M4_phon mélange un prior phonétique (champ p du candidat). | 🟢 |
| `M_SUBSTRAT_ORTHO_PURE` | **ON** | substrat ortho 40D indépendant. | 🟢 interne |
| `M_PHON_FEEDBACK` | **ON** | retour descendant phon (M4 effectif). | 🟢 interne |
| `M_WORD_DECLARE` | OFF | déclare si révélé + ratées ne laissent qu'un candidat. | 🟢 cohorte `len_index` |
| `M_IG_SELECT` / `M_IG_PSUCCESS` | OFF | InfoGain (lettre la plus discriminante) ± P(succès). | 🟢 `len_index` + révélé |
| `M_BPC_M3D` | **ON** | autoencodeur concept (perçoit en interne). | 🟢 interne |
| `M_BPC_READOUT_COUPLE` | **ON** | injecte le score-lettre appris par récompense (rwR, **+3,4 §3.1**). | 🟢 (appris du reward) |
| `M_PHON_READOUT_COUPLE` | **ON** | idem côté phon. | 🟢 |
| `M_PHON_CONCEPT_BIND` | **ON** | readout phon sur concept lié aux révélées. | 🟢 revealed-aware |
| `M_BPC_DECLARE` | OFF | déclare via le concept M3_d (cLetterScore). | 🟢 (sans `currentWord`) |
| `M_DECLARE_DUAL` | **ON** (preset) | declare niveau-mot : cohorte board × freq × ortho × phon. **Adopté 16/06**. | 🟢 `len_index` + révélé, OOV-honnête |
| `M_LEARN_FROM_COGNITION` | OFF | les apprenants apprennent de la lettre cognitive. | 🟢 apprentissage |
| `M_OS_LEARNING` (+ 4 gardes) | **ON** | autorise l'OS à apprendre θ=(α,β) (borné·audit·MDL·cohérence). | 🟢 apprentissage |
| `M_OS_LEARNING_ONLINE` | OFF | SPSA en ligne. **Mesuré : aucun gain + dérive** → OFF. | 🟢 (mais nuit) |
| `M_EMERGENT_DECLARE` | OFF | recall VSA : board révélé vs banc. | 🟢 révélé + banc |
| `M_EMERGENT_ASSEMBLED` | OFF | décode phon→ortho via `w.p`. | 🟠 mot entendu (`wp.get`) |
| `M_EMERGENT_G2P_ONLINE` | OFF | g2p appris en jouant (post-partie). | 🟢 apprentissage |
| `M_DECLARE_NEO` (maître) | **ON** | recall + assemblé + cohorte (+ muette/trigger). | 🟢 **ssi** cohorte/board-dérivé ON |
| `M_NEO_RECALL` | **ON** | recall adressée : board révélé + banc. | 🟢 |
| `M_NEO_ASSEMBLED` | **ON** | décode positions sonores (phon→ortho masqué). | ⚠️ 🟢 si `M_NEO_PHON_COHORT` ON ; 🟠 si OFF (`wp.get`) |
| `M_NEO_COHORT` | **ON** | filtre : lettre autorisée si ≥1 mot board-compatible. | 🟢 (corrigé `_neoEnsureWBL`) |
| `M_NEO_PHON_COHORT` | OFF (bleu) | son **board-dérivé** (consensus cohorte) au lieu de `wp.get`. | 🟢 (c'était LA fuite — corrigé) |
| `M_NEO_PHON_COHORT_JOINTE` | OFF (bleu) | jointe P(lettre\|phonème cohorte, voisins révélés). | 🟢 (corrigé) — *adoption rouverte §1.4.4* |
| `M_NEO_OS_ARB` | OFF (bleu) | mélange convexe sublexical⟷lexical (cohorte). | 🟢 (corrigé) |
| `M_NEO_G2P_EXP` | **ON** | g2p **révélé-seul** + pénalité 0,5 (cheat-free strict). | 🟢 apprentissage (révélé only) |
| `M_NEO_MUTE` / `M_NEO_TRIGGER` | OFF | muette par le son (croisée) ; trigger = gate sur l'incertitude. | 🟢 (neutres, cf. MOTEUR_HISTORIQUE §D) |
| `M_NEO_LETTER_NGRAM` | OFF (OOV) | n-gram de lettres pré-calculé du lexique (cascade OOV-only). | 🟢 agrégation lexique |
| `M_NEO_OS_ARB_NGRAM` | OFF (OOV) | n-gram = voie sublexicale de l'arbitrage OS (auto-régime). | 🟢 |
| `M_NEO_NGRAM_GAP` | OFF (OOV) | n-gram **gap-aware** (plus proche voisin révélé d=1..4). | 🟢 |
| `M_NEO_C_HEAVY` | OFF | C lourd (transformer) en voie sublexicale. **Mesuré §1.12 : parité, non câblé.** | 🟢 (poids `_neoHeavyC` null par défaut = inerte) |
| `M_TREXQUANT_MODE` | OFF | retire le mot du lexique → test hors-lexique (honnête après fix). | mode test |

> **Décompte** : ~41 toggles bascule + paramètres. Tout **OFF par défaut au boot** sauf `M4_PHON_USE_P` ; le preset
> ci-dessus allume la config cheat-free. Repère couleur UI : 🟢 optimale · 🔵 cheat-free optionnel · 🟠 lit le son du mot ·
> 🔴 triche grise (A1/A2/A3).

## 4. Interactions importantes
- **Cascade des declares** = **priorité fixe**, pas un arbitrage : `DUAL → émergent → NEO(recall → OS-arb → assemblé/jointe
  → muette)`. Le **dernier qui parle gagne** (`_neoDone` bloque la suite dans NEO). Donc `DUAL+OS-arb = OS-arb`.
- **`M_NEO_ASSEMBLED` × `M_NEO_PHON_COHORT`** : le 2e fait basculer le 1er de 🟠 (mot entendu) à 🟢 (board-dérivé) — seul couple
  qui change la **nature cheat** d'un toggle.
- **Cohorte (36-39)** : toutes passaient par le cache `_neoWBL` fuyard → leurs chiffres **OOV** étaient faux (in-lexique
  déguisé). **Corrigé** ; l'in-lexique n'est pas affecté.
- **θ × gardes × online** : online OFF → θ n'apprend pas en live (voulu, online dégrade) ; le batch Train θ reste possible.

## 5. Preset UI cheat-free (par libellé affiché)
**ON** : A4 · A5 · A6 · φ Voie Phon · φ OS v07 · φ Croisement p · φ Substrat pur · φ Feedback ↓ · bPC M3_d · Couplage
readout · Couplage readout φ · Concept lié φ · θ Apprentissage + 4 gardes · 🧩 Declare NEO maître · 🔁 recall · 🧬 assemblé
· 🎯 cohorte · 🧪 g2p révélé (pén 0,5) · 🦴 Declare DUAL.
**OFF** : θ EN LIGNE · A1/A2/A3 · B2 · 🎯 Declare mot · 🧠 InfoGain · IG×P(succès) · 🎯 Declare BPC · 🧠 Apprendre depuis
cognition · declares émergents · g2p online · 🔇 muette · 🎚️ trigger · 🎯 Mode Trexquant.
Paramètres : `NEO_CONF=0,75` · `RECALL_MARGIN=0,20` · `G2P_EXP_PEN=0,5` · DUAL `CONF=0,85`/`WORTHO=0,50`/`WPHON=0,25`.

**g2p révélé + pénalité (adopté 14/06)** : `learnExp` n'apprend que des positions révélées (≠ mot complet) + pénalité
bornée. Falsification : ancien 98,9 % · révélé-seul sans pénalité 98,3 % · révélé-seul + pén 0,5 = **98,9 %** → adopté
(plus propre, sans coût). **DUAL adopté 16/06** (détail §1.5) : +1,8 → 99,8 % mot-entendu / +2,5 → 97,3 % sans currentWord ;
reconnaissance in-lexique (OOV inchangé). Défaut moteur OFF (baseline byte-identique), activé dans le preset.

---

## 6. Config OOV / Trexquant — la VOIE N-GRAM (recommandée hors-lexique)

> ⛔ **Rétraction (2026-06-18, §1.6.1)** : les chiffres « OOV ~97 % / OS-arb » antérieurs étaient une **fuite cohorte**
> (`_neoWBL` non invalidé). **Vrai OOV ≈ 33 %** sans n-gram (cohorte reconstruite sans les mots-test). Corrigé.

La généralisation hors-lexique vient de l'**AGRÉGATION** (stats du lexique), PAS de la cognition (~11 % seule) ni de
l'apprentissage-par-jeu (`AUDIT_OMEGA §1.7/§1.8`).
- **🔠 `M_NEO_LETTER_NGRAM`** : n-gram positionnel de lettres pré-calculé du lexique (cascade OOV-only). **N=400 : 50→66 %
  (+16 pts)**. Mais **OFF en jeu normal** (écrase la cohorte qui a le mot : in-lex 97,5 → 69,5 %).
- **🔁 `M_NEO_OS_ARB_NGRAM`** (le fix « pas de switch ») : le n-gram devient la **voie sublexicale** d'un mélange convexe OS
  avec la cohorte board ; la fiabilité **bascule auto par régime**. Activation : `M_NEO_OS_ARB + M_NEO_OS_ARB_NGRAM`.
  **Mesuré (N=400) : in-lex 96-99 % (≈ cohorte) · OOV 52-63 % (≈ cascade).** Meilleur/égal dans les 2 régimes, config unique
  → **recommandé** à la place de la cascade (activable sans risque même si on ignore si le mot est in-lex).
- **🧩 `M_NEO_NGRAM_GAP`** (C, 1er gain cognitif > substrat) : utilise le **plus proche voisin révélé à distance 1..4**.
  **Mesuré : OOV +2 pts (~63-65 %, bande SOTA), in-lex coût nul.** Falsifié avant lui (ne pas refaire) : lissage par
  substrat `letterVecsSDIM`, pooling position-relative.
- **🧪 `M_NEO_C_HEAVY`** (transformer appris) : **mesuré §1.12 — parité avec gap-aware** (ne le bat pas ; entraîné sur états
  réels = recul par couverture). **Non câblé** ; hook OFF-inerte (poids `_neoHeavyC` null).

α,β défaut 1/1. Tous **OFF par défaut** (R66). Bench Trexquant in-app : lignes « n-gram cascade / OS-arb / + gap-aware ».
Persistance IndexedDB de la table = prématurée (réservée à une table apprise future justifiée). Repères SOTA : `docs/HANGMAN_SOTA.md`.
