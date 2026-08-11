# AUDIT DU CORRECTEUR — app · extension · Python (2026-08-11)

Demande de Rem : *« énormément de modifications sur un correcteur déjà mature ; il me faut un audit
profond : app et extension, liaison, bugs et conflits, valider les corrections et leur ordre, pas
d'omission, ce qui est rouge / orange / vert »*.

Tout ce qui suit est **mesuré**, pas lu. Les scripts d'audit sont reproductibles (§7).

---

## 1. Verdict en une page

| dimension | verdict | suite |
|---|---|---|
| Registres des 3 moteurs | ✅ **55 règles branchées partout**, même compte | — |
| Ordre d'exécution app ↔ extension | ✅ **identique**, rang par rang | — |
| **Ordre OPTIMAL ?** | ✅ **oui, mesuré** (§9) | — |
| Divergence de correction entre moteurs | ✅ **aucune** sur 24 cas construits + 328 phrases de parité | — |
| Règles jamais déclenchées | ⚠️ 21 sans tir sur nos corpus → **les 55 sont vivantes** (§10) | ✅ **CLOS** |
| Bug `son/sont` | ❌ ne tirait que si le tagger se TROMPE (§4) | ✅ **CORRIGÉ** |
| Rouge / orange | ⚠️ la grammaire n'avait pas de tier (§5) | ✅ **CORRIGÉ** |
| **Liaison app ↔ extension** | ❌ l'app appliquait la grammaire, l'extension jamais (§6) | ✅ **CORRIGÉ** |
| Typographie (6 règles) | ✅ présentes et actives **dans les 2 surfaces**, banc CI dédié (§11) | — |
| Arbitrage interne du speller | ✅ **cohérent** : plus la route est incertaine, plus elle est orange (§12) | — |
| Blocages mutuels entre voisins | ✅ **0,3 % de résiduel** mesuré (§13) | — |
| FP `rock n'roll` | ❌ deux listes d'exceptions divergentes (§10) | ✅ **CORRIGÉ** |
| **Ce que chaque surface applique** | ❌ le `tier` ne le dit pas : site 328 corr. / extension 269 (§6 bis) | ✅ **MESURÉ** |
| **Maximiser le rouge** | ✅ 2ᵉ sous-ensemble affirmable trouvé : le **glissement moteur** (§12 bis) | ✅ **LIVRÉ** |
| **Moteur standalone livré** | ❌ ne chargeait que le speller → grammaire du nombre MUETTE (§6 ter) | ✅ **CORRIGÉ** |
| **3ᵉ sous-ensemble affirmable** | ⛔ cherché, **PAS trouvé** — plafond atteint (§12 ter) | ⛔ **RÉFUTÉ** |
| **Infinitif de but** | ✅ « allé à la plage mangé »→manger, FP=0 (§12 quater) | ✅ **LIVRÉ** |

Les quatre défauts sont réparés dans la même PR ; les mesures d'avant/après sont conservées
ci-dessous parce qu'elles expliquent POURQUOI le correctif est ce qu'il est.
Les deux dernières lignes sont l'**addendum du 2026-08-11**, après la doctrine de Rem : *« une faute
est une faute, point ; c'est pour ça qu'il faut maximiser le ROUGE pour diminuer l'ORANGE »*.

---

## 2. Registres — aucune omission

| moteur | règles au registre | fonctions définies | non branchées |
|---|---|---|---|
| Python (`correcteur_probe.py`) | **55** | 56 | `rule_genre_adj` |
| app (`omega-pendu.html`) | **55** | 54 | aucune |
| extension (`dys-core.js`) | **55** | 54 | aucune |

- `rule_genre_adj` est **volontairement** hors registre, et le code le documente : mesurée FP-insûre
  (« presque toutes les formes adjectivales sont aussi des NOMS dans Lexique4 »). Ce n'est pas un oubli.
- **L'ordre d'exécution est identique** entre l'app et l'extension : les 55 rangs coïncident.
- 42 **noms** de règle pour 55 fonctions : « accord sujet-verbe » recouvre à lui seul **13 fonctions**.
  Conséquence : l'explication pédagogique, indexée par nom, est **la même pour ces 13 règles**.
- Un seul écart d'étiquette Python ↔ app : `-é/-er` contre `accord grammatical (é/er)`. La parité ne
  le voit pas (elle compare `index|mot|suggestion`, pas le nom).

---

## 3. Déclenchement réel — 7 960 phrases

Instrumentation de chaque règle sur : dys réel (gold), paires dys, corpus de Rem, GEC-100, GEC-fr,
multi-fautes (1 000), er/é/ez/ai, impératif, WiCoPaCo real-word (4 000), UD 2500 (texte correct).

