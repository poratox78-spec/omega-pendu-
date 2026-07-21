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
# PP en -u fréquents SUPPLÉMENTAIRES (Lexique4, par:pas, freq≥0.5) pour l'ACCORD du participe (rule_pp_etre / rule_pp_avoir_cod
# via _pp_base) : « intervenu/parvenu/survenu/obtenu/attendu/entendu/mordu/descendu… ». SÉPARÉ d'IRREG_PART À DESSEIN :
# _is_ppl (règle « j'est ») consulte IRREG_PART SEUL, pour GARDER son abstention sur « j'est entendu » (avoir↔passif ambigu,
# cf. recall_probe). Mesuré Δ+0 FP sur 2500 UD. (Idéal futur : dériver ces bases de Lexique dans build_cgram, cf. doctrine.)
_PP_U_EXTRA = {'abattu','accouru','advenu','apercu','appartenu','attendu','battu','chu','combattu','conclu','concu',
               'confondu','contenu','convaincu','convenu','corrompu','cousu','debattu','dechu','decu','defendu','deplu',
               'depourvu','descendu','detendu','detenu','elu','emu','entendu','entretenu','etendu','exclu','fendu',
               'fondu','foutu','interrompu','intervenu','maintenu','mordu','obtenu','parcouru','parvenu','pendu','percu',
               'perdu','pondu','pourvu','pretendu','prevenu','prevu','promu','reapparu','recousu','redevenu','reelu',
               'relu','rendu','repandu','repondu','resolu','retenu','revendu','revu','rompu','secouru','soutenu',
               'souvenu','survecu','survenu','suspendu','tendu','tondu','tordu','vaincu','vendu','vetu'}

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
        if e is None:
            # DÉTERMINANT ÉLIDÉ : « l'article » est UN token pour nous, DEUX pour le modèle (appris sur
            # UD, qui les sépare). Hors-vocabulaire, il retombait sur le backoff SUFFIXE puis sur le
            # prior « majuscule → PROPN ». Et comme Viterbi est GLOBAL, une seule forme collée DÉGRADE
            # l'étiquetage de TOUTE la phrase : « le responsable commandent l'article » faisait taguer
            # « commandent » NOUN. L'émission d'un « l'X » est celle de X — le déterminant ne porte pas
            # le contenu lexical.
            _m = _ELID_DET.match(lw)
            if _m: e = em.get(_m.group(1))
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

_E_PPL_STOP = {'cause', 'envie', 'affaire', 'affaires', 'confiance', 'honte', 'hate', 'chance', 'peine',
               'conscience', 'connaissance', 'tendance', 'coutume', 'estime', 'importance', 'influence',
               'crainte', 'cure', 'grace', 'force', 'partie', 'suite', 'tete', 'course', 'prise', 'charge'}


def rule_e_ppl(T, i):
    """AUXILIAIRE + verbe au PRÉSENT en -e → PARTICIPE en -é (« ont trouve »→trouvé, « a utilise »→utilisé).
    Le dys écrit la forme qu'il ENTEND (/truv/) ; après un auxiliaire, une forme FINIE est structurellement
    impossible — seul le participe peut suivre. rule_e_er ne voyait que -é↔-er, jamais le présent nu.
    Garde de couverture : le verbe doit être dans VERB_LEX (jeu CURÉ) — le commentaire de rule_e_er
    documente qu'élargir au lexique 155k fait monter les FP (53→74 sur UD). On ne rouvre pas ça."""
    w = T[i]; lw = w.lower(); dl = deacc(lw)
    if "'" in lw or not dl.endswith('e') or lw.endswith('é') or lw.endswith('ée'): return None
    if len(dl) < 4: return None
    if deacc((w[:-1] + 'er').lower()) not in VERB_LEX: return None      # vrai verbe du 1er groupe, jeu curé
    if dl in NOUN_E or dl in _E_PPL_STOP: return None                   # locution « avoir + nom NU » (« a envie de », « a cause de ») → jamais un participe
    if dl in D.GENDER_LEX:
        # NOM homographe (commande, place, garde, écoute…). Après un auxiliaire, un nom NU n'existe qu'en
        # LOCUTION ; un vrai complément exige un DÉTERMINANT. Le déterminant est AUDIBLE, donc fiable :
        #   « a commande LES rapports » → participe      « a envie DE partir » → nom
        nx = deacc(T[i+1].lower()) if i + 1 < len(T) else ''
        if nx not in NUM_DET and nx not in DET_GENDER: return None
    if dl in PREP or dl in MODAL: return None                           # mot-outil homographe (« a ENTRE autres participé ») : « entre » est une préposition, pas un verbe
    if i == 0: return None
    # AVOIR SEULEMENT. Après ÊTRE, une forme en -e est presque toujours un ADJECTIF (« est infecte »,
    # « est sèche », « est célèbre », « est égale ») : mesuré, ÊTRE apportait l'essentiel des 70 FP.
    if deacc(T[i-1].lower()) not in D.AUX_AVOIR: return None
    # « à » se DÉACCENTUE en « a » : sans ce test la préposition passait pour l'auxiliaire et
    # « à BASE de » devenait « à basé de » (11 FP à elle seule).
    if 'à' in T[i-1].lower(): return None
    # « A » MAJUSCULE n'est pas le verbe avoir : titre étranger (« A Place For Paedophiles ») ou sigle
    # coupé au point (« Bubendorff S.A. installe »). Deux des trois derniers FP venaient de là.
    if i - 1 > 0 and T[i-1][:1].isupper(): return None
    if w[:1].isupper(): return None                                     # un participe après avoir n'est pas capitalisé en cours de phrase
    # « est a base de » : ÊTRE suivi de AVOIR-3sg est impossible — ce « a » est un « à » mal accentué.
    if i >= 2 and deacc(T[i-2].lower()) in AUX: return None
    return _keepcase(w, w[:-1] + 'é')


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
    nxt_raw = T[i+1].lower() if i+1 < len(T) else ''
    nxt_noun_sg = _noun_gate(nxt) and not (nxt.endswith('s') or nxt.endswith('x')) and nxt_raw not in ('là', 'çà')   # NOM SG derrière = posterior §3 `_noun_gate` (P(NOM)≥τ ∧ P(VER)<ε), PAS l'appartenance brute à GENDER_PURE : « bien »/« à »/« de » sont dans GENDER_PURE (note de musique, homographes) → FP « …et… sont bien décidées »→son ; _noun_gate les écarte (NOUN_POST absent) et garde les vrais noms (chien/frère/ami). « là »/« çà » accentués = adverbes, exclus.
    plural_subj = (prev(T, i) in ('ils', 'elles')) or _plural_before(T, i) or is_plural_noun(T, i-1)
    if not plural_subj:                                                # déterminant PLURIEL (les/des/ces/leurs…) avant, dans la MÊME proposition → sujet pluriel (« Les sources … sont », « Les Bahrites ou X sont »)
        for j in range(i-1, max(-1, i-9), -1):
            if _SEG is not None and (j+1) < len(_SEG['bb']) and _SEG['bb'][j+1]: break
            if deacc(T[j].lower()) in PLURAL_DET: plural_subj = True; break
    if lw == 'sont':
        if prev(T, i) in ('il', 'elle', 'on', 'ils', 'elles', 'je', 'tu', 'nous', 'vous'): return None   # après un PRONOM SUJET, « sont » est le VERBE (« il sont là »), JAMAIS le possessif « son » (« il son X » est agrammatical) → ne pas proposer « son » ; le pronom sing (il/elle) est corrigé par rule_il_ils. Fixe « il sont là »→« il son là » et le sont→son de « il et elle sont »
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

# « mai » (le mois) écrit à la place de « mais » (la conjonction) — 92 occurrences dans les corpus,
# le plus gros silence mesuré par residual_audit.js. Même famille que rule_met_mais, autre graphie.
_MOIS = {'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre',
         'octobre', 'novembre', 'decembre'}
# contextes où « mai » est le MOIS : préposition/déterminant/quantifieur de date à gauche. « er » y figure
# parce que le tokeniseur jette les chiffres : « le 1er mai » arrive comme [le, er, mai].
_MAI_DATE_LEFT = {'en', 'de', 'du', 'des', 'depuis', 'jusqu', 'mi', 'debut', 'fin', 'courant', 'entre',
                  'avant', 'apres', 'vers', 'le', 'ce', 'cet', 'cette', 'au', 'aux', 'pour', 'd',
                  'premier', 'premiere', 'dernier', 'er', 'ler', 'et', 'ou', 'ni', 'que', 'qui',
                  'dont', 'si', 'comme', 'puis'}
# ouvertures de proposition à droite : la conjonction « mais » introduit une SECONDE proposition
_MAI_OPEN = {'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'ce', 'ca', 'cela', 'ceci',
             'le', 'la', 'les', 'un', 'une', 'des', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa',
             'ses', 'notre', 'nos', 'votre', 'vos', 'leur', 'leurs', 'cet', 'cette', 'ces',
             'ne', 'n', 'pas', 'plus', 'rien', 'jamais', 'aussi', 'encore', 'toujours', 'cependant',
             'pourtant', 'surtout', 'enfin', 'donc', 'alors', 'ici', 'y', 'en', 'tout', 'tous',
             'chacun', 'personne', 'quelques', 'certains', 'beaucoup', 'peu'}


def rule_mai_mais(T, i):
    if deacc(T[i].lower()) != 'mai': return None
    if i == 0: return None                                              # en tête : « Mai 68 » ; et une conjonction a besoin d'une proposition AVANT
    if _SEG is not None and i < len(_SEG['bb']) and _SEG['bb'][i]: return None   # début de proposition
    if i + 1 >= len(T): return None                                     # rien à droite : pas de seconde proposition
    p = deacc(T[i-1].lower())
    if p in _MAI_DATE_LEFT or p in _MOIS: return None                   # « en mai », « le 1er mai », « avril mai »
    nxt, n = T[i+1], deacc(T[i+1].lower())
    if n in _MOIS: return None                                          # « mai juin juillet »
    # ÉLISION : « l'équipe » est UN SEUL token — sans ce test on perdait 10 des 92 cas (même angle mort
    # que la règle on/ont). Le déterminant est là, juste collé.
    if not (n in _MAI_OPEN or re.match(r"^(l|j|c|n|s|qu)['’]", nxt.lower())): return None
    # une CONJONCTION joint deux propositions : il faut un verbe conjugué à GAUCHE, dans la même
    # proposition. Écarte « Paris, mai 1968 : la révolution » (aucun verbe) que UD ne contient pas mais
    # qui passerait sans ça.
    lo = 0
    if _SEG is not None:
        for j in range(i, 0, -1):
            if j < len(_SEG['bb']) and _SEG['bb'][j]: lo = j; break
    if not any(vlike(T, j) for j in range(lo, i)): return None
    return _keepcase(T[i], 'mais')


_LELID_STOP = {'un', 'une', 'autre', 'autres', 'on', 'uns'}   # « l'un et l'autre ont… » : pronoms indéfinis, pas des noms-têtes de sujet singulier


def rule_on_ont(T, i):
    lw = deacc(T[i].lower())
    if lw not in ('on', 'ont'): return None
    if _SEG is not None and i < len(_SEG['hy']) and _SEG['hy'][i]: return None   # « avait-on », « peut-on » : trait d'union → pronom inversé, jamais une faute
    if lw == 'ont':
        # « on » est un PRONOM SUJET : il ne peut PAS suivre un sujet NOMINAL. « La direction ont modifier » ne peut
        # pas devenir « La direction ON modifier » — impossible en français. Ce test passe AVANT tous les autres,
        # sinon le raccourci « mot suivant en -e » tranche le premier (« L'équipe ont rencontre » → « on rencontre »).
        _tgo = pos_tags(T)
        _so = _np_subject(T, _tgo, i) if _tgo else None
        # tête du GN COLLÉE au verbe : exigence qui écarte l'écran « de N » (« l'ensemble DES PARTICIPANTS ont »,
        # usage toléré), piège mesuré de cette famille. Sujet nominal SINGULIER ⇒ l'auxiliaire est « a » (avoir 3sg).
        # Débloque aussi le BLOCAGE MUTUEL : « ont modifier » n'était corrigible d'aucun côté ; « a » posé, la
        # règle du participe tire au tour suivant.
        if _so is not None and _so['idx'] == i - 1:
            return None if _so["n"] == "p" else _keepcase(T[i], "a")
        _cib = (i == 0) or (_SEG is not None and i < len(_SEG['bb']) and _SEG['bb'][i])
        if _so is None and i > 0 and not _cib:
            # ÉLISION : « L'équipe » est UN SEUL token, donc _np_subject n'y voit aucun déterminant et s'abstient.
            # Or « l' » est TOUJOURS singulier (« les » ne s'élide jamais) — l'information est là, juste collée.
            # MESURÉ : sans garde, cette branche coûte 4 FP sur UD (« de l'auteur, ont été publiées » sujet
            # POSTPOSÉ, « de l'homme, ont été unanimes » incise, « et l'étalonnage ont été » coordination,
            # « de l'album ont eu lieu » écran prépositionnel). Les quatre sont exactement ce que _np_subject
            # garde déjà — on lui emprunte ses gardes au lieu d'en inventer : pas de préposition ni de
            # coordination avant le GN, et pas de frontière de proposition entre lui et le verbe.
            _el = re.match(r"^l['’](.+)$", T[i-1].lower())
            _lft = deacc(T[i-2].lower()) if i >= 2 else ''
            if _el and deacc(_el.group(1)) not in _LELID_STOP and _lft not in PREP and _lft not in ('et', 'ou', 'ni'):
                _pe = NOUN_POST.get(deacc(_el.group(1))) if NOUN_POST else None
                if _pe and _pe[0] >= PL_TAU_M: return _keepcase(T[i], "a")
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

_PP_NOUN_HOMO = {'mort', 'fait', 'part', 'point'}   # noms homographes d'un participe → « à » PRÉPOSITION (condamnée à mort, tout à fait, à part, à point) ; le tagger tranche NOM vs VERB

def _aa_inverted(T, i):
    """Le pronom sujet en i-1 est-il INVERSÉ (« avait-il à cela », post-verbe / trait d'union) ? → pas un sujet PRÉVERBAL de « a » (FP à→a)."""
    if i - 2 < 0: return False
    hy = _SEG.get('hy', []) if _SEG is not None else []
    return vlike(T, i - 2) or (i - 1 < len(hy) and hy[i - 1])

