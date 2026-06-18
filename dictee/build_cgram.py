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
OUT_HF = os.path.join(HERE, 'cgram_hf.json')           # sous-ensemble haute-fréquence embarquable dans l'app
FREQ_MIN = float(os.environ.get('FREQ_MIN', '0.5'))   # garde les formes pas trop rares (taille raisonnable)
HF_FREQ = float(os.environ.get('HF_FREQ', '5'))        # seuil du sous-ensemble embarquable (par million, FreqOrtho)


def deacc(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


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
        c_freq = find_col(header, 'freqortho', 'freqfilms', 'freq')
        if min(c_mot, c_gram) < 0:
            print(f"[cgram] colonnes introuvables (mot={c_mot}, cgram={c_gram}). En-tête : {header[:8]}…")
            return 2
        verbs = {}                                       # forme VER → fréquence max
        n = 0
        gset = {}                                        # forme NOM → {genres vus} (écarte l'ambigu)
        gfreq = {}                                       # forme NOM → fréquence max
        adjp = {}                                         # (lemme, nombre) → {'m':forme_acc, 'f':forme_acc}
        adjg = {}                                         # déacc(forme ADJ) → {genres vus} (écarte l'ambigu)
        adjfreq = {}                                      # déacc(forme ADJ) → fréquence max
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
            if cg.startswith('VER') and fr >= FREQ_MIN:   # VER = verbe (toutes formes fléchies)
                verbs[w] = max(verbs.get(w, 0.0), fr); n += 1
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

    # === sous-ensemble HAUTE-FRÉQUENCE, embarquable dans l'app (IIFE) ===
    hv = sorted([w for w, fr in verbs.items() if fr >= HF_FREQ])
    hg = {w: gender[w] for w in gender if gfreq.get(w, 0.0) >= HF_FREQ}
    hf = {'v': hv, 'g': hg}                                # embed app = verbes + genre (l'accord-genre adjectif n'est pas branché ; cgram_adj.json reste un asset)
    json.dump(hf, open(OUT_HF, 'w', encoding='utf-8', newline=''), ensure_ascii=False, separators=(',', ':'))
    sz = os.path.getsize(OUT_HF)
    print(f"[HF] embarquable (freq≥{HF_FREQ}) : {len(hv)} verbes + {len(hg)} noms genrés → {OUT_HF}  ({sz//1024} Ko)")
    print("        vlike + governor_gender (route lexicale) les chargeront automatiquement.")
    return 0


if __name__ == '__main__':
    sys.exit(main())
