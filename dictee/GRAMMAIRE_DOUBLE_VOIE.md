# Grammaire à double voie — appliquer l'architecture OMEGA au levier grammatical

> Design (à mesurer, pas encore acquis — cap §1/§6). Idée : le levier grammaire est aujourd'hui **mono-voie et
> mono-boucle** (règles écrites à la main, décision seulement). On lui donne la signature d'OMEGA :
> **double ROUTE** (lexicale / sublexicale) × **double BOUCLE** (montante = décider / descendante = apprendre).

## Rappel : la signature d'OMEGA
- **Double ROUTE** (DRC) : route **lexicale** (mot connu → lookup, « word superiority ») + route **sublexicale**
  (GPC, feed-forward → généralise aux mots inconnus).
- **Double BOUCLE** : **montante** = décider (passe avant qui choisit) · **descendante** = miroir/apprentissage
  (passe post-résultat qui met à jour les associations). Les miroirs descendants du pendu sont **winrate-inertes**
  mais ce sont eux qui **apprennent** — leçon à garder en tête : *une boucle descendante ne paie pas automatiquement,
  ça se MESURE* (cf. `AUDIT_OMEGA.md` §1.4.1).

## Les deux ROUTES de la grammaire
| Route | Quoi | Force | Analogue DRC |
|---|---|---|---|
| **lexicale (grammaire)** | lookup POS/genre/nombre du mot (Lexique4 `cgram`) | exact sur les mots **attestés** | route lexicale (mot connu) |
| **sublexicale (grammaire)** | inférer POS/accord depuis la **morphologie + le contexte** (terminaisons, gouverneur) | **généralise** aux mots inconnus | route GPC (non-mots) |

État actuel : on a surtout la **sublexicale** (règles `decide(T,i)`, `vlike` morphologique). La **lexicale** est
*branchée mais bloquée* (`build_cgram.py` → `cgram_verbs.json`, en attente du lexique 34 Mo).
**Croisement = jointe (§3, pas argmax)** : `P(forme|contexte) ∝ P_lexicale × P_sublexicale`. Mot connu → la
lexicale tranche ; mot inconnu → la sublexicale porte. C'est exactement ce qui lèverait le mur actuel
(couverture verbale partielle → a/à, et/est, ce/se).

## Les deux BOUCLES de la grammaire
- **Montante = DÉCIDER** (acquis) : étant donné le contexte, choisir la forme accordée correcte. C'est le correcteur
  (passe avant) et le diagnostic dictée.
- **Descendante = APPRENDRE** (manquant) : une fois la **vérité connue** (cible de dictée, ou correction acceptée
  par l'élève), **mettre à jour** des tables apprises :
  - `gouverneur → terminaison` (ex. sujet pluriel → -nt) — compteurs appris ;
  - `mot → POS` (un mot vu après un sujet et finissant en -ent = verbe-ish) → **étend `vlike` sans liste écrite à la main** ;
  - `homophone → contexte` (quel membre du groupe va avec quel voisinage).
  C'est le **miroir** de la boucle descendante du pendu (mise à jour d'associations post-résultat).

## Pourquoi ça vaut le coup (le mur que ça vise)
Les manques résiduels (couverture verbale, `et/est` direction `est→et`, `ce/se`) sont un problème de **COUVERTURE
de connaissance**. Le tout-écrit-à-la-main (montant seul) ne scale pas. La **boucle descendante apprend** la
couverture depuis les données → scale sans coder chaque règle. Et le **cercle vertueux** est déjà là :
**la dictée fournit des exemples SUPERVISÉS** (la cible est connue) → entraîne la boucle descendante →
**améliore le correcteur** (non supervisé). Dictée = prof, correcteur = élève.

## Honnêteté (sinon on se raconte des histoires)
- Les miroirs descendants du pendu sont **mesurés inertes** : une boucle descendante grammaire **n'est pas garantie**
  de payer → **à mesurer**, pas à présumer.
- Le péché capital du correcteur = le **faux positif**. Tout apprentissage doit **garder FP = 0** comme garde-fou.
- Risque de sur-apprentissage sur un mini-corpus (30 phrases) → mesurer la **généralisation** (held-out), pas le rappel.

## Premier pas FALSIFIABLE (cheap, avant tout build lourd)
Probe « boucle descendante » : **apprendre** depuis les cibles connues de la dictée (supervisé) deux tables
— `gouverneur→terminaison` et `mot→POS` — puis mesurer si le modèle **appris** (a) égale/bat les règles écrites à
la main sur les témoins, (b) **étend** la couverture verbale (lève des cas que `vlike` rate), (c) **reste à FP = 0**.
Tout sur l'existant (`sentences.json` + levier), sans le lexique 34 Mo. Si Δ>0 et FP=0 → la boucle descendante
grammaire est réelle ; sinon → falsifiée tôt, comme les miroirs du pendu.
