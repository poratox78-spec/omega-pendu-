# -*- coding: utf-8 -*-
# Tables g2p ANGLAISES (VOW/NASAL/DBL/SEG/COND/ENTSIL) pour le clone du pendu — DATA-DRIVEN depuis
# lex_en.tsv (paires mot↔IPA). Le clone anglais ne doit contenir AUCUN français : l'algo g2p du
# moteur est agnostique de langue, seules ses TABLES sont FR → on les régénère en EN, exactement
# comme lex4_en / letter_freq_en. Méthode : alignement graphème↔phonème many-to-many par EM doux
# (forward-backward monotone), puis décodage 1-best → tally (graphème × contexte-droit → phonème
# argmax + surprisal h = entropie). Réutilise le tokeniseur IPA + l'inventaire GA de build_en_ngrams.
#   Sortie : dictee/g2p_en.json  (consommée par build_pendu_en.py)
#   Lancer : PYTHONUTF8=1 python dictee/build_g2p_en.py [n_words=20000] [iters=5]
import sys, io, os, json, unicodedata, collections, math
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
LEX = os.path.join(HERE, 'lex_en.tsv')
OUT = os.path.join(HERE, 'g2p_en.json')
NW   = int(sys.argv[1]) if len(sys.argv) > 1 else 20000
ITERS= int(sys.argv[2]) if len(sys.argv) > 2 else 5

if not os.path.exists(LEX):
    print('[FATAL] manquant :', LEX, '(régénérer via build_en_lex.py — maître gitignoré)'); sys.exit(1)

# ---- tokeniseur IPA + inventaire GA (source unique = build_en_ngrams.py, recopié verbatim) ----
STRIP = set("ˈˌ.ˑ|‖/[]() ​'ʼ‿-"); LONG = 'ː'; TIES = '͜͡'
MERGE2 = {('a','ɪ'),('a','ʊ'),('ɔ','ɪ'),('o','ʊ'),('e','ɪ'),('ə','ɹ'),('ə','r'),('t','ʃ'),('d','ʒ')}
def _bare(x): return ''.join(c for c in x if unicodedata.category(c) != 'Mn' and c != LONG)
def seg_ipa(s):
    out = []; cur = ''; merge_next = False
    for ch in s:
        if ch in STRIP:
            if cur: out.append(cur); cur = ''
            merge_next = False; continue
        if ch in TIES: cur += ch; merge_next = True; continue
        if unicodedata.category(ch) == 'Mn' or ch == LONG: cur += ch; continue
        if cur == '': cur = ch
        elif merge_next: cur += ch; merge_next = False
        else: out.append(cur); cur = ch
    if cur: out.append(cur)
    merged = []; i = 0
    while i < len(out):
        if i + 1 < len(out) and (_bare(out[i]), _bare(out[i+1])) in MERGE2:
            merged.append(out[i] + out[i+1]); i += 2
        else: merged.append(out[i]); i += 1
    return merged
EN_PHON = {'i','ɪ','ɛ','æ','ɑ','ɔ','ʊ','u','ʌ','ə','ɚ','eɪ','aɪ','ɔɪ','oʊ','aʊ',
           'p','b','t','d','k','ɡ','tʃ','dʒ','f','v','θ','ð','s','z','ʃ','ʒ','h','m','n','ŋ','l','ɹ','j','w'}
NORM = {'əɹ':'ɚ','ər':'ɚ','ɝ':'ɚ','ɜ':'ɚ','ɾ':'t','ʔ':'t','ɫ':'l','g':'ɡ','r':'ɹ','ɒ':'ɑ','ä':'ɑ',
        'ɐ':'ʌ','ɘ':'ə','ɵ':'oʊ','o':'oʊ','e':'ɛ','ɨ':'ɪ','ᵻ':'ɪ','ʉ':'u','ʍ':'w','ʋ':'v','ç':'h',
        'ɦ':'h','x':'k','q':'k','ʈ':'t','ɖ':'d','y':'i','ø':'ə','ā':'eɪ','ē':'i','ī':'aɪ','ō':'oʊ',
        'ū':'u','əʊ':'oʊ','ɪə':'ɪ','ɛə':'ɛ','ʊə':'ʊ'}
def _canon(p):
    b = ''.join(c for c in p if unicodedata.category(c) not in ('Mn','Lm','Sk') and c not in "ː:~ˑ")
    if not b: return None
    if b in EN_PHON: return b
    return NORM.get(b, None)

# ---- corpus : (mot en lettres a-z, séquence de phonèmes GA) ----
DBL   = ['bb','cc','dd','ff','gg','ll','mm','nn','pp','rr','ss','tt','zz']
# inventaire CURÉ des multigraphes anglais (linguistique standard, PAS arbitraire) : seuls ceux-ci
# peuvent être des blocs ≥2 lettres à l'alignement → segmentation propre (pas de "st"/"nt" spurieux).
# L'EM reste data-driven pour le PHONÈME de chaque graphème ; l'inventaire ne fait que borner la
# segmentation. Doubles inclus (l'algo moteur les mappe via la branche DBL).
MULTI = (['eigh','ough','augh','tion','sion','tch','igh','dge','sch']          # longs (4-3)
    + ['sh','ch','th','ph','wh','ck','ng','gh','qu','wr','kn','gn','mb','rh','ps']  # digraphes consonnes
    + ['ai','ay','au','aw','ea','ee','ei','eu','ew','ey','ie','oa','oe','oi','oo','ou','ow','oy','ue','ui','uy']  # digraphes voyelles
    + ['ar','er','ir','or','ur']                                                # voyelles r-contrôlées
    + DBL)
