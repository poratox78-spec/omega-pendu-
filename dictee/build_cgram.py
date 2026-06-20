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
        adjp = {}                                         # (lemme, nombre) → {'m':forme_acc, 'f':forme_acc}
        adjg = {}                                         # déacc(forme ADJ) → {genres vus} (écarte l'ambigu)
        adjfreq = {}                                      # déacc(forme ADJ) → fréquence max
        cj_f = {}                                          # forme_déacc → {"lemme;mode:temps;pers;nombre"} (toutes lectures finies)
        cj_c = {}                                          # lemme → mode:temps → slot(« 3s ») → (forme_acc, freq, spécificité)
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
            if cg.startswith('VER') and fr >= FREQ_MIN:   # VER = verbe (toutes formes fléchies). NB : être/avoir sont double-taggés VER+AUX dans Lexique → déjà couverts (vérifié : ajouter 'AUX' = no-op).
                verbs[w] = max(verbs.get(w, 0.0), fr); n += 1
                # table de conjugaison (accord sujet-verbe) — lectures finies à sujet (ind/sub/cnd)
                if c_info >= 0 and c_info < len(row) and c_lemme >= 0:
                    form = row[c_mot].strip(); form_lw = form.lower()
                    lem = deacc(row[c_lemme].strip().lower())
                    nb = row[c_nombre].strip().lower()[:1] if 0 <= c_nombre < len(row) else ''
                    nb = nb if nb in ('s', 'p') else ''                     # '' = à déduire de la morphologie
                    is_inf = (w == lem)                                      # forme = lemme → INFINITIF (ses tags finis = artefacts Lexique « chanter:ind:pre:2 ») → écarté
                    fin = []
                    for tag in row[c_info].split(','):
                        pp = tag.split(':')
                        if len(pp) == 3 and pp[0] in FINITE and pp[2] in ('1', '2', '3'):
                            fin.append((pp[0] + ':' + pp[1], pp[2]))
                    spec = len(fin)                                          # moins de tags = forme plus spécifique (fiable)
                    is_part = form_lw.endswith(PART_END)
                    if not is_inf:
                        for mt, per in fin:
                            nn = nb or derive_number(form_lw, per)          # nombre donné, sinon déduit (-ons/-ez/-ent…)
                            cj_f.setdefault(w, set()).add(f"{lem};{mt};{per};{nn}")
                            if nn in ('s', 'p') and not (is_part and mt.endswith(':pre')):
                                slot = per + nn; d = cj_c.setdefault(lem, {}).setdefault(mt, {})
                                if slot not in d or (spec, -fr) < (d[slot][2], -d[slot][1]):   # min spécificité, puis max fréq
                                    d[slot] = (form, fr, spec)
            if cg.startswith('NOM') and c_genre >= 0 and c_genre < len(row):
                g = row[c_genre].strip().lower()
                if g in ('m', 'f'):                       # genre marqué dans le lexique
                    gset.setdefault(w, set()).add(g)
                    gfreq[w] = max(gfreq.get(w, 0.0), fr)
            if cg.startswith('ADJ') and min(c_genre, c_lemme, c_nombre) >= 0 and max(c_genre, c_lemme, c_nombre) < len(row):
                g = row[c_genre].strip().lower(); nb = (row[c_nombre].strip().lower()[:1] or '')
                if g in ('m', 'f') and nb in ('s', 'p'):
                    lem = deacc(row[c_lemme].strip().lower())
                    adjp.setdefault((lem, nb), {})[g] = row[c_mot].strip().lower()   # forme accentuée (pour la suggestion)
                    adjg.setdefault(w, set()).add(g); adjfreq[w] = max(adjfreq.get(w, 0.0), fr)
    out = sorted(verbs)
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f"[cgram] {len(out)} formes verbales (sur {n} lignes VER, freq≥{FREQ_MIN}) → {OUT}")

    # table de conjugaison (accord sujet-verbe) : f = forme→lectures ; c = lemme→temps→slot→forme
    # chaque lecture = « lemme;mode:temps;personne;nombre » ; lectures séparées par « | ».
    conj_f = {k: '|'.join(sorted(v)) for k, v in cj_f.items()}
    conj_c = {lem: {mt: {s: v[0] for s, v in slots.items()} for mt, slots in mts.items()} for lem, mts in cj_c.items()}
    json.dump({'f': conj_f, 'c': conj_c}, open(OUT_CONJ, 'w', encoding='utf-8', newline=''),
              ensure_ascii=False, separators=(',', ':'))
    print(f"[conj] {len(conj_f)} formes / {len(conj_c)} lemmes (accord sujet-verbe) → {OUT_CONJ}  ({os.path.getsize(OUT_CONJ)//1024} Ko)")
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
    hv = sorted([w for w, fr in verbs.items() if fr >= HF_FREQ])
    hg = {w: gender[w] for w in gender if gfreq.get(w, 0.0) >= HF_FREQ}
    # conjugaison embarquée : formes HF, temps présent + imparfait seulement (les 2 plus fréquents/dys ;
    # l'imparfait porte le classique -ais/-ait). Le probe Python garde la table COMPLÈTE (tous temps).
    HF_TENSES = {'ind:pre', 'ind:imp'}
    hcf = {}
    for w in hv:
        rs = cj_f.get(w)
        if not rs: continue
        kept = [r for r in rs if r.split(';')[1] in HF_TENSES]
        if kept: hcf[w] = '|'.join(sorted(kept))
    hc_need = {r.split(';')[0] for rs in hcf.values() for r in rs.split('|')}
    hcc = {lem: {mt: s for mt, s in conj_c[lem].items() if mt in HF_TENSES}
           for lem in hc_need if lem in conj_c}
    hcc = {lem: m for lem, m in hcc.items() if m}
    # gn = genre de NOMS PURS (non ambigu MOINS verbes MOINS adjectifs) — pour la règle genre-déterminant de l'app.
    # Pré-filtré avec les lexiques PLEINS (verbs 12k, adj 16k) → l'app n'a qu'à tester l'appartenance : jamais
    # d'homographe nom/verbe (« porte ») ni nom/adjectif → parité garantie app ⊆ Python (rule_det_gender).
    hgn = {w: g for w, g in gender.items() if w not in verbs and w not in adj}
    hf = {'v': hv, 'g': hg, 'gn': hgn, 'cj': {'f': hcf, 'c': hcc}}   # embed app = verbes + genre HF + genre noms purs + conjugaison
    json.dump(hf, open(OUT_HF, 'w', encoding='utf-8', newline=''), ensure_ascii=False, separators=(',', ':'))
    sz = os.path.getsize(OUT_HF)
    print(f"[HF] embarquable (freq≥{HF_FREQ}) : {len(hv)} verbes + {len(hg)} noms genrés HF + {len(hgn)} noms purs genrés (gn) + {len(hcf)} formes conj → {OUT_HF}  ({sz//1024} Ko)")
    print("        vlike + governor_gender + accord sujet-verbe les chargeront automatiquement.")
    return 0


if __name__ == '__main__':
    sys.exit(main())
