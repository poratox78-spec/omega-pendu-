# -*- coding: utf-8 -*-
# Génère la connaissance lexicale grammaticale pour le correcteur/diagnostic (route LEXICALE de la double voie) :
#   - dictee/cgram_verbs.json  : couverture VERBALE complète (vlike) — étape 3.
#   - dictee/cgram_gender.json : carte FORME→genre des NOMS (genre non ambigu) — route lexicale du GENRE.
# Remplace les listes/heuristiques stopgap par les vraies catégories de Lexique 4 (colonnes 5_Cgram, 7_Genre).
#
# ⚠️ Le Lexique4.tsv (34 Mo, 188 863 mots) est HORS-REPO (Drive de Rem). Ce script l'attend en
#    /tmp/lex4/Lexique4.tsv (cf. CLAUDE.md) ; adapter LEX_PATH au besoin. Tant que le fichier n'est
#    pas là, le correcteur utilise sa liste blanche (vlike) — ce script est le branchement prêt à l'emploi.
#
# Robustesse : on repère les colonnes par NOM d'en-tête (cgram / Mot / Freq) — pas par index figé —
# car Lexique 4 a 37 colonnes au nommage « N_Nom ».
# Lancer (lexique présent) : python3 dictee/build_cgram.py
import os, sys, json, csv, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
LEX_PATH = os.environ.get('LEX4', '/tmp/lex4/Lexique4.tsv')
OUT = os.path.join(HERE, 'cgram_verbs.json')
OUT_GENDER = os.path.join(HERE, 'cgram_gender.json')
OUT_ADJ = os.path.join(HERE, 'cgram_adj.json')         # adjectifs : paires de genre (vert↔verte)
OUT_CONJ = os.path.join(HERE, 'cgram_conj.json')       # table de conjugaison (accord SUJET-VERBE : forme↔personne/nombre)
OUT_HF = os.path.join(HERE, 'cgram_hf.json')           # sous-ensemble haute-fréquence embarquable dans l'app
FREQ_MIN = float(os.environ.get('FREQ_MIN', '0.5'))   # garde les formes pas trop rares (taille raisonnable)
HF_FREQ = float(os.environ.get('HF_FREQ', '5'))        # seuil du sous-ensemble embarquable (par million, FreqOrtho)

# Accord sujet-verbe : on n'exploite que les modes à SUJET (imp = impératif sans pronom → écarté).
# `9_InfoVER` donne mode:temps:personne ; `8_Nombre` donne le nombre (la personne d'InfoVER n'a pas le nombre).
FINITE = {'ind', 'sub', 'cnd'}
PART_END = ('é', 'és', 'ée', 'ées')   # participes mal tagués « présent » (j'ai joué → ind:pre:1) : écartés des slots présents
# Mots-outils (PRÉPOSITIONS) qui sont aussi des formes verbales RARES (entrer/contrer) → exclus de la table de
# RECONNAISSANCE conj : sinon « entre l'UFE et les universités… »→entrent = FP sur UD (mesuré : entre ×6, contre ×3).
# On perd « il entre »→entrent (très rare) pour préserver le FP-safety. PAS « a » (= avoir, essentiel à on/ont, a/à).
CONJ_STOP = {'entre', 'contre'}


