# -*- coding: utf-8 -*-
u"""B2 — ROTATION CONTRASTIVE (la boucle de Rem, marche 2 : le squelette enseigne au mou).
Le générateur calibré (dys_gen) fabrique des paires (gold, fauté) à partir du corpus brut ;
le petit modèle apprend logP(gold) > logP(fauté) (marge) SANS oublier la langue (mix perte LM).
Cible mesurée : les faiblesses de la marche 1 = fatigue on/ont (70 %) et accords à distance.
  python dictee/b2_contrast.py [steps]   → data_local/b2_model_ct.pt + éval bancs intégrée."""
import os, sys, io, random

import torch
import torch.nn.functional as F

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from b2_train import CharT
import dys_gen

TRAIN = os.path.join(ROOT, 'data_local', 'b2_train.txt')
IN = os.path.join(ROOT, 'data_local', 'b2_model.pt')
OUT = os.path.join(ROOT, 'data_local', 'b2_model_ct.pt')
BATCH, LR, MARGE, LAMB_LM = 16, 5e-5, 0.08, 0.5

def main():
    steps = int(sys.argv[1]) if len(sys.argv) > 1 else 4000
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    ck = torch.load(IN, map_location='cpu', weights_only=False)
    chars = ck['chars']; v2i = {c: i for i, c in enumerate(chars)}
    CTX = ck['cfg']['CTX']
    m = CharT(len(chars), ck['cfg']).to(dev); m.load_state_dict(ck['model']); m.train()
    opt = torch.optim.AdamW(m.parameters(), lr=LR, weight_decay=0.01)

    lex = dys_gen.charge_lex()
    rng = random.Random(20260821)
    phrases = [l for l in io.open(TRAIN, encoding='utf-8').read().split('\n') if 30 < len(l) < 220]
    rng.shuffle(phrases)
    print('contrastif : %d phrases source · device %s' % (len(phrases), dev))

    def enc(s):
        ids = [v2i.get(c, 0) for c in s][:CTX]
        return ids

    def lot(k0):
        gold, faux = [], []
        k = k0
        while len(gold) < BATCH:
            s = phrases[k % len(phrases)]; k += 1
            f, n = dys_gen.genere(s, rng, lex)
            if n < 1 or f == s: continue
            gold.append(enc(s)); faux.append(enc(f))
        L = max(max(len(x) for x in gold), max(len(x) for x in faux))
        def pad(seqs):
            t = torch.zeros(len(seqs), L, dtype=torch.long)
            msk = torch.zeros(len(seqs), L)
            for i, x in enumerate(seqs):
                t[i, :len(x)] = torch.tensor(x); msk[i, 1:len(x)] = 1
            return t.to(dev), msk.to(dev)
        return pad(gold), pad(faux), k

    def scores(t, msk):
        lg = m(t)[:, :-1]
        lp = F.log_softmax(lg.float(), -1)
        tok = lp.gather(2, t[:, 1:, None])[:, :, 0] * msk[:, 1:]
        return tok.sum(1) / msk[:, 1:].sum(1).clamp(min=1), lg

    k = 0
    import time; t0 = time.time()
    for it in range(1, steps + 1):
        (g, gm), (f, fm), k = lot(k)
        sg, lg_g = scores(g, gm)
        sf, _ = scores(f, fm)
        perte_marge = F.relu(MARGE - (sg - sf)).mean()
        cible = g[:, 1:]
        perte_lm = F.cross_entropy(lg_g.transpose(1, 2), cible, reduction='none')
        perte_lm = (perte_lm * gm[:, 1:]).sum() / gm[:, 1:].sum().clamp(min=1)
        perte = perte_marge + LAMB_LM * perte_lm
        opt.zero_grad(set_to_none=True); perte.backward(); opt.step()
        if it % 500 == 0 or it == steps:
            viol = (sg <= sf).float().mean().item()
            print('step %5d · marge %.4f · lm %.3f · paires inversées %.0f %% · %.0f s'
                  % (it, perte_marge.item(), perte_lm.item(), 100 * viol, time.time() - t0))
    torch.save({'model': m.state_dict(), 'chars': chars, 'cfg': ck['cfg']}, OUT)
    print('sauvé : %s' % OUT)

    # ── ÉVAL bancs (mêmes juges externes) ──
    m.eval()
    import llm_juge_probe as J
    B = J.bancs()
    def score1(s):
        ids = enc(s)
        if len(ids) < 3: return -99.0
        t = torch.tensor([ids], device=dev)
        with torch.no_grad():
            lg = m(t)[0, :-1]
            lp = F.log_softmax(lg.float(), -1)
            return lp.gather(1, t[0, 1:, None]).mean().item()
    J.evalue(u'VOIE B2+CONTRASTIF (~5 M maison, boucle complète)', score1, B)

if __name__ == '__main__':
    main()
