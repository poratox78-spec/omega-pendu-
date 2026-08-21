# -*- coding: utf-8 -*-
"""OMEGA Dys — générateur paramétrique de la police (design AVEUGLE, cf. DESIGN_AVEUGLE.md).

Géométrie 100 % polygonale (cercles approximés à 48 segments) → TTF via fontTools.
Trois classes de graisse (le cœur de l'hypothèse) :
  VOISÉE  (b d g v z j)     → W_VOICED   (lourd : les cordes vibrent)
  SOURDE  (p t c k q f s)   → W_UNVOICED (léger : un souffle)
  NEUTRE  (le reste)        → W_NEUTRAL
Marqueurs anti-miroir : b=pied, d=drapeau, p=chapeau, q=queue, u=hampe terminale, l=pied.
Sortie : police/OmegaDys-Regular.ttf
"""
import math

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

# ---------------- paramètres (tout est réglable = falsifiable) ----------------
UPM = 1000
XH = 500          # hauteur d'x haute (surface distinctive maximale)
ASC = 750         # ascendantes
CAP = 700         # capitales
DESC = -250       # descendantes
SB = 70           # side bearings généreux (anti-encombrement)
W_VOICED = 105    # graisse consonne voisée
W_UNVOICED = 66   # graisse consonne sourde
W_NEUTRAL = 85    # graisse neutre
ACC_W = 64        # graisse des accents (agrandis, pente 45°)
SEG = 48          # segments par cercle complet

VOICED = set('bdgvzj')
UNVOICED = set('ptckqfs')


_UNIFORM = None   # graisse uniforme (variantes Light/Heavy pour la couche « police de son »)


def weight_of(ch):
    if _UNIFORM is not None:
        return _UNIFORM
    c = ch.lower()
    if c in VOICED:
        return W_VOICED
    if c in UNVOICED:
        return W_UNVOICED
    return W_NEUTRAL


# ---------------- primitives polygonales ----------------
def arc_pts(cx, cy, rx, ry, a0, a1, n=None):
    """Points le long d'un arc d'ellipse, a0→a1 en degrés (sens trigo si a1>a0)."""
    span = abs(a1 - a0)
    if n is None:
        n = max(3, int(SEG * span / 360.0))
    pts = []
    for i in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * i / n)
        pts.append((cx + rx * math.cos(a), cy + ry * math.sin(a)))
    return pts


def rect(x0, y0, x1, y1):
    return [[(x0, y0), (x1, y0), (x1, y1), (x0, y1)]]


def band(cx, cy, rx, ry, w, a0, a1):
    """Anneau partiel (arc épais) : arc externe a0→a1 puis arc interne a1→a0."""
    outer = arc_pts(cx, cy, rx, ry, a0, a1)
    inner = arc_pts(cx, cy, rx - w, ry - w, a1, a0)
    return [outer + inner]


def ring(cx, cy, rx, w, ry=None):
    """Anneau complet : contour externe + contour interne (sens opposé)."""
    ry = ry if ry is not None else rx
    outer = arc_pts(cx, cy, rx, ry, 0, 360)[:-1]
    inner = arc_pts(cx, cy, rx - w, ry - w, 360, 0)[:-1]
    return [outer, inner]


def stroke(x0, y0, x1, y1, w, cap=0.42):
    """Segment épais (quadrilatère), extrémités légèrement prolongées (joints fermés)."""
    dx, dy = x1 - x0, y1 - y0
    ln = math.hypot(dx, dy) or 1.0
    ux, uy = dx / ln, dy / ln
    nx, ny = -uy * w / 2.0, ux * w / 2.0
    e = w * cap
    x0, y0, x1, y1 = x0 - ux * e, y0 - uy * e, x1 + ux * e, y1 + uy * e
    return [[(x0 + nx, y0 + ny), (x1 + nx, y1 + ny), (x1 - nx, y1 - ny), (x0 - nx, y0 - ny)]]


def dot(cx, cy, r):
    return [arc_pts(cx, cy, r, r, 0, 360)[:-1]]


def translate(contours, dx, dy=0):
    return [[(x + dx, y + dy) for (x, y) in c] for c in contours]


# ---------------- lettres bas-de-casse ----------------
# Chaque fonction : (w) -> (contours, largeur_dessin)

def g_o(w):
    return ring(220, 250, 220, w), 440

def g_a(w):
    return ring(220, 250, 220, w) + rect(440 - w, 0, 440, XH), 440

def g_b(w):  # pied plat vers la gauche (anti-miroir)
    c = rect(60, 0, 60 + w, ASC) + ring(280, 250, 220, w) + rect(0, 0, 250, 52)
    return c, 500