def rule_a_aa(T, i):
    if deacc(T[i].lower()) != 'a': return None
    if T[i] == T[i].upper() and T[i] != T[i].lower(): return None      # « A » majuscule (sigle/lettre « Serie A » ; « À » en tête) → abstention (FP)
    pb = _SEG['bb'][i] if (_SEG is not None and i < len(_SEG['bb'])) else False   # frontière de proposition AVANT (virgule…) → le mot d'avant ne gouverne pas (« qui, à 4°C » : « qui » n'est pas le sujet de « à »)
    tg = pos_tags(T)                                                   # POS PLEINE-PHRASE : sépare les FAUX participes (nom homographe / -ment nominal) du vrai participe → tue les FP à→a par élimination
    p = prev(T, i)
    if not pb and p in ('il', 'elle', 'on', 'qui', 'ca', "c", "ça") and not _aa_inverted(T, i): return 'a'   # sujet 3sg net (pas à travers une virgule, pas inversé « avait-il ») → avoir
    if i+1 < len(T) and _is_ppl(T[i+1]) and not deacc(T[i+1].lower()).endswith('ee'):   # « a + participe » (« a été », « a décidé ») → auxiliaire AVOIR, jamais « à ». Écarte -ée FÉMININ (après AVOIR le pp NE s'accorde PAS → « -ée » = NOM → « à durée limitée » reste préposition)
        dn = deacc(T[i+1].lower()); nt = tg[i+1] if (tg and i+1 < len(tg)) else ''
        if not (dn in _PP_NOUN_HOMO and nt == 'NOUN'): return 'a'     # …SAUF nom-homographe tagué NOM (« condamnée à mort », « tout à fait ») = « à » préposition, pas le verbe « a »
    if i+2 < len(T) and deacc(T[i+1].lower()).endswith('ment') and (tg and i+1 < len(tg) and tg[i+1] == 'ADV') and _is_ppl(T[i+2]): return 'a'   # « a + ADVERBE(-ment) RÉEL + participe » (« a également exploité ») ; exige POS=ADV → exclut « à l'emplacement », « à l'effondrement » (NOM en -ment)
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
    if i+1 < len(T) and deacc(T[i+1].lower()) in ('il', 'elle', 'on', 'ils', 'elles', 'je', 'tu', 'nous', 'vous', 'moi', 'toi', 'lui', 'eux', 'soi'):
        return None                                                        # « il et elle », « lui et moi » : un pronom sujet suit → sujet COORDONNÉ, jamais « est » (« il est elle » est agrammatical) → « et » reste la conjonction
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


def rule_des_des(T, i):
    """« des » écrit pour « dès » — 50 occurrences mesurées, 2 formes seulement, toutes deux
    STRUCTURELLEMENT IMPOSSIBLES en français, donc FP=0 par construction :
      « des que »   → « des » est de+les, un déterminant pluriel ; « que » n'est pas un nom.
      « des l'X »   → un déterminant ne peut pas être suivi d'un autre déterminant élidé.
    Toute autre configuration : abstention (« des livres », « des l… » n'existe pas autrement)."""
    if deacc(T[i].lower()) != 'des': return None
    if i + 1 >= len(T): return None
    nxt = T[i+1]; nd = deacc(nxt.lower())
    if nd == 'que': return _keepcase(T[i], 'dès')
    if re.match(r"^l['’].", nxt.lower()): return _keepcase(T[i], 'dès')
    return None


def rule_ce_se(T, i):
    lw = deacc(T[i].lower())
    if lw not in ('ce', 'se'): return None
    if i+1 >= len(T): return None
    nd = deacc(T[i+1].lower())
    if nd in ('qui', 'que', 'dont', 'qu', "qu'"): return _keepcase(T[i], 'ce')         # ce qui/que/dont (+ élidé « qu' » : ce qu'il/qu'aurait)
    if nd in AUX or nd in ('sont', 'est'): return None                # « ce sont » vs « se sont déroulés », c'est vs s'est : ambigu → s'abstenir
    if nd in CLITIC: return None                                       # « se le/la/lui/en/y/ne donne » : clitique → « se » pronominal (ou « ce n'était » impersonnel) → ne pas toucher
    if nd in NUM_DET: return None                                      # « se une/le/des… » : déterminant, ni nom-tête ni verbe → abstention (texte corpus cassé)
    if nd.endswith('ant') and len(nd) > 4: return None                 # participe présent/gérondif (se constituant, en chantant) → « se » réfléchi, jamais « ce »
    isv = vlike(T, i+1); isn = nd in D.GENDER_LEX
    if isv and not isn: return _keepcase(T[i], 'se')                                    # verbe PUR → se (pronominal)
    tg = pos_tags(T)                                                   # homographe (livre/marche…)/inconnu → le TAGGER (contexte) tranche
    if tg is None or i+1 >= len(tg):
        return _keepcase(T[i], 'ce') if (isn and not isv) else None                    # sans tagger : repli nom-pur → ce
    # nom PUR → ce (démonstratif) SAUF si le tagger voit un VERBE (ex. « il se document[e] » : documenter absent du lexique verbal → isn/not-isv à tort) → on ne force PAS « ce »
    if isn and not isv and tg[i+1] not in ('VERB', 'AUX'): return _keepcase(T[i], 'ce')
    if lw == 'se':                                                     # « se » réfléchi est TOUJOURS devant un verbe/clitique → « se » + NOM (hors participe -ant) = « ce » (démonstratif)
        if tg[i+1] == 'NOUN' and not nd.endswith('ant'): return _keepcase(T[i], 'ce')
        # LE TAGGER EST CONTAMINÉ PAR LA FAUTE ELLE-MÊME. Dans « Se matin, la livraison est arrivée »
        # il étiquette « matin » VERB — parce que « se » prédit un verbe. Un tagger conditionné sur le
        # token fautif ne peut pas arbitrer la faute de ce token. Le posterior NOUN_POST, lui, est
        # SANS CONTEXTE (prior lexical), donc immunisé : matin/jour/soir/moment = P(NOM) 1000‰ et
        # P(VER) 0‰, tandis que livre/porte/marche/ferme restent ambigus et continuent de s'abstenir.
        if not nd.endswith('ant') and _noun_gate(nd): return _keepcase(T[i], 'ce')
        return None
    # lw == 'ce' → « se » SEULEMENT si un SUJET précède (« il ce lave »→se) ; sinon « ce » = PRONOM IMPERSONNEL (ce serait, ce n'était, pour ce faire) → abstention
    if tg[i+1] in ('VERB', 'AUX') and prev(T, i) in ('il', 'elle', 'on', 'je', 'tu', 'ils', 'elles', 'qui'):
        return _keepcase(T[i], 'se')
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

_ETRE_CONJ = {'je': 'suis', 'tu': 'es', 'il': 'est', 'elle': 'est', 'on': 'est',
              'nous': 'sommes', 'vous': 'êtes', 'ils': 'sont', 'elles': 'sont'}

def rule_ete_etre(T, i):
    """« ête » (non-mot) → être/êtes/es/été selon le CONTEXTE. Le son ne tranche pas (« trés→très » = même échange
    d'aperture qu'on veut ; « ête→été » qu'on ne veut pas) ; seul le contexte le fait (littérature : rescorage LM ;
    LanguageTool défère le non-mot à l'humain). avoir→été, pronom sujet→conjugaison d'être, sinon→être. Le speller
    JS (app/ext) est court-circuité sur « ête » pour laisser cette règle décider ; Python n'a pas de speller.
    L'app marque l'ambigu en ORANGE ; Python est rouge-seul (la clé de parité ignore le tier)."""
    m = re.match(r"^(n')?ête$", T[i].lower())
    if not m:
        return None
    pre = m.group(1) or ''
    p = deacc(T[i - 1].lower()) if i > 0 else ''
    praw = T[i - 1].lower() if i > 0 else ''
    if p in _AVOIR_AUX or praw in _AVOIR_JE:
        return _keepcase(T[i], pre + 'été')                       # avoir + été (« j'ai été »)
    if p in _ETRE_CONJ:
        return _keepcase(T[i], pre + _ETRE_CONJ[p])               # pronom sujet → conjugaison d'être
    return _keepcase(T[i], pre + 'être')                          # modal/prép/ambigu → infinitif (app : ORANGE si ambigu)

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
            return base if (deacc(base) in IRREG_PART or deacc(base) in _PP_U_EXTRA) else None
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
              'sorte', 'espece', 'genre',
              'bande', 'groupe', 'tas', 'serie', 'masse', 'nuee', 'troupe', 'ribambelle', 'cohorte',   # collectifs courants (accord de sens ambigu : « la bande de X arrivent » AUSSI valide → abstention)
              'myriade', 'pleiade', 'armee', 'meute', 'horde', 'essaim', 'tripotee', 'ramassis', 'foultitude', 'palanquee'}
def _noun_gender(w, num='s', full=False):
    """Genre d'un NOM via GENDER_PURE (noms à genre non ambigu). Dé-pluralisation SEULEMENT si le sujet est marqué
    pluriel (num=='p') et le mot n'est pas un invariable en -s (cours→cour(f) = faux ami). None sinon → abstention.
    full=True : quand GENDER_PURE échoue, retombe sur le lexique COMPLET D.GENDER_LEX (inclut les homographes
    verbe/nom : pomme/livre/lettre) — sûr UNIQUEMENT si l'appelant a déjà confirmé un antécédent [dét + NOM]
    (le contexte tranche l'homographie ; sinon on FP). Fix C : débloque l'accord du participe sur pomme/etc."""
    d = deacc(w.lower())
    def src(x):
        gg = GENDER_PURE.get(x)
        if gg in ('m', 'f'): return gg
        if full:
            gg = GENDER_FULL.get(x)
            if gg in ('m', 'f'): return gg
        return None
    g = src(d)
    if g: return g                                           # forme exacte (couvre singuliers + invariables cours/prix)
    if num != 'p' or d in _NOUN_INVAR_S: return None         # singulier, ou invariable -s → pas de dé-pluralisation
    if d.endswith('x') and len(d) > 2:                       # -eaux→-eau (bateaux→bateau)
        g = src(d[:-1]) or src(d[:-1] + 'u')
        if g in ('m', 'f'): return g
    if d.endswith('s') and len(d) > 2:                       # pluriel régulier : toilettes→toilette, voitures→voiture
        g = src(d[:-1])
        if g in ('m', 'f'): return g
    return None

# ---------- VRAI PARSEUR DE GROUPE-SUJET (tête du GN) ----------
# Sert l'accord adjectif/participe attribut ET l'accord sujet-verbe : identifie le NOM-TÊTE du sujet placé AVANT le verbe,
# en sautant les mots-écrans (compléments « de X » : « la couleur DE LA VOITURE est… » → tête = couleur, pas voiture) et
# en s'abstenant sur les cas où le sujet n'est pas un [dét + nom] simple (coordination = genre mixte ; infinitif/proposition
# = « s'assurer DE LA PENTE était crucial » → le dét « la » est précédé de « de » ⇒ PP, pas le sujet ⇒ abstention). FP-sûr.
_ELID_DET = re.compile(r"^l['’](.+)$")   # « l'X » = déterminant élidé + nom-tête dans UN SEUL token
_ELID_PRON = re.compile(r"['’](ils|elles|il|elle|on|je|tu|nous|vous)$")   # pronom ELIDE colle : qu'ils, s'il, lorsqu'elle


def _head_text(tok):
    """Le NOM porte par un token, elision decollee : « L'allegation » -> « allegation ».
    PRIMITIVE : la majuscule d'un nom elide en tete de phrase appartient au DETERMINANT, pas au nom.
    Les regles qui testaient tok[:1].isupper() pour ecarter un nom PROPRE ecartaient donc tout nom
    commun elide en tete de phrase (8 divergences mesurees par elision_probe sur l'adjectif epithete)."""
    m = _ELID_DET.match(tok.lower())
    return tok[len(tok) - len(m.group(1)):] if m else tok


def _elid_kind(tok):
    """Que cache un token a apostrophe ? 'pron' (qu'ils, s'il) | 'det' (l'equipe) | None.
    PRIMITIVE PARTAGEE : sans elle, les regles posent un veto EN BLOC sur l'apostrophe -- ce qui ecarte
    les pronoms elides (souhaite) MAIS AUSSI les determinants elides (angle mort mesure : 41 divergences,
    et 27 vetos-en-bloc rien que dans ce fichier)."""
    t = tok.lower()
    if _ELID_PRON.search(deacc(t)): return 'pron'
    if _ELID_DET.match(t): return 'det'
    return 'pron' if ("'" in t or "’" in t) else None   # autre contraction (d', qu', n') : prudence, on garde le veto


_COLLECTIF = set('''plupart majorite minorite moitie ensemble totalite reste nombre quantite foule dizaine douzaine centaine millier tas infinite serie groupe partie'''.split())   # accord « au sens » toléré : ces têtes acceptent le verbe au pluriel


