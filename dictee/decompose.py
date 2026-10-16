# -*- coding: utf-8 -*-
# OMEGA — DÉCOMPOSEUR DE MOTS « à la Lexique 4 », double voie (SON et ORTHO), qui APPREND.
# ─────────────────────────────────────────────────────────────────────────────────────────
# « lit et apprend des mots, les décompose comme dans Lexique 4 » (cf. demande + CLAUDE.md).
# Réutilise (doctrine §A2/A4 — la preuve de réutilisation est dans les imports/appels) :
#   · g2p_tables.json     ← tables AQUA-PHOTON v3 de l'app (route SUBLEXICALE g→p, hésitation latente §3)
#   · phono_homophones.json (43 580 groupes, clé = phono SAMPA Lexique) → route LEXICALE du SON + nbhomoph
#   · cgram_gender/verbs/adj.json (dérivés Lexique 4) → route LEXICALE de cgram/genre
#   · diag_sentence.deacc / toks / norm → tokenisation + normaliseur de surface
#
# DOUBLE VOIE (GRAMMAIRE_DOUBLE_VOIE.md) appliquée à la *décomposition* :
#   SON   = phono lexicale (Lexique SAMPA, exacte) × phono sublexicale (g2p, pour l'OOV)
#   ORTHO = découpage en graphèmes + syllabes orthographiques (route sublexicale, alignée aux noyaux)
#
# APPREND (boucle descendante, descending_probe.py — data-bound, FP=0) :
#   lexique appris incrémental learned_lex.json ; une source LEXICALE sûre n'est JAMAIS écrasée
#   par une supposition sublexicale ; l'usage répété renforce la confiance ; on lit aussi des TEXTES.
#
# Mesure (doctrine §1) : route sublexicale confrontée à la vérité-terrain Lexique (in-lexique),
#   in-lexique vs OOV tenus SÉPARÉS. Lancer :
#     python3 dictee/decompose.py "chevaux"            # décompose un mot (son ET ortho)
#     python3 dictee/decompose.py --read "<texte>"     # lit un texte et APPREND chaque mot
#     python3 dictee/decompose.py --read-file f.txt    # idem depuis un fichier
#     python3 dictee/decompose.py --lex                # état du lexique appris
#     python3 dictee/decompose.py --measure            # harnais falsifiable (in-lexique vs OOV)
#     python3 dictee/decompose.py --demo               # démonstration
import os, sys, re, json, random, unicodedata, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import conj_io                                        # ⭐ 13/10/2026 : table de conjugaison compacte (hors du try : un import raté doit se voir)
from diag_sentence import deacc, toks, norm            # réutilisation (§A2) : pas de réécriture

KEEP = re.compile(r"[^a-zàâäéèêëîïôöùûüÿçœ]")            # même filtre de lettres que g2p() de l'app
TABLES_PATH = os.path.join(HERE, 'g2p_tables.json')
LEX_LEARNED = os.path.join(HERE, 'learned_lex.json')

# ── tables sublexicales (extraites de l'app par build_g2p_tables.py) ──
if not os.path.exists(TABLES_PATH):
    sys.exit("[decompose] g2p_tables.json absent. Lance d'abord : python3 dictee/build_g2p_tables.py")
_T = json.load(open(TABLES_PATH, encoding='utf-8'))
VOW, NASAL, DBL = _T['VOW'], set(_T['NASAL']), set(_T['DBL'])
COND, ENTSIL = _T['COND'], set(_T['ENTSIL'])
RFIN = set(_T.get('RFIN') or [])                     # -er au r prononcé (extrait de l'app)
EPRON = set(_T.get('EPRON') or [])                   # e+s final prononcé (extrait de l'app)
ENTAMBIG = set(_T.get('ENTAMBIG') or [])             # -ent homographes (nom/adj ET 3e p. pluriel)
CFIN_MUET = set(_T.get('CFIN_MUET') or [])           # « c » final muet (liste fermée)
GFIN_MUET = set(_T.get('GFIN_MUET') or [])           # « g » final muet (liste fermée)
ILL_L = set(_T.get('ILL_L') or [])                   # ⭐ liste n° 39 : « ill » après consonne → /il/ (liste fermée)
ERS_R = set(_T.get('ERS_R') or [])                   # « -ers » final au r prononcé hors RFIN
GZ_PRE = set(_T.get('GZ_PRE') or [])                 # x + voyelle → /gz/ derrière ces préfixes
Z6 = set(_T.get('Z6') or [])                         # x → /z/ (deuxième, sixième, dixième)
IENT_V = set(_T.get('IENT_V') or [])                 # -ient /jɛ̃/ : 3e pers. sing. de venir/tenir (+ bientôt)
try:                                                  # formes conjuguées DÉJÀ embarquées (vdc-lex.cj.f)
    import json as _j, io as _io, os as _os
    _vp = _os.path.join(HERE, '..', 'extension', 'assets', 'vdc-lex.json')
    _cjv = _j.load(_io.open(_vp, encoding='utf-8'))['cj'] if _os.path.exists(_vp) else {}
    if _cjv and 'f' not in _cjv: _cjv = conj_io.reconstruire(_cjv)   # ⭐ 13/10/2026 : table COMPACTE — `f` recalculé depuis `c`
    CONJ_F, CONJ_C = _cjv.get('f') or {}, _cjv.get('c') or {}
except Exception:
    CONJ_F, CONJ_C = {}, {}
# SEG du moteur (43) ENRICHI de 8 segments mesurés net-positifs en held-out (+2.23 pts d'exactitude ;
# 'ti'→/sj/ seul vaut +1.4). Le moteur pendu garde SON SEG intact (R66) ; seul le décomposeur l'étend.
# 'ion','ue','oui'… ont été TESTÉS et ÉCARTÉS (ils dégradent) — cf. build_g2p_corrections.py / DECOMPOSE.md.
SEG_EXTRA = ['cqu', 'sh']   # ⭐ 16/10/2026 (liste n° 39) : ablation held-out APRÈS les règles de contexte du moteur — ueil −0,08, ail −0,55, sc −0,20,
                            #   oy 0, ay 0, ti −0,92 (le moteur les traite mieux par contexte) ; cqu +0,08 et sh +0,15 restent. Les 8 valaient +2,3 avant.
SEG = sorted(set(_T['SEG']) | set(SEG_EXTRA), key=lambda s: -len(s))
SEG_MOTEUR = sorted(set(_T['SEG']), key=lambda s: -len(s))   # ⭐ 16/10/2026 : les segments du MOTEUR seul (app `_DECL2`, extension/assets/g2p.js)
# ⭐ 16/10/2026 (liste n° 39) — UNITÉS d'émission du p2g : l'alignement son → graphie garde les 8 segments d'avant (ti, ail, ay, oy,
#   sc, sh, ueil, cqu) comme unités ; retirés du g2p mesuré (ci-dessus), ils restent des unités utiles pour émettre « tion », « aill », « ay ».
#   Mesuré : sans eux, top-5 p2g 3 134 → 3 119 sur 4 000 mots held-out (perdus : tion, aill, ay, eill).
SEG_UNITS = sorted(set(_T['SEG']) | {'ueil', 'cqu', 'ail', 'sc', 'sh', 'oy', 'ay', 'ti'}, key=lambda s: -len(s))