def g_d(w):  # drapeau incliné à droite au sommet (anti-miroir)
    c = ring(220, 250, 220, w) + rect(440 - w, 0, 440, ASC) + \
        stroke(440 - w / 2, ASC - 25, 535, ASC - 115, w * 0.85)
    return c, 545

def g_p(w):  # chapeau à gauche en tête de hampe (anti-miroir)
    c = rect(60, DESC, 60 + w, XH) + rect(0, XH - 52, 60 + w, XH) + ring(280, 250, 220, w)
    return c, 500

def g_q(w):  # queue horizontale à droite (anti-miroir)
    c = ring(220, 250, 220, w) + rect(440 - w, DESC, 440, XH) + rect(440 - w, DESC, 590, DESC + 52)
    return c, 590

def g_c(w):
    return band(220, 250, 220, 220, w, 38, 322), 440

def g_e(w):
    return band(220, 250, 220, 220, w, 0, 318) + rect(24, 250 - w * 0.45, 438, 250 + w * 0.45), 440

def g_s(w):
    top = band(220, 375, 125, 125, w, 20, 270)
    bot = band(220, 125, 125, 125, w, 90, -160)
    return top + bot, 440

def g_t(w):
    c = rect(150, 0, 150 + w, 650) + rect(0, 430, 340, 430 + w) + rect(150, 0, 300, 48)
    return c, 350

def g_f(w):
    c = rect(120, 0, 120 + w, 690) + rect(120, 690 - w, 330, 690) + rect(0, 430, 330, 430 + w)
    return c, 340

def g_g(w):
    c = ring(220, 250, 220, w) + rect(440 - w, DESC + 60, 440, XH) + rect(150, DESC, 440, DESC + 66)
    return c, 440

def g_h(w):
    c = rect(0, 0, w, ASC) + band(215, 285, 215, 215, w, 0, 180) + rect(430 - w, 0, 430, 285)
    return c, 430

def g_n(w):
    c = rect(0, 0, w, XH) + band(215, 285, 215, 215, w, 0, 180) + rect(430 - w, 0, 430, 285)
    return c, 430

def g_m(w):
    c = rect(0, 0, w, XH)
    c += band(150, 350, 150, 150, w, 0, 180) + rect(300 - w, 0, 300, 350)
    c += band(450, 350, 150, 150, w, 0, 180) + rect(600 - w, 0, 600, 350)
    return c, 600

def g_u(w):  # hampe terminale pleine hauteur (≠ n retourné)
    c = rect(0, 215, w, XH) + band(215, 215, 215, 215, w, 180, 360) + rect(430 - w, 0, 430, XH)
    return c, 430

def g_r(w):
    return rect(0, 0, w, XH) + band(180, 320, 180, 180, w, 30, 180), 350

def g_v(w):
    return stroke(35, XH, 180, 0, w) + stroke(180, 0, 325, XH, w), 360

def g_w(w):
    c = stroke(25, XH, 130, 0, w) + stroke(130, 0, 235, XH, w)
    c += stroke(235, XH, 340, 0, w) + stroke(340, 0, 445, XH, w)
    return c, 470

def g_x(w):
    return stroke(25, XH, 335, 0, w) + stroke(335, XH, 25, 0, w), 360

def g_y(w):
    return stroke(30, XH, 190, 62, w) + stroke(350, XH, 105, DESC + 55, w), 380

def g_z(w):
    bh = max(60, w * 0.85)
    return rect(0, XH - bh, 360, XH) + stroke(305, XH - bh, 60, bh, w) + rect(0, 0, 360, bh), 360

def g_k(w):
    c = rect(0, 0, w, ASC) + stroke(w, 235, 330, XH, w) + stroke(125, 265, 330, 0, w)
    return c, 350

def g_i(w):
    c = rect(0, 0, w, XH) + rect(w / 2 - 62, 592, w / 2 + 62, 716)
    return c, w

def g_l(w):  # petit pied à droite (≠ I, ≠ 1)
    return rect(0, 0, w, ASC) + rect(0, 0, w + 105, 50), w + 105

def g_j(w):
    c = rect(100, DESC + 66, 100 + w, XH) + rect(0, DESC, 100 + w, DESC + 66)
    c += rect(100 + w / 2 - 62, 592, 100 + w / 2 + 62, 716)
    return c, 100 + w


# ---------------- capitales ----------------
def G_A(w):
    return stroke(30, 0, 215, CAP, w) + stroke(215, CAP, 400, 0, w) + rect(115, 225, 320, 225 + w), 430

