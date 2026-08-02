# -*- coding: utf-8 -*-
# pos_en.py — DÉCODEUR de référence du POS-tagger ANGLAIS (HMM UPOS bigramme, Viterbi).
# Le modèle est produit par `build_pos_hmm.py --en` (UD English-EWT, CC BY-SA 4.0) ; CE fichier est la
# RÉFÉRENCE Python dont `corrector_en.js` est le miroir exact → parité vérifiable (`parity_pos_en.js`),
# même discipline que le FR (3 moteurs, mêmes scores, mêmes décisions).
#   from pos_en import tag_sentence, load_model
#   tag_sentence(['I','have','runned'], load_model()) -> ['PRON','AUX','VERB']
import io, os, json, math, gzip

HERE = os.path.dirname(os.path.abspath(__file__))
_M = None

def load_model(path=None):
    """Charge pos_hmm_en.json (ou .gz). None si absent → l'appelant se passe du tagger (dégradation douce)."""
    global _M
    if _M is not None: return _M
    p = path or os.path.join(HERE, 'pos_hmm_en.json')
    try:
        if os.path.exists(p):
            _M = json.load(io.open(p, encoding='utf-8'))
        elif os.path.exists(p + '.gz'):
            with gzip.open(p + '.gz', 'rt', encoding='utf-8') as f: _M = json.load(f)
    except Exception:
        _M = None
    return _M

def tag_sentence(words, M=None):
    """Viterbi bigramme -> liste d'UPOS alignée sur `words`. [] si pas de modèle."""
    M = M or load_model()
    if not M or not words: return []
    tags = M['tags']; tr = M['trans']; em = M['emit']; suf = M['suf']; pri = M['prior']; FL = M['floor']
    def lt(a, b): return tr.get(a, {}).get(b, FL)
    def le(t, w):
        lw = w.lower()
        # une suite de lettres n'est jamais PUNCT/SYM (garde reprise du FR)
        if (t == 'PUNCT' or t == 'SYM') and any(ch.isalpha() for ch in lw): return -100.0
        if lw in em: return em[lw].get(t, FL)
        for k in (4, 3, 2):                                  # backoff par suffixe (mots rares)
            if len(lw) >= k and lw[-k:] in suf:
                d = suf[lw[-k:]]
                return d.get(t, FL) + (math.log(1.1) if (w[:1].isupper() and t == 'PROPN') else 0.0)
        return pri.get(t, FL) + (math.log(3.0) if (w[:1].isupper() and t == 'PROPN') else 0.0)
    n = len(words)
    V = [{}]; bk = [{}]
    for t in tags: V[0][t] = lt('<s>', t) + le(t, words[0]); bk[0][t] = '<s>'
    for i in range(1, n):
        V.append({}); bk.append({})
        for t in tags:
            et = le(t, words[i]); best = -1e18; bp = None
            for pt in tags:
                sc = V[i-1][pt] + lt(pt, t)
                if sc > best: best, bp = sc, pt
            V[i][t] = best + et; bk[i][t] = bp
    best = -1e18; bt = None
    for t in tags:
        sc = V[n-1][t] + lt(t, '</s>')
        if sc > best: best, bt = sc, t
    seq = [bt]
    for i in range(n-1, 0, -1): seq.append(bk[i][seq[-1]])
    return seq[::-1]

if __name__ == '__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    M = load_model()
    print('modèle :', 'absent' if not M else '%d tags, %d mots émis' % (len(M['tags']), len(M['emit'])))
    for s in ['Their is no point .'.split(), 'I put it over there .'.split(),
              'You are going to their house .'.split(), 'He have runned fast .'.split()]:
        print(' ', ' '.join('%s/%s' % (w, t) for w, t in zip(s, tag_sentence(s, M))))
