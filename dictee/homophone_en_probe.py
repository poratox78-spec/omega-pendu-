# -*- coding: utf-8 -*-
# CANAL HOMOPHONE ANGLAIS — référence. LE gros des fautes dys en anglais = confusions de mots RÉELS
# (their/there/they're, your/you're, its/it's, than/then, could of…). Calqué sur le FR (rule_son_sont) :
# on tranche par la CLASSE du mot voisin (POS de lex_en) et on S'ABSTIENT dans l'ambigu → FP=0.
#   RED   = correction (faute structurellement certaine : modal+of, "their is", "its a"…).
#   ORANGE= vigilance « à vérifier » (contexte faible ; doctrine doute→orange, jamais le silence).
# Mesuré : RED sur EWT (texte correct) doit être ~0 (=FP) ; ORANGE = taux de flood reporté ;
#   recall sur fautes plantées.  Lancer : PYTHONUTF8=1 python dictee/homophone_en_probe.py
import gzip, os, re, sys, collections
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
LEX = os.path.join(HERE, 'lex_en.tsv.gz')

def load_lex():
    POS = {}; IPA = {}
    with gzip.open(LEX, 'rt', encoding='utf-8') as f:
        f.readline()
        for line in f:
            c = line.rstrip('\n').split('\t')
            if len(c) >= 3 and c[0]:
                POS[c[0]] = set(c[1].split('|'))
                if c[2]: IPA[c[0]] = c[2]
    return POS, IPA
POS, IPA = load_lex()

# a / an : tranché par le SON du mot suivant (IPA — c'est là que la phono de la base tranche :
# « an hour » vs « a university »). Voyelle initiale -> an ; consonne -> a. IPA manquante -> abstention (FP=0).
VOWEL_IPA = set('aeiouɑɒɔɛɪʊʌəæɜɚɝɐɘœø')
def vowel_start(w):
    ip = IPA.get(w.lower())
    if not ip: return None
    ip = ip.lstrip("/[]ˈˌˑ. ")
    return (ip[0] in VOWEL_IPA) if ip else None

def pos_of(w): return POS.get(w.lower(), set())
def is_noun(w): p = pos_of(w); return 'NOUN' in p
def only_noun(w): p = pos_of(w); return p == {'NOUN'}
def is_verb(w): return 'VERB' in pos_of(w)
def is_adj(w):  return 'ADJ' in pos_of(w)

MODALS = {'could', 'would', 'should', 'must', 'might', 'may'}
COMPAR = {'more', 'less', 'better', 'worse', 'rather', 'other', 'greater', 'fewer', 'sooner', 'bigger',
          'smaller', 'faster', 'slower', 'higher', 'lower', 'older', 'younger', 'longer', 'stronger'}
BE_AFTER = {'is', 'are', 'was', 'were', "isn't", "aren't"}     # copule -> « there », pas le possessif « their »
# après « than », un GN/pronom (comparé) = erreur « then » sûre ; un verbe = « then » temporel (abstention)
THAN_OBJ = {'a', 'an', 'the', 'i', 'me', 'you', 'he', 'him', 'she', 'her', 'it', 'we', 'us', 'they',
            'them', 'mine', 'yours', 'his', 'hers', 'ours', 'theirs', 'that', 'this', 'these', 'those',
            'any', 'ever', 'usual', 'before', 'expected'}
ITS_RED = {'a', 'an', 'the', 'been'}                           # possessif « its » NE PEUT PAS précéder article/been
ITS_ORANGE = {'not', 'going', 'gonna'}
YOURE_RED = {'gonna'}                                          # « gonna » n'est jamais un nom
YOURE_ORANGE = {'welcome', 'going', 'doing', 'being', 'getting', 'coming', 'not', 're'}
# adjectifs gradables fréquents (construction « too <adj> to/for ») — pour trancher to -> too
DEGREE_ADJ = {'late', 'early', 'hard', 'easy', 'big', 'small', 'large', 'far', 'fast', 'slow', 'high', 'low',
    'hot', 'cold', 'long', 'short', 'old', 'young', 'soon', 'tired', 'busy', 'expensive', 'cheap', 'heavy',
    'light', 'loud', 'quiet', 'tight', 'weak', 'strong', 'difficult', 'dangerous', 'scared', 'afraid',
    'close', 'deep', 'wide', 'narrow', 'thick', 'thin', 'rich', 'poor', 'full', 'empty', 'bright', 'dark',
    'sick', 'tall', 'nervous', 'proud', 'lazy', 'complicated', 'painful', 'risky'}
# mots qui prennent l'infinitif « to » -> ne PAS lire « to + adj » comme « too » (« I want to close… »)
TO_INF_GUARD = {'want', 'wants', 'wanted', 'need', 'needs', 'needed', 'like', 'likes', 'liked', 'love',
    'loves', 'loved', 'try', 'tries', 'tried', 'going', 'have', 'has', 'had', 'used', 'able', 'wish',
    'hope', 'hopes', 'plan', 'plans', 'decide', 'decided', 'learn', 'begin', 'seem', 'seems', 'start',
    'started', 'continue', 'refuse', 'offer', 'manage', 'tend', 'get', 'gets', 'got', 'allow', 'allowed',
    'how', 'way', 'ways', 'time', 'right', 'nice', 'hard', 'easy'}
