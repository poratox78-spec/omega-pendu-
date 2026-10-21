# -*- coding: utf-8 -*-
"""OMEGA Dys Word — la police qui marque D'ELLE-MÊME les lettres muettes et une syllabe sur deux (ligne 137, 21/10/2026).

Pourquoi. Dans Word, la « police de son » demandait le complément et un clic à chaque fois (Rem). Essai du 21/10 dans le Word de
Rem : les règles OpenType d'une police (GSUB) s'appliquent toutes seules pendant la frappe, mais Word n'affiche PAS les couleurs
d'une police (COLR et SVG essayés). Les marques sont donc dessinées en noir : un ROND sous la lettre muette, un TRAIT sous les
lettres d'une syllabe sur deux (2e, 4e…). Le texte n'est jamais modifié : seule la forme affichée change.

Comment, en deux temps.
① POSITION DANS LE MOT. Chaque lettre prend une forme « début », « milieu » ou « fin » (même dessin) selon ses voisines
   immédiates — trois petites règles par classes (lettre avant / après). Une lettre seule garde sa forme de base.
② LES MOTS. Pour chaque mot de police/mots_word.json (node police/annoter_mots_word.js, même moteur de son que le site), une
   règle sur la suite exacte de ses formes (début … fin) : le bord du mot est DANS les formes. Mesuré le 21/10 : une première
   version bornait le mot par une espace ou une ponctuation voisine — dans Chrome, qui découpe le texte avant de le mettre en
   forme, une partie des mots d'une phrase n'était plus marquée (isolés, ils l'étaient). Ici, rien ne dépend du voisinage.
Les lettres marquées passent à une variante dessinée : .mu (rond), .sy (trait), .mb (les deux) — et COLORÉE (COLR v0 + SVG) :
muette vermillon, syllabe bleue. Word affiche ces couleurs quand la page est en mode clair (vérifié le 21/10 dans le Word de
Rem) ; en mode sombre il garde le dessin noir sur blanc inversé, marques comprises.
Limites : une liste finie de mots (20 000 = 97,9 % des occurrences), en minuscules et à majuscule initiale ; sans grammaire
(un homographe garde UNE lecture) ; mot absent de la liste = pas de marque.
    python police/build_font_word.py [rond] [creux] [raye]
"""
import io, json, math, os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import newTable
from fontTools.ttLib.tables.C_P_A_L_ import Color
from fontTools.colorLib.builder import buildCOLR
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'OmegaDys-Regular.ttf')
# TROIS STYLES de lettre muette : rond dessous (défaut — choisi par Rem le 21/10, seul livré dans le pack), lettre en CREUX (seul le
# contour), lettre RAYÉE (fines bandes : paraît grise). Creux et rayé restent constructibles et demandent skia-pathops.
STYLES = {'rond': ('OMEGA Dys Word', 'OMEGADysWord', 'OmegaDysWord-Regular.ttf'),
          'creux': ('OMEGA Dys Word Creux', 'OMEGADysWordCreux', 'OmegaDysWordCreux-Regular.ttf'),
          'raye': (u'OMEGA Dys Word Rayé', 'OMEGADysWordRaye', 'OmegaDysWordRaye-Regular.ttf')}
MARQ = {'m': '.mu', 's': '.sy', 'b': '.mb'}
POSF = ('.ini', '.med', '.fin')
ALPHA = u'abcdefghijklmnopqrstuvwxyzàâäéèêëîïôöùûüÿçœæABCDEFGHIJKLMNOPQRSTUVWXYZÀÂÄÉÈÊËÎÏÔÖÙÛÜŸÇŒÆ'
PAR_BLOC = 500                                        # mots par sous-table (une sous-table reste sous 65 535 octets)


def _muette(gs, base, style):
    """Contour de la lettre muette en creux (seul le contour, tracé de 24 unités) ou rayée (bandes de 30 sur 64) — skia-pathops."""
    import pathops
    p = pathops.Path(); gs[base].draw(p.getPen())
    if style == 'creux':                               # la lettre « au trait » : seul son contour, tracé de 24 unités (de part et d'autre du bord)
        s = pathops.Path(); p.draw(s.getPen())
        s.stroke(24, pathops.LineCap.BUTT_CAP, pathops.LineJoin.ROUND_JOIN, 4); s.convertConicsToQuads(); s.simplify()
        return s
    bandes = pathops.Path()
    x0, y0, x1, y1 = p.bounds
    y = math.floor(y0 / 64.0) * 64
    while y < y1:
        bandes.moveTo(x0 - 10, y); bandes.lineTo(x1 + 10, y); bandes.lineTo(x1 + 10, y + 30); bandes.lineTo(x0 - 10, y + 30); bandes.close()
        y += 64
    return pathops.op(p, bandes, pathops.PathOp.INTERSECTION)


