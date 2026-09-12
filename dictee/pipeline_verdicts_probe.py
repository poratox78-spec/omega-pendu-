# -*- coding: utf-8 -*-
u"""pipeline_verdicts_probe.py — LE DIFFÉRENTIEL MOT À MOT DU PIPELINE (l'instrument qui manquait, 12/09/2026).

POURQUOI. `dys_pipeline_probe` donne des TOTAUX (réparés, cassés, appliqués faux). Un total qui bouge de 1 ne dit pas QUEL mot a
changé, et deux mouvements opposés s'annulent en silence. Le 12/09, la garde auxiliaire du lot « couverture conjugaison » a fait
tomber les réparés de 325 à 324 : ni le juge (0 famille), ni l'UD (liste identique), ni les parités ne l'ont vu. Cet instrument
imprime un VERDICT par (texte, index, mot) et compare deux états du moteur — il a nommé le cas en un run :
« est il vien sasoir » → vient, perdu parce que la garde lisait l'auxiliaire en i-2 sans voir le PRONOM SUJET intercalé.

  python3 dictee/pipeline_verdicts_probe.py avant.json            # état courant du dépôt
  git stash push -- dictee/correcteur_probe.py                     # (ou git checkout d'un autre état)
  python3 dictee/pipeline_verdicts_probe.py apres.json
  python3 dictee/pipeline_verdicts_probe.py avant.json apres.json --cmp

Lecture seule, aucun ancrage : c'est un instrument de DIAGNOSTIC, pas un garde-fou de la batterie.
"""
import io, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if '--cmp' in sys.argv:
    a = json.load(io.open(sys.argv[1], encoding='utf-8')); b = json.load(io.open(sys.argv[2], encoding='utf-8'))
    A = {k: v for k, v in a}; B = {k: v for k, v in b}
    n = 0
    for k in sorted(set(A) | set(B)):
        if A.get(k) != B.get(k):
            n += 1; print(u'%-70s %s -> %s' % (k[:70], A.get(k), B.get(k)))
    print(n, 'verdicts changés'); sys.exit(0)

import dys_pipeline_probe as P
DP = P.DP
amb_par_src = {}
_p = os.path.join(DP.DATA, P.GOLD)
for _l in io.open(_p, encoding='utf-8'):
    _l = _l.strip()
    if _l:
        _o = json.loads(_l); amb_par_src[_o['raw']] = set(x.lower() for x in _o.get('ambig', []))
out = []
for brut, gold in P._paires(P.GOLD):
    amb = amb_par_src.get(brut.strip(), set())
    T, o, Tc, orange, signale = P.pyramide(brut)
    al = DP.align(T, [x.group(0) for x in DP.TOK.finditer(gold)])
    for i, w in enumerate(T):
        if not w.isalpha() or i not in al or w.lower() in amb: continue
        g = al[i]
        faux = not DP.eq(w, g); juste = DP.eq(o[i], g)
        if faux and juste: v = 'REPARE'
        elif faux and DP.norm(o[i]) != DP.norm(w): v = 'APPFAUX:' + o[i]
        elif faux: v = 'RATE'
        elif not juste: v = 'CASSE:' + o[i]
        else: continue
        out.append([u'%s|%d|%s' % (brut[:40], i, w), v])
json.dump(out, io.open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False)
print(len(out), 'verdicts écrits')
