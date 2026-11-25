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

⭐ VERSION 2 (25/11/2026, listes n° 670 et 671) : deux profils de plus, réglés sur 2 170 fautes réelles (dys lourd) et 574 (scolaire), avec
la position de la faute dans le mot, le son gardé, le sens de l'accord et la longueur du mot touché. La version 1 reste le
comportement par défaut, à l'identique. Détail et chiffres : le bloc « VERSION 2 » plus bas.

  python dictee/dys_gen.py --demo             # montrer ce que ça produit
  python dictee/dys_gen.py --valide           # les trois juges
  python dictee/dys_gen.py --jsonl <n> <out>  # produire du corpus apparié
  … --profil dys_lourd | scolaire             # la version 2 (avec --demo et --jsonl)
  python dictee/dys_gen.py --valide2 --profil dys_lourd --source <paires.jsonl>   # version 2 contre le réel, mêmes textes
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


_PLURIELS, _GENRES, _POS = None, None, None


def _morpho():
    u"""Tables morphologiques CURÉES : les formes plurielles connues et le genre des noms."""
    global _PLURIELS, _GENRES, _POS
    if _PLURIELS is None:
        try:
            _PLURIELS = set(json.load(io.open(os.path.join(HERE, 'cgram_plural.json'), encoding='utf-8')))
        except Exception:
            _PLURIELS = set()
        try:
            _GENRES = json.load(io.open(os.path.join(HERE, 'cgram_gender.json'), encoding='utf-8'))
        except Exception:
            _GENRES = {}
        try:
            _POS = json.load(io.open(os.path.join(HERE, 'cgram_pos.json'), encoding='utf-8'))
        except Exception:
            _POS = {}
    return _PLURIELS, _GENRES, _POS


ACCORDABLE = ('NOM', 'ADJ', 'VER')      # seuls porteurs de marque d'accord en français


def f_accord(w, rng, lex):
    u"""Accord : la marque finale e/s/x saute ou s'ajoute. Muette, donc invisible à l'oreille.

    ⚠️ CETTE BRIQUE A DÛ ÊTRE RÉÉCRITE APRÈS LECTURE DES CAS. La première version ajoutait un « s »
    ou un « e » à N'IMPORTE QUEL mot, et produisait « pour » -> « pours », « Texas » -> « Texass »,
    « Madagascar » -> « Madagascare », « sortir » -> « sortirs ». Ce ne sont pas des fautes d'accord :
    aucun dyslexique n'écrit ça, et le correcteur avait RAISON de s'abstenir. La famille « accord »
    ressortait à 32,7 % de traitement — on mesurait le charabia du générateur, pas une faiblesse du
    correcteur. C'est la 5ᵉ fois de la journée qu'il faut LIRE LES CAS avant de conclure.

    Le garde-fou : on ne pose la faute que sur un mot dont la morphologie est ATTESTÉE dans les
    tables curées — la forme fléchie visée doit exister. Un invariable, un nom propre ou un
    infinitif n'a pas de pluriel attesté, donc la brique s'abstient.
    """
    plur, genres, pos = _morpho()
    d = deacc(w)
    cat = (pos.get(d) or [u''])[0]
    if cat and cat not in ACCORDABLE:
        return None
    cands = []
    # (a) le mot EST un pluriel attesté -> le dys écrit le singulier (marque muette oubliée)
    if d in plur:
        for m in (u'x', u's'):
            if w.endswith(m) and len(w) - 1 >= 3:
                cands.append(w[:-1])
    # (b) le mot a un PLURIEL attesté -> le dys met la marque en trop
    if d + u's' in plur:
        cands.append(w + u's')
    # (c) genre : le féminin en -e existe -> confusion de genre (« un avocat » / « une avocate »)
    if not w.endswith(u'e') and genres.get(d) and (w + u'e') in lex and cat in ('NOM', 'ADJ'):
        cands.append(w + u'e')
    if w.endswith(u'e') and len(w) > 3 and w[:-1] in lex and cat in ('NOM', 'ADJ'):
        cands.append(w[:-1])
    return _prefere_reel(cands, lex, rng) if cands else None


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


# ================================================================================================
# ⭐ VERSION 2 (25/11/2026, liste n° 670 — Rem : « prendre en compte les lettres dansantes »).
#
# CE QUE LA MESURE A DIT, avant d'écrire une ligne. La version 1 a été réglée sur 67 fautes (6 dictées).
# Les 72 productions dys lourdes en donnent 2 189, les copies scolaires 575. Même grille (dys_reel_probe) :
#   · LES LETTRES NE DANSENT PRESQUE PAS À L'ÉCRIT : un mot écrit avec les bonnes lettres dans un autre
#     ordre, c'est 0,9 % des fautes (0,5 % chez les scolaires) — la version 1 en fabriquait 4,5 % ;
#   · LA PREMIÈRE LETTRE TIENT : gardée dans 96 % des mots fautifs de 4 lettres et plus. La version 1 la
#     changeait 22 fois sur 100 dans sa brique « lettre changée » ;
#   · LA FAUTE EST À LA FIN : 59 % des fautes commencent dans le dernier tiers du mot ;
#   · LES CONFUSIONS « EN MIROIR » (b/d, p/q) SONT ABSENTES : sur 128 lettres changées, aucune. Ce qu'on
#     trouve : a→e 30, c→s 17, m→n 10, e→a 9, et des finales (s→t 8, s→e 7, t→s 4, s→x 3, t→x 3) ;
#   · LA LETTRE QUI TOMBE est une double (54), une voyelle du milieu (35), la finale (33), une consonne
#     du milieu (24), un h (3) ; LA LETTRE EN TROP est une double (25), une consonne (16), une voyelle
#     (12), une finale (11) ;
#   · UNE FAMILLE MANQUAIT : l'apostrophe oubliée (« jai », « lécole »), 3,6 % des fautes dys lourdes ;
#   · le TAUX : 30,9 % des mots sont fautifs dans les textes dys lourds, 13,5 % chez les scolaires
#     (19,8 % dans les 6 dictées).
# L'idée des « lettres dansantes » sert donc comme règle de POSITION — ce que l'œil tient (le début du mot)
# reste juste, c'est la fin qui lâche — et pas comme « mélanger les lettres ».
#
# TROIS PROFILS. `genere(..., profil=None)` reste la version 1, à l'identique (mêmes tirages) : le banc
# public `faiblesses.jsonl` et les mesures d'avant restent comparables. `profil='dys_lourd'` et
# `profil='scolaire'` sont la version 2. Les nombres de ce bloc sont des COMPTES mesurés, pas des réglages.
# ⚠️ ÉCART CONNU : les mots collés ou mal coupés sont rares dans cette grille (0,1 %) parce que
# l'alignement mot à mot les range dans « autre » ; la version 2 ne les modélise pas mieux que la 1.
# ================================================================================================