# accord sujet-verbe (erreurs dys/L2 anglaises fréquentes) — RED FP=0 (jamais correct en anglais standard)
SUBJ_SING3 = {'he', 'she', 'it'}                              # 3e sing. + « don't » -> « doesn't »
SUBJ_NON3  = {'i', 'you', 'we', 'they'}                       # non-3e + « doesn't » -> « don't »
WAS_WRONG  = {'you', 'we', 'they'}                            # you/we/they + « was » -> « were » (I/he/she/it was = correct)
# loose (adj « pas serré ») confondu avec le VERBE lose (perdre) : « to/will/don't … loose » -> lose (ORANGE)
LOOSE_TRIG  = {'to', 'will', 'would', 'can', 'could', 'might', 'must', 'should', 'may', "don't", "doesn't",
    'gonna', 'cannot', "'ll", 'll', "won't", 'wont'}
LOOSE_IDIOM = {'let', 'cut', 'break', 'set', 'turn', 'come', 'work', 'hang', 'shake', 'get', 'got', 'be',
    'been', 'being', 'is', 'are', 'was', 'were', 'on', 'so', 'too', 'very', 'more'}  # « be loose », « cut loose »… = adj légitime
TO_MUCH_PREV_STOP = {'', 'listen', 'up', 'close', 'talk', 'talking', 'speak', 'speaking', 'refer',
    'referred', 'according', 'due', 'access', 'attention', 'related'}
# ---- familles ajoutées en 08/2026 (miroir de corrector_en.js) : le discriminateur est STRUCTUREL (mot voisin ou POS)
# ⭐ FAUTES DE VRAI MOT, PAR OCCASIONS COMPTÉES (17/09/2026, miroir corrector_en.js). Sur les 626 fautes réelles qu'UD
# English-EWT annote (dictee/ewt_typos_en.tsv), 279 sont MUETTES parce que la graphie fautive est elle-même un mot : you pour
# your (14 sur 14 muettes), the pour they (6 sur 6), to pour too (5 sur 6), and/an, new pour knew, there own. Chaque règle a
# été passée au banc de tir AVANT d'être écrite : occasions justes sur ces fautes annotées, et tirs sur 176 893 tokens de
# texte ÉDITÉ (PUD + genres édités de GUM) et sur le reste d'EWT (web) — chaque tir lu. Toutes ORANGE : la phrase fautive
# laisse parfois deux lectures (« the are » = they are / there are), donc doute.
YOU_APPOS = {'guys', 'people', 'folks', 'two', 'three', 'four', 'five', 'all', 'both', 'lot', 'lots', 'kids', 'boys',
             'girls', 'ladies', 'gentlemen', 'men', 'women', 'fellas', 'fellows', 'ones', 'lads', 'children', 'students',
             'parents', 'kind', 'sort', 'sir', 'madam', 'too', 'either', 'yourself', 'yourselves', 'everyone', 'everybody',
             'anyone', 'something', 'anything', 'nothing', 'time', 'money', 'credit', 'luck', 'access', 'information',
             'advice', 'permission', 'notice', 'trouble', 'peace', 'joy', 'hell'}      # « you guys », « give you time » : pas un possessif
PREP_YOU = {'on', 'for', 'of', 'in', 'with', 'at', 'by', 'from', 'about', 'into', 'onto', 'under', 'over', 'through',
            'without', 'behind', 'near', 'inside', 'against', 'around', 'upon', 'within'}   # PAS « to » : « to you personally »
YOUR_IS = {'is', 'was', 'has', "isn't", "wasn't", 'will', 'would'}
YOUR_INTRO = {'that', 'if', 'hope', 'hoping', 'know', 'sure', 'glad', 'when', 'because', 'and', 'but', 'so', 'as',
              'since', 'while', 'whether', 'think', 'guess'}     # « told you dinner is ready » reste correct
THEY_AUX = {'are', 'were', "aren't", "weren't", "don't", "didn't", "can't", "couldn't", "won't", "wouldn't",
            "shouldn't", "haven't", "hadn't"}
THEY_MODAL = {'will', 'would', 'can', 'could', 'should', 'must', 'might'}
TOO_ADJ = {'far', 'bad', 'late', 'early', 'tight', 'hard', 'easy', 'big', 'small', 'large', 'high', 'hot', 'cold', 'old',
           'young', 'soon', 'tired', 'expensive', 'cheap', 'heavy', 'loud', 'weak', 'strong', 'difficult', 'dangerous',
           'scared', 'afraid', 'deep', 'wide', 'thick', 'rich', 'poor', 'sick', 'tall', 'nervous', 'lazy', 'complicated',
           'painful', 'risky', 'good', 'funny', 'cute', 'sweet', 'stupid', 'crazy', 'scary', 'hungry', 'sleepy', 'drunk'}
           # PAS fast/long/slow/close/light/thin… : « to fast », « to long for » sont des infinitifs
