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
| `lex_en.tsv.gz` | 1,42 Mo | **maître** : `surface · pos · ipa · lemma · tags · gender · freq` (124 189 surfaces à **signal utile** : ipa OU freq>0 OU homophone) |
| `homophones_en.json` | 0,16 Mo | `{ mot : [homophones…] }` — 5 549 groupes symétriques (their→there/they're, ate→eight/eyot…) |
| `forms_en.tsv.gz` | 0,70 Mo | table de flexion : `lemme · POS · form:tag,…` (91 214 lemmes ; go→went→gone, big→bigger→biggest) |
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

- **Surfaces** : 895 845 (1 481 704 lignes kaikki → 968 113 entrées retenues, après exclusion des
  entrées « faute d'orthographe » — Wiktionary documente teh/thier/freind… ; on les retire sinon le
  speller ne peut pas les corriger). NOUN 602 k, ADJ 177 k, VERB 159 k, ADV 25 k.
- **IPA** : 12 % global (kaikki 78 423 + cmu 28 217) — bas car la traîne rare domine. Sur les mots
  **utilisés** : freq≥1 → **76 %**, freq≥10 → **95 %**, freq≥100 → **100 %**.
- **Genre** : 64 (l'anglais n'a ~pas de genre grammatical — attendu).
- **Homophones** : 5 549 groupes.
- **Formes fléchies** : 369 640 surfaces dépliées ; 299 869 lemmes fléchis.
- **n-grammes ortho** : n1=28 · n2=727 · n3=13 832 · 0,06 Mo gz (top trigrammes : `ing`, `ed$`, `ion`, `ati`).
- **n-grammes phon** : **40 phonèmes** (inventaire GA propre) · n2=1 491 · n3=21 892 · 0,10 Mo gz.

## Outils bâtis dessus

- **`speller_en_probe.py`** — speller anglais de référence (comme `speller_probe.py` FR). Noisy-channel :
  `lex_en` + clé phonétique lossy EN + edits1 ; seuil AUTO (rouge) vs FLAG (orange, doute→orange).
  Mesuré : recall 44/55 sur fautes dys (les « misses » restants = vrais mots — calender/wold/wich —
  qu'il ne FAUT pas flaguer) ; **FP=0** sur EWT (les rares AUTO sur texte « correct » = vrais typos du
  corpus web). Lancer : `PYTHONUTF8=1 python dictee/speller_en_probe.py`.

- **`homophone_en_probe.py`** — canal homophone anglais (LE gros des fautes dys EN). Calqué sur le FR
  (`rule_son_sont`) : on tranche par la classe du mot voisin (POS de `lex_en`), on s'abstient dans
  l'ambigu. **RED** (FP=0, faute structurellement impossible) : `modal + of → have`, `their + is/are →
  there`, `its + a/an/the/been → it's`, `comparatif + then + GN → than`. **ORANGE** (vigilance) :
  direction possessive (there/you're/it's + nom). Mesuré : recall 14/14 ; sur EWT, les 20 fires RED
  sont **toutes de vraies fautes** du corpus (FP=0 réel) ; ORANGE sans flood (0,00/phrase).
  Limite mesurée : Wiktionary EN sur-verbifie (house/phone/sister tagués VERB) → la direction
  possessive ORANGE est bridée (`only_noun`) ; amélioration future = POS dominante par fréquence.

- **`corrector_en.js`** — moteur JS = **port fidèle** de `speller_en_probe.py` + `homophone_en_probe.py`
  (mêmes clés phon lossy, seuils AUTO/FLAG, règles RED/ORANGE). Tourne en Node (lexique via zlib) et
  en navigateur (`parseLexText` sur le `.gz` fetché + décompressé via `DecompressionStream`).
- **`parity_en.js`** — garde de **parité Python↔JS** (comme `parity_core.js` FR) : fait tourner les
  deux moteurs sur TOUT UD English-EWT et compare les agrégats. Mesuré : speller AUTO **60=60**,
  homophone RED **20=20** → parité exacte.
- **`../en/correcteur-outil.html`** — **page publique** : correcteur EN en pleine page (style dys, carte
  crème, a11y via `nav.js`). Fetch `../dictee/lex_en.tsv.gz` + décompresse en navigateur (rien n'est
  envoyé) ; textarea → surligne rouge (fix sûr) / orange (à vérifier), clic pour appliquer.

## Anti-flood du speller (mesuré)

Le FLAG (orange) brut sur EWT valait 7,88 % (noms propres + lettres a/I + rares) = inondation. Corrigé
(Python+JS, parité) : le speller **ignore** les lettres seules (a, I), les mots **capitalisés** (noms
propres — les homophones gèrent leur casse) et les inconnus **sans candidat proche** → orange **0,50 %**
(≈ vrai taux de typo), AUTO inchangé (60, tous vrais typos du corpus).

## Statut

Base + **speller** + **canal homophone** + **moteur JS (parité)** + **page publique** livrés et mesurés
(FP=0). Prochaines briques Phase 2 : pendu EN (`lex_en` + n-grammes + IPA), dictée EN.
