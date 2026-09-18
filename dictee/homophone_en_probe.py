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
# ---- LOT 2 (18/09/2026) — miroir exact des constantes de corrector_en.js (mêmes listes, nées du banc de tir) ----
def _S(t): return set(t.split(' '))
MASS_NOUN = _S('time money credit luck access information advice permission notice trouble peace joy hell company room space food water coffee dinner lunch breakfast help hope control power energy support feedback pleasure comfort shelter insurance coverage warning cover cash wine beer tea milk bread sleep rest work business service stuff damage harm grief pain rain snow sun air mail news homework respect love attention freedom justice strength courage confidence faith patience wisdom experience chance pause mercy grace hurt trust care thanks happiness health safety heat light shade cheer wealth fame glory honor honour proof evidence data input output leverage guidance direction directions instructions instruction assistance aid relief hassle stress fun entertainment music art culture science research education training practice exercise medicine therapy treatment surgery pizza cake candy fruit meat fish chicken beef rice pasta soup salad cheese butter sugar salt pepper oil gas fuel electricity internet wifi tv television radio email post paper ink paint glue tape stock inventory equipment furniture luggage baggage clothing footwear jewelry jewellery makeup hair skin blood sweat tears ice fire smoke dust dirt sand mud grass wood metal plastic glass cloth fabric leather cotton wool silk gold silver change debt interest profit revenue income tax taxes welfare unemployment employment housing transport transportation traffic parking entry admission membership ownership custody leave vacation overtime')
DITRANS = _S("give gave giving gives given tell told telling tells send sent sending sends show showed shown showing shows offer offered offering offers wish wished wishing wishes cost costs costing owe owed owes bring brought bringing brings buy bought buying buys get got getting gets gotten make made making makes call called calling calls teach taught teaching teaches save saved saving saves pay paid paying pays lend lent lending grant granted hand handed pass passed passing promise promised ask asked asking asks want wants wanted wanting need needs needed needing let lets see saw seen seeing sees help helped helping helps hear heard hearing hears watch watched watching have has had having thank thanks thanked keep kept keeps keeping find found finds finding leave left leaves leaving allow allowed allows deny denied guarantee guaranteed spare spared fix fixed cook cooked pour poured build built write wrote written read reads reading sing sang play played cause caused charge charged fine fined bear bore consider considered name named elect elected appoint appointed declare declared drive drove feed fed serve served earn earned win won bid bade refuse refused envy envied forgive forgave forgiven do does did doing done mean means meant order ordered book booked reserve reserved rent rented sell sold selling sells throw threw thrown toss tossed slip slipped mail mailed text texted email emailed ship shipped wire wired forward forwarded quote quoted bill billed award awarded assign assigned issue issued advise advised remind reminded inform informed notify notified warn warned convince convinced persuade persuaded expect expected suppose supposed assume assumed believe believed imagine imagined guess guessed reckon reckoned doubt doubted fear feared hope hoped bet betting wager wagered")
_AUX_INV = re.compile(r"^(?:do|does|did|don't|doesn't|didn't|can|could|will|would|should|shall|may|might|must|can't|won't|wouldn't|couldn't|shouldn't|are|were|is|was|am|be|been|being)$")
_WH = re.compile(r'^(?:why|how|what|when|where|who)$')
YOUR_AFTER_OK = _S('is was has will would can could should')
DET_SET = _S('the a an my your his her their our its this that these those some any')
OBJ_SET = _S('me him her us them you it')
WHERE_PREV = _S('know knew knows knowing wonder wondering wondered see saw tell told ask asked asking find found remember forget forgot understand explain sure idea matter care about exactly')
WHERE_NEXT = _S('i you we they he she it this that')
PARTICLE_OFF = _S('sent turned dropped picked shut logged signed kicked switched paid ripped wiped cooled knocked broke broken finished pulled tore torn scraped sealed killed laughed shook shaken brushed fought warded staved leveled fended dozed nodded wore worn showed shown backed put ran went fell laid called sold headed dusted polished chopped sawed sliced peeled rubbed shaved hopped jumped stepped walked drove flew rode dashed stormed marched wandered drifted sped raced run')
BE_RUN = _S('be been being is are was were')
THEN_PREV = _S("i you we they he she it and but so will would can could should must may might shall is are was were be been do does did has have had didn't don't doesn't isn't wasn't won't can't couldn't wouldn't shouldn't")
_COMPAR_RE = re.compile(r'(?:er|more|less|rather|other|fewer)$')
AFFECTED_OBJ = _S('me him her us them you my your his its their our')
AFFECTED_PREV = _S("was were is are been being be get got gets getting am i'm you're we're they're he's she's it's isn't aren't wasn't weren't badly greatly deeply directly negatively adversely severely")
BE_DOM = _S("is are was were be been being am isn't aren't it's")
DOMINANT_ADV = _S('incomplete incompletely also very more most less usually completely fully')
LOSER_PREV = _S('a total complete sore such real big')
COLLEGE_PREV = _S('to at in from before after during through into for finish finished finishing start started starting attend attended attending graduate graduated go going went')
COLLEGE_NEXT = _S('student students degree degrees kids life years education football basketball campus town tuition graduate graduates professor courses course class classes application applications fund essay essays dorm dorms roommate roommates freshman sophomore junior senior admission admissions loan loans')
OUR_PREV = _S('for behind of in at on from about near by into onto over under with to through during after before around beside')
OUR_STOP = _S('there here loud side west east north south back front patient patients house reach right door doors way of town state country office work school date box tray group crowd sourcing breaks break line lines field fields bounds bound building buildings put standing stand come coming')
WITHOUT_NEXT = _S('a the any my your his her their our it them this that these those me him us you having being even so much more too')
THEM_PREV = _S('let tell told give gave show showed ask asked help helped send sent bring brought join joined contact contacted thank thanked love hate meet met follow followed keep kept leave left take took allow allowed put get got make made see saw want wanted need needed call called visit visited pay paid teach taught watch watched hear heard')
THEM_NEXT = _S('know to the a that what how about in on out up all both off down away back go come be do have if when where why because with for from at by as home there here more some something anything nothing everything it this these those my your his her our their its')
ABROAD_PREV = _S('study studying studied studies semester year years program programs programme trip trips travel traveling travelling traveled travelled travels work working worked works move moving moved job jobs experience experiences students student teaching teach taught vacation holiday holidays')
ABROAD_STOP = _S('the a an this that his her its their our my your one')
HEAR_MODAL = _S("can could will would should might must may can't couldn't won't wouldn't didn't don't doesn't ll 'll")
HEAR_OBJ = _S('what that about anything something nothing everything more people voices music noise sounds sound')
HEAR_TO = _S('about you me him her them us it what that this anything something nothing everything more back')
THEIR_ADJ_STOP = _S('many few enough more less any no some other such several most much little own same next last first')
THEIR_NOUN_STOP = _S('there here people time times day days year years way ways thing things place places one ones lot lots money problem problems room rooms later today tomorrow yesterday now then too also again anyway though forever tonight soon already once twice alone ahead along apart aside away back behind below down forward inside outside upstairs downstairs overseas abroad home ago yet still anymore somewhere anywhere everywhere nowhere sometimes often always never ever instead otherwise indeed however therefore thus hence perhaps maybe please')
_ADV_RE = re.compile(r'(?:ly|wards?)$')
PARONYM = {'chose': 'choose', 'advice': 'advise', 'breath': 'breathe', 'cloth': 'clothe', 'device': 'devise'}
PARONYM_ADV = _S('then also just really never always still probably definitely simply')
VERB_SLOT_MODAL = _S("to will 'll would can could may might must shall should")
EVER_PP = _S('been had seen heard wanted done tried used traveled travelled visited felt met known wondered considered imagined experienced needed noticed tasted gotten got taken played watched worked lived loved eaten owned written driven dreamed witnessed encountered gone be see hear want do try travel feel know wonder consider imagine make get take find watch live eat own write witness encounter')
USED_PREV = _S("am is are was were be been being get got gets getting i'm you're we're they're he's she's it's isn't aren't wasn't weren't")
USED_STOP = _S('do does did can could will would what which that who how why where when you i we they he she it to')
SUPPOSED_PREV = _S("am is are was were be been being i'm you're we're they're he's she's it's isn't aren't wasn't weren't m re s")
PLEASED_PREV = _S("am is are was were be been being very more so really quite extremely not i'm you're we're they're he's she's it's")
PEDAL_PREV = _S('new left right foot gas brake clutch bike bicycle piano effects guitar broken')
BORDER_PREV = _S('southern northern eastern western mexican canadian us cross crossing crossed across the')
BORDER_PREV_STRONG = _S('southern northern eastern western mexican canadian cross crossing crossed')
BORDER_NEXT_WIDE = _S('with between crossing crossings patrol control town towns guard guards area areas region regions wall fence security checkpoint of into to and')
BORDER_NEXT = _S('with between crossing crossings patrol control guard guards wall fence checkpoint')
LATTER_PREV = _S('chose choose prefer preferred prefers like liked pick picked take took want wanted recommend recommended went go')
THOROUGH_PREV = _S('a an very more so really quite pretty extremely super most less not being is was were are be been')
THOROUGH_NEXT = _S('job jobs cleaning check checks inspection examination exam review investigation search understanding knowledge analysis look clean research explanation study testing test report assessment evaluation reading wash checkup work manner way person')
ACCEPTED_PREV = _S("was were been being get got am is are i'm you're we're they're he's she's it's")
ACCEPTED_NEXT = _S('to into at by for as')
WHILE_PREV = _S('a short long little')
WEIGHT_PREV = _S('your my his her their our the body lose losing lost gain gaining gained birth extra excess more much some ideal healthy')
BEING_PREV = _S("is are was were be am i'm you're we're they're isn't aren't wasn't weren't")
BEING_ADV = _S('currently still now also just being')
TO_VERB = _S('die go get make see find buy take give eat come know tell say think put keep let help try ask become leave mean meet pay sit speak stand write hear learn lose send bring hold understand watch follow create allow add spend grow walk win offer remember love consider appear wait serve expect build stay fall reach kill remain suggest raise pass sell require report decide pull use want describe explain avoid prevent reduce receive provide include continue achieve begin finish feel enjoy visit choose pick drink wear drive fly sing read teach bite catch fight forget forgive hide shake throw wake')
def _pluriel(n):
    if re.search(r'(s|x|z|ch|sh)$', n): return n + 'es'
    if re.search(r'[^aeiou]y$', n): return n[:-1] + 'ies'
    return n + 's'
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
        # 17/09/2026 (miroir JS) — devant un PRONOM, ou un adverbe suivi d'un VERBE, « a » n'ouvre aucun groupe nominal
        # (« rabbits a easily escape » = can ; « have a everything settled » = a en trop) : orange, pas rouge.
        p1, p2 = ctx_pos(T, i + 1), ctx_pos(T, i + 2) or ''
        return 'an', ('ORANGE' if (p1 == 'PRON' or (p1 == 'ADV' and p2 in ('VERB', 'AUX'))) else 'RED')
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
    # ---- LOT 2 (18/09/2026) : conditions du banc de tir, MÊME ORDRE que corrector_en.js ----
    colle_prev = i > 0 and (adj is None or (i - 1) in adj)
    pv_raw = T[i-1] if i > 0 else ''
    pos1, pos2 = (ctx_pos(T, i + 1) or ''), (ctx_pos(T, i + 2) or '')
    nx2_raw = T[i+2] if i + 2 < len(T) else ''
    # « cancel you ticket », « place you hand in the cage » -> your
    if (lw == 'you' and colle and colle_prev and ctx_pos(T, i - 1) == 'VERB' and _mot_minuscule(pv_raw) and pv not in DITRANS
            and not _AUX_INV.match(pv) and not _WH.match(pv2) and _mot_minuscule(nx_raw) and pos1 == 'NOUN' and not nx.endswith('s')
            and nx not in MASS_NOUN and nx not in YOU_APPOS and len(nx) >= 3 and _pluriel(nx) in POS
            and not (pos2 in ('VERB', 'AUX') and nx2 not in YOUR_AFTER_OK)):
        return 'your', 'ORANGE'
    # « the hotel is you choice » -> your
    if (lw == 'you' and colle and colle_prev and pv in ('is', 'was') and _mot_minuscule(nx_raw) and pos1 == 'NOUN'
            and not nx.endswith('s') and nx not in MASS_NOUN and nx not in YOU_APPOS and pos2 not in ('VERB', 'AUX', 'ADJ', 'ADV', 'PART')):
        return 'your', 'ORANGE'
    # « wanted to know were we stand » -> where
    if lw == 'were' and colle and colle_prev and pv in WHERE_PREV and nx in WHERE_NEXT:
        return 'where', 'ORANGE'
    # « can be run of those cylinders », « turned of the light » -> off
    if (lw == 'of' and colle_prev and _mot_minuscule(pv_raw) and pv in PARTICLE_OFF and (pv != 'run' or pv2 in BE_RUN)
            and (nx in DET_SET or nx in OBJ_SET or nx == 'if' or pos1 == 'NOUN' or i == len(T) - 1)):
        return 'off', 'ORANGE'
    # « the people would than rally », « Than the troops… » -> then
    if lw == 'than':
        if i == 0:
            if T[i] == 'Than' and len(T) > 2: return 'then', 'ORANGE'
        elif colle_prev and pv in THEN_PREV and not any(_COMPAR_RE.search(x.lower()) for x in T[max(0, i - 4):i - 1]):
            return 'then', 'ORANGE'
    # « this piece effected me », « guests were effected » -> affected
    if lw == 'effected' and ((colle and nx in AFFECTED_OBJ) or (colle_prev and pv in AFFECTED_PREV)):
        return 'affected', 'ORANGE'
    # « the gene is dominate » -> dominant
    if lw == 'dominate' and colle_prev and (pv in BE_DOM or (pv in DOMINANT_ADV and pv2 in BE_DOM)):
        return 'dominant', 'ORANGE'
    # « loosing my trust » -> losing ; « feel a looser » -> loser
    if lw == 'loosing': return 'losing', 'ORANGE'
    if lw == 'looser' and i > 0 and pv in LOSER_PREV and pos1 not in ('NOUN', 'PROPN', 'ADJ'):
        return 'loser', 'ORANGE'
    # « a year before collage », « collage students » -> college
    if lw in ('collage', 'collages') and ((colle_prev and pv in COLLEGE_PREV) or (colle and nx in COLLEGE_NEXT)):
        return ('college' if lw == 'collage' else 'colleges'), 'ORANGE'
    # « for out family trip » -> our
    if (lw == 'out' and colle and colle_prev and pv in OUR_PREV and _mot_minuscule(nx_raw) and pos1 == 'NOUN'
            and nx not in OUR_STOP and nx2 != 'of'):
        return 'our', 'ORANGE'
    # « with out a job » -> without (RED)
    if lw == 'with' and colle and nx == 'out' and (adj is None or (i + 1) in adj) and nx2 in WITHOUT_NEXT:
        return 'without', 'RED'
    # « to let then know » -> them ; « and them you can » -> then
    if lw == 'then' and colle and colle_prev and pv in THEM_PREV and nx in THEM_NEXT:
        return 'them', 'ORANGE'
    if lw == 'them' and colle and colle_prev and pv == 'and' and nx in SUBJ_PRON and pos2 in ('AUX', 'VERB'):
        return 'then', 'ORANGE'
    # « on the calender » -> calendar
    if lw in ('calender', 'calenders'):
        return ('calendar' if lw == 'calender' else 'calendars'), 'ORANGE'
    # « studying aboard » -> abroad
    if lw == 'aboard' and colle_prev and pv in ABROAD_PREV and nx not in ABROAD_STOP:
        return 'abroad', 'ORANGE'
    # « I could here my neighbors » -> hear ; « to here about » -> hear
    if lw == 'here' and colle_prev:
        if pv in HEAR_MODAL and colle and (nx in DET_SET or nx in OBJ_SET or nx in HEAR_OBJ): return 'hear', 'ORANGE'
        if pv == 'to' and colle and nx in HEAR_TO: return 'hear', 'ORANGE'
    # « announced there new console » -> their : there + ADJ + nom
    if (lw == 'there' and i > 0 and colle and (adj is None or (i + 1) in adj) and pv not in EXIST_BEFORE and pv not in PLACE_BEFORE
            and ctx_pos(T, i - 1) != 'NOUN' and pos1 == 'ADJ' and _mot_minuscule(nx_raw) and nx not in THEIR_ADJ_STOP
            and nx2 not in TIME_NOUNS and _mot_minuscule(nx2_raw) and pos2 == 'NOUN' and nx2 not in THEIR_NOUN_STOP
            and not _ADV_RE.search(nx2)):
        return 'their', 'ORANGE'
    # « they may then chose to » -> choose : paronyme après modal + adverbe
    if lw in PARONYM and i >= 2 and colle_prev and (adj is None or (i - 2) in adj) and pv in PARONYM_ADV and pv2 in VERB_SLOT_MODAL:
        return PARONYM[lw], 'ORANGE'
    # « have you every traveled » -> ever
    if lw == 'every' and colle and nx in EVER_PP and pos2 not in ('NOUN', 'PROPN'):
        return 'ever', 'ORANGE'
    # « got use to », « I use to think » -> used ; « I m suppose to » -> supposed ; « more please with » -> pleased
    if lw == 'use' and colle and nx == 'to' and colle_prev:
        if pv in USED_PREV: return 'used', 'ORANGE'
        if pv in SUBJ_PRON and pv2 not in USED_STOP and pos2 == 'VERB' and not nx2.endswith('ing'): return 'used', 'ORANGE'
    if lw == 'suppose' and colle and colle_prev and nx == 'to' and pv in SUPPOSED_PREV:
        return 'supposed', 'ORANGE'
    if lw == 'please' and colle and colle_prev and nx == 'with' and pv in PLEASED_PREV:
        return 'pleased', 'ORANGE'
    # petites paires : peddle/pedal, boarder/border, later/latter, through/thorough, excepted/accepted, wile/while, wight/weight, old fashion
    if lw in ('peddle', 'peddles') and colle_prev and (pv in DET_SET or pv in PEDAL_PREV):
        return ('pedal' if lw == 'peddle' else 'pedals'), 'ORANGE'
    if lw in ('boarder', 'boarders') and ((colle_prev and pv in BORDER_PREV and ((colle and nx in BORDER_NEXT_WIDE) or pv in BORDER_PREV_STRONG))
                                          or (colle and nx in BORDER_NEXT)):
        return ('border' if lw == 'boarder' else 'borders'), 'ORANGE'
    if (lw == 'later' and i > 1 and pv == 'the' and colle_prev and (adj is None or (i - 2) in adj) and pv2 in LATTER_PREV
            and pos1 not in ('NOUN', 'PROPN', 'ADJ')):
        return 'latter', 'ORANGE'
    if lw == 'through' and colle and colle_prev and pv in THOROUGH_PREV and nx in THOROUGH_NEXT:
        return 'thorough', 'ORANGE'
    if lw == 'excepted' and colle and colle_prev and pv in ACCEPTED_PREV and nx in ACCEPTED_NEXT:
        return 'accepted', 'ORANGE'
    if lw == 'wile' and colle_prev and pv in WHILE_PREV: return 'while', 'ORANGE'
    if lw == 'wight' and colle_prev and pv in WEIGHT_PREV: return 'weight', 'ORANGE'
    if lw == 'fashion' and colle_prev and pv == 'old' and pos1 not in ('NOUN', 'PROPN'): return 'fashioned', 'ORANGE'
    # « are currently been gathered » -> being
    if lw == 'been' and colle_prev and (pv in BEING_PREV or (pv in BEING_ADV and pv2 in BEING_PREV)):
        return 'being', 'ORANGE'
    # « shall read as follow. » -> follows
    if lw == 'follow' and pv == 'as' and (i == len(T) - 1 or not colle):
        return 'follows', 'ORANGE'
    # « they are too die for » -> to
    if lw == 'too' and colle and nx in TO_VERB:
        return 'to', 'ORANGE'
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
    # a -> an : devant un pronom ou un adverbe + verbe, « a » n'est pas un article -> orange (miroir JS)
    ("The rabbits a easily escape the pen", 2, 'an', 'ORANGE'),
    ("I already have a everything I need", 3, 'an', 'ORANGE'),
    ("She ate a apple today", 2, 'an', 'RED'),
    # LOT 2 (18/09/2026) — mêmes cas que corrector_en.js
    ("Please cancel you ticket before noon", 2, 'your', 'ORANGE'),
    ("The hotel is you choice tonight", 3, 'your', 'ORANGE'),
    ("I want to know were we stand", 4, 'where', 'ORANGE'),
    ("He turned of the light and left", 2, 'off', 'ORANGE'),
    ("The crowd would than rally again", 3, 'then', 'ORANGE'),
    ("Than the troops moved on", 0, 'then', 'ORANGE'),
    ("This news effected me deeply", 2, 'affected', 'ORANGE'),
    ("Only the guests were effected", 4, 'affected', 'ORANGE'),
    ("The brown gene is dominate here", 4, 'dominant', 'ORANGE'),
    ("We kept loosing the ball", 2, 'losing', 'ORANGE'),
    ("Nobody wants to feel a looser", 5, 'loser', 'ORANGE'),
    ("He worked a year before collage", 5, 'college', 'ORANGE'),
    ("We booked flights for out family trip", 4, 'our', 'ORANGE'),
    ("She left with out a word", 2, 'without', 'RED'),
    ("Call to let then know tonight", 3, 'them', 'ORANGE'),
    ("Rest first and them you can run", 3, 'then', 'ORANGE'),
    ("Put it on the calender now", 4, 'calendar', 'ORANGE'),
    ("She spent a year studying aboard", 5, 'abroad', 'ORANGE'),
    ("I could here my neighbors talking", 2, 'hear', 'ORANGE'),
    ("They announced there new console yesterday", 2, 'their', 'ORANGE'),
    ("You may then chose to leave", 3, 'choose', 'ORANGE'),
    ("Have you every traveled by train", 2, 'ever', 'ORANGE'),
    ("We got use to the noise", 2, 'used', 'ORANGE'),
    ("I use to think so", 1, 'used', 'ORANGE'),
    ("I m suppose to attend today", 2, 'supposed', 'ORANGE'),
    ("We were please with the service", 2, 'pleased', 'ORANGE'),
    ("The left peddle broke yesterday", 2, 'pedal', 'ORANGE'),
    ("They live south of the boarder with Mexico", 5, 'border', 'ORANGE'),
    ("I chose the later but regretted it", 3, 'latter', 'ORANGE'),
    ("They did a very through job", 4, 'thorough', 'ORANGE'),
    ("She was excepted to medical school", 2, 'accepted', 'ORANGE'),
    ("Wait here for a wile", 4, 'while', 'ORANGE'),
    ("Watch your wight carefully", 2, 'weight', 'ORANGE'),
    ("This camera is old fashion", 4, 'fashioned', 'ORANGE'),
    ("Reviews are currently been gathered", 3, 'being', 'ORANGE'),
    ("The rules shall read as follow", 5, 'follows', 'ORANGE'),
    ("These fries are too die for", 3, 'to', 'ORANGE'),
    ("I could of done it", 2, 'have', 'RED'),
    ("You should of asked", 2, 'have', 'RED'),
    ("It is bigger then mine", 3, 'than', 'RED'),
    ("She is more then happy", 3, 'than', 'ORANGE'),      # attendu RED jusqu'au 17/09/2026 — jamais comparé ; les deux moteurs rendent ORANGE (then + adjectif : pas de GN comparé derrière)
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
        # ⚠️ 17/09/2026 : le NIVEAU attendu fait partie du cas. Avant, seul le mot proposé était comparé — une mutation qui
        # remettait en ROUGE une suggestion voulue ORANGE passait ce --check (elle ne tombait que par la parité).
        ok = (s == exp and lv == lvl)
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