def _np_subject(T, tg, a):
    """Sujet [déterminant + nom-tête] placé juste avant le verbe d'indice a. Renvoie {'idx','det','g','n'} ou None.
    Bornes : proposition (_SEG). Abstention sur coordination (et/ou/ni), sujet-pronom (traité ailleurs), sujet-PP/infinitif
    (déterminant précédé d'une préposition), nom-tête absent."""
    lo = 0
    if _SEG is not None:
        for j in range(a, 0, -1):
            if j < len(_SEG['bb']) and _SEG['bb'][j]: lo = j; break
    det_idx = None
    _seen_prep = False
    _elid = False
    j = a - 1
    while j >= lo:
        dj = deacc(T[j].lower()); tgj = tg[j] if (tg and j < len(tg)) else None
        if dj in ('et', 'ou', 'ni'): return None             # sujet coordonné → genre/nombre mixtes → abstention
        if dj in _NP_BREAK: break                            # relative/subordonnée (que/qui/dont…) → GN sujet à droite (ne pas remonter dans la proposition amont)
        if _ELID_DET.match(T[j].lower()):
            # Ce test passe AVANT la frontière VERBALE ci-dessous : sur un token COLLÉ le tagger est
            # CONTAMINÉ — il étiquette « l'entreprise » VERB dans « l'entreprise ne présentais pas ».
            # PAS de garde « le tagger ne dit pas VERB » : sur un token COLLÉ le tagger est justement
            # contaminé — il étiquette « l'entreprise » VERB dans « l'entreprise ne présentais pas »
            # et dans « En urgence, l'entreprise commandaient ». C'est le GENRE du lexique (sans
            # contexte) qui décide plus bas : genre inconnu (« l'a », « l'ont », « l'on ») → abstention.
            # PRIMITIVE : DÉCOLLER L'ÉLISION. « l'équipe » est UN SEUL token, donc ni le tagger ni les
            # listes de déterminants n'y voient de déterminant — le parseur s'abstenait, et avec lui
            # toutes les règles d'accord qui en dépendent (23 divergences mesurées par elision_probe).
            # Or « l' » est TOUJOURS singulier (« les » ne s'élide jamais) : l'information EST là,
            # simplement collée. On la rend au parseur au lieu de la redécouvrir règle par règle.
            if det_idx is None or _seen_prep:
                det_idx = j; _seen_prep = False; _elid = True
            j -= 1; continue
        if tgj in ('VERB', 'AUX'):                           # frontière verbale : le GN sujet est à droite de j…
            if T[j].lower().endswith(('é', 'és', 'ée', 'ées')) and not (j-1 >= lo and tg and j-1 < len(tg) and tg[j-1] == 'AUX'):
                j -= 1; continue                             # …SAUF participe-épithète (relative réduite « cartons EMPILÉS dans… ») non précédé d'un aux = adjectif, pas le verbe → sauter vers le nom-tête
            break
        if dj in NUM_PRON: break                             # sujet-pronom → route pronom (rule_adj_attr) / abstention ici
        if "'" in T[j].lower() and re.search(r"(ils|elles|il|elle|on|je|tu|nous|vous)$", dj):
            break                                            # PRONOM COLLÉ (« qu'ils ont fait », « s'ils », « lorsqu'elle ») : le sujet EST ce pronom, pas un GN — sinon on remontait chercher un déterminant plus à gauche et on prenait le pronom lui-même pour nom-tête
        _pj = (dj in PREP or dj == 'en' or ("'" in T[j].lower() and dj.startswith('d')))
        if _pj: _seen_prep = True   # « de/du/des/au/aux/en/d' » : lien qui RATTACHE le GN de gauche à celui de droite. « en » MANQUAIT de PREP — « avec un cercle EN SON CENTRE ont été érigées » prenait « centre » pour sujet.
        if tgj == 'DET' or dj in NUM_DET:
            # On remonte au déterminant le PLUS À GAUCHE — mais SEULEMENT à travers un lien « de ».
            # C'est pour ça que la remontée existe : « les enfants DE la voisine » a sa tête à gauche
            # (« enfants »), pas à droite. Sans la condition, « Ce matin la livraison est arrivée »
            # remonte de « la » à « Ce » et prend « matin » pour sujet → « est arrivé » (FP mesuré).
            # Un second GN à gauche SANS lien « de » est un GN adverbial (« ce matin », « la semaine
            # dernière »), pas le sujet : on garde alors le déterminant le plus PROCHE du verbe.
            # Une préposition CONTRACTÉE (du/des/au/aux) qui sert d'ancre reste « molle » (_seen_prep
            # gardé vrai) : elle ouvre un COMPLÉMENT, donc un vrai déterminant plus à gauche doit
            # pouvoir la remplacer (« les autorités DU Sahara ont » → tête « autorités », pas « Sahara »).
            if det_idx is None or _seen_prep:
                det_idx = j; _seen_prep = _pj; _elid = False
        j -= 1
    if det_idx is None: return None
    # Un déterminant qui est AUSSI une préposition contractée (du/des/au/aux) et qui suit un NOM ouvre un
    # COMPLÉMENT, pas le sujet : « de nombreux pouvoirs DU GOUVERNEUR ont été délégués », « 50 000
    # Allemands DU WARTHELAND ont péri ». Aucun vrai déterminant n'existe plus à gauche (le numéral est
    # invisible pour le tokeniseur), donc la remontée ne peut pas réparer — on s'abstient.
    if (deacc(T[det_idx].lower()) in PREP and det_idx - 1 >= lo
            and tg and det_idx - 1 < len(tg) and tg[det_idx-1] in ('NOUN', 'PROPN')): return None
    if det_idx - 1 >= lo and deacc(T[det_idx-1].lower()) in PREP:
        return None                                          # « de la pente » : dét dans un PP ⇒ ce n'est pas le sujet ⇒ abstention
    if _elid:                                                # « l'équipe » : le déterminant ET la tête sont le MÊME token
        _h = _ELID_DET.match(T[det_idx].lower()).group(1)
        _g = _noun_gender(_h, 's') or GENDER_PURE.get(deacc(_h))
        if _g not in ('m', 'f'): return None                 # genre inconnu → on ne sait pas rendre le déterminant → abstention
        return {'idx': det_idx, 'det': det_idx, 'g': _g, 'n': 's', 'elid': True,
                'dtxt': ('la' if _g == 'f' else 'le'), 'htxt': _h}
    head = None                                              # nom-tête = 1er nom après le déterminant, AVANT tout complément « de X »
    for k in range(det_idx + 1, a):
        dk = deacc(T[k].lower())
        if dk in PREP or "'" in T[k].lower() and dk[:1] == 'd': break   # entrée dans un complément → la tête est avant
        if (tg and k < len(tg) and tg[k] in ('NOUN', 'PROPN')) or dk in GENDER_PURE:
            head = k; break
    if head is None: return None
    if deacc(T[head].lower()) in _COLLECTIF: return None   # NOM COLLECTIF (« la plupart ONT gardé », « la majorité sont ») : l'accord se fait au SENS, singulier ET pluriel sont corrects → abstention
    ddet = deacc(T[det_idx].lower())
    if ddet in NUM_DET:     num = 'p' if NUM_DET[ddet] == 'pl' else 's'
    elif ddet in _QUANT_PL: num = 'p'                         # plusieurs/quelques/certains/deux… (quantifieurs pluriels hors NUM_DET)
    elif ddet in _QUANT_SG: num = 's'                         # chaque/aucun/nul → singulier (même si le nom-tête finit en -s : « chaque relais »)
    else:                                                     # déterminant tagué DET mais hors listes → nombre via la morpho du nom-tête (invariables -s exclus)
        dh = deacc(T[head].lower())
        if dh in _NOUN_INVAR_S: return None
        num = 'p' if dh[-1:] in 'sx' else 's'
    g = _noun_gender(T[head], num) or _ADJ_DETM.get(ddet) or ('f' if ddet in _ADJ_DETF else None)  # le/un/ce→m, la/une/cette/ma/ta/sa→f (son/mon/ton EXCLUS : ambigus)
    return {'idx': head, 'det': det_idx, 'g': g or '?', 'n': num, 'elid': False,
            'dtxt': T[det_idx], 'htxt': T[head]}   # TEXTES explicites : les consommateurs ne re-derivent plus le determinant et la tete depuis T[], ce qui est exactement la ou l'elision se perdait

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
_COLOR_ADJ = {'bleu', 'vert', 'gris', 'blanc', 'noir', 'brun', 'violet', 'jaune', 'rouge', 'rose',
              'orange', 'marron', 'roux', 'blond', 'pourpre', 'mauve', 'beige', 'fauve'}   # couleurs : INVARIABLES en composé (bleu clair) ou dérivées de nom (vert pomme) → abstention si suivies d'un ADJ/NOM qualificatif
# COULEURS/MATIÈRES dérivées de NOM (fruit/pierre/matière) = adjectif INVARIABLE (« des gants crème », « bleu marine »).
# Beaucoup ont une lecture VERBE fantôme (crème→crémer, marine→mariner, olive→oliver) ET sont absents de GENDER_FULL →
# le filet homographe les prend pour des verbes et les accorde (« des gants crème »→crèment). Ce set les rend invariables.
_INVAR_COLOR = {'creme', 'marine', 'saumon', 'emeraude', 'turquoise', 'kaki', 'bordeaux', 'ivoire', 'ebene',
                'moutarde', 'brique', 'ocre', 'indigo', 'azur', 'cerise', 'framboise', 'lavande', 'prune', 'olive',
                'caramel', 'chocolat', 'noisette', 'paille', 'sable', 'bronze', 'cuivre', 'acajou', 'corail', 'grenat',
                'aubergine', 'abricot', 'peche', 'citron', 'lilas', 'anthracite', 'ardoise', 'taupe', 'champagne',
                'rouille', 'safran', 'pistache', 'amande', 'menthe', 'crevette', 'brique', 'nacre', 'perle', 'ivoire'}
def rule_adj_epithet(T, i):
    """Accord en GENRE×NOMBRE de l'ADJECTIF ÉPITHÈTE avec le nom qu'il suit : [ARTICLE + NOM(genre connu) + ADJ]
    (« la règle présidentiel »→présidentielle, « les domaines industriel »→industriels). Le territoire genre-adjectif
    jadis écarté, tenu FP=0 par : tagger ADJ, genre GENDER_PURE, NOMBRE via ARTICLE net, invariants(_SG_STOP)/nom
    propre/coordination(et/ou)/figé(«de»)/épicène exclus. Mesuré 60→1 FP sur UD (le 1 = vraie faute)."""
    # ÉLISION : « L'allégation naturel » n'a que DEUX tokens — l'article est COLLÉ au nom. Le patron
    # [ARTICLE + NOM + ADJ] du cas général ne s'applique pas, mais l'information y est toute :
    # « l' » = article défini SINGULIER, et le nom est la partie après l'apostrophe.
    _el = (i >= 1 and _elid_kind(T[i-1]) == 'det')
    # Un ÉPITHÈTE est dans le MÊME segment que son nom. « L'allégation « naturel » est floue » : le
    # tokeniseur jette les guillemets, donc « naturel » (une MENTION) devient l'épithète apparent de
    # « allégation ». _SEG.bb marque déjà les guillemets et virgules — il suffisait de le consulter.
    if _SEG is not None and i < len(_SEG['bb']) and _SEG['bb'][i]: return None   # garde GÉNÉRALE (pas seulement le cas élidé) : un épithète est dans le MÊME segment que son nom
    if i < 2 and not _el: return None
    w = T[i]; lw = w.lower()
    if "'" in lw or w[:1].isupper(): return None
    d = deacc(lw)
    if d not in ADJ_LEX or _adj_estem(lw) is not None: return None   # inconnu / épicène (radical -e : rouge/jeune) → pas de genre à trancher
    if d in ('tout', 'tous', 'toute', 'toutes'): return None         # géré par rule_tout_det (rôle déterminant/adverbe/pronom)
    if i+1 < len(T) and deacc(T[i+1].lower()) in ('de', 'et', 'ou', 'ni'): return None   # figé (« haut de gamme ») + coordination distributive (« sites allemand et français »)
    if d in ('bon', 'meilleur') and i+1 < len(T) and deacc(T[i+1].lower()) == 'marche': return None   # locution INVARIABLE « (bon/meilleur) marché » (« des vêtements bon marché ») — pas un adjectif accordable
    tg = pos_tags(T)
    if not tg or i >= len(tg) or tg[i] != 'ADJ': return None
    if tg[i-1] != 'NOUN' and not _el: return None   # sur un nom ÉLIDÉ le tagger dit PROPN (majuscule de l'article en tête de phrase) : c'est le genre du lexique qui fait foi ci-dessous
    if d in _COLOR_ADJ and i+1 < len(tg) and tg[i+1] in ('ADJ', 'NOUN'): return None   # COULEUR COMPOSÉE (bleu clair, vert pomme, bleu marine) = INVARIABLE → abstention (piège Voltaire)
    if _head_text(T[i-1])[:1].isupper(): return None                 # nom propre (capitalisé) → genre non fiable. ÉLISION DÉCOLLÉE : « L'allégation » en tête de phrase porte la majuscule du DÉTERMINANT, pas du nom — la tester ici écartait tout nom commun élidé.
    dn = deacc(_head_text(T[i-1]).lower()); g = GENDER_PURE.get(dn)
    if g not in ('m', 'f') or dn in _SG_STOP: return None            # genre connu (nom pur) ET pas un invariant -s/-x
    num = 's' if _el else (_EPI_ART.get(deacc(T[i-2].lower())) if i >= 2 else None)   # « l' » ne s'élide qu'au SINGULIER (« les » ne s'élide jamais) : le nombre est certain
    if num is None: return None                                      # nombre NON net (pas d'article devant le nom) → abstention (écran/possessif)
    sugg = _adj_agree(w, g, num)
    return _keepcase(T[i], sugg) if sugg.lower() != lw else None

def _pp_coord_subject(T, tg, a):
    """Sujet COORDONNÉ « X et/ni Y » juste avant l'aux ÊTRE (position a) → 'p' (pluriel), sinon None. Mêmes gardes FP=0
    que rule_accord_sv_coord (conjoint = pronom disjoint / [dét+nom] / nom(s) propre(s) nu(s) ; aucun verbe/prép/autre
    conjonction dans la zone sujet). NB : ici on TOLÈRE les conjoints noms-propres nus (« Luc et Samuel ») — à MESURER
    (le risque = nom composé « Belcastel-et-Buc »)."""
    lo = 0
    if _SEG is not None:
        for j in range(a, 0, -1):
            if j < len(_SEG['bb']) and _SEG['bb'][j]: lo = j; break
    conjuncts = [[]]; has_sep = False
    for m in range(lo, a):
        dm = deacc(T[m].lower())
        if dm in ('et', 'ni'): conjuncts.append([]); has_sep = True; continue
        if dm in ('ou', 'mais', 'car', 'donc', 'or', 'que', 'qu', 'qui'): return None
        if "'" in T[m].lower(): return None
        if m >= len(tg) or tg[m] in ('VERB', 'AUX') or dm in PREP: return None
        conjuncts[-1].append(m)
    if not has_sep or len(conjuncts) < 2: return None
    for cj in conjuncts:
        if not cj: return None
        first = deacc(T[cj[0]].lower())
        if len(cj) == 1 and first in _COORD_PRON: continue                      # pronom disjoint (toi/moi/lui/eux…)
        if tg[cj[0]] == 'DET' or T[cj[0]].lower() in NUM_DET:                    # [dét (+adj) + nom]
            if not any(tg[m] in ('NOUN', 'PROPN') for m in cj): return None
            continue
        if tg[cj[0]] in ('NOUN', 'PROPN') and all(tg[m] in ('NOUN', 'PROPN', 'ADJ') for m in cj): continue   # nom(s) propre(s)/commun(s) nu(s)
        return None
    return 'p'

