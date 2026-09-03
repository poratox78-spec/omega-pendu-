# -*- coding: utf-8 -*-
# DÉTECTEUR OS-SUJET de RÉFÉRENCE (chantier « accord par arbitrage du sujet »). Charge le LM baké (os_subj_lm.json.gz),
# arbitre 4 routes-sujet par l'OS du pendu (mix convexe pondéré FIABILITÉ=piqué, μ=r/(1+r)) → nombre du sujet + confiance.
# Si le verbe DÉSACCORDE le sujet-OS ET confiance>τ → propose la forme accordée (ORANGE « accord verbe à vérifier »).
#   Routes : R1 plus-proche det+nom · R2 tête-avant-« de » · R3 hors-PP · R4 cohérence-LM (le LM porte la CONFIANCE).
#   C'est LA RÉFÉRENCE que porteront app+extension (orange, comme imparfaitVig ; Python = pas de rouge ici).
#   Valide : flood sur dictee/fp_scale_corpus.txt (held-out, exclu du train LM) + recall sur multi1000. τ=0.85.
#     python dictee/os_subject_probe.py
import os, re, sys, json, gzip, math, difflib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import speller_probe as SP
import correcteur_probe as C
HERE = os.path.dirname(os.path.abspath(__file__))
CONJ_C = C.CONJ_C; NUM_DET = getattr(C, 'NUM_DET', {}); PREP = getattr(C, 'PREP', set())
NOUN_POST = getattr(C, 'NOUN_POST', None)
NON_VERBE_ACC = set(json.load(open(os.path.join(HERE, 'non_verbe_acc.json'), encoding='utf-8'))['mots'])   # collisions d'accent (build_non_verbe_acc.py)   # posterior NOM/VERBE (‰) sur 83 356 mots — la table qui repond VRAIMENT a la question du filet
FULL_AUX = getattr(C, 'FULL_AUX', set()); CLITIC = getattr(C, 'CLITIC', set()); SUBJ_PRON = getattr(C, 'SUBJ_PRON', {})
TOK = re.compile(r"[a-zA-Zà-ÿœæ'\-]+")
def tk(s): return [w.lower() for w in TOK.findall(s.replace('’', "'"))]

# ---- charge le LM baké ----
M = json.load(gzip.open(os.path.join(HERE, 'os_subj_lm.json.gz'), 'rt', encoding='utf-8'))
UNI = M['uni']; N = M['N']; TF = M['tf']; TB = M['tb']; BF = M['bf']; BB = M['bb']
sTF = {k: sum(v.values()) for k, v in TF.items()}; sTB = {k: sum(v.values()) for k, v in TB.items()}
sBF = {k: sum(v.values()) for k, v in BF.items()}; sBB = {k: sum(v.values()) for k, v in BB.items()}
Vu = len(UNI) + 1
def p_uni(w): return (UNI.get(w, 0) + 0.5) / (N + 0.5*Vu)
def p_fwd(w, p2, p1):
    key = p2 + '\t' + p1; d = TF.get(key); db = BF.get(p1)
    return 0.6*((d.get(w, 0)/sTF[key]) if d else 0) + 0.3*((db.get(w, 0)/sBF[p1]) if db else 0) + 0.1*p_uni(w)
def p_bwd(w, n1, n2):
    key = n1 + '\t' + n2; d = TB.get(key); db = BB.get(n1)
    return 0.6*((d.get(w, 0)/sTB[key]) if d else 0) + 0.3*((db.get(w, 0)/sBB[n1]) if db else 0) + 0.1*p_uni(w)
def lsc(w, p2, p1, n1, n2): return math.log(0.5*p_fwd(w, p2, p1) + 0.5*p_bwd(w, n1, n2) + 1e-12)