VERM, BLEU = (0xE0, 0x3C, 0x1E), (0x1E, 0x5A, 0xE6)   # muette vermillon, syllabe bleue (palette de la police de son)


def dessin(gs, hmtx, base, code, style='rond'):
    adv = hmtx[base][0]
    pen = TTGlyphPen(gs)
    if code == 'B':                                    # le trait seul (calque bleu d'une lettre muette ET soulignée)
        pen.moveTo((0, -205)); pen.lineTo((adv, -205)); pen.lineTo((adv, -250)); pen.lineTo((0, -250)); pen.closePath()
        return pen.glyph(), adv
    if code in ('m', 'b') and style != 'rond':
        _muette(gs, base, style).draw(Cu2QuPen(pen, 1.0, reverse_direction=False))
    else:
        gs[base].draw(pen)
    if code in ('m', 'b') and style == 'rond':                                   # rond sous la lettre (muette)
        cx, cy, r = adv / 2.0, -150, 55
        pts = [(round(cx + r * math.cos(2 * math.pi * k / 16)), round(cy - r * math.sin(2 * math.pi * k / 16))) for k in range(16)]
        pen.moveTo(pts[0])
        for p in pts[1:]: pen.lineTo(p)
        pen.closePath()
    if code in ('s', 'b'):                                   # trait sous la lettre, d'un bord à l'autre (syllabe soulignée)
        y0, y1 = (-250, -205) if code == 'b' else (-215, -170)
        pen.moveTo((0, y1)); pen.lineTo((adv, y1)); pen.lineTo((adv, y0)); pen.lineTo((0, y0)); pen.closePath()
    return pen.glyph(), adv


