# -*- coding: utf-8 -*-
# OMEGA — DÉCOMPOSEUR DE MOTS « à la Lexique 4 », double voie (SON et ORTHO), qui APPREND.
# ─────────────────────────────────────────────────────────────────────────────────────────
# « lit et apprend des mots, les décompose comme dans Lexique 4 » (cf. demande + CLAUDE.md).
# Réutilise (doctrine §A2/A4 — la preuve de réutilisation est dans les imports/appels) :
#   · g2p_tables.json     ← tables AQUA-PHOTON v3 de l'app (route SUBLEXICALE g→p, hésitation latente §3)
#   · phono_homophones.json (43 580 groupes, clé = phono SAMPA Lexique) → route LEXICALE du SON + nbhomoph
#   · cgram_gender/verbs/adj.json (dérivés Lexique 4) → route LEXICALE de cgram/genre
#   · diag_sentence.deacc / toks / norm → tokenisation + normaliseur de surface
#
# DOUBLE VOIE (GRAMMAIRE_DOUBLE_VOIE.md) appliquée à la *décomposition* :
#   SON   = phono lexicale (Lexique SAMPA, exacte) × phono sublexicale (g2p, pour l'OOV)
#   ORTHO = découpage en graphèmes + syllabes orthographiques (route sublexicale, alignée aux noyaux)
#
# APPREND (boucle descendante, descending_probe.py — data-bound, FP=0) :
#   lexique appris incrémental learned_lex.json ; une source LEXICALE sûre n'est JAMAIS écrasée
#   par une supposition sublexicale ; l'usage répété renforce la confiance ; on lit aussi des TEXTES.
#
# Mesure (doctrine §1) : route sublexicale confrontée à la vérité-terrain Lexique (in-lexique),
#   in-lexique vs OOV tenus SÉPARÉS. Lancer :
#     python3 dictee/decompose.py "chevaux"            # décompose un mot (son ET ortho)
#     python3 dictee/decompose.py --read "<texte>"     # lit un texte et APPREND chaque mot
#     python3 dictee/decompose.py --read-file f.txt    # idem depuis un fichier
#     python3 dictee/decompose.py --lex                # état du lexique appris
#     python3 dictee/decompose.py --measure            # harnais falsifiable (in-lexique vs OOV)
#     python3 dictee/decompose.py --demo               # démonstration
import os, sys, re, json, random, unicodedata, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from diag_sentence import deacc, toks, norm            # réutilisation (§A2) : pas de réécriture

KEEP = re.compile(r"[^a-zàâäéèêëîïôöùûüÿç]")            # même filtre de lettres que g2p() de l'app
TABLES_PATH = os.path.join(HERE, 'g2p_tables.json')
LEX_LEARNED = os.path.join(HERE, 'learned_lex.json')

# ── tables sublexicales (extraites de l'app par build_g2p_tables.py) ──
if not os.path.exists(TABLES_PATH):
    sys.exit("[decompose] g2p_tables.json absent. Lance d'abord : python3 dictee/build_g2p_tables.py")
_T = json.load(open(TABLES_PATH, encoding='utf-8'))
VOW, NASAL, DBL = _T['VOW'], set(_T['NASAL']), set(_T['DBL'])
COND, ENTSIL = _T['COND'], set(_T['ENTSIL'])
# SEG du moteur (43) ENRICHI de 8 segments mesurés net-positifs en held-out (+2.23 pts d'exactitude ;
# 'ti'→/sj/ seul vaut +1.4). Le moteur pendu garde SON SEG intact (R66) ; seul le décomposeur l'étend.
# 'ion','ue','oui'… ont été TESTÉS et ÉCARTÉS (ils dégradent) — cf. build_g2p_corrections.py / DECOMPOSE.md.
SEG_EXTRA = ['ueil', 'cqu', 'ail', 'sc', 'sh', 'oy', 'ay', 'ti']
SEG = sorted(set(_T['SEG']) | set(SEG_EXTRA), key=lambda s: -len(s))

