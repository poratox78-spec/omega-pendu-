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

## Prochaine jonction (si on continue)
Câbler le prior d'accord, **en version molle (jointe §3)**, dans la brique **DECLARE** du moteur
(`M_WORD_DECLARE` / `M_BPC_DECLARE`), mesuré contre le baseline DECLARE actuel (débranchable, défaut OFF, R66).
C'est là que les +6,7 % (probablement plus en mou) deviennent du winrate/erreurs réels du pendu.
