# -*- coding: utf-8 -*-
# PROBE CORRECTEUR — détection ET correction d'homophones grammaticaux SANS corrigé.
# ============================================================================================
# Hypothèse risquée à trancher (cap §1) : le levier d'accord/POS de diag_sentence.py peut-il, SANS
# connaître la phrase cible (≠ dictée), (a) DÉTECTER une faute d'homophone grammatical et (b) proposer
# la CORRECTION ? C'est le cœur d'un correcteur orthographique dys « semi-direct ».
#
# On vise les confusions que le contexte tranche (≠ ces/ses, sémantique) :
#   -é/-er (mangé/manger) · son/sont · on/ont · leur/leurs · a/à · et/est.
# Chaque règle = decide(T,i) -> forme correcte selon le contexte (voisins, POS), ou None (s'abstient).
# Le correcteur FLAGUE si la forme tapée ≠ forme décidée, et PROPOSE la forme décidée.
#
# Mesuré : faux positifs (sur les 30 phrases CORRECTES + cas témoins) · détection (faute injectée flaguée ?)
#          · correction (la proposition est-elle la bonne ?). Réutilise diag_sentence (doctrine §5).
# Lancer : python3 dictee/correcteur_probe.py
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import diag_sentence as D
from diag_sentence import deacc, toks, is_verb, is_participle, governor_number, NUM_DET, NUM_PRON, PREP

SENT = json.load(open(os.path.join(HERE, 'sentences.json'), encoding='utf-8'))

# Verbes/mots-outils suivis d'un INFINITIF (pour -é/-er). PREP (de/à/pour/sans…) vient de diag_sentence.
MODAL = {'veux','veut','veulent','peux','peut','peuvent','dois','doit','doivent','va','vais','vas','vont',
         'faut','sais','sait','aime','aimes','aiment','adore','espere','souhaite','prefere','preferent',
         'vient','viens','allons','allez','laisse','laissent','semble','ose','vais','pour','sans','afin','de'}
AUX = set(D.AUX_ETRE) | set(D.AUX_AVOIR)

# Durcissement FP (mesuré sur UD French, cf. fp_stress_test.py). Noms INVARIABLES en -s/-x (« leur pays » = sg, pas
# « leurs ») et mots-outils/adverbes homographes d'un nom (« mais pas », « mais comment » = conjonction, pas « mes »).
INVAR_NOUN = {'pays','temps','prix','poids','corps','fois','mois','cas','bras','dos','nez','choix','voix','croix',
              'bois','univers','succes','progres','repas','avis','sens','cours','concours','discours','jus','tas',
              'os','puits','bus','virus','tennis','colis','devis','permis','compromis','paradis','velours','dais'}
MAIS_STOP = {'pas','plus','moins','point','rien','tout','tres','jamais','surtout','aussi','encore','toujours',
             'comment','pourquoi','peu','trop','bien','non','oui','si','assez','enfin','donc','car','alors','ici','la'}
# Genre déterminant : mots qui suivent le déterminant SANS être le nom-tête (adverbe/comparatif/adjectif/prép/préfixe).
# La règle ne doit PAS les prendre pour le nom (« la plus belle », « une autre fois », « sa propre voie ») → abstention.
DET_SKIP = {'plus','moins','tres','bien','trop','assez','aussi','si','autre','autres','meme','propre','seul','seule',
            'tel','telle','certain','certaine','tout','toute','grand','grande','petit','petite','gros','grosse','beau',
            'bel','belle','bon','bonne','nouveau','nouvel','nouvelle','premier','premiere','dernier','derniere','jeune',
            'vieux','vieil','vieille','long','longue','large','simple','super','superbe','primaire','double','triple',
            'sous','pour','contre','par','sans','avec','entre','vers','mi','demi','semi','pseudo','quasi','ex',
            'porte','montre','des','les','de','le'}
# Marqueurs de sujet PLURIEL (pour bloquer « sont »→« son » quand le sujet pluriel est à distance).
PLURAL_MARK = {'ils','elles','nous','vous','les','des','ces','mes','tes','ses','nos','vos','leurs','plusieurs',
               'quelques','certains','certaines','deux','trois','quatre','cinq','six','sept','huit','neuf','dix','plupart'}
_CLAUSE_BREAK = {'et','ou','mais','car','donc','or','ni','que','qui','quand','lorsque','puisque','comme','si',
                 '.',',',';',':','!','?','(',')','«','»'}
# Participes passés IRRÉGULIERS (ne finissent pas en -é ; is_participle les rate) → « ont pu/fait/eu » = avoir, pas « on ».
IRREG_PART = {'eu','pu','du','su','vu','lu','tenu','venu','devenu','revenu','voulu','valu','fallu','connu','reconnu',
              'paru','apparu','disparu','couru','recu','deçu','dequ','mort','fait','refait','dit','redit','ecrit',
              'decrit','mis','remis','permis','promis','pris','appris','compris','surpris','ouvert','offert','couvert',
              'souffert','peri','acquis','conquis','assis','vecu','plu','cru','bu','tu'}

# Couverture verbale élargie SANS le lexique 34 Mo : liste BLANCHE de formes fréquentes (exactes → 0 FP par
# sur-généralisation). Stopgap avant Lexique4 cgram (étape 3). Désaccentué, minuscule.
COMMON_VERBS = set("""
suis es est sommes etes sont etais etait etions etiez etaient sera seront fut furent serait soit
ai as a avons avez ont avais avait avaient aura auront aurait eu
vais vas va allons allez vont allais allait ira iront alle aille
fais fait faisons faites font faisait fera fait fasse
dis dit disons dites disent disait dira
peux peut pouvons pouvez peuvent pouvait pourra pu puisse
veux veut voulons voulez veulent voulait voudra voulu veuille
dois doit devons devez doivent devait devra du doive
sais sait savons savez savent savait saura su sache
vois voit voyons voyez voient voyait verra vu voie
viens vient venons venez viennent venait viendra venu vienne
prends prend prenons prenez prennent prenait prendra pris prenne
mets met mettons mettez mettent mettait mettra mis mette
mange mangent mangeons mangez mangeait parle parlent parlez parlait
aime aiment aimez aimait donne donnent donnez trouve trouvent regarde regardent
joue jouent jouez jouait porte portent cherche cherchent pense pensent reste restent
passe passent arrive arrivent entre entrent monte montent tombe tombent tombait
chante chantent court courent boit boivent lit lisent ecrit ecrivent dort dorment
finit finissent etudie etudient quitte quittent calme creuse vend vendent
""".split())


# Étape 3 : si dictee/cgram_verbs.json existe (généré par build_cgram.py depuis Lexique4), on l'utilise
# en PLUS de la liste blanche (couverture verbale complète). Sinon, repli transparent sur la liste blanche.
_CGRAM_PATH = os.path.join(HERE, 'cgram_verbs.json')
VERB_LEX = set(COMMON_VERBS)
CGRAM_LOADED = False
if os.path.exists(_CGRAM_PATH):
    try:
        VERB_LEX |= set(json.load(open(_CGRAM_PATH, encoding='utf-8')))
        CGRAM_LOADED = True
    except Exception:
        pass
# Adjectifs genrés (vert↔verte) pour l'accord en genre dans le correcteur. Épicènes/ambigus déjà écartés (FP=0).
_ADJ_PATH = os.path.join(HERE, 'cgram_adj.json')
ADJ_LEX = {}
if os.path.exists(_ADJ_PATH):
    try: ADJ_LEX = json.load(open(_ADJ_PATH, encoding='utf-8'))
    except Exception: ADJ_LEX = {}
# POS-tagger 155k extrait du LEXIQUE EMBARQUÉ (build_pos.py → cgram_pos.json) : { forme : [POS, freq, nbhomog] }.
# Réutilise le gros lexique du pendu (§5) ; repli transparent si absent. pos_of(w) = lecture par forme déaccentuée.
_POS_PATH = os.path.join(HERE, 'cgram_pos.json')
POS_LEX = {}
if os.path.exists(_POS_PATH):
    try: POS_LEX = json.load(open(_POS_PATH, encoding='utf-8'))
    except Exception: POS_LEX = {}
if not POS_LEX:                                        # repli §5 : cgram_pos.json absent (CI avant build_pos / checkout frais)
    try:                                               # → extraire du lexique EMBARQUÉ (MÊME source que l'app posOf) → parité garantie
        from build_pos import extract as _pos_extract
        POS_LEX = _pos_extract()
    except Exception: POS_LEX = {}
def pos_of(w): return POS_LEX.get(deacc(w.lower()))

# ---------- POS-tagger HMM (bigramme + Viterbi) — analyse de NATURE par le CONTEXTE (séquence), pas mot par mot ----------
# Modèle appris sur le treebank UD French-GSD (CC BY-SA 4.0), exporté par build_pos_hmm.py → dictee/pos_hmm.json.
# ~95 % strict / ~96 % pertinent (test tenu). MÊME modèle + MÊME Viterbi que les 2 moteurs JS → parité exacte.
# Émission : mot vu (modèle) → repli lexique POS_LEX (déjà embarqué) → repli suffixe → repli capitale/prior. Sert de
# CONTEXTE gaté aux règles (jamais une assertion aveugle) ; None si le modèle est absent (repli transparent).
_HMM = None
def _hmm_model():
    global _HMM
    if _HMM is None:
        _HMM = {}
        _p = os.path.join(HERE, 'pos_hmm.json')
        if os.path.exists(_p):
            try: _HMM = json.load(open(_p, encoding='utf-8'))
            except Exception: _HMM = {}
    return _HMM if _HMM.get('tags') else None

def pos_tags(T):
    """Séquence de tags UPOS pour les tokens T (Viterbi HMM). None si modèle absent. Réutilise POS_LEX pour les mots
    hors-modèle (parité app/extension via posOf). Déterministe → parité exacte avec le port JS."""
    M = _hmm_model()
    if not M or not T: return None
    tags = M['tags']; tr = M['trans']; em = M['emit']; suf = M['suf']; pri = M['prior']; FL = M['floor']
    def lt(a, b): return tr.get(a, {}).get(b, FL)
    def le(t, w):
        lw = w.lower()
        if (t == 'PUNCT' or t == 'SYM') and any(ch.isalpha() for ch in lw): return -100.0   # un mot alphabétique n'est JAMAIS ponctuation (interdit ferme)
        e = em.get(lw)
        if e is not None: return e.get(t, FL)                                               # émission apprise (mot vu ≥2 sur UD)
        for k in (4, 3, 2):                                                                  # inconnu → backoff SUFFIXE (rien d'autre : parité 3 moteurs, pas de lexique POS externe)
            if len(lw) >= k and lw[-k:] in suf:
                d = suf[lw[-k:]]
                return d.get(t, FL) + (0.0953 if (w[:1].isupper() and t == 'PROPN') else 0.0)   # ln(1.1)
        return pri.get(t, FL) + (1.0986 if (w[:1].isupper() and t == 'PROPN') else 0.0)          # ln(3), capitale → PROPN
    n = len(T); V = [{}]; bk = [{}]
    for t in tags: V[0][t] = lt('<s>', t) + le(t, T[0]); bk[0][t] = '<s>'
    for i in range(1, n):
        V.append({}); bk.append({})
        for t in tags:
            et = le(t, T[i]); best = -1e18; bp = None
            for pt in tags:
                sc = V[i-1][pt] + lt(pt, t)
                if sc > best: best, bp = sc, pt
            V[i][t] = best + et; bk[i][t] = bp
    best = -1e18; bt = None
    for t in tags:
        sc = V[n-1][t] + lt(t, '</s>')
        if sc > best: best, bt = sc, t
    seq = [bt]
    for i in range(n-1, 0, -1): seq.append(bk[i][seq[-1]])
    return seq[::-1]


