# État des lieux du correcteur dys — 22/08/2026, confronté à la littérature

> Pause après la campagne qualité (#545→#554). Ce document répond à trois questions : **où on en est**,
> **ce que la littérature dit de ce qu'on fait**, et **ce que ça change aux chantiers ouverts**.
> Règle appliquée partout ici : un chiffre venu d'un papier est une *hypothèse à vérifier sur nos données*,
> pas un résultat. Deux pistes de la littérature ont ainsi été **rejetées après mesure** (§4).

## 1. Où on en est (mesuré, corpus dys réel — 1 726 paires)

| | valeur |
|---|---|
| mots erronés | 6,9 % |
| non-mots | 16,0 % |
| erreurs produisant un **vrai mot** | 34 % |
| non-mots promus avec la **bonne** graphie | 793 |
| non-mots promus avec la **MAUVAISE** | 216 |
| `orthographe auto` (précision) | 91,5 % |
| FP à l'échelle (UD, 2 500 phrases correctes) | **1,44 %** |
| gardes locales | dev.sh **69/69** |

Acquis structurant de la campagne : **le poison n'est pas le non-mot, c'est la réparation fausse.**
Un non-mot laissé visible coûte 6 points de précision à la grammaire (91 → 85 %) ; **mal réparé il en
coûte 36** (91 → 55 %), parce qu'il est promu au rang de mot connu et hérite de la confiance pleine.

## 2. Ce que la littérature CONFIRME

**Bodard (2020), JEP-TALN-RÉCITAL** — analyse de corpus dyslexiques **français**, même objectif que nous
(« guider le développement de modules de correction orthographique »).

| Ce qu'ils mesurent | Ce qu'on fait |
|---|---|
| **58,7 %** des formes erronées ont la **même phonétique** que la cible (**67,1 %** en voyelles simplifiées) | route phonétique = pilier du speller ✔ |
| gain à **simplifier les voyelles** (fusionner /e/-/ɛ/, /o/-/ɔ/, /ø/-/œ/-/ə/, /ɛ̃/-/œ̃/) | `phon_key` le fait déjà — et on a **mesuré-réfuté** l'IPA fidèle (85 % contre 67 % de collision typo↔correct). **Convergence indépendante** ✔ |
| erreurs les plus fréquentes : **phonétisation 27,25 %** + **accord genre/nombre/conjugaison 26,81 %** = plus de la moitié | nos deux plus gros investissements ✔ |
| formes les plus souvent erronées : *très, peut, à, après, ils, ont, c'est, ce, au, est* | exactement les règles qu'on a écrites (a/à, ce/se, est/et, on/ont, peu/peut) ✔ |
| **72,3 %** des formes erronées ont ≥1 mot de contexte erroné (fenêtre ±2) | notre « ancre polluée » — **le même phénomène, publié en 2020** ✔ |
| homophones **11,28 %**, majuscule **3,14 %**, segmentation **6,35 %** | couverts (règles, majuscule, élision/soudure) ✔ |

**Littérature anglophone** : les erreurs en **mot réel** (« form » pour « from ») sont ~20 % des fautes dys
et **les correcteurs courants ne les détectent pas** — c'est précisément le trou que notre couche grammaire
existe pour boucher.

**Recommandation pédagogique convergente** : l'élève doit **analyser** les suggestions plutôt que les
accepter d'un clic. C'est l'architecture rouge/orange + stade + remédiation, pas un choix esthétique.

## 3. Ce que la littérature CORRIGE — notre corpus est trop facile

Sur **tous** les axes mesurables, notre corpus privé est plus doux que les corpus dyslexiques publiés :

| | littérature FR (Bodard 2020) | **notre corpus** |
|---|---|---|
| mots erronés | ~33 % | **6,9 %** |
| formes à distance d'édition ≥2 | 41,2 % | **30,3 %** |
| 1ʳᵉ lettre fausse | 10,9 % | **6,2 %** |
| erreurs produisant un vrai mot | 53 % | **34 %** |
| erreurs par mot | 1,4 | — |

Conséquences, à assumer :

1. **Nos chiffres sont optimistes** par rapport à la population cible. « 91,5 % » et « FP 1,44 % » sont
   mesurés sur un texte plus propre que ce qu'un scripteur dyslexique produit réellement.
2. ⚠️ **RETOURNEMENT — la conclusion « `dys_gen.py` met ~2× trop de fautes » est à revoir.** Elle était
   mesurée **contre notre corpus** (13,1 % de mots fautifs contre 6,9 %). Contre la littérature (~33 %),
   c'est le **générateur qui est le plus proche du réel**, et notre corpus qui est atypique. Le biais
   ×29 sur les **déterminants** reste, lui, un vrai biais de forme. **À trancher par une mesure**, pas par
   arbitrage : nos deux populations diffèrent peut-être (âge, dictée vs écrit spontané, aide à la saisie).

## 4. Pistes de la littérature ÉVALUÉES ET REJETÉES sur nos données

- **Initiale phonétique au lieu d'initiale orthographique.** Le papier note 10,9 % de premières lettres
  fausses mais **<4 %** de premières lettres *phonétiquement* fausses — donc la garde « même initiale
  orthographique » du speller (`_cands`) semblerait écarter ~7 % de cas récupérables.
  **Mesuré chez nous : elle écarte 6,2 % des formes erronées, dont 5,5 % ont AUSSI l'initiale phonétique
  fausse → gain maximal 0,7 %.** Ne vaut pas le code. *Piste fermée.*
- **« Préférer le candidat qui n'invente aucune lettre »** (phénoménologie dys : on inverse/omet/double ce
  qu'on a écrit). Implémentée proprement, gagnait `belu`→*bleu*… et coûtait **11 bonnes corrections pour
  3 mauvaises évitées**. *Falsifiée (#554), ne pas refaire.*

## 5. LanguageTool — ce qu'on apprend de leur architecture

Leur `ConfusionProbabilityRule` utilise un **facteur** : de combien le mot **présent dans le texte** doit
être préféré à l'alternative. Points saillants :

- plage utilisée : **10 à 10 000 000** ; un facteur de **1 produit des fausses alertes** ;
- ils choisissent le facteur avec un évaluateur dédié (`ConfusionRuleEvaluator`) qui imprime précision et
  rappel, et **préfèrent explicitement la précision** : seuils minimaux **0,995** (mots fréquents),
  **0,99** (autres) ;
- la plupart des paires de confusion sont **désactivées par défaut** pour la qualité ;
- limite assumée : ils ne détectent pas les confusions dont un membre fait plusieurs tokens.

**Ce que ça dit de notre chantier n°1.** Notre garde de dominance ≫20× a la **même forme** que leur facteur
— mais avec une différence décisive : **leur comparaison est CONTEXTUELLE (n-gram), la nôtre est une
fréquence NUE.** C'est pour ça que `parvis` (0,15) ne peut pas battre `parties` (23,7) sur `parvies`, alors
même qu'il a la bonne priorité *et* le bon phon-match : hors contexte, il n'a aucun argument.

⇒ **Le chantier n°1 n'est donc pas « baisser le seuil de 20× »** (ce qui échangerait des junks contre des
faux positifs), **mais donner du contexte à la comparaison.** Le dépôt a déjà ce qu'il faut (n-gram
§1.7 arbitré OS, POS-tagger 155k, `noun-post`) — doctrine §5 : réutiliser avant d'ajouter.
Et leur seuil de précision (0,99–0,995) est le repère externe à viser.