# ── overlay ACCENTS (extension assumée : le g2p de l'app, pensé pour le pendu ASCII, rend '?'
#    sur é/è/ç… ; on ajoute les valeurs non ambiguës. Effet MESURÉ en ablation, cf. --measure). ──
ACC = {'é': ('e', 0.05), 'è': ('ɛ', 0.05), 'ê': ('ɛ', 0.05), 'ë': ('ɛ', 0.10),
       'à': ('a', 0.02), 'â': ('a', 0.05), 'ä': ('a', 0.10), 'ô': ('o', 0.05), 'ö': ('o', 0.10),
       'î': ('i', 0.05), 'ï': ('i', 0.10), 'û': ('y', 0.05), 'ù': ('y', 0.05), 'ü': ('y', 0.10),
       'ÿ': ('i', 0.10), 'ç': ('s', 0.02)}

# ── route LEXICALE du son : inversion de phono_homophones (mot → phono SAMPA) + taille de groupe ──
def _load_lexical_phon():
    p = os.path.join(HERE, 'phono_homophones.json')
    if not os.path.exists(p):
        return {}, {}
    d = json.load(open(p, encoding='utf-8'))
    w2p, group = {}, {}
    for phono, words in d.items():
        group[phono] = len(words)
        for w in words:
            w2p.setdefault(w.lower(), phono)            # 1re occurrence ; clé = phono Lexique
    return w2p, group
W2P, GROUP = _load_lexical_phon()

# ── AJOUT Morphalou (build_phon_morphalou.py) : mots absents de phono_homophones (qui ne connaît
# QUE les mots ayant un homophone — de/je/le/que/ne n'en ont pas, donc en étaient absents malgré
# leur fréquence extrême). ⚠️ NE PAS mélanger dans W2P lui-même : W2P sert de VÉRITÉ-TERRAIN à
# --measure/inlex_split/word_units (phono Lexique EXACT par construction) — y verser du Morphalou
# (82,4 % exact, mesuré) pollue la mesure du g2p (bug trouvé 2026-08-24 : exact chute de 52,4 % à
# 39,2 % dans --measure quand W2P contenait le mélange). PHON_MORPHALOU reste un dict À PART,
# consulté SEULEMENT en repli par decompose() — jamais par la mesure ni l'alignement p2g.
def _load_morphalou_phon():
    p = os.path.join(HERE, 'phono_morphalou.json')
    if not os.path.exists(p):
        return {}
    return json.load(open(p, encoding='utf-8'))
PHON_MORPHALOU = _load_morphalou_phon()

def _load_json(name, default):
    p = os.path.join(HERE, name)
    try:
        return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else default
    except Exception:
        return default
GENDER = _load_json('cgram_gender.json', {})            # mot(deacc) → 'm'/'f'  (noms non ambigus)
VERBS = set(_load_json('cgram_verbs.json', []))         # formes verbales (deacc)
ADJ = _load_json('cgram_adj.json', {})                  # forme(deacc) → [genre, contrepartie]
# CORRECTION APPRISE (boucle descendante, build_g2p_corrections.py) : (graphème\tnextchar) → chunk SAMPA gold.
# Apprise par alignement g2p↔phono Lexique sur le split TRAIN ; corrige les erreurs systématiques du g2p
# (o/ɔ, finales…). Mesurée en HELD-OUT (~+2 pts sur SEG enrichi). Inerte si le fichier est absent.
_CORR_RAW = _load_json('g2p_corrections.json', {})
CORR = _CORR_RAW.get('table', {}) if isinstance(_CORR_RAW, dict) else {}

# ── IPA (sortie g2p) → SAMPA Lexique : 1 caractère SAMPA = 1 phonème (donc len = nbphons) ──
IPA2SAMPA = {
    'a': 'a', 'e': 'e', 'i': 'i', 'o': 'o', 'u': 'u', 'y': 'y', 'ɑ': 'a',
    'ɔ': 'O', 'ɛ': 'E', 'ø': '2', 'œ': '9', 'ə': '°',
    'p': 'p', 'b': 'b', 't': 't', 'd': 'd', 'k': 'k', 'ɡ': 'g', 'g': 'g',
    'f': 'f', 'v': 'v', 's': 's', 'z': 'z', 'm': 'm', 'n': 'n', 'l': 'l',
    'ʁ': 'R', 'ʃ': 'S', 'ʒ': 'Z', 'ɲ': 'N', 'ŋ': 'G', 'j': 'j', 'w': 'w', 'ɥ': '8',
    'ɑ̃': '@', 'ɛ̃': '5', 'œ̃': '1', 'ɔ̃': '§',                       # voyelles nasales (base + U+0303)
}
SAMPA_VOW = set('aeiouyOE2°@519§')                      # noyaux syllabiques (semi-voyelles j/w/8 exclues)

def ipa_to_sampa(ph_ipa):
    """Convertit une chaîne IPA (issue de g2p) en SAMPA Lexique, phonème par phonème.
    Gère le tilde nasal combinant (U+0303) et le ∅ muet (→ rien)."""
    if ph_ipa == '∅':
        return ''
    out, i, s = [], 0, ph_ipa
    while i < len(s):
        tok = s[i]
        if i + 1 < len(s) and s[i + 1] == '̃':     # voyelle nasale = base + combinant
            tok = s[i] + s[i + 1]; i += 2
        else:
            i += 1
        out.append(IPA2SAMPA.get(tok, tok))
    return ''.join(out)

# ── ROUTE SUBLEXICALE : portage FIDÈLE du g2p() de l'app (briques AQUA-PHOTON v3) ──
_3P = None


def _build_3p():
    """Index des 3e personnes du pluriel depuis l arbre CONJ_C (miroir app).

    CONJ_F est une projection INCOMPLÈTE de l arbre : mesuré 69,2 % des -ent muets par CONJ_F seul,
    95,8 % en lisant aussi l arbre. Construit une fois, à la première question."""
    global _3P
    _3P = set()
    for lem, modes in (CONJ_C or {}).items():
        for mo, pers in (modes or {}).items():
            f = (pers or {}).get('3p')
            if isinstance(f, str):
                _3P.add(f)
            elif isinstance(f, list):
                _3P.update(f)
    return _3P


def _ent_verbe(w):
    """Forme de 3e personne du PLURIEL connue des tables déjà chargées (miroir app)."""
    if w in ENTAMBIG:
        return False
    e = CONJ_F.get(w)
    if e and any(x.endswith(';3;p') for x in str(e).split('|')):
        return True
    return w in (_3P if _3P is not None else _build_3p())



