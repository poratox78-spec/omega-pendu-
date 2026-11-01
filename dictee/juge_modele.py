# -*- coding: utf-8 -*-
u"""Le juge léger (liste n° 332) : lit toute la phrase d'un coup (gauche ET droite) et note, pour chaque mot, l'écrit et ses candidats.
Il ne fabrique aucun mot. Morceaux de mots hachés au lieu d'un dictionnaire : pas de table de mots à livrer, et une faute voisine ne l'aveugle pas.
Deux têtes sur le même encodeur : le choix du mot, et l'espace après chaque mot (rien, virgule, point, question).
La version navigateur vit dans dys-core.js (_jgMoteur) ; dictee/juge_probe.js garde leur parité."""
import math, os, re
import torch, torch.nn as nn, torch.nn.functional as FN
TOK = re.compile(r"[A-Za-zÀ-ÿœŒ'’ʼ]+|\d+|[^\sA-Za-zÀ-ÿœŒ'’ʼ\d]")
NG = 14
def fnv(s, B):
    h = 2166136261
    for ch in s:
        h = ((h ^ ord(ch)) * 16777619) & 0xffffffff
    return 1 + h % (B - 1)
def morceaux(w, B):
    w = w.lower().replace('’', "'").replace('ʼ', "'"); m = '<' + w + '>'; out = [m]
    for k in (1, 2, 3, 4):
        if len(w) > k: out.append(w[-k:] + '>')
    for k in (1, 2, 3):
        if len(w) > k: out.append('<' + w[:k])
    for i in range(1, len(w) - 2):
        out.append(w[i:i + 3])
    return [fnv(x, B) for x in out[:NG]]
class Bloc(nn.Module):
    def __init__(s, dm, nh, ff):
        super().__init__()
        s.ln1 = nn.LayerNorm(dm); s.ln2 = nn.LayerNorm(dm)
        s.att = nn.MultiheadAttention(dm, nh, batch_first=True)
        s.ff = nn.Sequential(nn.Linear(dm, ff), nn.GELU(), nn.Linear(ff, dm))
    def forward(s, x, pad):
        h = s.ln1(x); a, _ = s.att(h, h, h, key_padding_mask=pad, need_weights=False)
        x = x + a
        return x + s.ff(s.ln2(x))
class Mini(nn.Module):
    def __init__(s, cfg):
        super().__init__()
        s.cfg = cfg; B, de, dm, nl, nh, ff, dp = cfg['B'], cfg['DE'], cfg['DM'], cfg['NL'], cfg['NH'], cfg['FF'], cfg['DP']
        s.ng = nn.Embedding(B, de, padding_idx=0)
        s.ent = nn.Linear(de + 2, dm)
        s.pos = nn.Embedding(cfg['L'], dm)
        s.blocs = nn.ModuleList([Bloc(dm, nh, ff) for _ in range(nl)])
        s.lnf = nn.LayerNorm(dm)
        s.ph = nn.Linear(dm, dp); s.pc = nn.Linear(de, dp)
        s.tr = nn.Embedding(4, 6)   # distance
        s.mlp = nn.Sequential(nn.Linear(4 * dp + 6 + 6, 128), nn.GELU(), nn.Linear(128, 1))
        if cfg.get('PT'): s.pt = nn.Sequential(nn.Linear(dm * 2, 96), nn.GELU(), nn.Linear(96, 4))
    def ponct(s, h):   # chaque espace voit le mot d'avant et le mot d'après
        ap = torch.cat([h[:, 1:], torch.zeros_like(h[:, :1])], 1)
        return s.pt(torch.cat([h, ap], -1))
    def vec(s, ids):   # ids : ... x NG → ... x de (moyenne des morceaux)
        e = s.ng(ids); n = (ids > 0).float().sum(-1, keepdim=True).clamp(min=1)
        return e.sum(-2) / n
    def lire(s, ng, flags, pad):
        B, T = ng.shape[:2]
        x = s.ent(torch.cat([s.vec(ng), flags], -1)) + s.pos(torch.arange(T, device=ng.device))[None]
        for b in s.blocs: x = b(x, pad)
        return s.lnf(x)
    def noter(s, h, ew, ec, tr):
        # h : N x dm · ew : N x de · ec : N x C x de · tr : N x C x 6 (ph, son, dist, acc, freq, écrit)
        C = ec.shape[1]; hp = s.ph(h)[:, None].expand(-1, C, -1); wp = s.pc(ew)[:, None].expand(-1, C, -1); cp = s.pc(ec)
        d = s.tr(tr[..., 2].long())
        f = torch.stack([tr[..., 0], tr[..., 1], tr[..., 3], tr[..., 4] / 16, tr[..., 5], (hp * cp).sum(-1) / 8], -1)
        return s.mlp(torch.cat([hp, cp, wp, hp * cp, d, f], -1)).squeeze(-1)
def lexique():
    import gzip
    R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    F = {}
    for l in gzip.open(R + '/extension/assets/speller.tsv.gz', 'rt', encoding='utf-8'):
        p = l.split('\t')
        if len(p) >= 2:
            try: f = float(p[1])
            except ValueError: continue
            if f >= 1: F[p[0]] = f
    return F
def connu(F, w):
    return 1.0 if (w in F or w.split("'")[-1] in F) else 0.0
def freq(F, w):
    return float(round(math.log2(1 + F.get(w.split("'")[-1], 0))))
def taille(m):
    return sum(p.numel() for p in m.parameters())