## 6. Chantiers, remis dans l'ordre après cette revue

1. **Dominance ≫20× → comparaison en contexte** (reformulé ci-dessus). Le seul chantier restant dont on
   soit sûr qu'il porte du gain plutôt que du nettoyage.
2. **Trancher la question du corpus** : le nôtre est-il atypique, ou la population diffère-t-elle ? De la
   réponse dépend le calibrage de `dys_gen.py` **et** l'interprétation de tous nos pourcentages.
3. **Remesurer « 77 % des FP ont un voisin abîmé »** sur texte réel. Repère externe désormais disponible :
   **72,3 %** (Bodard) — mais sur un corpus 5× plus fautif que le nôtre.
4. **Drapeau de provenance** : la pyramide efface l'origine du mot (`_Tc[f.i]=f.sugg`) ; aucune règle ne
   distingue un mot écrit d'un mot inventé par le speller.
5. Dettes anciennes : FP des collectifs, docstring non tenue de `rule_accord_sv_noun`, **premier essai
   terrain du complément Word**.

## Sources

- Bodard, J. (2020). *Spécificités des erreurs d'orthographe des personnes dyslexiques : analyse d'un corpus
  de productions écrites.* JEP-TALN-RÉCITAL 2020, vol. 3, p. 15-28.
  <https://jep-taln2020.loria.fr/wp-content/uploads/JEP-TALN-RECITAL-2020_paper_169.pdf>
  (cite Antoine et al. 2019 · Pedler 2007 · Rello et al. 2012 · Sitbon et al. 2007 · Bacquelé 2015)
- Pedler, J. *Computer Correction of Real-word Spelling Errors in Dyslexic Text.*
  <https://www.dcs.bbk.ac.uk/site/assets/files/1025/pedler.pdf>
- Rello, L. et al. *A Spellchecker for Dyslexia.* ASSETS 2015. <https://dl.acm.org/doi/10.1145/2700648.2809850>
- *Spelling errors made by people with dyslexia.* Language Resources and Evaluation.
  <https://link.springer.com/article/10.1007/s10579-022-09603-6>
- LanguageTool — *Adding n-gram data rules.* <https://dev.languagetool.org/adding-n-gram-data-rules.html>
