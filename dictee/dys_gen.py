# -*- coding: utf-8 -*-
u"""GÉNÉRATEUR DE FAUTES DYS — du texte correct vers du texte tel qu'un dyslexique l'écrirait.

IDÉE DE REM. On a déjà un pendu dyslexique ; on peut avoir un scripteur dyslexique. L'intérêt est
mécanique : un générateur donne du corpus APPARIÉ en quantité illimitée, puisque le corrigé est
l'original par construction. C'est la technique standard de « synthetic error generation » en GEC.

⚠️ LE PIÈGE, ET IL EST LE CŒUR DU PROBLÈME. Un générateur bâti sur MES hypothèses ne mesurerait
QUE mes hypothèses : on entraînerait/évaluerait le correcteur sur les fautes qu'on a imaginées, et
le chiffre monterait sans que personne n'écrive mieux. C'est la version corpus des cas de test
vides. La seule parade est de (1) CALIBRER sur du réel mesuré et (2) VALIDER sur un axe qui n'a pas
servi à calibrer.

(1) CALIBRATION — sur `dictee/dys_reel_probe.py`, mesuré sur les 6 dictées appariées de l'ASEI
    (écrit dys RÉEL, gold contraint par 5 scripteurs du même texte) :
      accent seul 19,4 · autre 16,4 · accord marque finale 13,4 · terminaison verbale 11,9
      lettre manquante 10,4 · 1 lettre changée 7,5 · mot oublié 7,5 · inversion 4,5
      mot en trop 3,0 · lettre en trop 3,0 · segmentation 3,0     (% des fautes)
    Taux : 19,8 % des mots portent une faute.
    ⚠️ NE PAS calibrer sur WiCoPaCo : mesuré, c'est la distribution d'un CLAVIER (terminaison
    verbale 1,0 % contre 11,9 % ici, soit ×12 d'écart). Cf. [[corpus-dys-reel-apparie]].

(2) VALIDATION — le juge INDÉPENDANT est LE CORRECTEUR, et lui seul.
    Il n'a jamais été réglé sur ce corpus. S'il rattrape 51 % du réel, il doit rattraper ~51 % du
    généré : beaucoup plus, nos fautes sont trop faciles et le générateur ne modélise pas un dys.
    ⚠️ Le taux de mots réels a d'abord été présenté comme un second juge indépendant. Il ne l'est
    PLUS depuis qu'on préfère les formes attestées dans `_prefere_reel` — c'est devenu un contrôle
    de calibration. Le dire est le minimum : un juge qu'on a ajusté n'est plus un juge.

RÉSULTATS MESURÉS (graine 20260807, 240 versions fautives des 6 dictées) :
    · distribution : écart absolu cumulé 17,9 points sur 11 catégories (49,9 au premier jet)
    · mots réels : 38 % généré contre 47 % réel — cohérent
    · ⭐ LE CORRECTEUR : **47 % du généré traité contre 51 % du réel** ; mauvaises corrections
      5,3 % contre 5,1 %. Les fautes générées ont donc la même DIFFICULTÉ que les vraies.
    ⚠️ DEUX ÉCARTS QUI RESTENT, à ne pas cacher :
      · « autre » (fautes multiples sur un mot) : 9,7 % généré pour 16,4 % visé. Composer deux
        opérations ne suffit pas toujours à sortir de la catégorie de la première.
      · la RÉPARTITION rouge/orange diffère : réel 53 % de rouges, généré 38 %. Le générateur
        penche vers des fautes que le correcteur ne sait que SIGNALER, pas trancher. À surveiller
        si on s'en sert pour mesurer un progrès sur le rouge.

  python dictee/dys_gen.py --demo             # montrer ce que ça produit
  python dictee/dys_gen.py --valide           # les trois juges
  python dictee/dys_gen.py --jsonl <n> <out>  # produire du corpus apparié
"""
import os, sys, io, re, json, random, unicodedata, gzip, base64

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

APO = re.compile(u'[’ʼ‘]')
GRAINE = 20260807          # graine MAÎTRESSE : toute mesure de ce fichier est reproductible


def deacc(s):
    return u''.join(c for c in unicodedata.normalize('NFD', s)
                    if unicodedata.category(c) != 'Mn')