# ---- routes → distribution sur le nombre {s,p} ----
def _vote(x, c): return (0.5+0.5*c, 0.5-0.5*c) if x == 's' else ((0.5-0.5*c, 0.5+0.5*c) if x == 'p' else (0.5, 0.5))
def _elided_sing(w): return w[:2] == "l'"            # « l'X » = déterminant élidé le/la (JAMAIS les) → sujet SINGULIER. Sans ça les routes rataient le token collé et remontaient à un pluriel lointain (« les rapports mais l'entreprise contactera »→contacteront).
_NUM_PL = set("deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize vingt trente quarante cinquante soixante cent cents mille plusieurs".split())  # déterminants numéraux cardinaux ≥2 + « plusieurs » → sujet PLURIEL (« trois enfants qui vivent » ne doit plus floder ; « sept équipes décideront » attrapé)
_PL_DET2 = set("des certains certaines quelques divers diverses maints maintes".split())              # déterminants PLURIELS hors numéraux (« des constructeurs proposent », « certains fabricants »)
_PL_PHRASE = set("nombreux nombreuses beaucoup plupart".split())                                      # « de nombreux/nombreuses X », « beaucoup de X », « la plupart des X » → PLURIEL (PAS « nombre » : « au nombre variable » = sing)
# Noms dont le -s/-x final n'est PAS une marque de pluriel : il ne peut pas contredire le déterminant.
_OS_INVAR = set('prix cours corps temps bois pays mois bras dos cas choix croix voix noix toux poids '
                'concours discours parcours secours univers divers pervers avis colis permis compromis '
                'bus autobus jus repas tapis souris brebis puits gaz nez riz'.split())


def _num_at(F, k):                                   # nombre du sujet en tête k : élision « l'X » (sing.), numéral/dét-pluriel (plur.), OU déterminant connu F[k-1] ; sinon None
    if _elided_sing(F[k]): return 's'
    if k > 0:
        dk = SP.deacc(F[k-1])
        if dk in _NUM_PL or dk in _PL_DET2 or dk in _PL_PHRASE: return 'p'
        # « De trains passent » : « de/d' » en TÊTE de segment + nom en -s/-x = pluriel indéfini (miroir JS, 03/09/2026)
        _bb = C._SEG['bb'] if C._SEG is not None else None
        if dk in ('de', "d'") and (k-1 == 0 or (_bb is not None and k-1 < len(_bb) and _bb[k-1])):
            _nn = SP.deacc(F[k])
            if _nn.endswith(('s', 'x')) and _nn not in _OS_INVAR: return 'p'
        if dk in NUM_DET:
            # ⭐ Le -s/-x ne prouve un PLURIEL que si le mot n'est pas INVARIABLE. Sans ce test, le
            # « x » de « prix » écrasait le déterminant « Le », pourtant sans ambiguïté, et l'orange
            # proposait « Le prix SONT fixé par la loi ». Mesuré dans l'app le 26/08/2026.
            _n = SP.deacc(F[k])
            return 'p' if (NUM_DET.get(F[k-1]) == 'pl'
                           or (_n.endswith(('s', 'x')) and _n not in _OS_INVAR)) else 's'
    return None
def _coord_plural(F, vi):                            # sujet COORDONNÉ « N et N » avant le verbe, même proposition, PAS dans un PP « de X et Y » → PLURIEL (structure sûre ; l'OS floodait faute de cette route)
    lo = 0
    if C._SEG is not None:
        for j in range(vi, 0, -1):
            if j < len(C._SEG['bb']) and C._SEG['bb'][j]: lo = j; break
    for k in range(vi-1, lo, -1):
        if SP.deacc(F[k]) in ('et', 'puis') and k+1 < vi:   # « la pandémie … puis l'armistice » (miroir JS, 03/09/2026)
            if any(k-d >= lo and SP.deacc(F[k-d]) in ('de', 'des', 'du', "d'") for d in (1, 2, 3)): continue  # « de X et Y » = coordination DANS un complément → pas le sujet
            return True
    return False
def _rel_ant(F, vi):
    """LA RELATIVE EN « qui » (miroir JS _osRelAnt, 03/09/2026). Si un « qui » précède le verbe dans les 8 tokens, même
    segment, sans et/ou/mais/que/dont entre les deux : le sujet est l'ANTÉCÉDENT (token avant « qui »), pas le dernier
    nom de la relative (« les villages qui composent la commune sont » → villages). Rend l'indice de l'antécédent ou -1."""
    lo = 0
    if C._SEG is not None:
        for j in range(vi, 0, -1):
            if j < len(C._SEG['bb']) and C._SEG['bb'][j]: lo = j; break
    j = vi-1
    while j > lo and j >= vi-8:
        d = SP.deacc(F[j])
        if d == 'qui': return j-1
        if d in ('et', 'ou', 'mais', 'que', "qu'", 'dont'): return -1
        j -= 1
    return -1
