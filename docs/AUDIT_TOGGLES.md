# Audit COMPLET des toggles OMEGA-Ω — fonction · interactions · TRICHE — 2026-06-18

> Demandé par Rem après la découverte que « 97 % Trexquant » était une **fuite** (`AUDIT_OMEGA §1.6.1`).
> Ce document audite **les 43 toggles** sur le seul critère qui tranche la triche : **le code lit-il le mot caché
> pour DÉCIDER ?** (lecture pour MESURER = légitime, R67 ; lecture pour DÉCIDER = triche, doctrine §0).

## Les 3 sortes de « triche » (à ne pas confondre)
1. **⛔ Triche dure (lit la réponse)** — lit `currentWord` aux positions **non révélées**, OU le **son du mot entier**
   (`wp.get(currentWord)`), OU une **cohorte qui contient le mot** censé être retiré. → fausse le winrate.
2. **🟠 « Mot entendu »** — lit la **phonologie du mot complet** (`wp.get`). Triche pour le **pendu pur** (on ne voit
   que des cases), **légitime** sous la prémisse **dictée** (on a entendu le mot). C'est l'entrée du sous-projet dictée.
3. **🔴 Béquille lexicale (grise)** — injecte la **fréquence du dictionnaire** dans le score-lettre. Ne lit PAS la
   réponse, mais « connaît le français » au lieu de l'émerger. Normal pour un solveur lexical ; impur pour la doctrine.

🟢 = **propre** : ne lit que le **révélé** (info publique) et/ou itère `len_index` (donc **honnête hors-lexique**).

## Méthode (vérifiée dans le code)
Toute la **cognition lexicale** (`M4_phon_step` 3532, `_DECL2.declare` 6348, InfoGain 5907) itère **`OMEGA_LEX4.len_index`**
(respecte les retraits Trexquant) et ne lit `currentWord` qu'aux positions **révélées** (« info publique »). Les
caches `_neoWBL`/`_neoWF` étaient l'**exception** (bâtis depuis `words[]`) → fuite cohorte, **corrigée** (`_neoEnsureWBL`).

## Tableau des 43 toggles

