# OMEGA-Ω — Une architecture cognitive pour le pendu français

> *🇬🇧 [English version](README.en.md)*
>
> *Comment une machine peut jouer au pendu en **raisonnant** plutôt qu'en **lisant la réponse**.*
>
> *A cognitive architecture that plays French Hangman by reasoning, not by dictionary lookup.*

OMEGA-Ω est un moteur de pendu français (mots ≥ 7 lettres) bâti non comme un chercheur de
dictionnaire, mais comme une **architecture cognitive** sous une contrainte fondatrice —
**« cognition > oracle »** : aucun module ne lit le mot caché ailleurs qu'aux positions révélées.

> 🌐 **Site en ligne : [poratox78-spec.github.io/omega-pendu-](https://poratox78-spec.github.io/omega-pendu-/)** — la vitrine du **solveur de pendu**, plus les **outils de mots** dérivés (correcteur dys, dictée diagnostique, solveur de Scrabble *Scrabidon*) et les pages de **recherche** (méthode, évolution, résultats O1/O2).

## Résultat en un coup d'œil

| Régime | Réussite | Note |
|---|---|---|
| Cognition cheat-free seule | ~90 % | sans lire le dictionnaire pour scorer une lettre |
| **+ déclaration émergente (NEO)**, in-lexique | **97,5 % – 98,8 %** | au niveau des meilleurs solveurs lexicaux |
| Hors-lexique — cognition seule | ≈ 11 % | ne généralise **pas** en sous-lexical |
| Hors-lexique — orthographe sous-lexicale pure | ≈ 33 % | la vraie faiblesse (à construire : couche morpho) |
| Hors-lexique **cheat-free** — voie **n-gram d'agrégation** (~62 %) + **gap-aware** | **≈ 64 %** | bande SOTA ; +17 pts vs n-gram naïf (cf. tête-à-tête). *Premier gain cognitif réel au-dessus du substrat statistique* |
| Plafond oracle (lexique complet) | 98,7 % | la cible *exclue* par doctrine |

> *Nuance d'honnêteté : le 97,5 % cheat-free vaut pour le **scoring-lettre** (aucun lookup dictionnaire pour choisir une lettre). La voie de déclaration « assemblée » lit le **son** du mot cible (`w.p`, prémisse « mot entendu », légitime en dictée) ; pour un cheat-free **intégral** sans aucune lecture du mot, activer la cohorte board-dérivée (rapport §17.5).*
>
> *✓ **Stats revérifiées (06/2026)** en exécutant le bench du moteur lui-même (`_omega_trexquant_bench`, 3 graines, dans l'app) : in-lexique **~99 %**, OOV **gap-aware 64 % — stable sur les 3 graines** (bande SOTA, bons solveurs sans son 65-68 %). Mesure indépendante, cohérente avec le tableau.*

La contribution n'est **pas** un record de winrate (les solveurs lexicaux égalent le score
in-lexique) — c'est une **méthode** : mesurer avant de croire, falsifier avant de garder,
distinguer la cognition de l'oracle ; et une cartographie de ce qui généralise (la séquence
phon→ortho) et de ce qui se heurte à des murs (la capacité du concept).

### Tête-à-tête sur le même jeu OOV (mesuré 06/2026)

Comparaison *contrôlée* — mêmes mots hors-lexique, mêmes graines (12345/777/2024), budget 6 —
en relançant le moteur réel **et** un étalon n-gram standalone sur le jeu identique :

| Solveur (même jeu OOV) | Réussite |
|---|---|
| Étalon n-gram (trigramme + backoff) | 46,7 % |
| OMEGA — cohorte lexicale, held-out | 24 % |
| **OMEGA — agrégation n-gram + gap-aware (cheat-free)** | **64 %** |

**Ce que ça valide vraiment :**

