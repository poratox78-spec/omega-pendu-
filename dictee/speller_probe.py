# -*- coding: utf-8 -*-
# Moteur correcteur ORTHOGRAPHIQUE (non-mots) — 2 niveaux de confiance, mesuré sur le vrai corpus GEC.
#   AUTO  = remplace tout seul (l'app applique) : restauration d'accent NON AMBIGUË, ou typo distance-1 vers un
#           mot DOMINANT (fréquent, sans rival proche). Doit être quasi-FP=0 (change le texte en silence).
#   FLAG  = souligne (l'utilisateur clique) : candidat plausible mais incertain (rivaux, fréquence moyenne, élision).
#   None  = mot valide, ou nom propre, ou aucun bon candidat (néologisme) → on n'y touche pas.
# Ressources : Lexique4 (forme accentuée + fréquence). Phonétique = étape suivante.
import os, gzip, sys, csv, json, unicodedata, re
from collections import defaultdict
from functools import cmp_to_key

LEX = os.environ.get('LEX4', '/tmp/lex4/Lexique4.tsv')
# Frontières de proposition pour l'ANCRE DE GENRE du contexte : un relatif/conjonction entre le déterminant et
# le mot fautif = autre proposition (« un chien qui aboit »), le genre ne traverse pas. Miroir JS : SCTX_STOP.
CTX_STOP = set('qui que qu dont ou où et ni mais car donc or puis si lorsque quand comme'.split())
GEC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'corpus_gec_fr.jsonl')
ALPHA = "abcdefghijklmnopqrstuvwxyz"
ELIDE = set("lmtsndcj")                       # consonnes d'élision (l', d', m', t', s', n', c', j', qu')
_ELIDE_ACC = set("ldjcs")                      # préfixes SÛRS pour la restauration d'accent du reste (m'/t'/n' EXCLUS : « metre »=mètre≠m'être, mesuré FP)
VOWELS = set("aeiouyh")                        # le mot élidé commence par voyelle/h
AUTO_FREQ = 1.0                                # fréquence min (occ/M) pour AUTO
FLAG_FREQ = 0.1                                # fréquence min pour FLAG
KNOWN_ONLY_FREQ = 0.0                          # ⭐ CONNU MAIS JAMAIS CANDIDAT (porte EXACTE : freq 0) (02/09/2026). Un mot ajouté à fréquence 0 (gacc_lex_fr.tsv)
                                               # doit cesser d'être « inconnu » SANS entrer dans les candidats : l'A/B navigateur (1 998
                                               # phrases dys) a perdu 3 corrections JUSTES (égallement→également, tadr→tard, hitoiré→histoire)
                                               # parce que des voisins rares (égaillement, sadd, hiloire) cassaient la garde d'UNICITÉ des
                                               # candidats à distance 2. Sous ce seuil : dans WORDS, pas dans D2A. Wikt/argot/participes (0,05) intacts.
DOMINANCE = 5.0                               # rapport freq top/2e pour qu'un candidat soit "dominant" (AUTO)
# tokens courts NON-FRANÇAIS à ne JAMAIS corriger (port du produit, 04/09/2026) : mots anglais fréquents dans du
# texte FR (titres/orgs) que le speller accentuait à tort (the→thé, were→père, this→tit, that→ta, from→front,
# they→te, your→pour — 7 tirs mesurés sur les 18) + « er » = résidu d'ordinal « 1er » (le chiffre effacé laisse
# « er »→« ère »). Aucun n'entre en collision avec un mot français (mais/or/on/en/a/ni exclus). Miroir VERBATIM
# de `_SPELL_KEEP` (app + extension/dys-core.js) : le produit est VOLONTAIREMENT muet sur ces mots — la référence
# doit décrire le produit, elle corrigeait the→thé en AUTO (constat 03/09, REGLES_FR.md « FERMÉ PAR CHOIX »).
# Coût mesuré NUL : gold pipeline 402/19 STRICTEMENT identique avant/après (aucun de ces tokens dans le corpus dys).
# NB : le palier « mot inconnu » (spellUnknown JS) est porté ici depuis le 04/09/2026 : `spell_unknown`
# (action 'inconnu', OPT-IN via correct_text(..., inconnu=True) — défaut OFF, doctrine §1.6 : aucun
# consommateur existant ne change de comportement sans le demander).
SPELL_KEEP = set('the and of with is are was were this that from they you your its new world er'.split())

