# -*- coding: utf-8 -*-
u"""DISTILLATION INVERSE multi-familles (généralise distill_pluriel.py après PR#523) :
sv (accord sujet-verbe) · genre (accord genre) · ou (ou/où). Même recette prouvée :
le juge étiquette les oranges du correct (tais/garde), les JUSTES GÉNÉRÉES par le squelette
(auto-validées : l'orange re-tire avec la sugg d'origine) apprennent à la carte à GARDER.
Par famille : entraînement LR maison → SÉCURITÉ sur held-out disjoint (justes dys gardées +
fatigue tue) → verdict SHIP / PAS SÛR. On ne bake QUE les familles sûres (justes 100 % avec
marge ≥ 0.05 sur la plus proche menacée). Sortie : dictee/vig_tais_models.json {fam:{...}}.
  python dictee/distill_vig.py [modele.pt]"""
import os, sys, io, re, json, random, math, unicodedata
from collections import Counter, defaultdict

import torch
import torch.nn.functional as F

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from b2_train import CharT
from dys_reel_probe import align
from distill_pluriel import feats, fenetre, TOK, deacc

FAMS = {'sv': u'accord sujet-verbe à vérifier', 'genre': u'accord genre à vérifier', 'ou': u'ou/où à vérifier',
        'maj': u'majuscule initiale à vérifier', 'ces': u'ces/ses à vérifier'}

