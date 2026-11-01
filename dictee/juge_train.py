# -*- coding: utf-8 -*-
u"""Entraîne le juge léger sur le corpus PUBLIC fauté (dictee/juge_gen.js), jamais sur le corpus dys privé qui ne sert qu'à le mesurer.
Deux tâches sur le même encodeur : choisir le mot + lire l'espace après chaque mot (rien, virgule, point, question). ~20 min sur une RTX 3060.
  python dictee/juge_train.py <train.jsonl> <memo.json> <sortie.pt> '{}' 4"""
import io, json, math, random, sys, time
import numpy as np, torch, torch.nn.functional as FN
from juge_modele import Mini, morceaux, NG, taille, lexique, connu, freq
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
TR, ME, OUT, CFG, EP = sys.argv[1:6]; cfg = dict({'B': 32768, 'DE': 64, 'DM': 160, 'NL': 4, 'NH': 4, 'FF': 320, 'DP': 64, 'L': 80, 'PT': 1}, **json.loads(CFG)); EP = int(EP)
dev = 'cuda'; t0 = time.time(); CMAX = 17
memo = json.load(io.open(ME, encoding='utf-8')); FQ = lexique()
V = {'<pad>': 0}
def vid(w):
    k = V.get(w)
    if k is None: k = V[w] = len(V)
    return k
for w, c in memo.items():
    vid(w)
    for x in c[1:]: vid(x[0])
CLS = {',': 1, '.': 2, '!': 2, '…': 2, '?': 3}; PCL = {vid(k): v for k, v in CLS.items()}
low = lambda s: s.lower().replace('’', "'").replace('ʼ', "'")
X = []; Y = []; MJ = []
for l in io.open(TR, encoding='utf-8'):
    a, b = json.loads(l)
    if len(a) < 4: continue
    a = a[:cfg['L']]; b = b[:cfg['L']]
    X.append(np.array([vid(low(w)) for w in a], dtype=np.int32)); Y.append(np.array([vid(w) for w in b], dtype=np.int32)); MJ.append(np.array([1 if w[0].isupper() else 0 for w in a], dtype=np.int8))
print('phrases', len(X), 'vocab', len(V), '%.0f s' % (time.time() - t0), flush=True)
nV = len(V); inv = [None] * nV
for w, k in V.items(): inv[k] = w
NGm = np.zeros((nV, NG), dtype=np.int32); KO = np.zeros(nV, dtype=np.float32); CA = np.zeros((nV, CMAX), dtype=np.int32); CN = np.zeros(nV, dtype=np.int8); TRa = np.zeros((nV, CMAX, 6), dtype=np.float32)
for k in range(1, nV):
    m = morceaux(inv[k], cfg['B']); NGm[k, :len(m)] = m; KO[k] = connu(FQ, inv[k])
for w, c in memo.items():
    k = V[w]; CA[k, 0] = k; TRa[k, 0] = [1, 1, 0, 1, freq(FQ, w), 1]; n = 1
    for x in c[1:CMAX]:
        CA[k, n] = V[x[0]]; TRa[k, n] = [x[1], x[2], x[3], x[4], x[5], 0]; n += 1
    CN[k] = n