# ── overlay ACCENTS (extension assumée : le g2p de l'app, pensé pour le pendu ASCII, rend '?'
#    sur é/è/ç… ; on ajoute les valeurs non ambiguës. Effet MESURÉ en ablation, cf. --measure). ──
ACC = {'é': ('e', 0.05), 'è': ('ɛ', 0.05), 'ê': ('ɛ', 0.05), 'ë': ('ɛ', 0.10),
       'à': ('a', 0.02), 'â': ('a', 0.05), 'ä': ('a', 0.10), 'ô': ('o', 0.05), 'ö': ('o', 0.10),
       'î': ('i', 0.05), 'ï': ('i', 0.10), 'û': ('y', 0.05), 'ù': ('y', 0.05), 'ü': ('y', 0.10),
       'ÿ': ('i', 0.10), 'ç': ('s', 0.02)}

# ── route LEXICALE du son : inversion de phono_homophones (mot → phono SAMPA) + taille de groupe ──
def _load_lexical_phon():
    p = os.path.join(HERE, 'phono_homophones.json')
    if not os.path.exists(p):
        return {}, {}
    d = json.load(open(p, encoding='utf-8'))
    w2p, group = {}, {}
    for phono, words in d.items():
        group[phono] = len(words)
        for w in words:
            w2p.setdefault(w.lower(), phono)            # 1re occurrence ; clé = phono Lexique
    return w2p, group
W2P, GROUP = _load_lexical_phon()

def _load_json(name, default):
    p = os.path.join(HERE, name)
    try:
        return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else default
    except Exception:
        return default
GENDER = _load_json('cgram_gender.json', {})            # mot(deacc) → 'm'/'f'  (noms non ambigus)
VERBS = set(_load_json('cgram_verbs.json', []))         # formes verbales (deacc)
ADJ = _load_json('cgram_adj.json', {})                  # forme(deacc) → [genre, contrepartie]
# CORRECTION APPRISE (boucle descendante, build_g2p_corrections.py) : (graphème\tnextchar) → chunk SAMPA gold.
# Apprise par alignement g2p↔phono Lexique sur le split TRAIN ; corrige les erreurs systématiques du g2p
# (o/ɔ, finales…). Mesurée en HELD-OUT (~+2 pts sur SEG enrichi). Inerte si le fichier est absent.
_CORR_RAW = _load_json('g2p_corrections.json', {})
CORR = _CORR_RAW.get('table', {}) if isinstance(_CORR_RAW, dict) else {}

# ── IPA (sortie g2p) → SAMPA Lexique : 1 caractère SAMPA = 1 phonème (donc len = nbphons) ──
IPA2SAMPA = {
    'a': 'a', 'e': 'e', 'i': 'i', 'o': 'o', 'u': 'u', 'y': 'y', 'ɑ': 'a',
    'ɔ': 'O', 'ɛ': 'E', 'ø': '2', 'œ': '9', 'ə': '°',
    'p': 'p', 'b': 'b', 't': 't', 'd': 'd', 'k': 'k', 'ɡ': 'g', 'g': 'g',
    'f': 'f', 'v': 'v', 's': 's', 'z': 'z', 'm': 'm', 'n': 'n', 'l': 'l',
    'ʁ': 'R', 'ʃ': 'S', 'ʒ': 'Z', 'ɲ': 'N', 'ŋ': 'G', 'j': 'j', 'w': 'w', 'ɥ': '8',
    'ɑ̃': '@', 'ɛ̃': '5', 'œ̃': '1', 'ɔ̃': '§',                       # voyelles nasales (base + U+0303)
}
SAMPA_VOW = set('aeiouyOE2°@519§')                      # noyaux syllabiques (semi-voyelles j/w/8 exclues)

