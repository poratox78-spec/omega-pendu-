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
import os, sys, json, re
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import diag_sentence as D
from diag_sentence import deacc, toks, is_verb, is_participle, governor_number, NUM_DET, NUM_PRON, PREP

SENT = json.load(open(os.path.join(HERE, 'sentences.json'), encoding='utf-8'))

# Verbes/mots-outils suivis d'un INFINITIF (pour -é/-er). PREP (de/à/pour/sans…) vient de diag_sentence.
MODAL = {'veux','veut','veulent','peux','peut','peuvent','dois','doit','doivent','va','vais','vas','vont',
         'faut','sais','sait','aime','aimes','aiment','adore','espere','souhaite','prefere','preferent',
         'vient','viens','allons','allez','laisse','laissent','semble','ose','vais','pour','sans','afin','de',
         'devons','devez','pouvons','pouvez','voulons','voulez'}   # modaux conjugués 1pl/2pl (+ infinitif)
# Marqueurs de FUTUR (désaccentués) : « je + verbe » ne se décide en futur -ai que si l'un d'eux est présent.
# Sinon « je noté/retourné » est AMBIGU (futur « je noterai » vs passé à auxiliaire tombé « j'ai noté ») → abstention (FP-safe).
FUTURE_MARK = {'demain','bientot','prochain','prochaine','prochains','prochaines','ulterieurement',
               'dorenavant','desormais','tantot'}
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

def _looks_ppl(w):
    """Participe passé au sens LARGE — GARDE anti-FP (abstention seule), PAS pour décider une correction.
    Reconstruit aussi les -u/-i/-is/-it/-é des verbes en -re/-oir/-ire/-uire que _is_ppl (strict, anti-noms) écarte.
    Sur-couvrir est SANS RISQUE ici : « ont + participe » = avoir 3pl, jamais « on » → au pire on rate une
    correction ont→on rare. (Ne JAMAIS réutiliser pour une conversion : trop lâche, il attrape des noms en -é.)"""
    if _is_ppl(w): return True
    lw = w.lower(); d = deacc(lw)
    if len(d) < 3: return False
    if d in IRREG_PART: return True
    if lw.endswith(('é', 'ée', 'és', 'ées')): return True            # participe en -é (orchestré) même si l'infinitif -er manque du lexique
    if d.endswith('us'): d = d[:-1]
    if d.endswith('u') and any(inf in VERB_LEX for inf in (d[:-1]+'re', d+'re', d[:-1]+'oir')):
        return True                                                  # vendu→vendre, conclu→conclure, voulu→vouloir
    if d.endswith(('is', 'it')) and any(inf in VERB_LEX for inf in (d[:-2]+'re', d[:-2]+'ire', d[:-2]+'uire', d[:-2]+'endre', d[:-2]+'ettre', d[:-2]+'aire')):
        return True                                                  # commis→commettre, pris→prendre, déduit→déduire, écrit→écrire, dit→dire, fait→faire
    if d.endswith('i') and (d[:-1]+'re') in VERB_LEX: return True    # suivi→suivre
    return False

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

# --- Terminaisons -er / -é / -ez / -ai (verbe 1er groupe) tranchées par le GOUVERNEUR (test mordre/mordu) ---
# cadre PARTICIPE PASSÉ : avoir ET être (« je suis allez »→allé, « elle est rentrez »→rentré). « j'ai » = 1 token.
_AUX_AV = (set(D.AUX_AVOIR) | set(D.AUX_ETRE)
           | {'avoir', 'avais', 'avaient', "j'ai", 'etre', 'ete', 'etais', 'etait', 'etaient', 'etions', 'etiez',
              'serai', 'seras', 'serez', 'serons', 'soient', 'sois'})
_FLEX_CLITIC = {'se', 'me', 'te'}   # clitiques réfléchis PURS à SAUTER pour trouver le vrai gouverneur (« veut se séparer »). le/la/les EXCLUS (ambigus déterminant : « la cité remonte »=NOM, FP)
_CAUS = {'faire', 'fait', 'fais', 'faisait', 'faisaient', 'font', 'fera', 'feront', 'ferait'}   # causatif « faire + INFINITIF » (« fait déclarer », « faire évoluer ») → infinitif. Déclenché seulement si le mot SUIVANT est un verbe -er (« un fait divers » = adj, non touché)
_INF_GOV = {'de', 'pour', 'sans', 'afin'}                              # prépositions → infinitif (sous-ensemble SÛR de PREP)
_FLEX_STOP = {'assez', 'chez', 'rez', 'nez', 'mai', 'quai', 'vrai', 'gai', 'essai', 'delai',
              'balai', 'geai', 'bai', 'lai', 'quinquennat'}            # homographes -ez/-ai non verbaux
# Noms FÉMININS en -ée homographes d'un participe (stem+er est un vrai verbe) → jamais un infinitif/verbe mutilé.
NOUN_EE = {'fumee', 'pensee', 'entree', 'arrivee', 'portee', 'duree', 'montee', 'annee', 'idee', 'allee',
           'vallee', 'poupee', 'epee', 'assemblee', 'tournee', 'poignee', 'rentree', 'traversee', 'chaussee',
           'gelee', 'flambee', 'plongee', 'rangee', 'nuitee', 'veillee', 'bouchee', 'gorgee', 'cuilleree'}

_FLEX_ADV = {'deja', 'bien', 'toujours', 'jamais', 'pas', 'plus', 'vraiment', 'encore', 'aussi', 'souvent',
             'probablement', 'enfin', 'vite', 'trop', 'meme', 'presque', 'tres', 'tout', 'peut-etre'}   # adverbes intercalés à sauter

def _inf1(w):
    """Infinitif du 1er groupe reconstruit depuis une forme de surface -er/-é(s/e)/-ez/-erai, EN CONSERVANT LES ACCENTS
    (la suggestion ne doit pas désaccentuer). None si ce n'est pas un vrai verbe en -er (le filtre VERB_LEX désaccentué
    écarte berger/premier/nez/mai… = noms/adj homographes)."""
    lw = w.lower(); d = deacc(lw)
    if   lw.endswith('ées'): inf = lw[:-3] + 'er'
    elif lw.endswith('ée'):  inf = lw[:-2] + 'er'
    elif lw.endswith('és'):  inf = lw[:-2] + 'er'
    elif lw.endswith('é'):   inf = lw[:-1] + 'er'
    elif d.endswith('erai'): inf = lw[:-2]                             # futur 1sg : téléphonerai→téléphoner
    elif d.endswith('ez') and len(d) > 3: inf = lw[:-2] + 'er'
    elif d.endswith('er') and len(d) > 3: inf = lw
    else: return None
    return inf if len(inf) >= 4 and deacc(inf) in VERB_LEX else None

def rule_flexion_er(T, i):
    """-er / -é / -ez / -ai d'un verbe du 1er groupe, tranché par le GOUVERNEUR (méthode mordre/mordu) :
    avoir → -é (participe) ; prépo (de/pour/sans/afin) ou modal (veut/peut/doit/va…) → -er (infinitif) ;
    « vous »/inversion « -vous » → -ez (2e pl) ; « je » → -ai (futur 1sg). FP bornés : inf ∈ VERB_LEX, noms
    homographes (NOUN_E/genre/stop) exclus, « vous » objet gardé (« je vais vous aider »=inf)."""
    w = T[i]; lw = w.lower()
    if "'" in lw or i == 0: return None
    if w[:1].isupper() and not (_SEG is not None and i < len(_SEG['ss']) and _SEG['ss'][i]):
        return None                               # mot capitalisé hors début de phrase = nom propre (Rodez, Pompée)
    if _SEG is not None and i+1 < len(_SEG['hy']) and _SEG['hy'][i+1] and nxt(T, i) != 'vous':
        return None                               # mot suivi d'un trait d'union = composé (cessez-le-feu) → sauf inversion « livré-vous »
    inf = _inf1(w)
    if inf is None: return None
    d = deacc(lw)
    if d in NOUN_E or d in _FLEX_STOP or d in NOUN_EE: return None   # noms homographes d'un participe (marché, fumée, portée…)
    stem = inf[:-2]
    forms = {'inf': inf, 'part': stem + 'é', 'p2pl': stem + 'ez', 'fut1': inf + 'ai'}
    # catégorie de terminaison ACTUELLE — on ne réécrit pas si le mot est déjà dans la bonne classe (préserve l'accord : appliquées, classées)
    def _cat(x):
        if x.endswith(('ées', 'ée', 'és', 'é')): return 'part'
        if deacc(x).endswith('erai') or deacc(x).endswith('ai'): return 'fut1'
        if deacc(x).endswith('ez'): return 'p2pl'
        if deacc(x).endswith('er'): return 'inf'
        return None
    cur = _cat(lw)
    praw = T[i-1].lower(); p = deacc(praw)        # GOUVERNEUR IMMÉDIAT (adjacent) pour prépo/modal/vous/je : leurs cas réels sont collés
    hyp_vous = (nxt(T, i) == 'vous' and _SEG is not None and i+1 < len(_SEG['hy']) and _SEG['hy'][i+1])
    if hyp_vous:                                  # inversion « livré-vous ? »/« appeler-vous ? » (trait d'union) → -ez
        tgt = 'p2pl'
    elif praw == 'à' or T[i-1] == 'A' or T[i-1] == 'À':
        tgt = 'inf'                               # « à »/« À » = PRÉPOSITION → infinitif (AVANT avoir : « à » désaccentué = « a »)
    elif p in _AUX_AV or praw == "j'ai":          # avoir immédiat → participe (« avez classez »→classé)
        tgt = 'part'
    elif p in _INF_GOV or p in MODAL or p in _CAUS:   # prépo (de/pour/sans/afin)/modal/causatif (faire+inf) → infinitif
        tgt = 'inf'
    elif praw == 'vous':                          # « vous » sujet → -ez  (OBJET si précédé d'un verbe : « saura vous conseiller »)
        subj = (i == 1) or (_SEG is not None and i-1 < len(_SEG['bb']) and _SEG['bb'][i-1]) \
               or (i >= 2 and deacc(T[i-2].lower()) == 'que')   # « …, vous » / « que vous » = sujet ; « et/qui vous » = objet
        if not subj: return None
        tgt = 'p2pl'
    elif praw == 'je':                            # « je noté/noter » → futur -ai SEULEMENT si marqueur de futur présent
        if not any(deacc(t.lower()) in FUTURE_MARK for t in T): return None   # sinon ambigu (passé à auxiliaire tombé « j'ai noté ») → abstention FP-safe
        tgt = 'fut1'
    elif p == 'plait' and i >= 2 and deacc(T[i-2].lower()) == 'vous':
        tgt = 'p2pl'                              # « s'il vous plaît, cherché »→cherchez (impératif 2e pl poli)
    else:                                         # gouverneur à DISTANCE : sauter adverbes ET clitiques objet/réfléchis
        g = i - 1
        while g > 0 and deacc(T[g].lower()) in (_FLEX_ADV | _FLEX_CLITIC): g -= 1
        if g < 0: return None
        dg = deacc(T[g].lower()); graw = T[g].lower()
        if graw != 'à' and (dg in _AUX_AV or graw == "j'ai"):
            tgt = 'part'                          # avoir/être (+ clitique/adverbe) → participe (« a déjà écouter »→écouté). « à » désaccentué = « a » → NON
        elif dg in _INF_GOV or dg in MODAL or dg in _CAUS:
            tgt = 'inf'                           # prépo/modal/causatif (+ clitique) → infinitif (« veut se séparé »→séparer, « fait déclaré »→déclarer)
        else:
            return None
    if cur == tgt: return None                    # déjà la bonne classe de terminaison (n'écrase pas un accord)
    if lw.endswith(('és', 'ées')) and tgt in ('inf', 'p2pl', 'fut1'):
        return None                               # participe/adj PLURIEL (achetés, présumés) = jamais un infinitif/-ez/-ai mutilé
    if lw.endswith('ée') and tgt != 'part':
        return None                               # -ée = nom/participe FÉMININ (donnée, poussée, mêlée) → jamais un infinitif/-ez/-ai
    sugg = forms[tgt]
    if deacc(sugg) == d: return None
    return sugg[0].upper() + sugg[1:] if w[:1].isupper() else sugg

