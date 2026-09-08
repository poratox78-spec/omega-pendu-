# -*- coding: utf-8 -*-
u"""Note le Bescherelle produit par `bescherelle_gen.py` + `navigateur_flags_dump.js`.

Deux colonnes qui ne se mélangent pas : les phrases CORRECTES (le correcteur doit SE TAIRE — tout
flag y est un mot juste cassé) et les phrases FAUTÉES (il doit rendre la forme juste). Le détail par
TEMPS et par PERSONNE du sujet est ce qui a désigné le subjonctif comme point bas (63,7 % le 08/09).

  python3 dictee/bescherelle_score.py <meta.json> <out.json>
"""
import io, json, sys, collections
meta = json.load(io.open(sys.argv[1], encoding='utf-8'))
out  = json.load(io.open(sys.argv[2], encoding='utf-8'))
assert len(meta) == len(out), (len(meta), len(out))
ok_intact = ok_casse = 0
f_juste = f_faux = f_muet = 0
par_tps = collections.defaultdict(lambda: [0, 0])      # temps -> [attrapees, total fautees]
par_pron = collections.defaultdict(lambda: [0, 0])
casses = []
rates = []
PRON = {'1s': 'je', '2s': 'tu', '3s': 'il', '1p': 'nous', '2p': 'vous', '3p': 'ils'}
for m, o in zip(meta, out):
    fl = o.get('flags') or []
    cible = (m.get('mot') or '').lower()
    sur = [f for f in fl if str(f.get('word', '')).lower() == cible and f.get('tier') != 'vigilance']
    if m['attendu'] is None:
        if sur: ok_casse += 1; casses.append((m['t'], sur[0]['word'], sur[0]['sugg'], sur[0]['name']))
        else: ok_intact += 1
    else:
        p = PRON[m['slot']]
        par_tps[m['tps']][1] += 1; par_pron[p][1] += 1
        touche = [f for f in fl if str(f.get('word', '')).lower() == cible]
        if touche and str(touche[0].get('sugg', '')).lower() == m['attendu'].lower():
            f_juste += 1; par_tps[m['tps']][0] += 1; par_pron[p][0] += 1
        elif touche: f_faux += 1; rates.append((m['t'], touche[0]['sugg'], m['attendu']))
        else: f_muet += 1; rates.append((m['t'], 'MUET', m['attendu']))
n_ok = ok_intact + ok_casse; n_f = f_juste + f_faux + f_muet
print('=== BESCHERELLE dans le VRAI Chrome — %d phrases ===' % len(meta))
print('  PHRASES CORRECTES (%d) : %d intactes, %d MOTS JUSTES CASSÉS' % (n_ok, ok_intact, ok_casse))
print('  PHRASES FAUTÉES  (%d) : %d réparées (%.1f %%), %d mauvaise forme, %d muettes'
      % (n_f, f_juste, 100.0 * f_juste / n_f, f_faux, f_muet))
print('  par TEMPS :')
for t in ['ind:pre', 'ind:imp', 'ind:fut', 'cnd:pre', 'sub:pre', 'ind:pas']:
    a, n = par_tps[t]
    if n: print('     %-9s %3d/%-3d  %5.1f %%' % (t, a, n, 100.0 * a / n))
print('  par PERSONNE du sujet :')
for p in ['je', 'tu', 'il', 'nous', 'vous', 'ils']:
    a, n = par_pron[p]
    if n: print('     %-5s %3d/%-3d  %5.1f %%' % (p, a, n, 100.0 * a / n))
if casses:
    print('  ⚠️ MOTS JUSTES CASSÉS :')
    for t, w, s, nm in casses[:15]: print('     %-38s %s → %s [%s]' % (t, w, s, nm))
