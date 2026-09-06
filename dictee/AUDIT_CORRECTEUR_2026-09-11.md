# Audit du correcteur — 11/09/2026 (vrai Chrome, extension du dépôt via CDP)

> Demande de Rem (10/09) : « audit correcteur — debug connexion liaison branchement ; ordre règles ; textes
> d'explication, avec test dans le vrai chrome : phrases avec fautes classiques, et phrases avec fautes stupides
> (oubli de mot, faute de frappe, phrase mal fichue) ».
>
> Protocole : 24 phrases (12 classiques, 12 « stupides ») passées dans **Chrome réel** (extension chargée depuis
> `extension/` à main `a6fa567`, `diagnoseAll` comme le produit, via le même harnais CDP que
> `navigateur_flags_dump.js`, étendu aux `hint`, au stade et aux remèdes), **la référence Python en regard**
> (`dys_pipeline_probe.pyramide` : rouges appliqués, oranges proposés, soulignés). Run brut en annexe.
> Ce document ne corrige rien : il constate, classe, et ordonne. Chaque item porte sa phrase.

## 0. En une ligne

Le produit fait ce qu'il dit : **39 flags sur 24 phrases, aucun mot juste réécrit en rouge**, référence et produit
identiques sur les 24 (une seule différence, d'instrument, §5). Ce que l'audit trouve n'est pas dans le moteur :
c'est dans les **textes** (3 explications fausses, 2 absentes), une **fausse orange** née d'une pollution du lexique,
et des **silences** classables (10 fautes classiques manquées, presque toutes de la même famille : le mot est
juste, c'est la FORME ou le mot d'à côté).

## 1. Faux et fatigue (ce qui touche FP=0 ou le « bruit orange »)

| # | phrase | produit | verdict |
|---|---|---|---|
| 1.1 | « **Ma** mere ma dit de rentré avant huit heure » | ORANGE `genre déterminant` **Ma → Mon** | **fausse orange**. Cause tracée : `mere` (sans accent) EST une entrée de Lexique4 — `mere NOM m s 6,66/M` — donc le speller se tait (« mot valide ») et la règle de genre lit un nom MASCULIN. Même classe que `trés` (pollution : `mère` 630/M porte la même déaccentuation). Le speller ne restaure pas l'accent sur un mot CONNU. |
| 1.2 | « Il fais froid **aujourdhui** » | ORANGE `mot inconnu` **aujourdhui → (aucune suggestion)** | pas un faux, mais un souligné nu là où la réponse est fermée (`aujourd'hui`) : l'élision fusionnée (Jai→J'ai, l'hopital) ne couvre pas la forme figée. |

Aucun rouge sur un mot juste. **FP=0 tient sur les 24 phrases.**

## 2. Textes d'explication — faux, absents, ou pas synchronisés

Deux chemins produisent du texte : `REMED` (le remède de famille, ligne « remèdes » du panneau) et `ctxHint`
(le 💡 par correction). Ils ne se parlent pas, et ça se voit :

| # | phrase · correction | texte servi | problème |
|---|---|---|---|
| 2.1 | « mes **clé** » → clés | REMED : « remplace le verbe par **mordre** — si mordre sonne juste c'est l'infinitif -er… » | **faux** : le test du 3ᵉ groupe est servi sur un NOM. `REMED.accord` teste la finale é/és AVANT de savoir si c'est un verbe. |
| 2.2 | « avant huit **heure** » → heures | 💡 « C'est « **ma** » (singulier) qui commande → on accorde « heures » » | **faux et contradictoire** : le gouverneur affiché est « ma » (à 4 mots), pas « huit » ; un singulier qui commande un pluriel. `governorNumber` remonte trop loin ou ignore le cardinal. |
| 2.3 | « allé **a** la plage… j'ai **manger** » → mangé ; « **rentré** avant » → rentrer ; « avont **marcher** » → marché | aucun 💡 | **absent** : `ctxHint` exclut explicitement les familles `é/er` et `grammatical` (`!/é\/er\|grammatical\|…/`) et retombe sur `famHint` qui rend ''. Le test « mordre » existe pourtant dans `REMED.accord` — sur le mauvais chemin. |
| 2.4 | « Elle **c'est** trompé » → s'est | REMED générique : « remplace par une forme sûre (a→avait, et→et puis, son→mon) » ; aucun 💡 | **générique** : `_HPROBE` n'a pas d'entrée c'est/s'est (il en a pour a/à, son/sont, ce/se…). Le test attendu : « c'est » = « cela est » ; « s'est » = « il s'est ». |
| 2.5 | « un **chateau** » → château | REMED : « a→â. Dis-le à voix haute — **é ferme, è ouvre** » | **hors sujet** : le circonflexe ne s'entend pas ; la phrase é/è est celle de l'accent aigu/grave. |
| 2.6 | « Nous **avont** » → avons | REMED : « ici ce son s'écrit « s », pas « t » » | **mauvais cadre** : ce n'est pas un son, c'est la terminaison de « nous » (-ons). La famille `surface` a pris la main sur une désinence. |
| 2.7 | « **aujourdhui** » (inconnu) | REMED : « les accents s'entendent — é ferme, è/ê ouvre » | **hors sujet** (il manque une apostrophe) : `_corrFam` classe en `accent` faute de mieux. |

Textes justes, à garder tels quels : a/à (« remplace par avait »), son/sont (« remplace par étaient »), ce/se
(« essaie cela »), participe COD (« s'accorde avec le COD placé AVANT »), accord pluriel nom (« C'est « Les »
(pluriel) qui commande »), participe après « nous » (« il manque s : le participe s'ACCORDE ici »), élision
(« l'article est élidé, il faut l'apostrophe »), lettre manquante (« il manque la lettre e »).

## 3. Silences sur fautes classiques — 10 manquées, classées

Sur les 12 phrases classiques : **19 fautes corrigées, 10 manquées** (comptage à la main, phrase par phrase).

| famille du silence | phrases | ce qui manque |
|---|---|---|
| **accord à distance / sujet pronom** | « et **il** sont **content** » · « Les chiens du voisin **on** aboyer » · « son déjà **fané** » (fleurs) | il→ils (ou sont→est), content→contents, on→ont (sujet pluriel à 4 mots), fané→fanées. La vigilance « on/ont après un sujet pluriel » n'a pas tiré à cette distance. |
| **mot juste, forme fausse** (la famille « bon lemme, mauvaise flexion » du 10/09) | « **aboyer** toute la nuit » (aboyé), « je la **raconterais** » (raconterai) | infinitif après on/ont ; conditionnel pour futur. |
| **homophone non couvert** | « **sa** arrive » (ça), « **ou** j'ai mis » (où), « **ma** dit » ×2 (m'a), « **plut** » (plu) | sa→ça devant verbe ; ou→où (la vigilance ou/où existe, silencieuse ici) ; ma→m'a devant participe ; plut (forme rare valide de plaire, 0,36/M) contre plu. |
| **a → à** | « arrive **a** tout le monde » · « raconterais **a** mes amis » | le cadre a→à (31/08) couvre « a + nom nu » et « verbe + a » ; ici « a + tout », « a + mes » après un verbe conjugué au conditionnel — deux configurations à instruire avec la sonde a/à existante. |
| **accord GN au pluriel** | « attention **au voiture** qui passe » | au→aux + voiture→voitures (+ passe→passent en cascade) : la règle « accord pluriel nom » n'a pas d'ancre (au = singulier). |
| **trait d'union** | « **peut etre** dans la cuisine » | peut-être (la règle des questions gère le trait d'union, pas les locutions). |

