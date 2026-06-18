# Probe — pendu de PHRASES + prior d'accord : est-ce que ça vaut le coup ?

> Expérience falsifiable (cap §1, §4, §6) lancée pour trancher l'idée « pendu de phrases plutôt que de mots,
> ce qui ferait d'OMEGA un objet unique ». Code : `evo/phrase_hangman_probe.py` (`python3 evo/phrase_hangman_probe.py`).
> Autonome (réutilise le levier grammaire de `dictee/diag_sentence.py`, doctrine §5 ; pas le lexique 34 Mo).

## Question
En pendu de phrases, un **prior grammatical inter-mots** (l'accord) fait-il deviner *moins* que la route lexicale
seule ? Et le gain est-il sur les **terminaisons flexionnelles muettes** (-s/-t/-e/-nt), indevinables sur le mot seul
mais déterminées par le contexte ?

## Design (UNE jonction — on ne change QUE le prior)
- Plateau : structure révélée (nb de mots + longueurs), lettres cachées ; une lettre devinée se révèle **partout**.
- **P0** (route lexicale, sans contexte) : cohorte par mot = `{mot} ∪ homophones/flexions` (`sentences.json fam`),
  compatible motif + longueur ; devine la lettre de **couverture maximale** (sinon repli fréquence FR).
- **P1** = P0 + cohorte d'abord **filtrée par l'accord** déduit des mots révélés (`governor_number/gender`, `is_verb`…).
- Corpus : les 30 phrases (212 mots). Suffisant pour *falsifier*, pas pour *régler*.

## Résultats
| Métrique | P0 | P1 | Δ |
|---|---|---|---|
| **1. Erreurs** (lettres fausses) | 0 | 0 | **0** |
| **2. Déclaration** — lettres correctes avant d'identifier *tous* les mots | 120 | 112 | **−8 (−6,7 %)** |
| Mots « compris par le contexte » (uniques **avant toute lettre**) | 148/212 | 161/212 | **+13** |
| Décisions accord-décidables (le prior réduit la cohorte) | — | 45 | — |
| **Déclarations FAUSSES** (mot pincé vers un mauvais candidat) | 0 | **0** ✅ | — |

## Ce que ça dit (le *pourquoi*, sans quoi un Δ ne vaut rien)
1. **La métrique « erreurs » est structurellement aveugle ici.** En pendu de phrases, le **partage de lettres**
   révèle les terminaisons « gratis » (un -s/-t/-e apparaît dans *un* mot et se révèle partout). Le jeu **fuit les fins**.
   → Mesurer le prior par les lettres fausses ne marchera jamais : ce n'est pas le bon banc.
2. **La valeur est dans la DÉCLARATION** : le prior fait identifier la phrase à partir de **moins de lettres**
   (−6,7 %) et rend **13 mots de plus** déterminables par le seul contexte. C'est exactement le régime des briques
   DECLARE du moteur (« compléter le mot quand on est sûr »), pas l'évitement de lettres.

## Le garde-fou qui a tout changé (honnêteté §6)
Première version : Δ **+17,5 %** … mais **7 déclarations FAUSSES**. La sonde anti-mis-pin a montré que le prior
pinçait des **mots de classe fermée** (`dans`, `près`, `dès`, `nous`, `tes`, `les`, infinitif `jouer`) : la règle
« singulier → pas de -s » strippait leur **-s réel**. Correctif : n'appliquer le prior qu'aux **cibles d'accord
ouvertes** (noms/adjectifs/verbes finis/participes), jamais à la classe fermée ni aux infinitifs.
→ mis-pins **7 → 0**, Δ honnête **+6,7 %**.

## Doctrine
Le filtre dur (exclure un candidat) **est** l'argmax que §3 interdit (« croiser = jointe Σ P(φ)·P(lettre|φ), pas
argmax/produit »). Le +6,7 % est donc un **plancher** : une version **molle** (P(mot) ∝ lexical × accord, sans jamais
retirer la vraie cible) devrait faire mieux ET supprimer la micro-régression (−1 sur une phrase, effet de bord du
filtre dur sur la politique gloutonne).

## Verdict
**Oui, ça vaut le coup — mais reformulé.** Le pendu de phrases n'est pas « unique » comme *jeu* ; ce qui est
distinctif et **mesurable**, c'est un solveur qui **comprend la phrase à partir de moins d'information** grâce à la
morphosyntaxe. Le bon banc n'est pas les lettres fausses (le jeu les fuit) mais la **déclaration**.

