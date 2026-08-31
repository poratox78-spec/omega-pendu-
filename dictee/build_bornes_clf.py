# -*- coding: utf-8 -*-
"""build_bornes_clf.py — entraîne le classifieur de BORNES DE PROPOSITION (canal GROUPE)
et produit dictee/bornes_clf.json (poids + biais + seuil). Dérivé UD French GSD (CC BY-SA 4.0).

Industrialise le pipeline mesuré en phase-mesure (sonde bornes_probe, chantier bornes 31/08/2026) :
or STRUCTUREL « or-TOUT » construit depuis les arbres UD (clause 2 bords + adjoncts en tête +
appositions/dislocations + énumérations + discourse ; bords par POSITION DE CARACTÈRE — un calcul
par index de token perdait les mots-chiffres « En 2004 »), features tirées des primitives RÉELLES
de correcteur_probe (tags HMM, _seg_info, _ELIDED_PRON), régression logistique ~170 poids.
Mesuré en phase-mesure (held-out) : P 85,1 % / R 49,6 % @0,5 · P 98,2 % / R 36,5 % @0,9.

DONNÉES : UD French GSD CoNLL-U dans $UDFR (défaut /tmp/udfr). Absent -> « SAUTÉ », exit 0.

DÉTERMINISME :
  - ordre de phrases = ordre corpus (fichiers *.conllu TRIÉS, phrases dans l'ordre du fichier) ;
  - split SANS random : held-out = les N_HELDOUT (2000) premières phrases ALIGNÉES, entraînement
    = les N_TRAIN (4000) suivantes (disjoint par construction, même split que la phase-mesure) ;
  - le seul random = le mélange des phrases à chaque époque, random.Random(seed=42) figé ;
  - le JSON est trié + arrondi 4 décimales -> diff stable d'une exécution à l'autre.

GARDES (exit 1, JSON NON écrit) : P@0,5 >= BORNES_P_MIN (défaut 80 %) et R@0,5 >= BORNES_R_MIN
(défaut 40 %) sur held-out — marges anti-flaky sous les 85,1/49,6 attendus. Les P/R imprimés et
gardés sont mesurés avec les poids ARRONDIS (= exactement ceux du JSON, ceux du miroir).

SORTIE dictee/bornes_clf.json :
  {"w": {nom_feature: poids}, "b": biais, "tau": 0.5, "meta": {p05, r05, p07, r07, p09, r09,
   n_train, n_heldout, cible, licence}}

================================ CONTRAT D'EXTRACTION ================================
(le miroir JS des 3 moteurs doit le reproduire trait pour trait)

Entrée : T = tokens lettres de la phrase (regex [A-Za-zÀ-ÿœŒ'] ; apostrophes ’ʼ normalisées
en ') ; tg = pos_tags(T) (Viterbi HMM 16 tags UPOS embarqué, déjà dans les 3 moteurs) ;
ss[i] = vrai ssi un . ! ? … précède le token i (le champ 'ss' de _seg_info, déjà porté).
Une borne à la position i (i de 1 à n-1, JAMAIS 0) = « une frontière de proposition s'ouvre
DEVANT le token i ».

ÉTAT (balayage gauche->droite) : last_b = position de la dernière borne (init 0) ;
vu_verbe = un VERB/AUX vu depuis la dernière borne (init : tg[0] in (VERB, AUX)).

À chaque position i, DANS CET ORDRE :
  1. si ss[i] : last_b = i ; vu_verbe = faux.
  2. extraire les features (liste ci-dessous) ; z = b + somme des poids w[f] (poids absent = 0,
     accumulé DANS L'ORDRE des features) ; p = 1/(1+exp(-clamp(z, -30, +30))).
  3. si p >= tau : BORNE en i ; last_b = i ; vu_verbe = faux.
     (à l'entraînement, l'état est mis à jour par l'OR, pas par la prédiction — teacher forcing)
  4. si tg[i] in (VERB, AUX) : vu_verbe = vrai.

FEATURES à la position i (lw = T[i].lower(), lw0 = T[i-1].lower()), dans cet ordre :
  a. 'tg-1=' + tg[i-1]                        (tag HMM du token AVANT la frontière)
  b. 'tg0='  + tg[i]                          (tag HMM du token APRÈS = celui que la borne ouvre)
  c. si lw  dans FUNC : 'w='   + lw           (mot-fonction à la position ; liste FUNC ci-dessous
                                               — le miroir peut se contenter du lookup w['w='+lw],
                                               les mots hors FUNC n'ont jamais de poids)
  d. si lw commence par « qu' » : 'w=ELIDQU'
  e. si _ELIDED_PRON matche lw : 'w=ELIDPRON' (^(qu|s|n|c|j|l|d|m|t|puisqu|lorsqu|quoiqu)['’]
                                               (il|ils|elle|elles|on|je|tu|nous|vous)$)
  f. si lw0 dans FUNC : 'w-1=' + lw0          (mot-fonction AVANT la frontière)
  g. si vu_verbe : 'vu_verbe'
  h. d = i - last_b, bucketé : 'dist=1' (d<=1) · 'dist=2' · 'dist=3-5' · 'dist=6-10' · 'dist=11+'
  i. si vu_verbe et tg[i]=='DET' : 'vu_verbe&DET'
Le biais b est hors dictionnaire (clé "b" du JSON), TOUJOURS sommé en premier.
=====================================================================================

Usage : UDFR=/tmp/udfr python3 dictee/build_bornes_clf.py
"""
import os, re, sys, glob, json, math, random
from collections import defaultdict

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import correcteur_probe as C

