# -*- coding: utf-8 -*-
u"""ARBITRE DES VIGILANCES — le juge B2 sur TOUTES les oranges du pipeline réel (chantier
« symbiose » n°1). Question mesurée, dans les deux sens :
  · sur texte CORRECT (fp_scale+UD, dump arbitre_vig_dump) : toute orange est de la fatigue —
    combien le juge peut-il en TAIRE (il préfère nettement l'écrit au candidat) ?
  · sur le dys RÉEL apparié : les oranges se classent JUSTE (sugg == gold), POINTEUSE (vraie
    faute, autre sugg) ou FATIGUE (mot correct) — le juge doit GARDER les justes (≈100 %),
    garder les pointeuses, taire la fatigue.
Décision par flag : d = score(candidat) − score(écrit) ; TAIRE si d < −τ (l'écrit gagne par
marge). Chaque orange JUSTE perdue est IMPRIMÉE — on lit, on ne résume pas.
  python dictee/arbitre_vig_probe.py [modele.pt]"""
import os, sys, io, re, json, unicodedata
from collections import Counter, defaultdict

import torch
import torch.nn.functional as F

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from b2_train import CharT
from dys_reel_probe import align

DUMP = os.path.join(ROOT, 'data_local', 'arbitre_vig_dump.json')
TAUS = (0.0, 0.005, 0.01, 0.02, 0.04)
TOK = re.compile(u"[A-Za-zÀ-ÿœŒæÆ'ʼ]+")

def norm(w): return (w or u'').lower().replace(u'’', u"'")

def fenetre(t, pos):
    d = max(t.rfind(u'.', 0, pos), t.rfind(u'!', 0, pos), t.rfind(u'?', 0, pos))
    e = len(t)
    for c in u'.!?':
        k = t.find(c, pos)
        if k >= 0 and k < e: e = k
    return d + 1, min(e + 1, len(t))

def spans_tokens(t):
    return [(m.group(0), m.start(), m.end()) for m in TOK.finditer(t)]

def paires_flag(t, flag):
    u"""(fenêtre écrite, fenêtre candidate) pour un flag {i, span, sugg} sur le texte normalisé t."""
    st = spans_tokens(t)
    i = flag['i']; sp = flag.get('span') or 1
    if i >= len(st) or i + sp - 1 >= len(st): return None
    a, b = st[i][1], st[i + sp - 1][2]
    cand = t[:a] + flag['sugg'] + t[b:]
    w0, w1 = fenetre(t, a)
    d = len(cand) - len(t)
    return t[w0:w1], cand[w0:w1 + d]