_MULTI_BY_LEN = sorted(MULTI, key=lambda x: -len(x))
MINSEG = 4   # un multigraphe curé n'entre dans SEG que s'il est décodé ≥ MINSEG fois (drop les rarissimes)
rows = []
with io.open(LEX, encoding='utf-8') as f:
    f.readline()
    for line in f:
        c = line.rstrip('\n').split('\t')
        if len(c) < 7: continue
        surf, ipa = c[0], c[2]
        try: fr = float(c[6])
        except: fr = 0.0
        if fr <= 0 or not ipa: continue
        w = ''.join(ch for ch in surf.lower() if 'a' <= ch <= 'z')
        if not (3 <= len(w) <= 15): continue
        ph = tuple(x for x in (_canon(y) for y in seg_ipa(ipa)) if x)
        if len(ph) < 2: continue
        rows.append((fr, w, ph))
rows.sort(key=lambda r: -r[0])
pairs = [(w, ph) for (fr, w, ph) in rows[:NW]]
print('corpus alignement : %d paires (sur %d candidates)' % (len(pairs), len(rows)), flush=True)

# ---- candidats de graphèmes à la position i : lettre seule + multigraphes CURÉS qui matchent ----
def gblocks(w, i):
    m = len(w); out = [(1, w[i])]
    for L in _MULTI_BY_LEN:
        l = len(L)
        if l <= m - i and w[i:i+l] == L: out.append((l, L))
    return out

# ---- EM doux (forward-backward monotone) ; pblock ∈ {0,1,2 phonèmes} ----
FLOOR = 1e-7
def fb_counts(w, ph, getP, cnt, tot):
    m = len(w); n = len(ph)
    G = [gblocks(w, i) for i in range(m)]
    a = [[0.0]*(n+1) for _ in range(m+1)]; a[0][0] = 1.0
    for i in range(m):
        ai = a[i]
        for j in range(n+1):
            a0 = ai[j]
            if a0 == 0.0: continue
            for (la, gb) in G[i]:
                ani = a[i+la]
                for b in (0, 1, 2):
                    nj = j + b
                    if nj > n: break
                    p = getP(gb, ph[j:nj])
                    if p > 0.0: ani[nj] += a0 * p
    Z = a[m][n]
    if Z <= 0.0: return 0.0
    be = [[0.0]*(n+1) for _ in range(m+1)]; be[m][n] = 1.0
    for i in range(m-1, -1, -1):
        for j in range(n, -1, -1):
            acc = 0.0
            for (la, gb) in G[i]:
                bni = be[i+la]
                for b in (0, 1, 2):
                    nj = j + b
                    if nj > n: break
                    p = getP(gb, ph[j:nj])
                    if p > 0.0: acc += p * bni[nj]
            be[i][j] = acc
    for i in range(m):
        ai = a[i]
        for j in range(n+1):
            a0 = ai[j]
            if a0 == 0.0: continue
            for (la, gb) in G[i]:
                bni = be[i+la]
                for b in (0, 1, 2):
                    nj = j + b
                    if nj > n: break
                    pb = ph[j:nj]; p = getP(gb, pb)
                    if p <= 0.0: continue
                    post = a0 * p * bni[nj] / Z
                    if post > 0.0:
                        k = (gb, pb); cnt[k] = cnt.get(k, 0.0) + post; tot[gb] = tot.get(gb, 0.0) + post
    return Z

P = {}
for it in range(ITERS):
    cnt = {}; tot = {}
    if it == 0:
        getP = lambda g, pb: 1.0
    else:
        def getP(g, pb, _P=P): return _P.get((g, pb), FLOOR)
    ok = 0
    for (w, ph) in pairs:
        if fb_counts(w, ph, getP, cnt, tot) > 0.0: ok += 1
    P = {k: v / tot[k[0]] for k, v in cnt.items()}
    print('  EM iter %d : %d mots alignés, %d entrées (g,pb)' % (it+1, ok, len(P)), flush=True)

