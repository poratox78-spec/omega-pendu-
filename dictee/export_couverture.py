# -*- coding: utf-8 -*-
"""Ligne 25b (22/10/2026), étape 4 — les cas ÉNUMÉRÉS par couverture_conj_probe.py (sujet × temps, faute de personne) écrits en JSON
(dictee/couverture_conj_cas.json), pour que dictee/couverture_conj_produit.js les rejoue sur le PRODUIT sans le moteur Python.
--check : le JSON suit l'énumération tant que le Python reste (les tables de conjugaison changent → relancer l'export).
    python3 dictee/export_couverture.py          → écrit le JSON
    python3 dictee/export_couverture.py --check  → sort 1 si le JSON ne suit plus"""
import io, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import couverture_conj_probe as K
OUT = os.path.join(HERE, 'couverture_conj_cas.json')

if __name__ == '__main__':
    d = {'sujets': [s for s, _ in K.SUJETS], 'temps': K.temps_sondes(), 'cas': [list(c) for c in K.cas()]}
    txt = json.dumps(d, ensure_ascii=False, separators=(',', ':')).replace('],[', '],\n[') + '\n'
    if '--check' in sys.argv:
        old = io.open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
        if old != txt:
            print(u'✗ couverture_conj_cas.json ne suit plus couverture_conj_probe.py (relancer : python3 dictee/export_couverture.py)'); sys.exit(1)
        print(u'✓ couverture_conj_cas.json == couverture_conj_probe.py (%d cas)' % len(d['cas'])); sys.exit(0)
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write(txt)
    print(u'écrit %s (%d cas)' % (OUT, len(d['cas'])))