UDFR = os.environ.get('UDFR', '/tmp/udfr')
OUT = os.path.join(HERE, 'bornes_clf.json')
N_HELDOUT = 2000          # les N premières phrases alignées = held-out (comme la phase-mesure)
N_TRAIN = 4000            # les N suivantes = entraînement (disjoint par construction)
P_MIN = float(os.environ.get('BORNES_P_MIN', '80'))
R_MIN = float(os.environ.get('BORNES_R_MIN', '40'))

_TOKRE = re.compile(r"[A-Za-zÀ-ÿœŒ'’ʼ]+")   # même motif que diag_sentence.toks / la phase-mesure

# mots-fonction observés à une frontière (liste FIGÉE de la phase-mesure ; fait partie du contrat)
FUNC = {'que', 'qui', 'dont', 'où', 'quand', 'lorsque', 'puisque', 'si', 'comme', 'et', 'ou',
        'mais', 'car', 'alors', 'tandis', 'parce', 'puis', 'donc', 'enfin', 'ensuite',
        'cependant', 'toutefois', 'bien', 'afin', 'avant', 'après', 'pendant', 'depuis', 'dès',
        'pour', 'sans', 'sur', 'dans', 'en', 'par', 'avec', 'ce', 'cette', 'ces', 'il', 'elle',
        'ils', 'elles', 'on', 'je', 'tu', 'nous', 'vous', 'le', 'la', 'les', 'un', 'une', 'des',
        'du', 'au', 'aux', 'à', 'de', 'ne', 'se', 'est', 'sont', 'a', 'ont'}


def _norm(s):
    return s.replace('’', "'").replace('ʼ', "'")


# ---- cache pos_tags (déterministe : même T -> mêmes tags ; évite 8 recalculs Viterbi/phrase)
_PT = {}
def pos_cached(T):
    k = tuple(T)
    r = _PT.get(k)
    if r is None:
        r = C.pos_tags(T)
        _PT[k] = r
    return r


# ---------------- lecture UD + alignement caractère (repris de la phase-mesure) ----------------
def conllu_iter(d):
    for f in sorted(glob.glob(os.path.join(d, '*.conllu'))):
        text, rows = None, []
        for ln in open(f, encoding='utf-8', errors='ignore'):
            ln = ln.rstrip('\n')
            if not ln:
                if text and rows:
                    yield text, rows
                text, rows = None, []
            elif ln.startswith('# text = '):
                text = ln[9:].strip()
            elif ln[0] != '#':
                c = ln.split('\t')
                if len(c) >= 8:
                    rows.append(c)
        if text and rows:
            yield text, rows