# --- IMPÉRATIF : motifs LOCAUX (trait d'union + pronom) décidables sans détecter la modalité impérative globale ---
_IMP_PRON = {'moi', 'toi', 'lui', 'le', 'la', 'les', 'leur'}   # pronoms post-impératif OBJET (hors en/y ; nous/vous EXCLUS = inversion « sommes-nous »/« êtes-vous »)
_IMP_IRR = {'soyions': 'soyons', 'ayions': 'ayons', 'soyiez': 'soyez', 'ayiez': 'ayez'}   # formes JAMAIS valides → impératif être/avoir

def rule_imperatif(T, i):
    """Fautes d'impératif à MOTIF LOCAL (FP≈0, pas besoin de reconnaître la modalité globale) :
    1) -s euphonique : « mange-en/-y »→manges-en, « va-y »→vas-y (verbe -er 2sg + trait d'union + en/y) ;
    2) pas de -s : « donnes-lui/-moi… »→donne-lui (verbe -er + -es + trait d'union + pronom ≠ en/y) ;
    3) irrégulier jamais valide : soyions/ayions/soyiez/ayiez → soyons/ayons/soyez/ayez."""
    w = T[i]; lw = w.lower(); d = deacc(lw)
    if "'" in lw: return None
    if d in _IMP_IRR:                                              # 3) forme d'impératif malformée (jamais un mot)
        s = _IMP_IRR[d]; return s[0].upper() + s[1:] if w[:1].isupper() else s
    nx = nxt(T, i)                                                 # mot suivant (déaccentué)
    hyp = _SEG is not None and i+1 < len(_SEG['hy']) and _SEG['hy'][i+1]
    if not hyp: return None
    if i > 0 and (deacc(T[i-1].lower()) == 'ne' or T[i-1].lower() in ("n'", "n’")):
        return None                                               # impératif NÉGATIF (« ne touche-y pas ») : le pronom se déplace (N'y touche pas) → hors motif local
    if nx in ('en', 'y'):                                          # 1) -s euphonique devant en/y
        if _SEG is not None and i+2 < len(_SEG['hy']) and _SEG['hy'][i+2]: return None   # « danse-en-ligne » = composé → pas d'impératif
        if d == 'va': return w + 's'                              # aller → vas-y/vas-en
        if lw.endswith('e') and not lw.endswith('es') and deacc(lw) in VERB_LEX:
            return w + 's'                                        # « mange »/« achète » (forme verbale connue) + en/y → +s
        return None
    if nx in _IMP_PRON and lw.endswith('es') and lw[:-1].endswith('e') and deacc(lw[:-1]) in VERB_LEX:
        return w[:-1]                                             # 2) « donnes-lui »→donne-lui (verbe -er, retire le -s ; exclut prends-le)
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
    # sujet-NOM pluriel + « son » suivi d'un PRÉDICAT (participe/adjectif) + aucun verbe fini → « sont » (« les enfants son partis/noirs »→sont)
    # PRÉDICAT après « son » (sujet-nom pluriel) : participe PLURIEL (« les enfants son partis/venus »→sont). Les adjectifs
    # sont EXCLUS (trop de faux positifs : « son ancienne équipe », « son style, » = possessif + nom homographe d'adjectif).
    if i+1 < len(T) and plural_subj and prev(T, i) not in NUM_DET and prev(T, i) not in PREP \
       and _pp_base(T[i+1]) is not None and deacc(nxt).endswith(('s', 'x')) and _clause_no_finite_verb(T, i):
        return 'sont'
    return None

_PLURAL_CUE = {'et', 'ni', 'ils', 'elles', 'qui', 'ceux', 'celles', 'lesquels', 'lesquelles'}
def _plural_left(T, i):
    """Évidence d'un sujet PLURIEL/coordonné/relatif dans la proposition à GAUCHE (garde ont→on). Scanne ≤7 tokens
    sans franchir de frontière de proposition. « l'état ET le gouvernement ont », « populations…QUI…ont » : « ont »
    est correct (pluriel) → ne pas rabattre en « on ». Abstention seule ⇒ FP-safe (n'invente aucune correction)."""
    j = i - 1
    for _ in range(7):
        if j < 0: return False
        wj = deacc(T[j].lower())
        if wj in _PLURAL_CUE or is_plural_noun(T, j): return True
        if _SEG is not None and j < len(_SEG['bb']) and _SEG['bb'][j]: return False   # début de proposition atteint → stop
        j -= 1
    return False

def rule_on_ont(T, i):
    lw = deacc(T[i].lower())
    if lw not in ('on', 'ont'): return None
    if _SEG is not None and i < len(_SEG['hy']) and _SEG['hy'][i]: return None   # « avait-on », « peut-on » : trait d'union → pronom inversé, jamais une faute
    nx = T[i+1].lower() if i+1 < len(T) else ''
    if nx.endswith('e') and not nx.endswith('ée') and _reads(nx): return 'on'   # « on » + verbe FINI présent en -e (trouve/mange) → « on » (ont ne précède JAMAIS un verbe fini) ; fixe « professeurs on trouve »→ont
    # TÊTE de proposition (i==0 ou frontière avant) : le sujet à GAUCHE appartient à une AUTRE proposition — contexte
    # gauche INVALIDE (« …des données. On pouvait… » : « données » n'est pas le sujet de « on »). FP WiCoPaCo mesuré.
    ci = (i == 0) or (_SEG is not None and i < len(_SEG['bb']) and _SEG['bb'][i])
    if not ci:
        p = prev(T, i)
        pr = deacc(T[i-1].lower()) if i > 0 else ''
        glued_pl = ("'" in pr) and (pr.endswith('ils') or pr.endswith('elles'))   # pronom collé : qu'ils, s'ils, lorsqu'elles → sujet pluriel
        if p in ('ils', 'elles') or glued_pl or is_plural_noun(T, i-1): return 'ont'    # sujet/antécédent pluriel → avoir 3pl
        if i+1 < len(T) and _is_ppl(T[i+1]): return 'ont'              # avoir + participe (« les gens qui on grandi/incarné/pu ») → 3pl, jamais « on »
    if vlike(T, i+1):
        if lw == 'ont':
            if _looks_ppl(T[i+1]): return None                         # « ont conclu/suivi/déduit/orchestré » = avoir 3pl + participe (même -u/-i/-is/-it/-é hors _is_ppl), jamais « on » (FP WiCoPaCo)
            if _plural_left(T, i): return None                         # sujet pluriel coordonné/relatif à gauche (« l'état et le gouvernement ont », « …qui…ont ») → « ont » correct (FP WiCoPaCo)
        return 'on'                                                    # « on » sujet + verbe
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
    if i+1 < len(T) and _is_ppl(T[i+1]) and not deacc(T[i+1].lower()).endswith('ee'): return 'a'   # « a + participe » (« a été », « a décidé ») → auxiliaire AVOIR, jamais « à ». Écarte le participe FÉMININ -ée (durée, entrée, sortie) : après AVOIR le participe NE s'accorde PAS → « -ée » = NOM → « à durée limitée » reste préposition (FP WiCoPaCo)
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

JE_CONFUS = {'ke', 'ge', 'ce', 'se'}          # sujet « je » mal écrit (clavier k↔j, /ʒ/→ge, ce/se démonstratif/réfléchi)
JE_ETRE_1S = {'suis', 'serai', 'serais', 'fus'}   # ÊTRE 1re pers. sing. à INITIALE CONSONNE (« je X » correct sans élision)
def rule_je_subject(T, i):
    """Sujet « je » mal écrit devant ÊTRE en 1re pers. sing. : « ke/ge/ce/se + suis/serai/serais » → « je ».
    Séquence IMPOSSIBLE en français correct (« ce suis », « se suis », « ke suis » n'existent jamais) →
    FP=0 STRUCTUREL, vérifié 0 sur 2500 + 14 450 UD. EXCLUS : me/te/le/la/les/nous/vous (« je me suis »,
    « je te suis », « je le suis » valides) ; formes à VOYELLE ai/étais/avais (élision « j' » requise → 2e temps)."""
    if deacc(T[i].lower()) not in JE_CONFUS or i + 1 >= len(T): return None
    if deacc(T[i + 1].lower()) in JE_ETRE_1S: return _keepcase(T[i], 'je')
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
    j = i + 1                                                        # sauter ne/pas/bien/déjà… (« elle c'est bien amusée ») → participe
    while j < len(T) and j <= i + 3 and deacc(T[j].lower()) in _PP_MID: j += 1
    if j < len(T) and _is_ppl(T[j]): return _keepcase(T[i], "s'est")
    return None


def rule_sais(T, i):
    """« je/tu + c'est/ces/ses/sait » → « sais » (savoir 1re/2e pers. sing.). Ces suites n'existent JAMAIS
    en français correct (je/tu n'introduisent ni « c'est » ni un déterminant « ces/ses ») → FP=0 STRUCTUREL,
    mesuré 0 sur 16 951 phrases UD correctes. « il/on + c'est » reste AMBIGU (sait vs s'est) → non couvert ici."""
    if deacc(T[i].lower()) not in ("c'est", 'ces', 'ses', 'sait'): return None
    if _SEG is not None and i < len(_SEG['bb']) and _SEG['bb'][i]: return None   # « Moi, je… c'est » (dislocation) → abstention
    if prev(T, i) in ('je', 'tu'): return _keepcase(T[i], 'sais')
    return None

_PP_ETRE3P = {'sont', 'etaient', 'seront', 'soient', 'furent', 'seraient'}
_PP_MID = {'ne', 'n', 'pas', 'plus', 'jamais', 'y', 'en', 'se', 's', 'deja', 'toujours', 'aussi', 'bien', 'encore', 'tous', 'toutes', 'tout'}
_DESEL = {'j': 'je', 'n': 'ne', 'm': 'me', 't': 'te', 's': 'se', 'd': 'de', 'c': 'ce', 'qu': 'que'}
_DESEL_VOW = set('aeiouyàâäéèêëîïôöùûüh') | {'œ', 'æ'}
def rule_deselide(T, i):
    """Élision INVERSÉE (faute dys) : « j'ne, n'sait, m'détestons, d'guerre »… Un proclitique élidé (j'/n'/m'/t'/s'/d'/c'/qu')
    ne s'élide QUE devant voyelle ; devant CONSONNE = faute → on rétablit (je/ne/me/… + espace + mot). FP=0 (14 450 UD).
    l' exclu (le/la ambigu) ; nom propre (reste capitalisé) et « d'œuvre » (œ = voyelle) préservés."""
    w = T[i]; lw = w.lower()
    if lw in ("m'sieur", "m'dame", "m'ame"): return None
    m = re.match(r"^(qu|[jnmtsdcl])'(.+)$", lw)
    if not m: return None
    pre = m.group(1); rest = w[len(pre)+1:]
    if not rest or rest[0].lower() in _DESEL_VOW or not rest[0].isalpha() or rest[:1].isupper(): return None
    if pre == 'l':                                                    # « l' » + consonne → le/la selon le GENRE du nom (lexique) ; genre inconnu → abstention
        g = GENDER_PURE.get(deacc(rest.lower()))
        if g not in ('m', 'f'): return None
        return _keepcase(w, ('le' if g == 'm' else 'la') + ' ' + rest)
    return _keepcase(w, _DESEL[pre] + ' ' + rest)

_PP_ETRE_AUX = {'suis', 'es', 'est', 'sommes', 'etes', 'sont', 'etais', 'etait', 'etions', 'etiez', 'etaient',
                'sera', 'seras', 'serez', 'serons', 'seront', 'sois', 'soit', 'soyons', 'soyez', 'soient',
                'fut', 'furent', 'serais', 'serait'}
_PP_SUBJ = {'il': ('s', 'm'), 'elle': ('s', 'f'), 'ils': ('p', 'm'), 'elles': ('p', 'f'),
            'nous': ('p', '?'), 'je': ('s', '?'), 'tu': ('s', '?')}   # on/vous EXCLUS (nombre/personne ambigus)
_PP_AUX_P = {'sommes', 'etes', 'sont', 'etions', 'etiez', 'etaient', 'soyons', 'soyez', 'soient',
             'serons', 'serez', 'seront', 'furent'}                   # aux ÊTRE au PLURIEL (le reste = singulier)

_PP_IRR_CONS = {'mort', 'ne'}     # participes irréguliers base consonne/é où base+{'',e,s,es} accorde (mort/morte, né/née)
_PP_STOP = {'plus', 'bus', 'jus', 'obus', 'abus', 'virus', 'campus', 'sus', 'pus', 'rebus', 'blocus',
            'us', 'refus', 'talus', 'surplus', 'processus', 'consensus'}   # -us adverbe/nom ≠ participe (« plus »→« plu » interdit)

