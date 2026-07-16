# -*- coding: utf-8 -*-
# DÉTECTEUR OS-SUJET de RÉFÉRENCE (chantier « accord par arbitrage du sujet »). Charge le LM baké (os_subj_lm.json.gz),
# arbitre 4 routes-sujet par l'OS du pendu (mix convexe pondéré FIABILITÉ=piqué, μ=r/(1+r)) → nombre du sujet + confiance.
# Si le verbe DÉSACCORDE le sujet-OS ET confiance>τ → propose la forme accordée (ORANGE « accord verbe à vérifier »).
#   Routes : R1 plus-proche det+nom · R2 tête-avant-« de » · R3 hors-PP · R4 cohérence-LM (le LM porte la CONFIANCE).
#   C'est LA RÉFÉRENCE que porteront app+extension (orange, comme imparfaitVig ; Python = pas de rouge ici).
#   Valide : flood sur dictee/fp_scale_corpus.txt (held-out, exclu du train LM) + recall sur multi1000. τ=0.85.
#     python dictee/os_subject_probe.py
import os, re, sys, json, gzip, math, difflib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import speller_probe as SP
import correcteur_probe as C
HERE = os.path.dirname(os.path.abspath(__file__))
CONJ_C = C.CONJ_C; NUM_DET = getattr(C, 'NUM_DET', {}); PREP = getattr(C, 'PREP', set())
FULL_AUX = getattr(C, 'FULL_AUX', set()); CLITIC = getattr(C, 'CLITIC', set()); SUBJ_PRON = getattr(C, 'SUBJ_PRON', {})
TOK = re.compile(r"[a-zA-Zà-ÿœæ'\-]+")
def tk(s): return [w.lower() for w in TOK.findall(s.replace('’', "'"))]

# ---- charge le LM baké ----
M = json.load(gzip.open(os.path.join(HERE, 'os_subj_lm.json.gz'), 'rt', encoding='utf-8'))
UNI = M['uni']; N = M['N']; TF = M['tf']; TB = M['tb']; BF = M['bf']; BB = M['bb']
sTF = {k: sum(v.values()) for k, v in TF.items()}; sTB = {k: sum(v.values()) for k, v in TB.items()}
sBF = {k: sum(v.values()) for k, v in BF.items()}; sBB = {k: sum(v.values()) for k, v in BB.items()}
Vu = len(UNI) + 1
def p_uni(w): return (UNI.get(w, 0) + 0.5) / (N + 0.5*Vu)
def p_fwd(w, p2, p1):
    key = p2 + '\t' + p1; d = TF.get(key); db = BF.get(p1)
    return 0.6*((d.get(w, 0)/sTF[key]) if d else 0) + 0.3*((db.get(w, 0)/sBF[p1]) if db else 0) + 0.1*p_uni(w)
def p_bwd(w, n1, n2):
    key = n1 + '\t' + n2; d = TB.get(key); db = BB.get(n1)
    return 0.6*((d.get(w, 0)/sTB[key]) if d else 0) + 0.3*((db.get(w, 0)/sBB[n1]) if db else 0) + 0.1*p_uni(w)
def lsc(w, p2, p1, n1, n2): return math.log(0.5*p_fwd(w, p2, p1) + 0.5*p_bwd(w, n1, n2) + 1e-12)

# ---- routes → distribution sur le nombre {s,p} ----
def _vote(x, c): return (0.5+0.5*c, 0.5-0.5*c) if x == 's' else ((0.5-0.5*c, 0.5+0.5*c) if x == 'p' else (0.5, 0.5))
def _elided_sing(w): return w[:2] == "l'"            # « l'X » = déterminant élidé le/la (JAMAIS les) → sujet SINGULIER. Sans ça les routes rataient le token collé et remontaient à un pluriel lointain (« les rapports mais l'entreprise contactera »→contacteront).
def _num_at(F, k):                                   # nombre du sujet en tête k : élision « l'X » (sing.) OU déterminant connu F[k-1] ; sinon None
    if _elided_sing(F[k]): return 's'
    if k > 0 and SP.deacc(F[k-1]) in NUM_DET:
        return 'p' if (NUM_DET.get(F[k-1]) == 'pl' or SP.deacc(F[k]).endswith(('s', 'x'))) else 's'
    return None