def align_spans(text_n, rows):
    """Position de caractère (début, fin) de chaque mot UD dans le texte normalisé."""
    spans, pos, covered = {}, 0, 0
    for c in rows:
        cid = c[0]
        if '.' in cid:
            continue
        if '-' in cid:
            a, b = cid.split('-')
            form = _norm(c[1])
            k = text_n.find(form, pos)
            if k < 0:
                return None
            for w in range(int(a), int(b) + 1):
                spans[w] = (k, k + len(form))
            pos = k + len(form)
            covered = int(b)
            continue
        wid = int(cid)
        if wid <= covered:
            continue
        form = _norm(c[1])
        if form == '_':
            continue
        k = text_n.find(form, pos)
        if k < 0:
            return None
        spans[wid] = (k, k + len(form))
        pos = k + len(form)
    return spans


# ---------------- or STRUCTUREL « or-TOUT » depuis l'arbre UD ----------------
def gold_tout(words, children, spans, tokm):
    """Bornes-or (indices de TOKEN ; 0 et n exclus) : clause 2 bords (advcl/ccomp/csubj/parataxis/
    acl:relcl/xcomp+nsubj/conj-verbal) + adjonct en tête (bord droit) + appos/dislocated (2 bords)
    + énumération (bord gauche d'un conj non verbal) + discourse (2 bords).
    Bords par POSITION DE CARACTÈRE — robuste aux mots-chiffres, absents de T."""
    n_tok = len(tokm)
    out = set()

    def subtree_charspan(v):
        lo, hi = None, None
        stack, seen = [v], set()
        while stack:
            x = stack.pop()
            if x in seen:
                continue
            seen.add(x)
            sp = spans.get(x)
            if sp is not None:
                if lo is None or sp[0] < lo:
                    lo = sp[0]
                if hi is None or sp[1] > hi:
                    hi = sp[1]
            stack.extend(children.get(x, ()))
        return lo, hi

    def tok_left(clo):
        for k, (a, b) in enumerate(tokm):
            if b > clo:
                return k
        return None

    def tok_right(chi):
        """Premier token APRÈS le sous-arbre."""
        for k, (a, b) in enumerate(tokm):
            if a >= chi:
                return k
        return None

    def has_child(v, base):
        return any(words[w][3].split(':')[0] == base for w in children.get(v, ()))

    for v in sorted(words):
        form, upos, head, dep, feats_ = words[v]
        base = dep.split(':')[0]
        kind = None
        if base in ('advcl', 'ccomp', 'csubj', 'parataxis'):
            kind = base
        elif dep == 'acl:relcl':
            kind = 'acl:relcl'
        elif base == 'xcomp' and has_child(v, 'nsubj'):
            kind = 'xcomp+nsubj'
        elif base == 'conj' and has_child(v, 'nsubj') and \
                (upos == 'VERB' or any(words[w][3].split(':')[0] in ('aux', 'cop') for w in children.get(v, ()))):
            kind = 'conj-verbal'
        if kind is None and base not in ('obl', 'advmod', 'appos', 'dislocated', 'conj', 'discourse'):
            continue
        clo, chi = subtree_charspan(v)
        if clo is None:
            continue
        tl, tr = tok_left(clo), tok_right(chi)
        if kind is not None:                              # CLAUSE : les deux bords
            if tl is not None and tl > 0:
                out.add(tl)
            if tr is not None and 0 < tr < n_tok:
                out.add(tr)
        if base in ('obl', 'advmod', 'advcl') and tl == 0 and tr is not None and 0 < tr < n_tok:
            out.add(tr)                                   # ADJONCT EN TÊTE : sa fermeture
        if base in ('appos', 'dislocated'):               # APPOSITION / DISLOCATION : 2 bords
            if tl is not None and tl > 0:
                out.add(tl)
            if tr is not None and 0 < tr < n_tok:
                out.add(tr)
        if base == 'conj' and kind != 'conj-verbal' and tl is not None and tl > 0:
            out.add(tl)                                   # ÉNUMÉRATION : bord gauche
        if base == 'discourse':
            if tl is not None and tl > 0:
                out.add(tl)
            if tr is not None and 0 < tr < n_tok:
                out.add(tr)
    return out