def _pp_base(w):
    """Base MASC-SINGULIER d'un participe passé reconnu (à laquelle on ajoute e/s/es pour accorder), sinon None.
    Couvre -er (allé), -ir (parti/sorti/fini : base+r ∈ verbes), -u irrégulier (venu/reçu… ∈ IRREG_PART), mort/né."""
    lw = w.lower(); d = deacc(lw)
    if d in _PP_STOP: return None
    inf = _inf1(w)
    if inf: return inf[:-2] + 'é'                                  # -er : base = radical+é
    for suf, cut in (('ies', 3), ('ie', 2), ('is', 2), ('i', 1)):  # -ir : parti/partie/partis/parties
        if lw.endswith(suf):
            base = lw[:-cut] + 'i'
            return base if deacc(base + 'r') in VERB_LEX else None
    for suf, cut in (('ues', 3), ('ue', 2), ('us', 2), ('u', 1)):  # -u irrégulier : venu/venue/venus/venues
        if lw.endswith(suf):
            base = lw[:-cut] + 'u'
            return base if deacc(base) in IRREG_PART else None
    for suf, cut in (('es', 2), ('s', 1), ('e', 1)):               # mort/né (base consonne/é) : morte/morts/mortes…
        if lw.endswith(suf) and deacc(lw[:-cut]) in _PP_IRR_CONS: return lw[:-cut]
    return lw if d in _PP_IRR_CONS else None

_ADJ_DETM = {'le': 'm', 'un': 'm', 'ce': 'm', 'cet': 'm'}   # mon/ton/son EXCLUS (son amie = fém devant voyelle)
_ADJ_DETF = {'la': 'f', 'une': 'f', 'cette': 'f', 'ma': 'f', 'ta': 'f', 'sa': 'f'}
_ADJ_DETP = {'les', 'des', 'ces', 'mes', 'tes', 'ses', 'nos', 'vos', 'leurs'}
_ADJ_STOP = {'sur', 'certain', 'seul', 'meme', 'propre', 'sacre', 'pauvre', 'grand', 'ancien', 'drole'}   # idiomes/épicènes/sens-variable
# Mots tolérés ENTRE être et l'adjectif attribut : adverbes de degré + négation. PAS « en/y/se » (marqueurs de PP/pronom :
# « est EN plein essor », « s'est fait ») qui indiquent que ce qui suit n'est pas un attribut du sujet.
_ADJ_MID = {'ne', 'n', 'pas', 'plus', 'jamais', 'guere', 'point', 'tres', 'si', 'tout', 'toute', 'tous', 'toutes',
            'bien', 'aussi', 'trop', 'peu', 'assez', 'plutot', 'moins', 'deja', 'toujours', 'encore', 'vraiment', 'fort'}

def _adj_estem(lw):
    """Radical dé-pluralisé finissant en -e (hors -é) : soit ÉPICÈNE (rouge/sale/jeune), soit forme DÉJÀ FÉMININE
    (petite/verte). Dans les deux cas on n'accorde QUE le nombre, jamais les lettres du genre → tue le FP « sales→salées »
    (lexique qui confond sale/salé) sans jamais dégrader (le nombre déjà bon ⇒ aucune correction). Renvoie le radical ou None."""
    if lw.endswith('x'):                             s = lw[:-1]
    elif lw.endswith('s') and not lw.endswith('ss'): s = lw[:-1]
    else:                                            s = lw
    return s if (s.endswith('e') and not s.endswith('é')) else None

def _adj_agree(w, gender, num):
    """Accorde l'adjectif w (∈ ADJ_LEX) en genre+nombre. Radical en -e (épicène/féminin) → NOMBRE seul (genre inchangé) ;
    sinon genre via la paire lexicale + nombre (al→aux, eau→x, sinon +s ; bleu→bleus)."""
    lw = w.lower()
    stem = _adj_estem(lw)
    if stem is not None:                                      # rouge/sale/petite… : on garde le radical, accord de NOMBRE seul
        return stem + 's' if num == 'p' else stem
    g_adj, alt = ADJ_LEX[deacc(lw)]
    base = w if g_adj == gender else alt                      # bon genre (alt = forme de l'autre genre, accentuée)
    if num == 'p':
        db = deacc(base.lower())
        if db[-1] in 'sx':               pass                 # déjà pluriel/invariable
        elif db.endswith('al'):          base = base[:-2] + 'aux'
        elif db.endswith('eau'):         base = base + 'x'    # beau→beaux, nouveau→nouveaux
        else:                            base = base + 's'    # bleu→bleus (–eu prend –s), grand→grands…
    return base

_NOUN_INVAR_S = {'cours', 'corps', 'temps', 'prix', 'bois', 'pays', 'mois', 'bras', 'dos', 'nez', 'puits',
                 'univers', 'fois', 'poids', 'sens', 'tas', 'repas', 'concours', 'discours', 'parcours',
                 'secours', 'velours', 'jus', 'os', 'gaz', 'choix', 'croix', 'voix', 'noix', 'faux', 'toux'}
# Quantifieurs/déterminants PLURIELS hors NUM_DET (tagués DET mais absents de la classe fermée) → nombre = pluriel.
_QUANT_PL = {'plusieurs', 'quelques', 'certains', 'certaines', 'divers', 'diverses', 'maints', 'maintes',
             'differents', 'differentes', 'beaucoup', 'moults',
             'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze',
             'treize', 'quatorze', 'quinze', 'seize', 'vingt', 'trente', 'quarante', 'cinquante',
             'soixante', 'cent', 'cents', 'mille'}
_QUANT_SG = {'chaque', 'aucun', 'aucune', 'nul', 'nulle', 'chacun', 'chacune'}   # déterminants/quantifieurs SINGULIERS hors NUM_DET
# Conjonctions relatives/subordonnées/coordonnées : bornent le GN sujet (ne pas remonter dans la proposition amont :
# « un ordinaire QUE les Tchèques ont », « ce QUE les médecins interprètent » → sujet = après la conjonction).
_NP_BREAK = {'que', 'qu', 'qui', 'dont', 'quand', 'lorsque', 'puisque', 'parce', 'comme', 'si', 'car',
             'mais', 'donc', 'or', 'quoique', 'lequel', 'laquelle', 'lesquels', 'lesquelles'}
# Noms COLLECTIFS / de quantité : l'accord se fait souvent avec le COMPLÉMENT (« la plupart des gens SONT »,
# « une centaine d'illustrations ONT paru ») → règle d'accord spéciale, non décidable ici → abstention (FP=0).
_COLL_HEAD = {'plupart', 'majorite', 'minorite', 'nombre', 'total', 'partie', 'moitie', 'tiers', 'quart',
              'ensemble', 'reste', 'quantite', 'foule', 'multitude', 'infinite', 'poignee', 'kyrielle',
              'dizaine', 'douzaine', 'quinzaine', 'vingtaine', 'trentaine', 'quarantaine', 'cinquantaine',
              'soixantaine', 'centaine', 'millier', 'million', 'milliard', 'brochette', 'tapee', 'flopee',
              'sorte', 'espece', 'genre'}
def _noun_gender(w, num='s'):
    """Genre d'un NOM via GENDER_PURE (noms à genre non ambigu). Dé-pluralisation SEULEMENT si le sujet est marqué
    pluriel (num=='p') et le mot n'est pas un invariable en -s (cours→cour(f) = faux ami). None sinon → abstention."""
    d = deacc(w.lower())
    g = GENDER_PURE.get(d)
    if g in ('m', 'f'): return g                             # forme exacte (couvre singuliers + invariables cours/prix)
    if num != 'p' or d in _NOUN_INVAR_S: return None         # singulier, ou invariable -s → pas de dé-pluralisation
    if d.endswith('x') and len(d) > 2:                       # -eaux→-eau (bateaux→bateau)
        g = GENDER_PURE.get(d[:-1]) or GENDER_PURE.get(d[:-1] + 'u')
        if g in ('m', 'f'): return g
    if d.endswith('s') and len(d) > 2:                       # pluriel régulier : toilettes→toilette, voitures→voiture
        g = GENDER_PURE.get(d[:-1])
        if g in ('m', 'f'): return g
    return None

# ---------- VRAI PARSEUR DE GROUPE-SUJET (tête du GN) ----------
# Sert l'accord adjectif/participe attribut ET l'accord sujet-verbe : identifie le NOM-TÊTE du sujet placé AVANT le verbe,
# en sautant les mots-écrans (compléments « de X » : « la couleur DE LA VOITURE est… » → tête = couleur, pas voiture) et
# en s'abstenant sur les cas où le sujet n'est pas un [dét + nom] simple (coordination = genre mixte ; infinitif/proposition
# = « s'assurer DE LA PENTE était crucial » → le dét « la » est précédé de « de » ⇒ PP, pas le sujet ⇒ abstention). FP-sûr.
def _np_subject(T, tg, a):
    """Sujet [déterminant + nom-tête] placé juste avant le verbe d'indice a. Renvoie {'idx','det','g','n'} ou None.
    Bornes : proposition (_SEG). Abstention sur coordination (et/ou/ni), sujet-pronom (traité ailleurs), sujet-PP/infinitif
    (déterminant précédé d'une préposition), nom-tête absent."""
    lo = 0
    if _SEG is not None:
        for j in range(a, 0, -1):
            if j < len(_SEG['bb']) and _SEG['bb'][j]: lo = j; break
    det_idx = None
    j = a - 1
    while j >= lo:
        dj = deacc(T[j].lower()); tgj = tg[j] if (tg and j < len(tg)) else None
        if dj in ('et', 'ou', 'ni'): return None             # sujet coordonné → genre/nombre mixtes → abstention
        if dj in _NP_BREAK: break                            # relative/subordonnée (que/qui/dont…) → GN sujet à droite (ne pas remonter dans la proposition amont)
        if tgj in ('VERB', 'AUX'): break                     # frontière verbale : le GN sujet est à droite de j
        if dj in NUM_PRON: break                             # sujet-pronom → route pronom (rule_adj_attr) / abstention ici
        if tgj == 'DET' or dj in NUM_DET: det_idx = j        # on garde le déterminant le PLUS À GAUCHE (ouverture du GN)
        j -= 1
    if det_idx is None: return None
    if det_idx - 1 >= lo and deacc(T[det_idx-1].lower()) in PREP:
        return None                                          # « de la pente » : dét dans un PP ⇒ ce n'est pas le sujet ⇒ abstention
    head = None                                              # nom-tête = 1er nom après le déterminant, AVANT tout complément « de X »
    for k in range(det_idx + 1, a):
        dk = deacc(T[k].lower())
        if dk in PREP or "'" in T[k].lower() and dk[:1] == 'd': break   # entrée dans un complément → la tête est avant
        if (tg and k < len(tg) and tg[k] in ('NOUN', 'PROPN')) or dk in GENDER_PURE:
            head = k; break
    if head is None: return None
    ddet = deacc(T[det_idx].lower())
    if ddet in NUM_DET:     num = 'p' if NUM_DET[ddet] == 'pl' else 's'
    elif ddet in _QUANT_PL: num = 'p'                         # plusieurs/quelques/certains/deux… (quantifieurs pluriels hors NUM_DET)
    elif ddet in _QUANT_SG: num = 's'                         # chaque/aucun/nul → singulier (même si le nom-tête finit en -s : « chaque relais »)
    else:                                                     # déterminant tagué DET mais hors listes → nombre via la morpho du nom-tête (invariables -s exclus)
        dh = deacc(T[head].lower())
        if dh in _NOUN_INVAR_S: return None
        num = 'p' if dh[-1:] in 'sx' else 's'
    g = _noun_gender(T[head], num) or _ADJ_DETM.get(ddet) or ('f' if ddet in _ADJ_DETF else None)  # le/un/ce→m, la/une/cette/ma/ta/sa→f (son/mon/ton EXCLUS : ambigus)
    return {'idx': head, 'det': det_idx, 'g': g or '?', 'n': num}

