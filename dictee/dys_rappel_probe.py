# -*- coding: utf-8 -*-
u"""AUDIT RAPPEL DYS — étage jointure : les fautes VRAIES (align raw↔fixed, l'aligneur du dépôt)
croisées avec ce que le correcteur a rendu (dump JS du pipeline runCorr réel).
Verdicts par faute : CORRIGE (sugg == attendu) · SIGNALE_AUTRE (flag posé, mauvaise sugg) ·
VIGILANCE (orange sans sugg exacte) · RATE. Omissions/insertions comptées à part (hors périmètre
d'un correcteur mot-à-mot). CHAQUE faute ratée est IMPRIMÉE — on lit, on ne résume pas."""
import os, sys, io, json, unicodedata
from collections import Counter, defaultdict

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(REPO, 'dictee'))
from dys_reel_probe import toks, align, classe

def deacc(s):
    return u''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def norm(w):
    return (w or u'').lower().replace(u'’', u"'")

src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, 'data_local', 'dys_reel', 'audit_corr_dump.json')
if not os.path.exists(src):
    print(u'(dump absent — lancer d abord : node dictee/dys_rappel_dump.js ; corpus sous data_local)')
    sys.exit(0)
D = json.load(io.open(src, encoding='utf-8'))

tot = Counter(); par_classe = defaultdict(Counter); rates = []
hors = Counter()
for t in D:
    # tokens du MOTEUR des deux côtés : l'aligneur du probe splitte l'élision, le moteur non —
    # aligner avec deux tokenisations différentes fabriquait de FAUX ratés (c'etais vs etais).
    A = t['corr']['tokens']; B = t['corr']['tokensFixed']
    ops = align(A, B)
    # flags par index de token brut — le dump et align doivent tokeniser PAREIL : on vérifie
    TJ = t['corr']['tokens']
    fl = defaultdict(list)
    for f in t['corr']['flags']:
        fl[f['i']].append(f)
    # reconstruire l'index brut au fil des ops
    ia = 0
    for op in ops:
        kind, a, b = op
        if kind == 'ins':
            hors['mot oublié (insertion gold)'] += 1
            continue
        if kind == 'del':
            hors['mot en trop (suppression gold)'] += 1
            ia += 1
            continue
        # kind '=' ou 'sub' : a = token brut, b = token gold
        # l'index JS : les tokeniseurs peuvent diverger (apostrophes) → on cale par valeur autour d'ia
        if kind == 'sub' or (a != b):   # sub, ou même mot avec casse/accents différents
            cls = classe(a, b)
            tot['fautes'] += 1
            par_classe[cls]['total'] += 1
            # retrouver l'index de ce token dans TJ (fenêtre autour de ia)
            fs = fl.get(ia, [])   # même tokenisation partout : l'index est DIRECT
            # une correction span:2 (fusion « bien veillante ») est posée sur le token PRÉCÉDENT
            fs = fs + [f for f in fl.get(ia - 1, []) if f.get('span') == 2]
            verdict = 'RATE'
            for f in fs:
                sug = norm(f.get('sugg') or '')
                if sug == norm(b):
                    verdict = 'CORRIGE' if f.get('tier') != 'vigilance' else 'VIGILANCE_JUSTE'
                    break
            else:
                if fs:
                    verdict = 'VIGILANCE' if all(f.get('tier') == 'vigilance' for f in fs) else 'SIGNALE_AUTRE'
            tot[verdict] += 1
            par_classe[cls][verdict] += 1
            if verdict in ('RATE', 'SIGNALE_AUTRE', 'VIGILANCE'):
                det = ' / '.join((f.get('tier') or '?') + u'→' + (f.get('sugg') or u'∅') for f in fs) or u'—'
                rates.append(u'%-14s %-28s « %s » → « %s »  (moteur : %s)  [%s]' % (verdict, cls, a, b, det, t['src']))
        ia += 1

print(u'══ RAPPEL SUR LES %d DICTÉES DYS RÉELLES (fautes de substitution) ══' % len(D))
n = tot['fautes']
print(u'fautes vraies : %d · CORRIGÉES juste : %d (%.0f %%) · vigilance juste : %d · signalé autre sugg : %d · vigilance sans sugg : %d · RATÉES : %d (%.0f %%)' % (
    n, tot['CORRIGE'], 100.0 * tot['CORRIGE'] / max(1, n), tot['VIGILANCE_JUSTE'], tot['SIGNALE_AUTRE'], tot['VIGILANCE'], tot['RATE'], 100.0 * tot['RATE'] / max(1, n)))
print(u'hors périmètre mot-à-mot : ' + u' · '.join(u'%s %d' % (k, v) for k, v in hors.items()))
print(u'\n── par famille (corrigé+vigJuste / total) ──')
for cls, c in sorted(par_classe.items(), key=lambda x: -x[1]['total']):
    ok = c['CORRIGE'] + c['VIGILANCE_JUSTE']
    print(u'  %-32s %2d/%2d' % (cls, ok, c['total']))
print(u'\n── CHAQUE faute non corrigée, à LIRE ──')
for r in rates:
    print(u'  ' + r)
