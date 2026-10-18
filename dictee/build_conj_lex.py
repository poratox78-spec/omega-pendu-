# -*- coding: utf-8 -*-
"""build_conj_lex.py — SPELLER : les formes VERBALES valides que la table de conjugaison connaît et que le dictionnaire ignore
(liste n° 6, 14/10/2026).

Le symptôme (relu dans un texte réel ; phrases inventées équivalentes) : « elles outillent leurs ateliers » → outils, « les robots
indexent le site » → indécent, « elle aime prototyper » souligné. Le dictionnaire d'orthographe (Lexique 4 + lots) et la table de
conjugaison (vdc-lex.json, `cj`) ne sont pas synchronisés : la table a des formes que le dictionnaire n'a pas, et la table elle-même
a des trous au présent (« outiller » n'y avait que « outillons »).

Trois sources, toutes tirées de la table du produit :
  A. formes de la table absentes du dictionnaire (« indexent ») ;
  B. infinitif des lemmes en -er, accent reconstruit sur l'imparfait (1p − « ions » + « er » : « prototyper ») ;
  C. présent (1s, 2s, 3s, 3p — indicatif et subjonctif) des lemmes en -er quand la table a un trou : dérivé d'une forme présente
     (3s = 1s ; 2s = 3s + s ; 3p = 3s + nt ; 3s = 3p − nt), ou du radical de l'infinitif quand il ne connaît aucune alternance.
Quatre filtres anti-masquage, MESURÉS au produit (3 corpus dys + UD, voir la PR) — sans eux, des fautes réelles devenaient « valides » :
  (i) une lettre : jamais (« a » réveillait l'élision « 48 m a » → m'a) ;
  (ii) frère d'accent d'un mot connu (« entrecoupes » ↔ entrecoupés : l'accent oublié est LA faute dys) — ces présents-là sont
       acceptés en contexte verbal par le moteur (_presentRegulier), pas par le dictionnaire ;
  (iii) à une lettre d'un mot fréquent (≥ 20/M dans Lexique 4 : « fouis » masquerait « fois ») ;
  (iv) consonne doublée ou dédoublée d'un mot connu (« débutte » ↔ débute).
⭐ Liste n° 108 (18/10/2026) : ces filtres ne valent que pour les formes CONSTRUITES ici (non attestées). Une forme ATTESTÉE (Morphalou +
un dictionnaire indépendant) entre par ver_justes_lex_fr.tsv.gz, même à une lettre d'un mot fréquent (« entrecoupes », « fouis »,
« débutte » sont justes) : la confusion qu'elle pourrait cacher se rattrape par le CONTEXTE (_ctx108), jamais en refusant le mot.
Même contrat que les lots Morphalou : FreqOrtho 0 → dans WORDS, jamais dans D2A/PHON (jamais candidat, jamais concurrent).
Base NON circulaire : Lexique 4 + les lots SOURCES (pas l'asset livré, qui contient ce lot).

  python dictee/build_conj_lex.py            # régénère dictee/conj_lex_fr.tsv (Lexique 4 requis, data_local)
  python dictee/build_conj_lex.py --check    # forme du TSV commité (37 colonnes, FreqOrtho 0) + câblage dans le speller livré
"""
import io, os, re, sys, csv, json, gzip, unicodedata, collections
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..')
OUT = os.path.join(HERE, 'conj_lex_fr.tsv')
LOTS = ('wikt_lex_fr.tsv', 'argot_rows.tsv', 'participle_rows.tsv', 'gacc_lex_fr.tsv', 'morph_na_lex_fr.tsv', 'morph_ver_lex_fr.tsv.gz', 'morph_acc_lex_fr.tsv', 'metier_lex_fr.tsv', 'ver_justes_lex_fr.tsv.gz', 'rect90_lex_fr.tsv.gz')
SEUIL = 20.0
CONS = 'bcdfglmnprst'
da = lambda s: ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


def _table():
    sys.path.insert(0, HERE); import conj_io
    vd = json.load(io.open(os.path.join(ROOT, 'extension', 'assets', 'vdc-lex.json'), encoding='utf-8'))
    return conj_io.reconstruire(vd['cj'])['c']


