# -*- coding: utf-8 -*-
# Régénère le lexique EMBARQUÉ du moteur de pendu (bloc <script id="lex4-data-gz">,
# gzip+base64) depuis le Lexique4.tsv complet — format byte-compatible avec loadOmegaLex4().
#
# But (demande Rem) : TOUS LES MOTS, pas une sélection partielle. Les marginaux ne sont
# PAS exclus : ils gardent leur poids `f` (FreqOrtho = prior) + `prev` (prévalence) +
# `nbhomoph` (ambiguïté). La cohorte du moteur pondère par `f` ⇒ un mot rare a un prior
# bas mais le motif révélé relève son posterior (doctrine §3 : jointe, pas argmax).
#
# Filtres CONFIGURABLES (par défaut : tout) — pour valider la fidélité, on peut reproduire
# le blob historique (MINLEN=7 MAXLEN=15 MINFREQ=0.01).
#
#   LEX4=/tmp/lex4/Lexique4.tsv MINLEN=1 MAXLEN=999 MINFREQ=0 python3 evo/build_engine_lex.py
#
# Sorties : <OUT>.json (lisible), <OUT>.b64 (base64 du gzip, à coller dans le bloc),
#           + un résumé taille / n_words / couverture.
import os, sys, csv, json, gzip, base64, unicodedata
from collections import OrderedDict

LEX = os.environ.get('LEX4', '/tmp/lex4/Lexique4.tsv')
MINLEN = int(os.environ.get('MINLEN', '1'))
MAXLEN = int(os.environ.get('MAXLEN', '999'))
MINFREQ = float(os.environ.get('MINFREQ', '0'))
KEEP_EMPTY_FREQ = os.environ.get('KEEP_EMPTY_FREQ', '1') == '1'   # garder les formes sans fréquence (marginaux extrêmes)
OUT = os.environ.get('OUT', '/tmp/lex4/engine_lex')