**34 règles tirent. 21 ne tirent jamais.** Ce n'est pas un verdict de mort : nos corpus sont du
Wikipédia (WiCoPaCo) et du texte édité (GEC), pas de l'écrit dys. Passées à des phrases
déclenchantes construites d'après leur propre docstring, **15 sont confirmées vivantes dans les 3
moteurs** :

`ête`→été/es · `dont` invariable · participe épithète · `ce suis`→je · `je c'est`→sais ·
`je suis la`→là · `j'est`→j'ai · `c'ai`→c'est · `elles sente`→sentent · coordination ·
sujet postposé · verbe coordonné · relative objet · incise · aux mal orthographié ·
`met`→mais · `a allé`→est · `mais lunettes`→mes.

⚠️ **Aucune divergence entre Python, app et extension sur ces 24 cas.** C'est le point le plus
rassurant de l'audit sur la question « liaison ».

Restaient 2 règles sans confirmation (`rule_elide`, `rule_accord_sv_infinitif`) — **traitées en
§10 : elles vivent aussi.** Aucune règle morte dans le correcteur.

---

## 4. LE BUG : `son/sont` ne tire que si le tagger se trompe

```
les chats son venus    tags=[DET, NOUN, AUX,  VERB]  → garde=False → RIEN
les chats son partis   tags=[DET, NOUN, DET,  NOUN]  → garde=True  → sont ✓
les chats son allés    tags=[DET, NOUN, DET,  NOUN]  → garde=True  → sont ✓
les chats son mangés   tags=[DET, NOUN, DET,  ADJ ]  → garde=True  → sont ✓
```

La branche « prédicat » de `rule_son_sont` exige *aucun verbe fini dans la proposition*
(`_clause_no_finite_verb`). Or ce balayage **compte le participe que la règle vise elle-même**. Il
n'exclut que la case du mot corrigé (`i`), pas celle du prédicat (`i+1`).

⇒ La règle ne se déclenche **que lorsque le tagger étiquette mal le participe** (NOUN/ADJ). Quand il
fait correctement son travail — `venus` = VERB — elle abstient. **Améliorer le tagger DIMINUERAIT le
rappel de cette règle.**

C'est d'autant plus gênant que `venir` est un des verbes les plus fréquents du français, et que
« les enfants son venus » est une faute dys typique.

**Correctif mesuré** (exclure aussi `i+1` du balayage) :

| | avant | après |
|---|---|---|
| `les chats son venus` | RIEN | **sont** ✓ |
| `les enfants son venus` | RIEN | **sont** ✓ |
| `les chats son partis` | sont | sont |
| **FP sur UD 2500** | 38 phrases / 41 flags | **38 / 41 — identique, 0 nouveau** |

✅ **LIVRÉ** : `_clause_no_finite_verb(T, i, skip)` — l'appelant passe la case de son prédicat. Les
autres appelants gardent le comportement d'avant (paramètre optionnel). Miroir dans les 3 moteurs.
Garde CI : les 4 formes (`venus`/`partis`/`dans le jardin`/contrôles) sont dans l'échantillon de
parité, et les phrases correctes (« le son de la cloche », « son ancienne équipe ») y sont aussi.

---

## 5. Rouge / orange — la décision n'est pas dans le moteur

L'affichage de l'app tranche avec **une seule fonction** :

```js
function _dfltOn(f){
  if(f._fuseOn!=null)  return f._fuseOn;   // fusion de span : hérite
  if(f.span>=2)        return false;       // multi-mots (espacement, répétition, trait d'union)
  if(f.tier==='vigilance') return false;   // ORANGE
  if(f.src==='g')      return true;        // ⭐ TOUTE la grammaire → appliquée
  if(f.tier==='auto')  return true;        // speller confiant
  if(f.tier==='flag' && f.name==='orthographe') return true;
  return false; }