def generer():
    lex4 = os.environ.get('LEX4', os.path.join(ROOT, 'data_local', 'Lexique4.tsv'))
    base, freq = set(), set()
    with io.open(lex4, encoding='utf-8') as f:
        r = csv.reader(f, delimiter='\t'); H = next(r); ci = {h.lower(): i for i, h in enumerate(H)}
        cm = next(i for h, i in ci.items() if 'mot' in h); cf = next(i for h, i in ci.items() if 'freqortho' in h)
        for row in r:
            if len(row) <= max(cm, cf): continue
            w = row[cm].strip().lower(); base.add(w)
            try: fr = float((row[cf] or '0').replace(',', '.'))
            except ValueError: fr = 0.0
            if fr >= SEUIL: freq.add(w)
    for lot in LOTS:
        fn = os.path.join(HERE, lot)
        with (gzip.open(fn, 'rt', encoding='utf-8') if fn.endswith('.gz') else io.open(fn, encoding='utf-8')) as f:
            for l in f: base.add(l.split('\t', 1)[0].strip().lower())
    based = collections.defaultdict(set)
    for w in base: based[da(w)].add(w)
    FD = set()
    for w in freq:
        d = da(w); FD.add(d); FD.update(d[:i] + d[i + 1:] for i in range(len(d)))
    def voisin_frequent(f):
        d = da(f)
        return d in FD or any(d[:i] + d[i + 1:] in FD for i in range(len(d)))
    def redoublement(f):
        if any(f[i] == f[i - 1] and f[i] in CONS and (f[:i] + f[i + 1:]) in base for i in range(1, len(f))): return True
        return any(f[i] in CONS and (f[:i + 1] + f[i] + f[i + 1:]) in base for i in range(len(f)))
    C = _table(); cand = {}
    def ajoute(f, lem):
        if f and f not in base and f not in cand and re.match(r'^[a-zà-ÿœæ]+$', f): cand[f] = lem
    for lem, slots in C.items():
        if not isinstance(slots, dict): continue
        for mt, sl in slots.items():
            if isinstance(sl, dict):
                for per, f in sl.items():
                    for x in (f if isinstance(f, list) else [f]): ajoute(x, lem)
        if not lem.endswith('er') or lem == 'aller': continue
        imp = slots.get('ind:imp') or {}
        f1p = imp.get('1p'); f1p = f1p[0] if isinstance(f1p, list) else f1p
        inf = (f1p[:-4] + 'er') if (f1p and f1p.endswith('ions')) else None
        if inf and da(inf) == lem: ajoute(inf, lem)
        for mt in ('ind:pre', 'sub:pre'):
            sl = slots.get(mt) or {}
            g = lambda k: (sl.get(k)[0] if isinstance(sl.get(k), list) else sl.get(k))
            s3 = g('3s') or g('1s') or (g('2s')[:-1] if g('2s') and g('2s').endswith('s') else None) or (g('3p')[:-2] if g('3p') and g('3p').endswith('ent') else None)
            if not s3 and inf:
                rad = inf[:-2]
                if not re.search(r'[eé][^aeiouyéèêëàâîïôûù]+$', rad) and not re.search(r'(ç|g|y|el|et)$', rad): s3 = rad + 'e'
            if s3 and s3.endswith('e'):
                for f in (s3, s3 + 's', s3 + 'nt'): ajoute(f, lem)
    rows, n = [], collections.Counter()
    for f in sorted(cand):
        if len(f) < 2: n['une lettre'] += 1; continue
        if any(x != f for x in based.get(da(f), ())): n["frère d'accent"] += 1; continue
        if voisin_frequent(f): n['voisin fréquent'] += 1; continue
        if redoublement(f): n['redoublement'] += 1; continue
        row = [''] * 37; row[0] = f; row[3] = cand[f]; row[4] = 'VER'; row[5] = 'VER'; row[9] = '0'; row[10] = '0'; row[11] = '0'
        rows.append('\t'.join(row))
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(rows) + '\n')
    print('✓ conj_lex : %d formes -> %s (écartées : %s)' % (len(rows), os.path.relpath(OUT, ROOT), dict(n)))


def check():
    if not os.path.exists(OUT): print('✗ conj_lex_fr.tsv absent'); return 1
    L = [l.rstrip('\n') for l in io.open(OUT, encoding='utf-8') if l.strip()]
    bad = [l for l in L if len(l.split('\t')) != 37 or l.split('\t')[10] != '0' or l.split('\t')[4] != 'VER']
    if bad: print('✗ conj_lex_fr.tsv : %d ligne(s) mal formée(s) (37 colonnes, VER, FreqOrtho 0)' % len(bad)); return 1
    sp = {}
    for l in gzip.open(os.path.join(ROOT, 'extension', 'assets', 'speller.tsv.gz'), 'rt', encoding='utf-8'):
        p = l.rstrip('\n').split('\t'); sp[p[0]] = p[1] if len(p) > 1 else ''
    absents = [l.split('\t')[0] for l in L if l.split('\t')[0] not in sp]
    if absents: print('✗ conj_lex : %d forme(s) du lot absentes du speller livré (ex. %s) — régénérer le speller' % (len(absents), absents[:3])); return 1
    for w, attendu in (('outillent', True), ('indexent', True), ('prototyper', True), ('a', False)):   # entrecoupes / fouis / débutte : justes, entrés par le lot 108
        if (w in sp) != attendu: print('✗ conj_lex : « %s » %s au speller livré' % (w, 'absent' if attendu else 'présent')); return 1
    print('✓ conj_lex_fr.tsv : %d formes, 37 colonnes, FreqOrtho 0 ; câblé dans le speller livré (outillent, indexent, prototyper connus ; « a » non)' % len(L))
    return 0


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
    sys.exit(check() if '--check' in sys.argv else (generer() or 0))
