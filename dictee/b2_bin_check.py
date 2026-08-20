# -*- coding: utf-8 -*-
u"""Contrôle différentiel du FICHIER b2_web.bin : on le relit EXACTEMENT comme le JS (en-tête,
offsets, int8+échelles) et on recharge CharT avec — si les scores collent aux réfs, le fichier
est bon et tout écart navigateur vient du moteur WGSL ; sinon l'export est faux."""
import os, sys, json, struct

import numpy as np
import torch

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from b2_train import CharT

bin_ = open(os.path.join(ROOT, 'data_local', 'b2_web.bin'), 'rb').read()
hlen = struct.unpack('<I', bin_[:4])[0]
head = json.loads(bin_[4:4 + hlen].decode('utf-8'))
base = (4 + hlen + 3) & ~3
cfg = head['cfg']; chars = head['chars']

arrs = {}
for t in head['tenseurs']:
    n = 1
    for d in t['shape']: n *= d
    off = base + t['off']
    if t['dtype'] == 'i8':
        arrs[t['name']] = np.frombuffer(bin_, dtype=np.int8, count=n, offset=off).reshape(t['shape']).astype(np.float32)
    else:
        arrs[t['name']] = np.frombuffer(bin_, dtype='<f4', count=n, offset=off).reshape(t['shape']).copy()

sd = {}
for name, a in arrs.items():
    if name.endswith('.scale'): continue
    if name + '.scale' in arrs:
        a = a * arrs[name + '.scale'][:, None]
    sd[name] = torch.tensor(a)
sd['tete.weight'] = sd['emb.weight']
m = CharT(len(chars), cfg); m.load_state_dict(sd); m.eval()

import torch.nn.functional as F
v2i = {c: i for i, c in enumerate(chars)}
refs = json.load(open(os.path.join(ROOT, 'data_local', 'b2_web_refs.json'), encoding='utf-8'))
pire = 0.0
for r in refs:
    ids = [v2i.get(c, 0) for c in r['s']][:cfg['CTX']]
    t = torch.tensor([ids])
    with torch.no_grad():
        lp = F.log_softmax(m(t)[0, :-1].float(), -1)
        sc = lp.gather(1, t[0, 1:, None]).mean().item()
    d = abs(sc - r['score']); pire = max(pire, d)
    print(u'  |Δ|=%.6f  bin %.4f  ref %.4f  « %s »' % (d, sc, r['score'], r['s'][:55]))
print(u'pire écart : %.6f → %s' % (pire, u'FICHIER BON (bug côté WGSL/JS)' if pire < 1e-4 else u'EXPORT FAUX'))
