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

### Résultat (détection ET correction, faite une seule fois)
- **Faux positifs sur 30 phrases CORRECTES : 0** ✅ (condition n°1 : ne pas « corriger » du texte juste).
- **Détection + correction : 13/16** témoins.

| confusion | fp | détection | correction |
|---|---|---|---|
| `-é/-er` (mangé/manger) | 0/3 | 3/3 | 3/3 |
| `son/sont` | 0/3 | 3/3 | 3/3 |
| `leur/leurs` | 0/3 | 3/3 | 3/3 |
| `on/ont` | 0/3 | 2/3 | 2/3 |
| `a/à` | 0/2 | 1/2 | 1/2 |
| `et/est` | 0/2 | 1/2 | 1/2 |

### Le pourquoi des 3 manques (mécanisme, pas échec d'architecture)
`a/à`, `et/est`, `on/ont`(présent) demandent de savoir si le slot est **verbal** ; or `is_verb` est un **stub de 32
formes** du corpus (il ignore « mange », « va »…). Ce n'est PAS la méthode qui échoue : c'est la **couverture verbale**.
Un vrai lexique POS (Lexique4 `cgram`) lève ces 3 cas et scale hors-corpus.

## Verdict
Le cœur du correcteur (détecter + corriger sans corrigé) **marche, avec 0 faux positif** sur les confusions à
discriminateur propre. C'est constructible **sur l'existant** (levier d'accord + `phono_homophones.json`), sans le
lexique 34 Mo (nécessaire seulement pour la couche « typo / non-mot » et pour élargir `is_verb`).

## Suite (jonctions, dans l'ordre)
1. **Élargir `is_verb`** via Lexique4 `cgram` (verbe/nom/adj…) → débloque a/à, et/est, on/ont + scale. *(dépend du lexique 34 Mo hors-repo.)*
2. **Couche typo** : mot hors-lexique → plus proches voisins (édition + phon) → détection des fautes non-homophones.
3. **UI semi-directe** dans l'app : réutiliser le panneau « ✍️ Dictée diag » → mode « colle ton texte », surligne +
   propose + affiche le **stade**. OFF-inerte, R66.