# ⭐ 16/10/2026 — LISTE N° 39 : règles de contexte du g2p, miroir EXACT de `_r39` de l'app (_DECL2). Ne change que le phonème.
_V39 = 'aeiouyàâäéèêëîïôöùûüœ'; _C39 = 'bdfgɡkʒlmnɲŋpʁstvzʃ'
_CL39 = re.compile(r'^(b|c|d|f|g|k|p|t|v|ch|ph|cc|tt|pp|bb|dd|ff|gg)$'); _CU39 = re.compile(r'^(c|cc|g)$'); _TA39 = re.compile(r'^(l|ll|b|t)$')
_SC39 = re.compile(r'^(b|c|d|f|g|j|k|l|m|n|p|t|v|ç|qu|ch|ph|th)$'); _OBS39 = re.compile(r'^(b|c|d|f|g|k|p|t|v|ch|ph)$'); _RQ39 = re.compile(r'^(r|rr|q|g)$')
def _r39(S, w):
    n = len(S)
    def G(k): return S[k]['g'] if 0 <= k < n else '#'
    def vowG(k): return 0 <= k < n and S[k]['g'][0] in _V39
    def consPh(k):
        if k < 0 or k >= n: return False
        p = S[k]['ph']; return bool(p) and p != '∅' and p[-1] in _C39
    def eMuet(k): return 0 <= k < n and S[k]['g'] == 'e' and (not S[k]['ph'] or S[k]['ph'] == '∅')
    def fin(k): return k >= n or (k == n - 1 and S[k]['g'] == 's')
    def cluster(k): return k >= 2 and G(k - 1) in ('l', 'r') and bool(_CL39.match(G(k - 2)))
    for k in range(n):                                   # passe A — le « e » (miroir JS)
        s = S[k]
        if s['g'] != 'e': continue
        g2 = G(k + 1); g3 = G(k + 2)
        if g2 == 'rr': s['ph'] = 'ɛ'
        elif g2 == 'r':
            if k + 2 >= n:
                if w in RFIN: s['ph'] = 'ɛ'
            elif g3 == 's' and k + 3 == n:
                if w[:-1] in RFIN or w in ERS_R: s['ph'] = 'ɛ'
                else: s['ph'] = 'e'; S[k + 1]['ph'] = '∅'
            elif vowG(k + 2): s['ph'] = '∅' if vowG(k - 1) else 'ə'
            else: s['ph'] = 'ɛ'
        elif g2 == 'nn':
            if not w.startswith('ennu'): s['ph'] = 'ɛ'
        elif g2 == 'mm': s['ph'] = 'ɑ̃' if w.startswith('emm') else ('a' if w.startswith('femm') else 'ɛ')
        elif g2 == 'ss':
            if (g3 == 'e' and fin(k + 3)) or (g3 == 'en' and G(k + 3) == 't' and k + 4 == n): s['ph'] = 'ɛ'
        elif g2 in ('ll', 'tt', 'pp', 'cc', 'dd', 'bb', 'gg'): s['ph'] = 'ɛ'
        elif g2 == 'm' and g3 == 'en' and vowG(k - 1): s['ph'] = '∅'
        elif _SC39.match(g2):
            if k + 2 >= n:
                if g2 != 'd': s['ph'] = 'ɛ'
            elif vowG(k + 2):
                if not vowG(k - 1): s['ph'] = 'ə'
            elif g2 == 'd': pass
            elif _OBS39.match(g2) and g3 in ('l', 'r'):
                if not vowG(k - 1): s['ph'] = 'ə'
            else: s['ph'] = 'ɛ'
    pos = 0
    for k in range(n):                                   # passe B
        s = S[k]; g = s['g']; g2 = G(k + 1); g3 = G(k + 2)
        if g == 't' and G(k - 1) not in ('s', 'ss') and g2 == 'ien' and (g3 == 'c' or (g3 == 't' and w not in IENT_V)):
            s['ph'] = 's'
        elif g == 't' and g2 == 'i' and G(k - 1) not in ('s', 'ss') and (g3 in ('on', 'om', 'o', 'eu') or (g3 == 'e' and G(k + 3) in ('l', 'll')) or (g3 == 'a' and bool(_TA39.match(G(k + 3))))):
            s['ph'] = 's'
        elif g == 'i' and vowG(k + 1):
            if G(k - 1) == 'gn' and not eMuet(k + 1): s['ph'] = '∅'
            elif eMuet(k + 1): s['ph'] = 'i'
            else: s['ph'] = 'ij' if cluster(k) else 'j'
        elif g == 'ill':
            if w in ILL_L or k == 0: s['ph'] = 'il'
            elif s['ph'] == 'j': s['ph'] = 'ij' if consPh(k - 1) else 'j'
            elif s['ph'] == 'il' and g2 == 'i' and not consPh(k - 1): s['ph'] = 'j'
        elif g in ('ai', 'ei') and (g2 == 'll' or (g2 == 'l' and fin(k + 2))):
            if g == 'ei' and G(k - 1) == 'gu': s['ph'] = 'œ'
            elif g == 'ei' and G(k - 1) == 'u' and bool(_CU39.match(G(k - 2))): S[k - 1]['ph'] = '∅'; s['ph'] = 'œ'
            elif g == 'ei' and G(k - 1) == 'o': S[k - 1]['ph'] = '∅'; s['ph'] = 'œ'
            else: s['ph'] = 'a' if g == 'ai' else 'ɛ'
            S[k + 1]['ph'] = 'j'
        elif g in ('eu', 'ou', 'œ') and g2 == 'i' and g3 == 'l' and fin(k + 3): S[k + 1]['ph'] = '∅'; S[k + 2]['ph'] = 'j'
        elif g == 'o' and g2 == 'eu': s['ph'] = '∅'
        elif g in ('a', 'o', 'u') and g2 == 'y':
            if g3 == 'e' or vowG(k + 2):
                S[k + 1]['ph'] = 'j'
                s['ph'] = 'wa' if g == 'o' else ('ɥi' if g == 'u' else ('e' if (g3 == 'é' or (g3 == 'e' and S[k + 2]['ph'] == 'e')) else 'ɛ'))
            elif g == 'a': s['ph'] = 'ɛ'; S[k + 1]['ph'] = 'i'
        elif g == 'ien':
            if g2 == 'c' or (g2 == 't' and w not in IENT_V): s['ph'] = 'jɑ̃'
            if cluster(k) and s['ph'][:1] == 'j': s['ph'] = 'i' + s['ph']
        elif g == 'ou' and g2 == 'e' and eMuet(k + 1): s['ph'] = 'u'
        elif g == 'ou' and g2 in ('i', 'in') and g3 not in ('l', 'll'): s['ph'] = 'w'
        elif g == 'u' and (g2 == 'é' or (g2 == 'e' and not eMuet(k + 1))) and not _RQ39.match(G(k - 1)): s['ph'] = 'ɥ'
        elif g == 's' and g2 == 'c' and g3 != '#' and g3[0] not in 'eiyéèêë': s['ph'] = 's'
        elif g == 'x' and (vowG(k + 1) or g2 == 'h'):
            s['ph'] = 'z' if w in Z6 else ('ɡz' if w[:pos] in GZ_PRE else 'ks')
        pos += len(g)
    if len(w) > 4 and w.endswith('ient') and w not in ENTAMBIG and (w in ENTSIL or _ent_verbe(w)) and n >= 2 and S[n - 2]['g'] == 'ien':
        S[n - 2]['ph'] = 'i'