def vlike(T, i):
    """Verbe EN CONTEXTE : levier dictée (is_verb) OU lexique verbal (cgram si présent, sinon liste blanche)."""
    if i < 0 or i >= len(T): return False
    if is_verb(T, i): return True
    w = deacc(T[i].lower())
    if w in VLIKE_STOP: return False                                       # mots-outils homographes du cgram (« ne », « le »…) — jamais verbe ici
    return (w in VERB_LEX) and not (i > 0 and T[i-1].lower() in NUM_DET)  # « le porte » reste un nom


# cgram (12 k formes) contient des homographes COURTS de mots-outils (« ne », « le », « la », « on »…) qui
# faisaient mordre les règles à tort sur du texte réel. On les exclut de la détection verbale (mesuré : -FP).
VLIKE_STOP = (set(NUM_DET) | set(NUM_PRON) |
              {'ne', 'me', 'te', 'se', 'le', 'la', 'les', "l'", 'en', 'y', 'que', 'qu', 'qui',
               'si', 'ou', 'et', 'ni', 'car', 'or', 'ce', 'ces', 'de', 'des', 'du'})


def prev(T, i): return deacc(T[i-1].lower()) if i > 0 else None

def _is_ppl(w):
    """Participe passé RÉEL (cadre auxiliaire avoir). Terminaison de participe ET infinitif reconstruit PRÉSENT dans le
    lexique verbal → écarte les NOMS homographes en -é/-ée (actualité, portée-nom) qui faisaient exploser les FP."""
    lw = w.lower(); d = deacc(lw)
    if d in IRREG_PART or d in ('ete', 'eu'): return True             # vu/pu/eu/connu/mort/né… + été/eu
    if lw.endswith('ées'):   stem, inf = deacc(lw[:-3]), 'er'
    elif lw.endswith('ée'):  stem, inf = deacc(lw[:-2]), 'er'
    elif lw.endswith('és'):  stem, inf = deacc(lw[:-2]), 'er'
    elif lw.endswith('é'):   stem, inf = deacc(lw[:-1]), 'er'
    elif d.endswith('is'):   stem, inf = deacc(lw[:-2]), 'ir'
    elif d.endswith('i'):    stem, inf = deacc(lw[:-1]), 'ir'
    else: return False                                               # -u/-us écartés : trop de noms homographes (revenu, contenu, menu, tissu) → FP a/à
    return len(stem) >= 2 and (stem + inf) in VERB_LEX
def nxt(T, i):  return deacc(T[i+1].lower()) if i+1 < len(T) else None
def _plural_before(T, i):
    """Un marqueur de sujet PLURIEL apparaît-il avant le mot i, dans la même proposition (≤6 tokens, sans frontière) ?"""
    for j in range(i-1, max(-1, i-7), -1):
        w = deacc(T[j].lower())
        if w in _CLAUSE_BREAK: break
        if w in PLURAL_MARK: return True
    return False
def _clause_no_finite_verb(T, i):
    """Aucun verbe dans la proposition de i (bornes _SEG), hors T[i] ? Verbe-présence via le TAGGER HMM (contexte) —
    il tague « élèves/table/forme » NOUN par le contexte là où le repli `_reads` sur-détectait (→ ratés). Repli `_reads`
    (sur-détection = abstention, jamais un FP) si le modèle est absent. Parité : pos_tags identique Py/app/extension."""
    n = len(T); lo, hi = 0, n
    if _SEG is not None:
        for j in range(i, 0, -1):
            if j < len(_SEG['bb']) and _SEG['bb'][j]: lo = j; break
        for j in range(i+1, n):
            if j < len(_SEG['bb']) and _SEG['bb'][j]: hi = j; break
    tg = pos_tags(T)
    if tg is not None:
        for j in range(lo, hi):
            if j != i and tg[j] in ('VERB', 'AUX'): return False
        return True
    for j in range(lo, hi):                                        # repli (modèle absent) : lecture conjuguée `_reads`
        if j != i and _reads(T[j].lower()): return False
    return True

def is_plural_noun(T, j):
    if j < 0 or j >= len(T): return False
    dw = deacc(T[j].lower())
    if not (dw.endswith('s') or dw.endswith('x')): return False
    return j > 0 and T[j-1].lower() in NUM_DET and NUM_DET[T[j-1].lower()] == 'pl'   # nom marqué par un dét. pluriel


# ---------- règles : decide(T,i) -> forme correcte (orthographe) | None ----------
# Noms fréquents en -é homographes d'un participe (marché/traité/combiné/exposé…) — JAMAIS un infinitif mutilé → abstention (FP UD)
NOUN_E = set('marche traite combine cote passe arrete carre depute employe invite expose resume communique delegue prive defile abonne'.split())

def rule_e_er(T, i):
    w = T[i]; lw = w.lower()
    if "'" in lw: return None                          # token contracté (l'été, d'…) → pas un verbe -er/-é
    if lw.endswith('é'):              forms = (w, w[:-1] + 'er')          # tapé = participe
    elif deacc(lw).endswith('er') and len(lw) > 3: forms = (w[:-2] + 'é', w)  # tapé = infinitif
    else: return None
    if deacc(forms[0].lower()) in NOUN_E: return None  # nom courant en -é (marché du travail, traité de Lyon, combiné nordique…) → pas une faute
    if deacc(forms[1].lower()) not in VERB_LEX: return None   # forms[1] = infinitif -er ; doit être un VRAI verbe (sinon « thé »→« ther » : FP)
    # NB (mesuré, rejeté) : élargir aux verbes du lexique 155k (POS=VER) — même borné à AVOIR — fait remonter le FP
    # (-é/-er 53→74 sur UD : « le traité/marché/côté » nom → infinitif). La règle exige du CONTEXTE (nom vs participe),
    # pas l'appartenance lexicale. Couverture verbale = COMMON_VERBS ∪ cgram_verbs (curée). Cf. JOURNAL 2026-06-22.
    if i == 0: return None
    praw = T[i-1].lower()
    if praw == 'à' or T[i-1] == 'A': return forms[1]   # « à » / « À » (en tête de phrase) = PRÉPOSITION → infinitif
    p = prev(T, i)
    if p in AUX:                 return forms[0]      # auxiliaire (a/ont/est…) → participe -é
    if p in PREP:
        if deacc(forms[0].lower()) in D.GENDER_LEX: return None   # prép + NOM homographe de participe (« par arrêté », « du passé/marché ») → abstention (FP)
        return forms[1]                              # préposition → infinitif -er
    if p in MODAL:               return forms[1]
    return None

PLURAL_DET = {'les', 'des', 'ces', 'leurs', 'mes', 'tes', 'ses', 'nos', 'vos', 'quels', 'quelles',
              'plusieurs', 'certains', 'certaines', 'quelques', 'aux'}   # déterminants/marqueurs PLURIEL (sujet pluriel)

def rule_son_sont(T, i):
    # Tranché par CE QUI SUIT (grammaire) : « son » = déterminant → précède un NOM SG ; « sont » = être 3pl →
    # prédicat (adjectif/participe/adverbe/prép). Abstention dans l'ambigu → FP=0 (audit UD : l'ancien « verbe/prép/conj
    # avant → son » flaguait « et sont compétents », « agressions sont susceptibles »).
    lw = deacc(T[i].lower())
    if lw not in ('son', 'sont'): return None
    nxt = deacc(T[i+1].lower()) if i+1 < len(T) else ''
    nxt_noun_sg = (nxt in GENDER_PURE) and not (nxt.endswith('s') or nxt.endswith('x'))
    plural_subj = (prev(T, i) in ('ils', 'elles')) or _plural_before(T, i) or is_plural_noun(T, i-1)
    if not plural_subj:                                                # déterminant PLURIEL (les/des/ces/leurs…) avant, dans la MÊME proposition → sujet pluriel (« Les sources … sont », « Les Bahrites ou X sont »)
        for j in range(i-1, max(-1, i-9), -1):
            if _SEG is not None and (j+1) < len(_SEG['bb']) and _SEG['bb'][j+1]: break
            if deacc(T[j].lower()) in PLURAL_DET: plural_subj = True; break
    if lw == 'sont':
        if plural_subj: return None                                    # sujet pluriel (proche ou à distance) → « sont » correct → ne pas toucher
        if nxt_noun_sg: return 'son'                                   # « sont » + NOM SINGULIER direct (« il a perdu sont chien ») → possessif ; adj/participe/prép (« sont contents/partis/là ») → abstention
        return None
    # lw == 'son' → « sont » : cadre NET « ils/elles son <prédicat> » (FP=0)
    if prev(T, i) in ('ils', 'elles') and nxt and not nxt_noun_sg:
        return 'sont'                                                  # « ils son contents » → être 3pl
    # PILOTE « analyse » — sujet NOM : groupe pluriel avant + « son » suivi d'une PRÉPOSITION (un déterminant possessif
    # n'est JAMAIS suivi d'une prép ; le NOM « son » l'est mais est alors précédé d'un déterminant/prép, exclu) + AUCUN
    # verbe fini dans la proposition (signal verbe-présence ~94 %) → « son » occupe le créneau verbe → « sont ».
    # « Les poules son dans le jardin »→sont ; « Le son de la cloche résonne » : « son » précédé de « Le » ET verbe présent → abstention.
    if plural_subj and (nxt in PREP or nxt == 'en') and prev(T, i) not in NUM_DET and prev(T, i) not in PREP and _clause_no_finite_verb(T, i):
        return 'sont'                                                  # « en » (prép : en retard/en colère) inclus, hors PREP de base
    return None

def rule_on_ont(T, i):
    lw = deacc(T[i].lower())
    if lw not in ('on', 'ont'): return None
    if _SEG is not None and i < len(_SEG['hy']) and _SEG['hy'][i]: return None   # « avait-on », « peut-on » : trait d'union → pronom inversé, jamais une faute
    nx = T[i+1].lower() if i+1 < len(T) else ''
    if nx.endswith('e') and not nx.endswith('ée') and _reads(nx): return 'on'   # « on » + verbe FINI présent en -e (trouve/mange) → « on » (ont ne précède JAMAIS un verbe fini) ; fixe « professeurs on trouve »→ont
    p = prev(T, i)
    pr = deacc(T[i-1].lower()) if i > 0 else ''
    glued_pl = ("'" in pr) and (pr.endswith('ils') or pr.endswith('elles'))   # pronom collé : qu'ils, s'ils, lorsqu'elles → sujet pluriel
    if p in ('ils', 'elles') or glued_pl or is_plural_noun(T, i-1): return 'ont'    # sujet/antécédent pluriel → avoir 3pl
    if i+1 < len(T) and _is_ppl(T[i+1]):
        return 'ont'                                                    # avoir + participe (« ont grandi/incarné/pu/fait/eu ») → 3pl, jamais « on »
    if vlike(T, i+1):         return 'on'                               # « on » sujet + verbe
    return None