def deacc(s):
    s = s.replace('œ', 'oe').replace('Œ', 'OE').replace('æ', 'ae').replace('Æ', 'AE')
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

TOK = re.compile(r"[A-Za-zÀ-ÿœŒæÆ]+")          # inclut œ/æ (sinon « sœur » casse en s/ur)

def load_lexicon():
    WORDS, FREQ, DEACC2ACC, POS = set(), {}, defaultdict(list), defaultdict(set)
    # ⭐ LES AJOUTS AU FORMAT Lexique4 (wikt_lex_fr.tsv, gacc_lex_fr.tsv) SONT LUS ICI AUSSI (02/09/2026).
    # Avant : le JS embarquait Lexique4 + Wiktionnaire (214 684 formes) et la référence Python ne lisait que
    # Lexique4 (155 467) — deux lexiques pour un même speller ; la parité tolérait l'écart sur 48 cas.
    # Même source des deux côtés : la divergence ne peut plus naître de la DONNÉE, seulement du code.
    _HERE = os.path.dirname(os.path.abspath(__file__))
    # SPELLER_EXTRA=0 : base Lexique4 seule (instrument d'A/B : mesurer ce qu'un lot d'ajouts CHANGE, pas seulement ce qu'il apporte)
    _EXTRA = os.environ.get('SPELLER_EXTRA', '1') != '0'
    _SRC = [LEX] + ([os.path.join(_HERE, _a) for _a in ('wikt_lex_fr.tsv', 'argot_rows.tsv', 'participle_rows.tsv', 'gacc_lex_fr.tsv', 'morph_na_lex_fr.tsv', 'morph_ver_lex_fr.tsv.gz') if os.path.exists(os.path.join(_HERE, _a))] if _EXTRA else [])
    _H = None
    for _src in _SRC:
      with (gzip.open(_src, 'rt', encoding='utf-8') if _src.endswith('.gz') else open(_src, encoding='utf-8')) as f:   # le lot VER est commite gzippe (26,5 Mo en clair)
        r = csv.reader(f, delimiter='\t')
        if _H is None: _H = next(r)   # l'en-tête ne vit que dans Lexique4 ; les ajouts sont des lignes nues au même format
        H = _H
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
        if FREQ[w] > 0.0: DEACC2ACC[deacc(w)].append(w)   # connu-seulement (freq EXACTEMENT 0 = gacc) : jamais candidat. ≥ 0,01 retirait 26 % de la base (miroir JS fr>0)
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
        elif ch == 'x': res.append('ks')
        elif ch in 'zs': res.append('s')
        elif ch == 'y': res.append('i')
        elif ch == 'w': res.append('v')
        else: res.append(ch)
    s = ''.join(res).replace('§', '§').replace('¤', 'nj')        # gn≈nj ; ch reste distinct (§)
    out = []                                                     # collapse doublons
    for ch in s:
        if not out or out[-1] != ch: out.append(ch)
    s = ''.join(out)
    while s and s[-1] in 'est': s = s[:-1]                       # consonnes/e finales souvent muettes
    return s

def edits1(d):
    # ⚠️ ORDRE DE GÉNÉRATION, PAS UN ENSEMBLE (22/08/2026). Le classement des candidats du
    # speller (`_cmp`) est PAIRWISE (règles de dominance ≫20×/≫10×) : il n'est donc PAS un
    # ordre total — A≻B, B≻C, C≻A est possible — et le résultat d'un tri dépend alors de
    # l'ORDRE D'ENTRÉE. Avec un `set()`, cet ordre suivait le hachage : MESURÉ, 10 des 598
    # corrections du gold dys changeaient d'une exécution à l'autre (« annes »→anges ou
    # années ; « sété »→fêté ou rien du tout). Les moteurs JS (`sEdits1`) rendent
    # `Object.keys` = l'ordre de génération, eux DÉTERMINISTES : c'est donc Python qui
    # déviait, et la parité 3 moteurs n'était pas garantie sur ces cas. Un dict à ordre
    # d'insertion reproduit l'ordre de génération de JS (mêmes boucles, ALPHA = 'a'..'z').
    # ⚠️ HONNÊTETÉ SUR LA PORTÉE — MESURÉ, PAS DÉDUIT : cela rend Python REPRODUCTIBLE, ce
    # n'est PAS une parité avec l'app. Vérifié sur les 9 jetons concernés, Python et l'app
    # continuent de diverger (« annes » → ânes ici, années là ; « fise » → filé ici, fisc
    # là) parce qu'ils n'ont pas le MÊME ENSEMBLE DE CANDIDATS : Python lit `Lexique4.tsv`
    # brut (165 474 formes après filtres) quand l'app embarque `speller-lex-gz` = Lexique 4
    # + Wiktionnaire (214 685). Effet de cet écart MESURÉ sur le gold dys : 7 mots justes
    # seulement (sœur, pyrénées, technopôle, littorales, raisonnées, pnb, snk) — réel mais
    # petit, il n'invalide pas le chiffre de référence du pipeline.
    # Et ceci ne rend pas non plus le comparateur TRANSITIF — dette séparée, cf. `_cmp`.
    sp = [(d[:i], d[i:]) for i in range(len(d) + 1)]
    res = {}
    for a, b in sp:
        if b: res[a + b[1:]] = 1
        if len(b) > 1: res[a + b[1] + b[0] + b[2:]] = 1
        for c in ALPHA:
            res[a + c + b] = 1
            if b: res[a + c + b[1:]] = 1
    return list(res)

