# -*- coding: utf-8 -*-
# Moteur correcteur ORTHOGRAPHIQUE (non-mots) — 2 niveaux de confiance, mesuré sur le vrai corpus GEC.
#   AUTO  = remplace tout seul (l'app applique) : restauration d'accent NON AMBIGUË, ou typo distance-1 vers un
#           mot DOMINANT (fréquent, sans rival proche). Doit être quasi-FP=0 (change le texte en silence).
#   FLAG  = souligne (l'utilisateur clique) : candidat plausible mais incertain (rivaux, fréquence moyenne, élision).
#   None  = mot valide, ou nom propre, ou aucun bon candidat (néologisme) → on n'y touche pas.
# Ressources : Lexique4 (forme accentuée + fréquence). Phonétique = étape suivante.
import os, sys, csv, json, unicodedata, re
from collections import defaultdict
from functools import cmp_to_key

LEX = os.environ.get('LEX4', '/tmp/lex4/Lexique4.tsv')
GEC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'corpus_gec_fr.jsonl')
ALPHA = "abcdefghijklmnopqrstuvwxyz"
ELIDE = set("lmtsndcj")                       # consonnes d'élision (l', d', m', t', s', n', c', j', qu')
_ELIDE_ACC = set("ldjcs")                      # préfixes SÛRS pour la restauration d'accent du reste (m'/t'/n' EXCLUS : « metre »=mètre≠m'être, mesuré FP)
VOWELS = set("aeiouyh")                        # le mot élidé commence par voyelle/h
AUTO_FREQ = 1.0                                # fréquence min (occ/M) pour AUTO
FLAG_FREQ = 0.1                                # fréquence min pour FLAG
DOMINANCE = 5.0                               # rapport freq top/2e pour qu'un candidat soit "dominant" (AUTO)

def deacc(s):
    s = s.replace('œ', 'oe').replace('Œ', 'OE').replace('æ', 'ae').replace('Æ', 'AE')
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

TOK = re.compile(r"[A-Za-zÀ-ÿœŒæÆ]+")          # inclut œ/æ (sinon « sœur » casse en s/ur)

def load_lexicon():
    WORDS, FREQ, DEACC2ACC, POS = set(), {}, defaultdict(list), defaultdict(set)
    with open(LEX, encoding='utf-8') as f:
        r = csv.reader(f, delimiter='\t'); H = next(r)
        ci = {h.lower(): i for i, h in enumerate(H)}
        cm = next(i for h, i in ci.items() if 'mot' in h)
        cf = next(i for h, i in ci.items() if 'freqortho' in h)
        cg = next(i for h, i in ci.items() if 'cgram' in h and 'ortho' not in h)
        for row in r:
            if len(row) <= max(cm, cf, cg): continue
            w = (row[cm] or '').strip().lower()
            if not w or len(w) < 2 or not all(deacc(c) in ALPHA for c in w): continue
            try: fr = float((row[cf] or '0').replace(',', '.'))
            except ValueError: fr = 0.0
            if fr > FREQ.get(w, -1): FREQ[w] = fr
            WORDS.add(w)
            cgr = (row[cg] or '').strip().upper()
            p = 'N' if cgr.startswith('NOM') else ('V' if (cgr.startswith('VER') or cgr.startswith('AUX')) else ('A' if cgr.startswith('ADJ') else None))
            if p: POS[w].add(p)
    PHON = defaultdict(list)
    for w in WORDS:
        DEACC2ACC[deacc(w)].append(w)
        if FREQ[w] >= FLAG_FREQ:                   # index phonétique : mots pas trop rares (limite les collisions)
            PHON[phon_key(w)].append(w)
    for d in DEACC2ACC:
        DEACC2ACC[d].sort(key=lambda w: -FREQ[w])
    for k in PHON:
        PHON[k].sort(key=lambda w: -FREQ[w])
    for w in ('postulée', 'postulées', 'entretint', 'entretinrent', 'armet', 'armets'):   # MOTS VALIDES manquants du lexique que le speller éditait à tort (« mauvais candidat sur mot valide ») → protégés (WORDS ⇒ ni correction ni vigilance). FP=0 : vrais mots FR ; liste extensible. (miroir app/ext)
        WORDS.add(w)
    return WORDS, FREQ, DEACC2ACC, PHON, POS

