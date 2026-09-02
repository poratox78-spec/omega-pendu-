# -*- coding: utf-8 -*-
"""build_gacc_lex.py — AUGMENTATION DU SPELLER depuis une table qu on a DEJA (02/09/2026).

Rem : « faut etre sur qu on ne les a pas deja ». On les avait : GENDER_ACC (gender_acc.json, accentuee,
genre connu, kaikki+Lexique4+Morphalou, PR#573-578) contient 49 076 formes que le speller ignore — le
speller n a jamais recu Morphalou (build_speller_lex.py ne lit que Lexique4 + wikt_lex_fr.tsv).

Ce script ecrit dictee/gacc_lex_fr.tsv au FORMAT Lexique4 (37 colonnes), exactement comme wikt_lex_fr.tsv,
pour entrer dans la meme chaine : cat Lexique4.tsv wikt_lex_fr.tsv gacc_lex_fr.tsv -> build_speller_lex.py
(MINFREQ=0) -> inject_speller.py -> extension/build_assets.py.

AJOUT PUR et INERTE pour les suggestions PAR CONSTRUCTION : FreqOrtho = 0 -> freq embarquee 0,001 occ/M,
sous FLAG_FREQ (0,1) : jamais candidat AUTO/FLAG, absent de l index phonetique (>= FLAG_FREQ seulement).
Seul effet attendu : ces mots cessent d etre marques « mot inconnu ». Mesure au produit, pas suppose.

Filtre ANTI-MASQUAGE (mesure au produit, 02/09) : un mot rare ajoute a DISTANCE 1 d un mot FREQUENT
(>= 1 occ/M dans Lexique4) rend « valide » la faute de ce mot courant — « dess » masquait dess->des (x3),
« vermee » masquait vermee->fermee, mesure par le census. 4 175 des 46 799 candidats (8,9 %) sont dans
ce cas : ils restent « inconnus » (l orange sur un mot rare est la regle qui fait son travail, pas une faute).
Filtre anti-bruit A LA SOURCE (patron morphalou-lexique-croisement) : la graphie doit exister dans
Morphalou 3.1 (LGPL-LR, data_local/) — ecarte 2 264 entrees de GENDER_ACC (bleux, dre, carrets...).
Cgram = categorie du LEMME Morphalou (NOM/ADJ ; autres categories ecartees), Nombre = colonne 11 Morphalou,
Genre = GENDER_ACC. Sans Morphalou (CI) : --check verifie seulement que le TSV commite est bien forme.
  python dictee/build_gacc_lex.py            # regenere dictee/gacc_lex_fr.tsv
  python dictee/build_gacc_lex.py --check    # forme du TSV commite
"""
import io, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..')
sys.path.insert(0, HERE)
OUT = os.path.join(HERE, 'gacc_lex_fr.tsv')
NCOL = 37
CAT = {'Nom commun': 'NOM', 'Adjectif qualificatif': 'ADJ'}

ALPHA_ACC = "abcdefghijklmnopqrstuvwxyzàâäéèêëîïôöùûüçœæ'-"
def frequents(seuil=1.0):
    """Formes de Lexique4 a >= seuil occ/M (accentuees ET desaccentuees) — celles qu un ajout ne doit pas masquer."""
    import csv, unicodedata
    p = os.environ.get('LEX4', os.path.join(ROOT, 'data_local', 'Lexique4.tsv'))
    if not os.path.exists(p): p = 'C:/tmp/lex4/Lexique4.tsv'
    if not os.path.exists(p): return None
    dea = lambda t: ''.join(c for c in unicodedata.normalize('NFD', t) if unicodedata.category(c) != 'Mn')
    out = set()
    with io.open(p, encoding='utf-8') as f:
        r = csv.reader(f, delimiter=chr(9)); H = next(r); ci = {h.lower(): i for i, h in enumerate(H)}
        cm = next(i for h, i in ci.items() if 'mot' in h); cf = next(i for h, i in ci.items() if 'freqortho' in h)
        for row in r:
            if len(row) <= max(cm, cf): continue
            try: fr = float((row[cf] or '0').replace(',', '.'))
            except ValueError: fr = 0.0
            if fr >= seuil:
                w = row[cm].strip().lower(); out.add(w); out.add(dea(w))
    return out

def voisins1(w):
    out = set()
    for i in range(len(w)):
        out.add(w[:i] + w[i+1:])
        for c in ALPHA_ACC: out.add(w[:i] + c + w[i+1:])
    for i in range(len(w) + 1):
        for c in ALPHA_ACC: out.add(w[:i] + c + w[i:])
    for i in range(len(w) - 1): out.add(w[:i] + w[i+1] + w[i] + w[i+2:])
    return out

