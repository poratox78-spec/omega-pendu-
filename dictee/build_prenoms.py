# -*- coding: utf-8 -*-
"""PRÉNOMS + GENRE pour le correcteur — extracteur reproductible (demande de Rem, 2026-08-10).

POURQUOI. La machinerie d'accord fonctionne sur les noms communs mais est AVEUGLE sur les prénoms,
faute de connaître leur genre. Mesuré avec le moteur COMPLET (pas la seule couche speller) :

    « La fille est venu. »       -> venu→venue     ✓   (nom commun, genre connu)
    « La voiture est bleu. »     -> bleu→bleue     ✓
    « Le garçon est venue. »     -> venue→venu     ✓
    « Marie est venu. »          -> (RIEN)
    « Julie est parti. »         -> (RIEN)
    « ma soeur Julie est parti. »-> (RIEN)

Ce n'est donc pas la règle qui manque, c'est la DONNÉE. Critère de [[bases-genre-desaccentuees]] :
« pas le mot, la CAUSE de son absence » — ici la cause est une classe lexicale absente.

SOURCE : Wiktionnaire FRANÇAIS via kaikki.org (`data_local/fr/kaikki-frwikt.jsonl`), CC BY-SA =
notre licence. ⚠️ Le dump reste dans `data_local/` (gitignoré) ; SEULE la table extraite est commitée.

TROIS FILTRES, chacun motivé par une mesure :
  ① `pos=name` + tag `first-name` + initiale majuscule                    -> 9 274 prénoms vus
  ② genre NON AMBIGU : on écarte tout prénom dont UNE entrée porte à la fois `masculine` et
     `feminine` (« Prénom masculin ou féminin » : Claude, Camille, Alex, Dominique, Alix…).
     ⚠️ Quand les deux genres viennent d'entrées SÉPARÉES, on garde la PREMIÈRE seulement si
     l'autre genre est noté étranger (« Prénom féminin anglophone » : on garde « Jean » m.).
     ⭐ 09/11/2026 (liste n° 443) : sinon (« Sacha » : « Prénom masculin. » ET « Prénom féminin. »),
     le prénom est porté par les deux genres en français : genre « ? » (gardé comme prénom, aucun
     accord imposé). Avant, « Sacha est venue » recevait « venu » en ROUGE. 31 prénoms concernés.
  ④ MOTS-OUTILS écartés (« Elle », attesté comme prénom mais pronom 99,9 % du temps) — voir _OUTILS.
  ③ ANTI-PIÈGE DU DÉBUT DE PHRASE : en tête de phrase tout mot est capitalisé, donc « Rose est
     belle » peut être la fleur. Mesuré : 518 prénoms ont un homographe nom commun, mais 413 ont
     le MÊME genre (rose f./Rose f., olivier m./Olivier m.) = sans danger. Restent **105 dont le
     genre CONTREDIT** celui du nom commun (Pierre m. / la pierre f., Ada, Alizé, Boris, Avril…).
     ⚠️ On ne les JETTE PAS — ça coûtait « Pierre », l'un des prénoms français les plus courants.
     On les MARQUE (3ᵉ colonne `1`) : le moteur ne doit s'en servir QUE si le token n'est pas en
     tête de phrase, où une majuscule ne prouve rien. Ailleurs, une majuscule EST un nom propre.

TABLE : `nom<TAB>genre<TAB>tete_de_phrase_interdite` (genre m, f ou ? ; 3ᵉ colonne 1 seulement pour les 105).

    Lancer :  PYTHONUTF8=1 python dictee/build_prenoms.py
    Vérifier :  ... --check     (échoue si la table livrée n'est plus celle que produit ce script)
"""
import io, os, re, sys, json, collections

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(HERE)
DUMP = os.path.join(RACINE, 'data_local', 'fr', 'kaikki-frwikt.jsonl')
COMMUNS = os.path.join(RACINE, 'data_local', 'genre_accentue.json')
SORTIE = os.path.join(HERE, 'prenoms_genre.tsv')
CHECK = '--check' in sys.argv