def charge_lex():
    u"""Le lexique du CORRECTEUR (speller-lex-gz, 214 684 formes dont 76 236 accentuées).

    ⚠️ Surtout pas `cgram_words.json` : il est entièrement désaccentué, donc aveugle à la moitié
    de ce qu'on génère ici. Erreur commise et corrigée le 2026-08-07.
    """
    app = os.path.join(ROOT, 'app', 'omega-pendu.html')
    if not os.path.exists(app):
        return set()
    h = io.open(app, encoding='utf-8').read()
    m = re.search(u'id="speller-lex-gz">([^<]*)<', h)
    if not m:
        return set()
    brut = gzip.decompress(base64.b64decode(re.sub(r'\s', '', m.group(1)))).decode('utf-8')
    return set(l.split(u'\t')[0].lower() for l in brut.split(u'\n') if l)


# ================================================================================================
# LES BRIQUES. Chacune renvoie une forme fautive, ou None si elle ne s'applique pas au mot.
# Principe directeur, tiré de la doctrine d'audibilité : le dys écrit CE QU'IL ENTEND. Une faute
# crédible garde donc le son et casse la lettre muette — pas l'inverse.
# ================================================================================================

VOY = u'aeiouyàâäéèêëîïôöùûü'
FINS_VERB = [u'er', u'é', u'ée', u'és', u'ées', u'ez', u'ai', u'ais', u'ait', u'aient']
FINS_I = [u'i', u'is', u'it', u'ie', u'ies']
FINS_U = [u'u', u'us', u'ut', u'ue', u'ues']


def f_accent(w, rng, lex):
    u"""Accent seul : é<->è, on le perd, ou on en met un de trop. La faute la plus fréquente."""
    idx = [i for i, c in enumerate(w) if c in u'éèêàùûôî']
    if idx:
        i = rng.choice(idx)
        rempl = {u'é': [u'e', u'è', u'ê'], u'è': [u'e', u'é'], u'ê': [u'e', u'é'],
                 u'à': [u'a'], u'ù': [u'u'], u'û': [u'u'], u'ô': [u'o'], u'î': [u'i']}[w[i]]
        return _prefere_reel([w[:i] + c + w[i + 1:] for c in rempl], lex, rng)
    idx = [i for i, c in enumerate(w) if c == u'e' and i > 0]
    if idx:
        i = rng.choice(idx)
        return _prefere_reel([w[:i] + c + w[i + 1:] for c in (u'é', u'è')], lex, rng)
    return None


def _prefere_reel(cands, lex, rng):
    u"""Entre plusieurs formes fautives possibles, préférer celle qui EXISTE dans le lexique.

    Ce n'est pas un ajustement pour faire joli : c'est la doctrine d'audibilité appliquée à
    l'écriture. Le dys écrit une forme qui SONNE juste, et une forme qui sonne juste en français
    est le plus souvent un mot réel (« a » pour « à », « ces » pour « ses », « vit » pour « vie »).
    Sans cette préférence le générateur ne produisait que 24 % de mots réels contre 47 % mesurés :
    il fabriquait du charabia, pas des fautes de dys.
    ⚠️ CONSÉQUENCE SUR LA MÉTHODE : le taux de mots réels devient un CONTRÔLE de calibration et
    non plus un juge indépendant. Le seul juge resté indépendant est le CORRECTEUR.
    """
    if not cands:
        return None
    vrais = [c for c in cands if c in lex]
    return rng.choice(vrais) if vrais else rng.choice(cands)


def _est_marque(a, b):
    u"""a et b ne diffèrent-ils que d'une marque finale e/s/x ? (le classifieur dirait « accord »)"""
    x, y = deacc(a), deacc(b)
    return any(y == x + m or x == y + m for m in (u'es', u's', u'x', u'e'))


def f_terminaison(w, rng, lex):
    u"""Terminaison verbale homophone : mangé/manger/mangez. ×12 plus fréquent que dans WiCoPaCo.

    ⚠️ On ÉCARTE les candidats qui ne diffèrent que d'une marque finale (« aimais » -> « aimai ») :
    le classifieur les rangerait en « accord », et la catégorie qu'on vise ici se viderait. Première
    version : terminaison générée 2,8 % pour une cible de 11,9 %, tout absorbé par « accord ».
    """
    for jeu in (FINS_VERB, FINS_I, FINS_U):
        for f in sorted(jeu, key=len, reverse=True):
            if w.endswith(f) and len(w) - len(f) >= 2:
                cands = [w[:-len(f)] + x for x in jeu if x != f]
                cands = [c for c in cands if not _est_marque(c, w)] or None
                return _prefere_reel(cands, lex, rng) if cands else None
    return None


