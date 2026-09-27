# -*- coding: utf-8 -*-
u"""SONDE — « penser le son à partir du plateau » : M1 (entendre le plateau) → M2 (le son attendu) → voie B (sons →
lettres), SANS TRICHE, en français.

Question (Rem, 27/09/2026) : sur un mot INCONNU, la seule source de son permise est le plateau. En humain : on prononce
ce qu'on voit (M1), on « pense » les sons qui manquent (M2), on les change en lettres (voie B). Ce chemin aide-t-il à
choisir la bonne lettre, EN PLUS du n-gram de lettres qu'a déjà le moteur ?

Règles : les mots test (7-12 lettres, 10 % par empreinte CRC) sont absents de TOUTES les tables (alignement, n-gram de
lettres, M1, M2, P2G). M1 ne voit que les lettres RÉVÉLÉES et leurs voisines révélées — jamais la prononciation du mot
test. Deux RÉFÉRENCES à part, pour chiffrer la triche : « M1 oracle » (les vrais sons des lettres révélées, calculés sur
le mot entier — ce que faisait la sonde anglaise du 02/08) et « mot entendu » (le vrai son de la case cachée — le
régime du 74 %).

Mesure : sur des plateaux de milieu de partie, la lettre que chaque méthode jouerait est-elle dans le mot ?
Taux de coups justes, apparié plateau par plateau (McNemar).

VERDICT (27/09/2026, 4 000 mots test, 8 000 plateaux, déterministe) : AUCUNE variante du son pensé depuis le plateau
n'aide le n-gram de lettres (73,8 %) ; toutes le dégradent (cascade 71,9 %, produit 69,8-71,7 %, sons seuls 64,7 %).
Même avec les VRAIS sons des lettres révélées (M1 oracle) : 73,5 %. Le vrai son de la case cachée (mot entendu) : 99,0 %.
Le son qu'on peut tirer du plateau est déjà dans ses lettres — et le passage par le son en perd (plusieurs graphies pour
un même son).
Ce qui manque à un mot inconnu, c'est un son venu d'AILLEURS : le mot dit à voix haute (voie B). JOURNAL 2026-09-27.

Le lexique est lu DANS le monolithe (bloc `lex4-data-gz`, base64 + gzip), exactement celui du moteur (vérifié identique
mot pour mot au lexique chargé par `fitness_harness.js`). Comme le banc, la sonde cherche `../app/omega-pendu.html` :
copiée dans le labo (`data_local/pendu_labo/evo/`), elle mesure la copie.

    python evo/sonde_phon_plateau.py            (NTEST=4000 par défaut, ~3 min ; NTEST=500 pour un essai rapide)
"""
import base64, gzip, json, os, re, sys, zlib, random, math, collections

sys.stdout.reconfigure(encoding='utf-8')
ICI = os.path.dirname(os.path.abspath(__file__))
AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
EPS = '_'
APP = os.path.join(ICI, '..', 'app', 'omega-pendu.html')
_html = open(APP, encoding='utf-8').read()
_bloc = re.search(r'<script[^>]*id="lex4-data-gz"[^>]*>(.*?)</script>', _html, re.S)
if not _bloc:
    sys.exit(u'✗ bloc lex4-data-gz introuvable dans ' + APP)
_lex = json.loads(gzip.decompress(base64.b64decode(_bloc.group(1).strip())).decode('utf-8'))
MOTS = [(w['m'], w['p'], w.get('f', 0)) for w in _lex['words']
        if w.get('m') and w.get('p') and re.fullmatch('[A-Z]+', w['m'])]
del _html, _bloc, _lex


def est_test(m):
    return 7 <= len(m) <= 12 and zlib.crc32(m.encode()) % 10 == 0


train = [(m, p, f) for m, p, f in MOTS if not est_test(m)]
test_tous = [(m, p) for m, p, f in MOTS if est_test(m)]
rng = random.Random(27092026)
rng.shuffle(test_tous)
NTEST = int(os.environ.get('NTEST', '4000'))
test = test_tous[:NTEST]
print(u'entraînement %d mots · test %d mots (sur %d mis de côté, jamais vus par aucune table)'
      % (len(train), len(test), len(test_tous)))

# ── 1. alignement lettre → son (EM « dur », comme _emrg_initG2P du moteur), sur l'ENTRAÎNEMENT seulement ────────────
PH = sorted({c for _, p, _ in train for c in p} | {EPS})
PHI = {c: i for i, c in enumerate(PH)}
NP = len(PH)
NEG = -1e18


def ci(g):
    return ord(g) - 65


def logtab(em):
    L = []
    for g in range(26):
        s = sum(em[g])
        L.append([math.log(v / s) if v > 0 else -30.0 for v in em[g]])
    return L


