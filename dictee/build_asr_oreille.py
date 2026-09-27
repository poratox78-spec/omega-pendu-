#!/usr/bin/env python3
# -*- coding: utf-8 -*-
u"""
L'OREILLE APPRISE de la voie B (dictee/asr_oreille.json) : ce que wav2vec2-french-phonemizer ENTEND quand on lui dit
chaque son. Recette LOCALE (hors CI) : il faut l'audio VoxPopuli FR (CC0) dans data_local/voix/voxpopuli_fr/ et le
modèle acoustique (torch + transformers, GPU si disponible).

1. l'oreille écoute les 250 extraits (même découpe en mots et même conversion IPA → SAMPA qu'asr_voix.transcribe) ;
2. découpe PAR LOCUTEUR (les inconnus côté A ; puis le plus gros locuteur restant vers la moitié la plus légère) :
   seule la moitié A sert (123 extraits, 4 352 mots) — la moitié B a servi à MESURER (JOURNAL du 27/09) ;
3. pour chaque extrait, le son de référence (les mots du texte, prononcés comme le décodeur les prononce : l'index
   d'asr_voix) est aligné sur les sons entendus ; on compte substitutions, pertes, ajouts ; 3 passes d'EM dur
   (réalignement avec les coûts appris) ; lissage de Dirichlet (kappa 5, 85 % de la masse a priori sur « soi-même »).

Ce que la table a appris (27/09) : « 8 » (/ɥ/) est entendu « y » 88 % du temps — le modèle n'a PAS ce symbole ;
le schwa se perd 45 % du temps ; ø → ə 32 %, œ → ø 24 %, ɛ̃ → œ̃ 20 %, o → ɔ 20 %, liaisons (z, t ajoutés).

    python dictee/build_asr_oreille.py            # écrit dictee/asr_oreille.json
    python dictee/build_asr_oreille.py --check    # refait la table et la compare à celle du dépôt
"""
import io, json, math, os, re, sys, time
from collections import defaultdict
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import asr_voix as A
import decompose as D

VOX = os.path.join(HERE, '..', 'data_local', 'voix', 'voxpopuli_fr')
OUT = A.OREILLE_PATH
VOY = set(u'aeiouyEO2945@§1°')
ELID = {"l'": 'l', "d'": 'd', "j'": 'Z', "n'": 'n', "s'": 's', "c'": 's', "m'": 'm', "t'": 't', "qu'": 'k',
        "jusqu'": 'Zysk', "lorsqu'": 'lORsk', "puisqu'": 'p8isk', "quoiqu'": 'kwak', "presqu'": 'pREsk', "quelqu'": 'kElk'}
KAPPA, ITER = 5.0, 3


def entendre(wav, torch, proc, am, dev):
    u"""= asr_voix.transcribe (mêmes règles de découpe et de conversion), logits calculés sur `dev`."""
    import soundfile as sf
    a, sr = sf.read(wav)
    if getattr(a, 'ndim', 1) > 1: a = a.mean(1)
    iv = proc(a.astype('float32'), sampling_rate=16000, return_tensors='pt').input_values.to(dev)
    with torch.no_grad(): ids = am(iv).logits[0].argmax(-1).tolist()
    pad, bar = proc.tokenizer.pad_token_id, proc.tokenizer.convert_tokens_to_ids('|')
    def to_sampa(cids):
        toks = []; prev = None
        for i in cids:
            if i != prev: toks.append(proc.tokenizer.convert_ids_to_tokens(i)); prev = i
        out = []
        for t in toks:
            if t == '̃':
                if out: out[-1] = A.NAS.get(out[-1], out[-1])
            elif t in A.DROP: continue
            else:
                o = A.IPA2O.get(t)
                if o: out.append(o)
        return ''.join(out)
    words = []; cur = []; sil = 0; hasbar = False
    for i in ids:
        if i == pad or i == bar:
            sil += 1
            if i == bar: hasbar = True
        else:
            if sil > 0 and hasbar:
                if cur: words.append(to_sampa(cur))
                cur = []
            sil = 0; hasbar = False
            cur.append(i)
    if cur: words.append(to_sampa(cur))
    return [w for w in words if w]


