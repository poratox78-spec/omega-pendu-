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

def load_pos():
    POS = {}
    with gzip.open(LEX, 'rt', encoding='utf-8') as f:
        f.readline()
        for line in f:
            c = line.rstrip('\n').split('\t')
            if len(c) >= 2 and c[0]: POS[c[0]] = set(c[1].split('|'))
    return POS
POS = load_pos()

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
    fp_scale()

def fp_scale():
    path = os.path.join(HERE, '..', 'data_local', 'en_ewt-ud-train.conllu')
    if not os.path.exists(path):
        print('[fp] EWT introuvable — skip'); return
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

if __name__ == '__main__':
    main()
