# -*- coding: utf-8 -*-
# build_pos_hmm.py — entraîne un POS-tagger HMM bigramme sur le treebank UD (French GSD) et exporte un modèle COMPACT
# (JSON) chargé à l'identique par les 3 moteurs (Python réf + app + extension) → décodage Viterbi en parité exacte.
#
#   NATURE (UPOS) : DET NOUN ADJ VERB AUX ADV ADP PRON CCONJ SCONJ PROPN NUM PUNCT X …  (émission apprise + backoff suffixe
#   + repli lexique POS_LEX déjà embarqué). Le gain vient du MODÈLE DE SÉQUENCE (Viterbi), pas de règles ad hoc.
#   Mesuré (train 90 % / test 10 % TENUS) : ~95 % strict, ~96 % pertinent (PROPN↦NOUN). Voir mémoire sentence-analysis-probe.
#
# Données : Universal Dependencies French-GSD (ud_fr_gsd-train.conllu) — CC BY-SA 4.0. Le modèle en est dérivé → CC BY-SA
# (attribution UD). Fichier hors-repo (data_local/, gitignoré) ; le MODÈLE exporté (dictee/pos_hmm.json) est committé.
#
#   python dictee/build_pos_hmm.py           # entraîne sur TOUT UD → dictee/pos_hmm.json (+ extension/assets/pos-hmm.json.gz)
#   python dictee/build_pos_hmm.py --eval    # split 90/10, mesure l'exactitude du modèle EXPORTÉ sur le test tenu
import os, sys, math, json, gzip
from collections import defaultdict, Counter

HERE = os.path.dirname(os.path.abspath(__file__))
CONLLU = os.path.join(HERE, '..', 'data_local', 'ud_fr_gsd-train.conllu')
OUT = os.path.join(HERE, 'pos_hmm.json')
OUT_GZ = os.path.join(HERE, '..', 'extension', 'assets', 'pos-hmm.json.gz')
LO = -13.8          # log(~1e-6) : plancher d'émission (mot connu mais pas avec ce tag / tag hors candidats)

def load():
    sents, cur = [], []
    for l in open(CONLLU, encoding='utf-8'):
        if l.startswith('#'): continue
        l = l.rstrip('\n')
        if not l:
            if cur: sents.append(cur); cur = []
            continue
        c = l.split('\t')
        if len(c) < 4 or '-' in c[0] or '.' in c[0]: continue
        cur.append((c[1], c[3]))
    if cur: sents.append(cur)
    return sents

def suffixes(w):
    w = w.lower()
    return [w[-k:] for k in range(2, 5) if len(w) >= k]

def train(sents):
    trans = defaultdict(Counter); emitc = defaultdict(Counter); tagc = Counter()
    sufc = defaultdict(Counter); wordc = Counter()
    for s in sents:
        for w, t in s: wordc[w.lower()] += 1
    for s in sents:
        prev = '<s>'
        for w, t in s:
            trans[prev][t] += 1; emitc[t][w.lower()] += 1; tagc[t] += 1; prev = t
            if wordc[w.lower()] <= 2:
                for sf in suffixes(w): sufc[sf][t] += 1
        trans[prev]['</s>'] += 1
    return trans, emitc, tagc, sufc, wordc

def build_model(sents):
    trans, emitc, tagc, sufc, wordc = train(sents)
    tags = sorted(tagc); V = len(tags); N = sum(tagc.values())
    # transitions bigramme lissées (add-0.1)
    logtrans = {}
    for a in list(trans) + ['<s>']:
        tot = sum(trans[a].values())
        logtrans[a] = {b: round(math.log((trans[a][b] + 0.1) / (tot + 0.1 * (V + 1))), 4)
                       for b in tags + ['</s>']}
    # émission : mots vus ≥ 2 (les rares → modèle de suffixe), logP(mot|tag)
    logemit = {}
    for t in tags:
        for w, cnt in emitc[t].items():
            if wordc[w] >= 2:
                logemit.setdefault(w, {})[t] = round(math.log(cnt / tagc[t]), 4)
    # suffixes (mots rares) : logP(tag|suffixe)
    logsuf = {}
    for sf, c in sufc.items():
        tot = sum(c.values())
        if tot >= 3:
            logsuf[sf] = {t: round(math.log((c[t] + 0.01) / (tot + 0.01 * V)), 4) for t in c}
    logprior = {t: round(math.log(tagc[t] / N), 4) for t in tags}
    return {'tags': tags, 'trans': logtrans, 'emit': logemit, 'suf': logsuf, 'prior': logprior,
            'floor': LO, 'meta': 'HMM bigramme UPOS, UD French-GSD CC BY-SA 4.0'}