def morphalou():
    p = os.path.join(ROOT, 'data_local', 'morphalou', 'Morphalou3.1_CSV.csv')
    if not os.path.exists(p): return None
    info, cat = {}, None
    with io.open(p, encoding='utf-8', errors='replace') as fh:
        for l in fh:
            q = l.rstrip(chr(10)).split(';')
            if len(q) < 12: continue
            if q[0].strip(): cat = q[2].strip() or cat
            w = q[9].strip().lower()
            if not w: continue
            nb = q[11].strip().lower()[:1] if len(q) > 11 else ''
            info.setdefault(w, set()).add((cat, nb))
    return info

def main():
    if '--check' in sys.argv:
        if not os.path.exists(OUT): print('✗ gacc_lex_fr.tsv absent'); return 1
        bad = [i for i, l in enumerate(io.open(OUT, encoding='utf-8'), 1) if len(l.rstrip(chr(10)).split(chr(9))) != NCOL]
        n = sum(1 for _ in io.open(OUT, encoding='utf-8'))
        if bad: print('✗ gacc_lex_fr.tsv : %d ligne(s) mal formee(s) (37 colonnes attendues), ex. ligne %d' % (len(bad), bad[0])); return 1
        print('✓ gacc_lex_fr.tsv : %d lignes, 37 colonnes' % n); return 0
    import correcteur_probe as C, subprocess, gzip
    # ⭐ LA BASE = LE LEXIQUE COMMITÉ (git HEAD), pas speller_probe : celui-ci lit désormais gacc_lex_fr.tsv,
    # et se comparer à un speller DÉJÀ augmenté rendait le générateur circulaire (137 ajouts au 2e passage
    # au lieu de 46 799, mesuré le 02/09). L'asset commité = Lexique4 + wikt + argot + participes (214 684).
    raw = subprocess.run(['git', 'show', 'HEAD:extension/assets/speller.tsv.gz'], capture_output=True, cwd=ROOT).stdout
    W = set(l.split(chr(9))[0] for l in gzip.decompress(raw).decode('utf-8').split(chr(10)) if l)
    if len(W) < 100000: print('✗ base commitée illisible (%d formes)' % len(W)); return 1
    Wd = set(C.deacc(x) for x in W)
    info = morphalou()
    if info is None: print('✗ Morphalou absent (data_local/morphalou) : impossible de regenerer'); return 1
    ok = lambda w: isinstance(w, str) and re.match(r"^[a-zà-ÿœæ'-]+$", w)
    FREQ = frequents()
    if FREQ is None: print('✗ Lexique4 introuvable (LEX4 / data_local) : impossible de regenerer'); return 1
    import unicodedata
    dea = lambda t: ''.join(c for c in unicodedata.normalize('NFD', t) if unicodedata.category(c) != 'Mn')
    rows, ecartes, horscat, masquants = [], 0, 0, 0
    for w in sorted(C.GENDER_ACC):
        if not ok(w) or w in W or C.deacc(w) in Wd: continue
        m = info.get(w)
        if not m: ecartes += 1; continue
        cats = [CAT[c] for c, _ in m if c in CAT]
        if not cats: horscat += 1; continue
        if any((v in FREQ) or (dea(v) in FREQ) for v in voisins1(w)): masquants += 1; continue   # anti-masquage
        nb = next((n for c, n in m if c in CAT and n in ('s', 'p')), '')
        g = C.GENDER_ACC[w] if isinstance(C.GENDER_ACC, dict) else ''
        g = g if g in ('m', 'f') else ''
        row = [""] * NCOL
        row[0] = w; row[3] = w; row[4] = cats[0]; row[5] = cats[0]; row[6] = g; row[7] = nb; row[9] = '0'; row[10] = '0'; row[11] = '0'
        rows.append(chr(9).join(row))
    io.open(OUT, 'w', encoding='utf-8', newline=chr(10)).write(chr(10).join(rows) + chr(10))
    print('✓ gacc_lex_fr.tsv : %d formes ajoutees (NOM/ADJ, freq 0) · %d ecartees (absentes de Morphalou) · %d hors categorie · %d MASQUANTES ecartees (distance 1 d un mot frequent)' % (len(rows), ecartes, horscat, masquants))
    return 0

if __name__ == '__main__':
    sys.exit(main())
