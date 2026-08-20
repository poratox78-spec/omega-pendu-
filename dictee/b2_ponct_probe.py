# -*- coding: utf-8 -*-
u"""B2 → PONCTUATION : le modèle actuel (b2_model_14m, poids INCHANGÉS) sait-il juger la virgule
et le point ? Mesure AVANT le portage navigateur — si ça tient, la greffe ponctuation = les MÊMES
poids que le juge sait/s'est (deux usages, un fichier) ; sinon on saura qu'un affinage s'impose
(swap de poids, moteur intact). Référence à battre : la table ponct-lm plafonne à F1 0,21 en
texte seul (la littérature donne ~0,8 à un petit transformer).
Bancs sur HELD-OUT pur (fp_scale, jamais vu à l'entraînement) :
  · VIRGULES : phrases à virgules, virgules retirées → à chaque frontière de mot, le juge compare
    score(avec ,) vs score(sans) → P/R/F1 par seuil τ.
  · POINTS   : paires de phrases consécutives fusionnées sans point ni majuscule → même jeu avec
    « . » + majuscule ; la vraie jonction doit sortir, les autres frontières se taire.
  python dictee/b2_ponct_probe.py [modele.pt] [n_virg] [n_pts]"""
import os, sys, io, re

import torch
import torch.nn.functional as F

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from b2_train import CharT

FP_SCALE = os.path.join(HERE, 'fp_scale_corpus.txt')
TAUS = (0.0, 0.005, 0.01, 0.02, 0.04)
MOT = re.compile(u"[A-Za-zà-ÿÀ-ŸœŒæÆ'’\\-]+")

def main():
    fmod = sys.argv[1] if len(sys.argv) > 1 else 'b2_model_14m.pt'
    n_virg = int(sys.argv[2]) if len(sys.argv) > 2 else 600
    n_pts = int(sys.argv[3]) if len(sys.argv) > 3 else 300
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
            L = max(len(x) for x in ids)
            t = torch.zeros(len(ids), L, dtype=torch.long, device=dev)
            msk = torch.zeros(len(ids), L, device=dev)
            for i, x in enumerate(ids):
                t[i, :len(x)] = torch.tensor(x, device=dev); msk[i, 1:len(x)] = 1
            with torch.no_grad():
                lp = F.log_softmax(m(t)[:, :-1].float(), -1)
                tok = lp.gather(2, t[:, 1:, None])[:, :, 0] * msk[:, 1:]
                out.extend((tok.sum(1) / msk[:, 1:].sum(1).clamp(min=1)).tolist())
        return out

    corpus = [l.strip().replace(u'’', u"'") for l in io.open(FP_SCALE, encoding='utf-8') if l.strip()]

    # ── VIRGULES ─────────────────────────────────────────────────────────────
    cas = []                                   # (phrase sans virgules, indices gold, frontières)
    for s in corpus:
        if ',' not in s or len(s) > 350: continue
        mots = [(mm.group(0), mm.start(), mm.end()) for mm in MOT.finditer(s)]
        if len(mots) < 5: continue
        gold = set(i for i, (_w, _a, b) in enumerate(mots[:-1]) if s[b:mots[i + 1][1]].strip().startswith(','))
        if not gold: continue
        nu = re.sub(u' ?,', u'', s)
        cas.append((nu, gold))
        if len(cas) >= n_virg: break
    tp = {t: 0 for t in TAUS}; fp = {t: 0 for t in TAUS}; fn = {t: 0 for t in TAUS}
    for nu, gold in cas:
        mots = [(mm.group(0), mm.start(), mm.end()) for mm in MOT.finditer(nu)]
        variants = [nu[:b] + u',' + nu[b:] for (_w, _a, b) in mots[:-1]]
        sc = scores_lot([nu] + variants)
        base = sc[0]
        for i, sv in enumerate(sc[1:]):
            d = sv - base
            for t in TAUS:
                pred = d > t
                if pred and i in gold: tp[t] += 1
                elif pred: fp[t] += 1
                elif i in gold: fn[t] += 1
    print(u'═ VIRGULES — %d phrases held-out (réf. table ponct-lm : F1 0,21)' % len(cas))
    print(u'  τ       P        R        F1')
    for t in TAUS:
        p = tp[t] / max(tp[t] + fp[t], 1); r = tp[t] / max(tp[t] + fn[t], 1)
        f1 = 2 * p * r / max(p + r, 1e-9)
        print(u'  %.3f   %5.1f %%  %5.1f %%  %5.3f' % (t, 100 * p, 100 * r, f1))

    # ── POINTS (jonction de phrases, façon flux vocal : ni point ni majuscule) ─
    tp = {t: 0 for t in TAUS}; fp = {t: 0 for t in TAUS}; fn = {t: 0 for t in TAUS}
    npairs = 0
    for k in range(0, len(corpus) - 1, 2):
        if npairs >= n_pts: break
        a, b = corpus[k].rstrip(u'.!? '), corpus[k + 1]
        if len(a) + len(b) > 330 or len(a) < 15 or len(b) < 15: continue
        fusion = a + u' ' + b[:1].lower() + b[1:]
        mots = [(mm.group(0), mm.start(), mm.end()) for mm in MOT.finditer(fusion)]
        if len(mots) < 6: continue
        jonc = None
        for i, (_w, _a2, e) in enumerate(mots[:-1]):
            if e == len(a): jonc = i; break
        if jonc is None: continue
        npairs += 1
        variants = [fusion[:e] + u'.' + fusion[e:e + 1] + fusion[e + 1:e + 2].upper() + fusion[e + 2:] for (_w, _a2, e) in mots[:-1]]
        sc = scores_lot([fusion] + variants)
        base = sc[0]
        for i, sv in enumerate(sc[1:]):
            d = sv - base
            for t in TAUS:
                pred = d > t
                if pred and i == jonc: tp[t] += 1
                elif pred: fp[t] += 1
                elif i == jonc: fn[t] += 1
    print(u'\n═ POINTS — %d jonctions held-out (flux vocal : ni point ni majuscule)' % npairs)
    print(u'  τ       P        R        F1')
    for t in TAUS:
        p = tp[t] / max(tp[t] + fp[t], 1); r = tp[t] / max(tp[t] + fn[t], 1)
        f1 = 2 * p * r / max(p + r, 1e-9)
        print(u'  %.3f   %5.1f %%  %5.1f %%  %5.3f' % (t, 100 * p, 100 * r, f1))

if __name__ == '__main__':
    main()
