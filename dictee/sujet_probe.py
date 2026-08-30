# -*- coding: utf-8 -*-
"""SONDE SUJET — l'instrument de référence pour « le correcteur trouve-t-il le SUJET ? »

HISTOIRE (pourquoi ce fichier existe) : le chiffre « sujet ~63 % (mur) » cité par
DICTEE_ROADMAP.md:28 vient d'une sonde vécue en mémoire cloud (« sentence-analysis-probe »)
jamais commitée — PERDUE. L'enquête du 30/08/2026 a re-mesuré la détection du sujet contre
l'or UD (nsubj), mais sa sonde vivait en scratchpad — perdue aussi. Ce fichier VERSIONNE
l'instrument : c'est LUI la référence désormais ; les chiffres antérieurs (« ~63 % ») ne
sont PAS reproductibles (protocole inconnu) et ne doivent plus être cités sans cette sonde.

CE QU'ELLE MESURE (UD French GSD en CoNLL-U, ~3000 phrases, or = arbres gold) :
- pour chaque VERBE FINI portant un nsubj dans l'or (l'aux fini d'un passif/copule hérite
  du nsubj de sa tête), on demande au moteur de référence (correcteur_probe) son sujet via
  les primitives RÉELLES des règles d'accord : _subject_before (route pronom, cf.
  rule_accord_sv) puis _np_subject (route nominale, cf. rule_accord_sv_noun — clitiques
  sautés comme dans la règle, _SEG posé comme dans correct()). Juste = même TOKEN que la
  tête nsubj de l'or ; répondu-faux sinon ; aucune réponse = abstention.
- couverture globale (répond/total), précision-quand-répond (juste/répond), ventilation
  par type de sujet or (pronom/nominal) et ventilation des ÉCHECS nominaux par structure
  (postposé, relative, coordonné, nom propre, dét élidé, distant>3, autre — heuristiques
  simples sur l'or UD, premier critère qui matche).
- signal VERBE-PRÉSENCE : _clause_no_finite_verb interrogé depuis un token VOISIN du verbe
  fini (fenêtre _SEG vérifiée : le verbe est bien dans la proposition scannée) — il doit
  répondre False (« il y a un verbe »). Rappel = part des verbes finis vus.

CHIFFRES DE RÉFÉRENCE (mesurés le 30/08/2026 sur main) : couverture ~56,5 % ·
précision-quand-répond ~93,2 % · verbe-présence ~93,1 %. GARDES (marges anti-flaky,
violées => exit 1) : précision >= 90 % · verbe-présence >= 90 % · couverture >= 50 %.

LANCER :
  UDFR=/tmp/udfr python3 dictee/sujet_probe.py     # défaut UDFR=/tmp/udfr
  (git clone --depth 1 https://github.com/UniversalDependencies/UD_French-GSD /tmp/udfr)
  UDFR absent => « SAUTÉ (UDFR absent) » + exit 0 (comme les sondes dys en CI).
Déterministe (aucun aléa) ; lecture seule (n'écrit aucun fichier) ; SUJET_N=N pour changer
le nombre de phrases (défaut 3000 — les gardes sont calibrées sur ce défaut).
"""
import os
import re
import sys
import glob
from collections import Counter, defaultdict

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
UDFR = os.environ.get('UDFR', '/tmp/udfr')
N_SENT = int(os.environ.get('SUJET_N', '3000'))
MIN_PREC, MIN_VERB, MIN_COUV = 90.0, 90.0, 50.0     # gardes (marges sous les ~93,2/93,1/56,5 mesurés)

_TOKRE = re.compile(r"[A-Za-zÀ-ÿœŒ'’ʼ]+")           # MÊME motif que diag_sentence.toks (parité tokenisation)


def _norm(s):
    return s.replace('’', "'").replace('ʼ', "'")     # même normalisation d'apostrophe que correct() (1:1, offsets intacts)


