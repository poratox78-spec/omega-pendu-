# -*- coding: utf-8 -*-
# pos_en.py — DÉCODEUR de référence du POS-tagger ANGLAIS (HMM UPOS bigramme, Viterbi).
# Le modèle est produit par `build_pos_hmm.py --en` (UD English-EWT, CC BY-SA 4.0) ; CE fichier est la
# RÉFÉRENCE Python dont `corrector_en.js` est le miroir exact → parité vérifiable (`parity_pos_en.js`),
# même discipline que le FR (3 moteurs, mêmes scores, mêmes décisions).
# ⚠️ 16/09/2026 : les TROIS POST-PASSES du JS (#428 « that », #429 PROPN, #430 ADP/SCONJ) manquaient ici depuis le
# 08/08 — 2 630 tags divergents sur 62 309 tokens, invisibles parce que parity_pos_en.js ne tournait qu'en local.
# Les tables ci-dessous sont EXTRAITES du JS (littéraux identiques) ; parity_pos_en.js les compare à chaque CI.
#   from pos_en import tag_sentence, load_model
#   tag_sentence(['I','have','runned'], load_model()) -> ['PRON','AUX','VERB']
import io, os, json, math, gzip, re

_ASCII_LETTER = re.compile('[a-zA-Z]')
_ASCII_UPPER = re.compile('^[A-Z]')          # miroir JS : /^[A-Z]/ (ASCII), pas str.isupper() (Unicode : « Ã » y est une majuscule)

HERE = os.path.dirname(os.path.abspath(__file__))
_M = None

def load_model(path=None):
    """Charge pos_hmm_en.json (ou .gz). None si absent → l'appelant se passe du tagger (dégradation douce)."""
    global _M
    if _M is not None: return _M
    p = path or os.path.join(HERE, 'pos_hmm_en.json')
    try:
        if os.path.exists(p):
            _M = json.load(io.open(p, encoding='utf-8'))
        elif os.path.exists(p + '.gz'):
            with gzip.open(p + '.gz', 'rt', encoding='utf-8') as f: _M = json.load(f)
    except Exception:
        _M = None
    return _M

def tag_sentence(words, M=None):
    """Viterbi bigramme -> liste d'UPOS alignée sur `words`. [] si pas de modèle."""
    M = M or load_model()
    if not M or not words: return []
    tags = M['tags']; tr = M['trans']; em = M['emit']; suf = M['suf']; pri = M['prior']; FL = M['floor']
    def lt(a, b): return tr.get(a, {}).get(b, FL)
    def le(t, w):
        lw = w.lower()
        # une suite de lettres n'est jamais PUNCT/SYM (garde reprise du FR)
        if (t == 'PUNCT' or t == 'SYM') and _ASCII_LETTER.search(lw): return -100.0     # miroir JS : /[a-z]/i
        if lw in em: return em[lw].get(t, FL)
        for k in (4, 3, 2):                                  # backoff par suffixe (mots rares)
            if len(lw) >= k and lw[-k:] in suf:
                d = suf[lw[-k:]]
                return d.get(t, FL) + (math.log(1.1) if (_ASCII_UPPER.match(w) and t == 'PROPN') else 0.0)
        return pri.get(t, FL) + (math.log(3.0) if (_ASCII_UPPER.match(w) and t == 'PROPN') else 0.0)
    n = len(words)
    V = [{}]; bk = [{}]
    for t in tags: V[0][t] = lt('<s>', t) + le(t, words[0]); bk[0][t] = '<s>'
    for i in range(1, n):
        V.append({}); bk.append({})
        for t in tags:
            et = le(t, words[i]); best = -1e18; bp = None
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
    return _amb_pass(words, _that_pass(words, _propn_pass(words, seq[::-1])))


# ---- POST-PASSES (miroir exact de corrector_en.js : _propnPass -> _thatPass -> _ambPass, l'ordre compte) ----
# PROPN : la table d'émission est indexée en minuscules, la MAJUSCULE interne est donc jetée par le Viterbi ;
# on bascule NOUN/ADJ -> PROPN sur un mot capitalisé hors tête de phrase, hors acronymes, hors après . ! ? : ;
_CAP_WORD = re.compile('^[A-Z][a-z]')
_SENT_END = re.compile('^[.!?:;]$')
def _propn_pass(words, seq):
    for i in range(1, len(words)):
        w = str(words[i] or '')
        if not _CAP_WORD.match(w): continue
        if _SENT_END.match(str(words[i-1] or '')): continue
        if seq[i] == 'NOUN' or seq[i] == 'ADJ': seq[i] = 'PROPN'
    return seq