def phon_key(s):
    """Clé phonétique française approximative : deux mots qui SONNENT pareil → même clé.
    But : rapprocher « fote »≈« faute », « leson »≈« leçon », « ortografe »≈« orthographe ». Approximatif
    (collisions ver/vert/verre attendues) → usage FLAG seulement, classé par fréquence.
    ⚠️ NE PAS remplacer par un IPA/G2P « fidèle » : MESURÉ-RÉFUTÉ (gold dys 28 paires, 2026-07) — collision
    typo↔correct = 85 % avec CETTE clé approximative vs 67 % avec le vrai IPA Lexique. L'IPA préserve les finales
    (faute /fot/, commerce /komɛʁs/) que le dys LAISSE TOMBER ; l'approximation lossy des DEUX côtés EST la feature.
    (Idem swap G2P pendu, réfuté « trop fidèle ». Le mur d'accuracy = canal ORTHOGRAPHIQUE/fréquence, pas phonétique.)"""
    s = s.lower().replace('œ', 'oe').replace('æ', 'ae').replace('ç', 's')
    s = deacc(s)
    # NASALES : voyelle+n/m NON suivie de voyelle/n/m → une classe nasale unique (rappel : « sertin »≈« certain »,
    # « in/ain/ein/un »→/ɛ̃/=1 ; « an/en »→/ɑ̃/=2 ; « on »→/ɔ̃/=3). Préserve les non-nasales (animal, année, aime, pomme).
    s = re.sub(r'oin(?![aeiouy])', 'w1', s)
    s = re.sub(r'ien(?![aeiouy])', 'j1', s)
    s = re.sub(r'(?:ain|aim|ein|eim|in|im|yn|ym|un|um)(?![aeiouymn])', '1', s)
    s = re.sub(r'(?:an|am|en|em)(?![aeiouymn])', '2', s)
    s = re.sub(r'(?:on|om)(?![aeiouymn])', '3', s)
    s = s.replace('ph', 'f').replace('sch', 'ch').replace('th', 't')
    s = re.sub(r'ch(?=[bcdfgjklmnpqrstvwxz])', 'k', s)          # ch DEVANT CONSONNE = /k/ (mots grecs : technologie, chrome, chlore, orchestre) ≠ /ʃ/
    s = s.replace('ch', '§').replace('gn', '¤')                 # ch restant (devant voyelle) → /ʃ/ ; digraphes → placeholders
    s = s.replace('qu', 'k').replace('gu', 'g')
    s = s.replace('eau', 'o').replace('aux', 'o').replace('au', 'o')
    s = s.replace('ou', 'u').replace('eu', 'e').replace('oeu', 'e')
    s = s.replace('ai', 'e').replace('ei', 'e').replace('ay', 'e').replace('ey', 'e')
    s = s.replace('oi', 'wa')
    res = []
    for j, ch in enumerate(s):
        nx = s[j + 1] if j + 1 < len(s) else ''
        if ch == 'c':   res.append('s' if nx in 'eiy§' else 'k')
        elif ch == 'g': res.append('j' if nx in 'eiy' else 'g')
        elif ch == 'h': pass                                    # h muet
        elif ch == 'x': res.append('' if j == len(s) - 1 else 'ks')   # -x FINAL MUET (noix/prix/voix/choix) ; interne = ks (taxi)
        elif ch in 'zs': res.append('s')
        elif ch == 'y': res.append('i')
        elif ch == 'w': res.append('v')
        else: res.append(ch)
    s = ''.join(res).replace('§', '§').replace('¤', 'nj')        # gn≈nj ; ch reste distinct (§)
    out = []                                                     # collapse doublons
    for ch in s:
        if not out or out[-1] != ch: out.append(ch)
    s = ''.join(out)
    # FINALES MUETTES — le « e » final est muet MAIS il REND SONORE la consonne devant.
    # L'ancienne boucle rasait e/s/t : « faute » /fot/ et « faut » /fo/ tombaient tous deux sur
    # « fo », alors qu'ils ne se prononcent PAS pareil (relevé par Rem).
    if s.endswith('s'): s = s[:-1]                               # -s pluriel muet
    if s.endswith('e'): s = s[:-1]                               # -e muet : la consonne devant SE PRONONCE -> stop
    else:
        while s and s[-1] in 'st': s = s[:-1]                    # consonne finale muette (faut/vent)
    return s