def conllu_iter(d):
    """(texte, lignes CoNLL-U) par phrase, tous fichiers *.conllu triés (déterministe)."""
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
    """id de mot UD -> (début, fin) dans text_n. Les mots d'un token multi-mots (« du » = de+le)
    partagent l'empan du token de surface. None si une forme est introuvable (phrase sautée)."""
    spans, pos, covered = {}, 0, 0
    for c in rows:
        cid = c[0]
        if '.' in cid:
            continue                                  # noeud vide (ellipse) : pas de surface
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
            continue                                  # déjà couvert par le token multi-mots
        form = _norm(c[1])
        if form == '_':
            continue
        k = text_n.find(form, pos)
        if k < 0:
            return None
        spans[wid] = (k, k + len(form))
        pos = k + len(form)
    return spans


def _window(i, n, seg):
    """Réplique les bornes de proposition de _clause_no_finite_verb (lecture seule de _SEG)."""
    lo, hi = 0, n
    if seg is not None:
        for j in range(i, 0, -1):
            if j < len(seg['bb']) and seg['bb'][j]:
                lo = j
                break
        for j in range(i + 1, n):
            if j < len(seg['bb']) and seg['bb'][j]:
                hi = j
                break
    return lo, hi


def engine_subject(C, T, tg, tv):
    """Le sujet que répondent les VRAIES primitives, dans l'ordre des règles d'accord :
    _subject_before (pronom) sinon _np_subject (nominal, clitiques sautés comme rule_accord_sv_noun).
    -> ('pron'|'nom', index de token) ou (None, None) = abstention."""
    if C._subject_before(T, tv) is not None:
        j, steps = tv - 1, 0                          # ré-obtenir l'INDEX du pronom (la primitive rend (pers, nb)) :
        while j >= 0 and steps < 3 and C.deacc(T[j].lower()) in C.CLITIC:
            j -= 1                                    # même saut de clitiques que _subject_before
            steps += 1
        return 'pron', j
    vs = tv
    while vs - 1 >= 0 and C.deacc(T[vs - 1].lower()) in C.CLITIC:
        vs -= 1                                       # même saut que rule_accord_sv_noun avant _np_subject
    subj = C._np_subject(T, tg, vs) if tg else None
    if subj is not None:
        return 'nom', subj['idx']
    return None, None


def structure_of(v, s, tv, ts, words, children, T):
    """Structure du sujet nominal (heuristiques simples sur l'or UD) — pour ventiler les échecs."""
    if s > v:
        return 'postposé'
    if words[v][4].split(':')[0] == 'acl':
        return 'relative'
    if any(words[w][4].split(':')[0] == 'conj' for w in children.get(s, ())):
        return 'coordonné'
    if words[s][2] == 'PROPN':
        return 'nom propre'
    if ts is not None and "'" in T[ts]:
        return 'dét élidé'
    dist = (tv - ts) if ts is not None else (v - s)
    if dist > 3:
        return 'distant>3'
    return 'autre'