def ipa_to_sampa(ph_ipa):
    """Convertit une chaîne IPA (issue de g2p) en SAMPA Lexique, phonème par phonème.
    Gère le tilde nasal combinant (U+0303) et le ∅ muet (→ rien)."""
    if ph_ipa == '∅':
        return ''
    out, i, s = [], 0, ph_ipa
    while i < len(s):
        tok = s[i]
        if i + 1 < len(s) and s[i + 1] == '̃':     # voyelle nasale = base + combinant
            tok = s[i] + s[i + 1]; i += 2
        else:
            i += 1
        out.append(IPA2SAMPA.get(tok, tok))
    return ''.join(out)

# ── ROUTE SUBLEXICALE : portage FIDÈLE du g2p() de l'app (briques AQUA-PHOTON v3) ──
def g2p(word, accents=True, seg=None):
    """graphème→phonème déterministe + hésitation `h` (latent §3). Renvoie la liste des pas
    {g: graphème, ph: phonème IPA, h: hésitation}. `accents` active l'overlay é/è/ç (sinon '?').
    `seg` permet une segmentation alternative (ablation : SEG moteur vs SEG enrichi)."""
    segs = seg if seg is not None else SEG
    w = KEEP.sub('', word.lower())
    steps, i = [], 0
    while i < len(w):
        g = None
        for cand in segs:                                # maximal munch sur les segments connus
            if not w.startswith(cand, i):
                continue
            after = w[i + len(cand)] if i + len(cand) < len(w) else '#'
            if cand in NASAL and (after in VOW or after in 'nm'):
                continue                                 # « an »+voyelle/n/m → pas une nasale (anne, animal)
            g = cand; break
        if not g:
            g = w[i]
        prev = w[i - 1] if i > 0 else '#'
        nxt = w[i + len(g)] if i + len(g) < len(w) else '#'
        ph, h = '?', 0.0
        if g in DBL:
            ph = ((COND.get(g[0]) or {}).get('_', [g[0]])[0]) or g[0]; h = 0.0
        elif g in ACC and accents:                       # overlay accents (extension assumée)
            ph, h = ACC[g]
        else:
            t = COND.get(g)
            if t:
                e = t.get(nxt) or t.get('_')
                ph, h = e[0], e[1]
        # règles de contexte bilatéral déterministes (verbatim app) :
        if g == 's' and prev in VOW and nxt in VOW:
            ph, h = 'z', 0.10                            # s intervocalique → /z/ (maison, rose)
        elif g == 'x' and prev in VOW and nxt in VOW:
            ph, h = 'ɡz', 0.15                           # x intervocalique → /gz/ (examen)
        steps.append({'g': g, 'ph': ph, 'h': max(0.0, h)})
        i += len(g)
    if w in ENTSIL and w.endswith('ent'):                # -ent muet (verbe) : POS lève /ɑ̃/ vs ∅
        for k in range(len(steps) - 1, -1, -1):
            if steps[k]['g'] == 'en':
                steps[k]['ph'], steps[k]['h'] = '∅', 0.02; break
    return steps

def sublexical_phon(word, accents=True, correct=True, seg=None):
    """Décompo sublexicale → (sampa, ipa, graphèmes[{g,ph_sampa,h}], hesitation_moyenne).
    `correct` applique la table de correction apprise (boucle descendante) ; `seg` = segmentation."""
    steps = g2p(word, accents=accents, seg=seg)
    w = KEEP.sub('', word.lower())
    graph = []
    sampa_parts, ipa_parts, hs = [], [], []
    i = 0
    for st in steps:
        g = st['g']
        nxt = w[i + len(g)] if i + len(g) < len(w) else '#'; i += len(g)
        sp = ipa_to_sampa(st['ph'])
        if correct and CORR:                             # correction apprise (graphème, contexte droit)
            sp = CORR.get(g + '\t' + nxt, sp)
        graph.append({'g': g, 'ph': sp, 'ipa': '' if st['ph'] == '∅' else st['ph'], 'h': st['h']})
        sampa_parts.append(sp); ipa_parts.append('' if st['ph'] == '∅' else st['ph']); hs.append(st['h'])
    sampa = ''.join(sampa_parts)
    hmean = sum(hs) / len(hs) if hs else 0.0
    return sampa, ''.join(ipa_parts), graph, hmean