TOO_PREV_STOP = {'close', 'next', 'up', 'due', 'according', 'prior', 'similar', 'equal', 'compared', 'relative',
                 'opposed', 'back', 'down'}
KNEW_PREV = {'i', 'he', 'she', 'we', 'they', 'you', 'never', 'always', 'already', 'just', 'really', 'who'}
KNEW_NEXT = {'what', 'that', 'this', 'nothing', 'how', 'who', 'where', 'why', 'it', 'he', 'she', 'they', 'you', 'i', 'we',
             'about', 'exactly', 'better', 'of'}
AND_AN_PREV = {'is', 'was', 'be', 'been', "it's", 'visit', 'watching', 'have', 'has', 'had', 'got', 'need', 'want'}
_COORD_POS = {'ADJ', 'PROPN', 'VERB', 'NOUN', 'ADV'}
_MOT_MIN = re.compile(r'^[a-z]+$')
def _mot_minuscule(s): return bool(s) and s == s.lower() and bool(_MOT_MIN.match(s))
SUBJ_PRON = {'i', 'we', 'they', 'you', 'he', 'she', 'it'}          # pronoms SUJETS uniquement (« the place where… » est correct)
VERB_SLOT = {'to', 'will', "'ll", 'would', 'can', 'could', 'may', 'might', 'must', 'shall', 'should',
    'please', 'let', 'helps', 'help', 'wanna', 'gonna'}                 # position qui appelle un VERBE
NOUN_SLOT = {'the', 'a', 'an', 'this', 'that', 'my', 'your', 'his', 'her', 'our', 'their', 'some', 'any',
    'no', 'good', 'bad', 'best', 'free', 'professional', 'legal', 'medical', 'financial', 'deep', 'sound'}   # appelle un NOM
DET_AFTER = {'the', 'a', 'an', 'my', 'your', 'his', 'her', 'our', 'their', 'its'}   # PAS this/that : « effect that change » est l'idiome valide
AUX_BEFORE = {'does', 'do', 'did', "doesn't", "didn't", "don't", 'will', 'would', 'can', 'could', 'may',
    'might', 'must', 'shall', 'should', 'to', 'and', 'or', 'not', "won't", "can't", 'why', 'how', 'when', 'what', 'that'}
SUBJUNCTIVE = {'if', 'as', 'wish', 'wishes', 'wished', 'whether', 'though', 'although', 'unless', 'lest', 'than', 'suppose', 'supposing'}
SUBJ_3SG = {'he', 'she', 'it'}                       # pronoms 3e pers. sing. SEULS (un NOM serait ambigu : pluriel invariable, collectif)
DET_BEFORE = {'the', 'these', 'those', 'his', 'her', 'their', 'our', 'my', 'your', 'its', 'both', 'all', 'other', 'first', 'last', 'only', 'same', 'remaining'}
PERF_AUX = {'have', 'has', 'had', "'ve", "'s"}
# prépositions : un pronom qui les suit est COMPLÉMENT, pas sujet (« part of you was »)
_PREP_AVANT = {'of', 'to', 'with', 'for', 'at', 'from', 'about', 'between', 'among', 'like',
    'without', 'against', 'upon', 'than', 'as', 'on', 'in', 'by', 'near', 'behind', 'beside', 'toward', 'towards'}
# morphologie verbale irrégulière régularisée (runned->ran, goed->went…) — map de build_verbmorph_en.py
import os as _os, json as _json
VERBMORPH = {}
try:
    VERBMORPH = _json.load(open(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'verbmorph_en.json'), encoding='utf-8'))
except Exception: pass
PP_AUX = {'have', 'has', 'had', 'having', "'ve", "'d", 'been', 'be', 'is', 'am', 'are', 'was', 'were',
    'get', 'gets', 'got', 'getting'}       # auxiliaires -> participe passé (have runned -> run) ; sinon passé (I runned -> ran)

# MÊME motif que `tokenize` de corrector_en.js (apostrophe typographique ’, lettres accentuées) : sinon les index divergent.
_TOK_RE = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’ʼ][A-Za-zÀ-ÖØ-öø-ÿ]+)*")
def _tok(text): return _TOK_RE.findall(text)

def adj_mask(text):
    """Indices i tels que le token i TOUCHE le token i+1 dans le texte (rien d'autre que des espaces entre).
    `tokenize` jette chiffres et ponctuation : « hit a .322 average » donne `hit a average`, où « a » PARAÎT coller
    à « average ». Les règles qui exigent l'adjacence consultent ce masque. Miroir exact de `adjMask` (JS)."""
    adj = set(); prev_end = -1; i = -1
    for m in _TOK_RE.finditer(text):
        i += 1
        if prev_end >= 0 and re.fullmatch(r'[ \t]*', text[prev_end:m.start()]): adj.add(i - 1)
        prev_end = m.end()
    return adj