- ✅ **La méthode bat un étalon statistique propre** sur l'OOV français (+17 pts, même jeu). Validation directe de l'apport cognitif.
- ✅ **Reproductible** (64 % stable 3/3 graines) et **cheat-free** (l'étalon, lui, exploite le dico en plein).
- ⚠️ **Plafond honnête** : mon étalon est un trigramme standard, *pas* le SOTA ML (LSTM/transformer entraînés). Un modèle plus lourd réduirait l'écart. Donc « bat les solveurs standards » : **prouvé**. « Bat les tout meilleurs ML » : **non testé** (il faudrait en faire tourner un).

**Et le point ressources** — il est juste, et c'est là qu'il pèse. Les solveurs qui montent à 65-68 %, ce sont des réseaux entraînés sur GPU, avec pipeline d'entraînement et corpus massif. OMEGA atteint 64 % dans un seul fichier HTML, sans entraînement, sans GPU, dans un onglet. La bonne formulation n'est donc pas « il gagne plus », c'est : **performance comparable aux meilleurs, à une fraction des ressources — et supérieure nette aux solveurs standards.** Ça, c'est défendable et mesuré.

> **Verdict :** méthode validée comme reproductible, cheat-free, mesurablement meilleure qu'un étalon standard, et compétitive avec le ML lourd pour un coût sans commune mesure. Le seul « non » restant — *strictement* battre le meilleur ML — demande un duel contre un vrai réseau, que je ne peux pas monter ici.

## Lancer l'application

Ouvrir **`app/omega-pendu.html`** dans n'importe quel navigateur. Application monolithique
autonome (code + lexique inlinés), aucun serveur, aucune dépendance.

> ⚠️ **Au démarrage, tous les interrupteurs sont OFF** (le moteur joue alors à ≈ 2,6 %). Cliquez
> **« ⚙️ Config optimale »** (preset cheat-free, rapport §8.3) **avant** ▶ Start / ▶▶ Auto.

- **▶ Start** lance une partie (mot saisi, ou aléatoire si vide).
- **⚙️ Config optimale** active la configuration cheat-free de référence (≈ 97,5 % in-lexique).
- Le panneau de bascules compose la configuration cognitive (voies ortho/phon, OS, bPC, déclarations…).
- **🎯 Mode Trexquant (hors-lexique)** : quand il est ON, chaque nouvelle partie retire le mot tiré
  du dictionnaire interne (cohorte et recall aveugles) → on regarde OMEGA résoudre du **vrai mot neuf**
  par généralisation phon→ortho. Lexique restauré au tour suivant.
- Panneau **Bench → 🎯 Trexquant** : mesure le taux de réussite hors-lexique sur un lot de mots.

## Documents

- **`docs/MEMOIRE.html`** — le mémoire de recherche & d'ingénierie (thèse, architecture, méthode,
  résultats positifs **et** négatifs, travaux liés, références). *Le document à lire / publier.*
- **`docs/rapport-mode-emploi.html`** — le rapport de référence & mode d'emploi (interrupteurs,
  régimes, cadre anti-triche, état & limites).
- **`notes/`** — notes de session sourcées : système NEO (changelog, décomposition brique-par-brique,
  croisement de la voie muette) et le résultat négatif documenté (reconnexion M3_d falsifiée).

## Aussi dans ce dépôt — OMEGA·KEY

Le dossier [**`omega-key/`**](omega-key/) contient un projet dérivé : une **messagerie chiffrée de bout en bout**
dans un seul fichier HTML (passphrases françaises, AES-GCM-256, Double Ratchet DH, relais optionnel).
Il réutilise le substrat OMEGA comme source d'identité/entropie et confie toute la cryptographie à WebCrypto.
Voir [`omega-key/README.md`](omega-key/README.md) et le rapport [`omega-key/docs/RAPPORT_MODE_EMPLOI.html`](omega-key/docs/RAPPORT_MODE_EMPLOI.html).

## Aussi dans ce dépôt — Correcteur dys (dictée + extension)

