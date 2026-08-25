# -*- coding: utf-8 -*-
# icones_probe.py — UNE ICONE QUI NE MONTRE RIEN N'EST PAS UNE ICONE.
#
# Ne d'un defaut REEL (24/08/2026, signale par Rem : « le logo n'est pas visible sur Google,
# j'ai qu'un cercle tout noir »). Cause : `icon.svg` dessinait l'omega avec une balise texte
# et une font-family. Un rasteriseur SANS moteur de polices — celui de Google, et celui qui
# avait genere `apple-touch-icon.png` — rend le rectangle de fond et JETTE le texte. Il restait
# le fond #0d1117 aux coins arrondis : a 16 pixels, un cercle noir.
# Preuve materielle : `apple-touch-icon.png` faisait 618 octets et **4 couleurs, 99,7 % de
# #0d1117** — un carre noir uni, en ligne depuis des mois, que personne n'avait regarde.
#
# Deux verrous, l'un sur la CAUSE, l'autre sur l'EFFET :
#   1. `icon.svg` ne doit contenir NI balise texte NI font-family (le glyphe est un trace) ;
#   2. chaque icone matricielle doit avoir assez de couleurs ET assez de pixels de glyphe.
#
# Zero dependance (la CI n'installe rien) : lecteur PNG minimal en stdlib (zlib + struct),
# colortype 2 (RGB) et 6 (RGBA), profondeur 8 — le format de nos icones.
#   python3 dictee/icones_probe.py            # code de sortie != 0 si une icone est vide
import os, sys, zlib, struct, io, re

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIG = bytes([137, 80, 78, 71, 13, 10, 26, 10])
MIN_COULEURS = 32      # un aplat en a 1 a 4 ; nos icones saines en ont 217 et 372
MIN_GLYPHE = 2.0       # % de pixels clairs ; mesure : favicon-96x96 3,1 % · apple-touch 11,3 %


def _paeth(a, b, c):
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    return a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)


def lire_png(chemin):
    """-> (largeur, hauteur, [ (r,g,b), ... ]). Leve ValueError si format non gere."""
    d = io.open(chemin, 'rb').read()
    if d[:8] != SIG:
        raise ValueError('pas un PNG')
    w = h = bd = ct = None
    idat = []
    i = 8
    while i < len(d):
        ln = struct.unpack('>I', d[i:i + 4])[0]
        typ = d[i + 4:i + 8]
        dat = d[i + 8:i + 8 + ln]
        if typ == b'IHDR':
            w, h, bd, ct = struct.unpack('>IIBB', dat[:10])
        elif typ == b'IDAT':
            idat.append(dat)
        elif typ == b'IEND':
            break
        i += 12 + ln
    if bd != 8 or ct not in (2, 6):
        raise ValueError('profondeur/colortype non geres (bd=%s ct=%s)' % (bd, ct))
    npx = 3 if ct == 2 else 4
    brut = zlib.decompress(b''.join(idat))
    lignes, prec, p = [], bytearray(w * npx), 0
    for _y in range(h):
        f = brut[p]; p += 1
        cur = bytearray(brut[p:p + w * npx]); p += w * npx
        for x in range(len(cur)):
            a = cur[x - npx] if x >= npx else 0
            b = prec[x]
            c = prec[x - npx] if x >= npx else 0
            if f == 1:   cur[x] = (cur[x] + a) & 255
            elif f == 2: cur[x] = (cur[x] + b) & 255
            elif f == 3: cur[x] = (cur[x] + ((a + b) >> 1)) & 255
            elif f == 4: cur[x] = (cur[x] + _paeth(a, b, c)) & 255
        lignes.append(cur); prec = cur
    px = []
    for cur in lignes:
        for x in range(0, len(cur), npx):
            px.append((cur[x], cur[x + 1], cur[x + 2]))
    return w, h, px


def main():
    fail = []

    # 1. LA CAUSE — le glyphe doit etre un trace, jamais du texte a rendre.
    p = os.path.join(RACINE, 'icon.svg')
    if not os.path.exists(p):
        fail.append('icon.svg introuvable')
    else:
        s = io.open(p, encoding='utf-8').read()
        sans_com = re.sub(r'<!--[\s\S]*?-->', '', s)     # un commentaire n'est pas du contenu
        if '<text' in sans_com:
            fail.append('icon.svg contient une balise TEXTE : un rasteriseur sans polices la jettera '
                        '(= le cercle noir de Google). Vectoriser le glyphe en <path>.')
        if 'font-family' in sans_com:
            fail.append('icon.svg depend d une FONT-FAMILY : meme piege. Vectoriser en <path>.')

    # 2. L'EFFET — une icone matricielle doit montrer quelque chose.
    for nom in ('favicon-96x96.png', 'apple-touch-icon.png'):
        q = os.path.join(RACINE, nom)
        if not os.path.exists(q):
            fail.append('%s introuvable' % nom); continue
        try:
            w, h, px = lire_png(q)
        except Exception as e:
            fail.append('%s illisible : %s' % (nom, e)); continue
        couleurs = len(set(px))
        clair = sum(1 for c in px if sum(c) > 360)
        part = 100.0 * clair / max(1, len(px))
        if couleurs < MIN_COULEURS:
            fail.append('%s : %d couleurs seulement (< %d) = APLAT, le glyphe manque'
                        % (nom, couleurs, MIN_COULEURS))
        elif part < MIN_GLYPHE:
            fail.append('%s : %.1f %% de pixels de glyphe (< %.1f %%) = quasi vide'
                        % (nom, part, MIN_GLYPHE))
        else:
            print('  %-22s %dx%d · %d couleurs · glyphe %.1f %%' % (nom, w, h, couleurs, part))

    if fail:
        for f in fail:
            print('  x ' + f)
        return 1
    print('OK icones : le glyphe est un trace (aucune police requise) et chaque matricielle le montre.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