def rule_pp_etre(T, i):
    """Accord du PARTICIPE PASSÉ (tous groupes) avec le SUJET après ÊTRE : « nous sommes allez/allé »→allés,
    « elle est venu »→venue, « nous sommes parti »→partis, « elle est mort »→morte, « ils sont transformé »→transformés.
    Sujet = pronom fiable (il/elle/ils/elles/nous/je/tu ; on/vous exclus car ambigus). Genre inconnu (je/tu/nous) →
    on GARDE le genre écrit (jamais de fém→masc forcé). FP≈0 : ne se déclenche QUE si le participe est en DÉSACCORD."""
    lw = T[i].lower()
    if "'" in lw: return None
    base = _pp_base(T[i])                                      # base masc-sing du participe (tous groupes) ; None sinon
    if base is None: return None
    if deacc(base) in _PP_PERCEPTION and i+1 < len(T) and deacc(T[i+1].lower()) in VERB_LEX: return None   # « s'est vu/fait/laissé/entendu + INFINITIF » → PP INVARIABLE (piège Voltaire : « se les était vu confisquer », « elle s'est fait avoir »)
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
        if a >= 1 and _elid_kind(T[a-1]) == 'pron': return None   # PRONOM élidé avant l'aux (« qu'elle soit emmenée », « s'il est venu ») → le vrai sujet est le clitique. AVANT : veto EN BLOC sur l'apostrophe, qui écartait aussi le DÉTERMINANT élidé (« l'origine est discuté ») — l'angle mort mesuré.
        tg = pos_tags(T)
        if not tg or i >= len(tg) or tg[i] not in ('VERB', 'ADJ'): return None   # participe RÉEL (tagger) → écarte les noms homographes (« les données sont… »)
        if i+1 < len(tg) and tg[i+1] == 'DET': return None     # déterminant juste APRÈS le participe → sujet POSTPOSÉ (« est annoncée la reprise ») ou attribut → identification du sujet non fiable → abstention (FP)
        subj = _np_subject(T, tg, a)
        if subj is None:                                          # sujet nominal simple non résolu → tenter le sujet COORDONNÉ « X et Y sont » (pluriel, genre écrit gardé comme le chemin « nous »)
            if aux_num == 'p' and _pp_coord_subject(T, tg, a) == 'p':
                gen = 'f' if deacc(lw[:-1] if lw.endswith('s') else lw) == deacc(base) + 'e' else 'm'
                sugg = base + ('es' if gen == 'f' else 's')
                return _keepcase(T[i], sugg) if sugg.lower() != lw else None
            return None
        if subj['g'] not in ('m', 'f') or subj['n'] != aux_num: return None   # genre inconnu / aux en désaccord → abstention
        if a - subj['idx'] > 5: return None                    # sujet trop LOIN de l'aux → parseur peu fiable sur phrase longue (FP « dioxyde … est autorisé »)
        for k in range(subj['idx']+1, a):                      # nom PROPRE/capitalisé entre le sujet et l'aux → sujet réel ambigu (FP « Plusieurs fois les Français sont forcés »)
            if T[k][:1].isupper() and k < len(tg) and tg[k] in ('NOUN', 'PROPN'): return None
        sugg = base + {'sm': '', 'sf': 'e', 'pm': 's', 'pf': 'es'}[subj['n'] + subj['g']]
        return _keepcase(T[i], sugg) if sugg.lower() != lw else None
    if _SEG is not None and sk < len(_SEG['hy']) and _SEG['hy'][sk]: return None   # « poursuit-il » : pronom d'inversion (incise) ≠ sujet → abstention
    num, gen = info
    if num != aux_num: return None                           # « elles est … » : aux et sujet en désaccord → l'erreur est ailleurs, abstention
    refl = deacc(T[sk].lower()) == 'se' or (sk >= 1 and deacc(T[sk-1].lower()) in _PP_SUBJ)   # pronominal RÉFLÉCHI : « se » (ou pronom doublé « nous nous »/« vous vous »)
    if refl and i+1 < len(T):                                # pronominal + COD après (nom/déterminant) → « se » = COI, PP INVARIABLE (« nous nous sommes rendu service », « ils se sont lavé les mains ») ; n'affecte PAS « devenus médecins » (non pronominal)
        tgn = pos_tags(T)
        if tgn and i+1 < len(tgn) and tgn[i+1] in ('NOUN', 'DET'): return None
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
                'succede', 'procede', 'remedie', 'convenu', 'nui', 'menace', 'songe', 'reve',
                'fallu', 'pu'}    # TOUJOURS invariables : falloir (impersonnel) + pouvoir (objet = infinitif, jamais COD direct) — cf. « les efforts qu'il a fallu/pu » (pièges Voltaire). PAS du/su/voulu qui, eux, PEUVENT s'accorder.
_PP_PERCEPTION = {'vu', 'entendu', 'senti', 'regarde', 'ecoute', 'apercu', 'laisse', 'envoye', 'fait'}   # PP de perception/factitif : + INFINITIF = accord ambigu (l'antécédent fait OU subit l'action) → abstention ; « fait »+inf = causatif TOUJOURS invariable (« que j'ai fait venir », « s'est fait avoir »)
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
    if deacc(base) in _PP_PERCEPTION and i+1 < len(T) and deacc(T[i+1].lower()) in VERB_LEX: return None   # PP de perception/factitif + INFINITIF (« les airs que j'ai entendu jouer ») : l'antécédent SUBIT l'infinitif → accord AMBIGU (piège Voltaire) → abstention FP-safe
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
    g = _noun_gender(T[noun], nb, full=True)                        # antécédent = [dét (+adj) + NOM] confirmé (tagger+position) → lexique complet OK (homographes)
    if g not in ('m', 'f'): return None
    if i < len(tg) and tg[i] == 'NOUN': return None                 # le tagger le voit comme un NOM confiant (« les données que… ») ⇒ homographe ⇒ abstention (PROPN = repli mot inconnu, on laisse : la morphologie a déjà validé le participe)
    sugg = _pp_accord(base, nb, g)
    return _keepcase(T[i], sugg) if sugg.lower() != lw else None


# ---------- Participe passé avec AVOIR + relatif « dont » (COI) ⇒ INVARIABLE ----------
# « dont » remplace TOUJOURS un complément « de X » (jamais un COD) ⇒ le participe conjugué avec AVOIR reste
# INVARIABLE (masc-sing = forme de base). « les choses dont je t'ai parlées »→parlé (défait l'hypercorrection).
# FP=0 garanti par la grammaire (dont n'est jamais COD) ; garde-fous : AVOIR seul (être/pronominal accordent avec
# le SUJET ⇒ exclus), « dont » gouverne dans la MÊME proposition (_SEG borne), abstention si un « que » (COD
# antéposé) précède le participe (c'est alors rule_pp_avoir_cod qui gouverne l'accord, pas « dont »).
_ETRE_FORMS_DONT = set(D.AUX_ETRE) | {'etais', 'etait', 'etions', 'etiez', 'etaient', 'fus', 'fut', 'fumes',
                                      'serai', 'seras', 'sera', 'serons', 'serez', 'seront', 'sois', 'soit', 'soient'}
def _tok_conj_is(tok, forms):
    """Forme conjuguée dans `forms` ? Gère le clitique fusionné (j'ai / t'ai / l'a → partie après l'apostrophe)."""
    d = deacc(tok.lower())
    if d in forms: return True
    if "'" in tok: return deacc(tok.lower().rsplit("'", 1)[-1]) in forms
    return False

# Participes de verbes INTRANSITIFS en « de » (deacc, base masc-sing) : « dont » = LEUR complément « de » ⇒ ils
# n'ont JAMAIS de COD ⇒ le participe est TOUJOURS invariable. Whitelist = FP=0 (les verbes transitifs comme
# donner/traiter/écrire sont exclus : là « dont » peut être adverbial et le participe accorde avec un vrai COD).
_PP_DONT_DE = {'parle', 'reve', 'doute', 'joui', 'profite', 'beneficie', 'herite', 'dispose', 'temoigne',
               'raffole', 'decoule', 'resulte', 'accouche'}
def rule_pp_avoir_dont(T, i):
    lw = T[i].lower()
    if "'" in lw: return None
    base = _pp_base(T[i])
    if base is None: base = _IRR_PP.get(deacc(lw))
    if base is None: return None
    if deacc(base) not in _PP_DONT_DE: return None                  # whitelist verbes intransitifs-« de » → FP=0
    if deacc(base) == deacc(lw): return None                        # déjà invariable (masc-sing) → rien à défaire
    a = None                                                        # auxiliaire AVOIR PROCHE (≤3 tokens, ne saute que _PP_MID)
    for k in range(i - 1, max(-1, i - 4), -1):
        tk = T[k]; dk = deacc(tk.lower())
        if dk == 'ete' or _tok_conj_is(tk, _ETRE_FORMS_DONT): return None   # « a été <PP> » passif / pronominal → accorde avec le sujet
        if _tok_conj_is(tk, _AVOIR_AUX): a = k; break                       # avoir (y compris fusionné j'ai/t'ai/l'ai)
        if dk in _PP_MID: continue
        return None
    if a is None: return None
    lo = 0                                                          # borne de proposition à gauche de l'aux
    if _SEG is not None:
        for jj in range(a, 0, -1):
            if jj < len(_SEG['bb']) and _SEG['bb'][jj]: lo = jj; break
    for k in range(a - 1, lo - 1, -1):                             # « dont » gouverne dans la même proposition
        dk = deacc(T[k].lower())
        if dk == 'que' or T[k].lower().startswith("qu'"): return None
        if dk == 'dont': return _keepcase(T[i], base)
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


_REG_3PL = (('ind:imp', 'ait', 'aient'), ('cnd:pre', 'ait', 'aient'), ('ind:fut', 'ra', 'ront'))   # 3pl DÉTERMINISTE (0 exception FR) : imparfait/conditionnel 3s -ait→-aient · futur 3s -ra→-ront

def _fill_reg_3pl(cjc, cjf):
    """CLÔTURE 3PL RÉGULIÈRE. build_cgram envoyait tout « -aient » dans le bucket ambigu (finit par « -ient ») et sa
    résolution 3s/3p saute ind:imp → imparfait 3pl ABSENT partout (3551 lemmes : « les enfants jouait » non corrigé,
    « étaient » lu étayer) ; conditionnel/futur 3pl partiellement couverts (filtre HF). Ces 3pl sont DÉTERMINISTES →
    on les reconstruit du 3s au chargement, à l'identique dans les 3 moteurs (parité)."""
    for lem, mts in cjc.items():
        for mt, suf3s, suf3p in _REG_3PL:
            slot = mts.get(mt)
            if not slot: continue
            f3s = slot.get('3s')
            if isinstance(f3s, (list, tuple)): f3s = f3s[0]
            if not f3s or '3p' in slot or not f3s.endswith(suf3s): continue
            f3p = f3s[:-len(suf3s)] + suf3p
            slot['3p'] = f3p
            key = deacc(f3p.lower()); reading = lem + ';' + mt + ';3;p'
            cur = cjf.get(key)
            if not cur: cjf[key] = reading
            elif reading not in cur: cjf[key] = cur + '|' + reading

if CONJ_LOADED:
    _fill_reg_3pl(CONJ_C, CONJ_F)

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

_TLD_CAP = {'com', 'net', 'org', 'fr', 'io', 'co', 'eu', 'de', 'uk', 'be', 'ca', 'ch', 'us', 'info', 'edu', 'gov', 'biz', 'tv', 'me', 'app'}  # point de DOMAINE (commentcamarche.net) ≠ fin de phrase → pas de majuscule sur le TLD

def _seg_info(text):
    import re
    ss, bb, hy, cap, dig, prev_end = [], [], [], [], [], 0
    for k, m in enumerate(re.finditer(r"[A-Za-zÀ-ÿœŒ']+", text)):
        gap = text[prev_end:m.start()]
        s = any(c in gap for c in '.!?…')                        # début de phrase = APRÈS . ! ? (pas le 1er token : un fragment ne se capitalise pas)
        ss.append(s)
        bb.append(s or any(c in gap for c in ',;:()«»"–—\n'))
        hy.append('-' in gap)                                    # trait d'union avant (inversion « dit-il ») → anti-FP run-on
        _dom = ('.' in gap and not any(c.isspace() for c in gap) and m.group().lower() in _TLD_CAP)   # « .net/.com » collé (point de domaine, pas de fin de phrase) → jamais capitaliser le TLD
        cap.append(s and '..' not in gap and not any(c.isdigit() for c in gap) and not _dom)   # MAJUSCULE : vraie fin de phrase — pas une ellipse « .. », un point de nombre/décimale, ni un point de DOMAINE (URL)
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
    if per == '3' and nb == 's' and deacc(T[i].lower()) in _V3PL_SURE:   # « il/elle » (sing) + verbe SÛR 3pl (sont/ont/vont/font) : le « s » MUET de ils/elles est tombé → c'est le PRONOM la faute (rule_il_ils), pas le verbe → NE PAS fixer le verbe (sinon « il sont »→« ils est »)
        _pp = deacc(T[i-1].lower()) if i > 0 else ''
        if _pp in ('ne', 'n') and i > 1: _pp = deacc(T[i-2].lower())
        if _pp in ('il', 'elle'): return None
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
    if mt == 'ind:pas': return None                             # passé simple : hors ROUGE (→ vigilance ORANGE app/ext), cohérent avec _sv_finish
    sugg = CONJ_C.get(lem, {}).get(mt, {}).get(per + nb)
    if not sugg: return None
    if not _agrees(_reads(sugg), per, nb):
        return None                                             # garde : la suggestion doit VRAIMENT s'accorder (anti-bruit Lexique)
    return sugg


_V3PL_SURE = {'sont', 'ont', 'vont', 'font'}   # 3e pluriel irréguliers NON ambigus (jamais nom/adj, jamais 3sg)

def rule_il_ils(T, i):
    """AUDIBILITÉ sur le SUJET : « il/elle » + verbe SANS AMBIGUÏTÉ 3e pluriel → le « s » de ils/elles est MUET (le dys le
    laisse tomber), le verbe audible est fiable → corriger le PRONOM, pas le verbe. « il sont »→« ils sont ». FP=0 :
    « il/elle + verbe-3pl » n'existe pas en français correct. rule_accord_sv s'abstient en miroir (pas de « ils est »)."""
    lw = deacc(T[i].lower())
    if lw not in ('il', 'elle'): return None
    if i > 0 and (deacc(T[i-1].lower()) in ('et', 'ou', 'ni') or ',' in T[i-1]): return None   # sujet COORDONNÉ (« Paul et elle sont », « il et elle sont ») → le pluriel du verbe est DÉJÀ correct → ne pas toucher le pronom
    j = i + 1
    if j < len(T) and deacc(T[j].lower()) in ('ne', 'n'): j += 1         # « il ne sont pas »
    if j >= len(T) or deacc(T[j].lower()) not in _V3PL_SURE: return None  # verbe SÛR 3pl (sont/ont/vont/font) uniquement → FP=0 sans dépendre du tagger ; les -ent (mangent) restent au fix-verbe (à couvrir plus tard)
    s = 'ils' if lw == 'il' else 'elles'
    return s[0].upper() + s[1:] if T[i][:1].isupper() else s


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


def _verb_or_homograph(tg, T, i):
    """T[i] est-il un VERBE en contexte pour les règles d'accord SV ? VERB/AUX net, OU forme finie homographe ratée par
    l'émission HMM (elle ne couvre qu'~2 % des formes → « persiste »/« bloque »/« signale » mistagués NOM/ADJ) : forme
    connue (_reads) mais ABSENTE des lexiques nom (GENDER_FULL) ET adj (ADJ_LEX). Les homographes-noms CONNUS
    (gêne/reste/jeune) → False (tranchés par le contexte). Filet PARTAGÉ par les règles d'accord SV (sv_noun/postpose/
    quant/relatif/coord/ais_ait) ; les gardes propres à chaque règle bornent le contexte. Déterministe → parité 3 moteurs."""
    if i >= len(tg): return False
    if tg[i] in ('VERB', 'AUX'): return True
    d = deacc(T[i].lower())
    if d in _INVAR_COLOR: return False                                    # couleur/matière invariable (« des gants crème », « bleu marine ») tag NOUN → jamais un verbe (lecture crémer/mariner fantôme)
    if d in GENDER_FULL or d in ADJ_LEX or d in PREP: return False        # nom/adj/PRÉPOSITION homographe connu (« entre »/« modèle ») → tranché par le contexte, pas le verbe
    if i > 0 and (T[i-1].lower() in NUM_DET or deacc(T[i-1].lower()) in PREP): return False   # déterminant/préposition juste avant → T[i] est un NOM (« un modèle », « de rechange »)
    return bool(_reads(T[i]))