def g2p(word, accents=True, seg=None):
    """graphème→phonème déterministe + hésitation `h` (latent §3). Renvoie la liste des pas
    {g: graphème, ph: phonème IPA, h: hésitation}. `accents` active l'overlay é/è/ç (sinon '?').
    `seg` permet une segmentation alternative (ablation : SEG moteur vs SEG enrichi)."""
    segs = seg if seg is not None else SEG
    w = KEEP.sub('', word.lower())
    steps, i = [], 0
    while i < len(w):
        g = None
        for cand in segs:                                # maximal munch sur les segments connus
            if not w.startswith(cand, i):
                continue
            after = w[i + len(cand)] if i + len(cand) < len(w) else '#'
            if cand in NASAL and (after in VOW or after in 'nm'):
                continue                                 # « an »+voyelle/n/m → pas une nasale (anne, animal)
            g = cand; break
        if not g:
            g = w[i]
        prev = w[i - 1] if i > 0 else '#'
        nxt = w[i + len(g)] if i + len(g) < len(w) else '#'
        ph, h = '?', 0.0
        if g in DBL:
            # BUG DBL→∅ (signalé par Rem 2026-08-21) : l'ancienne branche prenait le DÉFAUT de la
            # lettre SIMPLE — pour « ss » c'est '∅' (s final muet) → poisson→/pwa§/, assis→/ai/ ;
            # « gg » héritait de /ʒ/ (g devant e/i) ; « zz » de ∅. Le `or g[0]` ne rattrapait que
            # la chaîne vide, pas '∅'. On consulte COND[g] (l'entrée du DIGRAMME, correcte),
            # repli anti-∅ sur la lettre sinon. Miroir app (même ligne corrigée).
            t = COND.get(g)
            if t:
                e = t.get(nxt) or t.get('_')
                ph, h = e[0], e[1]
            else:
                e = (COND.get(g[0]) or {}).get('_') or [g[0], 0.0]
                ph, h = (e[0] if e[0] and e[0] != u'∅' else g[0]), 0.0
        elif g in ACC and accents:                       # overlay accents (extension assumée)
            ph, h = ACC[g]
        else:
            t = COND.get(g)
            if t:
                e = t.get(nxt) or t.get('_')
                ph, h = e[0], e[1]
        # règles de contexte bilatéral déterministes (verbatim app) :
        if g == 's' and prev in VOW and nxt in VOW:
            ph, h = 'z', 0.10                            # s intervocalique → /z/ (maison, rose)
        elif g == 'x' and prev in VOW and nxt in VOW:
            ph, h = 'ɡz', 0.15                           # x intervocalique → /gz/ (examen)
        elif g == 'r' and nxt == '#' and prev != 'e':
            # ⭐ 25/09/2026 — LE « R » FINAL N EST PAS MUET (miroir app, rapport de Rem). COND est
            # indexée sur le SUIVANT : en fin de mot elle ne voyait que « # » et tranchait MUET avec
            # h=0,85, son hésitation la plus haute. Ce « # » mélange les infinitifs en -er (muets) et
            # tout le reste (prononcé). La table APPRISE avait refusé de trancher : g2p_corrections.json
            # a une entrée « r+suivant » pour 29 lettres et AUCUNE pour « # » (sous le seuil de pureté).
            # Mesuré : 72,9 % → 97,8 % justes sur 7 263 mots, un seul « cassé » (gold fautif).
            ph, h = 'ʁ', 0.05
        steps.append({'g': g, 'ph': ph, 'h': max(0.0, h)})
        i += len(g)
    # ⭐ 25/09/2026 — le « -ent » des verbes : la table était déjà là (miroir app).
    # Le commentaire d avant disait « la POS lève l ambiguïté » : c était faux, on lisait une liste de
    # 582 mots. 7,0 % des -ent muets couverts ; avec les formes conjuguées déjà chargées : 95,8 %.
    # ⚠️ ENTAMBIG prime sur ENTSIL : la liste faite main contenait déjà « ferment » (nom, prononcé).
    if w not in ENTAMBIG and (w in ENTSIL or _ent_verbe(w)) and w.endswith('ent'):                # -ent muet (verbe) : POS lève /ɑ̃/ vs ∅
        for k in range(len(steps) - 1, -1, -1):
            if steps[k]['g'] == 'en':
                steps[k]['ph'], steps[k]['h'] = '∅', 0.02; break
    if w in RFIN:                                    # ⭐ -er au r PRONONCÉ (liste fermée, miroir app)
        for k in range(len(steps) - 1, -1, -1):
            if steps[k]['g'] == 'r':
                steps[k]['ph'], steps[k]['h'] = 'ʁ', 0.05; break
    if w in CFIN_MUET or w in GFIN_MUET:              # ⭐ c/g final MUET (listes fermées, miroir app)
        if steps and steps[-1]['g'] in ('c', 'g'):
            steps[-1]['ph'], steps[-1]['h'] = '∅', 0.05
    if w in EPRON:                                   # ⭐ e+s final PRONONCÉ (liste fermée, miroir app)
        for k in range(len(steps)):
            if steps[k]['g'] == 'e':
                steps[k]['ph'], steps[k]['h'] = 'e', 0.05; break
    # ⭐ 09/10/2026 — miroir app (police de son) : ① « e » devant s/ss NON final prononcé (ss → /e/, s + consonne → /ɛ/,
    #    s + voyelle → /ə/) ; ② pluriels des c/g finaux muets (bancs, étangs) ; ③ « est » (verbe) et « es » → /ɛ/, s et t muets.
    for k in range(len(steps) - 2):
        ek, sk = steps[k], steps[k + 1]
        if ek['g'] == 'e' and ek['ph'] in ('', '∅', None) and sk['g'] in ('s', 'ss'):
            ek['ph'] = 'e' if sk['g'] == 'ss' else ('ə' if re.match('[aeiouyàâäéèêëîïôöùûü]', steps[k + 2]['g']) else 'ɛ')
            ek['h'] = 0.05
    if len(w) > 2 and w.endswith('s') and (w[:-1] in CFIN_MUET or w[:-1] in GFIN_MUET):
        if len(steps) >= 2 and steps[-2]['g'] in ('c', 'g'):
            steps[-2]['ph'], steps[-2]['h'] = '∅', 0.05
    if w in ('est', 'es'):
        for x in steps:
            x['ph'], x['h'] = ('ɛ' if x['g'] == 'e' else '∅'), 0.05
    _r39(steps, w)                                    # ⭐ liste n° 39 (phonème seulement, h intact)
    return steps