def rule_adj_attr(T, i):
    """Accord de l'ADJECTIF ATTRIBUT après ÊTRE, avec le sujet (« la voiture est bleu »→bleue,
    « elles sont content »→contentes, « les murs sont blanc »→blancs). Gaté par le TAGGER (tg[i]==ADJ → écarte les
    noms homographes blanche/vert…) + cadre être. Sujet = pronom (il/elle/ils/elles) ou [déterminant + nom]. FP≈0."""
    w = T[i]; lw = w.lower()
    if "'" in lw: return None
    d = deacc(lw)
    if d not in ADJ_LEX or d in _ADJ_STOP: return None
    alt = ADJ_LEX[d][1]
    if deacc(alt).endswith('ee') and not d.endswith('e'): return None   # « grave→gravée », « sale→salée » = participe contaminé, pas une paire de genre
    tg = pos_tags(T)
    if not tg or i >= len(tg) or tg[i] != 'ADJ': return None
    if i+1 < len(T) and tg[i+1] in ('NOUN', 'PROPN'): return None      # adjectif ÉPITHÈTE d'un nom suivant (« en plein DÉVELOPPEMENT ») ≠ attribut du sujet → abstention
    a = None
    for k in range(i-1, max(-1, i-4), -1):
        dk = deacc(T[k].lower())
        if dk in _PP_ETRE_AUX: a = k; break
        if dk in _ADJ_MID: continue                                    # adverbes/négation seulement ; « en/y/se » (marqueur de PP : « est EN plein essor ») coupe → abstention
        return None
    if a is None or a == 0: return None
    if _SEG is not None and (a-1) < len(_SEG['hy']) and _SEG['hy'][a-1]: return None   # inversion (est-il) ≠ sujet
    aux_num = 'p' if deacc(T[a].lower()) in _PP_AUX_P else 's'
    epicene = _adj_estem(lw) is not None                               # radical en -e (rouge/sale/petite) → nombre seul, genre indifférent
    sp = deacc(T[a-1].lower())
    if sp in ('il', 'elle', 'ils', 'elles'):                          # (1) sujet PRONOM fiable
        gender = 'f' if sp in ('elle', 'elles') else 'm'
        num = 'p' if sp in ('ils', 'elles') else 's'
    else:                                                             # (2) sujet NOM via le VRAI PARSEUR (tête du GN, mots-écrans sautés)
        subj = _np_subject(T, tg, a)                                 #     coordination/infinitif/PP → None (abstention FP-sûre)
        if subj is None: return None
        num = subj['n']; gender = subj['g']
        if gender == '?':
            if not epicene: return None                             # adjectif genré + genre du nom-tête inconnu → abstention
            gender = 'm'                                            # épicène : seul le nombre compte
    if num != aux_num: return None                                  # dét/pronom et aux en désaccord → l'erreur est ailleurs → abstention
    sugg = _adj_agree(w, gender, num)
    return _keepcase(T[i], sugg) if sugg.lower() != lw else None

_EPI_ART = {'le': 's', 'la': 's', 'les': 'p', 'un': 's', 'une': 's', 'des': 'p',
            'ce': 's', 'cet': 's', 'cette': 's', 'ces': 'p', 'du': 's'}   # articles à NOMBRE net (possessifs exclus : « leur » ambigu → FP mesuré)
def rule_adj_epithet(T, i):
    """Accord en GENRE×NOMBRE de l'ADJECTIF ÉPITHÈTE avec le nom qu'il suit : [ARTICLE + NOM(genre connu) + ADJ]
    (« la règle présidentiel »→présidentielle, « les domaines industriel »→industriels). Le territoire genre-adjectif
    jadis écarté, tenu FP=0 par : tagger ADJ, genre GENDER_PURE, NOMBRE via ARTICLE net, invariants(_SG_STOP)/nom
    propre/coordination(et/ou)/figé(«de»)/épicène exclus. Mesuré 60→1 FP sur UD (le 1 = vraie faute)."""
    if i < 2: return None
    w = T[i]; lw = w.lower()
    if "'" in lw or w[:1].isupper(): return None
    d = deacc(lw)
    if d not in ADJ_LEX or _adj_estem(lw) is not None: return None   # inconnu / épicène (radical -e : rouge/jeune) → pas de genre à trancher
    if d in ('tout', 'tous', 'toute', 'toutes'): return None         # géré par rule_tout_det (rôle déterminant/adverbe/pronom)
    if i+1 < len(T) and deacc(T[i+1].lower()) in ('de', 'et', 'ou', 'ni'): return None   # figé (« haut de gamme ») + coordination distributive (« sites allemand et français »)
    tg = pos_tags(T)
    if not tg or i >= len(tg) or tg[i] != 'ADJ' or tg[i-1] != 'NOUN': return None
    if T[i-1][:1].isupper(): return None                             # nom propre (capitalisé) → genre non fiable
    dn = deacc(T[i-1].lower()); g = GENDER_PURE.get(dn)
    if g not in ('m', 'f') or dn in _SG_STOP: return None            # genre connu (nom pur) ET pas un invariant -s/-x
    num = _EPI_ART.get(deacc(T[i-2].lower()))
    if num is None: return None                                      # nombre NON net (pas d'article devant le nom) → abstention (écran/possessif)
    sugg = _adj_agree(w, g, num)
    return _keepcase(T[i], sugg) if sugg.lower() != lw else None

def rule_pp_etre(T, i):
    """Accord du PARTICIPE PASSÉ (tous groupes) avec le SUJET après ÊTRE : « nous sommes allez/allé »→allés,
    « elle est venu »→venue, « nous sommes parti »→partis, « elle est mort »→morte, « ils sont transformé »→transformés.
    Sujet = pronom fiable (il/elle/ils/elles/nous/je/tu ; on/vous exclus car ambigus). Genre inconnu (je/tu/nous) →
    on GARDE le genre écrit (jamais de fém→masc forcé). FP≈0 : ne se déclenche QUE si le participe est en DÉSACCORD."""
    lw = T[i].lower()
    if "'" in lw: return None
    base = _pp_base(T[i])                                      # base masc-sing du participe (tous groupes) ; None sinon
    if base is None: return None
    a = None                                                   # auxiliaire ÊTRE en remontant (adverbes/clitiques tolérés)
    for k in range(i-1, max(-1, i-4), -1):
        dk = deacc(T[k].lower())
        if dk in _PP_ETRE_AUX: a = k; break
        if dk in _PP_MID: continue
        return None
    if a is None: return None
    aux_num = 'p' if deacc(T[a].lower()) in _PP_AUX_P else 's'
    info = None; sk = -1                                      # sujet pronom avant l'aux (tolère ne/n')
    for k in range(a-1, max(-1, a-3), -1):
        dk = deacc(T[k].lower())
        if dk in ('ne', 'n'): continue
        info = _PP_SUBJ.get(dk); sk = k; break
    if not info:                                              # pas de sujet PRONOM → tenter le sujet NOM (VRAI PARSEUR de tête de GN, comme rule_adj_attr : mots-écrans sautés, coordination/infinitif/PP → abstention FP-sûre)
        if a >= 1 and "'" in T[a-1]: return None               # pronom élidé avant l'aux (« qu'elle soit emmenée », « s'il est venu ») → le vrai sujet est le clitique, pas un nom → abstention (FP)
        tg = pos_tags(T)
        if not tg or i >= len(tg) or tg[i] not in ('VERB', 'ADJ'): return None   # participe RÉEL (tagger) → écarte les noms homographes (« les données sont… »)
        if i+1 < len(tg) and tg[i+1] == 'DET': return None     # déterminant juste APRÈS le participe → sujet POSTPOSÉ (« est annoncée la reprise ») ou attribut → identification du sujet non fiable → abstention (FP)
        subj = _np_subject(T, tg, a)
        if subj is None or subj['g'] not in ('m', 'f') or subj['n'] != aux_num: return None   # sujet non résolu / genre inconnu / aux en désaccord → abstention
        if a - subj['idx'] > 5: return None                    # sujet trop LOIN de l'aux → parseur peu fiable sur phrase longue (FP « dioxyde … est autorisé »)
        for k in range(subj['idx']+1, a):                      # nom PROPRE/capitalisé entre le sujet et l'aux → sujet réel ambigu (FP « Plusieurs fois les Français sont forcés »)
            if T[k][:1].isupper() and k < len(tg) and tg[k] in ('NOUN', 'PROPN'): return None
        sugg = base + {'sm': '', 'sf': 'e', 'pm': 's', 'pf': 'es'}[subj['n'] + subj['g']]
        return _keepcase(T[i], sugg) if sugg.lower() != lw else None
    if _SEG is not None and sk < len(_SEG['hy']) and _SEG['hy'][sk]: return None   # « poursuit-il » : pronom d'inversion (incise) ≠ sujet → abstention
    num, gen = info
    if num != aux_num: return None                           # « elles est … » : aux et sujet en désaccord → l'erreur est ailleurs, abstention
    if gen == '?':                                            # genre inconnu (je/tu/nous) → garder celui écrit
        gen = 'f' if deacc(lw[:-1] if lw.endswith('s') else lw) == deacc(base) + 'e' else 'm'
    sugg = base + {'sm': '', 'sf': 'e', 'pm': 's', 'pf': 'es'}[num + gen]
    return _keepcase(T[i], sugg) if sugg.lower() != lw else None

# ---------- Accord du PARTICIPE PASSÉ avec AVOIR + COD ANTÉPOSÉ (relatif « que ») ----------
# Règle du PP avec avoir : le participe s'accorde en genre+nombre avec le COMPLÉMENT D'OBJET DIRECT
# UNIQUEMENT s'il est placé AVANT le verbe. Déclencheur SÛR (FP=0) : [NOM genré+nombré] que/qu'
# [pronom sujet] [avoir] [PP en désaccord] → « les fleurs que j'ai cueilli »→cueillies, « la lettre qu'il a écrit »→écrite.
# On NE touche JAMAIS : le COI (« à qui / dont / auquel » n'ouvrent pas « que » → jamais déclenché), les verbes
# INTRANSITIFS/de mesure (« que » = circonstant, pas COD : « les heures que j'ai dormi ») et la COMPLÉTIVE « que »
# après un nom de parole/pensée (« la certitude que j'ai gagné » : gagné invariable) → listes STOP. Antécédent = même
# parseur de GN que le relatif « qui » (dét (+adj) + nom ; préposition/coordination avant ⇒ COD ambigu ⇒ abstention).
_AVOIR_AUX = {'ai', 'as', 'a', 'avons', 'avez', 'ont', 'avais', 'avait', 'avions', 'aviez', 'avaient',
              'aurai', 'auras', 'aura', 'aurons', 'aurez', 'auront', 'aurais', 'aurait', 'aurions', 'auriez', 'auraient'}
_AVOIR_JE = {"j'ai", "j'avais", "j'aurai", "j'aurais"}          # « j' » (sujet je) FUSIONNÉ avec l'aux avoir (1 seul token)
_QUE_SUBJ = {"qu'il", "qu'elle", "qu'on", "qu'ils", "qu'elles"}  # « que » (objet) FUSIONNÉ avec le sujet clitique (1 seul token)
_COD_SUBJ = {'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles'}   # sujet entre « que » et l'aux ⇒ « que » est OBJET
# PP de verbes INTRANSITIFS / de MESURE / à COI (base masc-sing déaccentuée) : « que » y est circonstant ou complément
# indirect ⇒ JAMAIS d'accord avec un COD (« les heures que j'ai dormi », « la personne que j'ai téléphoné »).
_PP_COD_STOP = {'menti', 'ri', 'souri', 'plu', 'deplu', 'nui', 'suffi', 'dormi', 'regne', 'existe', 'marche',
                'vecu', 'couru', 'coute', 'valu', 'pese', 'dure', 'reussi', 'echoue', 'appartenu', 'resiste',
                'survecu', 'nage', 'voyage', 'travaille', 'circule', 'evolue', 'rode', 'erre',
                'parle', 'repondu', 'telephone', 'obei', 'ressemble', 'renonce', 'participe', 'assiste',
                'succede', 'procede', 'remedie', 'convenu', 'nui', 'menace', 'songe', 'reve'}
# Noms de PAROLE / PENSÉE / FAIT : « que » après eux peut être COMPLÉTIF (conjonction) ⇒ le nom n'est pas le COD ⇒ abstention.
_COMPLETIVE_ANT = {'fait', 'faits', 'idee', 'idees', 'preuve', 'preuves', 'nouvelle', 'nouvelles', 'espoir', 'espoirs',
                   'crainte', 'craintes', 'peur', 'peurs', 'certitude', 'certitudes', 'conviction', 'convictions',
                   'impression', 'impressions', 'sentiment', 'sentiments', 'hypothese', 'hypotheses', 'theorie',
                   'principe', 'principes', 'regle', 'regles', 'condition', 'conditions', 'promesse', 'promesses',
                   'garantie', 'garanties', 'risque', 'risques', 'chance', 'chances', 'possibilite', 'probabilite',
                   'sensation', 'sensations', 'illusion', 'illusions', 'pensee', 'pensees', 'reve', 'reves',
                   'souvenir', 'souvenirs', 'doute', 'doutes', 'soupcon', 'signe', 'signes', 'raison', 'raisons', 'espere'}