TIERS_MANQUE = (21, 45, 34)        # lettre manquante : début / milieu / fin du mot (mots de 4 lettres et plus)
TIERS_CHANGE = (26, 36, 38)        # lettre changée
P_PREMIERE = 0.06                  # la première lettre n'est touchée que 6 fois sur 100
CONF_V2 = {u'a': [(u'e', 30)], u'c': [(u's', 17)], u'm': [(u'n', 10)], u'e': [(u'a', 9)], u'i': [(u'e', 3), (u'y', 3)],
           u'g': [(u'c', 3)], u'u': [(u'i', 2)]}
CONF_FIN_V2 = {u's': [(u't', 8), (u'e', 7), (u'x', 3)], u't': [(u's', 4), (u'x', 3)], u'x': [(u't', 2)]}   # sur la DERNIÈRE lettre seulement
MANQUE_V2 = ((u'double', 54), (u'voyelle', 35), (u'finale', 33), (u'consonne', 24), (u'h', 3))
TROP_V2 = ((u'double', 25), (u'consonne', 16), (u'voyelle', 12), (u'finale', 11))
# L'apostrophe : trois formes mesurées. « collé » (« jai ») ne se voit pas dans la classe « élision / apostrophe » de la grille :
# l'alignement le compte comme un mot oublié plus une lettre en trop. `_typologie(..., colle=True)` le compte à part.
APO_COLLE = 19
APO_V2 =((u'colle', APO_COLLE), (u'separe', 17), (u'entier', 16))
APO_ENTIER = {u'l': (u'le', u'la'), u'd': (u'de',), u'j': (u'je',), u'n': (u'ne',), u'm': (u'me',), u't': (u'te',), u's': (u'se',), u'c': (u'ce',),
              u'qu': (u'que',), u'jusqu': (u'jusque',), u'lorsqu': (u'lorsque',), u'puisqu': (u'puisque',), u'quelqu': (u'quelque',)}


def _pondere(rng, choix):
    u"""Tire un élément de [(valeur, poids), …] ; None si la liste est vide."""
    choix = [(v, p) for v, p in choix if p > 0]
    if not choix:
        return None
    r = rng.random() * sum(p for _, p in choix)
    for v, p in choix:
        if r < p:
            return v
        r -= p
    return choix[-1][0]


def _poids_position(i, n, tiers):
    u"""Poids d'une position dans un mot de n lettres : son tiers (début, milieu, fin) et la règle de la première lettre."""
    p = tiers[0] if i < n / 3.0 else tiers[1] if i < 2 * n / 3.0 else tiers[2]
    return p * (P_PREMIERE if i == 0 else 1.0)


# ⭐ LE SON. Le juge indépendant (le correcteur) a refusé la première version 2 : il traitait 78 % des fautes réelles et 62 % des
# fautes générées — autant que la version 1. Mesure : une faute RÉELLE garde le son du mot bien plus souvent qu'une faute tirée au
# hasard de la position. Clé de son = la lecture devinée du moteur (`decompose.g2p_moteur_cle`), mot écrit contre mot attendu :
#                         même son    un son d'écart    plus      (72 productions dys lourdes)
#   lettre manquante         59 %          26 %         15 %      — la version 1 : 17 / 47 / 36
#   1 lettre changée         61 %          24 %         14 %      — la version 1 : 23 / 66 / 11
#   lettre en trop           34 %          41 %         25 %
# « Le dys écrit ce qu'il entend » : chaque brique énumère donc TOUTES ses fautes possibles sur le mot, les range par écart de son,
# tire d'abord l'écart de son dans la proportion mesurée, puis la faute dans cette case (nature de la lettre et position).
SON_V2 = {u'dys_lourd': {u'manque': (59, 26, 15), u'change': (61, 24, 14), u'trop': (34, 41, 25)},
          u'scolaire': {u'manque': (38, 34, 28), u'change': (58, 32, 11), u'trop': (57, 34, 9)}}
_SON = SON_V2[u'dys_lourd']        # posé par genere() selon le profil
_CLE_SON, _G2P = {}, []


def _cle_son(w):
    u"""Clé de son du moteur ; chaîne vide si la lecture devinée n'est pas disponible (la contrainte de son se tait alors)."""
    if not _G2P:
        try:
            import decompose
            _G2P.append(decompose.g2p_moteur_cle)
        except Exception:
            _G2P.append(None)
    if _G2P[0] is None:
        return u''
    if w not in _CLE_SON:
        try:
            _CLE_SON[w] = _G2P[0](w)
        except Exception:
            _CLE_SON[w] = u''
    return _CLE_SON[w]


def _ecart_son(a, b):
    u"""0 = même son ; 1 = un son d'écart (changé, en plus ou en moins) ; 2 = plus."""
    a, b = _cle_son(a), _cle_son(b)
    if a == b:
        return 0
    if abs(len(a) - len(b)) > 1:
        return 2
    if len(a) == len(b):
        return 1 if sum(1 for x, y in zip(a, b) if x != y) == 1 else 2
    court, long_ = (a, b) if len(a) < len(b) else (b, a)
    return 1 if any(long_[:k] + long_[k + 1:] == court for k in range(len(long_))) else 2