def sublexical_phon(word, accents=True, correct=True, seg=None):
    """Décompo sublexicale → (sampa, ipa, graphèmes[{g,ph_sampa,h}], hesitation_moyenne).
    `correct` applique la table de correction apprise (boucle descendante) ; `seg` = segmentation."""
    steps = g2p(word, accents=accents, seg=seg)
    w = KEEP.sub('', word.lower())
    graph = []
    sampa_parts, ipa_parts, hs = [], [], []
    i = 0
    for st in steps:
        g = st['g']
        nxt = w[i + len(g)] if i + len(g) < len(w) else '#'; i += len(g)
        sp = ipa_to_sampa(st['ph'])
        if correct and CORR:                             # correction apprise (graphème, contexte droit)
            sp = CORR.get(g + '\t' + nxt + '\t' + sp, sp)   # ⭐ 16/10/2026 : clé conditionnelle à la prédiction (liste n° 39)
        graph.append({'g': g, 'ph': sp, 'ipa': '' if st['ph'] == '∅' else st['ph'], 'h': st['h']})
        sampa_parts.append(sp); ipa_parts.append('' if st['ph'] == '∅' else st['ph']); hs.append(st['h'])
    sampa = ''.join(sampa_parts)
    hmean = sum(hs) / len(hs) if hs else 0.0
    return sampa, ''.join(ipa_parts), graph, hmean

# ── ⭐ 16/10/2026 (liste n° 36) — le g2p EXACT du moteur JS, pour le speller de référence ──
def g2p_moteur(word):
    """g2p tel que le produit le rend (app `_DECL2.g2p` ≡ extension/assets/g2p.js) : segments du moteur, SANS overlay d'accents
    (le JS rend '?' sur une lettre accentuée) ; mesuré identique sur 19 785 mots (pools de candidats des 3 corpus dys)."""
    return g2p(word, accents=False, seg=SEG_MOTEUR)
def g2p_moteur_cle(word):
    """clé de SON du speller = phonèmes IPA concaténés, muets exclus — miroir exact de `_sonKey` (dys-core.js / app).
    ⭐ 16/10/2026 (liste n° 39) : le « e » FAIBLE ne compte pas (schwa ; e/ɛ d'un « e » nu non final) ; le e de -er/-ez finals reste."""
    st = g2p_moteur(word); o = []
    for i, s in enumerate(st):
        p = s['ph']
        if not p or p == u'∅' or p == u'ə': continue
        if s['g'] == 'e' and p in (u'e', u'ɛ') and not (i == len(st) - 2 and st[i + 1]['g'] in ('r', 'z')): continue
        o.append(p)
    return ''.join(o).replace(u'ɔ', 'o')   # ɔ → o (toreau / taureau)

# ── syllabes (SON) par RÈGLES (principe de l'attaque maximale) : noyaux = voyelles SAMPA ;
#    nbsyll = nb de noyaux (invariant). La frontière laisse à la syllabe suivante l'attaque LÉGALE
#    la plus longue (C+liquide(+glide), C+glide, C, glide) ; le reste forme la coda précédente. ──
LIQ = set('lR'); GLIDE = set('jw8')
def _legal_onset(s):
    if len(s) == 1: return True                          # une consonne ou un glide = attaque licite
    if len(s) == 2: return (s[1] in LIQ and s[0] not in LIQ | GLIDE) or (s[1] in GLIDE and s[0] not in GLIDE)
    if len(s) == 3: return s[2] in GLIDE and s[1] in LIQ and s[0] not in LIQ | GLIDE   # ex. /pri j/ → onset 'prj'? (rare)
    return False
def _onset_len(cluster):
    for L in (3, 2, 1):                                  # plus longue attaque légale en suffixe du cluster
        if L <= len(cluster) and _legal_onset(cluster[-L:]): return L
    return min(1, len(cluster))
def syllabify_sampa(sampa):
    nuclei = [i for i, c in enumerate(sampa) if c in SAMPA_VOW]
    if not nuclei:
        return ([sampa] if sampa else []), 0
    cuts = [0]
    for k in range(len(nuclei) - 1):
        a, b = nuclei[k], nuclei[k + 1]
        cluster = sampa[a + 1:b]                          # consonnes/glides entre deux noyaux
        cuts.append(b - _onset_len(cluster) if cluster else a + 1)   # attaque max à droite ; hiatus → coupe après a
    cuts.append(len(sampa))
    sylls = [sampa[cuts[i]:cuts[i + 1]] for i in range(len(cuts) - 1)]
    return sylls, len(nuclei)

# ── syllabes (ORTHO, orthosyll Lexique) : on CALQUE le découpage orthographique sur les syllabes
#    PHONOLOGIQUES (mêmes frontières) — chaque graphème va dans la syllabe de son 1er phonème ;
#    un graphème muet (∅) reste avec la syllabe courante (ex. le « x » final de chevaux). ──
def syllabify_ortho(graph):
    sylls, _ = syllabify_sampa(''.join(gp['ph'] for gp in graph))
    if not sylls:
        return [''.join(gp['g'] for gp in graph)] if graph else []
    syl_of = []                                          # position phonémique → index de syllabe
    for si, s in enumerate(sylls):
        syl_of += [si] * len(s)
    out = [''] * len(sylls); pos = 0
    for gp in graph:
        si = syl_of[pos] if pos < len(syl_of) else len(sylls) - 1
        out[si] += gp['g']; pos += len(gp['ph'])
    out = [s for s in out if s]
    return out or [''.join(gp['g'] for gp in graph)]

# ── route LEXICALE de la catégorie grammaticale (cgram / genre) ──
def lexical_gram(word):
    d = deacc(word.lower())
    cats, genre = [], None
    if d in VERBS:
        cats.append('VER')
    if d in GENDER:
        cats.append('NOM'); genre = GENDER[d]
    if d in ADJ:
        cats.append('ADJ'); genre = genre or ADJ[d][0]
    return cats, genre

def nombre_heuristic(word):
    """Nombre par suffixe (sublexical, classe fermée fiable) : -s/-x → pluriel, sinon singulier."""
    d = deacc(word.lower())
    return 'p' if d.endswith(('s', 'x')) else 's'

# ── MORPHOLOGIE (décompo « comme Lexique 4 ») : route LEXICALE md/mb (morpho.json, build_morpho.py)
#    × repli SUBLEXICAL par affixes (double voie de la morpho). ──
MORPHO = _load_json('morpho.json', {})                  # mot(deacc) → [base, md_brut]
def _parse_md(md):
    """« /port(er).able » → ['port','able'] (parenthèse = lemme, retirée ; '.' = affixe ; '/' = composé gardé)."""
    return [re.sub(r'\(.*?\)', '', p) for p in md.lstrip('/').split('.') if re.sub(r'\(.*?\)', '', p)]
