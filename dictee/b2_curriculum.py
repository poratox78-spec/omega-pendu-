# -*- coding: utf-8 -*-
u"""B2 — CURRICULUM (la boucle de Rem, marche 3 : le squelette fabrique des paires DURES).
Verdict de la marche 2 (b2_contrast) : saturation immédiate — dys_gen ne produit que des fautes
LOCALES, toutes déjà maîtrisées par le LM. Ici on génère les familles où le MOU échoue encore :
  · ces↔ses, on↔ont, sait↔s'est (choix RÉFÉRENTIELS — les ratés de FATIGUE)
  · accord du participe/adjectif en -é à distance (é↔ée, és↔ées — les ratés de PIÈGES)
et on MINE : seules les paires que le modèle rate ou tient mal (marge < MARGE) passent au
gradient — le facile est jeté, le curriculum s'adapte au modèle à mesure qu'il apprend.
λ·LM sur le gold contre l'oubli. Éval bancs intégrée (juges EXTERNES, jamais la boucle).
  python dictee/b2_curriculum.py [steps] [in.pt] [out.pt]      (défaut 2000, b2_model.pt → b2_model_cu.pt)"""
import os, sys, io, re, random, time
from collections import Counter

import torch
import torch.nn.functional as F

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from b2_train import CharT

TRAIN = os.path.join(ROOT, 'data_local', 'b2_train.txt')
BATCH, POOL, LR, MARGE, LAMB_LM = 16, 64, 5e-5, 0.08, 0.3

# ── le générateur de niveau 2 : fautes RÉFÉRENTIELLES et d'accord à distance ──
PAIRES_MOTS = [
    ('ces>ses', re.compile(u'\\bces\\b'), u'ses'),
    ('ses>ces', re.compile(u'\\bses\\b'), u'ces'),
    ('ont>on', re.compile(u'\\bont\\b'), u'on'),
    ('on>ont', re.compile(u'\\bon\\b'), u'ont'),
    ('sait>sest', re.compile(u'\\bsait\\b'), u"s'est"),
    ('sest>sait', re.compile(u"\\bs'est\\b"), u'sait'),
]
RE_PP = re.compile(u"\\b[a-zà-ÿ]{2,}(ées|és|ée|é)\\b")
PP_SWAP = {u'é': u'ée', u'ée': u'é', u'és': u'ées', u'ées': u'és'}

def genere_dur(s, rng):
    u"""Une faute ciblée dans s → (fauté, famille) ou None."""
    cands = []
    for fam, rx, rep in PAIRES_MOTS:
        for mm in rx.finditer(s):
            cands.append((fam, mm.start(), mm.end(), rep))
    for mm in RE_PP.finditer(s):
        suf = mm.group(1)
        cands.append(('accord_e', mm.end() - len(suf), mm.end(), PP_SWAP[suf]))
    if not cands: return None
    fam, a, b, rep = rng.choice(cands)
    return s[:a] + rep + s[b:], fam

def main():
    steps = int(sys.argv[1]) if len(sys.argv) > 1 else 2000
    fin = sys.argv[2] if len(sys.argv) > 2 else 'b2_model.pt'
    fout = sys.argv[3] if len(sys.argv) > 3 else 'b2_model_cu.pt'
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    ck = torch.load(os.path.join(ROOT, 'data_local', fin), map_location='cpu', weights_only=False)
    chars = ck['chars']; v2i = {c: i for i, c in enumerate(chars)}
    CTX = ck['cfg']['CTX']
    m = CharT(len(chars), ck['cfg']).to(dev); m.load_state_dict(ck['model'])
    opt = torch.optim.AdamW(m.parameters(), lr=LR, weight_decay=0.01)

    rng = random.Random(20260821)
    phrases = [l for l in io.open(TRAIN, encoding='utf-8').read().split('\n') if 30 < len(l) < 220]
    rng.shuffle(phrases)
    print('curriculum : %d phrases source · %s → %s · device %s' % (len(phrases), fin, fout, dev))

    def enc(s):
        return [v2i.get(c, 0) for c in s][:CTX]

    def pad(seqs):
        L = max(len(x) for x in seqs)
        t = torch.zeros(len(seqs), L, dtype=torch.long)
        msk = torch.zeros(len(seqs), L)
        for i, x in enumerate(seqs):
            t[i, :len(x)] = torch.tensor(x); msk[i, 1:len(x)] = 1
        return t.to(dev), msk.to(dev)

    def scores(t, msk):
        lg = m(t)[:, :-1]
        lp = F.log_softmax(lg.float(), -1)
        tok = lp.gather(2, t[:, 1:, None])[:, :, 0] * msk[:, 1:]
        return tok.sum(1) / msk[:, 1:].sum(1).clamp(min=1), lg

    vus = Counter(); durs = Counter()
    buf = []                                     # paires minées en attente de gradient
    k = 0; it = 0; t0 = time.time()
    m.eval()
    while it < steps:
        # 1) générer un pool, 2) MINER au score courant (sans gradient)
        pool = []
        while len(pool) < POOL:
            s = phrases[k % len(phrases)]; k += 1
            r = genere_dur(s, rng)
            if r is None or r[0] == s: continue
            pool.append((enc(s), enc(r[0]), r[1]))
        with torch.no_grad():
            g, gm = pad([p[0] for p in pool]); f, fm = pad([p[1] for p in pool])
            sg, _ = scores(g, gm); sf, _ = scores(f, fm)
            d = (sg - sf).tolist()
        for p, dv in zip(pool, d):
            vus[p[2]] += 1
            if dv < MARGE:
                durs[p[2]] += 1; buf.append(p)
        # 3) pas de gradient sur les paires DURES uniquement
        while len(buf) >= BATCH and it < steps:
            lot, buf = buf[:BATCH], buf[BATCH:]
            m.train()
            g, gm = pad([p[0] for p in lot]); f, fm = pad([p[1] for p in lot])
            sg, lg_g = scores(g, gm)
            sf, _ = scores(f, fm)
            perte_marge = F.relu(MARGE - (sg - sf)).mean()
            perte_lm = F.cross_entropy(lg_g.transpose(1, 2), g[:, 1:], reduction='none')
            perte_lm = (perte_lm * gm[:, 1:]).sum() / gm[:, 1:].sum().clamp(min=1)
            (perte_marge + LAMB_LM * perte_lm).backward()
            opt.step(); opt.zero_grad(set_to_none=True)
            m.eval()
            it += 1
            if it % 200 == 0 or it == steps:
                tot_v = sum(vus.values()); tot_d = sum(durs.values())
                fams = ' '.join('%s %d/%d' % (f_, durs[f_], vus[f_]) for f_, _ in durs.most_common(4))
                print('step %5d · marge %.4f · lm %.3f · dur %d/%d (%.0f %%) · %s · %.0f s'
                      % (it, perte_marge.item(), perte_lm.item(), tot_d, tot_v,
                         100.0 * tot_d / max(tot_v, 1), fams, time.time() - t0))
    torch.save({'model': m.state_dict(), 'chars': chars, 'cfg': ck['cfg']}, os.path.join(ROOT, 'data_local', fout))
    print(u'sauvé : %s · familles vues %s' % (fout, dict(vus)))

    # ── ÉVAL bancs (juges externes) ──
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
    J.evalue(u'VOIE B2+CURRICULUM (%s)' % fout, score1, B)

if __name__ == '__main__':
    main()