# ④ MOTS-OUTILS : le Wiktionnaire enregistre « Elle » comme prénom (rare, mais attesté). Capitalisé
# en tête de phrase, c'est le PRONOM 99,9 % du temps — mesuré : 67 occurrences sur 2 500 phrases UD,
# contre 0 emploi comme prénom. Le genre coïncide (f), donc le FP restait à 0, mais le parseur
# rendait un sujet NOMINAL là où le chemin sujet-PRONOM doit s'appliquer : une mine, pas un bug.
# On écarte donc les pronoms et mots grammaticaux, quoi qu'en dise la source.
_OUTILS = set("""Elle Il On Nous Vous Ils Elles Je Tu Moi Toi Lui Eux Soi Le La Les Un Une Des Du De
Ce Cet Cette Ces Se Sa Son Ses Ma Mon Mes Ta Ton Tes Notre Nos Votre Vos Leur Leurs Et Ou Ni Or Car
Mais Si Que Qui Quoi Dont Ne Pas Plus Rien Tout Tous Toute Bien Aussi Encore En Y A Au Aux Par Pour
Sur Sous Sans Dans Avec Chez Vers Entre Contre Depuis Avant Après Ici Là Oui Non""".split())


# ② bis : origine étrangère notée dans la définition (« Prénom féminin anglophone »)
_ETRANGER = re.compile(r"anglophone|anglais|américain|britannique|irlandais|écossais|gallois|italien|allemand|germanique|espagnol|"
                       r"hispanique|portugais|brésilien|russe|slave|polonais|tchèque|néerlandais|flamand|scandinave|suédois|norvégien|"
                       r"danois|finnois|islandais|hongrois|grec|turc|arabe|hébreu|hébraïque|japonais|chinois|coréen|indien|persan|basque|"
                       r"breton|corse|occitan|catalan|roumain|bulgare|serbe|croate|albanais|arménien|géorgien|africain|latin|hawaïen|yiddish|"
                       r"jusqu|siècle|vieilli|désuet|rare", re.I)   # … ou ancien : « Prénom féminin jusqu'au début du XVIIᵉ siècle » (Philippe)


def deacc(w):
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFD', w) if unicodedata.category(c) != 'Mn')


def extrait():
    if not os.path.exists(DUMP):
        print('[FATAL] dump absent :', DUMP)
        print('        (data_local/ est gitignoré — récupérer kaikki.org/frwiktionary)')
        sys.exit(1)
    ordre = collections.defaultdict(list); gloses = collections.defaultdict(list)
    for ligne in io.open(DUMP, encoding='utf-8', errors='ignore'):
        try:
            d = json.loads(ligne)
        except ValueError:
            continue
        if d.get('pos') != 'name':
            continue
        w = d.get('word') or ''
        t = set(d.get('tags') or [])
        if 'first-name' not in t or not w or not w[0].isupper():
            continue
        if w in _OUTILS:
            continue                                        # ④ pronom / mot grammatical : jamais un sujet-prénom
        if not re.match(r"^[A-ZÀ-Þ][A-Za-zÀ-ÿ'’-]{1,}$", w):
            continue                                        # écarte sigles, chiffres, formes exotiques
        gl = ' '.join((s.get('glosses') or [''])[0] for s in (d.get('senses') or []))
        if 'masculine' in t and 'feminine' in t:
            ordre[w].append('x')                            # ② une SEULE entrée bi-genre = ambigu
        elif 'masculine' in t:
            ordre[w].append('m'); gloses[w].append(('m', gl))
        elif 'feminine' in t:
            ordre[w].append('f'); gloses[w].append(('f', gl))
    vus = len(ordre)
    table = {w: v[0] for w, v in ordre.items() if v and v[0] in ('m', 'f') and 'x' not in v}
    ambigus = vus - len(table)
    # ② bis (liste n° 443) : deux entrées SÉPARÉES de genre opposé — l'autre genre noté étranger → on garde le premier ;
    # sinon le prénom est porté par les deux genres en français → genre « ? »
    deux = 0
    for w in table:
        autres = [g for g, _ in gloses[w] if g != table[w]]
        if autres and not all(_ETRANGER.search(gl) for g, gl in gloses[w] if g != table[w]):
            table[w] = '?'; deux += 1

    # ③ anti-piège du début de phrase : on MARQUE, on ne jette pas
    conflits = set()
    if os.path.exists(COMMUNS):
        com = json.load(io.open(COMMUNS, encoding='utf-8'))
        for w in table:
            gc = com.get(w.lower())
            if gc in ('m', 'f') and table[w] in ('m', 'f') and gc != table[w]:
                conflits.add(w)
    return table, vus, ambigus, conflits, deux


# ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
# ⭐ 24/11/2026 (liste n° 668, demande de Rem) — LES NAISSANCES. La table du Wiktionnaire ne couvrait que 84,5 % des naissances
# en France : Catherine, Georges, Anne, Stéphane, Maxime, Audrey manquaient (« Catherine est venu » : aucune alerte).
# Deux sources de plus, toutes deux dans data_local/prenoms_sources/ (gitignoré ; SEULE la table extraite est commitée) :
#   · INSEE, « Fichier des prénoms » 1900-2025 (Licence Ouverte 2.0), avec les accents : insee-prenoms-2025-nat.csv
#   · Retraite Québec, « Banque de prénoms » 1980-2025 (CC BY 4.0), SANS accents : quebec-garcons.csv, quebec-filles.csv
# RÈGLES (décisions de Rem) :
#   ① un prénom d'au moins 300 naissances en France (Mery : 420) ou 200 au Québec entre dans la table ;
#   ② son genre est le sexe MAJORITAIRE des naissances, et la part de ce sexe est gardée (5ᵉ colonne) : sous 95 %, le moteur
#      PROPOSE l'accord en orange au lieu de l'imposer (Camille 72 %, Claude 88 %, Mery 89 %). Exception : les 31 prénoms que le
#      Wiktionnaire donne pour masculins ET féminins en français (② bis, Sacha) gardent le genre « ? » : aucun accord proposé ;
#   ③ un prénom se reconnaît aussi SANS ses accents (« Emilie », « Helene » : en France on n'accentue guère les capitales) :
#      une ligne d'alias par forme nue, avec la graphie de référence (4ᵉ colonne) — sauf si la forme nue est un mot du
#      dictionnaire (« Honoré » / « honore ») ;
#   ④ un prénom NEUF qui est aussi un mot courant (Jade, Ange, Soleil, Aime) est marqué « pas en tête de phrase » ;
#   ⑤ Québec : la graphie accentuée vient de l'INSEE quand le prénom y existe, sinon de la liste à la main _QC_ACCENT.
#   ⑥ première mesure sur les textes réels : un prénom RARE est souvent autre chose dans un texte (un roi, un lieu) — le moteur
#      n'impose l'accord (rouge) qu'à partir de 5 000 naissances, d'où la 6ᵉ colonne.
# TABLE : nom <TAB> genre (m, f, ?) <TAB> tête de phrase interdite (0/1) <TAB> graphie de référence (forme sans accent)
#         <TAB> part du sexe majoritaire (%) <TAB> naissances comptées (France + Québec) <TAB> source (w = Wiktionnaire, n = naissances seules).
#   ⑦ un prénom connu par les SEULES naissances n'impose l'accord qu'à partir de 50 000 naissances (« Leslie »), et un mot en
#      minuscule n'est lu comme prénom qu'à partir de 5 000 (« maï » reste corrigé en « mai »).
SOURCES = os.path.join(RACINE, 'data_local', 'prenoms_sources')
SEUIL_FR, SEUIL_QC = 300, 200
_QC_ACCENT = {'Anaeve': 'Anaève', 'Anna-Eve': 'Anna-Ève', 'Cedrik': 'Cédrik', 'Eloic': 'Éloïc', 'Eliam': 'Éliam', 'Emeraude': 'Émeraude',
              'Emerik': 'Émerik', 'Frederike': 'Frédérike', 'Lea-Jade': 'Léa-Jade', 'Lea-Kim': 'Léa-Kim', 'Lea-Maude': 'Léa-Maude',
              'Loik': 'Loïk', 'Mahelie': 'Mahélie', 'Mederick': 'Médérick', 'Sara-Eve': 'Sara-Ève', 'Sarah-Eve': 'Sarah-Ève',
              'Stefanie': 'Stéfanie', 'Veronic': 'Véronic'}
