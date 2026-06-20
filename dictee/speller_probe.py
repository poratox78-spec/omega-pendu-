# -*- coding: utf-8 -*-
# PROTOTYPE correcteur ORTHOGRAPHIQUE (non-mots / accents / typos) — mesuré sur le vrai corpus GEC.
# But : dépasser les règles seules. Corrige un NON-MOT (forme absente du lexique) en cherchant le meilleur
# candidat : restauration d'accents + distance d'édition 1 (en espace déaccentué) + classement par FRÉQUENCE.
# N'utilise QUE des ressources qu'on a (Lexique4 : forme accentuée, fréquence). Phonétique = étape suivante.
#
# Garde-fou : ne JAMAIS toucher un mot valide (forme accentuée présente) → pas de FP cardinal. Abstention si
# aucun candidat proche (proche = distance 1 en déacc) → laisse les noms propres/néologismes (Walserhof…).
import os, sys, csv, json, unicodedata, re
from collections import defaultdict

LEX = os.environ.get('LEX4', '/tmp/lex4/Lexique4.tsv')
GEC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'corpus_gec_fr.jsonl')
ALPHA = "abcdefghijklmnopqrstuvwxyz"

def deacc(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def load_lexicon():
    WORDS = set()                 # formes accentuées valides (minuscule)
    FREQ = {}                     # forme accentuée -> fréquence max
    DEACC2ACC = defaultdict(list) # deacc -> [(forme accentuée, freq)]
    with open(LEX, encoding='utf-8') as f:
        r = csv.reader(f, delimiter='\t'); H = next(r)
        ci = {h.lower(): i for i, h in enumerate(H)}
        cm = next(i for h, i in ci.items() if 'mot' in h)
        cf = next(i for h, i in ci.items() if 'freqortho' in h)
        for row in r:
            if len(row) <= max(cm, cf): continue
            w = (row[cm] or '').strip().lower()
            # mot simple : lettres (accentuées) seulement, ≥2 — pas d'apostrophe/trait/espace pour ce proto
            if not w or not all(deacc(c) in ALPHA for c in w) or len(w) < 2: continue
            try: fr = float((row[cf] or '0').replace(',', '.'))
            except ValueError: fr = 0.0
            if w not in FREQ or fr > FREQ[w]:
                FREQ[w] = fr
            WORDS.add(w)
        for w in WORDS:
            DEACC2ACC[deacc(w)].append((w, FREQ[w]))
        for d in DEACC2ACC:
            DEACC2ACC[d].sort(key=lambda t: -t[1])
    return WORDS, FREQ, DEACC2ACC

def edits1_deacc(d):
    splits = [(d[:i], d[i:]) for i in range(len(d) + 1)]
    res = set()
    for a, b in splits:
        if b: res.add(a + b[1:])                       # delete
        if len(b) > 1: res.add(a + b[1] + b[0] + b[2:]) # transpose
        for c in ALPHA:
            res.add(a + c + b)                          # insert
            if b: res.add(a + c + b[1:])                # substitute
    return res

def best_correction(tok, WORDS, FREQ, DEACC2ACC, MINFREQ=0.5):
    """Renvoie (forme accentuée suggérée) si tok est un NON-MOT corrigeable, sinon None (valide ou abstention)."""
    low = tok.lower()
    if not low or not all(deacc(c) in ALPHA for c in low) or len(low) < 2: return None
    if low in WORDS: return None                        # mot valide (accentué) → ne pas toucher (FP=0 cardinal)
    d = deacc(low)
    cand = {}                                           # forme accentuée -> (priorité, freq)
    # priorité 0 = restauration d'accents (même deacc) ; 1 = distance d'édition 1
    for w, fr in DEACC2ACC.get(d, []):
        cand[w] = max(cand.get(w, (-1, 0)), (2, fr))    # accent-only : meilleur rang
    for e in edits1_deacc(d):
        for w, fr in DEACC2ACC.get(e, []):
            cand[w] = max(cand.get(w, (-1, 0)), (1, fr))
    if not cand: return None                            # aucun voisin proche → nom propre/néologisme → abstention
    # classe par (priorité, fréquence) ; exige une fréquence minimale (évite de "corriger" vers un mot ultra-rare)
    best = max(cand.items(), key=lambda kv: (kv[1][0], kv[1][1]))
    if best[1][1] < MINFREQ: return None
    return best[0]

def main():
    if not os.path.exists(LEX):
        print(f"Lexique introuvable ({LEX})"); return 1
    WORDS, FREQ, DEACC2ACC = load_lexicon()
    print(f"=== PROTOTYPE correcteur orthographique (non-mots) ===")
    print(f"  lexique : {len(WORDS)} formes accentuées | {len(DEACC2ACC)} clés déacc\n")
    PAIRS = [json.loads(l) for l in open(GEC, encoding='utf-8') if l.strip()]
    tok = re.compile(r"[A-Za-zÀ-ÿ]+")

    # (1) FAUX POSITIFS : sur les phrases CORRECTES, combien de mots valides sont "corrigés" à tort ?
    fp = 0; fp_ex = []
    for p in PAIRS:
        for w in tok.findall(p['good']):
            s = best_correction(w, WORDS, FREQ, DEACC2ACC)
            if s is not None and s != w.lower():
                fp += 1
                if len(fp_ex) < 15: fp_ex.append((w, s, p['good'][:70]))
    print(f"  [1] FAUX POSITIFS (mot juste 'corrigé') sur {len(PAIRS)} phrases correctes : {fp}")
    for w, s, ctx in fp_ex: print(f"        ⚠️ {w} → {s}   | {ctx}")

    # (2) NON-MOTS corrigés : sur les phrases BAD, les non-mots dont la cible est un seul mot
    import diag_sentence as D
    nonword = hit = 0; miss_ex = []
    for p in PAIRS:
        Tg, Sb = D.toks(p['good']), D.toks(p['bad'])
        for op, g, b in D.align(Tg, Sb):
            if op != 'sub': continue
            if b.lower() in WORDS: continue              # b déjà un mot valide = erreur réel-mot (hors correcteur ortho)
            if not all(deacc(c) in ALPHA for c in b.lower()) or len(b) < 2: continue
            nonword += 1
            s = best_correction(b, WORDS, FREQ, DEACC2ACC)
            if s is not None and deacc(s) == deacc(g.lower()) and s == g.lower():
                hit += 1
            elif len(miss_ex) < 18:
                miss_ex.append((b, g, s))
    print(f"\n  [2] NON-MOTS (cible = 1 mot) : {nonword} | CORRIGÉS exactement : {hit}  ({100*hit/max(1,nonword):.0f}%)")
    print("      exemples ratés (tapé → cible | suggestion) :")
    for b, g, s in miss_ex: print(f"        {b} → {g}   | sugg={s}")
    return 0

if __name__ == '__main__':
    sys.exit(main())