def _tire_par_son(w, cands, rng, cible, lex=None, reel=None):
    u"""cands = [(forme fautive, poids)] : tire d'abord l'écart de son (proportion mesurée), puis la forme dans cette case.
    `reel` : True = la faute doit donner un VRAI mot (« par » pour « part »), False = un mot qui n'existe pas, None = libre.
    C'est genere() qui tire ce choix dans la proportion mesurée (REEL_V2) et cherche un mot où il est possible."""
    cases = {0: [], 1: [], 2: []}
    for f, poids in cands:
        if f != w and poids > 0 and (reel is None or not lex or (f in lex) == reel):
            cases[_ecart_son(w, f)].append((f, poids))
    e = _pondere(rng, [(k, cible[k]) for k in (0, 1, 2) if cases[k]])
    return _pondere(rng, cases[e]) if e is not None else None


def f_lettre_manque_v2(w, rng, lex, reel=None):
    u"""Lettre en moins, version 2 : le SON gardé d'abord, puis la nature de la lettre qui tombe et sa position (comptes mesurés)."""
    n = len(w)
    if n < 3:
        return None
    nat = dict(MANQUE_V2)
    cands = []
    for i in range(n):
        if i > 0 and w[i] == w[i - 1]:
            poids = nat[u'double']
        elif i == n - 1:
            poids = nat[u'finale']
        elif w[i] == u'h' and i > 0:
            poids = nat[u'h'] * 4.0
        else:
            poids = (nat[u'voyelle'] if w[i] in VOY else nat[u'consonne']) * _poids_position(i, n, TIERS_MANQUE) / 40.0
        cands.append((w[:i] + w[i + 1:], poids))
    return _tire_par_son(w, cands, rng, _SON[u'manque'], lex, reel)


def f_lettre_trop_v2(w, rng, lex, reel=None):
    u"""Lettre en trop, version 2 : une consonne doublée, une consonne ou une voyelle glissée, une finale ajoutée — le son d'abord."""
    n = len(w)
    if n < 3:
        return None
    nat = dict(TROP_V2)
    cands = []
    for i in range(1, n):                                     # jamais devant la première lettre
        if w[i] not in VOY and w[i] != w[i - 1]:
            cands.append((w[:i] + w[i] + w[i:], nat[u'double']))
        for c, q in ((u's', 3), (u't', 3), (u'n', 2), (u'r', 2), (u'l', 2), (u'h', 2)):
            cands.append((w[:i] + c + w[i:], nat[u'consonne'] * q / 14.0))
        for c, q in ((u'e', 6), (u'i', 2), (u'a', 1), (u'u', 1)):
            cands.append((w[:i] + c + w[i:], nat[u'voyelle'] * q / 10.0))
    for c, q in ((u't', 5), (u'd', 2), (u'r', 2), (u'p', 1)):   # pas e / s / x : une marque ajoutée est une faute d'ACCORD pour la grille
        cands.append((w + c, nat[u'finale'] * q / 10.0 * n))
    return _tire_par_son(w, cands, rng, _SON[u'trop'], lex, reel)


_ALPHABET = u'abcdefghijklmnopqrstuvwxyz'
# Part des fautes qui donnent un VRAI mot, par classe (72 productions dys lourdes) : une lettre changée 59 %, une lettre en trop 52 %,
# une lettre manquante 41 % ; la première version 2 en donnait 16, 18 et 28 %.
REEL_V2 = {u'manque': 0.15, u'change': 0.25, u'trop': 0.20}          # version 2.1 : le reste des vrais mots vient de la brique des homophones
_CLASSE_V2 = {u'f_lettre_manque_v2': u'manque', u'f_lettre_change_v2': u'change', u'f_lettre_trop_v2': u'trop'}
# LE SENS DE L'ACCORD : dans le réel la marque est OUBLIÉE 86 fois sur 100 (« les voiture »), ajoutée 14 fois. La version 1 l'ajoute
# 66 fois sur 100 — et une marque en trop sur un mot isolé est invisible pour un correcteur, d'où des « ratés » qui n'existent pas.
P_ACCORD_OUBLI = 0.95                     # tiré plus haut que la part visée (86 %) : d'autres briques ajoutent des marques
# LA LONGUEUR DU MOT TOUCHÉ : les fautes réelles tombent sur les mots longs (part des fautes / part des mots du texte : 1-2 lettres
# 14 / 35, 3 lettres 8 / 14, 4-5 lettres 27 / 23, 6-8 lettres 34 / 20, 9 lettres et plus 17 / 8).
def _poids_longueur(w):
    n = len(w)
    return 0.40 if n <= 2 else 0.57 if n == 3 else 1.17 if n <= 5 else 1.70 if n <= 8 else 2.10


def f_accord_v2(w, rng, lex):
    u"""Accord, version 2 : mêmes garde-fous que la version 1 (morphologie attestée), mais la marque est OUBLIÉE 86 fois sur 100."""
    plur, genres, pos = _morpho()
    d = deacc(w)
    cat = (pos.get(d) or [u''])[0]
    if cat and cat not in ACCORDABLE:
        return None
    oubli, ajout = [], []
    if d in plur:
        for m in (u'x', u's'):
            if w.endswith(m) and len(w) - 1 >= 3:
                oubli.append(w[:-1])
    if w.endswith(u'e') and len(w) > 3 and w[:-1] in lex and cat in ('NOM', 'ADJ'):
        oubli.append(w[:-1])
    if w.endswith(u'es') and len(w) > 4 and w[:-2] in lex and cat in ('NOM', 'ADJ'):
        oubli.append(w[:-2])
    if d + u's' in plur:
        ajout.append(w + u's')
    if not w.endswith(u'e') and genres.get(d) and (w + u'e') in lex and cat in ('NOM', 'ADJ'):
        ajout.append(w + u'e')
    # Le sens est tiré D'ABORD ; si ce mot ne le permet pas, la brique s'abstient et genere() essaie un autre mot. Sans cela le sens
    # suivait les mots du texte (surtout des singuliers) et la marque était ajoutée 63 fois sur 100.
    cands = oubli if rng.random() < P_ACCORD_OUBLI else ajout
    return _prefere_reel(cands, lex, rng) if cands else None


