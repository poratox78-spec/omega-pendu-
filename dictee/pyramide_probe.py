#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sonde §3 OFF-INERTE — « pyramide » : remplace la garde DURE du pluriel du nom
(nbhomog==0 ∧ POS==NOM ∧ ¬CONJ_F) par un POSTERIOR fréquentiel sur la lecture POS latente :

    P(POS | forme) = Σ FreqMot(lectures de POS) / Σ FreqMot(toutes lectures)     (le Σ_φ du §3, croiser ≠ argmax)

Idée (cf. DOCTRINE §3) : le danger d'un faux positif sur « dét. pluriel + mot »
n'est PAS « le mot a un homographe » (garde binaire du matin, qui ratait ami/voiture/
pomme/faute) mais « une part non négligeable de la masse fréquentielle est une lecture
VERBE » (« il les livre/porte »). On tire ssi  P(NOM) ≥ τ  ET  P(VER) < ε.

MESURE SEULEMENT : lit /tmp/lex4/Lexique4.tsv (per-lecture FreqMot) + UD French.
Ne touche NI le moteur live, NI les assets, NI correcteur_probe (réutilise ses helpers).

Lancer :
    LEX4=/tmp/lex4/Lexique4.tsv UDFR=/tmp/udfr python3 dictee/pyramide_probe.py
    EPS=0.02 python3 dictee/pyramide_probe.py        # sweep du seuil verbe