def _pp_accord(base, nb, g):
    """Forme accordée d'un participe passé (masc-sing = base). Gère la base en -s (pris/mis/assis) : masc pluriel = base."""
    if nb == 's': return base if g == 'm' else base + 'e'
    if g == 'm': return base if base.endswith('s') else base + 's'
    return base + 'es'

# Participes passés IRRÉGULIERS TRANSITIFS fréquents (bases masc-sing accentuées) que _pp_base ne couvre pas (-t/-s/-u
# irréguliers). Verbes intransitifs/COI EXCLUS (dans _PP_COD_STOP). Chaque forme fléchie (déacc) → base masc-sing.
_IRR_PP_BASES = ("écrit décrit fait refait dit redit conduit construit produit détruit instruit cuit "
                 "ouvert offert couvert découvert souffert peint éteint atteint joint craint "
                 "pris mis appris compris surpris repris assis acquis conquis requis "
                 "entendu perdu vendu rendu attendu défendu descendu tendu mordu tordu cousu résolu "
                 "vu revu lu relu tenu obtenu retenu soutenu détenu maintenu "
                 "connu reconnu vaincu convaincu aperçu déçu conçu perçu parcouru").split()
_IRR_PP = {}
for _b in _IRR_PP_BASES:
    for _f in (_b, _b + 'e', (_b if _b.endswith('s') else _b + 's'), _b + 'es'):
        _IRR_PP.setdefault(deacc(_f), _b)


def rule_pp_avoir_cod(T, i):
    lw = T[i].lower()
    if "'" in lw: return None
    base = _pp_base(T[i])
    if base is None: base = _IRR_PP.get(deacc(lw))    # participe irrégulier -t/-s/-u (écrit/pris/entendu…) hors _pp_base
    if base is None: return None
    if deacc(base) in _PP_COD_STOP: return None                     # verbe intransitif/mesure/COI ⇒ « que » circonstant/indirect, pas COD
    a = None; a_is_je = False                                       # auxiliaire AVOIR en remontant (adverbes/négation tolérés)
    for k in range(i - 1, max(-1, i - 4), -1):
        tk = T[k].lower(); dk = deacc(tk)
        if dk in _AVOIR_AUX: a = k; break
        if tk in _AVOIR_JE: a = k; a_is_je = True; break            # « j'ai » = je+ai fusionné (le sujet est dans le token)
        if dk in _PP_MID: continue
        return None
    if a is None: return None
    q = None                                                        # position du token « que » (ou du token qu'+sujet fusionné)
    if a_is_je:                                                     # « … que j'ai <PP> » : « que » juste avant « j'ai »
        if a - 1 < 0 or deacc(T[a - 1].lower()) != 'que': return None
        q = a - 1
    else:                                                          # aux séparé ⇒ le sujet est AVANT (fusionné « qu'il » OU pronom + « que »)
        b = a - 1
        while b >= 0 and deacc(T[b].lower()) in ('ne', 'n'): b -= 1
        if b < 0: return None
        tb = T[b].lower()
        if tb in _QUE_SUBJ:                                        # « … lettre qu'il a <PP> » : que+sujet fusionnés ⇒ antécédent avant ce token
            q = b
        elif deacc(tb) in _COD_SUBJ:                               # « … livres que tu as <PP> » : pronom sujet séparé, « que » juste avant
            if b - 1 < 0 or deacc(T[b - 1].lower()) != 'que': return None
            q = b - 1
        else:
            return None
    lo = 0
    if _SEG is not None:
        for jj in range(q, 0, -1):
            if jj < len(_SEG['bb']) and _SEG['bb'][jj]: lo = jj; break
    tg = pos_tags(T)
    if not tg: return None
    det = None; noun = None                                         # antécédent nominal : [dét (+adj) + nom] juste avant « que »
    m = q - 1
    while m >= lo:
        dm = deacc(T[m].lower())
        if "'" in T[m].lower(): return None                         # élision (l'/d'…) ⇒ souvent mistaguée ⇒ antécédent ambigu ⇒ abstention
        if dm in PREP: return None                                  # « de X que » complément ⇒ COD ambigu ⇒ abstention
        if m < len(tg) and (tg[m] == 'DET' or dm in NUM_DET): det = m; break
        if m < len(tg) and tg[m] in ('NOUN', 'PROPN'): noun = m; m -= 1; continue
        if m < len(tg) and tg[m] in ('ADJ', 'ADV', 'NUM'): m -= 1; continue
        return None                                                 # verbe/pronom/conj ⇒ pas un GN simple ⇒ abstention
    if det is None or noun is None: return None
    mm = det - 1                                                    # préposition/coordination avant le déterminant ⇒ antécédent ambigu
    while mm > lo and mm < len(tg) and tg[mm] == 'ADV': mm -= 1
    if mm >= lo and deacc(T[mm].lower()) in PREP: return None
    if mm >= lo and deacc(T[mm].lower()) in ('et', 'ou', 'ni'): return None
    nd = deacc(T[noun].lower())
    if nd in _COMPLETIVE_ANT: return None                           # nom de parole/pensée ⇒ « que » peut être complétif ⇒ abstention
    dd = deacc(T[det].lower())
    if dd in NUM_DET: nb = 'p' if NUM_DET[dd] == 'pl' else 's'
    else: return None
    g = _noun_gender(T[noun], nb)
    if g not in ('m', 'f'): return None
    if i < len(tg) and tg[i] == 'NOUN': return None                 # le tagger le voit comme un NOM confiant (« les données que… ») ⇒ homographe ⇒ abstention (PROPN = repli mot inconnu, on laisse : la morphologie a déjà validé le participe)
    sugg = _pp_accord(base, nb, g)
    return _keepcase(T[i], sugg) if sugg.lower() != lw else None


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
    ss, bb, hy, cap, dig, prev_end = [], [], [], [], [], 0
    for k, m in enumerate(re.finditer(r"[A-Za-zÀ-ÿœŒ']+", text)):
        gap = text[prev_end:m.start()]
        s = any(c in gap for c in '.!?…')                        # début de phrase = APRÈS . ! ? (pas le 1er token : un fragment ne se capitalise pas)
        ss.append(s)
        bb.append(s or any(c in gap for c in ',;:()«»"–—\n'))
        hy.append('-' in gap)                                    # trait d'union avant (inversion « dit-il ») → anti-FP run-on
        cap.append(s and '..' not in gap and not any(c.isdigit() for c in gap))   # MAJUSCULE : vraie fin de phrase — pas une ellipse « .. » ni un point de nombre/décimale
        dig.append(any(c.isdigit() for c in gap))                # un NOMBRE (supprimé par toks) précédait ce token : « le 25 mars », « le 100 mètres » → écran, le déterminant ne gouverne pas ce nom
        prev_end = m.end()
    return {'ss': ss, 'bb': bb, 'hy': hy, 'cap': cap, 'dig': dig}

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
    # « je » (1sg) : les cibles COURTES avoir (ai) sont déjà écartées (len<4) ; on autorise les LONGUES (suis/étais/avais)
    # → « je sui »→suis. (« je ai »=élision j'ai gérée ailleurs : ai est trop court pour être une cible ici.)
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
    """Accord SUJET-VERBE à sujet-NOM, via le VRAI PARSEUR de sujet (_np_subject) : gère le sujet ÉLOIGNÉ (mots-écrans
    « de X ») que l'ancienne version (déterminant pluriel en tête seulement) ratait — « la liste des articles sont »→est,
    « le prix des matières premières ont »→a, « les cartons dans le couloir gêne »→gênent. FP=0 : on n'autorise entre le
    nom-tête et le verbe QUE des compléments prépositionnels ; coordination/relative, ponctuation, verbe/aux intercalé, ou
    un 2e GN non prépositionnel → abstention (autre structure)."""
    if not CONJ_LOADED or "'" in T[i].lower() or T[i].lower() == 'à': return None   # « à » (prép.) ≠ « a » (avoir) — déacc les confond
    if T[i].lower().endswith(('é', 'és', 'ée', 'ées')): return None     # PARTICIPE (destiné…) : accord ADJECTIVAL, pas verbal
    if i > 0 and T[i-1].lower() in NUM_DET: return None                 # déterminant juste avant → T[i] est un NOM (« les joue »)
    if i > 0 and deacc(T[i-1].lower()) in PREP: return None             # un verbe FINI n'est jamais gouverné par de/des/du/par/à… → T[i] = NOM homographe (« de contrôle », « par faute », « l'est »)
    if deacc(T[i].lower()) == 'peut' and i + 1 < len(T) and deacc(T[i+1].lower()) == 'etre': return None   # « peut-être » (adverbe), pas le verbe pouvoir
    if deacc(T[i].lower()) in ('est', 'ai') and i > 0 and deacc(T[i-1].lower()) in ('nord', 'sud', 'ouest'): return None   # « nord-est »/« sud-est » : « est » = point cardinal (nom), pas le verbe
    if i > 0 and T[i-1].isdigit(): return None                         # « WR 20 a », « A1 » : désignation alphanumérique → « a/est » n'est pas un verbe
    if i > 0 and len(T[i-1]) >= 2 and T[i-1].isupper(): return None     # sigle TOUT-EN-MAJUSCULES avant (« WR a », « NGC A ») = désignation → « a/est » homographe, pas verbe
    if _subject_before(T, i) is not None: return None                  # sujet pronom net → règle pronom (pas ici)
    p3 = [(l, mt, p, n) for (l, mt, p, n) in _reads(T[i]) if p == '3']  # sujet-nom = 3e personne
    if not p3: return None
    if (i >= 1 and deacc(T[i-1].lower()) in FULL_AUX) or (i >= 2 and deacc(T[i-2].lower()) in FULL_AUX):
        return None                                                    # temps composé/passif (aux + participe) → T[i] = participe, pas verbe fini
    tg = pos_tags(T)
    if not tg or i >= len(tg) or tg[i] not in ('VERB', 'AUX'): return None   # T[i] = VERBE EN CONTEXTE (écarte les noms/adjectifs homographes « de rechange », « par faute », « jeune âge »)
    subj = _np_subject(T, tg, i)                                       # tête [dét + nom] du sujet, mots-écrans « de X » sautés
    if subj is None: return None
    nb = subj['n']; hk = subj['idx']; dk = subj['det']
    ddet = deacc(T[dk].lower())
    if ddet not in NUM_DET and ddet not in _QUANT_PL and ddet not in _QUANT_SG: return None   # déterminant sujet DOIT être connu (le/la/les/un/des/plusieurs/chaque…) ; au/aux/du (prép+dét de PP « AU nord se trouvent ») ou mistag → abstention
    if deacc(T[hk].lower()) in _COLL_HEAD: return None                # nom collectif/quantité (plupart/majorité/centaine…) → accord avec le complément → abstention
    if tg[hk] == 'PROPN' or (hk > 0 and T[hk][:1].isupper()): return None   # nom-tête propre/titre (« Les Maroons », « les Chevaliers du feu ») = entité, nombre non fiable → abstention
    lo = 0                                                             # début de proposition (bornes _SEG)
    if _SEG is not None:
        for j in range(i, 0, -1):
            if j < len(_SEG['bb']) and _SEG['bb'][j]: lo = j; break
    for m in range(lo, i):                                             # apostrophe (élision l'/qu'/n'/d') dans la proposition → clause complexe (relative/sujet élidé) → abstention
        if "'" in T[m] or "’" in T[m]: return None
    for m in range(lo, dk):                                            # SUJET EN TÊTE DE PROPOSITION : seuls des adverbes antéposés avant le déterminant.
        if tg[m] != 'ADV': return None                                #   sinon le GN détecté est un OBJET/complément d'un verbe amont (« qui composent LE SME sont »), pas le sujet → abstention
    for m in range(hk + 1, i):                                         # GARDE STRUCTURE nom-tête → verbe : compléments prépositionnels SEULEMENT
        tok = T[m]; dw = deacc(tok.lower())
        if dw in CONJ_WORDS: return None                              # et/ou/qui/que/quand… (coordination/relative) → sujet ambigu → abstention
        if any(ch in ',;:()[]«»"' for ch in tok): return None        # ponctuation = apposition/incise → abstention
        if any(ch.isdigit() for ch in tok): return None              # désignation alphanumérique (« WR 20a », « A1 ») → « a/est » homographe, pas verbe → abstention
        if tg and m < len(tg) and tg[m] in ('VERB', 'AUX'): return None   # verbe/aux intercalé = sous-phrase → le vrai sujet du verbe est ailleurs → abstention
        if tok.lower() in NUM_DET and dw not in PREP and not (m > 0 and deacc(T[m-1].lower()) in PREP):
            return None                                              # 2e GN NON prépositionnel (nouveau sujet) → abstention ; « des/du » (prép+dét) & « de la » tolérés
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


