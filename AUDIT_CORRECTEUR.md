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
| Règles jamais déclenchées | ⚠️ 21 sans tir sur nos corpus → **15 confirmées vivantes**, 6 à confirmer | ouvert |
| Bug `son/sont` | ❌ ne tirait que si le tagger se TROMPE (§4) | ✅ **CORRIGÉ** |
| Rouge / orange | ⚠️ la grammaire n'avait pas de tier (§5) | ✅ **CORRIGÉ** |
| **Liaison app ↔ extension** | ❌ l'app appliquait la grammaire, l'extension jamais (§6) | ✅ **CORRIGÉ** |

Les trois défauts sont réparés dans la même PR ; les mesures d'avant/après sont conservées
ci-dessous parce qu'elles expliquent POURQUOI le correctif est ce qu'il est.

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

Restent 6 règles sans confirmation (`rule_elide`, `rule_accord_sv_infinitif` et 4 variantes
d'accord) : leurs formes déclenchantes ne sont pas documentées, il faut les lire une par une.

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

---

## 7. Reproduire

Scripts d'audit (scratchpad de session, non commités) :
`audit1_registres.py` (registres et ordre) · `audit2_tirs.py` (déclenchement sur 7 960 phrases) ·
`audit3_cas.py` (cas construits, 3 moteurs) · `tiers2.js` (rouge/orange par règle).

Bancs déjà en CI qui couvrent ces dimensions : `parity_corr.js`, `extension/parity_core.js`,
`fp_scale_probe.py`, `messy_probe.js`, `test_speller_app.js`, `prenoms_probe.py`.

---

## 8. Ce que l'audit N'A PAS couvert

Honnêteté de périmètre :

- Les **6 règles** sans forme déclenchante confirmée (§3).
- La couche **typographie** (espacement, guillemets, trait d'union) : vue dans les tiers, pas
  auditée règle par règle.
- Le **speller** (routes accent / édit-1 / phonétique / secours distance 2) : son arbitrage interne
  n'est pas dans cet audit, seulement ses sorties.
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
