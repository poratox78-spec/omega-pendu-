# -*- coding: utf-8 -*-
# Prédicteur phon ANGLAIS À ÉTAGES pour combler le champ `p` du lex4 (mots absents de kaikki/CMUdict).
# Philosophie OMEGA : on CROISE les données (vrai phon dico ⊕ morpho ⊕ g2p) — c'est l'ENSEMBLE qui nourrit
# les routes (cohorte, assemblé, muette, arbitre OS), pas une source isolée. Étages, du plus fiable au moins :
#   étage 1  CMUdict direct (ARPABET->IPA)                         [prononciation réelle]
#   étage 2  variante orthographe US (ise->ize, our->or, ...)      [prononciation réelle]
#   étage 3  base fléchie dans CMUdict + suffixe phonologique régulier (-s/-ed/-ing/-ly/-er/-est)
#   étage 4  g2p data-driven (build_g2p_en.py) — dernier recours   [prédit ~79 %]
# Mesuré 2026-08-02 : sur 91 156 mots sans phon source, ~37 % récupérables en VRAI phon (étages 2-3),
# le reste en g2p → phon RÉEL 53 %→70 %. Zéro français. Réutilisé par build_lex4_en.py.
import os, io, json, re

_HERE = os.path.dirname(os.path.abspath(__file__))
_G2P = None
_CMU = None   # mot -> liste ARPABET (phonèmes avec chiffre d'accent)

# ---- g2p data-driven (étage 4) ----
def load_tables(path=None):
    global _G2P
    if _G2P is None:
        p = path or os.path.join(_HERE, 'g2p_en.json')
        t = json.load(io.open(p, encoding='utf-8'))
        _G2P = {'SEG': t['SEG'], 'COND': t['COND'], 'DBL': set(t['DBL'])}
    return _G2P

def g2p_en_steps(word):
    """Mot -> liste de (graphème, phonème_IPA) ALIGNÉS (longest-match SEG + COND contextuel). Base de
    l'inversion phonème→lettre (PHON_TO_LETTERS anglais). Phonème '' = graphème muet."""
    t = load_tables()
    SEG, COND, DBL = t['SEG'], t['COND'], t['DBL']
    w = ''.join(ch for ch in word.lower() if 'a' <= ch <= 'z')
    steps = []; i = 0
    while i < len(w):
        g = None
        for cand in SEG:
            if w.startswith(cand, i): g = cand; break
        if not g: g = w[i]
        nxt = w[i+len(g)] if i+len(g) < len(w) else '#'
        if g in DBL and (g[0] in COND):
            e = COND[g[0]].get('_'); ph = e[0] if e else g[0]
        else:
            tb = COND.get(g); e = (tb.get(nxt) or tb.get('_')) if tb else None
            ph = e[0] if e else ''
        steps.append((g, ('' if ph == '∅' else ph))); i += len(g)
    return steps

def g2p_en(word):
    """Mot -> chaîne IPA (phonèmes GA joints). Dernier recours (prédit)."""
    return ''.join(ph for (g, ph) in g2p_en_steps(word) if ph)

# ---- CMUdict (étages 1-3) ----
ARPA2IPA = {'AA':'ɑ','AE':'æ','AH':'ʌ','AO':'ɔ','AW':'aʊ','AY':'aɪ','B':'b','CH':'tʃ','D':'d',
    'DH':'ð','EH':'ɛ','ER':'ɚ','EY':'eɪ','F':'f','G':'ɡ','HH':'h','IH':'ɪ','IY':'i','JH':'dʒ',
    'K':'k','L':'l','M':'m','N':'n','NG':'ŋ','OW':'oʊ','OY':'ɔɪ','P':'p','R':'ɹ','S':'s','SH':'ʃ',
    'T':'t','TH':'θ','UH':'ʊ','UW':'u','V':'v','W':'w','Y':'j','Z':'z','ZH':'ʒ'}
def _arpa_to_ipa(phones):
    out = []
    for ph in phones:
        st = ph[-1] if ph and ph[-1] in '012' else ''
        base = ph[:-1] if st else ph
        if base == 'AH' and st == '0': out.append('ə'); continue
        out.append(ARPA2IPA.get(base, ''))
    return ''.join(out)