# ---- décodeur de référence (sert au build --eval ; le MÊME algo sera porté en Python correcteur + JS) ----
_L2U = {'NOM':'NOUN','VER':'VERB','ADJ':'ADJ','ADV':'ADV','PRE':'ADP','PRO':'PRON','ART':'DET','CON':'CCONJ','AUX':'AUX'}
def _lex_upos(w):
    try:
        import correcteur_probe as C
        p = C.POS_LEX.get(C.deacc(w.lower()))
        return _L2U.get(p[0].split(':')[0]) if p else None
    except Exception:
        return None

def tag_sentence(words, M):
    tags = M['tags']; tr = M['trans']; em = M['emit']; suf = M['suf']; pri = M['prior']; FL = M['floor']
    def lt(a, b): return tr.get(a, {}).get(b, FL)
    def le(t, w):
        lw = w.lower()
        if (t == 'PUNCT' or t == 'SYM') and any(ch.isalpha() for ch in lw): return -100.0
        if lw in em: return em[lw].get(t, FL)
        for k in (4, 3, 2):
            if len(lw) >= k and lw[-k:] in suf:
                d = suf[lw[-k:]]; cap = 1.1 if (w[:1].isupper() and t == 'PROPN') else 1.0
                return d.get(t, FL) + math.log(cap)
        return pri.get(t, FL) + (math.log(3.0) if (w[:1].isupper() and t == 'PROPN') else 0.0)
    n = len(words)
    if not n: return []
    Vt = [{}]; bk = [{}]
    for t in tags: Vt[0][t] = lt('<s>', t) + le(t, words[0]); bk[0][t] = '<s>'
    for i in range(1, n):
        Vt.append({}); bk.append({})
        for t in tags:
            et = le(t, words[i]); best = -1e18; bp = None
            for pt in tags:
                sc = Vt[i-1][pt] + lt(pt, t)
                if sc > best: best, bp = sc, pt
            Vt[i][t] = best + et; bk[i][t] = bp
    best = -1e18; bt = None
    for t in tags:
        sc = Vt[n-1][t] + lt(t, '</s>')
        if sc > best: best, bt = sc, t
    seq = [bt]
    for i in range(n-1, 0, -1): seq.append(bk[i][seq[-1]])
    return seq[::-1]

def main():
    sys.path.insert(0, HERE)
    sents = load()
    if '--eval' in sys.argv:
        cut = int(len(sents) * 0.9); tr, te = sents[:cut], sents[cut:]
        M = build_model(tr)
        FOLD = {'PROPN':'NOUN','AUX':'VERB','SYM':'X','INTJ':'X'}; fold = lambda x: FOLD.get(x, x)
        tot = ok = okf = 0
        for s in te:
            pred = tag_sentence([w for w, t in s], M)
            for (w, g), p in zip(s, pred):
                if g == 'PUNCT': continue
                tot += 1
                if p == g: ok += 1
                if fold(p) == fold(g): okf += 1
        print("[eval] modèle EXPORTÉ sur test tenu (%d ph) : strict %.2f%% | pertinent %.2f%%" % (len(te), 100*ok/tot, 100*okf/tot))
        return 0
    M = build_model(sents)
    raw = json.dumps(M, ensure_ascii=False, separators=(',', ':'))
    open(OUT, 'w', encoding='utf-8').write(raw)
    os.makedirs(os.path.dirname(OUT_GZ), exist_ok=True)
    with gzip.open(OUT_GZ, 'wb') as f: f.write(raw.encode('utf-8'))
    print("[hmm] %d phrases → %s (%d Ko) | %s (%d Ko gz) | %d mots émis, %d suffixes, %d tags"
          % (len(sents), OUT, len(raw)//1024, OUT_GZ, os.path.getsize(OUT_GZ)//1024,
             len(M['emit']), len(M['suf']), len(M['tags'])))
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
