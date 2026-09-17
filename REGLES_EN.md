# RÉFÉRENTIEL DES RÈGLES DE L'ANGLAIS — et où en est OMEGA (2026-08-12)

Miroir anglais de `REGLES_FR.md`, même méthode : ① taxonomie des phénomènes (glossaire grammatical
OED + catégories LanguageTool EN utiles : Grammar / Commonly Confused Words / Possible Typo — liste
de FAITS, jamais leur XML, LGPL) ; ② état établi en **INTERROGEANT LE MOTEUR** (batterie composée
dans l'ordre exact du pipeline de `en/correcteur-outil.html`), pas en lisant le code ; ③ priorisation
dys : audibilité × fréquence × FP-risque.

**Référence LT** : 6 150 règles EN, dont l'essentiel est style/typographie. Notre unité est le
PHÉNOMÈNE ; LT tolère les FP, nous non (mesuré : sur « We was late » LT propose « are », qui change
le temps). Le mur anglais nommé : le CONTEXTE — kaikki sur-verbifie, c'est le TAGGER (90,7 %) qui
tranche ; toute règle d'accord bute sur l'absence de chunker de GN (3 réfutations mesurées).

Légende : 🔴 corrigé d'office (FP=0 mesuré) · 🟠 proposé/signalé · 🟡 PARTIEL · ❌ ABSENT (vérifié au
moteur) · ⛔ HORS PÉRIMÈTRE ou RÉFUTÉ chiffré.

---

## 1. ORTHOGRAPHE LEXICALE