def rule_leur_leurs(T, i):
    lw = deacc(T[i].lower())
    if lw not in ('leur', 'leurs'): return None
    if i+1 >= len(T): return None
    if is_verb(T, i+1): return 'leur'                                   # pronom (invariable) : « je leur parle »
    dn = deacc(T[i+1].lower())
    if dn in INVAR_NOUN: return 'leur'                                  # nom invariable en -s/-x (« leur pays » = sg) → jamais « leurs »
    return 'leurs' if (dn.endswith('s') or dn.endswith('x')) else 'leur'  # déterminant : accord avec le nom

def rule_a_aa(T, i):
    if deacc(T[i].lower()) != 'a': return None
    if T[i] == T[i].upper() and T[i] != T[i].lower(): return None      # « A » majuscule (sigle/lettre « Serie A » ; « À » en tête) → abstention (FP)
    pb = _SEG['bb'][i] if (_SEG is not None and i < len(_SEG['bb'])) else False   # frontière de proposition AVANT (virgule…) → le mot d'avant ne gouverne pas (« qui, à 4°C » : « qui » n'est pas le sujet de « à »)
    p = prev(T, i)
    if not pb and p in ('il', 'elle', 'on', 'qui', 'ca', "c", "ça"): return 'a'   # sujet 3sg net (pas à travers une virgule) → avoir
    if i+1 < len(T) and _is_ppl(T[i+1]):                  return 'a'    # « a + participe » (« a été », « a décidé ») → auxiliaire AVOIR, jamais « à »
    if i+2 < len(T) and deacc(T[i+1].lower()).endswith('ment') and _is_ppl(T[i+2]): return 'a'   # « a + adverbe(-ment) + participe » (« a également exploité »)
    if not pb and vlike(T, i-1):                                       # après un verbe (« va à »), même proposition → préposition
        pv = NOUN_POST.get(deacc(T[i-1].lower())) if i > 0 else None   # …SAUF si le mot avant « a » est un NOM confiant (posterior) :
        if pv and pv[0] >= PL_TAU_M and pv[1] < PL_EPS_M: return None  # « l'entreprise a », « la voiture a » → avoir, pas « à » (fixe ~10 FP a→à)
        return 'à'
    return None

def rule_et_est(T, i):
    lw = deacc(T[i].lower())
    if lw not in ('et', 'est'): return None
    if _SEG is not None and i < len(_SEG['bb']) and _SEG['bb'][i]: return None   # frontière avant (« elle, et … ») → pas de sujet net
    p = prev(T, i)
    if p not in ('il', 'elle', 'on', 'c', 'ce', 'ca', 'qui'): return None   # exige un PRONOM sujet net (sinon « le roi, et … » → FP)
    if i+1 < len(T) and T[i+1][:1].isupper(): return None                  # « et Bob », « et Chris Udoh » → nom propre → conjonction, jamais « est »
    if i+1 < len(T) and (is_participle(T, i+1) or T[i+1].lower() not in NUM_DET):
        return 'est'                                                       # pronom sujet + attribut → être 3sg
    return None

def rule_peu(T, i):
    lw = deacc(T[i].lower())
    if lw not in ('peu', 'peux', 'peut'): return None
    p = prev(T, i)
    if p in ('je', 'tu'):              return 'peux'                    # 1re/2e pers. → pouvoir
    if p in ('il', 'elle', 'on', 'qui'): return 'peut'                 # 3e sg → pouvoir
    if p in ('un', 'de', 'tres', 'si', 'trop', 'assez', 'bien', 'plus', 'tout', 'aussi', 'y'):
        return 'peu'                                                   # adverbe de quantité
    return None

def rule_ce_se(T, i):
    lw = deacc(T[i].lower())
    if lw not in ('ce', 'se'): return None
    if i+1 >= len(T): return None
    nd = deacc(T[i+1].lower())
    if nd in ('qui', 'que', 'dont', 'qu', "qu'"): return 'ce'         # ce qui/que/dont (+ élidé « qu' » : ce qu'il/qu'aurait)
    if nd in AUX or nd in ('sont', 'est'): return None                # « ce sont » vs « se sont déroulés », c'est vs s'est : ambigu → s'abstenir
    if nd in CLITIC: return None                                       # « se le/la/lui/en/y/ne donne » : clitique → « se » pronominal (ou « ce n'était » impersonnel) → ne pas toucher
    if nd in NUM_DET: return None                                      # « se une/le/des… » : déterminant, ni nom-tête ni verbe → abstention (texte corpus cassé)
    if nd.endswith('ant') and len(nd) > 4: return None                 # participe présent/gérondif (se constituant, en chantant) → « se » réfléchi, jamais « ce »
    isv = vlike(T, i+1); isn = nd in D.GENDER_LEX
    if isv and not isn: return 'se'                                    # verbe PUR → se (pronominal)
    tg = pos_tags(T)                                                   # homographe (livre/marche…)/inconnu → le TAGGER (contexte) tranche
    if tg is None or i+1 >= len(tg):
        return 'ce' if (isn and not isv) else None                    # sans tagger : repli nom-pur → ce
    # nom PUR → ce (démonstratif) SAUF si le tagger voit un VERBE (ex. « il se document[e] » : documenter absent du lexique verbal → isn/not-isv à tort) → on ne force PAS « ce »
    if isn and not isv and tg[i+1] not in ('VERB', 'AUX'): return 'ce'
    if lw == 'se':                                                     # « se » réfléchi est TOUJOURS devant un verbe/clitique → « se » + NOM (hors participe -ant) = « ce » (démonstratif)
        return 'ce' if (tg[i+1] == 'NOUN' and not nd.endswith('ant')) else None
    # lw == 'ce' → « se » SEULEMENT si un SUJET précède (« il ce lave »→se) ; sinon « ce » = PRONOM IMPERSONNEL (ce serait, ce n'était, pour ce faire) → abstention
    if tg[i+1] in ('VERB', 'AUX') and prev(T, i) in ('il', 'elle', 'on', 'je', 'tu', 'ils', 'elles', 'qui'):
        return 'se'
    return None

def rule_cest_sest(T, i):
    # « c'est » (ce+est, impersonnel) vs « s'est » (se+est, pronominal 3e sing.). FP=0 : un PRONOM SUJET SINGULIER
    # (il/elle/on) collé devant « c'est » SUIVI d'un PARTICIPE ne peut être que « s'est » (« elle c'est levée »→s'est).
    # Le participe bloque la dislocation familière « Elle c'est ma sœur » (c'est + NOM, pas participe) → abstention.
    # Singulier seulement : au pluriel « ils/elles c'est » la bonne forme est « se sont », pas « s'est » → abstention.
    if deacc(T[i].lower()) != "c'est": return None
    if _SEG is not None and i < len(_SEG['bb']) and _SEG['bb'][i]: return None   # frontière avant → pas de sujet net
    if prev(T, i) not in ('il', 'elle', 'on'): return None
    if i+1 < len(T) and _is_ppl(T[i+1]): return _keepcase(T[i], "s'est")
    return None

# ---------- Accord SUJET-VERBE (route lexicale Lexique4 : cgram_conj.json) ----------
# Le correcteur ne couvrait que 8 homophones ; les vraies copies dys ont surtout des accords (« Je doit », « On ont »,
# « il sont »). On ajoute l'accord sujet-verbe pour les sujets PRONOMS (personne+nombre certains), borné FP=0 :
#   - sujet = pronom isolé je/tu/il/elle/on/ils/elles (nous/vous écartés : ambigus avec le clitique objet) ;
#   - on flague le verbe seulement s'AUCUNE lecture finie (ind/sub/cnd) n'admet (personne,nombre) du sujet ;
#   - la correction n'est proposée QUE si la forme suggérée est elle-même confirmée par la table comme (pers,nombre)
#     du sujet (auto-garde contre le bruit Lexique : un slot douteux → abstention, jamais une mauvaise correction).
_CONJ_PATH = os.path.join(HERE, 'cgram_conj.json')
CONJ_F, CONJ_C = {}, {}
CONJ_LOADED = False
if os.path.exists(_CONJ_PATH):
    try:
        _cj = json.load(open(_CONJ_PATH, encoding='utf-8'))
        CONJ_F, CONJ_C = _cj.get('f', {}), _cj.get('c', {})
        CONJ_LOADED = bool(CONJ_F)
    except Exception:
        pass

SUBJ_PRON = {'je': ('1', 's'), 'tu': ('2', 's'), 'il': ('3', 's'), 'elle': ('3', 's'),
             'on': ('3', 's'), 'ils': ('3', 'p'), 'elles': ('3', 'p')}
CLITIC = {'ne', 'me', 'te', 'se', 'le', 'la', 'les', 'lui', 'leur', 'y', 'en', 'nous', 'vous',
          "l'", "m'", "t'", "s'", "n'"}


def _reads(w):
    """Lectures finies de la forme : liste de (lemme, mode:temps, personne, nombre)."""
    s = CONJ_F.get(deacc(w.lower()))
    if not s: return []
    r = []
    for chunk in s.split('|'):
        f = chunk.split(';')
        if len(f) == 4: r.append((f[0], f[1], f[2], f[3]))
    return r


# ---------- Couche SEGMENTS (ponctuation + majuscules = sens/contexte) ----------
# toks() jette la ponctuation : on recalcule, aligné sur toks, un drapeau par mot — début de phrase (après . ! ?) et
# borne de proposition (, ; : …). Sert (A) à BORNER la détection du sujet & l'atténuation, (B) à corriger la majuscule
# de début de phrase. _SEG est posé par correct() avant la passe de règles.
_SEG = None
ABBREV = {'m', 'mme', 'mlle', 'mr', 'dr', 'pr', 'me', 'mgr', 'st', 'ste', 'etc', 'cf', 'ex', 'vs', 'no', 'nos',
          'art', 'av', 'bd', 'env', 'fig', 'vol', 'ed', 'p', 'pp', 'al', 'co', 'inc', 'ave', 'apr', 'jc',
          'subsp', 'ssp', 'var', 'sp', 'spp', 'gen', 'fam'}     # + abréviations latines (noms d'espèces : « L. delbrueckii subsp. bulgaricus »)