def _ant_num(F, ant):
    """nombre porté par l'antécédent LUI-MÊME (miroir JS _osAntNum) : _num_at, sinon partitif « de N-s » ; sinon None → la
    règle se tait (un repli de 3 mots en arrière tombait à côté : « FIRA-AER qui », « architékete … qui »)."""
    if ant >= 2 and F[ant-1] in NUM_DET and SP.deacc(F[ant-2]) in ('de', 'des', 'du', "d'"):
        return None                                   # « les nations de la FIRA-AER qui » : antécédent = COMPLÉMENT, tête avant → ambigu, on se tait (miroir JS)
    x = _num_at(F, ant)
    if x: return x
    if ant > 0:
        dp, npf = SP.deacc(F[ant-1]), SP.deacc(F[ant])
        if dp in ('de', "d'") and npf.endswith(('s', 'x')) and npf not in _OS_INVAR: return 'p'
    return None
def R1(F, vi):
    for k in range(vi-1, -1, -1):
        x = _num_at(F, k)
        if x: return _vote(x, 0.85)
    return (0.5, 0.5)
def R2(F, vi):
    k = vi-1; last = None
    while k >= 0:
        x = _num_at(F, k)
        if x:
            last = x
            if k-2 >= 0 and SP.deacc(F[k-2]) in ('de', 'des', 'du', "d'"): k -= 2; continue
            return _vote(last, 0.9)
        k -= 1
    return _vote(last, 0.7) if last else (0.5, 0.5)
def R3(F, vi):
    for k in range(vi-1, -1, -1):
        x = _num_at(F, k)
        if x:
            if not _elided_sing(F[k]) and k-2 >= 0 and SP.deacc(F[k-2]) in PREP: continue
            return _vote(x, 0.85)
    return (0.5, 0.5)
def R4(F, vi, f3s, f3p):
    if not f3s or not f3p: return (0.5, 0.5)
    p2 = F[vi-2] if vi >= 2 else '<s>'; p1 = F[vi-1] if vi >= 1 else '<s>'
    n1 = F[vi+1] if vi+1 < len(F) else '</s>'; n2 = F[vi+2] if vi+2 < len(F) else '</s>'
    ss, sp = lsc(f3s, p2, p1, n1, n2), lsc(f3p, p2, p1, n1, n2); mx = max(ss, sp)
    es, ep = math.exp(ss-mx), math.exp(sp-mx); Z = es+ep; return (es/Z, ep/Z)
def _peak(d): return abs(d[0]-d[1])
def os_mix(ds):
    ws = [_peak(d)+1e-6 for d in ds]; Z = sum(ws)
    ps = sum(w*d[0] for w, d in zip(ws, ds))/Z; pp = sum(w*d[1] for w, d in zip(ws, ds))/Z
    return ('s' if ps >= pp else 'p', abs(ps-pp))
def _vinfo(form):
    rd = C._reads(form); p3 = [(l, mt, n) for (l, mt, p, n) in rd if p == '3']
    if not p3: return None
    lem = p3[0][0]; mts = [mt for l, mt, n in p3]; mt = 'ind:pre' if 'ind:pre' in mts else mts[0]
    nums = set(n for l, m, n in p3 if m == mt); vn = 's' if nums == {'s'} else ('p' if nums == {'p'} else '?')
    sl = CONJ_C.get(lem, {}).get(mt, {}); return (lem, mt, vn, sl.get('3s'), sl.get('3p'))

_OS_CLI = CLITIC                                     # skip clitiques/négation pour trouver le sujet-pronom (jeu identique Python↔JS)
def _pron_before(F, vi):                             # sujet PRONOM net (je/tu/il/elle/on/ils/elles) en sautant clitiques + « ne » → géré par la règle PRONOM, pas l'OS-noms
    j = vi - 1; steps = 0
    while j >= 0 and steps < 4 and SP.deacc(F[j]) in _OS_CLI: j -= 1; steps += 1
    if j < 0: return None
    m = C._ELIDED_PRON.match(F[j])                   # « Alors qu'il reste » : le pronom sujet vit DANS le token élidé (miroir JS, 03/09/2026)
    if m: return SP.deacc(m.group(1))
    return SUBJ_PRON.get(SP.deacc(F[j]))