```

⚠️ **Le rouge de la grammaire n'est pas une propriété du flag** : il est déduit de `src==='g'` au
moment du rendu. Mesuré sur le moteur autonome (`dictee/correcteur.js`) : sur 1 506 corrections,
**416 sortent sans aucun tier** — toutes les règles de grammaire (`mai/mais`, `on/ont`, `ce/se`,
`des/dès`, `a/à`, `accord sujet-verbe`, `accord participe`…).

Conséquence : **quiconque intègre le moteur autonome ne peut pas savoir ce qui est sûr** sans
réimplémenter `_dfltOn`. Le moteur et l'interface n'étaient pas d'accord sur l'endroit où vit la
décision rouge/orange.

✅ **LIVRÉ — le rouge est maintenant PORTÉ par le flag** : `tier:_vg||'auto'` dans `correctTokens`
(app et extension). Le code documentait déjà l'intention (« *{sugg,vig:1} → vigilance ; string =
rouge* ») ; elle est désormais matérialisée. Aucun changement de comportement dans l'app —
`_dfltOn` renvoyait déjà `true` sur `src==='g'` avant même de lire le tier. Les 2 règles qui
renvoient `{vig:1}` restent orange. Garde CI : toute correction de grammaire doit sortir avec un
tier, vérifiée en la cassant.

⚠️ **Nuance de vocabulaire, à ne pas confondre** : « la grammaire est rouge » ne veut pas dire
« FP = 0 littéral ». Mesuré : sur 2 500 phrases correctes, la grammaire tire **20 fois** — soit
0,8 % des phrases, appliquées d'office. C'est sous le plafond du banc, ce n'est pas zéro.

### Ce que le correcteur marque sur du texte CORRECT (UD 2500)

| tier | marques | lecture |
|---|---|---|
| `vigilance` (orange) | 267 | flood assumé — dont **170 « mot inconnu »** |
| `flag` | 32 | orthographe proposée |
| (sans tier) grammaire | 20 | ⚠️ appliqué par défaut dans l'app |
| **`auto` (rouge)** | **14** | la couche affirmative |

⇒ **« FP = 0 » porte sur la couche ROUGE de la grammaire**, pas sur le signalement total : sur
2 500 phrases correctes, le correcteur marque quand même 333 fois, dont 249 phrases touchées.
Ce n'est pas une contradiction — c'est la doctrine ORANGE — mais la formule « FP=0 » seule est
trompeuse si on ne précise pas la couche.

---

## 6. LIAISON app ↔ extension : la grammaire n'a pas le même statut

| | app | extension |
|---|---|---|
| corrections de grammaire | **appliquées par défaut** (`src==='g'` → ON) | **jamais appliquées** |
| orthographe `auto` | appliquée | appliquée en silence |
| vigilance / orange | proposée | proposée |

Vérifié sur le moteur, pas sur la lecture — toutes les corrections de grammaire sortent avec
`tier: null`, et `content.js` ne pose en silence que `f.tier === 'auto'` :

```
« les enfants son partis. »   son→sont   [son/sont]           tier=null → appliqué : 0/1
« il a allé au cinéma. »      a→est      [usage être/avoir]   tier=null → appliqué : 0/1
« Marie est venu. »           venu→venue [accord participe]   tier=null → appliqué : 0/1
« les enfant joue. »          ×2 accords                      tier=null → appliqué : 0/2
```

**Le même texte est donc corrigé dans l'app et seulement signalé dans l'extension.**

✅ **LIVRÉ — décision de Rem : « la correction grammaticale doit se faire dans l'extension comme
sur l'app ».** Le correctif est celui du §5 : en portant le tier `auto` sur la grammaire, le filtre
existant de `content.js` (`f.tier === 'auto'`) l'inclut, et `applyAutos` l'applique — avec sa garde
déjà en place « jamais le mot sous le curseur (en cours de frappe) ». Aucune ligne d'UI à changer :
c'était bien le moteur qui mentait par omission.

Vérifié sur le moteur de l'extension :

```
« les enfants son partis. »   son→sont[auto]      → appliqué
« Marie est venu. »           venu→venue[auto]    → appliqué
« les enfant joue. »          ×2 accords [auto]   → appliqués
« il a allé au cinéma. »      a→est[auto]         → appliqué
```

### 6 bis. ⚠️ Ce que chaque surface applique VRAIMENT — le tier ne le dit pas (2026-08-11)

L'audit lisait le `tier` du moteur. Or **aucune des deux surfaces n'applique « le tier »** :

* **site** — `_dfltOn` coche par défaut : `auto` **+** grammaire non-vigilance **+ TOUT `flag`
  orthographe** ;
* **extension à la frappe** — `applyAutos` ne pose en silence que `tier === 'auto'`.

Mesuré sur 474 phrases dys/GEC appariées, avec la règle réelle de chaque surface :

| | tirs | juste | à côté | sur mot correct | précision |
|---|---|---|---|---|---|
| **site** (coché par défaut) | 328 | 275 | 42 | 11 | **83,8 %** |
| **extension** (silence à la frappe) | 269 | 236 | 22 | 11 | **87,7 %** |
| seulement proposé (les deux) | 260 | 110 | 124 | 26 | 42,3 % |

Rappel de ce qui est **appliqué** sur les 1 076 fautes réelles : site **25,6 %**, extension **21,9 %**.

> ⚠️ **Chiffres corrigés le 2026-08-11 (2ᵉ passe).** La 1ʳᵉ version de ce tableau disait 244 / 159 :
> la sonde n'appelait que `loadSpellerLex()`, donc `rule_noun_plural`, `rule_det_gender` et les
> règles qui interrogent le POS-tagger étaient **MUETTES**. Voir §6 ter — la cause était dans le
> loader LIVRÉ, que la sonde recopiait.

⇒ **59 corrections d'écart**, toutes des `orthographe/flag` : `proffesseur→professeur`,
`conexion→connexion`, `soeur→sœur`, `tirroir→tiroir`… Ce n'est PAS le même défaut qu'au §6 : ces
corrections sont bien **proposées** dans la bulle de l'extension et appliquées par son « tout
corriger ». L'écart porte sur le **silence** — et il est justifié : réécrire un champ pendant que
l'utilisateur tape demande une barre plus haute que pré-cocher une case dans une barre qu'il relit.

⭐ **Leçon de méthode : mesurer « le rouge » comme `tier === 'auto'` décrit l'extension, pas le
site.** Interroger le moteur ne suffit pas quand chaque surface a sa propre règle d'application.

Le §12 bis referme 24 de ces 59 en promouvant le sous-ensemble **mesuré FP=0**, sans toucher aux
autres — dont la précision ne permet pas le silence.

### 6 ter. ⚠️ LE MOTEUR STANDALONE LIVRÉ ÉTAIT À MOITIÉ CHARGÉ (2026-08-11)

Rem : *« pourquoi tu fais pas tes tests dans mon Chrome au lieu de construire des harnais bancals ? »*
Réponse : parce que mes harnais recopiaient **le loader livré**, et **le loader livré était faux**.

`dictee/correcteur.js` — le moteur « sans UI » que le dépôt propose aux intégrateurs, et que deux
checks de la batterie exercent — n'appelait que `loadSpellerLex()`. Résultat mesuré **avant**
correctif, et confronté au vrai navigateur sur omegapendu.com :

| entrée | `correcteur.js` | le SITE |
|---|---|---|
| « les chien aboient » | `[]` | `chien→chiens` **ROUGE** |
| « des oiseau dans le ciel » | `[]` | `oiseau→oiseaux` **ROUGE** |
| « Les enfant joue et il sont content » | `[]` | 2 accords **ROUGES** |

`rule_noun_plural` et `rule_det_gender` sortent immédiatement sur `if(!NOUN_POST)`. Un intégrateur
recevait donc un correcteur **sans grammaire du nombre ni du genre**, sans aucun signal.

⭐ **Et la première garde que j'ai écrite contre ça ne servait à rien** : le bouchon DOM renvoyait un
`stub` pour tout id inconnu, donc `loadNounPost` construisait une table **vide mais non nulle** — la
garde « NOUN_POST est-il chargé ? » répondait **oui** sur du vide. *Un bouchon qui répond à tout ne
peut pas signaler ce qui manque.* Corrigé : liste EXPLICITE des blobs, `equipe()`, et 3 cas d'accord
du nom dans l'auto-test — qui ne passent que si la table est réellement là.

⭐⭐ **Leçon de méthode, la plus chère de la journée : la vérité est dans le navigateur.** Le harnais
Node reste nécessaire pour l'échelle (14 450 phrases × 2 variantes), mais il doit être **confronté à
la page réelle** avant qu'on croie ses chiffres — et porter un contrôle qui échoue s'il est mal
équipé, pas seulement s'il trouve peu.

---

## 7. Reproduire

Scripts d'audit (scratchpad de session, non commités) :
`audit1_registres.py` (registres et ordre) · `audit2_tirs.py` (déclenchement sur 7 960 phrases) ·
`audit3_cas.py` (cas construits, 3 moteurs) · `tiers2.js` (rouge/orange par règle).

Bancs déjà en CI qui couvrent ces dimensions : `parity_corr.js`, `extension/parity_core.js`,
`fp_scale_probe.py`, `messy_probe.js`, `test_speller_app.js`, `prenoms_probe.py`.

---

## 8. Ce que l'audit n'avait pas couvert — COUVERT DEPUIS (§10 à §13)

Les quatre points laissés ouverts au premier passage ont été traités : §10 les règles restantes ·
§11 la typographie · §12 l'arbitrage du speller · §13 les blocages mutuels. Reste hors périmètre :
l'ergonomie, et la calibration de l'orange contre la fatigue du lecteur (elle demande un vrai
utilisateur, pas un banc).
- Les **blocages mutuels** hors concurrence sur un même token (un cas connu est documenté dans le
  code pour `j'est mangez` : deux fautes adjacentes qui s'empêchent). §9 mesure la concurrence SUR
  UN TOKEN, pas l'interaction entre tokens voisins.