def _seg_info(text):
    import re
    ss, bb, hy, cap, prev_end = [], [], [], [], 0
    for k, m in enumerate(re.finditer(r"[A-Za-zÀ-ÿœŒ']+", text)):
        gap = text[prev_end:m.start()]
        s = any(c in gap for c in '.!?…')                        # début de phrase = APRÈS . ! ? (pas le 1er token : un fragment ne se capitalise pas)
        ss.append(s)
        bb.append(s or any(c in gap for c in ',;:()«»"–—\n'))
        hy.append('-' in gap)                                    # trait d'union avant (inversion « dit-il ») → anti-FP run-on
        cap.append(s and '..' not in gap and not any(c.isdigit() for c in gap))   # MAJUSCULE : vraie fin de phrase — pas une ellipse « .. » ni un point de nombre/décimale
        prev_end = m.end()
    return {'ss': ss, 'bb': bb, 'hy': hy, 'cap': cap}

# ---------- C : RUN-ON (ponctuation manquante entre 2 propositions) — VIGILANCE (vert), n'impose pas. Conservateur, FP-mesuré.
PRON_SUBJ = {'je': ('1', 's'), 'tu': ('2', 's'), 'il': ('3', 's'), 'elle': ('3', 's'), 'on': ('3', 's'),
             'nous': ('1', 'p'), 'vous': ('2', 'p'), 'ils': ('3', 'p'), 'elles': ('3', 'p')}
CONJ_REL = {'et', 'ou', 'ni', 'mais', 'car', 'donc', 'or', 'que', 'qu', 'qui', 'dont', 'quand',
            'lorsque', 'comme', 'si', 'puisque', 'quoique', 'lequel', 'laquelle', 'pour', 'sans', 'a'}

def _is_finite(w):
    return any(r[1].split(':')[0] in ('ind', 'sub', 'cnd', 'cond', 'imp') for r in _reads(w))

def runon_positions(text):
    """Indices des pronoms-sujets qui démarrent une 2e proposition COLLÉE (verbe fini avant, sans séparateur)
    → il manque sûrement une ponctuation AVANT ce pronom. Vert (le sens en dépend), n'impose rien."""
    T = toks(text); seg = _seg_info(text); out = []
    for i in range(2, len(T) - 1):
        pn = PRON_SUBJ.get(deacc(T[i].lower()))
        if not pn: continue
        if seg['bb'][i] or seg['hy'][i]: continue                # ponctuation / trait d'union (inversion) avant → pas un run-on
        if deacc(T[i - 1].lower()) in CONJ_REL: continue         # « et il », « qu'il »… → coordination/relative
        if "'" in T[i - 1].lower() or "'" in T[i].lower(): continue
        if not _is_finite(T[i - 1]): continue                    # fin de proposition 1 = verbe CONJUGUÉ
        if not _is_finite(T[i + 1]): continue                    # proposition 2 = sujet(i) + verbe CONJUGUÉ(i+1)
        if not _agrees(_reads(T[i + 1]), pn[0], pn[1]): continue  # le verbe 2 s'accorde avec le pronom → bien sujet+verbe
        out.append(i)
    return out

def rule_capital(T, i):
    if _SEG is None or i >= len(_SEG['cap']) or not _SEG['cap'][i]: return None
    w = T[i]
    if not (w[:1].isalpha() and w[:1].islower()): return None    # déjà capitale / non-lettre
    if i > 0 and deacc(T[i - 1].lower()) in ABBREV: return None   # après une abréviation (M. Dr etc.) → pas une vraie fin de phrase
    if i > 0 and len(deacc(T[i - 1].lower())) == 1: return None   # après une INITIALE (J. R. ou nom latin « L. casei ») → pas une fin de phrase
    return w[0].upper() + w[1:]

def _subject_before(T, i):
    """Remonte depuis i-1 en sautant les clitiques objets ; renvoie (personne, nombre) si un PRONOM sujet net précède.
    BORNE (A) : aucune frontière de proposition (ponctuation) entre le sujet et le verbe, sinon c'est une autre proposition."""
    j = i - 1; steps = 0
    while j >= 0 and steps < 3 and deacc(T[j].lower()) in CLITIC:
        j -= 1; steps += 1
    if j < 0: return None
    if _SEG is not None and any(_SEG['bb'][m] for m in range(j + 1, min(i + 1, len(_SEG['bb'])))):
        return None
    return SUBJ_PRON.get(deacc(T[j].lower()))


def _agrees(reads, per, nb):
    """La forme s'accorde-t-elle avec (personne, nombre) du sujet ?
    3e personne : nombre STRICT (il/ils, on/ont = là où le nombre tranche, et les tags y sont fiables).
    1re/2e personne (toujours SINGULIER) : personne seule — le tag 8_Nombre y est parfois faux (« peux »=p
    dans Lexique) ; ignorer le nombre évite le faux positif, au prix de rater « je pouvons » (rare)."""
    if per == '3':
        return any(p == per and (n == nb or n == 'x') for (_l, _mt, p, n) in reads)
    return any(p == per for (_l, _mt, p, _n) in reads)


def rule_accord_sv(T, i):
    if not CONJ_LOADED or "'" in T[i].lower(): return None        # forme élidée (j'ai) → hors v1
    if T[i].lower().endswith(('é', 'és', 'ée', 'ées')): return None   # participe (mangé…) : accord adjectival/temps composé, pas présent (deacc é→e trompe)
    reads = _reads(T[i])
    if not reads: return None                                     # pas une forme verbale connue → abstention
    pn = _subject_before(T, i)
    if pn is None: return None                                    # pas de sujet-pronom net → abstention
    per, nb = pn
    if deacc(T[i].lower()) == 'peut' and i + 1 < len(T) and deacc(T[i+1].lower()) == 'etre':
        return None                                              # « peut-être » (adverbe), pas le verbe pouvoir
    if _agrees(reads, per, nb): return None                      # déjà d'accord → ne pas toucher
    if (i >= 1 and deacc(T[i-1].lower()) in FULL_AUX) or (i >= 2 and deacc(T[i-2].lower()) in FULL_AUX):
        return None                                              # temps composé / passif (aux + participe : « auraient tenté », « sont-ils insérés ») → T[i] = participe, pas un verbe fini à accorder
    lemmas = {l for (l, _mt, _p, _n) in reads}
    if len(lemmas) != 1: return None                             # forme homographe inter-lemmes (vis=vivre/voir) → abstention
    lem = lemmas.pop()
    mts = [mt for (_l, mt, _p, _n) in reads]
    mt = 'ind:pre' if 'ind:pre' in mts else mts[0]               # temps cible = présent si dispo, sinon le temps tapé
    sugg = CONJ_C.get(lem, {}).get(mt, {}).get(per + nb)
    if not sugg: return None
    if not _agrees(_reads(sugg), per, nb):
        return None                                             # garde : la suggestion doit VRAIMENT s'accorder (anti-bruit Lexique)
    return sugg


def rule_accord_sv_recover(T, i):
    """« le pronom PLURIEL est révélateur » (idée Rem) : ils/elles + verbe MAL conjugué ABSENT du lexique
    (« elles sente », forme subjonctive/dys que _reads ne connaît pas → rule_accord_sv est aveugle). Un sujet 3p
    rend le verbe fautif quel que soit le mode (« qu'elles sente » = « sentent » aussi) → récupération FP=0 :
    le pluriel présent finit en -ent, donc si (radical + ent) est une forme 3p CONFIRMÉE par le lexique, on corrige.
    Mesuré : 0 flag sur 14 450 phrases UD correctes (le déclencheur exige une forme INCONNUE après ils/elles, que le
    texte correct ne produit jamais)."""
    if not CONJ_LOADED or "'" in T[i].lower(): return None
    if T[i].lower().endswith(('é', 'és', 'ée', 'ées')): return None   # participe (temps composé) → pas un présent à accorder
    dw = deacc(T[i].lower())
    if len(dw) < 4 or _reads(T[i]): return None                  # forme CONNUE → rule_accord_sv s'en occupe déjà
    if _subject_before(T, i) != ('3', 'p'): return None          # sujet-pronom PLURIEL net (ils/elles) uniquement — l'ancre fiable
    if (i >= 1 and deacc(T[i-1].lower()) in FULL_AUX) or (i >= 2 and deacc(T[i-2].lower()) in FULL_AUX):
        return None                                              # aux + participe (« elles sont venue ») → pas ici
    bases = []
    if dw.endswith('es'): bases.append(dw[:-2])                  # « sentes » → sent
    if dw.endswith('e'): bases.append(dw[:-1])                   # « sente »  → sent
    for base in bases:
        cand = base + 'ent'
        if cand == dw: continue
        # SÛR : n'accepter que la lecture 3e pers. STRICTEMENT PLURIELLE (n=='p'). ⚠️ -ent n'est PAS un gage de pluriel :
        # « vient/tient/devient » = 3SG en -ent, et la famille venir a un nombre CORROMPU dans Lexique (vient tagué 'x',
        # viennent tagué 's') → 'x' pas sûr non plus. n=='p' rejette vient/viennent → 0 mauvaise correction (« elles vies »
        # ne devient PAS « vient »). Coût = famille venir/voir(x) ratée = raté SÛR (jamais un faux positif).
        if len({l for (l, _mt, p, _n) in _reads(cand) if p == '3' and _n == 'p'}) == 1:
            return _keepcase(T[i], cand)
    return None


# ---------- Confusion d'USAGE être ↔ avoir (faute dys courante) : « il est faim »→« il a faim », « il a allé »→« il est allé »
# FP=0 par LISTES FERMÉES (un seul auxiliaire grammaticalement possible) : idiomes d'AVOIR, participes de verbes
# INTRANSITIFS d'ÊTRE, l'âge. On ne swappe QUE sur ces déclencheurs ; l'aux doit DÉJÀ s'accorder (sinon rule_accord_sv).
AVOIR_IDIOM = {'faim', 'soif', 'sommeil', 'raison', 'tort', 'envie', 'besoin', 'peur'}   # « être + X » impossible
# participes de verbes INTRANSITIFS purs (« avoir + X » impossible). Set EXPLICITE déjà désaccentué (⚠️ un autre ETRE_PP
# existe plus bas pour rule_jest → nom distinct AUX_ETRE_PP pour éviter la collision/écrasement de variable globale).
AUX_ETRE_PP = {'alle', 'allee', 'alles', 'allees', 'venu', 'venue', 'venus', 'venues', 'arrive', 'arrivee', 'arrives', 'arrivees',
               'parti', 'partie', 'partis', 'parties', 'devenu', 'devenue', 'devenus', 'devenues', 'revenu', 'revenue', 'revenus', 'revenues',
               'reste', 'restee', 'restes', 'restees', 'ne', 'nee', 'nes', 'nees', 'mort', 'morte', 'morts', 'mortes',
               'decede', 'decedee', 'decedes', 'decedees', 'reparti', 'repartie', 'repartis'}

