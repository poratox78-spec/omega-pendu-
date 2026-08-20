# -*- coding: utf-8 -*-
u"""B2 → NAVIGATEUR, étape 1 : export des poids en INT8 (par ligne, échelle f32) + en-tête JSON.
Un fichier data_local/b2_web.bin (~15 Mo, sous la limite Cloudflare Pages de 25 Mo/fichier) :
  [u32 longueur JSON][JSON: cfg, chars, tenseurs {name, shape, dtype, off}][données alignées 4]
int8 : poids des matmuls et embeddings (échelle par LIGNE de sortie) ; f32 : biais et LayerNorm.
--check : recharge les poids DÉQUANTIFIÉS dans le modèle Python et rejoue les 4 bancs — la
compression doit préserver les verdicts (100/100/92/86) AVANT d'écrire une ligne de WGSL.
  python dictee/b2_export_web.py [modele.pt] [--check]"""
import os, sys, json, struct

import torch

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from b2_train import CharT

OUT = os.path.join(ROOT, 'data_local', 'b2_web.bin')
F32 = {'lnf.weight', 'lnf.bias', 'pos.weight'}          # petits ou sensibles → f32 (pos: 590 Ko)

def est_f32(name):
    return name in F32 or '.ln' in name or 'bias' in name

def main():
    fmod = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else 'b2_model_14m.pt'
    check = '--check' in sys.argv
    ck = torch.load(os.path.join(ROOT, 'data_local', fmod), map_location='cpu', weights_only=False)
    sd = {k: v.float() for k, v in ck['model'].items()}
    sd.pop('tete.weight', None)                          # lié à emb.weight — exporté une fois

    tenseurs, blobs, off = [], [], 0
    def push(name, arr, dtype):
        nonlocal off
        b = arr.tobytes()
        tenseurs.append({'name': name, 'shape': list(arr.shape) if arr.ndim else [1], 'dtype': dtype, 'off': off})
        blobs.append(b); off += len(b) + (-len(b)) % 4
    deq = {}
    for name, w in sd.items():
        if est_f32(name) or w.ndim < 2:
            push(name, w.numpy().astype('float32'), 'f32')
            deq[name] = w
        else:
            sc = w.abs().amax(dim=1, keepdim=True).clamp(min=1e-8) / 127.0
            q = torch.round(w / sc).clamp(-127, 127).to(torch.int8)
            push(name, q.numpy(), 'i8')
            push(name + '.scale', sc[:, 0].numpy().astype('float32'), 'f32')
            deq[name] = q.float() * sc

    head = json.dumps({'cfg': ck['cfg'], 'chars': ck['chars'], 'tenseurs': tenseurs},
                      ensure_ascii=False).encode('utf-8')
    with open(OUT, 'wb') as f:
        f.write(struct.pack('<I', len(head))); f.write(head)
        pad = (-4 - len(head)) % 4
        f.write(b'\x00' * pad)
        for b in blobs:
            f.write(b); f.write(b'\x00' * ((-len(b)) % 4))
    print(u'écrit : %s (%.1f Mo) · %d tenseurs · cfg %s' % (OUT, os.path.getsize(OUT) / 1e6, len(tenseurs), json.dumps(ck['cfg'])))

    if check:
        deq['tete.weight'] = deq['emb.weight']
        m = CharT(len(ck['chars']), ck['cfg'])
        m.load_state_dict(deq); m.eval()
        dev = 'cuda' if torch.cuda.is_available() else 'cpu'
        m = m.to(dev)
        import torch.nn.functional as F
        import llm_juge_probe as J
        v2i = {c: i for i, c in enumerate(ck['chars'])}
        CTX = ck['cfg']['CTX']
        def score(s):
            ids = [v2i.get(c, 0) for c in s][:CTX]
            if len(ids) < 3: return -99.0
            t = torch.tensor([ids], device=dev)
            with torch.no_grad():
                lp = F.log_softmax(m(t)[0, :-1].float(), -1)
                return lp.gather(1, t[0, 1:, None]).mean().item()
        J.evalue(u'B2 INT8 déquantifié (contrôle avant portage)', score, J.bancs())
        # références de PARITÉ pour le navigateur : mêmes chaînes, scores attendus
        refs = [u"elle a grandi pendant la gerre . elle sais marier a l'age de vingt ans",
                u"elle a grandi pendant la gerre . elle s'est mariée a l'age de vingt ans",
                u"Elle sait marier les saveurs avec un talent rare.",
                u"Elle s'est marier les saveurs avec un talent rare.",
                u"Une fois emprisonné, Michael prépare son évasion.",
                u"Le sommet sur la biodiversité organisé en octobre a réuni cent pays.",
                u"Les enfants jouent dans la cour de l'école pendant la récréation."]
        B = J.bancs()                                       # + un échantillon des bancs (les 4 familles)
        for banc in ('REEL', 'PIEGE', 'FATIGUE'):
            for bonne, mauvaise in B[banc][:4]:
                refs.extend([bonne, mauvaise])
        rp = os.path.join(ROOT, 'data_local', 'b2_web_refs.json')
        json.dump([{'s': s, 'score': score(s)} for s in refs],
                  open(rp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(u'références de parité : %s (%d chaînes)' % (rp, len(refs)))

if __name__ == '__main__':
    main()
