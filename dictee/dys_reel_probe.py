# -*- coding: utf-8 -*-
u"""LA TYPOLOGIE DES FAUTES SUR DU VRAI ÉCRIT DYS — la cible de calibration qu'on n'avait pas.

POURQUOI CE PROBE EXISTE. Pour construire un générateur de fautes dys (idée de Rem), il faut savoir
QUOI générer. On avait deux sources et aucune ne pouvait servir de juge :
  · WiCoPaCo, 138 495 paires — mais ce sont des Wikipédiens qui réparent des COQUILLES. Mesuré :
    lettre manquante 27,7 %, accent seul 22,6 %, terminaison verbale 1,0 %. C'est la distribution
    d'un CLAVIER. Or le correcteur dépense l'essentiel de ses règles sur l'accord et les
    terminaisons — quasi absentes de cette distribution.
  · les corpus fabriqués de data_local — un générateur calibré dessus ne mesurerait que les
    hypothèses de celui qui les a fabriqués. Le piège circulaire.

Ici la source est de l'écrit dys RÉEL (dictées ASEI) et le gold est CONTRAINT (cinq scripteurs, un
même texte dicté) — cf. `dys_reel_gold.py`. La distribution qui en sort n'est l'hypothèse de personne.

MÉTHODE. Alignement mot à mot par programmation dynamique (Levenshtein sur la suite de tokens), puis
classement de chaque substitution. Les catégories sont VOLONTAIREMENT celles employées pour
WiCoPaCo, sinon la comparaison ne veut rien dire. Une faute tombe dans la PREMIÈRE catégorie qui
s'applique, de la plus spécifique à la plus vague — et « autre » est laissée visible, pas répartie
de force : c'est le taux d'« autre » qui dit si la grille est bonne.

  python dictee/dys_reel_probe.py            # dictées appariées (typologie + comparaison)
"""
import os, sys, io, json, unicodedata, re
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from dys_reel_gold import raws, DIR

APO = re.compile(u'[’ʼ‘]')


def deacc(s):
    return u''.join(c for c in unicodedata.normalize('NFD', s)
                    if unicodedata.category(c) != 'Mn')


def toks(s):
    return re.findall(u"[A-Za-zÀ-ÿŒœÆæ]+['’]?|[0-9]+", APO.sub(u"'", s))


def align(a, b):
    u"""Alignement DP mot à mot -> liste d'opérations ('=', 'sub', 'del', 'ins')."""
    n, m = len(a), len(b)
    d = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        d[i][0] = i
    for j in range(m + 1):
        d[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            c = 0 if a[i - 1].lower() == b[j - 1].lower() else 1
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c)
    ops, i, j = [], n, m
    while i > 0 or j > 0:
        if i > 0 and j > 0 and d[i][j] == d[i - 1][j - 1] + (0 if a[i - 1].lower() == b[j - 1].lower() else 1):
            ops.append(('=' if a[i - 1].lower() == b[j - 1].lower() else 'sub', a[i - 1], b[j - 1]))
            i -= 1; j -= 1
        elif i > 0 and d[i][j] == d[i - 1][j] + 1:
            ops.append(('del', a[i - 1], None)); i -= 1
        else:
            ops.append(('ins', None, b[j - 1])); j -= 1
    return ops[::-1]


# Terminaisons verbales homophones : le cœur du français écrit, et le point aveugle de WiCoPaCo.
# ⚠️ DÉSACCENTUÉES : on compare sur deacc(), donc « ée » n'existe plus ici, c'est « ee ». Écrire la
# liste accentuée la rendait inerte pour la moitié des cas (marier -> mariée tombait en « 1 lettre
# changée »).
FIN = ('er', 'e', 'ee', 'es', 'ees', 'ez', 'ai', 'ais', 'ait', 'aient', 'is', 'it', 'i', 'ie', 'ies',
       'us', 'ut', 'u', 'ue')
# Ajouts de MARQUE (e/s/x/es) : c'est de l'ACCORD (genre/nombre), pas un choix de terminaison verbale.
# La distinction n'est pas cosmétique — l'accord et la terminaison sont deux familles de règles
# différentes dans le correcteur, et c'est le partage entre les deux qu'on veut chiffrer.
MARQUE = ('e', 's', 'x', 'es', 'es')


