# -*- coding: utf-8 -*-
u"""Références de parité Python → navigateur du juge léger, phrases inventées. python dictee/juge_refs.py <modele_quant.pt> dictee/juge_refs.json"""
import io, json, sys
import torch
from juge_modele import Mini, TOK, morceaux, NG, lexique, connu, freq
ck = torch.load(sys.argv[1], map_location='cpu', weights_only=False); cfg = ck['cfg']
m = Mini(cfg); m.load_state_dict(ck['model']); m.eval(); FQ = lexique()
P = ["Le chat de ma voisine dort sur le toit.", "Il a manger une pomme, puis elle part.", "Nous avons parlé avec eux hier soir", "Ces bateaux rouges sont arrivés au port ce matin.", "Elle se demande si son frère viendra."]
low = lambda s: s.lower().replace('’', "'").replace('ʼ', "'")
out = []
with torch.no_grad():
    for s in P:
        t = TOK.findall(s); T = len(t); ids = []
        for w in t:
            a = morceaux(low(w), cfg['B']); ids.append(a + [0] * (NG - len(a)))
        x = torch.tensor([ids]); fl = torch.tensor([[[connu(FQ, low(w)), 1.0 if w[0].isupper() else 0.0] for w in t]])
        h = m.lire(x, fl, torch.zeros((1, T), dtype=torch.bool))
        for i in range(T):
            cs = [low(t[i]), 'mange', 'les', 'manger', 'bateau']; n = len(cs); tr = [[1, 1, 0, 1, freq(FQ, low(t[i])), 1.0]] + [[1, 0, 2, 0, freq(FQ, c), 0.0] for c in cs[1:]]
            ec = torch.tensor([[morceaux(c, cfg['B']) + [0] * (NG - len(morceaux(c, cfg['B']))) for c in cs]])
            ew = torch.tensor([ids[i]])
            sc = m.noter(h[:, i], m.vec(ew), m.vec(ec), torch.tensor([tr]))[0].tolist()
            out.append({'s': s, 'i': i, 'c': cs, 'tr': tr, 'sc': sc, 't': t, 'fl': fl[0].tolist()})
json.dump(out, io.open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False)
print('références', len(out))