def G_B(w):
    c = rect(0, 0, w, CAP)
    c += band(w, 520, 190, 180, w, -90, 90)
    c += band(w, 170, 215, 170, w, -90, 90)
    return c, 385

def G_C(w):
    return band(235, 350, 235, 350, w, 35, 325), 470

def G_D(w):
    return rect(0, 0, w, CAP) + band(w, 350, 330, 350, w, -90, 90), 330 + w

def G_E(w):
    bh = max(78, w)
    return rect(0, 0, w, CAP) + rect(0, CAP - bh, 360, CAP) + rect(0, 315, 315, 315 + bh) + rect(0, 0, 360, bh), 360

def G_F(w):
    bh = max(78, w)
    return rect(0, 0, w, CAP) + rect(0, CAP - bh, 360, CAP) + rect(0, 315, 315, 315 + bh), 360

def G_G(w):
    return band(235, 350, 235, 350, w, 38, 325) + rect(245, 275, 470, 275 + w) + rect(470 - w, 90, 470, 275 + w), 470

def G_H(w):
    return rect(0, 0, w, CAP) + rect(360 - w, 0, 360, CAP) + rect(0, 315, 360, 315 + w), 360

def G_I(w):
    return rect(150 - w / 2, 0, 150 + w / 2, CAP) + rect(25, CAP - 78, 275, CAP) + rect(25, 0, 275, 78), 300

def G_J(w):
    return rect(250, 78, 250 + w, CAP) + rect(0, 0, 250 + w, 78) + rect(0, 0, w * 0.8, 190), 250 + w

def G_K(w):
    return rect(0, 0, w, CAP) + stroke(w, 330, 340, CAP, w) + stroke(130, 370, 345, 0, w), 370

def G_L(w):
    return rect(0, 0, w, CAP) + rect(0, 0, 340, 78), 340

def G_M(w):
    c = rect(0, 0, w, CAP) + rect(430 - w, 0, 430, CAP)
    c += stroke(w / 2, CAP, 215, 190, w) + stroke(215, 190, 430 - w / 2, CAP, w)
    return c, 430

def G_N(w):
    return rect(0, 0, w, CAP) + stroke(w / 2, CAP - 40, 400 - w / 2, 40, w) + rect(400 - w, 0, 400, CAP), 400

def G_O(w):
    return ring(235, 350, 235, w, ry=350), 470

def G_P(w):
    return rect(0, 0, w, CAP) + ring(190, 505, 188, w, ry=195), 380

def G_Q(w):
    return ring(235, 350, 235, w, ry=350) + stroke(300, 130, 480, -55, w), 490

def G_R(w):
    return rect(0, 0, w, CAP) + ring(190, 505, 188, w, ry=195) + stroke(165, 320, 385, 0, w), 390

def G_S(w):
    top = band(220, 520, 180, 180, w, 20, 270)
    bot = band(220, 180, 180, 180, w, 90, -160)
    return top + bot, 440

def G_T(w):
    return rect(0, CAP - 82, 440, CAP) + rect(220 - w / 2, 0, 220 + w / 2, CAP - 82), 440

def G_U(w):
    return rect(0, 215, w, CAP) + band(215, 215, 215, 215, w, 180, 360) + rect(430 - w, 215, 430, CAP), 430

def G_V(w):
    return stroke(30, CAP, 215, 0, w) + stroke(215, 0, 400, CAP, w), 430

def G_W(w):
    c = stroke(20, CAP, 165, 0, w) + stroke(165, 0, 310, CAP, w)
    c += stroke(310, CAP, 455, 0, w) + stroke(455, 0, 600, CAP, w)
    return c, 620

def G_X(w):
    return stroke(25, CAP, 395, 0, w) + stroke(395, CAP, 25, 0, w), 420

def G_Y(w):
    return stroke(30, CAP, 210, 330, w) + stroke(390, CAP, 210, 330, w) + rect(210 - w / 2, 0, 210 + w / 2, 355), 420

def G_Z(w):
    bh = max(78, w)
    return rect(0, CAP - bh, 400, CAP) + stroke(340, CAP - bh, 65, bh, w) + rect(0, 0, 400, bh), 400


# ---------------- ponctuation ----------------
def g_period(w):
    return rect(0, 0, 124, 124), 124

def g_comma(w):
    return rect(0, 0, 124, 124) + stroke(62, 10, 8, -150, 74), 124

def g_apos(w):
    return rect(0, 555, 95, 700), 95