# « that » (SCONJ / PRON / DET) : table (tag gauche | tag droit) -> tag, apprise sur GUM seul, 61 contextes ;
# ADP/SCONJ ambigus (of, as, for, …) : table (mot | tag gauche | tag droit) -> tag, 638 contextes. Ailleurs : le Viterbi.
_AMB_W = frozenset(["of","as","after","for","by","in","than","since","until","while","before","with","on","about","so","though","although","because","if","when","once","unless","whether"])
_AMB_CTX = {"of|PROPN|PROPN": "ADP", "of|NOUN|ADJ": "ADP", "on|VERB|PUNCT": "ADP", "on|NOUN|ADV": "ADP", "of|NOUN|NOUN": "ADP", "of|NOUN|ADV": "ADP", "about|VERB|PRON": "ADP", "on|VERB|DET": "ADP", "of|NOUN|DET": "ADP", "in|VERB|NOUN": "ADP", "in|NOUN|NOUN": "ADP", "while|<s>|NOUN": "SCONJ", "on|VERB|ADJ": "ADP", "in|<s>|DET": "ADP", "on|NOUN|DET": "ADP", "on|NOUN|PROPN": "ADP", "in|NOUN|PROPN": "ADP", "as|NOUN|ADV": "ADV", "as|NOUN|DET": "ADP", "of|NOUN|PRON": "ADP", "of|PROPN|DET": "ADP", "when|<s>|VERB": "ADV", "by|VERB|ADJ": "ADP", "by|VERB|DET": "ADP", "in|NOUN|DET": "ADP", "for|VERB|NOUN": "ADP", "of|NOUN|PROPN": "ADP", "on|AUX|NOUN": "ADP", "for|PROPN|ADP": "ADP", "of|ADJ|PRON": "ADP", "of|PUNCT|PRON": "ADP", "by|NOUN|PROPN": "ADP", "of|NOUN|PUNCT": "ADP", "in|NOUN|PRON": "ADP", "in|NOUN|ADJ": "ADP", "on|NOUN|NOUN": "ADP", "in|NOUN|VERB": "SCONJ", "of|DET|DET": "ADP", "as|<s>|DET": "ADP", "by|PUNCT|VERB": "SCONJ", "with|NOUN|ADJ": "ADP", "in|ADJ|ADJ": "ADP", "about|NOUN|DET": "ADP", "in|ADV|DET": "ADP", "for|<s>|ADJ": "ADP", "for|NOUN|NOUN": "ADP", "for|<s>|NOUN": "ADP", "on|PUNCT|DET": "ADP", "as|ADJ|NOUN": "ADP", "for|NOUN|ADJ": "ADP", "although|<s>|ADJ": "SCONJ", "of|NUM|DET": "ADP", "by|PUNCT|NOUN": "ADP", "of|NOUN|NUM": "ADP", "on|NOUN|ADJ": "ADP", "in|ADJ|NOUN": "ADP", "in|<s>|NOUN": "ADP", "on|ADJ|DET": "ADP", "for|VERB|ADJ": "ADP", "of|ADJ|NOUN": "ADP", "for|NOUN|DET": "ADP", "in|NOUN|ADV": "ADP", "by|<s>|VERB": "SCONJ", "by|NOUN|DET": "ADP", "on|VERB|NOUN": "ADP", "for|ADJ|VERB": "SCONJ", "in|<s>|ADJ": "ADP", "by|VERB|VERB": "SCONJ", "in|VERB|NUM": "ADP", "by|VERB|PRON": "ADP", "in|PROPN|PROPN": "ADP", "by|VERB|PROPN": "ADP", "for|<s>|PRON": "ADP", "of|<s>|NOUN": "ADP", "for|ADV|ADJ": "ADP", "if|<s>|PRON": "SCONJ", "on|<s>|DET": "ADP", "in|VERB|DET": "ADP", "if|PUNCT|ADJ": "SCONJ", "for|NOUN|PRON": "ADP", "because|NOUN|PRON": "SCONJ", "in|PRON|NOUN": "ADP", "as|PUNCT|AUX": "SCONJ", "by|ADV|DET": "ADP", "for|CCONJ|VERB": "SCONJ", "if|PRON|PRON": "SCONJ", "if|<s>|DET": "SCONJ", "in|PUNCT|PRON": "ADP", "in|VERB|ADJ": "ADP", "as|VERB|DET": "ADP", "as|PUNCT|VERB": "SCONJ", "of|ADV|PROPN": "ADP", "of|AUX|DET": "ADP", "of|CCONJ|PRON": "ADP", "in|VERB|PROPN": "ADP", "when|NOUN|DET": "ADV", "in|<s>|PROPN": "ADP", "by|NOUN|ADJ": "ADP", "for|NUM|DET": "ADP", "for|PUNCT|DET": "ADP", "for|PUNCT|NOUN": "ADP", "on|VERB|PROPN": "ADP", "if|PUNCT|VERB": "SCONJ", "for|ADV|NOUN": "ADP", "on|PUNCT|PROPN": "ADP", "on|PUNCT|ADJ": "ADP", "in|PUNCT|PROPN": "ADP", "as|PUNCT|ADV": "ADV", "for|ADJ|DET": "ADP", "if|ADV|DET": "SCONJ", "in|ADP|DET": "ADP", "so|NOUN|ADV": "ADV", "if|<s>|NOUN": "SCONJ", "by|VERB|NOUN": "ADP", "for|PRON|NOUN": "ADP", "with|ADV|DET": "ADP", "with|PRON|DET": "ADP", "for|VERB|DET": "ADP", "when|PUNCT|VERB": "ADV", "in|NOUN|NUM": "ADP", "although|PUNCT|DET": "SCONJ", "with|PUNCT|DET": "ADP", "than|NOUN|DET": "ADP", "with|PROPN|DET": "ADP", "when|<s>|DET": "ADV", "for|PRON|DET": "ADP", "of|ADJ|DET": "ADP", "for|CCONJ|DET": "ADP", "with|NOUN|NOUN": "ADP", "of|VERB|NOUN": "ADP", "on|VERB|PRON": "ADP", "with|NOUN|DET": "ADP", "for|<s>|DET": "ADP", "while|PUNCT|VERB": "SCONJ", "since|PUNCT|PRON": "SCONJ", "with|<s>|NOUN": "ADP", "on|NOUN|VERB": "SCONJ", "on|CCONJ|DET": "ADP", "than|ADV|NUM": "ADP", "of|SCONJ|PRON": "ADP", "in|ADV|NOUN": "ADP", "of|ADJ|ADJ": "ADP", "of|PUNCT|DET": "ADP", "as|ADV|NOUN": "ADP", "with|VERB|DET": "ADP", "after|CCONJ|DET": "ADP", "of|PROPN|NOUN": "ADP", "of|VERB|NUM": "ADP", "before|NOUN|CCONJ": "ADP", "by|VERB|NUM": "ADP", "while|PUNCT|DET": "SCONJ", "after|NOUN|DET": "ADP", "in|CCONJ|DET": "ADP", "by|PART|DET": "ADP", "by|PROPN|PROPN": "ADP", "by|PROPN|NOUN": "ADP", "while|<s>|DET": "SCONJ", "of|VERB|ADV": "ADP", "than|NOUN|NOUN": "ADP", "about|AUX|DET": "ADV", "as|ADJ|DET": "ADP", "of|NOUN|AUX": "SCONJ", "in|PUNCT|NOUN": "ADP", "in|PUNCT|ADJ": "ADP", "so|AUX|ADJ": "ADV", "in|ADJ|DET": "ADP", "by|CCONJ|DET": "ADP", "with|ADV|ADJ": "ADP", "so|VERB|ADV": "ADV", "as|CCONJ|DET": "ADP", "in|PUNCT|DET": "ADP", "by|<s>|NOUN": "ADP", "in|PRON|NUM": "ADP", "about|VERB|DET": "ADP", "by|ADV|NOUN": "ADP", "in|CCONJ|NOUN": "ADP", "with|PUNCT|ADJ": "ADP", "as|VERB|SCONJ": "SCONJ", "in|VERB|PRON": "ADP", "of|ADV|NUM": "ADP", "because|VERB|PRON": "SCONJ", "as|ADJ|PRON": "SCONJ", "in|AUX|DET": "ADP", "when|VERB|VERB": "ADV", "for|ADV|DET": "ADP", "with|VERB|NOUN": "ADP", "in|NUM|DET": "ADP", "with|VERB|ADJ": "ADP", "than|ADJ|NUM": "ADP", "in|NUM|NOUN": "ADP", "as|ADJ|PROPN": "ADP", "as|<s>|ADP": "ADP", "for|VERB|PROPN": "ADP", "as|NOUN|VERB": "SCONJ", "of|SYM|DET": "ADP", "of|DET|PRON": "ADP", "of|ADV|DET": "ADP", "for|VERB|PRON": "ADP", "than|ADV|ADJ": "ADP", "when|<s>|NOUN": "ADV", "of|VERB|PUNCT": "ADP", "as|NOUN|NOUN": "ADP", "about|NOUN|NOUN": "ADP", "for|PROPN|PROPN": "ADP", "for|NOUN|PROPN": "ADP", "for|NOUN|VERB": "SCONJ", "of|NOUN|ADP": "ADP", "on|ADP|NOUN": "ADP", "so|PUNCT|PRON": "ADV", "when|NOUN|VERB": "ADV", "as|ADV|PART": "ADP", "for|PROPN|DET": "ADP", "for|NOUN|NUM": "ADP", "of|PUNCT|NOUN": "ADP", "as|PUNCT|PRON": "SCONJ", "as|VERB|NOUN": "ADP", "of|VERB|DET": "ADP", "on|CCONJ|PRON": "ADP", "for|ADJ|PROPN": "ADP", "with|ADV|NOUN": "ADP", "by|PUNCT|DET": "ADP", "about|ADP|NUM": "ADV", "for|ADJ|ADJ": "ADP", "of|VERB|PROPN": "ADP", "by|NOUN|VERB": "SCONJ", "whether|PUNCT|DET": "SCONJ", "for|ADV|PROPN": "ADP", "with|ADJ|DET": "ADP", "than|ADJ|NOUN": "ADP", "of|ADJ|PROPN": "ADP", "because|<s>|PRON": "SCONJ", "if|NOUN|DET": "SCONJ", "than|NOUN|ADP": "SCONJ", "because|NOUN|ADP": "ADP", "of|ADP|ADJ": "ADP", "in|ADV|ADJ": "ADP", "in|<s>|PRON": "ADP", "while|NOUN|VERB": "SCONJ", "than|ADV|ADP": "ADP", "in|ADJ|VERB": "SCONJ", "than|ADV|ADV": "ADP", "with|VERB|PRON": "ADP", "for|<s>|PROPN": "ADP", "of|AUX|ADJ": "ADP", "as|NOUN|PRON": "SCONJ", "with|NOUN|PROPN": "ADP", "in|PRON|VERB": "SCONJ", "by|ADJ|DET": "ADP", "of|AUX|NOUN": "ADP", "for|CCONJ|PRON": "ADP", "after|<s>|DET": "ADP", "of|PUNCT|PROPN": "ADP", "with|NOUN|PRON": "ADP", "in|PROPN|PRON": "ADP", "until|NOUN|PRON": "SCONJ", "because|PUNCT|PRON": "SCONJ", "in|VERB|ADP": "ADP", "in|PROPN|NOUN": "ADP", "in|PROPN|NUM": "ADP", "with|NUM|DET": "ADP", "for|ADP|DET": "ADP", "so|VERB|SCONJ": "SCONJ", "on|ADV|NOUN": "ADP", "in|PUNCT|NUM": "ADP", "when|NOUN|PRON": "ADV", "in|PRON|DET": "ADP", "with|PROPN|NOUN": "ADP", "as|VERB|PROPN": "ADP", "of|VERB|PRON": "ADP", "than|ADV|DET": "ADP", "by|ADV|PROPN": "ADP", "with|VERB|PROPN": "ADP", "in|<s>|NUM": "ADP", "in|ADV|NUM": "ADP", "for|ADV|PRON": "ADP", "of|VERB|ADJ": "ADP", "with|PROPN|PROPN": "ADP", "in|ADV|PRON": "ADP", "on|PROPN|PROPN": "ADP", "in|PROPN|DET": "ADP", "on|PROPN|DET": "ADP", "when|PROPN|PRON": "ADV", "while|<s>|PRON": "SCONJ", "when|VERB|DET": "ADV", "in|AUX|PROPN": "ADP", "of|ADJ|NUM": "ADP", "in|ADV|PROPN": "ADP", "so|CCONJ|ADP": "ADV", "on|ADV|PUNCT": "ADV", "while|PUNCT|ADV": "SCONJ", "of|NUM|PROPN": "ADP", "with|PUNCT|PROPN": "ADP", "as|VERB|NUM": "ADP", "by|PUNCT|PROPN": "ADP", "after|<s>|NUM": "ADP", "of|ADV|PRON": "ADP", "after|NOUN|PRON": "SCONJ", "although|PUNCT|PRON": "SCONJ", "while|<s>|PROPN": "SCONJ", "on|VERB|NUM": "ADP", "on|NOUN|NUM": "ADP", "as|NOUN|ADP": "ADP", "before|NOUN|PRON": "SCONJ", "on|PRON|PRON": "ADP", "if|VERB|PRON": "SCONJ", "if|CCONJ|PRON": "SCONJ", "after|PUNCT|VERB": "SCONJ", "for|PUNCT|PRON": "ADP", "as|NOUN|PROPN": "ADP", "as|<s>|ADV": "ADV", "since|PROPN|NUM": "ADP", "in|NUM|PROPN": "ADP", "in|PRON|ADJ": "ADP", "in|PROPN|ADJ": "ADP", "in|CCONJ|NUM": "ADP", "in|PRON|PROPN": "ADP", "in|ADP|PROPN": "ADP", "with|CCONJ|DET": "ADP", "for|AUX|DET": "ADP", "with|AUX|PRON": "ADP", "when|PRON|PRON": "ADV", "as|ADV|PRON": "SCONJ", "as|PROPN|DET": "ADP", "as|NOUN|PUNCT": "ADP", "as|PRON|DET": "ADP", "about|VERB|ADJ": "ADP", "on|AUX|DET": "ADP", "when|<s>|PRON": "ADV", "with|PRON|NOUN": "ADP", "if|PUNCT|NOUN": "SCONJ", "when|ADV|VERB": "ADV", "with|<s>|DET": "ADP", "as|<s>|PRON": "SCONJ", "of|NUM|PRON": "ADP", "of|ADP|NOUN": "ADP", "while|<s>|ADV": "SCONJ", "in|VERB|CCONJ": "ADP", "for|ADP|NOUN": "ADP", "after|<s>|VERB": "SCONJ", "with|NOUN|NUM": "ADP", "with|PROPN|NUM": "ADP", "on|<s>|PROPN": "ADP", "after|PROPN|VERB": "SCONJ", "in|NUM|NUM": "ADP", "so|NOUN|ADJ": "ADV", "in|ADJ|PRON": "ADP", "with|ADV|PROPN": "ADP", "for|PUNCT|PROPN": "ADP", "on|ADP|PROPN": "ADP", "by|<s>|DET": "ADP", "of|PROPN|NUM": "ADP", "by|PROPN|DET": "ADP", "of|AUX|PROPN": "ADP", "when|PUNCT|PRON": "ADV", "with|PROPN|PRON": "ADP", "as|VERB|PRON": "SCONJ", "though|PUNCT|ADV": "ADV", "on|VERB|ADV": "ADP", "of|PRON|DET": "ADP", "with|PUNCT|PRON": "ADP", "on|NOUN|PRON": "ADP", "about|ADV|NUM": "ADV", "on|ADP|DET": "ADP", "than|ADJ|ADV": "ADP", "in|AUX|NOUN": "ADP", "because|ADV|PRON": "SCONJ", "of|ADP|PROPN": "ADP", "about|VERB|NUM": "ADV", "with|ADJ|PRON": "ADP", "as|PROPN|NOUN": "ADP", "of|CCONJ|NOUN": "ADP", "after|PUNCT|NUM": "ADP", "before|NOUN|DET": "ADP", "on|VERB|ADP": "ADP", "as|PROPN|PRON": "ADP", "for|ADJ|PRON": "ADP", "though|PUNCT|PRON": "SCONJ", "of|CCONJ|DET": "ADP", "for|PUNCT|ADJ": "ADP", "in|CCONJ|ADJ": "ADP", "while|SCONJ|PRON": "SCONJ", "after|NOUN|VERB": "SCONJ", "as|PROPN|ADV": "ADV", "while|PUNCT|PRON": "SCONJ", "although|<s>|PRON": "SCONJ", "than|ADJ|PROPN": "ADP", "for|PROPN|ADJ": "ADP", "when|ADP|PRON": "ADV", "though|PUNCT|DET": "SCONJ", "for|NOUN|ADV": "ADP", "about|PUNCT|NUM": "ADV", "in|PUNCT|PUNCT": "ADP", "so|CCONJ|PRON": "ADV", "on|ADV|PROPN": "ADP", "in|ADJ|PROPN": "ADP", "about|AUX|PUNCT": "ADP", "in|AUX|PRON": "ADP", "as|PRON|PRON": "SCONJ", "about|PRON|DET": "ADP", "of|ADV|NOUN": "ADP", "with|ADJ|NOUN": "ADP", "in|PRON|PUNCT": "ADP", "so|CCONJ|PUNCT": "ADV", "when|VERB|PRON": "ADV", "in|VERB|ADV": "ADP", "if|PUNCT|PRON": "SCONJ", "so|VERB|ADJ": "ADV", "as|PART|ADJ": "ADV", "as|PUNCT|SCONJ": "SCONJ", "for|PRON|NUM": "ADP", "in|ADP|PRON": "ADP", "by|VERB|PUNCT": "ADP", "for|PUNCT|ADP": "ADP", "with|ADP|DET": "ADP", "of|ADP|PRON": "ADP", "as|AUX|ADV": "ADV", "in|ADJ|ADV": "ADP", "for|PRON|ADP": "ADP", "on|ADJ|PRON": "ADP", "on|PUNCT|PRON": "ADP", "about|VERB|PUNCT": "ADP", "on|NOUN|ADP": "ADP", "so|<s>|ADJ": "ADV", "in|PART|DET": "ADP", "for|VERB|PUNCT": "ADP", "in|CCONJ|PROPN": "ADP", "though|NOUN|PUNCT": "ADV", "as|AUX|ADJ": "ADV", "as|CCONJ|PRON": "SCONJ", "when|PUNCT|DET": "ADV", "so|PUNCT|ADV": "ADV", "when|AUX|PRON": "ADV", "if|ADV|PRON": "SCONJ", "about|PRON|PRON": "ADP", "by|NOUN|NUM": "ADP", "about|NOUN|PROPN": "ADP", "so|AUX|VERB": "ADV", "until|VERB|PRON": "SCONJ", "about|PRON|NOUN": "ADP", "for|ADJ|NOUN": "ADP", "for|VERB|NUM": "ADP", "of|PUNCT|PUNCT": "ADP", "with|<s>|PRON": "ADP", "with|VERB|PUNCT": "ADP", "about|VERB|NOUN": "ADP", "so|PUNCT|ADJ": "ADV", "for|PRON|ADV": "ADP", "with|PRON|PRON": "ADP", "with|ADV|PRON": "ADP", "on|ADV|PRON": "ADP", "so|<s>|AUX": "ADV", "unless|PUNCT|PRON": "SCONJ", "on|AUX|PRON": "ADP", "with|<s>|PROPN": "ADP", "of|ADJ|ADP": "ADP", "on|PRON|DET": "ADP", "on|NOUN|PUNCT": "ADP", "so|PUNCT|PUNCT": "ADV", "since|ADV|PRON": "SCONJ", "so|PUNCT|PART": "ADV", "about|AUX|NUM": "ADV", "so|ADV|ADV": "ADV", "about|VERB|ADP": "ADP", "since|<s>|PRON": "SCONJ", "on|NUM|DET": "ADP", "as|PRON|ADV": "ADV", "on|CCONJ|NOUN": "ADP", "as|<s>|PROPN": "SCONJ", "after|ADV|DET": "ADP", "about|ADV|PRON": "ADP", "before|PUNCT|PRON": "SCONJ", "for|VERB|ADP": "ADP", "as|PUNCT|ADP": "ADP", "so|AUX|ADP": "ADV", "when|ADV|PRON": "ADV", "of|ADV|ADV": "ADP", "of|ADV|ADJ": "ADP", "because|NOUN|ADV": "SCONJ", "because|NOUN|PUNCT": "SCONJ", "because|NOUN|PROPN": "SCONJ", "because|PUNCT|ADV": "SCONJ", "of|PUNCT|ADJ": "ADP", "because|ADJ|PUNCT": "SCONJ", "on|ADV|DET": "ADP", "because|SCONJ|PRON": "SCONJ", "so|CCONJ|DET": "ADV", "when|CCONJ|PRON": "ADV", "in|AUX|ADJ": "ADP", "on|PROPN|NOUN": "ADP", "of|ADP|NUM": "ADP", "about|NOUN|SCONJ": "SCONJ", "whether|PUNCT|PRON": "SCONJ", "of|ADP|DET": "ADP", "with|PUNCT|NOUN": "ADP", "on|AUX|PROPN": "ADP", "because|AUX|PRON": "SCONJ", "of|ADV|VERB": "ADP", "because|ADJ|DET": "SCONJ", "for|PRON|ADJ": "ADP", "by|ADV|VERB": "SCONJ", "although|<s>|DET": "SCONJ", "so|VERB|ADP": "ADV", "on|PRON|NOUN": "ADP", "because|ADJ|PRON": "SCONJ", "about|NOUN|PUNCT": "ADP", "as|ADJ|PUNCT": "ADP", "about|NOUN|PRON": "ADP", "on|ADP|PRON": "ADP", "because|PUNCT|DET": "SCONJ", "whether|AUX|PRON": "SCONJ", "so|PRON|PRON": "ADV", "about|ADJ|DET": "ADP", "because|NOUN|DET": "SCONJ", "after|NOUN|NOUN": "ADP", "on|PRON|PROPN": "ADP", "so|<s>|SCONJ": "ADV", "so|VERB|PUNCT": "ADV", "whether|VERB|DET": "SCONJ", "as|ADV|ADP": "ADP", "if|PUNCT|DET": "SCONJ", "because|ADV|DET": "SCONJ", "in|AUX|VERB": "ADP", "though|PUNCT|PUNCT": "ADV", "if|NOUN|PRON": "SCONJ", "by|ADJ|NOUN": "ADP", "until|PUNCT|PRON": "SCONJ", "as|SCONJ|DET": "ADP", "of|PRON|NOUN": "ADP", "because|PUNCT|ADP": "ADP", "in|SCONJ|DET": "ADP", "by|<s>|PROPN": "ADP", "by|NOUN|PUNCT": "PROPN", "while|ADV|PRON": "SCONJ", "with|ADP|NOUN": "ADP", "than|ADV|NOUN": "ADP", "of|SCONJ|NOUN": "ADP", "about|NOUN|ADV": "ADP", "in|PRON|PRON": "ADP", "in|ADP|NOUN": "ADP", "than|ADJ|DET": "ADP", "because|AUX|DET": "SCONJ", "while|DET|ADP": "NOUN", "of|NOUN|SYM": "ADP", "so|ADP|ADJ": "ADV", "after|VERB|DET": "ADP", "about|VERB|PROPN": "ADP", "for|PROPN|VERB": "SCONJ", "after|VERB|PROPN": "ADP", "when|ADJ|PRON": "ADV", "of|SCONJ|DET": "ADP", "because|AUX|NOUN": "SCONJ", "in|ADP|ADJ": "ADP", "with|PRON|ADJ": "ADP", "about|VERB|VERB": "SCONJ", "though|ADV|PRON": "SCONJ", "when|<s>|PROPN": "ADV", "when|PUNCT|PROPN": "ADV", "with|NOUN|ADV": "ADP", "as|CCONJ|ADV": "ADV", "of|ADJ|ADV": "ADP", "while|DET|PUNCT": "NOUN", "before|NOUN|VERB": "SCONJ", "in|PRON|ADP": "ADP", "before|PROPN|PUNCT": "ADV", "with|NOUN|VERB": "ADP", "for|PUNCT|ADV": "SCONJ", "when|CCONJ|DET": "ADV", "of|PRON|PRON": "ADP", "so|AUX|ADV": "ADV", "before|VERB|PUNCT": "ADV", "as|NOUN|SCONJ": "SCONJ", "with|CCONJ|NOUN": "ADP", "while|NOUN|DET": "SCONJ", "before|PRON|PUNCT": "ADV", "once|<s>|PRON": "SCONJ", "so|ADV|SCONJ": "SCONJ", "when|ADV|DET": "ADV", "with|VERB|ADV": "ADP", "because|PUNCT|PROPN": "SCONJ", "than|ADJ|ADJ": "ADP", "so|PRON|ADV": "ADV", "with|NOUN|PUNCT": "ADP", "so|PUNCT|VERB": "ADV", "when|<s>|AUX": "ADV", "for|ADV|NUM": "ADP", "for|CCONJ|NOUN": "ADP", "when|SCONJ|PRON": "ADV", "whether|VERB|PRON": "SCONJ", "so|PUNCT|NUM": "INTJ", "if|VERB|DET": "SCONJ", "on|VERB|VERB": "SCONJ", "than|ADV|VERB": "ADP", "of|NUM|NUM": "ADP", "because|ADV|ADP": "ADP", "as|ADJ|AUX": "ADP", "with|ADJ|PROPN": "ADP", "for|PRON|PRON": "ADP", "so|PRON|ADJ": "ADV", "of|PROPN|PRON": "ADP", "as|VERB|PUNCT": "ADP", "on|ADV|ADJ": "ADP", "for|PRON|PROPN": "ADP", "in|ADV|PUNCT": "ADP", "so|NOUN|SCONJ": "SCONJ", "by|NOUN|PRON": "ADP", "in|CCONJ|VERB": "SCONJ", "of|PROPN|ADJ": "ADP", "of|DET|PROPN": "ADP", "for|VERB|ADV": "ADP", "about|NOUN|ADJ": "ADP", "so|ADV|ADJ": "ADV", "if|ADJ|PRON": "SCONJ", "for|VERB|CCONJ": "ADP", "as|ADP|DET": "ADP", "so|CCONJ|ADV": "ADV", "for|NOUN|PUNCT": "ADP", "by|ADP|DET": "ADP", "after|ADV|VERB": "SCONJ", "because|PRON|PRON": "SCONJ", "about|ADJ|PRON": "ADP", "because|VERB|ADP": "ADP", "of|VERB|ADP": "ADP", "for|NOUN|ADP": "ADP", "because|<s>|NOUN": "SCONJ", "once|PUNCT|PRON": "SCONJ", "if|CCONJ|NOUN": "SCONJ", "as|ADJ|NUM": "ADP", "on|<s>|PRON": "ADP", "so|PUNCT|AUX": "ADV", "on|NOUN|CCONJ": "ADP", "so|INTJ|PRON": "INTJ", "so|ADJ|PRON": "ADV", "as|ADP|ADJ": "ADV", "in|VERB|</s>": "ADV", "if|<s>|VERB": "SCONJ", "once|NOUN|PRON": "SCONJ", "as|PUNCT|PUNCT": "ADP", "once|<s>|DET": "SCONJ"}
_THAT_CTX = {"<s>|AUX": "PRON", "<s>|NOUN": "DET", "<s>|VERB": "PRON", "ADJ|ADJ": "SCONJ", "ADJ|ADV": "SCONJ", "ADJ|AUX": "PRON", "ADJ|DET": "SCONJ", "ADJ|PRON": "SCONJ", "ADP|ADJ": "DET", "ADP|ADP": "PRON", "ADP|ADV": "PRON", "ADP|AUX": "PRON", "ADP|NOUN": "DET", "ADP|PUNCT": "PRON", "ADV|ADJ": "ADV", "ADV|ADV": "SCONJ", "ADV|AUX": "PRON", "ADV|DET": "SCONJ", "ADV|NOUN": "DET", "ADV|PRON": "SCONJ", "ADV|PUNCT": "PRON", "ADV|VERB": "PRON", "AUX|ADV": "PRON", "AUX|AUX": "PRON", "AUX|DET": "SCONJ", "AUX|PRON": "SCONJ", "AUX|PUNCT": "PRON", "AUX|VERB": "PRON", "CCONJ|ADV": "SCONJ", "CCONJ|AUX": "PRON", "CCONJ|DET": "SCONJ", "CCONJ|PRON": "SCONJ", "CCONJ|VERB": "PRON", "INTJ|AUX": "PRON", "NOUN|ADP": "SCONJ", "NOUN|ADV": "PRON", "NOUN|AUX": "PRON", "NOUN|PART": "PRON", "NOUN|VERB": "PRON", "NUM|AUX": "PRON", "PRON|AUX": "PRON", "PRON|DET": "SCONJ", "PRON|VERB": "PRON", "PROPN|AUX": "PRON", "PROPN|VERB": "PRON", "PUNCT|ADV": "PRON", "PUNCT|AUX": "PRON", "PUNCT|DET": "SCONJ", "PUNCT|PRON": "SCONJ", "PUNCT|VERB": "PRON", "SCONJ|AUX": "PRON", "SCONJ|NOUN": "DET", "SCONJ|PUNCT": "PRON", "SCONJ|VERB": "PRON", "VERB|AUX": "PRON", "VERB|DET": "SCONJ", "VERB|NUM": "SCONJ", "VERB|PRON": "SCONJ", "VERB|PROPN": "SCONJ", "VERB|PUNCT": "PRON", "VERB|SCONJ": "SCONJ"}
def _that_pass(words, seq):
    for i in range(len(words)):
        if str(words[i] or '').lower() != 'that': continue
        k = (seq[i-1] if i > 0 else '<s>') + '|' + (seq[i+1] if i + 1 < len(words) else '</s>')
        t = _THAT_CTX.get(k)
        if t: seq[i] = t
    return seq

def _amb_pass(words, seq):
    for i in range(len(words)):
        w = str(words[i] or '').lower()
        if w not in _AMB_W: continue
        k = w + '|' + (seq[i-1] if i > 0 else '<s>') + '|' + (seq[i+1] if i + 1 < len(words) else '</s>')
        t = _AMB_CTX.get(k)
        if t: seq[i] = t
    return seq

if __name__ == '__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    M = load_model()
    print('modèle :', 'absent' if not M else '%d tags, %d mots émis' % (len(M['tags']), len(M['emit'])))
    for s in ['Their is no point .'.split(), 'I put it over there .'.split(),
              'You are going to their house .'.split(), 'He have runned fast .'.split()]:
        print(' ', ' '.join('%s/%s' % (w, t) for w, t in zip(s, tag_sentence(s, M))))