# ── syllabes (SON) par RÈGLES (principe de l'attaque maximale) : noyaux = voyelles SAMPA ;
#    nbsyll = nb de noyaux (invariant). La frontière laisse à la syllabe suivante l'attaque LÉGALE
#    la plus longue (C+liquide(+glide), C+glide, C, glide) ; le reste forme la coda précédente. ──
LIQ = set('lR'); GLIDE = set('jw8')
def _legal_onset(s):
    if len(s) == 1: return True                          # une consonne ou un glide = attaque licite
    if len(s) == 2: return (s[1] in LIQ and s[0] not in LIQ | GLIDE) or (s[1] in GLIDE and s[0] not in GLIDE)
    if len(s) == 3: return s[2] in GLIDE and s[1] in LIQ and s[0] not in LIQ | GLIDE   # ex. /pri j/ → onset 'prj'? (rare)
    return False
def _onset_len(cluster):
    for L in (3, 2, 1):                                  # plus longue attaque légale en suffixe du cluster
        if L <= len(cluster) and _legal_onset(cluster[-L:]): return L
    return min(1, len(cluster))
def syllabify_sampa(sampa):
    nuclei = [i for i, c in enumerate(sampa) if c in SAMPA_VOW]
    if not nuclei:
        return ([sampa] if sampa else []), 0
    cuts = [0]
    for k in range(len(nuclei) - 1):
        a, b = nuclei[k], nuclei[k + 1]
        cluster = sampa[a + 1:b]                          # consonnes/glides entre deux noyaux
        cuts.append(b - _onset_len(cluster) if cluster else a + 1)   # attaque max à droite ; hiatus → coupe après a
    cuts.append(len(sampa))
    sylls = [sampa[cuts[i]:cuts[i + 1]] for i in range(len(cuts) - 1)]
    return sylls, len(nuclei)

# ── syllabes (ORTHO, orthosyll Lexique) : on CALQUE le découpage orthographique sur les syllabes
#    PHONOLOGIQUES (mêmes frontières) — chaque graphème va dans la syllabe de son 1er phonème ;
#    un graphème muet (∅) reste avec la syllabe courante (ex. le « x » final de chevaux). ──
def syllabify_ortho(graph):
    sylls, _ = syllabify_sampa(''.join(gp['ph'] for gp in graph))
    if not sylls:
        return [''.join(gp['g'] for gp in graph)] if graph else []
    syl_of = []                                          # position phonémique → index de syllabe
    for si, s in enumerate(sylls):
        syl_of += [si] * len(s)
    out = [''] * len(sylls); pos = 0
    for gp in graph:
        si = syl_of[pos] if pos < len(syl_of) else len(sylls) - 1
        out[si] += gp['g']; pos += len(gp['ph'])
    out = [s for s in out if s]
    return out or [''.join(gp['g'] for gp in graph)]

# ── route LEXICALE de la catégorie grammaticale (cgram / genre) ──
def lexical_gram(word):
    d = deacc(word.lower())
    cats, genre = [], None
    if d in VERBS:
        cats.append('VER')
    if d in GENDER:
        cats.append('NOM'); genre = GENDER[d]
    if d in ADJ:
        cats.append('ADJ'); genre = genre or ADJ[d][0]
    return cats, genre

def nombre_heuristic(word):
    """Nombre par suffixe (sublexical, classe fermée fiable) : -s/-x → pluriel, sinon singulier."""
    d = deacc(word.lower())
    return 'p' if d.endswith(('s', 'x')) else 's'

