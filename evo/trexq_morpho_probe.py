# -*- coding: utf-8 -*-
# SONDE TREXQUANT — la MORPHO/décompose aide-t-elle l'OOV du pendu ? FALSIFICATION mesurée.
# ============================================================================================
# Hypothèse (Rem : « décompose préparé pour le mode trexquant, voir si utile ») : la structure
# morphologique (affixes appris de morpho.json) ajoute-t-elle un Δ winrate AU-DESSUS du substrat
# n-gram de lettres (le levier §1.7/§1.8, ~66 % OOV) ?  — la thèse OUVERTE de AUDIT_OMEGA §1.8.
#
# RÉSULTAT : FALSIFIÉ. La morpho n'ajoute RIEN (au mieux +0,2 pt = bruit ; poids plus fort → dégrade).
#   A n-gram seul ≈ 69 % · n-gram+morpho ×1/×4/×12 = 69/68/66 % · morpho SEULE = 24 %.
#   Le n-gram capte DÉJÀ la structure d'affixes (forward = préfixes, backward = suffixes) → redondant.
#   → cohérent §1.8 : la cognition/structure n'ajoute pas de Δ sur le substrat n-gram. Le levier OOV
#     au-delà du n-gram est le CONTEXTE (LLM), pas la décomposition. La morpho reste utile pour la
#     DICTÉE/décomposeur (diagnostic dys), pas pour le pendu OOV.
#
# OOV par construction (test retiré du train → zéro fuite ; morpho apprise sur le TRAIN seul).
# Lancer : python3 evo/trexq_morpho_probe.py   (≈ 30 s)
import os, re, base64, gzip, json, random, unicodedata, sys
from collections import defaultdict, Counter

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', 'app', 'omega-pendu.html')
MORPHO = os.path.join(HERE, '..', 'dictee', 'morpho.json')
SEED, NTEST, N = 42, 500, 5
ABC = 'abcdefghijklmnopqrstuvwxyz'


def deac(s):
    s = s.replace('œ', 'oe')
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


def load_words():
    src = open(APP, encoding='utf-8').read()
    m = re.search(r'id="lex4-data-gz"[^>]*>([A-Za-z0-9+/=\s]+?)</script>', src)
    W = json.loads(gzip.decompress(base64.b64decode(re.sub(r'\s', '', m.group(1)))).decode())['words']
    ws = set()
    for e in W:
        w = deac((e.get('m') or '').lower())
        if 7 <= len(w) <= 12 and w.isalpha() and all('a' <= c <= 'z' for c in w):
            ws.add(w)
    ws = sorted(ws); random.Random(SEED).shuffle(ws)
    return ws[:NTEST], ws[NTEST:]


def build_ngram(train):
    F = [defaultdict(lambda: defaultdict(int)) for _ in range(N)]
    Bk = [defaultdict(lambda: defaultdict(int)) for _ in range(N)]
    for w in train:
        for i in range(len(w)):
            for k in range(N):
                if i - k >= 0: F[k][w[i-k:i]][w[i]] += 1
                if i + 1 + k <= len(w): Bk[k][w[i+1:i+1+k]][w[i]] += 1
    return F, Bk


def build_affix(train_set):
    sufC, preC = defaultdict(Counter), defaultdict(Counter)
    MOR = json.load(open(MORPHO, encoding='utf-8'))
    for w, (mb, md) in MOR.items():
        if w not in train_set:
            continue                                       # pas de fuite : morpho apprise sur le TRAIN seul
        parts = [p for p in md.lstrip('/_').replace('_', '.').split('.') if p]
        ms = [x for x in (re.sub(r'\(.*?\)', '', p) for p in parts) if x]
        if len(ms) >= 2:
            s, pr = ms[-1], ms[0]
            if 2 <= len(s) <= 6: sufC[len(s)][s] += 1
            if 2 <= len(pr) <= 6: preC[len(pr)][pr] += 1
    amax = max([1] + [c for C in sufC.values() for c in C.values()])
    return sufC, preC, amax


