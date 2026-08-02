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
# morphologie verbale irrégulière régularisée (runned->ran, goed->went…) — map de build_verbmorph_en.py
import os as _os, json as _json
VERBMORPH = {}
try:
    VERBMORPH = _json.load(open(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'verbmorph_en.json'), encoding='utf-8'))
except Exception: pass
PP_AUX = {'have', 'has', 'had', 'having', "'ve", "'d", 'been', 'be', 'is', 'am', 'are', 'was', 'were',
    'get', 'gets', 'got', 'getting'}       # auxiliaires -> participe passé (have runned -> run) ; sinon passé (I runned -> ran)

def _tok(text): return re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)*", text)

def decide(T, i):
    """-> (suggestion, level) | (None, None). level ∈ {'RED','ORANGE'}.
    RED = faute STRUCTURELLEMENT certaine (FP=0) ; ORANGE = vigilance contextuelle (doute→orange)."""
    w = T[i]; lw = w.lower()
    nx = T[i+1].lower() if i+1 < len(T) else ''
    nx2 = T[i+2].lower() if i+2 < len(T) else ''
    pv = T[i-1].lower() if i > 0 else ''
    # 1) modal + of -> have  (RED : « modal + of » n'est JAMAIS grammatical)
    if lw == 'of' and pv in MODALS:
        return 'have', 'RED'
    # « a » + son voyelle du mot suivant (IPA) -> « an » (a apple/hour). FP=0 : mot suivant en MINUSCULES
    # seulement (les acronymes/noms propres US/UN/August se prononcent lettre-à-lettre → lookup lowercase
    # faux : « a US firm » = « a you-ess » est correct). Direction an->a ABANDONNÉE (rare + « an »=typo « and »).
    nx_raw = T[i+1] if i+1 < len(T) else ''
    if (lw == 'a' and (w == 'a' or i == 0)              # « A » capital = article seulement en début de phrase (sinon étiquette : « Party A », « vitamin A »)
            and nx_raw.isalpha() and nx_raw.islower() and vowel_start(nx) is True):
        return 'an', 'RED'
    # 2) comparatif + then : RED si suivi d'un GN/pronom comparé (bigger then mine) ; sinon un verbe
    #    après = « then » temporel (work harder then rest) -> ORANGE prudent
    if lw == 'then' and (pv in COMPAR or (pv.endswith('er') and is_adj(pv))):
        if nx in THAN_OBJ or (nx and (is_noun(nx) or is_adj(nx)) and not is_verb(nx)):
            return 'than', 'RED'                           # bigger then mine / more then happy
        return 'than', 'ORANGE'                            # « harder then rest » : then peut être temporel
    # 3) their / there / they're  (direction possessive = ORANGE : nom PUR après = candidat possessif)
    if lw == 'their' and nx in BE_AFTER:
        return 'there', 'RED'                              # « their is/are » -> there (possessif+copule impossible)
    if lw == 'there' and nx and only_noun(nx):
        return 'their', 'ORANGE'                           # « there problem » -> their (contexte faible)
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
    if lw == 'to' and nx in ('much', 'many') and pv not in (
            '', 'listen', 'up', 'close', 'talk', 'talking', 'speak', 'speaking',
            'refer', 'referred', 'according', 'due', 'access', 'attention', 'related'):
        return 'too', 'ORANGE'
    # 6b) « to <adj gradable> to/for » = construction « too … to/for » (RED, FP≈0) :
    #     « to tired to walk », « to big for me », « to close to home ». Le « to/for » qui suit l'adj
    #     verrouille le sens intensif ; pv non-verbe-à-infinitif (évite « want to close … »).
    if lw == 'to' and nx in DEGREE_ADJ and nx2 in ('to', 'for') and pv not in TO_INF_GUARD:
        return 'too', 'RED'
    # 7) « weather or not » -> « whether or not » (RED : jamais correct — la météo ne se conjugue pas ainsi)
    if lw == 'weather' and nx == 'or' and nx2 == 'not':
        return 'whether', 'RED'
    # 8) accord sujet-verbe (RED, FP=0 en anglais standard)
    if lw == "don't" and pv in SUBJ_SING3:  return "doesn't", 'RED'   # he/she/it don't -> doesn't
    if lw == "doesn't" and pv in SUBJ_NON3: return "don't", 'RED'     # I/you/we/they doesn't -> don't
    if lw == 'was' and pv in WAS_WRONG:     return 'were', 'RED'      # you/we/they was -> were
    # 9) loose (adj) mis pour le verbe lose : trigger modal/to devant, hors idiome (be/cut/let… loose) -> ORANGE
    if lw == 'loose' and pv in LOOSE_TRIG and (i < 2 or T[i-2].lower() not in LOOSE_IDIOM):
        return 'lose', 'ORANGE'
    # 10) verbe irrégulier RÉGULARISÉ (runned->ran, goed->went, teached->taught) — RED FP=0 (forme nonstandard)
    if lw in VERBMORPH:
        past, pp = VERBMORPH[lw]
        return (pp if pv in PP_AUX else past), 'RED'
    return None, None

def correct(text, reds_only=True):
    T = _tok(text); out = []
    for i, w in enumerate(T):
        s, lv = decide(T, i)
        out.append((w, s, lv))
    return out

# ---------- fautes plantées (recall) ----------
CASES = [
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
    ("He don't like it", 1, "doesn't", 'RED'),
    ("She don't know", 1, "doesn't", 'RED'),
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
    red_fp = fp_scale()
    if '--check' in sys.argv:                                # garde CI : recall CASES complet + (si EWT) RED = vraies fautes
        ok = (hitR + hitO == len(CASES)) and (red_fp is None or red_fp <= 55)
        print('[check] %s — recall %d/%d, RED-EWT %s' % ('OK' if ok else 'ÉCHEC', hitR+hitO, len(CASES), red_fp))
        if not ok: sys.exit(1)

def fp_scale():
    path = os.path.join(HERE, '..', 'data_local', 'en_ewt-ud-train.conllu')
    if not os.path.exists(path):
        print('[fp] EWT introuvable — skip'); return None
    red = collections.Counter(); orange = 0; sents = 0; redex = []
    for l in open(path, encoding='utf-8'):
        if not l.startswith('# text = '): continue
        sents += 1
        T = _tok(l.split('=', 1)[1])
        for i in range(len(T)):
            s, lv = decide(T, i)
            if lv == 'RED':
                red[(T[i].lower(), s)] += 1
                if len(redex) < 20: redex.append('%s→%s' % (T[i], s))
            elif lv == 'ORANGE':
                orange += 1
    tot = sum(red.values())
    print('\n=== FP SCALE (EWT %d phrases) ===' % sents)
    print('  RED (rouge) sur texte correct : %d  ← doit tendre vers 0 (FP)' % tot)
    if red: print('   détail RED :', red.most_common(12))
    print('  ORANGE (vigilance) : %d (%.2f/phrase)' % (orange, orange/max(sents,1)))
    return tot

if __name__ == '__main__':
    main()