def _sv_finish(T, i, per, nb, p_reads):
    """Queue commune des règles d'accord sujet-verbe : corrige T[i] vers (per, nb) si désaccord ET forme confirmée.
    p_reads = lectures de T[i] filtrées sur la personne `per`. Anti-bruit : lemme unique + suggestion re-vérifiée."""
    if any(n == nb or n == 'x' for (_l, _mt, _p, n) in p_reads): return None   # déjà d'accord
    lemmas = {l for (l, _mt, _p, _n) in p_reads}
    if len(lemmas) != 1: return None
    lem = lemmas.pop()
    mts = [mt for (_l, mt, _p, _n) in p_reads]
    mt = 'ind:pre' if 'ind:pre' in mts else mts[0]
    sugg = CONJ_C.get(lem, {}).get(mt, {}).get(per + nb)
    if not sugg: return None
    if not any(p == per and (n == nb or n == 'x') for (_l, _mt, p, n) in _reads(sugg)):
        return None
    return sugg


# ---------- Accord SUJET-VERBE à sujet PRONOM/QUANTIFIEUR indéfini (chacun, certains, plusieurs, personne…) ----------
# Classe FERMÉE → FP=0 : le quantifieur-pronom impose le nombre (3e pers). On n'agit qu'en EMPLOI PRONOM (rien d'autre
# qu'un clitique/négation entre lui et le verbe) et en TÊTE de proposition — l'emploi DÉTERMINANT (« certains jours sont »)
# est laissé au parseur nominal (_np_subject via _QUANT_PL).
_QP_SG = {'chacun', 'chacune', "quelqu'un", 'quiconque', 'personne', 'rien', 'aucun', 'aucune', 'nul', 'nulle'}
_QP_PL = {'certains', 'certaines', 'plusieurs', 'tous', 'toutes'}
_QP_DE_PL = {'plupart', 'beaucoup', 'peu', 'bien', 'tas', 'tant', 'nombre'}   # + de(s) N → pluriel (accord complément) ; « nombre » exigera « bon/grand nombre »
_QP_GAP_OK = set(PREP) | {'entre', 'en'}                                       # tokens autorisés dans le complément « de(s)/d'entre … » entre le quantifieur et le verbe

def rule_accord_sv_quant(T, i):
    if not CONJ_LOADED or "'" in T[i].lower() or T[i].lower() == 'à': return None
    if T[i].lower().endswith(('é', 'és', 'ée', 'ées')): return None
    if i > 0 and deacc(T[i-1].lower()) in PREP: return None
    if deacc(T[i].lower()) == 'peut' and i + 1 < len(T) and deacc(T[i+1].lower()) == 'etre': return None
    p3 = [(l, mt, p, n) for (l, mt, p, n) in _reads(T[i]) if p == '3']
    if not p3: return None
    if (i >= 1 and deacc(T[i-1].lower()) in FULL_AUX) or (i >= 2 and deacc(T[i-2].lower()) in FULL_AUX): return None
    tg = pos_tags(T)
    if not tg or i >= len(tg) or tg[i] not in ('VERB', 'AUX'): return None
    lo = 0
    if _SEG is not None:
        for j in range(i, 0, -1):
            if j < len(_SEG['bb']) and _SEG['bb'][j]: lo = j; break
    q = deacc(T[lo].lower()); nxt = deacc(T[lo+1].lower()) if lo + 1 < len(T) else ''
    qend = lo                                                    # dernier indice du groupe-quantifieur (avant complément)
    if q in _QP_SG:                nb = 's'                      # chacun/aucun/personne/rien… (peut être suivi de « des N » : chacun DES équipes → sg)
    elif q in _QP_PL:             nb = 'p'                       # certains/plusieurs/tous… (peut être suivi de « d'entre eux »)
    elif q in _QP_DE_PL and q != 'un':                          # beaucoup/peu/bien + de(s) N → pluriel (accord complément)
        if nxt in ('de', 'des', 'd') or "'" in (T[lo+1].lower() if lo+1 < len(T) else '') and nxt[:1] == 'd': nb = 'p'
        else: return None
    elif q == 'la' and nxt == 'plupart':      nb = 'p'; qend = lo + 1   # « la plupart (des N) » → pluriel
    elif q in ('tout', 'toute') and nxt in ('le', 'la'):        # « tout le monde / toute la classe » → collectif SINGULIER
        nb = 's'; qend = lo + 1
    else: return None
    seen_prep = False                                           # un nom/déterminant n'est autorisé qu'APRÈS une préposition (vrai complément « de(s)/d'entre N ») ;
    for m in range(qend + 1, i):                                # un nom nu juste après le quantifieur = emploi DÉTERMINANT (« certaines ANNÉES », « tous LE personnel ») → abstention
        dm = deacc(T[m].lower()); tk = T[m].lower()
        if dm in CLITIC or dm in ('ne', 'n'): continue
        if dm in _QP_GAP_OK or ("'" in tk and dm[:1] == 'd'): seen_prep = True; continue   # de/des/d'/d'entre/à…
        if seen_prep and (tk in NUM_DET or tg[m] in ('DET', 'NOUN', 'PROPN', 'PRON', 'ADJ', 'NUM')): continue   # [dét] nom/pronom/adj DU COMPLÉMENT
        return None                                             # nom nu sans préposition / verbe / conj / ponctuation → abstention
    return _sv_finish(T, i, '3', nb, p3)


# ---------- Accord SUJET-VERBE dans une relative « QUI » : le verbe s'accorde avec l'ANTÉCÉDENT de « qui » ----------
# « c'est MOI qui suis », « les PERSONNES qui participent », « ce sont EUX qui gèrent ». Antécédent = pronom disjoint /
# démonstratif (personne+nombre certains) OU groupe nominal juste avant « qui » (3e pers., nombre via _np_subject). FP=0.
_REL_ANT = {'moi': ('1', 's'), 'toi': ('2', 's'), 'lui': ('3', 's'), 'elle': ('3', 's'), 'soi': ('3', 's'),
            'nous': ('1', 'p'), 'vous': ('2', 'p'), 'eux': ('3', 'p'), 'elles': ('3', 'p'),
            'ce': ('3', 's'), 'celui': ('3', 's'), 'celle': ('3', 's'), 'ceux': ('3', 'p'), 'celles': ('3', 'p')}

def rule_accord_sv_relatif(T, i):
    if not CONJ_LOADED or "'" in T[i].lower() or T[i].lower() == 'à': return None
    if T[i].lower().endswith(('é', 'és', 'ée', 'ées')): return None          # participe (accord adjectival)
    reads = _reads(T[i])
    if not reads: return None
    tg = pos_tags(T)
    if not tg or i >= len(tg) or tg[i] not in ('VERB', 'AUX'): return None
    j = i - 1                                                                # remonter jusqu'à « qui » (sauter clitiques/négation)
    while j >= 0 and (deacc(T[j].lower()) in CLITIC or deacc(T[j].lower()) in ('ne', 'n')): j -= 1
    if j < 0 or deacc(T[j].lower()) != 'qui': return None
    qk = j
    if qk == 0: return None                                                 # « Qui vient ? » (interrogatif, sans antécédent) → abstention
    ant = deacc(T[qk-1].lower())
    if ant in _REL_ANT:
        per, nb = _REL_ANT[ant]
    else:                                                                   # antécédent NOMINAL = groupe [dét (+adj) + nom] JUSTE avant « qui » (nom le plus proche)
        per = '3'; det = None; noun = None                                  # on remonte de qk-1 ; une PRÉPOSITION avant le déterminant = partitif/complément → attachement AMBIGU (« famille DE techniques qui ») → abstention
        lo = 0
        if _SEG is not None:
            for jj in range(qk, 0, -1):
                if jj < len(_SEG['bb']) and _SEG['bb'][jj]: lo = jj; break
        m = qk - 1
        while m >= lo:
            dm = deacc(T[m].lower())
            if "'" in T[m].lower(): return None                             # élision (d'un, l', qu'…) — souvent mistaguée (d'un→PROPN) → antécédent ambigu → abstention
            if dm in PREP: return None                                      # « de techniques qui », « des Mamelouks qui » → antécédent ambigu → abstention
            if tg[m] == 'DET' or dm in NUM_DET or dm in _QUANT_PL or dm in _QUANT_SG: det = m; break
            if tg[m] in ('NOUN', 'PROPN'): noun = m; m -= 1; continue
            if tg[m] in ('ADJ', 'ADV', 'NUM'): m -= 1; continue
            return None                                                     # verbe/pronom/conj → pas un GN simple → abstention
        if det is None or noun is None: return None
        mm = det - 1                                                        # token AVANT le déterminant (adverbes antéposés sautés)
        while mm > lo and tg[mm] == 'ADV': mm -= 1
        if mm >= lo and deacc(T[mm].lower()) in PREP: return None           # « de CE type qui », « à LA musique qui » : GN = COMPLÉMENT → antécédent réel plus à gauche → abstention
        if mm >= lo and deacc(T[mm].lower()) in ('et', 'ou', 'ni'): return None   # antécédent COORDONNÉ (« le tram ET le bus qui », « … et secondairement le maïs qui ») → pluriel ambigu → abstention
        dd = deacc(T[det].lower())
        if dd in NUM_DET:      nb = 'p' if NUM_DET[dd] == 'pl' else 's'
        elif dd in _QUANT_PL:  nb = 'p'
        elif dd in _QUANT_SG:  nb = 's'
        else: return None
    if any(p == per and (n == nb or n == 'x') for (_l, _mt, p, n) in reads): return None   # déjà d'accord
    lemmas = {l for (l, _mt, _p, _n) in reads}
    if len(lemmas) != 1: return None
    lem = lemmas.pop()
    mts = [mt for (_l, mt, _p, _n) in reads]
    mt = 'ind:pre' if 'ind:pre' in mts else mts[0]
    sugg = CONJ_C.get(lem, {}).get(mt, {}).get(per + nb)
    if not sugg: return None
    if not any(p == per and (n == nb or n == 'x') for (_l, _mt, p, n) in _reads(sugg)): return None
    return sugg


# ---------- Accord SUJET-VERBE à sujets COORDONNÉS (« le chat et le chien dorment ») ----------
# Sujet = plusieurs GN reliés par « et »/« ni » → verbe au PLURIEL. Personne : 1re (je/moi/nous) > 2e (tu/toi/vous) > 3e.
# FP=0 : chaque conjoint DOIT être un GN net (commence par déterminant/nom propre et contient un nom, ou EST un pronom) ;
# aucune préposition/verbe/autre conjonction dans la zone sujet (écarte coord. d'adjectifs « noir et blanc », de compléments
# « le livre de Paul et Marie », d'objets postposés, de propositions « il mange et dort »).
# Pronoms DISJOINTS seulement (peuvent être coordonnés : « toi ET moi ») — PAS les clitiques sujets je/tu/il/on
# (« une cornue et ON distillait » : « on » est le sujet du verbe, pas un conjoint).
_COORD_PRON = {'moi': '1', 'nous': '1', 'toi': '2', 'vous': '2', 'lui': '3', 'elle': '3', 'soi': '3', 'eux': '3', 'elles': '3'}