def rule_accord_sv_noun(T, i):
    """Accord SUJET-VERBE à sujet-NOM, via le VRAI PARSEUR de sujet (_np_subject) : gère le sujet ÉLOIGNÉ (mots-écrans
    « de X ») que l'ancienne version (déterminant pluriel en tête seulement) ratait — « la liste des articles sont »→est,
    « le prix des matières premières ont »→a, « les cartons dans le couloir gêne »→gênent. FP=0 : on n'autorise entre le
    nom-tête et le verbe QUE des compléments prépositionnels ; coordination/relative, ponctuation, verbe/aux intercalé, ou
    un 2e GN non prépositionnel → abstention (autre structure)."""
    if not CONJ_LOADED or "'" in T[i].lower() or T[i].lower() == 'à': return None   # « à » (prép.) ≠ « a » (avoir) — déacc les confond
    if deacc(T[i].lower()) == 'a' and i + 1 < len(T):                   # « a » + ARTICLE DÉFINI (la/le/les/l') → la préposition « à » est trop plausible (« les enfants a la maison / a l'école » = « à la/à l' », locatif) → a→ont S'ABSTIENT (ambigu). L'INDÉFINI (une/un/des) reste → possession (« ont une pomme »).
        _dn = deacc(T[i + 1].lower())
        if _dn in ('la', 'le', 'les') or _dn[:2] == "l'": return None
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
    if not tg or not _verb_or_homograph(tg, T, i): return None        # T[i] = verbe en contexte ; filet homographe PARTAGÉ (verbe raté par l'émission HMM à 2 %, absent des lexiques nom/adj), borné par les gardes structure ci-dessous
    _vs = i                                                            # sauter les clitiques objets avant le verbe (« nous parviendra », « m'inquiètent ») pour atteindre le sujet
    while _vs - 1 >= 0 and deacc(T[_vs-1].lower()) in CLITIC: _vs -= 1
    subj = _np_subject(T, tg, _vs)                                     # tête [dét + nom] du sujet, mots-écrans « de X » sautés
    if subj is None: return None
    nb = subj['n']; hk = subj['idx']; dk = subj['det']
    ddet = deacc(subj['dtxt'].lower())
    if ddet not in NUM_DET and ddet not in _QUANT_PL and ddet not in _QUANT_SG: return None   # déterminant sujet DOIT être connu (le/la/les/un/des/plusieurs/chaque…) ; au/aux/du (prép+dét de PP « AU nord se trouvent ») ou mistag → abstention
    if deacc(subj['htxt'].lower()) in _COLL_HEAD: return None                # nom collectif/quantité (plupart/majorité/centaine…) → accord avec le complément → abstention
    if not subj['elid'] and (tg[hk] == 'PROPN' or (hk > 0 and T[hk][:1].isupper())): return None   # nom-tête propre/titre (« Les Maroons », « les Chevaliers du feu ») = entité, nombre non fiable → abstention
    lo = 0                                                             # début de proposition (bornes _SEG)
    if _SEG is not None:
        for j in range(i, 0, -1):
            if j < len(_SEG['bb']) and _SEG['bb'][j]: lo = j; break
    for m in range(lo, i):                                             # RELATIVE ÉLIDÉE « qu' » dans la proposition → sujet ambigu → abstention (élision bénigne « de l'X », clitique « m'/s' » tolérée ; que/qui/dont pleins gardés par CONJ_WORDS)
        if T[m].lower().startswith(("qu'", "qu’")): return None
    for m in range(lo, dk):                                            # SUJET EN TÊTE DE PROPOSITION : seuls des adverbes antéposés avant le déterminant.
        if tg[m] != 'ADV': return None                                #   sinon le GN détecté est un OBJET/complément d'un verbe amont (« qui composent LE SME sont »), pas le sujet → abstention
    for m in range(hk + 1, i):                                         # GARDE STRUCTURE nom-tête → verbe : compléments prépositionnels SEULEMENT
        tok = T[m]; dw = deacc(tok.lower())
        if dw in CONJ_WORDS: return None                              # et/ou/qui/que/quand… (coordination/relative) → sujet ambigu → abstention
        if any(ch in ',;:()[]«»"' for ch in tok): return None        # ponctuation = apposition/incise → abstention
        if any(ch.isdigit() for ch in tok): return None              # désignation alphanumérique (« WR 20a », « A1 ») → « a/est » homographe, pas verbe → abstention
        if tg and m < len(tg) and tg[m] in ('VERB', 'AUX') and not (T[m].lower().endswith(('é', 'és', 'ée', 'ées')) and not (m > 0 and tg[m-1] == 'AUX')): return None   # verbe FINI intercalé = sous-phrase → abstention ; MAIS participe-épithète (« cartons empilés dans… gêne ») non précédé d'un aux = adjectif réduit → toléré (miroir du saut dans _np_subject)
        if tok.lower() in NUM_DET and dw not in PREP and not (m > 0 and deacc(T[m-1].lower()) in PREP):
            return None                                              # 2e GN NON prépositionnel (nouveau sujet) → abstention ; « des/du » (prép+dét) & « de la » tolérés
    if any(n == nb or n == 'x' for (_l, _mt, _p, n) in p3): return None  # déjà d'accord
    lemmas = {l for (l, _mt, _p, _n) in p3}
    if len(lemmas) != 1: return None
    lem = lemmas.pop()
    mts = [mt for (_l, mt, _p, _n) in p3]
    mt = 'ind:pre' if 'ind:pre' in mts else mts[0]
    if mt == 'ind:pas': return None                             # passé simple : hors ROUGE (mur du sujet « inspira les débats »→inspirèrent) → vigilance ORANGE (app/ext)
    sugg = CONJ_C.get(lem, {}).get(mt, {}).get('3' + nb)
    if not sugg: return None
    if not any(p == '3' and (n == nb or n == 'x') for (_l, _mt, p, n) in _reads(sugg)):
        return None
    return sugg


_POST_PL = ({'les', 'des', 'ces', 'mes', 'tes', 'ses', 'nos', 'vos', 'leurs', 'plusieurs', 'quelques', 'certains', 'certaines', 'divers', 'diverses', 'maints', 'maintes'}
            | set('deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize vingt trente quarante cinquante soixante cent cents mille'.split()))   # déterminants PLURIELS ouvrant un sujet postposé (set EXPLICITE partagé mot-à-mot avec app+ext pour la parité — pas _QUANT_PL qui diverge entre moteurs)
_UNACC = set('arriver venir revenir rester demeurer exister subsister survenir surgir apparaitre disparaitre naitre tomber entrer sortir partir passer figurer suivre resulter decouler compter regner circuler'.split())   # verbes INACCUSATIFS/présentatifs (déaccentués) : admettent un sujet postposé (« Vient/Arrivait les X ») ≠ impératif transitif (« Invite les X »)
_INV_WH = {'que', 'qu', 'ou', 'combien', 'comment', 'quand', 'pourquoi', 'quel', 'quelle', 'quels', 'quelles'}
_INV_ADV = set('ainsi ici la alors ensuite aussi puis enfin bientot partout dedans dehors dessus dessous'.split())   # adverbes frontaux d'inversion (déaccentués)

def _postpose_plural(T, tg, k, hi):
    """GN sujet postposé à partir de k : déterminant PLURIEL/numéral + (adjectifs) + nom-tête → True si pluriel net."""
    if k >= hi: return False
    d0 = deacc(T[k].lower()); num = None
    if d0 in _POST_PL: num = True
    elif T[k].lower() in NUM_DET: num = NUM_DET.get(T[k].lower()) == 'pl'
    else: return False
    if not num: return False
    for m in range(k + 1, min(hi, k + 5)):                             # nom-tête = 1er NOM après le det, en SAUTANT les adjectifs
        if m < len(tg) and tg[m] in ('NOUN', 'PROPN'): return True
        if deacc(T[m].lower()) in PREP: return False
    return False

def rule_accord_postpose(T, i):
    """Accord SUJET-VERBE à sujet POSTPOSÉ (inversion). Quand l'ORDRE change (idée de Rem), on INVERSE la recherche du
    sujet : scan AVANT. Déclencheur d'inversion = tête de proposition = PP/adverbe/interrogatif, OU verbe INACCUSATIF en
    début de PHRASE ; ET aucun sujet préverbal (pronom/expletif/relatif/l'X/nom-sujet) ; sujet postposé PLURIEL + verbe
    3sg → 3pl. FP=0 mesuré (0/2500 UD). « Sur la table reposait les dossiers »→reposaient, « Vient ensuite les vérifications
    »→viennent, « Que pense les clients »→pensent, « où est rangées les archives »→sont (saut du participe passif)."""
    if not CONJ_LOADED or "'" in T[i].lower() or T[i].lower() == 'à': return None   # « à » (prép.) ≠ « a » (avoir) — déacc les confond
    if T[i].lower().endswith(('é', 'és', 'ée', 'ées')): return None    # PARTICIPE (accord adjectival, pas verbal)
    if i > 0 and T[i-1].lower() in NUM_DET: return None                # déterminant avant → T[i] = NOM
    if i > 0 and deacc(T[i-1].lower()) in PREP: return None            # préposition avant → nom homographe
    if (i >= 1 and deacc(T[i-1].lower()) in FULL_AUX) or (i >= 2 and deacc(T[i-2].lower()) in FULL_AUX): return None   # temps composé
    if _subject_before(T, i) is not None: return None                 # sujet pronom net → règle pronom
    p3 = [(l, mt, p, n) for (l, mt, p, n) in _reads(T[i]) if p == '3']
    if not p3: return None
    if not any(n == 's' for (_l, _mt, _p, n) in p3): return None       # verbe 3SG (sinon rien à accorder au pluriel)
    if any(n == 'p' or n == 'x' for (_l, _mt, _p, n) in p3): return None   # déjà pluriel / ambigu → abstention (FP-safe)
    tg = pos_tags(T)
    if not tg or not _verb_or_homograph(tg, T, i): return None
    lo = 0; hi = len(T)
    if _SEG is not None:
        for j in range(i, 0, -1):
            if j < len(_SEG['bb']) and _SEG['bb'][j]: lo = j; break
        for j in range(i + 1, len(T)):
            if j < len(_SEG['bb']) and _SEG['bb'][j]: hi = j; break
    if _np_subject(T, tg, i) is not None: return None                 # sujet-nom PRÉVERBAL → pas une inversion
    for k in range(lo, i):                                            # expletif/impersonnel + relatif-sujet + l'X préverbal = sujet avant → pas inversion
        dk = deacc(T[k].lower())
        if dk in ('il', 'ce', 'c', 'on', 'ca', 'cela', 'ceci', 'qui', 'dont', 'lequel', 'laquelle', 'lesquels', 'lesquelles'): return None
        if dk in ('et', 'ou', 'ni'): return None                      # verbe COORDONNÉ (« La bureaucratie … et affecte des pans ») = 2e conjoint d'un sujet amont, pas une inversion
        if (dk == 'l' or T[k].lower().startswith("l'")) and (k == lo or deacc(T[k-1].lower()) not in PREP): return None
    lem0 = p3[0][0]                                                    # DÉCLENCHEUR d'inversion — DOIT ouvrir la PHRASE (une virgule mi-phrase = parenthèse « …siècle contenait » ⇒ le vrai sujet est avant)
    ss = _SEG['ss'] if _SEG is not None else None
    if not (lo == 0 or (ss is not None and lo < len(ss) and ss[lo])): return None
    if i == lo:                                                       # verbe EN TÊTE : seul cas = présentatif inaccusatif (pas « a des origines » : « a » matche « à » via déacc)
        if deacc(lem0) not in _UNACC: return None
    else:
        head = deacc(T[lo].lower())
        if not (head in PREP or head in _INV_WH or T[lo].lower() in _INV_WH or head in _INV_ADV or (lo < len(tg) and tg[lo] == 'ADV') or head in ('comme', 'quand', 'lorsque')): return None
    k = i + 1                                                          # scan AVANT : sauter adverbes postverbaux + participe passif (« est rangées les archives »)
    while k < hi and k < len(tg) and (tg[k] == 'ADV' or (tg[k] in ('VERB', 'ADJ') and T[k].lower().endswith(('é', 'és', 'ée', 'ées')))): k += 1
    if not _postpose_plural(T, tg, k, hi): return None
    lemmas = {l for (l, _mt, _p, _n) in p3}
    if len(lemmas) != 1: return None
    lem = lemmas.pop(); mts = [mt for (_l, mt, _p, _n) in p3]
    mt = 'ind:pre' if 'ind:pre' in mts else ('ind:imp' if 'ind:imp' in mts else mts[0])
    if mt == 'ind:pas': return None
    sugg = CONJ_C.get(lem, {}).get(mt, {}).get('3p')
    if not sugg: return None
    if not any(p == '3' and (n == 'p' or n == 'x') for (_l, _mt, p, n) in _reads(sugg)): return None
    return sugg


