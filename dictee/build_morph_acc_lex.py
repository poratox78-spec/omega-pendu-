# -*- coding: utf-8 -*-
"""build_morph_acc_lex.py — SPELLER : les formes ACCENTUÉES de Morphalou que l'anti-masquage écartait à tort (09/10/2026).

Le symptôme : « Il fallait qu'il se calmât » → « calmât » marqué MOT INCONNU (orange « calma »). Morphalou a la forme ; le lot
VER de build_morph_lex.py l'a écartée. Son anti-masquage refuse tout ajout à distance 1 d'un mot fréquent, et il le teste aussi
sur la forme DÉSACCENTUÉE : « calmat » est à une lettre de « calma ». Or un ajout à fréquence 0 n'entre que dans WORDS, à la
graphie EXACTE (jamais dans D2A, jamais candidat) : « calmat » tapé sans accent reste inconnu et corrigé. Seule la forme exacte
peut masquer une faute — à condition que la faute l'écrive ACCENT COMPRIS.

La classe, mesurée : 736 verbes en -er avaient leur passé simple « -a » sans leur subjonctif « -ât » ; plus généralement les
formes accentuées écartées pour cette seule raison (participes « arasés », passés simples « aliéna », 1990 « empiètements »…).
Trois filtres, chacun mesuré au moteur JS (A/B node, gold + 3 corpus dys + UD) :
  - anti-masquage sur la forme EXACTE seulement — et une suppression n'y touche jamais un circonflexe (une faute de frappe
    n'AJOUTE pas « â » : « mangeât » n'est pas une faute de « mangent ») ;
  - attestation : Morphalou2 ET au moins une autre source. Sans ce filtre, les graphies d'une seule source (« québecois »,
    « cotière », « hypotéqué ») rendaient VALIDES 15 vraies fautes du corpus dys ;
  - pas déjà dans le speller (base = les 7 lots SOURCES, pas l'asset : le générateur ne lit pas sa propre sortie).
Même contrat que les lots Morphalou : FreqOrtho 0 → dans WORDS, jamais dans D2A/PHON.

  python dictee/build_morph_acc_lex.py            # régénère dictee/morph_acc_lex_fr.tsv (Morphalou + Lexique4 requis, data_local)
  python dictee/build_morph_acc_lex.py --check    # forme du TSV commité (37 colonnes, fréquence 0)
"""
import io, csv, gzip, unicodedata, re, sys, os
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..')
OUT = os.path.join(HERE, 'morph_acc_lex_fr.tsv')
LOTS = ('wikt_lex_fr.tsv', 'argot_rows.tsv', 'participle_rows.tsv', 'gacc_lex_fr.tsv', 'morph_na_lex_fr.tsv', 'morph_ver_lex_fr.tsv.gz')
CIRC = set('âêîôû')


