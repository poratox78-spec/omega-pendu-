# -*- coding: utf-8 -*-
# BAKER du LM porte-confiance de l'OS-sujet (chantier « accord par arbitrage du sujet »).
# Le LM (R4 = cohérence de nombre du verbe par la surprise contextuelle) fournit le GRADIENT DE CONFIANCE qui rend le
# gating utile (mesuré : sans lui, flood plat). Élaguer tri>=5/bi>=3 réduit 695K->31K entrées SANS perdre le point
# tau=0.85 (flood ~1.1%/recall ~40%) et baisse même le flood (retire le bruit des contextes rares).
#   Source : treebank UD French-GSD (CC BY-SA 4.0), champ « # text » — MÊME source que pos_hmm.json. On EXCLUT du train
#   les phrases de dictee/fp_scale_corpus.txt (= le jeu de flood held-out) pour un chiffre honnête.
#   Sortie : dictee/os_subj_lm.json.gz  { uni, N, tf, tb, bf, bb }  (trigrammes+bigrammes bidirectionnels, comptes).
#   Reproductible : python dictee/build_os_lm.py   (lit ../data_local/ud_fr_gsd-train.conllu, local/gitignoré)
import os, re, json, gzip
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
UD = os.path.join(HERE, '..', 'data_local', 'ud_fr_gsd-train.conllu')
FP = os.path.join(HERE, 'fp_scale_corpus.txt')
OUT = os.path.join(HERE, 'os_subj_lm.json.gz')
PRUNE_TRI, PRUNE_BI = 5, 3

TOK = re.compile(r"[a-zA-Zà-ÿœæ'\-]+")
def tk(s): return [w.lower() for w in TOK.findall(s.replace('’', "'"))]

fp_norm = set(' '.join(tk(l)) for l in open(FP, encoding='utf-8') if l.strip())

def ud_sents():
    for l in open(UD, encoding='utf-8'):
        if l.startswith('# text ='):
            txt = l.split('=', 1)[1]
            if ' '.join(tk(txt)) in fp_norm: continue          # held-out flood → hors train
            yield tk(txt)

uni = Counter(); bf = defaultdict(Counter); tf = defaultdict(Counter); bb = defaultdict(Counter); tb = defaultdict(Counter); N = 0; kept = 0
for ws in ud_sents():
    kept += 1
    T = ['<s>', '<s>'] + ws + ['</s>', '</s>']
    for k in range(2, len(T)-2):
        w = T[k]; uni[w] += 1; N += 1
        bf[T[k-1]][w] += 1; tf[(T[k-2], T[k-1])][w] += 1
        bb[T[k+1]][w] += 1; tb[(T[k+1], T[k+2])][w] += 1

def prune(tab, thr, join2):
    out = {}; n = 0
    for ctx, cnt in tab.items():
        kk = (ctx[0] + '\t' + ctx[1]) if join2 else ctx
        d = {w: c for w, c in cnt.items() if c >= thr}
        if d: out[kk] = d; n += len(d)
    return out, n

TF, nTF = prune(tf, PRUNE_TRI, True)
TB, nTB = prune(tb, PRUNE_TRI, True)
BF, nBF = prune(bf, PRUNE_BI, False)
BB, nBB = prune(bb, PRUNE_BI, False)
UNI = {w: c for w, c in uni.items() if c >= 2}                  # unigramme (repli) : garde les mots vus >=2
model = {'uni': UNI, 'N': N, 'tf': TF, 'tb': TB, 'bf': BF, 'bb': BB,
         'src': 'UD French-GSD (CC BY-SA 4.0)', 'prune': [PRUNE_TRI, PRUNE_BI]}
with gzip.open(OUT, 'wt', encoding='utf-8') as f:
    json.dump(model, f, ensure_ascii=False, separators=(',', ':'))
sz = os.path.getsize(OUT)
tot = nTF + nTB + nBF + nBB + len(UNI)
print("LM OS-sujet baké : %s" % OUT)
print("  phrases UD train (hors held-out flood) : %d" % kept)
print("  entrées : tf=%d tb=%d bf=%d bb=%d uni=%d  → TOTAL %d" % (nTF, nTB, nBF, nBB, len(UNI), tot))
print("  taille gzip : %d octets (%.0f Ko)" % (sz, sz/1024))