_PREF = ['contre', 'entre', 'anti', 'auto', 'para', 'sous', 'des', 'pre', 'sur', 're', 'de', 'in', 'im', 'co']
_SUF = ['isation', 'ation', 'ition', 'ement', 'ible', 'able', 'ment', 'tion', 'sion', 'teur', 'trice', 'euse',
        'iste', 'isme', 'ique', 'aire', 'ance', 'ence', 'eur', 'age', 'ure', 'ite', 'eux', 'ive', 'er', 'ir',
        'ee', 'es', 'ais', 'ait', 'ant', 'ent', 'if']
def _sublex_morpho(word):
    """Repli sublexical CONSERVATEUR : pèle d'abord un SUFFIXE (signal fiable, racine restante ≥4) ; ne
    pèle un préfixe QUE si un suffixe a été trouvé — évite les faux découpages type « importante → im+portante »
    (pas de suffixe dans la liste → on s'abstient). None si moins de 2 morphèmes."""
    root = deacc(word.lower()); pref = suf = None
    for s in sorted(_SUF, key=len, reverse=True):
        if root.endswith(s) and len(root) - len(s) >= 4: suf = s; root = root[:-len(s)]; break
    if suf:
        for p in sorted(_PREF, key=len, reverse=True):
            if root.startswith(p) and len(root) - len(p) >= 4: pref = p; root = root[len(p):]; break
    parts = [x for x in (pref, root, suf) if x]
    return parts if len(parts) >= 2 else None
def morpho_of(word):
    """(morphèmes, base, md_brut, source) — route lexicale si connue, sinon repli sublexical, sinon None."""
    rec = MORPHO.get(deacc(word.lower()))
    if rec:
        mb, md = rec[0], rec[1]
        return (_parse_md(md) if md else [mb]), mb, md, 'lex'
    sub = _sublex_morpho(word)
    return (sub, max(sub, key=len), '', 'sublex') if sub else (None, '', '', None)  # base = racine (plus longue)

# ── DÉCOMPOSITION complète (un mot) : double voie SON+ORTHO, façon Lexique 4 ──
def decompose(word, accents=True):
    w = word.strip().lower()
    letters = KEEP.sub('', w)
    sub_sampa, sub_ipa, graph, hmean = sublexical_phon(w, accents=accents)
    # SON — route lexicale Lexique (exacte) > route lexicale Morphalou (82,4 % mesuré, mots SANS
    # homophone donc absents de W2P — de/je/le/que...) > sublexicale (g2p) pour le reste des OOV.
    lex_phono = W2P.get(w)
    morph_phono = PHON_MORPHALOU.get(w) if lex_phono is None else None
    if lex_phono is not None:
        phono, src_phon = lex_phono, 'lex'
        nbhomoph = max(0, GROUP.get(lex_phono, 1) - 1)
    elif morph_phono is not None:
        phono, src_phon = morph_phono, 'lex-morphalou'
        nbhomoph = 0                                  # inconnu (Morphalou ne rend pas les homophones)
    else:
        phono, src_phon = sub_sampa, 'sublex'
        nbhomoph = GROUP.get(sub_sampa, 0)            # nb de mots Lexique homophones du son PRÉDIT (0 si inédit)
    syll_phon, nbsyll = syllabify_sampa(phono)
    cv = ''.join('V' if c in SAMPA_VOW else ('G' if c in 'jw8' else 'C') for c in phono)
    # ORTHO — découpage en graphèmes + syllabes orthographiques (route sublexicale)
    syll_ortho = syllabify_ortho(graph)
    # GRAMMAIRE — route lexicale (cgram/genre) + nombre sublexical
    cats, genre = lexical_gram(w)
    gram_src = 'lex' if cats else 'sublex'
    # MORPHOLOGIE — route lexicale (md/mb Lexique 4) × repli sublexical (affixes)
    morphs, base, md, morpho_src = morpho_of(w)
    rec = {
        'mot': w, 'nblettres': len(letters),
        'graphemes': [gp['g'] for gp in graph],
        'syll_ortho': syll_ortho,
        'phono': phono, 'phono_ipa': sub_ipa, 'src_phon': src_phon,
        'nbphons': len(phono), 'syll_phon': syll_phon, 'nbsyll': nbsyll, 'cv': cv,
        'cgram': cats, 'genre': genre, 'nombre': nombre_heuristic(w),
        'nbhomoph': nbhomoph, 'gram_src': gram_src,
        'morpho': morphs, 'base': base, 'morpho_md': md, 'morpho_src': morpho_src,
        'sublex_phono': sub_sampa,                       # toujours la prédiction sublexicale (pour audit/learn)
        'hesitation': round(hmean, 3), 'confiance': round(max(0.0, 1.0 - hmean), 3),
        'alignement': [{'g': gp['g'], 'ph': gp['ph']} for gp in graph],
    }
    return rec

# ── affichage humain (SON ET ORTHO bien séparés) ──
def fmt(rec):
    L = []
    L.append(f"« {rec['mot']} »  ({rec['nblettres']} lettres)")
    al = '  '.join(f"{a['g']}→{a['ph'] or '∅'}" for a in rec['alignement'])
    L.append(f"  ORTHO  graphèmes : {al}")
    L.append(f"         syllabes  : {'-'.join(rec['syll_ortho'])}")
    rt = {'lex': 'lexicale (Lexique)', 'lex-morphalou': 'lexicale (Morphalou)'}.get(rec['src_phon'], 'sublexicale (g2p, OOV)')
    L.append(f"  SON    phono     : /{rec['phono']}/   [IPA {rec['phono_ipa'] or '∅'}]   route {rt}")
    L.append(f"         {rec['nbphons']} phonèmes · {rec['nbsyll']} syllabe(s) : "
             f"{'-'.join(rec['syll_phon'])} · CV={rec['cv']}")
    if rec['src_phon'] in ('lex', 'lex-morphalou') and rec['sublex_phono'] != rec['phono']:
        L.append(f"         (prédiction sublexicale : /{rec['sublex_phono']}/ — diverge, confiance {rec['confiance']})")
    gram = '/'.join(rec['cgram']) if rec['cgram'] else '—'
    g = {'m': 'masculin', 'f': 'féminin'}.get(rec['genre'], '—')
    nb = {'s': 'singulier', 'p': 'pluriel'}[rec['nombre']]
    src = 'lexicale' if rec['gram_src'] == 'lex' else 'sublexicale'
    L.append(f"  GRAM   cgram : {gram} ({src}) · genre : {g} · nombre : {nb} · homophones : {rec['nbhomoph']}")
    if rec.get('morpho'):
        ms = 'lexicale' if rec['morpho_src'] == 'lex' else 'sublexicale (affixes)'
        md = f"   [{rec['morpho_md']}]" if rec.get('morpho_md') else ''
        base = f" · base : {rec['base']}" if rec.get('base') and rec['base'].lower() != rec['mot'] else ''
        L.append(f"  MORPHO {' + '.join(rec['morpho'])}{md}{base}  ({ms})")
    return '\n'.join(L)

