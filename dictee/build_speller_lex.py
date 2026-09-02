# -*- coding: utf-8 -*-
# Génère le lexique EMBARQUÉ du correcteur orthographique (formes ACCENTUÉES + fréquence), gzip+base64.
# Le lexique moteur est déacc-é (ASCII) ; le speller doit PRODUIRE des formes accentuées (leçon, fenêtre) →
# il lui faut les surfaces accentuées. Format compact : lignes "mot_accentué\tfreq_milli" gzippées.
# JS reconstruit WORDS / FREQ / DEACC2ACC / index phonétique au chargement.
#
#   LEX4=/tmp/lex4/Lexique4.tsv MINFREQ=0.05 python3 dictee/build_speller_lex.py
import os, sys, csv, gzip, base64, unicodedata

LEX = os.environ.get('LEX4', '/tmp/lex4/Lexique4.tsv')
MINFREQ = float(os.environ.get('MINFREQ', '0.05'))
OUT = os.environ.get('OUT', '/tmp/lex4/speller_lex')
ALPHA = "abcdefghijklmnopqrstuvwxyz"

def deacc(s):
    s = s.replace('œ', 'oe').replace('æ', 'ae')
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def main():
    if not os.path.exists(LEX):
        print(f"Lexique introuvable ({LEX})"); return 1
    best = {}                       # mot accentué (minuscule) -> freq max
    pos = {}                        # mot accentué -> set POS {'N','V','A'} (désambiguïsation d'accent par contexte)
    with open(LEX, encoding='utf-8') as f:
        r = csv.reader(f, delimiter='\t'); H = next(r)
        ci = {h.lower(): i for i, h in enumerate(H)}
        cm = next(i for h, i in ci.items() if 'mot' in h)
        cf = next(i for h, i in ci.items() if 'freqortho' in h)
        cg = next(i for h, i in ci.items() if 'cgram' in h and 'ortho' not in h)
        for row in r:
            if len(row) <= max(cm, cf, cg): continue
            w = (row[cm] or '').strip().lower()
            if not w or len(w) < 2 or not all(deacc(c) in ALPHA for c in w): continue
            try: fr = float((row[cf] or '0').replace(',', '.'))
            except ValueError: fr = 0.0
            if fr < MINFREQ: continue
            if fr > best.get(w, -1.0): best[w] = fr
            cgr = (row[cg] or '').strip().upper()
            p = 'N' if cgr.startswith('NOM') else ('V' if (cgr.startswith('VER') or cgr.startswith('AUX')) else ('A' if cgr.startswith('ADJ') else None))
            if p: pos.setdefault(w, set()).add(p)
    lines = []
    for w in sorted(best):
        fm = round(best[w] * 1000)             # freq en milli (entier compact). ⭐ 0 RESTE 0 (02/09) : c'est la MARQUE des mots
                                               # « connus-seulement » (gacc_lex_fr.tsv, FreqOrtho 0) — dans WORDS, jamais dans D2A.
                                               # Lexique4 n'a AUCUNE ligne à FreqOrtho 0 (vérifié) ; wikt/argot/participes sont à 0,05 = 50.
        pp = ''.join(sorted(pos.get(w, ())))    # POS (ex. NV, VA) ou vide
        lines.append(f"{w}\t{fm}\t{pp}")
    raw = ('\n'.join(lines)).encode('utf-8')
    gz = gzip.compress(raw, 9)
    b64 = base64.b64encode(gz)
    with open(OUT + '.b64', 'wb') as fo: fo.write(b64)
    print(f"[speller-lex] {len(best)} mots accentués (freq≥{MINFREQ}/M)")
    print(f"  brut {len(raw)/1e6:.2f} Mo | gzip {len(gz)/1e6:.2f} Mo | base64 (embarqué) {len(b64)/1e6:.2f} Mo → {OUT}.b64")
    return 0

if __name__ == '__main__':
    sys.exit(main())