def edits1(d):
    sp = [(d[:i], d[i:]) for i in range(len(d) + 1)]
    res = set()
    for a, b in sp:
        if b: res.add(a + b[1:])
        if len(b) > 1: res.add(a + b[1] + b[0] + b[2:])
        for c in ALPHA:
            res.add(a + c + b)
            if b: res.add(a + c + b[1:])
    return res

class Speller:
    DET_G = {'un':'m','une':'f','le':'m','la':'f','du':'m','au':'m','ce':'m','cet':'m','cette':'f',
             'mon':'m','ma':'f','ton':'m','ta':'f','son':'m','sa':'f','quel':'m','quelle':'f'}
    DET_NUM = {'le':'s','la':'s','un':'s','une':'s','ce':'s','cet':'s','cette':'s','mon':'s','ma':'s',
               'ton':'s','ta':'s','son':'s','sa':'s','les':'p','des':'p','ces':'p','mes':'p','tes':'p',
               'ses':'p','nos':'p','vos':'p','leurs':'p'}
    ADVERB = set('tres si trop assez bien plus tout aussi moins fort peu'.split())   # contexte adjectif
    def __init__(self):
        self.WORDS, self.FREQ, self.D2A, self.PHON, self.POS = load_lexicon()
        here = os.path.dirname(os.path.abspath(__file__))
        def _load(name):
            fp = os.path.join(here, name)
            try: return json.load(open(fp, encoding='utf-8')) if os.path.exists(fp) else {}
            except Exception: return {}
        self.ADJ = _load('cgram_adj.json')         # forme_déacc -> [genre, contrepartie accentuée]
        self.GEN = _load('cgram_gender.json')       # nom_déacc -> genre (non ambigu)

    def _gender(self, w):
        """genre d'un candidat accentué : adjectif (paire) SI c'est un adjectif, sinon nom. None si inconnu.
        Le guard 'A' évite la collision déacc (« pomme » nom ≠ « pommé » adj → ne pas prendre le genre adj)."""
        if 'A' in self.POS.get(w, ()):
            a = self.ADJ.get(deacc(w))
            if a: return a[0]
        return self.GEN.get(deacc(w))

    COPULA = set('est sont suis es sommes etes etait etaient etais sera seront serai soit fut furent '
                 'parait paraissait semble semblait devient deviennent reste restent'.split())
    def _ctx_gender(self, toks, idx):
        """genre imposé par le contexte : déterminant proche, sinon nom-tête proche (≤4 tokens avant).
        Saute les copules (est/sont/semble…) : le genre d'un attribut vient du SUJET, pas du verbe
        (et « est » est un nom homographe — l'est — qui polluerait cgram_gender)."""
        if not toks or idx is None: return None
        for j in range(idx - 1, max(-1, idx - 5), -1):
            t = deacc(toks[j].lower())
            if t in self.COPULA: continue
            if t in self.DET_G: return self.DET_G[t]
            if toks[j].lower().replace('œ', 'oe').replace('æ', 'ae') not in self.WORDS: continue   # ancre de genre = un VRAI mot écrit : un token fautif (« tres ») porte un genre pollué (GEN déacc ← « trés » nom) → on continue vers le déterminant
            g = self.GEN.get(t)
            if g: return g
        return None

    def _ctx_number(self, toks, idx):
        if not toks or idx is None: return None
        for j in range(idx - 1, max(-1, idx - 4), -1):
            t = deacc(toks[j].lower())
            if t in self.DET_NUM: return self.DET_NUM[t]
        return None

    def _cands(self, low, d):
        """forme accentuée -> meilleure (priorité, freq). 2 = accent-only, 1 = edit-1, 0 = phonétique (FLAG)."""
        c = {}
        for w in self.D2A.get(d, []):
            c[w] = max(c.get(w, (-1, 0)), (2, self.FREQ[w]))
        for e in edits1(d):
            for w in self.D2A.get(e, []):
                c[w] = max(c.get(w, (-1, 0)), (1, self.FREQ[w]))
        for w in self.PHON.get(phon_key(low), [])[:8]:          # voisins phonétiques (FLAG) — limités, classés freq
            if abs(len(deacc(w)) - len(d)) > 2 or deacc(w)[:1] != d[:1]: continue   # garde-longueur (Δ≤2) + MÊME initiale : laisse le multi-édit silencieux (ortografe→orthographe : th/ph) ; bloque trist→tristesse (Δ4) et autent→hautaine (initiale a≠h)
            c[w] = max(c.get(w, (-1, 0)), (0, self.FREQ[w]))
        return c

    def correct_token(self, tok, at_start=False, toks=None, idx=None):
        """-> (action 'auto'|'flag', suggestion) ou None. toks/idx = contexte (accord genre/nombre)."""
        low = tok.lower().replace('œ', 'oe').replace('æ', 'ae')   # normalise la ligature (cœur→coeur : lexique en digraphe)
        if len(low) < 2 or not all(deacc(ch) in ALPHA for ch in low): return None
        _oel = {'soeur': 'sœur', 'soeurs': 'sœurs', 'coeur': 'cœur', 'coeurs': 'cœurs', 'choeur': 'chœur', 'choeurs': 'chœurs', 'oeuf': 'œuf', 'oeufs': 'œufs', 'oeuvre': 'œuvre', 'oeuvres': 'œuvres', 'boeuf': 'bœuf', 'boeufs': 'bœufs', 'oeil': 'œil', 'voeu': 'vœu', 'voeux': 'vœux', 'noeud': 'nœud', 'noeuds': 'nœuds', 'moeurs': 'mœurs', 'manoeuvre': 'manœuvre', 'manoeuvres': 'manœuvres', 'oeillet': 'œillet', 'oeillets': 'œillets', 'oesophage': 'œsophage', 'foetus': 'fœtus'}
        if low in _oel and 'œ' not in tok and 'Œ' not in tok: return ('flag', _oel[low])   # LIGATURE œ (« soeur »→« sœur »). Liste FERMÉE oe=œ → FP=0. Garde : pas de re-flag si déjà écrit avec œ. Miroir app/ext.
        if low in self.WORDS: return None                       # mot valide → ne pas toucher (couche grammaire s'en occupe)
        # nom propre : majuscule HORS début de phrase → on n'y touche pas
        if tok[:1].isupper() and not at_start: return None
        d = deacc(low)
        if not re.search(r'[aeiouy]', d): return None   # pas de voyelle → sigle/abréviation (www, qcm) — on n'invente pas
        # élision : « lannée »→« l'année », « dautres »→« d'autres » (consonne d'élision + mot voyelle/h valide)
        # DOUBLE-CONSONNE simplifiée = faute dys TRÈS fréquente (laisé→laissé, pome→pomme, carote→carotte, aporté→apporté,
        # décolé→décollé) : si doubler UNE consonne interne donne un mot COMMUN (freq≥3) qui GARDE la finale saisie →
        # restauration PRIORITAIRE (sur l'élision ET la route fréquence). Non-mots seulement (les vrais mots sont déjà sortis).
        _dblw = None; _dblf = 0.0
        for _q in range(1, len(low) - 1):
            if deacc(low[_q]) not in 'bcdfglmnprst': continue
            _cd = low[:_q + 1] + low[_q] + low[_q + 1:]
            _f = self.FREQ.get(_cd, 0.0) if _cd in self.WORDS else 0.0
            if _f >= 3.0 and _f > _dblf: _dblw = _cd; _dblf = _f
        if _dblw: return ('flag', _dblw)
        if len(low) > 2 and low[0] in ELIDE and deacc(low[1])[:1] in VOWELS:
            rest = low[1:]; cw = rest if (rest in self.WORDS and len(rest) >= 5 and self.FREQ.get(rest, 0) >= 1.0) else None   # reste COMMUN (≥5 lettres, freq≥1) sinon coïncidence nom propre/étranger (Sabu→S'abu abu/3, maven→m'aven aven/4, tai→t'ai ai/2, Mamadou amadou/0.19) → pas d'élision inventée ; « Lannée »→L'année préservé (année commun)
            if cw is None and low[0] in _ELIDE_ACC and len(rest) >= 4:   # restauration d'accent du reste (lhopital→l'hôpital, léconomi→l'économie) — préfixes SÛRS uniquement
                for w in self.D2A.get(deacc(rest), []):
                    if deacc(w)[:1] in VOWELS and self.FREQ.get(w, 0) >= 2.0 and (cw is None or self.FREQ[w] > self.FREQ.get(cw, 0)):
                        cw = w
            if cw and not (low[0] == 'c' and deacc(cw)[:1] not in 'ei'):   # « c' » seulement devant e/i (c'est, c'était)
                return ('flag', low[0] + "'" + cw)                     # élision = FLAG (sûr mais on laisse l'utilisateur valider)
        cands = self._cands(low, d)
        if not cands: return None                               # aucun voisin → néologisme/nom propre → abstention
        pk = phon_key(low)
        inp_aud = low.endswith('é')                                         # AUDIBILITÉ : l'utilisateur a écrit une finale /e/ (é) → il l'a ENTENDUE (fiable)
        cg, cn = self._ctx_gender(toks, idx), self._ctx_number(toks, idx)   # VOIE GRAMMAIRE : accord du contexte
        exp_pos = None                                                       # POS attendu (désambiguïse l'accent : élève/élevé)
        if toks and idx:
            for j in range(idx - 1, max(-1, idx - 4), -1):                   # remonte en sautant les adjectifs (une BONNE pome → nom)
                pt = deacc(toks[j].lower())
                if pt in self.DET_G or pt in self.DET_NUM: exp_pos = 'N'; break   # déterminant → nom
                if pt in self.ADVERB: exp_pos = 'A'; break                   # adverbe → adjectif (très élevé)
                if pt in self.ADJ: continue                                  # adjectif intercalé → on continue vers le déterminant
                break
        def pmatch(w):
            return 1 if (exp_pos and exp_pos in self.POS.get(w, ())) else 0
        def fin_aud(w):                                                     # finale AUDIBLE /e/ (é/ée/és/er/ez/ai…) vs -e/-es MUET
            return 1 if re.search(r'(é|ée|és|ées|er|ez|ai|ais|ait)$', w) else 0
        def gmatch(w):
            g = self._gender(w); return 1 if (cg and g and g == cg) else 0   # bonus seulement (pas de pénalité → ne casse pas fenêtre)
        def nmatch(w):
            return 1 if (cn and ((cn == 'p') == (deacc(w).endswith(('s', 'x'))))) else 0
        # tri : accent d'abord, puis POS du contexte (élève/élevé), puis accord GENRE, puis DOMINANCE (edits1 ≫ phonétique),
        #       puis phonétique, puis NOMBRE, puis fréquence. cmp (pas key) car la dominance est PAIRWISE.
        def _cmp(a, b):
            (wx, (px_, fx)), (wy, (py_, fy)) = a, b
            ax, ay = (1 if px_ == 2 else 0), (1 if py_ == 2 else 0)
            if ax != ay: return ay - ax
            qx, qy = pmatch(wx), pmatch(wy)
            if qx != qy:                                     # bonus POS gardé par la DOMINANCE de fréquence : un rival édit/accent
                if qx > qy and py_ >= 1 and fy >= 20 * fx: return 1   # ≫20× plus fréquent écrase le bonus (Lexique pollué : « trés » N
                if qy > qx and px_ >= 1 and fx >= 20 * fy: return -1  # 18/M ne doit pas battre « très » 1435/M ; « jamal » vs « jamais »)
                return qy - qx
            gx, gy = gmatch(wx), gmatch(wy)
            if gx != gy:                                     # même garde sur le bonus GENRE (entrées de genre polluées)
                if gx > gy and py_ >= 1 and fy >= 20 * fx: return 1
                if gy > gx and px_ >= 1 and fx >= 20 * fy: return -1
                return gy - gx
            if inp_aud:                                          # AUDIBILITÉ : saisie à finale /e/ écrite (é) → préférer un candidat à finale AUDIBLE
                fax, fay = fin_aud(wx), fin_aud(wy)              #   (mangé/donné) au -e MUET (mange/donne), AVANT la dominance de fréquence. Ancrer sur l'entendu.
                if fax != fay: return fay - fax
            if px_ == 1 and py_ == 0 and fx >= 10 * fy: return -1   # dominance : edits1 (tier1) ≫10× plus fréquent écrase un phonétique (tier0) — autent→autant, pas hautain
            if py_ == 1 and px_ == 0 and fy >= 10 * fx: return 1
            phx, phy = (1 if phon_key(wx) == pk else 0), (1 if phon_key(wy) == pk else 0)
            if phx != phy:                                   # AUDIBILITÉ finale muette : garde de dominance (miroir pmatch/gmatch).
                # phon_key strippe les finales muettes 'est' mais PAS 'd' → « accort »(0) phon-matche « accor », pas « accord »(975).
                # Un rival ≫20× plus fréquent (accord) écrase le phon-match d'un junk rare (accort) → restaure la finale muette -d.
                if phx > phy and py_ >= 1 and fy >= 20 * fx: return 1
                if phy > phx and px_ >= 1 and fx >= 20 * fy: return -1
                return phy - phx
            nx, ny = nmatch(wx), nmatch(wy)
            if nx != ny: return ny - nx
            return -1 if fx > fy else (1 if fx < fy else 0)
        ranked = sorted(cands.items(), key=cmp_to_key(_cmp))
        (w1, (p1, f1)) = ranked[0]
        if tok[:1].isupper() and deacc(w1) != d: return None    # mot capitalisé : SEULE la restauration d'accent (évite « Nathalie »→« natalité » : nom propre)
        # ACCORD GENRE (paire d'adjectif) : si le meilleur candidat a le mauvais genre et que sa contrepartie
        # colle au contexte ET est candidate → bascule (FLAG), même si w1 était une restauration d'accent (premiere→premier).
        if cg and 'A' in self.POS.get(w1, ()):                  # bascule réservée aux ADJECTIFS (évite nom « élève » → « élevée »)
            a = self.ADJ.get(deacc(w1))
            if a and a[0] != cg and a[1] in cands and self._gender(a[1]) == cg:
                return ('flag', a[1])
        if f1 < FLAG_FREQ: return None                          # meilleur candidat trop rare → abstention
        f2 = ranked[1][1][1] if len(ranked) > 1 else 0.0
        # AUTO : accent-only dominant (priorité 2, fréquent, sans rival proche) OU edit-1 vers un mot très dominant
        accent_only = (p1 == 2 and deacc(w1) == d)
        dominant = (f1 >= AUTO_FREQ and (f2 == 0 or f1 >= DOMINANCE * f2))
        if len(d) >= 3 and accent_only and dominant: return ('auto', w1)
        if len(d) >= 3 and p1 == 2 and f1 >= AUTO_FREQ and len([1 for _w,(p,_f) in ranked if p == 2]) == 1:
            return ('auto', w1)                                 # une seule restauration d'accent possible → sûr
        return ('flag', w1) if (len(d) >= 4 and f1 >= AUTO_FREQ) else None   # durcir : assez long ET fréquent — sinon abstention (moins, mais juste)

    def correct_text(self, text):
        text = text.replace('’', "'").replace('ʼ', "'")   # apostrophe typographique = droite (1:1)
        out = []; starts = self._sentence_starts(text)
        ms = list(TOK.finditer(text)); toks = [m.group(0) for m in ms]
        for i, m in enumerate(ms):
            r = self.correct_token(m.group(0), at_start=(m.start() in starts), toks=toks, idx=i)
            if r and r[1] != m.group(0).lower():
                sugg = r[1]
                if m.group(0)[:1].isupper() and sugg[:1].islower():   # préserver la MAJUSCULE d'origine (« Ecole »→« École », pas « école »)
                    sugg = sugg[0].upper() + sugg[1:]
                out.append((m.start(), m.group(0), sugg, r[0]))
        return out

    @staticmethod
    def _sentence_starts(text):
        st = {0}
        for m in re.finditer(r"[.!?]\s+(\S)", text):
            st.add(m.start(1))
        # 1er mot
        m0 = TOK.search(text)
        if m0: st.add(m0.start())
        return st

