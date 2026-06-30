# SONDE — Le modèle de forme-de-mot du pendu peut-il servir le correcteur ? (NÉGATIF)

**Date : 2026-06-30. Doctrine R66 : mesurer avant de croire, falsifier avant de jeter.**

## Question
Le moteur OMEGA généralise hors-lexique (~64 % OOV, n-gram gap-aware + cognition double-voie).
Pourrait-il **aider le correcteur dys** à distinguer un **vrai mot** (rare / néologisme) d'un **typo** —
là où le speller s'abstient aujourd'hui (FP=0) ? (Ici le **cheat-free ne s'applique pas** : c'est une
contrainte du pendu, pas du correcteur — seul le résultat FP=0/rappel compte.)

## Démarche (3 temps, honnête)
1. **Proxy trigramme maison** (char-n-gram sur la wordlist) → séparation quasi nulle ; **noms propres** scorent
   PLUS bas que les typos. *Conclusion hâtive « ça ne marche pas » → FAUSSE : ce n'était pas le moteur.*
2. **Vrai moteur** (extrait de l'app via `evo/fitness_harness.js`, **config optimale** cheat-free + gap-aware + NEO,
   joue au pendu = reconstruit le mot). Winrate : **vrai mot OOV 58 % · typo 36 % · nom propre 7 %**. Avait l'air fort.
3. **ROC propre** (ce qui tranche) : score **continu** = nb de mauvaises lettres (`_snap.err`), **valide-OOV
   minuscule vs typo** (mots communs du lexique → noms propres exclus de fait), lexique amputé pour mesurer le
   *modèle* (pas le lookup). Script : `evo/wordshape_corrector_probe.js`.

## Résultat
```
valide-OOV  err médian 5  moy 3,84
typo        err médian 5  moy 4,48
AUC (P[err_typo > err_valide]) = 0,627        (0,5 = nul · 1,0 = parfait)
```
**AUC 0,627 = signal FAIBLE.** Le winrate 58/36 était un **binaire grossier** (seuil à budget fixe) qui amplifiait
un petit écart de moyenne ; le score continu par mot **se chevauche** largement.

## Conclusion (NÉGATIF, mérité)
Un **typo à 1 édit garde presque toute la structure française** du mot → le moteur le reconstruit *presque aussi
bien* qu'un vrai mot. Sa force est **générative** (reconstruire une forme, la phonologie) ; le goulot du correcteur
est **discriminatif** (faute vs valide). **Ça ne matche pas assez** (AUC 0,63) pour câbler. Et le seul transfert qui
matchait — la **phonologie** — le correcteur le fait **déjà** (`phon_key` : « oartir »→partir).

➡️ **Ne pas re-creuser « le pendu pour le correcteur » sans battre AUC 0,63 sur CE protocole.**
Rejouer : `node evo/wordshape_corrector_probe.js` (nécessite `data_local/ud_fr_gsd-train.conllu`).