def rule_accord_sv_coord(T, i):
    if not CONJ_LOADED or "'" in T[i].lower() or T[i].lower() == 'à': return None
    if T[i].lower().endswith(('é', 'és', 'ée', 'ées')): return None
    if i > 0 and deacc(T[i-1].lower()) in PREP: return None
    if deacc(T[i].lower()) == 'peut' and i + 1 < len(T) and deacc(T[i+1].lower()) == 'etre': return None
    reads = _reads(T[i])
    if not reads: return None
    tg = pos_tags(T)
    if not tg or i >= len(tg) or tg[i] not in ('VERB', 'AUX'): return None
    lo = 0
    if _SEG is not None:
        for j in range(i, 0, -1):
            if j < len(_SEG['bb']) and _SEG['bb'][j]: lo = j; break
    conjuncts = [[]]; has_sep = False                              # découpe la zone sujet [lo,i) en conjoints séparés par « et »/« ni »
    for m in range(lo, i):
        dm = deacc(T[m].lower())
        if dm in ('et', 'ni'): conjuncts.append([]); has_sep = True; continue
        if dm in ('ou', 'mais', 'car', 'donc', 'or', 'que', 'qu', 'qui'): return None   # autre conjonction/relative → pas une coordination simple
        if "'" in T[m].lower(): return None                        # élision (l'/d'/qu') → mistags fréquents → abstention
        if tg[m] in ('VERB', 'AUX') or dm in PREP: return None     # verbe/préposition dans la zone sujet → pas une coordination de GN sujets
        conjuncts[-1].append(m)
    if not has_sep or len(conjuncts) < 2: return None
    per_rank = 3; has_common = False                              # priorité de personne : 1 > 2 > 3 ; has_common = au moins un conjoint pronom OU introduit par un déterminant
    for cj in conjuncts:
        if not cj: return None                                     # conjoint vide
        first = deacc(T[cj[0]].lower())
        if len(cj) == 1 and first in _COORD_PRON:                  # conjoint = pronom (toi, moi, lui…)
            per_rank = min(per_rank, int(_COORD_PRON[first])); has_common = True; continue
        if tg[cj[0]] == 'DET' or T[cj[0]].lower() in NUM_DET:      # conjoint = [déterminant + … + nom]
            if not any(tg[m] in ('NOUN', 'PROPN') for m in cj): return None
            has_common = True; continue
        if tg[cj[0]] == 'PROPN' and all(tg[m] == 'PROPN' for m in cj):
            continue                                              # conjoint = nom(s) propre(s) NU(s) — toléré mais ne compte pas comme has_common
        return None                                               # « noir et blanc » (adjectifs), etc. → abstention
    if not has_common: return None                               # tous les conjoints sont des noms propres NUS → risque de nom composé (« Belcastel-et-Buc », place) → abstention
    per, nb = str(per_rank), 'p'
    if any(p == per and (n == nb or n == 'x') for (_l, _mt, p, n) in reads): return None   # déjà d'accord
    lemmas = {l for (l, _mt, _p, _n) in reads}
    if len(lemmas) != 1: return None
    lem = lemmas.pop()
    mts = [mt for (_l, mt, _p, _n) in reads]
    mt = 'ind:pre' if 'ind:pre' in mts else mts[0]
    sugg = CONJ_C.get(lem, {}).get(mt, {}).get(per + nb)
    if not sugg: return None
    if not any(p == per and (n == nb or n == 'x') for (_l, _mt, p, n) in _reads(sugg)): return None
    return sugg


# ---------- Accord SUJET-VERBE à sujet INFINITIF (« Trop manger nuit », « Fumer et boire sont mauvais ») ----------
# Sujet = un INFINITIF en tête de proposition → verbe principal à la 3e SINGULIER ; deux infinitifs coordonnés → 3e PLURIEL.
# FP=0 : proposition commençant par un infinitif (adverbes frontés tolérés), complément non-fini seulement (pas de verbe
# fini ni de pronom sujet entre l'infinitif et le verbe principal). Les sujets-PROPOSITION « Que… » ne sont PAS traités.
def _is_infinitive(w):
    d = deacc(w.lower())
    return d in VERB_LEX and (d.endswith('er') or d.endswith('ir') or d.endswith('re') or d.endswith('oir'))

def rule_accord_sv_infinitif(T, i):
    if not CONJ_LOADED or "'" in T[i].lower() or T[i].lower() == 'à': return None
    if T[i].lower().endswith(('é', 'és', 'ée', 'ées')): return None
    reads = _reads(T[i])
    if not any(p == '3' for (_l, _mt, p, _n) in reads): return None
    if i > 0 and deacc(T[i-1].lower()) in PREP: return None
    tg = pos_tags(T)
    if not tg or i >= len(tg) or tg[i] not in ('VERB', 'AUX'): return None
    lo = 0
    if _SEG is not None:
        for j in range(i, 0, -1):
            if j < len(_SEG['bb']) and _SEG['bb'][j]: lo = j; break
    s = lo                                                        # sauter les adverbes frontés (« Trop manger »)
    while s < i and tg[s] == 'ADV': s += 1
    if s >= i or not _is_infinitive(T[s]): return None            # la proposition doit commencer par un INFINITIF (le sujet)
    coord_inf = False
    for m in range(s + 1, i):                                     # entre l'infinitif-sujet et le verbe principal : complément non-fini seulement
        dm = deacc(T[m].lower())
        if dm in ('et', 'ou') and m + 1 < i and _is_infinitive(T[m+1]): coord_inf = True; continue   # « fumer ET boire » → 2 infinitifs coordonnés → pluriel
        if "'" in T[m].lower(): return None                      # élision → clause complexe → abstention
        if dm in NUM_PRON or dm in SUBJ_PRON: return None        # pronom sujet → pas un sujet-infinitif
        if _is_infinitive(T[m]): continue                        # infinitif enchaîné (« savoir écouter ») toléré
        if tg[m] in ('VERB', 'AUX'): return None                 # verbe FINI intercalé → proposition (« que les prix augmentent ») → abstention
        if dm in CONJ_WORDS: return None                         # conjonction/relative → abstention
    nb = 'p' if coord_inf else 's'
    reads3 = [r for r in reads if r[2] == '3']
    return _sv_finish(T, i, '3', nb, reads3)


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

_POSS_DET = {'mon', 'ma', 'ton', 'ta', 'son', 'sa'}
_ART_BLOCK = {'un', 'une', 'le', 'la', 'les', 'du', 'des', 'au', 'aux', 'ce', 'cet', 'cette', 'ces',
              'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses',
              'notre', 'nos', 'votre', 'vos', 'leur', 'leurs'}   # le français n'empile JAMAIS article + possessif
def rule_det_gender(T, i):
    lw = deacc(T[i].lower())
    if lw not in DET_GENDER or "'" in T[i].lower(): return None
    if i + 1 >= len(T): return None
    if lw in _POSS_DET and prev(T, i) in _ART_BLOCK: return None    # possessif précédé d'un article = NOM homographe (« un son », « le ton », « du son ») → jamais possessif → abstention (FP WiCoPaCo « un son stéréo »→sa)
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


def rule_du_de(T, i):
    """« du » = de+le : suivi d'un ARTICLE (la / l') c'est structurellement impossible → « de »
    (« du la ferme »→« de la ferme », « du l'usine »→« de l'usine »). FP=0 mesuré (aucun « du la/l' »
    en français correct, scan UD-GSD). Faute dys fréquente (du/de). « les » exclu (« du les »→« des » = 2 tokens)."""
    if deacc(T[i].lower()) != 'du' or i + 1 >= len(T):
        return None
    nl = T[i + 1].lower()
    if nl == 'la' or nl.startswith("l'") or nl.startswith("l’"):
        return 'de'
    return None

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

# Sens INVERSE (plur→sing) : déterminant SINGULIER (classe fermée) collé à un nom au pluriel APPARENT.
# En français correct, « un/le/la/ce/… + nom-pluriel » est TOUJOURS une faute → FP=0 par construction.
_SING_DET = {'un', 'une', 'le', 'la', 'ce', 'cet', 'cette', 'mon', 'ma', 'ton', 'ta', 'son', 'sa', 'chaque', 'du', 'au'}
# Noms INVARIABLES -s/-x (sing==plur) : leur « singularisation » naïve donne un autre lexème valide → piège → abstention.
# (NOUN_POST/GENDER_PURE ne les distinguent pas ; les non-noms « très/sous/savons » sont écartés par _noun_gate.)
_SG_STOP = INVAR_NOUN | _NOUN_INVAR_S | {
    'fils', 'cours', 'paix', 'relais', 'taux', 'heros', 'mars', 'gaz', 'ours', 'sas', 'jus', 'mets',
    'remords', 'secours', 'concours', 'discours', 'parcours', 'univers', 'velours', 'fois', 'deces',
    'engrais', 'laps', 'cabas', 'fracas', 'matelas', 'lilas', 'ananas', 'compas', 'faux', 'roux', 'doux',
    'epoux', 'noix', 'toux', 'flux', 'reflux', 'houx', 'courroux', 'index', 'larynx', 'pharynx', 'silex'}
def _singularize_noun(n):
    """Inverse de _pluralize_noun, ANCRÉ : -aux→-al, -x→∅, -s→∅ — on ne renvoie QUE si la forme singulière est un
    NOM confiant (P(NOM)≥τ ∧ P(VER)<ε). Écarte automatiquement les invariants (temps→temp, prix→pri, époux→épou : pas des noms)."""
    dn = deacc(n.lower()); cands = []
    if dn.endswith('aux') and len(dn) > 4: cands.append(n[:-3] + 'al')   # chevaux→cheval, journaux→journal
    if dn.endswith('x'): cands.append(n[:-1])                            # jeux→jeu, choux→chou, eaux→eau
    if dn.endswith('s'): cands.append(n[:-1])                            # systèmes→système
    for c in cands:
        p = NOUN_POST.get(deacc(c.lower()))
        if p and p[0] >= PL_TAU_M and p[1] < PL_EPS_M: return c
    return None

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

def rule_noun_singular(T, i):
    if i == 0 or prev(T, i) not in _SING_DET: return None       # déterminant SINGULIER (classe fermée) juste avant
    if _SEG is not None and i < len(_SEG['dig']) and _SEG['dig'][i]: return None   # NOMBRE-écran (« le 25 mars », « le 100 mètres ») → le déterminant ne gouverne pas ce nom → abstention (FP)
    n = T[i]
    if not n[:1].isalpha() or n[0].isupper(): return None       # nom propre / capitalisé → abstention (FP)
    dn = deacc(n.lower())
    if len(dn) < 4 or dn[-1] not in 'sx' or dn in _SG_STOP or dn in NOUN_PL_STOP: return None   # doit finir s/x (pluriel apparent) ; invariant/piège → abstention
    if not _noun_gate(n): return None                           # le PLURIEL doit être NOM-dominant (P(NOM)≥τ ∧ P(VER)<ε) → écarte « le savons » (verbe), « un très » (adverbe), « un sous » (prép)
    nx = T[i + 1] if i + 1 < len(T) else ''
    if nx[:1].islower() and nx.isalpha():                       # nom composé (« le vice présidents ») : nom + NOM confiant NON-verbe → 1er souvent invariable → abstention
        pp = NOUN_POST.get(deacc(nx.lower()))                   #   (P(VER)<ε : un VERBE qui suit — « chaque jours compte » — n'est PAS un composé)
        if pp and pp[0] >= PL_TAU_M and pp[1] < PL_EPS_M and deacc(nx.lower()) not in ADJ_LEX: return None
    sg = _singularize_noun(n)                                   # forme singulière ANCRÉE (nom confiant) — écarte les invariants (temps→temp)
    return sg if (sg and deacc(sg.lower()) != dn) else None

# a/à, on/ont, son/sont, mais/mes, et/est, ce/se, peu : homophones À RÔLE GRAMMATICAL (verbe vs prép/det/conj).
# Restés EN ROUGE : on les tranche par la GRAMMAIRE (sujet, accord, couche segments, pronoms collés), pas par
# « vigilance verte » (= simplification). FP=0 par cadre syntaxique forcé (audit UD 2026-06-30 : durcis).
_SA_NONNOUN = {'je','tu','il','elle','on','ils','elles','nous','vous','y','en','ne'}   # pronoms sujets/clitiques qui ne peuvent JAMAIS suivre le possessif « sa »
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
        if T[i] == T[i].upper() and T[i] != T[i].lower(): return None   # « SA » (société anonyme…) → abstention
        if i + 1 < len(T):
            nt = T[i+1].lower(); nd = deacc(nt)
            # « sa » possessif précède TOUJOURS un nom : suivi d'un clitique, d'un pronom sujet, ou d'un mot ÉLIDÉ
            # (jamais « sa l'/j'/d'… », ni « sa amie » = « son amie ») → ce n'est pas « sa » mais « ça ». FP=0 structurel.
            if nd in CLITIC or nd in _SA_NONNOUN or "'" in nt:
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