---

## 9. L'ordre est-il OPTIMAL ? — mesuré

`correctTokens` prend la **première** règle qui répond sur un token, puis s'arrête (`break`) :
l'ordre du registre **est** une priorité. On a donc désactivé le `break`, collecté TOUTES les
réponses, et comparé le gagnant au corrigé de référence sur **1 460 phrases appariées** (dys réel,
GEC, multi-fautes, er/é/ez/ai, impératif).

| | |
|---|---|
| tokens où **plusieurs** règles répondent | **155** |
| la première a raison | **150** |
| ⚠️ une règle **masquée** avait la bonne réponse | **0** |
| aucune n'avait la bonne (hors sujet) | 5 |

⇒ **La priorité ne coûte jamais une correction juste sur ce corpus.** L'ordre est optimal au sens
mesurable du terme. À re-mesurer après tout ajout de règle : c'est le banc qui le dit, pas
l'intuition.


---

## 10. Les règles « sans déclencheur » — il n'en restait que DEUX, et elles vivent

Recomptage : sur les 21 sans tir, 19 étaient déjà confirmées. Les 2 dernières étaient testées **à
l'envers** de ce qu'elles font.

| règle | ce qu'elle fait vraiment | vérifié |
|---|---|---|
| `rule_elide` | **dé-élide** : une élision suivie d'une CONSONNE est impossible en français | `j'mange`→je mange · `d'la`→de la · `qu'tu`→que tu · `m'donne`→me donne · `n'sais`→ne sais · `j'ai` intact |
| `rule_accord_sv_infinitif` | sujet = **INFINITIF** en tête de proposition | `Fumer nuisent`→**nuit** · `Manger trop font`→**fait** · phrases correctes intactes |