def load_cmu(path=None):
    global _CMU
    if _CMU is None:
        _CMU = {}
        p = path or os.path.join(_HERE, '..', 'cmudict.dict')
        if not os.path.exists(p):
            p = os.path.join(_HERE, 'cmudict.dict')
        if os.path.exists(p):
            for ln in io.open(p, encoding='utf-8', errors='replace'):
                ln = ln.rstrip('\n')
                if not ln or ln.startswith(';;;'): continue
                parts = ln.split()
                w = re.sub(r'\(\d+\)$', '', parts[0]).lower()
                if w in _CMU: continue
                ph = parts[1:]
                if '#' in ph: ph = ph[:ph.index('#')]
                if ph: _CMU[w] = ph
    return _CMU

_VOICELESS = {'P','T','K','F','TH','S','SH','CH','HH'}
_SIBILANT  = {'S','Z','SH','ZH','CH','JH'}
def _base(ph): return ph[:-1] if ph and ph[-1] in '012' else ph

def _suffix_s(phones):   # -s / -es : /s/ /z/ /ɪz/ selon dernière consonne
    last = _base(phones[-1]) if phones else ''
    if last in _SIBILANT: return phones + ['IH0', 'Z']
    if last in _VOICELESS: return phones + ['S']
    return phones + ['Z']
def _suffix_ed(phones):  # -ed : /t/ /d/ /ɪd/
    last = _base(phones[-1]) if phones else ''
    if last in ('T', 'D'): return phones + ['IH0', 'D']
    if last in _VOICELESS: return phones + ['T']
    return phones + ['D']

# transforme (mot) -> liste de (base_candidate, fn_suffixe) à essayer dans CMUdict
def _infl_candidates(w):
    out = []
    if w.endswith('ies') and len(w) > 4:
        out.append((w[:-3] + 'y', _suffix_s))
    if w.endswith('ied') and len(w) > 4:
        out.append((w[:-3] + 'y', _suffix_ed))
    if w.endswith('es') and len(w) > 3:
        out += [(w[:-2], _suffix_s), (w[:-1], _suffix_s)]
    if w.endswith('s') and len(w) > 2:
        out.append((w[:-1], _suffix_s))
    if w.endswith('ed') and len(w) > 3:
        out += [(w[:-2], _suffix_ed), (w[:-1], _suffix_ed)]
        if len(w) > 4 and w[-3] == w[-4]: out.append((w[:-3], _suffix_ed))    # de-doublement (stopped->stop)
    if w.endswith('ing') and len(w) > 4:
        f = lambda p: p + ['IH0', 'NG']
        out += [(w[:-3], f), (w[:-3] + 'e', f)]
        if len(w) > 5 and w[-4] == w[-5]: out.append((w[:-4], f))             # de-doublement (running->run)
    if w.endswith('ly') and len(w) > 3:
        out.append((w[:-2], lambda p: p + ['L', 'IY0']))
    if w.endswith('est') and len(w) > 4:
        out += [(w[:-3], lambda p: p + ['IH0','S','T']), (w[:-2], lambda p: p + ['IH0','S','T'])]
    elif w.endswith('er') and len(w) > 3:
        out += [(w[:-2], lambda p: p + ['ER0']), (w[:-1], lambda p: p + ['ER0'])]
    return out

_US = [(r'isation$','ization'),(r'ised$','ized'),(r'ising$','izing'),(r'ise$','ize'),
       (r'ours$','ors'),(r'our$','or'),(r'ence$','ense'),(r'ogue$','og'),(r're$','er')]
def _us_variants(w):
    v = []
    for pat, rep in _US:
        u = re.sub(pat, rep, w)
        if u != w: v.append(u)
    return v

def real_phon(word):
    """VRAI phon dico (étages 1-3) ou None."""
    cmu = load_cmu()
    if not cmu: return None
    w = ''.join(ch for ch in word.lower() if 'a' <= ch <= 'z')
    if not w: return None
    if w in cmu: return _arpa_to_ipa(cmu[w])                       # 1 direct
    for u in _us_variants(w):                                      # 2 ortho US
        if u in cmu: return _arpa_to_ipa(cmu[u])
    for base, fn in _infl_candidates(w):                          # 3 base fléchie + suffixe
        if base in cmu: return _arpa_to_ipa(fn(list(cmu[base])))
    return None

def phon_tiered(word):
    """VRAI phon (CMUdict/morpho) si possible, SINON g2p prédit. Jamais vide pour un mot alphabétique."""
    return real_phon(word) or g2p_en(word)

if __name__ == '__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    for w in (sys.argv[1:] or ['UNICORNS','ORGANISED','HONOURS','CITIES','RUNNING','WATCHES',
                               'STOPPED','HAPPIEST','QUICKLY','WASTETH','AULETES','SNOWBOARDING']):
        r = real_phon(w)
        print('%-14s real=%-14s tiered=%s' % (w, r or '(g2p)', phon_tiered(w)))