def R1(F, vi):
    for k in range(vi-1, -1, -1):
        x = _num_at(F, k)
        if x: return _vote(x, 0.85)
    return (0.5, 0.5)
def R2(F, vi):
    k = vi-1; last = None
    while k >= 0:
        x = _num_at(F, k)
        if x:
            last = x
            if k-2 >= 0 and SP.deacc(F[k-2]) in ('de', 'des', 'du', "d'"): k -= 2; continue
            return _vote(last, 0.9)
        k -= 1
    return _vote(last, 0.7) if last else (0.5, 0.5)
def R3(F, vi):
    for k in range(vi-1, -1, -1):
        x = _num_at(F, k)
        if x:
            if not _elided_sing(F[k]) and k-2 >= 0 and SP.deacc(F[k-2]) in PREP: continue
            return _vote(x, 0.85)
    return (0.5, 0.5)
def R4(F, vi, f3s, f3p):
    if not f3s or not f3p: return (0.5, 0.5)
    p2 = F[vi-2] if vi >= 2 else '<s>'; p1 = F[vi-1] if vi >= 1 else '<s>'
    n1 = F[vi+1] if vi+1 < len(F) else '</s>'; n2 = F[vi+2] if vi+2 < len(F) else '</s>'
    ss, sp = lsc(f3s, p2, p1, n1, n2), lsc(f3p, p2, p1, n1, n2); mx = max(ss, sp)
    es, ep = math.exp(ss-mx), math.exp(sp-mx); Z = es+ep; return (es/Z, ep/Z)
def _peak(d): return abs(d[0]-d[1])
def os_mix(ds):
    ws = [_peak(d)+1e-6 for d in ds]; Z = sum(ws)
    ps = sum(w*d[0] for w, d in zip(ws, ds))/Z; pp = sum(w*d[1] for w, d in zip(ws, ds))/Z
    return ('s' if ps >= pp else 'p', abs(ps-pp))
def _vinfo(form):
    rd = C._reads(form); p3 = [(l, mt, n) for (l, mt, p, n) in rd if p == '3']
    if not p3: return None
    lem = p3[0][0]; mts = [mt for l, mt, n in p3]; mt = 'ind:pre' if 'ind:pre' in mts else mts[0]
    nums = set(n for l, m, n in p3 if m == mt); vn = 's' if nums == {'s'} else ('p' if nums == {'p'} else '?')
    sl = CONJ_C.get(lem, {}).get(mt, {}); return (lem, mt, vn, sl.get('3s'), sl.get('3p'))

_OS_CLI = CLITIC                                     # skip clitiques/négation pour trouver le sujet-pronom (jeu identique Python↔JS)
def _pron_before(F, vi):                             # sujet PRONOM net (je/tu/il/elle/on/ils/elles) en sautant clitiques + « ne » → géré par la règle PRONOM, pas l'OS-noms
    j = vi - 1; steps = 0
    while j >= 0 and steps < 4 and SP.deacc(F[j]) in _OS_CLI: j -= 1; steps += 1
    return SUBJ_PRON.get(SP.deacc(F[j])) if j >= 0 else None
def _guard_ok(F, vi):
    """gardes STRUCTURELLES (miroir de rule_accord_sv_noun/rule_ais_ait) que le port OS avait perdues → floodaient sur
    passé composé/participe/sujet-pronom (mesuré sur registre chat : flood 3,5 %→0 %, recall inchangé). Indépendantes du sujet-OS."""
    w = F[vi]
    if "'" in w: return False                                                     # verbe élidé (n'est…) → autre structure
    if w.endswith(('é', 'és', 'ée', 'ées')): return False                         # PARTICIPE (contacté, embrassé) : accord ADJECTIVAL, pas verbal
    if vi > 0 and F[vi-1] in NUM_DET: return False                               # déterminant avant → T[vi] = NOM (« les joue »)
    if vi > 0 and SP.deacc(F[vi-1]) in PREP: return False                        # préposition avant → nom homographe (« de contrôle »)
    if (vi >= 1 and SP.deacc(F[vi-1]) in FULL_AUX) or (vi >= 2 and SP.deacc(F[vi-2]) in FULL_AUX): return False  # temps composé (aux + participe : « ont contacté », « a montré »)
    if _pron_before(F, vi) is not None: return False                            # sujet pronom net (je/elle…) → « je ne me trompe », « elle m'a… »
    return True

