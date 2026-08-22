# -*- coding: utf-8 -*-
u"""DISTILLATION INVERSE mou→squelette (chantier symbiose n°3) — famille « accord pluriel à
vérifier », la plus grosse source de fatigue orange (le juge la tait à 68 % sur correct).
Le MOU étiquette (tais/garde, marge 0.01) les 6 137 oranges du dump ; une CARTE logistique
maison (façon cesses : mots voisins déaccentués, zéro POS) apprend à prédire son verdict —
le squelette gagne l'organe SANS le juge : pas d'opt-in, pas de 15 Mo, instantané.
SÉCURITÉ mesurée sur held-out DISJOINT de tout entraînement (mou ET carte) :
  · dys réel : les 19 oranges pluriel JUSTES doivent être GARDÉES ;
  · fp_scale : accord carte↔juge + fatigue tue à seuil choisi.
Sortie : dictee/pluriel_tais_model.json {prior, lr, seuil} + rapport.
  python dictee/distill_pluriel.py [modele.pt]"""
import os, sys, io, re, json, random, math, unicodedata
from collections import Counter, defaultdict

import torch
import torch.nn.functional as F

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from b2_train import CharT
from dys_reel_probe import align

TOK = re.compile(u"[A-Za-zÀ-ÿœŒæÆ'ʼ]+")
NUMOTS = set(u'deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize vingt trente quarante cinquante soixante cent cents mille plusieurs quelques'.split())

def deacc(s):
    return u''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def norm(w): return (w or u'').lower().replace(u'’', u"'")

DET_PL = set(u'les des ces ses mes tes nos vos leurs aux quelques plusieurs certains certaines'.split())
DET_SG = set(u"le la un une ce cet cette mon ton son ma ta sa notre votre leur au du chaque tout toute l'".split())
VERBE_PL = set(u'sont ont etaient seront furent vont font peuvent doivent'.split())

def feats(s, i):
    st = [mm.group(0) for mm in TOK.finditer(s)]
    if i >= len(st): return None
    def w(k):
        return deacc(st[k].lower()) if 0 <= k < len(st) else u'<>'
    f = [u'tok=' + w(i), u'pv=' + w(i - 1), u'pv2=' + w(i - 2), u'nx=' + w(i + 1)]
    pv = st[i - 1] if i >= 1 else u''
    if re.match(u'^[0-9]+$', pv) or deacc(pv.lower()) in NUMOTS: f.append(u'pvNUM')
    if i >= 2 and (re.match(u'^[0-9]+$', st[i - 2]) or deacc(st[i - 2].lower()) in NUMOTS): f.append(u'pv2NUM')
    if i <= 1: f.append(u'debut')
    # polarité du DÉTERMINANT (fenêtre gauche 1-2) et du VERBE à droite — le vrai partage
    # garde/fatigue : « Les propriétaire » (pl à gauche → l'orange est probablement JUSTE) vs
    # « le 25 août » (sg/num → le singulier est légitime, fatigue)
    for k in (1, 2):
        if w(i - k) in DET_PL: f.append(u'detPL')
        if w(i - k) in DET_SG: f.append(u'detSG')
    if w(i + 1) in VERBE_PL or w(i + 2) in VERBE_PL: f.append(u'vbPL')
    return f

def fenetre(t, pos):
    d = max(t.rfind(u'.', 0, pos), t.rfind(u'!', 0, pos), t.rfind(u'?', 0, pos))
    e = len(t)
    for c in u'.!?':
        k = t.find(c, pos)
        if k >= 0 and k < e: e = k
    return d + 1, min(e + 1, len(t))