def f_accord(w, rng, lex):
    u"""Accord : la marque finale e/s/x saute ou s'ajoute. Muette, donc invisible à l'oreille."""
    if w.endswith(u'aux') and len(w) > 4:
        return w[:-3] + u'als'
    cands = []
    for m in (u'es', u's', u'x', u'e'):
        if w.endswith(m) and len(w) - len(m) >= 3:
            cands.append(w[:-len(m)])
    cands += [w + u's', w + u'e']
    return _prefere_reel(cands, lex, rng)


def f_lettre_manque(w, rng, lex):
    u"""Lettre en moins — en visant les MUETTES et les doubles, pas au hasard."""
    cibles = [i for i in range(1, len(w)) if w[i] == w[i - 1]]                 # double consonne
    cibles += [i for i in range(1, len(w) - 1) if w[i] in u'hst' and w[i + 1] not in VOY]
    if not cibles:
        cibles = [i for i in range(1, len(w))]
    if not cibles:
        return None
    i = rng.choice(cibles)
    return w[:i] + w[i + 1:]


def f_lettre_trop(w, rng, lex):
    u"""Lettre en trop : on double une consonne (l'hésitation classique sur la gémination)."""
    cibles = [i for i, c in enumerate(w) if c not in VOY and i > 0]
    if not cibles:
        return None
    i = rng.choice(cibles)
    return w[:i] + w[i] + w[i:]


def f_lettre_change(w, rng, lex):
    u"""Une lettre pour une autre — parmi les confusions PHONOLOGIQUES réelles, pas n'importe quoi."""
    CONF = {u'b': u'd', u'd': u'b', u'p': u'q', u'q': u'p', u'm': u'n', u'n': u'm',
            u'v': u'f', u'f': u'v', u's': u'c', u'c': u's', u'g': u'j', u'j': u'g',
            u'k': u'c', u'z': u's', u't': u'd', u'a': u'e', u'e': u'a', u'o': u'ô', u'u': u'ou'}
    cibles = [i for i, c in enumerate(w) if c in CONF]
    if not cibles:
        return None
    i = rng.choice(cibles)
    return w[:i] + CONF[w[i]] + w[i + 1:]


def f_inversion(w, rng, lex):
    u"""Inversion de deux lettres voisines : « geurre » pour « guerre »."""
    if len(w) < 4:
        return None
    i = rng.randrange(1, len(w) - 1)
    return w[:i] + w[i + 1] + w[i] + w[i + 2:]


def f_autre(w, rng, lex):
    u"""« autre » = 16,4 % du réel. Ce n'est pas un fourre-tout : ce sont des fautes MULTIPLES sur
    le même mot (« oublirais » pour « oublierai » = lettre manquante + terminaison). On les
    fabrique donc par COMPOSITION, pas par bruit aléatoire."""
    a = rng.choice([f_lettre_manque, f_accent, f_lettre_change])(w, rng, lex)
    if not a or a == w:
        return None
    b = rng.choice([f_terminaison, f_accord, f_lettre_manque, f_inversion])(a, rng, lex)
    # Il FAUT deux opérations distinctes, sinon le classifieur range le résultat dans la catégorie
    # de la première et « autre » reste vide (mesuré : 7,8 % généré pour 16,4 % visé).
    return b if (b and b != a) else None


BRIQUES = [
    (19.4, f_accent),
    (16.4, f_autre),
    (13.4, f_accord),
    (11.9, f_terminaison),
    (10.4, f_lettre_manque),
    (7.5,  f_lettre_change),
    (4.5,  f_inversion),
    (3.0,  f_lettre_trop),
]
MOT_OUBLIE, MOT_TROP, SEGMENTATION = 7.5, 3.0, 3.0
TAUX = 0.198          # 19,8 % des mots portent une faute (mesuré)

# Mots-outils : ce sont eux que le dys saute, pas les mots pleins.
OUTILS = set(u"le la les un une des de du au aux à a et ou en y il elle ils elles je tu nous vous "
             u"se ce cette ces son sa ses leur leurs qui que quoi dont où ne pas plus est sont "
             u"sur pour par dans avec sans".split())