def _guard_ok(F, vi):
    """gardes STRUCTURELLES (miroir de rule_accord_sv_noun/rule_ais_ait) que le port OS avait perdues → floodaient sur
    passé composé/participe/sujet-pronom (mesuré sur registre chat : flood 3,5 %→0 %, recall inchangé). Indépendantes du sujet-OS."""
    w = F[vi]
    if "'" in w: return False                                                     # verbe élidé (n'est…) → autre structure
    if w.endswith(('é', 'és', 'ée', 'ées')): return False                         # PARTICIPE (contacté, embrassé) : accord ADJECTIVAL, pas verbal
    if vi > 0 and F[vi-1] in NUM_DET: return False                               # déterminant avant → T[vi] = NOM (« les joue »)
    if vi > 0 and SP.deacc(F[vi-1]) in PREP: return False                        # préposition avant → nom homographe (« de contrôle »)
    if (vi >= 1 and SP.deacc(F[vi-1]) in FULL_AUX) or (vi >= 2 and SP.deacc(F[vi-2]) in FULL_AUX): return False  # temps composé (aux + participe : « ont contacté », « a montré »)
    if _pron_before(F, vi) is not None: return False                            # sujet pronom net (je/elle…) → « je ne me trompe », « elle m'a… »
    return True

_ADV_ACC = set('là ici ainsi alors ensuite aussi puis enfin bientôt partout dedans dehors dessus dessous'.split())  # adverbes frontaux d'inversion, ACCENTUÉS (« là »≠« la » : tk garde les accents → pas de collision det/adverbe comme dans le rouge)
def _R_postpose(F, vi, tg):
    """Route SUJET POSTPOSÉ (inversion) : quand l'ORDRE change (idée de Rem #198), on cherche le sujet AVANT (scan APRÈS le
    verbe). Déclencheur d'inversion en tête de proposition = adverbe frontal / interrogatif / PP ; ET aucun sujet-pronom
    préverbal ; sujet postposé PLURIEL après (saut adverbes+participe passif). ACCENT-AWARE (là/à ≠ la/a) → pas besoin du
    `_np_subject` du rouge (qui bloquait les cas objet-de-PP) : le déclencheur accentué suffit. Rend (ps,pp) ou None."""
    lo = 0
    if C._SEG is not None:
        for j in range(vi, 0, -1):
            if j < len(C._SEG['bb']) and C._SEG['bb'][j]: lo = j; break
    acc = F[lo]; d = C.deacc(acc)
    # RELATIVE OBJET, detectee LOCALEMENT : _SEG['bb'] ne marque PAS « que » comme frontiere de
    # proposition, donc `lo` restait sur le determinant de l'antecedent et le declencheur ne tirait
    # jamais. On regarde les 3 tokens a gauche du verbe (negation et adverbe tolerés).
    _rel = False
    for _r in range(vi - 1, max(-1, vi - 4), -1):
        _dr = C.deacc(F[_r])
        if _dr in ('que', "qu'"): _rel = True; lo = _r; break
        if not (_dr in ('ne', "n'") or (_r < len(tg) and tg[_r] == 'ADV')): break
    if _rel: acc = F[lo]; d = C.deacc(acc)
    if not (_rel or acc in _ADV_ACC or (lo < len(tg) and tg[lo] == 'ADV') or acc in _INV_WH or d in _INV_WH
            or (d in PREP and acc != 'a' and acc != 'la') or acc in ('comme', 'quand', 'lorsque')): return None
    for k in range(lo, vi):                                   # sujet-pronom/expletif/relatif/coordination préverbal → pas une inversion
        dk = C.deacc(F[k])
        if dk in ('il', 'elle', 'elles', 'ils', 'ce', 'c', 'on', 'ca', 'cela', 'ceci', 'qui', 'dont', 'je', 'tu', 'nous', 'vous', 'lequel', 'laquelle', 'lesquels', 'lesquelles'): return None
        if dk in ('et', 'ou', 'ni'): return None
    hi = len(F)
    if C._SEG is not None:
        for j in range(vi + 1, len(F)):
            if j < len(C._SEG['bb']) and C._SEG['bb'][j]: hi = j; break
    k = vi + 1                                                # scan AVANT (après le verbe) : sauter adverbes + participe passif
    while k < hi and k < len(tg) and (tg[k] == 'ADV' or (tg[k] in ('VERB', 'ADJ') and F[k].endswith(('é', 'és', 'ée', 'ées')))): k += 1
    if C._postpose_plural(F, tg, k, hi): return (0.03, 0.97)  # sujet postposé PLURIEL net
    if _rel and C._postpose_singulier(F, tg, k, hi): return (0.97, 0.03)   # sujet postposé SINGULIER (relative objet seulement)
    return None