def rule_ais_ait(T, i):
    """Accord SUJET-VERBE en PERSONNE : verbe à l'imparfait écrit en 1re/2e pers. sing. (-ais) mais gouverné par un
    sujet-NOM 3e pers. sing. → 3e pers. (-ait). Comble le trou de rule_accord_sv_noun, qui ne prend QUE les lectures
    p==3 (accord de NOMBRE) : l'erreur de PERSONNE « le responsable installais »→installait lui échappe. -ais/-ait
    homophones (/ɛ/) → audible-fiable. FP=0 : mêmes gardes structurelles que rule_accord_sv_noun + PAS de sujet
    pronom (je/tu « je gardais » correct) + sujet SINGULIER strict (sinon -aient)."""
    w = T[i].lower()
    if not CONJ_LOADED or "'" in w or not deacc(w).endswith('ais'): return None
    rd = _reads(w)
    imp = [(l, mt, p, n) for (l, mt, p, n) in rd if p in ('1', '2') and n == 's' and 'imp' in mt and 'ind' in mt]
    if not imp: return None                                   # 1sg/2sg IMPARFAIT indicatif (pas l'impératif : 'imp' sans 'ind')
    if any(p == '3' for (l, mt, p, n) in rd): return None     # lit aussi 3e pers → ambigu → abstention
    if _subject_before(T, i) is not None: return None         # sujet pronom (je/tu/il…) → « je gardais » correct → abstention
    if (i >= 1 and deacc(T[i-1].lower()) in FULL_AUX) or (i >= 2 and deacc(T[i-2].lower()) in FULL_AUX): return None
    tg = pos_tags(T)
    if not tg or not _verb_or_homograph(tg, T, i): return None
    subj = _np_subject(T, tg, i)
    if subj is None or subj['n'] != 's': return None          # sujet-NOM SINGULIER (le pluriel donnerait -aient)
    hk = subj['idx']; dk = subj['det']
    ddet = deacc(subj['dtxt'].lower())
    if ddet not in NUM_DET and ddet not in _QUANT_SG: return None
    if deacc(subj['htxt'].lower()) in _COLL_HEAD: return None
    if not subj['elid'] and (tg[hk] == 'PROPN' or (hk > 0 and T[hk][:1].isupper())): return None
    lo = 0
    if _SEG is not None:
        for j in range(i, 0, -1):
            if j < len(_SEG['bb']) and _SEG['bb'][j]: lo = j; break
    for m in range(lo, i):
        if _elid_kind(T[m]) == 'pron': return None            # une élision de PRONOM (qu'il, s'il, d'un…) signale une clause complexe → abstention. AVANT : veto sur TOUTE apostrophe, ce qui écartait « L'entreprise transportais » — un déterminant élidé n'est pas une complexité, c'est un sujet.
    for m in range(lo, dk):
        if tg[m] != 'ADV': return None                        # sujet en tête de proposition (que des adverbes antéposés)
    for m in range(hk + 1, i):                                # nom-tête → verbe : compléments prépositionnels seulement
        tok = T[m]; dw = deacc(tok.lower())
        if dw in CONJ_WORDS: return None
        if any(ch in ',;:()[]«»"' for ch in tok): return None
        if tg and m < len(tg) and tg[m] in ('VERB', 'AUX'): return None
        if tok.lower() in NUM_DET and dw not in PREP and not (m > 0 and deacc(T[m-1].lower()) in PREP): return None
    lemmas = {l for (l, mt, p, n) in imp}
    if len(lemmas) != 1: return None
    lem = lemmas.pop()
    sugg = CONJ_C.get(lem, {}).get('ind:imp', {}).get('3s')
    if not sugg or sugg == w: return None
    if not any(p == '3' and (n == 's' or n == 'x') for (l, mt, p, n) in _reads(sugg)): return None
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
    if mt == 'ind:pas': return None                             # passé simple JAMAIS en ROUGE (mur du sujet : « inspira les débats »→inspirèrent) → vigilance ORANGE (app/ext) seulement
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
# Distributifs À TOLÉRANCE sing/plur quand suivis IMMÉDIATEMENT d'un complément « de(s)/d'(entre) + PLURIEL »
# (Grévisse : « aucun d'eux ne SERA / ne SERONT », « chacune de ces équipes AFFRONTE / AFFRONTENT » = les deux admis).
# personne/rien/quelqu'un/quiconque N'EN sont PAS (strictement sing même avec complément) → la règle stricte les garde.
_DISTRIB_AMBIG = {'chacun', 'chacune', 'aucun', 'aucune', 'nul', 'nulle'}
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
    if not tg or not _verb_or_homograph(tg, T, i): return None
    lo = 0
    if _SEG is not None:
        for j in range(i, 0, -1):
            if j < len(_SEG['bb']) and _SEG['bb'][j]: lo = j; break
    q = deacc(T[lo].lower()); nxt = deacc(T[lo+1].lower()) if lo + 1 < len(T) else ''
    qend = lo                                                    # dernier indice du groupe-quantifieur (avant complément)
    if q in _DISTRIB_AMBIG and (nxt in ('de', 'des') or (lo + 1 < len(T) and T[lo+1].lower().startswith(("d'", 'd’')))):
        return None                                             # tolérance sing/plur « chacun/aucun/nul de(s)/d' + pluriel » → n'impose aucun nombre (FP=0)
    if q in _QP_SG:                nb = 's'                      # chacun/aucun/personne/rien… (peut être suivi de « des N » : chacun DES équipes → sg)
    elif q in _QP_PL:             nb = 'p'                       # certains/plusieurs/tous… (peut être suivi de « d'entre eux »)
    elif q in _QP_DE_PL and q != 'un':                          # beaucoup/peu/bien + de(s) N → pluriel (accord complément)
        if nxt in ('de', 'des', 'd') or "'" in (T[lo+1].lower() if lo+1 < len(T) else '') and nxt[:1] == 'd': nb = 'p'
        else: return None
    elif q == 'la' and nxt == 'plupart':                               # « la plupart » : nombre = celui du COMPLÉMENT (« des gens » pluriel VS « du temps »/« de la classe » singulier)
        qend = lo + 1
        c2 = deacc(T[lo+2].lower()) if lo + 2 < len(T) else ''
        c3 = deacc(T[lo+3].lower()) if lo + 3 < len(T) else ''
        nb = 's' if (c2 == 'du' or (c2 == 'de' and c3 in ('la', 'l')) or c2 == 'dul') else 'p'   # « la plupart du temps suffit » (sing) ≠ « la plupart des gens pensent » (plur) ; sans complément → pluriel (« la plupart pensent »)
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
    if not tg or not _verb_or_homograph(tg, T, i): return None
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
        if tg[noun] == 'PROPN' or (noun > 0 and T[noun][:1].isupper()): return None   # antécédent PROPRE/TITRE (« la revue Les Facettes qui », « les Maroons qui ») = nombre non fiable → abstention (même garde que rule_accord_sv_noun)
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
    if mt == 'ind:pas': return None                             # passé simple → hors ROUGE (vigilance ORANGE app/ext)
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
    if not tg or not _verb_or_homograph(tg, T, i): return None
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
    if mt == 'ind:pas': return None                             # passé simple → hors ROUGE (vigilance ORANGE app/ext)
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
    if d not in VERB_LEX or not (d.endswith('er') or d.endswith('ir') or d.endswith('re') or d.endswith('oir')): return False
    return not _reads(w)          # vrai infinitif = AUCUNE lecture finie conjuguée (« manger »/« vendre »/« offrir » : _reads=[]) ; « nombre »/« offre »/« livre » (formes conjuguées en -re) ont des lectures finies → PAS des infinitifs (FP « nombre de spécialistes doutent »)

def rule_accord_sv_infinitif(T, i):
    if not CONJ_LOADED or "'" in T[i].lower() or T[i].lower() == 'à': return None
    if T[i].lower().endswith(('é', 'és', 'ée', 'ées')): return None
    reads = _reads(T[i])
    if not any(p == '3' for (_l, _mt, p, _n) in reads): return None
    if i > 0 and deacc(T[i-1].lower()) in PREP: return None
    tg = pos_tags(T)
    if not tg or not _verb_or_homograph(tg, T, i): return None
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
GENDER_PURE = {}; GENDER_FULL = {}
_HF_PATH = os.path.join(HERE, 'cgram_hf.json')
if os.path.exists(_HF_PATH):
    try:
        _hf = json.load(open(_HF_PATH, encoding='utf-8'))
        GENDER_PURE = _hf.get('gn', {}); GENDER_FULL = _hf.get('g', {})   # 'g' = genre des noms verbe-homographes (pomme/ferme/forme) = vd.g/GENDER_MAP de l'app → Fix C, MÊME source (parité)
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
# GENRE des noms en œ (clé déaccentuée « oe ») manquants du lexique gn (couverture incohérente : cœur présent,
# sœur/œuf/œuvre/œil absents) → débloque « mon soeur »→ma sœur + accord genre. FP=0 (genres corrects, union). Miroir app + ext.
for _w, _g in {'soeur': 'f', 'soeurs': 'f', 'coeur': 'm', 'coeurs': 'm', 'oeuf': 'm', 'oeufs': 'm', 'oeuvre': 'f', 'oeuvres': 'f', 'boeuf': 'm', 'boeufs': 'm', 'voeu': 'm', 'voeux': 'm', 'noeud': 'm', 'noeuds': 'm', 'oeil': 'm', 'moeurs': 'f', 'manoeuvre': 'f', 'manoeuvres': 'f', 'oeillet': 'm', 'oeillets': 'm', 'oesophage': 'm', 'foetus': 'm'}.items():
    GENDER_PURE.setdefault(_w, _g)

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
    if T[i+1][:1].isupper(): return None                           # nom propre/étranger (capitalisé) → abstention (FP)
    hi = i + 1                                                      # indice du NOM-TÊTE (défaut = mot suivant)
    _pp = NOUN_POST.get(nd)                                        # GARDE §3 (posterior fréquentiel) : le NOM-TÊTE doit être CONFIDEMMENT un NOM
    if lw in ('quel', 'quelle') and not (_pp and _pp[0] >= PL_TAU_M):   # « quel/quelle + ADJECTIF antéposé + nom » : sauter UN adjectif sûr (tagger) → nom-tête (« quel belle journée »→quelle)
        tgq = pos_tags(T)
        if tgq and i+2 < len(T) and i+1 < len(tgq) and tgq[i+1] == 'ADJ' and "'" not in T[i+2].lower() and not T[i+2][:1].isupper():
            hi = i + 2; _pp = NOUN_POST.get(deacc(T[hi].lower()))
    if hi == i + 1 and nd in DET_SKIP: return None                 # adverbe/modifieur (pas le nom-tête) sans saut → abstention (FP)
    if not (_pp and _pp[0] >= PL_TAU_M): return None   # GARDE §3 genre RELAXÉE : NOM confiant (P(NOM)≥τ) ; garde verbe levée — mot après déterminant = NOM même si verbe-homographe (recall 66,8→72,7 %, FP 0,09→0,10/1000, gender_levers_ud.py)
    g_noun = GENDER_PURE.get(deacc(T[hi].lower()))                 #   (l'ambiguïté de GENRE — « tour » m+f — reste couverte par GENDER_PURE)
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


_MET_LEFT_SUBJ = {'il', 'elle', 'on', 'ce', 'ca', 'qui', 'celui', 'celle', 'chacun', 'nul', 'quiconque'}   # sujets 3sg possibles de « met »
_MET_RIGHT_CLAUSE = {'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'ce', 'ca',
                     "j'ai", "j'avais", "j'aurai", "j'aurais"}   # un pronom sujet (ou j'ai fusionné) OUVRE une nouvelle proposition → « mais »

def rule_met_mais(T, i):
    d = deacc(T[i].lower())
    # --- met → mais : « met » (mettre 3sg) EXIGE un sujet 3sg à sa gauche ; sans lui, c'est la conjonction « mais »
    #     (« je voulais venir met j'ai pas pu »→mais). FP=0 : abstention dès qu'un sujet 3sg / clitique objet / GN
    #     précède (« il met », « le facteur met », « il y met des fleurs ») ; on n'AFFIRME que si une NOUVELLE
    #     proposition (pronom sujet) suit — là « met » ne peut être le verbe et « mais » a un sens.
    if d == 'met':
        if T[i][:1].isupper() or i == 0: return None                   # « Met/Mets » en tête = impératif → abstention
        p = prev(T, i)
        if p is None or p in _MET_LEFT_SUBJ or p in CLITIC: return None # sujet 3sg / clitique objet à gauche → « met » EST le verbe
        tg = pos_tags(T)
        if tg and i-1 < len(tg) and tg[i-1] in ('NOUN', 'PROPN', 'DET', 'NUM'): return None   # GN sujet à gauche → verbe
        if T[i-1][:1].isupper(): return None                           # nom propre sujet à gauche → verbe
        if nxt(T, i) in _MET_RIGHT_CLAUSE:                             # une nouvelle proposition suit → « mais »
            return _keepcase(T[i], 'mais')
        return None
    # « je/tu/il/on/ils » sont des clitiques sujets PURS : ils sont TOUJOURS suivis de leur verbe et ne peuvent JAMAIS
    # être objet de préposition (c'est lui/eux/moi/toi qui le sont). Donc « [pronom] mais … » → forme de METTRE
    # (« il mais son manteau »→met). FP=0 par construction. « elle/elles » sont EXCLUS : ils sont leur propre pronom
    # disjoint (« derrière elle mais… », « avec elles mais… ») → « mais » y est la vraie conjonction (raté assumé).
    if d != 'mais': return None
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
    return 'mes' if (_noun_gate(dn) and dn.endswith(('s', 'x'))) else None   # NOM (posterior §3 `_noun_gate`, pas GENDER_PURE brut) ET PLURIEL : « mes » est le possessif PLURIEL → « mes attention »/« mes budget » (sg) est agrammatical (FP « raffinée mais attention »→mes) ; les vrais catches sont pluriels (mes lunettes/parents/amis/yeux)


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


_ETRE_SUR = {'est', 'es', 'suis', 'sommes', 'etes', 'sont', 'etais', 'etait', 'etions', 'etiez', 'etaient',
             'sera', 'serai', 'seras', 'serait', 'serais', 'soit', 'suis'}

def rule_la_la(T, i):
    """« la » (article/pronom) vs « là » (adverbe de lieu). « être + la » en FIN de proposition → là
    (« je suis la »→là, « il est la »→là). FP=0 : après être, l'article « la » précède TOUJOURS un nom
    (« c'est la vie ») → en fin de proposition c'est l'adverbe « là ». Mesuré : 0 « être+la+fin » sur 2500 UD."""
    if deacc(T[i].lower()) != 'la' or "'" in T[i].lower(): return None
    if prev(T, i) not in _ETRE_SUR: return None                         # juste après une forme d'être
    n = nxt(T, i)
    if n is None or (_SEG is not None and i + 1 < len(_SEG['bb']) and _SEG['bb'][i + 1]):   # fin de proposition
        return _keepcase(T[i], 'là')
    return None


def rule_sur_sur(T, i):
    """« sur » (préposition) vs « sûr » (adjectif = certain). « être/bien + sur + de/que » ou fin de proposition → sûr
    (« je suis sur de moi »→sûr, « tu es sur ? »→sûr, « bien sur que oui »→bien sûr). FP=0 : la préposition « sur »
    précède un GN (« sur la table », « bien sur le sol ») — jamais « de/que » ni une frontière juste après un attribut."""
    if deacc(T[i].lower()) != 'sur' or "'" in T[i].lower(): return None
    p = prev(T, i)
    if p not in _ETRE_SUR and p != 'bien': return None                  # contexte ATTRIBUT : après être (ou l'idiome « bien sûr »)
    n = nxt(T, i)
    if n in ('de', "d'", 'que', "qu'") or n is None: return _keepcase(T[i], 'sûr')   # « sûr de/que » ou fin
    if _SEG is not None and i + 1 < len(_SEG['bb']) and _SEG['bb'][i + 1]: return _keepcase(T[i], 'sûr')   # frontière (ponctuation) juste après
    return None


