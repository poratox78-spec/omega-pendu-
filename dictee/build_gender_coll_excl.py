# -*- coding: utf-8 -*-
"""Exclusions de GENDER_ACC_COLL — les clés NUES piégées par un jumeau accentué dominant.

FP mesuré (2026-08-22, texte dys réel) : « ma mere ma dit » → « mon mere ». La table accentuée à
collision contenait « mere » (m, kaikki : forme rare/étrangère) à côté de « mère » (f). Un scripteur
dys qui tape « mere » veut « mère » (630/M contre 6,7/M) : lire le genre de la forme nue, c'est lire
le genre du mauvais mot. Règle : une clé NUE (sans accent) dont un jumeau ACCENTÉ de genre OPPOSÉ est
≥ DOM× plus fréquent (ou dont la forme nue est absente du lexique) n'a rien à dire au correcteur →
exclue. Les clés accentuées (âme, affairé, lettré) et les nues dominantes (affaire, lettre) restent.

Sortie : dictee/gender_acc_coll_excl.json (liste), consommée par correcteur_probe (Python) ; les
listes JS `_GCOLL` de l'app et de l'extension sont régénérées depuis la table Python filtrée
(build_gcoll_js.py) → parité 3 moteurs (parity_gender_coll.js).
  LEX4=/chemin/Lexique4.tsv python3 dictee/build_gender_coll_excl.py
"""
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
DOM = 20.0


def main():
    import speller_probe as S
    import correcteur_probe as C
    WORDS, FREQ, _, _, _ = S.load_lexicon()
    part = {}
    for w, g in C.GENDER_ACC.items():
        part.setdefault(S.deacc(w.lower()), []).append((w.lower(), g))
    excl = []
    for w, g in sorted(C.GENDER_ACC_COLL.items()):
        lw = w.lower()
        if lw != S.deacc(lw):
            continue                                     # clé accentuée : c'est sa raison d'être
        fw = FREQ.get(lw, 0.0)
        for s, gs in part.get(lw, []):
            if s == lw or gs == g:
                continue
            fs = FREQ.get(s, 0.0)
            if lw not in WORDS or (fs > 0 and fs >= DOM * max(fw, 0.05)):
                excl.append([lw, g, s, gs, round(fw, 2), round(fs, 2)])
                break
    out = os.path.join(HERE, 'gender_acc_coll_excl.json')
    with io.open(out, 'w', encoding='utf-8') as f:
        json.dump([e[0] for e in excl], f, ensure_ascii=False)
    print('%d exclusions → %s' % (len(excl), out))
    for e in excl[:40]:
        print('  %-14s %s  ←  %-14s %s   (%s/M vs %s/M)' % tuple(e))
    if len(excl) > 40:
        print('  … +%d' % (len(excl) - 40))


if __name__ == '__main__':
    main()