def deacc(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def col(header, *needles):
    low = [h.lower() for h in header]
    for nd in needles:
        for k, h in enumerate(low):
            if nd in h:
                return k
    return -1

def fnum(row, i):
    if i < 0 or i >= len(row): return None
    v = (row[i] or '').strip().replace(',', '.')
    if v == '': return None
    try: return float(v)
    except ValueError: return None

def fint(row, i):
    f = fnum(row, i)
    return int(f) if (f is not None and f == int(f)) else f

def fstr(row, i):
    if i < 0 or i >= len(row): return None
    v = (row[i] or '').strip()
    return v or None

def main():
    if not os.path.exists(LEX):
        print(f"[engine-lex] Lexique4 introuvable ({LEX}).")
        return 1
    with open(LEX, encoding='utf-8') as f:
        r = csv.reader(f, delimiter='\t')
        H = next(r)
        ci = {
            'm':   col(H, 'mot'),
            'p':   col(H, '2_phono', 'phono') if col(H, '2_phono') >= 0 else col(H, 'phono'),
            'l':   col(H, 'lemme'),
            'g':   col(H, 'cgram', 'gram'),
            'f':   col(H, 'freqortho', 'freqfilms', 'freq'),
            'fl':  col(H, 'freqlemme'),
            'cd':  col(H, 'cdortho'),
            'old': col(H, 'old20'),
            'pld': col(H, 'pld20'),
            'syll':col(H, 'syllnb', 'nbsyll'),
            'cvo': col(H, 'cvortho'),
            'cvp': col(H, 'cvphono'),
            'puo': col(H, 'puortho'),
            'pup': col(H, 'puphon'),
            'mb':  col(H, 'morphobase'),
            'ms':  col(H, 'morphostruct'),
            'md':  col(H, 'morphodecomp'),
            'prev':col(H, 'preval') if col(H, 'prevalnb') < 0 else col(H, '33_preval', 'preval'),
            'rt':  col(H, 'zrt_flp', 'zrt'),
            'nbhomoph': col(H, 'nbhomoph'),
            'nbhomog':  col(H, 'nbhomog'),
        }
        # p : prendre la 1re colonne "phono" (2_Phono, code Lexique) — pas l'IPA (3_Phono_IPA)
        ci['p'] = col(H, '2_phono')
        if ci['p'] < 0: ci['p'] = col(H, 'phono')
        STR = {'p','l','g','cvo','cvp','mb','ms','md'}
        INT = {'syll','puo','pup','nbhomoph','nbhomog'}
        FLO = {'f','fl','cd','old','pld','prev','rt'}
        ROUND = {'f':3,'fl':3,'cd':3,'old':2,'pld':2,'prev':1,'rt':3}   # comme le blob historique (limite la taille)
        best = OrderedDict()   # m -> (freq, entry)  (dédup : garde la plus fréquente)
        kept = dropped_len = dropped_freq = dropped_nonascii = 0
        for row in r:
            mi = ci['m']
            if mi < 0 or mi >= len(row): continue
            raw = (row[mi] or '').strip().lower()
            m = deacc(raw).upper()
            if not m or not all('A' <= c <= 'Z' for c in m):
                dropped_nonascii += 1; continue
            L = len(m)
            if L < MINLEN or L > MAXLEN:
                dropped_len += 1; continue
            fr = fnum(row, ci['f'])
            if fr is None and not KEEP_EMPTY_FREQ:
                dropped_freq += 1; continue
            if fr is not None and fr < MINFREQ:
                dropped_freq += 1; continue
            e = {'m': m}
            allcols = ('p','l','g','f','fl','cd','old','pld','syll','cvo','cvp','puo','pup','mb','ms','md','prev','rt','nbhomoph','nbhomog')
            keep = os.environ.get('KEEPCOLS', '')
            cols = [c for c in allcols if c in keep.split(',')] if keep else allcols
            for k in cols:
                idx = ci.get(k, -1)
                if idx is None or idx < 0: continue
                if k in STR: v = fstr(row, idx)
                elif k in INT: v = fint(row, idx)
                else:
                    v = fnum(row, idx)
                    if v is not None and k in ROUND: v = round(v, ROUND[k])
                if v is not None and v != '':
                    e[k] = v
            frk = fr if fr is not None else -1.0
            prev = best.get(m)
            if prev is None or frk > prev[0]:
                best[m] = (frk, e)
            kept += 1
        # tri par fréquence décroissante (comme le blob historique : POURQUOI, COMMENT, …)
        words = [e for _, e in sorted(best.values(), key=lambda t: -t[0])]
        len_index = {}
        for i, e in enumerate(words):
            len_index.setdefault(str(len(e['m'])), []).append(i)
        blob = {
            'version': 'Lexique4_OMEGA_full_v1',
            'source': 'Lexique4.tsv (New et al. 2024) — CC BY-SA 4.0',
            'min_word_len': MINLEN, 'max_word_len': MAXLEN, 'min_freq_ortho': MINFREQ,
            'cgram_filter': 'NONE (all categories included)',
            'n_words': len(words),
            'columns_short': {
                'm':'mot UPPERCASE ASCII','p':'Phono Lexique4 code','l':'Lemme','g':'CGram (POS)',
                'f':'FreqOrtho (occ/M)','fl':'FreqLemme (occ/M)','cd':'CDOrtho','old':'OLD20','pld':'PLD20',
                'syll':'SyllNb','cvo':'CVOrtho','cvp':'CVPhono','puo':'PUOrtho','pup':'PUPhon',
                'mb':'MorphoBase','ms':'MorphoStruct','md':'MorphoDecomp','prev':'Prevalence (%)',
                'rt':'zRT_FLP','nbhomoph':'NbHomoph','nbhomog':'NbHomog'},
            'words': words, 'len_index': len_index,
        }
        raw_json = json.dumps(blob, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        gz = gzip.compress(raw_json, 9)
        b64 = base64.b64encode(gz)
        with open(OUT + '.json', 'wb') as fo: fo.write(raw_json)
        with open(OUT + '.b64', 'wb') as fo: fo.write(b64)
        print(f"[engine-lex] gardés={kept}  dédupliqués→{len(words)} mots uniques")
        print(f"             rejetés : longueur={dropped_len}  freq={dropped_freq}  non-ASCII={dropped_nonascii}")
        print(f"             JSON décompressé : {len(raw_json)/1e6:.2f} Mo  |  gzip : {len(gz)/1e6:.2f} Mo  |  base64 (embarqué) : {len(b64)/1e6:.2f} Mo")
        print(f"             config : MINLEN={MINLEN} MAXLEN={MAXLEN} MINFREQ={MINFREQ} KEEP_EMPTY_FREQ={KEEP_EMPTY_FREQ}")
        print(f"             → {OUT}.json  +  {OUT}.b64")
        # distribution par longueur
        from collections import Counter
        bylen = Counter(len(e['m']) for e in words)
        print("             par longueur :", {k: bylen[k] for k in sorted(bylen)})
        return 0

if __name__ == '__main__':
    sys.exit(main())