def mots(t): return re.findall(u"[a-zà-ÿœ']+", t.lower())


def g2p_sampa(w):                                 # = asr_voix.build_index.g2p_sampa
    out = []
    for s in D.g2p(w):
        ph = s.get('ph')
        if not ph or ph == '∅': continue
        for ch in ph:
            if ch == '̃':
                if out: out[-1] = A.NAS.get(out[-1], out[-1])
            elif ch == 'ʲ': out.append('j')
            elif ch == 'ː': pass
            else:
                o = A.IPA2O.get(ch)
                if o: out.append(o)
    return ''.join(out)


WPRON = {}
def pron(w):
    u"""Le son que le décodeur prête au mot (son index), élision découpée, g2p en dernier recours."""
    if not WPRON:
        for ph, ws in A.PH2W.items():
            for x in ws: WPRON.setdefault(x, ph)
    if w in WPRON: return WPRON[w]
    if "'" in w:
        i = w.index("'") + 1
        return ELID.get(w[:i], g2p_sampa(w[:i - 1])) + (pron(w[i:]) if w[i:] else '')
    return D.W2P.get(w) or g2p_sampa(w)


def moitie_a(items):
    u"""Découpe par locuteur (identique au banc du labo) : rend les extraits de la moitié A."""
    par = defaultdict(list)
    for k, (ref, loc) in items.items(): par[loc or 'None'].append(k)
    a_, nb = list(par.pop('None', [])), 0
    taille = lambda ks: sum(len(re.findall(u"[a-zà-ÿœæ]+'?", items[k][0].lower())) for k in ks)
    na = taille(a_)
    for l in sorted(par, key=lambda l: (-taille(par[l]), l)):
        if nb <= na: nb += taille(par[l])
        else: a_ += par[l]; na += taille(par[l])
    return sorted(a_)


def aligner(r, h, SYM, SUB=None, DEL=None, INS=None):
    n, m = len(r), len(h)
    if SUB is None:
        cs = lambda a, b: 0.0 if a == b else (1.0 if ((a in VOY) == (b in VOY)) else 1.6)
        cd = lambda a: 1.0; ci = lambda b: 1.0
    else:
        cs = lambda a, b: SUB[SYM[a], SYM[b]]; cd = lambda a: DEL[SYM[a]]; ci = lambda b: INS[SYM[b]]
    INF = 1e18
    d = [[INF] * (m + 1) for _ in range(n + 1)]; bp = [[0] * (m + 1) for _ in range(n + 1)]
    d[0][0] = 0.0
    for i in range(n + 1):
        for j in range(m + 1):
            if i == 0 and j == 0: continue
            best = INF; b = 0
            if i > 0 and j > 0:
                v = d[i - 1][j - 1] + cs(r[i - 1], h[j - 1])
                if v < best: best, b = v, 1
            if i > 0:
                v = d[i - 1][j] + cd(r[i - 1])
                if v < best: best, b = v, 2
            if j > 0:
                v = d[i][j - 1] + ci(h[j - 1])
                if v < best: best, b = v, 3
            d[i][j] = best; bp[i][j] = b
    ops = []; i, j = n, m
    while i > 0 or j > 0:
        b = bp[i][j]
        if b == 1: ops.append(('S', r[i - 1], h[j - 1])); i -= 1; j -= 1
        elif b == 2: ops.append(('D', r[i - 1], None)); i -= 1
        else: ops.append(('I', None, h[j - 1])); j -= 1
    return ops