# ── DÉCOMPOSITION complète (un mot) : double voie SON+ORTHO, façon Lexique 4 ──
def decompose(word, accents=True):
    w = word.strip().lower()
    letters = KEEP.sub('', w)
    sub_sampa, sub_ipa, graph, hmean = sublexical_phon(w, accents=accents)
    # SON — route lexicale prioritaire (exacte), sinon sublexicale (g2p) pour l'OOV
    lex_phono = W2P.get(w)
    if lex_phono is not None:
        phono, src_phon = lex_phono, 'lex'
        nbhomoph = max(0, GROUP.get(lex_phono, 1) - 1)
    else:
        phono, src_phon = sub_sampa, 'sublex'
        nbhomoph = GROUP.get(sub_sampa, 0)            # nb de mots Lexique homophones du son PRÉDIT (0 si inédit)
    syll_phon, nbsyll = syllabify_sampa(phono)
    cv = ''.join('V' if c in SAMPA_VOW else ('G' if c in 'jw8' else 'C') for c in phono)
    # ORTHO — découpage en graphèmes + syllabes orthographiques (route sublexicale)
    syll_ortho = syllabify_ortho(graph)
    # GRAMMAIRE — route lexicale (cgram/genre) + nombre sublexical
    cats, genre = lexical_gram(w)
    gram_src = 'lex' if cats else 'sublex'
    rec = {
        'mot': w, 'nblettres': len(letters),
        'graphemes': [gp['g'] for gp in graph],
        'syll_ortho': syll_ortho,
        'phono': phono, 'phono_ipa': sub_ipa, 'src_phon': src_phon,
        'nbphons': len(phono), 'syll_phon': syll_phon, 'nbsyll': nbsyll, 'cv': cv,
        'cgram': cats, 'genre': genre, 'nombre': nombre_heuristic(w),
        'nbhomoph': nbhomoph, 'gram_src': gram_src,
        'sublex_phono': sub_sampa,                       # toujours la prédiction sublexicale (pour audit/learn)
        'hesitation': round(hmean, 3), 'confiance': round(max(0.0, 1.0 - hmean), 3),
        'alignement': [{'g': gp['g'], 'ph': gp['ph']} for gp in graph],
    }
    return rec

# ── affichage humain (SON ET ORTHO bien séparés) ──
def fmt(rec):
    L = []
    L.append(f"« {rec['mot']} »  ({rec['nblettres']} lettres)")
    al = '  '.join(f"{a['g']}→{a['ph'] or '∅'}" for a in rec['alignement'])
    L.append(f"  ORTHO  graphèmes : {al}")
    L.append(f"         syllabes  : {'-'.join(rec['syll_ortho'])}")
    rt = 'lexicale (Lexique)' if rec['src_phon'] == 'lex' else 'sublexicale (g2p, OOV)'
    L.append(f"  SON    phono     : /{rec['phono']}/   [IPA {rec['phono_ipa'] or '∅'}]   route {rt}")
    L.append(f"         {rec['nbphons']} phonèmes · {rec['nbsyll']} syllabe(s) : "
             f"{'-'.join(rec['syll_phon'])} · CV={rec['cv']}")
    if rec['src_phon'] == 'lex' and rec['sublex_phono'] != rec['phono']:
        L.append(f"         (prédiction sublexicale : /{rec['sublex_phono']}/ — diverge, confiance {rec['confiance']})")
    gram = '/'.join(rec['cgram']) if rec['cgram'] else '—'
    g = {'m': 'masculin', 'f': 'féminin'}.get(rec['genre'], '—')
    nb = {'s': 'singulier', 'p': 'pluriel'}[rec['nombre']]
    src = 'lexicale' if rec['gram_src'] == 'lex' else 'sublexicale'
    L.append(f"  GRAM   cgram : {gram} ({src}) · genre : {g} · nombre : {nb} · homophones : {rec['nbhomoph']}")
    return '\n'.join(L)

# ── APPREND : lexique appris incrémental (boucle descendante, FP=0) ──
def load_learned():
    return _load_json(os.path.basename(LEX_LEARNED), {'_meta': {'lus': 0, 'phon_inv': {}, 'graph_inv': {}}})