def load(n_max):
    """Phrases précalculées {T, gold, ss}, dans l'ordre corpus. L'entraînement/décodage se fait
    sur texte DÉPONCTUÉ (virgule -> espace : tokens identiques, vérifié) = ce que voit un texte dys."""
    out, n_skip = [], 0
    for text, rows in conllu_iter(UDFR):
        if len(out) >= n_max:
            break
        text_n = _norm(text)
        spans = align_spans(text_n, rows)
        if spans is None:
            n_skip += 1
            continue
        tokm = [(m.start(), m.end()) for m in _TOKRE.finditer(text_n)]
        T = [text_n[a:b] for a, b in tokm]
        if not T:
            continue
        depunct = text_n.replace(',', ' ')
        T2 = [m.group() for m in _TOKRE.finditer(depunct)]
        if T2 != T:
            n_skip += 1
            continue
        words, children = {}, defaultdict(list)
        for c in rows:
            if '-' in c[0] or '.' in c[0]:
                continue
            wid = int(c[0])
            head = int(c[6]) if c[6].isdigit() else 0
            words[wid] = (c[1], c[3], head, c[7], c[5])   # (forme, upos, tête, deprel, feats)
        for wid, w in words.items():
            children[w[2]].append(wid)
        gold = gold_tout(words, children, spans, tokm)
        ss = C._seg_info(depunct)['ss']
        if len(ss) != len(T):
            n_skip += 1
            continue
        out.append({'T': T, 'gold': gold, 'ss': ss})
    return out, n_skip


# ---------------- features + régression logistique (contrat en docstring) ----------------
def feats(T, tg, i, last_b, fin_seen):
    f = ['tg-1=' + tg[i - 1], 'tg0=' + tg[i]]
    lw, lw0 = T[i].lower(), T[i - 1].lower()
    if lw in FUNC:
        f.append('w=' + lw)
    if lw.startswith("qu'"):
        f.append('w=ELIDQU')
    if C._ELIDED_PRON.search(lw):
        f.append('w=ELIDPRON')
    if lw0 in FUNC:
        f.append('w-1=' + lw0)
    if fin_seen:
        f.append('vu_verbe')
    d = i - last_b
    f.append('dist=1' if d <= 1 else 'dist=2' if d == 2 else
             'dist=3-5' if d <= 5 else 'dist=6-10' if d <= 10 else 'dist=11+')
    if fin_seen and tg[i] == 'DET':
        f.append('vu_verbe&DET')
    return f


def _sigma(z):
    return 1.0 / (1.0 + math.exp(-max(-30.0, min(30.0, z))))


def train_clf(train, epochs=8, lr0=0.3, seed=42):
    """SGD logistique, hyperparamètres FIGÉS = ceux de la phase-mesure. Teacher forcing :
    l'état (last_b, vu_verbe) suit l'OR pendant l'entraînement."""
    W, b = defaultdict(float), 0.0
    rng = random.Random(seed)
    order = list(range(len(train)))
    for ep in range(epochs):
        rng.shuffle(order)
        lr = lr0 * (0.85 ** ep)
        for si in order:
            s = train[si]
            T, ss, gold = s['T'], s['ss'], s['gold']
            tg = pos_cached(T)
            last_b, fin_seen = 0, tg[0] in ('VERB', 'AUX')
            for i in range(1, len(T)):
                if ss[i]:
                    last_b, fin_seen = i, False
                fv = feats(T, tg, i, last_b, fin_seen)
                z = b
                for k in fv:
                    z += W[k]
                p = _sigma(z)
                y = 1.0 if i in gold else 0.0
                g = (p - y) * lr
                b -= g
                for k in fv:
                    W[k] -= g
                if i in gold:
                    last_b, fin_seen = i, False
                if tg[i] in ('VERB', 'AUX'):
                    fin_seen = True
    return dict(W), b