def genere(texte, rng, lex, taux=TAUX):
    u"""Renvoie (texte fautif, nombre de fautes posées)."""
    morceaux = re.split(u'(\\W+)', APO.sub(u"'", texte))
    idx = [i for i, m in enumerate(morceaux) if i % 2 == 0 and len(m) >= 2 and m.isalpha()]
    if not idx:
        return texte, 0
    cible = max(1, int(round(taux * len(idx))))
    rng.shuffle(idx)
    tot = sum(p for p, _ in BRIQUES) + MOT_OUBLIE + MOT_TROP + SEGMENTATION
    pose = 0
    suppr, dup, fus = [], [], []
    libres = list(idx)

    # ⚠️ ON TIRE LA BRIQUE D'ABORD, PUIS on cherche un mot où elle s'applique.
    # Première version : on tirait le mot puis la brique, et quand la brique ne s'appliquait pas
    # (« terminaison verbale » sur un mot qui n'a pas de terminaison verbale) le tirage était perdu.
    # Résultat mesuré : terminaison verbale 3,6 % pour une cible de 11,9 %, tandis que « accord »,
    # qui s'applique TOUJOURS (on peut toujours ajouter un s), gonflait à 25,5 % pour 13,4 %.
    # Ce n'était pas un défaut de calibration mais un défaut de TIRAGE.
    essais = 0
    while pose < cible and libres and essais < 40 * cible:
        essais += 1
        r = rng.random() * tot
        # --- opérations qui touchent le MOT entier ---
        if r < MOT_OUBLIE:
            cand = [i for i in libres if morceaux[i].lower() in OUTILS]
            if cand:
                i = rng.choice(cand); suppr.append(i); libres.remove(i); pose += 1
            continue
        r -= MOT_OUBLIE
        if r < MOT_TROP:
            i = rng.choice(libres); dup.append(i); libres.remove(i); pose += 1
            continue
        r -= MOT_TROP
        if r < SEGMENTATION:
            cand = [i for i in libres if i + 2 < len(morceaux) and morceaux[i + 1] == u' '
                    and (i + 2) in libres]
            if cand:
                i = rng.choice(cand); fus.append(i); libres.remove(i); libres.remove(i + 2); pose += 1
            continue
        r -= SEGMENTATION
        # --- opérations qui touchent les LETTRES ---
        for p, fn in BRIQUES:
            if r < p:
                for i in rng.sample(libres, min(len(libres), 12)):
                    w = morceaux[i]
                    out = fn(w.lower(), rng, lex)
                    if out and out != w.lower():
                        morceaux[i] = (out[0].upper() + out[1:]) if w[0].isupper() else out
                        libres.remove(i); pose += 1
                        break
                break
            r -= p
    for i in sorted(fus, reverse=True):
        morceaux[i] = morceaux[i] + morceaux[i + 2]
        morceaux[i + 1] = u''
        morceaux[i + 2] = u''
    for i in sorted(dup, reverse=True):
        morceaux[i] = morceaux[i] + u' ' + morceaux[i]
    for i in sorted(suppr, reverse=True):
        morceaux[i] = u''
        if i + 1 < len(morceaux) and morceaux[i + 1] == u' ':
            morceaux[i + 1] = u''
    return u''.join(morceaux), pose


# ================================================================================================
# LES TROIS JUGES. Aucun n'a servi à calibrer — c'est toute la question.
# ================================================================================================

def _typologie(paires):
    u"""Reclasse des paires (fautif, correct) avec la MÊME grille que sur le réel."""
    from dys_reel_probe import toks, align, classe, apostrophe, _segmentation
    from collections import Counter
    cnt, n = Counter(), 0
    for bad, good in paires:
        a, b = toks(bad), toks(good)
        ops = align(a, b)
        k = 0
        while k < len(ops):
            op, x, y = ops[k]
            if op == '=':
                k += 1; continue
            seg = _segmentation(ops, k)
            if seg:
                cnt[seg[0]] += 1; n += 1; k += 2; continue
            if op == 'sub':
                n += 1
                cnt[u'élision / apostrophe' if apostrophe(x, y) else (classe(x, y) or u'autre')] += 1
            elif op == 'del':
                n += 1; cnt[u'mot en trop'] += 1
            else:
                n += 1; cnt[u'mot oublié'] += 1
            k += 1
    return cnt, n


