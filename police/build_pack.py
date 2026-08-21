# -*- coding: utf-8 -*-
"""Construit omega-police-dys.zip (le pack de polices téléchargeable du site) depuis police/ — et, en mode
--check, vérifie que le zip COMMITÉ est FRAIS (mêmes fichiers, mêmes octets que les sources).
Même garde que extension/build_zip.py : un pack rassis est un défaut livré.
  python3 police/build_pack.py            → (re)génère le zip à la racine du repo
  python3 police/build_pack.py --check    → sort 1 si le zip ne correspond pas aux sources (mode CI)
"""
import io
import os
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ZIP = os.path.join(ROOT, 'omega-police-dys.zip')
FILES = ['OmegaDys-Regular.ttf', 'OmegaDys-Light.ttf', 'OmegaDys-Heavy.ttf', 'LISEZMOI.txt', 'OFL.txt']


def norm(name, data):
    return data.replace(b'\r\n', b'\n') if name.endswith('.txt') else data


def sources():
    return [('OmegaDys/' + f, os.path.join(HERE, f)) for f in FILES]


def build():
    with zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED) as z:
        for arc, p in sources():
            zi = zipfile.ZipInfo(arc, date_time=(2026, 1, 1, 0, 0, 0))   # horodatage fixe → zip reproductible
            zi.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(zi, norm(arc, open(p, 'rb').read()))
    print('pack écrit : %s (%d fichiers)' % (ZIP, len(FILES)))


def check():
    if not os.path.exists(ZIP):
        print('✗ pack absent : ' + ZIP); return 1
    with zipfile.ZipFile(ZIP) as z:
        have = {i.filename: z.read(i.filename) for i in z.infolist()}
    want = {arc: norm(arc, open(p, 'rb').read()) for arc, p in sources()}
    bad = [a for a in want if have.get(a) != want[a]] + [a for a in have if a not in want]
    if bad:
        print('✗ pack police RASSIS (régénérer : python3 police/build_pack.py) : ' + ', '.join(bad)); return 1
    print('✓ pack police frais : %d fichiers == sources' % len(want)); return 0


if __name__ == '__main__':
    sys.exit(check() if '--check' in sys.argv else build())
