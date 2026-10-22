# -*- coding: utf-8 -*-
"""Ligne 25b (22/10/2026), étape 5 — l'échantillon de gender_coll_probe.py (mots à clé désaccentuée partagée avec un autre genre,
et les pièges d'adjectif antéposé) écrit en JSON (dictee/gender_coll_cas.json), pour que dictee/gender_coll_produit.js le rejoue sur
le PRODUIT sans le moteur Python. --check : le JSON suit l'échantillon tant que le Python reste.
    python3 dictee/export_gender_coll.py          → écrit le JSON
    python3 dictee/export_gender_coll.py --check  → sort 1 si le JSON ne suit plus"""
import io, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gender_coll_probe as G
OUT = os.path.join(HERE, 'gender_coll_cas.json')

if __name__ == '__main__':
    coll = getattr(G.C, 'GENDER_ACC_COLL', {})
    cas = [[w, coll[w]] for w in G._mots()]
    d = {'cas': cas, 'pieges': G.PIEGES, 'rappel_min': G.RAPPEL_MIN}
    txt = json.dumps(d, ensure_ascii=False, separators=(',', ':')).replace('],[', '],\n[') + '\n'
    if '--check' in sys.argv:
        old = io.open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
        if old != txt:
            print(u'✗ gender_coll_cas.json ne suit plus gender_coll_probe.py (relancer : python3 dictee/export_gender_coll.py)'); sys.exit(1)
        print(u'✓ gender_coll_cas.json == gender_coll_probe.py (%d mots, %d pièges)' % (len(cas), len(G.PIEGES))); sys.exit(0)
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write(txt)
    print(u'écrit %s (%d mots, %d pièges)' % (OUT, len(cas), len(G.PIEGES)))