La **double voie** d'OMEGA appliquée à l'écrit : un **correcteur dys** hors-ligne (grammaire + orthographe
non-mots/accents/typos, **FP=0**, en **parité** Python ↔ app ↔ extension), avec **aide-frappe** (complétion accentuée
du mot en cours) et une **boucle d'apprentissage** (profil dys unifié → dictée adaptative → courbe de progrès).
**Deux niveaux de soulignement** : *rouge* = corrections **FP=0** ; **🟢 vert** = *vigilance* sur les mots **confusables** (homophones + paronymes, ~80 groupes curés de Lexique), qui **n'affirme pas** de faute — il propose les possibilités & le sens (le distributionnel sert à *ordonner/atténuer*, jamais à trancher).
- **Rouge (FP=0)** : **accord sujet-verbe**, genre, **pluriel & singulier du nom** (déterminant + nom : « les enfant »→enfants, « le camps »→camp), é/er, leur/leurs, **homophones grammaticaux** (a/à, on/ont, son/sont, mais/mes, et/est, ce/se, peu — tranchés par la **syntaxe** : sujet, accord, cadre auxiliaire « a/ont + participe », pronoms collés, frontières), **usage être↔avoir** (« il est faim »→« il a faim », « il a allé »→« il est allé »), **auxiliaire mal orthographié** (« vous ete »→« êtes »), **majuscule** de début de phrase. **Vert (vigilance)** : confusables + **run-on** (ponctuation manquante). *Le FP=0 des homophones est tenu par la grammaire, pas par une démotion en vert — vérifié par un audit à l'échelle (corpus UD, 14 450 phrases : 4,70 %→1,73 % de flags rouges, dont une partie sont de vraies fautes détectées ; garde-fou CI `fp_scale_probe`), puis **re-validé sur un corpus de VRAIES fautes FR** (WiCoPaCo, ~45 k erreurs réelles avec contexte) : il a révélé **3 FP invisibles sur l'UD curé** (on/ont en tête de proposition, a/à + participe féminin, genre « un son ») — **corrigés** — et un **levier de recall** (accord singulier du nom, +435 corrections réelles), tous en parité 3 moteurs.*
- Dans l'app `app/omega-pendu.html` : panneaux **🩹 Correcteur** et **✍️ Dictée diag**.
- Partout sur le web : [`extension/`](extension/) (Chrome MV3) — voir [`extension/README.md`](extension/README.md).
- Feuille de route & état : [`DICTEE_ROADMAP.md`](DICTEE_ROADMAP.md) · journal : [`dictee/JOURNAL.md`](dictee/JOURNAL.md).

## Doctrine & méthode

- **Cap §43 (cognition > oracle)** : les modules cognitifs ne lisent `currentWord` qu'aux positions
  révélées (sens montant = décider). L'apprentissage post-partie (sens descendant) voit le mot complet.
- **Lexique** : interdit dans le scoring-lettre ; autorisé pour le *DECLARE par cohorte* (board-dérivé)
  et l'apprentissage post-partie. Les interrupteurs `A1/A2/A3` (injection de fréquence lexicale) sont OFF.
- **R66** : aucun module activé par défaut sans test de falsification (bypass + statistiques appariées,
  multi-graines, harnais déterministe).

## Architecture (résumé)

Double pipeline en Möbius sur un substrat **hyperdimensionnel** (HRR/VSA, 1024D concept / 512D lexical) ;
cinq niveaux montants M1→M5 ; **double route** orthographique + phonologique (SAMPA) arbitrée par un OS ;
concept M3_d en **codage prédictif bidirectionnel** ; déclarations émergentes (recall / assemblé phon→ortho /
cohorte). Détails dans le mémoire.

## Références