def f_lettre_change_v2(w, rng, lex, reel=None):
    u"""Une lettre pour une autre, version 2 : le son d'abord (c/s, s/z, g/j, c/k/q viennent d'eux-mêmes), puis les confusions
    RÉELLES en priorité (a/e, c/s, m/n, finales s/t/x), presque jamais la première lettre."""
    n = len(w)
    if n < 3:
        return None
    cands = []
    for i, c in enumerate(w):
        if c not in _ALPHABET:
            continue
        connu = dict(CONF_V2.get(c, ()))
        if i == n - 1:
            connu.update(dict(CONF_FIN_V2.get(c, ())))
        pos = _poids_position(i, n, TIERS_CHANGE)
        for autre, poids in connu.items():                   # les confusions OBSERVÉES seulement : l'alphabet entier donnait « maisoh »
            cands.append((w[:i] + autre + w[i + 1:], poids * pos))
    return _tire_par_son(w, cands, rng, _SON[u'change'], lex, reel)


def f_inversion_v2(w, rng, lex):
    u"""Inversion de deux lettres voisines, version 2 : jamais la première lettre. Rare : 0,9 % des fautes réelles."""
    if len(w) < 5:
        return None
    i = rng.randrange(1, len(w) - 1)
    return w[:i] + w[i + 1] + w[i] + w[i + 2:] if w[i] != w[i + 1] else None


# ⭐ VERSION 2.1 (25/11/2026, liste n° 671, suite voulue par Rem). Trois mesures de plus sur les 1 929 mots
# fautifs des productions dys lourdes, avec leur effet ici :
#   · LES HOMOPHONES : dans 28 % des fautes, le mot écrit est un VRAI mot de même son que le mot attendu. La plupart sont des
#     pluriels sans leur « s » (déjà dans l'accord). Restent les petits mots de grammaire, que rien ne fabriquait : est / et,
#     ce / se, ont / on, où / ou, sont / son, ses / ces, tout / tous, aux / au, ils / il — environ 7 % des fautes. Une brique
#     à part, `f_homophone_v2`, sur une liste fermée ; les poids sont les comptes relevés.
#   · L'ACCORD OUBLIÉ suit un déterminant pluriel dans 36 % des cas (juste avant : 28 %, deux mots avant : 8 %). La brique ne
#     voit qu'un mot : c'est genere() qui choisit de préférence un mot placé là (`_apres_pluriel`).
#   · LES FAUTES MULTIPLES (« autre ») : 2 lettres à changer dans 45 % des cas, 3 dans 29 %, 4 ou plus dans 26 % ; le son est
#     le même dans 20 % des cas, à un son près dans 38 %, plus loin dans 42 %. La version 2 composait toujours deux
#     opérations sans regarder le son du résultat.
HOMOPHONES_V2 = {u'est': [(u'et', 18)], u'et': [(u'est', 11)], u'ce': [(u'se', 14)], u'se': [(u'ce', 7)], u'ont': [(u'on', 12)],
                 u'on': [(u'ont', 4)], u'sont': [(u'son', 8)], u'son': [(u'sont', 6)],
                 u'ses': [(u'ces', 4)], u'ces': [(u'ses', 3)], u'tout': [(u'tous', 5)], u'tous': [(u'tout', 3)], u'aux': [(u'au', 5)],
                 u'ils': [(u'il', 8)], u'sais': [(u'sait', 3)], u'sait': [(u'sais', 2)], u'veut': [(u'veux', 3)], u'peut': [(u'peux', 2), (u'peu', 2)],
                 u'es': [(u'est', 3)], u'sa': [(u'ça', 3)], u'ça': [(u'sa', 5)],
                 u'mais': [(u'mes', 2)], u'mes': [(u'mais', 2)], u'dans': [(u'dan', 7)], u'très': [(u'tré', 13)]}
DET_PLURIEL_V2 = set(u"les des ces mes tes ses nos vos leurs aux quelques plusieurs certains certaines deux trois quatre cinq six sept "
                     u"huit neuf dix tous toutes".split())
P_APRES_PLURIEL = 1.0              # mesuré : sans rien forcer, 38 % des accords oubliés suivent déjà un déterminant pluriel (réel : 36 %)
AUTRE_NB_V2 = ((2, 45), (3, 29), (4, 14), (5, 12))      # nombre d'opérations d'une faute multiple
AUTRE_SON_V2 = (20, 38, 42)        # son du résultat : même / un son d'écart / plus


# ⭐ CE QUE LE CORRECTEUR A MONTRÉ, classe par classe (part des mots fautifs laissés sans marque, réel / première version 2.1) :
# accent seul 5 % / 24 %, terminaison verbale 19 % / 40 %, lettre manquante 19 % / 38 %. Trois briques tiraient donc des fautes
# que personne ne fait. La forme RÉELLE, relevée sur les mêmes textes :
#   · ACCENT : l'accent est OUBLIÉ 78 fois sur 100 (mauvais accent 14, accent en trop 7), et le résultat n'est un vrai mot que
#     19 fois sur 100. Lettre attendue → lettre écrite : à→a 105, é→e 47, è→é 30, è→e 22, e→é 18, ù→u 10, ê→é 9, ê→e 8, û→u 5,
#     ô→o 5, ç→c 5, â→a 4. La version 1 préférait le vrai mot quand il existait (« dès » pour « des ») : muet pour un correcteur.
#   · TERMINAISON DE VERBE : -é→-er 51, -er→-é 24, -ut→-u 18, -és→-er 13, -ée→-er 10, -is→-ie 9, -ez→-er 8, -it→-i 8, -ait→-é 6,
#     -ait→-ais 6, -ées→-és 5, -ut→-us 5, -is→-it 5, -er→-ez 4, -ais→-é 4 (copies scolaires : -aient→-ait 16, -er→-é 14, -é→-er 9,
#     -is→-it 8). La version 1 tirait la finale au hasard dans la série.
#   · LETTRE MANQUANTE, CHANGÉE, EN TROP : le vrai mot obtenu dans le réel est presque toujours un petit mot de grammaire
#     (« et » pour « est ») ; ils ont leur brique. Ces trois-là ne visent donc plus qu'un peu de vrais mots.
ACCENT_V2 = {u'à': [(u'a', 105)], u'é': [(u'e', 47)], u'è': [(u'é', 30), (u'e', 22)], u'e': [(u'é', 18)], u'ù': [(u'u', 10)],
             u'ê': [(u'é', 9), (u'e', 8)], u'û': [(u'u', 5)], u'ô': [(u'o', 5)], u'ç': [(u'c', 5)], u'â': [(u'a', 4)], u'î': [(u'i', 1)]}