RULES = [('élision inversée', rule_deselide),
         ('-é/-er', rule_e_er), ('accord participe', rule_pp_etre), ('accord participe (COD avoir)', rule_pp_avoir_cod), ('accord adjectif', rule_adj_attr), ('accord adjectif épithète', rule_adj_epithet), ('terminaison -er/-é/-ez/-ai', rule_flexion_er),
         ('impératif', rule_imperatif),
         ('son/sont', rule_son_sont), ('on/ont', rule_on_ont),
         ('leur/leurs', rule_leur_leurs), ('a/à', rule_a_aa), ('et/est', rule_et_est),
         ('peu/peux/peut', rule_peu), ('sujet je', rule_je_subject), ('sais/sait', rule_sais), ('ce/se', rule_ce_se), ("c'est/s'est", rule_cest_sest), ('ça/sa', rule_ca_sa),
         ('met/mais', rule_met_mais), ('mais/mes', rule_mais_mes), ('du/de', rule_du_de),
         ("j'est/j'ai", rule_jest), ("c'ai/c'est", rule_cai), ('élision', rule_elide),
         ('accord sujet-verbe', rule_accord_sv),
         ('accord sujet-verbe', rule_accord_sv_recover),
         ('accord sujet-verbe', rule_accord_sv_noun),
         ('accord sujet-verbe', rule_accord_sv_quant),
         ('accord sujet-verbe', rule_accord_sv_relatif),
         ('accord sujet-verbe', rule_accord_sv_coord),
         ('accord sujet-verbe', rule_accord_sv_infinitif),
         ('genre déterminant', rule_det_gender),
         ('accord tout', rule_tout_det),
         ('accord pluriel nom', rule_noun_plural),
         ('accord singulier nom', rule_noun_singular),
         ('usage être/avoir', rule_aux_usage),
         ('aux mal orthographié', rule_aux_misspell),
         ('majuscule', rule_capital)]   # rule_genre_adj (adjectifs) reste NON branchée (FP-insûre)


def correct(text):
    text = text.replace('’', "'").replace('ʼ', "'")   # apostrophe typographique (claviers mobiles) = apostrophe droite (1:1, offsets intacts)
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
    ("je veux partir", "veux", "veut", "accord sujet-verbe"),                # vouloir 1re pers. (slot 1s réparé)
    ("tu veux venir", "veux", "veut", "accord sujet-verbe"),                 # vouloir 2e pers.
    ("Il a faim", "a", "ont", "accord sujet-verbe"),
    ("On a gagné", "a", "ont", "accord sujet-verbe"),
    ("Ils doivent manger", "doivent", "doit", "accord sujet-verbe"),
    ("Elle est contente", "est", "sont", "accord sujet-verbe"),
    # accord sujet-verbe à sujet NOM (déterminant pluriel → verbe pluriel)
    ("Les enfants jouent dehors", "jouent", "joue", "accord sujet-verbe"),
    ("Les oiseaux chantent", "chantent", "chante", "accord sujet-verbe"),
    ("Les voitures roulent vite", "roulent", "roule", "accord sujet-verbe"),
    # accord sujet-verbe à sujet ÉLOIGNÉ (mots-écrans « de X » via le vrai parseur _np_subject) — FP=0 sur 14 450 UD
    ("La liste des articles est longue", "est", "sont", "accord sujet-verbe"),        # tête = liste (sing.), pas articles
    ("Le prix des matières premières a augmenté", "a", "ont", "accord sujet-verbe"),  # tête = prix (sing.), pas matières
    ("Le stock de pièces détachées diminue vite", "diminue", "diminuent", "accord sujet-verbe"),  # tête = stock (sing.)
    ("Les employés du service répondent", "répondent", "répond", "accord sujet-verbe"),  # tête = employés (plur.)
    # accord sujet-verbe à sujet PRONOM/QUANTIFIEUR indéfini (classe fermée)
    ("Chacun fait de son mieux", "fait", "font", "accord sujet-verbe"),               # chacun → 3e sing.
    ("Certains pensent le contraire", "pensent", "pense", "accord sujet-verbe"),      # certains → 3e plur.
    ("Tous savent la réponse", "savent", "sait", "accord sujet-verbe"),               # tous → 3e plur.
    ("Tout le monde est content", "est", "sont", "accord sujet-verbe"),               # tout le monde → collectif sing.
    ("La plupart des gens préfèrent partir", "préfèrent", "préfère", "accord sujet-verbe"),  # la plupart des N → plur.
    # accord sujet-verbe dans une relative « qui » (accord avec l'antécédent)
    ("Les personnes qui participent restent", "participent", "participe", "accord sujet-verbe"),  # antécédent = personnes (plur.)
    ("Voici les articles qui manquent", "manquent", "manque", "accord sujet-verbe"),         # antécédent = articles (plur.)
    ("Ce sont eux qui gèrent le dépôt", "gèrent", "gère", "accord sujet-verbe"),             # antécédent = eux (3e plur.)
    # accord sujet-verbe à sujets COORDONNÉS (X et Y → pluriel ; personne 1>2>3)
    ("Le chat et le chien mangent la viande", "mangent", "mange", "accord sujet-verbe"),     # deux GN → 3e plur.
    ("Toi et moi mangeons ensemble", "mangeons", "mange", "accord sujet-verbe"),             # toi + moi → 1re plur.
    ("Ton frère et toi mangez trop", "mangez", "mange", "accord sujet-verbe"),               # frère + toi → 2e plur.
    # accord sujet-verbe à sujet INFINITIF (infinitif → 3e sing. ; infinitifs coordonnés → 3e plur.)
    ("Trop manger nuit à la santé", "nuit", "nuisent", "accord sujet-verbe"),                # infinitif sujet → 3e sing.
    ("Réussir cet examen demande des efforts", "demande", "demandent", "accord sujet-verbe"),  # infinitif + objet → 3e sing.
    ("Fumer et boire sont mauvais", "sont", "est", "accord sujet-verbe"),                    # deux infinitifs → 3e plur.
    # accord PLURIEL du NOM (déterminant pluriel + nom singulier → pluriel ancré dans le lexique)
    ("Les enfants jouent", "enfants", "enfant", "accord pluriel nom"),
    ("Des oiseaux chantent", "oiseaux", "oiseau", "accord pluriel nom"),
    ("Les chevaux galopent", "chevaux", "cheval", "accord pluriel nom"),
    ("Il a des difficultés", "difficultés", "difficulté", "accord pluriel nom"),
    # accord SINGULIER du NOM (déterminant singulier + nom pluriel → singulier ancré) — miroir, FP=0 par construction
    ("Le camp est installé", "camp", "camps", "accord singulier nom"),          # le + pluriel → singulier
    ("Chaque jour compte", "jour", "jours", "accord singulier nom"),            # chaque + pluriel → singulier (verbe « compte » ≠ composé)
    ("Une voiture rouge passe", "voiture", "voitures", "accord singulier nom"), # une + pluriel → singulier
    ("Ce systeme fonctionne", "systeme", "systemes", "accord singulier nom"),   # ce + pluriel → singulier (sans accent, ancré)
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
    # du/de : « du » (=de+le) + article = impossible → « de »
    ("Il revient de la maison", "de", "du", "du/de"),
    # terminaison -er/-é/-ez/-ai tranchée par le gouverneur (test mordre/mordu)
    ("Vous signez le document", "signez", "signer", "terminaison -er/-é/-ez/-ai"),      # vous → -ez
    ("Demain je noterai le numéro", "noterai", "noté", "terminaison -er/-é/-ez/-ai"),   # je → futur -ai
    ("Vous avez classé les bordereaux", "classé", "classez", "terminaison -er/-é/-ez/-ai"),  # avez (avoir) → participe -é
    ("Je suis allé à Paris", "allé", "allez", "terminaison -er/-é/-ez/-ai"),               # suis (être) → participe -é
    ("Il faut noter le numéro", "noter", "notez", "terminaison -er/-é/-ez/-ai"),          # il faut → infinitif -er
    ("S'il vous plaît, notez le numéro", "notez", "noté", "terminaison -er/-é/-ez/-ai"),  # s'il vous plaît → impératif -ez
    # impératif irrégulier jamais valide (les cas à trait d'union -s euphonique/pas-de-s ne sont pas testables ici :
    # le harnais 2b reconstruit sans trait d'union ; ils sont validés hors-CI par corpus_imperatif.jsonl, FP=0 sur UD)
    ("Soyons honnêtes entre nous", "soyons", "soyions", "impératif"),  # être impératif malformé (sans trait d'union)
    # accord du participe passé avec le sujet (être)
    ("Nous sommes allés à Paris", "allés", "allé", "accord participe"),   # nous → pluriel (-er)
    ("Elle est allée au marché", "allée", "allé", "accord participe"),    # elle → féminin (-er)
    ("Elle est venue hier", "venue", "venu", "accord participe"),         # -u (venir)
    ("Nous sommes partis tôt", "partis", "parti", "accord participe"),    # -ir (partir)
    ("Elle est morte en hiver", "morte", "mort", "accord participe"),     # irrégulier (mourir)
    # accord du PARTICIPE avec AVOIR + COD ANTÉPOSÉ (relatif « que ») — s'accorde avec l'objet placé AVANT
    ("les erreurs que nous avons faites", "faites", "fait", "accord participe (COD avoir)"),        # fém pluriel, aux séparé
    ("la voiture qu'elle a achetée", "achetée", "acheté", "accord participe (COD avoir)"),          # fém sing, qu'elle fusionné
    ("les photos que vous avez prises", "prises", "pris", "accord participe (COD avoir)"),          # irrégulier -s (prendre)
    ("la chanson que j'ai entendue", "entendue", "entendu", "accord participe (COD avoir)"),        # irrégulier -u, j'ai fusionné
    ("les fleurs que j'ai cueillies", "cueillies", "cueilli", "accord participe (COD avoir)"),      # -ir, fém pluriel
    # accord de l'adjectif attribut après être (sujet pronom)
    ("Elle est contente", "contente", "content", "accord adjectif"),      # elle → féminin
    ("Ils sont nationaux", "nationaux", "national", "accord adjectif"),   # ils → pluriel (-al→-aux)
    ("Elles sont vertes", "vertes", "vert", "accord adjectif"),           # elles → féminin pluriel
    # accord de l'adjectif attribut à sujet NOM (VRAI PARSEUR de tête de GN : mots-écrans « de X » sautés, FP=0 sur 14 450 UD)
    ("La voiture est bleue", "bleue", "bleu", "accord adjectif"),         # nom-sujet féminin (genre via déterminant « la »)
    ("La table est petite", "petite", "petit", "accord adjectif"),        # nom-sujet féminin
    ("Les plats sont bons", "bons", "bon", "accord adjectif"),            # nom-sujet masculin pluriel
    ("La couleur de la voiture est belle", "belle", "beau", "accord adjectif"),  # MOT-ÉCRAN : tête = couleur (f), pas voiture
    ("La voiture de mon père est verte", "verte", "vert", "accord adjectif"),    # MOT-ÉCRAN : tête = voiture (f), pas père
    # accord de l'adjectif ÉPITHÈTE ([article + nom genre connu + adj] → genre×nombre, FP=0 très gardé)
    ("La commission présidentielle est là", "présidentielle", "présidentiel", "accord adjectif épithète"),  # commission (f) → présidentielle
    ("Les domaines industriels progressent", "industriels", "industriel", "accord adjectif épithète"),     # domaines (m,pl) → industriels
    ("Une décision mondiale s'impose", "mondiale", "mondial", "accord adjectif épithète"),                 # décision (f) → mondiale
    ("Les enfants sont partis", "sont", "son", "son/sont"),               # sujet-nom pluriel + participe → sont
    # sujet « je » mal écrit devant être 1sg (séquence impossible → FP=0) : ke/ge/ce/se + suis/serais → je
    ("je suis fatigué", "je", "ke", "sujet je"),                          # clavier k↔j
    ("je suis content", "je", "ce", "sujet je"),                          # ce démonstratif ≠ sujet
    ("je suis là", "je", "se", "sujet je"),                               # se réfléchi ≠ sujet
    ("je suis prêt", "je", "ge", "sujet je"),                             # /ʒ/ → ge
    ("je serais content", "je", "ke", "sujet je"),                        # forme serais (conditionnel)
    # famille /sɛ/ : je/tu + c'est/ces/ses/sait → sais (savoir) ; c'est → s'est à travers un adverbe
    ("je sais nager", "sais", "c'est", "sais/sait"),                      # je c'est → je sais
    ("tu sais la réponse", "sais", "ces", "sais/sait"),                   # tu ces → tu sais
    ("je sais bien", "sais", "sait", "sais/sait"),                        # je sait → je sais (accord)
    ("elle s'est bien amusée", "s'est", "c'est", "c'est/s'est"),          # elle c'est bien amusée → s'est (adverbe intercalé)
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