def save_learned(lex):
    json.dump(lex, open(LEX_LEARNED, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

def _entry(rec):
    return {'phono': rec['phono'], 'ipa': rec['phono_ipa'], 'nbphons': rec['nbphons'],
            'nbsyll': rec['nbsyll'], 'cv': rec['cv'], 'cgram': rec['cgram'], 'genre': rec['genre'],
            'nombre': rec['nombre'], 'nbhomoph': rec['nbhomoph'],
            'src': rec['src_phon'], 'gram_src': rec['gram_src']}

def learn_word(lex, word, accents=True):
    """Apprend (ou renforce) un mot. RÈGLE FP=0 : une entrée LEXICALE sûre n'est jamais
    dégradée par une prédiction sublexicale ; lex remplace sublex (montée en sûreté) ;
    l'usage répété incrémente `vu`. Renvoie ('neuf'|'renforce'|'promu')."""
    rec = decompose(word, accents=accents)
    w = rec['mot']
    if not rec['graphemes']:
        return None
    prev = lex.get(w)
    e = _entry(rec)
    if prev is None:
        e['vu'] = 1; e['premier'] = lex['_meta']['lus']; lex[w] = e; status = 'neuf'
    else:
        vu = prev.get('vu', 1) + 1
        if prev.get('src') == 'lex' and e['src'] == 'sublex':
            prev['vu'] = vu; status = 'renforce'          # ne PAS écraser la source sûre (FP=0)
        elif prev.get('src') == 'sublex' and e['src'] == 'lex':
            e['vu'] = vu; e['premier'] = prev.get('premier', lex['_meta']['lus']); lex[w] = e; status = 'promu'
        else:
            prev['vu'] = vu; status = 'renforce'
    lex[w]['dernier'] = lex['_meta']['lus']
    # inventaire d'usage (apprend la distribution des phonèmes/graphèmes vus)
    for c in rec['phono']:
        lex['_meta']['phon_inv'][c] = lex['_meta']['phon_inv'].get(c, 0) + 1
    for gph in rec['graphemes']:
        lex['_meta']['graph_inv'][gph] = lex['_meta']['graph_inv'].get(gph, 0) + 1
    return status

def read_text(text, accents=True, verbose=False):
    """Lit un texte mot à mot et APPREND chaque mot (le volet « lu aussi »)."""
    lex = load_learned()
    counts = {'neuf': 0, 'renforce': 0, 'promu': 0}
    for tok in toks(text):
        st = learn_word(lex, tok, accents=accents)
        if st:
            counts[st] += 1; lex['_meta']['lus'] += 1
            if verbose:
                print(f"  {tok:16} {st:9} → /{lex[tok.lower()]['phono']}/ ({lex[tok.lower()]['src']})")
    save_learned(lex)
    return counts, lex

# ── MESURE (doctrine §1) : route sublexicale vs vérité-terrain Lexique. in-lexique ⟂ OOV ──
def _lev(a, b):
    n, m = len(a), len(b)
    dp = list(range(m + 1))
    for i in range(1, n + 1):
        prev, dp[0] = dp[0], i
        for j in range(1, m + 1):
            cur = dp[j]
            dp[j] = min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] != b[j - 1]))
            prev = cur
    return dp[m]

# ── ALIGNEMENT graphème↔phonème (partagé : boucle descendante + cognition phono→ortho) ──
def steps_of(word):
    """[(graphème, caractère-suivant, phonème SAMPA prédit RAW)] via le g2p enrichi (sans correction)."""
    st = g2p(word, accents=True, seg=SEG)
    w = KEEP.sub('', word.lower()); out = []; i = 0
    for s in st:
        g = s['g']; nxt = w[i + len(g)] if i + len(g) < len(w) else '#'
        out.append((g, nxt, ipa_to_sampa(s['ph']))); i += len(g)
    return out