TERMINAISON_V2 = {
    u'dys_lourd': [(u'é', u'er', 51), (u'er', u'é', 24), (u'ut', u'u', 18), (u'és', u'er', 13), (u'ée', u'er', 10), (u'is', u'ie', 9),
                   (u'ez', u'er', 8), (u'it', u'i', 8), (u'ait', u'é', 6), (u'ait', u'ais', 6), (u'ées', u'és', 5), (u'ut', u'us', 5),
                   (u'is', u'it', 5), (u'er', u'ez', 4), (u'ais', u'é', 4), (u'er', u'ée', 3), (u'é', u'ait', 3), (u'ait', u'er', 3),
                   (u'aient', u'er', 3), (u'us', u'ut', 3)],
    u'scolaire': [(u'aient', u'ait', 16), (u'er', u'é', 14), (u'é', u'er', 9), (u'is', u'it', 8), (u'ées', u'és', 5), (u'ait', u'er', 5),
                  (u'it', u'is', 5), (u'ut', u'us', 4), (u'us', u'ut', 4), (u'u', u'ut', 4), (u'ait', u'ai', 3), (u'it', u'i', 3)],
}
_TERM = TERMINAISON_V2[u'dys_lourd']       # posé par genere() selon le profil


def _accent_cands(w):
    u"""Toutes les fautes d'accent possibles sur le mot, avec leur poids (comptes relevés). Le « e » nu ne prend un accent
    qu'à l'intérieur du mot ou en finale (« arrive » → « arrivé » est une autre faute : terminaison)."""
    cands = []
    for i, c in enumerate(w):
        if c == u'e' and (i == 0 or i == len(w) - 1):
            continue
        for autre, poids in ACCENT_V2.get(c, ()):
            cands.append((w[:i] + autre + w[i + 1:], poids))
    return cands


def f_accent_v2(w, rng, lex):
    u"""Accent seul, version 2.1 : l'accent oublié d'abord, dans la proportion relevée ; aucune préférence pour le vrai mot."""
    return _pondere(rng, _accent_cands(w))


def _poids_accent(w):
    return float(sum(q for _, q in _accent_cands(w.lower())))


def _terminaison_cands(w):
    plur, genres, pos = _morpho()
    if u'VER' not in (pos.get(deacc(w)) or [u'VER']):
        return []
    cands = []
    for attendue, ecrite, poids in _TERM:
        if w.endswith(attendue) and len(w) - len(attendue) >= 2 and not any(w.endswith(plus) and len(plus) > len(attendue) for plus, _, _ in _TERM):
            cands.append((w[:-len(attendue)] + ecrite, poids))
    return cands


def f_terminaison_v2(w, rng, lex):
    u"""Terminaison de verbe, version 2.1 : la finale écrite suit les confusions relevées (-é / -er d'abord), sur un verbe."""
    return _pondere(rng, _terminaison_cands(w))


def _poids_terminaison(w):
    return float(sum(q for _, q in _terminaison_cands(w.lower())))


_POIDS_MOT_V2 = {u'f_accent_v2': _poids_accent, u'f_terminaison_v2': _poids_terminaison}


def f_homophone_v2(w, rng, lex):
    u"""Un petit mot de grammaire pour un autre de même son (« et » pour « est ») : liste fermée, poids = comptes relevés."""
    return _pondere(rng, list(HOMOPHONES_V2.get(w, ())))


def _apres_pluriel(morceaux, i):
    u"""Le mot en i suit-il un déterminant pluriel (juste avant, ou deux mots avant) ?"""
    vus = 0
    for k in range(i - 1, -1, -1):
        if morceaux[k] and morceaux[k].isalpha():
            if morceaux[k].lower() in DET_PLURIEL_V2:
                return True
            vus += 1
            if vus >= 2:
                break
    return False


def f_autre_v2(w, rng, lex):
    u"""Fautes multiples sur le même mot, version 2.1 : de deux à cinq opérations (proportion mesurée), plusieurs essais, et le SON du
    résultat tiré comme dans le réel (même son 20 %, un son d'écart 38 %, plus 42 %)."""
    if len(w) < 4:
        return None
    essais = []
    for _ in range(30):
        nb = _pondere(rng, list(AUTRE_NB_V2))
        f, faites = w, 0
        for k in range(nb + 2):
            if faites >= nb:
                break
            op = rng.choice([f_lettre_manque_v2, f_lettre_change_v2, f_lettre_trop_v2, f_accent_v2, f_terminaison_v2, f_accord_v2])
            g = op(f, rng, lex)
            if g and g != f and g != w and len(g) >= 2:
                f, faites = g, faites + 1
        if faites >= 2 and f != w:
            essais.append((f, 1.0))
    return _tire_par_son(w, essais, rng, AUTRE_SON_V2) if essais else None


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