def g_hyphen(w):
    return rect(0, 218, 250, 218 + W_NEUTRAL), 250

def g_excl(w):
    return rect(20, 215, 20 + 92, CAP) + rect(0, 0, 130, 124), 132

def g_quest(w):
    c = band(155, 485, 150, 195, W_NEUTRAL, -75, 180)
    c += rect(112, 150, 112 + 88, 285) + rect(95, 0, 220, 118)
    return c, 310

def g_colon(w):
    return rect(0, 0, 124, 124) + rect(0, 356, 124, 480), 124

def g_semi(w):
    return rect(0, 356, 124, 480) + rect(0, 0, 124, 124) + stroke(62, 10, 8, -150, 74), 124


# ---------------- accents (agrandis, pente 45° franche) ----------------
def acc_acute(cx, y=590):
    return stroke(cx - 92, y, cx + 92, y + 128, ACC_W)

def acc_grave(cx, y=590):
    return stroke(cx - 92, y + 128, cx + 92, y, ACC_W)

def acc_circ(cx, y=585):
    return stroke(cx - 112, y, cx, y + 125, ACC_W * 0.92) + stroke(cx, y + 125, cx + 112, y, ACC_W * 0.92)

def acc_trema(cx, y=610):
    return dot(cx - 95, y + 55, 55) + dot(cx + 95, y + 55, 55)

def acc_cedilla(cx):
    return rect(cx - 26, -95, cx + 30, 6) + rect(cx - 26, -160, cx + 90, -95)


LOWER = dict(a=g_a, b=g_b, c=g_c, d=g_d, e=g_e, f=g_f, g=g_g, h=g_h, i=g_i, j=g_j,
             k=g_k, l=g_l, m=g_m, n=g_n, o=g_o, p=g_p, q=g_q, r=g_r, s=g_s, t=g_t,
             u=g_u, v=g_v, w=g_w, x=g_x, y=g_y, z=g_z)
UPPER = dict(A=G_A, B=G_B, C=G_C, D=G_D, E=G_E, F=G_F, G=G_G, H=G_H, I=G_I, J=G_J,
             K=G_K, L=G_L, M=G_M, N=G_N, O=G_O, P=G_P, Q=G_Q, R=G_R, S=G_S, T=G_T,
             U=G_U, V=G_V, W=G_W, X=G_X, Y=G_Y, Z=G_Z)
PUNCT = {'.': ('period', g_period), ',': ('comma', g_comma), "'": ('quotesingle', g_apos),
         '’': ('quoteright', g_apos), '-': ('hyphen', g_hyphen), '!': ('exclam', g_excl),
         '?': ('question', g_quest), ':': ('colon', g_colon), ';': ('semi', g_semi)}

# accentuées : (base, accent, nom)
ACCENTED = {
    'é': ('e', 'acute'), 'è': ('e', 'grave'), 'ê': ('e', 'circ'), 'ë': ('e', 'trema'),
    'à': ('a', 'grave'), 'â': ('a', 'circ'),
    'ù': ('u', 'grave'), 'û': ('u', 'circ'), 'ü': ('u', 'trema'),
    'î': ('i', 'circ'), 'ï': ('i', 'trema'),
    'ô': ('o', 'circ'), 'ö': ('o', 'trema'),
    'ç': ('c', 'cedilla'),
    'É': ('E', 'acute'), 'È': ('E', 'grave'), 'Ê': ('E', 'circ'),
    'À': ('A', 'grave'), 'Ç': ('C', 'cedilla'), 'Ô': ('O', 'circ'),
}
ACC_FN = dict(acute=acc_acute, grave=acc_grave, circ=acc_circ, trema=acc_trema)


def build_glyph_contours(ch):
    """(contours, largeur) pour un caractère, graisse selon la classe phonologique."""
    w = weight_of(ch)
    if ch in LOWER:
        return LOWER[ch](w)
    if ch in UPPER:
        return UPPER[ch](w)
    if ch in ACCENTED:
        base, acc = ACCENTED[ch]
        contours, width = build_glyph_contours(base)
        contours = [list(c) for c in contours]
        cx = width / 2.0
        if acc == 'cedilla':
            contours += acc_cedilla(cx)
        else:
            y = 790 if base.isupper() else (590 if base not in ('i',) else 592)
            if base == 'i':  # l'accent remplace le point
                contours = [c for c in contours if max(p[1] for p in c) < 560]
            contours += ACC_FN[acc](cx, y) if base.isupper() else ACC_FN[acc](cx)
        return contours, width
    return None, None