1. Coltheart, M., Rastle, K., Perry, C., Langdon, R., & Ziegler, J. (2001). *DRC: A Dual Route Cascaded Model of Visual Word Recognition and Reading Aloud.* Psychological Review, 108(1), 204–256.
2. Frady, E. P., Kent, S. J., Olshausen, B. A., & Sommer, F. T. (2020). *Resonator Networks…* Neural Computation, 32(12).
3. Kanerva, P. (2009). *Hyperdimensional Computing…* Cognitive Computation, 1(2), 139–159.
4. McClelland, J. L., McNaughton, B. L., & O'Reilly, R. C. (1995). *Why There Are Complementary Learning Systems in the Hippocampus and Neocortex.* Psychological Review, 102(3), 419–457.
5. Plate, T. A. (1995). *Holographic Reduced Representations.* IEEE Transactions on Neural Networks, 6(3), 623–641.
6. Qiu, S., Bhattacharyya, S., Coyle, D., & Dora, S. (2025). *Deep Predictive Coding with Bi-directional Propagation for Classification and Reconstruction.* Neural Networks, 191, 107785.

## Crédits

Direction et conception : **Rem**. Assistance d'ingénierie et rédaction : **Claude (Anthropic)**.

## Licence

Régime double :

- **Code** (moteur, UI, docs rédigées) : © Rem — sous **MIT** (voir [`LICENSE`](LICENSE)).
- **Données lexicales** (base Lexique embarquée dans `app/omega-pendu.html`) :
  **Creative Commons Attribution – ShareAlike 4.0 (CC BY-SA 4.0)**, © New, Pallier et al.,
  [www.lexique.org](https://www.lexique.org). **Attribution requise · Partage à l'identique obligatoire.**

Voir le fichier [`NOTICE`](NOTICE) pour l'attribution complète.

> Réutilisation : libre, **y compris commerciale**, avec attribution **et** partage des dérivés
> sous CC BY-SA 4.0. Pour passer l'app sous une licence non-SA (ex. MIT pur), il faudrait
> remplacer la base lexicale par une source compatible.

---
*Instantané 07/2026 · moteur build phase47 · site déployé (pendu · correcteur · dictée · Scrabidon · recherche · évolution) · recherche O1/O2 close · correcteur re-validé sur WiCoPaCo (~45 k vraies fautes FR) : 3 FP homophones corrigés + 4 leviers de recall (~960 corrections) — « accord singulier du nom » (+435), « participe après être à sujet nom » (+405), « terminaisons -er/-é/-ez » (+57), « accord adjectif épithète » (+114, le genre-adjectif enfin FP=0 grâce au POS-tagger) — FP=0 préservé, parité 3 moteurs. Puis confronté à un **corpus dys RÉEL** (78 textes, analyse Bodard 2020) qui valide la direction (43 % des fautes dys sont phonétiques → le canal phon est central, 38 % grammaticales → notre campagne vise juste) et ouvre la **fusion d'élision** (« lhopital »→l'hôpital, « dargen »→d'argent, classe dys absente de Wikipédia ; FP élision 10→7 sur UD).*


## Aussi dans ce dépôt

- [**`dictee/`**](dictee/) — **dictée diagnostique** (cible *dys / troubles de l'écrit*) bâtie sur la double route d'OMEGA : dictée de phrases, diagnostic multi-étiquette (accent · sourde/sonore · muette · ajout · inversion · homophone · accord · surface) + remédiation. Intégrée dans `app/omega-pendu.html` (panneau « ✍️ Dictée diag »). Voir [`dictee/README.md`](dictee/README.md), [`DICTEE_ROADMAP.md`](DICTEE_ROADMAP.md).
- [**`evo/`**](evo/) — *workstream EVO* : OMEGA **évolue** (P1 se copie byte-exact · P2 communiquent · P3 générations sous sélection, **+14 pt OOV**). **O1** (travail de groupe) : clos **négatif** — de vraies versions sont trop fortes & semblables, la coordination utile est déjà l'arbitrage interne du moteur. **O2** (multi-usage) : le substrat est un **compresseur de structure domaine-agnostique** — il compresse le **code** aussi bien que le français (et rien sur du brouillé), *capture de structure, pas compréhension* ; et le « sens » distributionnel est **recalé par la doctrine FP=0** (mesuré). Tout rejouable. Voir [`evo/EVO_ROADMAP.md`](evo/EVO_ROADMAP.md).
- Audit transverse : `CLAUDE.md` (§ Audit projet).
