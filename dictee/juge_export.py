# -*- coding: utf-8 -*-
u"""Exporte le juge léger au format int8, une échelle par table, pour extension/assets/juge-mini.bin et app/juge-mini.bin.
  python dictee/juge_export.py <modele.pt> <sortie.bin> [sortie_quant.pt]"""
import gzip, io, json, struct, sys
import numpy as np, torch
ck = torch.load(sys.argv[1], map_location='cpu', weights_only=False); cfg = ck['cfg']; sd = ck['model']; t = []; data = []; q = {}
for k, v in sd.items():
    a = v.numpy().astype(np.float32); s = float(np.abs(a).max()) / 127 or 1.0; i = np.clip(np.round(a / s), -127, 127).astype(np.int8)
    t.append([k, list(a.shape), s]); data.append(i.tobytes()); q[k] = torch.from_numpy(i.astype(np.float32) * s)
h = json.dumps({'cfg': cfg, 't': t}, separators=(',', ':')).encode('utf-8')
b = b'OJM1' + struct.pack('<I', len(h)) + h + b''.join(data)
open(sys.argv[2], 'wb').write(b)
print('octets', len(b), 'compressé gzip', len(gzip.compress(b, 9)), 'tables', len(t))
if len(sys.argv) > 3: torch.save({'cfg': cfg, 'model': q}, sys.argv[3])