# ── APPREND : lexique appris incrémental (boucle descendante, FP=0) ──
def load_learned():
    return _load_json(os.path.basename(LEX_LEARNED), {'_meta': {'lus': 0, 'phon_inv': {}, 'graph_inv': {}}})

def save_learned(lex):
    json.dump(lex, open(LEX_LEARNED, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

def _entry(rec):
    return {'phono': rec['phono'], 'ipa': rec['phono_ipa'], 'nbphons': rec['nbphons'],
            'nbsyll': rec['nbsyll'], 'cv': rec['cv'], 'cgram': rec['cgram'], 'genre': rec['genre'],
            'nombre': rec['nombre'], 'nbhomoph': rec['nbhomoph'],
            'src': rec['src_phon'], 'gram_src': rec['gram_src']}

def learn_word(lex, word, accents=True, role=None):
    """Apprend (ou renforce) un mot. RÈGLE FP=0 : une entrée LEXICALE sûre n'est jamais
    dégradée par une prédiction sublexicale ; lex remplace sublex (montée en sûreté) ;
    l'usage répété incrémente `vu`. `role` (optionnel) = étiquette grammaticale EN CONTEXTE
    accumulée dans la base (apprend la grammaire d'usage). Renvoie ('neuf'|'renforce'|'promu')."""
    rec = decompose(word, accents=accents)
    w = rec['mot']
    if not rec['graphemes']:
        return None
    prev = lex.get(w)
    e = _entry(rec)
    if prev is None:
        e['vu'] = 1; e['premier'] = lex['_meta']['lus']; lex[w] = e; status = 'neuf'
    else:
        vu = prev.get('vu', 1) + 1
        if prev.get('src') == 'lex' and e['src'] == 'sublex':
            prev['vu'] = vu; status = 'renforce'          # ne PAS écraser la source sûre (FP=0)
        elif prev.get('src') == 'sublex' and e['src'] == 'lex':
            e['vu'] = vu; e['premier'] = prev.get('premier', lex['_meta']['lus']); lex[w] = e; status = 'promu'
        else:
            prev['vu'] = vu; status = 'renforce'
    lex[w]['dernier'] = lex['_meta']['lus']
    if role:                                             # GRAMMAIRE EN CONTEXTE stockée dans la base (compteur par rôle)
        r = lex[w].setdefault('roles', {})
        r[role] = r.get(role, 0) + 1
    # inventaire d'usage (apprend la distribution des phonèmes/graphèmes vus)
    for c in rec['phono']:
        lex['_meta']['phon_inv'][c] = lex['_meta']['phon_inv'].get(c, 0) + 1
    for gph in rec['graphemes']:
        lex['_meta']['graph_inv'][gph] = lex['_meta']['graph_inv'].get(gph, 0) + 1
    return status

def read_text(text, accents=True, verbose=False):
    """Lit un texte mot à mot et APPREND chaque mot (le volet « lu aussi »)."""
    lex = load_learned()
    counts = {'neuf': 0, 'renforce': 0, 'promu': 0}
    for tok in toks(text):
        st = learn_word(lex, tok, accents=accents)
        if st:
            counts[st] += 1; lex['_meta']['lus'] += 1
            if verbose:
                print(f"  {tok:16} {st:9} → /{lex[tok.lower()]['phono']}/ ({lex[tok.lower()]['src']})")
    save_learned(lex)
    return counts, lex

# ── MESURE (doctrine §1) : route sublexicale vs vérité-terrain Lexique. in-lexique ⟂ OOV ──
def _lev(a, b):
    n, m = len(a), len(b)
    dp = list(range(m + 1))
    for i in range(1, n + 1):
        prev, dp[0] = dp[0], i
        for j in range(1, m + 1):
            cur = dp[j]
            dp[j] = min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] != b[j - 1]))
            prev = cur
    return dp[m]

# ── ALIGNEMENT graphème↔phonème (partagé : boucle descendante + cognition phono→ortho) ──
def steps_of(word, seg=None):
    """[(graphème, caractère-suivant, phonème SAMPA prédit RAW)] via le g2p enrichi (sans correction) ; `seg` : SEG par défaut."""
    st = g2p(word, accents=True, seg=SEG if seg is None else seg)
    w = KEEP.sub('', word.lower()); out = []; i = 0
    for s in st:
        g = s['g']; nxt = w[i + len(g)] if i + len(g) < len(w) else '#'
        out.append((g, nxt, ipa_to_sampa(s['ph']))); i += len(g)
    return out

def align_chunks(preds, gold):
    """Partition MONOTONE de `gold` en len(preds) morceaux (0..3 car.) minimisant Σ _lev(pred_i, morceau_i).
    Les prédictions g2p servent d'ancres → chaque graphème reçoit son morceau de phono gold."""
    k, n = len(preds), len(gold); INF = 10 ** 9
    dp = [[INF] * (n + 1) for _ in range(k + 1)]; bk = [[0] * (n + 1) for _ in range(k + 1)]; dp[0][0] = 0
    for i in range(1, k + 1):
        pr = preds[i - 1]
        for p in range(n + 1):
            best, bq = INF, 0
            for q in range(max(0, p - 3), p + 1):
                if dp[i - 1][q] >= INF: continue
                c = dp[i - 1][q] + _lev(pr, gold[q:p])
                if c < best: best, bq = c, q
            dp[i][p] = best; bk[i][p] = bq
    chunks = []; p = n
    for i in range(k, 0, -1):
        q = bk[i][p]; chunks.append(gold[q:p]); p = q
    chunks.reverse(); return chunks

def aligned_units(word):
    """Unités d'alignement d'un mot in-lexique : liste de (morceau_phono, graphie) où les graphèmes
    MUETS (∅) sont repliés sur le graphème prononcé voisin (précédent, sinon suivant). Base du p2g."""
    if word not in W2P:
        return None
    S = steps_of(word, seg=SEG_UNITS); chunks = align_chunks([s[2] for s in S], W2P[word])   # unités d'émission (liste n° 39)
    units = []; lead = ''
    for (g, _, _), ch in zip(S, chunks):
        if ch == '':                                     # graphème muet (lettre non prononcée)
            if units: units[-1][1] += g                  # replie sur la graphie prononcée précédente
            else: lead += g                              # muet en tête (h de homme) → graphème suivant
        else:
            units.append([ch, lead + g]); lead = ''
    if lead and units: units[0][1] = lead + units[0][1]
    return units

def inlex_split(seed=42, test_frac=0.2):
    """Partage déterministe des mots in-lexique en TRAIN (apprend la correction) / TEST (mesure).
    Garantit que la table de correction n'est PAS mesurée sur ses données d'apprentissage (§1.3)."""
    pool = [w for w in W2P if w.isalpha()]
    rnd = random.Random(seed); rnd.shuffle(pool)
    cut = int(len(pool) * (1 - test_frac))
    return pool[:cut], pool[cut:]