def aligner(m, p, L):
    N, M = len(m), len(p)
    if M > N:
        return None
    dp = [[NEG] * (M + 1) for _ in range(N + 1)]
    bk = [[0] * (M + 1) for _ in range(N + 1)]
    dp[0][0] = 0.0
    for i in range(1, N + 1):
        row = L[ci(m[i - 1])]
        e = row[PHI[EPS]]
        prev = dp[i - 1]
        cur = dp[i]
        for j in range(0, min(i, M) + 1):
            best = prev[j] + e if prev[j] > NEG else NEG
            b = 0
            if j > 0 and prev[j - 1] > NEG:
                v = prev[j - 1] + row[PHI[p[j - 1]]]
                if v > best:
                    best, b = v, 1
            cur[j] = best
            bk[i][j] = b
    if dp[N][M] <= NEG / 2:
        return None
    out, i, j = [], N, M
    while i > 0:
        if bk[i][j] == 1:
            out.append(p[j - 1]); i -= 1; j -= 1
        else:
            out.append(EPS); i -= 1
    return out[::-1]


emit = [[0.1] * NP for _ in range(26)]
for m, p, _ in train[:60000]:
    ps = set(p)
    for g in m:
        for ph in ps:
            emit[ci(g)][PHI[ph]] += 1
        emit[ci(g)][PHI[EPS]] += 0.5
for it in range(4):
    L = logtab(emit)
    cnt = [[0.01] * NP for _ in range(26)]
    for m, p, _ in train[:60000]:
        al = aligner(m, p, L)
        if al:
            for g, lab in zip(m, al):
                cnt[ci(g)][PHI[lab]] += 1
    emit = cnt
LOGE = logtab(emit)
ALIGN = []
for m, p, _ in train:
    al = aligner(m, p, LOGE)
    if al:
        ALIGN.append((m, al))
print(u'alignés : %d / %d mots d\'entraînement' % (len(ALIGN), len(train)))

# ── 2. les tables (ENTRAÎNEMENT seulement) ────────────────────────────────────────────────────────────────────────────
def nouv():
    return collections.defaultdict(collections.Counter)


UNI, BL, BR, TRI = nouv(), nouv(), nouv(), nouv()          # n-gram de lettres positionnel, comme _neoEnsureNG
for m, _, _ in train:
    n = len(m)
    if not 7 <= n <= 12:
        continue
    for q, c in enumerate(m):
        UNI[(n, q)][c] += 1
        if q > 0: BL[(n, q, m[q - 1])][c] += 1
        if q < n - 1: BR[(n, q, m[q + 1])][c] += 1
        if 0 < q < n - 1: TRI[(n, q, m[q - 1], m[q + 1])][c] += 1

M1, M2, P2G, M2P = nouv(), nouv(), nouv(), nouv()
for m, lab in ALIGN:
    n = len(m)
    for q in range(n):
        g = m[q]
        lg = m[q - 1] if q > 0 else '#'
        rg = m[q + 1] if q < n - 1 else '#'
        # M1 : le son d'une lettre VUE, selon ses voisines vues (inconnue = '*')
        for k in ((g, lg, rg), (g, lg, '*'), (g, '*', rg), (g, '*', '*')):
            M1[k][lab[q]] += 1
        # M2 : le son d'une case, selon les sons de ses voisines (bord = '#', inconnu = '*')
        ll = lab[q - 1] if q > 0 else '#'
        rl = lab[q + 1] if q < n - 1 else '#'
        for k in ((ll, rl), (ll, '*'), ('*', rl), ('*', '*')):
            M2[k][lab[q]] += 1
        if 7 <= n <= 12:
            for k in ((n, q, ll, rl), (n, q, ll, '*'), (n, q, '*', rl), (n, q, '*', '*')):
                M2P[k][lab[q]] += 1
        # voie B (P2G) : la lettre d'un son, selon les lettres voisines vues
        for k in ((lab[q], lg, rg), (lab[q], lg, '*'), (lab[q], '*', rg), (lab[q], '*', '*')):
            P2G[k][g] += 1
FREQ = collections.Counter(c for m, _, _ in train for c in m)


def norm(cn):
    s = sum(cn.values())
    return {k: v / s for k, v in cn.items()} if s else {}


def pioche(table, cles, mini=2):
    for k in cles:
        c = table.get(k)
        if c and sum(c.values()) >= mini:
            return norm(c)
    return {}


# ── 3. les distributions par case cachée ─────────────────────────────────────────────────────────────────────────
def voisins(mot, vu, q):
    n = len(mot)
    lg = (mot[q - 1] if vu[q - 1] else '*') if q > 0 else '#'
    rg = (mot[q + 1] if vu[q + 1] else '*') if q < n - 1 else '#'
    return lg, rg