# ---- POS CONTEXTUEL (HMM UPOS, pos_en.py) : débloque la direction possessive ----------------------
# `only_noun` s'appuie sur le lexique Wiktionary, qui SUR-VERBIFIE (house/engine/phone/sister sont tous
# tagués VERB) → la direction « there + NOM → their » ne passait presque jamais. Le tagger tranche EN
# CONTEXTE (« there house » : house est NOUN ici), ce que le lexique seul ne peut pas faire.
# Cache par phrase (id de la liste) : Viterbi une fois, pas une fois par token.
try:
    from pos_en import tag_sentence as _tagseq, load_model as _posload
except Exception:
    _tagseq = None; _posload = lambda: None
_POSCACHE = {}
def ctx_pos(T, i):
    """UPOS du token i dans SA phrase (ou None si pas de modèle)."""
    if _tagseq is None or not _posload(): return None
    k = ''.join(T)                                     # miroir JS (T.join('')) — id(T) se réutilise, pas le texte
    tags = _POSCACHE.get(k)
    if tags is None:
        tags = _tagseq(list(T)); _POSCACHE.clear(); _POSCACHE[k] = tags
    return tags[i] if 0 <= i < len(tags) else None

EXIST_BEFORE = {'is', 'are', 'was', 'were', 'be', 'been', 'being', "isn't", "aren't", "wasn't",
                "weren't", 'there'}          # « is there time » = existentiel, PAS un possessif
PLACE_BEFORE = {'over', 'out', 'up', 'down', 'back', 'in', 'from', 'around', 'near', 'right'}
TIME_NOUNS = {'time', 'times', 'yesterday', 'today', 'tomorrow', 'tonight', 'day', 'days', 'week',
              'weeks', 'month', 'months', 'year', 'years', 'morning', 'afternoon', 'evening', 'night',
              'hour', 'hours', 'minute', 'minutes', 'moment', 'while', 'once', 'again'}
def _next_is_noun_ctx(T, i):
    """« there » + NOM (POS CONTEXTUEL) = candidat possessif.
    Le tagger tague « there » PRON dans les DEUX cas (l'existentiel EST un PRON en UD) : le
    discriminant n'est donc pas « there » lui-même mais ce qui SUIT — « there is/are » (AUX) =
    existentiel correct, « there house » (NOUN) = possessif écrit de travers. Deux gardes :
      · pv existentiel / inversion (« is there time ») → abstention ;
      · pv locatif (« over there people… ») → abstention (there = lieu, c'est la virgule qui manque)."""
    pv = T[i-1].lower() if i > 0 else ''
    if pv in EXIST_BEFORE or pv in PLACE_BEFORE: return False
    # FP mesurés sur EWT (2026-08-03), deux familles de « there » LOCATIF suivi d'un nom :
    #   · nom de TEMPS = adverbial, pas possédé : « went there yesterday », « gone there time and time » ;
    #   · « there » POST-NOMINAL (nom juste avant) : « the people there attempt… » = les gens de là-bas.
    # Aucune des 8 vraies fautes d'EWT n'est perdue (leur pv est VERB/ADP/CCONJ/ADV, jamais NOUN).
    if i + 1 < len(T) and T[i+1].lower() in TIME_NOUNS: return False
    if ctx_pos(T, i - 1) == 'NOUN': return False
    return ctx_pos(T, i + 1) == 'NOUN'