_FORME = re.compile(r"^[A-ZÀ-Þ][A-Za-zÀ-ÿ'’-]{1,}$")


def etendre(table, conflits):
    import lzma
    cap = lambda k: '-'.join(p[:1].upper() + p[1:].lower() for p in k.split('-'))
    sexe = lambda m, f: 'm' if m > f else 'f' if f > m else '?'
    part = lambda m, f: str(int(round(100.0 * max(m, f) / (m + f))))
    for f in ('insee-prenoms-2025-nat.csv', 'quebec-garcons.csv', 'quebec-filles.csv'):
        if not os.path.exists(os.path.join(SOURCES, f)):
            print('[FATAL] source absente :', os.path.join(SOURCES, f)); sys.exit(1)
    T = collections.OrderedDict((w, [table[w], '1' if w in conflits else '0', '', '', '', 'w']) for w in sorted(table))
    I = collections.defaultdict(lambda: [0, 0])
    with io.open(os.path.join(SOURCES, 'insee-prenoms-2025-nat.csv'), encoding='utf-8') as h:
        h.readline()
        for l in h:
            c = l.rstrip('\n').split(';')
            if len(c) >= 4 and c[3].replace('.', '').isdigit():
                I[cap(c[1])][0 if c[0] == '1' else 1] += int(float(c[3]))
    com = json.load(io.open(COMMUNS, encoding='utf-8')) if os.path.exists(COMMUNS) else {}
    freq = {}
    with io.TextIOWrapper(lzma.open(os.path.join(RACINE, 'Lexique4.tsv.xz')), encoding='utf-8') as h:
        h.readline()
        for l in h:
            c = l.split('\t')
            try:
                freq[c[0]] = max(freq.get(c[0], 0.0), float(c[9] or 0))
            except ValueError:
                freq.setdefault(c[0], 0.0)
    def tete(w, g):                                            # ④
        gc = com.get(w.lower())
        return '1' if (g in ('m', 'f') and gc in ('m', 'f') and gc != g) or freq.get(w.lower(), 0) >= 1 else '0'
    nb = collections.Counter()
    for w in I:
        if deacc(w) != w:
            nb[deacc(w)] += sum(I[w])
    soeur = set(d for d in nb if nb[d] > sum(I.get(d, [0, 0])))   # la graphie accentuée est la plus donnée
    for w in list(I):                                          # ① ② France
        m, f = I[w]
        if m + f < SEUIL_FR or w in _OUTILS or not _FORME.match(w):
            continue
        if w not in T and w in soeur and w.lower() in freq:
            continue                                           # ③ forme nue d'un prénom accentué, et mot du dictionnaire
        g = sexe(m, f)
        if w not in T:
            T[w] = [g, tete(w, g), '', part(m, f), str(m + f), 'n']
        else:
            if T[w][0] != '?':                                 # liste n° 443 : « Sacha », masculin ET féminin pour le Wiktionnaire, reste sans genre
                T[w][0] = g
            T[w][3] = part(m, f); T[w][4] = str(m + f)
    Q = collections.defaultdict(lambda: [0, 0])                # ① ② ⑤ Québec
    for k, fn in enumerate(('quebec-garcons.csv', 'quebec-filles.csv')):
        with io.open(os.path.join(SOURCES, fn), encoding='utf-8-sig') as h:
            h.readline()
            for l in h:
                c = l.rstrip('\n').split(',')
                if ' ' in c[0]:
                    continue
                Q[cap(c[0])][k] += sum(int(x) if x.isdigit() else (2 if x == '<5' else 0) for x in c[1:])
    par = collections.defaultdict(list)
    for w in T:
        par[deacc(w)].append(w)
    ins = collections.defaultdict(list)
    for w in I:
        ins[deacc(w)].append(w)
    for d in list(Q):
        m, f = Q[d]
        if m + f < SEUIL_QC or d in par or d in _OUTILS or not _FORME.match(d):
            continue
        w = _QC_ACCENT.get(d) or (max(ins[d], key=lambda x: (sum(I[x]), x)) if d in ins else d)
        g = sexe(m, f)
        T[w] = [g, tete(w, g), '', part(m, f), str(m + f + sum(I.get(w, [0, 0]))), 'n']; par[deacc(w)].append(w)
    for d, w in sorted(_QC_ACCENT.items()):
        if d in T and w not in T:
            T[w] = list(T[d]); par[deacc(w)].append(w)
    for d in sorted(par):                                      # ③ les formes sans accent
        L = sorted(w for w in par[d] if w != d)
        if not L:
            continue
        if d in T:                                             # « Emilie », « Sebastien » : graphies de l'état civil, la sœur accentuée fait référence
            vraies = [w for w in L if sum(I.get(w, [0, 0])) >= SEUIL_FR or freq.get(w.lower(), 0) >= 1]   # une sœur réellement donnée (« Cathérine », 0 naissance, ne fait pas référence pour « Catherine »), ou qui est aussi un mot courant (« Léger »)
            if vraies:
                T[d][2] = max(vraies, key=lambda x: (sum(I[x]), x))
            continue
        if d.lower() in freq:
            continue
        gs = set(T[w][0] for w in L)
        ref = max(L, key=lambda x: (sum(I.get(x, [0, 0])), x))
        T[d] = [gs.pop() if len(gs) == 1 else '?', '1' if any(T[w][1] == '1' for w in L) else '0', ref, T[ref][3] if len(gs) == 0 else '', T[ref][4] if len(gs) == 0 else '', T[ref][5]]
    return T