| phénomène | état | où / limite |
|---|---|---|
| non-mot → candidat (édit-1, phon, slot du mot-outil) | 🔴/🟠 | speller ; score 6·tier+log(freq), anagramme +2, slot +2 (calibrés) + SORTE D'ÉDITION (ligne suivante) |
| classement par SORTE D'ÉDITION (accesed → accessed, plus accused ; achive → achieve, plus active) | 🟠→ bonne cible LIVRÉ (2026-09-17, `build_canal_en.py`) | 55 % des mauvaises cibles avaient la bonne à UNE édition, battue sur la seule fréquence. Un candidat à une édition reçoit 1,5 × (ln lift(sorte) + ln lift(1re lettre)) + 3 si lettre doublée ; lift = P(sorte \| bonne cible) / P(sorte \| candidat), APPRIS sur les 2 784 fautes attestées de Wiktionary (double +0,42 · transposition +0,40 · voyelle oubliée +0,39 · voyelle↔voyelle +0,27 · … · consonne↔consonne −1,06 · voyelle↔consonne −2,16 ; 1re lettre changée −1,90) et VALIDÉ sur deux bancs non vus : Wikipédia mauvaises cibles 409 → 287 (bonne cible 81,9 → 86,4 %), JFLEG en contexte 138 → 116 ; rouges faux inchangés. Poids et bonus calibrés par balayage (JFLEG culmine à 1,5 ; bonus plateau 3-4). Constantes gardées en CI (recalcul == les deux moteurs) |
| glissement moteur (occuring, teh — 1 candidat + désordre/redoublement) | 🔴 | porté du FR ; JFLEG 176→190 confirmés |
| faute ATTESTÉE (definatly, abcess, wierd — Wiktionary « misspelling of ») | 🔴/🟠 LIVRÉ (2026-09-17, table `misspell_en.tsv`, `build_misspell_en.py`) | 2 823 graphies ; la cible relue par des humains REMPLACE la cible devinée (abcess → abscess, plus access) ; ROUGE si le moteur devine la même cible (deux sources d'accord : 224/226 confirmées par la liste de Wikipédia) ET sans RIVAL FORT (un autre candidat à une édition, fréq ≥ 200 et ≥ 20× la cible : agress → aggress contre agrees — là les deux listes humaines se contredisent ; 16 rouges sur 2 273 redeviennent orange), ORANGE sinon ; 20 graphies que le lexique tenait pour des mots (wierd, tought, hight) ne passent plus en silence (orange). Mesuré : Wikipédia 80,4 → 81,9 %, mauvaises cibles 448 → 409, rouge faux 2 → 1 ; JFLEG 190/203 → 214/227 confirmés ; texte édité +1 rouge = vraie faute du corpus (recieve) |
| distance 2 en secours | 🟠 | jamais rouge (tier 0,5) ; rappel 61,0→64,4 % |
| prétérit RÉGULARISÉ (doed→did, bited→bit, goed→went) | 🔴 | **vérifié BRANCHÉ à la batterie** (la question ouverte de 2026-08-03 est résolue) |
| orthographe britannique | ✅ tolérée | dérivation UK→US pour INTERROGER seulement ; jamais proposer colour→color |
| phonétique profonde (nife→knife) | ❌ | mur de GÉNÉRATION connu (gold absent des candidats 309 vs 83 mal classés) |
| mots collés figés (alot, aswell, infact…) | 🔴 LIVRÉ (2026-08-12, `mergedDecide`) | 14 formes ; alright ABSENT (graphie acceptée) ; 0 tir/10 137 ; rappel web 6 |

## 2. CONTRACTIONS — ⚠️ LE TROU N° 1, jumeau du « n' » français

L'apostrophe est **inaudible** : le dys écrit ce qu'il entend. Batterie du 2026-08-12 :

| écrit | attendu | le moteur rend |
|---|---|---|
| cant / wont / lets / whos / theyre / hes / Im / its(=it's) | can't / won't / let's / who's / they're / he's / I'm / it's | **RIEN** |
| dont | don't | **don** (fausse direction) |
| youre | you're | **your** (fausse direction) |
| isnt / didnt / ive | isn't / didn't / I've | **ist / didst / give** (aberrations) |
| the dog wagged it's tail | its | RIEN (direction inverse absente) |

**🔴 LIVRÉ (2026-08-12, `contractionDecide`)** — deux régimes mesurés :
- **rouge direct** : 30 formes jamais correctes en anglais édité (non-mots ET graphies eye-dialect
  que kaikki connaît : thats, theyre, im, arent…) ;
- **contexte étroit** : cant/wont + verbe BASE (« thieves' cant is » et « wont to argue » exclus),
  its + {a an the been being not} (« its very nature », « its loading environment » ont tué very
  et -ing au proto), lets en tête + verbe (« she lets him play » exclu).
Mesure : **3 tirs / 15 353 phrases éditées, tous de vraies fautes** (youll ×2, « Theres [sic] ») ;
rappel EWT (web) : **119**, échantillon relu = 100 % de vraies fautes ; banc FP propre inchangé.
**EXCLUS v1 (homographes massifs, contexte sûr inexistant)** : were(=we're), hes, shes, id, ill,
shell, hell, shed, wed. Le jour où un signal sûr existe, commencer par « hes » (quasi toujours
fautif) et « were + gérondif » (we're).

## 3. HOMOPHONES (Commonly Confused Words)

| phénomène | état | note |
|---|---|---|
| a/an · its/it's · their/there/they're · then/than · to/too/two · was/were · where/were · we're · weather/whether · your/you're · loose/lose · should/could/would of→have · who's/whose · lead/led · past/passed · advice/advise · breath/breathe · chose/choose · accept/except · affect/effect(🟠) | 🔴 | 49/49 cas gardés CI ; décidé par le TAGGER, pas le lexique |
| it's → its (direction inverse) | ⛔ REPORTÉ chiffré (2026-08-12) | le cadre SÛR (it's+NOM+VERBE fini) a un rappel mesuré NUL (0 sur 22 681 phrases réelles) ; la vraie faute vit en position OBJET (« wagged it's tail »), indiscernable des complétives (« said it's time ») |
| confusables par créneau (council/counsel…) | 🔴 | 20 mots (lectures NOM/ADJ seules) ; 68 groupes = sens pur, HORS D'ATTEINTE en rouge |
| confusables indécidables (witch/which) | 🟠 info | liste curée 109 groupes, membre rare seulement (flood 2,07 % = périmètre) |

## 4. CONJUGAISON / ACCORD

| phénomène | état | note |
|---|---|---|
| 3sg (he go→goes) | 🔴 | 9 gardes (prétérit, gérondif, pronom non-sujet…) |
| interrogatif do/does/did · be · have | 🔴 | 0 FP / 177 748 tokens |
| auxiliaire (he are going→is, he have gone→has) | 🔴 | |
| participe après have (has went→gone) | 🔴 | miroir : sur-régularisation couverte |
| was/were (pronoms) | 🔴 | we was→were ✓ |
| modal + forme fléchie (she can sings, he will came) | 🔴 LIVRÉ (2026-08-12, `baseFormDecide`) | past + 3sg ; gardes : minuscule, pas en tête (inversion), pas après dét/prép (« the can », « on may »), cible ∉ be/modaux (« free will is », would=past AGID de will), forme ∉ bases (« will saw ») |
| to + forme fléchie (have to reduced) | 🔴 LIVRÉ (2026-08-12) | gouverneur INFINITIVAL fermé adjacent exigé — le to prépositionnel + participe adjectival était 12 des 24 tirs du proto (« leads to reduced activity ») ; PAST seulement ; jamais -ing (« forward to going ») |
| do/does/did déclaratif + forme fléchie (she did went) | 🔴 LIVRÉ (2026-08-12) | PAST seulement (« did wonders » = pluriel nominal) ; be exclu (« all we did was » = pseudo-clivée) |
| comparatif redondant (more better, most easiest) | 🔴 LIVRÉ (2026-08-12, `doubleCompDecide`) | comparatifs RÉELS de forms_en (2 359/2 397) — « more clever », « most honest » sûrs par CONSTRUCTION (pas un test de suffixe) ; le more/most est supprimé ; 0 tir/10 137 |
| pluriel irrégulier + s (childrens, mens) | 🟠 LIVRÉ (2026-08-12, `irregPluralDecide`) | 10 formes ; « mens rea » (latin juridique) exclu ; l'infobulle mentionne le possessif (children's) — ⚠️ elle était écrite mais jamais AFFICHÉE (le rendu ne montrait le « pourquoi » que pour les suppressions), branchée le 17/09/2026 ; 0 tir/10 137, 1 vraie faute web |
| accord en nombre dét↔nom | 🟠 | REFUSÉ 2× en rouge (+5 puis +11 FP — nom épithète = fait de langue) ; vit en orange |
| BE-copule (they is happy) | ⛔ réfuté | sujets nominaux = mur du chunker de GN ; pronoms = rappel 0 |
| accord sujet nominal (the boys goes) | ⛔ réfuté 3× | il faut savoir où FINIT le GN ; prochaine tentative = chunker d'abord |
| manquant « to » (I want go home) | ⛔ REPORTÉ chiffré (2026-08-12) | les 3 seuls tirs réels étaient tous MAUVAIS : « the Court need reach » (need SEMI-MODAL juridique correct), « wanted win in 48 hours » (win = typo de within → fausse direction), « want want » (répétition). 0 vrai positif sur 22 681 phrases |

## 5. TYPOGRAPHIE / PONCTUATION / CASSE

| phénomène | état | note |
|---|---|---|
| espace avant , . ; : ! ? · espace manquant après point (majuscule exigée) · doublement , . | 🔴 | plus large que le FR (l'anglais n'espace jamais avant) ; ! ? exclus du doublement (emphase) |
| répétition de mot (the the) | 🟠 LIVRÉ (2026-08-12, `repetitionDecide`) | ORANGE, pas rouge comme en FR : les genres court/speech de GUM transcrivent les disfluences verbatim (24 tirs, tous là) — l'oral transcrit est hostile à cette règle ; liste blanche had/that/very/… ; « Duran Duran » exclu (2ᵉ capitalisé) ; rappel web 17 |
| pronom « i » minuscule | 🔴 LIVRÉ (2026-08-12, `capIDecide`) | « clôture absolue » RÉFUTÉ par la mesure : « i square root of two » (imaginaire ×8), hawaïen, « the i » (journal britannique), troncatures « i- ». Cadre sûr = **i + VERBE/AUX au tagger** + gardes the/romain/i.e./trait d'union → 1 tir/10 137 = vraie faute ; rappel web **194** |
| jours/mois minuscules (monday, january) | 🟠 LIVRÉ (2026-08-12, `calendarCapDecide`) | 16 mots — may/march/august EXCLUS (modal, marche, adjectif auguste) ; 1 tir/10 137 = vraie anomalie ; rappel web 10 |
| possessif sans apostrophe (my dads car) | ❌ | dads = pluriel légitime ; il faut le contexte possessif → 🟠 au mieux, à mesurer |

## 5 bis. LE PIPELINE ET SES BANCS (17/09/2026)

La chaîne des 18 décisions vit dans le moteur : `analyzeText(lex, text, ctx)` rend, pour chaque mot, `{sugg, cls, rule}`. La page ne fait plus que le rendu ; les bancs appellent la même fonction avec tous les actifs (`loadAllNode`). Déplacement vérifié au caractère : la page committée et la page refaite donnent le même HTML sur 15 104 textes (cas de garde, PUD, EWT, JFLEG), 2 250 marques. Avant, chaque banc rejouait SA copie de la chaîne — sans les contractions, la forme de base, « i » → I, les mots collés — et le banc de texte édité passait les oranges avant le speller : on mesurait autre chose que le produit.

| banc | ce qu'il mesure | 17/09/2026 (pipeline du produit) |
|---|---|---|
| `fp_en_propre_probe.js` (local) | rouges et oranges sur texte ÉDITÉ, PUD + genres édités de GUM | 15 rouges / 176 893 tokens, tous de vraies fautes du corpus (11 avec l'ancienne chaîne, qui ignorait 4 règles) ; 582 oranges (0,33 %) |
| `jfleg_en_probe.js` (local) | rouges confirmés par ≥ 1 des 4 annotateurs | 295 / 308 = 95,8 % (références recollées : « do n't » → don't, sinon aucune contraction n'était jamais confirmée) |
| `ewt_typos_en_probe.js` (**CI**) | rappel du produit sur 626 fautes RÉELLES en contexte, annotées par UD English-EWT (`Typo=Yes` / `CorrectForm`) | 231 bien corrigées (36,9 %) dont 90 rouges ; 4 rouges faux, imprimés ; 279 muettes parce que la graphie est un vrai mot (you → your ×14, the → they, to ↔ too) = le prochain écart ; plancher 228 / 88, plafond 4 |
| `recall_en_probe.py` (local) | bonne cible du speller, 2 886 fautes de la liste de Wikipédia | 86,4 % · rouge faux 1 |

## 6. CE QU'ON A DÉCIDÉ / RÉFUTÉ (ne pas rejouer)

- ⛔ **be + forme nue** (he is concern→concerned) : précision 8/35 sur JFLEG — be ne contraint RIEN.
- ⛔ **contrainte de créneau dominante** : 614→612, dégrade. Le bonus reste un bonus.
- ⛔ **rescoring POS du speller** : toute dose dégrade (95,4→94,0→90,5 %).
- ⛔ **brancher homophones_en.json (5 549)** : 36 % de flood — index de collisions, pas de confusions.
- ⛔ **dérivation -y→-iness** : kaikki marque money/turkey ADJ → moneiness. Chantier lexique.
- ⛔ **extension navigateur EN** : décision de Rem, actée.
- SCONJ 58,8 % : frontière de proposition = début de parseur, pas une table.
- ⛔ **« rival à DEUX éditions » pour rétrograder un rouge** (17/09/2026) : les deux rouges faux connus ont leur bonne cible à deux éditions (convience → convenience, welcame → welcomed). Mesuré sur 3 284 rouges (Wikipédia, Wiktionary, EWT, JFLEG) : « un rival fréquent à deux éditions » rétrograde **757 rouges JUSTES** pour 12 faux ; « même son » n'attrape rien ; « forme fléchie de la cible » : 387 justes perdus pour 6. On ne retire pas des centaines de corrections pour deux cas.
- ⛔ **orange « mot rare voisin d'un mot très fréquent »** (wether → whether, 17/09/2026) : 35 occasions dans EWT, mais sur du texte ÉDITÉ la règle soulignerait 0,22 % des mots connus (PUD) à 0,25 % (GUM) — un mot juste sur 400, presque tous légitimes (arid, silt, median, tort, mites). Flood sans rendement.

---

## CE QUI MANQUE RÉELLEMENT — priorisé dys (audibilité × fréquence × FP-risque)

1. ~~Contractions sans apostrophe~~ — **🔴 LIVRÉ le jour même** (§2) : 30 formes rouges + 4
   homographes sous contexte ; les fausses directions (dont→don, youre→your, ive→give) sont mortes.
2. ~~Modal / to / do + forme fléchie → base~~ — **🔴 LIVRÉ** (`baseFormDecide`, carte
   forms_en 34 064 formes, ambiguïtés levées par dominance de fréquence ≥20× — « went » = past de
   go ET wend). Mesuré : flood 1/15 353 phrases éditées (vraie faute GUM « could wired ») ;
   **JFLEG 5/5 confirmées gold**.
3. ~~Répétition de mot~~ — **🟠 LIVRÉ** (orange : les transcriptions orales répètent verbatim).
4. ~~« i » → I~~ — **🔴 LIVRÉ** (cadre i+verbe ; le « clôture absolue » du 1er jet était FAUX).
5. ~~alot + collés figés~~ — **🔴 LIVRÉ** (14 formes).
6. ~~more better / most easiest~~ — **🔴 LIVRÉ** (comparatifs réels de forms_en).
7. **it's → its** (direction inverse) — possessif devant nom. 🔴 à mesurer.
8. **childrens/mens** (🟠, ambigu possessif) · **jours/mois** (🟠, politique de casse) ·
   **« to » manquant** (🟠, gouverneurs fermés, à mesurer).

Discipline inchangée : occasions sur JFLEG d'abord, flood sur PUD+GUM (chaque tir LU — EWT est du
web fautif, borne supérieure seulement), gardes CI des deux sens vérifiées en les cassant, câblage
PAGE vérifié (`en_page_wiring_probe`), et lecture des cas avant toute conclusion.
