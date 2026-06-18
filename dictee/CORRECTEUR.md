# Correcteur dys (semi-direct) — direction & probe de faisabilité

> Idée (Rem) : une fois le levier d'accord en place, en faire un **correcteur orthographique dys** « semi-direct ».
> Recadrage clé : le correcteur **roule sur le moteur de DICTÉE** (`diag_sentence.py`), pas sur le pendu — il traite
> donc **toutes les longueurs** (le `MIN_WORD_LEN=7` du pendu ne s'applique pas), et vit dans le **régime mot-court**
> où l'accord paie (cf. `evo/PHRASE_HANGMAN_PROBE.md` : le pendu nous a servi de banc, pas de débouché).

## Ce qui distingue ce correcteur (≠ Antidote/Grammalecte/LanguageTool)
Il **détecte + corrige + situe l'erreur dans un STADE développemental** (phono → alphabétique → lexical →
morphosyntaxique) pour la **remédiation dys**. Angle pédagogique, cible n°1 du projet — pas « encore un correcteur ».

## Le seul vrai inconnu, mesuré : détecter/corriger SANS corrigé
La dictée connaît la cible ; un correcteur non → il doit **inférer l'intention**. Probe : `dictee/correcteur_probe.py`
(`python3 dictee/correcteur_probe.py`). Pour chaque homophone grammatical, une règle `decide(T,i)` tranche la bonne
forme via le contexte (voisins, POS, accord — réutilise `diag_sentence`). Le correcteur **flague** si tapé ≠ décidé
et **propose** la forme décidée.

### Résultat (détection ET correction, faite une seule fois) — après étape 1 (couverture élargie)
- **Faux positifs sur 30 phrases CORRECTES : 0** ✅ (condition n°1 : ne pas « corriger » du texte juste).
- **Détection + correction : 22/24** témoins (était 13/16 avant l'élargissement verbal).

| confusion | fp | détection | correction |
|---|---|---|---|
| `-é/-er` (mangé/manger) | 0/3 | 3/3 | 3/3 |
| `son/sont` | 0/3 | 3/3 | 3/3 |
| `leur/leurs` | 0/3 | 3/3 | 3/3 |
| `on/ont` | 0/5 | 5/5 | 5/5 |
| `a/à` | 0/3 | 3/3 | 3/3 |
| `peu/peux/peut` | 0/3 | 3/3 | 3/3 |
| `et/est` | 0/2 | 1/2 | 1/2 |
| `ce/se` | 0/2 | 1/2 | 1/2 |

### Étape 1 : couverture verbale élargie SANS le lexique 34 Mo
`is_verb` du levier dictée est un stub de 32 formes du corpus (il ignore « mange », « va »…). On l'a doublé d'une
**liste blanche de formes verbales fréquentes** (exactes → 0 FP par sur-généralisation) : `vlike()`. Ça débloque
`a/à`, `on/ont`, `peu/peux/peut` **sans** le lexique. Restent partiels : `et/est` (seule la direction `et→est` est
sûre ; `est→et` exige détecter un parallélisme de noms, sémantique) et `ce/se` (couverture pronominale limitée).
**Lexique4 `cgram` (étape 3)** remplacera la liste blanche → couverture verbale complète + scaling hors-corpus.

## Verdict
Le cœur du correcteur (détecter + corriger sans corrigé) **marche, avec 0 faux positif** sur les confusions à
discriminateur propre. C'est constructible **sur l'existant** (levier d'accord + `phono_homophones.json`), sans le
lexique 34 Mo (nécessaire seulement pour la couche « typo / non-mot » et pour élargir `is_verb`).

## Suite (jonctions, dans l'ordre)
1. **Élargir `is_verb`** via Lexique4 `cgram` (verbe/nom/adj…) → débloque a/à, et/est, on/ont + scale. *(dépend du lexique 34 Mo hors-repo.)*
2. **Couche typo** : mot hors-lexique → plus proches voisins (édition + phon) → détection des fautes non-homophones.
3. **UI semi-directe** dans l'app : réutiliser le panneau « ✍️ Dictée diag » → mode « colle ton texte », surligne +
   propose + affiche le **stade**. OFF-inerte, R66.
