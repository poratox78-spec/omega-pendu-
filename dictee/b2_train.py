# -*- coding: utf-8 -*-
u"""B2 — entraînement du PETIT modèle maison (la boucle de Rem, marche 1 : la LANGUE sur le brut).
Char-transformer, GPU (RTX 3060 6 Go). Objectif LM causal sur b2_train.txt (630k phrases,
100 Mchars — même source que ponct-lm, held-out fp_scale exclu).
  python dictee/b2_train.py [steps]     → data_local/b2_model.pt (+ vocab intégré)
Gabarit par variables d'env : B2_CTX B2_DM B2_NL B2_NH B2_FF B2_BATCH B2_OUT
  défaut  = 4,8 M (256d×6L, ctx 256)
  « gros » = B2_CTX=384 B2_DM=384 B2_NL=8 B2_FF=1536 B2_BATCH=64  (~14 M, accords à distance)
La barre à viser (sonde PR#514) : gpt-fr-124M fait REEL 100 · GEN 100 · PIEGE 92 · FATIGUE 94."""
import os, sys, io, json, math, time, random

import torch
import torch.nn as nn
import torch.nn.functional as F

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TRAIN = os.path.join(ROOT, 'data_local', 'b2_train.txt')
DEV = os.path.join(ROOT, 'data_local', 'b2_dev.txt')
OUT = os.environ.get('B2_OUT', os.path.join(ROOT, 'data_local', 'b2_model.pt'))

CTX = int(os.environ.get('B2_CTX', '256'))
DM = int(os.environ.get('B2_DM', '256'))
NL = int(os.environ.get('B2_NL', '6'))
NH = int(os.environ.get('B2_NH', '8'))
FF = int(os.environ.get('B2_FF', '1024'))
BATCH = int(os.environ.get('B2_BATCH', '96'))
LR, WARM = 3e-4, 300

class Bloc(nn.Module):
    def __init__(self, dm, nh, ff):
        super().__init__()
        self.ln1 = nn.LayerNorm(dm); self.ln2 = nn.LayerNorm(dm)
        self.att = nn.MultiheadAttention(dm, nh, batch_first=True)
        self.ff = nn.Sequential(nn.Linear(dm, ff), nn.GELU(), nn.Linear(ff, dm))
    def forward(self, x, mask):
        h = self.ln1(x)
        a, _ = self.att(h, h, h, attn_mask=mask, need_weights=False)
        x = x + a
        return x + self.ff(self.ln2(x))

class CharT(nn.Module):
    def __init__(self, V, cfg):
        super().__init__()
        self.cfg = cfg
        dm = cfg['DM']
        self.emb = nn.Embedding(V, dm)
        self.pos = nn.Embedding(cfg['CTX'], dm)
        self.blocs = nn.ModuleList([Bloc(dm, cfg['NH'], cfg['FF']) for _ in range(cfg['NL'])])
        self.lnf = nn.LayerNorm(dm)
        self.tete = nn.Linear(dm, V, bias=False)
        self.tete.weight = self.emb.weight
    def forward(self, ids):
        B, T = ids.shape
        x = self.emb(ids) + self.pos(torch.arange(T, device=ids.device))[None]
        mask = torch.triu(torch.full((T, T), float('-inf'), device=ids.device), 1)
        for b in self.blocs: x = b(x, mask)
        return self.tete(self.lnf(x))

def main():
    steps = int(sys.argv[1]) if len(sys.argv) > 1 else 9000
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    txt = io.open(TRAIN, encoding='utf-8').read().replace('\n', '\x03')
    from collections import Counter
    cc = Counter(txt)
    chars = ['\x00', '\x01'] + sorted([c for c, n in cc.items() if n >= 20])   # 0=<unk> 1=<bos>
    v2i = {c: i for i, c in enumerate(chars)}
    print('vocab %d · corpus %.1f Mchars · device %s' % (len(chars), len(txt) / 1e6, dev))
    data = torch.tensor([v2i.get(c, 0) for c in txt], dtype=torch.int16)
    dtxt = io.open(DEV, encoding='utf-8').read().replace('\n', '\x03')[:200000]
    ddata = torch.tensor([v2i.get(c, 0) for c in dtxt], dtype=torch.int16)

    cfg = {'CTX': CTX, 'DM': DM, 'NL': NL, 'NH': NH, 'FF': FF}
    torch.manual_seed(20260821)
    m = CharT(len(chars), cfg).to(dev)
    npar = sum(p.numel() for p in m.parameters())
    print('paramètres : %.2f M · cfg %s' % (npar / 1e6, json.dumps(cfg)))
    opt = torch.optim.AdamW(m.parameters(), lr=LR, weight_decay=0.01)
    scaler = torch.amp.GradScaler(dev, enabled=(dev == 'cuda'))

    def lot(src):
        ix = torch.randint(0, len(src) - CTX - 1, (BATCH,))
        x = torch.stack([src[i:i + CTX].long() for i in ix]).to(dev)
        y = torch.stack([src[i + 1:i + CTX + 1].long() for i in ix]).to(dev)
        return x, y

    t0 = time.time()
    for it in range(1, steps + 1):
        lr = LR * min(1.0, it / WARM) * (0.5 * (1 + math.cos(math.pi * it / steps)) * 0.9 + 0.1)
        for g in opt.param_groups: g['lr'] = lr
        x, y = lot(data)
        with torch.amp.autocast(dev, enabled=(dev == 'cuda')):
            loss = F.cross_entropy(m(x).transpose(1, 2), y)
        opt.zero_grad(set_to_none=True)
        scaler.scale(loss).backward()
        scaler.step(opt); scaler.update()
        if it % 500 == 0 or it == steps:
            m.eval()
            with torch.no_grad(), torch.amp.autocast(dev, enabled=(dev == 'cuda')):
                dx, dy = lot(ddata)
                dl = F.cross_entropy(m(dx).transpose(1, 2), dy).item()
            m.train()
            print('step %5d · train %.3f · dev %.3f · %.0f s' % (it, loss.item(), dl, time.time() - t0))
        if it % 5000 == 0 and it < steps:            # checkpoint périodique (runs longs)
            torch.save({'model': m.state_dict(), 'chars': chars, 'cfg': cfg}, OUT)
    torch.save({'model': m.state_dict(), 'chars': chars, 'cfg': cfg}, OUT)
    print('sauvé : %s (%.1f Mo)' % (OUT, os.path.getsize(OUT) / 1e6))

if __name__ == '__main__':
    main()
