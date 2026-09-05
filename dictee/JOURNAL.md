# Dictée diagnostique — Journal

> Journal de bord (entrée la plus récente en haut) pour ne pas se perdre ni refaire deux fois.
> Voir aussi : `../DICTEE_ROADMAP.md` (plan), `README.md` (données), `../docs/MEMOIRE.html` (moteur OMEGA).

---

## 2026-09-07 (fin) — `b_slip` RE-MESURÉ sur la surface complète : FERMÉ PAR LA MESURE, et l'« asymétrie » de #664 n'en était pas une

> ② de la file de Rem, après ① tokeniseur (#673) et ③ garde étendue (#674). Variante posée dans un worktree de
> mesure, JAMAIS commitée : aux six sites ≫20× de `_cmp`, la dominance n'écrase pas un candidat PROCHE (tier ≥ 1) ET
> HOMOPHONE EXACT, sauf si l'écraseur est un `_slipMot` de la saisie (décalqué, 7 lignes). Même cadre que le 04/09.

**Ce que le 04/09 voyait** (référence à deux paliers, sans contexte-first, sans DET_G aligné, sans tokeniseur) :
402/19 → 405/18, « gagnant ». Le port JS cassait « je suis **tres** content » → trés et « un **gran** homme » →
gram ; on a cherché l'asymétrie dans la clé phonétique, le bonus POS, les tables POS, contexte-first (#664-#667).

**Ce que la surface complète voit aujourd'hui** (référence ≡ produit à 98,4 % de palier, 880 paires) :
- **La référence reproduit EXACTEMENT les casses du port JS** : sur le gold, `tres`→**trés** [flag] (produit :
  très [auto]) et `apres`→**aprés** [flag] (produit : après [auto]) — deux junks AFFIRMÉS ; et `gran`→gram
  [inconnu] : la batterie **§5 est ROUGE** (`gran` → None au lieu de ('vigilance', grand)). Il n'y avait pas
  d'asymétrie de moteur : il manquait à la référence les étapes portées depuis (#670 · #672 · #673).
- **Garde de palier : 98,4 → 96,8 %, 12 désaccords NOUVEAUX** avec le produit (angrais→engrais, polution→pollution
  = les gains attendus, flag ; mais diver→divers, fast→fat, jant→jan, loire→loir, oten→autant, sété→ai,
  éme→émet, apret→après = des choix que le produit ne fait pas), 1 hors accord nouveau (`l'éme`).
- **Parité : 5 divergences nouvelles**, toutes « Python s'abstient / produit propose » (d'oves, dare, over,
  téléphonies, usque) — b_slip éteint des propositions.
- **Pipeline** : 284 → **286 réparés (+2)**, 14 cassés identiques mot à mot, un-clic 243 → 244, bruit 238 → 232,
  MUET 747 → **750 (+3)**. ⚠️ Le +2 est à la limite de la bande d'ordre ±1 (#662) ; et les 3 « muets » de plus
  sont des junks APPLIQUÉS sur des fautes (trés, aprés…) : la sonde pipeline ne compte une correction appliquée
  fausse ni en réparé ni en cassé — elle tombe dans MUET. Instrument à instruire, pas b_slip à créditer.
- Inchangés : FP à l'échelle 1,40 % · §4 cas fondateurs verts (chein/accor/tres/jamai/autent) · §1 AUTO=0 FLAG=0.

**⇒ `b_slip` est FERMÉ PAR LA MESURE.** Pour +2 réparations dans le bruit, il affirme deux junks (trés, aprés), perd
gran→grand, éteint 5 propositions et s'écarte du produit sur 12 paliers. Ce n'est plus « bloqué sur une asymétrie » :
c'est refusé sur ses effets, vus par un juge qui décrit le produit. Le raisonnement du 04/09 (« le rapport de fréquence
seul ne sépare pas mot rare et bruit ») reste vrai ; sa mise en œuvre par exemption à la dominance, non.

**Et une dette d'instrument nommée** : `dys_pipeline_probe` range en MUET une correction APPLIQUÉE fausse. Il faut
une colonne « appliqué FAUX » — c'est elle qui aurait montré trés/aprés au premier coup d'œil.

---

## 2026-09-07 (suite) — la garde de palier voit désormais le palier « mot inconnu » et ANCRE ce qu'un seul moteur rend

> ③ de la file de Rem (« ces trois points dans l'ordre logique »), juste après le tokeniseur (#673) et avant la
> re-mesure de `b_slip` : la surface de mesure doit être COMPLÈTE et gardée avant qu'on y mesure une variante.

**Ce qui change dans `palier_gold_probe`** : le dump du produit inclut la famille « mot inconnu » (spellUnknown,
orange) comme 4ᵉ palier `inconnu` (∅ = souligné sans suggestion), la référence est appelée avec `inconnu=True` ;
et les corrections qu'UN SEUL moteur rend (« référence seule » / « produit seul ») sont ANCRÉES : une nouvelle
rougit, une disparue est un gain. C'est l'angle mort de `parity_speller` (« Python corrige / produit muet », noté
depuis #663), fermé.

**Vue ROUGE d'abord, contre la référence de #673** — et le rouge dit exactement ce qu'on cherchait :
- paires **604 → 880** (le palier `inconnu` en apporte 276 : **269 accords, même mot 269/269**) ; accord
  **866/880 = 98,4 %** (< 98,8 ancré : la base a changé, pas le produit) ;
- **7 désaccords NOUVEAUX**, invisibles jusque-là : **6 « vigilance (py) vs inconnu (produit) »** (`aggrée`,
  `courrent`, `merais`, `panden`, `petet`, `regetes` — `correct_token` Python PROPOSE en orthographe là où
  `spellTokenCore` rend null et `spellUnknown` propose ; même mot 3/6) et **1 « inconnu (py) vs vigilance
  (produit) »** (`aparé`→apparais vs « a paré » : la découpe en deux mots, absente) ;
- **hors accord : 2** (`Enerver` — atStart ≡ premier token du texte ; `ere` — appariement par occurrence),
  **0 produit seul**. L'angle mort est ÉNUMÉRÉ, plus estimé.
Ancré tel quel (`--fix`) : 880 paires, 98,4 %, 14 désaccords distincts, 2 hors accord ; vert ensuite.

**Ce que le rouge nomme pour la suite** (aucun port dans ce PR) : la génération des CANDIDATS (`_cands` Python
vs `cand` JS) diverge sur des non-mots à match phonétique (courrent→courant est proposé par la référence en
orthographe, par le produit en « mot inconnu ») — à instruire AVANT `_slipMot`/`_aux`, puisque c'est en amont.
La carte des étapes JS absentes reste : `_slipMot`/élongation (auto), `_aux` participe (flag), découpe « a paré »,
`atStart`. **`b_slip` peut maintenant être re-mesuré sur une surface complète et gardée** (② de la file).

---

## 2026-09-07 — le tokeniseur du produit porté dans la référence : l'angle mort de l'appariement était surtout ÇA

> 7ᵉ maillon de « la référence décrit le produit » (#659 · #663 · #665 · #666 · #670 · #672). Nommé par la garde
> d'accord de palier le 06/09 : « d'une pérsone », « l'est conporte » — UN token côté produit, deux côté référence.

**① LE DÉFAUT.** `toks` (dys-core.js l.11, miroir app) garde l'apostrophe dans le token : « d'une », « l'est »,
« qu'il », « d'othographes » sont un token. La référence tokenisait avec `TOK` (lettres seules) : elle voyait
« une » puis « pérsone » — un déterminant que le produit ne voit pas, donc un POS attendu, donc un palier AFFIRMÉ
là où le produit PROPOSE. Et pour les tokens d'élision fautifs (« d'oves »), le produit passe par un étage
`spellToken` qui analyse le RESTE avec le contexte des tokens entiers puis ré-attache le préfixe (gardes :
voyelle/h après l'élision, distance ≤ 1 hors auto) — étage absent de la référence, qui coupait le token en deux
et corrigeait « oves » seul, à un autre offset : **inappariable** pour toute sonde qui aligne sur le produit.

**② LE PORT** : `TOK_JS` (décalque de `toks`), `spell_token` (décalque de `spellToken` l.2918-2926, avec `sed1`
décalque de `sEd1`), `correct_text` passe par les deux ; `parity_speller` compare désormais via `spell_token`
(elle donnait déjà les tokens du produit à la référence, mais sans l'étage). 12 témoins / 12 identiques au
produit, mot ET palier : « d'une pérsone »→personne **vigilance** · « l'est conporte »→comporte **vigilance** ·
« les d'oves »→d'oses vigilance · « qu'il vien »→viens flag · « L'ecole »→L'école auto · « Lannée »→L'année flag
(la fusion sans apostrophe, déjà portée, reste). `spellUnknown` refuse l'apostrophe des deux côtés.

**③ LA MESURE, produit byte-identique.** Accord de palier sur le gold : **98,3 → 98,8 % (597/604), 0 nouveau,
3 disparus** (agées, conporte, pérsone). Mais le vrai résultat est ailleurs : les colonnes HORS accord — les
corrections qu'un seul moteur rend — passent de **35 référence seule / 20 produit seul à 8 / 1**. L'« angle mort »
de parity_speller (« Python corrige / produit muet », noté depuis #663) était en grande partie un artefact de
tokenisation. Ce qui reste, lu un par un dans le produit :
- 5 « référence seule » sont en réalité **une autre FAMILLE côté produit** : `merais`, `petet`, `courrent`,
  `regetes`, `panden` sortent en « mot inconnu » (spellTokenCore rend null, spellUnknown propose) là où
  `correct_token` Python propose en orthographe|vigilance — la garde ne compare que la famille `orthographe`,
  c'est le prochain pas de la garde (③ de la file : comparer aussi le palier « inconnu ») ;
- 1 est la **majuscule en début de phrase** (`Enerver`→Énerver auto) : le produit ne passe `atStart` qu'au
  premier token du TEXTE (`i===0`), la référence à chaque début de phrase — 1 cas sur 604, nommé, pas porté ;
- 1 « produit seul » est une **suggestion à deux mots** (`aparé`→« a paré ») : étape de découpe absente ;
- 2 (`ere`, `aggrée`) : même mot, même palier des deux côtés, appariement par occurrence pris en défaut — à voir
  avec la garde étendue.
Les 7 désaccords de palier restants sont les deux dernières étapes JS absentes : `_slipMot`/élongation → **auto**
(`alllez`, `cocinelle`, `contorl`, `fourgonette`, `fautra`) et `_aux` participe → **flag** (`prais`→prêté,
`étudiré`→étudiée ; et `ceuse`→cessé vs cesse au même palier).

**Pipeline** (`dys_pipeline_probe`, 72 productions, 1 542 fautes) : **284 réparés (18,4 %) = inchangé · 14 cassés
IDENTIQUES mot à mot** · un-clic 243 = inchangé · bruit orange 236 → 238 (+2) · MUET 749 → 747 (−2). Lecture : la
sonde pipeline alignait déjà sur les tokens à apostrophe (#614) ; les 2 muets devenus bruit sont des tokens
d'élision où le produit propose (faux) et où la référence se taisait. FP à l'échelle **1,40 %** inchangé ; batterie
§1 AUTO=0 · FLAG=0 · VIGILANCE=1, §2 7/11, §3-§5 verts.

**Précision par famille** (référence) : `orthographe|flag` 83,9 → 82,9 % (422 J / 11 I / 76 F, n 479 → 509) ·
`vigilance` 54,2 → 53,6 % · `auto` 88,0 → 88,2 % (350 / **0** / 47). Les 2 « mots justes réécrits » de plus au
palier flag sont `d'oeuvre`→d'œuvre et `inspireé`→inspiré (corpus faiblesses) — **identiques au produit sur le texte
complet** (vérifié dans dys-core) : la baisse est le juge qui décrit le produit, ré-ancrée ; `--navigateur` intact.

**Parité** `parity_speller` (262 comparaisons) : **12 → 5 ancres, 0 nouvelle** — les 7 disparues sont TOUTES des
« py — » sur des tokens d'élision (`d'aeration`, `d'oves`, `l'Oeuf`, `l'apprehender`, `l'economie`, `l'ete`,
`l'hotel`) : la référence les coupait en deux et ne voyait rien. Les 5 qui restent : `saisoon` (auto vs flag),
`dera` (mot, vigilance), `france`, `miya`, `genus`.

**⇒** La série a maintenant une carte complète des étapes non portées : `_slipMot`/élongation (auto), `_aux`
participe (flag), découpe « a paré », `atStart` ≡ premier token. Et la file de Rem se déroule dans l'ordre :
① tokeniseur — fait ; ③ étendre la garde aux colonnes hors accord et au palier « inconnu » ; ② re-mesurer `b_slip`.

---

## 2026-09-06 — contexte-first porté dans la référence : 239 → 284 réparés à produit identique, et un DET_G de trop

> 6ᵉ maillon de « la référence décrit le produit » (#659 · #663 · #665 · #666 · #670). Chiffré avant d'être fait :
> 36 « vigilance (py) vs flag (produit) » sur le gold, 7 ancres de parité, A/B « gross » seul → vigilance,
> « une gross » → flag. C'est la première jonction que la garde d'accord de palier (05/09 soir) a vue de bout en bout.

**① LE PORT** : décalque du bloc `if(expPos){…}` de `spellTokenCore` (dys-core.js l.3080-3083, miroir app) à la
même position dans `correct_token` — après les autos, avant le gate confident. Quand le contexte attend un POS,
le plus fréquent des candidats édit-1/accent (p ≥ 1) qui a la MÊME clé phonétique que la saisie, colle au POS
attendu, respecte l'audibilité de la finale, le NOMBRE du contexte (forme invariable = compatible, décalque de
`sInvarS`) et le GENRE du déterminant immédiat, est AFFIRMÉ (flag) même court ou non dominant — sauf si le
vainqueur du tri colle déjà au POS et est ≫20× plus fréquent (« un chein » reste chien). Témoins ≡ produit :
`une gross`→grosse flag / `gross`→gros vigilance · `il a pri`→pris · `ils von`→vont · `il pleu`→pleut.

**② ROUGE D'ABORD, ET CE QU'IL A TROUVÉ.** La garde d'accord de palier sur le gold est montée de 92,4 % à
97,6 % — et a ROUGI : **5 désaccords NOUVEAUX**, tous « Python affirme, le produit propose » : `au boulo`,
`du marcketing`, `au échenge`, `d'une pérsone`, `l'est conporte`. Cause 1 (3/5) : **`DET_G` Python contenait
« du » et « au » ; le `DET_G` du produit (l.1331) non.** Le POS attendu (#665) en héritait sans que rien ne le
dise, parce que le POS attendu ne pesait que dans le TRI ; dès qu'il décide un PALIER, l'écart se voit. Aligné
verbatim (même geste que #665) → **98,3 % (575/585), 31 désaccords disparus, 2 restants**. Cause 2 (2/5) :
**tokenisation des apostrophes** — « d'une », « l'est » sont UN token côté produit (`toks`), deux côté
référence (`TOK` sans apostrophe) ; le produit ne voit donc ni déterminant ni copule avant le mot. Jonction
suivante, nommée ; les 2 sont ancrés avec leur cause.

**③ MESURÉ, produit byte-identique** (`dys_pipeline_probe`, 72 productions, 1 542 fautes) :

| | main (#670) | contexte-first seul | + DET_G aligné (livré) |
|---|---:|---:|---:|
| RÉPARÉS sans clic | 239 (15,5 %) | 287 (18,6 %) | **284 (18,4 %)** |
| rattrapable EN UN CLIC | 277 | 241 | 243 |
| bruit orange | 251 | 234 | 236 |
| signalé sans suggestion | 30 | 30 | 30 |
| MUET côté Python | 745 | 750 | 749 |
| ⛔ CASSÉS | 14 | 14 | **14 — identiques mot à mot** |

Conservation : −45 ratés = un-clic −34 · bruit −15 · muet +4. Les 3 réparations que l'alignement DET_G
rend au clic sont exactement celles que le produit ne fait que proposer (« au boulo »). Le « ~276 au plus »
attendu était une borne de la mesure du 05/09 (37 vigilance/flag) : la référence affirme aussi là où elle
s'ABSTENAIT (`cha`→chat, `pû`→pu : contexte-first tire « même court », avant le gate `len ≥ 4`).

**Inchangés / verts** : FP à l'échelle 1,40 % (35/2 500) · batterie §1 AUTO=0 · FLAG=0 · VIGILANCE=1 ·
§2 non-mots 5 → 7 corrigés exactement (les deux vigilances devenues flags, comme au produit) · §3/§4/§5 verts
(les 7 témoins de palier de #670 tiennent). **Parité** `parity_speller` : 23 → **12** ancres, 12 disparues
(apperçoit, blanch, cha, gross, innondation, pery, pû, sympatique×2, turkey, dera×2), 1 re-clée (`dera` : Python
dit désormais déjà, le produit ders — désaccord de mot au palier vigilance, pas de palier), 0 nouvelle.
**Précision par famille** (`dys_precision_ref`, référence) : `orthographe|vigilance` 57,5 → 54,2 % (les justes
sont passés en flag, mécanique — comme au 05/09) · `flag` 83,2 → 83,9 % · `auto` 88,2 → 88,0 % (329 justes / **0 mot
juste réécrit** / 45 fausses). Ré-ancrée ; `--navigateur` (le produit) non touché.

**⇒ Ce que ça change** : le chiffre de référence est **284 / 14**, et sa borne est désormais serrée — 2
affirmations produit non portées (apostrophes) au lieu de 37. `b_slip` peut être re-mesuré (jonction suivante,
PAS dans ce PR). Et la garde du 05/09 a fait exactement son travail : sans elle, le DET_G de trop passait.

---

## 2026-09-05 (soir) — la garde qui aurait vu #667 plus tôt : accord de PALIER produit↔référence sur le gold

> Suite directe de #670. La mesure ad hoc qui a fermé le chantier (525/570 = 92 %) devient une garde
> DURABLE : `dictee/palier_gold_probe.py` (+ `palier_gold_dump.js`, moteur de l'extension équipé
> comme dans `parity_core.js`). Modèle : `parity_speller` (ancrage, rouge sur nouveauté) ×
> `dys_precision_probe` (gold LOCAL ⇒ **SAUTÉE explicitement** sans corpus, jamais un vert muet).

**Ce qu'elle compare.** Sur les 72 productions du gold, chaque correction du speller que rendent LES
DEUX moteurs pour le même mot (appariement par occurrence, dans l'ordre — la mesure ad hoc écrasait
par mot, dernier gagnant, d'où 570 → 566 paires) : le PALIER référence (`correct_text` → action)
contre le palier produit (`spellText`, famille `orthographe`). Les corrections d'UN SEUL moteur
(35 référence seule · 39 produit seul) sont comptées à part, jamais dans le pourcentage.

**À la pose — 523 / 566 = 92,4 %** (référence 601 corrections, produit 605) :

| py \ produit | auto | flag | vigilance |
|---|---:|---:|---:|
| **auto** | **119** (même mot 118) | 1 | — |
| **flag** | 4 | **115** (même mot 115) | — |
| **vigilance** | 2 | **36** (même mot 25) | **289** (même mot 275) |

Le seul désaccord de masse reste **vigilance (py) vs flag (produit) : 36** — contexte-first non
porté, le maillon suivant. 39 désaccords distincts ancrés.

**Vue ROUGE avant d'être crue** : ancien gate flag-only rétabli dans `speller_probe` (une ligne) →
**270 / 566 = 47,7 %, 256 désaccords NOUVEAUX**, sortie 1 ; gate restauré → 92,4 %, vert. Et le
chemin « plancher » seul (référence trafiquée à 99,9 %) rend aussi 1.

**Règle d'ancrage** : baisse de l'accord = rouge ; désaccord NOUVEAU = rouge même si l'accord global
monte ailleurs (le masque classique du plancher) ; hausse = gain annoncé, à ré-ancrer (`--fix`).
Câblée dev.sh ≡ ci.yml (ci_parity 89/89), ETAT.md régénéré (89 gardes).

---

## 2026-09-05 — le palier VIGILANCE du speller porté dans la référence : le chiffre de référence était SUR-COMPTÉ de 165

> 5ᵉ maillon de « la référence décrit le produit » (`_SPELL_KEEP` #659 · mot inconnu #663 · POS attendu
> #665 · x final #666). Ouvert par #667 : le juge Python ne voyait pas le palier où `b_slip` perdait.

**① LE DÉFAUT.** Le produit (`spellTokenCore`, app + dys-core) n'AFFIRME une correction (`flag`, appliquée
par « tout corriger ») que s'il est **confiant** — accent pur, OU finale muette -s/-x ajoutée
(dehor→dehors), OU édit-1 gardant la 1ʳᵉ lettre, SEUL de son rang et dominant ; sinon il PROPOSE en
orange (`vigilance`, au clic). La référence Python rendait `flag` dès que le seuil passait : **elle
appliquait ce que le produit ne fait que proposer.** Trois consommateurs (`dys_pipeline_probe`,
`cube_veto_probe`, `spirale_probe`) branchaient déjà `act == 'vigilance'` — le palier était attendu en
aval et jamais émis.

**② LE PORT** : décalque du gate `confident` (dys-core l.3084-3097 — `first_ok`, `n_top`, `final_s`,
`sub_fin`). Substitution de la consonne finale JAMAIS affirmée (Durand/Durant, poids/pois). Vérité JS
mesurée sur dys-core chargé de ses assets : **10 témoins / 10** identiques, mot ET palier — dont
`leson`→leçon en **vigilance** : `CORRECTEUR.md` le citait en FLAG depuis des semaines, c'est la doc
qui était en retard sur le produit (corrigée : 3 paliers, 9 exemples mesurés dans les 3 moteurs).

**③ PARITÉ, protocole rouge-d'abord.** `parity_speller` étendue au palier `orthographe|vigilance`
AVANT le port → **51 divergences nouvelles / 262** (le palier manquant, chiffré). APRÈS → **14**,
toutes à mécanisme identifié HORS gate, ancrées (12 → 23) et classées :
- **7** : le JS affirme via une étape absente en Python — la **ré-sélection contexte-first**, CONFIRMÉE
  par A/B (`gross` seul → vigilance, « une gross » → flag ; idem `innondation`) ; 3 ne sont que des
  ancres re-clées (`apperçoit`, `blanch`, `pery` : Python a changé de palier sur son propre mot) ;
- **4** : choix de mot différent AU palier vigilance (`dera`, `genus`, `turkey`) — l'angle mort les cachait ;
- **3** : le JS propose, Python s'abstient (`d'oves`, `france`, `miya` — élision, nom propre, seuil).

**④ VALIDATION SUR LE GOLD (pas seulement le corpus de parité).** 570 corrections appariées par mot :
accord de palier produit↔référence **525 (92 %)**. Le seul désaccord de masse : **37 « vigilance (py) vs
flag (produit) »** — contexte-first, non porté. ⇒ la référence est désormais une **borne basse** de ce que
le produit applique, à ≤ 37 près.

**⑤ LE CHIFFRE DE RÉFÉRENCE, AVANT → APRÈS** (`dys_pipeline_probe`, 72 productions, 1 542 fautes ;
produit **byte-identique**, seul le juge change) :

| | avant (main) | après le port |
|---|---:|---:|
| RÉPARÉS sans clic | **404 (26,2 %)** | **239 (15,5 %)** |
| rattrapable EN UN CLIC (orange juste) | 118 | **277** |
| bruit orange (orange faux) | 106 | 251 |
| signalé sans suggestion | 30 | 30 |
| MUET côté Python | 884 | 745 |
| ⛔ CASSÉS (mots justes) | **19 (0,41 %)** | **14 (0,30 %)** |

Conservation vérifiée : ratés 1 138 → 1 303 (+165) = un-clic +159 · bruit +145 · muet −139. Lecture :
**165 « réparations » n'en étaient pas** (le produit les propose, 159 sont justes → un clic) ; **139
« muets » recevaient en fait une proposition FAUSSE** que la référence appliquait (→ bruit orange) ;
et **5 « cassés » ne sont pas cassés** par le produit (il ne fait que proposer). Le 402/19 de
CLAUDE.md était périmé depuis #665 (404/19) sans avoir été mis à jour — corrigé, avec sa borne.

**Inchangés** : FP à l'échelle 1,40 % (35/2 500) · batterie §1 sur GEC : AUTO=0 · FLAG=0 ·
VIGILANCE=1 (le « FLAG=1 » d'avant était une proposition au clic) · §3/§4 verts · §5 (nouveau, 7
témoins de palier ≡ produit) vert.

**⇒ Ce que ça change pour la suite** : tout gain speller mesuré en Python AVANT ce jour sur-comptait ;
`b_slip` peut être RE-MESURÉ sur la surface complète (préalable levé). Et le maillon suivant est
nommé et chiffré : **porter contexte-first** (≤ 37 affirmations, 7 ancres). Une garde durable
« accord de palier produit↔référence sur le gold » (525/570) est à créer — c'est elle qui aurait vu
tout ça plus tôt.

---

## 2026-09-05 — différés ② et ③ : la cible des « relatives » était la MAUVAISE, et le canal GROUPE reste OFF faute de données

**② RELATIVES / SUJET DISTANT — mesuré avec l'instrument dédié, pas avec un filtre improvisé.**
Première tentative : un filtre maison sur le gold dys, qui a rendu « 320 ratés » — chiffre **jeté**,
il attrapait `foie`→fois et `tomate`→tomates (l'heuristique « terminaison verbale » matchait toute
différence d'une lettre). C'est exactement le piège que le projet répète : *l'instrument avant le
moteur*. Reprise avec `dictee/sujet_probe.py`, versionnée en #613 précisément pour ça.

**Ventilation des échecs de sujet NOMINAL (1 166 sur 4 175 verbes finis à sujet or) :**

| structure | échecs | part |
|---|---:|---:|
| **nom propre** | **434** | 37 % |
| **distant > 3 jetons** | **299** | 26 % |
| autre | 173 | 15 % |
| postposé | 92 | 8 % |
| coordonné | 85 | 7 % |
| dét élidé | 50 | 4 % |
| **relative** | **33** | **3 %** |

⇒ **La cible du différé était la mauvaise.** « Relatives + coordinations » pèsent **118/1 166 (10 %)**,
la relative étant le **plus petit** poste de tous. Les deux tiers de la masse sont ailleurs :
**nom propre (434) et sujet distant (299) = 63 %**. Si l'on rouvre le sujet nominal un jour, c'est
là qu'il faut aller — et le nom propre est déjà partiellement outillé (table PRÉNOMS, #615).

⚠️ **Honnêteté de protocole** : cette ventilation est mesurée sur **UD (français correct)**, alors
que le « ~13 ratés » de l'enquête du 30/08 portait sur le **gold dys**. Les deux ne se comparent pas
terme à terme ; ce qui est solide ici, c'est la **hiérarchie des structures**, pas un report de
volume vers le dys. Rappel du plafond global déjà mesuré (30/08) : débloquer le parseur de sujet
vaut **+10-15 réparations au mieux**, les gisements 3-4× plus gros sont ailleurs.

**③ CANAL GROUPE — rien de neuf, il reste OFF-inerte.** La règle posée en #617 est explicite : tout
futur consommateur doit faire SA preuve AU PRODUIT (le premier essai rendait 0 réparation / +1 FP).
Aucun consommateur n'est proposé aujourd'hui et aucune donnée nouvelle n'est apparue ⇒ **on ne
rouvre pas**. Ce qui compterait comme « donnée nouvelle », pour mémoire : un consommateur autre que
le lo-scan de `_np_subject` (borner `_plural_before` ? un tier orange ?) accompagné d'un A/B produit
montrant un gain net — pas un gain de la tâche parseur, qui a déjà été mesuré comme ne traversant
pas les gardes des règles.

---

## 2026-09-05 — différé « a→à devant la/le/les » : INSTRUIT par la mesure (le cadre existe, sa limite est nommée)

> Le différé de #616 disait « 1 500+ configs avoir-correct » sans plus de détail. Re-mesuré des
> DEUX côtés (gold dys + UD complet 14 450). Rien n'est câblé ici : c'est l'enquête préalable.

**① La population du gold, ventilée par ce qui SUIT** (100 cas `a`→`à` alignés, 72 productions) :
`a` + NOM NU **61** (cadre livré #616) · **`a` + la/le/les 17** · `a` + autre déterminant 12 ·
`a` + l'X élidé 6 · `a` en fin de phrase 3 · `a` + Majuscule 1.

**② La surface FP est BIEN plus petite qu'annoncé** : sur UD 2 500, `a + la/le/les` ne compte que
**6** occurrences ; sur UD complet, **36**. Le « 1 500+ » ne décrivait pas cette configuration.

**③ ⚠️ MON PREMIER CADRE ÉTAIT À L'ENVERS — et la mesure l'a dit.** J'ai d'abord exigé un
**créneau verbal LIBRE** (la garde des règles de sujet) : **1 pris / 19 ratés** sur le gold. La
raison est évidente après coup : dans « je vais **a la** plage », le créneau est justement PRIS par
« vais ». **La bonne condition est l'inverse** — `a` est la PRÉPOSITION quand la proposition a
DÉJÀ un verbe conjugué ailleurs, car alors `a` ne peut pas être le verbe. Cadre inversé :
**19 pris / 1 raté**.

**④ Le compromis, chiffré des deux côtés** :

| cadre | couverture gold | FP sur UD 14 450 (français correct) |
|---|---|---|
| créneau verbal LIBRE (faux) | 1 / 20 | — |
| créneau verbal PRIS (juste) | **19 / 20** | ~11 |
| + garde « pas de sujet devant » | **8 / 20** | **2** |

**⑤ Les 2 FP résiduels, lus un par un** — et il n'y en a qu'UN de vrai :
- `qu'Alégracia a les yeux verts` : sujet PROPRE derrière une conjonction élidée ; ma garde testait
  la majuscule du token entier (`qu'Alégracia` commence par `q`) — **fermable** en coupant sur l'apostrophe ;
- `A la conférence de Paris…` : c'est une **VRAIE FAUTE D'UD** (la capitale `À` sans accent), que la
  règle corrigerait à raison. Comptée FP par le protocole, elle n'en est pas une.

**⑥ La vraie limite, et elle est connue** : les 12 cas perdus par la garde de sujet sont tous du type
« je suis **aller a la** plage » — le verbe y est LUI-MÊME mal orthographié, donc indétectable comme
verbe conjugué. C'est **le même mur que les bornes de proposition** (enquête 30/08) : sur du dys, la
détection de verbe est le facteur limitant, pas le cadre.

**⇒ Le différé devient un chantier INSTRUIT** : cadre connu (verbe conjugué ailleurs + pas de sujet
devant), gain mesuré 8/20 pour 1 FP réel fermable, plafond fixé par la détection de verbe. À
reprendre APRÈS le portage du palier `orthographe|vigilance` (cf. entrée précédente) : tant que la
référence ne voit pas tout ce que le produit affiche, un « +8 » Python n'est pas un gain produit.

**Non mesurés ce tour, restent différés tels quels** : relatives/coordinations du sujet distant
(~13 ratés, enquête 30/08) · canal GROUPE (OFF-inerte #617, doit faire sa preuve au produit).

---

## 2026-09-05 (fin) — b_slip : la cause TROUVÉE, et ce n'était AUCUNE des hypothèses — le juge était aveugle au palier

> Enquête lecture-seule. Trois hypothèses successives avaient été écrites et **toutes réfutées** :
> clé phonétique (#663 → portée en #666), bonus POS contextuel (#665), puis « la ré-sélection
> contexte-first ». Voici la vraie réponse, et elle n'est dans aucune des trois.

**Ce qui a été écarté par la mesure, dans l'ordre**
1. **Clé phonétique** : `phonKey` ≡ `phon_key` sur les mots en cause (et le x final est porté depuis, #666).
2. **Bonus POS** : aligné (#665) — l'échec persistait ; et avec `exp_pos='VA'`, ni `trés` (tagué `N`)
   ni `très` (aucun POS) ne reçoit le bonus, dans **aucun** moteur.
3. **Tables POS** : **identiques** — l'asset JS donne `trés`→`N`/18 089 et `très`→*aucun POS*/1 435 582,
   exactement comme la référence.
4. **Ré-sélection « contexte-first »** : neutralisée en A/B (`if(false&&expPos)`) → **aucun changement**.
   L'hypothèse écrite la veille est **fausse**.
5. **Lexiques app ↔ extension** : décompressés et comparés — **byte-identiques** (705 653 lignes).

**⭐ LA CAUSE : le juge ne regardait pas le bon palier.** Le produit rend
`gran` → **`grand`**, famille `orthographe`, palier **`vigilance`**. Or la référence Python **n'émet
pas ce palier** : `correct_text` rend `auto`/`flag` (plus `inconnu` depuis #663) — le speller Python
compte **2** occurrences de « vigilance » (des commentaires) contre **46** côté `dys-core.js`.
Sous `b_slip`, le tri change et le produit **perd** `gran`→`grand` (il tombe au palier « mot inconnu »
et rend `gram`) ; la mesure Python, elle, ne voyait pas ce palier et affichait un **gain** (405/18
puis 407/18 après l'alignement du POS). **Il n'y a jamais eu d'asymétrie de comparateur : il y avait
un trou dans la SURFACE DE MESURE de la référence.**

**Conséquence pour b_slip** : réfuté pour une raison SIMPLE et engine-agnostique — il coûte
`gran`→`grand`, une correction que `dictee/test_speller_app.js` garde explicitement
(« audibilité finale muette »). Ce n'est plus un mystère de portage, c'est un coût mesurable qu'on
refuse. Le gain Python annoncé (+3/−1) est **non fiable tant que la référence n'émet pas le palier
vigilance du speller** : il compte des gains sur un périmètre qui ignore une partie de ce que le
produit affiche.

**⇒ LE CHANTIER SUIVANT, NOMMÉ** : porter le palier **`orthographe|vigilance`** du speller dans
`dictee/speller_probe.py` — cinquième maillon de la série « la référence décrit le produit »
(`_SPELL_KEEP` #659 · palier « mot inconnu » #663 · POS attendu #665 · x final #666). Tant qu'il
manque, toute mesure speller faite en Python sous-estime ce que l'utilisateur voit. Ne PAS re-tenter
b_slip avant : son verdict doit être rendu sur la surface complète.

**Reste ouvert, mineur** : sous `b_slip`, le harnais `test_speller_app.js` (qui EXTRAIT une tranche
de l'app et l'évalue) rendait `tres`→`trés` là où le moteur extension rend `très`, à lexiques
identiques et `_cmp` textuellement identique. Non élucidé ; à re-tester si b_slip revient.

**Leçon (la troisième en deux jours, toujours la même)** : trois attributions écrites avec assurance,
trois réfutations par la mesure. Ce qui a fini par payer n'est pas une meilleure intuition, c'est
d'avoir comparé **ce que chaque instrument peut voir** avant de comparer leurs résultats.

---

## 2026-09-05 (suite) — le X FINAL MUET porté dans la référence — et une SONDE QUI MENTAIT au lieu d'échouer

**① LE PORTAGE.** Le commit #244 (21/07/2026) avait rendu le **-x final muet** dans `phonKey` côté app
ET extension (`res+=(j===s.length-1?'':'ks')`) ; `dictee/speller_probe.py` gardait un
`res.append('ks')` **inconditionnel**. Six semaines d'asymétrie silencieuse — la référence ne
décrivait pas le produit sur toutes les finales en `-x`. Elle n'a été VUE que le 04/09, par la sonde
de parité étendue au palier « mot inconnu » (#663), qui avait ancré 3 divergences faute de pouvoir
les expliquer. Correctif = miroir direct (prétraitement identique des deux côtés, `aux`→`o` compris) :
seul le x FINAL tombe. Vérifié clé par clé — `cheveux` `'§evek'`→`'§ev'` (= JS), `yeux` `'iek'`→`'i'`,
`noix`→`'nva'`, `prix`→`'pri'`, et `taxi` `'taksi'` / `exact` `'eksak'` **INCHANGÉS**.

**Mesures** : gold pipeline **404 réparés (26,2 %) / 19 cassés (0,41 %) IDENTIQUE** (aucun arbitrage
requis) · FP échelle 1,40 % identique · batteries §1/§3/§4 vertes · parité speller **15 → 12 ancres**,
les 3 prédites disparues (`chevout`→cheveux, `rosso`→roseaux, `yay`→yeux). Ré-ancrage **À LA BAISSE** :
une ancre de moins = une asymétrie réparée, jamais un plancher relâché.

**② ⚠️⚠️ L'INSTRUMENT QUI MENTAIT (la vraie prise du jour).** `dev.sh` a sorti un rouge « précision AU
PRODUIT » (`orthographe|vigilance·propre` 54,9 % < plancher 55,4) — alors que **ce PR ne touche AUCUN
fichier JS**. Re-mesuré proprement sur `main` non modifié PUIS sur la branche : **108 = 108**, et les
**196 lignes de classification identiques au caractère près**. Le 54,9 % était FAUX.

**Cause** : lancer un script Python depuis `extension/` y laisse un **`__pycache__`** — gitignoré,
donc invisible au diff. Chrome **refuse** un dossier d'extension contenant un nom en `_` (réservé
système). Et la sonde, au lieu d'échouer, **a rendu un chiffre plausible**, lu comme une régression
pendant une heure. C'est exactement ce que la doctrine interdit : *un instrument doit échouer
BRUYAMMENT, jamais mentir*. (Le même piège avait déjà mordu la veille pendant la vérification de
#663 — sans qu'on en tire la conséquence. Deuxième fois : on garde.)

**Garde posée** — `verifierDossierExtension()` dans `extension/cdp_chrome.js` (le helper partagé),
appelée par `dictee/navigateur_flags_dump.js` avant tout `Extensions.loadUnpacked` : elle refuse de
démarrer, **nomme le fichier exact à supprimer**, et sort en 2. **Vue ROUGE sur le défaut réel**
(`__pycache__` réintroduit) avant d'être crue.

**Leçon, la même que le 04/09 sous un autre visage** : un rouge n'est pas une preuve de régression,
c'est une question. Celui-ci disait « ton code a cassé le produit » ; la réponse mesurée était
« ton environnement a cassé la sonde ».

---

## 2026-09-05 — le POS attendu du contexte décrit enfin le PRODUIT — et RECTIFICATION de l'attribution de #664

> Chantier ouvert par #664 (b_slip réfuté au portage JS). Enquête lecture-seule puis alignement.

**L'ASYMÉTRIE, LUE PUIS MESURÉE.** La référence Python et les moteurs JS ne dérivaient pas le même
« POS attendu du contexte », qui pilote le bonus POS du classement des candidats du speller :

| | portée | déclencheurs |
|---|---|---|
| référence Python (avant) | **3 jetons** en arrière, saute les adjectifs | déterminant→`N`, adverbe→`A` |
| produit (app + extension) | **1 seul jeton** | + copule→`VA`, auxiliaire-avoir / pronom-sujet→`V` |

Le second jeu vient de l'audit 07/2026 (« je suis trist »→triste, pri→pris, pleu→pleut) et n'avait
jamais été porté dans la référence. Tables JS **lues dans le fichier** (aucune transcription à la
main), motifs validés sur positifs connus avant de conclure.

**Population** : **11,7 %** des jetons d'UD 2500 et **14,5 %** du gold recevaient un POS attendu
différent — mais **seules 9 corrections du gold et 1 d'UD en changeaient**. Jugées une par une
contre le gold : le **PRODUIT a raison 2 fois** (cose→cause, forse→force), l'ancienne référence 1
(deriere→derrière), **les deux ont tort 6** ; et côté UD le produit **retire un FP** (« ambu »→abu).

⇒ **La référence est alignée SUR LE PRODUIT** (même geste que `_SPELL_KEEP` #659 et le palier
« mot inconnu » #663 : la référence doit décrire ce qui est livré, pas un autre moteur). `AUXAV` et
`SUBJP` décalquées verbatim de `dys-core.js` ; `COPULA` était déjà identique (vérifié).
**Mesures : pipeline 402/19 → 404 réparés (26,2 %) / 19 cassés (0,41 %)** · FP échelle 1,40 %
inchangé · batteries §1-§4 vertes (dont §4, les cas fondateurs de #664) · parité speller 209
comparaisons, 0 divergence nouvelle.

⚠️⚠️ **RECTIFICATION DE #664 — l'attribution était FAUSSE.** L'entrée du 04/09 (soir) écrivait que
l'échec du portage de `b_slip` venait « du bonus POS contextuel (pm/pmatch) ». **C'est réfuté par la
mesure** : une fois la dérivation alignée, `b_slip` ré-appliqué à la référence Python donne
**407 réparés / 18 cassés** et rend TOUJOURS `tres`→très, `chein`→chien, `accor`→accord (batterie §4
verte) — la référence ne reproduit donc toujours pas l'échec observé dans l'app. Cause directe
identifiée au passage : avec `exp_pos='VA'` (copule « suis »), **ni `trés` (tagué `N`) ni `très`
(aucun POS) ne reçoit le bonus** — le bonus POS ne peut pas être le mécanisme, dans aucun des deux
moteurs. **La cause de l'échec de b_slip au portage reste À TROUVER** ; ce n'est ni la clé
phonétique (#663, déjà écarté), ni le POS attendu (ici). Ne pas re-tenter b_slip avant de l'avoir.

**PISTE RESSERRÉE POUR LA SUITE (mesuré ici même)** — trois candidats écartés, un seul debout :
- clé phonétique : `phonKey` ≡ `phon_key` sur les mots en cause (#663 n'explique rien ici) ;
- **tables POS : IDENTIQUES** — l'asset JS `speller.tsv.gz` donne `trés` → `N` freq 18 089 et
  `très` → *aucun POS* freq 1 435 582, exactement comme la référence ;
- POS attendu du contexte : aligné par ce PR, et l'échec persiste.
⇒ Il reste **une étape que les moteurs JS ont et que la référence n'a PAS DU TOUT** : la
**RÉ-SÉLECTION « CONTEXTE-FIRST »** (`dys-core.js` ~3081 / app ~27567 — 1 occurrence de chaque côté
JS, **0 côté Python**, vérifié). Elle tourne APRÈS le tri et re-choisit un candidat édit-1/accent à
même clé phonétique. C'est le seul endroit où les deux moteurs peuvent structurellement diverger
une fois tout le reste aligné — et l'enquête du 04/09 avait déjà noté qu'il ne fallait pas y
toucher (son candidat est phon-exact ∧ tier≥1 par construction). **C'est LÀ qu'il faut chercher.**

**Leçon** : une attribution écrite le soir d'un chantier est une hypothèse, pas un fait — celle-ci
a tenu moins de 24 h. Ce qui l'a fait tomber : avoir mesuré au lieu de re-citer.

---

## 2026-09-04 (soir) — dominance ≫20× : la garde n'était gardée par RIEN ; `b_slip` mesuré gagnant en Python, RÉFUTÉ au portage JS

> Chantier « la dominance ne distingue pas mot rare de bruit lexical » (ouvert depuis le 22-23/08).
> Enquête lecture-seule d'abord (les DEUX populations exigées), puis tentative de câblage.

**① LA BATTERIE QUI MANQUAIT (livrée)** — `speller_probe.main` §4. Les cinq corrections qui sont la
RAISON D'ÊTRE des gardes de dominance de `_cmp` — `chein`→chien, `accor`→accord, `tres`→très,
`jamai`→jamais, `autent`→autant — n'étaient gardées par **RIEN** : grep exhaustif, elles ne vivaient
que dans des **commentaires**. Vécu le jour même : une variante d'assouplissement les a cassées
(`chein`→**chin**, `accor`→**aucune suggestion**) avec **dev.sh entièrement vert**. La batterie est
posée, vue VERTE sur main, puis vue **ROUGE** sur la variante fautive (falsification faite avant
d'y croire), sortie DURE comme §3. Toute retouche de `_cmp` passe désormais par elle.

**② `b_slip` — MESURÉ GAGNANT EN PYTHON** : aux six sites ≫20×, la garde n'écrase pas un candidat
à la fois PROCHE (tier≥1) et HOMOPHONE EXACT, SAUF si l'écraseur est un glissement moteur
(`_slipMot` : anagramme/redoublement) de la saisie. Référence Python : **402/19 → 405 réparés
(26,3 %) / 18 cassés (0,39 %)**, FP à l'échelle 1,40 % inchangé, batterie §4 verte, cas fondateurs
intacts. Le raisonnement tient : le rapport de fréquence **seul** ne sépare pas « mot rare légitime »
de « bruit lexical » — mesuré dans les DEUX sens (73/105 des candidats écrasés *à raison* sont eux
aussi phon-match ; la bande 20-50× contient pollution 23× et engrais 27× **comme** chin 40×).

**③ RÉFUTÉ AU PORTAGE — ne pas re-tenter en l'état.** Porté verbatim dans les deux moteurs JS
(régions `_cmp` vérifiées identiques hors commentaires), il **casse dans l'app** ce que Python
préserve, sur les phrases mêmes de la batterie :

| saisie | Python + b_slip | app/extension + b_slip |
|---|---|---|
| « je suis **tres** content » | `très` (auto) ✅ | **`trés`** (flag) ❌ le junk 18/M gagne |
| « un **gran** homme » | (abstention) | **`gram`** ❌ |

⚠️ **Ce n'est PAS l'asymétrie de clé phonétique de #663** : `phonKey` ≡ `phon_key` sur ces mots,
vérifié (`tres`/`trés`/`très` → 'tr' des deux côtés ; `gran` → 'gr2', `grand` → 'gr2d'). La
divergence vit dans le **bonus POS contextuel** (`pm`/`pmatch`) : sur la MÊME phrase, le bonus tire
côté JS et pas côté Python, si bien que l'exemption ouvre une porte que Python ne voit jamais.
La parité speller CI n'a rien dit (`tres` n'est pas dans son corpus, 0 divergence nouvelle sur 209).

**⇒ b_slip est BLOQUÉ sur une asymétrie Py↔JS du bonus POS, pas sur son propre raisonnement.**
La parité 3 moteurs est obligatoire (un patch Python seul rendrait `parity_speller` rouge) : on ne
livre donc que la batterie. Reprise possible **après** avoir instruit `pm` vs `pmatch` — et le
gain reste attractif (+3 réparations, −1 casse, FP speller 91→86 en Python). Prix déjà nommé si
on y revient : `juis`→jouis perdu ; `parvies` ne devient PAS une réparation (parvis 0,15/M reste
sous la porte d'émission f1≥1,0) — seule la fausse suggestion `parties` disparaîtrait.

**Ce que cet épisode confirme** : c'est la batterie posée AVANT le câblage qui a rendu la
réfutation visible. Sans elle, `b_slip` partait en production avec dev.sh vert et deux corrections
fondatrices cassées en silence.

---

## 2026-09-04 — les soulignés sans suggestion ÉQUIPÉS : S6 élision + S4 clé phonétique d=1 dans la voie '' de spellUnknown (3 moteurs + port Python du palier)

Implémentation du cadre retenu par l'enquête du 04/09 (88 fautes réelles au palier « mot inconnu »
SANS suggestion, sur 1 140 ratés du pipeline ; cause dominante = distance d'édition ≥ 2 : 83/90).

- **Le branchement** : UNIQUEMENT la voie `''` de `spellUnknown` (le fallback « inconnu sans
  suggestion fiable »), app + `extension/dys-core.js` (miroir verbatim) : **S6 ÉLISION** (tête
  d/l/j/n/m/t/s/c/qu + reste corrigé par les MÊMES pools D2A/phon/edits1, voyelle exigée,
  ≥ FLAG_FREQ) PRIORITAIRE, puis **S4 CLÉ PHONÉTIQUE À DISTANCE 1** (edits1 sur la CLÉ, lookup
  PHON, fréquence). Zéro asset nouveau, briques existantes (SELIDE/SVOW/sEdits1/phonKey/SP.*).
  Écartés par l'enquête, non branchés : S1 edit-2 (104 ms/token, 60 % fatigue UD), S5 mot-collé.
- **PROPRIÉTÉ CARDINALE PROUVÉE — aucune marque nouvelle, rien d'appliqué** : gold pipeline
  **402 réparés (26,1 %) / 19 cassés (0,41 %) STRICTEMENT identique** avant/après ; flags totaux
  du dump produit **1 307 = 1 307** ; UD 2500 : mots inconnus **155 = 155** (98 sans/57 avec →
  **65 sans/90 avec**, 33 équipés — la fatigue reste DERRIÈRE le clic). `fp_scale` **1,40 %**
  inchangé ; coût 1er passage texte dys **9 ms** (plafond 120).
- **Ce que voit l'utilisateur** (ventilation produit des 1 140 ratés, dump dys-core) :
  rattrapable en un clic **109 → 142** (+33, l'enquête en prédisait +32 : +1 d'écart, assumé),
  souligné sans suggestion **90 → 30**, bruit orange 197 → 224 (le prix, refusable au clic),
  invisible 614 inchangé. Census vigilance : justes **306 → 309** (dcuatc→ducats, qulqut→quelque,
  spcifiqut→spécifique), pointeuses 240 → 237, fatigue 146 inchangée — aucune orange juste perdue, ré-ancré.
- **Port Python du palier** : `speller_probe.spell_unknown` (décalque de spellUnknown, S6/S4
  compris — None / '' / suggestion), action **`inconnu`** OPT-IN via `correct_text(...,
  inconnu=True)` (défaut OFF, aucun consommateur existant ne bouge). `dys_pipeline_probe` la
  consomme : la ligne « signalé SANS suggestion » cesse d'être structurellement 0 (30 mesurés ;
  MUET 1 114 → 886, avertissement réécrit — il reste un léger sur-estimé, couches vigilance JS
  non portées). Validé sur la population de l'enquête : top-1 32/88 · propose 60/88 (chiffres
  d'enquête reproduits à l'identique).
- **`parity_speller` étendue au palier `inconnu`** (comparaisons 48 → 209) — début de comblement
  de l'angle mort « la sonde ne compare que auto/flag ». Protocole falsifiable respecté : vue
  **ROUGE d'abord** (38 divergences, port Python fait / JS pas encore), verte après le JS.
  **3 divergences ancrées** (chevout, rosso, yay) : la sonde a EXPOSÉ une asymétrie PRÉEXISTANTE
  de la clé phonétique — le **x final muet** ajouté côté JS par #244 (21/07) n'a jamais été porté
  dans `phon_key` Python (« cheveux » = '§ev' JS vs '§evek' Py). Chantier séparé proposé (il
  déplace le PHON de la référence → re-mesure complète obligatoire).
- **Libellé** : orange « mot inconnu » équipé = INTERROGATIF — l'app disait déjà « mot à vérifier
  — peut-être « X » ? » (rien à faire) ; l'extension affiche désormais « municipio » →
  peut-être « municipaux » ? (mitigation nom propre). Batteries : cas gagnés (dargen→d'argent,
  léconomi→l'économie, bégnier→baigner, ésituron→hésiteront) + témoins sans invention
  (delbrueckii, bulgaricus) dans `test_speller_app.js`, `extension/test_speller.js` (+ parité
  directe ext≡app) et `speller_probe.main` §3.
- **Écart assumé au tract d'enquête** : « luiil→lui » était le top-1 de S4 SEUL ; dans le cadre
  combiné S6 prioritaire donne « l'huile » (les 3 moteurs d'accord). Le total 32/88 est celui
  du cadre combiné, inchangé.

---

## 2026-09-04 — _cmp non transitif : dette RE-MESURÉE et INSTRUITE — on ne câble pas (canon:F qualifiée, en réserve)

> Enquête lecture-seule sur main (lexique speller 705 654 formes, baseline produit reproduite 402/19,
> contrôle positif : le moteur monkeypatché en mode neutre rend le même 402/19). L'énoncé d'origine
> (23/08, §5quater) : `_cmp` est pairwise avec gardes de dominance ⇒ pas un ordre total ; reproductible
> depuis le correctif dict-à-ordre-d'insertion, mais l'issue dépend de l'ordre d'ARRIVÉE des candidats.

**La dette re-mesurée** : sous permutation seedée des candidats (5 graines), **8-13 corrections changent
par graine (1,33-2,16 %), union 14/601 (2,33 %)** — le « 7/602 (1,16 %) » du 23/08 sous-estimait
(1 permutation). Mais elle est PLUS BÉNIGNE que son énoncé : **100 % au palier FLAG — 0 des 126
corrections AUTO ne bouge**, gold et UD confondus ; FP UD insensibles (1 suggestion changée, mot latin
« genus ») ; et **INSENSIBLE à la taille du lexique** (même protocole sur Lexique4 seul, 165 474 formes :
union 14/601 identique, 12/14 clés communes — la dette n'a pas grandi avec le ×4,3).

⭐ **LE CHIFFRE PRODUIT A UNE BANDE D'ORDRE ±1** : baseline 402/19 · permute101 **403**/19 ·
permute202 **401**/19 (cassés 19 constant). L'orbite de permutation contient des ordres meilleurs ET
pires que le produit livré ⇒ **ne JAMAIS lire un ±1 de `dys_pipeline_probe` entre deux variantes du
speller comme un signal** — c'est exactement le plancher de bruit que le placebo (#653) impose de battre.

**Le mécanisme, exhibé** : 168/726 jeux de candidats (23 %) contiennent des cycles — 41 221 triangles
orientés au total (`cmp` parfaitement antisymétrique, explicateur de niveaux validé 0 divergence).
Deux ressorts : ① les gardes de dominance ≫20×/≫10× sont RELATIVES À L'ADVERSAIRE (« écrasé par
CELUI-LÀ ») ; ② elles interagissent avec les bonus de niveau (POS/genre/phon/nombre/fin_aud).
Verbatim : « apré » — pré ≻ paré [bonus POS] · paré ≻ après [fin_aud] · après ≻ pré [pmatch écrasé
par ≫20×] ← cycle. « nape » — nappe ≻ tape [bonus PHON] · tape ≻ nappes [≫10× inter-tiers] ·
nappes ≻ nappe [bonus NOMBRE] ← cycle.

**4 constructions invariantes construites, PROUVÉES invariantes (3 graines de shuffle, sorties
byte-identiques) et mesurées au produit** :
- **canon:F** (pré-tri canonique `(-freq, mot)` avant la passe pairwise) — **la seule qui passe la
  règle de décision** : pipeline **402/19 strictement égal**, FP UD inchangés, 6 écarts speller lus
  un par un (1 juste gagné que la grammaire rendait déjà, le reste faux→faux ou faux→abstention).
- canon:L (lexicographique) — 403/19 mais par COMPENSATION avec un écart strictement pire
  (nape abstenu ⇒ « nappes » perdu au gold) ; le +1 est au niveau du placebo. Écartée.
- tournoi (extraction répétée du champion) — 402/19 par compensation ; mécanisme nocif mesuré :
  le dernier champion pairwise est un porteur de bonus RARE (nappes p0 f0,80) que la porte de
  confiance aval (f1≥1,0) tue ⇒ 9 corrections deviennent des abstentions. Écarté.
- copeland (victoires « par le lot ») — **REPRODUIT VERBATIM la falsification du 23/08**
  (nape→tape, bonbe→bonne ; dissection : tape et nappe à 30 victoires chacun, départage fréquence).
  La mesure CONFIRME l'énoncé « la dominance pairwise encode ‹ écrasé par CELUI-LÀ ›, pas ‹ par le
  lot › ». Écarté — ne pas re-tenter.

**DÉCISION : ON NE CÂBLE PAS.** canon:F est qualifiée mais son gain produit est NUL et le ±1 est du
bruit d'ordre démontré — par #617 (pas de consommation sans preuve produit) et #653 (battre le
placebo), un geste 3 moteurs sans gain ne se fait pas. Le produit livré est déjà déterministe et
miroité (reproductibilité inter-processus re-vérifiée, 3 graines de hachage). La dette est
définitionnelle, pas fonctionnelle : petite (2,33 %), stable, confinée au palier FLAG du speller.

**La recette en réserve, si un besoin réel apparaît** (p. ex. un chantier dominance-contextuelle
voulant une référence fonction de l'ENSEMBLE des candidats) : canon:F = 1 ligne de pré-tri
`(-freq, mot)` × 3 sites (`speller_probe.py` ~399 · app ~27496 · `dys-core.js` ~3020), 3 MOTEURS
SIMULTANÉS obligatoires (la parité speller CI rendrait un patch Python-seul rouge) + ré-ancrages
(`parity_speller_ref`, `dys_precision_ref`/nav). ⚠️ Avant tout câblage : refaire le diff produit
token-par-token de canon:F (la vérification « catégories identiques » de l'enquête est déduite des
totaux + lecture des 6 écarts — le diff exhaustif a été interrompu) ; et même avec canon:F,
l'égalité INTER-moteurs sur les cas cycliques reste empirique (Timsort vs sort JS).

---

## 2026-08-30 → 2026-09-03 — rattrapage journal : instruments qui savent échouer, lexique 705 k, ponctuation, accord orange (PR #611-#655)

> Digest écrit d'après les messages de commit de `main` (ce sont les rapports). #653 (« fermer les
> boucles » du pendu, placebo, `pendu_paired_ab.js`) a son entrée dédiée juste en dessous — non repris ici.

**30/08 — rendu & paquets (#611-#612)**
- **#611** couleurs du correcteur × police de son : en sombre la muette tombait à 1,43:1 dans un mot
  corrigé. Police de son ON ⇒ le correcteur libère le canal fond et passe au TRAIT (motif=catégorie),
  gaté `body.son-actif`. Mesuré navigateur : muette 8,52 · syllabe 9,04 (sombre), min 5,19 (clair),
  4 thèmes ≥ 4,5 ; falsification : bloc retiré en live → min 1,18, sonde rouge. 3 écarts au plan mesurés
  (`::selection` sur les spans enfants ; muette > syllabe au survol ; verdict isDarkBg périmé à la
  bascule de thème → observer les classes du body).
- **#612** extension 0.6.1 : le paquet rattrape #607/#608 (Store publié en 0.6.0).

**31/08 — le sujet, a/à, et deux falsifications (#613-#618)**
- **#613** détection du sujet : `_ELIDED_PRON` enfin lu par 5 règles à liste propre (rappel :
  « Lorsqu'il à faim »→a, « Puisqu'elle c'est levée »→s'est…) et un FP réparé (« et lorsqu'elle
  dort »→dorment). Sonde-sujet versionnée (couverture 57,9 %, précision-quand-répond 95,2 %).
  « sommes » 1p ressuscité (régression #83 : la supplétive « so»≠«et » tombait au filtre anti-bruit) —
  gold homophones 11→12/15, le chiffre du ROADMAP restauré.
- **#614** bornes de proposition : canal `pb` (listes fermées, SÉPARÉ de `bb` = ponctuation de
  l'auteur) — son/sont, et/est, peu/peut tirent à travers les subordonnées non ponctuées. Et le VICE
  D'INSTRUMENT : `dys_pipeline_probe` reconstruisait le texte par `' '.join` (ponctuation perdue) —
  la sonde mentait de 4. **Nouvelle référence produit : 402 réparés (26,1 %) / 19 cassés (0,41 %)** ;
  gain propre du canal +1 sur ce corpus, coût nul (UD 2,04 % strictement identique).
- **#615** es/as/vas sous sujet nominal (liste fermée, coût UD zéro), prénoms dans `sv_noun`
  (« Marie chantent »→chante), « mes amis on raison »→ont, FP préexistant « selon » réparé.
  FALSIFIÉ en route : la relaxation générale des lectures 1re/2e pers. (+11 flags UD dont ~9 FP réels)
  — ne pas refaire.
- **#616** a→à devant NOM NU — la forme dominante du gold (41/95) : « avoir exige un déterminant »,
  idiomes en liste fermée (a lieu ×13…). UD 2,04 % strictement identique ; juge strict 44→46 réparées,
  casses 4→4. Différés nommés avec leurs surfaces (a+la/le, a+l'X, a+toponyme, a+PROPN).
- **#617** canal GROUPE (classifieur 170 poids, bornes de groupe) : construit, mesuré, **FALSIFIÉ au
  produit** — 0 réparation / +1 FP ; le +0,92 pt de la tâche parseur-de-sujet ne traverse pas les
  gardes des règles. Hook OFF-inerte (pattern `_neoHeavyCDist`), infrastructure gardée.
- **#618** chantier anglais, l'état MESURÉ (12 bancs sur main@fc7f09a) : précision bonne (93,6 % des
  rouges confirmés humain, 0,0051 % de rouges sur texte édité), couverture faible (7,9 %, 53 règles
  vs 82 FR), FP=0 déjà violé (2 rouges faux). Le danger : des bancs qui ne savent pas échouer
  (auto-désactivation silencieuse, oracle auto-écrit, parité de TOTAUX). Garde-fou proposé : le TEST
  DU MIROIR (échanger source/cible — s'il passe aussi bien, le banc ne prouve rien).

**01/09 — LOT 1 « les bancs qui savent échouer » (#619-#627)**
- **#619** ⚠️ **FP=0 VIOLÉ EN PRODUCTION, des mois** : « La foule attendait » → attendaient (3 moteurs,
  palier AUTO). Cause : « La » désaccentué pris pour l'adverbe « là » dans `_INV_ADV`
  (rule_accord_postpose) ; correctif : « là » exige sa forme ACCENTUÉE. Le message d'alerte était
  IMPRIMÉ à chaque batterie — et jeté (cf. #620).
- **#620** `dev.sh` cachait les preuves : la sortie des contrôles VERTS était jetée (dev.sh:15).
  Désormais un vert qui imprime une marque d'échec est affiché « ⚠ » et nommé (3 verts suspects
  mesurés). Aucun verdict ne bascule.
- **#621** parité SPELLER Python↔JS — le 3e côté du triangle n'était gardé par rien : 12 divergences
  mesurées et ANCRÉES, dans les DEUX sens (le JS souvent en avance : accents après élision que le
  Python refuse). Sans Lexique4 : « SAUTÉ » explicite, jamais un vert muet.
- **#622** boucle descendante (genre) : banc décoratif (aucun exit branché) → contrat en planchers
  (précision 186/188 · leave-one-out 178/178 à 100 % · détection 3/3).
- **#623** précision dys : contrat par (famille, palier), et la dette NOMMÉE, réimprimée à chaque
  vert : 4 règles AUTO sous 80 % sur dys réel (élision fusionnée 27,8 % · -er/-é/-ez/-ai 56,2 % ·
  -é/-er 61,1 % · accord SV 67,9 %).
- **#624** le bake autonome (`build_correcteur.js`) était MUET sur l'accord : 1 lexique embarqué sur
  9, 1 chargeur sur 8 — le bug du 2026-08-11 réparé dans l'app, jamais dans le bake. 7 lexiques bakés,
  `init()` rejette si l'un manque. Et le FP=0 PRODUIT gardé : les 333 phrases correctes traversent la
  vraie page dans Chrome, 0 correction (falsifié par injection).
- **#625** census : le rouge portait sur le NET — 13 oranges justes perdues compensées par 13 gagnées
  passaient VERT. Rouge sur les PERTES ; falsifié (1 perdue/1 gagnée, net +0 → exit 1).
- **#626** une garde par table de lexique, établie par ABLATION sur moteur réel (300 phrases dys) :
  pos-hmm 8 comportements · os-lm 2 · noun-post 1 · prenoms 1 — sans pos-hmm le moteur FABRIQUE une
  faute (« ont »→« on »). Ma 1re carte (18 phrases inventées) était FAUSSE — refaite sur corpus réel.
  gdet/gacc : aucun déclencheur trouvé, dit plutôt que caché.
- **#627** remédiation : la conjugaison n'était JAMAIS expliquée — `remedFams` filtrait par stade au
  lieu de prioriser (une seule faute d'accent éteignait tout le reste). 4→7 familles expliquées,
  173→207 faits/224. Le stade lui-même est JUSTE (mesuré : 3/139 seulement sensibles à l'ordre).

**01-02/09 — ponctuation : la couche que le dys réel réclamait (#628-#631, #636)**
- **#628** la VIRGULE manquante enfin proposée (insistance de Rem, à raison) : le détecteur de run-on
  exigeait un verbe fini collé au pronom ET un accord déjà juste — il ne parlait que là où il n'y a
  rien à corriger. Après : « …la palge ‖ vous » proposée ; fatigue 0,60 virgule/1 000 mots sur 2 500
  correctes (sous la référence 0,93). Jamais un mot fabriqué : orange, ponctuation seule.
- **#629** le « ? » n'était pas bridé par la grammaire mais par le RENDU (`_typoGapHtml` jetait les
  insertions en fin de segment) : proposé désormais sans point préalable. FP=0 produit 333/333.
- **#630** le POINT FINAL manquant : 39 % des productions dys réelles, 2 % du synthétique (facteur 20
  — les bancs étaient structurellement aveugles), aucune règle nulle part. Règle naïve inutilisable
  (parlerait sur 79 % des états de frappe). Mon 1er déclencheur (« a déjà ponctué ailleurs ») refusé
  par Rem à raison : il coûtait 14/28 cas réels, précisément les scripteurs les plus faibles. Retenu :
  dernier segment ≥ 3 mots + verbe conjugué + pas interrogative. 28/28 · fatigue 14/2500.
- **#631** la détection de QUESTION entre dans la batterie : précision ≥ 96,6 % ET rappel ≥ 18,4 % —
  un plancher de précision seul récompenserait le silence. Deux ajouts de ma main RÉFUTÉS par le banc
  avant livraison (interrogatifs ambigus en tête : 96,67 → 31,31 %).
- **#636** la coupe à 12 mots d'`estQuestion` était une contrainte VOCALE qui fuyait dans le
  correcteur (qui proposait un POINT au bout des questions longues). Paramétrée : voix 12 (mesure
  inchangée), correcteur 20 (rappel 18,47→25,48 %, précision 91,95 %). Piège : ma 1re version du banc
  lisait un « 20 » EN DUR — il lit désormais la constante de la source.

**01-02/09 — l'instrument avant le moteur, suite (#632-#635, #637-#638)**
- **#632** l'extension PUBLIÉE entre dans la batterie, dans un VRAI Chrome (`Extensions.loadUnpacked`,
  assets par `chrome.runtime.getURL` + `DecompressionStream`) ; étiquettes des gardes établies par
  ABLATION (une 1re version restait verte avec l'asset supprimé). 4 pièges payés, écrits.
- **#633** la batterie « FP=0 » rend enfin un code de sortie (zéro `sys.exit` en 4 800 lignes —
  narration, pas verdict) : zéros DURS (FP corpus, témoins) + planchers détection/correction 155/170.
- **#634** a/à : `_aaInverted` ne vérifiait pas ce qu'il nommait (un verbe en i-2 suffisait, jamais de
  test pronom) — le rouge « angle mort ÉLISION » venait de là. Divergences élision 2→0 ; et la sonde
  ne testait RIEN en CI (0 phrase = tic vert) → corpus commités branchés, `tested==0` FATAL.
- **#635** la table de précision mesure le PRODUIT (`--navigateur` : 1 798 paires dans Chrome via
  `cdp_chrome.js` partagé), plus le harnais Python — sur « élision fusionnée » le harnais disait
  3 justes/17 fausses, le vrai Chrome 2/1, et le « correctif » dérivé du harnais avait dû être reverté.
- **#637** la dette cachait la SEULE colonne qui viole FP=0 : INUTILE (mot juste réécrit) était tue.
  Gardée en VALEUR ABSOLUE (produit 25 · référence 28, plafonds qui ne peuvent que baisser). Sur 3 cas
  vérifiés main : 1 défaut de gold, 2 = l'arbitrage mesuré dét↔nom (le gold corrige le nom 59 contre
  12), zéro bug non gardé.
- **#638** « ces chiffres sont inquiétants » (Rem) → RIEN n'a été cassé (4 instruments indépendants
  d'accord, #618→HEAD identique à l'événement près). Mais la bannière classait par % sans effectif :
  « 30,8 % » = [13-58] sur 13 cas ; médiane d'effectif 4 ; 29 % des lignes n'ont qu'UN événement.
  Plancher n=30, sinon « NON MESURÉE ». La vraie dette massive est la FATIGUE orange (30 marques
  inutiles pour 1 utile, n=40). Et 2 témoins positifs ONT ÉCHOUÉ (sonde verte après retrait de la
  stop-liste a/à et annulation de #619) : « aucun changement » ≠ « aucune régression ».

**02/09 — garde OS au bon instrument, lexique ×3,3 (#639-#643)**
- **#639** garde OS : le filet homographe demandait « est-ce un nom ? » à une table de GENRE (4 178
  entrées) alors que `noun-post` (83 356 mots, déjà chargé) est l'instrument — « une dure écorce qui
  met » recevait « écorcent ». Seuil propre P(NOM)≥0,90 ∧ P(VER)≤0,05 ; produit 1/30/9 → 1/26/9.
  Plus : `./dev.sh fresh` (3 batteries perdues le 02/09 sur artefacts non régénérés), `ci_parity`
  valide le YAML (un workflow refusé par GitHub était vert), `residual_audit.js` (dormant depuis
  juillet, jamais branché) entre dans la batterie — plafond DUR 18 tokens corrects détruits.
- **#640** collision d'accent : CONJ_F keyée DÉSACCENTUÉE croyait « adhérent/côté/gène/mûre » verbes.
  Table exacte `non_verbe_acc.json` (16 mots, classe mesurée contre Morphalou 511 275 formes verbales),
  consultée avant le tagger — périmètre volontairement limité à l'orange (le rouge = enjeu FP=0, à
  mesurer avant).
- **#641** speller : « CONNU MAIS JAMAIS CANDIDAT » (freq 0 → dans WORDS, jamais dans D2A/PHON).
  L'augmentation naïve MESURÉE au produit : des mots rares masquaient des fautes de mots courants
  (« dess »→des) ou cassaient l'unicité (« égallement » perdait sa correction) ; 1re porte (≥0,01)
  RÉFUTÉE — elle retirait 26 % du lexique de BASE des candidats. +40 034 formes (gacc). Et la
  référence Python lit désormais les MÊMES ajouts que le JS — fin des deux lexiques pour un même
  speller.
- **#642** +81 042 noms/adj/adv de Morphalou 3.1 (LGPL-LR) — 6 des 12 mots rares du corpus dys
  récupérés ; A/B node : 10 flags perdus TOUS mauvais, 0 correction juste perdue ; 254 581→323 593
  formes. Lot VERBES mesuré mais PARQUÉ (poids ×2 : décision remise à Rem).
- **#643** Rem tranche (« 0,6 s c'est minime ») → +384 869 formes verbales Morphalou. **Lexique
  705 653 formes** (était 155 467 avant la série), asset 2,36 Mo gz ; A/B : 6 flags perdus tous
  mauvais, 0 juste perdue. TSV commité gzippé (1,3 Mo au lieu de 26,5).

**02-03/09 — le rendu ne ment plus, les questions, l'orange d'accord (#644-#649, #652, #654)**
- **#644** deux défauts signalés par Rem, mesurés dans Chrome : ① le RENDU écrivait la ponctuation
  proposée DANS le texte saisi (26→28 caractères : clics et sélection à côté ; le moteur relisait le
  « ? » comme du texte) → span vide + glyphe CSS hors flux ; ② le clic sur une faute de la zone de
  saisie n'existait PLUS depuis le 10/07 (retiré sans rebranchement — je l'avais d'abord présenté
  comme une conception : c'était faux) → rebranché, même carte que la liste du bas.
- **#645/#646/#648** le « ? » et le point proposés s'APPLIQUENT d'un clic — app (drapeau `appliquer`
  perdu à la sérialisation), panneau latéral (`applyFlag` ancrait sur un indice de token que les
  insertions n'ont pas), et la marque était incliquable (0×3 px → 16×32 px dans le flux). Gardes
  navigateur falsifiées à chaque étape.
- **#647** questions SANS trait d'union (« veux tu venir », « qu'allons nous faire », « est ce que ») :
  la garde est la CONJUGAISON (la forme s'accorde avec le clitique). Banc voix 58/60→59/61 ·
  correcteur 80/87→81/89.
- **#649** orange « accord verbe à vérifier » : après une relative en « qui », le sujet est
  l'ANTÉCÉDENT (« les villages qui composent la commune sont » ne devient plus « est »). Famille
  1/25/9 → 2/15/9 dans Chrome sur corpus dys ; français correct 49→40 marques ; parité OS 23/23/23.
- **#652** le parseur de sujet (`_npSubject`) consulté AVANT la route postposée et les voisins R1-R3 ;
  famille 2/15/9 → 2/10/9, français correct 49→35, 0 fausse en plus ; parité OS 22/22/22. P2G.md remis
  à jour (lexicalité élargie au speller : mesurée PIRE, écartée).
- **#654** la FORME avant le NOMBRE : « vont cherchait »→chercher existait mais passait APRÈS l'orange
  de nombre qui le taisait ; « faire » semi-auxiliaire ; « elle s'est mariaient »→mariée ; gérondif
  (« tout en pensent »→pensant). NOUN_POST est une Map dans l'extension, un objet dans l'app →
  accesseur tolérant (le portage verbatim PLANTAIT l'app) ; `parity_os` charge noun-post comme le
  produit (l'écart 17/16 venait de là). Famille 2/10/9+0/6/1 → 2/7/5+0/4/0 ; texte correct 537→529.

**03/09 — paquets et fraîcheur (#650, #651, #655)**
- **#650** données ouvertes du site : `omega-lexiques.zip` servait ~214 k formes pour un moteur à
  705 653 — AUCUN contrôle ne le surveillait. Reconstruit (12 fichiers, 4,4 Mo), Morphalou crédité
  (LGPL-LR) dans NOTICE/page/JSON-LD, garde `build_lexiques.py --check` (zip == sources) en dev.sh
  + ci.yml ; piège CRLF/LF payé (zip Windows vs CI Linux).
- **#651** extension 0.6.2 : le paquet Store rattrape TOUT depuis la 0.6.0 publiée (lexique ×4,5,
  questions #647, panneau #646, relative « qui » #649, correctifs 0.6.1 jamais publiée).
- **#655** extension 0.6.3 (la 0.6.2 a été téléversée par Rem le 03/09, état après #652 ; un numéro
  remis est BRÛLÉ — la 0.6.3 rattrape #654). Et le census des oranges honorait `data_local` en dur :
  dans tout worktree il s'imprimait « SAUTÉ » — les batteries vertes de #649/#652/#654 n'ont jamais
  fait tourner le census. Il lit `OMEGA_DYS_DATA` comme les six autres sondes ; référence ré-ancrée
  (306 justes, aucune juste perdue).

**Chiffres de référence en sortie de fenêtre** : pipeline produit **402 réparés (26,1 %) / 19 cassés
(0,41 %)** (#614) · FP échelle UD **2,04 %** (295/14 450, plafond 3 %) · lexique speller **705 653
formes** · dette FP=0 produit **25 INUTILE-auto** (plafond dur, #637) · résiduel **18** tokens
corrects détruits (plafond dur, #639) · batterie ~80 contrôles, census 306 justes (#655).

---

## 2026-09-03 — « fermer les boucles du pendu » : mesuré, rien ne bouge (réfuté chiffré)

> Déclencheur : Rem, « on n'avait jamais vraiment fermé les boucles, particulièrement celle phon […] explore le champ des possibles ».

- **Ce qui est vrai dans le code** : la voie phon est un *shadow* (« M1 seul livré ») dont le substrat est un vecteur par LETTRE
  (identité + 14 traits articulatoires), pas du son ; `M1_phon_m`/`M2_phon_m` sont écrits, jamais lus (audit F3) ; le canal Möbius
  `M_BOUCLE` ne ferme que la boucle ORTHO et est OFF en config de référence ; aucun étage descendant n'atteint la décision-lettre.
- **Inerte par construction, pas seulement débranché** : `M1_phon_m.letterScore = clamp(1 − letterPenalty, 0..1)`, or les pénalités
  apprises sont presque toutes négatives (des boosts) → le clamp les efface. Branché tel quel, il reproduit la référence **à la partie
  près** (E3a : 282/273/270 sur 3 graines, identique).
- **Banc** : protocole exact de `evo/ci_smoke.js` (in-lexique K=1, mots 7-12, warmup 120), copie patchée de l'app pour la seule
  variante nouvelle (Möbius phon SIGNÉ : `−letterPenalty` module le contexte phon avant normalisation, poids W). 900 parties par
  condition (Wilson ±1,8 pt), puis **apparié** 3 000 mots (issue par mot, paires discordantes, McNemar exact) — l'outil est commité :
  `evo/pendu_paired_ab.js` (toggles existants).

| variante | 900 parties : cognition / +NEO | apparié 3 000 mots (cognition) |
|---|---|---|
| E0 référence | 91,7 % / 98,7 % | 90,73 % |
| E1 Möbius ortho ON (`L01_B2`) | 92,3 / 98,8 | 90,20 % (−0,53 pt) · 214 discordantes, 99 gagnées / 115 perdues · p = 0,31 |
| E2 co-décision descendante (`M5_D_M1_M`) | 92,0 / 98,6 | 91,60 % (+0,87 pt) · 198 discordantes, 112 / 86 · p = 0,075 |
| E3 Möbius phon clampé, W 0,05 / 0,2 / 0,5 | 91,7 (identique) / 92,3 / 91,0 | — |
| E4 Möbius phon signé W 0,05 / 0,2 / 0,5 | 92,3 / 92,2 / **92,9** · NEO plat | W 0,05 : 91,10 % (+0,37) · 213 disc. · p = 0,49 · W 0,5 : 90,33 % (−0,40) · 212 disc. · p = 0,45 |
| E4 Möbius phon signé W 1,0 | — | 91,60 % (+0,87) · 200 disc., 113 / 87 · p = 0,077 |
| E5 Möbius ortho + phon signé W 0,5 | (ortho + phon 0,2 : 92,2 / 99,0) | 90,00 % (−0,73) · 218 disc., 98 / 120 · p = 0,16 |

- **Le même signe partout** : E2 et E4 (W 1,0) font tous deux +0,87 pt avec la même structure (112/86, 113/87), et ce sont les **mêmes
  mots** qui basculent d'une variante à l'autre (ETIQUETAIT, PROVERBE, SKYPAIT, DECHARGEZ, PASSEUSE, TAMOXIFENE gagnés par E1, E2 et
  E4) : signature d'un bruit de PERTURBATION — des mots au bord basculent dès que le chemin numérique change, quel que soit le
  mécanisme. Contrôle : un **placebo** (Möbius phon W = 1e‑9, mathématiquement nul) et une **réplication** sur graines neuves
  (31337, 2024, 9001) — résultats ci-dessous.
| **placebo** (Möbius phon W = 1e‑9, nul) | — | **91,17 % (+0,43) · 195 disc., 104 / 91 · p = 0,39** — les mêmes mots basculent |
| réplication, graines neuves (E0 = 91,13 %) | — | phon W 1,0 : +0,43 (108 / 95, p = 0,40) · co‑décision : −0,10 (87 / 90, p = 0,88) |
| réplication, graines neuves (suite) | — | phon W 2,0 : 91,57 % (+0,43) · 185 disc., 99 / 86 · p = 0,378 · placebo : 90,20 % (-0,93) · 196 disc., 84 / 112 · p = 0,054 |

- **Le placebo tranche** : une modulation mathématiquement nulle, qui ne change que le chemin des flottants, produit +0,43 pt et
  195 paires discordantes — le **plancher de bruit de perturbation** de ce moteur est ~200 parties sur 3 000 qui basculent dès
  qu'on touche au chemin numérique, dans un sens ou dans l'autre. Tous les « effets » mesurés (−0,73 à +0,87) sont dans ce plancher,
  et les deux +0,87 ne se répliquent pas sur graines neuves (+0,43 et −0,10).
- **Verdict** : aucune boucle fermée ne déplace le taux cheat-free ; le +1,2 pt de E4c sur 900 parties était du bruit (apparié :
  −0,40 pt, p = 0,45). ⚠️ Méthode : sur ce moteur, **un A/B doit toujours embarquer un placebo** ; une variante qui ne bat pas le
  placebo n'a rien montré, quel que soit son p isolé. Avec NEO (config produit) tout est plat à 98,7 %. La config de référence est un optimum local pour ces
  leviers — Rem : « tu vois la config optimale a priori, donc on atteint la fin de tâches ».
- **Ne pas re-tenter** sans idée neuve. La seule entrée non testée est une VRAIE entrée sonore, qui n'existe pas dans le jeu ; côté
  dictée vocale, la boucle son→OMEGA (voie B) est déjà mesurée et l'arbitrage du pendu y est réfuté (cf. mémoire `asr-phon-route`).

---

## 2026-09-03 — TRI de CLAUDE.md : l'histoire migre ici, CLAUDE.md redevient un sommaire

> CLAUDE.md avait gonflé à ~7 600 mots avec des lignes de 13 000 caractères (illisibles en diff,
> invisibles au grep). Le tri du 03/09 le ramène à un sommaire ≤ 1 500 mots gardé par
> `dictee/docs_probe.py` ; les blocs datés ci-dessous sont le matériau historique qui y vivait.
> Contrôle « rien de perdu » : MANIFEST du tri (bloc par bloc) dans le PR de remise en ordre.

Réserves techniques reportées telles quelles de CLAUDE.md (toujours vraies au 03/09, pas d'entrée datée propre) :
- ⚠️ **`OLD20` câblé à vide** (panneau 🔤 Décompose) : `lexLookup` lit `e.old` défensivement mais la colonne
  **n'est PAS embarquée** (0/155 493) → toujours `null`, jamais affiché. Embarqué réel = **11 dims** :
  `m p g f prev pld md mb l nbhomoph nbhomog` (OLD20/syll/cvo/cvp **régénérables** depuis `Lexique4.tsv`
  en asset, pas gratuits). Le panneau vit dans un `<script>` séparé (zéro adjacence avec le correcteur).
- ⏳ Panneau app « 🔤 Décompose » : la route sublexicale y est encore **brute** (parité du SEG enrichi
  + correction apprise à porter depuis `dictee/decompose.py`).
- ⏳ Wiktionnaire : genre/IPA extraits aussi (`wikt_lex_fr.tsv`) mais activation genre/`phon_key`
  **DIFFÉRÉE** (couplée à `cgram_hf`/conj, régénération LEFFF-dépendante).
- **ACCENTS — solution déjà présente** (ne pas réinventer) : *en lexique* = lookup du mot accentué
  (`1_Mot`) ; *hors-lexique* = le **phonème porte l'accent** (é=/e/, è=/ɛ/, cf. `PHON_TO_LETTERS`).
  `decompose`/`p2g` l'appliquent déjà (overlay g2p + émission p2g accentuée).

---

## 2026-08-22 → 2026-08-30 — rattrapage journal : sondes qui s'auto-censurent, Morphalou en 4 lots, la ponctuation au correcteur, expliquer les fautes, Store v0.6.0 publiée (PR #546-#610)

> Digest écrit d'après les messages de commit de `main` (ce sont les rapports), comme le digest
> #611-#655 en tête de journal. Une partie de la fenêtre est déjà couverte EN PROFONDEUR par les
> entrées datées ci-dessous (posées lors du TRI de CLAUDE.md, #656) : pour celles-là, une ligne +
> pointeur ; le détail pour les autres. #607/#608 ne sont cités dans le digest #611-#655 que comme
> référence de version (#612 les rattrape) — leur contenu est ici.

**22/08 — la campagne du soir : déjà couverte, plus l'outillage qui s'auto-censurait (#546-#561)**
- **#546-#557** : couverts par l'entrée « 2026-08-22 — qualité sur TEXTE DYS » ci-dessous et ses
  sections — #546 les « 24 % » du pluriel (Suite), #547 audit règle par règle (Suite 2), #548
  leur/leurs 64→86 % (Suite 3), #549 générateur de fautes (Suite 4), #550 enquête ancre polluée
  (Suite 5), #551 primitive d'ancre NON CÂBLÉE (Suite 6), #552 spirale du non-mot, #553 le speller
  effaçait le pluriel, #554 hypothèse lemme FALSIFIÉE, et la PAUSE littérature = #555 (état des
  lieux), #556 (mélange mal étiqueté), #557 (« même corpus » Bodard, dominance en contexte).
- **#558** « ganglions partout » : généralisation du motif REFUSÉE par la mesure — majuscule
  initiale 7 796 ex mais fatigue tuée au mieux 1/15 (fp_scale 2/34), ces/ses 1 907 ex, 0/22 tuées
  à tout seuil ; 2 familles sur 5 passent la barre (pluriel, SV, déjà shippées). Deux bugs
  d'outillage : `distill_vig.py` ÉCRASAIT le registre au lieu de fusionner (relancer sur une
  famille déjà shippée s'auto-censure : le moteur de collecte contient déjà sa carte) ; les dumps
  n'appelaient jamais `spell(t, true)` alors que `capital=true` est le réglage de production —
  census re-ancré 297→302 justes.
- **#559** même auto-censure sur `distill_pluriel.py` (le tout premier script, jamais retouché) :
  garde-fou d'écrasement posé, vérifié en relançant pour de vrai — 0 fatigue tuée sur la
  re-collecte → la garde avertit et NE RÉÉCRIT RIEN, `pluriel_tais_model.json` intact.
- **#560** parité DICTÉE Python↔JS : `diag_sentence.py` et `diagnoseSentence` n'avaient AUCUN
  filet (deux pipelines indépendants du correcteur). `parity_diag.js` rejoue les 5 générateurs de
  corruption : 1309/1309 cas identiques au premier essai ; câblé dev.sh + ci.yml.
- **#561** ponctuation, réparer l'INSTRUMENT d'abord : mesurer une virgule contre UD est invalide
  (souvent FACULTATIVE) → juge à TROIS classes (obligatoire / INTERDITE / facultative). 2 bugs de
  règles corrigés (justesse 62,68→64,19 %, 13 virgules fautives en moins) ; et le juge a trouvé
  seul que le chemin vocal LIVRÉ posait 9 virgules INTERDITES sur 616 → primitive PARTAGÉE
  `ponctInterdit`. La CI a arrêté l'interdit en bloc « devant et/ou/ni » (proso 156→154 : un
  coordonnant RÉPÉTÉ est une énumération) — exception posée, 156/156.

**23/08 — voix, et les sondes qui mentent (#562-#571)**
- **#562, #563, #564, #566, #567, #568** : couverts par l'entrée « 2026-08-23 — Gold complet ×20 »
  ci-dessous — #562 le pipeline de bout en bout, #563 les 72 productions corrigées à la main
  (gold ×20), #564 la sonde pipeline fausse (22,1→25,8 %), #566 moteur de référence non
  déterministe + « tré », #567 noms propres fermés au coût/gain, #568 ancre de genre 381→394 +
  `_cmp` transitif falsifié.
- **#565** saisie vocale, plus d'arrêt auto (signalé par Rem) : même avec `continuous=true` le
  moteur Web Speech coupe après un silence, et `onend` finalisait TOUJOURS. Flag `userStop` posé
  par le seul clic ⏹ ; sinon réarmement silencieux d'un nouvel objet SpeechRecognition, texte
  préservé. Vérifié par moteur simulé, site + extension.
- **#569** la sonde pipeline affichait « signalé SANS suggestion : 0 » avec aplomb : la référence
  Python n'émet pas le palier « mot inconnu » (seul `spellText` app le fait). Réel, croisé avec un
  dump de l'app : **38,5 % de ratés SOULIGNÉS, 59,8 % d'invisibles**. L'avertissement est
  désormais dans la sortie de la sonde ; chiffres inchangés (394/19).
- **#570** régression de #565 : le vidage de `S.finals` à chaque relance silencieuse privait
  `prosodyText()` de tout segment — plus aucune ponctuation après la 1ʳᵉ relance (mesuré par Rem
  en direct). Remplacé par un décalage d'index ; 4 frontières de phrase sur les 4 salves de sa
  capture.
- **#571** `_dedupFinals` avalait des mots réels : test « déjà dit » en SOUS-CHAÎNE brute sans
  limite de mot — « le » supprimé parce que « pLEuvait » le contient. Fix aux limites de mot +
  filet anti-collapse `_dedupFinalsSur` (si le dédoublonnage réduit à {}, on garde le brut).

**24/08 — Morphalou (genre, son, conjugaison, branchement), B2 compresse, la ponctuation arrive au correcteur (#572-#581)**
- **#572** « entraîner EST compresser » (question de Rem) : sur texte suivi held-out, B2 fait
  **1,80 bit/caractère contre 3,73 pour gzip (×2,07)** ; sur mots isolés ×1,25 seulement —
  l'avantage est CONTEXTUEL. Et l'orthographe française coûte **3,8 bits/mot de plus que le son**
  (écart 5,38 : 1,54 bit d'information perdue = homophonie, 3,84 de redondance pure). Deux fois
  l'instrument a menti : séparateurs hors vocabulaire (les 3 999 sauts de ligne supprimés), puis
  le modèle CURRICULUM pris en premier (2,02 b/c, 13 % pire en langue que la base 1,78).
- **#573** genre accentué : Morphalou 3.1 en 3ᵉ source, **26 609 → 80 692 entrées** (+54 083).
  2 bugs corrigés avant intégration : le filtre anti-homographe tuait des accords UNANIMES des 3
  sources ; kaikki+Lexique4 reste la source de vérité, Morphalou n'AJOUTE que (jamais en
  arbitrage).
- **#574** purge des 82 entrées bruit de `gender_acc.json` (« ami »→f cité) : le filtre runtime
  CACHAIT l'erreur au lieu de la corriger — appliqué une fois pour toutes à la source
  (80 692→80 610), comportement inchangé par construction.
- **#575** route lexicale du son complétée : `phono_homophones.json` ne contient QUE les mots à
  homophone — 54 298 mots sur 170 782 tombaient au sublexical, dont de/je/le/que. Conversion
  SAMPA Morphalou→Lexique4 (82,4 % exact, 96,5 % avec variantes o/O e/E) ; +305 120 mots en REPLI
  seulement — verser dans W2P polluait `--measure` lui-même (52,4→39,2 %, la table sert aussi de
  vérité-terrain) ; et le schwa unique des monosyllabes ne se supprime plus (de→/d°/, pas /d/).
- **#576** SEO : les liens internes pointaient vers `.html`, que Cloudflare 308-redirige — Google
  excluait ces pages (« page avec redirection », 11 des 15 exemples du rapport GSC). 386 liens /
  32 fichiers réécrits sans extension, précache sw.js suivi, 2 sondes site adaptées. L'essai à
  blanc a évité une vraie casse (index.html→`/` ABSOLU : l'accueil EN serait parti vers le FR).
- **#577** accord sujet-verbe : 22 lemmes verbaux Morphalou (585 formes), scope VOLONTAIREMENT
  étroit (lemmes entièrement absents seulement). 3 bugs trouvés en mesurant : fréquence lue toutes
  catégories (« avenir » verbe empruntait le nom 60/M), lemmes pronominaux préfixés (les 47
  « nouveaux » du 1er essai TOUS déjà connus en forme nue), composés à trait d'union jamais
  déclenchables (le tokeniseur coupe) — écartés. 3 moteurs.
- **#578** gender_acc BRANCHÉ dans le produit (poussé par Rem : « c'est pas livré en fait ») : la
  table n'atteignait le JS que via `_GCOLL` (~1 500 mots, <2 %). Bloc `gacc-lex-gz` (59 916
  entrées) + une ligne en tête de `_nounGender`, miroir exact du Python ; asset extension additif.
  Vérifié navigateur : « une lettre rédigé »→rédigée, IMPOSSIBLE avant sur le produit réel.
- **#579** le « ? » manquant arrive au correcteur : `estQuestion` (96,67 % précision, 58/60)
  vivait en DOUBLE dans les 2 surfaces vocales et dans AUCUN moteur. Déplacée dans dys-core+app,
  `_questionScan` en ORANGE. 3 défauts de mon propre travail trouvés par les gardes : paramètre
  renommé (référence morte), le « ? » mis à tort dans `_typoScan` (couche MÉCANIQUE, or il dépend
  du tagger), et la variante « sans ponctuation finale » COMPTÉE SANS ÊTRE PEINTE (`_typoGapHtml`
  ne peint qu'entre les mots) → la règle se tait là et dit pourquoi.
- **#580** census : la garde était aveugle deux fois — elle SE SAUTE sans corpus (donc jamais
  tournée en CI) et sa référence datait de #558 → rouge permanent plus lu, 20 PR de dérive. Elle
  cachait **9 oranges devenues FAUSSES depuis #568** (tèrs→terre, priosn→prions, sonn→sont…).
  Non réparées ici, mesuré : toutes les variantes sont zéro-somme (`_cmp` pairwise, le vrai
  chantier est là). Livré : comptage AVEC multiplicité (13 perdues/12 gagnées, pas « net 1 »),
  dette RÉAFFICHÉE à chaque run vert, référence ré-ancrée (301/241/162).
- **#581** les règles de virgule au correcteur (étape ③ de #561, restée en plan) : ORANGE, fatigue
  mesurée avant branchement **0,93 virgule/1 000 mots** sur 2 500 phrases correctes. ⭐⭐ Quatre
  défauts de mon propre travail, dont : le `norm` du bloc porté ÉCRASAIT le `norm` PHONÉTIQUE de
  l'app — **134 diagnostics de dictée basculaient de famille**, invisible au diff et à
  `parity_corr`, vu par la seule `parity_diag` (1309 cas) livrée la veille. Cible cliquable 5 px
  → 15-19 px ; nouvelle famille `ponctuation` (la carte disait « Homophone »).

**25/08 — verrous, ou/où, accessibilité, récupération, l'extension avant le Store (#582-#594)**
- **#582** une locution figée ne perd plus contre une devinette à un mot : `_HYPHLOC` était
  étouffée par les suggestions mot-à-mot (« week end » recevait « geek » ; « au dela » l'accent
  sans le trait d'union). Priorité changée, condition de déclenchement INCHANGÉE : 15/19 → 19/19.
- **#583** verrou de miroir app↔extension pour les 5 blocs de ponctuation miroités à la main. ⭐⭐
  La première version ne pouvait PAS échouer : marqueur de fin tombant sur un `catch`
  intermédiaire → 9 lignes comparées sur 19, la garde trait d'union HORS comparaison — découvert
  en introduisant une divergence EXPRÈS. Et la normalisation abîmait ce qu'elle mesurait (`\b`
  ASCII : « plutôt »→« plutô§ »). Re-testée en échec sur CHAQUE bloc ; 1 vraie divergence sortie.
- **#584** ou/où : la famille la plus DENSE du corpus dys — 11 vraies fautes sur 23 « ou » lus un
  par un (48 %), couverture ZÉRO (« carte enseignante »). 3 cadres livrés en ORANGE, chacun 0 FP
  sur 121 phrases UD ; 3 cadres MESURÉS ET REFUSÉS (« ou »+verbe conjugué : 14 FP/121). Python
  7/11 dys, extension 9/9. LanguageTool vaut mieux comme fournisseur de CONTRE-EXEMPLES que de
  règles.
- **#585** deux défauts pour la cible dys : une correction n'était atteignable qu'à la SOURIS
  (`data-key` sans tabindex ; `_cardKey` : Entrée/Espace applique, `aria-live` posé) ; et le logo
  Google était un carré noir — `icon.svg` dessinait l'oméga en balise TEXTE, jeté par tout
  rasteriseur sans polices (preuve : `apple-touch-icon.png` 618 o, 99,7 % de #0d1117). Oméga
  vectorisé en `<path>`, `icones_probe` falsifié dans les deux sens.
- **#586** RÉCUPÉRATION : deux commits du PR #576 ne sont JAMAIS arrivés dans main. Reposés :
  sitemap complet (32 URL == 32 pages, plus aucune page noindex), `sitemap_probe.js` à 3 règles
  symétriques, testé en échec dans les deux sens.
- **#587** blocages avant Store (« pourtant je l'avais dit tu m'as pas cru » — les deux étaient
  réels) : « tout corriger » n'appliquait AUCUN flag typo (`sp[undefined]` → return en silence) ;
  bulle ↔ miroir rendus EXCLUSIFS (patron voix↔miroir réutilisé) ; notes de confidentialité
  REPLIÉES, pas raccourcies. Plus : lecture du TEXTE à voix haute (karaoké), miroir du bouton de
  l'app.
- **#588** au banc navigateur : l'alternateur mourait en silence si `chrome.storage` jetait (le
  listener vivait DANS le try) ; le lecteur échouait sans le dire (`onerror` affiche désormais la
  raison). Et un diagnostic à moi RETIRÉ — le verrou anti-écrasement du karaoké reposait sur une
  cause inexistante, mesurée au banc.
- **#589** aide au nombre (dyscalculie) dans le panneau : la police de son est INERTE sur les
  chiffres (mesuré : `decompose('42')` = 0 lettre) mais décompose les MOTS-nombres. Nombre sous 3
  formes (groupé / en lettres / valeur de position), convertisseur 38 pièges du français sur 38.
  Pourquoi pas une calculette : transcodage, position, inversion, quantité — le calcul délégué ne
  touche aucun des quatre.
- **#590** préparation Chrome Web Store (3 blocages levés, dossier STORE.md) : couvert par
  l'entrée « 2026-08-25 — Publication Chrome Web Store » ci-dessous.
- **#591** l'extension calcule aussi (décision de Rem : extension = RAPIDE, site = développé) :
  analyseur descendant maison, ZÉRO `eval` (structurel — `<all_urls>` + eval = refus Store),
  refuse plutôt qu'inventer (5/0, « 2+ », « 1.2.3 » → « Calcul impossible »), résultat relu en
  lettres et par position. 21 cas/21.
- **#592** l'URL de politique de confidentialité donnée à Google renvoyait un **308**
  (`/confidentialite.html` ; la ressource est à `/confidentialite`) — exactement le piège de
  #576, sur l'URL qui conditionne la publication. Corrigé dans STORE.md.
- **#593** `/calcul`, la partie développée du site : 4 opérations posées en colonnes, potence avec
  reste (le seul endroit où le résultat se prouve : quotient × diviseur + reste), `versNombre()`
  mots→chiffres (l'erreur canonique « 30005 » pour trois cent cinq ; quatre-vingt recollé sinon
  97 = 41). Sonde `calc_dys_probe.js` : 20 011 allers-retours, ~46 000 poses, 4 gardes FALSIFIÉES
  une par une — la retenue ADDITIVE et la sonde restée verte sont l'entrée « 2026-08-25 — Aide au
  calcul » ci-dessous.
- **#594** passe de doc après `/calcul` + 3 retards antérieurs (README/SITE_DEPLOY oubliaient la
  saisie vocale et Double-Sens, livrées depuis longtemps) ; rapport §18.7 avec les limites dites
  (aucune validation élèves, entiers seulement).

**26/08 — expliquer les fautes, puis les familles une à une (#595-#601)**
- **#595** « on se doit d'expliquer les fautes » (Rem) : mesuré dans l'app réelle, **3 corrections
  sur 16 donnaient une explication (19 %)**. Trois causes : le fil couche-dys→carte manquant, un
  attrape-tout qui MENTAIT (l'espacement conseillé comme homophone ET compté morphosyntaxique
  dans le STADE), 14 règles sans `_EXPL`. → 100 %, crible navigateur permanent (il clique et lit
  la carte), FALSIFIÉ deux fois — la 1ʳᵉ version acceptait le mot « Pourquoi », qui est le TITRE
  de la carte.
- **#596** dette Python remboursée (les 3 règles du crible portées à la référence) — le portage a
  payé : 2 FP de mes propres règles trouvés (« les endroits OÙ on va coûte cher » → on→ont ; `où`
  et `dont` ouvrent une relative dont « on » est le sujet). Et « Marie est venu CE MATIN » réparé :
  la garde `tg[i+1]=='DET'` (sujet postposé) s'abstenait sur « ce » ; conditionner au sujet
  REFUSÉ (FP 1,40→1,48 %), retenu : exemption des COMPLÉMENTS DE TEMPS en liste fermée, FP
  strictement inchangé 1,40 % (35/2500). Balayage 84 fautes/19 familles → REGLES_FR §0-bis
  (piège : lancé sur le Python seul il annonçait 42 « muets » — chiffre FAUX, refait au
  navigateur).
- **#597** et/est avec sujet nominal (« Ce chien et gentil » muet) : élargi au seul cadre
  DÉTERMINANT+NOM avant / ADJECTIF après, 4 gardes chacune née d'un FP UD mesuré — 0 tir sur
  2 500, FP 1,40 % exact. Honnêteté : rappel ajouté sur le corpus dys = 0, gardé quand même
  (coût nul). Et le correctif speller tar→tarte REFUSÉ PAR LE CENSUS : 4 oranges justes perdues
  pour 1 gagnée, c'étaient des ACCENTS de vrai texte dys — retiré, 301/301.
- **#598** les 3 défauts graves du panel Chrome (37 phrases neuves) : participe après ÊTRE en
  LISTE FERMÉE de verbes (le tagger et ADJ_LEX tentés et refusés : « seche »/« celebre » = VERB,
  ADJ_LEX contient « fatigue ») ; COD antéposé SANS apostrophe (« que j ai cueilli »→cueillies —
  c'est ainsi qu'un dys écrit) ; orange faux est→sont (« Le prix est fixe » : le -x de PRIX
  écrasait le déterminant — la liste des INVARIABLES existait, pas consultée là). Coût mesuré des
  trois : ZÉRO (1,40 %, census 301/301).
- **#599** le bug de fond des explications : `_corrFam` classait par la FORME du couple AVANT le
  NOM de la règle — arrive→arrivé expliqué comme ACCENT, sait→s'est comme SEGMENTATION :
  correction juste, explication FAUSSE (pire qu'une correction manquée pour un dys). Le nom de la
  règle prime désormais ; famille `participe` créée. Et sait→s'est LIVRÉ devant participe (savoir
  ne prend jamais un participe pour complément) 11/11 ; ma régression « savoir semi-auxiliaire »
  (sait ARRÊTER proposé sur une vraie faute) corrigée.
- **#600** son/sont devant adjectif pluriel : le tagger est EMPOISONNÉ PAR LA FAUTE ELLE-MÊME (il
  voit « son », déduit un déterminant, lit un nom derrière — « contents » = NOUN). Ce qui marche :
  un fait STRUCTUREL que la faute ne corrompt pas — le possessif « son » est toujours suivi d'un
  singulier, sauf invariables (fils, corps, prix — la liste de #598). 13/13, excédent INCHANGÉ à
  36 flags.
- **#601** trois familles + le paquet Store v0.6.0. peut/peu : le discriminateur est le VERBE FINI
  déjà présent dans la proposition (10/10) ; mais/mes en tête de phrase dans le seul cadre nom
  pluriel+verbe (12/12) ; ÉLISION FUSIONNÉE (jai→j'ai, quil→qu'il) — ⭐⭐ la 1ʳᵉ version passait
  13/13 et faisait monter l'excédent de 36 à **140 : 104 faux positifs, tous des NOMS PROPRES**
  (Charles→C'harles, Nantes→N'antes) — sans le comptage de FLAGS demandé par Rem ils passaient
  (le % global bougeait à peine). Excédent final 36 identique. Dans le même PR : le VETO
  ORTHO/PHONO/GRAMMAIRE (« cube » au lieu de la pyramide) construit, mesuré, **FALSIFIÉ** —
  meilleur taux de change 5 réparations perdues pour 1 casse évitée, plafond oracle +0/−1 ; 3ᵉ
  confirmation de « garde PAR RÈGLE, jamais globale ». Ne pas câbler.

**27-29/08 — le site : 404, Store publié, bêta EN, glossaire (#602-#606)**
- **#602** soft-404 sur tout le site (cause n°4 de l'enquête positionnement, la seule encore
  active) : sans `404.html`, Cloudflare Pages sert l'accueil EN 200 sur toute URL inexistante
  (mesuré : curl → 200). Vraie page 404 (noindex, liens ABSOLUS, hors sitemap) ; et le SW JETAIT
  les réponses non-ok — une 404 serveur devenait page d'erreur navigateur. Rappel : le remède
  principal reste la STABILITÉ, ceci est le seul correctif code utile.
- **#603** l'extension est SUR LE STORE (publiée le 28/08/2026, id dbochkbaechbemahapplibbhmfkcldln,
  v0.6.0) : deux pages affirmaient encore le contraire — bouton « Ajouter à Chrome », zip replié
  en `<details>` (seule voie Firefox/postes bloqués). Défaut antérieur réparé : l'extension est
  FRANÇAISE et `en/correcteur.html` proposait le zip sans le dire. Instrument au passage :
  `getBoundingClientRect` rapportait le zip VISIBLE dans un `<details>` fermé —
  `checkVisibility({contentVisibilityAuto})` tranche juste.
- **#604** logo Chrome sur le bouton, SVG INLINE — jamais une image gstatic (fuite d'IP de chaque
  visiteur trois lignes au-dessus de « Rien ne sort de votre appareil », et hors-ligne cassé).
  Géométrie contrôlée par `getBBox()`, pas à l'œil (les 3 secteurs font bien 120°).
- **#605** anglais marqué BÊTA sur les 3 surfaces qui l'offraient sans le dire (dont mon propre
  défaut de #603) — on marque le point où l'ANGLAIS est offert, pas la langue de la page. Et
  l'inventaire EXACT de la localisation (`extension/I18N.md`) : 124 messages = 101 à TRADUIRE ·
  3 à RÉÉCRIRE (REMED parle de phonétique française) · 10 JAMAIS (donnée FR sans équivalent) ·
  10 inertes ; trois versions fausses du compteur avant la bonne, gardées dans le doc.
- **#606** glossaire : 16 → 97 entrées, 8 groupes, tout le projet et plus seulement le pendu
  (HMM, n-gramme, g2p, FP=0, les 43 nœuds de la toile). Termes choisis par RELEVÉ page par page,
  pas de mémoire ; sigles vérifiés DANS les documents. Trouvable depuis recherche/toile/mémoire.

**30/08 — police de son × corrections, « durand », le dossier couleurs (#607-#610)**
- **#607** le VOISEMENT S'INVERSAIT dans les mots corrigés : les 3 faces enregistrées sans
  descripteur de graisse → dans un `<b>` le navigateur SYNTHÉTISE le gras — mesuré au canvas :
  Light 836→1263 pixels encrés (+51,1 %), PLUS ÉPAIS que Heavy 1242. ⚠️ La LARGEUR ne le voit pas
  (chasse fixe, 143,17 px identique) : ma première sonde concluait « aucun défaut », il faut
  compter l'ENCRE. Correctif `{weight:'1 1000'}`, garde greffée dans `parity_son.js` et
  falsifiée. L'extension PUBLIÉE 0.6.0 garde le défaut (rattrapé par la 0.6.1, #612).
- **#608** corrections SOULIGNÉES, plus surlignées (proposition de Rem, mesurée juste) : le fond
  du mot corrigé ne contrastait que **1,15** avec le fond de la boîte (seuil 3,0) — l'indicateur
  était quasi invisible. Foncer le fond est IMPOSSIBLE (les deux exigences vont en sens inverse,
  3 fonds mesurés) → signal déplacé sur un canal LIBRE : trait plein #2e8b57, 3,91 clair / 3,65
  sombre, une seule couleur passe dans les deux thèmes ; la rustine #00699f de la veille devient
  inutile, retirée. Reste ouvert (dit, pas touché) : muette vs syllabe à 1,17 en luminance.
- **#609** « durand » n'est plus corrigé d'office en « durant » (Rem : « la garde [nom propre] je
  suis contre » — respecté) : seul patronyme sur 72 à franchir la barre `confident`, et c'est le
  PIRE cas (substitution de la consonne FINALE, là où Durand/Durant, Renaud/Renault se séparent).
  Confiance resserrée, pas la couverture : 0/46 corrections UD retirées, 0/14 vraies fautes dys
  démotées — et le census MONTE de 301 à 305 oranges justes (référence ré-ancrée 305/242/163).
- **#610** chantier couleurs du correcteur : le DOSSIER (rien de livré) — muette à 1,43:1 dans un
  mot corrigé en sombre ; le réflexe évident (« réparer isDarkBg par segment ») MESURÉ inefficace
  (le bleu Okabe-Ito échoue sur les 5 pastels : 3,03…4,29) ; la solution = canaux DISJOINTS, avec
  4 pièges mesurés d'avance. Exécuté par #611 — cf. le digest #611-#655 en tête de journal.

**Chiffres de référence en sortie de fenêtre** : pipeline **397 réparés (25,7 %) / 19 cassés
(0,41 %)** (#601) · FP échelle UD **1,40 %** (35/2500) · census **305 oranges justes** (#609) ·
excédent homophones **36 flags**/2 500 correctes · batterie **75/75** · extension **v0.6.0
publiée au Chrome Web Store le 28/08** (#603).

---

## 2026-08-25 — Publication Chrome Web Store : préparation complète (dossier `extension/STORE.md`)

> [Verbatim CLAUDE.md, bloc EXTENSION CHROME. Dépassé par les faits depuis : 0.6.2 téléversée par Rem
> le 03/09/2026 (revue Google en cours), 0.6.3 prête — cf. ETAT.md, chantier « Publication Chrome Web Store ».]

**PUBLICATION CHROME WEB STORE — préparation faite (25/08/2026), dossier `extension/STORE.md`** :
3 blocages techniques levés —
① aucune icône (le Store exige 128, Chrome affiche 16/32/48) → `extension/build_icons.py` les **dérive**
de `icon-512.png` (pur Python, sans PIL ni rasteriseur : décodage/moyenne d'aire/réencodage, déterministe,
garde `--check` en CI et dev.sh — l'icône du site change ⇒ celle de l'extension suit) ;
② `description` du manifeste 343 caractères pour une **limite de 132** → 119 (le pitch long devient la
fiche du Store) ;
③ le zip commité range tout sous `extension/` (voulu : on le dézippe et on charge le dossier) mais le
Store veut `manifest.json` **à la RACINE** → `build_zip.py --store` (racine aplatie, README retiré,
31 fichiers, 4,0 Mo, **non commité** = artefact de publication).
Aussi : `short_name`, `minimum_chrome_version` 114 (= sidePanel). **Vérifié par le parseur de Chrome
lui-même** (`chrome --pack-extension` → .crx ; chargement headless sans erreur). `confidentialite.html`
gagne une section « L'extension Chrome » (ce qu'elle lit = le champ actif, pas la page) — c'est l'URL de
politique exigée par le Store. Permissions minimales et **toutes utilisées** (`storage`/`contextMenus`/
`sidePanel`, **pas** `tabs`), **aucun code distant** (mesuré). ⚠️ `<all_urls>` ⇒ revue lente attendue ;
la justification est écrite mot pour mot dans `STORE.md`.

---

## 2026-08-25 — Aide au calcul (dyscalculie) : la retenue ADDITIVE, et la sonde qui restait verte

> [Verbatim CLAUDE.md, bloc « Aide au calcul ». La décision reste vivante — pointée dans le nouveau CLAUDE.md.]

**Aide au calcul (dyscalculie)** — `calcul.html` (`/calcul`, version qui POSE l'opération) et le bloc
« 🔢 Aide au nombre » du panneau (version RAPIDE). Moteur `calc_dys.js` en **2 copies** (racine +
`extension/`), gardées par `dictee/calc_dys_probe.js`. **⚠️ La soustraction pose la retenue ADDITIVE
(sur le chiffre du BAS) — ne pas revenir à la méthode soustractive : elle affiche « il reste −1 » sur
502−347.** La sonde garde la signature structurelle `aEffectif ∈ {a, a+10}` ; tester le signe des valeurs
stockées NE SUFFIT PAS (le négatif naissait dans l'affichage — sonde restée verte, vécu le 25/08/2026).

---

## 2026-08-23 — Gold complet ×20, LE chiffre de référence du produit, et la série §5quater→§5septies

> [Verbatim CLAUDE.md, seconde moitié du bloc « ÉTAT DES LIEUX + LITTÉRATURE ». La version PROFONDE de
> chaque section vit dans `dictee/ETAT_DES_LIEUX.md` (§5ter → §5septies) ; ceci est le condensé daté qui
> vivait dans CLAUDE.md. La première moitié (paliers, spirale, rétractations `dys_gen`, « même corpus »
> Bodard) est déjà dans l'entrée JOURNAL du 2026-08-22 et sa PAUSE littérature.]

⇒ ~~Le vrai manque… c'est du TEXTE DYS RÉEL~~ **COMBLÉ le 22/08 : les 72 productions sans corrigé ont
été CORRIGÉES À LA MAIN** (`data_local/dys_reel/gold_claude.jsonl`, **6 778 mots** contre 335 — ×20 ;
protocole + contrôle qualité dans `dictee/ETAT_DES_LIEUX.md` §5ter/§CORPUS COMPLET ; 14 tokens `ambig`
non tranchés, exclus des mesures ; annotation **par Claude**, jamais un corrigé humain expert).

**LE CHIFFRE DE RÉFÉRENCE DU PRODUIT** (`dictee/dys_pipeline_probe.py`, 72 productions, 6 217 mots) :
**25,8 % des fautes RÉPARÉES · 0,77 % de mots justes CASSÉS** (⚠️ 1re version 22,1 % FAUSSE : la sonde
tokenisait sans les apostrophes typographiques `’ʼ` et **abandonnait 32 % des corrections du speller** ;
corrigée, 95,4 % appliquées). C'est LUI qui doit piloter les décisions — les mesures par COUCHE mentent
sur le produit (corriger un mot dys demande souvent speller ET grammaire : jugé isolément le speller
compte des fautes là où la pyramide rend le gold). Le corpus **converge avec la littérature** (1ʳᵉ lettre
11,2 % vs 10,9 % · vrai mot 54,8 % vs 53 % · fautifs 23,7 % vs 33 %) ⇒ représentatif, pas seulement
volumineux.

⚠️ **« ×29 sur les déterminants » RÉTRACTÉ** — encore l'artefact du mélange. Remesuré PAR GROUPE (juge
strict), contradictions dét/nom : **nom fautif = RÉEL 83 % (5/1, n=7) · SONDES 97 % (108/3) · GÉNÉRÉ
84 % (63/12)** ⇒ **le générateur colle au réel** ; le « 99 % » qui avait fait refuser la garde globale
venait des SONDES (faute unique, presque toujours sur le mot plein). Axe large, formes visant un
**mot-outil** : réel **21,4 %** · généré **27,1 %** · sondes 14,0 % ⇒ **1,27×, pas 29×**.
⇒ **`dys_gen.py` n'a plus AUCUN biais démontré** — les 3 griefs venaient tous de la comparaison à un
mélange de sondes. ⚠️ **n=7 ⇒ rien n'est tranché** : la décision de ne pas câbler reposait sur un mauvais
chiffre, mais on ne la renverse pas sur 7 cas ; sur les 78 textes réels ~**15 %** des groupes [dét+nom]
montrent une contradiction apparente ⇒ phénomène FRÉQUENT, attribution IMPOSSIBLE sans gold.

⭐ **ANCRE DE GENRE DU SPELLER — le bon candidat gagnait puis était DÉFAIT (23/08, §5septies)** : `chère`
gagnait le classement (priorité accent) puis la **bascule d'accord d'adjectif** le retournait en `cher`
sur une ancre fausse — le `un` de « **un peu** » (adverbial), et `mois` (« moins » mal écrit, nom masculin
**sans déterminant**). 2 gardes en **ABSTENTION PURE** (`peu` jamais ancre ; un **NOM NU** ne gouverne pas
le genre) ⇒ **pipeline 381→394 réparés (25,6 %) · casses 22→19 (0,41 %)** · FP speller échelle **46
inchangé** · dev.sh 70/70 · 4 moteurs. Elles rapportent **13 réparations**, pas seulement les 3 casses
visées. ⚠️ `decide`→`décidé` NON réglé (fréquence entre 2 candidats à accent, il faut le contexte verbal).

**« L'ORANGE EST-IL LÀ POUR LES 75 % RATÉS ? » — NON, MESURÉ** : sur 1 148 fautes non réparées, **1,6 %
rattrapables en un clic** (orange + suggestion juste, presque que `ce/se`+`quel/quelle`), 0,2 % de bruit,
**38,5 % SOULIGNÉES SANS suggestion** (l'app voit le problème, ne propose rien) et **59,8 % INVISIBLES**.
⚠️ 1re version fausse (« souligné : 0 ») — la référence **Python n'émet pas le palier « mot inconnu »**,
seul `spellText` (app) le fait ⇒ croiser avec un dump de l'APP. **Levier identifié, non traité : les 442
mots déjà soulignés sans suggestion — y proposer quelque chose ne coûte AUCUN risque de FP** (orange = au clic).

**RENDRE `_cmp` TRANSITIF : CONSTRUIT, MESURÉ, FALSIFIÉ** — la dette est réelle (permutation des
candidats : **7/602 corrections changent, 1,16 %**) mais la reformulation « gardes par candidat » donne
**392/19 contre 394/19** = **−2 réparations pour 0 casse évitée** (`nape`→tape au lieu de nappe…) : la
dominance pairwise encode « écrasé par CELUI-LÀ », pas « par le lot ». On garde le pairwise ; dette
nommée, faible priorité.

**NOMS PROPRES — FERMÉ PAR LA MESURE (23/08, §5sexies), PAS par l'absence de source** : le dump kaikki
EST dans le dépôt (`data_local/fr/kaikki-frwikt.jsonl`, celui qui a produit `prenoms_genre.tsv` DÉJÀ
embarqué) ⇒ « lexique introuvable » était FAUX. Ce qui ferme : **134 002 noms propres = 539 Ko gzippés**
à embarquer dans **3 moteurs** pour **3 casses sur 22** (`provence`/`loire`/`opel` ✓ ; **`xbox` ✗ `daeu` ✗
`microsoft` ✗** = la queue MARQUES/SIGLES, non bornée) + risque non mesuré de **masquer un vrai typo**
tombant sur un toponyme. Variante consignée non recommandée : toponymes FR seuls (quelques dizaines de Ko,
2 casses/22). ⚠️ Si le sujet revient, l'argument est le COÛT/GAIN.

⭐ **« une TRÉ faible exportation » → un (23/08, §5quinquies) — le posterior LEXICAL ne sait pas OÙ est le
mot** : `rule_det_gender` prenait le mot juste après le déterminant pour nom-tête et le validait au
posterior ; or `tré` **est un vrai mot** (0,038/M, masculin, P(NOM)=100 %) alors que le nom-tête est
`exportation` — `très` (1 435/M, **37 000×**) est dans `DET_SKIP`, pas `tré`. **2 casses au palier ROUGE,
dans le PRODUIT LIVRÉ** (vérifié sur `dys-core` chargé avec ses assets). Ce n'est PAS une ancre polluée
(l'ancre est un mot connu) ⇒ 3ᵉ confirmation qu'une primitive d'ancre LEXICALE globale ne sert à rien.
**Correctif = ajouter du CONTEXTE, pas baisser un seuil** : le tagger HMM (déjà embarqué partout) tague
`tré` **ADJ** et désigne `exportation` **NOUN** plus à droite. ⚠️ **1re version FAUSSE SUR LE PRINCIPE**
(« exiger le tag NOUN ») : `dev.sh`/`gender_coll_probe` l'a attrapée — **rappel 210→168**, elle punissait
les noms MAL TAGUÉS (`ajouté`/`analysé` = VERB au tagger, noms au posterior) = **ce que le posterior
existe pour rattraper**. Garde retenue = abstention **seulement si tag ADJ ET un NOUN suit dans les 2
jetons** (casses : ADJ+NOUN ; rappels perdus : VERB+ADV) ⇒ **rappel 210 identique avec et sans, coût
nul**. **Mesuré (4 moteurs) : pipeline 381 réparés INCHANGÉ, casses 24→22 · batterie genre 6/6 FP=0 ·
FP échelle 1,40 % STRICTEMENT inchangé · parités app et extension OK.** ⚠️ Une garde de FRÉQUENCE
(décalque de la dominance ≫20×) a été écartée : **non portable** — la grammaire Python n'a qu'un ENSEMBLE
de mots (`cgram_words.json`), les moteurs JS ont `SP.FREQ` ⇒ parité cassée ou nouvel asset.

⚠️⚠️ **LE MOTEUR DE RÉFÉRENCE N'ÉTAIT PAS DÉTERMINISTE (23/08, §5quater)** : `speller_probe.edits1`
rendait un `set()`, et le classement des candidats (`_cmp`) est **pairwise** (gardes de dominance) donc
**pas un ordre total** ⇒ le résultat d'un tri dépendait de l'ordre d'entrée, c.-à-d. du **hachage**.
**Mesuré : 10 des 598 corrections du gold changeaient d'une exécution à l'autre**, y compris l'existence
de la correction (`sété`→fêté ou rien). **Les moteurs JS, eux, étaient déterministes** (`Object.keys` =
ordre de génération) : c'est la RÉFÉRENCE Python qui dérivait, donc nos MESURES, pas le produit livré.
Correctif = dict à ordre d'insertion ⇒ stable sur 4 graines, pipeline **381/24 sur 3 passages
identiques**. ⚠️ **Cela ne donne PAS la parité avec l'app** (vérifié, pas déduit) : les deux moteurs
n'ont pas le même ensemble de candidats — Python lit `Lexique4.tsv` brut (**165 474** formes), l'app
embarque `speller-lex-gz` = Lexique 4 + Wiktionnaire (**214 685**) ; effet mesuré sur le gold = **7 mots
justes** (sœur, pyrénées, technopôle…), réel mais sans effet sur le chiffre de référence.
[Note du tri 03/09 : comblé depuis — la référence Python lit les mêmes lots (02/09/2026) et la parité
SPELLER Python↔JS est en CI (#621).] **Dette nommée** : `_cmp` reste NON TRANSITIF — reproductible ≠
bien défini.

**LanguageTool** : facteur de confusion de même forme que notre dominance ≫20× (plage **10–10⁷**,
précision préférée au rappel, seuils **0,995/0,99**, paires désactivées par défaut) mais **comparaison
CONTEXTUELLE (n-gram) vs notre fréquence NUE** ⇒ le chantier dominance = **donner du contexte**, pas
baisser le seuil.

---

## 2026-08-22 — qualité sur TEXTE DYS avant le store : paliers mesurés par sous-cas, 3 FP réparés à la source

> Déclencheur : revue de l'extension avec 5 phrases dys réalistes. Le moteur était **fort en grammaire** (« les enfant mange des bonbon » → enfants/mangent/bonbons, expliqué) mais rendait des corrections FAUSSES avec l'étiquette « sûr » : « ma **mere** ma dit » → « **mon** mere », « chein » → « chin », « aboit » → « about »/« a boit ». FP=0 tenait sur texte correct, pas sur texte dys — or c'est le texte qu'on reçoit.

- **La mesure qui manquait** : `dys_precision_probe.py` — sur 1 726 paires (brut, gold) du corpus dys local, chaque flag est jugé *juste / inutile (FP dys) / fausse*, **par famille et par palier**. Ortho auto 91 %, participe-après-avoir / majuscule / a-à / adjectif épithète / singulier du nom **100 %** ; **genre déterminant 58 %, leur/leurs 64 %, accord participe 43 %, ce/se 0/2**. Alignement brut↔gold par similarité locale (les mots-outils répétés piègent un alignement naïf ; tolérance aux élisions).
- **Paliers par sous-cas, pas par famille** (le banc Chrome réel l'a imposé : « il a ouvert leur volets », « Marie est venu » sont SÛRS) : `tier_of` (Python, réf.) ≡ `_tierOf` (app, dys-core). Rouge = sous-cas mesuré sûr (vrai pluriel attesté — pas « français/pays » —, nom écrit avec accent, sujet pronom/prénom), orange sinon. **Parité des paliers en CI** (142 corrections). Après : leur/leurs rouge 6/1 — l'orange a absorbé les 3 « inutiles ».
- **3 FP à la source** : (1) « mere » (m, rare) vivait dans la table de genre à collision à côté de « mère » (f, 100×) → `build_gender_coll_excl.py` exclut les **clés nues dominées par un jumeau accentué** (16 : mere/mère, cote/côté, foret/forêt, tare/taré…), listes JS `_GCOLL` régénérées depuis Python (`build_gcoll_js.py`, source unique) ; rappel genre 217→210 (plancher 200) ; (2) « chein » : le JS avait « chien » premier au tri mais une ré-sélection « contexte-first » (absente du Python) reprenait « chin » par clé phonétique sans garde de dominance → garde ≫20× ajoutée, parité ; (3) « aboit » : l'ancre de genre du speller traversait « qui » (→ nom masculin « about ») → `CTX_STOP` ; et la soudure « a + verbe » primait sur un verbe à 1 édition de même son → `_homophoneEdit1` (« aboie »).
- **Nouvelle règle ORANGE « est/et (proposition) »** (phrase de Rem : « je suis allé à la plage **est** c'était cool ») : « est » + c'est/c'était ou + pronom sujet **suivi d'un verbe** (POS) → « et » ; gardes trait d'union, « est ce que », « il est, je crois » ; l'inversion sans trait d'union (« est il pour les débutants ? », UD) est écartée par le POS. FP UD inchangé **38/2500 (1,52 %)**, rappel dys 59 %, batteries vertes.
- **Déjà là, vérifié plutôt que refait** : la révocation par mot dans le panneau (#544, clé index|mot|suggestion) ; la clé phonétique du speller (`phon_key`/`phonKey`) — le problème était le classement, pas l'absence de phonétique.
- ⚠️ Préexistant sur `main`, hors périmètre : 1 FP batterie « La foule impatiente attendait » → attendaient (collectifs).

### Suite (même jour) — « et les 24 % restants du pluriel ? » (question de Rem)
- Décomposés cas par cas : **7 des 11 = la même phrase recopiée par 7 élèves** (« à l'âge de vingt **anse** » → *anses* : « anse » existe, le speller le laisse, la règle accorde le mauvais mot) ; 2 = **artefact d'alignement** (« leurs tige → tiges », le gold dit bien *tiges*) ; 1 ambigu (« les guerre » → le gold change le déterminant). Sur cas **distincts** le pluriel est à ~81 % (28/4/3), pas 76 %. La sonde compte désormais aussi les **cas distincts** (mot, suggestion, contexte ±2).
- Deux **vrais défauts de règle** sujet-verbe, réparés dans les 3 moteurs : (1) le **pronom sujet élidé** (« alors **qu'il** reste 35 minutes » → *restent*) était invisible à `rule_accord_postpose` et à `_subject_before` → `_ELIDED_PRON` (qu'/s'/n'/puisqu'… + pronom) ; gain collatéral : « puisqu'ils mange » → *mangent*, nouveau rappel ; (2) « **le** pilotes sont » → *est* : `rule_accord_sv_noun` accordait sur un déterminant singulier contredit par un nom à forme plurielle attestée → abstention (sens inverse « les enfant joue » intact : c'est le nom que le gold corrige).
- FP UD 38/2500 inchangé, batteries vertes, parité 3 moteurs.

### Suite (2) — « y a-t-il d'autres règles polluées ? » : AUDIT RÈGLE PAR RÈGLE

> `dys_precision_probe` mesure par FAMILLE. Or **77 règles portent 60 noms** — « accord sujet-verbe »
> en cache **14** à lui seul : une règle fautive se cachait derrière la moyenne de ses voisines. Et une
> règle SOURDE est invisible d'une mesure de précision (la précision ne compte que ce qui tire).

- **Nouvel instrument** : `dictee/rules_audit_probe.py` — chaque règle appelée SÉPARÉMENT sur
  ① le texte dys (jugé contre le gold : juste / inutile / fausse, cas DISTINCTS), ② 2 500 phrases
  CORRECTES d'UD (tout tir = faux positif, ventilé rouge/orange par `tier_of`), ③ la batterie `CASES`
  (pour distinguer « muette parce que morte » de « muette faute d'occasion »). Signale aussi les
  règles **MASQUÉES** (elles tirent toujours derrière une règle prioritaire : code décoratif).
- **Leçon de méthode** : une bonne part des « FP » sur UD sont de **vraies fautes présentes dans UD**
  que la règle corrige justement (« à cette époques »→époque, « Au débuts des années »→début, « deux
  cent salariés »→cents, « Le pilier … semblent »→semble). Vérifier CAS PAR CAS avant de durcir : le
  tableau seul aurait fait « réparer » des règles qui avaient raison.
- **3 vrais défauts trouvés et réparés (3 moteurs)** :
  1. **`_np_subject` prenait le NUMÉRAL pour le nom-tête** — « ces **vingt** quatre équipes sont
     réparties » → tête « vingt » (masculin dans `GENDER_PURE` : « un vingt ») → « répartis » proposé
     sur un sujet féminin CORRECT. Bug **partagé** : ce parseur sert l'accord sujet-verbe nominal, le
     participe après être et l'adjectif attribut — toutes héritaient du faux genre. On saute le
     cardinal (`CARD`/tag NUM).
  2. **Verbe lu comme épithète** — « La taupe **court** pour semer les mouches » → « courte » (ROUGE
     sur UD). Le tagger HMM étiquette « court » ADJ après [DET NOUN] et `rule_adj_epithet` s'y fiait.
     Discriminant : l'**accord**. Une lecture verbale finie de 3ᵉ personne qui s'accorde avec le sujet
     = le verbe de la phrase → abstention. Rappel préservé quand le verbe n'accorde pas (« les
     situations **critique** » → critiques).
  3. **Cascade de deux ROUGES qui FABRIQUE une faute** — « dont cette statue **à conservé** le
     souvenir » recevait « à »→« a » (juste) ET « conservé »→« conserver » (parce que « à » était lu
     préposition) : appliquées ensemble → « a conserver ». L'ancre de la règle était un mot que le
     correcteur lui-même juge faux. Garde : si `rule_a_aa` corrige ce « à », abstention. **Deux règles
     partageaient l'angle mort** (`rule_e_er` ET `rule_flexion_er`) — seul l'audit par règle l'a montré.
- **Mesuré** : FP à l'échelle **1,52 % → 1,48 %** (37/2500) ; `rule_flexion_er` 100 % sans FP rouge ;
  `rule_e_er` 3→1 FP rouge ; `rule_adj_epithet` 3→2 ; `rule_pp_etre` 4→3 inutiles. Rappel dys 59 %,
  batteries et parités 3 moteurs vertes.
- **Reste au tableau, non imputable aux règles** : `rule_det_gender` 50 % et `rule_leur_leurs` 64 %
  sur dys — déjà rendus en ORANGE par sous-cas (PR #545) ; leurs « inutiles » viennent d'un contexte
  dys pollué, pas d'une erreur de raisonnement.

### Suite (3) — « et les 36 % restants de leur/leurs ? »

Même méthode : les 4 cas non justes sortis EN CONTEXTE, plus les 5 tirs sur texte correct (UD).

- **3 des 5 « FP » UD étaient de VRAIES fautes d'UD** que la règle corrige bien (« émettant **leur
  données** », « de **leur premières années** », « **leur différentes marques** » → *leurs*). Encore
  une fois : le tableau seul aurait fait durcir une règle qui avait raison.
- **Les 4 cas dys se ramènent à UNE cause** : la règle lit le NOMBRE sur l'orthographe du nom
  suivant — or sur du texte dys, l'orthographe est justement ce qui n'est pas fiable.
  ① **nom inconnu** : « de leur **payss** », « la nourriture lèurs **tigec** » — le -s final est du
  bruit, pas une marque de pluriel ; ② **faux pluriel** : « leur **français** » → *leurs*, parce que
  `INVAR_NOUN` (38 entrées) ignore les noms en -ais/-ois.
- **Correctifs (3 moteurs)** : ① abstention si le nom n'est pas un mot connu — on ne s'ancre pas sur
  un mot que le correcteur juge faux (même principe que la cascade « à conservé ») ; ② **test
  morphologique au lieu d'une liste** : un -s/-x n'est une marque de pluriel que si le singulier
  existe au lexique (« données »→donnée ✓, « français »→françai ✗) — sinon abstention (proposer
  « leur » ajoutait un FP sur « leurs Français »).
- **③ Le palier, tranché par une PREUVE** : « leurs »→« leur » corrige le DÉTERMINANT, la direction
  minoritaire (mesuré 12 contre 59). Première tentative — tout passer en orange — **cassée par le
  banc navigateur réel** : « il range leurs livre » DOIT s'appliquer (repli quand « livre » est
  ambigu verbe). Critère retenu, mesurable : rouge par défaut, **orange si un verbe de 3ᵉ personne
  PLURIELLE suit le groupe** (« Leurs racine ls **défendent** ») — la preuve que le GN est bien
  pluriel, donc que c'est le NOM qui a perdu son -s.
- **Mesuré** : leur/leurs sur texte dys **64 % → 86 %** (6 justes / 1 inutile, en ORANGE / 0 fausse) ;
  **FP à l'échelle 1,52 % → 1,44 %** (36/2500, meilleur niveau à ce jour) ; rappel dys 59 % ;
  batteries, parités 3 moteurs et banc navigateur réel verts.

### Suite (4) — le GÉNÉRATEUR DE FAUTES au service de l'audit (question de Rem)

> « Les travaux sur le générateur de fautes dys peuvent-ils aider pour les % restants ? »
> **Oui — et il a trouvé un bug que le corpus réel ne pouvait pas montrer.**

- **Le goulot de l'audit était le VOLUME** : `rule_leur_leurs` n'avait que 11 tirs distincts sur le
  corpus réel, `rule_accord_sv_noun` 2. On ne juge pas une règle sur 2 cas. Le générateur
  (`dys_gen.py`, calibré sur l'écrit dys réel de l'ASEI) applique des fautes crédibles à du
  **français correct réel** (corpus UD) : corpus apparié à volonté, corrigé certain par construction.
- **Branché dans l'audit** : `rules_audit_probe.py --genere N`. Sur 400 paires générées,
  `rule_accord_sv_noun` passe de 2 tirs (corpus réel) à **6**, dont **5 inutiles + 1 fausse**.
- **Le bug trouvé — le SYMÉTRIQUE de celui du 22/08 matin.** « **Les signe** de Budin **est** un
  test », « **les couple a** voulu », « **Les** somptueux **château constitue** » : déterminant
  PLURIEL contredit par un nom à forme SINGULIÈRE. J'avais corrigé la contradiction dans l'autre
  sens seulement (« **le pilotes sont** »). Discriminant retenu, le même que pour leur/leurs :
  **si `rule_noun_plural` sait réparer le nom, le pluriel est confirmé** et la règle continue
  (« les enfant **joue** » → enfants + jouent, la faute dys emblématique, PRÉSERVÉE) ; **sinon la
  contradiction reste ouverte → abstention**.
- **Vérification honnête des 5 signalements** : 3 étaient de vraies pollutions (corrigées), **2
  étaient des artefacts du générateur** — il avait supprimé « une » dans « une des nombreuses
  possibilités est », et rendu un groupe cohéremment singulier dans « Le pilier … semblent » (le
  correcteur a alors RAISON, c'est le gold qui garde la trace de l'original pluriel). Toujours la
  même règle : vérifier cas par cas avant de durcir.
- **Ce que le générateur mesure bien / mal**, mesuré ici : très bien les **faux positifs** (le
  corrigé est certain, et il reproduit exactement le mécanisme d'ANCRE POLLUÉE) ; **mal le rappel
  d'une règle rare** — après correctif la règle tombe à 2 tirs, tous artefacts, et sa précision
  reste à 0 % faute de « justes » : le générateur ne produit presque jamais la faute qu'elle vise.
  Il **complète** le corpus réel, il ne le remplace pas.
- **Mesuré** : sur 400 paires générées, `rule_accord_sv_noun` 6 tirs (1 fausse, 5 inutiles) → **2**
  (les 2 artefacts) ; corpus dys RÉEL inchangé (sujet-verbe 66,7 % pollué / 100 % propre) ; FP à
  l'échelle **1,44 %** inchangé ; batteries, parités 3 moteurs et banc navigateur réel verts.
- ⚠️ **Écart pré-existant repéré au passage** (hors périmètre) : la docstring de `rule_accord_sv_noun`
  promet « les cartons dans le couloir gêne » → gênent, or la règle est muette sur ce cas **déjà
  sur `main`** — une promesse de documentation non tenue, à traiter séparément.

### Suite (5) — ENQUÊTE : « on a la détection de type de mot (pronom/adjectif/sujet/verbe), pourquoi encore ces problèmes ? »

> Question de Rem. Trois hypothèses possibles : les couches de détection sont absentes, elles se
> trompent, ou elles ne servent à rien dans ces cas-là. **Mesuré : c'est la troisième.**

**① Qui consulte quoi** (77 règles) : POS-tagger 30 · conjugaison (`_reads`) 17 · posterior nom/verbe
9 · `vlike` 5 · **aucune couche : 36 règles (47 %)**. Ce n'est pas automatiquement un défaut — une
règle d'homophone à classe fermée (du/dû, mai/mais) n'a pas besoin d'un tagger. Mais `rule_e_er` et
`rule_flexion_er`, les deux de la cascade du matin, sont dans ce lot.

**② Le tagger se trompe-t-il là où ça fait mal ?** Configuration piège `[DET NOUN X]` avec X de
lecture verbale 3ᵉ pers., sur 2 500 phrases correctes : **66 % VERB/AUX, 7 % ADJ**. Et en regardant
les 60 « ADJ » un par un : ce sont en majorité de **vrais adjectifs** (« homme politique », « bronze
doré », « ton critique »). Le tagger n'est donc PAS systématiquement fautif ici — mon hypothèse de
départ était fausse et la mesure l'a corrigée.

**③ LA VRAIE CAUSE, mesurée** (`rules_audit_probe.py --ancres N`, sur 601 paires générées où l'on
sait exactement quels mots ont été abîmés) : sur 47 faux positifs du correcteur,
**36 (77 %) ont un VOISIN IMMÉDIAT ABÎMÉ** — « à **développé** », « les **bouddhisme** », « des
**valeur** », « **Lés** pouovirs publics **ont** ». Seuls 23 % surviennent en contexte propre. Et
c'est un **plancher** : les mots hors alignement ne sont pas comptés et le juge tolère l'accent.

**La leçon, et elle est structurelle** : *un POS-tagger étiquette CORRECTEMENT un mot FAUX.* Aucune
couche de détection ne peut aider quand l'information d'entrée est corrompue — et sur du texte dys
~20 % des mots le sont, donc pour un mot donné la probabilité qu'un de ses 4 voisins immédiats soit
abîmé approche **1−(0,8)⁴ ≈ 56 %**. Ajouter de la détection ne réglera pas ça.

**Ce qui marche, et c'est exactement ce qu'ont fait les 8 correctifs du jour** : ne pas raisonner sur
une ancre non fiable. Quatre variantes du même geste ont été codées séparément aujourd'hui —
mot inconnu du lexique (leur/leurs, speller), déterminant contredit par le nom (accord SV, les deux
sens), mot lui-même corrigé par une autre règle (cascade à/é-er), règle voisine qui sait réparer
(leur/leurs, accord SV). **Prochain pas naturel : les factoriser en une primitive partagée
« cette ancre est-elle fiable ? »**, disponible pour les 36 règles qui n'ont aucune garde — plutôt
que de la réécrire au cas par cas.

### Suite (6) — chantier « primitive partagée : cette ancre est-elle fiable ? » : LANCÉ, MESURÉ, **NON CÂBLÉ**

> Rem : « factorise-la en primitive partagée, utilisable par les 36 règles sans garde — je veux lancer
> ce chantier. » Lancé. Et la mesure a dit **non** avant la première ligne de câblage.

- **Ce qu'il fallait vérifier d'abord** : la primitive envisagée était lexicale (« l'ancre est-elle un
  mot connu ? »). Question préalable : **quelle part des faux positifs a une ancre non-mot ?**
- **Première mesure, FAUSSE de ma part** : j'ai compté « un voisin abîmé est un non-mot » (28 %) au
  lieu de « **l'ANCRE de la règle** est un non-mot ». Dans « l'an *derniai* **les** spécialiste »,
  l'ancre est « les » (mot réel, abîmé), le non-mot « derniai » traîne ailleurs dans la phrase.
- **Mesure corrigée, sur l'ancre réelle des 10 règles à ancre identifiable** : sur 36 faux positifs,
  **33 (92 %) ont une ancre parfaitement CONNUE** ; 3 seulement (8 %) sont des non-mots (« la **mêm**
  lignée », « a **unn** comportement », « a **édé** retiré »). **Une primitive lexicale partagée
  n'attraperait donc que ~8 % du problème**, au prix d'abstentions ajoutées dans 36 règles.
- **Second garde-fou, décisif** : le mécanisme dominant (92 %) est une **contradiction
  déterminant/nom** (« **des** valeur », « **les** bouddhisme »). Tentation : abstention sur
  contradiction. **Mesuré avant de coder** — qui est fautif quand déterminant et nom se contredisent ?
  · corpus dys **RÉEL** : le NOM 167 fois, le DÉTERMINANT **2** → **99 %** ;
  · corpus **GÉNÉRÉ** : le NOM 244, le DÉTERMINANT 98 → 71 %.
  **Le générateur abîme le déterminant ~29× plus souvent qu'un vrai scripteur dys.** Câbler cette
  garde aurait cassé une règle juste 99 fois sur 100 sur la population cible, pour faire plaisir à un
  corpus synthétique. C'est exactement le piège que la docstring de `dys_gen.py` annonce.
- **Décision** : la garde d'ancre reste **PAR RÈGLE** (4 variantes justifiées cas par cas le 22/08),
  pas de primitive globale. Le signal utile est la **cohérence** (déterminant vs nom, règle voisine
  qui sait réparer), pas l'appartenance au lexique — et la cohérence ne se juge qu'en connaissant
  l'ancre de CHAQUE règle.
- **Livré quand même** : la mesure est figée dans `rules_audit_probe.py --ancres N` (part d'ancre
  polluée + part d'ancre non-mot, avec la conclusion imprimée), et le **nœud « Ancre fiable »** entre
  dans la *toile du correcteur* (`toile.html`, famille « signaux de contexte », relié à sv/nom/genre/
  homophones/cœur) avec ses chiffres et sa limite.
- **Le vrai prochain chantier, lui, est identifié** : **corriger le biais du générateur** (il choisit
  le mot à abîmer sans respecter la répartition réelle mot-plein / mot-outil). Tant qu'il abîme les
  déterminants 29× trop souvent, son inventaire de faux positifs n'est pas exploitable pour régler
  les règles d'accord — alors qu'il l'est déjà pour tout le reste.

- **« C'est quoi un non-mot ? Le reste-t-il ? Spirale positive ou négative ? »** — question posée en fin
  de journée, mesurée avant de répondre : `dictee/spirale_probe.py` (corpus dys réel, SAUTÉE sans lui ;
  `--densite` pour le calibrage du générateur).
  - **Définition** : un non-mot est un token ABSENT du lexique speller (211 491 formes, repli sans
    accents) — définition **lexicale, pas linguistique**. Elle ne dit RIEN sur la justesse : « parties »
    (mauvaise réparation de « parvis ») est un mot valide, et la faute dys la plus fréquente (ces/ses,
    a/à, é/er) ne produit **jamais** de non-mot. Un mot n'est donc pas non-mot « parce qu'il a une
    faute » : il l'est parce qu'il est **inconnu**. Deux notions disjointes — et c'est exactement
    l'angle mort que la couche grammaire existe pour couvrir.
  - **Le statut n'est PAS stable** : sur 29 784 mots (16,0 % de non-mots), **22 % le perdent en une
    seule passe** — 16 % promus avec la **bonne** graphie, **5 % avec la MAUVAISE**, 1 % alors qu'ils
    étaient déjà justes. Le moment est une ligne : la **pyramide** de `diagnoseAll` applique les
    suggestions ortho non-vigilance aux tokens **avant** que la grammaire ne les lise (`_Tc[f.i]=f.sugg`).
    Après elle, la grammaire ne voit plus le non-mot **et ignore que le mot vient d'être fabriqué** : la
    **provenance est effacée**.
  - **La spirale, mesurée dans les deux sens** : grammaire seule sur tokens **bruts** 88 % (236 justes) →
    sur tokens **nettoyés** 86 % (248 justes). La pyramide **gagne 12 corrections justes (+5 % de rappel)
    et coûte 8 fausses** : **positive en volume, légèrement négative en confiance**.
  - **Le résultat utile est le détail**, précision selon le voisinage (±2) : contexte propre **91 %** ·
    voisin non-mot **bien** réparé 86 % · **non-mot laissé tel quel 85 %** · le mot lui-même mal réparé
    75 % · **VOISIN mal réparé 55 %**. ⇒ **un non-mot laissé en l'état coûte 6 points, mal réparé il en
    coûte 36 — six fois pire.** Le poison n'est pas le non-mot, c'est la **réparation fausse** : elle
    promeut l'erreur au rang de mot connu et lui fait hériter de la **confiance pleine**
    (« parvies »→*parties*, puis l'accord du nom empile *parties*→*partie*).
  - **Réparable, mais pas gratuitement** : ces décisions sur ancre blanchie sont **26 justes / 10
    fautives, toutes en ROUGE**. Tout passer en orange retirerait 10 erreurs confiantes au prix de 26
    corrections à un clic — arbitrage, pas gain. Seul le sous-cas « **voisin** mal réparé » (55 %, pile
    ou face, **confirmé à 52 % indépendamment sur corpus généré**) mérite l'orange sans discussion.
    **Non câblé** : à trancher avec Rem, comme les autres paliers.
- **Second biais du générateur, mesuré au passage** (`spirale_probe.py --densite`) : `dys_gen.py` est bien
  calibré sur la **nature** des fautes (62 % de non-mots contre 66 % en réel) mais en met **~2× trop par
  phrase** (13,1 % de mots fautifs contre **6,9 %**). Indépendant du ×29 sur les déterminants.
  ⚠️ **Correction à porter sur une mesure du jour** : le « **77 % des FP ont un voisin abîmé** » vient du
  corpus **généré**, où la probabilité qu'un des 4 voisins soit abîmé vaut 43 % contre **25 %** en réel —
  **ce chiffre est surestimé** et doit être remesuré sur texte dys réel.

- **« 10 erreurs confiantes en moins contre 26 corrections derrière un clic » — le dilemme n'existait pas.**
  Rem tranche : *« objectif résultat parfait »* → ne PAS arbitrer le troc, chercher le DISCRIMINANT. En
  sortant les 39 décisions prises sur ancre blanchie une par une (au lieu du tableau agrégé), le motif
  saute aux yeux :
  ```
  pettits      → petit   (speller)  puis  petit → petits   (grammaire)   gold petits ✓
  souterrainss → souterrain         puis  → souterrains                  gold souterrains ✓
  jourss       → jour               puis  → jours                        gold jours ✓
  leusr        → leur               puis  → leurs                        gold leurs ✓
  ```
  Dans CHAQUE cas le speller a choisi un candidat **plus loin** que le bon (`jourss`→`jours` = 1 édition,
  `jour` = 2) : il **enlève la marque de pluriel**, et la grammaire la remet. **Deux erreurs qui
  s'annulent.** Les 26 « justes » n'étaient pas des corrections à arbitrer — elles n'avaient pas lieu
  d'exister. Et le même défaut produit des fautes : `vvient`→`vivent` est UNE transposition (le gold),
  `viens` en coûte deux ; le speller prend `viens`, la grammaire empile `viennent`.
- **Cause racine, mesurée dans le code puis vérifiée par sonde** : le critère d'accord en nombre
  (`nmatch` / `sNMatch`) existait **et était correct** — il n'avait **jamais la preuve**. `_ctx_number`
  ne connaissait ni les numéraux ni les quantifieurs pluriels, et ne regardait **que vers l'arrière**.
  Sans preuve, `_cmp` retombe sur la **fréquence brute** : la forme de base étant presque toujours plus
  fréquente que la fléchie, le singulier gagne systématiquement. Preuve directe : le même mot dans un
  contexte pluriel DÉJÀ reconnu donne le bon résultat (`« Trois jourss »`→jour, `« les jourss »`→jours).
- **Correctif (3 moteurs, parité exacte)** — on ne touche PAS au classement, on lui donne ce qui est
  déjà écrit dans la phrase. **Pluriel NON AMBIGU uniquement, jamais de singulier** → aucun risque nouveau.
  1. **En arrière** : cardinaux ≥2 (même liste et même sémantique que `CARD` de `correcteur_probe`, déjà
     mesurée FP=0 à l'échelle UD) + quantifieurs pluriels absents de la table (`tous`, `plusieurs`,
     `quelques`, `certains`…). Répare « Trois jourss », « deux seccrétaires », « Tous less magasins ».
  2. **En avant** : pour un déterminant ou un adjectif, la marque est portée par le **nom qui suit** —
     direction que le code ne regardait pas du tout (« pettits **tuyaux** », « leusr **tiges** »).
     Restreinte pour ne créer AUCUN risque : token **immédiatement** suivant · **nom connu** (tag N) au
     pluriel **morphologique** (le -s/-x n'est une marque que si le singulier est attesté au lexique) ·
     **jamais un mot-outil**. Ce dernier point est le piège de la symétrie, **mesuré avant d'écrire la
     règle** : « il mangee **des** pommes » ne doit pas mettre le VERBE au pluriel (vérifié, ne tire pas).
  3. **Adjacence** : un déterminant COLLÉ prime ; sinon la preuve avant prime sur un déterminant lointain
     (« à la nourriture de leusr **tiges** » : le `la` à 3 mots donnait « singulier »).
  4. Deux défauts de ma propre règle vus à l'œil et réparés AVANT de mesurer : « tuyaux » lu comme un
     pluriel en `-al` (il faut tester les DEUX singuliers, cheval/tuyau), et l'adjacence ci-dessus.
- **Mesuré (corpus dys réel, `spirale_probe.py`)** :

  | | avant | arrière | **+ avant** |
  |---|---|---|---|
  | non-mots promus avec la **bonne** graphie | 779 | 784 | **793** |
  | non-mots promus avec la **MAUVAISE** | 229 | 225 | **216** |
  | décisions rouges **justes** sur ancre blanchie | 26 | 24 | **19** |
  | décisions rouges **fautives** | 10 | 8 | **8** |

  Les 26 corrections « à risque » tombent à 19 **sans qu'aucune soit dégradée** : le speller fait le
  travail lui-même, la grammaire n'a plus à compenser. Le travail est revenu à la bonne couche.
- **Gardes : aucune régression.** Batterie FP=0 · FP échelle grammaire **1,44 %** · FP speller à l'échelle
  **38 ≤ 48** · speller GEC 98 phrases AUTO=0/FLAG=1 **identique** · rappel non-mots GEC 6/11 · parité
  `dys-core` ⊆ Python (296 phrases) · paliers ext ↔ Python (142 corrections) · **parité 3 moteurs sur le
  nouveau comportement : 0 divergence / 11 cas** · **dev.sh 69/69** (banc navigateur réel compris).
  Vérifié en rejouant sur `main` : `blanch→blanches` et `oves→oses` sont **préexistants**, pas causés ici.
- **AUDIT HONNÊTE — ce qui n'est PAS réglé** : il reste **8 erreurs confiantes**, et elles relèvent d'un
  AUTRE mécanisme — le speller se trompe de **LEMME**, pas de nombre : `belu`→*beau* (gold *bleu*),
  `parvies`→*parties* (gold *parvis*), `alle`→*allé* (gold *elle*). Les deux candidats sont à **égale
  distance d'édition** et la fréquence tranche — mal. Aucune preuve d'accord ne peut les rattraper, parce
  que le nombre n'est pas ce qui les sépare. **Chantier séparé**, cas nommés, à ne pas empiler ici.

- **Erreurs de LEMME : une hypothèse construite, mesurée et REJETÉE (22/08).** Le PR précédent laissait
  8 erreurs confiantes relevant d'un autre mécanisme : le speller se trompe de **lemme**, pas de nombre
  (`belu`→*beau* / gold **bleu**, `parvies`→*parties* / gold **parvis**), les deux candidats étant à
  **égale distance d'édition** avec la fréquence pour seul arbitre.
  - **Hypothèse (phénoménologie dys)** : l'élève **inverse, omet, double** des lettres qu'il a écrites ;
    il en **invente** rarement. `belu` contient exactement les lettres de `bleu` ; `beau` exige un `a`
    absent de la saisie. `parvies`→`parvis` n'invente rien, `parties` réclame un `t` venu de nulle part.
  - **Implémentée proprement** : départage placé **juste avant la fréquence** (n'agit que si tout le reste
    est à égalité) et surtout **pas un filtre** — vérifié que `leson`→`leçon` (invente un `c`) et
    `fote`→`faute` (invente `a`,`u`) survivent, aucun rival de même rang ne faisant mieux. Sur les 13 cas
    témoins : `belu`→**bleu** gagné, tous les gains du matin tenus, parité 3 moteurs 0 divergence.
  - **REJETÉE PAR LA MESURE** (`spirale_probe.py`, corpus dys réel) : non-mots promus avec la BONNE
    graphie **793→782 (−11)**, avec la MAUVAISE **216→213 (−3)**. **11 bonnes corrections perdues pour
    3 mauvaises évitées.** Joli sur trois exemples choisis, perdant à l'échelle. **Retirée des 3 moteurs.**
    ⇒ **FALSIFIÉ — ne pas refaire** : « préférer le candidat qui n'invente aucune lettre ».
- **Garde verbale sur `nmatch` (gardée, mais MESURÉE INERTE — dit honnêtement).** Un `-s` final n'est une
  marque de pluriel que sur un NOM ou un ADJECTIF ; sur un VERBE c'est la 2ᵉ personne du **singulier**
  (« tu viens »). La preuve de pluriel élargie du matin rendait ce bonus atteignable pour des formes
  verbales. Garde ajoutée (3 moteurs) : pas de bonus de nombre pour un candidat **verbe seul**.
  **Chiffres dys rigoureusement identiques avec et sans** (793/216, rouges fautives 8) → gardée parce que
  le raisonnement est **faux** sans elle, **pas** parce qu'elle gagne quelque chose.
  ⚠️ **Correction d'une affirmation que j'avais faite** : j'ai d'abord cru que cette garde réparait
  « vvient »→*viens*. **Faux** — la **fréquence** y décide de toute façon (viens 736 contre vient 340) ;
  ce qui avait retourné ce cas, c'était le départage « lettre inventée », précisément celui que la mesure
  a rejeté. Le commentaire de code portait cette erreur : corrigé dans les 3 moteurs.
- **`parvies` : cause identifiée, NON traitée (délibérément).** `parvis` **est** le bon candidat — même
  priorité (edit-1) **et** c'est lui qui porte le phon-match (`parvi`). Il perd parce que la garde de
  **dominance ≫20×** — écrite contre les junks lexicaux type `accort`/`accord` — écrase le phon-match dès
  que le bon mot est simplement **rare** (parvis 0,15 contre parties 23,7). Cette garde ne sait pas
  distinguer « mot rare » de « bruit lexical » ; la retoucher demande de mesurer les DEUX populations à la
  fois (junks ET mots rares légitimes). Chantier séparé, pas un bricolage de fin de campagne.

- **PAUSE : état des lieux + revue de littérature + LanguageTool** → `dictee/ETAT_DES_LIEUX.md`.
  - **CONFIRMÉ par Bodard (2020, JEP-TALN, corpus dyslexiques FRANÇAIS)** : 58,7 % des formes erronées ont
    la MÊME phonétique que la cible (67,1 % voyelles simplifiées) — notre route phonétique est le bon
    pilier, et notre `phon_key` fait déjà la simplification des voyelles qu'ils recommandent (on avait en
    plus **mesuré-réfuté** l'IPA fidèle : 85 % contre 67 %, **convergence indépendante**). Erreurs les plus
    fréquentes : phonétisation 27,25 % + accord genre/nombre/conjugaison 26,81 % = **nos deux plus gros
    investissements**. Formes les plus erronées : très/peut/à/après/ils/ont/c'est/ce/au/est = **exactement
    nos règles**. Et **72,3 % des formes erronées ont ≥1 mot de contexte erroné (fenêtre ±2)** : notre
    « ancre polluée » est un phénomène publié en 2020.
  - ⚠️ **CORRIGÉ : notre corpus dys est PLUS FACILE que les corpus publiés, sur tous les axes** — mots
    erronés 6,9 % contre ~33 % · distance ≥2 : 30,3 % contre 41,2 % · 1ʳᵉ lettre fausse 6,2 % contre
    10,9 % · erreurs en vrai mot 34 % contre 53 %. **Nos pourcentages sont donc optimistes** par rapport à
    la population cible.
  - ⚠️ **RETOURNEMENT sur `dys_gen.py`** : « ~2× trop de fautes » était mesuré contre NOTRE corpus. Contre
    la littérature (~33 % de mots fautifs), c'est le **générateur (13,1 %) qui est le plus proche du réel**
    et notre corpus qui est atypique. Le biais ×29 sur les déterminants reste un vrai biais de forme.
    **À trancher par une mesure** (nos populations diffèrent peut-être : âge, dictée vs écrit spontané).
  - **Piste de la littérature ÉVALUÉE ET REJETÉE sur nos données** : « comparer l'initiale PHONÉTIQUE au
    lieu de l'initiale orthographique » dans `_cands` (le papier note 10,9 % d'initiales fausses mais <4 %
    de phonétiquement fausses). **Chez nous la garde n'écarte que 6,2 % des formes, dont 5,5 % ont aussi
    l'initiale phonétique fausse → gain plafonné à 0,7 %.** Ne vaut pas le code. *Piste fermée.*
  - ⚠️ **LE « ×29 SUR LES DÉTERMINANTS » EST RÉTRACTÉ — encore l'artefact du mélange.** Le chiffre venait
    de comparer le généré au « corpus dys réel » (93 % de sondes). Remesuré **par groupe**, juge STRICT :

    | | contradictions dét/nom | nom fautif | dét fautif | **nom =** |
    |---|---|---|---|---|
    | **RÉEL (6 dictées)** | 7 | 5 | 1 | **83 %** |
    | SONDES | 288 | 108 | 3 | **97 %** |
    | **GÉNÉRÉ** | 124 | 63 | 12 | **84 %** |

    **Le générateur (84 %) colle au réel (83 %).** Le « 99 % » qui m'avait fait REFUSER la garde globale
    venait des **sondes** — qui injectent une faute unique, presque toujours sur le mot plein. Axe large,
    formes erronées visant un **mot-outil** : réel **21,4 %** · généré **27,1 %** · sondes 14,0 %
    ⇒ **1,27×, pas 29×**.
    ⇒ **`dys_gen.py` n'a plus AUCUN biais démontré** (densité 13,2 % vs 12,8 % · nature 62 %/66 % ·
    mots-outils 1,27×). Les **trois** griefs portés contre lui aujourd'hui venaient tous de la même erreur
    de méthode : le comparer à un mélange dominé par des sondes.
    ⚠️ **MAIS n=7 côté réel : rien n'est tranché.** Ma décision de ne pas câbler la garde reposait sur un
    mauvais chiffre ; je ne la renverse pas sur 7 cas. Sur les **78 textes réels** (sans corrigé, donc sans
    attribution possible), ~**15 %** des groupes [déterminant + nom] montrent une contradiction apparente
    au test morphologique — le phénomène est **fréquent**, mais **qui a tort** reste hors de portée. (Le
    test bute en outre sur les mots courts : « son pas », « le taux », « une des ».)
    ⇒ **Même conclusion que partout ailleurs aujourd'hui : il faut du GOLD sur du texte dys réel.**
  - **CHANTIER « dominance en contexte » : INVENTAIRE FAIT (§5 doctrine), ROUTE BLOQUÉE PAR LES DONNÉES.**
    Ce qui existe déjà : **`os_subj_lm.json.gz`** (LM bidirectionnel trigrammes+bigrammes UD-GSD, API
    `p_fwd`/`p_bwd`/**`lsc()`**, **EN PRODUCTION**, parité 3 moteurs via `parity_os.js`/`os-lm-gz`),
    `pos_hmm.json` (HMM Viterbi ~95 %), `ces_ses_model.json`, et `build_asr_lm.py` (LM ×240 **mesuré
    pire**, gardé comme recette). **Rien à construire — `lsc()` EST la comparaison contextuelle voulue.**
    Testé sur les cas connus : `parvies`→*parties* (−8,90 vs −13,78), `belu`→*beau*, `vvient`→*vient*
    (2 succès seulement : `less`→les, `leson`→leçon). **Cause mesurée** : le LM fait **13 954 unigrammes /
    233 614 tokens** ; `parvis` y apparaît **2 fois** contre 40 pour `parties`, **`nuque` est ABSENT** →
    `lsc` **dégénère en `p_uni`** = la fréquence nue qu'on fuyait. ⇒ **bloqué par le VOLUME, pas par
    l'architecture** (LanguageTool = n-grammes Google, milliards ; nous 0,23 M) — et le dépôt a **déjà**
    tenté de grossir (piège de registre Wikipédia, même piège de fréquence). Rouvrir suppose un corpus FR
    massif au bon registre = arbitrage explicite (taille embarquée, licence), pas un réglage de seuil.
  - ⚠️⚠️⚠️ **CORRECTION MAJEURE — ce n'est PAS une convergence, c'est le MÊME CORPUS.** La notice
    `corpus_dys/README.txt` le dit : **FFDys** (Laetitia Branciard, 7 textes, adolescent) + **Plateforme
    Dys de l'ASEI** (Cécile Péguin, 71 textes, adultes) = **exactement les deux corpus de Bodard 2020**.
    Vérifié, pas supposé : **les 15 formes citées en exemple dans le papier sont dans nos fichiers**
    (`disgetif`, `meiu`, `setoufle`, `mayeur`, `Qustion`, `aprle`, `situiation`, `réusite`, `comerse`,
    `ducou`, `rendévous`, `lafrique`, `oré`, `nalé`, `fesé`). **La « convergence indépendante » que
    j'ai annoncée n'existe pas** — nos chiffres ressemblent aux leurs parce que ce sont les mêmes données.
    Ce que ça apporte à la place : leurs statistiques publiées **décrivent notre corpus**, avec un gold que
    nous n'avons pas — elles donnent la vérité terrain des **72 textes que nous n'exploitons pas**.
  - **Les 78 textes SONT dans le dépôt** (`data_local/dys_reel/corpus_dys/`), mais en `_raw.txt` **sans
    corrigé** : seules les 6 **dictées** ont un gold (le texte dicté est connu), d'où les « 6 paires ».
    Les 72 autres restent mesurables pour ce qui ne demande **pas** de référence — non-mots par genre :
    corpus1 (ado) **26,2 %** · Dictée 21,8 % · Expression libre 16,0 % · Expr. dirigée 15,4 % ·
    **TOTAL réel 20,6 %** contre **16,0 %** dans le mélange qu'on mesurait. Le texte dys réel est **plus
    dur**, et la dictée n'est pas le genre le plus facile sur cet axe.
  - ⚠️ **BIAIS DE MESURE DANS NOTRE JUGE** : `dys_precision_probe.eq` **normalise les accents**, or
    l'accent est une famille dys majeure que Bodard compte. Mots fautifs sur les 6 dictées : **13,1 % au
    juge actuel contre 17,1 % en strict** (4 pts d'écart = accents/élisions ; sondes 0,8 pt ; généré
    3,6 pts). ⇒ **toutes mes comparaisons de pourcentages à la littérature étaient biaisées à la baisse.**
    La tolérance reste justifiée pour **juger une correction**, pas pour **décrire un corpus**.
  - ⚠️⚠️ **PUIS, EN OUVRANT LES FICHIERS (`corpus_profile_probe.py`) : le « corpus dys réel » est un
    MÉLANGE MAL ÉTIQUETÉ.** 1 726 paires = **1 600 SONDES à faute unique** (`faiblesses.jsonl`, 200 × 8
    familles : accent, inversion, lettre_manque…), **120 générées**, et **6 VRAIES DICTÉES** (0,3 %,
    335 mots). Profil par groupe : le sous-ensemble **RÉEL converge avec la littérature** (d=1 60,5 % vs
    58,8 % · d≥2 39,5 % vs 41,2 % · 1ʳᵉ lettre 18,6 % vs 10,9 % · vrai mot 48,8 % vs 53 %) — ce sont **les
    SONDES qui sont atypiques** (faute isolée, première lettre quasi jamais touchée, 31,2 % de vrais mots).
    ⇒ **les deltas avant/après de la campagne restent VALIDES** (même corpus des deux côtés) mais **les
    ABSOLUS mesurent la tenue du moteur sur des fautes ISOLÉES**, pas sur du dys réel.
    ⇒ **DOUBLE RÉTRACTATION sur `dys_gen.py`** : ni « 2× trop dense » (comparé au mélange), ni « plus
    proche du réel que notre corpus » (§ ci-dessus) — **mesure directe : généré 13,2 % contre RÉEL 12,8 %,
    il est BIEN CALIBRÉ en densité.** Le biais ×29 sur les déterminants reste à vérifier séparément.
    ⇒ **Le vrai manque n'est pas un meilleur générateur, c'est du TEXTE DYS RÉEL.** La validation terrain
    (orthophonistes), déjà au plan, débloque tout le reste : 335 mots, c'est trop peu pour conclure.
  - **LanguageTool** : leur `ConfusionProbabilityRule` utilise un **facteur** de même FORME que notre garde
    de dominance ≫20× (plage **10 à 10 000 000** ; facteur 1 = fausses alertes), choisi par un évaluateur
    dédié, avec **précision préférée au rappel** (seuils **0,995** mots fréquents / **0,99** autres) et la
    plupart des paires **désactivées par défaut**. **Différence décisive : leur comparaison est
    CONTEXTUELLE (n-gram), la nôtre est une fréquence NUE.** ⇒ le chantier « dominance » n'est PAS
    « baisser le seuil » (on échangerait des junks contre des FP) mais **donner du contexte à la
    comparaison** — le dépôt a déjà n-gram §1.7, POS-tagger 155k et `noun-post` (doctrine §5).

## 2026-07 → 2026-08 — POLICE DYS : design en aveugle → littérature → intégrée PARTOUT → pack OFL → Word

> [Verbatim CLAUDE.md, bloc « POLICE DYS » (aucune entrée JOURNAL n'existait pour ce chantier ; le
> worktree police avait sa propre mémoire). Docs : `police/DESIGN_AVEUGLE.md`, `police/LITTERATURE.md`.]

**POLICE DYS** (`police/`) : `build_font.py` (fontTools) → `OmegaDys-Regular.ttf` (85 glyphes,
paramétrique) + `demo.html`. Design **en aveugle** figé (`DESIGN_AVEUGLE.md`) puis confronté à la
littérature (`LITTERATURE.md`) : espacement large **confirmé** (Zorzi 2012), anti-miroir type
OpenDyslexic **falsifié par proxy** (méta-analyse 2026 : aucun effet), voisement=graisse **inédit**
(précédent : Visible Speech, Bell 1867), « **police de son** » (rendu contextuel g2p : muettes grisées,
s→/z/ via variantes PUA U+E000+, syllabes) **converge avec LireCouleur**. Axe retenu : rendu adaptatif >
forme fixe ; graisse-voisement réservée à la remédiation ciblée. Banc de mesure prévu = la dictée.

**Architecture tranchée : le TEXTE ne change JAMAIS** (pas d'alphabet privé ; PUA dépréciés) — même
police en 3 graisses (`Light/Regular/Heavy`) + spans posés par le g2p réel (`build_son_layer.py` →
`son_layer.json`, garantie de reconstruction testée ; aperçu `apercu_son.png`). ⚠️ Bug moteur découvert :
`decompose.g2p` branche DBL rend les doubles consonnes muettes (assis→/ai/) + correction apprise `ss→∅` —
**confirmé aussi dans l'app** (`_DECL2.g2p` ligne ~6440, même défaut) — tâche séparée, contournement
`DBL_FIX` porté partout (inerte après correctif).

**INTÉGRÉE DANS L'APP** : bloc idempotent `OMEGADYS-SON` (`police/inject_fonts.py` = 3 TTF base64 +
`son_core.js` sans DOM + `son_ui.js`) → case « Police de son » dans la dictée (OFF défaut, `vdd_son`,
chargement paresseux) qui habille `.vdd-truth` via `_DECL2.g2p` (voisé=Heavy, sourd=Light,
muette=**vermillon** `#a34700` (clair) / `#f0a04b` (sombre) — le gris, jugé pénible, est abandonné, texte
DOM identique). Parité CI : `node police/parity_son.js` (fraîcheur bloc, clitiques ≡ Python, texte jamais
altéré, ancres poison/poisson). Couleurs : BDA (crème, pas de gris faible) + Okabe-Ito, la couleur jamais
seul canal.

**PARTOUT (08/2026)** : habille la **SAISIE** (Correcteur `#vdc-in` après chaque réécriture du
correcteur ; **Dictée `#vdd-ans` devenue contenteditable** avec shim `value/select` comme `#vdc-in`,
ré-habillage auto 300 ms), curseur préservé par offset texte ; couleur muette/syllabe par **luminosité du
fond réel** (thème sombre OK) ; **syllabes** (`syllableIndex` = port de `decompose.syllabify_*`, bouton
« ✂️ Syllabes », parité là où graphèmes ET phonèmes coïncident). **Extension** : `extension/son_panel.js`
(shim textarea→contenteditable `#omdys-ta` + police de son, chargé AVANT `sidepanel.js`), assets `g2p.js`
(tranche `_DECL2` verbatim) + `son_core.js` + 3 TTF produits par `build_assets.py`, chargés
paresseusement ; surface panneau seulement (jamais un champ de site tiers). Cases « 🔡 Police de son /
✂️ Syllabes » dans les réglages du panneau.

**PACK TÉLÉCHARGEABLE (08/2026)** : 135 glyphes (chiffres, ponctuation complète, « », œ/Œ/æ/Æ, capitales
accentuées), licence **SIL OFL 1.1** (glyphes originaux, pas une dérivée Lexique), `police/build_pack.py`
→ `omega-police-dys.zip` (3 TTF + `LISEZMOI.txt` + `OFL.txt`, garde `--check` en CI + dev.sh), lien sur
`donnees.html` (FR/EN). Dans Word la police fait le voisement **par lettre** seulement (pas de g2p) ; la
police de son complète = app/extension.

**Complément Word (bêta, `word/`)** : `son_word.js` = planificateur pur (mot → runs `{text,font,color}`,
texte identique garanti), `taskpane.js` = glue Office (`getTextRanges` → `insertText Replace/After`),
`manifest.xml` (TaskPaneApp WordApi 1.3 → `https://omega-pendu.pages.dev/word/taskpane.html`), icônes,
README sideload ; charge `extension/assets/g2p.js` + `son_core.js` (zéro duplication moteur). Garde CI
`node word/test_son_word.js` (g2p réel, 306 morceaux, glue simulée). ⚠️ **Non testé dans Word réel**
(logique testée sous node + volet vérifié hors Word) — premier essai terrain à faire.

---

## 2026-07 — Correcteur : UI par confiance · speller anti-flood Wiktionnaire · genre +21 847 noms

> [Verbatim CLAUDE.md, extraits du bloc « CORRECTEUR DYS » sans entrée JOURNAL datée propre.]

**UI par CONFIANCE (07/2026)** : texte source jamais réécrit, corrigé dans un encadré séparé — sûr (FP=0)
+ candidats ortho APPLIQUÉS par défaut, chaque mot = bascule annuler/réappliquer ; orange au clic +
**stade**.

**Anti-flood « mot inconnu » (07/2026)** : le Wiktionnaire (kaikki, CC BY-SA) ajoute 46 018 mots FR
absents de Lexique (noms/adj/adv rares, garde edit-1 vs mots fréquents pour ne masquer aucun typo) →
**flood UD −56 %** (406→180 mots inconnus, le reste = latin/anglais/propre, correctement orange) ;
**recall dys sûr** (les mots récupérés sont de vrais mots, 0 typo masqué). Verbes rares rejetés (taille).
[À sa date, le bloc `speller-lex-gz` faisait **211 491 formes** = Lexique 4 low-freq + Wiktionnaire FR
`dictee/wikt_lex_fr.tsv` (`build_speller_lex.py` MINFREQ=0 + `inject_speller.py`) ; au 03/09/2026 il en
fait 705 653 après les 3 lots Morphalou #641-#643.]

**Genre déterminant, route Wiktionnaire** : **+21 847 noms Wiktionnaire pur-nom genrés** fusionnés dans
`gn`+`noun-post` par `build_wikt_gender.py`, FP=0 mesuré 41 FP/UD inchangé, produit vérifié
(« le babiche→la »).

---

## 2026-07-12 — rattrapage journal : correcteur mûri + le correcteur PARTOUT (PR #82-#143)

> Entrée de consolidation : le journal s'était arrêté au 03/07 (PR #66) alors que ~55 PR ont livré depuis. Détail fin = mémoires de session + pages de PR ; résumé par thème ci-dessous. **FP=0 tenu partout** (garde CI `fp_scale_probe` UD 2500, plafond 3 %, courant ~1,9 %). Parité 3 moteurs (Python ⊆ app ⊆ extension) maintenue, `dev.sh` 34/34.

- **Accord sujet-verbe à la racine** (#82-86, #123-125, #127) : classe « je veut / tu finit » réparée à la SOURCE (défaut Lexique 8_Nombre) ; présent je/tu + il/elle/on + ils/elles complété ; validé LEFFF (99,77→99,99 %). Conditionnel + subjonctif présent + **futur en ROUGE FP=0** ; passé simple → **orange** (formes pures) ; garde distributive « aucun/chacun de + pluriel ».
- **Participe passé / COD / homophones grammaticaux** (#89-90, #100-101, #104-105, #117, #120-121, #129-130, #139, #141) : COD antéposé « que » (→ accord) ; quel/quelle ; met→mais (2 sens) ; sa→ça ; **du→dû** (avoir+inf) ; **ou/où** (orange) + **sur/sûr** + **la/là** (rouge FP=0) ; accord dét↔nom (« la boites »→orange) ; être 3pl (« sont arrivé »→orange) ; PP être en -u ; sujet coordonné (« Luc et Samuel sont parti »→partis) ; **dont→invariable** (« parlées »→parlé) ; **COD sur noms verbe-homographes** (« la pomme que j'ai mangé »→mangée).
- **Speller / audibilité / lexique** (#91-92, #103, #107, #112, #114-115, #119, #131-132, #134) : banc FP speller à l'échelle (2500 UD) ; artefacts d'accent vétés (trés→très) ; **participe après auxiliaire** (grammaire-informe-speller, FP=0) ; élision reste-commun ; liste blanche mot-valide ; **ligature œ** (soeur→sœur) + genre œ ; complétude genre par lemme (+147) ; **audibilité : la finale /e/ écrite (é) bat la fréquence** (pièges cassés) ; **Wiktionnaire** — anti-flood « mot inconnu » −56 % + 21 847 noms genrés (fusion FP=0) ; audibilité finale muette (accor→accord).
- **Nouvelles catégories** (#106, #109-111) : orange accord SV mid-phrase (doctrine doute→orange) ; répétition de mot (« le le ») ; espacement FR (« bonjour,je ») ; trait d'union figé (« au dessus »→au-dessus).
- **Perf / robustesse** (#108, #136) : mémoïsation POS O(n²)→O(n) (longs textes) ; **vdc-lex gzip async, app 13→9 Mo** (−3,93 Mo, chantier #30 clos).
- **UI correcteur** (#94-99, #116, #118, #122, #135, #137) : saisie éditable + carte d'action sur le corrigé ; fixes curseur (police dys, curseur violet visible sur correction, espace fantôme) ; zone de saisie contenteditable ; fusion majuscule/accent + span:2 ; **nav ◂▸ + compteur sûres/à-vérifier** (+ surlignage dans la saisie, plafond anti-gel 20 000 car.) ; **« 💡 Pourquoi ? »** (règle expliquée par correction) ; la majuscule n'attaque plus les TLD (net→Net).
- **Extension — le correcteur PARTOUT** (#138, #142-143) : barre visible dans les éditeurs riches Slate/Draft/ProseMirror (**chat Twitch/Discord**) via MutationObserver+keyup ; **aide-frappe** applicable (#142) puis **AFFICHÉE** (#143) en contenteditable — mapping `caretOf`→offset `ceCollect` (mêmes coords que `getText`/`ceReplace`) ; **version 0.2.2→0.2.3** (figée depuis #138 → discipline : bumper à chaque PR extension). Zip régénéré, en ligne, **vérifié end-to-end dans Chrome** (affiche + applique en contenteditable).
- **Théorie / doc** (#87-88, #102, #133) : easter egg → **géométrie de l'arbitrage** (`arbitrage.html`) ; retrait Konami + nettoyage de références internes ; la même loi noisy-channel gouverne pendu (OS) + dictée (p2g) + correcteur ; phon_key — ne pas swap vers IPA fidèle (mesuré-réfuté).
- **➡️ PROCHAIN (décidé 13/07)** : **arbitrage speller×grammaire pondéré par l'AUDIBILITÉ** contre le gate de dominance fréquentielle. Le banc `scratchpad/joint_bench.js` (#39) a mesuré : le rerank joint **naïf ÉGALE** le hand-tuné, ne le bat pas ; le levier **non-testé** = l'audible bat le fréquent (ex. manjé→mangé, car le -é final est audible). Mesurer (banc + FP=0 UD 2500 + parité) **avant** de shipper. Puis dictée (classée bonne, ne pas recalibrer).

---

## 2026-07-03 — audit complet contre-vérifié + campagne de correctifs (PR #50-#66)

- **Audit multi-agents** (8 sous-systèmes, contre-vérification adversariale) : 78 constats → **47 confirmés + 26 mineurs, 0 réfuté**. Verdict : le moteur était sous cloche (CI), la **couche de livraison** ne l'était pas.
- **Correcteur — application par CONFIANCE** (PR #50-#55) : le texte source n'est plus jamais réécrit (overlay de surlignage SUR la saisie, corrigé dans un encadré séparé) ; sûr (FP=0) + candidats ortho (~79 % mesuré sur dys réel) appliqués par défaut, chaque mot = bascule annuler/réappliquer ; orange au clic. Leçon : « FP=0 sur texte parfait » = seuil pour toucher EN SILENCE, pas pour toucher — la réversibilité achète l'agressivité.
- **Qualité des remplacements** (PR #56-#57, verrous CI) : « dehor »→dehors (lettre finale muette, FP=0/2 500 UD) ; garde de dominance ×20 (fini « tres »→« trés », « jamai »→« jamal ») ; ancre de genre = vrai mot (fini « chere »→« cher ») ; majuscule préservée (« Ecole »→« École »).
- **Apostrophe typographique ’** (PR #58) : normalisée 1:1 dans les 3 moteurs — les claviers mobiles ne fabriquent plus de fausses fautes.
- **Pédagogie** (PR #61) : gouverneur élidé (« l'automne » ≠ « les » d'une autre proposition), -ons nominal (« maisons » n'est plus un verbe), syllabation V.CV alignée (a-mi), stade agrégé PAR SESSION.
- **Livraison** (PR #63-#65) : zip extension régénéré (53 commits de retard) + garde CI de fraîcheur ; sw.js sondé en CI ; précache reshape → hors-ligne réel sur Cloudflare (308) ; POS-tagger enfin chargé dans l'extension ; contenteditable non destructif ; « tout corriger » sans vigilance.
- **OMEGA·KEY v0.19** (PR #62) : interop clé générée↔importée réparée, graine du pair validée (anti-XSS), zéro requête externe. test_crypto 37/37.
- **Licence** : la base Lexique est **CC BY-SA 4.0** (dépôt officiel OpenLexicon, LICENSE-CC-BY-SA4.0.txt) — la LICENSE racine disait BY-NC à tort, corrigée.
- FP-échelle courant : **2,04 %** (plafond CI 3 %). Détail de l'audit : `data_local/audit_omega_2026-07-03.json` (local).


## 2026-06-24 (suite 10) — boucle : seuil de variété, lisibilité UI, audit macro

- **Variété dans `pick()`** (anti-démotivation) : tirage PONDÉRÉ sur `DysProfile.ranked()` (plusieurs faiblesses, pas
  que la #1), 55 % ciblé / 45 % libre, anti-répétition (jamais 3× la même famille de suite). Mesuré 2000 tirages :
  46 % libre, ciblage réparti, max 2 consécutifs.
- **Lisibilité (récurrent, mémorisé)** : fini le texte/couleur pâle sur le crème des panneaux dys.
  - `.vdc/.vdd/.vdk-sc` gris #6b6b6b → **#444** (+ override sombre #b4bdc7).
  - Chips de complétion correcteur : toutes violet plein lisibles (1re marquée par liseré, pas par contraste).
  - **Cause racine trouvée** : le `<style>` global fuit du clair — `h2{color:var(--fg)}` et `button:not(.btn){}`
    (spécif. 0,1,1) battent une classe nue → titres + chips clairs. Fix = **scoper sous l'ID de carte**
    (`#vdc-card .vdc-comp`, `#vdc-card h2{color:#222}`) + override thème sombre. Mémo `dys-ui-contrast`.
- **Audit macro** (rien de cassé ; git propre, dev.sh 26/26, pas de TODO/debug, `complete()` identique app/ext) :
  - chips extension alignées sur l'app (violet plein) ;
  - **doublon de profil retiré** : l'ancien encart `vdd-prof` (comptes + argmax) supprimé, le `vdd-uprof` unifié
    (taux + cible + sparkline) le remplace (évite deux « on travaille » contradictoires) ; `PROF`/`renderProf`
    legacy laissés inertes (dette mineure, lignes denses).
  - `evo/saisie_oracle.js` = labo/mesure orphelin assumé (n-gram/sublexical/autocomplete non portés en prod).

## 2026-06-24 (suite 9) — boucle d'apprentissage : PROFIL DYS UNIFIÉ (dictée + correcteur) + courbe de progrès

Suite à l'extrapolation (le pendu n'entre PAS dans la boucle famille-dys : deviner des lettres ≠ écrire, et il joue
sans accents → erreur de catégorie ; il ne contribue que par ses **données** lexique). Construit la vraie boucle,
**app-only** (localStorage ≠ extension, contrainte sandbox assumée) :
- **Module `window.DysProfile`** (nouveau `<script>` partagé) : `dys_profile_v3`. Source-aware — DICTÉE = pratique
  supervisée → **att/err → taux par famille** (gold) ; CORRECTEUR = erreurs de rédaction réelles → tally `cerr`
  (priorité, PAS un dénominateur, sinon taux faussé à ~100 %). `weakest()` = taux mesuré prioritaire, le correcteur
  ne domine qu'avec beaucoup d'erreurs. `spark()` = taux par buckets dans le temps (courbe de progrès).
- **Dictée** : `check()` alimente le profil (att par trap testée, err par famille) ; `pick()` cible désormais la
  famille faible **unifiée** ; nouvel encart **📈 Profil dys unifié** (taux % + sparkline + ↓progrès + rédaction ×N).
- **Correcteur** : `applyFix`/`applyAutos` enregistrent l'erreur confirmée (famille via `_corrFam`, accent détecté
  par déacc-égalité). HORS PARITÉ (pas un flag).
- **Piège corrigé** (prévu par l'extrapolation) : le correcteur ne loggue que des erreurs → l'inclure dans le taux
  donnait « 88 % » faux. Résolu : taux = dictée seule, correcteur = tally séparé.
- **Bugs harnais réglés** : `renderUProf()` appelé à l'init référait `window.DysProfile` (nu) → ReferenceError dans
  parity_corr.js (window bouchonné) et le bake (pas de window). Fix = **alias local null-safe** `var DysProfile=
  (typeof window!=='undefined'&&window.DysProfile)||null;` dans chaque IIFE + toutes les gardes via l'alias.
- Vérifs : logique testée (A/B/C : taux prime / beaucoup d'erreurs réd. priment / progrès récent<global) ; `dev.sh`
  **26/26** (parité app↔Py + bake verts).

## 2026-06-24 (suite 8) — aide-frappe FONDUE dans le correcteur (app + extension), panneau ✍️ retiré

Demande de Rem : l'aide-frappe dans le correcteur ET l'extension, pas un panneau séparé. Étude de faisabilité :
le correcteur (app `vdc` + extension `content.js`) EST déjà une aide-frappe temps-réel avec accents (même speller
`SP.D2A`/`PHON`, `sEdits1` avec transposition, AUTO silencieux + barre/flags cliquables). La correction faisait
donc DOUBLON. Seul manquait le **neuf** = la **COMPLÉTION prédictive**.
- **Retiré** l'IIFE `vdo` (panneau ✍️ séparé) de l'app.
- **Ajouté `complete(prefix)`** (préfixe → mots plus longs, trié fréquence, **accentué nativement** car `SP.D2A`
  l'est) aux DEUX moteurs : app correcteur (`vdc-complete`, chips, **Tab** accepte la 1re) et extension
  (`dys-core.js` → `DYSCORE.complete` ; section violette dans la barre flottante, clic insère ; pas de hijack Tab
  sur sites tiers — seule différence app/ext, par prudence).
- **HORS PARITÉ** : une complétion n'est PAS un flag FP=0 → ne touche pas `flags-ext ⊆ flags-Python`. Vérifié :
  `dev.sh` **26/26** (parité app↔Py et ext↔Py vertes). Test fonctionnel ext : caf→café, ecol→école,
  telep→téléphone, franc→français, recev→recevoir.
- n-gram + sublexical OOV restent app-only (besoin moteur), non portés (marginaux). evo/saisie_oracle.js conservé
  (labo/mesure).

## 2026-06-24 (suite 7) — aide-frappe : RESTAURATION D'ACCENTS (solution embarquée speller)

Bug remonté par Rem : les suggestions sortaient SANS accents. Cause = `OMEGA_LEX4.m` est **déaccentué MAJUSCULE**
(« CAFE », « ECOLE », « TELEPHONE » — le pendu joue sans accents). Solution embarquée = l'asset `speller-lex-gz`
(lexique du correcteur orthographique) qui porte les formes **accentuées + fréquence**.
- L'IIFE `vdo` décompresse le **MÊME bloc DOM** indépendamment du correcteur (zéro adjacence) et bâtit `ACC`
  déacc→accentué (forme la plus fréquente ; gère œ/æ). Appliqué à l'affichage ET à l'insertion (chips, Tab).
- Vérifié sur l'asset réel (87 082 entrées) : cafe→café, ecole→école, telephone→téléphone, francais→français,
  etre→être, probleme→problème… Chargé async à l'ouverture, re-render dès prêt (repli déacc si indispo).
- Fixes UI antérieurs même jour : bouton invisible (garde `OMEGA_LEX4` au parse async → retirée, charge paresseuse) ;
  lisibilité (thème sombre app déteignait → couleurs explicites `!important`, `-webkit-text-fill-color`).
- `dev.sh` 26/26 vert · charge headless OK.

## 2026-06-24 (suite 6) — oracle CÂBLÉ dans l'UI : panneau « ✍️ Aide-frappe » (app)

Port de `evo/saisie_oracle.js` dans `app/omega-pendu.html` comme **IIFE isolé `vdo-*`** (calqué sur le panneau
Décompose `vdk` : SCRIPT SÉPARÉ, zéro adjacence avec le correcteur ; R66 OFF-default = inerte tant que le bouton
n'est pas cliqué). Bouton flottant à `bottom:158px` (sous Décompose).
- **Temps réel** : pour le mot sous le curseur → **correction** de typo (chips, Tab accepte la 1re) + **complétions**
  préfixe (cohorte triée fréquence). Double voie arbitrée : lexicale (cohorte phon∪edit-1, distance Damerau →
  anagramme → freq+n-gram) et sublexicale (n-gram moteur, OOV).
- **Réutilise** OMEGA_LEX4 (155k, indices F/D2A/PHON bâtis 1× au 1er ouvrir) + `_neoNG` via `_neoEnsureNG` (scorer
  interne, backoff tri→bi→uni) — §5/A2, pas de réinvention. Ne touche jamais le correcteur ni la baseline moteur.
- **Vérifs** : (1) charge headless sans erreur (`fitness_harness.loadEngine`) ; (2) logique = port fidèle du evo
  validé 85 % ; (3) glu DOM unit-testée 7/7 (frontière de mot, curseur intra-mot, majuscule préservée, accents) ;
  (4) `dev.sh` **26/26 vert**. Smoke-test navigateur non fait (preview MCP bloqué : `launch.json` doit vivre dans
  `C:\Program Files\Git` en lecture seule) — à confirmer en ouvrant l'app et le bouton ✍️.
- Extension : non câblée (paradigme content-script ≠ overlay app) — suite éventuelle.

## 2026-06-24 (suite 5) — oracle : stats bi/trigramme DANS la voie lexicale (départage les candidats)

Jusqu'ici les n-grammes ne servaient qu'aux voies cognitives (sublexicale, autocomplete). Branchés aussi sur le
**cheval de bataille lexical** : le tri des candidats devient `distance → anagramme → CUE` où `CUE = log(freq) +
0.6·n-gramme` (score `__sx` du moteur, backoff tri→bi→uni) au lieu de la **freq seule**. Le n-gramme tranche entre
deux candidats que la fréquence confond (plausibilité orthographique).
- **A/B mesuré** (n=442, `ORACLE_NONG=1` = baseline freq seule) : freq seule **84 %** (lex 370/422) → freq+n-gramme
  **85 %** (lex **374/422**). +4 cas, +1 pp. `qiu→qui`, `ortografe→orthographe` toujours bons.
- Itératif gauche→droite sur l'autocomplete TESTÉ puis **rejeté** : greedy propage les erreurs (32 % < 34 % du
  gap-aware à voisins confirmés). Gardé : voisin gauche RÉVÉLÉ (robuste).
Les n-grammes du moteur servent désormais les 3 voies (lexicale, sublexicale, autocomplete). FP-safe (evo/ isolé).

## 2026-06-24 (suite 4) — oracle saisie : voie sublexicale = n-gram MOTEUR + route AUTOCOMPLETE gap-aware

Deux raccordements de `evo/saisie_oracle.js` au moteur (§5/A2 : réutiliser, pas réinventer) :
- **Voie sublexicale = n-gram du MOTEUR** (`_neoNG` via `_neoEnsureNG`, bâti du lexique 155k — la table de l'OOV
  du pendu) au lieu d'une trigramme maison ; scorer engine-side `__sx` (backoff tri→bi→uni). Voie sublexicale
  seule (≈ OOV) = **21 %** (bas, attendu ; seule voie quand la lexicale rend 0).
- **Route AUTOCOMPLETE / gap-fill** : `predictWord(L,rev)` réplique par-position la logique **gap-aware** de
  `_neoLetterNgramDist` (voisin RÉVÉLÉ le plus proche à distance 1..MAXD via `Ld/Rd`/`_neoEnsureNGgap` ; tri-joint
  si 2 adjacents, sinon produit des marginales, backoff uni). Mesuré (1 position /3 révélée, trous distance 1-2) :
  **lettres-trou 34 %** (≫ hasard 4 %), mot exact 1 % — bas car board ultra-clairsemé (régime cognitif pur). Voie
  du NOVEL ; la lexicale (cohorte préfixe top-3 89 %) reste le cheval de bataille in-lexique.
Bilan oracle : double voie arbitrée, les DEUX voies branchées sur le moteur. Câblage UI = suite.

## 2026-06-24 (suite 3) — étape 3 : ORACLE DE SAISIE bâti (double voie arbitrée) — evo/saisie_oracle.js

Le pendu comme oracle de saisie/typo = la **DOUBLE VOIE arbitrée** d'OMEGA appliquée à la frappe (Leçon 79 du mémoire :
la force vient de l'ENSEMBLE, pas d'une voie isolée). Réutilise `OMEGA_LEX4` (155k + phon `.p`) — §5, pas de réinvention.
- **Voie LEXICALE** (in-lexique) : cohorte (clé phon ∪ edit-1), classée **DISTANCE Damerau → anagramme → fréquence**.
  Mesuré **~84 % top-1** sur typos variés ; `qiu→qui`, `ortografe→orthographe`, `recevior→recevoir`, `teléfone→téléphone`,
  `maintnant→maintenant`. (Damerau = transposition à dist 1 ; anagramme départage `qiu`→qui pas qu.)
- **Voie SUBLEXICALE** (OOV) : trigrammes de caractères appris du même lexique (la voie qui généralise hors-lexique).
  Faible seule mais **SEULE voie sur l'OOV** (la lexicale y rend 0) — d'où la double voie.
- **ARBITRAGE par fiabilité** (distance≤2 ∨ même clé phon, ∧ candidat dominant) : lexicale si confiante, sinon sublexicale —
  bascule auto par régime, comme l'OS du moteur (`M_NEO_OS_ARB`). Swap futur : `_neoLetterNgramDist` gap-aware (déjà OFF-inerte).
- **Progression mesurée** (= preuve de l'ensemble) : anagramme-freq 11 % → phon 44 % → +edit 78 % → +distance/Damerau **84-87 %**.
- Nouveau module `evo/` (zéro impact sur le correcteur 3-moteurs). Câblage UI (aide-frappe / suggestion typo dys) = suite.

## 2026-06-24 (suite 2) — speller : multi-édit phonétique silencieux (ortografe→orthographe), 3 moteurs

Fautes de frappe (étape 2). **Speller déjà bon** (FP=0, accent/transposition/omission/doublement/adjacent/phon).
- **Multi-édit livré** : garde-longueur de `_cands` (phonétique) passée de **Δ≤1 à Δ≤2 + MÊME initiale** → laisse passer
  le multi-édit à lettres silencieuses (clé phon identique mais +2 lettres : `ortografe→orthographe` th/ph, `simfonie→symphonie`,
  `teatre→théâtre`) ; bloque toujours `trist→tristesse` (Δ4) et `autent→hautaine` (initiale a≠h). **GEC FP=0** ;
  **UD 240→231** (la garde initiale retire même des FP préexistants). 3 moteurs, parité verte, dev.sh 26/26.
- **Désambiguïsation mot-court par fréquence : FALSIFIÉ** (testé, reverté) : `qiu` a ≥2 mots réels à edit-1 → soit
  sur-flague le junk (von→vont, two→to : +19 FP UD), soit abstient (= actuel). L'abstention du speller est *juste* ;
  les mots courts ambigus + la queue typo = **bornés par le CONTEXTE** → étape 3 (pendu-oracle).

## 2026-06-24 (suite) — BESCHERELLE livré (paradigmes complets) + élision durcie → FP UD 2,18 → 2,17 %

« Durcir d'abord » (Rem) : le Bescherelle ajoute du rappel SANS monter le FP. Pipeline reproductible
(`build_cgram` → `inject_vdc.py` (NOUVEAU) → `build_assets`), parité 3 moteurs, batterie FP=0.
- **BESCHERELLE livré** : table de conjugaison construite pour TOUTES les formes (découplée de `FREQ_MIN`) →
  « Ils **détestons** »→détestent, « réunissons »→réunissent (formes 1pl rares auparavant absentes). **Durci** :
  (a) seul **indicatif PRÉSENT + IMPARFAIT** (exclut passé simple/futur/subj/cnd → tue « tentèrent/fut/appris→apprit »)
  (b) **participes exclus** de la reconnaissance (déployé/donnés = participe/adj, pas verbe SV)
  (c) `CONJ_STOP={entre,contre}` (prépositions homographes de verbes rares). **Effet net : SV FP 25→22** (MIEUX que
  baseline). Coût : app vdc-lex 1,55→1,84 Mo (+288 Ko) ; `cgram_conj.json` 0,65→2,03 Mo (Python, non embarqué).
  `inject_vdc.py` = injecteur app←cgram_hf (le bloc vdc-lex était maintenu à la main).
- **ÉLISION durcie** : les 5 FP UD (`N'Dour`/`M'Tioua`/`N'Zalat` noms propres + `rock n'roll` + `m'sieur`) tués par
  garde **« pas de de-élision devant MAJUSCULE »** (nom propre) + stoplist `{n'roll, m'sieur}`. **élision FP : 5→0.**
- **RÉSULTAT : FP UD 2,18 % → 2,17 %** (355/16342) — Bescherelle + élision AJOUTENT du rappel ET BAISSENT le FP.
  Résiduel SV inchangé = « Les Andalouses est »→sont (nom propre pluriel-apparent, pré-existant).

## 2026-06-24 — ÉLISION FP-safe (j'sais→je sais, 3 moteurs) + cadrage du BESCHERELLE (conjugaison)

Mesure §1 : sur **26 fautes GEC réelles**, les règles n'en attrapent que **5** (4 genre + 1 MAUVAISE « monde→mondes »). Ratées = élision, conjugaison (personne), nombre, ordre des mots, mot manquant, accord adjectif. Les FP-safe faisables :
- **ÉLISION livrée (3 moteurs)** : `rule_elide`/`rElide` — clitique élidé devant CONSONNE = toujours faute → **FP=0 STRUCTUREL** → de-élide. Clitiques DÉTERMINISTES `j'/n'/m'/d'/c'/qu'` (→ je/ne/me/de/ce/que) ⇒ **parité triviale (aucun lexique)**. EXCLUS : `t'/s'` (te/tu, se/si ambigus), `l'` (le/la = genre, différé), `h` (« l'homme » muet → élision correcte), `y` (« j'y »). Mesuré : prend `j'sais→je sais`, `n'sait→ne`, `m'détestons→me`, `qu'tu→que tu` ; **FP=0 sur 10 contrôles** (« l'homme »/« l'eau »/« j'y »/« d'abord »). Ajouté à `--check` (CI) + batteries parité. **dev.sh 26/26**.
- **BESCHERELLE (cadré, non livré — décision produit)** : « Ils détestons »→détestent raté car la **FORME** « détestons » (1pl) manque de la table HF (8018 formes ≈ freq≥1) bien que le lemme `détester` y soit (déteste/détestent). Compléter les paradigmes (Lexique4 = **87 497 formes VER** ; freq≥0.5 = 11 754) catcherait ces accords de personne — au **COÛT d'embarquement** (table conj. ×1.5 à ×3 dans `vdc-lex`). En attente d'arbitrage taille-monolithe. (1re/2e pers. nombre + nous/vous = abstentions de design, anti-FP.)
- Hors-portée (contexte/LLM, cf. suite 3) : ordre des mots, mot manquant, accord adjectif.

## 2026-06-23 (suite 3) — point (c) : plafond du correcteur-CONTEXTE (LLM = Claude) mesuré À L'AVEUGLE

Le LLM opt-in (déjà câblé : cloud / Chrome Nano) est la seule voie pour les limites de CONTEXTE (et/est, ce/se, accord SV à sujet nom, avoir↔être, + tout le hors-périmètre). Mesuré **directement (je suis le modèle)** sur du RÉEL non fabriqué (corpus GEC), protocole **aveugle** (corrigé sans voir le gold, tally par script) :
- **Rappel AVEUGLE : 11/12 exact** (GEC réel, rangs 15-26 par longueur). Le 12ᵉ : ma sortie est valide aussi (le gold ajoutait un « m' » objet optionnel = sous-correction, pas faute). (1er lot de 14, gold visible = plafond 14/14.)
- Ces fautes sont **massivement HORS-PÉRIMÈTRE des règles** : genre (« ma→mon », « le→la »), ordre des mots (« genres quels→quels genres », « étage deuxième→deuxième étage »), mot manquant (« nous **nous** réunissons », « n'avez **pas** saisi »), accord adjectif (« amicale→amical », « froide→froid »), élision (« j'/n'/l'/m' »), nombre (« le mobiles→le mobile »), expression (« s'il te plaît »). Le correcteur-RÈGLES n'en prendrait que ~1-2.
- **FP** : **0 sur-correction** sur le lot (je n'ai ajouté que des corrections réelles ; j'ai même SOUS-corrigé une fois plutôt que sur-corriger) — cohérent avec le plafond POSTIT « LLM ≈ rappel total, FP ≈ 1-2/30 » (bas mais non nul → pourquoi opt-in, pas le plancher FP=0).
- **Conclusion (architecture validée par la mesure)** : **règles = plancher FP=0 hors-ligne ; LLM = rappel-CONTEXTE, opt-in**. Le LLM récupère exactement ce que les règles abstiennent. Mesure de plafond — pas de câblage nouveau (le LLM est déjà opt-in dans l'app).

## 2026-06-23 (suite 2) — points (a)+(d) : garde rappel en CI + mesure genre (fausse alerte parité, corrigée dans l'entrée)

- **(d) garde anti-régression CI** : `recall_probe.py --check` (13 comportements déterministes du levier `j'est` être/avoir + contrôles FP, exit 1 si régression), câblé dans `dev.sh` (**26 checks**) + `ci.yml`.
- **(a) familles d'ACCORD au harnais** : genre déterminant (un/une, le/la) ajouté à `recall_probe` (swap propre). Rappel genre : **propre 65-67 %, GEC 52 %**.
- ⚠️ **FAUSSE ALERTE PARITÉ — corrigée par vérif data (§6)** : `recall_probe.js` affichait « app 51-53 % < extension 56 % » sur le genre, j'en avais conclu (à tort) que l'app n'embarquait pas le genre-relâché. **FAUX** : les 3 sources sont **IDENTIQUES — 46 432 entrées** : bloc app `gdet-lex-gz` = extension `gender-relaxed.tsv.gz` = python `cgram_gender_relaxed.json` (et `build_assets.py` EXTRAIT l'asset extension **du** bloc app). L'app a bien son loader `loadGenderLex` (l.11742). → **les 3 versions SONT au même point sur le genre** à l'exécution. L'écart = **artefact du harnais** : `recall_probe.js` n'extrait l'IIFE que jusqu'à `correctText` (l.11700), donc le `loadGenderLex` **async** (déclenché au clic) ne tourne pas → l'app y est mesurée avec le `gn` HF seul. **Rappel genre RÉEL de l'app = celui de l'extension (56 %). AUCUN fix data (la donnée y est déjà).** Caveat documenté dans `recall_probe.js`. Leçon : mesurer le bon objet avant de conclure (la vérif data a évité un embedding inutile du monolithe).
- Reste : pluriel nom + accord SV = transformation morpho (pas un swap) → injecteur dédié à faire. (b) DATA / (c) LLM-Nano = egress / opt-in navigateur (hors local).

## 2026-06-23 (suite) — être/avoir : « j'est » + adjectif → « je suis » (3 moteurs, parité stricte)

Cible Rem : confusions être/avoir (règles + ressemblance phonétique `/ʒe/~/ʒɛ/`) avec **app pendu ≡ extension**.
- **Mesuré d'abord** (recall_probe + familles être/avoir `j'ai/j'est`, `a/as`, `est/es`) : la **parité app≡extension est déjà tenue** (APP==EXT sur toutes les familles). Les ratés être/avoir sont **100 % à sujet NOM** (« La fillette as », « Sami es ») = mur SV distant déféré (pas FP-safe), PAS un trou lexical → le Lexique4 plus riche n'y change rien.
- **Levier propre livré** : `rule_jest`/`rJest` étendue — `j'est` (jamais valide → **FP=0 STRUCTUREL**, la règle ne se déclenche que sur `j'est`). Listes **CLOSES identiques dans les 3 moteurs** (parité stricte, pas de divergence de lexique HF) : **adjectif prédicatif pur** `CADJ` (content/malade/triste…) OU **participe de verbe d'ÊTRE** `ETRE_PP` (allé/venu/parti/arrivé/devenu/revenu) → « je suis » ; **partitif** (`du`/`des`, ou `de`+article) → « j'ai » (« j'ai de la peine » — couvre le cas Rem « j'est de le peine ») ; déterminant/été/eu → « j'ai ». Participe d'AVOIR (« j'est entendu ») ou `de`+nom propre (« j'est de Paris ») = auxiliaire ambigu → abstention.
- **Validé** : `j'est content/allé/venu`→`je suis`, `j'est de le peine / du mal / des soucis`→`j'ai`, `j'est un chien`→`j'ai`, `j'est de Paris / entendu`→abstention, FP control vide ; **`dev.sh` 25/25** (parity_corr + parity_core verts, cas `j'est` ajoutés aux batteries = 3 moteurs d'accord). Reste hors-portée (limite) : `j'est <participe avoir>` = sélection d'auxiliaire (contexte), et l'accord SV à sujet NOM.

## 2026-06-23 — RAPPEL mesuré à l'échelle (harnais recall_probe) + 2 falsifications (§6)

Mesure du **rappel** (faux négatif), sous-chiffré jusqu'ici (témoins curés ~90 % = trompeurs). Nouvel outillage **lecture seule** (R67) : `recall_probe.py` (injection contrôlée d'homophones dans des phrases CORRECTES, ventilé par famille ET par source) + `recall_probe.js` (rejeu du même corpus dans les 2 moteurs JS — app pendu / extension), réutilise `correcteur_probe.correct` + `diag_sentence` (§5).
- **Rappel réf. Python — corpus PROPRE (dys court, filtré URLs/longueur) : 56 %** (19/34) vs **GEC encyclopédique 27 %** (21/79) → le domaine compte ×2 ; les témoins sur-estimaient. Par famille (propre) : on/ont & leur/leurs **100 %** · a/à 67 % · son/sont & peu/peux 50 % · **ce/se 33 %, et/est 0 % = ABSTENTION par design (limite contexte, FP-safe), pas un bug**. Rappel sur erreurs RÉELLES (`eval_gec` in-scope) = 50 %, dominé genre/SV.
- **2 versions ≈ à parité** (rejeu : app 27 % / ext 27 % / Python 29 %) : écart HF↔complet minuscule (on/ont 100→88, a/à 32→29). L'app embarque `OMEGA_LEX4` 155k mais son rappel homophone = celui de l'extension HF → **la grosse table n'est PAS utilisée par les règles d'homophones** (seulement par les gardes genre/pluriel).
- **FALSIFIÉ A** : régénérer `cgram_noun_post.json` depuis Lexique4 complet = **identique** (61 453 = 61 453) → asset déjà pleine-couverture, régénérer n'apporte rien.
- **FALSIFIÉ B** (levier posterior 155k/Lexique4 pour `son/sont`) : inspection des 8 ratés → sujet pluriel **DISTANT** (mur FP de l'accord SV déjà déféré) ou ratés synthétiques illusoires (tronqués/URLs), **pas** un trou de couverture. Le Lexique4 plus riche (InfoVER/FreqMot par lecture) ne débloque PAS `son/sont` FP-safe — goulot = contexte/structure, pas lexique. **Ne pas construire** (= grinder une limite connue).
- FP UD inchangé (**2,18 %**, ventilé : a/à 92 · -é/-er 53 · on/ont 52 · genre 42 · son/sont 38…). `Lexique4.tsv.xz` fourni en local, **hors-repo** (`.gitignore`). Outillage local : Python 3.13 + Node 24 ; `dev.sh` rendu portable Windows (PYTHONUTF8 + bake temp portable), **25/25 local & CI**.

## 2026-06-22 — FP homophones : on/ont −27 (suivant décisif) + a/à −5 (garde posterior) — 3 moteurs

Enchaînement auto sur les 2 plus gros postes de FP. **Échantillonné les vrais FP sur UD** pour trouver le pattern :
- **on/ont (79 FP)** : « professeurs **on** trouve », « comme **on** dit » → la garde `is_plural_noun(prev)` tirait « ont »
  alors que le mot **suivant** est un verbe fini présent. FIX (1 ligne, en TÊTE) : suivant = verbe fini en **-e** (trouve/
  mange, jamais un PP) → « on » décisif. Mesuré : **79→52 (−27), 0 nouveau FP, recall intact**. (Tentative plus large —
  retirer `IRREG_PART` du test PP — REJETÉE : +36 FP, casse « ont pu/eu/fait ». La forme ambiguë « dit » reste un résiduel.)
- **a/à (97 FP, 90 = a→à)** : « l'entreprise **a** douze », « la voiture **a** quatre » → `vlike(prev)` tirait « à »
  sur des noms à homographe verbal. FIX : ne pas suggérer « à » si le mot avant « a » est un **NOM confiant** au posterior
  (`P(NOM)≥0.5 ∧ P(VER)<0.01`, NOUN_POST déjà chargé). Mesuré : **97→92 (−5), 0 nouveau FP, 0 perte recall** (va/pense/
  cherche a→à gardés). Garde *stricte* (ver<10) choisie pour ne pas rater « maison a vendre »→à.

3 moteurs (Python `_reads`/`NOUN_POST`, app/ext `svReads`/`NOUN_POST`), parité app≡Python≡extension, batterie dys FP=0.
**Total FP UD : 2.46%→2.18%** (cumulé avec pluriel/genre/§3 de la session). Le posterior sert maintenant 4 règles.

---

## 2026-06-22 — Accord SV sujet-nom : relâcher `dk==0` via le posterior — MESURÉ, REJETÉ (ne pas refaire)

Enchaînement auto suivant : `rule_accord_sv_noun` exige le déterminant pluriel **en tête** (`dk==0`). Hypothèse :
cette restriction venait du *manque de lexique de noms* → le posterior NOUN_POST pourrait la lever et récupérer les
cas en milieu de phrase (« Hier les oiseaux chante », « et les chats mange »). **Mesuré (sonde `/tmp`, UD French)** :
relâcher à `dk>0` (avec garde « aucun nom confiant avant le dét. » + nom-tête posterior) → **+18 FP** pour **2 patterns**
récupérés. FP dominants **non réparables par le posterior** : (a) « entre »→entrent ×8 (préposition lue comme verbe
entrer — c'est *précisément* ce que `dk==0` bloquait) ; (b) « est/était→sont » (le dét. pluriel gouverne un nom mais
le verbe s'accorde avec un sujet **singulier** à distance — indécidable sans parse). **Conclusion** : `dk==0` n'est PAS
un défaut de lexique, c'est une garde structurelle justifiée (homographes prép/verbe + sujet distant). NON câblé. La
sonde est jetable (non versionnée). **Bilan des 3 enchaînements §3** : pluriel ✅, genre ✅, accord SV sujet-nom ❌.

---

## 2026-06-22 — GARDE §3 ÉTENDUE au GENRE (FP 61→42, « le faute »→la) + pos-abstain SUPPRIMÉ

Enchaînement auto après le pluriel. Mesuré AVANT câblage (sonde inline) : la garde genre `POS≠NOM ∨ nbhomog>1`
(tag dur) devient le posterior `P(NOM)≥0.5 ∧ P(VER)<0.01` (variante **stricte** : OOV→abstient ; le « fallthrough »
testé = pire, +22 FP). **Strict mesuré : FP genre 71→49 standalone, 61→42 canonique (UD)** — un gain NET (moins de
FP) ET « le faute »→la récupéré (faute=VER au tag, 99,7 % NOM en freq). L'ambiguïté de GENRE (« tour » m+f) reste
couverte par `GENDER_PURE` (pas besoin de nbhomog). 3 moteurs : `rule_det_gender`/`rDetGenre` lisent `NOUN_POST`.

**Conséquence hygiène** : genre+pluriel utilisant tous deux le posterior, **tout l'appareil pos-abstain est MORT**
→ supprimé de l'extension : asset `pos-abstain.txt.gz` (237 Ko, shippé aux users), `POS_ABSTAIN`/loader/exports,
refs `build_assets`/`content`/`parity_core`/bundle. (App `posOf` + Python `pos_of`/`cgram_pos`/`build_pos` gardés :
`pos_of` sert encore à `pyramide_probe`.) Batterie dys **FP=0**, parité app≡Python≡extension, suite verte.

---

## 2026-06-22 — GARDE §3 du pluriel CÂBLÉE dans les 3 moteurs (posterior fréquentiel, fix POS inhérent)

Décision Rem : « fix POS PUIS garde §3 à ε=0.01 ». Fait, mesuré, 3 moteurs à parité.

**Asset canonique** `dictee/cgram_noun_post.json` (`build_noun_post.py` depuis le TSV) = `{forme : [nom‰, ver‰]}`,
posterior `P(POS|forme)=ΣFreqMot/ΣFreqMot` (61 453 formes nom‰≥300). La garde plate `nbhomog==0 ∧ POS==NOM`
(lue sur le tag DUR, **faux** pour faute=VER/amis=ADJ) devient **`P(NOM)≥0.5 ∧ P(VER)<0.01`** + ancre du pluriel
via le posterior (≥0.3). Le « fix POS » est **inhérent** : le posterior est strictement plus juste que le tag embarqué.

- **Python** (`correcteur_probe.py`) : `NOUN_POST` + `_noun_gate` + ancre posterior + stop latin (quanta…).
- **App** (`omega-pendu.html`) : bloc embarqué `noun-post-gz` (290 Ko b64) + `loadNounPost` (miroir `loadGenderLex`) +
  `rNounPlural` réécrit ; seed global `OMEGA_NOUN_POST` pour la parité (comme `OMEGA_LEX4`).
- **Extension** : `noun-post.txt.gz` (218 Ko, remplace `nom-nbhomog`) ; `dys-core` posterior ; `build_assets`/`content`/`parity_core` MAJ.

**Mesuré** : batterie dys **FP=0** ; **ami/voiture/faute récupérés**, « porte/livre/rouge/quanta » abstenus ;
parité app≡Python≡extension (0 écart pluriel) ; FP UD encyclopédique 22→26 (+4, marge anglicismes/composés, hors CI).
Genre **non** touché (resterait à mesurer séparément avant de l'étendre au posterior).

---

## 2026-06-22 — SONDE §3 « pyramide » : posterior fréquentiel > garde plate (récupère « des ami » FP-safe)

Idée de Rem : la dictée lit une *tranche plate* du lexique, le pendu empile les niveaux (pyramide). Audit du
lexique embarqué : **11 dims réelles** (`m p g f prev pld md mb l nbhomoph nbhomog`) ; OLD20/syll/cvo/cvp **déclarés
mais à 0 %** (`old` câblé à vide dans `lexLookup`, doc corrigé). TSV complet (37 col.) fourni → `/tmp/lex4`.

**Sonde `dictee/pyramide_probe.py` (OFF-inerte, mesure seule, ne touche ni moteur ni assets).** Remplace la garde
DURE du pluriel du nom (`nbhomog==0 ∧ POS==NOM ∧ ¬CONJ_F`, qui ratait ami/voiture/pomme/faute) par le **posterior §3**
`P(POS|forme)=ΣFreqMot(POS)/ΣFreqMot` (le `Σ_φ`, croiser ≠ argmax). Garde : tire ssi `P(NOM)≥τ ∧ P(VER)<ε`.

**Découverte clé : le POS embarqué est BUGGÉ** — `amis`→ADJ (posterior 85,5 % NOM), `pommes`/`faute`→VER (posterior
99,5/99,7 % NOM). Le posterior fréquentiel est **strictement plus juste**. ami/pomme étaient bloqués par l'ancre du
pluriel (qui vérifiait via `pos_of` embarqué faux) → ancrer le pluriel via le posterior aussi → récupérés.

**Mesuré (sweep ε, FP sur UD French 16 342 ph.)** : à **ε=0.01** → **+3 récupérations** (ami, voiture, faute) pour
**+1 seul FP** (`terre→terres` dans « terre-neuviers », artefact tiret). Rappel : la relaxation plate du matin
coûtait **+25 FP** et ne récupérait PAS ami. **La pyramide réussit là où la garde plate échouait.**

Sous-gain durable **FP-safe pur** (indépendant de la garde permissive) : **régénérer `cgram_pos` via le POS
fréquentiel-dominant** (corrige amis/pommes/faute) → aide genre + pluriel + toute règle POS-gardée, 0 FP nouveau.
⏳ Décision Rem : (a) câbler la garde §3 à ε=0.01 (asset posterior, 3 moteurs+parité) ? (b) d'abord juste régénérer
le POS ? (c) en rester à la sonde mesurée ? Lancer : `LEX4=/tmp/lex4/Lexique4.tsv UDFR=/tmp/udfr python3 dictee/pyramide_probe.py`.

---

## 2026-06-22 — Accord pluriel : PORTÉ dans l'extension (3 moteurs à parité) + relâche nbhomog mesurée-REJETÉE

Suite du levier pluriel. Deux demandes de Rem : (1) porter à l'extension, (2) récupérer « des ami »/« les faute ».

**(1) Extension — FAIT, parité exacte.** `dys-core` n'a pas `posOf` (que des SET/MAP dérivés). Nouvel asset
`nom-nbhomog.txt.gz` (163 Ko, 55 746 formes POS=NOM-dominantes → `form\tnbhomog`, généré par `build_assets.py`
depuis `cgram_pos.json` = MÊME source que l'app/Python). `rNounPlural` y lit : nom-pur = `NOM_MAP.get(dn)===0`
(≡ `posOf[0]=='NOM' ∧ nbhomog==0`), vérif pluriel = `NOM_MAP.has(cand)`, composé = `NOM_MAP.has(nx) ∧ !ADJP[nx]`.
**Parité `parity_core` : ext ⊆ Python, 0 écart** sur 63 phrases (11 pluriel ajoutées) → l'extension corrige le pluriel
**à l'identique** de l'app (enfant→enfants, oiseau→oiseaux, cheval→chevaux ; « il les porte »/« les rouge » abstenus).
Les **3 moteurs** ont maintenant le levier. `content.js` charge l'asset ; `parity_core` l'injecte.

**(2) Récupérer « des ami »/« les faute » — MESURÉ, REJETÉ.** Relâché le filtre `nbhomog==0` → `nbhomog<=1` (sauf
forme verbale `CONJ_F`, car l'homographe ADJ « ami »=nation amie pluralise pareil). Résultat : **FP 22→47**
(adj-homographes « les rouge »→rouges…) ET « des ami » **toujours raté** (« amis » est ADJ-dominant dans le lexique
→ échoue la vérif NOM du pluriel). Verdict : pas FP-safe, et la donnée ne le supporte pas. **Reverté**, note in-code.
« des ami »/« les faute »/« des pomme » restent **abstenus** (homographes verbe/adj) — limite FP-safe assumée.

État : accord pluriel du nom = **app + Python + extension**, parité exacte, FP-safe (22 « FP » UD dont ~18 vraies prises).

---

## 2026-06-22 — NOUVEAU LEVIER : accord PLURIEL du nom (« des ami »→amis), la faute dys n°1 — app + Python

Suite directe du test terrain. La classe manquante n°1 (« les enfant », « des difficulté ») est branchée :
`rule_noun_plural` / `rNounPlural`. **Déterminant pluriel** (les/des/ces/mes/tes/ses/nos/vos/leurs, classe fermée)
+ **nom singulier** → pluriel. Bornage FP-safe + **pluriel ancré dans le lexique** (§5, réutilise le 155k embarqué) :

- **filtre nom** = `POS==NOM ∧ nbhomog==0` (lexique 155k via `pos_of`/`posOf`) → exclut les **homographes** verbe/adj
  (« les **porte** »=verbe, « les **rouge** », « les **livre** ») ET le pronom « les » (« il les porte »). FP-safe.
- **pluralisation vérifiée** : on génère +s / −al→−aux / −au-eu→+x et on ne garde que la forme qui **existe comme NOM**
  dans le 155k → « oiseau→oiseaux », « cheval→chevaux », « journal→journaux », « festival→festivals » (pas « oiseaus » ;
  « bal→bals » car +s vérifié d'abord, pas « baux »). Toutes les formes plurielles (même irrégulières) sont dans le 155k.
- gardes FP : capitalisé (propre), déjà pluriel (−s/−x/−z), trop court (unité kg/cm : len<3), pluriels latins
  (`NOUN_PL_STOP` = minima/maxima/media/data…), **nom composé** (« hit parade », « vice président », « tour opérateur »
  = nom+nom → 1er invariable → abstention ; exception adj-nom « les département **français** » → corrigé).

**Mesuré UD French (16 342 phrases)** : règle = **22 « FP »**, dont **~18 sont de VRAIS accords ratés du corpus gold**
(« les fournisseur d'accès », « les conseil de », « ces robot l'ont »…) = bonnes prises ; ~4 vrais FP (anglicismes
mono/plug/single/people). **22 < genre 61 < on/ont 79 < a/à 97** : la règle est la plus précise. FP global **2,35→2,46 %**.
Batterie **FP 0/40**, recall pluriel **4/4** (4 cas ajoutés). **Parité app≡Python EXACTE** (`parity_corr` : harnais
charge désormais OMEGA_LEX4 pour exercer `posOf` ; 13 phrases pluriel ajoutées, 0 flag propre app).

**Limite honnête (FP-safe assumé)** : « des **ami** » (nbhomog=1), « les **faute** » (tagué VER), « des **pomme** »
(nbhomog=1) → **abstenus** (homographes). Récupérables plus tard avec une garde « forme-verbale-conjuguée » (cgram_conj).
**Extension = SUITE** : `dys-core` n'a pas `posOf` (que le SET pos-abstain) → la règle pluriel exige un asset noms-purs
dédié (à faire) ; `parity_core` reste vert (ext ⊆ Python = écart de couverture). Pour l'instant : **app oui, extension non**.

---

## 2026-06-22 — Test terrain (phrase dys réelle) : 1 bug réparé (élision speller), 1 levier mesuré-rejeté (−é/−er verbes)

Rem teste le panneau « 🩹 Correcteur » de l'app sur une phrase dys spontanée (« j'ai des ami qui sont partie à la
plage sent moi… des faute d'othographes parse que j'ai été coder »). Verdict : **« Aucune faute détectée »** — mauvais.
Diagnostic mot par mot (mesuré via `dictee/correcteur.js`, le moteur de l'app headless) :

| classe | exemples | statut |
|---|---|---|
| **accord pluriel du NOM** | des **ami**, des **difficulté**, les **faute** | ❌ règle **inexistante** (3/8) — c'est LE prochain levier |
| accord participe passé | sont **partie**→partis | ❌ hors-périmètre |
| homophone hors-liste | **sent**/sans, **parse**/parce | ❌ hors-périmètre (parse = vrai mot → exige contexte) |
| non-mot **élidé** | d'**othographes** | ⚠️ **BUG réparé** (voir ci-dessous) |
| −é/−er, verbe rare | a **coder**→codé | ⚠️ couverture verbe — **mesuré, pas réparable sans contexte** |

**(1) Élision speller — RÉPARÉ** (`054aa60`). `toks()` garde l'apostrophe → « d'othographes » = **1 token** jamais
ré-analysé. Fix : détacher le préfixe d'élision connu (d'/l'/j'/qu'… via `SELIDE`) et analyser le reste. Gardes
anti-faux-ami : (a) la correction doit **garder une voyelle/h initiale** (« l'aramel »→« caramel » casserait
l'élision → abstention ; trouvé sur UD), (b) hors AUTO, seule une correction **accent-seul ou distance ≤1** est
proposée (le phonétique distant « othographe→autographe », orthographe rare freq=41 vs autographe 1639, = faux ami →
abstention). Élisions correctes (l'orthographe, c'est) → reste connu → abstention. Mesuré **4000 phrases UD : 5 flags
élidés, tous de VRAIS typos** (l'extention→l'extension, l'economie→l'économie…). App + extension à parité (`test_speller` ≡).

**(2) −é/−er — élargir la couverture verbe : MESURÉ, REJETÉ.** « il a coder » échoue car « coder » n'est pas dans
`COMMON_VERBS`/`cgram_verbs`. Tenté de réutiliser le POS 155k (§5) : accepter forms[1] si **POS=VER**. Naïf → FP
**53→98** (« il est **fier** »→fié : être+adjectif). Borné à **AVOIR seul** (« avoir+adj » n'existe pas) → FP **98→74**,
toujours **+21** : « le **traité**/**marché**/**côté** » (nom) → infinitif. Verdict : comme a/à, la règle −é/−er exige
le **CONTEXTE** (nom vs participe), pas l'appartenance lexicale. **Reverté**, note in-code. Couverture verbe = liste curée.

**Leçon** : le correcteur a un **rappel étroit** par conception (FP=0 d'abord, liste de règles fixe). Sur de l'écrit dys
spontané, la faute n°1 — **l'accord pluriel du nom** — n'existe pas. C'est le **prochain levier** (a tout dans le lexique :
POS=NOM 155k + pluriels Lexique 4), à border FP-safe comme le genre + mesurer sur UD French.

---

## 2026-06-22 — POS-tagger 155k (réutilise le lexique du pendu) + lot 5 −é/−er : FP 2,74 % → 2,35 % sur UD French

Suite directe des 4 lots. Deux leviers FP-safe de plus, mesurés sur les **16 342 phrases correctes** (UD French) :
**FP 2,74 % → 2,35 %** (447 → **384/16342**). Toujours **abstention pure** (jamais de nouvelle correction).

**Lot 5 — −é/−er noms-homographes de participes** (`15a5b40`). Beaucoup de FP −é/−er sont des **noms** homographes
d'un participe (« un arrêt**é** », « un trait**é** », « un employ**é** », « le pass**é** ») : la règle voulait écrire
`-er`. Garde : si le mot est un **nom** connu (`cgram_gender`/`GENDER_LEX`) précédé d'un déterminant → abstention.
Tentative **a/à** (cgram + participes irréguliers) **REVERTÉE** : backfire mesuré (12 → 18 FP, cas « à été… »), gardé
seulement la garde « A » majuscule du lot 3. Effet : **−é/−er 90 → 53**.

**POS-tagger 155k extrait du lexique EMBARQUÉ** (`056a1db` fondation + `b64feb6` câblage 3 moteurs). §5 anti-
réinvention : le pendu embarque déjà `OMEGA_LEX4` (155 493 mots, champ `g` = cgram, `nbhomog`) — `build_pos.py`
en extrait `cgram_pos.json = {forme:[POS,freq,nbhomog]}` (réutilise le décodeur de `build_morpho.py`, **aucune
nouvelle dépendance**, gitignored car régénéré en CI). Branché en **garde du genre déterminant** (`rule_det_gender` /
`rDetGenre`) : on n'avait que la contrainte « nom-pur `gn` » ; on **abstient** désormais aussi si le mot après le
déterminant a **POS ≠ NOM** OU **nbhomog > 1** (homographe nom/verbe/adj : « la **droite** », « un **boucher** »).
Effet : **genre déterminant 91 → 61**.

**Parité 3 moteurs — exacte, par construction** (tous dérivent du MÊME lexique) :
| moteur | source POS | garde |
|---|---|---|
| `correcteur_probe.py` (réf) | `cgram_pos.json` | `pos_of()` : abstient si POS≠NOM ∨ nbhomog>1 |
| app `omega-pendu.html` | `OMEGA_LEX4` direct (index `posOf`) | `rDetGenre` idem |
| `extension/dys-core.js` | asset `pos-abstain.txt.gz` (237 Ko, SET des formes à abstenir) | `POS_ABSTAIN.has(nd)` |
| `correcteur.js` (headless) | décompresse `lex4-data-gz` → `OMEGA_LEX4` | (parité Python en CI) |

`build_assets.py` régénère l'asset `pos-abstain` depuis `cgram_pos.json` (formes POS≠NOM ∨ nbhomog>1). CI : étape
`build_pos.py` **avant** `build_assets.py`, puis `close_conj_paradigm --check` + parités.

**Garde-fous (re-mesurés ce jour)** : batterie **FP 0/36**, recall des familles **intact** (genre 4/4, on/ont 5/5,
son/sont 3/3, a/à 3/3, leur/leurs 3/3, −é/−er 3/3, accord SV 8/8+8/8), **parité app⊆Python OK** (1 écart de
couverture = lexique HF), **parité ext⊆Python OK** (0 écart). **CI verte** sur PR #9 (`b64feb6`, 2 jobs `dictee`).

| règle | après 4 lots | maintenant | levier |
|---|---|---|---|
| −é/−er | 90 | **53** | lot 5 : noms-homographes de participes (cgram_gender) |
| genre déterminant | 91 | **61** | POS-port : abstient si mot-après POS≠NOM ∨ nbhomog>1 |
| a/à | 97 | 97 | (tentative revertée — exige le contexte prép/avoir) |
| on/ont | 79 | 79 | (« …, on trouve » : `on` sujet après ponctuation) |
| **total** | **447 (2,74 %)** | **384 (2,35 %)** | |

**Reste (ROI décroissant, exige un modèle de CONTEXTE, pas l'appartenance lexicale)** : a/à 97 (prép/avoir),
on/ont 79 (sujet après ponctuation), genre 61 (noms ambigus/propres résiduels), −é/−er 53. Garde permanente :
`fp_stress_test.py` (`FP_MAX=`). Le domaine *dys* (phrases courtes) reste plus bas que ces 2,35 % encyclopédiques.

---

## 2026-06-21 — Durcissement FP du correcteur : 6,02 % → 2,74 % sur UD French (4 lots, recall + parité intacts)

Suite du stress-test (« FP=0 » sur-estimé). 4 lots de gardes **FP-safe** (abstention pure, jamais de nouvelle
correction), chacun **mesuré + commité séparément**, porté en parité **Python ref + app + extension dys-core**.
Mesuré sur **16 342 phrases correctes** (UD French GSD) : **FP 6,02 % → 2,74 %** (447/16342, plus que ÷2).

| lot | garde | par-règle (16k) |
|---|---|---|
| 1 | leur/leurs **invariables** (-s/-x : pays, temps) · mais/mes **adverbes** (pas, comment) | leur 31→23 · mais 53→13 |
| 2 | genre : nom suivant **capitalisé** (propre/étranger) · **non-nom-tête** (plus, autre, propre, sous… via DET_SKIP) | genre **477→91** |
| 3 | son/sont : **sujet pluriel à distance** (`_plural_before`) · a/à : **« A » majuscule** | son/sont 101→38 |
| 4 | on/ont : **participes irréguliers** (ont pu/fait/eu = avoir, IRREG_PART) — calibré pour garder le témoin « Ont mange » | on/ont 138→79 |

Garde-fous à chaque lot : batterie **FP 0/36**, recall des familles **conservé** (on/ont 5/5, genre 4/4, son/sont 3/3,
a/à 3/3, leur/leurs 3/3), parités **app⊆Python & ext⊆Python** intactes, app compile. La garde **« ont+verbe→abstention »
a été ÉCARTÉE** (lot 0) car elle cassait 2 témoins — remplacée par IRREG_PART (lot 4, recall préservé) : leçon = chaque
garde FP doit prouver FP↓ **ET** recall conservé.

**Reste (classes plus dures, ROI décroissant, à faire ensuite)** : a/à 97 (mécanisme prép/avoir ambigu sans POS),
-é/-er 90 (noms-homographes de participes : « un arrêté », « un traité »), genre 91 (noms ambigus/propres résiduels),
on/ont 79 (« …, on trouve » : `on` sujet après ponctuation). Garde permanente : `fp_stress_test.py` (`FP_MAX=`).
⚠️ Docs (`README`, `CORRECTEUR.md`, rapport §18) disent encore « FP=0 » → à requalifier (« FP=0 sur batterie ;
2,7 % sur français encyclopédique réel, en baisse »).

---

## 2026-06-21 — ⚠️ STRESS-TEST FP à grande échelle : « FP=0 » est SUR-ESTIMÉ (≈6 % sur du vrai français) + 1er durcissement

En cherchant des ressources libres (`RESSOURCES_LIBRES.md`), tiré **UD French GSD** (treebank gold, GitHub) →
**16 342 phrases correctes réelles**. Passé le correcteur dessus (`dictee/fp_stress_test.py`, R67) : **FP = 6,02 %**
(983/16342). **Notre « FP=0 » ne valait que sur les batteries curées** (30 phrases + 98 GEC, courtes/simples) — sur du
français réel divers (Wikipédia/critiques : noms propres, structures formelles, mots étrangers), il **casse la garde
cardinale**. Ventilation : genre déterminant 477 · on/ont 138 · a/à 115 · son/sont 101 · -é/-er 90 · mais/mes 53 ·
leur/leurs 31 · accord SV 25 · et/est 8 · ce/se 3.

**Reframe (doctrine §6) :** le vrai chantier du correcteur n'est PAS d'ajouter de la couverture (Lefff +37k noms,
et/est, ce/se = mineurs ici) mais de **DURCIR les FAUX POSITIFS**. La couverture *augmenterait* le FP.

**1er durcissement livré (FP-safe, 3 moteurs) :** `son/mon/ton` + nom à initiale **voyelle/h** → **abstention**
(« son Histoire », « son amie », « son indépendance » sont CORRECTS — le possessif masculin est obligatoire devant
voyelle, même au féminin). Mesuré : retire la classe « possessif-voyelle » (23/75 des FP genre sur dev+test) ; batterie
**FP 0/36**, genre **4/4**, parités app⊆Python & ext⊆Python intactes, bake FP-check OK. Outil garde permanent :
`fp_stress_test.py` (UDFR local, `FP_MAX=` = seuil d'échec, absence-safe).

**Reste (classes FP à durcir, priorisées par volume) :** genre sur noms ambigus/propres/étrangers (tour, la Pan Am),
son/sont avec sujet pluriel (« les moments … sont »), on/ont après ponctuation (« …, on trouve »), mais/mes en tête de
phrase (« Mais comment »), accord SV sur entité nommée (« Les Andalouses est »). Caveat honnête : UD = français
encyclopédique, pas de l'écrit dys ; le FP réel-domaine est plus bas, mais plusieurs classes toucheraient aussi un apprenant.

---

## 2026-06-21 — Correcteur : clôture de paradigme de la conjugaison embarquée (écart de couverture accord ext↔Python comblé, FP=0)

La parité `extension/parity_core.js` montrait **1 écart de couverture** : « Les voitures roule vite » → Python corrige
`roule→roulent` (accord sujet-verbe), l'extension/app **ratent**. Cause **mesurée** : le sous-ensemble HF embarqué
(`vdc-lex.cj`) garde `cj.f['roule']` (3s) mais **pas `cj.f['roulent']`** (3p), alors que `cj.c['rouler']['ind:pre']['3p']='roulent'`
existe. La règle d'accord produit bien `roulent` mais sa **garde d'auto-vérification** `svReads(sugg)` échoue (forme
absente) → abstention. Le probe Python, lui, charge `cgram_conj.json` **complet** (a `roulent`). C'était un **défaut de
clôture de paradigme** : filtrage par fréquence de `cj.f` sans garantir que toute forme **suggérable** par `cj.c` y figure.

- **Fix à la source** (`build_cgram.py`) : après construction du sous-ensemble HF, **clôture** — toute forme-suggestion
  de `cj.c` est ajoutée à `cj.f` (lectures filtrées présent/imparfait) depuis `cj_f` complet.
- **Fix des artefacts en repo (sans le TSV hors-repo)** : `dictee/close_conj_paradigm.py` complète le bloc `vdc-lex` de
  l'app depuis `cgram_conj.json` (idempotent ; `--check` = garde CI). **+2076 formes** dans `cj.f` (2010→4086) ; propagé à
  l'extension via `build_assets.py` (source unique = l'app).
- **Mesuré** : parité **coverage gap 1→0** ; **508/1088 lemmes HF** ont désormais leur 3p vérifiable ; généralisation
  **held-out 50/60** (« Les gens \<V-3sg\> » hors batterie) corrigés 3sg→3p, **0 flag hors-cible**. FP=0 conservé partout
  (parité ext⊆Python & app⊆Python, `correcteur_probe` 0/36, speller AUTO FP=0, bake FP-check). Garde CI ajoutée
  (`close_conj_paradigm.py --check`). Gap restant `parity_corr` = **genre déterminant** (pré-existant, hors scope).

---

## 2026-06-20 — ✅ Vérif APPRENTISSAGE (décompose-en-parallèle l'a-t-il modifié ?) → NON

Rem : « quand on a regardé si décompose en parallèle apporte un delta, on a peut-être modifié l'apprentissage, vérifie ».
Il a aussi pointé un **angle mort de §7.1** (diff = suppressions seules, pas les ajouts). Corrigé (`AUDIT_BASELINE.md §9`) :
**diff BIDIRECTIONNEL complet du bloc moteur** 6f9fe61↔HEAD → **différence = uniquement les ~20 lignes du bouton reset
ajoutées CETTE session**. Donc décompose a ajouté **0 ligne moteur** (panneaux séparés + donnée lexique seulement).
Le hook delta accord `M_DECLARE_ACCORD_PRIOR` est **pré-existant** (identique 6f9fe61/HEAD), **doublement inerte** au boot
(`=false` ET `_omega_accordPriorFn=null`), **lecture seule** (× un poids de declare, n'écrit aucun état appris ; posé que
par le harnais phrase externe). Toggles dictée hors boucle ; panneau Décompose à état séparé (`vdk_lex`). Mesuré HEAD :
apprentissage **actif** (cold≠warm) et **réinitialisable** (reset→cold). **Apprentissage intact.**

## 2026-06-20 — ✅ Correctif contamination : bouton « 🔄 Reset moteur » (option 1, choix Rem)

Le bouton existait déjà (`ui_resetLearning` = `initOmegaGlobals` + reset stats). **Vérifié** : restaure exactement le
cold (contaminé `ab00eea9` → après Reset `666f0f81`). C'était un problème de **découvrabilité**. Ajouté (additif, UI
seulement, **winrate banc inchangé 12,0 %**) : bouton renommé « 🔄 Reset moteur » + titre explicite + **indicateur
visuel** (`ui_markEngineDirty` flague le bouton `⚠️`+contour à chaque changement de toggle ; `ui_clearEngineDirty` au
reset). Options teardown-auto/auto-reset laissées en réserve. Détail : `../AUDIT_BASELINE.md §8.5`.

## 2026-06-20 — ⚠️ CONTAMINATION à la désactivation des toggles — CONFIRMÉE (Rem avait raison)

Rem : « vérifie la **désactivation** des toggles, il y a une **contamination**, c'est sûr ». Test dynamique
(`AUDIT_BASELINE.md §8`, séquences de jeu hashées, reproduites 2×) : le moteur est **session-stateful** (il apprend en
jouant : cold `666f0f81` ≠ warm `b1257f00`). Deux contaminations réelles **en interactif** :
1. **RESET DUR** — basculer `M_VOIE_PHON`/`M_SUBSTRAT` appelle `initOmegaGlobals()` (ON **et** OFF) → **efface tout
   l'apprentissage de la session** (retour cold `666f0f81`).
2. **RÉSIDU** — activer un toggle learning/declare (θ via `M_OS_LEARNING`+`M_OS_V07`, ou `M_DECLARE_NEO`), **jouer**, le
   désactiver → les apprenants persistants gardent l'état (hash `8d973926`/`286431bf` ≠ warm). Les **drapeaux** reviennent
   à false (`leftON=[]`), mais **l'état appris non**.
**Portée** : le **banc `fitness_harness` est IMMUNISÉ** (load frais à chaque run → A/B §0 valable) ; seul l'**usage
interactif** est touché = très probablement la source du « plus les mêmes résultats ». **PRÉ-EXISTANT** (code byte-identique
6f9fe61↔HEAD), pas la fenêtre décompose. **Pas une régression** mais une **repro** : « même config » ⇒ « mêmes résultats »
**seulement depuis un chargement frais**. Correctif proposé (§8.5) : bouton Reset moteur / teardown symétrique / avertir UI
— **choix de Rem requis, base non touchée**.

## 2026-06-20 — ✅ Audit STRUCTUREL complet (flux · toggles · architecture) → aucune dérive

Rem pas convaincu par l'A/B winrate → audit **structurel**. Mesuré sur le CODE (`AUDIT_BASELINE.md §7`) :
- **17 lignes** seulement diffèrent 6f9fe61↔HEAD, **toutes** correcteur/dictée (`vdc-`/`vdd-`), **0 ligne moteur** ;
- **73 défauts de toggles** extraits des 2 commits → **`diff` VIDE** (aucun défaut n'a flippé) ;
- **flux** `omegaStep` (cStep 5-modules ortho → voie phon → OS v07 → cascade declare) **byte-identique** ; au boot tous
  les **maîtres** declare sont OFF → baseline = cognition pure (R66 OK, gating par maître) ;
- finding mineur : `CONFIG_TOGGLES.md §3` disait « tout OFF sauf M4_PHON_USE_P » alors que `M_NEO_ASSEMBLED/RECALL`=true
  mais **inertes** (maître `M_DECLARE_NEO` OFF) → doc **précisée**.
**Verdict : structure intacte, rien à réparer.** Détail : `../AUDIT_BASELINE.md §7`.

## 2026-06-20 — ✅ Audit baseline moteur LANCÉ → pas de régression (mesuré)

A/B `6f9fe61`(83k) vs HEAD(155k), **même harnais figé**, headless : (1) **code moteur byte-identique** (les 17 lignes
qui diffèrent = panneau correcteur/dictée, jamais le hot-path pendu → R66 OK) ; (2) **in-lex** 5 graines n=400 :
**10,0 % ↔ 10,3 %** (bruit), err/p identique ; (3) **mêmes mots fixes** : **9,8 % = 9,8 %** ; (4) **mots nouveaux**
(OOV-83k / in-lex-155k) : **12,5 % = 12,5 %**. Lexique = **83k ⊂ 155k** (superset pur). ⇒ le changement de lexique est
**WINRATE-INERTE** ; ce que tu as vu de « différent » = `_omega_pickWords` échantillonne d'autres mots (cosmétique), +
une fenêtre où le banc **plantait** (bloc speller `text/plain`, réparé par `3ff98c1`). **Rien à réparer, garder le 155k.**
Détail + réserve Trexquant : `../AUDIT_BASELINE.md` §0.

## 2026-06-20 — ⚠️ Signalement baseline moteur (Rem) → mémo `AUDIT_BASELINE.md`

Rem signale : « la **base à ne pas toucher** a **peut-être** été modifiée, je n'ai **peut-être** plus les mêmes
résultats — n'invente pas. Depuis **décompose** + un **ajustement trexquant**. Audit structurel profond à faire. »

**Documenté, RIEN corrigé** (mémo dédié `../AUDIT_BASELINE.md`). Fait vérifiable trouvé (non interprété) : le **bloc
lexique moteur** `lex4-data-gz` de l'app a été **changé 2×** dans la fenêtre — `9d3763c` (**83 605→155 493 mots**) et
`3ff98c1` (réintègre `mb` + **fix harnais evo**). Or `evo/fitness_harness.js` **tire les mots de test ET le savoir du
devineur de ce lexique** (L17/L53) ⇒ changer le lexique **change mécaniquement** le winrate du banc. **Hypothèse n°1 à
VÉRIFIER** (A/B winrate `6f9fe61` vs HEAD, harnais constant, ≥4 graines) — **non mesuré ici, ne pas conclure, ne pas
revenir au 83k sans mesure**. Détail + plan d'audit : `../AUDIT_BASELINE.md`.

---

## 2026-06-20 — PIVOT PRODUIT : extension Chrome « correcteur dys partout » (socle + moteur, phase 1)

**Demande (Rem)** : « corriger le texte directement dans la zone de saisie », **partout** (n'importe quel champ),
hors-ligne (« c'est chiant cette histoire de en ligne »). Repli prévu : clavier virtuel / zone de saisie universelle
pour les champs où l'injection est impossible. → nouveau dossier **`extension/`** (MV3).

**Principe verrouillé** : on **réutilise notre moteur mesuré** (§5), on ne le réécrit pas. Le probe Python reste la
**référence** ; l'extension devient un **3ᵉ miroir parité-testé** (comme l'app).

**Livré (phase 1, ce socle)** :
- `build_assets.py` → extrait les lexiques de l'app vers `extension/assets/` (`vdc-lex.json` 1,5 Mo,
  `gender-relaxed.tsv.gz` 140 Ko, `speller.tsv.gz` 452 Ko — source unique régénérable, CC BY-SA 4.0).
- `dys-core.js` = **copie VERBATIM** du moteur correcteur de l'app (règles homophones + accord SV + genre +
  `j'est→j'ai`) + couche dys (stades, remédiation), **sans DOM**, lexiques chargés depuis les assets
  (fetch + DecompressionStream). API : `correctText`, `diagnose(text)` (→ flags + stade + remédiation), `loadLex`.
- `content.js` → s'accroche aux champs (`textarea`/`input`/`contenteditable`), **barre flottante** près du champ :
  clic sur une faute (ou « tout corriger ») = corrige **DANS le champ**. Affiche **stade + remédiation**. FP=0.
- `popup` (activer/désactiver), `content.css` (styles isolés), `README.md`, `manifest.json` (MV3, `<all_urls>`).
- `parity_core.js` : **dys-core ⊆ Python sur 52 phrases, aucun FP propre** (1 écart de couverture HF connu).
  Ajouté à la **CI** (+ syntaxe + build_assets).

**Vérifié headless** : parité OK, `diagnose` correct sur copies réelles (`j'est le poisse…` → j'ai + le→la,
stade lexical ; `les enfants joue` → jouent, morphosyntaxique ; `le voiture` → la). **Test réel = charger
`extension/` dans Chrome** (mode développeur).

**Phase 2** : couche orthographe (non-mots/accents : `oartir→partir`, `monagne→montagne`) via `speller.tsv.gz` +
**Gemini Nano** (contexte, hors-ligne). **Phase 3** : clavier virtuel / zone universelle (repli injection).

---

## 2026-06-20 — Règle « j'est → j'ai » (confusion avoir/être, phono) — signalée par Rem

**Cas** (copie réelle Rem) : `j'est le poisse de oartir à la monagne`. Le correcteur attrapait `le→la`,
`oartir→partir`, `monagne→montagne` mais **ratait `j'est`**. Diagnostic Rem : « problème verbe avoir et être
surement phono ».

**Pourquoi raté** : `toks` inclut l'apostrophe → `j'est` = **un seul token** ; `rAccordSV` (et les autres)
**abandonnent dès qu'un token contient `'`** (pour ne pas casser `c'est`/`qu'est`/`l'est`). Donc `j'est` filait.

**Décision (FP=0)** : la **détection** de `j'est` est toujours sûre (jamais valide en français). La **correction**
`j'ai` vs `je suis` est ambiguë EN GÉNÉRAL — **sauf** que l'élision tranche : « je suis » ne s'élide jamais (consonne
/s/), donc `j'…` vise une forme à voyelle ⇒ présent d'**avoir** (`ai`, /e/≈/ɛ/ avec `est`). **Devant un déterminant**
(`j'est le/un…`) c'est certain → `j'ai`. Sur **adjectif/participe** (`j'est content/allé` = choix d'auxiliaire) →
**abstention** (contexte = LLM, ligne doctrinale du projet).

**Livré** : `rule_jest` (Python `correcteur_probe.py`) + `rJest` (app), enregistrées après `mais/mes`. Famille =
homophone (stade lexical) → tip de remplacement adapté (`j'ai`→`j'avais` ?). **Mesuré** : Python OK sur 8 cas
(`j'est le/un…`→`j'ai` ; `content`/`allé`/`c'est`/`qu'est-ce`/`j'ai` → rien) ; **FP=0** maintenu (30 phrases +
témoins + **98 GEC réelles**) ; `parity_corr.js` étendu de 8 cas → **app ⊆ Python sur 67 phrases** ; speller inchangé.

**Reste contexte → LLM** : `j'est content`→`je suis content`, `j'est allé`→`je suis allé` (auxiliaire), `je sui`,
`bouliées`. C'est exactement la frontière hors-ligne/contexte déjà cartographiée.

---

## 2026-06-20 — Couche dys ENRICHIE : remédiation ciblée PAR FAMILLE (le produit)

**Le produit** = `famille → stade → REMÉDIATION ciblée`. Jusqu'ici : famille→stade OK, mais la « remédiation » se
réduisait au **rejeu** (répétition de la famille la plus ratée). Manquait l'**instruction** : *quoi faire* face à
chaque type d'erreur. Ajouté (§5 réutilise `STAGE_FAM`/`developmental`) :

- **Table `REMED`** (8 familles → 1 stratégie d'orthophonie ancrée double-route/stades) : voisée-sourde = main sur la
  gorge ; inversion = syllabation doigt G→D ; ajout = compter les sons ; surface = mot-modèle (graphies du même son) ;
  accent = é fermé/è ouvert à voix haute ; muette = mot de la même famille (petit→petitE) ; homophone = test de
  remplacement (a→avait) ; accord = qui commande (sujet/déterminant).
- **`remedFams(F)`** = familles présentes **au stade visé** (maillon le plus tôt non acquis) ; **`remedBlock(F,cls)`**
  = bloc HTML « 🛠️ Remédiation ciblée », affiché **par-dessus le stade aux 3 sorties** (dictée · correcteur règles ·
  correcteur IA) + dans le **profil persistant** (« on travaille : X » → la stratégie, qui complète le rejeu).
- **Bonus correctif** : le correcteur-règles classait **toutes** les fautes en `accord` (stade faussé en
  morphosyntaxique). Corrigé : nom de règle → famille (`son/sont`, `a/à`… = **homophone/lexical** ; seuls SV & genre =
  **accord/morphosyntaxique**) → stade ET remédiation justes.

**Honnêteté (§1/§6)** : contenu **pédagogique ancré** (Ferreiro/Berliocchi, double route), **pas** une détection
mesurable — aucune métrique revendiquée. Vérifié : bloc compile ; `remedFams` testé sur 7 cas (chaque famille →
bon stade/tip ; mix → stade le plus tôt ; clean → vide) ; `parity_corr.js`/`test_speller_app.js` inchangés
(la remédiation ne touche pas la détection).

---

## 2026-06-20 — Chrome local (Gemini Nano) câblé dans le panneau IA — hors-ligne, sans clé

**Pourquoi** (Rem) : « chrome est utilisé par bcp donc on par chrome ». Le LLM = plafond *contexte* ; Gemini Nano
**intégré au navigateur** (Prompt API) le donne **hors-ligne, gratuit, sans clé, sans égress** → cohérent avec la
cible dys (vie privée des copies d'élèves) et la doctrine (moteur = consommable, **notre couche dys = produit**).

**Livré** (app, panneau « 🩹 Correcteur » → « 🤖 Correction par IA ») :
- Case **🧠 Chrome local (Gemini Nano)** : cochée → masque les champs cloud (`iaCloudVis`), persistée (`vdd_ia.chrome`).
- `iaRunChrome()` = Prompt API **conforme spec** : `LanguageModel.availability/create/prompt/destroy`,
  `expectedInputs/Outputs languages:['fr']`, **sortie JSON contrainte** `responseConstraint:IA_SCHEMA`
  (`omitResponseConstraintInput`), moniteur de **téléchargement** (1ʳᵉ fois), repli `self.ai`/`window.ai.languageModel`.
- **Même rendu, même COLLE** : `iaRender`/`iaParse` factorisés → cloud ET Chrome passent par notre `developmental()`
  → **STADE dys affiché par-dessus** (engine-agnostic, §5 réutilisation). Le bouton dispatch selon la case.
- Messages d'indispo explicites (Chrome/Edge ≥ 138, flag `prompt-api-for-gemini-nano`, Firefox/Safari → Cloud/Ollama).

**Vérifié ici** : bloc correcteur **compile** (`new Function`, 68 k chars), **parité** app⊆Python OK (`parity_corr.js`),
spell app OK (`test_speller_app.js`). **Non testable en conteneur** (pas de Chrome/Nano headless) → **mesure réelle =
chez Rem dans Chrome** (qualité + FP du Nano sur `je sui dan le voiture…`). Cloud/Ollama inchangés (toujours opt-in).

**Note Grammalecte** : la faisabilité reste prouvée (entrée plus bas) mais **écartée** (option 3 : données redondantes +
GPL ; on garde MIT). Chrome Nano = la voie *contexte* retenue côté navigateur, sans dépendance ni changement de licence.

---

## 2026-06-20 — Cap verrouillé (moteur=consommable, NOTRE couche dys=produit) + LA COLLE + Grammalecte PROUVÉ faisable

**Recadrage (Rem, verrouillé `POSTIT.md`)** : le moteur de correction est un **consommable interchangeable** ; **NOTRE
cognition dys est LE PRODUIT**. On ne devient pas un wrapper. Un moteur externe **complète / remplace les *règles*** (la
corvée faible), **jamais notre travail** (famille→stade→remédiation). Conséquence : on **arrête de grinder les règles**,
on **branche le meilleur moteur**, on **investit la couche dys**.

**LA COLLE livrée** (commit `1c60750`) : dans le panneau IA, la sortie du moteur (LLM → champ `famille`) est mappée
vers nos **familles canoniques** → `developmental()` → **STADE affiché PAR-DESSUS** les corrections. Réutilise
`stageOfFact`/`developmental`/`STAGE_LBL` existants (§5). **Même point d'entrée pour Grammalecte** (rule-id→famille).
Engine-agnostic = c'est le seul code qui compte vraiment.

**Grammalecte — faisabilité PROUVÉE (pas supposée)** :
- SDK navigateur récupéré (plugin ONLYOFFICE) ; **égress GitHub OK**. API = `new GrammarChecker(path,…,"fr")` →
  `parseAndSpellcheck()` → `{nStart, nEnd, aSuggestions, sMessage}` (offsets exacts = idéal pour nos soulignements).
- **Exécuté headless** (sandbox = scope navigateur, **sans fetch**, dico nourri en objet JSON) : spellchecker chargé
  avec le **vrai dico 490 045 entrées**, suggestions **excellentes** : `fenetre→fenêtre`, `leson→leçon`,
  `aujourdhui→aujourd'hui` ✓ (`bouliées` reste dur pour le spellchecker seul = grammaire/contexte).
- **Modules = `<script>` classiques** (pas ES) → s'inlinent en **un bloc concaténé** (eval scope partagé, contexte
  SANS `exports` = comportement navigateur). **Données** (dico 3,6 M · conj 366 K · phonet 405 K · mfsp 189 K) =
  fetchées via **`helpers.loadFile(path)`** → **un seul point à patcher** pour les servir depuis des blobs embarqués ;
  règles `gc_rules_graph.js` (3,4 M) = JS inline.
- **Taille** : embed gzippé ≈ **+3 Mo** (app ~11-12 Mo). **Licence : GPL-3.0** acceptée (Rem) → l'app distribuée
  devient GPL-3.0 ; ajouter `NOTICE` + `licenses/Grammalecte.license` au moment de l'embed.

**PLAN D'EMBED** (de-risqué, reste à faire) : (1) concaténer les ~18 modules en 1 `<script>` ; (2) embarquer dico +
conj/phonet/mfsp/locutions en gzip+base64 (comme nos lexiques) ; (3) patcher `helpers.loadFile` → blobs embarqués +
injecter le dico dans le SpellChecker ; (4) `parseAndSpellcheck` → mapper `nStart/nEnd/aSuggestions/type` → notre
overlay + **familles/stades** (la colle) ; (5) Web Worker pour les longs textes ; (6) `NOTICE` GPL.

---

## 2026-06-20 — VOLET LLM démarré (correcteur, opt-in en ligne) — 1re brique

Les 3 fronts butent — **mesuré** — sur le CONTEXTE (correcteur : did-you-mean falsifié ; décodeur : g2p-sur-typo ;
trexquant : morpho = 0 Δ sur n-gram). Conclusion de Rem actée : **le levier partout = le LLM**. On démarre par le
**correcteur** (douleur réelle).

**Plafond démontré** (moi = LLM) sur la phrase qui mettait les règles à zéro : « je sui dan le voiture, et j'est
bouliées mais lunettes » → **« Je suis dans la voiture, et j'ai oublié mes lunettes. »** = **6/6** corrections (sui→suis,
dan→dans, le→la voiture, j'est→j'ai, bouliées→oublié, mais→mes) **contre 0/6 pour les règles**. Le plafond est réel.

**Faisabilité env** : égress vers les API LLM **ouvert** (api.anthropic.com/openai joignables, ≠ Drive/HF bloqués) ;
**aucune clé embarquée** utilisable → l'**utilisateur apporte sa clé**. ⇒ approche **hybride opt-in EN LIGNE**.

**Doctrine / vie privée** : le correcteur dys promet « hors-ligne, aucune donnée envoyée ». Le LLM **casse** cette
promesse → la 1re brique est **OFF par défaut**, **opt-in explicite** (pas de clé = aucun appel réseau, vérifié), pour
un futur mode UI **déclaré** (consentement).

**1re brique livrée** : `dictee/llm_correcteur.py` — le **prompt dys** soigné (conservateur : corrige sans reformuler,
sortie JSON `{corrige, fautes:[{ecrit,correct,famille}]}`) + appel endpoint **OpenAI-compatible** (env `LLM_API_URL/
LLM_API_KEY/LLM_MODEL`) + harnais **`--eval`** (récall + **FP cardinal sur le `good`** du GEC, à comparer aux règles
`eval_gec.py`). Non câblé dans l'app, pas en CI (dépend clé/réseau).
**Suite** : (1) mesurer récall/FP réel du LLM sur le GEC (avec clé) ; (2) intégration app = panneau opt-in + consentement,
LLM en **surcouche du FLAG** (les règles restent la base hors-ligne) ; (3) arbitrer le modèle (qualité × coût × local).

**MAJ — plafond mesuré (1) + intégration app (2) faites :**
- **Plafond** (Claude Opus = correcteur, échantillon GEC : 30 correctes + 16 fautives) : **récall ~total** (genre/accord/
  conjugaison/élision/typo = les familles où les règles font 0), **FP ≈ 1/30** (souvent défendable ; **découverte : le
  gold GEC contient des fautes** — ex. « l'orthographe ancien » → ancienne — donc le FP est *sous-estimé contre ce gold*).
  Verdict : à qualité forte, volet **massivement justifié** ; seul risque = sur-correction (faible, modèle fort + prompt strict).
- **Intégration app** : panneau 🩹 Correcteur, section **« 🤖 IA (en ligne, opt-in) »** — checkbox OFF par défaut +
  avertissement vie privée + clé/endpoint/modèle saisis dans l'UI (localStorage, jamais committé) + bouton **« ✨ Corriger
  avec l'IA »** (pas d'appel à chaque frappe = coût maîtrisé). Sortie : phrase corrigée (« appliquer tout ») + fautes
  cliquables par mot, **par-dessus** les soulignements hors-ligne (les règles restent la base ; aucun `fetch` sans opt-in
  explicite). Bloc compile (CI `new Function`), parité + speller intacts. Appel **OpenAI-compatible** (miroir de
  `dictee/llm_correcteur.py`). **Reste (3)** : arbitrer le modèle bon-marché (FP réel via `--eval`, avec clé).

---

## 2026-06-20 — TREXQUANT : la MORPHO/décompose n'aide pas l'OOV (FALSIFIÉ) — réponse à la thèse §1.8

Rem : « décompose préparé pour le mode trexquant, voir si utile ». Mesuré (`evo/trexq_morpho_probe.py`, standalone,
OOV par construction : test retiré du train, morpho apprise sur le train seul) — réponse à la **thèse ouverte
AUDIT §1.8** (« la cognition/structure ajoute-t-elle un Δ AU-DESSUS du substrat n-gram ? »).

| variante (winrate OOV, 500 mots held-out) | % |
|---|---|
| **A — n-gram de lettres seul (le substrat §1.7)** | **69,4** |
| n-gram + morpho (affixes de `morpho.json`) ×1 | 69,4 (bruit) |
| n-gram + morpho ×4 / ×12 | 67,8 / 65,8 (**dégrade**) |
| morpho **seule** | 22,6 |

**Verdict : FALSIFIÉ — la morpho n'ajoute aucun Δ** (au mieux +0 ; poids fort → ça empire ; seule = faible). **Cause** :
le n-gram capte **déjà** la structure d'affixes (forward = préfixes, backward = suffixes) → la morpho explicite est
**redondante**. Conforme §1.8 et au motif déjà falsifié (C léger/lourd = parité avec le substrat) : **le levier OOV
au-delà du n-gram est le CONTEXTE (LLM), pas la décomposition**. La morpho/décompose **reste utile pour la DICTÉE**
(diagnostic dys, route lexicale du décomposeur) — pas pour le pendu OOV. Sonde gardée (assert : la falsification doit
rester vraie). Cohérent avec la conclusion de Rem : *« c'est notre limite partout → LLM »* (trexquant, décodeur, correcteur).

---

## 2026-06-20 — Cas durs classe A : route PHONÈME réelle — ne bat pas la baseline (g2p-sur-typo non fiable)

Suite de la classe A (`doi→doigt`, `pié→pied` : le bon mot n'est pas candidat par `phon_key` crue). Tenté la **route
phonème réelle** : indexer le lexique par son **vrai SAMPA** (`phono_homophones.json`, committé) + dériver le phonème
du typo via **g2p** (`decompose.sublexical_phon`), puis préférer le candidat dont le SAMPA = g2p(input). Mécanique
testée : « un accent doit préserver le son » (démoter `pie` si son SAMPA ≠ g2p(`pié`), promouvoir `pied`).

**En principe, ça marche** : g2p(`pié`)=/pje/ = `pied` (/pje/) **≠** `pie` (/pi/) → désambiguïsé. La route isole aussi
correctement les **vraies ambiguïtés** (`doi`=/dwa/ = dois/doit/doigt ; `tan`/`balon`/`voudrai` = vrais homophones du
voisin) → ne pas deviner = FP=0 respecté.

**Mais sur le GEC (le juge), 5 variantes mesurées — AUCUNE ne bat la baseline** : recall **7/13** inchangé, et la
**confiance AUTO chute (2→0)**. Les cas « gagnés » (`pié→pied`) **ne sont pas dans le corpus** → j'optimisais des
**anecdotes**, pas la mesure (piège doctrine §1/§6.4).
- **Cause racine = g2p-sur-typo non fiable** : drop du `e` muet (`cafe`→/kaf/ ≠ café /kafe/), du schwa (`fenetre`
  `fnEtR` vs `f°nEtR`), qualités vocaliques (`telefon` vs `telefOn`). → exiger un match phonétique **démote les
  restaurations d'accent AUTO légitimes** (café/fenêtre = la feature FP=0 la plus précieuse).
- Tentatives de sauvetage mesurées et épuisées : préfixe-tolérant (récupère café mais pas fenêtre), rival = edit-1
  seulement, **normalisation de notation** (`°`/`E`/`O`) → **réintroduit des collisions** (`pié→pieu`).

**Verdict (barrière de mérite §6.4)** : ne bat pas la baseline → **NON câblé**. `pié→pied` est résoluble *en principe*
mais bloqué par la **qualité de g2p sur les mots mal orthographiés**. Le vrai fix (ouvert) : embarquer le **phonème
réel par mot** (rebuild `speller-lex` avec `2_Phono` de Lexique4) **+ un g2p aligné sur cette notation** — exige
Lexique4, et même là la fiabilité g2p-sur-typo reste la question ouverte. Cohérent avec le plafond « sans-contexte »
des deux classes (cf. entrée did-you-mean).

---

## 2026-06-20 — « DID YOU MEAN » fréquence : FALSIFIÉ (mesuré, jonction 7 classe vrai-mot)

Reprise de la piste laissée ouverte par le stress-test : corriger un **vrai mot rare** (que le speller ne touche pas,
`balon`/`tan`/`voudrai`) vers un voisin **plus fréquent**, gardé FLAG, FP chiffré sur le GEC. Mesuré sur le **lexique
embarqué** (`speller-lex-gz`, sans Lexique4) + 98 paires GEC — `dictee/didyoumean_probe.py`.

**Diagnostic des cas durs (dump des candidats) — DEUX classes distinctes :**
- **Classe A** (`doi→doigt`, `mangont→mangeons`) : le bon mot **n'est même pas candidat** (distance-2 ET clé phon
  différente à cause des lettres muettes : `doigt`=`dvag` ≠ `doi`=`dva`). Le re-ranking ne peut rien. → relève d'une
  **clé phonétique sachant les finales muettes** (route phon), PAS du « did you mean ». Piste séparée, ouverte.
- **Classe B** (`balon→ballon`, `tan→tant`, `voudrai→voudrais`) : input = **vrai mot** (faible freq) → speller renvoie
  `None`. Le voisin fréquent EST candidat. C'est la cible « did you mean ».

**Mesure classe B → FALSIFIÉ.** Aucun réglage n'atteint **FP=0** :
- large (rare<seuil × dominant) : **8→58 FP** / 98 correctes pour **0→3 corrections** / 152 erreurs vrai-mot GEC.
- stricte (edit-1 + phon-**identique** + dominant) : **3→10 FP** pour **0→1 correction**.
- FP irréductibles = vrais mots rares à voisin fréquent phon-identique (`vainc→vain`, `coll→cool`, `absorbeur→absorber`,
  `croît→crois`) — **indissociables d'un typo sans contexte**. Et `voudrai` (futur correct « je voudrai ») = un seuil
  fréquence corrigerait du **juste**. *Nuance* : la stricte corrige bien `balon→ballon` et laisse `tan`/`voudrai`, mais
  les 3 FP tuent le cardinal.
→ **Conforme à la doctrine** (POS/contexte-naïf déjà falsifié) : la classe vrai-mot exige un **modèle de CONTEXTE**
(LLM-grade) ; le C lourd transformer est déjà falsifié (CLAUDE.md). **Ne pas câbler.** Sonde `didyoumean_probe.py` gardée
(assert : la falsification doit RESTER vraie). Détail : `CORRECTEUR.md` (§ FALSIFIÉ did-you-mean).

---

## 2026-06-20 — Réintègre `mb` (base morpho) dans le lexique embarqué + fix harnais evo

> Soulevé par Rem après la consolidation : « build_morpho régénère un morpho.json dégradé, alors que le lexique
> est intégré à omega-pendu — vérifier. » Vérifié → cause trouvée → corrigé.

**Cause (≠ ce que je croyais).** Pas un Lexique4 manquant : `build_morpho.py` lit le lexique **embarqué** (`lex4-data-gz`).
Le vrai souci : commit `9d3763c` (PR #9) a re-embarqué le lexique COMPLET (83 605 → **155 493 mots**) via
`build_engine_lex.py` avec `KEEPCOLS` **sans `mb`** (« colonne morpho-base sans consommateur »). Or `mb` **a** un
consommateur : `morpho.json` / route lexicale du décomposeur (**PR #10**, parallèle). Le merge fait se rencontrer
app-sans-`mb` × consommateur-de-`mb` → régénération dégradée (bases vidées, 0 `mb`).

**Fix sans Lexique4 (egress Drive bloqué + connecteur MCP sature le contexte).** La donnée `mb` existait déjà dans
l'app de `main` (19 341 mots). **Transplant** par script : on ajoute le champ `mb` aux entrées du lexique 155 k
**sans réordonner `words`/`len_index`** (→ baseline moteur préservée ; `mb` est un champ que le pendu IGNORE, seul
`build_morpho` le lit). App **+0,13 Mo** (8,32→8,45). `morpho.json` régénéré : **26 918 clés dont 18 227 avec base**
(vs 20 523 committé, vs 0 dégradé) → **plus riche ET cohérent** app↔morpho.

**Non-régression moteur MESURÉE** (`evo/measure_lex_bylen.js`) : 7→97,5 % · 8-9→100 % · 10-12→100 % · 13-15→100 %
= identique à `9d3763c` (≤1 mot sur les 7 = bruit cohorte documenté). `mb` purement additif.

**Bonus — bug pré-existant PR #9 corrigé.** `fitness_harness.js`/`measure_lex_bylen.js` castaient (SyntaxError)
sur le bloc **`speller-lex-gz`** (`text/plain`, donnée base64, ajouté par PR #9, jamais exclu du concat-eval). Fix :
exclure aussi les blocs data `text/plain` (1 ligne/harnais). Prouvé pré-existant (échec identique avant le transplant).
CI complète verte (18 étapes).

---

## 2026-06-20 — Couche SPELLER ortho (AUTO/FLAG) + hybride + genre déterminant + stress-test FP + CONSOLIDATION (rattrapage §6)

> Entrée de rattrapage : le journal s'était arrêté au 18/06 ; cet arc (couche orthographique du correcteur,
> 18→20/06) vivait dans `CORRECTEUR.md` + les commits mais **pas dans le journal** (trou §6). Comblé ici.
> Détail complet : `dictee/CORRECTEUR.md`.

### Couche ORTHOGRAPHIQUE — non-mots (`speller_probe.py` + miroir JS dans l'app)
Au-delà des homophones grammaticaux : un vrai correcteur de **non-mots** (formes absentes du lexique), temps réel
(panneau « 🩹 Correcteur », debounce 350 ms). Candidats = **restauration d'accent** (deacc→accentué, prio 2) +
**edit-1** (prio 1) + **route phonétique** (`phon_key` : ph→f, ç→s, qu→k, finales muettes… ; cible dys, prio 0).
- **2 niveaux** : **AUTO** (remplace seul, accent-only dominant ≥3 lettres, même longueur → curseur préservé,
  `fenetre→fenêtre`) — **cardinal FP=0** ; **FLAG** (souligne, clic) candidat incertain (`leson→leçon`, `gato→gâteau`).
- **Embarqué** : bloc `speller-lex-gz` (92 743 formes accentuées + freq, gzip+base64 0,56 Mo). Miroir JS = exact du Python.
- **Mesuré (GEC 98 phrases)** : **AUTO FP=0/98** ; non-mots corrigés exactement **58 %** ; FLAG-FP=12 (OOV/rares, non destructif).

### HYBRIDE — la voie grammaire désambiguïse les candidats du speller
Accord genre/nombre du contexte (déterminant/nom-tête proche, en sautant les copules) + **bascule de paire
d'adjectif** (`cgram_adj`) → `fote→faute`, `gross→grosse`, `premiere→premier`, `blanch→blanche`. Accord = **bonus
jamais pénalité** (ne casse pas l'AUTO accent). Câblé Python **et** app, parité vérifiée, **AUTO FP=0 préservé**.

### Genre DÉTERMINANT (`rule_det_gender`) — la catégorie dominante du réel
Déterminant à genre certain (un/une/le/la/ce/cet/cette/mon/ma/ton/ta/son/sa) + **nom PUR** juste après (champ `gn` =
genre non ambigu MOINS verbes MOINS adjectifs) → genre(dét)≠genre(nom) → corrige. **GEC : FP=0/98, 17/27 détectés+
corrigés**. Câblé app (`rDetGenre`), parité EXACTE. (≠ `rule_genre_adj` adjectifs, qui reste NON branchée, FP-insûre.)

### Intégration SANS l'app (sans UI/DOM)
`dictee/correcteur.js` (lié à l'app, source unique = monolithe) + `build_correcteur.js` → `correcteur.standalone.js`
(bake, HTML non requis, **2,16 Mo** : 48 Ko code + 2,11 Mo données ; PAS le lexique 5,5 Mo du pendu). En CI.

### STRESS-TEST « les deux » (20/06) — 3 vrais FP corrigés, edit-2 falsifié, élision-espace livrée
- **FP éliminés** (sur texte correct → cardinal FP=0) : (a) **ligature œ** (`cœur→coeur` : normalise œ→oe avant lookup) ;
  (b) **nom propre en tête** (`Nathalie→natalité` BLOQUÉ : mot capitalisé → seule la restauration d'accent autorisée) ;
  (c) **`pome`→paumée** (collision genre nom/adj : `_gender` n'utilise la table adjectif que si POS='A' → garde anti-déacc).
- **(A) edit-distance 2 : FALSIFIÉ par mesure** — 59 ms/mot (injouable temps réel), n'attrape **aucun** cas dur
  (`mangont`/`doi`/`pié` : un candidat distance-1 gagne, le bon mot reste noyé), et ajoute du bruit (FLAG-FP 8→10).
  **Non câblé** (comme les garde-fous NbHomoph/Preval). Trace négatif = R66/§6.4.
- **(B) ÉLISION-ESPACE : livrée** — `c est`→`c'est`, `j ai`→`j'ai`, `qu il`→`qu'il`, `aujourd hui`→`aujourd'hui`.
  Fusion de **2 tokens** (flag `span:2`, renderCorr/applyFix). Détection : lettre d'élision + mot voyelle valide,
  écart purement blanc (apostrophe typographique déjà là → pas de FP). **5/5 élisions, 0 FP, parité OK.** En CI.
- **Cas restants (honnête)** : `balon`/`tan`/`voudrai` = **vrais mots** → le speller n'y touche pas (les corriger =
  « did you mean » contextuel = terrain déjà **falsifié** côté POS naïf, risque FP). `doi→doigt`/`pié→pied`/
  `mangont→mangeons` = distance 2 **+** lettres muettes (clé phon `dwag`≠`dwa`) → exigent un modèle contexte/fréquence
  (ré-ordonner vrai-mot-rare → mot-fréquent-proche) **mesuré contre FP=0 sur le GEC** = jonction 7 de `CORRECTEUR.md`,
  **reportée** (la doctrine §1 interdit de la câbler sans mesure).

### CONSOLIDATION (20/06) — PR #9 synchronisée avec main
- PR #10 (« décomposeur à la Lexique 4 ») mergée dans `main` → PR #9 (correcteur) mergée avec `origin/main` (main
  désormais ancêtre, mergeable proprement). `app/omega-pendu.html` + `CLAUDE.md` auto-mergés (panneaux Décompose et
  Correcteur coexistent). CI = **union** (décompose + correcteur/speller), **vérifiée verte en local** (18 étapes).
- **Corpus GEC réintégré** : PR #9 l'avait sorti du repo (`hors-repo`, provenance à confirmer) ; PR #10 l'a committé
  (`dictee/corpus_gec_fr.jsonl`, 98 paires) → on s'aligne sur l'état canonique de `main`. ⚠️ Provenance/licence du
  corpus **toujours à confirmer** (texte type Wikipédia) — à retirer si besoin. Docs `eval_gec.py`/`CORRECTEUR.md`
  réconciliées (« hors-repo » → « suivi dans le repo »).

---

## 2026-06-19 — Audit projet : correctifs appliqués (ex-`AUDIT_PROJET.md`, replié puis migré ici)

> [Verbatim CLAUDE.md, section « Audit projet ». Le ⏳ restant (validation terrain orthophonistes) est
> suivi comme chantier ouvert dans ETAT.md.]

✅ vivarium retiré · legacy dictée isolé · lexique compressé (16→5 Mo) · CI (`.github/workflows/ci.yml`) ·
banner sécurité omega-key · **citation Lexique 4 complète + CC BY-SA 4.0 partout** · audit structurel
(sécu XSS, try/catch muets, accessibilité toggles) corrigé → `AUDIT_STRUCTUREL.md`.
⏳ Reste : **validation terrain** (vraies copies dys — externe, orthophonistes) — elle valide ET nourrit
la boucle descendante ; arbitrage branche/`main` (commits OMEGA·KEY divergents).

---

## 2026-06-18 — LE VRAI PROBLÈME : cognition/apprentissage ne généralisent pas + FIX n-gram (N=400 : 50→66 %) — AUDIT §1.7/§1.8

Suite Rem : « le pendu n'est qu'une MESURE ; OMEGA ne gagne ni par mémorisation ni par apprentissage-par-jeu — vrai
problème, trouve cause + solution ». Mesuré (vrai OOV) :
- baseline n-gram TRIVIAL du lexique = **57,5 %** ; **OMEGA cognition SEULE = ~8 %** → le signal est dans le lexique,
  la cognition ne le capte pas.
- **FIX** `M_NEO_LETTER_NGRAM` (OFF-inerte) : n-gram positionnel de lettres pré-calculé depuis `len_index` (cheat-free,
  respecte Trexquant). **N=400 (4 graines) : hybride 50,0 → 66,0 % (+16 pts, gagne à chaque graine), moins de coups.**
- **CAUSE de fond** : généraliser = **agréger** la structure du lexique. OMEGA apprend par **récompense-par-partie +
  mémoire** (~200 mots vus), goulot 12 cellules, **pas de câblage concept→lettre** (§1.4.2). Mauvais paradigme + capacité + câblage.
- **SOLUTION** : désintriquer ORACLE (lire la réponse, triche) / AGRÉGATION (stats du lexique = substrat légitime) /
  COGNITION (Δ par-dessus). Thèse → « la cognition ajoute-t-elle un Δ au-dessus du substrat n-gram ? ». Étapes : (1) substrat
  agrégé (one-pass lexique, lettres+phonèmes) ; (2) mesurer Δ cognition ; (3) si oui, capacité+câblage (§3). Détail AUDIT §1.8.
- **⚠️ DEUX corrections honnêtes (petit-N over-read)** : (a) « recall tue la généralisation » = FAUX (recall OFF ≈ ON).
  (b) « plus de données = pire » = **bruit, non confirmé** (w1500 full=jointe OFF=θ OFF=23,3 % IDENTIQUE ; baseline w200=50 %
  à N=400). Le vrai problème n'est PAS une dégradation, c'est que la cognition ne généralise pas (8 %).
- Leçon transverse : OMEGA généralise par **AGRÉGATION DE STRUCTURE** (déjà le paradigme gagnant du correcteur dys :
  cgram/conjugaison), pas par récompense ni mémoire. Cf. `docs/HANGMAN_SOTA.md`.

---

## 2026-06-18 — ⛔ FUITE COHORTE trouvée (Rem avait raison) : "97 % OOV" = bidon, vrai OOV ~33 % — CORRIGÉ

Rem : « 97 % Trexquant impossible, le système triche ». **Exact.** Audit du code → bug `_neoWBL` :
- La cohorte NEO (`_neoCohortMasks`/`_neoPhonCohort`/`_neoPhonCohortDist` → assemblé/jointe/**OS-arb**/muette) lit un
  cache `_neoWBL` **bâti une fois depuis `OMEGA_LEX4.words[]`** et **jamais invalidé**. Trexquant (`_trexq_removeWord`)
  et le harnais (`filtered`) ne retirent le mot que du **`len_index`** → le mot "retiré" **restait dans la cohorte**.
- **Preuve** (même protocole, cohorte reconstruite SANS les mots-test) : 98,3/95,0 % (fuite) → **33,3/33,3 %** (vrai OOV).
  Fuite **≈ 62-65 pts**. Le vrai OOV est **~33 %** (sous SOTA 50-68 %) : la généralisation sublexicale pure d'OMEGA
  est **faible**, pas exceptionnelle. Ma §1.6.1 « OS-arb 96,7 % OOV » = **artefact**, **rétractée**.
- **Fix** : `_neoEnsureWBL()` bâtit la cohorte depuis `len_index` (respecte les retraits) + invalide le cache
  (changement de référence ; `_trexq_*` annulent `_neoWBL`). **In-lexique inchangé** ; Trexquant aveugle enfin vraiment.
- **Leçon (doctrine §1/§6)** : un Δ extraordinaire = chercher la fuite, pas pavoiser. Tout chiffre OOV/Trexquant
  antérieur (§1.1, MAJ CONFIG_REFERENCE) est **à re-mesurer**. Le in-lexique (§1.6) n'est pas touché.

---

## 2026-06-18 — Accord sujet-verbe à SUJET-NOM (« les enfants joue »→jouent), FP=0 sans lexique de noms

Test terrain Rem : « les enfants joue dans le jardin et ils ont content » → rien (joue = sujet NOM, hors v1 pronom).
Ajout `rule_accord_sv_noun` (Python + app, parité).
- **Portée sûre** : déterminant PLURIEL (les/des/ces…) **EN TÊTE de phrase** (dk==0) → verbe au pluriel. En tête,
  rien à gauche → aucun génitif/PP/objet-de-verbe → **FP=0 SANS lexique de noms** (donc parité app↔Python parfaite).
- **Itérations FP (cardinal)** : 1res versions = 21 FP/98 corpus (déterminant le plus proche attrapait « des
  institutions », « l'automne est »→« les feuilles », « protéger les infrastructures »). Durci pas à pas
  (exclure « à »≠« a » ; clitique « le chat **les** regarde » ; génitif « des » ; verbe/coordination) puis
  **simplifié en dk==0** (lexicon-free, robuste) → **FP 21→0**. Garde structure : nom-tête toléré (homographe
  « voitures »), verbe intercalé après = sous-phrase → abstention. Direction unique pluriel→3p (singulier→3p écarté :
  « le chien **et** le chat mangent »).
- **Donnée** : corrigé `derive_number` (nombre vide fréquent au présent) → -ent/-ont LONG non -ient = pluriel
  régulier (chantent, dorment) ; -ient/court = ambigu→wildcard (vient/ment) → débloque les slots 3p manquants.
- **Mesuré** : témoins 8/8, held-out **11/11 vocab NEUF**, **FP=0** (30 phrases + 98 GEC réel + held-out). Parité
  app↔Python : invariant **flags-app ⊆ flags-Python** (app au lexique HF s'abstient sur verbes rares, jamais de FP).
- **Honnête** : « ils ont content » non flagué (« ont » s'accorde avec « ils ») ; reste l'erreur avoir↔être
  (sémantique) + accord adjectif — hors portée. Sujet-nom en sous-phrase/distance = reporté (exige une vraie analyse).

---

## 2026-06-18 — ACCORD SUJET-VERBE branché dans le correcteur (route conjugaison Lexique 4), FP=0

Recadrage de Rem (test « Les enfant joue… Je doit manger. On ont gagné. » → rien détecté) : le correcteur ne
couvrait **que 8 homophones**, or ses fautes étaient toutes des **accords**. On retourne le levier d'accord du
DIAGNOSTIC en CORRECTION (§5 réutiliser l'existant), pour l'**accord sujet-verbe à sujet PRONOM**.
- **Donnée** : `9_InfoVER` + `8_Nombre` de Lexique 4 → `cgram_conj.json` (8 018 formes / 2 404 lemmes ;
  `f`=forme→lectures, `c`=lemme→temps→slot→forme). Généré par `build_cgram.py`. Sous-ensemble HF (présent+imparfait)
  embarqué dans l'app (`vdc-lex`, +210 Ko). Probe Python = table complète.
- **Règle** `rule_accord_sv` : sujet = pronom isolé (je/tu/il/elle/on/ils/elles ; nous/vous exclus, ambigus avec le
  clitique objet) ; flague le verbe **si aucune lecture (pers,nombre) du sujet** ; corrige **seulement si** la
  suggestion est elle-même confirmée (pers,nombre) du sujet (auto-garde anti-bruit).
- **Bruit Lexique trouvé & neutralisé** (sinon FP/mauvaises corrections) : `peux`=nombre `p` (faux) → 1re/2e pers.
  jugées sur la **personne seule** ; **infinitif** porte des tags finis parasites (`chanter:ind:pre:2`) → écarté
  (forme=lemme) ; `8_Nombre` **vide** fréquent au présent des -er (`travaille`) → **nombre déduit** (-ons/-ez=pl ;
  3e pers. -ent/-ont=ambigu→wildcard ; sinon sg) ; participe mal tagué présent (`joué:ind:pre:1`) → écarté des slots.
- **Mesuré** : « Je doit »→dois, « On ont »→a, « il sont »→est ✓ ; témoins 5/5 ; **held-out 6/6 sur vocab NEUF**
  (chanter/travailler/regarder/inventer/ranger/nettoyer) → généralise. **FP=0** partout (30+29 témoins, 98 GEC réel,
  held-out). Corpus réel : 2/12 accords SV (les 2 à sujet pronom ; 10 à sujet **nom** = jonction suivante).
- **Parité app↔Python** : `dictee/parity_corr.js` (29 phrases identiques), ajouté en CI. UI : message « Aucune faute
  grammaticale » + périmètre explicite ; intro mentionne l'accord SV.
- **Choix** : on corrige le **verbe** vers le sujet écrit (« il sont »→« il est »), pas le sujet — règle enseignable.

---

## 2026-06-18 — Correcteur validé sur VRAI corpus (Rem) : FP 11 → 0 / 98, durcissement « abstention »

Rem a fourni un vrai corpus GEC FR (98 paires erroné/corrigé, Wikipédia). `dictee/eval_gec.py`.
- **Test cardinal (FP sur phrases CORRECTES réelles)** : 1re passe **11 FP** → le « 0 FP » synthétique était
  **falsifié par le réel** (exactement le risque « validation circulaire » signalé). Mécanismes : `deacc(à)==a`
  (collision avec l'aux *a*), homographes courts du cgram (« ne »→vlike), participes hors stub (« incarné »),
  tokens contractés (« l'été »).
- **Durcissement** : à/a distingués, `VLIKE_STOP` (mots-outils), -é/-er ignore les tokens apostrophés, on/ont
  détecte le participe par suffixe, et les règles ambiguës (son/sont, ce/se, et/est) **s'abstiennent** au lieu de
  deviner. → **FP 11 → 0 / 98** (Python + app, parité vérifiée). Coût : −2 in-corpus (22→20), −1 held-out (12→11).
- **Honnêteté périmètre** : 1 seule des 98 erreurs réelles est dans les 8 confusions du correcteur (le reste = genre
  déterminant un/une, nombre, ordre, mots manquants, typos = hors périmètre). Le correcteur est **FP-safe sur du
  réel** mais **couvre peu** des erreurs réelles → couche large (genre/nombre/typo) = futur, exige un POS/tagger.
- Corpus tiers gitignoré (hors-repo comme Lexique4). Détail : `dictee/CORRECTEUR.md`.

---

## 2026-06-18 — Boucle DESCENDANTE de la grammaire : apprendre le lexique de genre (100 % préc., FP=0, data-bound)

Seconde moitié de la double voie (après la route lexicale). `dictee/descending_probe.py` : la boucle descendante
**apprend** nom→genre depuis les contextes à déterminant genré des phrases correctes (« une table » → f), validé
contre Lexique4.
- **Précision 26/26 = 100 %** · généralisation leave-one-out **1/1** (un seul nom se répète sur 30 phrases →
  recouvrement quasi nul) · détection via genre appris **FP=0**.
- **Verdict** : ça APPREND vraiment (≠ miroirs du pendu, mesurés inertes) et c'est FP-safe, MAIS la valeur vient
  du **VOLUME** — 30 phrases n'apprennent qu'une poignée de noms. Home réel = corpus corrigés (validation terrain) :
  la boucle est le moteur d'**auto-enrichissement** du correcteur (genre/POS/gouverneur→terminaison appris en continu).
- Les deux moitiés de la double voie sont posées et mesurées : route **lexicale** (genre 3/3) + boucle **descendante**
  (100 % préc.). Détail : `GRAMMAIRE_DOUBLE_VOIE.md`.

---

## 2026-06-18 — Lexique4 reçu → route LEXICALE de la grammaire (verbes + GENRE)

Rem a fourni le `Lexique4.tsv` (33 Mo) → `build_cgram.py` génère deux ressources dérivées (CC BY-SA) :
- `cgram_verbs.json` (**12 415** formes verbales, col. 5_Cgram=VER) → `vlike` (couverture verbale complète).
  *Mesuré* : FP=0 ; sur le jeu-témoin contrived 21/24 (vs 22/24 liste blanche) car les **homographes nom+verbe**
  (livre/porte/trouve…) passent pour verbes → leçon = croiser avec le contexte (jointe §3), pas drapeau brut.
- `cgram_gender.json` (**53 050** noms à genre NON ambigu ; 186 ambigus écartés : tour, livre…) → **route lexicale
  du GENRE** : `lexical_gender(T,i)` lit le genre du nom-tête quand le déterminant ne le marque pas (leur/notre/des).

`diag_sentence` : branche genre = `governor_gender(T,i) or lexical_gender(T,i)`. **Mesuré : 3/3** sur déterminant
neutre (« Leur grande maison » → maison f → grande ; « Notre petite voiture » → f ; « Leur chien noir » → m) —
là où on **s'abstenait** avant. Familles **100 %** + toutes les mesures précédentes **intactes** (la route lexicale
n'ajoute que des décisions, jamais ne change un diagnostic correct). FP-safe (noms ambigus écartés du lexique).

C'est la **moitié « route lexicale »** de la double voie (`GRAMMAIRE_DOUBLE_VOIE.md`). Reste : la moitié
« boucle descendante » (apprendre depuis les cibles de dictée) et le port app (sous-ensemble haute-fréquence).

---

## 2026-06-18 — Direction CORRECTEUR dys : probe « détecter + corriger SANS corrigé » (0 faux positif)

### Idée (Rem) → recadrage
Faire du levier d'accord un **correcteur orthographique dys semi-direct**. Recadrage : le correcteur roule sur le
moteur de **dictée** (pas le pendu) → toutes longueurs, régime mot-court (où l'accord paie). Le pendu de phrases
a été un **banc de mesure** (falsifié comme débouché winrate), pas l'application. Angle unique : détecte + corrige
**+ situe le STADE** (remédiation dys), ce qu'aucun correcteur grand public ne fait.

### Le seul inconnu, mesuré (`dictee/correcteur_probe.py`)
La dictée connaît la cible ; un correcteur doit **inférer l'intention**. Règles `decide(T,i)` par homophone
grammatical (réutilise `diag_sentence`), détection ET correction faites ensemble (« sinon on le fait deux fois »).
- **Faux positifs sur 30 phrases correctes : 0** (condition n°1 : ne pas corriger du texte juste).
- **Détection + correction : 13/16** ; **9/9** sur `-é/-er`, `son/sont`, `leur/leurs`.
- 3 manques (`a/à`, `et/est`, `on/ont` présent) = `is_verb` est un stub de 32 formes du corpus (ignore « mange »…).
  Mécanisme, pas échec d'architecture : un lexique POS (Lexique4 `cgram`) les lève et scale.
- Bug attrapé en route : un FP `sont→son` quand un adjectif s'intercale (« fleurs rouges sont ») → règle son/sont
  recadrée sur le mot **précédent** (verbe/prép/conj → possessif ; sujet → verbe) → 0 FP.

### Verdict
Cœur du correcteur validé sur l'existant, **0 faux positif**. Suite : élargir `is_verb` (cgram), couche typo
(non-mot via voisins), UI semi-directe (réutiliser le panneau dictée, OFF-inerte R66). Détail : `dictee/CORRECTEUR.md`.

---

## 2026-06-18 — Validation terrain : fiche imprimable (le juge est humain, §4)

### Quoi
Le levier grammaire « classe fermée » a épuisé ce que le corpus de 30 phrases permet de **mesurer en synthétique**.
Prochaine étape du plan = **C, validation terrain** (vraies copies dys, orthophonistes) : c'est le vrai juge (doctrine §4).
Livrable : un **support imprimable** pour faire passer la dictée et **mesurer l'accord outil↔expert**.

- `dictee/build_validation_sheet.py` — générateur (réutilise `sentences.json` + `FAM2STAGE`/`STAGE_ORDER` de `diag_sentence.py`,
  doctrine §5 : pas de duplication des données). Régénérable.
- `dictee/validation_terrain.html` — fiche autonome, 3 feuilles (sauts de page) :
  1. **Protocole + métadonnées élève** (anonymisé, consignes, aide-mémoire familles/stades).
  2. **Feuille EXAMINATEUR** : 30 phrases à dicter + grille de relevé par mot fauté
     (mot cible · écrit élève · **famille expert** · stade · **famille outil** · **accord ?**) → mesure directe du taux d'accord.
  3. **Feuille ÉLÈVE** : lignes vierges numérotées, police lisible dys — **sans le texte cible** (c'est une dictée).
  4. **Synthèse** : profil de stade (expert vs outil) + calcul du **taux d'accord** = validation/falsification du diagnostic.

### Conception (pourquoi cette forme)
- Diagnostic expert **en aveugle** d'abord, comparaison à l'outil ensuite → le taux d'accord n'est pas biaisé.
- Cible interne = 100 %/famille (synthétique) ; un écart terrain pointe la famille à revoir (donnée actionnable, §1 falsifiable).
- Pas de moteur PDF dans l'env → l'HTML s'imprime au navigateur (Ctrl+P). Données : Lexique 4, CC BY-SA 4.0.

---

## 2026-06-18 — Levier grammaire : participe passé avec AVOIR, le COD antéposé

### Quoi
La dernière règle d'accord « dure » du français : le participe avec *avoir* s'accorde avec le **COD
quand il est ANTÉPOSÉ** (« la pomme **qu'**il a cueilli**e** ») et reste **invariable** sinon (« il a cueilli des pommes »).

- `find_cod_antepose(T,idx)` : cherche un relatif **« que / qu' »** à gauche du participe (fenêtre courte) ;
  l'antécédent = le GN avant le relatif → genre/nombre via `governor_gender` + `governor_number`.
  Renvoie `(antécédent, genre|None, nombre|None)`, ou `None` (→ invariable).
- Branche *avoir* de `diagnose_sentence` : accord avec le COD antéposé si relatif, sinon « invariable, COD placé après ».
  ⚠️ Le tokeniseur garde l'élision : `qu'il` est **un seul token** → on teste `== 'que'` **ou** `startswith("qu'")`.

### Mesuré (`python3 dictee/diag_sentence.py`)
- Familles **100 %** · participe détecté **7/7** inchangés.
- Démos COD (synthétiques — le corpus n'a que des COD postposés, cf. phrases 14/18) :
  - « La pomme **qu'**il a cueillie » → COD antéposé « pomme » (f, sg) → accord ✓
  - « Les fleurs **qu'**elle a cueillies » → COD antéposé « fleurs » (genre None car « les » ne marque pas le genre, pl) → accord ✓
  - « Elle a cueilli des pommes rouges » → **invariable** (COD placé après) ✓
- Honnêteté : avec « les » le genre n'est pas porté par le déterminant → on accorde en **nombre** seul (le genre est lexical, hors moteur sans lexique).

### App (port vérifié)
`findCodAntepose` porté dans l'IIFE dictée ; branche *avoir* enrichie. Parité JS↔Python sur les 3 cas (`['pomme','f','sg']` / `['fleurs',null,'pl']` / `null`). CI verte.

---

## 2026-06-18 — Levier grammaire : chaîne du GN, l'accord en GENRE

### Quoi
Quatrième pièce du levier grammaire (après sujet-verbe, sujet à distance, participe passé) :
**l'accord en genre dans le groupe nominal** — l'erreur dys classique « une robe **vert** ».

- `GEN_DET` : déterminants **genrés** (le/un/ce/cet/mon/ton/son/au/du = m · la/une/cette/ma/ta/sa = f). Classe fermée, fiable sans POS.
- `governor_gender(T,idx)` : remonte au déterminant genré le plus proche à gauche → `(mot,'m'|'f')`.
  **Abstention** si on croise un déterminant non-genré (les/des/leur) ou un pronom (on a quitté le GN).
- Branche GN de `diagnose_sentence` : quand `accord_type=='genre'` (et pas un verbe), on diagnostique le genre
  (« accord en genre : « une » féminin → accorder « verte ») au lieu du nombre.

### Mesuré (`python3 dictee/diag_sentence.py`)
- Familles **100 %** inchangées · gouverneur identifié sur erreur d'accord **82 %→84 %** (138/164 : les accords en genre trouvent maintenant leur gouverneur genré).
- **Chaîne du GN — genre : 7/7** quand un déterminant genré gouverne ; **abstention 6/6** quand il n'y en a pas
  (pronom « Il/tu », « leur tour » non genré, début de phrase). *Le « 7/13 » naïf cachait 6 abstentions correctes :
  il n'y a pas de genre à accorder sans déterminant genré — un Δ sans le pourquoi ne vaut rien.*
- Démo synthétique « Elle porte une robe vert(e) » → gouverneur genre = `('une','f')` : **skippe le pronom « Elle »**
  (le genre vient du déterminant du GN, pas du sujet).

### App (port vérifié)
`governorGender` + `GEN_DET` + `accordType` portés dans l'IIFE dictée (OFF-inerte, R66 baseline intacte).
Parité JS↔Python vérifiée sur 5 phrases + accordType (genre/nombre/verbal) : identique. CI (python + compile du bloc) OK.

---

## 2026-06-13 — Décision de direction + Phase 0 livrée

### Décision
- **Cible n°1 = dys / troubles de l'écrit** (confirmée par Rem). Usage école/soutien/orthophonie.
- **Produit = dictée à diagnostic d'erreur**, bâtie sur la **double route** d'OMEGA.

### Pourquoi la dictée (fondé sur mémoire + rapport)
- La **force mesurée** d'OMEGA est **phon→ortho** (70 % hors-lexique, 97-98 % en lexique) — la dictée *est* cette tâche.
- Le **profil de défaite est une signature de dyslexie phonologique** (mémoire §11.2) : 96 % des défaites = paire phonétiquement proche ; **58 % voisée/sourde** (P/B, T/D, K/G, F/V, S/Z, vecteurs quasi-identiques).
- La **dictée est déjà à moitié implémentée** dans `app/omega-pendu.html` : route **lexicale** (`M_DICTEE_LEXICAL`, mémoire/homophones) + route **sublexicale** (`M_DICTEE_SUBLEXICAL`, EM phonème→graphème, généralise). Ce sont les deux voies du modèle DRC.

### Accents — résolu
- Surface ASCII (corpus inliné = `NFD + ASCII strict`), **mais les accents vivent dans le SAMPA** : é=/e/, è/ê=/E/ → table `PHON_TO_LETTERS` + prior `M4_PHON_USE_P` (seule bascule ON par défaut).
- **Lexique4 complet** : la colonne `1_Mot` est **accentuée** → en lexique, l'accent est un **lookup** (pas de reconstruction). Reconstruction phon→ortho réservée au **hors-lexique**.

### Données — Lexique4 complet (reçu via Drive→zip→upload chat)
- **188 863 mots, 37 colonnes.** `1_Mot` (accentué), `2_Phono` (SAMPA), `3_Phono_IPA`, `24_NbHomoph` (71,8 % ont des homophones), `15_NbLettres`/`16_NbPhons` (muettes), `33_Preval`+`11_FreqOrtho`+`26_SyllNb` (difficulté), `30-32` (morpho).
- **30 774 mots < 7 lettres (16 %)** → mots courts disponibles.
- ⚠️ Le `.tsv` de 34 Mo est **hors-repo** (trop gros) ; vit dans `/tmp/lex4/Lexique4.tsv` (volatile) ou chez Rem. `build_testset.py` attend ce chemin.

### Périmètre tranché (Phase 0.4)
**V1 assume mots courts + accents en sortie** (la source les fournit). Plus de blocage « ≥7 lettres ASCII ».

### Livré (Phase 0)
- `dictee/test_set.tsv` — **300 mots étiquetés** (homophone / voisée-sourde paire minimale / accent / muette ≥2 / contrôle), gradués en difficulté. Étiquetage **dérivé des colonnes** (reproductible, seed=42).
- `dictee/build_testset.py` — script de génération (repro). `dictee/README.md` — schéma + logique.
- Mis à jour + commités : `DICTEE_ROADMAP.md` (Phase 0.4 résolue, Phase 1 simplifiée).

### Limites connues
- `muette` reste fréquent (~61 % ; le français abonde en lettres muettes) — discriminant mais pas rare.
- Pas d'étiquette « régularisation » (graphie plausible mais fausse) — à ajouter au besoin.
- Décodage sublexical glouton (sans contexte) ; qualité moteur plafonnée ~0,80 ; voisée/sourde non résolue côté pendu (levier `M_PHON_CORRECTION` à activer/mesurer).

### Prochain pas
**Classifieur de diagnostic + mesure** sur `test_set.tsv` (doctrine « mesure d'abord ») : générer des erreurs synthétiques par catégorie, faire deviner le type au classifieur, **scorer** la classification → premier chiffre réel avant d'investir dans l'UI (Phases 1-2).

### Infra / contexte
- Travail mené depuis une session **cloud** (Claude Code web) : conteneur **éphémère** (rollbacks), connecteur Drive **cassé** (`requires approval` persistant), repo en scope = `omega-pendu-`.
- Donc : **tout artefact dictée est commité/poussé sur `claude/replace-repo-content-6jWzn`** → durable. Le suivi sérieux gagnerait à passer en **local** (cf. discussion VIVARIUM).

---

## 2026-06-13 (suite) — Baseline diagnostic mesuré + hypothèse M3_d cadrée

- **Baseline du classifieur** (`diag_baseline.py`, surface/phono, sans M3_d) mesuré sur 415 cas : **91,3 % exact**, **8,7 % ambigu**. Détail dans `diag_baseline_results.md`.
- **accent + voisée/sourde = 100 % décidables en surface** (M3_d inutile là).
- **Ambiguïté concentrée sur les homophones (27 %)** → seul le **sens** tranche.
- **Hypothèse M3_d (Rem) cadrée** : le latent sémantique orphelin pourrait enfin servir **à désambiguïser les homophones** — mais **uniquement en contexte** (indécidable sur mot isolé) → **argument pour la dictée de PHRASES**.
- Prochaine expérience falsifiable : un signal sémantique en contexte réduit-il le 27 % d'ambigu homophone ? (OFF-inerte, gardé si Δ mesuré).

---

## 2026-06-13 (suite 2) — Expérience M3_d : FALSIFIÉE au design

- Revue du code : `M3_d_step` encode `M1_d` (ortho) + option `M1_phon` ; **aucune entrée sens/contexte**.
- Donc M3_d **ne peut pas** désambiguïser les homophones (mauvais signal + pas de contexte), ET il n'y a pas de vrai problème (cible connue en dictée ; ambiguïté gérée en **multi-étiquette**).
- **Décision : on ne monte pas l'expérience A.** M3_d reste sans rôle **sémantique/homophone** (pas d'entrée sens/contexte) — c'est le rôle *sémantique* qui est nul, **pas M3_d globalement** : côté pendu, son readout `cLetterScore` est utile (+3,4 cheat-free, `AUDIT_OMEGA §3.1`, maj 17/06). Détail : `EXP_M3D_FALSIFIE.md`.
- **Pivot : on avance la surface** (Ph.1-2) — 91,3 % de diagnostic sans M3_d ; sémantique = signal externe à acter séparément si dictée de phrases un jour.

---

## 2026-06-13 (suite 3) — Module de diagnostic multi-étiquette livré

- `diagnostic.py` : `diagnose(cible, tentative[, phono])` → **liste de faits + feedback français** (accent, voisée/sourde, muette, homophone, autre). Multi-étiquette.
- `phono_homophones.json` : index compact (4994 groupes, ~197 Ko, mots freq≥1) pour détecter les homophones **sans** le lexique 34 Mo.
- **Mesuré sur `test_set.tsv` (415 cas) : rappel 93 %.** accent / voisée-sourde / muette = **100 %**. **Homophone = 58,6 %** — borné par la couverture de l'index compact (les homophones rares sont filtrés). Couverture pleine = lexique entier, dispo **en local**.
- Phase 1 accents : en lexique = la cible vient accentuée (rien à faire) ; détection d'erreur d'accent = 100 %. Reconstruction OOV (enrichir `PHON_TO_LETTERS`) = route app, **déférée au local**.
- Exemples de feedback validés (ex. « amenée ← amenèe » → accent ; « admettons ← admetton » → muette « s »).
- Reste (local/app) : UI de saisie (Ph.2), reconstruction accents OOV, couverture homophone pleine.

---

## 2026-06-14 — Partie dyslexie TERMINÉE (app + index plein)

- **Index homophones PLEIN** régénéré depuis Lexique4 (43 580 groupes, 2,1 Mo, sans filtre freq) → item 1 réglé.
- `diagnostic.py` re-mesuré : **rappel global 99,8 %** (homophone **58,6 % → 98,6 %**, accent/voisée-sourde/muette 100 %).
- **`dictee_app.html`** : application de dictée diagnostique **autonome** (un seul HTML) — 620 mots gradués (`word_pool.json`, dérivés Lexique 4), **dictée vocale** (TTS fr-FR), saisie, **diagnostic multi-étiquette + feedback dys**, correction révélée. Diagnostic JS porté de `diagnostic.py` (testé 6/6, identique).
- Reconstruction accents OOV : **non nécessaire** pour la dictée (les mots dictés viennent du lexique → accentués). Item clos.
- **État : le cœur dyslexie est complet et utilisable.** Reste optionnel : dictée de PHRASES (signal sémantique externe), polissage UI, validation terrain (orthophonistes).

---

## 2026-06-14 (suite) — Intégration FICHIER UNIQUE + recherche dyslexie + catégories enrichies

- **Recherche dyslexie multi-sources** (Tous à l'école, Happydys, Upbility, Lexidys, Cairn) : confirme la **double route** (dyslexie phonologique vs surface) et la **typologie en 4 familles** (phono / lexicale-surface / sémantique / morphosyntaxique). Profil voisée/sourde validé.
- **Catégories enrichies** selon la grille : ajout de **inversion** et **ajout** (famille phonologique), en plus de accent/voisée-sourde/muette/homophone. Morphosyntaxique (accords) noté comme **extension phrases** (mots isolés insuffisants).
- **Correction demandée par Rem : UN SEUL FICHIER.** La dictée est désormais un **panneau additif intégré dans `app/omega-pendu.html`** (IIFE, OFF-inerte, bouton « ✍️ Dictée diag »). Le fichier séparé `dictee_app.html` est **supprimé**.
- Diagnostic JS re-testé **8/8** (dont inversion + ajout) depuis le fichier injecté.

---

## 2026-06-14 (suite 2) — Cadre A choisi : DICTÉE DE PHRASES (brick mesuré)

- Décision Rem : **dictée de phrases** (le contexte = la phrase cible rend homophones ET accords gradables, **sans M3_d**).
- `dictee/sentences.json` : **30 phrases graduées** (10/10/10) + familles d'homophones par mot (depuis l'index plein).
- `dictee/diag_sentence.py` : tokenise → **aligne** (Levenshtein mots) → diagnostique chaque mot (accent/voisée-sourde/inversion/muette/ajout/homophone/**accord**/omission/mot_en_trop). `is_accord` distingue **accord** (diff flexionnelle s/e/t/x/n) vs **homophone lexical** (ver/verre).
- **Mesuré (30 phrases) : rappel accent/accord/homophone/omission = 100 %.** Casse gérée (comparaisons lower). Gain clé : **accords détectés** via contexte.
- Reste : porter dans le fichier unique (remplacer le mode mot-isolé), détecter la **surface/plausible** (leson→leçon), réconcilier diagnostic.py.

---

## 2026-06-14 (suite 3) — Dictée de PHRASES intégrée dans le fichier unique

- `app/omega-pendu.html` : le panneau « ✍️ Dictée diag » passe en **mode PHRASES** (remplace le mot-isolé). Dicte la phrase (TTS fr-FR), l'élève la retape, **feedback par mot** dont **accords** (contexte). Toujours OFF-inerte (IIFE).
- Logique JS portée de `diag_sentence.py` (align Levenshtein + diagWord + isAccord). Vérifiée depuis le fichier : accord/accent/correct OK.
- **Divergence audit résolue côté cadre** : la référence est désormais la **dictée de phrases** (`diag_sentence.py` = moteur Python de référence ; l'app = portage). `diagnostic.py`/`test_set.tsv`/`word_pool.json` = **legacy mot-isolé** (gardés pour historique + l'équipe Lexique).
- **Reste de l'audit** : (1) détecter la **surface/plausible** (leson→leçon → « autre » ; nécessite graphème→phonème) ; (2) **validation moins circulaire** / données réelles ; (3) **boucle de remédiation** (rejouer la famille la plus ratée) ; (4) message accent générique (ç/à/ô).

---

## 2026-06-14 (suite 4) — Détection SURFACE/plausible (audit HAUT #2 réglé)

- Ajout d'un **normaliseur phonétique** `norm()` (ph→f, ç→s, c doux→s, eau/au→o, ai/ei→e, qu→k, doubles consonnes, finales muettes…) : si la graphie élève **normalise comme la cible** mais s'écrit autrement → étiquette **surface** (au lieu de « autre »).
- Couvre la **dyslexie de surface** : *leson→leçon*, *bateau→bato*, *photo→foto*, *question→kestion*, *frèzes→fraises*.
- Limites honnêtes : *femme* (em→/a/ irrégulier), nasales — non couverts.
- Intégré dans `diag_sentence.py` **et** l'app (fichier unique). **Mesuré : surface 17/17 = 100 %, zéro régression** (accent/accord/homophone/omission toujours 100 %).
- **Scorecard audit** : 🔴 isolé ✅ · divergence ✅ · casse ✅ · **surface ✅** · reste : validation moins circulaire, boucle de remédiation, message accent générique.

---

## 2026-06-14 (suite 5) — Boucle de REMÉDIATION (audit item réglé)

- Phrases **taguées** (`sentences.json` : champ `traps`) avec les familles qu'elles peuvent exercer (depuis le lexique) : accent/accord/homophone/voisée-sourde/muette.
- App (fichier unique) : **profil d'erreurs persistant** (localStorage `vdd_profile`, compteur par famille) + **sélection ciblée** : 65 % du temps, la phrase suivante exerce la **famille la plus ratée** (« on travaille : accord »). Affichage du profil + bouton réinitialiser.
- Le diagnostic ne fait plus que constater : il **oriente l'entraînement** (intervention, comme le préconise la recherche). Bloc app **compile sans erreur de syntaxe**.
- (Remédiation = logique UI/session, app-only ; `diag_sentence.py` reste le moteur de diagnostic de référence.)

---

## 2026-06-14 (suite 6) — Audit projet : correctifs appliqués

- **1** vivarium **retiré** du repo (vit ailleurs/privé). **3** legacy mot-isolé → `dictee/legacy/`. **2** banner sécurité en tête de `omega-key/README`. **5** CI minimale (`.github/workflows/ci.yml` : mesure `diag_sentence` + syntaxe bloc dictée) + README monorepo.
- **4 Compression du lexique** : `app/omega-pendu.html` **16 Mo → 5 Mo**. Le bloc `application/json` (15,5 Mo) devient `text/plain` **gzip+base64** (3,4 Mo gz) ; `loadOmegaLex4` (déjà `async`) décompresse via `DecompressionStream`. **Vérifié headless : 83 605 mots décompressés + parties jouées** → moteur intact (OFF-inerte, R66). Harnais evo mis à jour (gz + async).

---

## 2026-06-17 — Diagnostic DÉVELOPPEMENTAL par stade (Ferreiro/Berliocchi)

- **Apport** : lecture du mémoire Berliocchi (2022, conscience phonologique / entrée dans l'écrit) → les familles d'erreurs ne sont pas une liste plate, elles révèlent un **stade** (genèse de l'écriture, Ferreiro). Ajout d'une couche **développementale** sur `diag_sentence.py` (additif, réutilise `diag_word` ; familles toujours 100 %).
- **Mapping** (4 bandes, du plus amont au plus avancé — la GRAMMAIRE est l'apex) :
  - **phonologique** (voisée-sourde · inversion · ajout) → le SON mal perçu/segmenté (conscience phonémique ; l'axe dyslexie-phono d'OMEGA) ;
  - **alphabétique** (surface · accent) → écrit « comme ça sonne », pas l'ortho conventionnelle ;
  - **lexical** (muette · homophone) → orthographe du MOT (lettres muettes lexicales, homophone lexical) ;
  - **morphosyntaxique** (accord) → **GRAMMAIRE** : accords genre/nombre/verbal, sans indice sonore — **le palier le plus tardif = le prochain gros levier**.
- **Fonctions** : `stage_of_fact(types)` (par mot, le stade le plus AVANCÉ l'emporte → la famille spécifique prime sur le détecteur structurel `ajout/muette` co-déclenché ; un « élèves→élève » tagué muette+accord monte ainsi en **morphosyntaxique** = bien diagnostiqué « grammaire ») ; `developmental_diagnosis(facts)` → stade = **bande la plus en amont où il bute** + message.
- **Graine du levier grammaire** : `accord_type(t,s)` → **nombre / genre / verbal** (heuristique SANS POS). Démo : « répète→répètent » = accord **verbal** (sujet-verbe), « élève→élèves » = **nombre**.
- **Mesuré** : élèves « purs » par stade → **4/4 bien placés** (phono/alpha/lexical/morphosyntaxique). Familles toujours 100 %, additif (réutilise `diag_word`).
- **Lien cognition** (session moteur) : cohérent avec l'audit M3_d — les **cellules-concept = latent de FORME** = candidat signal de **stade précoce** (pré-syllabique/syllabique).
- **PROCHAIN GROS LEVIER = la grammaire** (morphosyntaxe), maintenant posée comme apex : il faudra la **catégorie grammaticale (POS)** + l'**accord à distance** (sujet-verbe, participe passé, chaîne d'accords du GN) — `accord_type` n'en est que la graine sans POS. C'est là que le contexte de la phrase (raison d'être de la dictée de PHRASES) paie le plus.
- **Reste aussi** : porter dans l'app (panneau affiche encore les familles seules) ; grain syllabe (Berliocchi : syllabe→rime→phonème) ; axe **temporel/rythmique** non couvert (OMEGA segmental) — limite honnête.

---

## 2026-06-17 (suite) — Levier GRAMMAIRE : 1ʳᵉ jonction (accord sujet-verbe en contexte)

- **Démarrage du gros levier grammaire** (posé apex à l'entrée précédente). Astuce §5 : le **nombre** se lit sur les **mots-outils en classe fermée** (déterminants `le/les…`, pronoms `il/ils…`) → pas besoin de taguer tous les mots ni de Lexique4-full (hors-repo ; le lexique embarqué n'a ni POS ni les mots courts).
- `governor_number(T, idx)` : remonte au **gouverneur** d'accord (pronom sujet / déterminant le plus proche à gauche) → son **nombre**. `diagnose_sentence` enrichit toute erreur d'accord : `grammaire` = **sujet-verbe** (si `accord_type='verbal'`) ou **groupe nominal**, + le gouverneur et le message (« accord sujet-verbe : « Les » pl → accorder « répètent » »). C'est ici que le **contexte de la phrase paie** (raison d'être de la dictée de PHRASES).
- **Mesuré (30 phrases)** : gouverneur identifié sur **82 %** des erreurs d'accord ; **accord sujet-verbe détecté sur 93 %** des accords verbaux. Familles 100 %, 4/4 stades, additif.
- **Limites honnêtes** : heuristique sujet = plus-proche-déterminant/pronom à gauche (OK en SVO, pas tous les cas — sujet nom propre, sujet à distance, inversion) ; `genre -e` vs `verbal -e` toujours ambigu sans **POS** ; participe passé, chaîne complète du GN, accord à longue distance = **suite du levier**.
- **Suite du levier grammaire** : POS (catégorie grammaticale) pour lever l'ambiguïté genre/verbal et le sujet réel ; participe passé ; accords du GN multi-mots ; porter dans l'app.

---

## 2026-06-17 (suite 2) — Levier grammaire : POS-contexte (désambiguïsation nom/verbe)

- **Continuation du levier grammaire.** Constat données : `lit`, `porte`, `court`, `calme`, `vend` sont **nom ET verbe** selon la phrase (« le lit » nom / « papa lit » verbe) → un POS plat est faux, il faut le **contexte**. C'est la substance grammaticale.
- **POS-contexte léger** (`is_verb(T,idx)`) : lexique de **formes verbales** du corpus + règle « précédé d'un déterminant → nom, pas verbe ». Pas besoin de POS complet ni de Lexique4 (hors-repo).
- **Effet** : `accord_type` désambiguïse enfin **genre -e vs verbal -e** (le verbe prime via le contexte) ; le label **sujet-verbe vs groupe-nominal** repose sur `is_verb` (contexte), plus sur le suffixe.
- **Mesuré** : désambiguïsation homographes nom/verbe **5/5** (`lit@0`=nom, `lit@4`=verbe, `verre@2`=nom, `porte@12`=verbe, `calme@26`=verbe) ; gouverneur 82 %, accord sujet-verbe **94 %**. Familles 100 %, 4/4 stades.
- **Limites / suite** : lexique verbal **du corpus** (ne scale pas → un tagger ou Lexique4-`cgram` pour un corpus plus grand) ; sujet = plus-proche-gouverneur-gauche (rate le sujet à distance avec PP intercalé) ; **participe passé** (accord avec être/avoir) = prochaine jonction grammaire ; portage app.

---

## 2026-06-17 (suite 3) — Grammaire : participe passé + sujet à distance + scaling

- **(1) Participe passé** : `is_participle` + `find_aux` → accord **avec être** (= sujet) vs **avec avoir** (invariable sauf COD antéposé). Message dédié (« participe passé avec être : accord avec le sujet « X » pl »). **Mesuré 7/7** participes du corpus détectés.
- **(2) Sujet à distance** : `governor_number(..., skip_pp=True)` saute les déterminants de **groupe prépositionnel** pour un verbe/participe-être → trouve le **vrai sujet**. Démo : « Les vers **de la terre** creusent » → sans skip = « la » (sg, faux) ; skip_pp = « Les » (pl, vrai sujet **et bon nombre**).
- **(3) Scaling POS** : repli **morphologique** sous le lexique corpus (`VERB_SUF` = -ons/-ez/-aient/-ait/-èrent/-irent/-issent, **pas** -ent trop ambigu ; stoplist adverbes). is_verb marche au-delà des 30 phrases pour les formes conjuguées claires. Limite honnête : pour un grand corpus → tagger ou Lexique4-`cgram`.
- **État** : familles 100 %, 4/4 stades, homographes 5/5, gouverneur 82 %, sujet-verbe 94 %, participe 7/7. Tout additif, moteur de référence `diag_sentence.py`.
- **Reste = (4) portage app** (en cours) : faire remonter stade + grammaire dans le panneau « ✍️ Dictée diag ».

---

## 2026-06-17 (suite 4) — Portage APP : stade + grammaire dans le panneau dictée (point 4)

- **Porté dans `app/omega-pendu.html`** (bloc IIFE « ✍️ Dictée diag », OFF-inerte) le levier complet : `NUM_DET/NUM_PRON/PREP`, `governorNumber(skip_pp)`, `VERB_FORMS`+repli morpho `isVerb`, `AUX_*`/`PART_FORMS`/`isParticiple`/`findAux`, stades `STAGE_*`/`stageOfFact`/`developmental`. `diagnoseSentence` enrichit chaque erreur d'accord avec `fact.gram` (relation grammaticale).
- **UI** : sous chaque faute d'accord, une sous-ligne « → accord sujet-verbe : « Les » pluriel → accorder « répètent » » (ou GN, ou participe passé être/avoir) ; et un encart **« Stade : … »** (phonologique→morphosyntaxique) avec message pédagogique. (L'app montre la *relation* grammaticale, pas le tag nombre/genre — plus actionnable.)
- **Vérifié** : CI syntaxe (`new Function`) OK ; **parité Python** testée sur les helpers portés — homographes nom/verbe 5/5, gouverneur+skip_pp, participe/findAux, `developmental` → mêmes résultats que `diag_sentence.py`. Aucune référence pendante. Baseline pendu intacte (additif IIFE).
- **Les 4 points enchaînés livrés** : (1) participe passé, (2) sujet à distance, (3) scaling morpho, (4) portage app.
- **Suite** : grammaire — accord du GN multi-mots (déterminant-nom-adjectifs en chaîne), participe passé avec COD antéposé, vrai tagger/Lexique4-`cgram` pour scaler le corpus ; validation terrain (orthophonistes).

---

## 2026-06-20 — Décomposeur « à la Lexique 4 » : base de décomposition (son/ortho/morpho/grammaire) + cognition phono→ortho

Demande : *« un truc qui lit et apprend des mots, les décompose comme dans Lexique 4 »*. Livré comme **base de décomposition** (décrit, ne corrige pas), en réutilisant l'existant OMEGA (doctrine §A2/A4). **Mesuré held-out** (seed 42, test=4000), gardé par CI + asserts. **PR #10 mergée dans `main`** (`d7d65b5`).

- **`decompose.py` — double voie SON · ORTHO · MORPHO**, qui apprend (`learned_lex.json`, **FP=0**). SON = phono lexicale (`phono_homophones.json`, exacte) × sublexicale (`g2p()` de l'app **extrait** en `g2p_tables.json`). ORTHO = graphèmes + syllabes (alignées noyaux). MORPHO = route lexicale `md/mb` (`morpho.json`, décodé d'OMEGA_LEX4, 20 523 mots) × repli sublexical affixes.
- **Route sublexicale améliorée +3,7 pts** (échelle held-out) : **48,6 %** (g2p brut) → **50,9 %** (+SEG enrichi, 8 segments **mesurés**, `ion/ue/oui` testés et **écartés**) → **52,4 %** (+correction apprise par **boucle descendante** : alignement DP g↔phono Lexique sur TRAIN, 667 règles, `build_g2p_corrections.py`). Syllabation par **règles** (attaque maximale, son+ortho calqués).
- **Croisé/validé contre la vérité Lexique** (OMEGA_LEX4 décodé, 64 634 mots) : ma **nbsyll = 100 %** du `syll` gold ; mon CV = convention `cvp` (désaccords = diacritiques `:`/`'` seuls).
- **Cognition phono→ortho** (`p2g.py` + `P2G.md`) — **l'inverse** (son→écriture, *le* point dur dys). Jointe **§3** : beam-search marginalisant la segmentation latente, **triple croisement** émission × prior ortho bigramme × **lexicalité**. Held-out : top-1 **26,7 %** · top-3 **64 %** · top-5 **73 %** (lexicalité = gros levier ; plafond bridé par 2,3 homophones/son ; **fréquence testée et rejetée**, §6.4). Dette §A2 consignée : le moteur a déjà `L2[φ]→graphème` (+5,28 OOV), `_neoCRS`, `_neoDeclareOSmix`.
- **Décompo PARALLÈLE 3 voies** (`decompose_corpus.py`) : ORTHO ∥ PHON ∥ GRAMMAIRE (cgram/genre/nombre/morpho **+ rôle en contexte** via `diag_sentence`). **Lit le corpus réel** `corpus_gec_fr.jsonl` (98 paires, fourni en local) → enrichit la base (1487 mots → 770 distincts) ; **grammaire en contexte STOCKÉE** (`learn_word(role=…)` → compteurs : `la→{déterminant:61}`, `est→{verbe:25}`, `important→{accord-sg}`).
- **Compressibilité de la base** (`compress_probe.py`) : 7,9× gzip, **17× factorisé** ; 51 % des phonos déductibles par g2p → lexique d'exceptions.
- **Panneau app « 🔤 Décompose »** (IIFE OFF-inerte, réutilise `_DECL2.g2p` + `OMEGA_LEX4` md/mb/OLD20/PLD20). Isolé dans un **`<script>` séparé** → **zéro adjacence** avec le correcteur (le correcteur — `correcteur_probe.py` et panneau `vdc` — **jamais touché**, prouvé byte-identique).
- **ACCENTS** : solution **déjà présente** (lookup en lexique `1_Mot` + phonème porte l'accent `PHON_TO_LETTERS`) — appliquée par decompose/p2g, rien à réinventer.
- **Garde-fous** : `test_decompose.py` (21 asserts + seuils held-out qui font échouer la CI). CI : `build_g2p_tables`/`build_morpho`/`build_g2p_corrections`/`decompose --measure`/`build_p2g`/`p2g --measure`/`test_decompose`/`decompose_corpus --show` + compile des 2 blocs app.
- **Audit honnête** : sublexical plafonné ~52 % (g2p heuristique) ; p2g top-1 ~27 % (homophonie). Suite possible : brancher p2g dans la dictée (proposer les graphies sur un son), réutiliser `L2`, nourrir la base de plus de données réelles.