| # | Toggle | Fonction (1 ligne) | Lit le mot caché ? |
|---|---|---|---|
| 1 | `L01_A1_M2_ORTHO` | Perception ortho des lettres **révélées** (socle voie ortho). | 🔴 béquille (socle lexical ; OFF réf.) |
| 2 | `L01_A2_M4_LEX4` | Filtre dico + score lettres par **fréquence** des candidats. | 🔴 béquille (fréquence dico ; OFF réf.) |
| 3 | `L01_A3_M5M_WORDLEX4` | Réinjecte la connaissance du **mot entier** (Lex4) en descendant. | 🔴 béquille (OFF réf.) |
| 4 | `L01_A4_M4M_DECOMP` | Signal-mot → pénalités **par lettre** (descendant). | 🟢 interne |
| 5 | `L01_A5_M2M_POSITIONAL` | Pondère **quelles positions** comptent (descendant). | 🟢 interne |
| 6 | `L01_A6_OS_CONCEPT_ARBITRAGE` | L'OS arbitre entre concepts des voies → lettre finale. | 🟢 interne |
| 7 | `L01_B2_MOBIUS` | Couplage croisé ortho↔phon (Möbius). | 🟢 interne |
| 8 | `M5_D_M1_M` | Co-décision M1_m = **prior de fréquence** (poids 0,1). | 🟢 (ne lit jamais `currentWord`, vérifié 5179/5621) |
| 9 | `M_VOIE_PHON` | Voie phonologique SAMPA (double voie DRC). | 🟢 `len_index` + révélé (3532/3544) |
| 10 | `M_OS_V07` | L'OS v07 combine ortho+phon et **pilote** la décision. | 🟢 interne |
| 11 | `M4_PHON_USE_P` | M4_phon mélange un prior **phonétique réel** (champ p). | 🟢 (p = propriété du candidat, pas du mot caché) |
| 12 | `M_SUBSTRAT_ORTHO_PURE` | Substrat ortho 40D indépendant. | 🟢 interne |
| 13 | `M_PHON_FEEDBACK` | Retour descendant phon (M4 effectif). | 🟢 interne |
| 14 | `M_WORD_DECLARE` | Déclare si le révélé + ratées ne laissent **qu'un** candidat. | 🟢 cohorte `len_index`, révélé only |
| 15 | `M_IG_SELECT` | InfoGain : lettre qui discrimine le plus la cohorte. | 🟢 `len_index` + révélé (5907/5911) |
| 16 | `M_IG_PSUCCESS` | Pondère l'InfoGain par P(succès). | 🟢 (modifie 15) |
| 17 | `M_BPC_M3D` | Autoencodeur concept (perçoit le mot en **interne**). | 🟢 interne (M1_d ne lit pas le caché) |
| 18 | `M_BPC_READOUT_COUPLE` | Injecte le score-lettre **appris par récompense** (rwR). | 🟢 (appris du reward hit/miss, pas du mot) |
| 19 | `M_PHON_READOUT_COUPLE` | Idem côté phon (R_phon). | 🟢 |
| 20 | `M_PHON_CONCEPT_BIND` | Readout phon sur concept **lié aux révélées** (permutation). | 🟢 **revealed-aware** (4356) |
| 21 | `M_BPC_DECLARE` | Déclare un mot via le concept M3_d (cLetterScore). | 🟢 (cLetterScore via M1_d, sans `currentWord`) |
| 22 | `M_DECLARE_DUAL` | Declare niveau-mot : cohorte board × freq × ortho × phon. | 🟢 `len_index` + révélé (6348/6355), **OOV-honnête** |
| 23 | `M_LEARN_FROM_COGNITION` | Les apprenants apprennent de la lettre **cognitive**. | 🟢 apprentissage |
| 24 | `M_OS_LEARNING` (maître) | Autorise l'OS à apprendre θ=(α,β). | 🟢 apprentissage |
| 25–28 | `M_OS_LEARNING_GUARD_1..4` | Gardes θ (borné · audit · MDL · cohérence). | 🟢 apprentissage (sécurité) |
| 29 | `M_OS_LEARNING_ONLINE` | SPSA en ligne par partie. **Mesuré : dégrade (dérive)** → OFF. | 🟢 apprentissage (mais nuit) |
| 30 | `M_EMERGENT_DECLARE` | Recall VSA : board **révélé** vs banc des mots vécus. | 🟢 révélé + banc (post-game) |
| 31 | `M_EMERGENT_ASSEMBLED` | Décode phon→ortho via `w.p` du mot. | 🟠 **mot entendu** (`wp.get(currentWord)` 7215) |
| 32 | `M_EMERGENT_G2P_ONLINE` | g2p appris **en jouant** (post-partie). | 🟢 apprentissage |
| 33 | `M_DECLARE_NEO` (maître) | Recall + Assemblé + Cohorte + Muette + Trigger. | 🟢 **ssi** cohorte ON (sinon via #35 → 🟠) |
| 34 | `M_NEO_RECALL` | Recall adressée : board **révélé** + banc. | 🟢 révélé + banc |
| 35 | `M_NEO_ASSEMBLED` | Décode les positions sonores (phon→ortho masqué). | ⚠️ **🟢 si `M_NEO_PHON_COHORT` ON** ; 🟠 si OFF (`wp.get` 7257) |
| 36 | `M_NEO_COHORT` | Filtre : lettre autorisée si ≥1 mot board-compatible la porte. | 🟢 **(corrigé)** `_neoEnsureWBL`←`len_index` |
| 37 | `M_NEO_PHON_COHORT` | Son **board-dérivé** (consensus cohorte) au lieu de `wp.get`. | 🟢 **(c'était LA fuite — corrigé)** |
| 38 | `M_NEO_PHON_COHORT_JOINTE` | Jointe P(lettre\|phonème cohorte, voisins révélés). | 🟢 **(même fuite — corrigé)** |
| 39 | `M_NEO_OS_ARB` | Mélange convexe sublexical⟷lexical (cohorte). | 🟢 **(même fuite — corrigé)** |
| 40 | `M_NEO_G2P_EXP` | g2p **révélé-seul** + pénalité (cheat-free strict). | 🟢 apprentissage (révélé only) |
| 41 | `M_NEO_MUTE` | Positions muettes prédites par phonogramme croisé. | 🟢 décision via cohorte (si ON) ; apprentissage post-game lit le son complet (descendant) |
| 42 | `M_NEO_TRIGGER` | La muette n'override que si la cognition est **incertaine**. | 🟢 (gate) |
| 43 | `M_TREXQUANT_MODE` | Retire le mot du lexique → test **hors-lexique**. | mode test (était bidon via fuite ; **corrigé** → honnête, vrai OOV ~33 %) |

## Interactions importantes
- **Cascade des declares** (`omega-pendu.html:7187-7291`) = **priorité fixe**, pas un arbitrage : `DUAL → émergent →
  NEO( recall → OS-arb → assemblé/jointe → muette )`. Le **dernier qui parle gagne** ; `_neoDone` bloque la suite
  dans le bloc NEO. Donc `DUAL+OS-arb = OS-arb` (NEO écrase DUAL). Un declare ON peut en **masquer** un autre.
- **`M_NEO_ASSEMBLED` × `M_NEO_PHON_COHORT`** : le 2e fait basculer le 1er de 🟠 (mot entendu) à 🟢 (board-dérivé).
  C'est le seul couple qui change la **nature cheat** d'un toggle.
- **Cohorte (36/37/38/39)** : toutes passaient par le cache `_neoWBL` fuyard → leurs chiffres **OOV** étaient faux
  (in-lexique déguisé). **Corrigé** ; le **in-lexique** de ces toggles n'est pas affecté.
- **θ (24) × gardes (25-28) × online (29)** : online OFF → θ n'apprend pas en live (gardes inertes) ; c'est voulu
  (online **dégrade**, mesuré). Le batch Train θ reste possible.

## Verdict pour la config de Rem (capture)
Cognition ON (A4/A5/A6, φ·*, bPC, couplages) + NEO (maître, recall, assemblé, **son board-dérivé**, jointe, OS-arb,
muette, trigger) ; A1/A2/A3 OFF ; DUAL OFF ; online OFF.
- **Après le fix**, cette config est **propre pour la DÉCISION** (aucune lecture de la réponse) : l'assemblé est en
  mode board-dérivé (🟢) ; la muette décide via la cohorte (🟢) ; pas de béquille A1/A2/A3.
- **In-lexique** (jeu normal) : ~96-99 % = **vrai** (pendu lexical légitime).
- **Hors-lexique** (Trexquant) : ~**33 %** = la vraie généralisation sublexicale (le « 97 % » était la fuite).
- Reste **🟠 latent** : si on éteint `M_NEO_PHON_COHORT`, l'assemblé NEO lit `wp.get(currentWord)` (mot entendu) — à
  garder ON pour rester pendu-pur.