def align_chunks(preds, gold):
    """Partition MONOTONE de `gold` en len(preds) morceaux (0..3 car.) minimisant Σ _lev(pred_i, morceau_i).
    Les prédictions g2p servent d'ancres → chaque graphème reçoit son morceau de phono gold."""
    k, n = len(preds), len(gold); INF = 10 ** 9
    dp = [[INF] * (n + 1) for _ in range(k + 1)]; bk = [[0] * (n + 1) for _ in range(k + 1)]; dp[0][0] = 0
    for i in range(1, k + 1):
        pr = preds[i - 1]
        for p in range(n + 1):
            best, bq = INF, 0
            for q in range(max(0, p - 3), p + 1):
                if dp[i - 1][q] >= INF: continue
                c = dp[i - 1][q] + _lev(pr, gold[q:p])
                if c < best: best, bq = c, q
            dp[i][p] = best; bk[i][p] = bq
    chunks = []; p = n
    for i in range(k, 0, -1):
        q = bk[i][p]; chunks.append(gold[q:p]); p = q
    chunks.reverse(); return chunks

def aligned_units(word):
    """Unités d'alignement d'un mot in-lexique : liste de (morceau_phono, graphie) où les graphèmes
    MUETS (∅) sont repliés sur le graphème prononcé voisin (précédent, sinon suivant). Base du p2g."""
    if word not in W2P:
        return None
    S = steps_of(word); chunks = align_chunks([s[2] for s in S], W2P[word])
    units = []; lead = ''
    for (g, _, _), ch in zip(S, chunks):
        if ch == '':                                     # graphème muet (lettre non prononcée)
            if units: units[-1][1] += g                  # replie sur la graphie prononcée précédente
            else: lead += g                              # muet en tête (h de homme) → graphème suivant
        else:
            units.append([ch, lead + g]); lead = ''
    if lead and units: units[0][1] = lead + units[0][1]
    return units

def inlex_split(seed=42, test_frac=0.2):
    """Partage déterministe des mots in-lexique en TRAIN (apprend la correction) / TEST (mesure).
    Garantit que la table de correction n'est PAS mesurée sur ses données d'apprentissage (§1.3)."""
    pool = [w for w in W2P if w.isalpha()]
    rnd = random.Random(seed); rnd.shuffle(pool)
    cut = int(len(pool) * (1 - test_frac))
    return pool[:cut], pool[cut:]

def measure(seed=42, n_test=4000):
    _, test = inlex_split(seed)
    test = test[:n_test]
    base_seg = sorted(set(_T['SEG']), key=lambda s: -len(s))   # SEG du moteur (sans enrichissement)
    print(f"=== MESURE route SUBLEXICALE vs phono Lexique — HELD-OUT (test={len(test)}, seed={seed}) ===")
    def run(tag, correct, seg, acc=True):
        exact = nph = 0; tot_ed = tot_ph = 0
        for w in test:
            gold = W2P[w]; pred, _, _, _ = sublexical_phon(w, accents=acc, correct=correct, seg=seg)
            exact += (pred == gold); tot_ed += _lev(pred, gold); tot_ph += len(gold); nph += (len(pred) == len(gold))
        N = len(test)
        print(f"  {tag:46} exact {100*exact/N:5.2f}%  ·  phonémique {100*(1-tot_ed/max(1,tot_ph)):5.2f}%  ·  nbphons {100*nph/N:5.1f}%")
        return 100 * exact / N
    a = run("(1) g2p moteur brut (SEG=43, sans correction)", False, base_seg)
    b = run("(2)  + SEG enrichi (+8 segments mesurés)", False, SEG)
    c = run("(3)  + correction apprise (boucle descendante)", True, SEG)
    cstate = f"chargée, {len(CORR)} règles" if CORR else "ABSENTE → lance build_g2p_corrections.py"
    print(f"  Δ total (3)−(1) : {c-a:+.2f} points d'exactitude   ·   table de correction : {cstate}")
    # ablation ACCENTS (sur le meilleur étage) — l'overlay reste mesuré (§1)
    na = run("    ablation : SANS overlay accents", True, SEG, acc=False)
    print(f"    → overlay accents : {c-na:+.2f} pts")
    # OOV (tenu SÉPARÉ §1.3) : pas de vérité-terrain → couverture/confiance seulement
    rnd = random.Random(seed)
    oov = [w for w in VERBS if w not in W2P and w.isalpha()]
    oov = rnd.sample(oov, min(1000, len(oov)))
    conf = [decompose(w)['confiance'] for w in oov]
    print(f"=== OOV (sans phono Lexique — couverture/confiance, n={len(oov)}) ===")
    print(f"    sublexical : 100% produisent un phono · confiance moyenne {sum(conf)/max(1,len(conf)):.3f} · cgram couvre 100% (verbes)")
    # garde-fous (§1.5) : cas connus reproduits
    CHK = {'chat': 'Sa', 'cheval': 'S°val', 'oiseau': 'wazo', 'maison': 'mEz§', 'examen': 'Egzam5',
           'beau': 'bo', 'rouge': 'RuZ', 'lui': 'l8i', 'nation': 'nasj§'}
    bad = [(w, sublexical_phon(w)[0], g) for w, g in CHK.items() if sublexical_phon(w)[0] != g]
    print("=== garde-fous (cas connus) ===", "OK" if not bad else f"ÉCHECS : {bad}")

