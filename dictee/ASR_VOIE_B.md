# ASR local « voie B » (sans Google) — chantier de recherche, clos

**But.** Tester si la *route phonologique* d'OMEGA (le moteur du pendu : double-voie ortho⟷phon,
arbitrage OS) peut servir de **back-end ASR** — « OMEGA corrige le texte → OMEGA peut corriger le son ».
Voie B = **local, poids ouverts, zéro Google** (opposé à la voie A = Web Speech/Google du site).

## Chaîne
`audio → wav2vec2-french-phonemizer (phonèmes IPA + pauses) → OMEGA :`
1. **récupération lexicale** — homophones exacts + proximité de prononciation sur ~214 k mots (index `PH2W`) ;
2. **grammaire** — décodage Viterbi trigramme (`os-subj-lm`) ;
3. **ponctuation PROSODIQUE** — les silences (timing wav2vec2) posent `.` / `,` ;
4. **pitch → « ? »** — montée de F0 en fin de phrase (autocorrélation, zéro modèle) ;
5. **parseur de sujet MODE-CONFIANCE** — accord son/sont, adj/participe (flips de genre gratuits à l'oral) ;
6. **correcteur rouge FP=0** nourri de la ponctuation.

Outils : `asr_voix.py` (chaîne + CLI), `asr_voix_gui.py` / `asr_voix_test.py` (interfaces),
`Tester ma voix.bat` / `Dictée vocale.bat` (lanceurs). Dépendances locales : `torch`, `transformers`,
`soundfile`, `faster-whisper` (`pip install`). Hors build/CI.

## Résultats mesurés (voix dys réelle de Rem + TTS)
| étape | word-acc (voix propre) |
|---|---|
| p2g argmax, 0 grammaire | 13,6 % |
| + grammaire trigramme | 49,7 % |
| + homophones exacts (116 k) | 63,3 % |
| + récup floue 214 k | 70,1 % |
| + correcteur rouge | 72,8 % |
| + parseur de sujet mode-confiance | 76,9 % |
| **+ couverture apostrophe (elision_recall)** | **~85 %** (vraie voix) |

- **Ponctuation prosodique** : F1 **100 %** (frontières de proposition depuis le silence).
- **Pitch → « ? »** : 2/3 questions attrapées, **0 faux « ? »** (seuil prudent ; les questions en *qu-*
  descendent — la littérature dit qu'il faut un cue lexical, non tiré).

## Leviers testés — et pourquoi la plupart échouent (mesuré)
| levier | verdict |
|---|---|
| **couverture apostrophe** (idée Rem) | ✅ **+4 %** (81→85) — le SEUL gros gain restant |
| LM plus gros (UD+WiCoPaCo, ×240 trigrammes) | ❌ **empire** (81→79) : registre Wikipédia = piège de fréquence |
| posteriors soft (top-2 CTC) | ❌ **empire** : le 2ᵉ phonème est du bruit |
| prononciation Wiktionnaire IPA | ~0 : seuls 13 k mots ont l'IPA en local |
| homonymes en mode-confiance | ~3 % mais en zone d'abstention FP (risqué) |
| récup non-mots double-route (idée Rem) | no-op : le fix couverture a supprimé les non-mots |
| correcteur nourri de la ponctuation | +1 mot (angle mort d'archi corrigé) |

**La constante, mesurée cinq fois :** le résidu n'est **ni** un non-mot, **ni** un trou de couverture,
**ni** de la grammaire — c'est un **VRAI mot FAUX choisi sur un son mal entendu** (`comment→comme`,
`voulais→soulais`, `promener→provene`). C'est **acoustique** : l'information est perdue au micro, pas
au traitement. **Aucun levier CPU** (grammaire, POS, ponctuation, pendu, lexique) ne peut le corriger.

## Verdict
- **La thèse est prouvée** : la route phon d'OMEGA EST un back-end ASR viable (~85 % voix propre).
- **Le plafond de voie B = le modèle acoustique** (wav2vec2-base). Le franchir demande un **meilleur
  modèle** : GPU fine-tuning, ou **Whisper**.
- **Whisper small local** (faster-whisper, poids ouverts MIT, PAS Google) = **98 %** sur la voix de Rem,
  ponctuation + majuscules + « ? » inclus, 1 seule erreur. Le correcteur OMEGA par-dessus = « rien à
  corriger » (Whisper sort du français propre). **→ Pour un outil local réel, Whisper est l'outil ;
  la voie phon reste la preuve de recherche.**

## Où vit la valeur d'OMEGA sur la voix
- **Web (voie A)** : Whisper trop gros pour le navigateur → Web Speech (Google) + correction/formatage OMEGA.
- **Clavier** (site, extension, Twitch) : OMEGA, tout le temps — sa vraie maison.
- **Leçon transverse** : la vraie valeur dys de la voix = **pouvoir PARLER** (éviter le clavier), pas la
  correction — un bon ASR la livre seul.

*(Sources d'entraînement/lexique utilisées : UD French-GSD CC BY-SA, fp_scale local, set conversationnel
curé. JAMAIS le corpus dys privé ni WiCoPaCo non-redistribué dans un artefact commité.)*