# ---- décodage 1-best (Viterbi) + tally COND[graphème][contexte-droit] ----
def viterbi(w, ph):
    m = len(w); n = len(ph)
    G = [gblocks(w, i) for i in range(m)]
    NEG = float('-inf')
    dp = [[NEG]*(n+1) for _ in range(m+1)]; dp[0][0] = 0.0
    bp = [[None]*(n+1) for _ in range(m+1)]
    for i in range(m):
        for j in range(n+1):
            if dp[i][j] == NEG: continue
            base = dp[i][j]
            for (la, gb) in G[i]:
                for b in (0, 1, 2):
                    nj = j + b
                    if nj > n: break
                    p = P.get((gb, ph[j:nj]), FLOOR)
                    sc = base + math.log(p)
                    if sc > dp[i+la][nj]:
                        dp[i+la][nj] = sc; bp[i+la][nj] = (i, j, gb, ph[j:nj])
    if dp[m][n] == NEG: return None
    steps = []; i, j = m, n
    while not (i == 0 and j == 0):
        pi, pj, gb, pb = bp[i][j]; steps.append((gb, pb)); i, j = pi, pj
    steps.reverse(); return steps

# dist[gblock][ctx][pb_ipa] = poids
dist = collections.defaultdict(lambda: collections.defaultdict(lambda: collections.Counter()))
def ipa_of(pb): return '∅' if len(pb) == 0 else ''.join(pb)
for (w, ph) in pairs:
    st = viterbi(w, ph)
    if not st: continue
    pos = 0
    for (gb, pb) in st:
        rc = w[pos+len(gb)] if pos+len(gb) < len(w) else '#'
        s = ipa_of(pb)
        dist[gb][rc][s] += 1; dist[gb]['_'][s] += 1
        pos += len(gb)

def entropy(counter):
    tot = sum(counter.values())
    if tot <= 0: return 0.0
    h = 0.0
    for v in counter.values():
        p = v / tot
        if p > 0: h -= p * math.log2(p)
    return h

# COND_EN : {graphème : {ctx : [phonème_argmax_IPA, h]}} — h = entropie (surprisal du graphème)
COND = {}
for gb, ctxs in dist.items():
    ent = {}
    for ctx, ctr in ctxs.items():
        best = max(ctr.items(), key=lambda kv: kv[1])[0]
        ent[ctx] = [best, round(entropy(ctr), 3)]
    COND[gb] = ent

# SEG = multigraphes réellement décodés ≥ MINSEG fois, + tous les doubles (branche DBL du moteur).
def _usage(gb): return sum(dist[gb]['_'].values()) if gb in dist else 0
SEG = sorted({g for g in COND if len(g) >= 2 and (_usage(g) >= MINSEG or g in DBL)} | set(DBL),
             key=lambda x: -len(x))
tables = {
    'VOW': 'aeiouy',
    'NASAL': [],                 # l'anglais n'a pas le système nasal FR ; garde vide (l'algo saute la garde nasale)
    'DBL': list(DBL),
    'SEG': SEG,
    'COND': COND,
    'ENTSIL': [],                # spécifique FR (verbes en -ent muet) → vide en anglais
    'meta': {'n_words': len(pairs), 'iters': ITERS, 'graphemes': len(COND), 'seg': len(SEG)},
}
io.open(OUT, 'w', encoding='utf-8').write(json.dumps(tables, ensure_ascii=False))
print('ÉCRIT %s : %d graphèmes, %d SEG multigraphes' % (os.path.relpath(OUT, os.path.join(HERE, '..')), len(COND), len(SEG)), flush=True)

# ---- vérif : mini-g2p Python (miroir de l'algo moteur) → accuracy phonème/mot sur échantillon ----
VOW = set('aeiouy')
def g2p_en(word):
    w = ''.join(ch for ch in word.lower() if 'a' <= ch <= 'z')
    steps = []; i = 0
    while i < len(w):
        g = None
        for cand in SEG:
            if w.startswith(cand, i): g = cand; break
        if not g: g = w[i]
        nxt = w[i+len(g)] if i+len(g) < len(w) else '#'
        if g in DBL and (g[0] in COND):
            e = COND[g[0]].get('_'); ph = e[0] if e else g[0]
        else:
            t = COND.get(g); e = (t.get(nxt) or t.get('_')) if t else None; ph = e[0] if e else '?'
        steps.append(ph); i += len(g)
    return [p for p in steps if p and p != '∅']

# échantillon = 2000 mots au hasard-déterministe (pas dans l'ordre de fréquence) parmi les paires
import hashlib
def _lev(a, b):
    m, n = len(a), len(b)
    if m == 0: return n
    prev = list(range(n+1))
    for i in range(1, m+1):
        cur = [i] + [0]*n
        for j in range(1, n+1):
            cur[j] = min(prev[j]+1, cur[j-1]+1, prev[j-1] + (a[i-1] != b[j-1]))
        prev = cur
    return prev[n]
sample = sorted(pairs, key=lambda wp: hashlib.md5(wp[0].encode()).hexdigest())[:2000]
wok = 0; ed = 0; tot = 0
for (w, ph) in sample:
    pred = ''.join(g2p_en(w)); gold = ''.join(ph)   # chaînes IPA jointes (blocs multi-phonèmes gérés)
    if pred == gold: wok += 1
    ed += _lev(pred, gold); tot += max(1, len(gold))
print('vérif g2p_en : word-acc=%.1f%% (%d/%d) · phon-acc(1−CER)≈%.1f%%' %
      (100.0*wok/len(sample), wok, len(sample), 100.0*(1 - ed/tot)), flush=True)