def decide(T, i, adj=None):
    """-> (suggestion, level) | (None, None). level ∈ {'RED','ORANGE'}.
    RED = faute STRUCTURELLEMENT certaine (FP=0) ; ORANGE = vigilance contextuelle (doute→orange).
    `adj` = masque d'adjacence RÉELLE (cf. adj_mask) ; absent, on suppose l'adjacence (comportement historique).
    ⚠️ MIROIR EXACT de `homoDecide` (corrector_en.js), règle pour règle et dans le MÊME ORDRE : la première qui
    répond gagne. Toute règle ajoutée d'un côté doit l'être de l'autre — parity_en.js compare token par token."""
    w = T[i]; lw = w.lower()
    nx = T[i+1].lower() if i+1 < len(T) else ''
    nx2 = T[i+2].lower() if i+2 < len(T) else ''
    nx_raw = T[i+1] if i+1 < len(T) else ''
    pv = T[i-1].lower() if i > 0 else ''
    # 1) modal + of -> have  (RED : « modal + of » n'est JAMAIS grammatical) — SAUF « of course » (« would of course be »)
    if lw == 'of' and pv in MODALS and nx != 'course':
        return 'have', 'RED'
    # « a » + son voyelle du mot suivant (IPA) -> « an ». FP=0 : mot suivant en MINUSCULES seulement (US/UN/August se
    # prononcent lettre à lettre) ; « A » capital = article seulement en début de phrase (« Party A ») ; et ADJACENCE
    # RÉELLE (« hit a .322 average » donne les tokens `hit a average`).
    if (lw == 'a' and (w == 'a' or i == 0)
            and nx_raw.isalpha() and nx_raw == nx_raw.lower() and nx_raw != nx_raw.upper()
            and vowel_start(nx) is True
            and (adj is None or i in adj)):
        return 'an', 'RED'
    # la direction inverse « an user » -> « a » : le SON décide (an user, an one : consonne /j/, /w/) ; « an hour »
    # reste muet (IPA vocalique) ; la classe h- aspiré (« an historic », registre britannique) est exclue exprès.
    # « very kind an gentle », « Barcelona an Valencia » : la règle an -> a y posait un ROUGE FAUX (l'un des 4 du banc EWT).
    # Entre deux mots de même nature, « an » devant consonne est un « and » tronqué : orange, et an -> a ne parle plus.
    if (lw == 'an' and w == 'an' and i > 0 and _mot_minuscule(nx_raw) and len(nx_raw) >= 3
            and nx[0] in 'bcdfghjklmnpqrstvwxz' and (adj is None or i in adj)
            and ((ctx_pos(T, i + 1) in _COORD_POS and ctx_pos(T, i - 1) == ctx_pos(T, i + 1))
                 # le tagger se trompe sur les phrases courtes (gentle/PROPN en fin de phrase, clean/VERB) : deux mots que le
                 # LEXIQUE connaît comme adjectifs, sans nom derrière, suffisent.
                 or (is_adj(pv) and is_adj(nx) and ctx_pos(T, i + 2) != 'NOUN'))):
        return 'and', 'ORANGE'
    if (lw == 'an' and (w == 'an' or i == 0)
            and nx_raw.isalpha() and nx_raw == nx_raw.lower() and nx_raw != nx_raw.upper()
            and not nx.startswith('h')
            and vowel_start(nx) is False                     # None (mot hors IPA) => on s'abstient
            and (adj is None or i in adj)):
        return 'a', 'RED'
    # 2) comparatif + then : RED si suivi d'un GN/pronom comparé (bigger then mine) ; sinon un verbe
    #    après = « then » temporel (work harder then rest) -> ORANGE prudent
    if lw == 'then' and (pv in COMPAR or (pv.endswith('er') and is_adj(pv))):
        if nx in THAN_OBJ or (nx and (is_noun(nx) or is_adj(nx)) and not is_verb(nx)):
            return 'than', 'RED'
        return 'than', 'ORANGE'
    # --- familles ajoutées : le discriminateur est STRUCTUREL (mot voisin), donc mesurable à FP=0 ---
    # WHERE/WERE : un pronom sujet ne peut pas être suivi de « where » (« they where happy ») — SAUF si « where »
    # ouvre une vraie subordonnée : sujet + VERBE/AUX derrière (« tell you where it is »). Le tagger dit AUX pour is/are.
    if (lw == 'where' and pv in SUBJ_PRON
            and not (nx in SUBJ_PRON and i + 2 < len(T) and ctx_pos(T, i + 2) in ('VERB', 'AUX'))):
        return 'were', 'RED'
    # WERE/WE'RE : « were » en tête suivi d'un participe présent (« Were going home ») = « We're » ; question inversée exclue.
    if lw == 'were' and i == 0 and nx.endswith('ing') and nx not in SUBJ_PRON and not only_noun(nx):
        return "We're", 'ORANGE'
    # WHO'S/WHOSE : la NATURE du mot suivant tranche (nom pur -> possessif).
    if lw == "who's" and nx and only_noun(nx):
        return 'whose', 'ORANGE'
    # WHOSE/WHO'S : -ing ne suffit pas (« whose king »), le TAGGER dit VERB en contexte.
    if lw == 'whose' and (nx == 'been' or nx == 'gonna' or (nx.endswith('ing') and ctx_pos(T, i+1) == 'VERB')):
        return "who's", 'RED'
    # LEAD/LED : après un auxiliaire du parfait, le PARTICIPE ; borné à « to » (« have lead » peut être le NOM).
    if lw == 'lead' and pv in PERF_AUX and nx == 'to':
        return 'led', 'RED'
    # PASSED/PAST : « I past » n'a aucune lecture correcte ; le pronom sujet est la garde.
    if lw == 'past' and pv in SUBJ_PRON:
        return 'passed', 'RED'
    # TWO/TO : un nombre n'est pas suivi d'un verbe seul (« I want two go ») ; « the two » = pronom ; « Two » capitalisé
    # hors tête = mot de titre ; un gérondif ne suit jamais « to » infinitif (« series two working »).
    if (lw == 'two' and pv not in DET_BEFORE and nx and ctx_pos(T, i+1) == 'VERB'
            and (i == 0 or T[i] == T[i].lower())
            and not nx.endswith('ing')):
        return 'to', 'RED'
    # PARONYMES nom/verbe : la POSITION tranche — un modal/« to » appelle un VERBE, un déterminant un NOM.
    if pv in VERB_SLOT:
        if lw == 'advice': return 'advise', 'RED'
        if lw == 'breath': return 'breathe', 'RED'
        if lw == 'chose': return 'choose', 'RED'
        if lw == 'cloth': return 'clothe', 'RED'
        if lw == 'loath': return 'loathe', 'RED'
        if lw == 'device': return 'devise', 'RED'
        if lw == 'prophecy': return 'prophesy', 'RED'
        if lw == 'effect' and nx in DET_AFTER: return 'affect', 'ORANGE'   # « to effect the change » existe : ambigu -> orange
    if pv in NOUN_SLOT:
        if lw == 'advise': return 'advice', 'RED'
        if lw == 'breathe': return 'breath', 'RED'
        if lw == 'clothe': return 'cloth', 'RED'
        if lw == 'devise': return 'device', 'RED'
        if lw == 'prophesy': return 'prophecy', 'RED'
        if lw == 'affect': return 'effect', 'ORANGE'                        # « a flat affect » existe (psychologie)
    # ACCEPT/EXCEPT : « except » est une préposition, pas le verbe d'un pronom sujet.
    if lw == 'except' and pv in SUBJ_PRON:
        return 'accept', 'RED'
    # ACCORD SUJET-VERBE 3sg : seulement si le pronom est vraiment SUJET (pas après un auxiliaire : « Does she have »),
    # et pas au subjonctif (« if he were »).
    pv2 = T[i-2].lower() if i > 1 else ''
    if pv in SUBJ_3SG and pv2 not in AUX_BEFORE:
        if lw == 'have': return 'has', 'RED'
        if lw == "don't": return "doesn't", 'ORANGE'                         # « he don't » est attesté à l'oral/en dialecte
        if lw == 'were' and pv2 not in SUBJUNCTIVE: return 'was', 'ORANGE'
    # 3) their / there / they're  (direction possessive = ORANGE : nom PUR après = candidat possessif)
    if lw == 'their' and nx in BE_AFTER:
        return 'there', 'RED'                              # « their is/are » -> there (possessif+copule impossible)
    if lw == 'there' and nx and (only_noun(nx) or _next_is_noun_ctx(T, i)):
        return 'their', 'ORANGE'                           # « there problem/house » -> their (POS contextuel)
    if lw == "they're" and nx and only_noun(nx):
        return 'their', 'ORANGE'
    # 4) your / you're
    if lw == 'your':
        if nx in YOURE_RED: return "you're", 'RED'
        if nx in YOURE_ORANGE or (nx and is_verb(nx) and not is_noun(nx)): return "you're", 'ORANGE'
    if lw == "you're" and nx and only_noun(nx):
        return 'your', 'ORANGE'                            # « you're car » -> your
    # 5) its / it's
    if lw == 'its':
        if nx in ITS_RED: return "it's", 'RED'             # « its a/an/the/been » -> it's (impossible en possessif)
        if nx in ITS_ORANGE: return "it's", 'ORANGE'
    if lw == "it's" and nx and only_noun(nx) and nx not in BE_AFTER:
        return 'its', 'ORANGE'                             # « it's tail » -> its
    # 6) to / too  (ORANGE : « to » intensif vs préposition = ambigu)
    if lw == 'to' and nx in ('much', 'many') and pv not in TO_MUCH_PREV_STOP:
        return 'too', 'ORANGE'
    # 6b) « to <adj gradable> to/for » = construction « too … to/for » (RED, FP≈0)
    if lw == 'to' and nx in DEGREE_ADJ and nx2 in ('to', 'for') and pv not in TO_INF_GUARD:
        return 'too', 'RED'
    # 7) « weather or not » -> « whether or not » (RED : jamais correct)
    if lw == 'weather' and nx == 'or' and nx2 == 'not':
        return 'whether', 'RED'
    # 8) accord sujet-verbe (RED, FP=0 en anglais standard)
    if lw == "don't" and pv in SUBJ_SING3:  return "doesn't", 'RED'   # he/she/it don't -> doesn't (atteint seulement après un auxiliaire, cf. SUBJ_3SG)
    if lw == "doesn't" and pv in SUBJ_NON3: return "don't", 'RED'     # I/you/we/they doesn't -> don't
    # you/we/they was -> were — SAUF pronom capitalisé hors tête (mot de TITRE : « Love You was released ») et pronom
    # COMPLÉMENT d'une préposition (« part of you was »).
    if (lw == 'was' and pv in WAS_WRONG
            and (i - 1 == 0 or T[i-1] == T[i-1].lower())
            and not (i >= 2 and T[i-2].lower() in _PREP_AVANT)):
        return 'were', 'RED'
    # 9) loose (adj) mis pour le verbe lose : trigger modal/to devant, hors idiome (be/cut/let… loose) -> ORANGE
    if lw == 'loose' and pv in LOOSE_TRIG and (i < 2 or T[i-2].lower() not in LOOSE_IDIOM):
        return 'lose', 'ORANGE'
    # ---- fautes de vrai mot, par occasions comptées (cf. les listes fermées plus haut ; MÊME ORDRE que le JS) ----
    colle = (adj is None or i in adj)
    # « the are located », « the don't do », « the will go » -> they. Banc de tir : 5 justes, 0 tir édité, 0 tir web.
    if lw == 'the' and colle and nx in THEY_AUX:
        return 'they', 'ORANGE'
    if (lw == 'the' and colle and nx in THEY_MODAL and i + 2 < len(T) and _mot_minuscule(T[i + 2])
            and nx2 not in ('of', 'to', 'power') and ctx_pos(T, i + 2) == 'VERB'):
        return 'they', 'ORANGE'
    # « thanks for you cooperation », « hope you day is going well » -> your. 3 justes, 0 tir édité, 0 tir web.
    # (« verbe + you + nom nu » a été MESURÉ et écarté : « wishing you prosperity », « hearing you scream » sur texte édité.)
    if (lw == 'you' and colle and _mot_minuscule(nx_raw) and nx not in YOU_APPOS and ctx_pos(T, i + 1) == 'NOUN'
            and (pv in PREP_YOU or (nx2 in YOUR_IS and (i == 0 or pv in YOUR_INTRO)))):
        return 'your', 'ORANGE'
    # « sink to far into », « that was to bad she » -> too. Les GAMMES (« fair to good ») sont écartées par l'adjectif
    # d'avant, les infinitifs (« to fast », « to close ») par la liste fermée.
    if (lw == 'to' and colle and nx in TOO_ADJ and pv not in TOO_PREV_STOP
            and not (ctx_pos(T, i - 1) == 'ADJ' and pv != 'little')
            and (ctx_pos(T, i + 2) or '') not in ('NOUN', 'ADJ', 'PROPN', 'NUM')
            and not any(x.lower() in ('from', 'between') for x in T[max(0, i - 5):i])):
        return 'too', 'ORANGE'
    # « I never new this », « she new what she was doing » -> knew. 2 justes, 0 tir.
    if lw == 'new' and pv in KNEW_PREV and nx in KNEW_NEXT:
        return 'knew', 'ORANGE'
    # « everyone has there own way » -> their. 2 justes, 0 tir.
    if lw == 'there' and nx == 'own':
        return 'their', 'ORANGE'
    # « leave it their. » : « their » veut un nom derrière lui ; en fin de phrase c'est « there ». 1 juste, 0 tir.
    if lw == 'their' and i == len(T) - 1 and i > 0:
        return 'there', 'ORANGE'
    # « she is and excellent doctor », « watching and old film » -> an. 2 justes, 0 tir.
    if (lw == 'and' and pv in AND_AN_PREV and _mot_minuscule(nx_raw) and len(nx_raw) >= 3 and nx[0] in 'aeio'
            and not nx.endswith('s') and (ctx_pos(T, i - 1) or '') in ('AUX', 'VERB')
            and (ctx_pos(T, i + 1) or '') in ('ADJ', 'NOUN')):
        return 'an', 'ORANGE'
    # 10) verbe irrégulier RÉGULARISÉ (runned->ran, goed->went, teached->taught) — RED FP=0 (forme nonstandard)
    if lw in VERBMORPH:
        past, pp = VERBMORPH[lw]
        return (pp if pv in PP_AUX else past), 'RED'
    return None, None

