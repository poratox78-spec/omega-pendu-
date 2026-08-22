# -*- coding: utf-8 -*-
"""Régénère les listes JS `_GCOLL` (app + extension) depuis GENDER_ACC_COLL (Python, référence) —
source unique, parité 3 moteurs (parity_gender_coll.js). Idempotent : remplace les deux lignes
`('… ').split(' ').forEach(function(w){_GCOLL[w]='f';});` / `…='m'…` qui suivent `var _GCOLL={};`.
  python3 dictee/build_gcoll_js.py
"""
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import correcteur_probe as C  # noqa: E402

PAT = re.compile(r"(var _GCOLL=\{\};\n)\s*\('[^\n]*'\)\.split\(' '\)\.forEach\(function\(w\)\{_GCOLL\[w\]='f';\}\);\n\s*\('[^\n]*'\)\.split\(' '\)\.forEach\(function\(w\)\{_GCOLL\[w\]='m';\}\);\n")


def main():
    f = sorted(w for w, g in C.GENDER_ACC_COLL.items() if g == 'f')
    m = sorted(w for w, g in C.GENDER_ACC_COLL.items() if g == 'm')
    block = ("var _GCOLL={};\n"
             "  ('" + ' '.join(f) + "').split(' ').forEach(function(w){_GCOLL[w]='f';});\n"
             "  ('" + ' '.join(m) + "').split(' ').forEach(function(w){_GCOLL[w]='m';});\n")
    for rel in ('app/omega-pendu.html', 'extension/dys-core.js'):
        p = os.path.join(ROOT, rel)
        s = io.open(p, encoding='utf-8').read()
        s2, n = PAT.subn(lambda _: block, s)
        assert n == 1, (rel, n)
        io.open(p, 'w', encoding='utf-8', newline='').write(s2)
        print('%s : _GCOLL régénéré (%d f, %d m)' % (rel, len(f), len(m)))


if __name__ == '__main__':
    main()