def d_ortho(mot, vu, q):                               # = _neoLetterNgramDist (sans gap) : tri → bl → br → uni
    n = len(mot)
    lg = mot[q - 1] if q > 0 and vu[q - 1] else None
    rg = mot[q + 1] if q < n - 1 and vu[q + 1] else None
    for tab, k, ok in ((TRI, (n, q, lg, rg), lg and rg), (BL, (n, q, lg), lg), (BR, (n, q, rg), rg), (UNI, (n, q), True)):
        if ok and tab.get(k):
            return norm(tab[k])
    return {}


def son_vu(mot, vu, q, oracle=None):                   # M1 : l'étiquette la plus probable d'une lettre révélée
    if oracle is not None:
        return oracle[q]
    lg, rg = voisins(mot, vu, q)
    d = pioche(M1, ((mot[q], lg, rg), (mot[q], lg, '*'), (mot[q], '*', rg), (mot[q], '*', '*')), 1)
    return max(d, key=d.get) if d else '*'


def d_phon(mot, vu, q, oracle=None, entendu=None, pos=False):
    n = len(mot)
    lg, rg = voisins(mot, vu, q)
    if entendu is not None:                            # RÉFÉRENCE « mot entendu » : le vrai son de la case cachée
        dl = {entendu[q]: 1.0}
    else:
        ll = (son_vu(mot, vu, q - 1, oracle) if vu[q - 1] else '*') if q > 0 else '#'
        rl = (son_vu(mot, vu, q + 1, oracle) if vu[q + 1] else '*') if q < n - 1 else '#'
        if pos:                                                              # M2 positionnel d'abord
            dl = (pioche(M2P, ((n, q, ll, rl), (n, q, ll, '*'), (n, q, '*', rl), (n, q, '*', '*')), 3)
                  or pioche(M2, ((ll, rl), (ll, '*'), ('*', rl), ('*', '*'))))
        else:
            dl = pioche(M2, ((ll, rl), (ll, '*'), ('*', rl), ('*', '*')))       # M2 : le son attendu
    out = collections.Counter()
    for lab, pl in dl.items():                                               # voie B : son → lettre
        for x, px in pioche(P2G, ((lab, lg, rg), (lab, lg, '*'), (lab, '*', rg), (lab, '*', '*'))).items():
            out[x] += pl * px
    s = sum(out.values())
    return {k: v / s for k, v in out.items()} if s else {}


def produit(a, b, lam=1.0):
    if not b:
        return a
    o = {x: a.get(x, 0) * (b.get(x, 0) + 1e-6) ** lam for x in AZ}
    s = sum(o.values())
    return {k: v / s for k, v in o.items()} if s else a


# ── 4. les plateaux de milieu de partie, et le coup que chaque méthode jouerait ──────────────────────────────────────
ORDRE = [c for c, _ in FREQ.most_common()]
RANG = {c: i for i, c in enumerate(ORDRE)}


def plateaux(m, r):
    # ⚠️ jamais l'ordre d'un set : il change à chaque lancement (hachage aléatoire de Python) et avec lui les tirages
    # — deux lancements donnaient 73,6 et 73,8 %. Trié d'abord, les plateaux sont les mêmes à chaque fois.
    distinctes = sorted(sorted(set(m)), key=lambda c: RANG[c] + r.uniform(-3, 3))
    out = []
    for _ in range(2):
        k = max(1, round(r.uniform(0.25, 0.7) * len(distinctes)))
        rev = set(distinctes[:k]) if r.random() < 0.7 else set(r.sample(distinctes, k))
        if rev == set(m):
            rev = set(sorted(rev)[:-1])
        absentes = [c for c in ORDRE if c not in m]
        ratees = set(absentes[:r.randint(0, 3)])
        out.append((rev, ratees))
    return out


def joue(mot, vu, essayees, dist_par_case):
    score = collections.Counter()
    for q in range(len(mot)):
        if vu[q]:
            continue
        for x, v in dist_par_case(q).items():
            if x not in essayees:
                score[x] += v
    if not score:
        return None
    return max(sorted(score), key=lambda x: (score[x], -RANG[x]))


METHODES = ['fréquence seule', 'n-gram de lettres (moteur)', 'sons du plateau (M1→M2→voie B)',
            'sons → lettres (cascade, top 5)', 'lettres → sons (cascade, top 5)', 'lettres × sons', 'lettres × sons^0,5',
            'sons positionnels seuls', 'lettres × sons positionnels', 'lettres × sons positionnels^0,5',
            'RÉF. lettres × sons, M1 oracle (sonde EN)', 'RÉF. mot entendu (son exact)', 'RÉF. lettres × mot entendu']