class Speller:
    DET_G = {'un':'m','une':'f','le':'m','la':'f','du':'m','au':'m','ce':'m','cet':'m','cette':'f',
             'mon':'m','ma':'f','ton':'m','ta':'f','son':'m','sa':'f','quel':'m','quelle':'f'}
    DET_NUM = {'le':'s','la':'s','un':'s','une':'s','ce':'s','cet':'s','cette':'s','mon':'s','ma':'s',
               'ton':'s','ta':'s','son':'s','sa':'s','les':'p','des':'p','ces':'p','mes':'p','tes':'p',
               'ses':'p','nos':'p','vos':'p','leurs':'p'}
    # PREUVE DE PLURIEL élargie (22/08/2026) — mesuré : sans elle le classement retombait sur la FRÉQUENCE BRUTE,
    # et la forme de base étant presque toujours plus fréquente que la fléchie, le speller enlevait la marque de
    # pluriel (« jourss »→jour, « pettits »→petit, « less »→le) que la grammaire remettait ensuite : deux erreurs
    # qui s'annulaient ou se cumulaient. Le critère `nmatch` existait déjà et était CORRECT — il n'avait jamais
    # la preuve. On n'ajoute QUE du pluriel NON AMBIGU (jamais de singulier : pas de risque nouveau).
    #   · cardinaux ≥2 : même liste et même sémantique que `CARD` de correcteur_probe (déterminant pluriel non
    #     ambigu, mesuré FP=0 à l'échelle UD) — « trois jourss », « deux seccrétaires », « vingt anse » ;
    #   · quantifieurs pluriels absents de la table (« tous less magasins », « plusieurs », « quelques »).
    # Clés DÉACCENTUÉES (`_ctx_number` compare sur deacc). Miroir app/extension.
    DET_NUM.update(dict.fromkeys(
        'deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize vingt trente '
        'quarante cinquante soixante cent cents mille tous toutes plusieurs quelques certains certaines '
        'divers diverses nombreux nombreuses differents differentes'.split(), 'p'))
    ADVERB = set('tres si trop assez bien plus tout aussi moins fort peu'.split())   # contexte adjectif
    def __init__(self):
        self.WORDS, self.FREQ, self.D2A, self.PHON, self.POS = load_lexicon()
        self.PRENOMS_L = set()                                  # prénoms en MINUSCULE (protection, cf. correct_token)
        try:
            with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'prenoms_genre.tsv'), encoding='utf-8') as _fp:
                for _l in _fp:
                    _n = _l.split('	')[0].strip().lower()
                    if len(_n) >= 3 and _n not in self.WORDS: self.PRENOMS_L.add(_n)
        except Exception:
            pass
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
    # Décalques VERBATIM de `SAUXAV`/`SSUBJP` (extension/dys-core.js, miroir app) : le POS attendu du
    # contexte les consulte depuis le 04/09/2026 (alignement de la référence sur le produit, PR #664).
    AUXAV = set("a ai as ont avons avez avait avaient aura auront aurai aurais aurait eu ete j'ai j'est j'avais j'aurai".split())
    SUBJP = set('je tu il elle on ils elles nous vous'.split())

    def _ctx_gender(self, toks, idx):
        """genre imposé par le contexte : déterminant proche, sinon nom-tête proche (≤4 tokens avant).
        Saute les copules (est/sont/semble…) : le genre d'un attribut vient du SUJET, pas du verbe
        (et « est » est un nom homographe — l'est — qui polluerait cgram_gender)."""
        if not toks or idx is None: return None
        for j in range(idx - 1, max(-1, idx - 5), -1):
            t = deacc(toks[j].lower())
            if t in self.COPULA: continue
            if t in CTX_STOP: return None                     # frontière de proposition (« un chien QUI aboit ») : le genre de « un » ne gouverne plus
            # ⛔ « UN PEU » N'EST PAS UN DÉTERMINANT (23/08, gold dys réel). « mais un peu plus chere » :
            # le `un` de « un peu » était lu comme un déterminant MASCULIN, et la bascule d'accord
            # d'adjectif retournait `chère` (qui avait pourtant GAGNÉ le classement, priorité 2) en
            # `cher`. Le mot juste était trouvé puis DÉFAIT par une ancre adverbiale.
            if t in ('peu', 'peux') or (t in self.DET_G and j + 1 < len(toks)
                                        and deacc(toks[j + 1].lower()) in ('peu', 'peux')): continue
            if t in self.DET_G: return self.DET_G[t]
            if toks[j].lower().replace('œ', 'oe').replace('æ', 'ae') not in self.WORDS: continue   # ancre de genre = un VRAI mot écrit : un token abîmé
            # ⛔ UN NOM NU NE GOUVERNE PAS LE GENRE (23/08, gold dys réel). « elle est donc mois chére » :
            # `mois` (= « moins » mal écrit, mais nom MASCULIN attesté) servait d'ancre et retournait
            # `chère` en `cher`. Un nom ne gouverne un attribut que s'il est lui-même DÉTERMINÉ ; sans
            # déterminant c'est un adverbe, un fragment, ou un mot d'une autre construction. Abstention
            # pure : on retire une ancre, on n'en ajoute aucune ⇒ le gagnant du classement est conservé.
            if t in self.GEN and not (j > 0 and deacc(toks[j - 1].lower()) in self.DET_G): continue
            g = self.GEN.get(t)
            if g: return g
        return None

    def _ctx_number(self, toks, idx):
        if not toks or idx is None: return None
        back, bdist = None, 99
        for j in range(idx - 1, max(-1, idx - 4), -1):
            t = deacc(toks[j].lower())
            if t in self.DET_NUM: back, bdist = self.DET_NUM[t], idx - j; break
        if back is not None and bdist == 1: return back      # déterminant COLLÉ = preuve la plus forte
        # PREUVE VERS L'AVANT (22/08/2026) : pour un DÉTERMINANT ou un ADJECTIF, la marque de nombre est portée
        # par le NOM QUI SUIT, pas par ce qui précède (« pettits TUYAUX », « leusr TIGES ») — sans elle le
        # classement retombait sur la fréquence brute et le speller enlevait le pluriel.
        # Restreinte au strict nécessaire pour ne créer AUCUN risque nouveau :
        #   · le token IMMÉDIATEMENT suivant seulement (pas de fenêtre) ;
        #   · ce doit être un NOM connu (tag N) au PLURIEL MORPHOLOGIQUE — le -s/-x n'est une marque que si le
        #     singulier est attesté au lexique (même test que leur/leurs : « pays »→« pay » ✗) ;
        #   · JAMAIS un mot-outil (DET_NUM exclu) : « il mangee DES pommes » ne doit pas mettre le VERBE au
        #     pluriel — c'est le piège de la symétrie, mesuré avant d'écrire la règle ;
        #   · renvoie 'p' uniquement, jamais 's' (on n'ajoute que de la preuve de pluriel).
        if idx + 1 < len(toks):
            nx = toks[idx + 1].lower().replace('œ', 'oe').replace('æ', 'ae')   # lookup sur la forme ACCENTUÉE (« écoles » est au lexique, « ecoles » non)
            if (deacc(nx) not in self.DET_NUM and nx in self.WORDS and 'N' in self.POS.get(nx, ())
                    and nx.endswith(('s', 'x'))):
                # « -aux » a DEUX singuliers possibles : cheval→chevaux (-al) ET tuyau→tuyaux (-x). Tester les deux,
                # sinon « tuyaux » est lu comme non-pluriel (défaut vu à l'œil sur « pettits tuyaux », réparé).
                for sg in ((nx[:-3] + 'al', nx[:-1]) if nx.endswith('aux') else (nx[:-1],)):
                    if sg in self.WORDS: return 'p'
        return back                                          # preuve adjacente absente → on retombe sur l'arrière

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
        # ⛔ PRÉNOM ÉCRIT EN MINUSCULE (22/08/2026) — mesuré sur le PIPELINE (`dys_pipeline_probe.py`).
        # La garde « nom propre » existante exige une MAJUSCULE hors début de phrase : elle ne protège
        # donc RIEN chez un scripteur dys, qui n'en met pas. Mesuré : « isis » → « ici ». La liste des
        # prénoms EXISTE DÉJÀ (`prenoms_genre.tsv`, 8 729 entrées, Wiktionnaire CC BY-SA, chargée par
        # les 3 moteurs pour l'accord) — on la RÉUTILISE au lieu d'en ajouter une (doctrine §5).
        # Risque quasi nul : la garde ne s'applique qu'à un token DÉJÀ inconnu du lexique de 211 k
        # formes ; qu'il soit en plus un prénom attesté en fait un nom, pas un typo.
        if low in self.PRENOMS_L: return None
        if low in SPELL_KEEP: return None      # mot anglais fréquent / résidu d'ordinal (« the »/« er ») → ni corrigé ni signalé (miroir JS _SPELL_KEEP, même position : après prénom, avant nom-propre)
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
        # POS attendu du contexte (désambiguïse l'accent : élève/élevé). ⚠️ DÉCALQUE DU PRODUIT — la
        # référence décrivait ici un AUTRE moteur que celui livré (asymétrie mesurée le 04/09/2026,
        # PR #664) : elle remontait 3 jetons en sautant les adjectifs mais ne connaissait QUE
        # déterminant→N et adverbe→A, là où les moteurs JS regardent le SEUL jeton précédent et
        # ajoutent copule→'VA' (« je suis trist »→triste) et auxiliaire/pronom-sujet→'V' (pri→pris,
        # pleu→pleut) — ajout de l'audit 07/2026 jamais porté ici. Écart mesuré : 11,7 % des jetons
        # d'UD et 14,5 % du gold recevaient un POS attendu différent, mais SEULES 9 corrections du
        # gold et 1 d'UD en changeaient. Jugées une par une contre le gold : le PRODUIT a raison 2
        # fois, l'ancienne référence 1, les deux ont tort 6 — et le produit retire un FP d'UD
        # (« ambu »→abu). On aligne donc la référence SUR LE PRODUIT (même geste que _SPELL_KEEP
        # #659 et le palier « mot inconnu » #663). Miroir : `expPos`/`pm` de extension/dys-core.js.
        exp_pos = None
        if toks and idx:
            pt = deacc(toks[idx - 1].lower())
            if pt in self.DET_G or pt in self.DET_NUM: exp_pos = 'N'       # déterminant → nom
            elif pt in self.ADVERB: exp_pos = 'A'                          # adverbe → adjectif (très élevé)
            elif pt in self.COPULA: exp_pos = 'VA'                         # copule → attribut POSSIBLE : verbe OU adjectif
            elif pt in self.AUXAV or pt in self.SUBJP: exp_pos = 'V'       # auxiliaire avoir / pronom sujet → verbe
        def pmatch(w):
            if not exp_pos: return 0
            ps = self.POS.get(w, ())
            return 1 if any(c in ps for c in exp_pos) else 0               # exp_pos peut être multi-POS ('VA')
        def fin_aud(w):                                                     # finale AUDIBLE /e/ (é/ée/és/er/ez/ai…) vs -e/-es MUET
            return 1 if re.search(r'(é|ée|és|ées|er|ez|ai|ais|ait)$', w) else 0
        def gmatch(w):
            g = self._gender(w); return 1 if (cg and g and g == cg) else 0   # bonus seulement (pas de pénalité → ne casse pas fenêtre)
        def nmatch(w):
            # Un « -s » final n'est une marque de PLURIEL que sur un NOM ou un ADJECTIF. Sur un VERBE c'est la
            # 2e personne du SINGULIER (« tu viens ») : le bonus de nombre n'a donc rien à y faire, et la preuve
            # de pluriel élargie du 22/08 le rendait atteignable. ⚠️ HONNÊTETÉ : cette garde est MESURÉE INERTE
            # sur le corpus dys réel (1 726 paires — chiffres RIGOUREUSEMENT identiques avec et sans). Elle est
            # gardée parce que le raisonnement est FAUX sans elle, pas parce qu'elle gagne quelque chose.
            # (J'avais d'abord cru qu'elle réparait « vvient »→viens : c'était faux, la FRÉQUENCE y décide de
            # toute façon — viens 736 contre vient 340.) Gains du jour préservés : les/jours/petits/secrétaires/
            # leurs/tuyaux/tiges/toutes sont tous N ou A, vérifié tag par tag.
            if not cn: return 0
            ps = self.POS.get(w, ())
            if 'V' in ps and 'N' not in ps and 'A' not in ps: return 0
            return 1 if ((cn == 'p') == (deacc(w).endswith(('s', 'x')))) else 0
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
        # ⚠️⚠️ « RENDRE `_cmp` TRANSITIF » — CONSTRUIT, MESURÉ, FALSIFIÉ (23/08/2026). NE PAS REFAIRE
        # EN L'ÉTAT. Le constat de départ est JUSTE : `_cmp` est PAIRWISE (les gardes de dominance
        # comparent deux candidats ENTRE EUX) donc ce n'est PAS un ordre total — A≻B, B≻C, C≻A est
        # possible. Mesuré en permutant l'ordre des candidats dans le moteur réel : **7 des 602
        # corrections du gold dys changent de réponse** (1,16 %).
        # La reformulation essayée : rendre les gardes PAR CANDIDAT (« ce bonus est-il écrasé par le
        # plus fréquent du lot ? ») pour obtenir une CLÉ de tri, donc un ordre total. Clé exacte
        # essayée, dans l'ordre : accent-only · pmatch∧¬écrasé · gmatch∧¬écrasé · [fin_aud si
        # inp_aud] · (prio1 ∧ freq ≥ 10× le meilleur prio0) · phon∧¬écrasé · nmatch · fréquence ·
        # départage lexical ; avec écrasé(w) = (meilleure freq prio≥1) ≥ 20 × freq(w).
        # RÉSULTAT MESURÉ (pipeline, 72 productions dys réelles) : **392 réparés / 19 cassés contre
        # 394 / 19** en pairwise — soit **2 réparations PERDUES pour zéro casse évitée**, et 13
        # décisions changées dont plusieurs franchement pires (`nape`→tape au lieu de nappe,
        # `bonbe`→bonne au lieu de bombe, `payssage`→passage au lieu de paysage, `render`/`oblier`
        # devenus des abstentions). La dominance pairwise encode donc quelque chose qu'une clé
        # par candidat ne capture pas : « ce candidat-ci est écrasé par CELUI-LÀ », pas « par le lot ».
        # ⇒ On GARDE le comparateur pairwise. La dette reste ouverte et NOMMÉE : le tri est
        # REPRODUCTIBLE (cf. `edits1`, ordre de génération) mais pas BIEN DÉFINI. Ce qui est falsifié
        # est CETTE reformulation, pas l'idée ; mais le prix mesuré (−2 réparations) contre un
        # problème qui touche 1,16 % des cas en fait un chantier à faible priorité.
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

    # ----- PALIER « MOT INCONNU » — décalque de `spellUnknown` (app + extension/dys-core.js) -----
    # Rendu : None = rien à signaler · '' = souligné SANS suggestion · 'mot' = suggestion ORANGE (au clic).
    # Palier VIGILANCE pur : il n'APPLIQUE jamais rien — hors FP=0 par construction (le texte ne change pas).
    # ENQUÊTE 04/09/2026 (88 fautes réelles à ce palier, sur 1 140 ratés du pipeline) : la cause dominante
    # d'absence de suggestion est la distance d'édition ≥ 2 (83/90), PAS les gardes. La voie '' est donc
    # équipée par deux générateurs (mêmes pools, zéro asset nouveau) : S6 ÉLISION puis S4 CLÉ PHONÉTIQUE
    # À DISTANCE 1. Mesuré (population de l'enquête) : top-1 32/88 · propose sur 60/88 · UD ~33/96 mots
    # inconnus équipés (fatigue DERRIÈRE le clic, AUCUNE marque nouvelle) · coût ~0 ms.
    # ÉCARTÉS par l'enquête, ne pas rebrancher sans nouvelle mesure : S1 edit-2 (104 ms/token, 60 % de
    # fatigue UD) · S5 mot-collé (2 vrais cas seulement).

    def _su_elision(self, low):
        """S6 — élision oubliée : « dargen »→d'argent, « listoir »→l'histoire, « léconomi »→l'économie.
        Tête d'élision (ELIDE + qu') + RESTE corrigé par les pools de spellUnknown (D2A > phon > edits1),
        initiale voyelle/h et fréquence ≥ FLAG_FREQ exigées. Miroir JS : _suElision."""
        heads = []
        if low[:1] in ELIDE and len(low) >= 4: heads.append((low[0], low[1:]))
        if low[:2] == 'qu' and len(low) >= 5: heads.append(('qu', low[2:]))
        for h, rest in heads:
            dr = deacc(rest)
            hits = {}
            for w in self.D2A.get(dr, []): hits.setdefault(w, (2, self.FREQ.get(w, 0)))
            for w in self.PHON.get(phon_key(rest), []):
                if abs(len(deacc(w)) - len(dr)) <= 2: hits.setdefault(w, (1, self.FREQ.get(w, 0)))
            for e in edits1(dr):
                for w in self.D2A.get(e, []): hits.setdefault(w, (0, self.FREQ.get(w, 0)))
            for w in sorted(hits, key=lambda x: (-hits[x][0], -hits[x][1])):
                if deacc(w)[:1] in VOWELS and self.FREQ.get(w, 0) >= FLAG_FREQ:
                    return h + "'" + w
        return None

    def _su_phon_e1(self, low):
        """S4 — presque-homophone : edits1 appliqué à la CLÉ phonétique, lookup PHON, classement
        fréquence (« luiil »→lui, « bégnier »→baigner, « ésituron »→hésiteront). Miroir JS : _suPhonE1.
        (PHON ne contient que des formes de fréquence ≥ FLAG_FREQ — filtre déjà dans load_lexicon.)"""
        hits = {}
        for e in edits1(phon_key(low)):
            for w in self.PHON.get(e, []): hits.setdefault(w, self.FREQ.get(w, 0))
        best, bf = None, -1.0
        for w, f in hits.items():
            if f > bf: best, bf = w, f
        return best

    def spell_unknown(self, tok, at_start=False, toks=None, idx=None):
        """-> None | '' (souligné sans suggestion) | suggestion (orange AU CLIC, jamais appliquée)."""
        low = tok.lower().replace('œ', 'oe').replace('æ', 'ae')
        if len(low) < 3 or not all(deacc(c) in ALPHA for c in low): return None
        if low in self.WORDS or deacc(low) in self.WORDS: return None       # mot connu (ou connu sans accents)
        if low == 'ête': return None            # réservé à la règle grammaire (rEteEtre) — miroir du court-circuit spellText
        if low in SPELL_KEEP: return None       # mot anglais fréquent / résidu d'ordinal → ni corrigé ni signalé
        if tok[:1] != tok[:1].lower(): return None    # majuscule → possible nom propre, même en début de phrase (prudence)
        if tok == tok.upper() and len(tok) >= 2: return None                # acronyme tout-capitale
        d = deacc(low)
        if not re.search(r'[aeiouy]', d) or re.fullmatch(r'[ivxlcdm]+', d): return None   # sigle sans voyelle / chiffre romain
        # candidat best-effort (accents + phonétique + édit-1) : homophone > audibilité > fréquence, non-homophone filtré à l'initiale
        arr = list(self.D2A.get(d, []))
        arr += list(self.PHON.get(phon_key(low), []))
        for e in edits1(d):
            arr += self.D2A.get(e, ())
        iaU = low.endswith('é')
        pk = phon_key(low)
        best, bh, ba, bf = None, -1, -1, -1.0
        for w in arr:
            hm = 1 if phon_key(w) == pk else 0
            if not hm and deacc(w)[:1] != d[:1]: continue
            au = 1 if (iaU and re.search(r'(é|ée|és|ées|er|ez|ai|ais|ait)$', w)) else 0
            fq = self.FREQ.get(w, 0)
            if hm > bh or (hm == bh and (au > ba or (au == ba and fq > bf))):
                bh, ba, bf, best = hm, au, fq, w
        if best and toks and idx is not None and idx + 1 < len(toks):
            # DÉTERMINANT : le genre du NOM SUIVANT domine la fréquence (« uen maison »→une) — miroir JS
            dp2 = {'un': 'une', 'une': 'un', 'le': 'la', 'la': 'le', 'ce': 'cette', 'cette': 'ce', 'cet': 'cette'}.get(deacc(best))
            if dp2 and deacc(best) in self.DET_G:
                nw2 = toks[idx + 1].lower().replace('œ', 'oe').replace('æ', 'ae')
                if nw2 in self.WORDS:
                    ng2 = self._gender(nw2)
                    if ng2 and ng2 != self.DET_G[deacc(best)] and self.DET_G.get(deacc(dp2)) == ng2:
                        if sorted(deacc(low)) == sorted(deacc(dp2)) or deacc(dp2) in edits1(deacc(low)):
                            best = dp2
        if best and best != low: return best
        # VOIE '' (inconnu sans suggestion fiable) : S6 élision PRIORITAIRE, puis S4 clé phonétique d=1
        g = self._su_elision(low) or self._su_phon_e1(low)
        return g if (g and g != low) else ''

    def correct_text(self, text, inconnu=False):
        """inconnu=True (OPT-IN, défaut OFF) : ajoute le palier « mot inconnu » (action 'inconnu') sur
        les tokens que la voie correction laisse muets — comme la chaîne vigilance de spellText (JS)."""
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
            elif inconnu:
                u = self.spell_unknown(m.group(0), at_start=(m.start() in starts), toks=toks, idx=i)
                if u is not None:
                    out.append((m.start(), m.group(0), u, 'inconnu'))
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

    # (3) PALIER « MOT INCONNU » (spell_unknown, décalque JS — enquête 04/09/2026) : cas gagnés + témoins.
    #     Orange AU CLIC, jamais appliqué → hors FP=0 ; la parité 3 moteurs est gardée par parity_speller.
    su_fail = []
    for t, exp in [('dargen', "d'argent"), ('léconomi', "l'économie"), ('bégnier', 'baigner'), ('ésituron', 'hésiteront')]:
        got = sp.spell_unknown(t)
        if got != exp: su_fail.append(f"{t} → {exp!r} attendu, eu {got!r}")
    for t in ('delbrueckii', 'bulgaricus'):     # témoins : sans candidat du cadre → '' (souligné SANS suggestion, on n'invente pas)
        got = sp.spell_unknown(t)
        if got != '': su_fail.append(f"témoin {t} → '' attendu (pas d'invention), eu {got!r}")
    if sp.spell_unknown('fenêtre') is not None: su_fail.append("mot CONNU « fenêtre » signalé (doit rendre None)")
    if sp.spell_unknown('Nathalie') is not None: su_fail.append("majuscule « Nathalie » signalée (nom propre, doit rendre None)")
    print(f"\n  [3] PALIER « mot inconnu » (spell_unknown) : {'OK' if not su_fail else 'ÉCHEC'}")
    for x in su_fail: print(f"        ✗ {x}")

    # (4) CAS FONDATEURS DE LA GARDE DE DOMINANCE — ils n'étaient gardés par RIEN (04/09/2026).
    #     Ces cinq corrections sont la RAISON D'ÊTRE des gardes de dominance de `_cmp` : un rival
    #     beaucoup plus fréquent doit écraser le bonus (POS/genre/phon) d'un junk rare du lexique.
    #     Vécu le 04/09 : une variante d'assouplissement les a cassées (« chein »→chin) avec dev.sh
    #     ENTIÈREMENT VERT — aucune batterie ne les regardait, seuls des commentaires les citaient.
    #     Toute retouche de `_cmp` doit passer ici. Sortie DURE (comme [3]).
    dom_fail = []
    for phrase, tok, exp in [('un chein noir', 'chein', 'chien'),
                             ('accor parfait', 'accor', 'accord'),
                             ('je suis tres content', 'tres', 'très'),
                             ('jamai de la vie', 'jamai', 'jamais'),
                             ('autent que possible', 'autent', 'autant')]:
        got = {w: sg for (i, w, sg, a) in sp.correct_text(phrase)}.get(tok)
        if got != exp: dom_fail.append('%s -> %r attendu, eu %r   (phrase : %r)' % (tok, exp, got, phrase))
    print('')
    print('  [4] CAS FONDATEURS de la dominance : %s' % ('OK' if not dom_fail else 'ÉCHEC'))
    for x in dom_fail: print('        ✗ %s' % x)
    return 1 if (su_fail or dom_fail) else 0

if __name__ == '__main__':
    sys.exit(main())
