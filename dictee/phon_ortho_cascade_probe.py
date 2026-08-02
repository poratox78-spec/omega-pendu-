# -*- coding: utf-8 -*-
# MESURE de l'idée de Rem : cascade n-gramme PHON puis ORTHO (dans cet ordre). Le pont phonème→lettre est
# légitime : le phonème d'une case MASQUÉE se prédit depuis les phonèmes des lettres RÉVÉLÉES (phonotactique
# n-gramme) → phon2letters → lettres candidates ; puis l'ortho n-gramme (contexte de lettres révélées)
# tranche. Tâche = récupération de lettre masquée (proxy propre du pendu, régime sublexical). Held-out 10%.
# Compare : ORTHO seul · PHON seul · PHON→ORTHO (Rem) · ORTHO→PHON. Métrique = top-1 accuracy.
#   Lancer : PYTHONUTF8=1 python dictee/phon_ortho_cascade_probe.py
import gzip, io, os, sys, json, math, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from g2p_en_apply import g2p_en_steps
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
p2l = json.load(io.open(os.path.join(HERE, 'phon2letters_en.json'), encoding='utf-8'))

# --- charge mots attestés len 7-15 (le pool de mesure du pendu) ---
words = []
with gzip.open(os.path.join(HERE, 'lex_en.tsv.gz'), 'rt', encoding='utf-8') as f:
    f.readline()
    for ln in f:
        c = ln.rstrip('\n').split('\t')
        if len(c) < 7: continue
        w = c[0]
        if not (w.isalpha() and w.isascii() and 7 <= len(w) <= 15): continue
        try: fr = int(c[6])
        except:
            try: fr = int(float(c[6]))
            except: fr = 0
        if fr > 0: words.append(w.upper())
train = [w for i, w in enumerate(words) if i % 10 != 0]
test  = [w for i, w in enumerate(words) if i % 10 == 0][:4000]
print('train %d · test %d (held-out)' % (len(train), len(test)))

# --- n-gramme ORTHO positionnel (tri/bi/uni de lettres, contexte gauche révélé) ---
o3 = collections.Counter(); o2 = collections.Counter(); o1 = collections.Counter(); oc2 = collections.Counter(); oc1 = collections.Counter()
for w in train:
    s = '^^' + w + '$'
    for i in range(2, len(s)):
        o1[s[i]] += 1; o2[(s[i-1], s[i])] += 1; oc1[s[i-1]] += 1
        o3[(s[i-2], s[i-1], s[i])] += 1; oc2[(s[i-2], s[i-1])] += 1
V = 27
def ortho_dist(a, b):  # P(x | a,b) backoff, sur A-Z
    d = {}
    for x in AZ:
        pt = (o3.get((a, b, x), 0) + 0.1) / (oc2.get((a, b), 0) + 0.1 * V)
        pb = (o2.get((b, x), 0) + 0.1) / (oc1.get(b, 0) + 0.1 * V)
        d[x] = 0.7 * pt + 0.3 * pb
    return d

# --- n-gramme PHON (tri de phonèmes) + alignement lettre→phonème ---
def letter_phons(w):  # index de lettre -> phonème du bloc (ou '' si muet)
    out = []
    for (g, ph) in g2p_en_steps(w):
        for _ in g: out.append(ph)
    return (out + [''] * len(w))[:len(w)]
ph3 = collections.Counter(); phc2 = collections.Counter(); phset = set()
for w in train:
    lp = letter_phons(w); seq = ['^', '^'] + [p for p in lp if p] + ['$']
    for p in lp:
        if p: phset.add(p)
    for i in range(2, len(seq)):
        ph3[(seq[i-2], seq[i-1], seq[i])] += 1; phc2[(seq[i-2], seq[i-1])] += 1
def phon_next(a, b):  # distribution du phonème suivant | 2 précédents
    d = {}; tot = 0
    for p in phset:
        v = ph3.get((a, b, p), 0) + 0.05; d[p] = v; tot += v
    return {p: v / tot for p, v in d.items()}

def phon_dist(w, i, lp):  # P(lettre à i) via phonotactique : prédit le phonème à i puis phon2letters
    a = lp[i-2] if i >= 2 and lp[i-2] else '^'
    b = lp[i-1] if i >= 1 and lp[i-1] else '^'
    pn = phon_next(a, b)                                  # phonème probable à i (depuis révélés gauche)
    d = {x: 0.0 for x in AZ}
    for ph, pp in pn.items():
        m = p2l.get(ph)
        if not m: continue
        for L, w2 in m.items(): d[L] += pp * w2
    s = sum(d.values()) or 1.0
    return {x: d[x] / s for x in AZ}

def top1(scores, avail):
    best = None; bv = -1
    for L in avail:
        if scores[L] > bv: bv = scores[L]; best = L
    return best

# --- récupération de lettre masquée : chaque position, contexte gauche révélé ---
import collections as _c
hit = _c.Counter(); n = 0
for w in test:
    lp = letter_phons(w)
    s = '^^' + w + '$'
    for i in range(len(w)):
        gold = w[i]; a = s[i]; b = s[i+1]     # 2 lettres révélées à gauche
        od = ortho_dist(a, b)
        pd = phon_dist(w, i, lp)
        avail = AZ
        # 4 stratégies
        cand_o = top1(od, avail)
        cand_p = top1(pd, avail)
        # PHON->ORTHO : phon propose top-5, ortho tranche
        topP = sorted(AZ, key=lambda x: -pd[x])[:5]
        cand_po = top1(od, topP)
        # ORTHO->PHON : ortho propose top-5, phon tranche
        topO = sorted(AZ, key=lambda x: -od[x])[:5]
        cand_op = top1(pd, topO)
        if cand_o == gold: hit['ortho'] += 1
        if cand_p == gold: hit['phon'] += 1
        if cand_po == gold: hit['phon→ortho'] += 1
        if cand_op == gold: hit['ortho→phon'] += 1
        n += 1
print('\ntop-1 récupération de lettre masquée (n=%d positions) :' % n)
for k in ['ortho', 'phon', 'phon→ortho', 'ortho→phon']:
    print('  %-12s : %.1f%%' % (k, 100.0 * hit[k] / n))