def generer():
    dea = lambda t: ''.join(c for c in unicodedata.normalize('NFD', t) if unicodedata.category(c) != 'Mn')
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
            if fr >= 1.0: freq.add(w); freq.add(dea(w))
    for lot in LOTS:
        fn = os.path.join(HERE, lot)
        with (gzip.open(fn, 'rt', encoding='utf-8') if fn.endswith('.gz') else io.open(fn, encoding='utf-8')) as f:
            for l in f: base.add(l.split('\t', 1)[0].strip().lower())
    dels = lambda w, garde=False: {w[:i] + w[i + 1:] for i in range(len(w)) if not (garde and w[i] in CIRC)}
    FD = set()
    for w in freq: FD |= dels(w)
    def masque_exact(w):   # la forme EXACTE est-elle à distance 1 d'un mot fréquent ? (jamais en supprimant un circonflexe)
        return w in freq or w in FD or bool(dels(w, True) & freq) or bool(dels(w, True) & FD)
    ok = re.compile(r"^[a-zà-ÿœæ'-]+$"); CAT = {'Nom commun': 'NOM', 'Adjectif qualificatif': 'ADJ', 'Verbe': 'VER', 'Adverbe': 'ADV'}
    cat = lemme = None; seen = set(); rows = []
    with io.open(os.path.join(ROOT, 'data_local', 'morphalou', 'Morphalou3.1_CSV.csv'), encoding='utf-8', errors='replace') as fh:
        for l in fh:
            p = l.rstrip('\n').split(';')
            if len(p) < 18: continue
            if p[0].strip(): cat = p[2].strip() or cat; lemme = p[0].strip().lower()
            w = p[9].strip().lower()
            if not w or w in seen or not ok.match(w) or len(w) < 3 or w == dea(w) or w in base: continue
            c = CAT.get(cat)
            if not c: continue
            src = p[17].split()
            if 'morphalou2' not in src or len(src) < 2: continue
            if masque_exact(w): continue
            seen.add(w)
            g = (p[5].strip().lower()[:1] if c in ('NOM', 'ADJ') and p[5].strip() else '')
            g = g if g in ('m', 'f') else ''
            nb = p[11].strip().lower()[:1]; nb = nb if nb in ('s', 'p') else ''
            row = [''] * 37; row[0] = w; row[3] = lemme or w; row[4] = c; row[5] = c; row[6] = g; row[7] = nb; row[9] = '0'; row[10] = '0'; row[11] = '0'
            rows.append('\t'.join(row))
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(rows) + '\n')
    print('✓ morph_acc : %d lignes -> %s' % (len(rows), os.path.relpath(OUT, ROOT)))


def main():
    if '--check' in sys.argv:
        if not os.path.exists(OUT): print('✗ morph_acc_lex_fr.tsv absent'); return 1
        n = bad = 0
        for l in io.open(OUT, encoding='utf-8'):
            n += 1; c = l.rstrip('\n').split('\t')
            if len(c) != 37 or c[10] != '0': bad += 1
        if bad: print('✗ morph_acc_lex_fr.tsv : %d ligne(s) mal formée(s) (37 colonnes, FreqOrtho 0)' % bad); return 1
        # le lot est-il CÂBLÉ ? (une garde par table : un lot commité mais absent de l'asset livré laisse « calmât » inconnu, en silence)
        SP = {}
        for l in gzip.open(os.path.join(ROOT, 'extension', 'assets', 'speller.tsv.gz'), 'rt', encoding='utf-8'):
            c = l.rstrip('\n').split('\t')
            if c[0]: SP[c[0]] = c[1] if len(c) > 1 else ''
        lot = [l.split('\t', 1)[0] for l in io.open(OUT, encoding='utf-8') if l.strip()]
        absents = [w for w in lot if w not in SP and all(unicodedata.normalize('NFD', ch)[0] in 'abcdefghijklmnopqrstuvwxyz' for ch in w)]
        if absents: print('✗ morph_acc : %d forme(s) du lot absentes de extension/assets/speller.tsv.gz (ex. %s) — régénérer le speller' % (len(absents), absents[0])); return 1
        for w, attendu in (('calmât', True), ('mangeât', True), ('calmat', False)):   # témoins : la forme exacte connue (fréquence 0), jamais sa clé sans accent
            if (w in SP) != attendu or (attendu and SP[w] != '0'): print('✗ morph_acc : témoin « %s » %s' % (w, 'absent ou fréquent' if attendu else 'présent')); return 1
        print('✓ morph_acc_lex_fr.tsv : %d lignes, 37 colonnes, FreqOrtho 0 ; câblé dans le speller livré (calmât, mangeât connus ; calmat non)' % n); return 0
    if not os.path.exists(os.path.join(ROOT, 'data_local', 'morphalou', 'Morphalou3.1_CSV.csv')):
        print('✗ Morphalou absent (data_local/morphalou) : impossible de régénérer'); return 1
    generer(); return 0


if __name__ == '__main__':
    sys.exit(main())