def measure(seed=42, n_test=4000):
    _, test = inlex_split(seed)
    test = test[:n_test]
    base_seg = sorted(set(_T['SEG']), key=lambda s: -len(s))   # SEG du moteur (sans enrichissement)
    print(f"=== MESURE route SUBLEXICALE vs phono Lexique — HELD-OUT (test={len(test)}, seed={seed}) ===")
    def run(tag, correct, seg, acc=True):
        exact = nph = 0; tot_ed = tot_ph = 0
        for w in test:
            gold = W2P[w]; pred, _, _, _ = sublexical_phon(w, accents=acc, correct=correct, seg=seg)
            exact += (pred == gold); tot_ed += _lev(pred, gold); tot_ph += len(gold); nph += (len(pred) == len(gold))
        N = len(test)
        print(f"  {tag:46} exact {100*exact/N:5.2f}%  ·  phonémique {100*(1-tot_ed/max(1,tot_ph)):5.2f}%  ·  nbphons {100*nph/N:5.1f}%")
        return 100 * exact / N
    a = run("(1) g2p moteur brut (SEG=%d, sans correction)" % len(SEG_MOTEUR), False, base_seg)
    b = run("(2)  + SEG enrichi (+%d segments mesurés)" % len(SEG_EXTRA), False, SEG)
    c = run("(3)  + correction apprise (boucle descendante)", True, SEG)
    cstate = f"chargée, {len(CORR)} règles" if CORR else "ABSENTE → lance build_g2p_corrections.py"
    print(f"  Δ total (3)−(1) : {c-a:+.2f} points d'exactitude   ·   table de correction : {cstate}")
    # ablation ACCENTS (sur le meilleur étage) — l'overlay reste mesuré (§1)
    na = run("    ablation : SANS overlay accents", True, SEG, acc=False)
    print(f"    → overlay accents : {c-na:+.2f} pts")
    # OOV (tenu SÉPARÉ §1.3) : pas de vérité-terrain → couverture/confiance seulement
    rnd = random.Random(seed)
    oov = [w for w in VERBS if w not in W2P and w.isalpha()]
    oov = rnd.sample(oov, min(1000, len(oov)))
    conf = [decompose(w)['confiance'] for w in oov]
    print(f"=== OOV (sans phono Lexique — couverture/confiance, n={len(oov)}) ===")
    print(f"    sublexical : 100% produisent un phono · confiance moyenne {sum(conf)/max(1,len(conf)):.3f} · cgram couvre 100% (verbes)")
    # couverture MORPHO (route lexicale md/mb × repli sublexical affixes)
    mlex = sum(1 for w in test if (morpho_of(w)[3] == 'lex'))
    msub = sum(1 for w in test if (morpho_of(w)[3] == 'sublex'))
    print(f"    MORPHO sur le test : lexicale {100*mlex/len(test):.0f}% · repli sublexical {100*msub/len(test):.0f}% "
          f"· sans morpho {100*(len(test)-mlex-msub)/len(test):.0f}% (mots mono-morphème)")
    # garde-fous (§1.5) : cas connus reproduits
    CHK = {'chat': 'Sa', 'cheval': 'S°val', 'oiseau': 'wazo', 'maison': 'mEz§', 'examen': 'Egzam5',
           'beau': 'bo', 'rouge': 'RuZ', 'lui': 'l8i', 'nation': 'nasj§'}
    bad = [(w, sublexical_phon(w)[0], g) for w, g in CHK.items() if sublexical_phon(w)[0] != g]
    print("=== garde-fous (cas connus) ===", "OK" if not bad else f"ÉCHECS : {bad}")

# ── état du lexique appris ──
def show_lex():
    lex = load_learned()
    words = {k: v for k, v in lex.items() if k != '_meta'}
    meta = lex.get('_meta', {})
    print(f"=== lexique appris : {len(words)} mots distincts · {meta.get('lus',0)} occurrences lues ===")
    by_src = {}
    for v in words.values():
        by_src[v.get('src')] = by_src.get(v.get('src'), 0) + 1
    print(f"  sources : {by_src}")
    top = sorted(words.items(), key=lambda kv: -kv[1].get('vu', 0))[:12]
    for w, v in top:
        roles = v.get('roles')
        rstr = ('  rôles ' + ' '.join(f"{k}:{n}" for k, n in sorted(roles.items(), key=lambda x: -x[1]))) if roles else ''
        print(f"  {w:16} vu×{v.get('vu',1):<3} /{v['phono']}/  {('/'.join(v['cgram']) if v['cgram'] else '—')}  ({v['src']}){rstr}")
    pinv = sorted(meta.get('phon_inv', {}).items(), key=lambda kv: -kv[1])[:10]
    print("  phonèmes les plus fréquents :", ' '.join(f"{p}:{c}" for p, c in pinv))


def main(argv):
    if not argv:
        print(__doc__.strip().split('\n\n')[0]); print("\nUsage : voir l'en-tête (mot | --read | --read-file | --lex | --measure | --demo)")
        return 0
    a = argv[0]
    if a == '--measure':
        measure(); return 0
    if a == '--lex':
        show_lex(); return 0
    if a == '--read':
        c, lex = read_text(' '.join(argv[1:]), verbose=True)
        print(f"→ appris : {c['neuf']} neufs · {c['renforce']} renforcés · {c['promu']} promus "
              f"· lexique = {len([k for k in lex if k!='_meta'])} mots"); return 0
    if a == '--read-file':
        if len(argv) < 2 or not os.path.exists(argv[1]):
            print("fichier introuvable"); return 1
        c, lex = read_text(open(argv[1], encoding='utf-8').read())
        print(f"→ appris depuis {argv[1]} : {c['neuf']} neufs · {c['renforce']} renforcés · {c['promu']} promus "
              f"· lexique = {len([k for k in lex if k!='_meta'])} mots"); return 0
    if a == '--demo':
        demo(); return 0
    for w in argv:                                       # un ou plusieurs mots
        print(fmt(decompose(w))); print()
    return 0


def demo():
    print("=== décomposition (son ET ortho), double voie ===\n")
    for w in ['chevaux', 'oiseau', 'femme', 'examen', 'beaucoup', 'aujourd', 'kayak', 'dictée']:
        print(fmt(decompose(w))); print()
    print("=== APPREND en lisant un texte (lexique incrémental, FP=0) ===")
    txt = "Le petit chat boit du lait. Les chats boivent du lait."
    c, lex = read_text(txt)
    print(f"texte : « {txt} »\n→ {c['neuf']} mots neufs, {c['renforce']} renforcés "
          f"(« chat/chats », « du », « lait » revus). Lexique = {len([k for k in lex if k!='_meta'])} mots.")


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