# Les profils. « asei » est la version 1, inchangée. Les deux autres sont la version 2.
# CIBLE_V2 = les parts MESURÉES (72 productions dys lourdes : 2 170 fautes pour 7 085 mots ; copies scolaires EcriScol : 574 fautes
# pour 4 258 mots), avec la grille `_typologie(..., colle=True)`.
# Les poids des profils sont des poids de TIRAGE, et ils diffèrent des parts visées exprès : une brique échoue sur certains mots, et la
# grille range une partie de ses fautes dans une autre classe (deux fautes composées redeviennent une seule, l'apostrophe collée devient
# un mot oublié…). Ils sont réglés pour que la répartition GÉNÉRÉE retombe sur la répartition mesurée : écart absolu cumulé de 4 à 7
# points pour « dys_lourd » (34 à 37 pour la version 1 sur les mêmes textes), de 9 points environ pour « scolaire » (59 pour la version 1).
# ⚠️ OÙ EN EST LA VERSION 2.1, mesuré par `--valide2` (72 productions dys lourdes ; réel / version 2.1 / version 1) :
#   · répartition des classes, écart cumulé    —    / entre 7 et 10 points / 34 points
#   · accord : marque oubliée                 86 % / 84 % / 34 %
#   · homophone (vrai mot de même son)        28 % / 23 % / 20 %
#   · même son que le mot attendu             40 % / 30 % / 25 %
#   · le mot fautif est un vrai mot           49 % / 41 % / 42 %
#   · fautes multiples : son proche           59 % / 41 % / 27 %
#   · LE JUGE (le correcteur, `dys_corpus_probe.js`) traite 78 % des fautes réelles, 72 à 73 % des fautes de la version 2.1
#     (66 à 68 % pour la version 2, 62 à 63 % pour la version 1). Sur les copies scolaires : 61 % du réel, 68 % du généré —
#     là le généré est un peu plus FACILE que le réel.
#   La version 2.1 est la plus proche du réel sur presque chaque mesure ; elle ne l'a pas rejoint : il lui manque du son
#   gardé et des fautes multiples plus proches du mot. Ne pas lire un chiffre obtenu sur du généré comme un chiffre sur du réel.
CIBLE_V2 = {
    u'dys_lourd': {u'autre': 20.9, u'accord : marque finale (e/s/x)': 19.1, u'lettre manquante': 12.4, u'accent seul': 12.3,
                   u'terminaison verbale': 9.8, u'1 lettre changée': 8.1, u'mot oublié': 6.0, u'lettre en trop': 4.5,
                   u'élision / apostrophe': 3.6, u'mot en trop': 1.5, u'inversion': 0.9, u'apostrophe collée': 0.9,
                   u'segmentation (scission)': 0.1},
    u'scolaire': {u'accord : marque finale (e/s/x)': 30.3, u'accent seul': 22.8, u'terminaison verbale': 17.9, u'lettre manquante': 8.2,
                  u'lettre en trop': 7.8, u'autre': 5.9, u'1 lettre changée': 4.9, u'mot en trop': 0.7, u'mot oublié': 0.5,
                  u'inversion': 0.5, u'apostrophe collée': 0.2, u'élision / apostrophe': 0.2},
}
TAUX_V2 = {u'dys_lourd': 30.6, u'scolaire': 13.5}          # % de mots fautifs mesurés
PROFILS = {
    u'asei': {u'briques': BRIQUES, u'oublie': MOT_OUBLIE, u'trop': MOT_TROP, u'segmentation': SEGMENTATION, u'apostrophe': 0.0, u'taux': TAUX},
    u'dys_lourd': {u'briques': [(29.6, f_autre_v2), (21.2, f_accord_v2), (7.9, f_lettre_manque_v2), (11.9, f_accent_v2), (9.5, f_terminaison_v2),
                               (3.4, f_lettre_change_v2), (0.5, f_lettre_trop_v2), (0.4, f_inversion_v2), (5.5, f_homophone_v2)],
                   u'oublie': 4.8, u'trop': 1.5, u'segmentation': 0.1, u'apostrophe': 4.3, u'taux': 0.327},
    u'scolaire': {u'briques': [(38.0, f_accord_v2), (19.0, f_accent_v2), (27.0, f_terminaison_v2), (6.5, f_lettre_manque_v2), (4.0, f_lettre_trop_v2),
                              (9.7, f_autre_v2), (3.0, f_lettre_change_v2), (0.5, f_inversion_v2), (2.0, f_homophone_v2)],
                  u'oublie': 0.6, u'trop': 0.9, u'segmentation': 0.0, u'apostrophe': 0.6, u'taux': 0.147},
}