_INV_WH = getattr(C, '_INV_WH', set())

OS_NOUN_TAU, OS_NOUN_EPS = 900, 50   # P(NOM) >= 0,90 et P(VERBE) <= 0,05 : un nom NET, pas un homographe

def _verb_ctx(tg, F, vi):
    """GATE POS de l'OS + filet homographe ÉTROIT. VERB/AUX net, OU verbe-forme mistaguée NOUN/X (PAS ADJ/PROPN : jeune/Bee
    = flood) NI nom (GENDER_FULL) NI adj (ADJ_LEX) NI préposition, et pas précédée d'un dét/prép. Récupère « les rumeurs
    circule » (circule tagué NOUN par l'émission HMM à 2 %) SANS le flood des épicènes/propres. Mesuré : +1 recall / +0
    flood vs le gate VERB/AUX seul. Plus ÉTROIT que le _verb_or_homograph des règles rouges (l'OS scanne large, moins gardé)."""
    if vi >= len(tg): return False
    if F[vi].lower() in NON_VERBE_ACC: return False   # collision d'accent : « adhérent » n'est pas « adhèrent » (miroir JS _NON_VERBE_ACC)
    if tg[vi] in ('VERB', 'AUX'): return True
    if tg[vi] not in ('NOUN', 'X'): return False
    d = C.deacc(F[vi].lower())
    if d in C.GENDER_FULL or d in C.ADJ_LEX or d in PREP: return False
    # ⭐ LE BON INSTRUMENT À LA PLACE DU PROXY. Ce filet demandait « est-ce un nom ? » à une table de
    # GENRE de 4 178 entrées (GENDER_FULL) — or `noun_post` répond exactement à cette question sur
    # 83 356 mots : P(NOM) contre P(VERBE) en ‰. « écorce » y vaut [975, 23] et passait quand même,
    # d'où « une dure écorce qui met le bois tendre » → « écorcent » (mesuré au produit, 4 fois).
    # Seuil PROPRE à cette garde : le précédent de la règle a/à (P(VER) < 1 ‰) est trop strict et
    # laisserait passer écorce. On exige un nom NET, ce qui laisse intacts les homographes
    # réellement ambigus (ferme [389,472], porte [716,284], marche [383,617]) et les mots ABSENTS de
    # la table — dont « circule », le cas que ce filet existe pour rattraper.
    _np = NOUN_POST.get(d) if NOUN_POST else None
    if _np and _np[0] >= OS_NOUN_TAU and _np[1] <= OS_NOUN_EPS: return False
    if vi > 0 and (F[vi-1].lower() in NUM_DET or C.deacc(F[vi-1].lower()) in PREP): return False
    return bool(C._reads(F[vi]))