⇒ **Les 55 règles sont vivantes.** Aucune règle morte dans le correcteur.

### ❌ Et un FAUX POSITIF trouvé en les testant : `rock n'roll` → « rock ne roll »

Cause : **deux règles jumelles avec deux listes d'exceptions différentes.**

```python
rule_elide     : _ELIDE_STOP = {"n'roll", "m'sieur"}
rule_deselide  : ("m'sieur", "m'dame", "m'ame")        ← pas de n'roll
```

Quelqu'un avait bien prévu `rock n'roll` — **dans la mauvaise liste**. Et côté JS c'est l'autre
règle qui traitait le cas, donc la même exception manquait à un troisième endroit.
⭐ **Deux listes pour une même garde DÉRIVENT toujours.** ✅ **LIVRÉ : liste UNIQUE** dans les 3
moteurs (`n'roll`, `m'sieur`, `m'dame`, `m'ame`, `c'te`). Mesuré après : `rock n'roll` et
`c'te histoire` abstiennent, `j'sais`→je sais et `d'la`→de la intacts.

---

## 11. Typographie — déjà auditée et gardée

6 règles, toutes vérifiées présentes ET actives dans **l'app et l'extension** :
`espace après la virgule` · `espace avant la ponctuation` · `espace double` · `virgule doublée`
(les 4 en **rouge**) · guillemets `"`→« » · `...`→… (en **orange**).

Un banc dédié existe déjà en CI : **`dictee/typo_probe.js` — 38 cas, parité sur les 2 surfaces**,
et il extrait la fonction des fichiers LIVRÉS (« une garde qui teste sa propre copie ne garde
rien »). Sa docstring porte la mesure qui autorise le rouge ici : **2 déclenchements sur 14 450
phrases UD correctes, et les DEUX sont de vraies fautes de typo du corpus**.