def norm(w): return (w or u'').lower().replace(u'’', u"'")

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

    D = json.load(io.open(os.path.join(ROOT, 'data_local', 'distill_vig_dump.json'), encoding='utf-8'))
    A = json.load(io.open(os.path.join(ROOT, 'data_local', 'arbitre_vig_dump.json'), encoding='utf-8'))
    fps = set(l.strip().replace(u'’', u"'") for l in io.open(os.path.join(HERE, 'fp_scale_corpus.txt'), encoding='utf-8') if l.strip())

    ppath = os.path.join(HERE, 'vig_tais_models.json')
    # FUSION, pas écrasement : une famille déjà shippée (carte embarquée dans app/omega-pendu.html) s'AUTO-
    # CENSURE dès qu'on re-collecte aujourd'hui (spellText applique déjà sa propre carte) — la refaire tourner
    # sous-compte sa fatigue et lui fait échouer la porte « utile » à tort. On garde donc l'entrée EXISTANTE
    # telle quelle si la famille ne rebake pas cette fois (bug trouvé 2026-08-22 : un run avait vidé sv/genre/ou).
    registre_avant = json.load(io.open(ppath, encoding='utf-8')) if os.path.exists(ppath) else {}
    registre = dict(registre_avant)
    for fam, nomfam in FAMS.items():
        Dtr = D[fam]['oranges']; Dj = D[fam]['justes']
        rngj = random.Random(7)
        rngj.shuffle(Dj)
        nev = max(len(Dj) // 7, 0)
        Dj_ev, Dj_tr = Dj[:nev], Dj[nev:]         # 15 % des justes GÉNÉRÉES = banc de sécurité TESTABLE (les justes dys peuvent manquer)
        lab = juge_tais(Dtr)
        XY = [(feats(Dtr[k]['s'].replace(u'’', u"'"), Dtr[k]['i']), lab[k]) for k in range(len(Dtr))]
        XY += [(feats(e['s'].replace(u'’', u"'"), e['i']), False) for e in Dj_tr]
        XY = [(f, y) for f, y in XY if f is not None and y is not None]
        nT = sum(1 for _f, y in XY if y)
        print(u'\n══ %s — %d ex (%d juge + %d justes gén.) · tais %d (%.0f %%) ══'
              % (fam, len(XY), len(Dtr), len(Dj), nT, 100.0 * nT / max(len(XY), 1)))
        if nT < 30:
            print(u'  ⛔ PAS ASSEZ de fatigue étiquetée — famille non distillée (rien à apprendre)')
            continue
        rng = random.Random(20260821)
        rng.shuffle(XY)
        W = defaultdict(float); prior = 0.0
        for ep in range(12):
            rng.shuffle(XY)
            for f, y in XY:
                z = prior + sum(W[x] for x in f)
                p = 1.0 / (1.0 + math.exp(-max(-30, min(30, z))))
                g = (1.0 if y else 0.0) - p
                prior += 0.15 * g
                for x in f:
                    W[x] += 0.15 * (g - 1e-5 * W[x])
        LRp = {k: round(v, 3) for k, v in W.items() if abs(v) >= 0.15}
        def proba(f):
            z = prior + sum(LRp.get(x, 0.0) for x in f)
            return 1.0 / (1.0 + math.exp(-max(-30, min(30, z))))
        # sécurité : dys (classes au gold) + fp_scale (fatigue par définition)
        dys_j, dys_f = [], []
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
                if f.get('name') != nomfam: continue
                g = gold.get(f['i'])
                if g is None: continue
                a, b = g
                ex = {'s': tn, 'i': f['i'], 'sugg': f['sugg'], 'tok': a, 'gold': b}
                if norm(a) != norm(b) and norm(f.get('sugg')) == norm(b): dys_j.append(ex)
                elif norm(a) == norm(b): dys_f.append(ex)
        held = []
        for e in A['correct']:
            s = e['s'].replace(u'’', u"'")
            if s not in fps: continue
            for f in e['flags']:
                if f.get('name') == nomfam: held.append({'s': s, 'i': f['i'], 'sugg': f['sugg']})
        meilleurs = None
        pj_gen = [proba(feats(e['s'].replace(u'’', u"'"), e['i']) or []) for e in Dj_ev]
        for seuil in (0.5, 0.6, 0.7, 0.8, 0.9, 0.95):
            pj = [proba(feats(e['s'], e['i']) or []) for e in dys_j]
            ok_j = sum(1 for p in pj if p <= seuil)
            marge = seuil - max([p for p in pj if p <= seuil], default=0.0)
            ok_g = sum(1 for p in pj_gen if p <= seuil)
            tue_f = sum(1 for e in dys_f if proba(feats(e['s'], e['i']) or []) > seuil)
            tue_h = sum(1 for e in held if proba(feats(e['s'], e['i']) or []) > seuil)
            # PORTES durcies (v1 : « sûr » était CREUX quand dys_j est vide et le rendement nul) :
            #   sécurité TESTABLE : justes dys 100 % ET marge ≥0.05 ET justes générées held-out ≥99.5 %
            #   rendement RÉEL   : ≥5 oranges fatigue tues sur les bancs held-out
            sur = (ok_j == len(dys_j)) and (marge >= 0.05) and (not pj_gen or 1000 * ok_g >= 995 * len(pj_gen))
            utile = (tue_h + tue_f) >= 5
            print(u'  seuil %.2f : justes dys %d/%d (marge %.2f) · justes gén. %d/%d · fatigue dys tue %d/%d · fp_scale tues %d/%d %s'
                  % (seuil, ok_j, len(dys_j), marge, ok_g, len(pj_gen), tue_f, len(dys_f), tue_h, len(held),
                     (u'← SÛR+UTILE' if sur and utile else (u'(sûr, rendement nul)' if sur else u''))))
            if sur and utile and (meilleurs is None or tue_h > meilleurs[1]):
                meilleurs = (seuil, tue_h, tue_f)
        for e in dys_j:
            p = proba(feats(e['s'], e['i']) or [])
            if p > 0.5: print(u'  ⚠ juste menacée (p=%.2f) : « %s »→« %s » · %s' % (p, e['tok'], e['sugg'], e['s'][:60]))
        if meilleurs is None:
            if fam in registre_avant:
                print(u'  ⚠ pas de seuil SÛR+UTILE AUJOURD’HUI — entrée EXISTANTE gardée telle quelle '
                      u'(probable auto-censure : la carte déjà embarquée filtre sa propre collecte)')
            else:
                print(u'  ⛔ pas de seuil à la fois SÛR (testable) et UTILE (≥5 tues) — famille NON bakée')
            continue
        registre[fam] = {'prior': round(prior, 3), 'lr': LRp, 'seuil': meilleurs[0], 'nom': nomfam}
        print(u'  ✅ bakée : seuil %.2f · %d traits' % (meilleurs[0], len(LRp)))

    json.dump(registre, io.open(ppath, 'w', encoding='utf-8'), ensure_ascii=False)
    print(u'\nregistre : %s (%s, %.1f Ko)' % (ppath, u' + '.join(registre) or u'VIDE', os.path.getsize(ppath) / 1024.0))

if __name__ == '__main__':
    main()