def main(style='rond'):
    fam, ps, sortie = STYLES[style]
    OUT = os.path.join(HERE, sortie)
    mots = json.load(io.open(os.path.join(HERE, 'mots_word.json'), encoding='utf-8'))['mots']
    f = TTFont(SRC)
    cm = f.getBestCmap()
    gname = lambda ch: cm.get(ord(ch))
    lettres = [ch for ch in ALPHA if gname(ch)]
    gs = f.getGlyphSet(); glyf = f['glyf']; hmtx = f['hmtx']; order = list(f.getGlyphOrder()); nouveaux = []

    def ajoute(n, base, code):
        gl, adv = dessin(gs, hmtx, base, code, style)
        glyf[n] = gl; hmtx[n] = (adv, 0); order.append(n); nouveaux.append(n)
    for ch in lettres:                                 # formes de position : même dessin
        for p in POSF: ajoute(gname(ch) + p, gname(ch), '')
    formes = []                                        # (mot affiché, codes)
    for w, c in sorted(mots, key=lambda x: (x[0][0], -len(x[0]), x[0])):
        for v in (w, w[0].upper() + w[1:]):
            if len(v) >= 2 and all(gname(ch) for ch in v): formes.append((v, c))
    marquees = sorted({ch for v, c in formes for ch, k in zip(v, c) if k != '.'})
    for ch in marquees:
        for k, suf in MARQ.items(): ajoute(gname(ch) + suf, gname(ch), k)
        ajoute(gname(ch) + '.mbt', gname(ch), 'B')
    f.setGlyphOrder(order); f['maxp'].numGlyphs = len(order)
    for n in nouveaux:
        glyf[n].recalcBounds(glyf); hmtx[n] = (hmtx[n][0], glyf[n].xMin)
    # ⭐ COULEURS (21/10, vérifié dans le Word de Rem : affichées quand la PAGE est en mode clair ; en mode sombre Word les ignore et
    # garde le dessin, marques comprises). Deux formats, comme l'essai validé : COLR v0 + CPAL, et SVG.
    cpal = newTable('CPAL'); cpal.version = 0; cpal.numPaletteEntries = 2
    cpal.palettes = [[Color(red=c[0], green=c[1], blue=c[2], alpha=0xFF) for c in (VERM, BLEU)]]
    f['CPAL'] = cpal
    calques = {}
    for ch in marquees:
        g0 = gname(ch)
        calques[g0 + '.mu'] = [(g0 + '.mu', 0)]
        calques[g0 + '.sy'] = [(g0 + '.sy', 1)]
        calques[g0 + '.mb'] = [(g0 + '.mu', 0), (g0 + '.mbt', 1)]
    f['COLR'] = buildCOLR(calques, version=0)
    gs2 = f.getGlyphSet(); docs = []
    for n, cal in calques.items():
        chemins = []
        for (cg, pi) in cal:
            sp = SVGPathPen(gs2); gs2[cg].draw(TransformPen(sp, (1, 0, 0, -1, 0, 0)))
            chemins.append('<path fill="#%02X%02X%02X" d="%s"/>' % ((VERM, BLEU)[pi] + (sp.getCommands(),)))
        gid = f.getGlyphID(n)
        docs.append(('<svg xmlns="http://www.w3.org/2000/svg"><g id="glyph%d">%s</g></svg>' % (gid, ''.join(chemins)), gid, gid))
    svg = newTable('SVG '); svg.docList = sorted(docs, key=lambda d: d[1]); f['SVG '] = svg

    B = [gname(ch) for ch in lettres]
    TOUT = B + [g + p for g in B for p in POSF] + [gname(ch) + s for ch in marquees for s in MARQ.values()]
    fea = ['languagesystem DFLT dflt;', 'languagesystem latn dflt;',
           '@B = [%s];' % ' '.join(B), '@L = [%s];' % ' '.join(TOUT)]
    for p in POSF:
        fea.append('lookup V%s { %s } V%s;' % (p[1:], ' '.join('sub %s by %s%s;' % (g, g, p) for g in B), p[1:]))
    fea.append('lookup POS_MED { sub @L @B\' lookup Vmed @L; } POS_MED;')     # lettre entre deux lettres
    fea.append('lookup POS_FIN { sub @L @B\' lookup Vfin; } POS_FIN;')         # lettre après une lettre (et pas avant une autre)
    fea.append('lookup POS_INI { sub @B\' lookup Vini @L; } POS_INI;')         # lettre avant une lettre, en début de mot
    for k, suf in MARQ.items():                        # toute forme d'une lettre marquée → sa variante dessinée
        fea.append('lookup L%s { %s } L%s;' % (k, ' '.join('sub %s by %s%s;' % (gname(ch) + p, gname(ch), suf)
                                                       for ch in marquees for p in POSF), k))
    regles = []
    for n_forme, (v, c) in enumerate(formes):
        if n_forme and n_forme % PAR_BLOC == 0: regles.append('subtable;')
        a = min(i for i, k in enumerate(c) if k != '.'); z = max(i for i, k in enumerate(c) if k != '.')
        gl = [gname(ch) + ('.ini' if i == 0 else '.fin' if i == len(v) - 1 else '.med') for i, ch in enumerate(v)]
        run = ' '.join("%s'%s" % (gl[i], (' lookup L' + c[i]) if c[i] != '.' else '') for i in range(a, z + 1))
        regles.append(' '.join(('sub %s %s %s;' % (' '.join(gl[:a]), run, ' '.join(gl[z + 1:]))).split()))
    fea.append('lookup MOTS useExtension {\n  ' + '\n  '.join(regles) + '\n} MOTS;')
    for feat in ('ccmp', 'calt', 'liga', 'rlig'):
        fea.append('feature %s { lookup POS_MED; lookup POS_FIN; lookup POS_INI; lookup MOTS; } %s;' % (feat, feat))
    addOpenTypeFeaturesFromString(f, '\n'.join(fea))
    for r in f['name'].names:
        s = r.toUnicode()
        if r.nameID in (1, 3, 4): r.string = s.replace('OMEGA Dys', fam)
        if r.nameID == 6: r.string = ps + '-Regular'
    f.save(OUT)
    print('OK -> %s (%d mots, %d formes, %d glyphes, %d Ko)' % (OUT, len(mots), len(formes), len(order), os.path.getsize(OUT) // 1024))


if __name__ == '__main__':
    for st in (sys.argv[1:] or ['rond']): main(st)
