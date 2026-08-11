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
| **Ce que chaque surface applique** | ❌ le `tier` ne le dit pas : site 244 corr. / extension 159 (§6 bis) | ✅ **MESURÉ** |
| **Maximiser le rouge** | ✅ 2ᵉ sous-ensemble affirmable trouvé : le **glissement moteur** (§12 bis) | ✅ **LIVRÉ** |

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
| **site** (coché par défaut) | 244 | 202 | 36 | 6 | **82,8 %** |
| **extension** (silence à la frappe) | 159 | 137 | 16 | 6 | **86,2 %** |
| seulement proposé (les deux) | 221 | 86 | 122 | 13 | 38,9 % |

⇒ **85 corrections d'écart**, toutes des `orthographe/flag` : `proffesseur→professeur`,
`conexion→connexion`, `soeur→sœur`, `tirroir→tiroir`… Ce n'est PAS le même défaut qu'au §6 : ces
corrections sont bien **proposées** dans la bulle de l'extension et appliquées par son « tout
corriger ». L'écart porte sur le **silence** — et il est justifié : réécrire un champ pendant que
l'utilisateur tape demande une barre plus haute que pré-cocher une case dans une barre qu'il relit.

⭐ **Leçon de méthode : mesurer « le rouge » comme `tier === 'auto'` décrit l'extension, pas le
site.** Interroger le moteur ne suffit pas quand chaque surface a sa propre règle d'application.

Le §12 bis referme 24 de ces 85 en promouvant le sous-ensemble **mesuré FP=0**, sans toucher aux 61
autres — dont la précision (76 %) ne permet pas le silence.

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