def detect(F, vi, tau=0.85, tg=None):
    """rend (forme accordée suggérée, confiance) si le verbe F[vi] désaccorde le sujet-OS au-dessus de τ, sinon None.
    _guard_ok : gardes structurelles (participe/aux/dét/prép/sujet-pronom) — miroir des règles sœurs.
    tg (POS-tags de F) : GATE POS — écarte les noms/adj homographes de verbes (« la côte », « influent », « la pêche »)
    que _vinfo prend à tort pour des verbes = vrais FP (mesuré : −17 flood pour −2 recall). tg passé par le moteur."""
    if not _guard_ok(F, vi): return None
    vi_ = _vinfo(F[vi])
    if not vi_: return None
    lem, mt, vn, f3s, f3p = vi_
    if vn == '?' or not f3s or not f3p: return None
    if tg is not None and (vi >= len(tg) or tg[vi] not in ('VERB', 'AUX')): return None
    num, conf = os_mix([R1(F, vi), R2(F, vi), R3(F, vi), R4(F, vi, f3s, f3p)])
    if conf < tau or num == vn: return None
    return (f3p if num == 'p' else f3s, conf)

if __name__ == '__main__':
    TAU = 0.85
    fp = [l.strip() for l in open(os.path.join(HERE, 'fp_scale_corpus.txt'), encoding='utf-8') if l.strip()]
    if len(sys.argv) > 1 and sys.argv[1] == 'floodflags':   # mode PARITÉ (self-contained, fp_scale committé) : dump les flags OS sur fp_scale[:1500] → comparé aux moteurs JS par dictee/parity_os.js
        flags = []
        for s in fp[:1500]:
            F = tk(s); C._SEG = C._seg_info(s); tg = C.pos_tags(F)
            for i in range(len(F)):
                r = detect(F, i, TAU, tg)
                if r and r[0] != F[i]: flags.append([F[i], r[0]])
        print(json.dumps(sorted(flags), ensure_ascii=False)); sys.exit(0)
    fl = nv = 0
    for s in fp[:1500]:
        F = tk(s); C._SEG = C._seg_info(s); tg = C.pos_tags(F)
        for i in range(len(F)):
            if _vinfo(F[i]): nv += 1
            r = detect(F, i, TAU, tg)
            if r and r[0] != F[i]: fl += 1
    agr = []
    for l in open(os.path.join(HERE, '..', 'data_local', 'corpus_multi1000.jsonl'), encoding='utf-8'):
        try: d = json.loads(l)
        except: continue
        bad = d.get('bad', ''); a, b = tk(bad), tk(d.get('good', ''))
        for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b).get_opcodes():
            if op == 'replace':
                for k, (x, y) in enumerate(zip(a[i1:i2], b[j1:j2])):
                    vx, vy = _vinfo(x), _vinfo(y)
                    if x != y and vx and vy and vx[0] == vy[0] and vx[2] != vy[2] and vx[2] != '?' and vy[2] != '?': agr.append((bad, i1+k, x, y))
    seen = set(); agr = [t for t in agr if (t[2], t[3]) not in seen and not seen.add((t[2], t[3]))]
    rc = 0
    for bad, bi, x, y in agr:
        F = tk(bad); C._SEG = C._seg_info(bad); tg = C.pos_tags(F)
        if bi < len(F) and F[bi] == x and (detect(F, bi, TAU, tg) or (None,))[0] == y: rc += 1
    print("=== DÉTECTEUR OS-SUJET de référence (LM baké, τ=%.2f) ===" % TAU)
    print("  LM : %d entrées chargées | verbes UD testés %d" % (len(UNI)+len(TF)+len(TB)+len(BF)+len(BB), nv))
    print("  FLOOD (verbes UD corrects flaggués) : %d/%d = %.2f%%" % (fl, nv, 100*fl/max(1, nv)))
    print("  RECALL (accord dys réel proposé) : %d/%d = %.0f%%" % (rc, len(agr), 100*rc/max(1, len(agr))))
