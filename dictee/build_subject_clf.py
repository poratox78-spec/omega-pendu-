# -*- coding: utf-8 -*-
# build_subject_clf.py — entraîne un classifieur de SUJET (régression logistique) sur les dépendances gold UD (nsubj)
# et exporte les poids → dictee/subject_clf.json. Modèle = ~18 poids (portable Python↔JS). Sert à GATER l'accord
# sujet-verbe mid-phrase au FP=0 : on ne corrige que si le sujet-candidat est scoré ≥ 0.99 (mesuré : 0 FP sur UD tenu).
# Données : UD French-GSD (CC BY-SA 4.0) → modèle dérivé CC BY-SA. Features = tags du POS-tagger HMM + structure.
import os, sys, math, json, re
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import correcteur_probe as C
CONLLU = os.path.join(HERE, '..', 'data_local', 'ud_fr_gsd-train.conllu')
OUT = os.path.join(HERE, 'subject_clf.json')

SUBJP = {'je','tu','il','elle','on','ils','elles','nous','vous','qui'}
PLUR_DET = {'les','des','ces','mes','tes','ses','nos','vos','leurs'}

def load():
    sents, cur = [], []
    for l in open(CONLLU, encoding='utf-8'):
        if l.startswith('#'): continue
        l = l.rstrip('\n')
        if not l:
            if cur: sents.append(cur); cur = []
            continue
        c = l.split('\t')
        if len(c) < 8 or '-' in c[0] or '.' in c[0]: continue
        cur.append((c[1], c[3], c[7]))
    if cur: sents.append(cur)
    return sents

def clause_starts(T):
    st = [False]*len(T)
    if T: st[0] = True
    for i in range(1, len(T)):
        if T[i-1] in (',', ';', ':') or re.match(r'^[.!?…»«()]', T[i-1]): st[i] = True
    return st

# features(T, tags, i, cs) — DOIT être identique en JS (subject_score). Retourne dict {nom: valeur}.
def features(T, tags, i, cs):
    d = C.deacc(T[i].lower()); tg = tags[i]; f = {'bias': 1.0}
    f['is_pron_subj'] = 1.0 if d in SUBJP else 0.0
    f['tag_PRON'] = 1.0 if tg == 'PRON' else 0.0
    f['tag_NOUN'] = 1.0 if tg == 'NOUN' else 0.0
    f['tag_PROPN'] = 1.0 if tg == 'PROPN' else 0.0
    f['clause_init'] = 1.0 if cs[i] else 0.0
    pt = tags[i-1] if i > 0 else '<s>'
    f['prev_DET'] = 1.0 if pt == 'DET' else 0.0
    f['prev_ADP'] = 1.0 if pt == 'ADP' else 0.0
    f['prev_VERB'] = 1.0 if pt in ('VERB', 'AUX') else 0.0
    f['prev_SCONJ'] = 1.0 if pt in ('SCONJ', 'CCONJ') else 0.0
    f['prev_bos'] = 1.0 if i == 0 else 0.0
    vafter = 0; vpos = None
    for j in range(i+1, min(len(T), i+5)):
        if tags[j] in ('VERB', 'AUX'): vafter = 1; vpos = j; break
        if tags[j] == 'SCONJ': break
    f['verb_after'] = float(vafter)
    f['next_is_verb'] = 1.0 if (i+1 < len(T) and tags[i+1] in ('VERB', 'AUX')) else 0.0
    f['verb_dist'] = (1.0/(vpos-i)) if vpos else 0.0
    agree = 0
    if vpos is not None:
        cand_pl = d.endswith('s') or d.endswith('x') or (i > 0 and C.deacc(T[i-1].lower()) in PLUR_DET) or d in ('ils','elles','nous','vous')
        vr = C._reads(T[vpos])
        vnums = {n for (_l, _m, _p, n) in vr}
        if vr and (('p' in vnums) == cand_pl or 'x' in vnums): agree = 1
    f['agree_verb'] = float(agree)
    f['pp_within2'] = 1.0 if (i >= 2 and tags[i-2] == 'ADP') else 0.0
    f['prev2_DET'] = 1.0 if (i >= 2 and tags[i-2] == 'DET') else 0.0
    f['cap'] = 1.0 if (i > 0 and T[i][:1].isupper()) else 0.0
    return f

FEATS = ['bias','is_pron_subj','tag_PRON','tag_NOUN','tag_PROPN','clause_init','prev_DET','prev_ADP','prev_VERB',
         'prev_SCONJ','prev_bos','verb_after','next_is_verb','verb_dist','agree_verb','pp_within2','prev2_DET','cap']

def main():
    sents = load(); C._hmm_model()
    ev = '--eval' in sys.argv
    tr = sents[:int(len(sents)*0.9)] if ev else sents
    te = sents[int(len(sents)*0.9):] if ev else []
    rows = []
    for s in tr:
        T = [f for f, u, d in s]; tags = C.pos_tags(T) or ['X']*len(T); cs = clause_starts(T)
        for i, (form, u, dep) in enumerate(s):
            if u == 'PUNCT': continue
            rows.append((features(T, tags, i, cs), 1.0 if dep in ('nsubj', 'nsubj:pass') else 0.0))
    w = {k: 0.0 for k in FEATS}
    for ep in range(30):
        for f, y in rows:
            z = sum(w[k]*f.get(k, 0.0) for k in FEATS); p = 1.0/(1.0+math.exp(-max(-30, min(30, z))))
            g = p - y
            for k in FEATS: w[k] -= 0.3*(g*f.get(k, 0.0) + 1e-4*w[k])
    if ev:
        sc = []
        for s in te:
            T = [f for f, u, d in s]; tags = C.pos_tags(T) or ['X']*len(T); cs = clause_starts(T)
            for i, (form, u, dep) in enumerate(s):
                if u == 'PUNCT': continue
                z = sum(w[k]*features(T, tags, i, cs).get(k, 0.0) for k in FEATS)
                sc.append((1.0/(1.0+math.exp(-max(-30, min(30, z)))), 1.0 if dep in ('nsubj','nsubj:pass') else 0.0))
        npos = sum(1 for _, y in sc if y == 1)
        for th in [0.9, 0.99]:
            tp = sum(1 for p, y in sc if p >= th and y == 1); fp = sum(1 for p, y in sc if p >= th and y == 0)
            print("[eval] seuil %.2f : préc %.1f%% rappel %.1f%%" % (th, 100*tp/max(1, tp+fp), 100*tp/max(1, npos)))
        return 0
    json.dump({'feats': FEATS, 'w': {k: round(w[k], 5) for k in FEATS},
               'meta': 'régression logistique sujet/nsubj, UD French-GSD CC BY-SA 4.0'},
              open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print("[subj] %d phrases → %s | poids: %s" % (len(tr), OUT, {k: round(w[k], 2) for k in FEATS}))
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
