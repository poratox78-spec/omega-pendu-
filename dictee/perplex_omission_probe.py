# -*- coding: utf-8 -*-
u"""VIGILANCE-PERPLEXITÉ — le mou signale là où AUCUNE règle ne regarde : les MOTS OUBLIÉS
(chantier symbiose n°2). Le juge B2 lit la phrase UNE fois (un forward → logprob de chaque
caractère) ; à la frontière où un mot manque, le mot SUIVANT surprend. Signal par frontière de
mot, deux variantes mesurées :
  · moyTok  = − logprob moyen par caractère du token qui suit la frontière ;
  · z-score = moyTok normalisé par la distribution de LA phrase (les mots rares surprennent
              partout — un nom propre ne doit pas déclencher).
Bancs (held-out pur) :
  · SYNTHÉTIQUE : fp_scale, UN mot retiré (50 % mots-outils — ne/pas/de/à/le… quasi inaudibles —
    50 % n'importe lequel) → localisation (hit exact / ±1) + à CHAQUE seuil le taux de fausse
    alerte sur les phrases INTACTES (la fatigue, encore elle).
  · DYS RÉEL : les omissions vraies du corpus apparié (align : insertion côté gold), texte brut
    avec toutes ses AUTRES fautes — le test honnête.
  python dictee/perplex_omission_probe.py [modele.pt]"""
import os, sys, io, re, json, random, unicodedata
from collections import Counter

import torch
import torch.nn.functional as F

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from b2_train import CharT
from dys_reel_probe import align

FP_SCALE = os.path.join(HERE, 'fp_scale_corpus.txt')
DUMP = os.path.join(ROOT, 'data_local', 'arbitre_vig_dump.json')
TOK = re.compile(u"[A-Za-zÀ-ÿœŒæÆ'ʼ]+")
OUTILS = set(u"ne pas de à le la les un une des en que qui se sa son ses et ou est a au aux du il elle on nous vous ils elles pour dans sur avec par plus si".split())