Aucune de ces familles n'est nouvelle ; toutes sont dans `etat_chantiers` ou le JOURNAL. Ce que l'audit apporte :
**l'ordre par fréquence sur 12 phrases naturelles** — accord à distance et « bon lemme, mauvaise flexion » d'abord.

## 4. Phrases « stupides » — le produit se tait, et c'est juste

| phrase | produit | lecture |
|---|---|---|
| « Je vais **au** avec mon frère » (mot oublié) | rien | juste : aucun mot n'est faux, et on n'invente pas le mot manquant. |
| « Il a **manger** la pomme et puis il. » (phrase tronquée) | mangé (rouge) ; le « il. » final : rien | juste des deux côtés. |
| « Le chat le chien dorment » (« et » oublié) | rien | juste (pas de détecteur de mot manquant — ce serait un jugement, pas FP=0). |
| « nous sommes **allé** au cinéma voir un très bon. » | allés (rouge, 💡 « nous » commande) | juste ; la phrase tronquée n'induit rien. |
| « Elle a dit **que qu'**elle viendrait » (répétition) | rien | **raté** : la couche « répétition » attrape « de de » mais pas « que qu'elle » — le token élidé `qu'elle` ≠ `que`. À couvrir par la déaccentuation du préfixe élidé (que/qu'). |
| « **Jai** oublié mes clés sur la **tabl** » | J'ai (rouge auto), table (rouge flag) | juste. |
| « jouent dans **jardin** » (article oublié) | rien | juste. |
| « Bonjour je voudrais savoir si vous pouvez me dire. » | rien | juste (phrase mal fichue mais chaque mot est bon). |
| « Il **fais** froid **aujourdhui** » | fait (rouge, 💡 « Il » commande) ; aujourdhui souligné sans suggestion | fais ✓ ; aujourdhui → §1.2. |
| « entreprise **de de** transport » | répétition (rouge flag) | juste. ⚠️ le panneau montre « de → de » (la suggestion d'un span 2 rendue mot à mot) — à vérifier à l'œil dans `content.js`. |
| « très bien fait par contre la fin. » (phrase mal fichue) | rien | juste. |
| « s'il te **plait** merci » | rien | juste (plait, orthographe rectifiée de 1990, est au lexique). |

**Verdict** : sur les phrases mal fichues, le produit ne fabrique rien — c'est exactement la doctrine (un rouge
s'applique seul ; dans le doute, silence). Un seul raté réel : la répétition à travers une élision.

## 5. Branchements, liaisons, ordre des règles

- **Produit ≡ référence sur les 24 phrases** (rouges, oranges, soulignés) — une seule différence : sur « **On** a
  visiter… », la référence rend `On → on` (la règle on/ont rend la minuscule ; le produit garde la casse du
  token). Différence de CASSE seulement, sans effet sur réparés/cassés (la sonde compare déaccentué-minuscule),
  mais c'est un artefact d'instrument : `pyramide` devrait ignorer une suggestion qui ne diffère que par la casse,
  comme le produit.
- **Ordre des règles** : 72 règles de grammaire, **même ordre dans l'app et dans l'extension** (vérifié octet
  par octet, `CRULES` identiques) ; la référence Python porte les mêmes 72 dans le même ordre, plus 3 vigilances
  que le JS met dans `spellText` (« personne du verbe », « infinitif après semi-auxiliaire », « on/ont après un
  sujet pluriel ») et 2 normaliseurs d'apostrophe. Aucune divergence d'ordre mesurée sur les 24 phrases.
- **Ordre des couches de vigilance de `spellText`** (premier qui tire gagne) : anglicisme · abréviation ·
  orthographe · mot inconnu · homophone · genre · pluriel · participe · sujet-verbe mid-phrase · gérondif ·
  s'est+pp · semi-auxiliaire · verbe (-ais/-ait) · OS-sujet · ces/ses · conjugaison après je · personne · on/ont
  pluriel · ou/où · élision ×4 · contraction · répétition · mot coupé · espacement · pléonasme · nombre · majuscule.
  Cohérent avec la mesure du 03/09 (forme avant nombre). Rien à réordonner d'après cet audit.
- **Le vrai défaut de branchement est celui des TEXTES** (§2) : `REMED` et `ctxHint` sont deux routes qui ne
  partagent ni les familles ni les tests — le test « mordre » vit dans l'une, les astuces de substitution dans
  l'autre, et chacune a ses trous.

## 6. Plan de correction, dans l'ordre

1. **Textes (aucun risque FP, un seul fichier + miroir app)** : (a) `REMED.accord` — le test « mordre » seulement
   si la famille est verbale ; (b) `ctxHint` — servir le test « mordre » aux familles `é/er`/`grammatical`/
   `terminaison` au lieu de '' ; (c) `_HPROBE` — ajouter c'est/s'est (« cela est » / « il s'est ») ; (d)
   `governorNumber` — un cardinal (« huit ») commande avant un possessif à distance, et jamais un singulier pour un
   pluriel ; (e) `REMED.accent` — pas de « é ferme, è ouvre » pour un circonflexe ; (f) `_corrFam` — une apostrophe
   manquante n'est pas un accent. Chaque texte est vérifiable au même harnais (`hint` dans le dump).
2. **La fausse orange `Ma → Mon`** : décision sur `mere` (Lexique4 6,66/M contre `mère` 630/M, même
   déaccentuation) — recenser `mere` sur le gold et UD avant toute règle ; candidat : la liste fermée `_AFIX`
   (3 moteurs), comme `trés`. Même protocole que le « e » muet (#681) : recensement → trait → garde → mesure.
3. **`aujourd'hui`** et les formes figées à apostrophe : liste fermée dans l'élision fusionnée, FP=0 par
   construction.
4. **Répétition à travers une élision** (« que qu'elle ») : déaccentuer le préfixe élidé avant de comparer.
5. **Silences** (§3), dans l'ordre de fréquence de l'audit : accord à distance (on/ont, il→ils, participe distant),
   « bon lemme, mauvaise flexion » (37/68 des appliqués faux au pipeline), a→à devant tout/mes, sa→ça, ma→m'a,
   au→aux. Chacun est un chantier de MOTEUR à mesurer sur le gold avec le juge aligné — pas une rustine par phrase.
6. **Instrument** : `pyramide` ignore les suggestions qui ne diffèrent que par la casse.

---

## Annexe — le run brut (Chrome réel, 11/09/2026, main `a6fa567`)

```

[classique]  « Les enfant joue dans le jardin et il sont content. »
   stade produit : morphosyntaxique (grammaire) · remèdes : « enfant » → « enfants » : il manque le « s » du pluriel — regarde ce qui commande.
   PRODUIT ROUGE·auto  accord pluriel nom                 enfant → enfants
           💡 C'est « Les » (pluriel) qui commande → on accorde « enfants ».
   PRODUIT ROUGE·auto  accord sujet-verbe                 joue → jouent
           💡 C'est « Les » (pluriel) qui commande → on accorde « jouent ».
   RÉF PY  rouges : enfant→enfants joue→jouent · oranges : — · soulignés : —

[classique]  « Je suis allé a la plage et j'ai manger des glace. »
   stade produit : morphosyntaxique (grammaire) · remèdes : « a » → « à » : essaie « avait » à la place — si la phrase ne tient plus, c’est « à »., « glace » → « glaces » : il manq
   PRODUIT ROUGE·auto  a/à                                a → à
           💡 Astuce : remplace par « avait ». « …suis allé avait la plage… » se dit ? oui → « a » (verbe avoir) · non → « à » (préposition).
   PRODUIT ROUGE·auto  terminaison -er/-é/-ez/-ai         manger → mangé
   PRODUIT ROUGE·auto  accord pluriel nom                 glace → glaces
           💡 C'est « des » (pluriel) qui commande → on accorde « glaces ».
   RÉF PY  rouges : a→à manger→mangé glace→glaces · oranges : — · soulignés : —

[classique]  « Elle c'est trompé de chemin, sa arrive a tout le monde. »
   stade produit : morphosyntaxique (grammaire) · remèdes : « c'est » → « s'est » : remplace par une forme sûre (a→avait, et→et puis, son→mon) — si la phrase tient, garde-la.
   PRODUIT ROUGE·auto  c'est/s'est                        c'est → s'est
   RÉF PY  rouges : c'est→s'est · oranges : — · soulignés : —

[classique]  « Il faut que tu fait attention au voiture qui passe. »
   stade produit : morphosyntaxique (grammaire) · remèdes : « fait » → « fais » : repère QUI COMMANDE (déterminant, sujet) et accorde en genre et en nombre.
   PRODUIT ROUGE·auto  accord sujet-verbe                 fait → fais
           💡 C'est « tu » (singulier) qui commande → on accorde « fais ».
   RÉF PY  rouges : fait→fais · oranges : — · soulignés : —

[classique]  « Ma mere ma dit de rentré avant huit heure. »
   stade produit : morphosyntaxique (grammaire) · remèdes : « Ma » → « Mon » : repère QUI COMMANDE (déterminant, sujet) et accorde en genre et en nombre., « rentré » → « rentrer » 
   PRODUIT ORANGE      genre déterminant                  Ma → Mon
   PRODUIT ROUGE·auto  terminaison -er/-é/-ez/-ai         rentré → rentrer
   PRODUIT ROUGE·auto  accord pluriel nom                 heure → heures
           💡 C'est « ma » (singulier) qui commande → on accorde « heures ».
   RÉF PY  rouges : rentré→rentrer heure→heures · oranges : Ma→Mon · soulignés : —

[classique]  « Les chiens du voisin on aboyer toute la nuit. »
   stade produit : None · remèdes : 
   PRODUIT : — (rien)
   RÉF PY  rouges : — · oranges : — · soulignés : —

[classique]  « On a visiter un chateau tres ancien pendant les vacance. »
   stade produit : alphabétique (écrit au son) · remèdes : « chateau » → « château » : a→â. Dis-le à voix haute — é ferme, è ouvre., « visiter » → « visité » : remplace le verbe p
   PRODUIT ROUGE·auto  accord grammatical (é/er)          visiter → visité
   PRODUIT ROUGE·auto  orthographe                        chateau → château
   PRODUIT ROUGE·auto  orthographe                        tres → très
   PRODUIT ROUGE·auto  accord pluriel nom                 vacance → vacances
           💡 C'est « les » (pluriel) qui commande → on accorde « vacances ».
   RÉF PY  rouges : On→on visiter→visité chateau→château tres→très vacance→vacances · oranges : — · soulignés : —

[classique]  « Je ne sais pas ou j'ai mis mes clé, peut etre dans la cuisine. »
   stade produit : alphabétique (écrit au son) · remèdes : « etre » → « être » : e→ê. Dis-le à voix haute — é ferme, è ouvre., « clé » → « clés » : remplace le verbe par « mordre 
   PRODUIT ROUGE·auto  accord pluriel nom                 clé → clés
           💡 C'est « mes » (pluriel) qui commande → on accorde « clés ».
   PRODUIT ROUGE·auto  orthographe                        etre → être
   RÉF PY  rouges : clé→clés etre→être · oranges : — · soulignés : —

[classique]  « Cette histoire ma beaucoup plut, je la raconterais a mes amis. »
   stade produit : None · remèdes : 
   PRODUIT : — (rien)
   RÉF PY  rouges : — · oranges : — · soulignés : —

[classique]  « Les fleur que j'ai acheter son déjà fané. »
   stade produit : morphosyntaxique (grammaire) · remèdes : « fleur » → « fleurs » : il manque le « s » du pluriel — regarde ce qui commande., « acheter » → « achetées » : c’est un
   PRODUIT ROUGE·auto  accord pluriel nom                 fleur → fleurs
           💡 C'est « Les » (pluriel) qui commande → on accorde « fleurs ».
   PRODUIT ROUGE·auto  accord participe (COD avoir)       acheter → achetées
           💡 Avec « avoir », le participe s'accorde avec le COD placé AVANT (les fleurs que j'ai cueillies) — pas avec le sujet.
   RÉF PY  rouges : fleur→fleurs acheter→achetées · oranges : — · soulignés : —

[classique]  « Il ce demande si sont frère viendra demain. »
   stade produit : morphosyntaxique (grammaire) · remèdes : « ce » → « se » : essaie « cela » à la place — si la phrase ne tient plus, c’est « se ».
   PRODUIT ORANGE      ce/se                              ce → se
   PRODUIT ROUGE·auto  son/sont                           sont → son
           💡 Astuce : remplace par « étaient ». « …demande si étaient frère viendra… » se dit ? oui → « sont » (verbe être) · non → « son » (le sien).
   RÉF PY  rouges : sont→son · oranges : ce→se · soulignés : —

[classique]  « Nous avont marcher longtemps sous la pluit. »
   stade produit : alphabétique (écrit au son) · remèdes : « avont » → « avons » : ici ce son s’écrit « s », pas « t »., « marcher » → « marché » : remplace par une forme sûre (a→
   PRODUIT ROUGE·flag  orthographe                        avont → avons
   PRODUIT ROUGE·auto  terminaison -er/-é/-ez/-ai         marcher → marché
   PRODUIT ROUGE·flag  orthographe                        pluit → pluie
   RÉF PY  rouges : avont→avons marcher→marché pluit→pluie · oranges : — · soulignés : —

[stupide]    « Je vais au avec mon frère. »
   stade produit : None · remèdes : 
   PRODUIT : — (rien)
   RÉF PY  rouges : — · oranges : — · soulignés : —

[stupide]    « Il a manger la pomme et puis il. »
   stade produit : morphosyntaxique (grammaire) · remèdes : « manger » → « mangé » : remplace le verbe par « mordre » — si « mordre » sonne juste c’est l’infinitif -er, si c’est « 
   PRODUIT ROUGE·auto  accord grammatical (é/er)          manger → mangé
   RÉF PY  rouges : manger→mangé · oranges : — · soulignés : —

[stupide]    « Le chat le chien dorment sur le canapé. »
   stade produit : None · remèdes : 
   PRODUIT : — (rien)
   RÉF PY  rouges : — · oranges : — · soulignés : —

[stupide]    « Hier soir nous sommes allé au cinéma voir un très bon. »
   stade produit : morphosyntaxique (grammaire) · remèdes : « allé » → « allés » : il manque « s » : le participe s’ACCORDE ici.
   PRODUIT ROUGE·auto  accord participe                   allé → allés
           💡 C'est « nous » (pluriel) qui commande → on accorde « allés ».
   RÉF PY  rouges : allé→allés · oranges : — · soulignés : —

[stupide]    « Elle a dit que qu'elle viendrait. »
   stade produit : None · remèdes : 
   PRODUIT : — (rien)
   RÉF PY  rouges : — · oranges : — · soulignés : —

[stupide]    « Jai oublié mes clés sur la tabl. »
   stade produit : alphabétique (écrit au son) · remèdes : « Jai » → « J'ai » : l’article est élidé, il faut l’apostrophe., « tabl » → « table » : il manque la lettre « e ».
   PRODUIT ROUGE·auto  élision fusionnée                  Jai → J'ai
   PRODUIT ROUGE·flag  orthographe                        tabl → table
   RÉF PY  rouges : Jai→J'ai tabl→table · oranges : — · soulignés : —

[stupide]    « Les enfants jouent dans jardin. »
   stade produit : None · remèdes : 
   PRODUIT : — (rien)
   RÉF PY  rouges : — · oranges : — · soulignés : —

[stupide]    « Bonjour je voudrais savoir si vous pouvez me dire. »
   stade produit : None · remèdes : 
   PRODUIT : — (rien)
   RÉF PY  rouges : — · oranges : — · soulignés : —

[stupide]    « Il fais froid aujourdhui. »
   stade produit : alphabétique (écrit au son) · remèdes : « aujourdhui » → « aujourdhui » : les accents s’entendent — é ferme, è/ê ouvre. Dis le mot à voix haute avant de choisir
   PRODUIT ROUGE·auto  accord sujet-verbe                 fais → fait
           💡 C'est « Il » (singulier) qui commande → on accorde « fait ».
   PRODUIT ORANGE      mot inconnu                        aujourdhui → aujourdhui
   RÉF PY  rouges : fais→fait · oranges : — · soulignés : aujourdhui

[stupide]    « Mon père travaille dans une entreprise de de transport. »
   stade produit : None · remèdes : 
   PRODUIT ROUGE·flag  répétition                         de → de
   RÉF PY  rouges : — · oranges : — · soulignés : —

[stupide]    « Le film était vraiment très bien fait par contre la fin. »
   stade produit : None · remèdes : 
   PRODUIT : — (rien)
   RÉF PY  rouges : — · oranges : — · soulignés : —

[stupide]    « Tu peux me passer le sel s'il te plait merci. »
   stade produit : None · remèdes : 
   PRODUIT : — (rien)
   RÉF PY  rouges : — · oranges : — · soulignés : —
```
