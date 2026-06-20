# -*- coding: utf-8 -*-
# COGNITION Phono→Ortho (p2g) — DÉCODEUR jointe §3 : donné un SON (phono SAMPA), produit la
# DISTRIBUTION des orthographes probables, en marginalisant sur la segmentation phonémique latente
# (beam-search). On NE fait PAS d'argmax par phonème : on CROISE deux sources molles —
#   (a) émission apprise  P(graphie | morceau-phono, phonème précédent, position finale)   [route SON]
#   (b) prior orthographique  P(suite de lettres)  (bigramme de caractères sur le lexique)  [route ORTHO]
# La décision émerge de la jointe émission × prior sur la séquence. Inverse du g2p, point dur dys.
#
# Table apprise : build_p2g.py → p2g_table.json. Lancer :
#   python3 dictee/p2g.py "wazo"        # un son SAMPA → top orthographes
#   python3 dictee/p2g.py --mot oiseau  # prend le phono du mot, montre ce que la cognition propose
#   python3 dictee/p2g.py --measure     # mesure held-out (top-k) + ablation du prior ortho (croisement)
#   python3 dictee/p2g.py --demo
import os, sys, json, math
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import decompose as D

LAMBDA = float(os.environ.get('P2G_LAMBDA', '1.0'))      # poids du prior ortho dans le croisement
BLEX = float(os.environ.get('P2G_LEX', '3.0'))           # bonus LEXICALITÉ : graphie qui EST un vrai mot
LEX = set(D.W2P)                                          # ensemble des vraies graphies du lexique
_P = os.path.join(HERE, 'p2g_table.json')
_RAW = json.load(open(_P, encoding='utf-8')) if os.path.exists(_P) else {'table': {}}
TABLE = _RAW.get('table', {})

# ── émission : clés (morceau,prev,fin) → distribution ; replis (morceau,fin) puis (morceau) ──
LOGP = {}; _MF = defaultdict(lambda: defaultdict(int)); _M = defaultdict(lambda: defaultdict(int))
for _key, _cnt in TABLE.items():
    _tot = sum(_cnt.values()); LOGP[_key] = [(g, math.log(c / _tot)) for g, c in _cnt.items()]
    _ch, _pv, _fin = _key.split('\t')
    for g, c in _cnt.items():
        _MF[(_ch, _fin)][g] += c; _M[_ch][g] += c
def _norm(d):
    t = sum(d.values()); return sorted([(g, math.log(c / t)) for g, c in d.items()], key=lambda x: -x[1])
MARGFIN = {k: _norm(v) for k, v in _MF.items()}          # (morceau,fin) → [(graphie,logp)]
MARG = {k: _norm(v) for k, v in _M.items()}              # morceau → [(graphie,logp)]
BACKOFF = math.log(0.3); IDENT = math.log(1e-4)

def _emit(chunk, prev, fin):
    k = chunk + '\t' + prev + '\t' + fin
    if k in LOGP: return LOGP[k]
    if (chunk, fin) in MARGFIN: return [(g, lp + BACKOFF) for g, lp in MARGFIN[(chunk, fin)][:8]]
    if chunk in MARG: return [(g, lp + 2 * BACKOFF) for g, lp in MARG[chunk][:8]]
    return [(chunk, IDENT)]

# ── prior ORTHOGRAPHIQUE (route ortho) : bigramme de caractères appris sur les graphies du lexique ──
_OB = defaultdict(lambda: defaultdict(float)); _OT = defaultdict(float)
for _w in D.W2P:
    s = '^' + _w + '$'
    for a, b in zip(s, s[1:]):
        _OB[a][b] += 1.0; _OT[a] += 1.0
def ortho_logp(spelling):
    """log-vraisemblance moyenne par caractère de la graphie sous le bigramme ortho (lissé)."""
    s = '^' + spelling + '$'; lp = 0.0
    for a, b in zip(s, s[1:]):
        lp += math.log((_OB[a][b] + 0.1) / (_OT[a] + 0.1 * 40))
    return lp / max(1, len(s) - 1)