NGt = torch.from_numpy(NGm).long().to(dev); KOt = torch.from_numpy(KO).to(dev); CAt = torch.from_numpy(CA).long().to(dev); CNt = torch.from_numpy(CN).long().to(dev); TRt = torch.from_numpy(TRa).to(dev)
print('tables %.0f s' % (time.time() - t0), flush=True)
random.seed(1); idx = list(range(len(X))); random.shuffle(idx); DEV = idx[:6000]; TRN = idx[6000:]
m = Mini(cfg).to(dev); print('paramètres', taille(m), flush=True)
opt = torch.optim.AdamW(m.parameters(), lr=1e-3, weight_decay=0.01); BS = 96; steps = EP * (len(TRN) // BS); pas = 0
def lr(p): return min(1, p / 500) * (0.05 + 0.95 * 0.5 * (1 + math.cos(math.pi * p / steps)))
def suite(i, colle):
    # Plusieurs phrases à la suite, jusqu'à la taille d'un long texte : les textes réels finissent souvent sans ponctuation.
    if random.random() >= colle: return ()
    cible = random.randint(12, 64); js = []; n = len(X[i])
    while n < cible and len(js) < 9:
        j = TRN[random.randrange(len(TRN))]; js.append(j); n += len(X[j])
    return js
def prepare(i, js=()):
    # Ponctuation retirée selon le tirage ; l'étiquette va sur le mot d'avant. -100 : signe laissé (rien à deviner).
    ax = X[i]; ay = Y[i]; am = MJ[i]
    for j in js:
        ax = np.concatenate([ax, X[j]]); ay = np.concatenate([ay, Y[j]]); bm = MJ[j].copy(); bm[0] = 0 if random.random() < 0.5 else bm[0]; am = np.concatenate([am, bm])
    r = random.random(); tire = 0 if r < 0.2 else (1 if r < 0.45 else (2 if r < 0.8 else 3))   # 0 : tout laisser · 1 : virgules retirées · 2 : tout retirer · 3 : seul le dernier signe reste
    ax_ = ax.tolist(); der = max((k for k, a in enumerate(ax_) if a in PCL), default=-1)
    x = []; y = []; mj = []; e = []
    for k, (a, b, c) in enumerate(zip(ax_, ay.tolist(), am.tolist())):
        cl = PCL.get(a)
        if cl is not None:
            if e:
                if tire == 2 or (tire == 1 and cl == 1) or (tire == 3 and k != der): e[-1] = max(e[-1], cl); continue
                e[-1] = -100
            x.append(a); y.append(b); mj.append(c); e.append(0)
        else:
            x.append(a); y.append(b); mj.append(c); e.append(0)
    return x[:cfg['L']], y[:cfg['L']], mj[:cfg['L']], e[:cfg['L']]
def lot(ids, colle=0.5):
    P = [prepare(i, suite(i, colle)) for i in ids]
    T = max(len(p[0]) for p in P); n = len(P)
    x = torch.zeros((n, T), dtype=torch.long); y = torch.zeros((n, T), dtype=torch.long); mj = torch.zeros((n, T)); e = torch.full((n, T), -100, dtype=torch.long)
    for a, p in enumerate(P):
        k = len(p[0]); x[a, :k] = torch.tensor(p[0]); y[a, :k] = torch.tensor(p[1]); mj[a, :k] = torch.tensor(p[2], dtype=torch.float); e[a, :k] = torch.tensor(p[3])
    return x.to(dev), y.to(dev), mj.to(dev), e.to(dev)
POIDS = torch.tensor([1.0, 2.0, 3.0, 6.0], device=dev)
def perte(x, y, mj, e):
    pad = x == 0
    with torch.autocast('cuda', dtype=torch.float16):
        h = m.lire(NGt[x], torch.stack([KOt[x], mj], -1), pad)
        k = CNt[x] > 1
        cmat = CAt[x[k]]; good = (cmat == y[k].unsqueeze(1)); pos = good.any(1)
        cm = cmat[pos]; tgt = good[pos].float().argmax(1)
        uq, inv_ = torch.unique(cm, return_inverse=True); ec = m.vec(NGt[uq])[inv_]
        ew = m.vec(NGt[x[k][pos]]); sc = m.noter(h[k][pos], ew, ec, TRt[x[k][pos]])
        sc = sc.float().masked_fill(cm == 0, -1e4)
        l = FN.cross_entropy(sc, tgt, reduction='none'); w = torch.where(tgt == 0, torch.tensor(1.0, device=dev), torch.tensor(3.0, device=dev))
        lc = (l * w).sum() / w.sum()
        lg = m.ponct(h).float().reshape(-1, 4); lp = FN.cross_entropy(lg, e.reshape(-1), weight=POIDS, ignore_index=-100)
    return lc + 0.5 * lp, sc.detach(), tgt, lc.detach(), lp.detach()
scaler = torch.amp.GradScaler('cuda')
for ep in range(EP):
    random.shuffle(TRN); m.train()
    for b in range(0, len(TRN) - BS, BS):
        ids = sorted(TRN[b:b + BS], key=lambda i: len(X[i])); x, y, mj, e = lot(ids); r = perte(x, y, mj, e)
        for g in opt.param_groups: g['lr'] = 1e-3 * lr(pas)
        opt.zero_grad(set_to_none=True); scaler.scale(r[0]).backward(); scaler.unscale_(opt); torch.nn.utils.clip_grad_norm_(m.parameters(), 1.0); scaler.step(opt); scaler.update(); pas += 1
        if pas % 1000 == 0: print('pas', pas, '/', steps, 'choix %.4f ponct %.4f' % (r[3].item(), r[4].item()), '%.0f s' % (time.time() - t0), flush=True)
    m.eval(); ok = {'garde': [0, 0], 'faute': [0, 0]}
    with torch.no_grad():
        for b in range(0, len(DEV), BS):
            ids = sorted(DEV[b:b + BS], key=lambda i: len(X[i])); x, y, mj, e = lot(ids, 0); r = perte(x, y, mj, e); sc, tgt = r[1], r[2]; pr = sc.argmax(1)
            for nom, ma in (('garde', tgt == 0), ('faute', tgt != 0)):
                ok[nom][0] += (pr[ma] == tgt[ma]).sum().item(); ok[nom][1] += ma.sum().item()
    print('époque', ep, 'dev garde %.4f faute %.4f' % (ok['garde'][0] / max(1, ok['garde'][1]), ok['faute'][0] / max(1, ok['faute'][1])), '%.0f s' % (time.time() - t0), flush=True)
    torch.save({'cfg': cfg, 'model': {k: v.cpu() for k, v in m.state_dict().items()}}, OUT)
print('fini', flush=True)
