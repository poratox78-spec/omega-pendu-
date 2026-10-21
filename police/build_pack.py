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


def noms_windows(data):
    """Numéros de nom (table « name ») présents pour la plateforme Windows (3). ⭐ 21/10/2026 : sans le n° 3 (identifiant unique),
    Windows refuse d'installer la police (« fichier de police non valide ») alors que les navigateurs l'affichent : constat de Rem
    sur le zip du site. Lecture directe de la table, sans dépendance."""
    import struct
    n = struct.unpack('>H', data[4:6])[0]
    for k in range(n):
        tag, _cs, off, _ln = struct.unpack('>4sIII', data[12 + 16 * k:28 + 16 * k])
        if tag == b'name':
            cnt = struct.unpack('>H', data[off + 2:off + 4])[0]
            return {struct.unpack('>HHHHHH', data[off + 6 + 12 * r:off + 18 + 12 * r])[3]
                    for r in range(cnt) if struct.unpack('>H', data[off + 6 + 12 * r:off + 8 + 12 * r])[0] == 3}
    return set()


def page_latin(data):
    """⭐ 21/10/2026 : la police déclare-t-elle la page de code Latin 1 (OS/2, ulCodePageRange1, bit 0) ? À zéro, Windows la range hors
    de l'alphabet latin et Word l'affiche dans la liste sans s'en servir (constat de Rem, après l'installation réparée)."""
    import struct
    n = struct.unpack('>H', data[4:6])[0]
    for k in range(n):
        tag, _cs, off, ln = struct.unpack('>4sIII', data[12 + 16 * k:28 + 16 * k])
        if tag == b'OS/2':
            return ln >= 86 and struct.unpack('>H', data[off:off + 2])[0] >= 1 and bool(struct.unpack('>I', data[off + 78:off + 82])[0] & 1)
    return False


def check():
    if not os.path.exists(ZIP):
        print('✗ pack absent : ' + ZIP); return 1
    for f in FILES:
        if f.endswith('.ttf'):
            manque = {1, 2, 3, 4, 6} - noms_windows(open(os.path.join(HERE, f), 'rb').read())
            if manque:
                print('✗ %s : noms Windows manquants %s — Windows refusera son installation (police/build_font.py)' % (f, sorted(manque))); return 1
            if not page_latin(open(os.path.join(HERE, f), 'rb').read()):
                print('✗ %s : page de code Latin 1 non déclarée — Word ne s’en servira pas (police/build_font.py)' % f); return 1
    with zipfile.ZipFile(ZIP) as z:
        have = {i.filename: z.read(i.filename) for i in z.infolist()}
    want = {arc: norm(arc, open(p, 'rb').read()) for arc, p in sources()}
    bad = [a for a in want if have.get(a) != want[a]] + [a for a in have if a not in want]
    if bad:
        print('✗ pack police RASSIS (régénérer : python3 police/build_pack.py) : ' + ', '.join(bad)); return 1
    print('✓ pack police frais : %d fichiers == sources, polices installables sous Windows (noms 1, 2, 3, 4, 6) et déclarées latines (Word)' % len(want)); return 0


if __name__ == '__main__':
    sys.exit(check() if '--check' in sys.argv else build())