def main():
    fmod = sys.argv[1] if len(sys.argv) > 1 else 'b2_model_14m.pt'
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    ck = torch.load(os.path.join(ROOT, 'data_local', fmod), map_location='cpu', weights_only=False)
    chars = ck['chars']; v2i = {c: i for i, c in enumerate(chars)}
    CTX = ck['cfg']['CTX']
    m = CharT(len(chars), ck['cfg']).to(dev); m.load_state_dict(ck['model']); m.eval()

    def scores_lot(strs):
        out = []
        for a in range(0, len(strs), 64):
            lot = strs[a:a + 64]
            ids = [[v2i.get(c, 0) for c in s][:CTX] for s in lot]
            L = max(max(len(x) for x in ids), 3)
            t = torch.zeros(len(ids), L, dtype=torch.long, device=dev)
            msk = torch.zeros(len(ids), L, device=dev)
            for i, x in enumerate(ids):
                t[i, :len(x)] = torch.tensor(x, device=dev); msk[i, 1:len(x)] = 1
            with torch.no_grad():
                lp = F.log_softmax(m(t)[:, :-1].float(), -1)
                tok = lp.gather(2, t[:, 1:, None])[:, :, 0] * msk[:, 1:]
                out.extend((tok.sum(1) / msk[:, 1:].sum(1).clamp(min=1)).tolist())
        return out

    D = json.load(io.open(DUMP, encoding='utf-8'))

    # ── A · CORRECT : toute orange = fatigue ─────────────────────────────────
    items = []                                    # (nom, écrit, candidat)
    for e in D['correct']:
        t = e['s'].replace(u'’', u"'")
        for f in e['flags']:
            p = paires_flag(t, f)
            if p: items.append((f.get('name') or '?', p[0], p[1]))
    se = scores_lot([x[1] for x in items]); sc = scores_lot([x[2] for x in items])
    dA = [(sc[k] - se[k], items[k][0]) for k in range(len(items))]
    print(u'══ A · FATIGUE (corpus correct %d phrases) — %d oranges jugées ══' % (D['nCorrects'], len(dA)))
    print(u'  τ       tues (fatigue évitée)')
    for tau in TAUS:
        n = sum(1 for d, _ in dA if d < -tau)
        print(u'  %.3f   %4d/%4d (%.0f %%)' % (tau, n, len(dA), 100.0 * n / max(len(dA), 1)))
    fam = defaultdict(lambda: [0, 0])
    for d, nm in dA:
        fam[nm][1] += 1
        if d < -0.01: fam[nm][0] += 1
    print(u'  par famille (tues/total à τ=0.01) :')
    for nm, (t_, n_) in sorted(fam.items(), key=lambda x: -x[1][1])[:12]:
        print(u'    %-38s %4d/%4d (%.0f %%)' % (nm, t_, n_, 100.0 * t_ / n_))

    # ── B · DYS RÉEL : juste / pointeuse / fatigue ───────────────────────────
    cls_items = defaultdict(list)                 # classe → [(d sera rempli), (nom, e, c, contexte)]
    bruts = []
    for t in D['dys']:
        tn = t['raw'].replace(u'’', u"'")
        ops = align(t['tokens'], t['tokensFixed'])
        gold = {}                                 # index brut → (token brut, token gold)
        ia = 0
        for op in ops:
            k, a, b = op
            if k == 'ins': continue
            if k == 'del': ia += 1; continue
            gold[ia] = (a, b); ia += 1
        for f in t['flags']:
            g = gold.get(f['i'])
            if g is None: continue
            a, b = g
            if norm(a) == norm(b): cl = 'FATIGUE'
            elif norm(f.get('sugg')) == norm(b): cl = 'JUSTE'
            else: cl = 'POINTEUSE'
            p = paires_flag(tn, f)
            if p: bruts.append((cl, f.get('name') or '?', p[0], p[1], a, b, f.get('sugg')))
    se = scores_lot([x[2] for x in bruts]); sc = scores_lot([x[3] for x in bruts])
    print(u'\n══ B · DYS RÉEL (%d textes) — %d oranges classées ══' % (len(D['dys']), len(bruts)))
    print(u'  τ       JUSTES gardées    POINTEUSES gardées    FATIGUE tue')
    for tau in TAUS:
        g = Counter(); n = Counter()
        for k, (cl, nm, _e, _c, _a, _b, _s) in enumerate(bruts):
            n[cl] += 1
            d = sc[k] - se[k]
            if cl in ('JUSTE', 'POINTEUSE') and d >= -tau: g[cl] += 1
            if cl == 'FATIGUE' and d < -tau: g[cl] += 1
        print(u'  %.3f   %3d/%3d (%.0f %%)      %3d/%3d (%.0f %%)         %3d/%3d (%.0f %%)'
              % (tau, g['JUSTE'], n['JUSTE'], 100.0 * g['JUSTE'] / max(n['JUSTE'], 1),
                 g['POINTEUSE'], n['POINTEUSE'], 100.0 * g['POINTEUSE'] / max(n['POINTEUSE'], 1),
                 g['FATIGUE'], n['FATIGUE'], 100.0 * g['FATIGUE'] / max(n['FATIGUE'], 1)))
    print(u'\n── chaque orange JUSTE que τ=0.01 perdrait — à LIRE ──')
    for k, (cl, nm, e, c, a, b, s) in enumerate(bruts):
        if cl == 'JUSTE' and (sc[k] - se[k]) < -0.01:
            print(u'  Δ=%+.3f [%s] « %s »→« %s » (gold %s) · %s' % (sc[k] - se[k], nm, a, s, b, e[:70]))

if __name__ == '__main__':
    main()