def _coord_verbe(F, vi, vn, f3s, f3p, tg):
    """« remporta six victoires ET encaisse trois défaites » : le verbe qui suit et/ou/puis/mais reprend le sujet du verbe
    fini précédent du même segment (le tagger tranche les homographes : « contre », « vents »). Même lecture (personne,
    nombre) possible → None (rien à dire) ; sinon la forme du nombre du premier verbe. False = la route ne s'applique pas.
    Le token est comparé BRUT (« où » désaccentué serait pris pour « ou »). Miroir JS _osCoordVerbe (03/09/2026)."""
    j, st = vi - 1, 0
    while j >= 0 and st < 3 and SP.deacc(F[j]) in _OS_CLI: j -= 1; st += 1
    if j < 0 or F[j] not in ('et', 'ou', 'puis', 'mais'): return False
    lo = 0
    if C._SEG is not None:
        for q in range(j, 0, -1):
            if q < len(C._SEG['bb']) and C._SEG['bb'][q]: lo = q; break
    rv = C._reads(F[vi])
    for q in range(j - 1, max(lo, j - 12) - 1, -1):
        w = F[q]
        if "'" in w or re.search(u'(é|és|ée|ées)$', w): continue
        if tg is None or q >= len(tg): continue
        if tg[q] not in ('VERB', 'AUX'):
            # passé simple pris pour un NOM par le tagger (« remporta ») : repris seulement si verbe PUR au noun-post (miroir JS)
            if tg[q] not in ('NOUN', 'PROPN') or not C.NOUN_POST: continue
            _nq = C.NOUN_POST.get(SP.deacc(w))
            if _nq and _nq[0] >= 100: continue
        r = C._reads(w)
        if not r:
            if tg[q] == 'VERB' and len(w) > 3 and re.search(u'[a-zà-ÿ]a$', w): r = [(w, 'ind:pas', '3', 's')]   # passé simple 3s en -a (« remporta ») absent des tables
            else: continue
        elif not C._is_finite(w): continue
        nbs = set(); ok = False
        for a in r:
            nbs.add(a[3])
            for b in rv:
                if a[2] == b[2] and (a[3] == b[3] or a[3] == 'x' or b[3] == 'x'): ok = True
        if ok: return None
        if 's' in nbs and 'p' not in nbs: return None if vn == 's' else (f3s, 0.9)
        if 'p' in nbs and 's' not in nbs: return None if vn == 'p' else (f3p, 0.9)
        return None
    return False

def detect(F, vi, tau=0.85, tg=None):
    """rend (forme accordée suggérée, confiance) si le verbe F[vi] désaccorde le sujet-OS au-dessus de τ, sinon None.
    _guard_ok : gardes structurelles (participe/aux/dét/prép/sujet-pronom) — miroir des règles sœurs.
    tg (POS-tags de F) : GATE POS — écarte les noms/adj homographes de verbes (« la côte », « influent », « la pêche »)
    que _vinfo prend à tort pour des verbes = vrais FP (mesuré : −17 flood pour −2 recall). tg passé par le moteur."""
    if not _guard_ok(F, vi): return None
    vi_ = _vinfo(F[vi])
    if not vi_: return None
    lem, mt, vn, f3s, f3p = vi_
    if vn == '?' or not f3s or not f3p: return None
    if tg is not None and not _verb_ctx(tg, F, vi): return None
    if tg is not None:                                        # COORDINATION DE VERBES (miroir JS _osCoordVerbe, 03/09/2026)
        cv = _coord_verbe(F, vi, vn, f3s, f3p, tg)
        if cv is not False: return cv
    if tg is not None:                                        # LE PARSEUR DE SUJET D'ABORD (miroir JS, 03/09/2026)
        try: np_ = C._np_subject(F, tg, vi)
        except Exception: np_ = None
        if np_ and np_.get('n') in ('s', 'p') and not _coord_plural(F, vi) and _rel_ant(F, vi) < 0:   # relative entre la tête et le verbe : la route relative parle (miroir JS)
            ds = [_vote(np_['n'], 0.9), R4(F, vi, f3s, f3p)]
            ws = [_peak(ds[0]) + 1e-6, (_peak(ds[1]) + 1e-6) * 0.4]
            Z = sum(ws); ps = sum(w * d[0] for w, d in zip(ws, ds)) / Z; pp = sum(w * d[1] for w, d in zip(ws, ds)) / Z
            num = 's' if ps >= pp else 'p'; conf = abs(ps - pp)
            if conf < tau or num == vn: return None
            return (f3p if num == 'p' else f3s, conf)
    if tg is not None:                                        # SUJET POSTPOSÉ (inversion) : mode dédié qui DOMINE (ordre inversé → scan avant)
        pp_ = _R_postpose(F, vi, tg)
        if pp_ is not None:
            num = 's' if pp_[0] >= pp_[1] else 'p'; conf = abs(pp_[0] - pp_[1])
            if conf < tau or num == vn: return None
            return (f3p if num == 'p' else f3s, conf)
    ant = _rel_ant(F, vi)
    if ant >= 0:                                          # relative : l'antécédent EST le sujet ; s'il ne porte pas son nombre, on se tait (miroir JS)
        an = _ant_num(F, ant)
        if not an: return None
        ds = [_vote(an, 0.9), R4(F, vi, f3s, f3p)]
    else:
        ds = [R1(F, vi), R2(F, vi), R3(F, vi), R4(F, vi, f3s, f3p)]
    ws = [_peak(d) + 1e-6 for d in ds]
    ws[-1] *= 0.4                                          # LM (R4) DÉ-PONDÉRÉ : biaisé-fréquence (préfère le sing.), ne doit pas écraser les routes structurelles concordantes (récupère « les livreurs accepte→acceptent »)
    if _coord_plural(F, vi):                              # route COORDINATION : sujet « N et N » → pluriel, poids fort (tue les floods « la suède et la russie signent »→signe)
        ds.append((0.02, 0.98)); ws.append(max(ws) + 1.0)
    Z = sum(ws)
    ps = sum(w * d[0] for w, d in zip(ws, ds)) / Z; pp = sum(w * d[1] for w, d in zip(ws, ds)) / Z
    num = 's' if ps >= pp else 'p'; conf = abs(ps - pp)
    if conf < tau or num == vn: return None
    return (f3p if num == 'p' else f3s, conf)