def main():
    if not os.path.isdir(UDFR) or not glob.glob(os.path.join(UDFR, '*.conllu')):
        print('SAUTÉ (UDFR absent)')
        return 0
    sys.path.insert(0, HERE)
    import correcteur_probe as C

    n_sent = n_skip = 0
    tot = Counter()                                   # 'juste'/'faux'/'abst' par type ('pronom'/'nominal')
    fail_struct = Counter()
    vp_ok = vp_tot = 0

    for text, rows in conllu_iter(UDFR):
        if n_sent >= N_SENT:
            break
        text_n = _norm(text)
        spans = align_spans(text_n, rows)
        if spans is None:
            n_skip += 1
            continue
        n_sent += 1
        tokm = [(m.start(), m.end()) for m in _TOKRE.finditer(text_n)]
        T = [text_n[a:b] for a, b in tokm]
        if not T:
            continue

        def tidx(wid):
            sp = spans.get(wid)
            if sp is None:
                return None
            for k, (a, b) in enumerate(tokm):
                if a < sp[1] and sp[0] < b:
                    return k
            return None

        words, children = {}, defaultdict(list)
        for c in rows:
            if '-' in c[0] or '.' in c[0]:
                continue
            wid = int(c[0])
            head = int(c[6]) if c[6].isdigit() else 0
            words[wid] = (c[1], c[3], c[3], head, c[7], c[5])   # (forme, upos, upos, tête, deprel, feats)
        for wid, w in words.items():
            children[w[3]].append(wid)

        def nsubj_of(v):
            for w in sorted(children.get(v, ())):
                if words[w][4].split(':')[0] == 'nsubj':
                    return w
            return None

        C._SEG = C._seg_info(text_n)                  # même pose que correct() avant la passe de règles
        tg = C.pos_tags(T)

        for v in sorted(words):
            form, upos, _, head, dep, feats = words[v]
            if upos not in ('VERB', 'AUX') or 'VerbForm=Fin' not in feats:
                continue
            tv = tidx(v)
            if tv is None:
                continue
            # --- signal verbe-présence : depuis un voisin dont la fenêtre CONTIENT le verbe ---
            for i in (tv - 1, tv + 1):
                if 0 <= i < len(T):
                    lo, hi = _window(i, len(T), C._SEG)
                    if lo <= tv < hi:
                        vp_tot += 1
                        if C._clause_no_finite_verb(T, i) is False:
                            vp_ok += 1
                        break
            # --- sujet : verbe fini avec nsubj dans l'or ---
            s = nsubj_of(v)
            if s is None and upos == 'AUX' and dep.split(':')[0] in ('aux', 'cop'):
                s = nsubj_of(head)                    # passif/copule : le nsubj est porté par la tête lexicale
            if s is None:
                continue
            ts = tidx(s)
            typ = 'pronom' if words[s][1] == 'PRON' else 'nominal'
            mode, idx = engine_subject(C, T, tg, tv)
            if mode is None:
                verdict = 'abst'
            elif ts is not None and idx == ts:
                verdict = 'juste'
            else:
                verdict = 'faux'
            tot[(typ, verdict)] += 1
            if typ == 'nominal' and verdict != 'juste':
                fail_struct[structure_of(v, s, tv, ts, words, children, T)] += 1

    def _line(typ):
        j, f, a = tot[(typ, 'juste')], tot[(typ, 'faux')], tot[(typ, 'abst')]
        n, rep = j + f + a, j + f
        cv = 100.0 * rep / n if n else 0.0
        pr = 100.0 * j / rep if rep else 0.0
        return n, j, f, a, cv, pr

    np_, jp, fp, ap, cvp, prp = _line('pronom')
    nn, jn, fn, an, cvn, prn = _line('nominal')
    total = np_ + nn
    juste, faux = jp + jn, fp + fn
    rep = juste + faux
    couv = 100.0 * rep / total if total else 0.0
    prec = 100.0 * juste / rep if rep else 0.0
    vp = 100.0 * vp_ok / vp_tot if vp_tot else 0.0

    print(f'=== SONDE SUJET — or UD nsubj ({n_sent} phrases, {n_skip} sautées, {total} verbes finis avec nsubj) ===')
    print(f'  couverture globale        : {rep}/{total} = {couv:.1f} %')
    print(f'  précision quand répond    : {juste}/{rep} = {prec:.1f} %   (répondu-faux {faux})')
    print(f'  par type de sujet (or) :')
    print(f'    pronom  : {np_:5d}  couverture {cvp:5.1f} %  précision {prp:5.1f} %  (juste {jp} / faux {fp} / abst {ap})')
    print(f'    nominal : {nn:5d}  couverture {cvn:5.1f} %  précision {prn:5.1f} %  (juste {jn} / faux {fn} / abst {an})')
    ech = sum(fail_struct.values())
    vent = ' · '.join(f'{k} {v}' for k, v in fail_struct.most_common())
    print(f'  échecs nominaux (faux+abstention = {ech}) par structure :')
    print(f'    {vent}')
    print(f'  signal verbe-présence (_clause_no_finite_verb) : {vp_ok}/{vp_tot} = {vp:.1f} %')
    fails = []
    if prec < MIN_PREC:
        fails.append(f'précision {prec:.1f} % < {MIN_PREC:.0f} %')
    if vp < MIN_VERB:
        fails.append(f'verbe-présence {vp:.1f} % < {MIN_VERB:.0f} %')
    if couv < MIN_COUV:
        fails.append(f'couverture {couv:.1f} % < {MIN_COUV:.0f} %')
    if fails:
        print('  GARDES : ROUGE — ' + ' ; '.join(fails))
        return 1
    print(f'  GARDES : OK (précision >= {MIN_PREC:.0f} %, verbe-présence >= {MIN_VERB:.0f} %, couverture >= {MIN_COUV:.0f} %)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