def rule_aux_usage(T, i):
    if not CONJ_LOADED or "'" in T[i].lower(): return None
    reads = _reads(T[i])
    if not reads: return None
    lemmas = {l for (l, _mt, _p, _n) in reads}
    if not ({'etre', 'avoir'} & lemmas): return None             # pas un auxiliaire être/avoir
    pn = _subject_before(T, i)
    if pn is None and i > 0:                                     # nous/vous SUJET : sûrs SEULEMENT si l'aux est la forme 1p/2p correspondante
        pv = deacc(T[i - 1].lower())
        if pv == 'nous' and any(p == '1' and n == 'p' for (_l, _m, p, n) in reads): pn = ('1', 'p')
        elif pv == 'vous' and any(p == '2' and n == 'p' for (_l, _m, p, n) in reads): pn = ('2', 'p')
    if pn is None: return None
    per, nb = pn
    if not _agrees(reads, per, nb): return None                  # l'aux s'accorde déjà (sinon = rule_accord_sv)
    if per == '1' and nb == 's': return None                     # « je » → forme élidée (j'ai) → différé v2
    mts = [mt for (_l, mt, _p, _n) in reads]
    mt = 'ind:pre' if 'ind:pre' in mts else ('ind:imp' if 'ind:imp' in mts else None)
    if mt is None: return None
    nxt = deacc(T[i + 1].lower()) if i + 1 < len(T) else ''
    age = ('etre' in lemmas and nxt in ('ans', 'an'))            # « être + [nombre] ans » (toks retire le chiffre) → AVOIR
    if 'etre' in lemmas and (nxt in AVOIR_IDIOM or age):         # ÊTRE devant idiome d'avoir / âge → AVOIR
        return CONJ_C.get('avoir', {}).get(mt, {}).get(per + nb)
    if 'avoir' in lemmas and nxt in AUX_ETRE_PP:                 # AVOIR devant participe de verbe d'être → ÊTRE
        return CONJ_C.get('etre', {}).get(mt, {}).get(per + nb)
    return None


# ---------- Auxiliaire être/avoir MAL ORTHOGRAPHIÉ (faute dys n°1) : « je sui »→suis, « nous avon »→avons, « vous ete »→êtes
# Après un sujet-pronom net, si le mot n'est PAS une forme valide accordée mais est à ≤2 éditions d'UNE forme être/avoir
# accordée → on corrige. ABSTENTION si ambigu entre être et avoir (anti-swap) ou si c'est déjà un autre verbe valide.
def _lev(a, b):
    if abs(len(a) - len(b)) > 2: return 9
    prev = list(range(len(b) + 1))
    for ia, ca in enumerate(a, 1):
        cur = [ia]
        for jb, cb in enumerate(b, 1):
            cur.append(min(prev[jb] + 1, cur[jb - 1] + 1, prev[jb - 1] + (ca != cb)))
        prev = cur
    return prev[-1]

def _aux_targets(per, nb):                                       # formes être/avoir accordées (présent + imparfait) : (déacc, verbe, forme)
    out = []
    for v in ('etre', 'avoir'):
        for m in ('ind:pre', 'ind:imp'):
            f = CONJ_C.get(v, {}).get(m, {}).get(per + nb)
            if f: out.append((deacc(f), v, f))
    return out

# TOUTES les formes être/avoir (tous temps, désaccentué) — un mot qui en fait partie est un aux VALIDE : ne jamais le « corriger »
FULL_AUX = set((
    'suis es est sommes etes sont etais etait etions etiez etaient fus fut fumes futes furent '
    'serai seras sera serons serez seront serais serait serions seriez seraient sois soit soyons soyez soient '
    'fusse fusses fussions fussiez fussent '       # participes (été/étant/eu/ayant) VOLONTAIREMENT exclus : juste après un
    'ai as a avons avez ont avais avait avions aviez avaient eus eut eumes eutes eurent '   # pronom sujet, un participe seul = aux
    'aurai auras aura aurons aurez auront aurais aurait aurions auriez auraient aie aies ait ayons ayez aient '   # manquant/mal écrit → corrigible
    'eusse eusses eussions eussiez eussent').split())

# Mots fréquents à ≤1 édition d'une forme aux longue (avec≈avez, avant≈avait…) mais qui ne sont JAMAIS un aux mutilé → ne pas corriger
NON_AUX = set('avec avant apres dans pour sur sous vers chez sans mais donc alors aussi tres plus tout tous leur leurs cette cela elle elles entre selon ainsi'.split())

def rule_aux_misspell(T, i):
    if not CONJ_LOADED or "'" in T[i].lower(): return None
    w = deacc(T[i].lower())
    if len(w) < 3 or not w.isalpha(): return None                # ≥3 lettres (les mots-outils courts « ne »/« le »/« se » ne sont jamais un aux mutilé)
    if w in FULL_AUX or w in NON_AUX: return None                # déjà une forme être/avoir valide, ou un mot fréquent proche (avec/avant) → ne pas toucher
    pn = _subject_before(T, i)
    if pn is None and i > 0 and deacc(T[i - 1].lower()) in ('nous', 'vous'):
        pn = ('1', 'p') if deacc(T[i - 1].lower()) == 'nous' else ('2', 'p')
    if pn is None: return None
    per, nb = pn
    if per == '1' and nb == 's': return None                     # « je » → élision (j'ai) différée v2
    reads = _reads(T[i])
    if reads and _agrees(reads, per, nb): return None            # déjà une forme valide accordée → ne pas toucher
    best_d, best_f, best_v = 9, None, None
    for (dform, verb, aform) in _aux_targets(per, nb):
        if len(dform) < 4: continue                              # SEULES les formes LONGUES (avons/êtes/étions/avait…) ; jamais a/as/ai/es : ces cibles courtes attrapent ne/le/se/me
        d = _lev(w, dform)
        if d < best_d: best_d, best_f, best_v = d, aform, verb
        elif d == best_d and verb != best_v: best_v = 'AMBIG'    # à égale distance d'être ET d'avoir → ambigu
    if best_f is None or best_d > 1: return None                 # distance ≤1 stricte (une seule lettre absente/fausse) — anti-FP à l'échelle
    if best_v == 'AMBIG': return None                            # anti-swap : on ne devine pas être vs avoir
    if reads and best_d > 1: return None                         # mot déjà reconnu (autre verbe) : n'y toucher que si TRÈS proche (≤1)
    if w == deacc(best_f.lower()): return None
    return best_f


def _noun_subject_number(T, i):
    """Nombre du sujet-NOM avant le verbe i (3e personne). Saute les clitiques objets (« le chat LES regarde » :
    « les » = pronom, pas déterminant pluriel), puis prend le déterminant gouverneur (en sautant les dét. de
    groupe prépositionnel). Renvoie (nombre 's'|'p', index_du_déterminant) ou None. Pronom → None (autre règle)."""
    j = i - 1; steps = 0
    while j >= 0 and steps < 2 and deacc(T[j].lower()) in CLITIC: j -= 1; steps += 1
    for k in range(j, -1, -1):
        w = deacc(T[k].lower())
        if w in NUM_PRON: return None                                  # sujet pronom → règle pronom
        if T[k].lower() in NUM_DET:
            if k > 0 and deacc(T[k-1].lower()) in PREP: continue        # déterminant de PP → continuer (vrai sujet plus à gauche)
            return ('s' if NUM_DET[T[k].lower()] == 'sg' else 'p', k)
    return None


# Mots qui « cassent » le groupe sujet→verbe (sous-phrase, PP, coordination, 2e GN) : si l'un apparaît ENTRE le
# déterminant sujet et le verbe, la structure est trop complexe pour un accord sûr sans analyse → on s'abstient (FP=0).
CONJ_WORDS = {'et', 'ou', 'ni', 'mais', 'car', 'donc', 'or', 'que', 'qu', 'qui', 'quand', 'comme', 'si',
              'lorsque', 'puisque', 'dont', 'lequel', 'laquelle', 'lesquels', 'lesquelles'}


def rule_accord_sv_noun(T, i):
    if not CONJ_LOADED or "'" in T[i].lower() or T[i].lower() == 'à': return None   # « à » (prép.) ≠ « a » (avoir) — déacc les confond
    if T[i].lower().endswith(('é', 'és', 'ée', 'ées')): return None     # PARTICIPE (destiné/déchargé…) : accord ADJECTIVAL (destinés), pas verbal (destinent) — deacc destiné→destine=destiner-3sg trompait la règle
    if i > 0 and T[i-1].lower() in NUM_DET: return None                 # déterminant juste avant → T[i] est un NOM (« les joue »)
    if _subject_before(T, i) is not None: return None                  # sujet pronom net → règle pronom (pas ici)
    p3 = [(l, mt, p, n) for (l, mt, p, n) in _reads(T[i]) if p == '3']  # sujet-nom = 3e personne
    if not p3: return None
    sub = _noun_subject_number(T, i)
    if sub is None: return None
    nb, dk = sub
    # FP=0 SANS lexique de noms : déterminant PLURIEL (les/des/ces…) EN TÊTE de phrase (dk==0). En tête, aucun
    # génitif/PP/objet-de-verbe possible à gauche (rien ne précède) → on évite tous ces pièges (« la préparation
    # DES mahashi », « protéger LES infrastructures ») sans dépendre d'un lexique de noms (→ parité app↔Python).
    if nb != 'p' or dk != 0 or i - dk < 2: return None                 # +il faut un nom-tête entre le déterminant et le verbe
    # GARDE STRUCTURE : le nom-tête (dk+1, homographe « voitures » toléré) ; tout PP / 2e déterminant / pronom /
    # conjonction, ou un VERBE intercalé APRÈS le nom-tête (sous-phrase « les feuilles TOMBENT, l'automne est ») → abstention.
    for m in range(dk + 1, i):
        tok = T[m]; dw = deacc(tok.lower())
        if "'" in tok.lower() or dw in PREP or dw == 'en' or tok.lower() in NUM_DET or dw in NUM_PRON or dw in CONJ_WORDS or dw in FULL_AUX:
            return None                                                  # +aux (auraient/avait/sont…) + « en » (PP/clitique : « pris EN compte ») entre le nom et le verbe → abstention
        if any(ch in ',;:()[]«»"' for ch in tok):
            return None                                                  # ponctuation intercalée = apposition/énumération (« Les établissements, résidence (demeure), … ») → abstention
        if m > dk + 1 and _reads(tok):
            return None
    _tg = pos_tags(T)                                                    # apposition/énumération : ≥2 noms entre le déterminant et le
    if _tg and sum(1 for m in range(dk + 1, i) if _tg[m] in ('NOUN', 'PROPN')) >= 2:  # verbe (« Les établissements, résidence, demeure… »)
        return None                                                      # → le vrai verbe est ailleurs, un nom-homographe est pris pour verbe → abstention. (Adjectif toléré : « les grands chiens » = 1 nom.)
    if any(n == nb or n == 'x' for (_l, _mt, _p, n) in p3): return None  # déjà d'accord
    lemmas = {l for (l, _mt, _p, _n) in p3}
    if len(lemmas) != 1: return None
    lem = lemmas.pop()
    mts = [mt for (_l, mt, _p, _n) in p3]
    mt = 'ind:pre' if 'ind:pre' in mts else mts[0]
    sugg = CONJ_C.get(lem, {}).get(mt, {}).get('3' + nb)
    if not sugg: return None
    if not any(p == '3' and (n == nb or n == 'x') for (_l, _mt, p, n) in _reads(sugg)):
        return None
    return sugg


