# -*- coding: utf-8 -*-
"""build_metier_lex.py — lot « métier » du dictionnaire d'orthographe (liste n° 7 et 10, 15/10/2026).

Source : dictee/metier_curated.tsv (liste relue à la main : mot, nature, genre, domaine). Sortie : dictee/metier_lex_fr.tsv, lignes au
schéma Lexique4 (37 colonnes) comme les autres lots, FreqOrtho 0,05 (candidat possible au tri, jamais dominant — comme l'extrait
Wiktionnaire de juillet). Chaque mot est validé contre le dictionnaire de BASE (Lexique4 + les lots sources, pas l'asset livré) avec
les gardes mesurées sur les corpus dys le 15/10/2026 :
  - absent du dictionnaire (sinon : doublon inutile) ;
  - pas un jumeau d'accent d'un mot connu ≥ 0,1/M (l'accent oublié est LA faute dys) ;
  - pas à une lettre d'un mot connu ≥ 1/M (il masquerait une faute).
  python dictee/build_metier_lex.py            # régénère dictee/metier_lex_fr.tsv (Lexique4 requis, data_local)
  python dictee/build_metier_lex.py --check    # garde (dev.sh + CI) : TSV commité bien formé, et chaque mot câblé dans speller.tsv.gz
"""
import csv, gzip, io, os, sys, unicodedata
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
SRC = os.path.join(HERE, 'metier_curated.tsv'); OUT = os.path.join(HERE, 'metier_lex_fr.tsv')
SPELLER = os.path.join(ROOT, 'extension', 'assets', 'speller.tsv.gz')
LEX4 = os.environ.get('LEX4') or os.path.join(ROOT, 'data_local', 'Lexique4.tsv')
LOTS = ('wikt_lex_fr.tsv', 'argot_rows.tsv', 'participle_rows.tsv', 'gacc_lex_fr.tsv', 'morph_na_lex_fr.tsv', 'morph_ver_lex_fr.tsv.gz', 'morph_acc_lex_fr.tsv', 'conj_lex_fr.tsv', 'ver_justes_lex_fr.tsv.gz', 'rect90_lex_fr.tsv.gz')
NC = 37; CI = {'Mot': 0, 'Lemme': 3, 'Cgram': 4, 'CgramOrtho': 5, 'Genre': 6, 'FreqMot': 9, 'FreqOrtho': 10, 'FreqLemme': 11}
CG = {'N': 'NOM', 'V': 'VER', 'A': 'ADJ'}
AB = 'abcdefghijklmnopqrstuvwxyz'

def deacc(s):
    s = s.replace('œ', 'oe').replace('æ', 'ae')
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
def e1(w):
    S = [(w[:i], w[i:]) for i in range(len(w) + 1)]
    return set([a + b[1:] for a, b in S if b] + [a + c + b[1:] for a, b in S if b for c in AB] + [a + c + b for a, b in S for c in AB] + [a + b[1] + b[0] + b[2:] for a, b in S if len(b) > 1])

def lire_curated():
    rows = []
    for l in io.open(SRC, encoding='utf-8'):
        l = l.rstrip('\n')
        if not l or l.startswith('#'): continue
        p = l.split('\t')
        if len(p) < 4 or p[1] not in CG: raise SystemExit('metier_curated.tsv : ligne mal formée : ' + l)
        rows.append((p[0].strip().lower(), p[1], p[2].strip(), p[3]))
    return rows

def base():
    """mots du dictionnaire de base : Lexique4 + lots sources → (connus, freq milli par mot désaccentué max)"""
    connus, sq = set(), {}
    srcs = [LEX4] + [os.path.join(HERE, f) for f in LOTS if os.path.exists(os.path.join(HERE, f))]
    H = None
    for s in srcs:
        with (gzip.open(s, 'rt', encoding='utf-8') if s.endswith('.gz') else io.open(s, encoding='utf-8')) as f:
            r = csv.reader(f, delimiter='\t')
            if H is None: H = next(r)
            ci = {h.lower(): i for i, h in enumerate(H)}; cm = next(i for h, i in ci.items() if 'mot' in h); cf = next(i for h, i in ci.items() if 'freqortho' in h)
            for row in r:
                if len(row) <= max(cm, cf): continue
                w = (row[cm] or '').strip().lower()
                if not w: continue
                try: fm = int(round(float((row[cf] or '0').replace(',', '.')) * 1000))
                except ValueError: fm = 0
                connus.add(w); d = deacc(w); sq[d] = max(sq.get(d, 0), fm)
    return connus, sq

def ligne(w, nat, g):
    row = [''] * NC; cg = CG[nat]
    row[CI['Mot']] = w; row[CI['Lemme']] = w; row[CI['Cgram']] = cg; row[CI['CgramOrtho']] = cg; row[CI['Genre']] = g if nat == 'N' else ''
    row[CI['FreqMot']] = row[CI['FreqOrtho']] = row[CI['FreqLemme']] = '0.05'
    return '\t'.join(row)

def construire():
    rows = lire_curated(); connus, sq = base(); ko = []; out = []
    for w, nat, g, dom in rows:
        d = deacc(w)
        if w in connus: ko.append('« %s » est déjà au dictionnaire' % w); continue
        if sq.get(d, 0) >= 100: ko.append('« %s » : jumeau d\'accent d\'un mot connu ≥ 0,1/M' % w); continue
        if any(x != d and sq.get(x, 0) >= 1000 for x in e1(d)): ko.append('« %s » : à une lettre d\'un mot connu ≥ 1/M' % w); continue
        out.append(ligne(w, nat, g))
    if ko: print('✗ lot métier : ' + ' ; '.join(ko)); sys.exit(1)
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(out) + '\n')
    print('✓ écrit %s : %d mots' % (OUT, len(out)))

def check():
    ko = []
    lignes = [l.rstrip('\n') for l in io.open(OUT, encoding='utf-8') if l.strip()]
    mots = [l.split('\t')[0] for l in lignes]
    if any(l.count('\t') != NC - 1 for l in lignes): ko.append('TSV mal formé (37 colonnes attendues)')
    attendus = [w for w, _n, _g, _d in lire_curated()]
    if mots != attendus: ko.append('metier_lex_fr.tsv ne suit pas metier_curated.tsv — relance python dictee/build_metier_lex.py')
    connus = set()
    with gzip.open(SPELLER, 'rt', encoding='utf-8') as f:
        for l in f: connus.add(l.split('\t')[0])
    absents = [m for m in mots if m not in connus]
    if absents: ko.append('non câblés dans speller.tsv.gz : %s — régénérer le dictionnaire' % ', '.join(absents))
    if ko: print('✗ lot métier : ' + ' ; '.join(ko)); sys.exit(1)
    print('✓ lot métier : %d mots (agentique, upcycler, rissole…) bien formés et câblés dans speller.tsv.gz' % len(mots))

if __name__ == '__main__':
    check() if '--check' in sys.argv else construire()