def decode(s, W, b, tau):
    T, ss = s['T'], s['ss']
    tg = pos_cached(T)
    out = set()
    last_b, fin_seen = 0, tg[0] in ('VERB', 'AUX')
    for i in range(1, len(T)):
        if ss[i]:
            last_b, fin_seen = i, False
        fv = feats(T, tg, i, last_b, fin_seen)
        z = b
        for k in fv:
            z += W.get(k, 0.0)
        if _sigma(z) >= tau:
            out.add(i)
            last_b, fin_seen = i, False
        if tg[i] in ('VERB', 'AUX'):
            fin_seen = True
    return out


def pr(sents, W, b, tau):
    tp = fp = fn = 0
    for s in sents:
        pred, gold = decode(s, W, b, tau), s['gold']
        tp += len(pred & gold)
        fp += len(pred - gold)
        fn += len(gold - pred)
    P = 100.0 * tp / (tp + fp) if (tp + fp) else 0.0
    R = 100.0 * tp / (tp + fn) if (tp + fn) else 0.0
    return P, R, tp, fp, fn


def main():
    if not glob.glob(os.path.join(UDFR, '*.conllu')):
        print(f'SAUTÉ (UDFR absent : {UDFR})')
        return 0
    if C.pos_tags(['le', 'chat', 'dort']) is None:
        print('ERREUR : modèle POS (cgram_pos.json) absent — le contrat exige les tags HMM.')
        return 1

    print('=== build_bornes_clf : bornes de proposition (canal GROUPE, cible or-TOUT) ===')
    allsents, n_skip = load(N_HELDOUT + N_TRAIN)
    if len(allsents) < N_HELDOUT + 500:
        print(f'ERREUR : corpus trop petit ({len(allsents)} phrases alignées, {n_skip} sautées).')
        return 1
    heldout, train = allsents[:N_HELDOUT], allsents[N_HELDOUT:]
    ng = sum(len(s['gold']) for s in train)
    print(f'UD {UDFR} : {len(train)} phrases d\'entraînement ({ng / len(train):.2f} bornes-or/phrase) '
          f'· {len(heldout)} held-out DISJOINT (les {N_HELDOUT} premières du corpus) · {n_skip} sautées')

    Wf, bf = train_clf(train)
    # poids ARRONDIS 4 décimales = l'artefact ; les zéros après arrondi sont élagués (inertes).
    W = {k: round(v, 4) for k, v in Wf.items() if round(v, 4) != 0.0}
    b = round(bf, 4)
    print(f'poids : {len(Wf)} features vues -> {len(W)} poids retenus (≠0 après arrondi) + biais {b}')

    print('held-out (poids arrondis = ceux du JSON) :')
    res = {}
    for tau in (0.5, 0.7, 0.9):
        P, R, tp, fp_, fn_ = pr(heldout, W, b, tau)
        res[tau] = (P, R)
        print(f'  seuil {tau:.1f} : P {P:5.1f} % · R {R:5.1f} %  (tp {tp} fp {fp_} fn {fn_})')

    P05, R05 = res[0.5]
    ok = True
    for lbl, val, mn in (('P@0,5', P05, P_MIN), ('R@0,5', R05, R_MIN)):
        if val >= mn:
            print(f'GARDE {lbl} >= {mn:.1f} % : OK ({val:.1f} %)')
        else:
            print(f'GARDE {lbl} >= {mn:.1f} % : ÉCHEC ({val:.1f} %)')
            ok = False
    if not ok:
        print(f'ÉCHEC — {OUT} NON écrit.')
        return 1

    obj = {'w': W, 'b': b, 'tau': 0.5,
           'meta': {'p05': round(P05, 1), 'r05': round(R05, 1),
                    'p07': round(res[0.7][0], 1), 'r07': round(res[0.7][1], 1),
                    'p09': round(res[0.9][0], 1), 'r09': round(res[0.9][1], 1),
                    'n_train': len(train), 'n_heldout': len(heldout),
                    'cible': 'or-TOUT (clause 2 bords + adjonct en tête + appos + énum + discourse)',
                    'licence': 'dérivé UD French GSD (CC BY-SA 4.0)'}}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write('\n')
    print(f'-> {OUT} écrit ({os.path.getsize(OUT)} octets)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