def main():
    fmod = sys.argv[1] if len(sys.argv) > 1 else 'b2_model_14m.pt'
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    ck = torch.load(os.path.join(ROOT, 'data_local', fmod), map_location='cpu', weights_only=False)
    chars = ck['chars']; v2i = {c: i for i, c in enumerate(chars)}
    CTX = ck['cfg']['CTX']
    m = CharT(len(chars), ck['cfg']).to(dev); m.load_state_dict(ck['model']); m.eval()

    def scores_lot(strs):
        out = []
        for a in range(0, len(strs), 64):
            lot = strs[a:a + 64]
            ids = [[v2i.get(c, 0) for c in s][:CTX] for s in lot]
            L = max(max(len(x) for x in ids), 3)
            t = torch.zeros(len(ids), L, dtype=torch.long, device=dev)
            msk = torch.zeros(len(ids), L, device=dev)
            for i, x in enumerate(ids):
                t[i, :len(x)] = torch.tensor(x, device=dev); msk[i, 1:len(x)] = 1
            with torch.no_grad():
                lp = F.log_softmax(m(t)[:, :-1].float(), -1)
                tok = lp.gather(2, t[:, 1:, None])[:, :, 0] * msk[:, 1:]
                out.extend((tok.sum(1) / msk[:, 1:].sum(1).clamp(min=1)).tolist())
        return out

    def juge_tais(exemples):
        u"""exemples [{s,i,sugg}] → [bool tais] (l'écrit gagne par marge 0.01)."""
        E, C_ = [], []
        for e in exemples:
            t = e['s'].replace(u'’', u"'")
            st = [(mm.start(), mm.end()) for mm in TOK.finditer(t)]
            if e['i'] >= len(st): E.append(None); C_.append(None); continue
            a, b = st[e['i']]
            cand = t[:a] + e['sugg'] + t[b:]
            w0, w1 = fenetre(t, a); d = len(cand) - len(t)
            E.append(t[w0:w1]); C_.append(cand[w0:w1 + d])
        ok = [k for k in range(len(E)) if E[k] is not None]
        se = scores_lot([E[k] for k in ok]); sc = scores_lot([C_[k] for k in ok])
        lab = [None] * len(E)
        for j, k in enumerate(ok):
            lab[k] = (se[j] - sc[j]) > 0.01
        return lab

    # ── 1 · étiqueter le corpus d'entraînement de la carte ──────────────────
    # deux flux : les oranges du correct (étiquette = verdict du JUGE) + les JUSTES générées par
    # le squelette (étiquette garde par CONSTRUCTION — le correct ne contient pas « les
    # propriétaire », il faut les fabriquer, sinon la carte ne peut pas apprendre à les garder).
    Draw = json.load(io.open(os.path.join(ROOT, 'data_local', 'distill_pluriel_dump.json'), encoding='utf-8'))
    Dtr = Draw['oranges'] if isinstance(Draw, dict) else Draw
    Dj = Draw.get('justes', []) if isinstance(Draw, dict) else []
    lab = juge_tais(Dtr)
    XY = [(feats(Dtr[k]['s'].replace(u'’', u"'"), Dtr[k]['i']), lab[k]) for k in range(len(Dtr))]
    XY += [(feats(e['s'].replace(u'’', u"'"), e['i']), False) for e in Dj]
    XY = [(f, y) for f, y in XY if f is not None and y is not None]
    nT = sum(1 for _f, y in XY if y)
    print(u'étiquettes : %d exemples (%d juge + %d justes générées) · tais %d (%.0f %%)'
          % (len(XY), len(Dtr), len(Dj), nT, 100.0 * nT / max(len(XY), 1)))

    # ── 2 · carte logistique maison (SGD, L2) ───────────────────────────────
    rng = random.Random(20260821)
    rng.shuffle(XY)
    ndev = len(XY) // 7
    dev_xy, tr_xy = XY[:ndev], XY[ndev:]
    W = defaultdict(float); prior = 0.0
    LR, L2, EPOQ = 0.15, 1e-5, 12
    for ep in range(EPOQ):
        rng.shuffle(tr_xy)
        for f, y in tr_xy:
            z = prior + sum(W[x] for x in f)
            p = 1.0 / (1.0 + math.exp(-max(-30, min(30, z))))
            g = (1.0 if y else 0.0) - p
            prior += LR * g
            for x in f:
                W[x] += LR * (g - L2 * W[x])
    LRp = {k: round(v, 3) for k, v in W.items() if abs(v) >= 0.15}   # ÉLAGAGE AVANT l'éval : on mesure l'ARTEFACT baké, pas le modèle complet
    def proba(f):
        z = prior + sum(LRp.get(x, 0.0) for x in f)
        return 1.0 / (1.0 + math.exp(-max(-30, min(30, z))))
    acc = sum(1 for f, y in dev_xy if (proba(f) > 0.5) == y)
    print(u'accord carte↔juge (dev interne, poids ÉLAGUÉS) : %d/%d (%.0f %%) · %d traits gardés sur %d' % (acc, len(dev_xy), 100.0 * acc / len(dev_xy), len(LRp), len(W)))

    # ── 3 · SÉCURITÉ sur held-out disjoint ──────────────────────────────────
    A = json.load(io.open(os.path.join(ROOT, 'data_local', 'arbitre_vig_dump.json'), encoding='utf-8'))
    fps = set(l.strip().replace(u'’', u"'") for l in io.open(os.path.join(HERE, 'fp_scale_corpus.txt'), encoding='utf-8') if l.strip())
    held = []                                     # oranges pluriel de fp_scale (jamais vues du mou NI de la carte)
    for e in A['correct']:
        s = e['s'].replace(u'’', u"'")
        if s not in fps: continue
        for f in e['flags']:
            if f.get('name') == u'accord pluriel à vérifier':
                held.append({'s': s, 'i': f['i'], 'sugg': f['sugg']})
    lab_h = juge_tais(held)
    dys_j, dys_f = [], []                         # justes / fatigue du corpus dys
    for t in A['dys']:
        tn = t['raw'].replace(u'’', u"'")
        ops = align(t['tokens'], t['tokensFixed'])
        gold = {}; ia = 0
        for op in ops:
            kk, a, b = op
            if kk == 'ins': continue
            if kk == 'del': ia += 1; continue
            gold[ia] = (a, b); ia += 1
        for f in t['flags']:
            if f.get('name') != u'accord pluriel à vérifier': continue
            g = gold.get(f['i'])
            if g is None: continue
            a, b = g
            ex = {'s': tn, 'i': f['i'], 'sugg': f['sugg'], 'tok': a, 'gold': b}
            if norm(a) != norm(b) and norm(f.get('sugg')) == norm(b): dys_j.append(ex)
            elif norm(a) == norm(b): dys_f.append(ex)
    rendement_shippe = None   # (tue_h, tue_f) AU SEUIL RÉELLEMENT BAKÉ (0.9) — garde de fusion plus bas
    for seuil in (0.5, 0.7, 0.8, 0.9):
        ok_j = sum(1 for e in dys_j if proba(feats(e['s'], e['i']) or []) <= seuil)
        tue_f = sum(1 for e in dys_f if proba(feats(e['s'], e['i']) or []) > seuil)
        agree = sum(1 for k, e in enumerate(held) if lab_h[k] is not None and (proba(feats(e['s'], e['i']) or []) > seuil) == lab_h[k])
        n_h = sum(1 for l in lab_h if l is not None)
        tue_h = sum(1 for e in held if proba(feats(e['s'], e['i']) or []) > seuil)
        print(u'seuil %.1f : dys JUSTES gardées %d/%d · dys fatigue tue %d/%d · fp_scale accord juge %d/%d · fp_scale tues %d/%d'
              % (seuil, ok_j, len(dys_j), tue_f, len(dys_f), agree, n_h, tue_h, len(held)))
        if seuil == 0.9: rendement_shippe = (tue_h, tue_f)
    for e in dys_j:
        p = proba(feats(e['s'], e['i']) or [])
        if p > 0.5:
            print(u'  ⚠ juste menacée (p=%.2f) : « %s »→« %s » (gold %s) · %s' % (p, e['tok'], e['sugg'], e['gold'], e['s'][:70]))

    # ── 4 · baker la carte (les poids ÉVALUÉS ci-dessus) ────────────────────
    # FUSION prudente (audit 2026-08-22) : ce script n'a AUCUNE porte SÛR+UTILE (contrairement à
    # distill_vig.py) — il bake TOUJOURS au seuil fixe 0.9. Or re-collecter aujourd'hui via
    # distill_pluriel_dump.js s'AUTO-CENSURE (le moteur qu'il utilise contient déjà plTaisCarte,
    # donc les cas que la carte tait sont invisibles à son propre ré-entraînement). Un futur
    # ré-entraînement pourrait produire une carte appauvrie SANS AUCUN avertissement. Même
    # principe que le fix posé le même soir sur distill_vig.py : on n'écrase plus aveuglément si
    # le rendement s'effondre — pas de re-calibrage du seuil ici, juste un garde-fou d'écrasement.
    out = {'prior': round(prior, 3), 'lr': LRp, 'seuil': 0.9}
    p = os.path.join(HERE, 'pluriel_tais_model.json')
    avant = json.load(io.open(p, encoding='utf-8')) if os.path.exists(p) else None
    if avant is not None and rendement_shippe is not None and sum(rendement_shippe) < 5:
        print(u'\n⚠ rendement effondré à seuil 0.9 sur CETTE collecte (%d tués) — probable '
              u'auto-censure (la carte déjà embarquée filtre sa propre collecte) : carte '
              u'EXISTANTE gardée telle quelle, RIEN écrit' % sum(rendement_shippe))
    else:
        json.dump(out, io.open(p, 'w', encoding='utf-8'), ensure_ascii=False)
        print(u'carte : %s (%d traits, %.1f Ko, seuil %.1f)' % (p, len(LRp), os.path.getsize(p) / 1024.0, out['seuil']))

if __name__ == '__main__':
    main()
