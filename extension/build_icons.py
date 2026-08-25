# -*- coding: utf-8 -*-
"""Génère les ICÔNES de l'extension (16/32/48/128) exigées par le Chrome Web Store.

Pourquoi un script et pas 4 PNG posés à la main : le Store impose une icône 128×128 (fiche + gestionnaire
d'extensions) et Chrome en réclame 16/32/48 (barre d'outils, page chrome://extensions, favicon du panneau).
Les quatre doivent rester la MÊME marque que le site — donc on les DÉRIVE de `icon-512.png` (l'icône OMEGA-Ω
déjà servie par omegapendu.com, elle-même tracée depuis `icon.svg`) au lieu d'inventer un second logo.

Zéro dépendance (ni PIL ni rasteriseur) : décodage PNG 8 bits + rééchantillonnage par MOYENNE D'AIRE +
réencodage, en pur Python. Sortie DÉTERMINISTE (mêmes octets à chaque exécution) → gardable en CI.

  python3 extension/build_icons.py           → (ré)écrit extension/icons/icon{16,32,48,128}.png
  python3 extension/build_icons.py --check   → sort 1 si un PNG commité ≠ ce que produit la source (mode CI)
"""
import os, struct, sys, zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC  = os.path.join(ROOT, 'icon-512.png')          # source de marque (site + PWA)
OUT  = os.path.join(HERE, 'icons')
SIZES = (16, 32, 48, 128)
RADIUS_RATIO = 96.0 / 512.0                        # rx du <rect> de icon.svg — même arrondi que la marque


# ---------------------------------------------------------------- décodage PNG (8 bits, non entrelacé)
def decode_png(path):
    d = open(path, 'rb').read()
    if d[:8] != b'\x89PNG\r\n\x1a\n':
        raise SystemExit('pas un PNG : ' + path)
    pos, idat, ihdr = 8, [], None
    while pos < len(d):
        ln, = struct.unpack('>I', d[pos:pos + 4])
        typ, data = d[pos + 4:pos + 8], d[pos + 8:pos + 8 + ln]
        if typ == b'IHDR': ihdr = struct.unpack('>IIBBBBB', data)
        elif typ == b'IDAT': idat.append(data)
        pos += 12 + ln
    w, h, depth, color, comp, filt, inter = ihdr
    if depth != 8 or color not in (2, 6) or inter != 0:
        raise SystemExit('PNG non géré (attendu 8 bits RGB/RGBA non entrelacé) : %r' % (ihdr,))
    bpp = 3 if color == 2 else 4
    raw = zlib.decompress(b''.join(idat))
    stride = w * bpp
    out, prev, i = bytearray(), bytearray(stride), 0
    for _ in range(h):
        f = raw[i]; i += 1
        line = bytearray(raw[i:i + stride]); i += stride
        if f:
            for x in range(stride):
                a = line[x - bpp] if x >= bpp else 0
                b = prev[x]
                c = prev[x - bpp] if x >= bpp else 0
                if   f == 1: line[x] = (line[x] + a) & 255
                elif f == 2: line[x] = (line[x] + b) & 255
                elif f == 3: line[x] = (line[x] + ((a + b) >> 1)) & 255
                elif f == 4:
                    p = a + b - c
                    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                    line[x] = (line[x] + (a if (pa <= pb and pa <= pc) else (b if pb <= pc else c))) & 255
                else: raise SystemExit('filtre PNG inconnu : %d' % f)
        out += line; prev = line
    return w, h, bpp, bytes(out)