def main():
    fmod = sys.argv[1] if len(sys.argv) > 1 else 'b2_model_14m.pt'
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    ck = torch.load(os.path.join(ROOT, 'data_local', fmod), map_location='cpu', weights_only=False)
    chars = ck['chars']; v2i = {c: i for i, c in enumerate(chars)}
    CTX = ck['cfg']['CTX']
    m = CharT(len(chars), ck['cfg']).to(dev); m.load_state_dict(ck['model']); m.eval()

    def lp_chars_lot(strs):
        u"""log-prob de chaque caractère (positions 1..L-1), par lot."""
        out = []
        for a in range(0, len(strs), 64):
            lot = strs[a:a + 64]
            ids = [[v2i.get(c, 0) for c in s][:CTX] for s in lot]
            L = max(max(len(x) for x in ids), 3)
            t = torch.zeros(len(ids), L, dtype=torch.long, device=dev)
            for i, x in enumerate(ids):
                t[i, :len(x)] = torch.tensor(x, device=dev)
            with torch.no_grad():
                lp = F.log_softmax(m(t)[:, :-1].float(), -1)
                g = lp.gather(2, t[:, 1:, None])[:, :, 0]
            for i, x in enumerate(ids):
                out.append(g[i, :len(x) - 1].tolist())          # lp du char k = out[k-1]
        return out

    def surprises(s, lp):
        u"""par token (index, surprise moyenne/char, z-score dans la phrase)."""
        st = [(mm.start(), mm.end()) for mm in TOK.finditer(s)]
        vals = []
        for (a, b) in st:
            cs = [lp[k - 1] for k in range(max(a, 1), min(b, len(lp) + 1))]
            vals.append(-sum(cs) / max(len(cs), 1))
        if not vals: return []
        mu = sum(vals) / len(vals)
        sd = (sum((v - mu) ** 2 for v in vals) / max(len(vals) - 1, 1)) ** 0.5 or 1.0
        return [(i, v, (v - mu) / sd) for i, v in enumerate(vals)]

    # ── SYNTHÉTIQUE (fp_scale held-out) ──────────────────────────────────────
    rng = random.Random(20260821)
    corpus = [l.strip().replace(u'’', u"'") for l in io.open(FP_SCALE, encoding='utf-8') if l.strip()]
    cas = []                                       # (phrase trouée, index token attendu, intacte)
    for s in corpus:
        st = [(mm.group(0), mm.start(), mm.end()) for mm in TOK.finditer(s)]
        if len(st) < 6 or len(s) > 330: continue
        outils = [k for k, (w, _a, _b) in enumerate(st) if w.lower() in OUTILS and 0 < k < len(st) - 1]
        pool = outils if (outils and rng.random() < 0.5) else list(range(1, len(st) - 1))
        k = rng.choice(pool)
        a, b = st[k][1], st[k][2]
        e = b + 1 if b < len(s) and s[b] == u' ' else b
        troue = s[:a] + s[e:]
        cas.append((troue, k, s, st[k][0]))        # après retrait, la frontière = token k (le suivant a pris l'index k)
        if len(cas) >= 900: break
    lps_t = lp_chars_lot([c[0] for c in cas])
    lps_i = lp_chars_lot([c[2] for c in cas])
    hits = Counter(); n_loc = 0
    z_omis, z_intact = [], []
    for (troue, k, intact, mot), lpt, lpi in zip(cas, lps_t, lps_i):
        sv = surprises(troue, lpt)
        if not sv: continue
        n_loc += 1
        top = max(sv, key=lambda x: x[2])
        if top[0] == k: hits['exact'] += 1
        if abs(top[0] - k) <= 1: hits['pm1'] += 1
        z_omis.append(max(x[2] for x in sv))
        si = surprises(intact, lpi)
        if si: z_intact.append(max(x[2] for x in si))
    print(u'══ SYNTHÉTIQUE — %d phrases trouées (held-out fp_scale) ══' % n_loc)
    print(u'localisation (argmax z) : exacte %.0f %% · ±1 token %.0f %%' % (100.0 * hits['exact'] / n_loc, 100.0 * hits['pm1'] / n_loc))
    print(u'  seuil z   déclenche sur TROUÉES   fausse alerte sur INTACTES')
    for zt in (1.5, 2.0, 2.5, 3.0, 3.5):
        r = sum(1 for z in z_omis if z > zt); f = sum(1 for z in z_intact if z > zt)
        print(u'  %.1f       %4d/%4d (%.0f %%)         %4d/%4d (%.1f %%)'
              % (zt, r, len(z_omis), 100.0 * r / len(z_omis), f, len(z_intact), 100.0 * f / len(z_intact)))

    # ── DYS RÉEL : les vraies omissions du corpus apparié ────────────────────
    D = json.load(io.open(DUMP, encoding='utf-8'))
    omis = []
    for t in D['dys']:
        tn = t['raw'].replace(u'’', u"'")
        ops = align(t['tokens'], t['tokensFixed'])
        ia = 0
        for op in ops:
            kk, a, b = op
            if kk == 'ins':
                omis.append((tn, ia, b))          # le mot b manque AVANT le token brut ia
                continue
            if kk == 'del': ia += 1; continue
            ia += 1
    lps = lp_chars_lot([o[0] for o in omis])
    got = Counter(); zr = []
    for (tn, k, mot), lp in zip(omis, lps):
        sv = surprises(tn, lp)
        if not sv: continue
        got['n'] += 1
        top = max(sv, key=lambda x: x[2])
        if abs(top[0] - k) <= 1: got['pm1'] += 1
        zk = max((x[2] for x in sv if abs(x[0] - k) <= 1), default=-9)
        zr.append((zk, mot, tn))
    print(u'\n══ DYS RÉEL — %d omissions vraies (texte brut, autres fautes incluses) ══' % got['n'])
    print(u'argmax z tombe à ±1 de l omission : %d/%d (%.0f %%)' % (got['pm1'], got['n'], 100.0 * got['pm1'] / max(got['n'], 1)))
    for zt in (1.5, 2.0, 2.5):
        r = sum(1 for z, _m, _t in zr if z > zt)
        print(u'  z>%.1f : le site aurait signalé %d/%d (%.0f %%)' % (zt, r, len(zr), 100.0 * r / max(len(zr), 1)))
    print(u'\n── quelques omissions réelles et leur z local ──')
    for z, mot, tn in sorted(zr, reverse=True)[:6]:
        print(u'  z=%+.1f  manque « %s » · %s' % (z, mot, tn[:80]))

if __name__ == '__main__':
    main()