def rule_du_du(T, i):
    """« du » (de+le) vs « dû » (participe de DEVOIR). « avoir + du + INFINITIF » → dû (« j'ai du partir »→dû,
    « il a du travailler »→dû). FP=0 : le partitif « du » précède un NOM, JAMAIS un infinitif ; et « avoir + dû +
    infinitif » = devoir. Gain sur le trou du/dû (homophone dys fréquent, non couvert avant)."""
    if deacc(T[i].lower()) != 'du' or "'" in T[i].lower() or i + 1 >= len(T): return None
    if not _is_infinitive(T[i + 1]): return None                        # « du » + INFINITIF (écarte « du pain/courage » = partitif + nom)
    for k in range(i - 1, max(-1, i - 4), -1):                          # auxiliaire AVOIR en remontant (adverbes/négation tolérés)
        tk = T[k].lower(); dk = deacc(tk)
        if dk in _AVOIR_AUX or tk in _AVOIR_JE: return _keepcase(T[i], 'dû')
        if dk in _PP_MID: continue
        return None
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
    m = re.match(r'^(.*?)(?:ez|er)$', dn)               # BLOCAGE MUTUEL « j'est mangez » : cette règle attend un participe, la règle -ez/-é attend un
    if m and len(m.group(1)) >= 2:                      # auxiliaire correct → aucune ne démarre. Or « j'est » n'est JAMAIS valide : si le mot suivant est
        pp = m.group(1) + 'é'                           # une forme verbale en -ez/-er, l'auxiliaire visé est certain. On tranche ; l'itération corrige -ez
        if _is_ppl(pp):                                 # ensuite. FP=0 conservé (« j'est » toujours fautif ; ETRE_PP sépare je suis / j'ai).
            return _keepcase(T[i], "je suis" if deacc(pp) in ETRE_PP else "j'ai")
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
# Formes NOM attestées STRICTEMENT plurielles dans Lexique4 (cgram_plural.json, build_cgram) — vrais pluriels, invariables
# (fils/paix/taux) et pluriels à nombre vide EXCLUS. Sert la voie RELÂCHÉE de rule_noun_singular (« la boites »).
PLURAL_NOUNS = set()
try:
    with open(os.path.join(HERE, 'cgram_plural.json'), encoding='utf-8') as _f:
        PLURAL_NOUNS = set(json.load(_f))
except (OSError, ValueError):
    PLURAL_NOUNS = set()
PL_TAU_M, PL_EPS_M, PL_ANCHOR_M = 500, 10, 300   # P(NOM)≥0.5 / P(VER)<0.01 / ancre P(NOM)≥0.3 (en ‰) — mesuré ε=0.01 : +3 récup., +1 FP (UD)

def _noun_gate(n):                                              # §3 : nom-dominant ET masse verbe négligeable
    p = NOUN_POST.get(deacc(n.lower()))
    return bool(p) and p[0] >= PL_TAU_M and p[1] < PL_EPS_M

def _noun_gate_n(n):                                            # variante SANS veto verbal : reservee aux
    """determinants pluriels NON AMBIGUS (voir rule_noun_plural)."""
    p = NOUN_POST.get(deacc(n.lower())) if NOUN_POST else None
    return bool(p) and p[0] >= PL_TAU_M

_PL_OUX = {'bijou', 'caillou', 'chou', 'genou', 'hibou', 'joujou', 'pou'}          # -ou qui prend -x
_PL_AILAUX = {'bail', 'corail', 'émail', 'soupirail', 'travail', 'vantail', 'vitrail'}   # -ail -> -aux

def _pluralize_noun(n):
    """Pluriel ANCRÉ DANS LE POSTERIOR (pas de « oiseaus ») : +s / -al→-aux / -au-eu→+x, on garde la forme dont
    la part NOM ≥ 30 % (le pos_of EMBARQUÉ est FAUX pour amis=ADJ/pommes=VER → l'ancre fréquentielle les récupère)."""
    dn = deacc(n.lower()); lw = n.lower(); cands = []
    # Les DEUX familles d'exceptions du pluriel francais, en listes CLOSES (apprises par coeur a
    # l'ecole, elles ne s'etendent pas). Sans elles le moteur produisait un FAUX pluriel :
    # « des travail » -> « travails », « des corail » -> « corails » — pire que se taire.
    # Elles passent AVANT le +s ; l'ancre du posterior reste le juge final.
    # « email » SANS accent est laisse de cote : c'est le courriel, pluriel « emails ».
    if dn in _PL_OUX: cands.append(n + 'x')                     # les sept en -oux
    if lw in _PL_AILAUX: cands.append(n[:-3] + 'aux')           # travail->travaux (forme ACCENTUEE : email/email)
    cands.append(n + 's')
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
    # GARDE §3 : P(NOM)≥0,5 ∧ P(VER)<0,01 — exclut porte/livre (verbe) et rouge (ADJ-dom).
    # MAIS après un déterminant pluriel NON AMBIGU (des/ces/mes/tes/ses/nos/vos — jamais pronoms),
    # un verbe CONJUGUÉ est impossible : le déterminant EST le contexte grammatical, et il est
    # AUDIBLE donc fiable. Le veto P(VER) y est redondant — il bloquait « des moule », « des porte ».
    # « les » et « leurs » restent gardés : ce sont AUSSI des pronoms (« il les porte »).
    _pd = deacc(T[i - 1].lower())
    if not (_noun_gate_n(n) if _pd not in ('les', 'leurs') else _noun_gate(n)): return None
    #   « les porte/livre » (masse verbe) et « les rouge » (ADJ-dom, P(NOM)<0.5) ; récupère ami/voiture/faute que la garde nbhomog ratait.
    #   (Ancien : nbhomog==0 ∧ POS==NOM lu sur le tag DUR embarqué — faux pour faute=VER/amis=ADJ. Relaxe naïve nbhomog<=1 = REJETÉE, +25 FP.)
    nx = T[i + 1] if i + 1 < len(T) else ''
    if nx[:1].islower() and nx.isalpha():                       # nom composé (« hit parade », « vice président », « tour opérateur ») :
        pp = NOUN_POST.get(deacc(nx.lower()))                   #   nom + nom → 1er élément souvent invariable → abstention
        if pp and pp[0] >= PL_TAU_M and deacc(nx.lower()) not in ADJ_LEX: return None   # (« français » = adj-nom → PAS un composé : « les département français » corrigé)
    pl = _pluralize_noun(n)
    return pl if (pl and deacc(pl.lower()) != dn) else None

def rule_noun_singular(T, i):
    # DÉTERMINANT ÉLIDÉ : « de l'hommes » n'a PAS de déterminant séparé — il est COLLÉ au nom, et « l' »
    # est toujours SINGULIER. La faute est alors DANS le token ; on corrige donc le token ENTIER, en
    # réémettant le préfixe élidé devant le nom singularisé (« l'hommes » → « l'homme »).
    _pre = ''
    if _elid_kind(T[i]) == 'det':
        # Après « l' », un nom en -X est quasi toujours INVARIABLE (prix, voix, choix, apex, index) :
        # le déterminant élidé ne dit rien du nombre, donc on ne prend QUE le -s. Mesuré : sans ça
        # « l'apex » devenait « l'ape » — et « ape » EXISTE au lexique, donc un test « mot connu »
        # n'aurait pas suffi.
        if not deacc(_head_text(T[i]).lower()).endswith('s'): return None
        _pre = T[i][:len(T[i]) - len(_head_text(T[i]))]
        T = list(T); T[i] = _head_text(T[i])
    elif i == 0 or prev(T, i) not in _SING_DET:
        return None                                             # déterminant SINGULIER (classe fermée) juste avant
    if _SEG is not None and i < len(_SEG['dig']) and _SEG['dig'][i]: return None   # NOMBRE-écran (« le 25 mars », « le 100 mètres ») → le déterminant ne gouverne pas ce nom → abstention (FP)
    n = T[i]
    if not n[:1].isalpha() or n[0].isupper(): return None       # nom propre / capitalisé → abstention (FP)
    dn = deacc(n.lower())
    if len(dn) < 4 or dn[-1] not in 'sx' or dn in _SG_STOP or dn in NOUN_PL_STOP: return None   # doit finir s/x (pluriel apparent) ; invariant/piège → abstention
    nx = T[i + 1] if i + 1 < len(T) else ''
    if nx[:1].islower() and nx.isalpha():                       # nom composé (« le vice présidents ») : nom + NOM confiant NON-verbe → 1er souvent invariable → abstention
        pp = NOUN_POST.get(deacc(nx.lower()))                   #   (P(VER)<ε : un VERBE qui suit — « chaque jours compte » — n'est PAS un composé)
        if pp and pp[0] >= PL_TAU_M and pp[1] < PL_EPS_M and deacc(nx.lower()) not in ADJ_LEX: return None
    if _noun_gate(n):                                           # VOIE FRÉQUENTIELLE : le PLURIEL est NOM-dominant (P(NOM)≥τ ∧ P(VER)<ε) → « une voitures »→voiture
        sg = _singularize_noun(n)                              #   forme singulière ANCRÉE (nom confiant) — écarte les invariants (temps→temp)
        if sg and deacc(sg.lower()) != dn: return _pre + sg
    # VOIE RELÂCHÉE : pluriel homographe d'un VERBE (« la boites » = boiter 3sg) que le posterior fréquentiel écarte à
    # tort. Le déterminant singulier + le TAGGER (contexte → NOUN) + le LEXIQUE (forme STRICTEMENT plurielle, singulier
    # connu) le tranchent. FP=0 mesuré (UD) : mois écartés par le singulier non-nom (mars→mar), composés par le trait d'union.
    if dn.endswith('s') and dn in PLURAL_NOUNS and dn[:-1] in GENDER_PURE:
        if _SEG is not None and i + 1 < len(_SEG['hy']) and _SEG['hy'][i + 1]: return None   # composé à trait d'union (« la sous-famille »)
        tg = pos_tags(T)
        if tg and i < len(tg) and tg[i] == 'NOUN':
            return _pre + n[:-1]                                # -s retiré, accents/casse préservés (« boîtes »→« boîte »)
    return None

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

_COORD_SUBJW = set('je tu il elle on ils elles nous vous ça ca ce c cela ceci qui que dont'.split())   # entre la conj et V2 : présence d'un de ces mots = V2 a son propre sujet → pas une coordination de verbes

def _vnum3(w):
    """Nombre du verbe FINI en 3e personne indicatif présent/imparfait (s/p), NON ambigu ; sinon None."""
    rs = [r for r in _reads(w) if r[2] == '3' and r[1] in ('ind:pre', 'ind:imp')]
    if not rs: return None
    nums = {r[3] for r in rs}
    return 'p' if nums == {'p'} else ('s' if nums == {'s'} else None)

def rule_accord_verb_coord(T, i):
    """Accord SUJET-VERBE par RÉCUPÉRATION du sujet via le VERBE COORDONNÉ (idée de Rem : le sujet n'est pas toujours à
    côté — le verbe frère le porte). « les chats mangent et dort »→dorment : « dort » n'a pas de sujet adjacent, mais V1
    « mangent » (3pl) donne le nombre du sujet PARTAGÉ. Cadre : V2=T[i] verbe fini 3e pers. (ind:pre/imp) homographe-safe,
    précédé de « et/ou/ni » SANS nouveau sujet entre (dét+nom, pronom, impersonnel) ; V1 = 1er verbe fini avant la conj,
    nombre 3e pers. net ≠ celui de V2. Filet homographe sur les DEUX verbes (récupère « volent et chante » mistagués).
    Gardes : participe (-é), passé composé (aux avant), coordination NOMINALE (vrai nom/adj avant la conj → « et » coord
    de noms, pas de verbes). FP=0 mesuré (0/2500 UD)."""
    w = T[i].lower()
    if not CONJ_LOADED or "'" in w or w.endswith(('é', 'és', 'ée', 'ées')): return None    # participe = accord adjectival
    tg = pos_tags(T)
    if not tg or not _verb_or_homograph(tg, T, i): return None
    r2 = [r for r in _reads(T[i]) if r[2] == '3' and r[1] in ('ind:pre', 'ind:imp')]
    if not r2: return None
    vn2 = _vnum3(T[i])
    if vn2 is None: return None
    if i > 0 and (T[i-1].lower() in NUM_DET or deacc(T[i-1].lower()) in PREP): return None   # dét/prép avant → nom homographe
    if (i >= 1 and deacc(T[i-1].lower()) in FULL_AUX) or (i >= 2 and deacc(T[i-2].lower()) in FULL_AUX): return None   # passé composé
    lo = 0
    if _SEG is not None:
        for j in range(i, 0, -1):
            if j < len(_SEG['bb']) and _SEG['bb'][j]: lo = j; break
    ci = None
    for k in range(i-1, lo-1, -1):
        if deacc(T[k].lower()) in ('et', 'ou', 'ni'): ci = k; break
    if ci is None: return None
    for m in range(ci+1, i):                                    # entre la conj et V2 : aucun sujet → sinon V2 a le sien
        if T[m].lower() in NUM_DET or deacc(T[m].lower()) in _COORD_SUBJW: return None
    v1 = None                                                   # V1 = 1er verbe fini avant la conj (filet homographe inclus) ; s'arrête sur un vrai nom/adj (coord nominale)
    for k in range(ci-1, lo-1, -1):
        if not T[k].lower().endswith(('é', 'és', 'ée', 'ées')) and _verb_or_homograph(tg, T, k) and _vnum3(T[k]) is not None:
            v1 = k; break
        d = deacc(T[k].lower())
        if d in GENDER_FULL or d in ADJ_LEX: break
    if v1 is None: return None
    n1 = _vnum3(T[v1])
    if n1 is None or n1 == vn2: return None
    lem = r2[0][0]; mt = 'ind:pre' if 'ind:pre' in {r[1] for r in r2} else 'ind:imp'
    sug = CONJ_C.get(lem, {}).get(mt, {}).get('3' + n1)
    return sug if (sug and sug.lower() != w) else None

# antécédent de « que » interdit : mots-outils + TÊTES de subordonnants (« dès/lors/parce/afin/bien/tandis/alors/pendant/après/avant que »)
_REL_STOP = set('que qui quoi dont je tu il elle on ils elles nous vous ce ca ça cela ceci me te se le la les lui leur y en '
                'et ou ni mais or car donc ne pas plus moins tres bien des dès lors depuis parce afin tandis alors pendant apres avant sans pour'.split())

def _rel_fin_between(T, tg, a, b):
    """un verbe fini embarqué existe-t-il dans ]a, b[ ? Discriminant relatif-objet (2 verbes : « que JE VOIS joue »)
    vs complétif (1 seul verbe : « que les chats dorment » → pas de verbe entre « que » et la cible)."""
    for k in range(a + 1, b):
        wk = T[k].lower()
        if wk.endswith(('é', 'és', 'ée', 'ées')): continue
        if _verb_or_homograph(tg, T, k) and [r for r in _reads(T[k]) if r[1] in ('ind:pre', 'ind:imp', 'ind:fut', 'cnd:pre', 'sub:pre')]:
            return True
    return False

