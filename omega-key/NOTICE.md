# NOTICE — attributions & licences des données

## Code
Le code source d'OMEGA·KEY est sous licence **MIT** (voir `LICENSE`).

## Données dérivées de Lexique (génération de passphrases)
Les listes embarquées dans `app/omega-key.html` servant à générer les
passphrases — `WORDLIST_FR` (4096 mots), `SYLL_FR` (256 syllabes) et
`SYLL_SAFE` (128 syllabes) — sont **dérivées de la base Lexique**.

- **Source** : Lexique (https://www.lexique.org) — projet https://github.com/chrplr/openlexicon
- **Auteurs** : Boris New & Christophe Pallier
- **Licence de la source** : **Creative Commons Attribution - Partage dans les
  Mêmes Conditions 4.0 (CC BY-SA 4.0)**

Référence à citer :
> New, B., Pallier, C., Brysbaert, M., & Ferrand, L. (2004). Lexique 2 : A New
> French Lexical Database. *Behavior Research Methods, Instruments, & Computers*,
> 36(3), 516-524.

### Conséquences
1. **Attribution** : la source Lexique et ses auteurs doivent être cités (présent
   fichier).
2. **Partage à l'identique (ShareAlike)** : la partie *données dérivées*
   (`WORDLIST_FR` / `SYLL_FR` / `SYLL_SAFE`), ainsi que toute œuvre qui les
   incorpore, doit être diffusée sous la même licence **CC BY-SA 4.0** (ou
   compatible). L'usage commercial est **autorisé** dès lors que l'attribution et
   le partage à l'identique sont respectés.

### Pour échapper au partage à l'identique (licence non-SA)
Régénérer `WORDLIST_FR` / `SYLL_FR` / `SYLL_SAFE` **sans** données issues de
Lexique — par exemple à partir d'une liste au domaine public ou sous licence
permissive (type EFF Diceware) — puis remplacer les tableaux correspondants dans
`app/omega-key.html`. Le reste du logiciel (code MIT) n'est pas concerné.
