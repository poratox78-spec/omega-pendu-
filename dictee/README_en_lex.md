# OMEGA-EN — base lexicale anglaise (Phase 2)

Équivalent **anglais** de la base lexicale française, pour les futurs outils EN **publics**
(correcteur / dictée / pendu d'anglais — comme le chantier chinois, mais public). Construit
« à la manière du français » : une source Wiktionnaire (kaikki) dépliée en trames
`mot · POS · IPA · lemme · nombre · genre`, + fréquence sous-titres, + n-grammes.

En français la base maître est **Lexique 4** (hors-repo, 34 Mo) complétée par kaikki.
En anglais **il n'existe pas de Lexique-4 libre** (CELEX est payant) : **kaikki EST la base**,
donc on extrait TOUT (pas de filtre « mot manquant »).

## Sources (brutes, gitignorées, re-téléchargeables)

| Fichier | Taille | Licence | Rôle |
|---|---|---|---|
| `kaikki-en.jsonl` | 3,19 Go | **CC BY-SA** | ortho, POS, IPA (par dialecte), **homophones**, formes fléchies, genre |
| `subtlex_us.json` | 3,6 Mo | MIT (wrapper) ; SUBTLEX = libre recherche | **fréquence** sous-titres (registre dys, = méthodo Lexique FR) |
| `cmudict.dict` | 3,6 Mo | **BSD-2** | secours **phonologie** (ARPAbet→IPA ; formes fléchies + mots hors-Wiktionary) |

- kaikki : `kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl`
- SUBTLEX : `raw.githubusercontent.com/words/subtlex-word-frequencies/master/index.json`
- CMUdict : `raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict`

## Assets produits (dérivés, **committés** avec attribution CC BY-SA)

| Fichier | Taille | Contenu |
|---|---|---|
| `lex_en.tsv.gz` | 1,42 Mo | **maître** : `surface · pos · ipa · lemma · tags · gender · freq` (124 376 surfaces à **signal utile** : ipa OU freq>0 OU homophone) |
| `homophones_en.json` | 0,16 Mo | `{ mot : [homophones…] }` — 5 558 groupes symétriques (their→there/they're, ate→eight/eyot…) |
| `forms_en.tsv.gz` | 0,70 Mo | table de flexion : `lemme · POS · form:tag,…` (91 324 lemmes ; go→went→gone, big→bigger→biggest) |
| `ngrams_ortho_en.json.gz` | 0,06 Mo | bi/trigrammes **caractères** (graphotactique — orthographe profonde EN) |
| `ngrams_phon_en.json.gz` | 0,10 Mo | bi/trigrammes **phonèmes** (inventaire General-American, 40) |

Le maître **complet** (901 496 surfaces, `lex_en.tsv` ~30 Mo + `forms_en.tsv` ~13 Mo) est **gitignoré**
(régénérable, comme Lexique4 côté FR) : sa traîne (777 k mots freq=0 sans IPA = archaïsmes/taxons/
termes rares) n'apporte rien aux outils. Les `.gz` committés sont **scopés au signal utile** — complets
pour tout usage réel (tout le vocabulaire fréquent, toute la phono dispo, tous les homophones).

Les dérivés héritent de **CC BY-SA** (kaikki). Attribution : Wiktionary (via Wiktextract/kaikki.org),
SUBTLEX-US (Brysbaert & New), CMU Pronouncing Dictionary.

## Construire

```bash
# 1) sources brutes (une fois)
curl -sL -o kaikki-en.jsonl https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl
curl -sL -o subtlex_us.json https://raw.githubusercontent.com/words/subtlex-word-frequencies/master/index.json
curl -sL -o cmudict.dict    https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict

# 2) maître + homophones + flexions
PYTHONUTF8=1 python dictee/build_en_lex.py kaikki-en.jsonl dictee --freq subtlex_us.json --cmu cmudict.dict

# 3) n-grammes ortho + phon (TYPE par défaut ; --freq = pondéré fréquence)
PYTHONUTF8=1 python dictee/build_en_ngrams.py dictee/lex_en.tsv dictee
```

## Schéma & choix

- **POS** (kaikki→étiquette) : NOUN VERB ADJ ADV PRON PREP CONJ DET NUM INTJ. Noms propres, locutions,
  affixes, symboles exclus. Contractions (they're, don't) gardées (homophones/grammaire).
- **IPA** : priorité General-American > Received-Pronunciation > 1re dispo (kaikki) ;
  **secours CMUdict** (ARPAbet→IPA, schwa AH0→ə) quand kaikki n'a rien — surtout les **formes
  fléchies** (Wiktionary met l'IPA sur le lemme, pas sur les pluriels/temps).
- **Genre** : l'anglais n'a ~pas de genre grammatical → colonne quasi vide (capté seulement si
  Wiktionary le marque, ex. actress f). Normal et attendu.
- **Homophones** : champ `sounds.homophone` de Wiktionary, fusionné en groupes **symétriques**.
- **Formes fléchies** : `forms` de kaikki filtré (plural/past/participle/comparative/superlative/…),
  **dépliées en surfaces** (le pluriel `dictionaries` a sa propre ligne, lemme=`dictionary`).
- **n-grammes phon** : IPA segmentée (stress/longueur retirés, affriquées t͡ʃ et diphtongues aɪ/oʊ
  gardées entières) puis **normalisée** vers l'inventaire canonique **General-American (40 phonèmes)** —
  Wiktionary/CMU mélangent dialectes, allophones (t̪ d̚), tons et fuites d'enPR ; on nettoie.
- **n-grammes ortho** : lettres a-z pures (déaccentuées), marqueurs de bord `^…$`.

## Mesures (fichier complet, kaikki EN 3,19 Go)

- **Surfaces** : 901 496 (1 481 704 lignes kaikki → 974 202 entrées retenues). NOUN 605 k, ADJ 178 k,
  VERB 160 k, ADV 25 k, INTJ 3 k, PRON/PREP/NUM/DET/CONJ ~2,6 k.
- **IPA** : 12 % global (kaikki 78 423 + cmu 28 217) — bas car la traîne rare domine. Sur les mots
  **utilisés** : freq≥1 → **76 %**, freq≥10 → **95 %**, freq≥100 → **100 %**.
- **Genre** : 64 (l'anglais n'a ~pas de genre grammatical — attendu).
- **Homophones** : 5 558 groupes.
- **Formes fléchies** : 370 132 surfaces dépliées ; 300 277 lemmes fléchis.
- **n-grammes ortho** : n1=28 · n2=727 · n3=13 832 · 0,06 Mo gz (top trigrammes : `ing`, `ed$`, `ion`, `ati`).
- **n-grammes phon** : **40 phonèmes** (inventaire GA propre) · n2=1 491 · n3=21 892 · 0,10 Mo gz.

## Statut

Base **produite et mesurée**. Aucun moteur ne la consomme encore — c'est la **brique 1** de la
Phase 2 (outils EN publics). Prochaines briques : speller EN (SP.WORDS depuis `lex_en`), canal
phonétique (n-grammes phon + homophones), pendu EN, correcteur EN (homophones + morphologie).
