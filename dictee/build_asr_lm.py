# -*- coding: utf-8 -*-
# ⚠️ MESURÉ PIRE — GARDÉ COMME RECETTE, PAS ACTIVÉ. BAKER d'un LM de DÉCODAGE voie B plus gros
# (UD-GSD complet + WiCoPaCo « after »). Couverture ×240 (797 -> 191 225 trigrammes) MAIS sur la
# voix chat de Rem le score BAISSE (81 % -> 79 % au mieux, λ=0,75) : WiCoPaCo = registre WIKIPÉDIA,
# ses fréquences tirent vers père/opposé au lieu de chères/proposer (piège de fréquence). Le petit
# os_subj_lm reste meilleur ici ; asr_voix.py NE charge PAS asr_lm.json.gz. Le vrai levier serait un
# corpus REGISTRE CHAT/dys (qu'on n'a pas) — remplacer alors WICO ci-dessous et re-mesurer.
# SÉPARÉ de os_subj_lm.json.gz (prod correcteur, parité 3 moteurs — NE PAS toucher).
#   Reproductible : python dictee/build_asr_lm.py   (lit ../data_local/, local/gitignoré)
import os, re, json, gzip
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
DL = os.path.join(HERE, '..', 'data_local')
UD = os.path.join(DL, 'ud_fr_gsd-train.conllu')
WICO = os.path.join(DL, 'wicopaco_realword_sents.jsonl')
OUT = os.path.join(HERE, 'asr_lm.json.gz')
PRUNE_TRI, PRUNE_BI = 2, 2

TOK = re.compile(r"[a-zA-Zà-ÿœæ'\-]+")
def tk(s): return [w.lower() for w in TOK.findall(s.replace('’', "'"))]

def sents():
    n_ud = n_wi = 0
    if os.path.exists(UD):
        for l in open(UD, encoding='utf-8'):
            if l.startswith('# text ='):
                n_ud += 1; yield tk(l.split('=', 1)[1])
    if os.path.exists(WICO):
        for l in open(WICO, encoding='utf-8'):
            l = l.strip()
            if not l: continue
            try: o = json.loads(l)
            except Exception: continue
            s = o.get('after') or o.get('good')
            if s: n_wi += 1; yield tk(s)
    print('  phrases : UD=%d  WiCoPaCo=%d' % (n_ud, n_wi))

uni = Counter(); bf = defaultdict(Counter); tf = defaultdict(Counter); N = 0; ns = 0
for ws in sents():
    if not ws: continue
    ns += 1
    T = ['<s>', '<s>'] + ws + ['</s>', '</s>']
    for k in range(2, len(T) - 2):
        w = T[k]; uni[w] += 1; N += 1
        bf[T[k - 1]][w] += 1; tf[(T[k - 2], T[k - 1])][w] += 1

def prune(tab, thr, join2):
    out = {}; n = 0
    for ctx, cnt in tab.items():
        kk = (ctx[0] + '\t' + ctx[1]) if join2 else ctx
        d = {w: c for w, c in cnt.items() if c >= thr}
        if d: out[kk] = d; n += len(d)
    return out, n

TF, nTF = prune(tf, PRUNE_TRI, True)
BF, nBF = prune(bf, PRUNE_BI, False)
UNI = {w: c for w, c in uni.items() if c >= 2}
model = {'uni': UNI, 'N': N, 'tf': TF, 'bf': BF,
         'src': 'UD French-GSD (CC BY-SA) + WiCoPaCo after (GFDL) — LOCAL, décodage voie B', 'prune': [PRUNE_TRI, PRUNE_BI]}
with gzip.open(OUT, 'wt', encoding='utf-8') as f:
    json.dump(model, f, ensure_ascii=False, separators=(',', ':'))
sz = os.path.getsize(OUT)
print('LM de décodage baké : %s' % OUT)
print('  phrases totales : %d   tokens N : %d   vocab : %d' % (ns, N, len(UNI)))
print('  contextes bigramme : %d   trigramme : %d' % (nBF, nTF))
print('  taille gzip : %.1f Mo' % (sz / 1024 / 1024))
