# -*- coding: utf-8 -*-
"""Ligne 25b (22/10/2026) — retrait progressif du moteur Python : la BATTERIE du correcteur (témoins CASES, silences MUETS de
correcteur_probe.py ; les phrases correctes sont déjà dans sentences.json) écrite en JSON, pour que le produit (moteur JS) la
rejoue sans importer le Python (dictee/batterie_produit.js). Tant que le Python reste, --check vérifie que le JSON le suit.
    python3 dictee/export_batterie.py          → écrit dictee/batterie_correcteur.json
    python3 dictee/export_batterie.py --check  → sort 1 si le JSON ne suit plus correcteur_probe.py"""
import io, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import correcteur_probe as C
OUT = os.path.join(HERE, 'batterie_correcteur.json')


def donnees():
    return {'cases': [list(c) for c in C.CASES], 'muets': [list(m) for m in C.MUETS]}


if __name__ == '__main__':
    d = donnees()
    txt = json.dumps(d, ensure_ascii=False, indent=0) + '\n'
    if '--check' in sys.argv:
        old = io.open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
        if old != txt:
            print(u'✗ batterie_correcteur.json ne suit plus correcteur_probe.py (relancer : python3 dictee/export_batterie.py)'); sys.exit(1)
        print(u'✓ batterie_correcteur.json == correcteur_probe.py (%d témoins, %d silences)' % (len(d['cases']), len(d['muets']))); sys.exit(0)
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write(txt)
    print(u'écrit %s (%d témoins, %d silences)' % (OUT, len(d['cases']), len(d['muets'])))