def rule_accord_rel_obj(T, i):
    """Accord SUJET-VERBE par RÉCUPÉRATION du sujet via une RELATIVE à antécédent-avant (famille « sujet non-adjacent » de
    Rem, après #207/coordination). « les enfants QUE je vois joue »→jouent : le sujet de « joue » = l'antécédent « les
    enfants » (AVANT le relatif), séparé du verbe par la relative « que je vois ». Ancres : « que » (objet), « dont »
    (de-relatif) et « où » (locatif/temporel) — TOUS à antécédent-avant. « dont »/« où » sont TOUJOURS relatifs (jamais
    complétifs), plus propres que « que » ; « où » exigé ACCENTUÉ (le « ou » conjonction ne compte pas). Cadre : V=T[i]
    verbe fini 3e pers. (ind:pre/imp) SINGULIER homographe-safe ; ancre avant lui avec un VERBE FINI embarqué entre les
    deux (sépare le relatif du complétif « que les chats dorment ») ; antécédent = déterminant PLURIEL audible (« les/des »)
    + nom réel juste avant l'ancre. Direction audible seulement (dét pluriel entendu, -ent muet) → pluriel. Filet
    homographe partagé (#204/#205) écarte les noms-verbes (« la fatigue », « le reste »). _REL_STOP bloque les
    subordonnants (dès/parce que…). FP=0 mesuré (0/2500 UD, 0/10+0/10 pièges retors que+dont+où)."""
    w = T[i].lower()
    if not CONJ_LOADED or "'" in w or w.endswith(('é', 'és', 'ée', 'ées')): return None
    tg = pos_tags(T)
    if not tg or not _verb_or_homograph(tg, T, i): return None
    r2 = [r for r in _reads(T[i]) if r[2] == '3' and r[1] in ('ind:pre', 'ind:imp')]
    if not r2 or _vnum3(T[i]) != 's': return None                            # cible = verbe 3sg (dir. audible : pluriel manquant)
    if i > 0 and (T[i-1].lower() in NUM_DET or deacc(T[i-1].lower()) in PREP): return None
    if (i >= 1 and deacc(T[i-1].lower()) in FULL_AUX) or (i >= 2 and deacc(T[i-2].lower()) in FULL_AUX): return None
    q = None
    for k in range(i-1, -1, -1):
        wk = T[k].lower()
        if wk in ('que', "qu'", 'qu', 'dont', 'où') or wk.startswith("qu'"): q = k; break   # « où » ACCENTUÉ = relatif (≠ « ou » conjonction, borne ci-dessous)
        if deacc(wk) in ('et', 'ou', 'ni', 'mais', 'car', 'donc', 'or'): break
    if q is None or q < 2 or q >= i - 1: return None
    if not _rel_fin_between(T, tg, q, i): return None
    ant = T[q-1].lower(); det = T[q-2].lower()
    if det not in PLURAL_DET or ant in _REL_STOP: return None                # antécédent = dét PLURIEL audible + nom réel
    lem = r2[0][0]; mt = 'ind:pre' if 'ind:pre' in {r[1] for r in r2} else 'ind:imp'
    sug = CONJ_C.get(lem, {}).get(mt, {}).get('3p')
    return sug if (sug and sug.lower() != w) else None

def rule_accord_incise(T, i):
    """Accord SUJET-VERBE quand une INCISE sépare le sujet du verbe (famille « sujet non-adjacent » de Rem, après
    #207/#209/#210). « les livres, malgré leur prix, reste chers »→restent : le sujet « les livres » et son verbe « reste »
    sont dans la MÊME proposition, interrompue par l'incise « , malgré leur prix, ». Les règles SV ordinaires s'abstiennent
    car la virgule met bb[i]=True (contexte gauche vide). Cadre : V=T[i] fini 3e pers. (ind:pre/imp) SINGULIER
    homographe-safe, JUSTE après une virgule (bb[i] ∧ ¬ss[i]) ; incise = ]m, i[ délimitée par la virgule d'ouverture m
    (frontière précédente, non début-de-phrase), ≤7 tokens. ANCRE FP=0 = déterminant PLURIEL AUDIBLE en TÊTE de la
    proposition-sujet (T[lo]) : tue le trou « de N » (« le prix DES vacances, lui, reste » : « des » n'est pas en tête,
    « le » l'est → abstention) ET l'antéposition locative (« dans les jardins, … »). Gardes : l'incise DOIT commencer par
    un mot FONCTIONNEL (prép/adverbe/participe/subordonnant) — un nom nu = ÉNUMÉRATION (« établissement, résidence, cité,
    … correspondent ») → abstention ; AUCUN verbe fini dans la proposition-sujet (sinon le GN est un OBJET). Direction
    audible seulement (pluriel manquant). FP=0 mesuré (0/2500 UD, 0/8+0/12 pièges retors énumération/apposition/locatif)."""
    w = T[i].lower()
    if not CONJ_LOADED or "'" in w or w.endswith(('é', 'és', 'ée', 'ées')): return None
    if _SEG is None: return None
    bb, ss = _SEG['bb'], _SEG['ss']
    if i >= len(bb) or not bb[i] or ss[i]: return None                        # V juste après une virgule (frontière ≠ début de phrase)
    tg = pos_tags(T)
    if not tg or not _verb_or_homograph(tg, T, i): return None
    r2 = [r for r in _reads(T[i]) if r[2] == '3' and r[1] in ('ind:pre', 'ind:imp')]
    if not r2 or _vnum3(T[i]) != 's': return None                            # cible = verbe 3sg (dir. audible)
    if i > 0 and (T[i-1].lower() in NUM_DET or deacc(T[i-1].lower()) in PREP): return None
    if (i >= 1 and deacc(T[i-1].lower()) in FULL_AUX) or (i >= 2 and deacc(T[i-2].lower()) in FULL_AUX): return None
    m = None                                                                 # virgule d'OUVERTURE de l'incise
    for j in range(i-1, 0, -1):
        if ss[j]: return None                                                # début de phrase avant l'ouverture → pas une incise
        if bb[j]: m = j; break
    if m is None or m < 2 or (i - m) > 7: return None
    im = T[m].lower()                                                        # l'incise commence par un mot FONCTIONNEL (sinon = énumération de noms)
    if not (deacc(im) in PREP or (m < len(tg) and tg[m] in ('ADP', 'ADV', 'SCONJ')) or im.endswith(('é', 'és', 'ée', 'ées'))):
        return None
    lo = 0                                                                   # début de la proposition-sujet (avant l'incise)
    for j in range(m-1, 0, -1):
        if bb[j]: lo = j; break
    if deacc(T[lo].lower()) not in PLURAL_DET: return None                   # ANCRE : dét PLURIEL audible EN TÊTE
    hasnoun = False
    for k in range(lo+1, m):
        if (k < len(tg) and tg[k] in ('NOUN', 'PROPN')) or deacc(T[k].lower()) in GENDER_PURE: hasnoun = True
        if k < len(tg) and tg[k] in ('VERB', 'AUX'): return None            # verbe fini avant l'incise → le GN est un OBJET → abstention
    if not hasnoun: return None
    lem = r2[0][0]; mt = 'ind:pre' if 'ind:pre' in {r[1] for r in r2} else 'ind:imp'
    sug = CONJ_C.get(lem, {}).get(mt, {}).get('3p')
    return sug if (sug and sug.lower() != w) else None


RULES = [('élision inversée', rule_deselide),
         ('être (ête)', rule_ete_etre),
         ('-é/-er', rule_e_er), ('-e/-é (participe)', rule_e_ppl), ('accord participe', rule_pp_etre), ('accord participe (COD avoir)', rule_pp_avoir_cod), ('accord participe (dont)', rule_pp_avoir_dont), ('accord adjectif', rule_adj_attr), ('accord adjectif épithète', rule_adj_epithet), ('terminaison -er/-é/-ez/-ai', rule_flexion_er),
         ('impératif', rule_imperatif),
         ('son/sont', rule_son_sont), ('on/ont', rule_on_ont),
         ('leur/leurs', rule_leur_leurs), ('a/à', rule_a_aa), ('et/est', rule_et_est),
         ('peu/peux/peut', rule_peu), ('sujet je', rule_je_subject), ('sais/sait', rule_sais), ('ce/se', rule_ce_se),
         ('des/dès', rule_des_des), ("c'est/s'est", rule_cest_sest), ('ça/sa', rule_ca_sa),
         ('met/mais', rule_met_mais),
         ('mai/mais', rule_mai_mais), ('mais/mes', rule_mais_mes), ('du/de', rule_du_de), ('du/dû', rule_du_du), ('sur/sûr', rule_sur_sur), ('la/là', rule_la_la),
         ("j'est/j'ai", rule_jest), ("c'ai/c'est", rule_cai), ('élision', rule_elide),
         ('accord sujet-verbe', rule_accord_sv),
         ('accord sujet-verbe', rule_il_ils),
         ('accord sujet-verbe', rule_accord_sv_recover),
         ('accord sujet-verbe', rule_accord_sv_noun),
         ('accord sujet-verbe', rule_ais_ait),
         ('accord sujet-verbe', rule_accord_sv_quant),
         ('accord sujet-verbe', rule_accord_sv_relatif),
         ('accord sujet-verbe', rule_accord_sv_coord),
         ('accord sujet-verbe', rule_accord_sv_infinitif),
         ('accord sujet-verbe', rule_accord_postpose),
         ('accord sujet-verbe', rule_accord_verb_coord),
         ('accord sujet-verbe', rule_accord_rel_obj),
         ('accord sujet-verbe', rule_accord_incise),
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
    ("Le chat et le chien sont là", "sont", "son", "son/sont"),             # FP-GUARD : sujet coordonné singulier + « sont là » (là≠note « la ») → « sont » NE doit PAS devenir « son »
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
    ("Il et elle sont là", "et", "est", "et/est"),                          # FP-GUARD : « il et elle » = sujet coordonné (pronom après « et ») → « et » NE doit PAS devenir « est »
    ("Je peux venir demain", "peux", "peut", "peu/peux/peut"),
    ("Il peut venir demain", "peut", "peux", "peu/peux/peut"),
    ("Il mange un peu de pain", "peu", "peut", "peu/peux/peut"),
    ("Le chat se trouve là", "se", "ce", "ce/se"),
    ("Il prend ce livre", "ce", "se", "ce/se"),
    ("Je voulais venir mais il est parti", "mais", "met", "met/mais"),    # met→mais : « met » sans sujet 3sg à gauche + proposition qui suit
    ("Il met son manteau", "met", "mais", "met/mais"),                    # mais→met : « il mais »→met (sens inverse)
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
    ("Mon collègue vérifiait les comptes", "vérifiait", "vérifiais", "accord sujet-verbe"),   # -ais→-ait : personne (1sg sous sujet-nom 3sg)
    ("Le technicien réparait la machine", "réparait", "réparais", "accord sujet-verbe"),       # -ais→-ait
    ("Je gardais le secret", "gardais", "gardait", "accord sujet-verbe"),                      # FP-GUARD : sujet PRONOM « je » → « gardais » correct, NE doit PAS devenir « gardait »
    ("Tu regardais la télévision", "regardais", "regardait", "accord sujet-verbe"),            # FP-GUARD : pronom « tu » → « regardais » correct
    ("les enfants a l'école", "a", "ont", "accord sujet-verbe"),             # « a l'école » = « à l'école » (locatif, article défini) → a→ont NE doit PAS tirer (ambigu avec la préposition « à »)
    ("les filles a la maison", "a", "ont", "accord sujet-verbe"),            # idem « à la maison »
    ("Ils sont contents", "ils", "il", "accord sujet-verbe"),               # « il sont »→« ils sont » : le « s » MUET de « ils » est tombé → corriger le PRONOM (pas le verbe → « ils est »)
    ("Paul et elle vont bien", "elle", "elles", "accord sujet-verbe"),      # CONTRÔLE coordination : « et elle vont » = sujet coordonné, pluriel DÉJÀ correct → « elle » ne doit PAS devenir « elles »
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
    ("La plupart du temps suffit", "suffit", "suffisent", "accord sujet-verbe"),             # la plupart DU (sing.) → sing. (FP « la plupart du temps suffisent » tué)
    ("Nombre de spécialistes doutent", "doutent", "doute", "accord sujet-verbe"),            # « nombre de N » nu → pluriel (FP « nombre… doute » tué : « nombre » n'est pas un infinitif-sujet)
    # accord sujet-verbe dans une relative « qui » (accord avec l'antécédent)
    ("Les personnes qui participent restent", "participent", "participe", "accord sujet-verbe"),  # antécédent = personnes (plur.)
    ("Voici les articles qui manquent", "manquent", "manque", "accord sujet-verbe"),         # antécédent = articles (plur.)
    ("Ce sont eux qui gèrent le dépôt", "gèrent", "gère", "accord sujet-verbe"),             # antécédent = eux (3e plur.)
    # accord sujet-verbe via RELATIVE-OBJET « que » (sujet récupéré de l'antécédent, séparé par la relative) — famille non-adjacent
    ("Les enfants que je vois jouent", "jouent", "joue", "accord sujet-verbe"),              # antécédent = enfants (plur.), écran « que je vois »
    ("Les gens que je connais viennent", "viennent", "vient", "accord sujet-verbe"),         # antécédent = gens (hors-lexique) → dét « les » audible suffit
    ("Les erreurs que le prof corrige persistent", "persistent", "persiste", "accord sujet-verbe"),  # sujet embarqué 3sg « le prof » ≠ sujet du verbe cible
    ("Les sujets dont on parle intéressent", "intéressent", "intéresse", "accord sujet-verbe"),      # relatif « dont » (jamais complétif) → antécédent-avant
    ("Les endroits où on va coûtent cher", "coûtent", "coûte", "accord sujet-verbe"),                # relatif « où » ACCENTUÉ (≠ conjonction « ou »)
    # accord sujet-verbe à travers une INCISE (sujet interrompu par une parenthèse à virgules, rule_accord_incise)
    ("Les livres, malgré leur prix, restent chers", "restent", "reste", "accord sujet-verbe"),       # incise « malgré leur prix » entre sujet et verbe
    ("Les élèves, malgré la fatigue, travaillent bien", "travaillent", "travaille", "accord sujet-verbe"),  # ancre = dét pluriel en tête, incise PREP
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
    ("Quelle belle journée", "Quelle", "Quel", "genre déterminant"),        # quel/quelle À TRAVERS un adjectif antéposé → nom-tête fém
    ("Quel joli paysage", "Quel", "Quelle", "genre déterminant"),           # nom-tête masc à travers l'adjectif
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
    ("j'ai dû partir tôt", "dû", "du", "du/dû"),                          # avoir + du + infinitif → dû (participe de devoir)
    ("je suis sûr de moi", "sûr", "sur", "sur/sûr"),                       # être + sur + de → sûr (adjectif certain)
    ("je suis là", "là", "la", "la/là"),                                   # être + la + fin → là (adverbe de lieu)
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
    ("les choses dont je t'ai parlé", "parlé", "parlées", "accord participe (dont)"),               # « dont » = COI → participe INVARIABLE (défait l'hypercorrection)
    ("la femme dont il a rêvé", "rêvé", "rêvées", "accord participe (dont)"),                        # rêver de → invariable
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