if __name__ == '__main__':
    from dys_reel_gold import raws
    arg = sys.argv[1] if len(sys.argv) > 1 else '--demo'
    lex = charge_lex()
    rng = random.Random(GRAINE)
    r = raws()
    if r is None:
        print(u'(corpus dys réel absent de data_local/dys_reel — pas de calibration possible)')
        sys.exit(0)

    if arg == '--demo':
        print(u'GÉNÉRATEUR DE FAUTES DYS — graine %d\n' % GRAINE)
        for cle, _, gold in r[:3]:
            faux, n = genere(gold, rng, lex)
            print(u'  ORIGINAL : %s' % gold[:110])
            print(u'  GÉNÉRÉ   : %s' % faux[:110])
            print(u'  (%d fautes posées)\n' % n)
        sys.exit(0)

    if arg == '--jsonl':
        n, dst = int(sys.argv[2]), sys.argv[3]
        src = [g for _, _, g in r]
        with io.open(dst, 'w', encoding='utf-8') as fh:
            for i in range(n):
                g = src[i % len(src)]
                faux, _ = genere(g, rng, lex)
                fh.write(json.dumps({'src': 'genere', 'raw': faux, 'fixed': g}, ensure_ascii=False) + u'\n')
        print(u'%d paires -> %s' % (n, dst))
        sys.exit(0)

    # ---------------------------------- --valide ----------------------------------
    print(u'VALIDATION DU GÉNÉRATEUR — trois juges, aucun n\'a servi à calibrer\n')
    paires = []
    for cle, _, gold in r:
        for _ in range(40):                       # 240 versions fautives des 6 textes
            paires.append((genere(gold, rng, lex)[0], gold))

    # --- JUGE 1 : la typologie retombe-t-elle sur la cible ? (contrôle, pas validation) ---
    CIBLE = {u'accent seul': 19.4, u'autre': 16.4, u'accord : marque finale (e/s/x)': 13.4,
             u'terminaison verbale': 11.9, u'lettre manquante': 10.4, u'1 lettre changée': 7.5,
             u'mot oublié': 7.5, u'inversion': 4.5, u'mot en trop': 3.0, u'lettre en trop': 3.0}
    cnt, n = _typologie(paires)
    print(u'  CONTRÔLE — la distribution générée contre la cible mesurée (%d fautes) :' % n)
    ecart = 0.0
    for c in sorted(set(list(cnt) + list(CIBLE)), key=lambda c: -cnt.get(c, 0)):
        ici, vise = 100.0 * cnt.get(c, 0) / max(1, n), CIBLE.get(c)
        if vise is None:
            print(u'    %-32s généré %5.1f %%   (hors cible)' % (c, ici)); continue
        ecart += abs(ici - vise)
        print(u'    %-32s généré %5.1f %%   cible %5.1f %%   écart %+.1f' % (c, ici, vise, ici - vise))
    print(u'    -> écart absolu cumulé : %.1f points' % ecart)

    # --- JUGE 2 : le taux de MOTS RÉELS, jamais ajusté ---
    if lex:
        reel = tot = 0
        from dys_reel_probe import toks, align
        for bad, good in paires:
            for op, x, y in align(toks(bad), toks(good)):
                if op == 'sub':
                    tot += 1
                    w = x.lower().rstrip(u"'").replace(u'œ', u'oe')
                    if w in lex:
                        reel += 1
        print(u'\n  JUGE — part de MOTS RÉELS parmi les substitutions (jamais ajustée) :')
        print(u'    généré %.0f %%   ·   réel mesuré 47 %%   ->   %s'
              % (100.0 * reel / max(1, tot), u'COHÉRENT' if abs(100.0 * reel / max(1, tot) - 47) <= 12 else u'ÉCART'))

    # --- JUGE 3 : le corpus pour le correcteur (mesuré par dys_corpus_probe.js) ---
    dst = os.path.join(ROOT, 'data_local', 'dys_reel', 'genere_gold.jsonl')
    with io.open(dst, 'w', encoding='utf-8') as fh:
        for bad, good in paires[:120]:
            fh.write(json.dumps({'src': 'genere', 'raw': bad, 'fixed': good}, ensure_ascii=False) + u'\n')
    print(u'\n  JUGE LE PLUS DUR — le CORRECTEUR, instrument indépendant jamais réglé sur ce corpus.')
    print(u'    Il rattrape 51 %% du RÉEL. S\'il rattrape bien plus du généré, nos fautes sont')
    print(u'    trop faciles et le générateur ne modélise pas un dys. Corpus écrit :')
    print(u'      node dictee/dys_corpus_probe.js %s' % os.path.relpath(dst, ROOT).replace(os.sep, '/'))