def main():
    if not os.path.exists(MORPHO):
        print(f"[trexq] morpho.json absent ({MORPHO})."); return 1
    TEST, TRAIN = load_words()
    trainset = set(TRAIN)
    F, Bk = build_ngram(TRAIN)
    sufC, preC, amax = build_affix(trainset)
    print(f"=== SONDE TREXQUANT — morpho vs n-gram (OOV) ===  train={len(TRAIN)} test_OOV={len(TEST)}\n")

    def pdir(tab, k, ctx, c):
        d = tab[k].get(ctx)
        if not d: return None
        tot = sum(d.values())
        if tot < 5 and k > 0: return None
        return (d.get(c, 0) + 0.01) / (tot + 0.26)

    def ngram_letters(pat):
        out = {}
        for c in ABC:
            sc = 0.0
            for p in range(len(pat)):
                if pat[p] != '_': continue
                f = b = None
                for k in range(N - 1, -1, -1):
                    if p - k >= 0 and '_' not in pat[p-k:p]:
                        v = pdir(F, k, pat[p-k:p], c)
                        if v is not None: f = v; break
                for k in range(N - 1, -1, -1):
                    if p + 1 + k <= len(pat) and '_' not in pat[p+1:p+1+k]:
                        v = pdir(Bk, k, pat[p+1:p+1+k], c)
                        if v is not None: b = v; break
                vals = [x for x in (f, b) if x is not None]
                if vals: sc += sum(vals) / len(vals)
            out[c] = sc
        return out

    def affix_letters(pat):
        out = defaultdict(float); L = len(pat)
        for sl, C in sufC.items():
            if sl >= L: continue
            seg = pat[L-sl:]
            for s, cnt in C.items():
                if all(seg[j] == '_' or seg[j] == s[j] for j in range(sl)):
                    for j in range(sl):
                        if seg[j] == '_': out[s[j]] += cnt
        for pl, C in preC.items():
            if pl >= L: continue
            seg = pat[:pl]
            for s, cnt in C.items():
                if all(seg[j] == '_' or seg[j] == s[j] for j in range(pl)):
                    for j in range(pl):
                        if seg[j] == '_': out[s[j]] += cnt
        return out

    def play(word, wt, ngram_on=True, lives=6):
        pat = ['_'] * len(word); tried = set(); wrong = 0
        while '_' in pat and wrong < lives:
            cur = ''.join(pat)
            ng = ngram_letters(cur) if ngram_on else {}
            af = affix_letters(cur) if wt else {}
            best = bc = None
            for c in ABC:
                if c in tried: continue
                s = (ng.get(c, 0) if ngram_on else 0) + (wt * af.get(c, 0) / amax if wt else 0)
                if best is None or s > best: best = s; bc = c
            tried.add(bc)
            if bc in word:
                for i, ch in enumerate(word):
                    if ch == bc: pat[i] = ch
            else:
                wrong += 1
        return '_' not in pat

    def wr(wt, ngram_on=True):
        return 100.0 * sum(play(w, wt, ngram_on) for w in TEST) / len(TEST)

    A = wr(0.0)
    print(f"  A — n-gram seul (substrat)     : {A:.1f}%")
    best_hybrid = A
    for wt in (1.0, 4.0, 12.0):
        h = wr(wt); best_hybrid = max(best_hybrid, h)
        print(f"  n-gram + morpho ×{wt:<5}         : {h:.1f}%")
    MO = wr(1.0, ngram_on=False)
    print(f"  morpho SEULE (sans n-gram)     : {MO:.1f}%")

    print("\n  VERDICT : la morpho n'ajoute pas de Δ sur le n-gram (le substrat capte déjà les affixes).")
    print("            Levier OOV au-delà du n-gram = CONTEXTE (LLM), pas la décomposition. (AUDIT §1.8)")
    # garde de régression : la falsification doit RESTER vraie (morpho ne bat pas le n-gram de façon nette)
    assert MO < A - 10, "morpho SEULE inattendument forte — ré-évaluer"
    assert best_hybrid <= A + 1.0, "FALSIFICATION CADUQUE : la morpho bat le n-gram (>+1 pt) — ré-évaluer, mesurer, arbitrer"
    return 0


if __name__ == '__main__':
    sys.exit(main())