def _rac(w):
    for f in sorted(FIN, key=len, reverse=True):
        if w.endswith(f):
            return w[:-len(f)], f
    return None, None


def classe(bad, good):
    b, g = bad.lower(), good.lower()
    db, dg = deacc(b), deacc(g)
    if b == g:
        return None
    if db == dg:
        return u'accent seul'
    for m in MARQUE:                       # AVANT la terminaison verbale : abris/abri est un accord
        if dg == db + m or db == dg + m:
            return u'accord : marque finale (e/s/x)'
    rb, fb = _rac(db)
    rg, fg = _rac(dg)
    if rb is not None and rb == rg and fb != fg and len(rb) >= 2:
        return u'terminaison verbale'
    if len(db) == len(dg) and sum(1 for x, y in zip(db, dg) if x != y) == 1:
        return u'1 lettre changée'
    if len(db) == len(dg) and sorted(db) == sorted(dg):
        return u'inversion'
    if len(dg) == len(db) + 1 and dg[:len(db)] != db and _sousmot(db, dg):
        return u'lettre manquante'
    if _sousmot(db, dg):
        return u'lettre manquante'
    if _sousmot(dg, db):
        return u'lettre en trop'
    return u'autre'


def _sousmot(court, long_):
    u"""court s'obtient-il de long_ en retirant des lettres (sous-suite) ?"""
    if len(court) >= len(long_):
        return False
    it = iter(long_)
    return all(c in it for c in court)


def apostrophe(bad, good):
    return (u"'" in good) != (u"'" in bad)


def _segmentation(ops, k):
    u"""Les deux opérations en ops[k:k+2] forment-elles une fusion/scission de mots ?

    Renvoie (libellé, exemple) ou None. On accepte les deux ORDRES possibles produits par la DP.
    """
    if k + 1 >= len(ops):
        return None
    paire = [ops[k], ops[k + 1]]
    sub = [p for p in paire if p[0] == 'sub']
    if len(sub) != 1:
        return None
    _, sx, sy = sub[0]
    dele = [p for p in paire if p[0] == 'del']
    ins = [p for p in paire if p[0] == 'ins']
    if len(dele) == 1:                                  # 2 mots écrits -> 1 mot attendu
        dx = dele[0][1]
        for coll in (sx + dx, dx + sx):
            if deacc(coll.lower()) == deacc(sy.lower()):
                return u'segmentation (fusion)', u'%s + %s -> %s' % (sx, dx, sy)
    if len(ins) == 1:                                   # 1 mot écrit -> 2 mots attendus
        iy = ins[0][2]
        for coll in (sy + iy, iy + sy):
            if deacc(sx.lower()) == deacc(coll.lower()):
                return u'segmentation (scission)', u'%s -> %s + %s' % (sx, sy, iy)
    return None