def apprendre(paires, SYMS):
    SYM = {c: i for i, c in enumerate(SYMS)}; NS = len(SYMS)
    SUB = DEL = INS = None
    for it in range(ITER):
        cnt = np.zeros((NS, NS)); cdel = np.zeros(NS); cins = np.zeros(NS); npos = 0
        for r, h in paires:
            npos += len(r) + 1
            for op, a, b in aligner(r, h, SYM, SUB, DEL, INS):
                if op == 'S': cnt[SYM[a], SYM[b]] += 1
                elif op == 'D': cdel[SYM[a]] += 1
                else: cins[SYM[b]] += 1
        SUB = np.zeros((NS, NS)); DEL = np.zeros(NS)
        for a in range(NS):
            tot = cnt[a].sum() + cdel[a]
            prior = np.full(NS, 0.15 / (NS + 1)); prior[a] += 0.85
            SUB[a] = -np.log((cnt[a] + KAPPA * prior) / (tot + KAPPA))
            DEL[a] = -math.log((cdel[a] + KAPPA * 0.15 / (NS + 1)) / (tot + KAPPA))
        INS = -np.log((cins + KAPPA * 0.05 / NS) / (npos + KAPPA))
        tous = cnt.sum() + cdel.sum()
        print(u'  passe %d : %d sons dits, %.1f %% entendus autrement, %.1f %% perdus, %d ajoutés' % (
            it + 1, int(tous), 100.0 * (cnt.sum() - np.trace(cnt)) / tous, 100.0 * cdel.sum() / tous, int(cins.sum())))
    return SUB, DEL, INS


def construire():
    idx = os.path.join(VOX, 'index.jsonl')
    if not os.path.exists(idx):
        sys.exit(u"Il manque l'audio VoxPopuli FR (CC0) : data_local/voix/voxpopuli_fr/index.jsonl + les .wav.")
    import torch
    from transformers import Wav2Vec2ForCTC, AutoProcessor
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    proc = AutoProcessor.from_pretrained(A.MODEL)
    am = Wav2Vec2ForCTC.from_pretrained(A.MODEL).to(dev).eval()
    A.PH2W, A.FREQ, A.POS = A.build_index()
    items = {}; ent = {}; t0 = time.time()
    for ln in io.open(idx, encoding='utf-8'):
        x = json.loads(ln)
        items[x['wav']] = (x['nu'], x.get('locuteur'))
        ent[x['wav']] = entendre(os.path.join(VOX, x['wav']), torch, proc, am, dev)
    print(u'oreille : %d extraits écoutés (%s, %.0f s)' % (len(ent), dev, time.time() - t0))
    ka = moitie_a(items)
    paires = [(''.join(pron(w) for w in mots(items[k][0])), ''.join(ent[k])) for k in ka]
    s = set()
    for ph in A.PH2W: s.update(ph)
    for k in items:
        for w in ent[k]: s.update(w)
        for w in mots(items[k][0]): s.update(pron(w))
    SYMS = sorted(s)
    print(u'moitié A : %d extraits · %d symboles' % (len(ka), len(SYMS)))
    SUB, DEL, INS = apprendre(paires, SYMS)
    return {
        'version': 1,
        'source': u'VoxPopuli FR (Parlement européen, CC0) — moitié A par locuteur : %d extraits' % len(ka),
        'modele_acoustique': A.MODEL,
        'methode': u'alignement phrase entière son de référence (index d\'asr_voix) ↔ sons entendus, EM dur %d passes, '
                   u'Dirichlet kappa %g (85 %% sur soi-même) ; coûts = −log P' % (ITER, KAPPA),
        'symboles': SYMS,
        'sub': [[round(float(v), 5) for v in row] for row in SUB],
        'del': [round(float(v), 5) for v in DEL],
        'ins': [round(float(v), 5) for v in INS],
    }


def main():
    T = construire()
    if '--check' in sys.argv:
        R = json.load(open(OUT, encoding='utf-8'))
        if R['symboles'] != T['symboles']: sys.exit(u'❌ symboles différents de la table du dépôt')
        ecart = max(float(np.abs(np.array(R[k]) - np.array(T[k])).max()) for k in ('sub', 'del', 'ins'))
        print(u'écart maximal avec la table du dépôt : %.5f' % ecart)
        sys.exit(0 if ecart < 1e-3 else 1)
    json.dump(T, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(u'écrit %s (%d octets)' % (OUT, os.path.getsize(OUT)))


if __name__ == '__main__':
    main()