"""
import os, sys, glob, collections

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import correcteur_probe as C          # toks, deacc, prev, PLURAL_DET, NOUN_PL_STOP, _pluralize_noun, pos_of, ADJ_LEX

TSV  = os.environ.get('LEX4', '/tmp/lex4/Lexique4.tsv')
UDFR = os.environ.get('UDFR', '/tmp/udfr')
TAU  = float(os.environ.get('TAU', '0.5'))    # P(NOM) minimum (nom-dominant)
EPS  = float(os.environ.get('EPS', '0.05'))   # P(VER) maximum (pas de lecture verbe substantielle)

# ---------- 1) posterior P(POS|forme) depuis le TSV (FreqMot PAR LECTURE) ----------
def build_posterior(tsv):
    if not os.path.isfile(tsv):
        print(f"[pyramide] Lexique4 introuvable ({tsv}) — déposer le TSV à /tmp/lex4 ou LEX4=… ; skip."); sys.exit(0)
    freq = collections.defaultdict(lambda: collections.defaultdict(float))   # forme_déacc -> {cgram: Σ FreqMot}
    with open(tsv, encoding='utf-8') as f:
        f.readline()
        for line in f:
            c = line.rstrip('\n').split('\t')
            if len(c) < 10: continue
            w = C.deacc(c[0].lower())
            try: fm = float(c[9])           # 10_FreqMot (par lecture ortho×cgram)
            except ValueError: fm = 0.0
            freq[w][c[4]] += fm             # 5_Cgram
    post = {}
    for w, d in freq.items():
        tot = sum(d.values())
        post[w] = (d.get('NOM', 0.0)/tot, d.get('VER', 0.0)/tot, d.get('ADJ', 0.0)/tot) if tot > 0 else (0.0, 0.0, 0.0)
    return post

POST = build_posterior(TSV)

# ---------- 2) les deux gardes (binaire du matin vs §3) ----------
def gate_hard(n):                          # réplique exacte de rule_noun_plural (matin)
    dn = C.deacc(n.lower())
    v = C.pos_of(n)
    if not (v and v[0] == 'NOM' and v[2] == 0): return False
    return True

def gate_s3(n):                            # §3 : posterior fréquentiel sur la lecture latente
    p = POST.get(C.deacc(n.lower()))
    if not p: return False                 # OOV du lexique → abstention
    pn, pv, pa = p
    return pn >= TAU and pv < EPS

ANCHOR = float(os.environ.get('ANCHOR', '0.3'))   # part NOM min de la FORME PLURIELLE (ancre §3, remplace pos_of embarqué buggé)
def pluralize_s3(n):                       # pluriel ancré dans le POSTERIOR (pas le pos_of embarqué : amis=ADJ/pommes=VER y sont FAUX)
    dn = C.deacc(n.lower()); cands = [n + 's']
    if dn.endswith('al'): cands.append(n[:-2] + 'aux')
    if dn.endswith('au') or dn.endswith('eu'): cands.append(n + 'x')
    for c in cands:
        p = POST.get(C.deacc(c.lower()))
        if p and p[0] >= ANCHOR: return c   # la forme plurielle est majoritairement NOM dans le lexique
    return None

# ---------- 3) la règle pluriel, paramétrée par une garde (le reste = identique au moteur) ----------
def plural_flags(T, gate, pluralize):
    out = []
    for i in range(len(T)):
        if i == 0 or C.prev(T, i) not in C.PLURAL_DET: continue
        n = T[i]
        if not n[:1].isalpha() or n[0].isupper(): continue
        if '-' in n or (i + 1 < len(T) and T[i + 1].startswith('-')): continue   # composé tiret (« terre-neuviers »)
        dn = C.deacc(n.lower())
        if len(dn) < 3 or dn[-1] in 'sxz' or dn in C.NOUN_PL_STOP: continue
        if not gate(n): continue
        nx = T[i + 1] if i + 1 < len(T) else ''                       # garde composé (nom+nom, pas adj)
        if nx[:1].islower() and nx.isalpha():
            vx = C.pos_of(nx)
            if vx and vx[0] == 'NOM' and nx not in C.ADJ_LEX: continue
        pl = pluralize(n)                                             # pluriel ancré dans le lexique
        if pl and C.deacc(pl.lower()) != dn:
            out.append((i, n, pl))
    return out

# ---------- 4) mesures ----------
def conllu_sentences(d):
    for f in sorted(glob.glob(os.path.join(d, '*.conllu'))):
        toks = []
        for line in open(f, encoding='utf-8'):
            if line.startswith('#'): continue
            if not line.strip():
                if toks: yield ' '.join(toks); toks = []
                continue
            col = line.split('\t')
            if len(col) > 1 and '-' not in col[0] and '.' not in col[0]:
                toks.append(col[1])
        if toks: yield ' '.join(toks)

RECOVER = ['les enfant', 'des oiseau', 'des ami', 'des voiture', 'des pomme', 'les faute',
           'des difficulté', 'les cheval galopent', 'des journal']
ABSTAIN = ['il les porte', 'il les livre à domicile', 'les rouge vif', 'je les vois',
           'des chat noirs', 'les beau jours']     # chat noirs/beau = déjà corrects ou non-pluriel-nom

def battery():
    print(f"\n=== batterie diagnostique (τ={TAU} P(NOM)min, ε={EPS} P(VER)max, ancre={ANCHOR}) ===")
    print(f"{'phrase':<26}{'DUR (matin)':<16}{'§3 (pyramide)'}")
    for s in RECOVER + ['---'] + ABSTAIN:
        if s == '---': print('  ' + '-'*46); continue
        T = C.toks(s)
        h = plural_flags(T, gate_hard, C._pluralize_noun); t = plural_flags(T, gate_s3, pluralize_s3)
        fmt = lambda fl: (fl[0][1] + '→' + fl[0][2]) if fl else '·'
        print(f"  {s:<24}{fmt(h):<16}{fmt(t)}")

def fp_measure(sentences=None):
    if not os.path.isdir(UDFR):
        print(f"\n[pyramide] UD French introuvable ({UDFR}) — FP non mesuré."); return
    S = sentences if sentences is not None else list(conllu_sentences(UDFR))
    fp_h = fp_s = 0; new = []
    for s in S:
        T = C.toks(s)
        h = plural_flags(T, gate_hard, C._pluralize_noun); t = plural_flags(T, gate_s3, pluralize_s3)
        if h: fp_h += 1
        if t: fp_s += 1
        hs = {x[0] for x in h}
        for x in t:
            if x[0] not in hs: new.append((x[1], x[2], s[:66]))
    print(f"\n=== FP sur UD French ({len(S)} phrases) — τ={TAU} ε={EPS} ancre={ANCHOR} ===")
    print(f"  garde DURE (matin)  : {fp_h} phrases")
    print(f"  garde §3 (pyramide) : {fp_s} phrases   (Δ {fp_s-fp_h:+d})  | FP nouveaux : {len(new)}")
    for w, pl, ctx in new[:25]:
        print(f"      {w}→{pl}   « {ctx}… »")
    return fp_h, fp_s

def sweep():
    global EPS
    if not os.path.isdir(UDFR): return
    S = list(conllu_sentences(UDFR))
    print(f"\n=== sweep ε (τ={TAU}, ancre={ANCHOR}) — récupérés vs FP nouveaux ===")
    rec_words = ['des ami', 'des voiture', 'des pomme', 'les faute']
    for eps in [0.005, 0.01, 0.02, 0.05]:
        EPS = eps
        fp_h = fp_s = 0
        for s in S:
            T = C.toks(s)
            if plural_flags(T, gate_hard, C._pluralize_noun): fp_h += 1
            if plural_flags(T, gate_s3, pluralize_s3): fp_s += 1
        rec = [w.split()[1] for w in rec_words if plural_flags(C.toks(w), gate_s3, pluralize_s3)]
        print(f"  ε={eps:<5}  FP {fp_s} (Δ{fp_s-fp_h:+d})   récupérés: {','.join(rec) if rec else '—'}")

if __name__ == '__main__':
    battery()
    fp_measure()
    sweep()