coups = {k: [] for k in METHODES}
r = random.Random(1789)
nb = 0
for m, p in test:
    al_test = aligner(m, p, LOGE)                      # sert UNIQUEMENT aux deux références
    for rev, ratees in plateaux(m, r):
        vu = [c in rev for c in m]
        if all(vu):
            continue
        essayees = rev | ratees
        nb += 1
        cache_o, cache_p, cache_pp = {}, {}, {}
        def pp(q):
            if q not in cache_pp: cache_pp[q] = d_phon(m, vu, q, pos=True)
            return cache_pp[q]
        def o(q):
            if q not in cache_o: cache_o[q] = d_ortho(m, vu, q)
            return cache_o[q]
        def ph(q):
            if q not in cache_p: cache_p[q] = d_phon(m, vu, q)
            return cache_p[q]
        choix = {
            'fréquence seule': next((c for c in ORDRE if c not in essayees), None),
            'n-gram de lettres (moteur)': joue(m, vu, essayees, o),
            'sons du plateau (M1→M2→voie B)': joue(m, vu, essayees, ph),
            'lettres × sons': joue(m, vu, essayees, lambda q: produit(o(q), ph(q), 1.0)),
            'lettres × sons^0,5': joue(m, vu, essayees, lambda q: produit(o(q), ph(q), 0.5)),
            'sons positionnels seuls': joue(m, vu, essayees, pp),
            'lettres × sons positionnels': joue(m, vu, essayees, lambda q: produit(o(q), pp(q), 1.0)),
            'lettres × sons positionnels^0,5': joue(m, vu, essayees, lambda q: produit(o(q), pp(q), 0.5)),
        }
        # cascade inverse : le n-gram de lettres propose 5 lettres, les sons tranchent
        sc_o = collections.Counter()
        for q in range(len(m)):
            if not vu[q]:
                for x, v in o(q).items():
                    if x not in essayees: sc_o[x] += v
        top5o = set(sorted(sc_o, key=lambda x: -sc_o[x])[:5])
        choix['lettres → sons (cascade, top 5)'] = joue(m, vu, essayees | (set(AZ) - top5o), ph) if top5o else choix['n-gram de lettres (moteur)']
        # cascade : les sons proposent 5 lettres, le n-gram de lettres tranche entre elles
        sc_p = collections.Counter()
        for q in range(len(m)):
            if not vu[q]:
                for x, v in ph(q).items():
                    if x not in essayees: sc_p[x] += v
        top5 = set(sorted(sc_p, key=lambda x: -sc_p[x])[:5])
        choix['sons → lettres (cascade, top 5)'] = joue(m, vu, essayees | (set(AZ) - top5), o) if top5 else choix['n-gram de lettres (moteur)']
        if al_test:
            choix['RÉF. lettres × sons, M1 oracle (sonde EN)'] = joue(m, vu, essayees, lambda q: produit(o(q), d_phon(m, vu, q, oracle=al_test), 1.0))
            choix['RÉF. mot entendu (son exact)'] = joue(m, vu, essayees, lambda q: d_phon(m, vu, q, entendu=al_test))
            choix['RÉF. lettres × mot entendu'] = joue(m, vu, essayees, lambda q: produit(o(q), d_phon(m, vu, q, entendu=al_test), 1.0))
        else:
            for k in [x for x in METHODES if x.startswith('RÉF.')]:
                choix[k] = choix['n-gram de lettres (moteur)']
        cachees = {m[q] for q in range(len(m)) if not vu[q]}
        for k in METHODES:
            coups[k].append(1 if choix.get(k) in cachees else 0)

print(u'\n%d plateaux de milieu de partie (2 par mot test) — la lettre jouée est-elle dans le mot ?\n' % nb)
base = coups['n-gram de lettres (moteur)']


def pmcnemar(a, b):
    g = sum(1 for x, y in zip(a, b) if y and not x)
    pe = sum(1 for x, y in zip(a, b) if x and not y)
    if g + pe == 0:
        return g, pe, 1.0
    chi = (abs(g - pe) - 1) ** 2 / (g + pe)
    return g, pe, math.erfc(math.sqrt(chi / 2))


for k in METHODES:
    v = coups[k]
    t = 100 * sum(v) / len(v)
    ic = 196 * math.sqrt(t / 100 * (1 - t / 100) / len(v))
    if k == 'n-gram de lettres (moteur)' or k == 'fréquence seule':
        print(u'  %-44s %5.1f %% ± %.1f' % (k, t, ic))
    else:
        g, pe, pv = pmcnemar(base, v)
        print(u'  %-44s %5.1f %% ± %.1f   vs n-gram : +%d / −%d  (p %s)' % (k, t, ic, g, pe, ('%.1e' % pv) if pv < 0.01 else '%.2f' % pv))