# ── état du lexique appris ──
def show_lex():
    lex = load_learned()
    words = {k: v for k, v in lex.items() if k != '_meta'}
    meta = lex.get('_meta', {})
    print(f"=== lexique appris : {len(words)} mots distincts · {meta.get('lus',0)} occurrences lues ===")
    by_src = {}
    for v in words.values():
        by_src[v.get('src')] = by_src.get(v.get('src'), 0) + 1
    print(f"  sources : {by_src}")
    top = sorted(words.items(), key=lambda kv: -kv[1].get('vu', 0))[:12]
    for w, v in top:
        print(f"  {w:16} vu×{v.get('vu',1):<3} /{v['phono']}/  {('/'.join(v['cgram']) if v['cgram'] else '—')}  ({v['src']})")
    pinv = sorted(meta.get('phon_inv', {}).items(), key=lambda kv: -kv[1])[:10]
    print("  phonèmes les plus fréquents :", ' '.join(f"{p}:{c}" for p, c in pinv))


def main(argv):
    if not argv:
        print(__doc__.strip().split('\n\n')[0]); print("\nUsage : voir l'en-tête (mot | --read | --read-file | --lex | --measure | --demo)")
        return 0
    a = argv[0]
    if a == '--measure':
        measure(); return 0
    if a == '--lex':
        show_lex(); return 0
    if a == '--read':
        c, lex = read_text(' '.join(argv[1:]), verbose=True)
        print(f"→ appris : {c['neuf']} neufs · {c['renforce']} renforcés · {c['promu']} promus "
              f"· lexique = {len([k for k in lex if k!='_meta'])} mots"); return 0
    if a == '--read-file':
        if len(argv) < 2 or not os.path.exists(argv[1]):
            print("fichier introuvable"); return 1
        c, lex = read_text(open(argv[1], encoding='utf-8').read())
        print(f"→ appris depuis {argv[1]} : {c['neuf']} neufs · {c['renforce']} renforcés · {c['promu']} promus "
              f"· lexique = {len([k for k in lex if k!='_meta'])} mots"); return 0
    if a == '--demo':
        demo(); return 0
    for w in argv:                                       # un ou plusieurs mots
        print(fmt(decompose(w))); print()
    return 0


def demo():
    print("=== décomposition (son ET ortho), double voie ===\n")
    for w in ['chevaux', 'oiseau', 'femme', 'examen', 'beaucoup', 'aujourd', 'kayak', 'dictée']:
        print(fmt(decompose(w))); print()
    print("=== APPREND en lisant un texte (lexique incrémental, FP=0) ===")
    txt = "Le petit chat boit du lait. Les chats boivent du lait."
    c, lex = read_text(txt)
    print(f"texte : « {txt} »\n→ {c['neuf']} mots neufs, {c['renforce']} renforcés "
          f"(« chat/chats », « du », « lait » revus). Lexique = {len([k for k in lex if k!='_meta'])} mots.")


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