⭐ La distinction qui justifie le rouge, et qui vaut d'être retenue : *« où faut-il une virgule ? »*
est un **jugement** (mesuré 51,98 % de justesse — aucun réglage n'en fera du FP=0) ; *« l'espace
autour de la virgule QUI EST DÉJÀ LÀ est-il bien placé ? »* est **mécanique**, décidable sur la
chaîne seule.

---

## 12. Arbitrage interne du speller — cohérent : plus la route est incertaine, plus elle est orange

Route du candidat retenu (`cand[w][0]` : 2 accent · 1 édit-1 · 0,5 secours distance 2 · 0 phonétique) :

| route | texte FAUTIF (963 corr.) | texte CORRECT (116 = FP) |
|---|---|---|
| **accent** | **586 auto** + 7 flag | 11 auto + 2 flag |
| édit-1 | 138 flag + 116 vigilance | 14 flag + 43 vigilance |
| phonétique | 11 vigilance **seulement** | 9 vigilance |
| secours distance 2 | 4 vigilance **seulement** | 26 vigilance |

⇒ La hiérarchie est respectée : plus la route est incertaine, plus elle est orange, et les routes
phonétique / distance 2 ne sont **jamais** affirmatives.
*(La ligne « secours distance 2 » est historique : le mécanisme a été **retiré** le 2026-08-11,
mesuré nuisible — 0 correction juste ajoutée sur 1 360 phrases dys, 26 oranges de plus sur du texte
correct. Elle reste ici parce qu'elle documente la hiérarchie.)*

### 12 bis. L'accent n'est plus seul à pouvoir affirmer — le GLISSEMENT MOTEUR (2026-08-11)

L'audit concluait « seule la restauration d'ACCENT a le droit d'être rouge ». C'était vrai, mais
c'était une **description**, pas une limite prouvée. Sous la doctrine de Rem — *« une faute est une
faute ; il faut maximiser le ROUGE pour diminuer l'ORANGE »* — on a cherché un second sous-ensemble
affirmable dans l'édit-1, et on l'a trouvé :

> **un seul candidat au lexique** (toutes routes) **ET** l'écart n'est qu'un **ORDRE de lettres** ou
> un **REDOUBLEMENT** ⇒ le mot visé n'est pas en doute, un doigt a glissé.

| | |
|---|---|
| corpus dys/GEC appariés | **+28 applications justes, 0 fausse, 0 régression** (différentiel moteur avec/sans, contrôle intégré) |
| texte CORRECT, UD 14 450 phrases | **9 tirs, tous sur de VRAIES fautes du corpus** (`professionalisme`, `couisn`, `majortié`, `entammer`, `acceuil`, `saisoon`) ⇒ **FP = 0 littéral** |

⭐ **C'est l'INTERSECTION des deux conditions qui vaut, pas chacune.** « Un seul candidat » **seul**
tire 65 fois sur ces mêmes 14 450 phrases et réécrirait en silence des mots ÉTRANGERS
(`flight→light`, `kommune→commune`, `project→projet`, `strategia→stratégie`). Un mot étranger diffère
toujours par une lettre **substituée ou absente**, jamais par un simple désordre — c'est le
redoublement/la transposition qui sépare les deux populations.

⛔ **Garde graphotactique RÉFUTÉE** au passage : filtrer sur les trigrammes absents du français coûte
14 gains pour 5 bruits écartés, et ne voit même pas `flight`. Le lexique de 214 685 mots atteste
6 912 trigrammes : il n'y a plus de séquence « impossible ».

Gardes CI : `test_speller_app.js` et `extension/test_speller.js` exigent le rouge sur 6 cas **et**
l'orange sur les 4 mots étrangers (contre-garde vérifiée : les 4 tirent bien, en orange). La parité
app ↔ extension compare le **tier**, donc la promotion elle-même est sous parité. Les deux vérifiées
en les cassant.


### 12 ter. ⛔ Un TROISIÈME sous-ensemble affirmable : cherché, PAS trouvé

Après l'accent (§12) et le glissement moteur (§12 bis), l'orange orthographique restant a été
redécoupé par six critères calculables — 192 tirs sur les corpus dys/GEC appariés, 54 % de
précision globale. **Aucun n'atteint la barre du rouge :**

| critère | tirs | précision | bruit / UD 14 450 |
|---|---|---|---|
| glissement moteur SANS « seul candidat » | 48 | 79 % | 23 |
| écart VOYELLE seule | 8 | 75 % | **44** |
| suffixe commun ≥ 4 | 36 | 47 % | 86 |
| préfixe commun ≥ 5 | 45 | 38 % | 91 |
| préfixe ≥ 5 ET même longueur | 7 | 29 % | 28 |
| voyelle seule ET préfixe ≥ 3 | 1 | 0 % | 33 |

⭐ « écart voyelle seule » semblait la piste évidente — le dys entend la voyelle et hésite sur la
graphie. Elle tire **44 fois** sur du texte correct, et ce sont des mots **ÉTRANGERS** : `arabo`,
`anglo`, `common`, `miya`, `penta`, `signo`. Même forme que le refus du secours distance 2.

⇒ **La couche affirmative du speller est à son plafond mesuré avec les signaux actuels.** Ce qui
reste en orange est genuinement incertain ; le rappel restant vit dans le **CONTEXTE** (grammaire),
pas dans un redécoupage de l'orthographe. Ne pas rouvrir sans un signal NOUVEAU — pas un nouveau
seuil sur les mêmes features.

### 12 quater. ✅ INFINITIF DE BUT (PR#469) — le rappel qui restait était bien dans le CONTEXTE

Signalé par Rem : « Je suis allé à la plage **mangé** des champignons ». `rFlexionEr` décide
d'après le token **immédiatement** à gauche ; ici le gouverneur (« allé ») est séparé du verbe par
un complément de destination, donc elle s'abstient.

Le piège n'est pas le rappel, c'est le **participe ADJECTIVAL** (« rentré à la maison **épuisé** »).
Trois gardes cumulées, chacune née d'un FP mesuré : ① verbe **PUR** (colonne POS **accentuée** du
lexique speller : `mangé` V, `épuisé` AV, `tracé` NV) · ② suivi d'un **déterminant** (objet direct)
· ③ verbe de mouvement **licencié** (aller fini, ou participe + auxiliaire être).

**4 cibles /4 · 0 piège /4 · 1 seul tir sur 14 450 phrases UD** — « Ran va-t-elle épousé le
docteur ? », une vraie faute du corpus ⇒ **FP = 0**.
⚠️ **Rappel NON mesuré** : 0 occurrence du motif dans les 474 phrases appariées. Livré sur un FP=0
mesuré et des cas construits — c'est dit, pas maquillé.

⭐ **Parité, asymétrie assumée** : les deux moteurs LIVRÉS lisent la même colonne POS accentuée et
sont **identiques** ; le probe Python n'a pas cette table et reste un **sur-ensemble** volontaire
(il tire sur `tracé`). Le contrat est `app ⊆ Python`, jamais l'égalité.

### Ce que sont vraiment les 78 « FP » orange du speller sur UD

`canarien→canadien` · `casei→cassée` · `subsp→sûrs` · `defining→définis` · `turkey→turk` ·
`cusps→corps` · `daïra→dira` · `empoyés→employés`.

⇒ Ce sont presque tous des mots **qui ne sont pas français** (latin, anglais, translittérations,
termes techniques) : le moteur les voit inconnus et propose un voisin. C'est le comportement voulu
(orange, jamais appliqué). ⚠️ Et `empoyés→employés` est **une vraie faute du corpus UD** — même
leçon qu'en anglais : *lire les cas avant de conclure qu'un FP en est un*.

---

## 13. Blocages mutuels entre tokens voisins — 0,3 % de résiduel

Deux fautes adjacentes peuvent s'empêcher. Le pipeline a une **cascade à 4 passes** ; la question
est ce qu'il en reste. Méthode : pour chaque faute non corrigée, on répare TOUTES ses voisines et
on relance — si elle se corrige alors, elle était bloquée.

| | moteur Python (grammaire seule) | **moteur COMPLET** (speller + grammaire + pyramide) |
|---|---|---|
| fautes examinées (phrases à ≥2 fautes) | 2 753 | 2 727 |
| corrigées directement | 1 188 | 1 182 |
| **bloquées par une voisine** | 34 (**1,2 %**) | **7 (0,3 %)** |

⭐ **La pyramide ortho→grammaire fait son travail** : elle débloque 27 des 34 cas. Le motif est net
— la voisine bloquante est presque toujours une **faute d'orthographe dans le sujet**
(`L'equipe`, `cliete`, `transportuer`, `collegue`) ; une fois le sujet bien écrit, l'accord
s'identifie.

Le résidu (7 cas) est le cas d'école : **`Se mtain`**, où chaque faute bloque l'autre — aucune
cascade ne peut trancher, il faudrait choisir laquelle réparer en premier sur un pari.

⇒ Chiffre à retenir : **0,3 %**. Ce n'est plus une inconnue.

---

# AUDIT 2 — liaison, conflits, croisement des lexiques (2026-08-11, fin de journée)

Demande de Rem : *« audit correcteur, app et extension, debug liaison et conflit règles,
croisement / liaisons des lexiques et données »*. Re-passe des 5 sondes historiques + 3 sondes
NEUVES sur les angles que l'audit #461 ne couvrait pas — dont deux ont produit des bugs réels
depuis (`leurs tige`, pipeline de l'extension).

## 14. Re-passe des sondes historiques — tout tient après les ~12 PR du jour

| sonde | verdict |
|---|---|
| registres 3 moteurs | ✅ 43 noms = 43 = 43 (56 fonctions avec `rInfBut`) ; seul écart d'étiquette connu `-é/-er` |
| ordre des règles | ✅ **toujours optimal** : 155 tokens à concurrence, la 1ʳᵉ a raison 150×, **0** masquée juste |
| règles sans tir | ✅ toutes vivantes sur cas construits, 3 moteurs d'accord |
| blocages mutuels | ✅ 1,2 % Python seul (34/2 753), connu 0,3 % moteur complet |

## 15. LIAISON — pipeline ENTIER site ↔ extension : un seul écart, et il est VOULU

Diff de **tous** les flags (position, mot, suggestion, tier, règle) entre `_computeCorrs` (site) et
`diagnoseAll` (extension) sur **2 621 phrases** (dys/GEC + UD 2 000) :

> flags site 1 218 · flags extension 1 184 · **écart : 34, tous « majuscule initiale à vérifier »**

C'est la **politique documentée** : la vigilance majuscule est activée sur la page correcteur
(`spellText(t, true)`) et coupée dans l'extension pour ne pas harceler chaque message en minuscules.
⇒ **Zéro divergence de grammaire ou d'orthographe.** La réparation de la pyramide (PR#471) est
totale, pas seulement sur les 2 cas de sa garde.

## 16. CONFLITS entre règles — le texte corrigé est un POINT FIXE (à 3 near-misses près)

Méthode : appliquer tout ce que le site coche par défaut, relancer le moteur sur le résultat.
Un re-flag = cascade inachevée ou conflit qui fabrique une faute (la signature de `leurs tige`).

> **3 621 phrases → 3 re-flags, et AUCUN ne fabrique une faute.**

Les trois sont des **convergences en deux passes** — la cascade interdit un second flag sur le même
token (anti-boucle), donc `se→ce` puis `ce→cette` demande une relance :
`m'détestons→me détestons` puis `détestent` · `se vie→ce vie` puis `cette` · un `-er` débloqué par
une correction en aval. Comportement stable, pas un défaut : la relance suivante converge.
**Plus aucun conflit de la famille `leurs tige` dans le correcteur.**

## 17. CROISEMENT DES LEXIQUES ET DES DONNÉES

### 17.1 Inventaire et fraîcheur — ✅ les 5 tables partagées sont OCTET-À-OCTET identiques

| table | clé | app ↔ extension | rôle |
|---|---|---|---|
| speller (3,46 Mo) | **accentuée**, œ→oe au build | ✅ identiques | orthographe + POS fin (`rInfBut`, glissement) |
| noun-post (1,45 Mo) | désaccentuée, œ→oe | ✅ identiques | posterior NOM/VER (nombre, genre dét.) |
| genre relâché (0,54 Mo) | désaccentuée | ✅ identiques | âme/amé, affaire/affairé |
| POS-HMM (0,69 Mo) | désaccentuée | ✅ identiques | tagger de séquence |
| prénoms (0,11 Mo) | accentuée | ✅ identiques | genre des prénoms |
| lex4 155k (19,3 Mo) | désaccentuée | app **seulement** (documenté : pas de `posOf` côté ext) | guard genre, `rFlexionEr` |

### 17.2 Contradictions ENTRE tables — mesurées, gardées par le comportement

* **(a) speller « V pur » vs posterior NOM-dominant : 953 formes** (`acté`, `adressé`, `affichés`…).
  C'est la tension entre le discriminateur de `rInfBut` (speller) et celui de `rNounPlural`
  (posterior). **Gardée par la mesure, pas par la cohérence des tables** : `rInfBut` = 1 tir sur
  14 450 phrases UD, une vraie faute. ⭐ Leçon : deux tables peuvent se contredire tant que chaque
  règle est mesurée sur SA table — mais toute NOUVELLE règle qui croiserait les deux doit re-mesurer.
* **(b) speller ↔ 155k en désaccord sur la nominalité : ~2 700 formes** (1 504 + 1 173). C'est
  exactement pourquoi le choix de table est un choix de COMPORTEMENT — l'infinitif de but a choisi
  le speller accentué délibérément, et le probe Python (155k) est un sur-ensemble assumé.
  ⇒ argument de plus pour le chantier **lexique unifié** (à froid).
* **(c) prénoms ↔ mots : 700 collisions sur 8 729** (`rose`, `pierre`…) — gérées par la garde
  « pas en tête de phrase » posée en PR#460.
* **(d) ligature** : le speller ne stocke AUCUNE forme en œ (normalisées au build) ; la lecture de
  NOUN_POST passe par œ→oe, gardée par le banc ligature.

## 18. Incident de discipline, consigné

Pendant cet audit, la CI de la PR#473 est passée ROUGE (Chrome du runner > 10 s à ouvrir son port de
débogage) **et je l'ai mergée quand même** : mon enchaînement `tail && merge` ne conditionnait pas le
merge sur le verdict. Le contenu était sain (banc vert en local, échec environnemental), le geste
non. Correctifs : le banc lit désormais le port dans `DevToolsActivePort` (choisi par Chrome,
fenêtre 60 s — PR#474), et le merge est **conditionné par `if [ $RC -eq 0 ]`**, plus jamais enchaîné.