def main():
    if not os.path.exists(LEX): print(f"Lexique introuvable ({LEX})"); return 1
    sp = Speller()
    print(f"=== Moteur correcteur orthographique (AUTO/FLAG) ===")
    print(f"  lexique : {len(sp.WORDS)} formes | {len(sp.D2A)} clés déacc\n")
    PAIRS = [json.loads(l) for l in open(GEC, encoding='utf-8') if l.strip()]

    # (1) FAUX POSITIFS sur phrases CORRECTES — séparé AUTO (cardinal) / FLAG (tolérable)
    fpA = []; fpF = []
    for p in PAIRS:
        for (i, w, s, act) in sp.correct_text(p['good']):
            (fpA if act == 'auto' else fpF).append((w, s, p['good'][:65]))
    print(f"  [1] FAUX POSITIFS / {len(PAIRS)} phrases correctes :  AUTO={len(fpA)} (cardinal)  ·  FLAG={len(fpF)}")
    for w, s, c in fpA[:12]: print(f"        AUTO ⚠️ {w}→{s}  | {c}")
    for w, s, c in fpF[:8]:  print(f"        flag    {w}→{s}  | {c}")

    # (2) NON-MOTS corrigés sur phrases BAD (cible = 1 mot)
    import diag_sentence as D
    nw = okA = okF = 0; miss = []
    for p in PAIRS:
        flags = {i: (w, s, a) for (i, w, s, a) in sp.correct_text(p['bad'])}
        Tg, Sb = D.toks(p['good']), D.toks(p['bad'])
        for op, g, b in D.align(Tg, Sb):
            if op != 'sub' or b.lower() in sp.WORDS: continue
            if len(b) < 2 or not all(deacc(c) in ALPHA for c in b.lower()): continue
            nw += 1
            hit = next((v for v in flags.values() if v[0].lower() == b.lower()), None)
            if hit and hit[1] == g:   # comparaison EXACTE (casse comprise) : la majuscule d'origine doit être préservée (« Ecole »→« École »)
                if hit[2] == 'auto': okA += 1
                else: okF += 1
            elif len(miss) < 16: miss.append((b, g, hit[1] if hit else None))
    print(f"\n  [2] NON-MOTS (cible=1 mot) : {nw} | corrigés exactement : AUTO={okA} + FLAG={okF} = {okA+okF} ({100*(okA+okF)//max(1,nw)}%)")
    for b, g, s in miss: print(f"        {b} → {g}  | sugg={s}")
    return 0

if __name__ == '__main__':
    sys.exit(main())