def correct(text, reds_only=True):
    T = _tok(text); adj = adj_mask(text); out = []
    for i, w in enumerate(T):
        s, lv = decide(T, i, adj)
        out.append((w, s, lv))
    return out

# ---------- fautes plantées (recall) ----------
CASES = [
    # fautes de vrai mot, par occasions comptées (17/09/2026) — phrases inventées, mêmes cas que corrector_en.js
    ("I think the are ready now", 2, 'they', 'ORANGE'),
    ("We waited but the don't answer", 3, 'they', 'ORANGE'),
    ("This way the will learn faster", 2, 'they', 'ORANGE'),
    ("Thanks for you patience today", 2, 'your', 'ORANGE'),
    ("I hope you day is going well", 2, 'your', 'ORANGE'),
    ("He went a little to far that time", 4, 'too', 'ORANGE'),
    ("I never new that about him", 2, 'knew', 'ORANGE'),
    ("Everyone has there own way", 2, 'their', 'ORANGE'),
    ("Just leave it their", 3, 'there', 'ORANGE'),
    ("She is very kind an gentle", 4, 'and', 'ORANGE'),
    ("He was tired an hungry after work", 3, 'and', 'ORANGE'),
    ("She is and excellent doctor", 2, 'an', 'ORANGE'),
    ("She found an gentle giant", 2, 'a', 'RED'),          # « an » + adjectif + NOM reste l'article : an -> a
    ("I could of done it", 2, 'have', 'RED'),
    ("You should of asked", 2, 'have', 'RED'),
    ("It is bigger then mine", 3, 'than', 'RED'),
    ("She is more then happy", 3, 'than', 'RED'),
    ("Their is a problem", 0, 'there', 'RED'),
    ("Their are many people", 0, 'there', 'RED'),
    ("its a good idea", 0, "it's", 'RED'),
    ("its been a while", 0, "it's", 'RED'),
    ("your gonna love it", 0, "you're", 'RED'),
    ("your welcome to stay", 0, "you're", 'ORANGE'),
    ("your going to love it", 0, "you're", 'ORANGE'),
    ("its not fair", 0, "it's", 'ORANGE'),
    ("there car is red", 0, 'their', 'ORANGE'),
    ("it's car is fast", 0, 'its', 'ORANGE'),
    ("I saw a apple", 2, 'an', 'RED'),
    ("It is a honest mistake", 2, 'an', 'RED'),
    ("You are to tired to walk", 2, 'too', 'RED'),
    ("It is to big for me", 2, 'too', 'RED'),
    ("We are to close to home", 2, 'too', 'RED'),
    ("I do not know weather or not to go", 4, 'whether', 'RED'),
    ("He don't like it", 1, "doesn't", 'ORANGE'),          # ORANGE comme le JS : « he don't » est attesté à l'oral/en dialecte
    ("She don't know", 1, "doesn't", 'ORANGE'),
    ("I doesn't care", 1, "don't", 'RED'),
    ("They was late", 1, 'were', 'RED'),
    ("You was right", 1, 'were', 'RED'),
    ("Don't loose your keys", 1, 'lose', 'ORANGE'),
    ("You will loose the game", 2, 'lose', 'ORANGE'),
    ("He runned home fast", 1, 'ran', 'RED'),
    ("She goed to school", 1, 'went', 'RED'),
    ("I have runned all day", 2, 'run', 'RED'),
    ("They teached us well", 1, 'taught', 'RED'),
    ("We buyed a new car", 1, 'bought', 'RED'),
]
# NB : la direction possessive ORANGE (there/you're/it's + NOM → their/your/its) est bridée par
# `only_noun` : Wiktionary EN sur-verbifie (house/engine/phone/sister sont tous tagués VERB), donc
# peu de noms sont « purs ». Amélioration future = POS dominante par FRÉQUENCE, ou liste de noms
# concrets curée. Le canal RED (FP=0) reste le levier principal ; l'ORANGE est un bonus prudent.