def build(style='Regular', uniform=None):
    """Construit une TTF. `uniform` force une graisse unique (Light/Heavy) : c'est la
    couche de rendu (g2p) qui choisit alors la graisse par PHONÈME via des spans —
    le texte Unicode, lui, ne change JAMAIS."""
    global _UNIFORM
    _UNIFORM = uniform
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    chars = list('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ') + \
        list(ACCENTED.keys()) + list(PUNCT.keys())

    glyphs, cmap, metrics, order = {}, {}, {}, ['.notdef', 'space']

    # .notdef : rectangle vide
    pen = TTGlyphPen(None)
    for c in rect(60, 0, 540, CAP):
        pen.moveTo(c[0])
        for p in c[1:]:
            pen.lineTo(p)
        pen.closePath()
    for c in rect(120, 60, 480, CAP - 60)[0:1]:
        pen.moveTo(c[-1])
        for p in reversed(c[:-1]):
            pen.lineTo(p)
        pen.closePath()
    glyphs['.notdef'] = pen.glyph()
    metrics['.notdef'] = (660, 60)

    glyphs['space'] = TTGlyphPen(None).glyph()
    metrics['space'] = (340, 0)
    cmap[ord(' ')] = 'space'
    cmap[0x00A0] = 'space'

    # --- variantes de SON (zone privée Unicode) : la « police de son » ---
    # La forme dépend du PHONÈME, pas de la lettre ; c'est la couche de rendu
    # (g2p/n-grams du projet) qui substitue le codepoint. v1 :
    #   U+E000 = s prononcé /z/ (voisé → graisse lourde)  ex. poi_s_on
    #   U+E001 = s muet (squelette léger, à griser côté rendu)
    SOUND_VARIANTS = {0xE000: ('s.voiced', g_s, W_VOICED), 0xE001: ('s.mute', g_s, W_UNVOICED)}

    seen = set()
    for cp, (name, fn, wv) in SOUND_VARIANTS.items():
        contours, width = fn(wv)
        contours = translate(contours, SB)
        pen = TTGlyphPen(None)
        for c in contours:
            c = [(round(x), round(y)) for x, y in c]
            pen.moveTo(c[0])
            for p in c[1:]:
                pen.lineTo(p)
            pen.closePath()
        g = pen.glyph()
        glyphs[name] = g
        g.recalcBounds(None)
        metrics[name] = (round(width + 2 * SB), g.xMin if g.numberOfContours else 0)
        cmap[cp] = name
        order.append(name)

    for ch in chars:
        if ch in PUNCT:
            name, fn = PUNCT[ch]
            contours, width = fn(W_NEUTRAL)
        else:
            name = 'uni%04X' % ord(ch)
            contours, width = build_glyph_contours(ch)
        if name in seen:
            cmap[ord(ch)] = name
            continue
        seen.add(name)
        contours = translate(contours, SB)
        pen = TTGlyphPen(None)
        for c in contours:
            c = [(round(x), round(y)) for x, y in c]
            pen.moveTo(c[0])
            for p in c[1:]:
                pen.lineTo(p)
            pen.closePath()
        g = pen.glyph()
        glyphs[name] = g
        g.recalcBounds(None)
        lsb = g.xMin if g.numberOfContours else 0
        metrics[name] = (round(width + 2 * SB), lsb)
        cmap[ord(ch)] = name
        order.append(name)

    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=880, descent=-280)
    fam = 'OMEGA Dys' if style == 'Regular' else 'OMEGA Dys ' + style
    fb.setupNameTable({
        'familyName': fam,
        'styleName': 'Regular',
        'fullName': 'OMEGA Dys ' + style,
        'psName': 'OMEGADys-' + style,
        'version': 'Version 0.1',
        'description': 'Police experimentale dys — design en aveugle OMEGA '
                       '(voisement = graisse, anti-miroir bdpq, accents agrandis).',
        'licenseDescription': 'CC BY-SA 4.0 (prototype de recherche OMEGA).',
    })
    fb.setupOS2(sTypoAscender=880, sTypoDescender=-280, sTypoLineGap=200,
                usWinAscent=960, usWinDescent=320)
    fb.setupPost()
    out = os.path.join(here, 'OmegaDys-%s.ttf' % style)
    fb.save(out)
    print('OK ->', out, '(%d glyphes)' % len(order))


def main():
    build('Regular')                    # graisse par lettre (statique, utilisable seule)
    build('Light', uniform=W_UNVOICED)  # pour les spans « sourde » de la police de son
    build('Heavy', uniform=W_VOICED)    # pour les spans « voisée » de la police de son


if __name__ == '__main__':
    main()