def _pure_adj(w):
    """Adjectif NON ambigu : forme adjectivale genrée qui n'est NI un verbe NI un nom (sinon homographe → FP)."""
    d = deacc(w.lower())
    return d in ADJ_LEX and d not in VERB_LEX and d not in D.GENDER_LEX

def _head_noun_gender(T, i):
    """Genre du nom-tête, en ne retenant que des noms PURS (ni adjectif ni verbe) — évite de prendre « rouges »/« écrit »."""
    for rng in (range(i-1, max(-1, i-4), -1), range(i+1, min(len(T), i+3))):
        for j in rng:
            w = T[j].lower()
            if w in D.NUM_PRON or deacc(w) in PREP: break
            d = deacc(w)
            if d in D.GENDER_LEX and d not in ADJ_LEX and d not in VERB_LEX:
                return D.GENDER_LEX[d]
    return None

def rule_genre_adj(T, i):
    """Accord en GENRE de l'adjectif via le lexique. ⚠️ NON BRANCHÉ (mesuré FP-INSÛR) : presque toutes les formes
    adjectivales sont aussi des NOMS dans Lexique4 (blanche/noire = notes, grande, vert = couleur…). Le filtre
    « adjectif pur » sûr (≠ verbe ≠ nom) ne laisse alors quasi rien (det 0/3) ; sans filtre il flague du juste
    (maîtresse/écrit → FP). Conclusion : l'accord en genre dans le CORRECTEUR exige un vrai POS en contexte
    (tagger), pas la seule appartenance lexicale. La route lexicale du genre reste utilisée dans le DIAGNOSTIC
    (diag_sentence.lexical_gender), où elle ne se déclenche que sur une erreur d'accord détectée (sûr, mesuré 3/3)."""
    if not _pure_adj(T[i]):
        return None
    g_adj, alt = ADJ_LEX[deacc(T[i].lower())]
    gn = _head_noun_gender(T, i)
    if gn and gn != g_adj:
        return alt
    return None

# ---------- Accord GENRE déterminant→nom (route lexicale : déterminant figé × cgram_gender) ----------
# Le « gros du réel » (corpus GEC) : « un adhésion »→une, « la fondateur »→le, « Ma appartement »→Mon.
# Différent de rule_genre_adj (NON branchée, FP-insûre) : ici le déterminant a un genre CERTAIN, et on
# n'accepte qu'un NOM PUR juste après (genre non ambigu, NI adjectif NI verbe) → écarte le/la pronom-objet
# (« je le vois » : vois=verbe), les homographes (poste, tour, livre : hors cgram_gender), les adjectifs.
DET_GENDER = {'un':'m','une':'f','le':'m','la':'f','ce':'m','cet':'m','cette':'f',
              'mon':'m','ma':'f','ton':'m','ta':'f','son':'m','sa':'f',
              'quel':'m','quelle':'f'}   # quel/quelle = adjectifs interrogatifs/exclamatifs → accord de GENRE avec le nom-tête (« quel maison »→quelle)
DET_ALT = {('un','f'):'une',('une','m'):'un',('le','f'):'la',('la','m'):'le',
           ('ce','f'):'cette',('cet','f'):'cette',('cette','m'):'ce',
           ('mon','f'):'ma',('ma','m'):'mon',('ton','f'):'ta',('ta','m'):'ton',
           ('son','f'):'sa',('sa','m'):'son',
           ('quel','f'):'quelle',('quelle','m'):'quel'}

def _keepcase(src, sugg):
    return sugg[:1].upper() + sugg[1:] if src[:1].isupper() else sugg

# Genre de NOMS PURS (cgram_hf.json 'gn' = genre non ambigu MOINS verbes MOINS adjectifs). MÊME source que
# l'app (vdc-lex 'gn') → parité EXACTE. Pré-filtré : pas de re-vérif verbe/adjectif (les homographes « porte »,
# « rouge » sont déjà exclus). Si cgram_hf absent : pas de règle genre-déterminant (abstention totale).
GENDER_PURE = {}
_HF_PATH = os.path.join(HERE, 'cgram_hf.json')
if os.path.exists(_HF_PATH):
    try: GENDER_PURE = json.load(open(_HF_PATH, encoding='utf-8')).get('gn', {})
    except Exception: pass
# RELAXATION (mesurée FP=0, +1 GEC) : on ÉTEND aux noms verbe-homographes (« voiture », « table ») que « gn »
# excluait, via cgram_gender_relaxed.json = cgram_gender MOINS les adjectifs POS 'A' (épicènes inclus → « jeune »
# exclu, FP « sa jeune fille » bordé). Source unique = build_gender_relaxed.py (mêmes données pour l'app).
_GREL_PATH = os.path.join(HERE, 'cgram_gender_relaxed.json')
if os.path.exists(_GREL_PATH):
    try:
        _grel = json.load(open(_GREL_PATH, encoding='utf-8'))
        for _w, _g in _grel.items():
            GENDER_PURE.setdefault(_w, _g)          # union : garde gn, ajoute les noms purs supplémentaires
    except Exception: pass

def rule_det_gender(T, i):
    lw = deacc(T[i].lower())
    if lw not in DET_GENDER or "'" in T[i].lower(): return None
    if i + 1 >= len(T): return None
    g_det = DET_GENDER[lw]
    nxt_raw = T[i+1].lower()
    if "'" in nxt_raw: return None                                  # élision (l'arbre) → genre caché, abstention
    nd = deacc(nxt_raw)
    if len(nd) < 2 or not nd.isalpha(): return None                # fragment (œ cassé en « s »/« ur » par toks) → abstention
    if lw in ('son', 'mon', 'ton') and nd[:1] in 'aeiouyh':        # son/mon/ton OBLIGATOIRES devant voyelle/h (son amie,
        return None                                                # son Histoire) — correct même au féminin → JAMAIS un FP
    if T[i+1][:1].isupper() or nd in DET_SKIP: return None         # nom propre/étranger (capitalisé) OU adverbe/adj/prép. avant le vrai nom-tête → abstention (FP)
    _pp = NOUN_POST.get(nd)                                        # GARDE §3 (posterior fréquentiel) : le suivant doit être CONFIDEMMENT un NOM
    if not (_pp and _pp[0] >= PL_TAU_M): return None   # GARDE §3 genre RELAXÉE : NOM confiant (P(NOM)≥τ) ; garde verbe levée — mot après déterminant = NOM même si verbe-homographe (recall 66,8→72,7 %, FP 0,09→0,10/1000, gender_levers_ud.py)
    g_noun = GENDER_PURE.get(nd)                                   #   (l'ambiguïté de GENRE — « tour » m+f — reste couverte par GENDER_PURE)
    if g_noun not in ('m', 'f') or g_noun == g_det: return None    # nom inconnu/ambigu/homographe → abstention ; ou accord OK
    sugg = DET_ALT.get((lw, g_noun))
    return _keepcase(T[i], sugg) if sugg else None


# Mots après lesquels « tout » n'est PAS un déterminant (prépositions, « le tout » = nom, idiomes « avant/après/en tout »).
TOUT_LSTOP = PREP | set(NUM_DET) | {'avant', 'apres', 'après', 'en', 'comme', 'selon', 'sauf', 'envers',
                                    'durant', 'pendant', 'hormis', 'outre', 'moyennant', 'suivant', 'concernant'}
def rule_tout_det(T, i):
    # « tout/toute » (forme SINGULIÈRE) DÉTERMINANT + déterminant + NOM confiant s'accorde en genre ET nombre avec son
    # groupe : « tout les jours »→tous, « toute les semaines »→toutes (nombre) ; « tout cette mascarade »→toute, « toute
    # le pays »→tout (genre). Nombre = déterminant (les/des→pl, le/la→sg ; classe fermée fiable) ; genre = nom-tête
    # confiant (GENDER_PURE). FP=0 : on ne déclenche que sur le SINGULIER (tout/toute) — le quantifieur FLOTTANT
    # (« ils ont tous une chambre ») est toujours PLURIEL, donc jamais confondu. Gardes : « tout » précédé d'une
    # prép./déterminant/idiome (« avant tout les… », « le tout, les… ») OU séparé du déterminant par une frontière =
    # autre rôle (pronom/nom/adverbe) → abstention.
    # DIFFÉRÉ (FP-risqué) : sens inverse forme PLURIELLE (« tous le monde »→tout, « tous les actions »→toutes = quantifieur
    # flottant), rôle ADVERBE (« tout contente »→toute, invariable sauf fém.+consonne/h-aspiré), rôle PRONOM.
    lw = deacc(T[i].lower())
    if lw not in ('tout', 'toute'): return None
    if i + 2 >= len(T): return None
    num = NUM_DET.get(deacc(T[i+1].lower()))
    if num is None: return None                                    # le mot suivant doit être un DÉTERMINANT (sinon autre rôle)
    if _SEG is not None and i+1 < len(_SEG['bb']) and _SEG['bb'][i+1]: return None   # frontière « tout | déterminant » (« le tout, les… ») → abstention
    if prev(T, i) in TOUT_LSTOP: return None                       # prép./dét./idiome avant « tout » → pronom/nom/adverbe, pas déterminant
    if "'" in T[i+2].lower(): return None                          # nom-tête élidé (l'…) → genre caché → abstention
    nd = deacc(T[i+2].lower())
    pp = NOUN_POST.get(nd)
    if not (pp and pp[0] >= PL_TAU_M): return None                 # le mot après le déterminant doit être un NOM confiant
    g = GENDER_PURE.get(nd)
    if g not in ('m', 'f'): return None                            # genre inconnu/ambigu → abstention
    target = ('tous' if g == 'm' else 'toutes') if num == 'pl' else ('tout' if g == 'm' else 'toute')
    return _keepcase(T[i], target) if target != lw else None


def rule_met_mais(T, i):
    # « je/tu/il/on/ils » sont des clitiques sujets PURS : ils sont TOUJOURS suivis de leur verbe et ne peuvent JAMAIS
    # être objet de préposition (c'est lui/eux/moi/toi qui le sont). Donc « [pronom] mais … » → forme de METTRE
    # (« il mais son manteau »→met). FP=0 par construction. « elle/elles » sont EXCLUS : ils sont leur propre pronom
    # disjoint (« derrière elle mais… », « avec elles mais… ») → « mais » y est la vraie conjonction (raté assumé).
    if deacc(T[i].lower()) != 'mais': return None
    if _SEG is not None and i < len(_SEG['bb']) and _SEG['bb'][i]: return None   # frontière avant → pas de sujet net
    p = prev(T, i)
    if p in ('je', 'tu'):  return 'mets'
    if p in ('il', 'on'):  return 'met'
    if p == 'ils':         return 'mettent'
    return None