def main():
    print('=== HOMOPHONE EN — %d mots POS ===' % len(POS))
    hitR = hitO = miss = 0
    for text, idx, exp, lvl in CASES:
        T = _tok(text)
        s, lv = decide(T, idx)
        ok = (s == exp)
        if ok and lv == 'RED': hitR += 1
        elif ok and lv == 'ORANGE': hitO += 1
        else:
            miss += 1; print('  MISS  %-26s [%s] -> %s/%s (attendu %s/%s)' % (text, T[idx], s, lv, exp, lvl))
    print('recall %d/%d (RED %d + ORANGE %d)' % (hitR+hitO, len(CASES), hitR, hitO))
    red_pud, red_fp = fp_scale()
    if '--check' in sys.argv:                                # garde CI : recall CASES complet + rouges sur texte correct
        # ⚠️ 17/09/2026 (lot 1 de CHANTIER_ANGLAIS §4) : « red_fp is None or … » laissait la garde FP se DÉSACTIVER dès
        # qu'EWT (corpus local) manquait — c'est-à-dire toujours en CI. Elle tient désormais sur PUD committé : 0 rouge.
        ok = (hitR + hitO == len(CASES)) and red_pud == 0 and (red_fp is None or red_fp <= 55)
        print('[check] %s — recall %d/%d, RED sur PUD committé %s (max 0), RED-EWT local %s (max 55)'
              % ('OK' if ok else 'ÉCHEC', hitR+hitO, len(CASES), red_pud, red_fp))
        if not ok: sys.exit(1)

