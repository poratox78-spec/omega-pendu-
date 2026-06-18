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

État actuel : **sublexicale** (règles `decide(T,i)`, `vlike`) **+ lexicale LIVRÉE** — lexique reçu →
`build_cgram.py` produit `cgram_verbs.json` (12 415 verbes) et `cgram_gender.json` (53 050 noms genrés non ambigus).
**Route lexicale du GENRE mesurée 3/3** (`diag_sentence.lexical_gender` : décide le genre quand le déterminant
est neutre — leur/notre — là où on s'abstenait ; familles 100 % intactes, FP-safe). *Leçon homographes* : la
membership verbale brute doit être **croisée au contexte** (jointe §3), pas un drapeau is-verbe.
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

## Premier pas FALSIFIABLE — FAIT (`dictee/descending_probe.py`)
Boucle descendante : **apprendre le lexique de GENRE** depuis les contextes à déterminant genré des phrases
correctes (« une table » → table=f), validable contre Lexique4 (vérité terrain).
- **Précision : 26/26 = 100 %** (le genre appris depuis l'usage est correct).
- **Généralisation (leave-one-out) : 1/1** — MAIS un seul nom se répète sur 30 phrases (vocabulaire quasi
  sans recouvrement) → généralisation à peine testable : **limite de DONNÉES, pas de mécanisme.**
- **Usage en détection : FP = 0** (genre appris → accord vérifiable, aucune contradiction).

**Verdict** : la boucle descendante **apprend vraiment** (≠ miroirs du pendu, inertes) et reste FP-safe ; mais sa
valeur vient du **VOLUME** (corpus corrigés réels = validation terrain). C'est le moteur d'**auto-enrichissement**
du correcteur : chaque copie corrigée nourrit les tables (genre, POS, gouverneur→terminaison). Les deux moitiés de
la double voie sont donc posées et mesurées — route **lexicale** (genre, 3/3) + boucle **descendante** (100 % préc.).
Suite naturelle : brancher la collecte (fiche `validation_terrain.html`) → la boucle apprend des vraies données.