if __name__ == '__main__':
    r = raws()
    if r is None:
        print(u'(corpus dys réel absent de data_local/dys_reel — rien à mesurer)')
        sys.exit(0)

    cnt, exemples = Counter(), {}
    nseg, nelis, nmots, nfautes = 0, 0, 0, 0
    for cle, raw, gold in r:
        a, b = toks(raw), toks(gold)
        nmots += len(b)
        ops = align(a, b)
        k = 0
        while k < len(ops):
            op, x, y = ops[k]
            if op == '=':
                k += 1; continue
            # SEGMENTATION : une fusion (« bien veillante » -> « bienveillante ») ou une scission
            # (« àeu » -> « a eu »). Elle sort de la DP en DEUX opérations dont l'ORDRE n'est pas
            # garanti : la DP peut produire (sub, del) comme (del, sub). Ne tester qu'un seul ordre
            # laissait « àeu » se faire classer « lettre en trop » et « bien veillante » exploser en
            # « mot en trop » + « autre ». On teste donc les deux sens.
            seg = _segmentation(ops, k)
            if seg:
                lab, ex = seg
                cnt[lab] += 1
                exemples.setdefault(lab, []).append(ex)
                nfautes += 1
                k += 2
                continue
            if op == 'sub':
                nfautes += 1
                if apostrophe(x, y):
                    c = u'élision / apostrophe'
                else:
                    c = classe(x, y) or u'autre'
                cnt[c] += 1
                exemples.setdefault(c, []).append(u'%s -> %s' % (x, y))
            elif op == 'del':
                nfautes += 1; cnt[u'mot en trop'] += 1; exemples.setdefault(u'mot en trop', []).append(x)
            else:
                nfautes += 1; cnt[u'mot oublié'] += 1; exemples.setdefault(u'mot oublié', []).append(y)
            k += 1

    print(u'TYPOLOGIE DES FAUTES — ÉCRIT DYS RÉEL (dictées ASEI, gold contraint)\n')
    print(u'  %d textes · %d mots · %d fautes  (%.1f %% des mots)\n'
          % (len(r), nmots, nfautes, 100.0 * nfautes / max(1, nmots)))
    print(u'  %-26s %5s  %6s   exemples' % (u'catégorie', u'n', u'%'))
    for c, n in cnt.most_common():
        ex = u', '.join(exemples[c][:3])
        print(u'  %-26s %5d  %5.1f %%   %s' % (c, n, 100.0 * n / max(1, nfautes), ex))

    # ---- la comparaison qui décide : ce corpus dit-il autre chose que WiCoPaCo ? ----
    WICO = {u'lettre manquante': 27.7, u'accent seul': 22.6, u'autre': 18.3, u'lettre en trop': 17.0,
            u'1 lettre changée': 10.8, u'inversion': 2.6, u'terminaison verbale': 1.0, u'marque finale s/x': 0.0}
    print(u'\n  CONTRE WiCoPaCo (138 495 paires de coquilles Wikipédia) :')
    for c in sorted(set(list(cnt.keys()) + list(WICO.keys())),
                    key=lambda c: -100.0 * cnt.get(c, 0) / max(1, nfautes)):
        ici = 100.0 * cnt.get(c, 0) / max(1, nfautes)
        la = WICO.get(c)
        if la is None:
            print(u'  %-26s  dys %5.1f %%   WiCoPaCo : catégorie absente (non annotée)' % (c, ici))
        else:
            fl = u'  <<< ÉCART' if abs(ici - la) >= 8 else u''
            print(u'  %-26s  dys %5.1f %%   WiCoPaCo %5.1f %%%s' % (c, ici, la, fl))

    # ================================================================================================
    # MOT RÉEL ou NON-MOT ? La question qui dit QUEL moteur peut voir la faute.
    # Un non-mot (« geurre », « uen ») est visible du CORRECTEUR ORTHOGRAPHIQUE : il suffit de ne pas
    # être dans le lexique. Un mot réel fautif (« cultivé » pour « cultivée », « a » pour « à ») est
    # INVISIBLE au speller — seule la grammaire peut le voir. C'est le partage qui décide où investir.
    # ================================================================================================
    # ⚠️ LE LEXIQUE DOIT ÊTRE CELUI DU CORRECTEUR, pas le premier sous la main. Première version de
    # cette sonde : `cgram_words.json`, 155 493 formes -> « sœur » ressortait en non-mot et le
    # plancher était surestimé. La vraie base du speller est le bloc `speller-lex-gz` de l'app :
    # 214 684 formes. Mesurer la couverture d'un moteur avec un AUTRE lexique que le sien ne mesure
    # rien — c'est la même faute que comparer le pendu EN au FR sans vérifier la couverture des data.
    LEX = set()
    EXACT = True          # vrai dès qu'on tient le lexique ACCENTUÉ du speller
    app = os.path.join(ROOT, 'app', 'omega-pendu.html')
    if os.path.exists(app):
        import gzip, base64
        h = io.open(app, encoding='utf-8').read()
        m = re.search(u'id="speller-lex-gz">([^<]*)<', h)
        if m:
            brut = gzip.decompress(base64.b64decode(re.sub(r'\s', '', m.group(1)))).decode('utf-8')
            LEX = set(l.split(u'\t')[0].lower() for l in brut.split(u'\n') if l)
    if not LEX:                                    # repli seulement si l'app est absente
        lexp = os.path.join(HERE, 'cgram_words.json')
        if os.path.exists(lexp):
            LEX = set(json.load(io.open(lexp, encoding='utf-8')))
            EXACT = False   # repli désaccentué : AVEUGLE aux fautes d'accent, chiffre à ne pas citer

    def connu(w):
        # Le lexique stocke « soeur », pas « sœur » -> normaliser la ligature, sinon faux non-mot.
        w = APO.sub(u"'", w).lower().rstrip(u"'").replace(u'œ', u'oe').replace(u'æ', u'ae')
        # ⚠️ PAS de repli désaccentué. Le premier jet comparait via deacc() parce que cgram_words est
        # ENTIÈREMENT désaccentué (0 forme accentuée sur 155 493, vérifié) : toute faute d'accent
        # ressortait donc « connue », et la part de mots réels était gonflée à 65 %. Le lexique du
        # speller, lui, porte 76 236 formes accentuées — « mère » y est, « mére » n'y est pas, et
        # c'est exactement la distinction qu'on veut mesurer.
        return w in LEX or (not EXACT and deacc(w) in LEX)

    if LEX:
        reel = sum(1 for c, exs in exemples.items() for e in exs
                   if u' -> ' in e and connu(e.split(u' -> ')[0]))
        tot = sum(1 for c, exs in exemples.items() for e in exs if u' -> ' in e)
        print(u'\n  MOT RÉEL vs NON-MOT (lexique de %d formes) — sur les %d fautes de substitution :' % (len(LEX), tot))
        print(u'    mot réel mais faux (INVISIBLE au speller, il faut la grammaire) : %d  (%.0f %%)'
              % (reel, 100.0 * reel / max(1, tot)))
        print(u'    non-mot (le speller peut le voir)                              : %d  (%.0f %%)'
              % (tot - reel, 100.0 * (tot - reel) / max(1, tot)))

    # ---- les 71 + 7 textes SANS gold : ce qu'on peut encore mesurer sans inventer de corrigé ----
    # Sans corrigé on ne peut pas mesurer un rappel. Mais le TAUX DE NON-MOTS est objectif (c'est
    # l'appartenance au lexique, pas mon jugement) et il donne un plancher du taux de fautes à une
    # échelle 13× supérieure aux dictées. À lire comme un PLANCHER : toutes les fautes en mot réel
    # sont invisibles ici, et on vient de mesurer qu'elles sont majoritaires.
    autres = []
    for base, _, fichiers in os.walk(DIR):
        for f in fichiers:
            if f.endswith('_raw.txt') and u'Dict' not in base.replace('\\', '/'):
                autres.append(os.path.join(base, f))
    if autres and LEX:
        # ⚠️ NETTOYAGE OBLIGATOIRE AVANT DE LIRE LE CHIFFRE. Le premier passage donnait 12,5 %, soit
        # PLUS que le taux de fautes total des dictées (19,8 % dont 6 % de non-mots) — incohérent,
        # donc suspect. Lecture des cas : les « non-mots » les plus fréquents étaient `harold`(23),
        # `afrique`(16), `france`(12), `maud`, `sony`, `bouddah`, plus les nombres `1960`, `30`, `70`.
        # Des NOMS PROPRES et des CHIFFRES, pas des fautes. On retire ce qui est objectivement
        # retirable ; le résidu de noms propres non capitalisés reste et est annoncé comme tel.
        nt = nn = 0
        propres = 0
        for p in sorted(autres):
            txt = io.open(p, encoding='utf-8').read()
            majs = set(w.lower() for w in re.findall(u'(?<![.!?]\\s)(?<!^)\\b[A-ZÀ-Þ][a-zà-ÿ]{2,}', txt))
            for w in toks(txt):
                if len(w) < 2 or w.isdigit():
                    continue
                nt += 1
                if connu(w):
                    continue
                if w.lower() in majs:                 # capitalisé en cours de phrase = nom propre
                    propres += 1
                    continue
                nn += 1
        print(u'\n  LES %d AUTRES TEXTES (expression libre + dirigée + scolaire, SANS corrigé) :' % len(autres))
        print(u'    %d mots · %d non-mots = %.1f %% — PLANCHER du taux de fautes' % (nt, nn, 100.0 * nn / max(1, nt)))
        print(u'    (%d noms propres et les nombres écartés ; il reste des noms propres écrits sans' % propres)
        print(u'     majuscule, donc ce plancher est encore LÉGÈREMENT surestimé)')
        print(u'    Sur les dictées appariées : %.1f %% de fautes TOTALES, dont %.1f %% de non-mots.'
              % (100.0 * nfautes / max(1, nmots), 100.0 * 21 / max(1, nmots)))