def genere(texte, rng, lex, taux=None, profil=None):
    u"""Renvoie (texte fautif, nombre de fautes posées). `profil` : None ou « asei » = version 1 (inchangée) ;
    « dys_lourd » ou « scolaire » = version 2 (liste n° 670)."""
    prof = PROFILS[profil or u'asei']
    global _SON
    _SON = SON_V2.get(profil or u'asei', SON_V2[u'dys_lourd'])
    global _TERM
    _TERM = TERMINAISON_V2.get(profil or u'asei', TERMINAISON_V2[u'dys_lourd'])
    if taux is None:
        taux = prof[u'taux']
    briques, p_oublie, p_trop, p_seg, p_apo = prof[u'briques'], prof[u'oublie'], prof[u'trop'], prof[u'segmentation'], prof[u'apostrophe']
    morceaux = re.split(u'(\\W+)', APO.sub(u"'", texte))
    idx = [i for i, m in enumerate(morceaux) if i % 2 == 0 and m.isalpha() and (len(m) >= 2 or (profil not in (None, u'asei') and m.lower() in (u'à', u'a')))]
    if not idx:
        return texte, 0
    cible = max(1, int(round(taux * len(idx))))
    rng.shuffle(idx)
    tot = sum(p for p, _ in briques) + p_oublie + p_trop + p_seg + p_apo
    pose = 0
    suppr, dup, fus, apo = [], [], [], []
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
        if r < p_oublie:
            cand = [i for i in libres if morceaux[i].lower() in OUTILS]
            if cand:
                i = rng.choice(cand); suppr.append(i); libres.remove(i); pose += 1
            continue
        r -= p_oublie
        if r < p_trop:
            i = rng.choice(libres); dup.append(i); libres.remove(i); pose += 1
            continue
        r -= p_trop
        if r < p_seg:
            cand = [i for i in libres if i + 2 < len(morceaux) and morceaux[i + 1] == u' '
                    and (i + 2) in libres]
            if cand:
                i = rng.choice(cand); fus.append(i); libres.remove(i); libres.remove(i + 2); pose += 1
            continue
        r -= p_seg
        if r < p_apo:                                         # version 2 : l'apostrophe oubliée (« j'ai » → « jai »)
            cand = [i for i in range(0, len(morceaux) - 2, 2) if morceaux[i + 1] == u"'" and morceaux[i].isalpha() and (i + 2) in libres]
            if cand:
                i = rng.choice(cand); apo.append((i, _pondere(rng, list(APO_V2)))); libres.remove(i + 2); pose += 1
                if i in libres: libres.remove(i)
            continue
        r -= p_apo
        # --- opérations qui touchent les LETTRES ---
        for p, fn in briques:
            if r < p:
                if profil in (None, u'asei'):
                    essai = rng.sample(libres, min(len(libres), 12))
                else:                                         # version 2 : les mots longs d'abord, dans la proportion mesurée
                    if fn is f_homophone_v2:                  # version 2.1 : le MOT de la liste d'abord (par son compte), puis une occurrence
                        presents = {}
                        for i in libres:
                            if morceaux[i].lower() in HOMOPHONES_V2:
                                presents.setdefault(morceaux[i].lower(), []).append(i)
                        mot = _pondere(rng, [(m, sum(q for _, q in HOMOPHONES_V2[m])) for m in sorted(presents)])
                        essai = [rng.choice(presents[mot])] if mot else []
                    elif fn is f_accord_v2:                   # version 2.1 : de préférence après un déterminant pluriel
                        essai = sorted(libres, key=lambda i: -(rng.random() ** (1.0 / (_poids_longueur(morceaux[i])
                                       * (P_APRES_PLURIEL if _apres_pluriel(morceaux, i) else 1.0)))))[:12]
                    elif fn.__name__ in _POIDS_MOT_V2:        # version 2.1 : le mot est tiré selon ce que la brique peut y faire (« à » d'abord pour l'accent)
                        pm = _POIDS_MOT_V2[fn.__name__]
                        pesés = [(i, pm(morceaux[i])) for i in libres]
                        essai = sorted([i for i, q in pesés if q > 0], key=lambda i: -(rng.random() ** (1.0 / pm(morceaux[i]))))[:12]
                    else:
                        essai = sorted(libres, key=lambda i: -(rng.random() ** (1.0 / _poids_longueur(morceaux[i]))))[:12]
                classe_v2 = _CLASSE_V2.get(fn.__name__)
                veut = (rng.random() < REEL_V2[classe_v2]) if classe_v2 else None
                if veut is not None:                          # on cherche plus loin : tous les mots ne permettent pas un vrai mot voisin
                    essai = sorted(libres, key=lambda i: -(rng.random() ** (1.0 / _poids_longueur(morceaux[i]))))[:40]
                for i in essai:
                    w = morceaux[i]
                    out = fn(w.lower(), rng, lex, reel=veut) if veut is not None else fn(w.lower(), rng, lex)
                    if out and out != w.lower():
                        morceaux[i] = (out[0].upper() + out[1:]) if w[0].isupper() else out
                        libres.remove(i); pose += 1
                        break
                break
            r -= p
    for i, forme in sorted(apo, reverse=True):
        entier = APO_ENTIER.get(morceaux[i].lower())
        if forme == u'entier' and entier:                    # « que il », « le ami » : la forme pleine, pas d'élision
            e = rng.choice(entier)
            morceaux[i] = (e[0].upper() + e[1:]) if morceaux[i][0].isupper() else e
            morceaux[i + 1] = u' '
        elif forme == u'colle':                               # « jai »
            morceaux[i + 1] = u''
        else:                                                 # « j ai »
            morceaux[i + 1] = u' '
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

def _typologie(paires, colle=False):
    u"""Reclasse des paires (fautif, correct) avec la MÊME grille que sur le réel.
    `colle=True` (version 2) compte à part « l'apostrophe collée » (« jai » pour « j'ai ») : sans cela l'alignement en fait
    un mot oublié plus une lettre en trop, sur le réel comme sur le généré."""
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
            if colle and k + 1 < len(ops):
                (o1, x1, y1), (o2, x2, y2) = ops[k], ops[k + 1]
                if (o1 == 'ins' and o2 == 'sub' and y1.endswith(u"'") and x2.lower() == (y1[:-1] + y2).lower()) or \
                   (o1 == 'sub' and o2 == 'ins' and y1.endswith(u"'") and x1.lower() == (y1[:-1] + y2).lower()):
                    cnt[u'apostrophe collée'] += 1; n += 1; k += 2; continue
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


def _mesures_v2(paires, lex):
    u"""Les mesures de la version 2 sur des paires (texte fautif, texte corrigé) : la répartition des classes, le taux de mots
    fautifs, et quatre traits mot à mot (première lettre gardée, faute dans le dernier tiers, même son, vrai mot), plus le sens de l'accord."""
    from dys_reel_probe import toks, align, classe, apostrophe
    cnt, n = _typologie(paires, colle=True)
    mots = sum(len(toks(g)) for _, g in paires)
    t = {u'n4': 0, u'prem': 0, u'fin': 0, u'n': 0, u'son': 0, u'reel': 0, u'acc': 0, u'oubli': 0, u'homo': 0, u'plur': 0, u'aut': 0, u'aut2': 0}
    for bad, good in paires:
        ops = align(toks(bad), toks(good))
        attendus = [y for op, x, y in ops if op != 'del']
        rang = -1
        for op, x, y in ops:
            if op != 'del':
                rang += 1
            if op != 'sub' or not x or not y or apostrophe(x, y):
                continue
            xl, yl = x.lower().rstrip(u"'"), y.lower().rstrip(u"'")
            a, b = deacc(xl), deacc(yl)
            if a == b and xl == yl:
                continue
            t[u'n'] += 1
            t[u'reel'] += 1 if xl in lex else 0
            meme = _ecart_son(yl, xl) == 0
            if len(yl) >= 3:
                t[u'son'] += 1 if meme else 0
            t[u'homo'] += 1 if (meme and xl in lex and yl in lex) else 0
            cl = classe(x, y) or u'autre'
            if cl.startswith(u'accord'):
                t[u'acc'] += 1
                if len(a) < len(b):
                    t[u'oubli'] += 1
                    avant = [m.lower().rstrip(u"'") for m in attendus[max(0, rang - 2):rang]]
                    t[u'plur'] += 1 if any(m in DET_PLURIEL_V2 for m in avant) else 0
            if cl == u'autre':
                t[u'aut'] += 1
                t[u'aut2'] += 1 if _ecart_son(yl, xl) <= 1 else 0
            if len(b) >= 4 and a != b:
                t[u'n4'] += 1
                t[u'prem'] += 1 if a[:1] == b[:1] else 0
                k = next((i for i in range(min(len(a), len(b))) if a[i] != b[i]), min(len(a), len(b)))
                t[u'fin'] += 1 if k >= 2 * len(b) / 3.0 else 0
    pc = lambda a, b: 100.0 * a / max(1, b)
    return {u'classes': dict((c, pc(v, n)) for c, v in cnt.items()), u'taux': pc(n, mots), u'première lettre gardée': pc(t[u'prem'], t[u'n4']),
            u'faute dans le dernier tiers du mot': pc(t[u'fin'], t[u'n4']), u'même son que le mot attendu': pc(t[u'son'], t[u'n']),
            u'le mot fautif est un vrai mot': pc(t[u'reel'], t[u'n']), u'accord : marque oubliée': pc(t[u'oubli'], t[u'acc']),
            u'homophone (vrai mot de même son)': pc(t[u'homo'], t[u'n']),
            u'accord oublié après un dét. pluriel': pc(t[u'plur'], t[u'oubli']),
            u'fautes multiples : son proche': pc(t[u'aut2'], t[u'aut'])}