def deacc(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


def derive_number(form_lw, per):
    """Nombre déduit de la morphologie quand 8_Nombre est vide (fréquent au présent : « travaille », « chantent »).
    Sûr : -ons/-ez = pluriel (1p/2p) ; 3e pers. -ent/-ont LONG non -ient = pluriel régulier (chantent, dorment) ;
    3e pers. -ient ou forme courte (≤5) = AMBIGU (vient/ment 3sg ↔ rient 3pl) → 'x' (wildcard, pas de FP) ;
    sinon singulier. Les seules erreurs (passé simple 1p/2p) ne touchent que nous/vous (exclus du correcteur)."""
    if form_lw.endswith('ons') or form_lw.endswith('ez'):
        return 'p'
    if per == '3' and (form_lw.endswith('ent') or form_lw.endswith('ont')):
        if form_lw.endswith('ient') or len(form_lw) <= 5:   # vient/tient (3sg), ment/sent (3sg) → ambigu
            return 'x'
        return 'p'                                            # chantent, dorment, racontent… = pluriel régulier
    return 's'


def find_col(header, *needles):
    """Index de la 1re colonne dont le nom (minuscule) contient l'une des aiguilles."""
    low = [h.lower() for h in header]
    for nd in needles:
        for k, h in enumerate(low):
            if nd in h:
                return k
    return -1


def main():
    if not os.path.exists(LEX_PATH):
        print(f"[cgram] Lexique4 introuvable ({LEX_PATH}).")
        print("        Le correcteur reste sur sa liste blanche (vlike). Place le .tsv et relance.")
        return 1
    with open(LEX_PATH, encoding='utf-8') as f:
        rdr = csv.reader(f, delimiter='\t')
        header = next(rdr)
        c_mot = find_col(header, 'mot')                 # 1_Mot (forme fléchie)
        c_lemme = find_col(header, 'lemme')              # 4_Lemme
        c_gram = find_col(header, 'cgram', 'gram')       # 5_Cgram : catégorie grammaticale
        c_genre = find_col(header, 'genre')              # 7_Genre : m / f
        c_nombre = find_col(header, 'nombre')            # 8_Nombre : s / p
        c_info = find_col(header, 'infover', 'info')     # 9_InfoVER : mode:temps:personne (CSV)
        c_freq = find_col(header, 'freqortho', 'freqfilms', 'freq')
        c_homoph = find_col(header, 'nbhomoph')          # 24_NbHomoph : garde-fou FP (mot à homophones → abstention)
        c_preval = find_col(header, 'preval')            # 33_Preval : prévalence % (mot rare/inconnu → abstention)
        if min(c_mot, c_gram) < 0:
            print(f"[cgram] colonnes introuvables (mot={c_mot}, cgram={c_gram}). En-tête : {header[:8]}…")
            return 2
        verbs = {}                                       # forme VER → fréquence max
        n = 0
        allwords = {}                                    # INVENTAIRE COMPLET : forme_déacc → fréquence max (reconnaissance : ne jamais flaguer un vrai mot)
        det = {}                                          # DÉTERMINANTS genrés : forme_déacc → genre (closed-class fiable)
        guard_homoph = set()                              # garde-fou : formes à ≥2 homophones (abstention)
        guard_lowprev = {}                                # forme_déacc → prévalence (mots peu connus)
        # déterminants closed-class fiables (Lexique tague mal « le=NOM, la=ADJ:m » : on fige la table sûre)
        DET_GENDER = {'un':'m','une':'f','le':'m','la':'f','du':'m','au':'m','ce':'m','cet':'m','cette':'f',
                      'mon':'m','ma':'f','ton':'m','ta':'f','son':'m','sa':'f','quel':'m','quelle':'f'}
        gset = {}                                        # forme NOM → {genres vus} (écarte l'ambigu)
        gfreq = {}                                       # forme NOM → fréquence max
        nom_lem_g = {}                                    # lemme → {genres nets} : hériter le genre des formes à genre VIDE (Lexique4)
        nom_empty = []                                    # (forme_déacc, lemme_déacc) des NOMs à genre VIDE → complétés par héritage de lemme
        adjp = {}                                         # (lemme, nombre) → {'m':forme_acc, 'f':forme_acc}
        adjg = {}                                         # déacc(forme ADJ) → {genres vus} (écarte l'ambigu)
        adjfreq = {}                                      # déacc(forme ADJ) → fréquence max
        cj_f = {}                                          # forme_déacc → {"lemme;mode:temps;pers;nombre"} (toutes lectures finies)
        cj_c = {}                                          # lemme → mode:temps → slot(« 3s ») → (forme_acc, freq, spécificité)
        cj_x = {}                                          # 3e pers. AMBIGUË (vient/rient) → lemme → mt → [(forme,freq,spéc)] (promotion 3s ci-dessous)
        inf_acc = {}                                       # lemme → infinitif ACCENTUÉ (pour dériver le 3s des -er réguliers rares)
        for row in rdr:
            if len(row) <= max(c_mot, c_gram):
                continue
            cg = row[c_gram].strip().upper()
            w = deacc(row[c_mot].strip().lower())
            if not (w and all('a' <= ch <= 'z' for ch in w)):
                continue
            fr = 0.0
            if c_freq >= 0 and c_freq < len(row):
                try: fr = float((row[c_freq] or '0').replace(',', '.'))
                except ValueError: pass
            # INVENTAIRE COMPLET (toutes catégories, toutes fréquences) : reconnaissance, ne pas flaguer un vrai mot
            allwords[w] = max(allwords.get(w, 0.0), fr)
            # garde-fous FP (colonnes natives Lexique)
            if c_homoph >= 0 and c_homoph < len(row):
                try:
                    if int((row[c_homoph] or '0').strip() or 0) >= 2: guard_homoph.add(w)
                except ValueError: pass
            if c_preval >= 0 and c_preval < len(row):
                pv = (row[c_preval] or '').strip().replace(',', '.')
                if pv:
                    try: guard_lowprev[w] = min(guard_lowprev.get(w, 100.0), float(pv))
                    except ValueError: pass
            # déterminants genrés (closed-class fige, Lexique trop bruité sur ces mots-outils)
            if w in DET_GENDER:
                det[w] = DET_GENDER[w]
            if cg.startswith('VER'):                       # VER = verbe. être/avoir double-taggés VER+AUX → déjà couverts.
                if fr >= FREQ_MIN:                          # vlike (couverture verbale) garde le seuil de fréquence
                    verbs[w] = max(verbs.get(w, 0.0), fr); n += 1
                # BESCHERELLE : la table de conjugaison ci-dessous est construite pour TOUTES les formes (SANS seuil) —
                # « détestons » (1pl, freq<0.5) est nécessaire à l'accord de PERSONNE bien que rare → paradigmes COMPLETS.
                # table de conjugaison (accord sujet-verbe) — lectures finies à sujet (ind/sub/cnd)
                if c_info >= 0 and c_info < len(row) and c_lemme >= 0 and w not in CONJ_STOP:
                    form = row[c_mot].strip(); form_lw = form.lower()
                    lem = deacc(row[c_lemme].strip().lower())
                    nb = row[c_nombre].strip().lower()[:1] if 0 <= c_nombre < len(row) else ''
                    nb = nb if nb in ('s', 'p') else ''                     # '' = à déduire de la morphologie
                    is_inf = (w == lem)                                      # forme = lemme → INFINITIF (ses tags finis = artefacts Lexique « chanter:ind:pre:2 ») → écarté
                    if is_inf:
                        inf_acc.setdefault(lem, form)                        # infinitif accentué mémorisé (dérivation 3s des -er réguliers)
                    fin = []
                    for tag in row[c_info].split(','):
                        pp = tag.split(':')
                        # BESCHERELLE durci : SEUL l'indicatif PRÉSENT + IMPARFAIT (les temps de l'accord SV courant) —
                        # exclut passé simple/futur/subj/cnd (homographes rares « tentèrent/fut/appris→apprit » = FP UD).
                        if len(pp) == 3 and pp[0] == 'ind' and pp[1] in ('pre', 'imp') and pp[2] in ('1', '2', '3'):
                            fin.append((pp[0] + ':' + pp[1], pp[2]))
                    spec = len(fin)                                          # moins de tags = forme plus spécifique (fiable)
                    is_part = form_lw.endswith(PART_END)
                    if not is_inf and not is_part:                          # exclut les PARTICIPES (déployé/donnés = participe/adj, pas verbe SV → FP)
                        for mt, per in fin:
                            # Nombre PUREMENT morphologique en 1re/2e pers. (-ons/-ez=pluriel, sinon sing.) ET en 3e pers.
                            # -ent/-ont (long -ent = pluriel régulier). La colonne 8_Nombre de Lexique est FAUSSE pour beaucoup
                            # (« veux »/« finis » sing. tagués plur. ; « viennent » plur. tagué sing.) → on la contourne là où
                            # la morphologie tranche. Le -ient/-ent COURT reste 'x' (vient 3sg ↔ rient 3pl) → promu en 3s plus bas.
                            if per == '3' and (form_lw.endswith('ent') or form_lw.endswith('ont')):
                                # 3e pers. -ent/-ont : ambiguë 3sg↔3pl (il consent ↔ ils chantent/consentent) → DIFFÉRÉE.
                                # Sa lecture cj_f est posée par la RÉSOLUTION (3p/3s exact, par longueur), PAS 'x' : sinon
                                # « ont »/« sont » agréeraient à tort avec un sujet 3sg (« il ont »→a ne serait plus détecté).
                                cj_x.setdefault(lem, {}).setdefault(mt, []).append((form, fr, spec))
                                continue
                            nn = derive_number(form_lw, per) if per in ('1', '2') else (nb or derive_number(form_lw, per))
                            cj_f.setdefault(w, set()).add(f"{lem};{mt};{per};{nn}")
                            if nn in ('s', 'p'):
                                slot = per + nn; d = cj_c.setdefault(lem, {}).setdefault(mt, {})
                                if slot not in d or (spec, -fr) < (d[slot][2], -d[slot][1]):   # min spécificité, puis max fréq
                                    d[slot] = (form, fr, spec)
            if cg.startswith('NOM'):
                g = row[c_genre].strip().lower() if (0 <= c_genre < len(row)) else ''
                lem = deacc(row[c_lemme].strip().lower()) if (0 <= c_lemme < len(row)) else ''
                if g in ('m', 'f'):                       # genre marqué dans le lexique
                    gset.setdefault(w, set()).add(g)
                    gfreq[w] = max(gfreq.get(w, 0.0), fr)
                    if lem: nom_lem_g.setdefault(lem, set()).add(g)   # le lemme retient les genres nets de ses formes
                elif g == '' and lem:                     # genre STRICTEMENT vide ('') : donnée manquante → hérité du lemme ci-dessous (soeur/oeuf/oeil).
                    nom_empty.append((w, lem))            #   'e' (ÉPICÈNE : un/une élève) = IGNORÉ, comme l'ancien build — jamais de genre unique (FP=0).
            if cg.startswith('ADJ') and min(c_genre, c_lemme, c_nombre) >= 0 and max(c_genre, c_lemme, c_nombre) < len(row):
                g = row[c_genre].strip().lower(); nb = (row[c_nombre].strip().lower()[:1] or '')
                if g in ('m', 'f') and nb in ('s', 'p'):
                    lem = deacc(row[c_lemme].strip().lower())
                    adjp.setdefault((lem, nb), {})[g] = row[c_mot].strip().lower()   # forme accentuée (pour la suggestion)
                    adjg.setdefault(w, set()).add(g); adjfreq[w] = max(adjfreq.get(w, 0.0), fr)
    out = sorted(verbs)
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f"[cgram] {len(out)} formes verbales (sur {n} lignes VER, freq≥{FREQ_MIN}) → {OUT}")

    # SEED des IRRÉGULIERS rares que Lexique n'atteste pas en 1re/2e pers. sing. — table de référence VÉRIFIÉE
    # (conjugaison standard ; 1s = 2s pour tous). Les autres (défectifs/impersonnels : falloir, pleuvoir, seoir,
    # sourdre, braire, raire, bruire, éclore, s'ensuivre, messeoir) n'ont PAS de « je/tu » → absents à dessein (preuve).
    _SEED_SG = {
        'advenir': 'adviens', 'survenir': 'surviens', 'suivre': 'suis', 'vetir': 'vêts', 'devetir': 'dévêts',
        'croitre': 'croîs', 'decroitre': 'décroîs', 'ceindre': 'ceins', 'enceindre': 'enceins', 'empreindre': 'empreins',
        'circoncire': 'circoncis', 'confire': 'confis', 'induire': 'induis', 'epandre': 'épands',
        'enquerir': 'enquiers', 'rementir': 'remens', 'clore': 'clos', 'enclore': 'enclos',
    }
    for _lem, _sg in _SEED_SG.items():
        _pres = cj_c.setdefault(_lem, {}).setdefault('ind:pre', {})
        for _slot in ('1s', '2s'):
            if _slot not in _pres:
                _pres[_slot] = (_sg, 0.0, 97)
                cj_f.setdefault(deacc(_sg.lower()), set()).add(f"{_lem};ind:pre;{_slot[0]};s")

    # RÉSOLUTION 3s/3p des formes 3e pers. en -ent/-ont (différées en 'x' : ambiguës 3sg↔3pl). Par lemme : la PLUS
    # LONGUE = 3p (chantent, consentent, viennent) ; une STRICTEMENT plus courte = 3s (consent, vient). Tôt (avant la
    # dérivation -er) pour que le 3p soit dispo. Idempotente. FP-safe : « rient » (seule forme, rire) ne devient jamais un 3s.
    for _lem, _xd in cj_x.items():
        _xs = _xd.get('ind:pre')
        if not _xs:
            continue
        _pres = cj_c.setdefault(_lem, {}).setdefault('ind:pre', {})
        _uniq = sorted({f for f, _fr, _sp in _xs}, key=len)
        _long = _uniq[-1]
        if '3p' not in _pres:
            _pres['3p'] = (_long, 0.0, 96)
            cj_f.setdefault(deacc(_long.lower()), set()).add(f"{_lem};ind:pre;3;p")
        if '3s' not in _pres and len(_uniq) >= 2 and _uniq[0] != _long:
            _pres['3s'] = (_uniq[0], 0.0, 96)
            cj_f.setdefault(deacc(_uniq[0].lower()), set()).add(f"{_lem};ind:pre;3;s")

    # 3s des -er RÉGULIERS rares non attestés (« accole », « acidifie ») : dérivé de l'infinitif ACCENTUÉ
    # (accoler→accole, créer→crée). EXCLUS les -er à radical changeant (appeler→appelle, mener→mène, payer→paie, aérer→
    # aère…) — non dérivables du seul infinitif → abstention. Débloque ensuite 1s/2s/3p (boucle régulière ci-dessous).
    def _er_stem_change(l):
        if l.endswith(('eler', 'eter', 'yer')):
            return True
        return len(l) >= 4 and l[-4] == 'e' and l[-3] in 'bcdfghjklmnpqrstvz' and l.endswith('er')
    _s3er = 0
    for _lem in list(cj_c.keys()):
        _pres = cj_c[_lem].get('ind:pre')
        if _pres is None or '3s' in _pres or not _lem.endswith('er') or _lem == 'aller':
            continue
        _f = None
        if '2s' in _pres:                                       # 2s partage le radical TONIQUE du 3s (appelles→appelle) → sûr même à radical changeant, accent préservé
            _f = _pres['2s'][0][:-1]
        elif not _er_stem_change(_lem):                         # radical STABLE → 3s dérivable de n'importe quelle forme attestée (accent préservé)
            if _lem in inf_acc:
                _f = inf_acc[_lem][:-1]                         # accoler→accole, créer→crée
            elif '2p' in _pres and _pres['2p'][0].endswith('ez'):
                _f = _pres['2p'][0][:-2] + 'e'                  # bariolez→bariole
            elif '1p' in _pres and _pres['1p'][0].endswith('ons'):
                _f = _pres['1p'][0][:-3] + 'e'                  # bariolons→bariole
            elif '3p' in _pres and _pres['3p'][0].endswith('ent'):
                _f = _pres['3p'][0][:-3] + 'e'                  # bariolent→bariole
        if _f:
            _pres['3s'] = (_f, 0.0, 95)
            cj_f.setdefault(deacc(_f.lower()), set()).add(f"{_lem};ind:pre;3;s")
            _s3er += 1

    # COMPLÉTION DE PARADIGME PRÉSENT (verbes RÉGULIERS) — Lexique n'atteste pas toujours « je/tu » des verbes rares
    # (« tu adoubes »). Pour un -er régulier (hors « aller ») la forme est DÉTERMINISTE : 1s = 3s, 2s = 3s+s ; pour un
    # -ir 2e groupe (3s en -it) : 1s = 2s = 3s sans -t, +s (finit→finis). On reconstruit ces cases manquantes — une
    # faute reste une faute même sur un verbe rare. JAMAIS les irréguliers (-re/-oir/-ir 3e groupe), où fabriquer la
    # forme serait une FAUSSE suggestion (abstention > erreur). Les formes reconstruites vont aussi dans cj_f (lectures)
    # pour passer l'auto-vérification de rule_accord_sv. spec=99 (priorité minimale) : une vraie forme Lexique l'emporte.
    _fill = 0
    for _lem, _mts in cj_c.items():
        _pres = _mts.get('ind:pre')
        if not _pres or '3s' not in _pres:
            continue
        _f3 = _pres['3s'][0]
        _der = {}
        if _lem.endswith('er') and _lem != 'aller' and _f3.endswith('e'):
            _der = {'1s': _f3, '2s': _f3 + 's', '3p': _f3 + 'nt'}          # parle → parles, parlent
        elif _lem.endswith('ir') and _f3.endswith('it'):
            _s = _f3[:-1] + 's'
            _der = {'1s': _s, '2s': _s, '3p': _f3[:-1] + 'ssent'}          # finit → finis, finissent
        for _slot, _form in _der.items():
            if _slot not in _pres:
                _pres[_slot] = (_form, 0.0, 99)
                cj_f.setdefault(deacc(_form.lower()), set()).add(f"{_lem};ind:pre;{_slot[0]};{_slot[1]}")
                _fill += 1
    # RÉSOLUTION 3s/3p des formes 3e pers. en -ent/-ont (différées en 'x' car ambiguës 3sg↔3pl). Par lemme : la forme la
    # PLUS LONGUE = 3p (chantent, consentent, viennent) ; une forme STRICTEMENT plus courte = 3s (consent, vient). Si une
    # seule forme (rient) → 3p par défaut, le 3s reste éventuellement une forme non-ent déjà slottée (rit). FP-safe : on
    # ne tranche 3s que quand la longueur départage réellement ; « rient » (rire) ne devient JAMAIS un 3s inventé.
    _p3 = 0
    for _lem, _xd in cj_x.items():
        _xs = _xd.get('ind:pre')
        if not _xs:
            continue
        _pres = cj_c.setdefault(_lem, {}).setdefault('ind:pre', {})
        _uniq = sorted({f for f, _fr, _sp in _xs}, key=len)
        _long = _uniq[-1]
        if '3p' not in _pres:
            _pres['3p'] = (_long, 0.0, 96)
            cj_f.setdefault(deacc(_long.lower()), set()).add(f"{_lem};ind:pre;3;p")
            _p3 += 1
        if '3s' not in _pres and len(_uniq) >= 2 and _uniq[0] != _long:
            _pres['3s'] = (_uniq[0], 0.0, 96)
            cj_f.setdefault(deacc(_uniq[0].lower()), set()).add(f"{_lem};ind:pre;3;s")
            _p3 += 1

    # COMPOSÉ → BASE : un préfixé se conjugue EXACTEMENT comme sa base (advenir←venir, démettre←mettre, élire←lire).
    # Pour un verbe encore incomplet, on cherche le PLUS LONG verbe-base (déjà complet en 1s+2s) qui est un suffixe du
    # lemme ET dont le 3s préfixé reconstitue le 3s du composé → on copie ses 1s/2s avec le même préfixe (accentué,
    # relu sur les FORMES). Autoritatif : ce sont les formes réelles de la base (Lexique), pas une invention.
    def _cx(v):   # itère : passe base tant que ça remplit (une base fraîchement complétée en débloque d'autres)
        n = 0
        bases = sorted([l for l, m in cj_c.items() if {'1s', '2s', '3s'} <= set(m.get('ind:pre', {}))], key=len)
        for _lem, _mts in cj_c.items():
            _pres = _mts.get('ind:pre')
            if not _pres or '3s' not in _pres or {'1s', '2s', '3p'} <= set(_pres):
                continue
            _l3 = _pres['3s'][0]; _dl3 = deacc(_l3.lower())
            for _b in reversed(bases):
                if _b == _lem or len(_b) < 4 or not _lem.endswith(_b):
                    continue
                _bp = cj_c[_b]['ind:pre']; _b3 = _bp['3s'][0]; _db3 = deacc(_b3.lower())
                if not _dl3.endswith(_db3):
                    continue
                _pref = _l3[:len(_l3) - len(_b3)]
                if deacc((_pref + _b3).lower()) != _dl3:
                    continue
                for _slot in ('1s', '2s', '3p'):
                    if _slot not in _pres and _slot in _bp:
                        _form = _pref + _bp[_slot][0]
                        _pres[_slot] = (_form, 0.0, 98)
                        cj_f.setdefault(deacc(_form.lower()), set()).add(f"{_lem};ind:pre;{_slot[0]};{_slot[1]}")
                        n += 1
                break
        return n
    _cx_total = 0
    while True:
        _k = _cx(0)
        _cx_total += _k
        if not _k:
            break
    print(f"[conj] complétion : +{_fill} régulières (-er/-ir) + {_cx_total} composées (base) reconstruites")

    # ─── CROISEMENT LEFFF (validation indépendante du présent) ─── OPTIONNEL : données LEFFF hors-repo (LGPL-LR ; INRIA).
    # LEFFF (~500k formes) est INDÉPENDANT de Lexique 4 → on CROISE l'indicatif présent : on CORRIGE nos formes là où LEFFF
    # (autoritaire) diverge — surtout les confusions de personne dues à la colonne 8_Nombre de Lexique (« dites » rangé en
    # 2s au lieu de 2p, « entres » en 1s…) — et on COMBLE les trous des lemmes que LEFFF couvre (radicaux changeants exclus
    # de la dérivation : budgeter→budgète…). Filtre anti-bruit : la forme LEFFF doit démarrer comme le lemme (écarte
    # « raller→rva »). Les formes conjuguées sont des FAITS ; lecture seule ; attribution LEFFF (voir NOTICE).
    _LEFFF = os.environ.get('LEFFF', 'C:/tmp/lefff/lefff-3.4.mlex')
    if os.path.exists(_LEFFF):
        import re as _re2
        _rx = _re2.compile(r'^([A-Za-z]+)([123]+)([sp])$')
        _lef = {}
        for _ln in open(_LEFFF, encoding='utf-8', errors='ignore'):
            _p = _ln.rstrip('\n').split('\t')
            if len(_p) < 4 or _p[1] != 'v':
                continue
            _m = _rx.match(_p[3])
            if not _m or 'P' not in _m.group(1):
                continue
            _dl = deacc(_p[2].lower())
            for _per in _m.group(2):
                _lef.setdefault((_dl, _per, _m.group(3)), _p[0].lower())
        _fix = _add = 0
        for _lem, _mts in cj_c.items():
            _pres = _mts.setdefault('ind:pre', {})
            for _per in ('1', '2', '3'):
                for _num in ('s', 'p'):
                    _lf = _lef.get((_lem, _per, _num))
                    if not _lf or deacc(_lf)[:2] != _lem[:2]:          # anti-bruit : LEFFF doit démarrer comme le lemme
                        continue
                    _cur = _pres.get(_per + _num)
                    if _cur is None:
                        _pres[_per + _num] = (_lf, 0.0, 94); _add += 1
                        cj_f.setdefault(deacc(_lf), set()).add(f"{_lem};ind:pre;{_per};{_num}")
                    elif deacc(_cur[0].lower()) != deacc(_lf):         # désaccord réel → LEFFF (corrige le bruit 8_Nombre de Lexique)
                        _pres[_per + _num] = (_lf, 0.0, 93); _fix += 1
                        cj_f.setdefault(deacc(_lf), set()).add(f"{_lem};ind:pre;{_per};{_num}")
        print(f"[lefff] croisement présent : {_fix} formes corrigées + {_add} trous comblés (LEFFF hors-repo, LGPL-LR)")
    else:
        print(f"[lefff] {_LEFFF} absent → pas de croisement (données hors-repo). Table = dérivation Lexique seule.")

    # table de conjugaison (accord sujet-verbe) : f = forme→lectures ; c = lemme→temps→slot→forme
    # chaque lecture = « lemme;mode:temps;personne;nombre » ; lectures séparées par « | ».
    conj_f = {k: '|'.join(sorted(v)) for k, v in cj_f.items()}
    conj_c = {lem: {mt: {s: v[0] for s, v in slots.items()} for mt, slots in mts.items()} for lem, mts in cj_c.items()}
    json.dump({'f': conj_f, 'c': conj_c}, open(OUT_CONJ, 'w', encoding='utf-8', newline=''),
              ensure_ascii=False, separators=(',', ':'))
    print(f"[conj] {len(conj_f)} formes / {len(conj_c)} lemmes (accord sujet-verbe) → {OUT_CONJ}  ({os.path.getsize(OUT_CONJ)//1024} Ko)")
    for _w, _lem in nom_empty:                            # HÉRITAGE DE GENRE PAR LEMME : Lexique4 laisse le genre VIDE sur ~458
        _gl = nom_lem_g.get(_lem)                         #   formes (soeur, oeuf, oeil…) alors que le lemme est net (soeurs=f).
        if _gl and len(_gl) == 1 and _w not in gset:      #   On complète sans jamais écraser un genre déjà attesté (FP=0).
            gset[_w] = set(_gl)
    gender = {w: list(gs)[0] for w, gs in gset.items() if len(gs) == 1}   # NON ambigu seulement (FP=0)
    amb = sum(1 for gs in gset.values() if len(gs) > 1)
    json.dump(gender, open(OUT_GENDER, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f"[gender] {len(gender)} noms à genre non ambigu (+{amb} ambigus écartés : tour, livre…) → {OUT_GENDER}")

    # adjectifs : paires genre (forme → [genre, contrepartie de l'autre genre, même nombre]). Épicènes/ambigus écartés (FP=0).
    adj = {}
    for (lem, nb), d in adjp.items():
        if 'm' in d and 'f' in d and d['m'] != d['f']:    # paire genrée distincte (≠ épicène « rouge »)
            adj[deacc(d['m'])] = ['m', d['f']]            # tapé masculin → suggérer le féminin
            adj[deacc(d['f'])] = ['f', d['m']]
    for w, gs in adjg.items():                            # forme vue dans les 2 genres (homographe) → écarter
        if len(gs) > 1 and w in adj:
            del adj[w]
    json.dump(adj, open(OUT_ADJ, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f"[adj] {len(adj)} formes adjectivales genrées (épicènes/ambigus écartés) → {OUT_ADJ}")

    # === INVENTAIRE COMPLET + garde-fous + déterminants (récupération « tous les mots ») ===
    OUT_WORDS = os.path.join(HERE, 'cgram_words.json')     # reconnaissance : toutes les formes (ne pas flaguer un vrai mot)
    OUT_GUARD = os.path.join(HERE, 'cgram_guard.json')     # garde-fous FP natifs (homophones / faible prévalence)
    OUT_DET   = os.path.join(HERE, 'cgram_det.json')        # déterminants genrés (un/une, ce/cette…)
    words_sorted = sorted(allwords)
    json.dump(words_sorted, open(OUT_WORDS, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f"[words] INVENTAIRE COMPLET : {len(words_sorted)} formes (toutes catégories/fréquences) → {OUT_WORDS}")
    LOWPREV = 30.0                                          # < 30 % de gens connaissent → mot marginal (abstention)
    guard = {'homoph': sorted(guard_homoph),
             'lowprev': sorted(w for w, p in guard_lowprev.items() if p < LOWPREV)}
    json.dump(guard, open(OUT_GUARD, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f"[guard] FP : {len(guard['homoph'])} formes à homophones + {len(guard['lowprev'])} formes peu connues (<{LOWPREV}%) → {OUT_GUARD}")
    json.dump(det, open(OUT_DET, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f"[det] {len(det)} déterminants genrés (closed-class) → {OUT_DET}")

    # === sous-ensemble HAUTE-FRÉQUENCE, embarquable dans l'app (IIFE) ===
    # VERBES : couverture COMPLÈTE embarquée (= cgram_verbs.json), pas le seuil HF. La règle -er/-é/-ez/-ai
    # (rFlexionEr) et rEer dépendent de l'appartenance verbale ; avec le sous-ensemble HF (~3,5k) l'app ratait
    # des verbes courants (imprimer, classer, réserver…) → app ⊊ Python. Coût : ~+250 Ko dans cgram_hf.json
    # (les formes verbales compressent bien). Genre/adjectifs/conjugaison restent HF (volumineux). Parité app == Python sur les verbes.
    hv = out
    hg = {w: gender[w] for w in gender if gfreq.get(w, 0.0) >= HF_FREQ}
    # conjugaison embarquée COMPLÈTE (choix Rem 2026-07-02 : « d'abord l'efficacité, on verra après pour le poids »).
    # Auparavant sous-ensemble HF (verbes freq≥seuil × présent+imparfait) → l'app ratait les verbes hors-HF (« diminuer »,
    # « imprimer »…) → app ⊊ Python sur l'accord sujet-verbe. On embarque désormais la table INTÉGRALE (= cgram_conj.json :
    # tous verbes, tous temps) → app == Python sur la conjugaison. Clôture de paradigme automatique (toute forme
    # suggérable est déjà dans conj_f). Coût : blob nettement plus lourd (poids assumé pour l'instant).
    hcf = conj_f
    hcc = conj_c
    # gn = genre de NOMS PURS (non ambigu MOINS verbes MOINS adjectifs) — pour la règle genre-déterminant de l'app.
    # Pré-filtré avec les lexiques PLEINS (verbs 12k, adj 16k) → l'app n'a qu'à tester l'appartenance : jamais
    # d'homographe nom/verbe (« porte ») ni nom/adjectif → parité garantie app ⊆ Python (rule_det_gender).
    hgn = {w: g for w, g in gender.items() if w not in verbs and w not in adj}
    hf = {'v': hv, 'g': hg, 'gn': hgn, 'a': adj, 'cj': {'f': hcf, 'c': hcc}}   # embed app = verbes + genre HF + genre noms purs + paires adjectif (accord speller) + conjugaison
    json.dump(hf, open(OUT_HF, 'w', encoding='utf-8', newline=''), ensure_ascii=False, separators=(',', ':'))
    sz = os.path.getsize(OUT_HF)
    print(f"[HF] embarquable (freq≥{HF_FREQ}) : {len(hv)} verbes + {len(hg)} noms genrés HF + {len(hgn)} noms purs genrés (gn) + {len(hcf)} formes conj → {OUT_HF}  ({sz//1024} Ko)")
    print("        vlike + governor_gender + accord sujet-verbe les chargeront automatiquement.")
    return 0


if __name__ == '__main__':
    sys.exit(main())
