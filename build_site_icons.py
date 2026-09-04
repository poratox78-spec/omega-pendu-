# -*- coding: utf-8 -*-
"""Génère les icônes MATRICIELLES DU SITE dérivées de `icon-512.png` (la marque, tracée depuis icon.svg).

Pourquoi : les PNG du site venaient d'un rendu Chrome headless de juillet 2026 fait quand `icon.svg`
dessinait encore l'oméga en balise <text> — deux d'entre eux sont sortis en APLAT noir. #585 a régénéré
`apple-touch-icon.png` à la main mais PAS `icon-192.png` (l'icône d'installation PWA du manifest),
resté un carré 99,7 % #0d1117 jusqu'au 04/09/2026. Un build déterministe + `--check` en CI rend la
rechute impossible : l'icône de marque change ⇒ les dérivées suivent, sinon rouge.

Zéro dépendance ni duplication : les fonctions (décodage PNG, MOYENNE D'AIRE, encodage) sont IMPORTÉES
de `extension/build_icons.py` — même technique, source unique. Différence : les icônes du site sont à
FOND PERDU (opaques, sans coins alpha — iOS et les launchers appliquent leur propre masque), donc
encodage RGB (colortype 2) sans masque arrondi.

  python3 build_site_icons.py           → (ré)écrit apple-touch-icon.png (180) + icon-192.png (192)
  python3 build_site_icons.py --check   → sort 1 si un PNG commité ≠ ce que produit icon-512.png (CI)

Hors périmètre, avec raison : `icon-maskable-512.png` (marge de 20 % posée au rendu d'origine, sain —
mesuré 4,0 % de glyphe) et `favicon-96x96.png`/`favicon.ico` (sains, ~10 % de glyphe) restent tels
quels ; l'EFFET est gardé pour tous par `dictee/icones_probe.py`.
"""
import importlib.util, os, struct, sys, zlib

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'icon-512.png')

_spec = importlib.util.spec_from_file_location('ext_build_icons', os.path.join(HERE, 'extension', 'build_icons.py'))
_ext = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_ext)

SORTIES = (('apple-touch-icon.png', 180), ('icon-192.png', 192))


def encode_png_rgb(n, rgb):
    """PNG colortype 2 (RGB opaque, fond perdu), filtre 0, déterministe — même structure que
    l'encode_png RGBA de l'extension, sans canal alpha."""
    raw = bytearray()
    for y in range(n):
        raw.append(0)
        raw += rgb[y * n * 3:(y + 1) * n * 3]

    def chunk(typ, data):
        return struct.pack('>I', len(data)) + typ + data + struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', n, n, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(bytes(raw), 9))
            + chunk(b'IEND', b''))


def render():
    w, h, bpp, px = _ext.decode_png(SRC)
    out = {}
    for nom, n in SORTIES:
        small = _ext.resize_area(w, h, bpp, px, n)
        if bpp == 4:                                   # source RGBA : on jette l'alpha (fond perdu)
            small = bytes(b for i, b in enumerate(small) if i % 4 != 3)
        out[nom] = encode_png_rgb(n, small)
    return out


def main():
    check = '--check' in sys.argv
    made = render()
    if check:
        bad = []
        for nom, data in sorted(made.items()):
            p = os.path.join(HERE, nom)
            if not os.path.exists(p): bad.append('MANQUANTE : ' + nom)
            elif open(p, 'rb').read() != data: bad.append('PÉRIMÉE (≠ icon-512.png) : ' + nom)
        if bad:
            print('✗ ICÔNES DU SITE PAS FRAÎCHES — régénérer : python3 build_site_icons.py')
            for b in bad: print('   ', b)
            return 1
        print('✓ icônes du site fraîches : %d PNG == icon-512.png' % len(made))
        return 0
    for nom, data in sorted(made.items()):
        open(os.path.join(HERE, nom), 'wb').write(data)
        print('  %-22s %5d octets' % (nom, len(data)))
    print('✓ %d icônes du site écrites depuis icon-512.png' % len(made))
    return 0


if __name__ == '__main__':
    sys.exit(main())
