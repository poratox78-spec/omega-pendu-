# -*- coding: utf-8 -*-
"""Ligne 25b (22/10/2026), étape 3 — les comportements clés de recall_probe.py écrits en JSON (dictee/recall_comportements.json), pour
que dictee/recall_produit.js les rejoue sur le PRODUIT sans le moteur Python. --check : le JSON suit recall_probe.py tant qu'il reste.
    python3 dictee/export_recall.py          → écrit le JSON
    python3 dictee/export_recall.py --check  → sort 1 si le JSON ne suit plus"""
import io, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import recall_probe as R
OUT = os.path.join(HERE, 'recall_comportements.json')

if __name__ == '__main__':
    d = {k: [list(x) if isinstance(x, tuple) else x for x in v] for k, v in R.comportements().items()}
    txt = json.dumps(d, ensure_ascii=False, indent=0) + '\n'
    if '--check' in sys.argv:
        old = io.open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
        if old != txt:
            print(u'✗ recall_comportements.json ne suit plus recall_probe.py (relancer : python3 dictee/export_recall.py)'); sys.exit(1)
        print(u'✓ recall_comportements.json == recall_probe.py (%d comportements)' % sum(len(v) for v in d.values())); sys.exit(0)
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write(txt)
    print(u'écrit %s (%d comportements)' % (OUT, sum(len(v) for v in d.values())))
