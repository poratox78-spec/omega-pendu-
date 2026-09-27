#!/usr/bin/env python3
# -*- coding: utf-8 -*-
u"""
GARDE — la voie B décode avec l'OREILLE APPRISE (dictee/asr_oreille.json) et le LM ORAL (27/09).

Mesuré au labo (locuteurs jamais vus, réglages figés) : 70,4 → 75,1 % (Parlement), 69,4 → 80,6 % (registre parlé),
voix de Rem 46 → 48/53 ; placebos à plat (dictee/JOURNAL.md du 27/09). Cette garde ne refait pas la mesure (il faut
l'audio et le modèle acoustique) : elle vérifie que ce qui a été mesuré est bien ce qui tourne.

  ① l'asset : forme, symboles, et ce que l'oreille a appris sur de vraies voix — « 8 » (/ɥ/, absent du modèle) entendu
     « y » presque gratuit ; le schwa se perd pour peu ; se garder soi-même coûte peu ;
  ② le dernier centimètre : les candidats d'asr_voix.cands() sur un mini-lexique où la FRÉQUENCE pousse le mauvais
     mot — l'oreille doit gagner au son (/lyi/ → lui et non lit ; /mzyR/ → mesure et non masure) ;
  ③ auto-falsification : avec une table UNIFORME à la place de l'oreille, ② doit échouer (sinon ② ne teste rien) ;
  ④ le LM oral : en tête de phrase, « tu » passe devant « tant » (le LM écrit fait l'inverse — vérifié aussi) ;
  ⑤ le branchement : run() décode par cands() par défaut, init() charge l'oreille et le LM oral.

    python3 dictee/asr_oreille_probe.py
"""
import gzip, inspect, json, os, sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np
import asr_voix as A

KO = []
def ok(cond, msg):
    print((u'  ✓ ' if cond else u'  ✗ ') + msg)
    if not cond: KO.append(msg)


# ① l'asset
T = json.load(open(A.OREILLE_PATH, encoding='utf-8'))
S = {c: i for i, c in enumerate(T['symboles'])}; NS = len(S)
ok(len(T['sub']) == NS and all(len(r) == NS for r in T['sub']) and len(T['del']) == NS and len(T['ins']) == NS,
   u'asset : %d symboles, matrices carrées' % NS)
ok(all(c in S for c in u'aeiouyEO2951@§°bdfgklmnpRstvzSZjw8N'), u'asset : tous les sons du français présents')
sub = np.array(T['sub']); dg = np.diag(sub)
ok(sub[S['8'], S['y']] < 1.0 < sub[S['8'], S['8']],
   u'appris : /ɥ/ (« 8 ») entendu « y » %.2f, entendu « 8 » %.2f (le modèle n\'a pas ce symbole)' % (
       sub[S['8'], S['y']], sub[S['8'], S['8']]))
ok(T['del'][S['°']] < 1.5 < T['del'][S['a']], u'appris : schwa perdu %.2f, « a » perdu %.2f' % (T['del'][S['°']], T['del'][S['a']]))
ok(float(np.median(dg)) < 0.5, u'appris : se garder soi-même coûte peu (médiane de la diagonale %.2f)' % float(np.median(dg)))


# ② le dernier centimètre, sur un mini-lexique où la fréquence pousse le MAUVAIS mot
MINI = {'lui': 'l8i', 'lit': 'li', 'lu': 'ly', 'lys': 'lis', 'mesure': 'm°zyR', 'masure': 'mazyR', 'jardin': 'ZaRd5'}
FREQ_MINI = {'lui': 10, 'lit': 1000, 'lu': 500, 'lys': 5, 'mesure': 10, 'masure': 1000, 'jardin': 50}
ATTENDU = [('lyi', 'lui'), ('mzyR', 'mesure'), ('ZaRd5', 'jardin')]


def premiers():
    A._RC.clear()
    return {s: A.cands(s)[0][0] for s, _ in ATTENDU}


A.PH2W = defaultdict(list)
for w, ph in MINI.items(): A.PH2W[ph].append(w)
A.PH2W = dict(A.PH2W); A.FREQ = FREQ_MINI
A.load_oreille(); A.index_sons()
p = premiers()
for s, w in ATTENDU:
    ok(p[s] == w, u'oreille : /%s/ → %s (rendu : %s)' % (s, w, p[s]))

# ③ auto-falsification : même code, table uniforme (−1 par erreur de son) — les deux premiers cas doivent tomber
SUB, DEL, INS = A.OREILLE
A.OREILLE = ((1.0 - np.eye(SUB.shape[0])).astype(np.float32), np.ones_like(DEL), np.ones_like(INS))
pu = premiers()
ok(pu['lyi'] != 'lui' and pu['mzyR'] != 'mesure',
   u'falsifié : table uniforme → /lyi/ → %s, /mzyR/ → %s (la fréquence gagne : ② teste bien l\'oreille)' % (pu['lyi'], pu['mzyR']))
A.OREILLE = (SUB, DEL, INS)


# ④ le LM oral
FREQ = {}
with gzip.open(A.SPELLER, 'rt', encoding='utf-8') as f:
    for line in f:
        c = line.rstrip('\n').split('\t')
        if len(c) >= 2:
            try: FREQ[c[0]] = int(c[1])
            except ValueError: pass
oral = A.load_lm(FREQ, A.LAM_ORAL)[2]; ecrit = A.load_lm()[2]
o_tu, o_tant = oral('tu', '<s>', '<s>'), oral('tant', '<s>', '<s>')
e_tu, e_tant = ecrit('tu', '<s>', '<s>'), ecrit('tant', '<s>', '<s>')
ok(o_tu > o_tant, u'LM oral : en tête de phrase « tu » %.2f > « tant » %.2f' % (o_tu, o_tant))
ok(e_tu < o_tant and e_tu < e_tant, u'falsifié : le LM écrit met « tu » %.2f sous « tant » %.2f' % (e_tu, e_tant))


# ⑤ le branchement
sig = inspect.signature(A.run).parameters
src_run = inspect.getsource(A.run); src_init = inspect.getsource(A.init)
ok(sig['oreille'].default is True and 'viterbi([cands(w) for w in phs])' in src_run,
   u'run() décode par cands() (l\'oreille) par défaut')
ok('load_oreille()' in src_init and 'load_lm(FREQ, LAM_ORAL)' in src_init, u'init() charge l\'oreille et le LM oral')

print(u'\n%s' % (u'✅ voie B : oreille apprise et LM oral branchés' if not KO else u'❌ %d contrôle(s) en échec' % len(KO)))
sys.exit(1 if KO else 0)