if __name__ == '__main__':
    TAU = 0.85
    fp = [l.strip() for l in open(os.path.join(HERE, 'fp_scale_corpus.txt'), encoding='utf-8') if l.strip()]
    if len(sys.argv) > 1 and sys.argv[1] == 'floodflags':   # mode PARITÉ (self-contained, fp_scale committé) : dump les flags OS sur fp_scale[:1500] → comparé aux moteurs JS par dictee/parity_os.js
        flags = []
        for s in fp[:1500]:
            F = tk(s); C._SEG = C._seg_info(s); tg = C.pos_tags(F)
            for i in range(len(F)):
                r = detect(F, i, TAU, tg)
                if r and r[0] != F[i]: flags.append([F[i], r[0]])
        print(json.dumps(sorted(flags), ensure_ascii=False)); sys.exit(0)
    if len(sys.argv) > 1 and sys.argv[1] == 'probeflags':   # mode PARITÉ batterie : phrases JSON sur stdin → flags OS (lock du comportement postposé/homographe cross-moteurs)
        flags = []
        for s in json.loads(sys.stdin.read()):
            F = tk(s); C._SEG = C._seg_info(s); tg = C.pos_tags(F)
            for i in range(len(F)):
                r = detect(F, i, TAU, tg)
                if r and r[0] != F[i]: flags.append([F[i], r[0]])
        print(json.dumps(sorted(flags), ensure_ascii=False)); sys.exit(0)
    fl = nv = 0
    for s in fp[:1500]:
        F = tk(s); C._SEG = C._seg_info(s); tg = C.pos_tags(F)
        for i in range(len(F)):
            if _vinfo(F[i]): nv += 1
            r = detect(F, i, TAU, tg)
            if r and r[0] != F[i]: fl += 1
    agr = []
    for l in open(os.path.join(HERE, '..', 'data_local', 'corpus_multi1000.jsonl'), encoding='utf-8'):
        try: d = json.loads(l)
        except: continue
        bad = d.get('bad', ''); a, b = tk(bad), tk(d.get('good', ''))
        for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b).get_opcodes():
            if op == 'replace':
                for k, (x, y) in enumerate(zip(a[i1:i2], b[j1:j2])):
                    vx, vy = _vinfo(x), _vinfo(y)
                    if x != y and vx and vy and vx[0] == vy[0] and vx[2] != vy[2] and vx[2] != '?' and vy[2] != '?': agr.append((bad, i1+k, x, y))
    seen = set(); agr = [t for t in agr if (t[2], t[3]) not in seen and not seen.add((t[2], t[3]))]
    rc = 0
    for bad, bi, x, y in agr:
        F = tk(bad); C._SEG = C._seg_info(bad); tg = C.pos_tags(F)
        if bi < len(F) and F[bi] == x and (detect(F, bi, TAU, tg) or (None,))[0] == y: rc += 1
    print("=== DÉTECTEUR OS-SUJET de référence (LM baké, τ=%.2f) ===" % TAU)
    print("  LM : %d entrées chargées | verbes UD testés %d" % (len(UNI)+len(TF)+len(TB)+len(BF)+len(BB), nv))
    print("  FLOOD (verbes UD corrects flaggués) : %d/%d = %.2f%%" % (fl, nv, 100*fl/max(1, nv)))
    print("  RECALL (accord dys réel proposé) : %d/%d = %.0f%%" % (rc, len(agr), 100*rc/max(1, len(agr))))