def valide_v2(profil, source, lex, graine=GRAINE):
    u"""Version 2 contre le RÉEL, sur les MÊMES textes corrigés. `source` : un fichier .jsonl de paires {raw, fixed} (corpus privé,
    data_local/dys_reel). Écrit data_local/dys_reel/genere_<profil>.jsonl pour le juge indépendant : le correcteur."""
    T = [json.loads(l) for l in io.open(source, encoding='utf-8') if l.strip()]
    T = [j for j in T if j.get('fixed')]
    reel = _mesures_v2([(j['raw'], j['fixed']) for j in T], lex)
    rng = random.Random(graine)
    gen2 = [(genere(j['fixed'], rng, lex, profil=profil)[0], j['fixed']) for j in T]
    rng = random.Random(graine)
    gen1 = [(genere(j['fixed'], rng, lex)[0], j['fixed']) for j in T]
    v2, v1 = _mesures_v2(gen2, lex), _mesures_v2(gen1, lex)
    print(u'GÉNÉRATEUR, VERSION 2 — profil « %s », %d textes, graine %d\n' % (profil, len(T), graine))
    print(u'  %-36s   réel     v2     v1' % u'part des fautes (%)')
    e2 = e1 = 0.0
    for c in sorted(set(reel[u'classes']) | set(v2[u'classes']) | set(v1[u'classes']), key=lambda c: -reel[u'classes'].get(c, 0)):
        r, a, b = reel[u'classes'].get(c, 0), v2[u'classes'].get(c, 0), v1[u'classes'].get(c, 0)
        e2 += abs(a - r); e1 += abs(b - r)
        print(u'  %-36s  %5.1f  %5.1f  %5.1f' % (c, r, a, b))
    print(u'  %-36s         %5.1f  %5.1f' % (u'écart absolu cumulé avec le réel', e2, e1))
    print(u'  %-36s  %5.1f  %5.1f  %5.1f' % (u'mots fautifs (% des mots)', reel[u'taux'], v2[u'taux'], v1[u'taux']))
    for k in (u'première lettre gardée', u'faute dans le dernier tiers du mot', u'même son que le mot attendu', u'le mot fautif est un vrai mot',
              u'homophone (vrai mot de même son)', u'accord : marque oubliée', u'accord oublié après un dét. pluriel', u'fautes multiples : son proche'):
        print(u'  %-36s  %5.1f  %5.1f  %5.1f' % (k + u' (%)', reel[k], v2[k], v1[k]))
    dst = os.path.join(ROOT, 'data_local', 'dys_reel', 'genere_%s.jsonl' % profil)
    with io.open(dst, 'w', encoding='utf-8', newline=u'\n') as fh:
        for bad, good in gen2:
            fh.write(json.dumps({'src': 'genere_' + profil, 'raw': bad, 'fixed': good}, ensure_ascii=False) + u'\n')
    print(u'\n  LE JUGE INDÉPENDANT reste le correcteur — comparer sa part de fautes traitées sur le réel et sur le généré :')
    print(u'    node dictee/dys_corpus_probe.js %s' % os.path.relpath(source, ROOT).replace(os.sep, '/'))
    print(u'    node dictee/dys_corpus_probe.js %s' % os.path.relpath(dst, ROOT).replace(os.sep, '/'))


if __name__ == '__main__':
    _opt = {}
    for _nom in ('--profil', '--source'):
        if _nom in sys.argv:
            _k = sys.argv.index(_nom); _opt[_nom] = sys.argv[_k + 1]; del sys.argv[_k:_k + 2]
    PROFIL_CLI = _opt.get('--profil')
    if PROFIL_CLI is not None and PROFIL_CLI not in PROFILS:
        sys.exit(u'profil inconnu : %s (connus : %s)' % (PROFIL_CLI, u', '.join(sorted(PROFILS))))
    if len(sys.argv) > 1 and sys.argv[1] == '--valide2':
        if not _opt.get('--source'):
            sys.exit(u'usage : python dictee/dys_gen.py --valide2 --profil dys_lourd --source data_local/dys_reel/<paires>.jsonl')
        valide_v2(PROFIL_CLI or u'dys_lourd', _opt['--source'], charge_lex())
        sys.exit(0)
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
            faux, n = genere(gold, rng, lex, profil=PROFIL_CLI)
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
                faux, _ = genere(g, rng, lex, profil=PROFIL_CLI)
                fh.write(json.dumps({'src': 'genere' if not PROFIL_CLI else 'genere_' + PROFIL_CLI, 'raw': faux, 'fixed': g}, ensure_ascii=False) + u'\n')
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
