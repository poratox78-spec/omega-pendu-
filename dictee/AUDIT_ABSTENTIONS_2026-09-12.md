# Audit des abstentions gardées — 12/09/2026

**La question de Rem** (12/09, après « j'est de Paris ») : « tu m'en fais beaucoup des abstentions comme ça sans regarder
le contexte et sans rien contrôler ? ». Le cas déclencheur : la garde `recall_probe` *exigeait* le silence sur
« j'est de Paris » et « j'est entendu le tonnerre » (« aux ambigu → non flagué ») — deux structures différentes, que le
voisin tranche (de + nom propre = origine → *je suis* ; participe + objet → *j'ai*). Réparé dans le lot 1 « bon lemme,
mauvaise flexion ». Cette page répond à la question générale : **où sont les autres ?**

Instrument : `python3 dictee/abstentions_inventaire.py` (lecture seule) — il dresse la liste, le verdict est humain et
tient ici. Règle de lecture : une abstention sur du texte **correct** est la bonne sortie (FP=0) ; une abstention sur du
texte **faux** est une correction perdue, qui doit recevoir une sortie (le bon mot, ou un orange sur l'élément suspect).

## Réponse courte

> ⚠️ Inventaire écrit au lot 1 (#736). Ce qui a reçu sa sortie depuis — et un cas mal classé ici, « Elles est formée » — est
> dans la section **Suivi**, en fin de page.

| Gisement | Total | Sur texte correct (légitime) | Sur texte FAUX avec une sortie | Sur texte FAUX **sans** sortie |
|---|---:|---:|---:|---:|
| bancs `rien: true` (Chrome) | 50 | 49 | — | **1** : « vous somme très contents » |
| bancs `interdit` (Chrome) | 17 | 12 | 3 (« le maçons ont » → *les ?*, « lorsqu'il sont » → *ils*, « a se placer » → *à*) | **2** : « Elles est formée », « n'ont pas été prise » |
| garde `recall_probe` abstain | 0 (était 2) | — | 2 (levées le 12/09) | 0 |
| référence, `return None` commentés | 91 dans 33 règles | ≈ 70 (structure non lisible, nom propre, sigle, coordination, titre) | ≈ 8 (donnée manquante : genre inconnu, table incomplète) | **≈ 13**, listées ci-dessous |

Donc : peu d'abstentions **gardées** sur du texte faux — une quinzaine, nommées — et beaucoup de gardes FP=0 légitimes.
La vraie masse de silence n'est pas dans les gardes : ce sont les **637 mots faux muets** du pipeline (aucune règle ne
parle), déjà comptés par `dys_pipeline_probe`, et travaillés famille par famille (329 « bon lemme, mauvaise forme »,
pluriel manquant en tête ; lot 2 « accord du participe relu dans -er → -é » ; « je noté » ; homophones muets).

## ① Bancs : les 3 silences sur texte faux

1. **« vous somme très contents »** (`rien: true`) — « plus de *sommez* en rouge : se taire plutôt qu'inventer ». Sortie
   possible : orange *êtes* (sujet « vous » + forme d'être à une lettre), à mesurer ; ou deux boutons *êtes / sommes*.
2. **« Elles est formée par l'ensemble des bractées »** (`interdit: elles sont formée`) — le pronom est suspect (« Elle »),
   pas le verbe : deux boutons *Elle est formée / Elles sont formées* (mémoire deux-boutons), pas de silence.
3. **« les demandes … n'ont pas été prise en compte »** (`interdit: prisent`) — silence assumé du lot 1 ; la sortie *prises*
   est le lot 2 (accord du participe après « été » avec le sujet nominal avant l'auxiliaire).

## ② Référence : les ≈ 13 abstentions sur texte possiblement faux, avec la sortie à chercher

| Règle · ligne | Abstention | Le contexte dit… | Sortie à mesurer |
|---|---|---|---|
| `rule_pp_etre` l.2019, `rule_adj_attr` l.1737 | aux et sujet en désaccord (« elles est … ») → « l'erreur est ailleurs » | le pronom OU l'auxiliaire est faux | deux boutons (pronom / auxiliaire), orange |
| `rule_flexion_er` l.676 | « je noté » sans marqueur de futur → ambigu (j'ai noté / je noterai) | aucun auxiliaire, aucun marqueur | orange deux lectures ; au moins un orange « forme impossible après je » |
| `rule_ce_se` l.1290 | « ce sont » vs « se sont déroulés » | le participe qui suit tranche (« se sont + participe ») | étendre : participe après → *se* |
| `rule_leur_leurs` l.1037/1039/1052 | pas de nom lisible / nom inconnu / -s non morphologique | le speller connaît souvent le nom | relire après correction orthographique (bout de chaîne) |
| `_np_subject` l.1673, `rule_det_gender` l.3865, `rule_tout_det` l.3895, `rule_ca_sa` l.4544 | genre inconnu | donnée absente, pas ambiguïté | chantier COUVERTURE (tables de genre) — orange « genre à vérifier » possible |
| `rule_sujet_flexion` l.3767 | le temps écrit n'est pas dans la table | donnée absente | chantier COUVERTURE conjugaison (passé simple, impératif) |
| `rule_accord_sv` l.2564 | forme homographe inter-lemmes (« vis » = vivre / voir) | les deux lemmes ont la même flexion | proposer la forme accordée si les deux lemmes donnent le MÊME mot |
| `rule_accord_sv_noun` l.2869, `_np_subject` l.1690 | nom collectif (« la plupart ont », « la majorité sont ») | accord de sens, deux formes correctes | silence légitime — mais orange possible quand le complément est absent |
| `rule_pp_avoir_cod` l.2096 | perception + infinitif (« que j'ai entendu jouer ») | accord réellement ambigu (règle de grammaire) | silence légitime |

Les ≈ 70 autres sont des gardes sur du texte **correct** ou sur des structures que le moteur ne lit pas (nom propre,
sigle, titre, coordination, incise, élision non lisible, apposition) : le silence y est la bonne sortie, chacune est née
d'un faux positif mesuré (UD, frgec, Voltaire). Elles ne sont pas « sans contrôle » : elles sont contrôlées par
`fp_scale_probe` (UD 2 500), la batterie et les gardes Chrome.

## ③ Ce qui n'est pas une garde : les muets

`dys_pipeline_probe` (72 productions dys, 12/09) : 1 542 mots faux, 319 réparés, **637 muets**. Un muet n'est pas une
abstention décidée, c'est une règle qui n'existe pas encore. Ils sont travaillés par famille (état des chantiers :
« bon lemme, mauvaise flexion » lots 1 et 2, « je noté », homophones et/est, -er/-é dispersés, féminin manquant).

## Ce que ça change

- Une garde de banc qui dit « ne doit PAS flaguer » sur du texte faux est une **dette datée**, pas une spécification :
  la relire avec le voisin, et la faire passer dans `expect` quand une sortie existe (fait pour j'est).
- « Restaurer l'abstention » n'est jamais un correctif.
- Deux phrases qui partagent un mot n'ont pas la même structure : jamais une seule règle de silence pour les deux.

## Suivi — les sorties rendues depuis l'inventaire (12/09/2026, soir)

Vérifié dans le dépôt et dans le vrai Chrome (`navigateur_flags_dump.js`) :

| Silence inventorié | Ce que le produit rend maintenant | Où |
|---|---|---|
| « vous somme très contents » (`rien`) | *êtes* en rouge — et « vous sommes » → *êtes* (deux lemmes pesés) | #737 · 0.6.21 |
| « n'ont pas été prise » (`interdit: prisent`) | *prises* : l'accord du participe est relu après « été » et dans -er → -é | #739 · 0.6.23 |
| `rule_ce_se` : « ils ce sont déroulés » | *se* en orange : le participe après l'auxiliaire tranche | #740 · 0.6.24 |
| « Elles est formée » (`interdit`) | **Mal classé par cet inventaire** : le produit rendait déjà *Elles sont formées* (verbe et participe en rouge) depuis la 0.6.16. Recensé dans les corpus appariés : 2 occurrences sur 34 416 paires. Rien à coder ; le texte de la garde Chrome, qui disait « le verbe ne bouge pas », est corrigé. | textes · 0.6.27 |
| « a réussie à se placer » (appliqué faux, accord surnuméraire) | *réussi* en orange — règle neuve pour une case vide : participe marqué après avoir, aucun antécédent, un témoin après | 0.6.27 |

**Atteint en 0.6.28 : le cas dys lui-même**, « la France a **réusie** a se placer » → *réussi ?*. Les règles orange, qui vivent
dans `spellText`, lisaient le mot **brut** : le speller prenait « réusie » (→ *réussie*) et l'accord du participe n'était jamais
consulté. Le bout de chaîne s'étend de l'orthographe vers l'orange : la suggestion d'orthographe est appliquée seule, les règles
orange sont consultées au même index, et la marque devient orange avec l'état final — mesuré dans Chrome sur 1 798 textes dys : 20 marques changent — 9 fausses deviennent justes (réusie → réussi, marriée → mariée ×2, démaré → démarrer, pérméte → permettent, trouveron → trouveront, apartien → appartiennent, etute → études, régio → régions), 1 juste devient fausse (deuxiem → deuxièmes, après « deux »), 9 restent fausses, 1 sur un mot déjà juste ; 2 500 phrases correctes : 638 marques avant et après, 2 suggestions changées sur des faux positifs du speller déjà présents.

« heur » → heures, prévu dans le même lot, n'est pas une abstention : c'est le choix du speller (mot rare à une lettre d'un mot
courant, 189 occurrences hétérogènes dans les paires) — rangé avec les 637 muets.

Restent, dans l'ordre : « je noté » (orange, deux lectures) · leur/leurs relu après
l'orthographe · « vis » (même forme accordée pour les deux lemmes) · collectifs · genre et temps manquants (chantier COUVERTURE).