def fp_scale():
    """Rouges sur texte CORRECT : (PUD committé, EWT local ou None). PUD = dictee/parity_en_corpus.txt, 1 000 phrases
    d'UD English-PUD (CC BY-SA 3.0, texte édité) — toujours là, donc la garde ne peut plus se désactiver."""
    pud = _fp_mesure(os.path.join(HERE, 'parity_en_corpus.txt'), 'PUD committé')
    ewt = os.path.join(HERE, '..', 'data_local', 'en_ewt-ud-train.conllu')
    if not os.path.exists(ewt):
        print('[fp] EWT local absent — la garde tient sur PUD committé'); return pud, None
    return pud, _fp_mesure(ewt, 'EWT local')


def _fp_mesure(path, nom):
    red = collections.Counter(); orange = 0; sents = 0; redex = []
    conllu = path.endswith('.conllu')
    for l in open(path, encoding='utf-8'):
        if conllu:
            if not l.startswith('# text = '): continue
            _txt = l.split('=', 1)[1]
        else:
            if not l.strip() or l.startswith('#'): continue
            _txt = l
        sents += 1
        T = _tok(_txt); adj = adj_mask(_txt)
        for i in range(len(T)):
            s, lv = decide(T, i, adj)
            if lv == 'RED':
                red[(T[i].lower(), s)] += 1
                if len(redex) < 20: redex.append('%s→%s' % (T[i], s))
            elif lv == 'ORANGE':
                orange += 1
    tot = sum(red.values())
    if sents < 900 and nom.startswith('PUD'): raise RuntimeError('corpus PUD committé tronqué : %d phrases' % sents)
    print('\n=== FP SCALE (%s : %d phrases) ===' % (nom, sents))
    print('  RED (rouge) sur texte correct : %d  ← doit tendre vers 0 (FP)' % tot)
    if red: print('   détail RED :', red.most_common(12))
    print('  ORANGE (vigilance) : %d (%.2f/phrase)' % (orange, orange/max(sents,1)))
    return tot

if __name__ == '__main__':
    main()
