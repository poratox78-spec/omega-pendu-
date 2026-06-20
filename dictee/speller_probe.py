# -*- coding: utf-8 -*-
# Moteur correcteur ORTHOGRAPHIQUE (non-mots) — 2 niveaux de confiance, mesuré sur le vrai corpus GEC.
#   AUTO  = remplace tout seul (l'app applique) : restauration d'accent NON AMBIGUË, ou typo distance-1 vers un
#           mot DOMINANT (fréquent, sans rival proche). Doit être quasi-FP=0 (change le texte en silence).
#   FLAG  = souligne (l'utilisateur clique) : candidat plausible mais incertain (rivaux, fréquence moyenne, élision).
#   None  = mot valide, ou nom propre, ou aucun bon candidat (néologisme) → on n'y touche pas.
# Ressources : Lexique4 (forme accentuée + fréquence). Phonétique = étape suivante.
import os, sys, csv, json, unicodedata, re
from collections import defaultdict

LEX = os.environ.get('LEX4', '/tmp/lex4/Lexique4.tsv')
GEC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'corpus_gec_fr.jsonl')
ALPHA = "abcdefghijklmnopqrstuvwxyz"
ELIDE = set("lmtsndcj")                       # consonnes d'élision (l', d', m', t', s', n', c', j', qu')
VOWELS = set("aeiouyh")                        # le mot élidé commence par voyelle/h
AUTO_FREQ = 1.0                                # fréquence min (occ/M) pour AUTO
FLAG_FREQ = 0.1                                # fréquence min pour FLAG
DOMINANCE = 5.0                               # rapport freq top/2e pour qu'un candidat soit "dominant" (AUTO)

def deacc(s):
    s = s.replace('œ', 'oe').replace('Œ', 'OE').replace('æ', 'ae').replace('Æ', 'AE')
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

TOK = re.compile(r"[A-Za-zÀ-ÿœŒæÆ]+")          # inclut œ/æ (sinon « sœur » casse en s/ur)

def load_lexicon():
    WORDS, FREQ, DEACC2ACC = set(), {}, defaultdict(list)
    with open(LEX, encoding='utf-8') as f:
        r = csv.reader(f, delimiter='\t'); H = next(r)
        ci = {h.lower(): i for i, h in enumerate(H)}
        cm = next(i for h, i in ci.items() if 'mot' in h)
        cf = next(i for h, i in ci.items() if 'freqortho' in h)
        for row in r:
            if len(row) <= max(cm, cf): continue
            w = (row[cm] or '').strip().lower()
            if not w or len(w) < 2 or not all(deacc(c) in ALPHA for c in w): continue
            try: fr = float((row[cf] or '0').replace(',', '.'))
            except ValueError: fr = 0.0
            if fr > FREQ.get(w, -1): FREQ[w] = fr
            WORDS.add(w)
    for w in WORDS:
        DEACC2ACC[deacc(w)].append(w)
    for d in DEACC2ACC:
        DEACC2ACC[d].sort(key=lambda w: -FREQ[w])
    return WORDS, FREQ, DEACC2ACC

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
    def __init__(self):
        self.WORDS, self.FREQ, self.D2A = load_lexicon()

    def _cands(self, d):
        """forme accentuée -> meilleure (priorité, freq). priorité 2 = accent-only, 1 = edit-1."""
        c = {}
        for w in self.D2A.get(d, []):
            c[w] = max(c.get(w, (0, 0)), (2, self.FREQ[w]))
        for e in edits1(d):
            for w in self.D2A.get(e, []):
                c[w] = max(c.get(w, (0, 0)), (1, self.FREQ[w]))
        return c

    def correct_token(self, tok, at_start=False):
        """-> (action 'auto'|'flag', suggestion) ou None."""
        low = tok.lower()
        if len(low) < 2 or not all(deacc(ch) in ALPHA for ch in low): return None
        if low in self.WORDS: return None                       # mot valide → ne pas toucher (couche grammaire s'en occupe)
        # nom propre : majuscule HORS début de phrase → on n'y touche pas
        if tok[:1].isupper() and not at_start: return None
        d = deacc(low)
        # élision : « lannée »→« l'année », « dautres »→« d'autres » (consonne d'élision + mot voyelle/h valide)
        if len(low) > 2 and low[0] in ELIDE and deacc(low[1])[:1] in VOWELS:
            rest = low[1:]
            if rest in self.WORDS:
                pre = "qu'" if low[0] == 'q' else low[0] + "'"
                return ('flag', pre + rest)                     # élision = FLAG (sûr mais on laisse l'utilisateur valider)
        cands = self._cands(d)
        if not cands: return None                               # aucun voisin → néologisme/nom propre → abstention
        ranked = sorted(cands.items(), key=lambda kv: (kv[1][0], kv[1][1]), reverse=True)
        (w1, (p1, f1)) = ranked[0]
        if f1 < FLAG_FREQ: return None                          # meilleur candidat trop rare → abstention
        f2 = ranked[1][1][1] if len(ranked) > 1 else 0.0
        # AUTO : accent-only dominant (priorité 2, fréquent, sans rival proche) OU edit-1 vers un mot très dominant
        accent_only = (p1 == 2 and deacc(w1) == d)
        dominant = (f1 >= AUTO_FREQ and (f2 == 0 or f1 >= DOMINANCE * f2))
        if len(d) >= 3 and accent_only and dominant: return ('auto', w1)
        if len(d) >= 3 and p1 == 2 and f1 >= AUTO_FREQ and len([1 for _w,(p,_f) in ranked if p == 2]) == 1:
            return ('auto', w1)                                 # une seule restauration d'accent possible → sûr
        return ('flag', w1)

    def correct_text(self, text):
        out = []; starts = self._sentence_starts(text)
        for m in TOK.finditer(text):
            r = self.correct_token(m.group(0), at_start=(m.start() in starts))
            if r and r[1] != m.group(0).lower():
                out.append((m.start(), m.group(0), r[1], r[0]))
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
            if hit and hit[1] == g.lower():
                if hit[2] == 'auto': okA += 1
                else: okF += 1
            elif len(miss) < 16: miss.append((b, g, hit[1] if hit else None))
    print(f"\n  [2] NON-MOTS (cible=1 mot) : {nw} | corrigés exactement : AUTO={okA} + FLAG={okF} = {okA+okF} ({100*(okA+okF)//max(1,nw)}%)")
    for b, g, s in miss: print(f"        {b} → {g}  | sugg={s}")
    return 0

if __name__ == '__main__':
    sys.exit(main())