if __name__ == '__main__':
    table, vus, ambigus, conflits, deux = extrait()
    T = etendre(table, conflits)
    lignes = ''.join('%s\t%s\n' % (w, '\t'.join(T[w])) for w in sorted(T))
    nm = sum(1 for v in T.values() if v[0] == 'm')
    nf = sum(1 for v in T.values() if v[0] == 'f')
    conflits = set(w for w in T if T[w][1] == '1')
    wikt = len(table); table = T

    if CHECK:
        actuel = io.open(SORTIE, encoding='utf-8').read() if os.path.exists(SORTIE) else None
        if actuel == lignes:
            print('  ✓ table des prénoms FRAÎCHE : %d prénoms (%d m / %d f, %d à majuscule ambiguë)'
                  % (len(table), nm, nf, len(conflits)))
            sys.exit(0)
        print('  ✗ TABLE DES PRÉNOMS PÉRIMÉE : dictee/prenoms_genre.tsv ≠ build_prenoms.py')
        print('    Corriger : PYTHONUTF8=1 python dictee/build_prenoms.py')
        sys.exit(1)

    io.open(SORTIE, 'w', encoding='utf-8', newline='\n').write(lignes)
    print('TABLE écrite : dictee/prenoms_genre.tsv')
    print('  prénoms vus (pos=name + first-name)   : %d' % vus)
    print('  ② écartés, genre ambigu               : %d  (Claude, Camille, Alex, Dominique…)' % ambigus)
    print('  ② bis genre « ? » (deux entrées FR)    : %d  (Sacha, Marin…)' % deux)
    print('  ③ MARQUÉS « pas en tête de phrase »   : %d  (%s…)' % (len(conflits), ', '.join(sorted(conflits)[:6])))
    print('  Wiktionnaire seul                     : %d' % wikt)
    print('  RETENUS (avec INSEE, Québec, alias)   : %d  (%d masculins / %d féminins, %d formes sans accent)' % (len(table), nm, nf, sum(1 for v in table.values() if v[2])))
