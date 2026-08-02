# -*- coding: utf-8 -*-
# Prédicteur g2p ANGLAIS réutilisable (miroir Python de l'algo g2p du moteur du pendu, et copie de la
# fonction de vérif de build_g2p_en.py). Charge dictee/g2p_en.json (tables SEG/COND/DBL data-driven) et
# transcrit N'IMPORTE QUEL mot en séquence de phonèmes GA. Sert à COMBLER le champ phon (`p`) des mots
# absents de kaikki/CMUdict → couverture phon ~100 % comme le lex4 FR (Lexique4). Zéro français.
import os, io, json

_HERE = os.path.dirname(os.path.abspath(__file__))
_G2P = None

def load_tables(path=None):
    global _G2P
    if _G2P is None:
        p = path or os.path.join(_HERE, 'g2p_en.json')
        t = json.load(io.open(p, encoding='utf-8'))
        _G2P = {'SEG': t['SEG'], 'COND': t['COND'], 'DBL': set(t['DBL'])}
    return _G2P

def g2p_en(word):
    """Mot (lettres) -> chaîne IPA (phonèmes GA joints, sans accent tonique ni point). '' si vide."""
    t = load_tables()
    SEG, COND, DBL = t['SEG'], t['COND'], t['DBL']
    w = ''.join(ch for ch in word.lower() if 'a' <= ch <= 'z')
    steps = []; i = 0
    while i < len(w):
        g = None
        for cand in SEG:                       # SEG est trié plus-long-d'abord (longest-match)
            if w.startswith(cand, i): g = cand; break
        if not g: g = w[i]
        nxt = w[i+len(g)] if i+len(g) < len(w) else '#'
        if g in DBL and (g[0] in COND):
            e = COND[g[0]].get('_'); ph = e[0] if e else g[0]
        else:
            tb = COND.get(g); e = (tb.get(nxt) or tb.get('_')) if tb else None
            ph = e[0] if e else ''
        steps.append(ph); i += len(g)
    return ''.join(p for p in steps if p and p != '∅')

if __name__ == '__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    for w in (sys.argv[1:] or ['SNOWBOARDING', 'ORGANISED', 'HONOURS', 'UNICORNS', 'WASTETH', 'OFFENCE']):
        print('%-16s -> %s' % (w, g2p_en(w)))