def decode(phono, k=10, beam=80, lam=None, blex=None):
    """Beam émission, puis re-classement par la JOINTE émission + lam·prior_ortho + blex·lexicalité
    (croisement §3 : route SON × route ORTHO × est-ce un vrai mot)."""
    lam = LAMBDA if lam is None else lam
    bl = BLEX if blex is None else blex
    if not phono: return []
    n = len(phono); layer = {0: [(0.0, '')]}
    for pos in range(n):
        if pos not in layer: continue
        cur = sorted(layer[pos], key=lambda x: -x[0])[:beam]
        prev = phono[pos - 1] if pos > 0 else '#'
        for L in (1, 2, 3):
            if pos + L > n: continue
            fin = '1' if pos + L == n else '0'
            for g, lp in _emit(phono[pos:pos + L], prev, fin):
                dst = layer.setdefault(pos + L, [])
                for plp, psp in cur: dst.append((plp + lp, psp + g))
    agg = {}                                              # marginalise les alignements → graphie cumulée
    for lp, sp in layer.get(n, []):
        if sp not in agg or lp > agg[sp]: agg[sp] = lp
    if not agg: return []
    cand = sorted(agg.items(), key=lambda x: -x[1])[:40]  # croisement sur les meilleures hypothèses d'émission
    scored = [(sp, em + lam * ortho_logp(sp) + (bl if sp in LEX else 0.0)) for sp, em in cand]
    mx = max(s for _, s in scored); Z = sum(math.exp(s - mx) for _, s in scored)
    return [(sp, math.exp(s - mx) / Z) for sp, s in sorted(scored, key=lambda x: -x[1])[:k]]


def measure(seed=42, n_test=4000):
    if not TABLE:
        print("[p2g] table absente — lance build_p2g.py."); return
    _, test = D.inlex_split(seed); test = test[:n_test]
    print(f"=== COGNITION phono→ortho — HELD-OUT (test={len(test)}, seed={seed}) ===")
    print("    « donné le SON, la vraie ORTHOGRAPHE est-elle proposée ? » (top-k)")
    for tag, lam, bl in (('émission seule', 0.0, 0.0), ('+ prior ortho croisé', LAMBDA, 0.0),
                         (f'+ lexicalité (β={BLEX})', LAMBDA, BLEX)):
        t1 = t3 = t5 = t10 = 0
        for w in test:
            res = decode(D.W2P[w], k=10, lam=lam, blex=bl); spell = [s for s, _ in res]; tgt = w.lower()
            r = (spell.index(tgt) + 1) if tgt in spell else 0
            t1 += (r == 1); t3 += (1 <= r <= 3); t5 += (1 <= r <= 5); t10 += (r >= 1)
        N = len(test)
        print(f"    [{tag:24}] top-1 {100*t1/N:5.1f}%  top-3 {100*t3/N:5.1f}%  top-5 {100*t5/N:5.1f}%  top-10 {100*t10/N:5.1f}%")
    homoph = sum(max(0, D.GROUP.get(D.W2P[w], 1) - 1) for w in test) / len(test)
    print(f"    (ambiguïté intrinsèque : {homoph:.2f} homophone(s) Lexique/mot → plafond top-1 < 100%)")
    for w in ('eau', 'oiseau', 'chat', 'maison', 'bateau'):       # phono RÉEL des mots connus
        gold = D.W2P.get(w)
        if not gold: continue
        props = [s for s, _ in decode(gold, k=6)]
        print(f"    « {w} » /{gold}/ → {props[:6]}  {'✓' if w in props else '·manque'}")


def show(phono):
    print(f"/{phono}/  → orthographes probables :")
    for sp, p in decode(phono, k=10):
        print(f"    {p*100:5.1f}%  {sp}")

def demo():
    print("=== phono → ortho : le son donne plusieurs graphies, la cognition les CROISE et classe ===\n")
    for son in ('o', '5', 'so', 'vER', 'mEz§'):           # /o/, /ɛ̃/, /so/, /vɛʁ/ (ver/vert/verre), /mɛzɔ̃/
        show(son); print()

def main(argv):
    if not argv:
        print("Usage : p2g.py \"<phono SAMPA>\" | --mot <mot> | --measure | --demo"); return 0
    if argv[0] == '--measure': measure(); return 0
    if argv[0] == '--demo': demo(); return 0
    if argv[0] == '--mot':
        if len(argv) < 2: print("précise un mot"); return 1
        w = argv[1].lower(); phono = D.W2P.get(w) or D.sublexical_phon(w)[0]
        print(f"mot « {w} » → phono /{phono}/"); show(phono); return 0
    for a in argv: show(a)
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