def rule_mais_mes(T, i):
    """« mais » devant un NOM (≠ prép/dét/pronom/verbe) → « mes » (« mais lunettes »→« mes lunettes »). FP=0 mesuré
    (garde PREP : « Mais, sous… » abstenu car sous=préposition). Homophone dys fréquent, hors des 8 d'origine."""
    if deacc(T[i].lower()) != 'mais' or i + 1 >= len(T):
        return None
    if i == 0 or (_SEG is not None and i < len(_SEG['ss']) and _SEG['ss'][i]): return None   # « Mais … » en tête de phrase = conjonction, jamais « mes »
    nx = T[i + 1].lower(); dn = deacc(nx)
    if dn in MAIS_STOP:                                 # adverbe/mot-outil (homographe nom : « pas », « point ») → « mais »
        return None                                    #   conjonction, jamais « mes » (« mais pas »/« mais comment » corrects)
    if dn in PREP or nx in NUM_DET or dn in NUM_PRON or dn in VERB_LEX:
        return None                                    # pas prép/déterminant/pronom/verbe
    return 'mes' if dn in GENDER_PURE else None        # le mot suivant est un nom genré connu

# Adjectifs prédicatifs PURS (≠ verbe/nom/participe) — « j'est <adj> » → « je suis <adj> » (être copule). Liste
# CLOSE volontaire = PARITÉ stricte app/extension/Python (pas de divergence de lexique HF). Désaccentué.
CADJ = set("content contente contents contentes malade malades triste tristes heureux heureuse heureuses "
           "pret prete prets pretes libre libres seul seule seuls seules fier fiere fiers fieres".split())
# Participes de verbes d'ÊTRE (non ambigus, sans collision déacc — « né »/« mort »/« passé » exclus : homographes) :
# « j'est allé » → « je suis allé ». Liste CLOSE = parité 3 moteurs.
ETRE_PP = set("alle allee alles allees venu venue venus venues parti partie partis parties "
              "arrive arrivee arrives arrivees devenu devenue devenus devenues revenu revenue revenus revenues".split())
PART_ART = {'le', 'la', "l'", 'les', 'un', 'une'}   # article après « de » → partitif AVOIR (« j'ai de la peine »)


def rule_jest(T, i):
    """« j'est » (j' + est) n'est JAMAIS valide → la règle ne se déclenche que sur « j'est », donc FP=0 STRUCTUREL.
    Suggestion bornée aux contextes SÛRS : déterminant / « été »-« eu » / partitif (du, des, de+article) → « j'ai »
    (avoir) ; adjectif PUR ou participe de verbe d'ÊTRE → « je suis ». Participe d'AVOIR (« j'est entendu ») ou
    « de » + nom propre (« j'est de Paris ») = auxiliaire ambigu → abstention (contexte)."""
    if deacc(T[i].lower()) != "j'est" or i + 1 >= len(T):
        return None
    nxt = T[i + 1]; nl = nxt.lower(); dn = deacc(nl)
    if nl in NUM_DET or dn in ('ete', 'eu') or dn in ('du', 'des'):                 # avoir certain (déterminant / été-eu / partitif du-des)
        return _keepcase(T[i], "j'ai")
    if nl in ('de', "d'"):                                                          # possession → j'ai : « j'ai de la peine » (partitif) ET « j'est de tomates » (de + nom COMMUN)
        if i + 2 < len(T) and (T[i + 2].lower() in PART_ART or (T[i + 2][:1].isalpha() and not T[i + 2][:1].isupper())):
            return _keepcase(T[i], "j'ai")
        return None                                                                # « j'est de Paris » (de + nom PROPRE) = origine « je suis de… » → abstention
    if dn in CADJ or dn in ETRE_PP:                     # adjectif PUR ou participe de verbe d'ÊTRE → je suis (liste close = parité 3 moteurs)
        return _keepcase(T[i], "je suis")
    if _is_ppl(nxt):                                    # participe d'AVOIR (pris/mangé/fait/vu…) — les participes d'ÊTRE sont déjà traités → j'ai
        return _keepcase(T[i], "j'ai")
    return None


def rule_cai(T, i):
    """« c'ai » (c' + ai) est TOUJOURS invalide → « c'est » : confusion avoir/être (le « vice-versa » de j'est→j'ai).
    FP=0 (« c'ai » n'existe jamais en français)."""
    return _keepcase(T[i], "c'est") if deacc(T[i].lower()) == "c'ai" else None


# Élision fautive DEVANT CONSONNE : une forme élidée n'est valide que devant voyelle → devant consonne = TOUJOURS
# faute (FP=0 STRUCTUREL). Clitiques DÉTERMINISTES uniquement (j'/n'/m'/d'/c'/qu') → parité triviale (aucun lexique).
# EXCLUS : t' (te/tu), s' (se/si) ambigus ; l' (le/la = genre) ; h (« l'homme » = h muet, élision correcte) ; y (« j'y »).
_ELIDE = {"j'": 'je', "n'": 'ne', "m'": 'me', "d'": 'de', "c'": 'ce', "qu'": 'que'}
_ELIDE_CONS = set("bcdfgjklmnpqrstvwxz")
_ELIDE_STOP = {"n'roll", "m'sieur"}   # emprunt (rock n'roll) / familier (m'sieur = monsieur) : ne pas de-élider


def rule_elide(T, i):
    w = T[i]; lw = w.lower()
    if lw in _ELIDE_STOP:
        return None
    for pre, full in _ELIDE.items():
        if lw.startswith(pre):
            rest = w[len(pre):]
            # de-élide ssi rest commence par une consonne MINUSCULE (≠ voyelle/h/y ; ≠ NOM PROPRE « N'Dour »/« M'Tioua »)
            if rest and rest[0].islower() and deacc(rest[0].lower()) in _ELIDE_CONS:
                return _keepcase(w, full + ' ' + rest)
            return None
    return None


# ---------- Accord PLURIEL du NOM (déterminant pluriel + nom singulier) — la faute dys n°1 ----------
PLURAL_DET = {w for w, v in NUM_DET.items() if v == 'pl'}   # ces/des/les/leurs/mes/nos/ses/tes/vos (classe fermée, fiable)

# POSTERIOR §3 sur la lecture POS latente — P(POS|forme) en pour-mille (cgram_noun_post.json, dérivé du TSV par build_noun_post.py).
# Remplace la garde binaire nbhomog==0 ∧ POS==NOM du pluriel : on tire ssi P(NOM)≥τ ∧ P(VER)<ε (le danger = masse VERBE, pas « a un homographe »).
NOUN_POST = {}
try:
    with open(os.path.join(HERE, 'cgram_noun_post.json'), encoding='utf-8') as _f:
        NOUN_POST = json.load(_f)
except (OSError, ValueError):
    NOUN_POST = {}
PL_TAU_M, PL_EPS_M, PL_ANCHOR_M = 500, 10, 300   # P(NOM)≥0.5 / P(VER)<0.01 / ancre P(NOM)≥0.3 (en ‰) — mesuré ε=0.01 : +3 récup., +1 FP (UD)

def _noun_gate(n):                                              # §3 : nom-dominant ET masse verbe négligeable
    p = NOUN_POST.get(deacc(n.lower()))
    return bool(p) and p[0] >= PL_TAU_M and p[1] < PL_EPS_M

def _pluralize_noun(n):
    """Pluriel ANCRÉ DANS LE POSTERIOR (pas de « oiseaus ») : +s / -al→-aux / -au-eu→+x, on garde la forme dont
    la part NOM ≥ 30 % (le pos_of EMBARQUÉ est FAUX pour amis=ADJ/pommes=VER → l'ancre fréquentielle les récupère)."""
    dn = deacc(n.lower()); cands = [n + 's']
    if dn.endswith('al'): cands.append(n[:-2] + 'aux')          # cheval→chevaux (mais bals vérifié d'abord)
    if dn.endswith('au') or dn.endswith('eu'): cands.append(n + 'x')   # oiseau/jeu→+x (-eau finit par -au)
    for c in cands:
        p = NOUN_POST.get(deacc(c.lower()))
        if p and p[0] >= PL_ANCHOR_M: return c                 # forme plurielle majoritairement NOM dans le lexique
    return None

NOUN_PL_STOP = {'minima', 'maxima', 'media', 'data', 'extra', 'intra', 'euros',
                'quanta', 'addenda', 'errata', 'curricula', 'strata'}   # pluriels latins / invariables déjà pluriels

def rule_noun_plural(T, i):
    if i == 0 or prev(T, i) not in PLURAL_DET: return None      # déterminant pluriel juste avant
    n = T[i]
    if not n[:1].isalpha() or n[0].isupper(): return None       # nom propre / capitalisé → abstention (FP)
    dn = deacc(n.lower())
    if len(dn) < 3 or dn[-1] in 'sxz' or dn in NOUN_PL_STOP: return None   # trop court (unité kg/cm) / déjà pluriel / invariant
    if not _noun_gate(n): return None                           # GARDE §3 : P(NOM)≥0.5 ∧ P(VER)<0.01 (posterior fréquentiel) — exclut
    #   « les porte/livre » (masse verbe) et « les rouge » (ADJ-dom, P(NOM)<0.5) ; récupère ami/voiture/faute que la garde nbhomog ratait.
    #   (Ancien : nbhomog==0 ∧ POS==NOM lu sur le tag DUR embarqué — faux pour faute=VER/amis=ADJ. Relaxe naïve nbhomog<=1 = REJETÉE, +25 FP.)
    nx = T[i + 1] if i + 1 < len(T) else ''
    if nx[:1].islower() and nx.isalpha():                       # nom composé (« hit parade », « vice président », « tour opérateur ») :
        pp = NOUN_POST.get(deacc(nx.lower()))                   #   nom + nom → 1er élément souvent invariable → abstention
        if pp and pp[0] >= PL_TAU_M and deacc(nx.lower()) not in ADJ_LEX: return None   # (« français » = adj-nom → PAS un composé : « les département français » corrigé)
    pl = _pluralize_noun(n)
    return pl if (pl and deacc(pl.lower()) != dn) else None