# ---------------------------------------------------------------- rééchantillonnage par moyenne d'aire
def resize_area(w, h, bpp, px, n):
    """Réduction n×n par MOYENNE D'AIRE (chaque pixel de sortie = moyenne pondérée du rectangle source
    correspondant, bords fractionnaires compris). 512→48 n'est pas un diviseur entier : un simple
    sous-échantillonnage crénellerait le trait de l'oméga."""
    sx, sy = w / float(n), h / float(n)
    out = bytearray(n * n * bpp)
    for oy in range(n):
        y0, y1 = oy * sy, (oy + 1) * sy
        for ox in range(n):
            x0, x1 = ox * sx, (ox + 1) * sx
            acc, wsum = [0.0] * bpp, 0.0
            for yy in range(int(y0), min(h, int(y1 - 1e-9) + 1)):
                wy = min(y1, yy + 1) - max(y0, yy)
                if wy <= 0: continue
                for xx in range(int(x0), min(w, int(x1 - 1e-9) + 1)):
                    wx = min(x1, xx + 1) - max(x0, xx)
                    if wx <= 0: continue
                    a = wy * wx; wsum += a
                    o = (yy * w + xx) * bpp
                    for c in range(bpp): acc[c] += px[o + c] * a
            o = (oy * n + ox) * bpp
            for c in range(bpp):
                out[o + c] = max(0, min(255, int(acc[c] / wsum + 0.5)))
    return bytes(out)


def rounded_alpha(n, ratio, ss=4):
    """Masque alpha d'un carré à coins arrondis, antialiasé par sur-échantillonnage ss×ss."""
    r = ratio * n
    a = bytearray(n * n)
    for y in range(n):
        for x in range(n):
            cov = 0
            for sy in range(ss):
                py = y + (sy + 0.5) / ss
                for sx in range(ss):
                    px_ = x + (sx + 0.5) / ss
                    cx = r if px_ < r else (n - r if px_ > n - r else px_)
                    cy = r if py < r else (n - r if py > n - r else py)
                    dx, dy = px_ - cx, py - cy
                    if dx * dx + dy * dy <= r * r: cov += 1
            a[y * n + x] = int(255 * cov / float(ss * ss) + 0.5)
    return bytes(a)


# ---------------------------------------------------------------- encodage PNG RGBA déterministe
def encode_png(n, rgba):
    raw = bytearray()
    for y in range(n):
        raw.append(0)                                  # filtre 0 : sortie reproductible, taille négligeable ici
        raw += rgba[y * n * 4:(y + 1) * n * 4]
    def chunk(typ, data):
        return struct.pack('>I', len(data)) + typ + data + struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', n, n, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(bytes(raw), 9))
            + chunk(b'IEND', b''))


def render():
    w, h, bpp, px = decode_png(SRC)
    out = {}
    for n in SIZES:
        small = resize_area(w, h, bpp, px, n)
        alpha = rounded_alpha(n, RADIUS_RATIO)
        rgba = bytearray(n * n * 4)
        for i in range(n * n):
            o = i * bpp
            rgba[i * 4]     = small[o]
            rgba[i * 4 + 1] = small[o + 1]
            rgba[i * 4 + 2] = small[o + 2]
            rgba[i * 4 + 3] = alpha[i]
        out['icon%d.png' % n] = encode_png(n, bytes(rgba))
    return out


def main():
    check = '--check' in sys.argv
    made = render()
    if check:
        bad = []
        for name, data in sorted(made.items()):
            p = os.path.join(OUT, name)
            if not os.path.exists(p): bad.append('MANQUANTE : icons/' + name)
            elif open(p, 'rb').read() != data: bad.append('PÉRIMÉE (≠ icon-512.png) : icons/' + name)
        if bad:
            print('✗ ICÔNES EXTENSION PAS FRAÎCHES — régénérer : python3 extension/build_icons.py')
            for b in bad: print('   ', b)
            return 1
        print('✓ icônes extension fraîches : %d PNG == icon-512.png' % len(made))
        return 0
    os.makedirs(OUT, exist_ok=True)
    for name, data in sorted(made.items()):
        open(os.path.join(OUT, name), 'wb').write(data)
        print('  icons/%-12s %5d octets' % (name, len(data)))
    print('✓ %d icônes écrites depuis %s' % (len(made), os.path.relpath(SRC, ROOT)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