## Jonction §3 livrée : DECLARE MOU (jointe) > filtre dur (argmax)
Remplacé le filtre dur par un **posterior** `P(cand) ∝ poids`, où l'incompatible vaut **eps (jamais 0)** ; on déclare
un mot quand `max posterior ≥ conf`. Banc à **ordre de révélation fixe** (les deux bras révèlent les lettres dans le
même ordre → ablation pure du prior, sans l'effet de bord de la politique gloutonne qui causait le −1 en métrique 2).

Balayage (eps, conf), baseline P0 (sans accord) = 89 lettres pour tout déclarer :

| eps | conf | reveals P1 | Δ vs P0 | fausses déclarations |
|----|----|----|----|----|
| 0.10 | 0.80 | 81 | **+8 (+9,0 %)** | 0 ✅ |
| 0.10 | 0.85–0.90 | 82 | +7 (+7,9 %) | 0 ✅ |
| 0.20 | 0.80 | 82 | +7 (+7,9 %) | 0 ✅ |
| (conf/eps élevés) | | 89 | +0 % | 0 ✅ (revient au baseline) |

**→ meilleure config sûre : eps=0,10 conf=0,80 → +9,0 %, 0 fausse déclaration.** Le mou **bat** le dur (+6,7 %)
ET est principiel : comme eps>0 ne retire jamais la vraie cible, on règle la vitesse sans jamais inventer (≠ argmax).

## Mode phrase sur le VRAI moteur — MESURÉ (et c'est une falsification utile)
Construit : (1) monolithe — flag `M_DECLARE_ACCORD_PRIOR_ENABLED` (défaut OFF, R66 byte-identique) + hook
`_omega_accordPriorFn` qui multiplie le poids des candidats dans `_omega_declareBestCandidate` (jointe §3,
poids ∈ ]0,1], jamais 0) ; (2) harnais `evo/phrase_engine_bench.js` qui joue chaque mot **≥7** d'une phrase
avec la **vraie route lexicale + vraies fréquences**, prior d'accord OFF vs ON, sur les 30 phrases.

| conf | gagnés OFF→ON | erreurs OFF→ON |
|---|---|---|
| 0.65 | 51→49 (**−2**) | 174→174 (0) |
| 0.75 | 49→50 (**+1**) | 203→197 (**−6**) |
| 0.85 | 47→49 (**+2**) | 199→210 (**+11**) |
| 0.95 | 43→45 (**+2**) | 211→219 (**+8**) |
(64 mots ≥7 joués, dont 55 accord-décidables.)

**Verdict honnête : effet MARGINAL et non robuste.** Au mieux +2 gagnés/64 (~+3 %) à conf élevée, mais souvent
au prix de +erreurs, et **négatif** à conf basse. **Le +9 % du probe NE se transfère PAS au vrai moteur.**

### Pourquoi (le mécanisme, sans quoi un Δ ne vaut rien)
1. **Le moteur exclut les mots < 7 lettres** (`const MIN_WORD_LEN=7`, lexique embarqué ≥7) — c'est exactement
   là que l'accord **décide** (verte/vert, chat/chats, dort/dors). Sur les ≥7, la longueur+motif désambiguïsent déjà.
2. **La fréquence lexicale réelle `w.f` domine déjà** : pour un mot long, elle concentre la masse sur la bonne
   forme ; l'accord ajoute peu, et parfois **lutte** contre la fréquence (d'où les +erreurs à conf élevée).
3. DECLARE seul fait déjà l'essentiel du travail sur les ≥7 (8→47–56 gagnés/64) : l'accord y est redondant.

### Conséquence (doctrine §0/§6 : le pendu est une unité de mesure, pas le but)
La valeur du levier accord est **DIAGNOSTIQUE** (la dictée, livrée) et vit dans le **régime mot-court**, pas dans
le DECLARE ≥7 du moteur. Hook gardé **OFF-inerte** (R66), documenté comme mesuré-marginal — comme `M1_m` :
on ne garde pas actif ce qui ne se mesure pas. **L'idée « pendu de phrases unique » est tranchée par la mesure :
la cognition phrase paie en DÉCLARATION et sur les mots courts — pas dans le moteur ≥7 actuel.**

## (Référence) Prochaine jonction envisagée avant mesure — sur le VRAI moteur (build, pas réglage)
Le moteur joue des **mots isolés** : il n'a **pas de mode phrase** ni de contexte inter-mots. Câbler ce prior dans
les briques DECLARE (`M_WORD_DECLARE` / `M_BPC_DECLARE`) suppose donc d'abord **un mode phrase** (jouer les mots
d'une phrase en partageant un contexte + exposer la distribution de candidats du DECLARE pour la pondérer par
l'accord). C'est une **fonctionnalité**, pas une jonction — débranchable, défaut OFF, R66 (baseline byte-identique).
Plan : (1) harnais phrase autour du moteur (`evo/`), (2) hook prior externe OFF-inerte dans `_omega_declareBestCandidate`,
(3) mesure DECLARE baseline vs +accord-mou. Plafond visé = ~+9 % (lettres pour « comprendre » la phrase).
À décider : ce plafond justifie-t-il le mode phrase dans le monolithe ?