# a/à, on/ont, son/sont, mais/mes, et/est, ce/se, peu : homophones À RÔLE GRAMMATICAL (verbe vs prép/det/conj).
# Restés EN ROUGE : on les tranche par la GRAMMAIRE (sujet, accord, couche segments, pronoms collés), pas par
# « vigilance verte » (= simplification). FP=0 par cadre syntaxique forcé (audit UD 2026-06-30 : durcis).
def rule_ca_sa(T, i):
    # Homophone « ça » (pronom démonstratif) ↔ « sa » (déterminant possessif). DEUX sens FP=0 :
    #  • sa→ça : « sa » précède TOUJOURS un nom ; un PRONOM CLITIQUE ne peut jamais suivre « sa » → c'est « ça »
    #    (« sa me fait rire », « sa se passe », « sa ne va pas »). FP=0 blindé (un clitique n'est pas un nom).
    #  • ça→sa : « ça » (pronom) ne précède JAMAIS un nom nu (il précède verbe/adverbe/clitique) → « ça » + NOM confiant
    #    = possessif : « ça maison »→sa, « ça vélo »→son, « ça amie »→son (sa+voyelle→son). Garde NOM STRICTE
    #    (P(NOM)≥τ ∧ P(VER)<ε) → « ça marche/change » (verbe) écarté ; frontière/sigle/élision → abstention.
    # NB : « sa + verbe » (« sa va ») non couvert (noms féminins homographes d'un verbe en -er : marche, banque…).
    lw = deacc(T[i].lower())
    if lw == 'sa':
        if i + 1 < len(T) and deacc(T[i+1].lower()) in CLITIC:
            return _keepcase(T[i], 'ça')
        return None
    if lw == 'ca':                                                    # « ça » (deacc) → sens ça→sa
        if T[i] == T[i].upper() and T[i] != T[i].lower(): return None # « CA » sigle (chiffre d'affaires…) → abstention
        if i + 1 >= len(T): return None
        if _SEG is not None and i+1 < len(_SEG['bb']) and _SEG['bb'][i+1]: return None   # frontière « ça, X » → « ça » n'est pas déterminant → abstention
        if "'" in T[i+1].lower(): return None
        nd = deacc(T[i+1].lower())
        pp = NOUN_POST.get(nd)
        if not (pp and pp[0] >= PL_TAU_M and pp[1] < PL_EPS_M): return None   # NOM confiant ET pas verbe-homographe (« ça marche » = verbe)
        if T[i+1][:1].lower() in 'aeiouyh': return _keepcase(T[i], 'son')     # voyelle/h → son (sa amie→son amie)
        g = GENDER_PURE.get(nd)
        if g == 'f': return _keepcase(T[i], 'sa')
        if g == 'm': return _keepcase(T[i], 'son')
        return None                                                  # genre inconnu (consonne) → abstention
    return None

RULES = [('-é/-er', rule_e_er), ('son/sont', rule_son_sont), ('on/ont', rule_on_ont),
         ('leur/leurs', rule_leur_leurs), ('a/à', rule_a_aa), ('et/est', rule_et_est),
         ('peu/peux/peut', rule_peu), ('ce/se', rule_ce_se), ("c'est/s'est", rule_cest_sest), ('ça/sa', rule_ca_sa),
         ('met/mais', rule_met_mais), ('mais/mes', rule_mais_mes),
         ("j'est/j'ai", rule_jest), ("c'ai/c'est", rule_cai), ('élision', rule_elide),
         ('accord sujet-verbe', rule_accord_sv),
         ('accord sujet-verbe', rule_accord_sv_recover),
         ('accord sujet-verbe', rule_accord_sv_noun),
         ('genre déterminant', rule_det_gender),
         ('accord tout', rule_tout_det),
         ('accord pluriel nom', rule_noun_plural),
         ('usage être/avoir', rule_aux_usage),
         ('aux mal orthographié', rule_aux_misspell),
         ('majuscule', rule_capital)]   # rule_genre_adj (adjectifs) reste NON branchée (FP-insûre)


def correct(text):
    """-> liste de (index, mot_tapé, suggestion, nom_règle) pour chaque mot jugé fautif."""
    global _SEG
    _SEG = _seg_info(text)                                        # ponctuation/majuscules (sens/contexte) pour la passe de règles
    T = toks(text); out = []
    for i in range(len(T)):
        for name, rule in RULES:
            dec = rule(T, i)
            if dec is not None and dec != T[i] and (name == 'majuscule' or dec.lower() != T[i].lower()):
                out.append((i, T[i], dec, name)); break   # 'majuscule' = changement de CASSE seule (le→Le), légitime
    return out


# ---------- jeu de test : (phrase correcte, mot-déclencheur, forme fautive, règle) ----------
CASES = [
    ("Il a mangé la soupe", "mangé", "manger", "-é/-er"),
    ("Il veut manger la soupe", "manger", "mangé", "-é/-er"),
    ("Elle a préféré rester", "préféré", "préférer", "-é/-er"),
    ("Il met son manteau", "son", "sont", "son/sont"),
    ("Les enfants sont contents", "sont", "son", "son/sont"),
    ("Mes amis sont gentils", "sont", "son", "son/sont"),
    ("Ils ont mangé la tarte", "ont", "on", "on/ont"),
    ("On mange ensemble", "On", "Ont", "on/ont"),
    ("Les chats ont faim", "ont", "on", "on/ont"),
    ("Ils prennent leurs cahiers", "leurs", "leur", "leur/leurs"),
    ("Il caresse leur chien", "leur", "leurs", "leur/leurs"),
    ("Je leur parle souvent", "leur", "leurs", "leur/leurs"),
    ("Elle a trouvé un trésor", "a", "à", "a/à"),
    ("Elle va à Paris", "à", "a", "a/à"),
    ("Il pense à son chien", "à", "a", "a/à"),
    ("Le chat est noir", "est", "et", "et/est"),
    ("Le chien et le chat jouent", "et", "est", "et/est"),
    ("Je peux venir demain", "peux", "peut", "peu/peux/peut"),
    ("Il peut venir demain", "peut", "peux", "peu/peux/peut"),
    ("Il mange un peu de pain", "peu", "peut", "peu/peux/peut"),
    ("Le chat se trouve là", "se", "ce", "ce/se"),
    ("Il prend ce livre", "ce", "se", "ce/se"),
    ("On mange ensemble", "On", "Ont", "on/ont"),
    ("Ils ont fini leur travail", "ont", "on", "on/ont"),
    # accord SUJET-VERBE (route lexicale cgram_conj) — sujet pronom, personne/nombre certains
    ("Je dois partir", "dois", "doit", "accord sujet-verbe"),
    ("Il a faim", "a", "ont", "accord sujet-verbe"),
    ("On a gagné", "a", "ont", "accord sujet-verbe"),
    ("Ils doivent manger", "doivent", "doit", "accord sujet-verbe"),
    ("Elle est contente", "est", "sont", "accord sujet-verbe"),
    # accord sujet-verbe à sujet NOM (déterminant pluriel → verbe pluriel)
    ("Les enfants jouent dehors", "jouent", "joue", "accord sujet-verbe"),
    ("Les oiseaux chantent", "chantent", "chante", "accord sujet-verbe"),
    ("Les voitures roulent vite", "roulent", "roule", "accord sujet-verbe"),
    # accord PLURIEL du NOM (déterminant pluriel + nom singulier → pluriel ancré dans le lexique)
    ("Les enfants jouent", "enfants", "enfant", "accord pluriel nom"),
    ("Des oiseaux chantent", "oiseaux", "oiseau", "accord pluriel nom"),
    ("Les chevaux galopent", "chevaux", "cheval", "accord pluriel nom"),
    ("Il a des difficultés", "difficultés", "difficulté", "accord pluriel nom"),
    # accord GENRE déterminant→nom (route lexicale cgram_gender) — noms PURS non ambigus
    ("Il a un chien", "un", "une", "genre déterminant"),
    ("Elle habite une maison", "une", "un", "genre déterminant"),
    ("Le jardin est vert", "Le", "La", "genre déterminant"),
    ("Il regarde la montagne", "la", "le", "genre déterminant"),
    # confusion d'USAGE être↔avoir (listes fermées : idiomes d'avoir, verbes d'être, âge)
    ("Il a faim", "a", "est", "usage être/avoir"),
    ("Tu as raison", "as", "es", "usage être/avoir"),
    ("Nous avons soif", "avons", "sommes", "usage être/avoir"),
    ("Vous avez peur", "avez", "êtes", "usage être/avoir"),
    ("Il est allé à Paris", "est", "a", "usage être/avoir"),
    ("Elle est partie tôt", "est", "a", "usage être/avoir"),
    ("Ils sont restés ici", "sont", "ont", "usage être/avoir"),
    # auxiliaire être/avoir mal orthographié (distance d'édition vers la forme accordée)
    ("Nous sommes prêts", "sommes", "somme", "aux mal orthographié"),
    ("Vous êtes là", "êtes", "ete", "aux mal orthographié"),
    ("Nous avons un chien", "avons", "avon", "aux mal orthographié"),
    ("Ils sont contents", "sont", "son", "aux mal orthographié"),
    # majuscule : seulement APRÈS . ! ? (jamais le 1er token = fragment). Non testable par ce harnais (il reconstruit
    # sans ponctuation) → vérifié hors-CASES, cf. evo/aux_port_test.js : « il pleut. demain »→Demain.
]


def main():
    print("=== PROBE CORRECTEUR — homophones grammaticaux, SANS corrigé (détection + correction) ===")
    print(f"  couverture verbale : {'Lexique4 cgram (' + str(len(VERB_LEX)) + ' formes)' if CGRAM_LOADED else 'liste blanche stopgap (cgram absent — voir build_cgram.py)'}\n")

    # 1) FAUX POSITIFS sur les 30 phrases CORRECTES du corpus
    fp_corpus = []
    for e in SENT:
        for (i, w, sug, name) in correct(e['text']):
            fp_corpus.append((e['text'], w, sug, name))
    print(f"  [1] Faux positifs sur 30 phrases CORRECTES : {len(fp_corpus)}")
    for txt, w, sug, name in fp_corpus:
        print(f"        ⚠️ flague « {w} »→« {sug} » [{name}]  dans : {txt}")

    # 2) FAUX POSITIFS sur les phrases-témoins correctes (où la forme tapée EST la bonne)
    fp_cases = det = corr = 0
    per = {}
    for (good_sent, trig, wrong, name) in CASES:
        per.setdefault(name, [0, 0, 0])  # [fp, detect, correct]
        # 2a : la phrase CORRECTE ne doit pas flaguer le déclencheur
        flags_ok = correct(good_sent)
        if any(deacc(w.lower()) == deacc(trig.lower()) for (i, w, sug, nm) in flags_ok):
            fp_cases += 1; per[name][0] += 1
        # 2b : injecter la faute → doit DÉTECTER + CORRIGER
        T = toks(good_sent)
        bad = ' '.join(wrong if deacc(t.lower()) == deacc(trig.lower()) else t for t in T)
        flags_bad = correct(bad)
        hit = next(((i, w, sug, nm) for (i, w, sug, nm) in flags_bad if deacc(w.lower()) == deacc(wrong.lower())), None)
        if hit:
            det += 1; per[name][1] += 1
            if hit[2].lower() == trig.lower():
                corr += 1; per[name][2] += 1
    n = len(CASES)
    print(f"\n  [2] Témoins ({n} confusions) :")
    print(f"        faux positifs (forme correcte flaguée à tort) : {fp_cases}/{n}")
    print(f"        DÉTECTION (faute injectée repérée)             : {det}/{n}")
    print(f"        CORRECTION (bonne forme proposée)              : {corr}/{n}")
    print("        par confusion (fp · détection · correction) :")
    for name in [r[0] for r in RULES]:
        if name in per:
            fp, d, c = per[name]; tot = sum(1 for x in CASES if x[3] == name)
            print(f"           {name:10} fp={fp}/{tot}  det={d}/{tot}  corr={c}/{tot}")

    print("\n  Lecture : faux positifs ≈ 0 = on ne « corrige » pas du texte juste (condition n°1 d'un correcteur).")
    print("            détection+correction élevées = le levier d'accord tranche l'homophone SANS corrigé.")
    print("            → si oui, le correcteur dys (détecte, corrige, situe le STADE) est constructible sur l'existant.")


if __name__ == '__main__':
    main()
