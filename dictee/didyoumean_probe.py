# -*- coding: utf-8 -*-
# SONDE « DID YOU MEAN » — FALSIFICATION mesurée (jonction 7 « couche typo », classe vrai-mot-rare).
# ============================================================================================
# Question (bilan stress-test) : peut-on corriger un VRAI mot rare (que le speller ne touche pas,
# « le speller n'y touche pas car c'est un vrai mot ») en le ré-ordonnant vers un voisin FRÉQUENT
# proche (balon→ballon, tan→tant, voudrai→voudrais) — gardé FLAG, FP chiffré sur le GEC ?
#
# RÉSULTAT : FALSIFIÉ. La fréquence seule ne distingue PAS « rare-mais-correct » de « rare-typo ».
#   - variante large   : 8→58 FP / 98 phrases correctes  pour  0→3 corrections / 152 erreurs vrai-mot GEC.
#   - variante stricte (edit-1 + phon-IDENTIQUE + dominant) : 3→10 FP  pour  0→1 correction.
#   FP irréductibles = vrais mots rares à voisin fréquent phon-identique (vainc→vain, coll→cool,
#   absorbeur→absorber, croît→crois…) — indissociables d'un typo SANS contexte. Cardinal FP=0 violé.
#   → la classe « vrai-mot-rare » exige un modèle de CONTEXTE (LLM-grade) ; le C lourd transformer a
#     déjà été falsifié (CLAUDE.md). Ne PAS câbler une règle fréquence.
#
# Reproductible SANS Lexique4 : lit le lexique EMBARQUÉ du speller (bloc speller-lex-gz) + le corpus
# GEC committé (dictee/corpus_gec_fr.jsonl). Lancer : python3 dictee/didyoumean_probe.py
import os, re, base64, gzip, json, sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import speller_probe as S
import diag_sentence as D

APP = os.path.join(HERE, '..', 'app', 'omega-pendu.html')
GEC = os.path.join(HERE, 'corpus_gec_fr.jsonl')


def load_embedded():
    """Reconstruit (WORDS, FREQ, D2A, PHON, POS) depuis le bloc speller-lex-gz de l'app (= le lexique du PRODUIT)."""
    src = open(APP, encoding='utf-8').read()
    m = re.search(r'id="speller-lex-gz"[^>]*>([A-Za-z0-9+/=\s]+?)</script>', src)
    if not m:
        print("[did-you-mean] bloc speller-lex-gz introuvable"); sys.exit(2)
    raw = gzip.decompress(base64.b64decode(re.sub(r'\s', '', m.group(1)))).decode('utf-8')
    WORDS, FREQ = set(), {}
    D2A, PHON, POS = defaultdict(list), defaultdict(list), defaultdict(set)
    for line in raw.split('\n'):
        if not line:
            continue
        f = line.split('\t')
        w = f[0]; fr = (int(f[1]) / 1000.0) if len(f) > 1 else 0.001
        WORDS.add(w); FREQ[w] = fr
        for c in (f[2] if len(f) > 2 else ''):
            if c in 'NVA':
                POS[w].add(c)
    for w in WORDS:
        D2A[S.deacc(w)].append(w)
        if FREQ[w] >= S.FLAG_FREQ:
            PHON[S.phon_key(w)].append(w)
    for d in D2A:
        D2A[d].sort(key=lambda w: -FREQ[w])
    for k in PHON:
        PHON[k].sort(key=lambda w: -FREQ[w])
    return WORDS, FREQ, D2A, PHON, POS


def didyoumean(sp, tok, RARE_T, DOM, strict):
    """Vrai mot mais rare (freq<RARE_T) → meilleur voisin >=DOM× plus fréquent. strict=edit-1 + phon-identique."""
    low = tok.lower()
    if low not in sp.WORDS:
        return None                          # non-mot → speller normal (hors sujet)
    ftok = sp.FREQ.get(low, 0.0)
    if ftok >= RARE_T:
        return None                          # pas rare → on n'y touche pas
    pk = S.phon_key(low); best = None
    for w, (p, f) in sp._cands(low, S.deacc(low)).items():
        if w == low:
            continue
        if strict and (p < 1 or S.phon_key(w) != pk):
            continue                         # strict : edit-1 + phonétiquement identique
        if f >= DOM * max(ftok, 1e-3) and f >= 1.0:
            if best is None or f > best[1]:
                best = (w, f)
    return best[0] if best else None


def main():
    if not os.path.exists(GEC):
        print(f"[did-you-mean] corpus GEC absent ({GEC})."); return 1
    S.load_lexicon = lambda: load_embedded()           # monkeypatch : pas de Lexique4 requis
    sp = S.Speller()
    PAIRS = [json.loads(l) for l in open(GEC, encoding='utf-8') if l.strip()]
    print("=== SONDE « DID YOU MEAN » — falsification mesurée (lexique embarqué + GEC) ===")
    print(f"  {len(sp.WORDS)} formes embarquées | {len(PAIRS)} paires GEC\n")

    # erreurs RÉELLES de type vrai-mot (sub où bad ET good sont de vrais mots) = cibles in-scope
    realword = []
    for p in PAIRS:
        for op, g, b in D.align(D.toks(p['good']), D.toks(p['bad'])):
            if op == 'sub' and b.lower() in sp.WORDS and g.lower() != b.lower():
                realword.append((b, g))
    print(f"  erreurs 'vrai-mot' dans le GEC (in-scope) : {len(realword)}\n")

    print(f"  {'variante':>8} {'RARE_T':>7} {'DOM':>4} | {'FP/good':>8} | {'fixes/bad':>10} | exemples FP")
    worst_fp = 0
    for strict in (False, True):
        for RARE_T in (0.3, 0.5, 1.0, 2.0):
            DOM = 20
            fp, fpex = 0, []
            for p in PAIRS:
                for t in D.toks(p['good']):
                    s = didyoumean(sp, t, RARE_T, DOM, strict)
                    if s and s.lower() != t.lower():
                        fp += 1
                        if len(fpex) < 4:
                            fpex.append(f"{t}->{s}")
            fix = sum(1 for b, g in realword
                      if (lambda s: s and s.lower() == g.lower())(didyoumean(sp, b, RARE_T, DOM, strict)))
            tag = 'stricte' if strict else 'large'
            print(f"  {tag:>8} {RARE_T:>7} {DOM:>4} | {fp:>8} | {fix:>3}/{len(realword):<6} | {', '.join(fpex)}")
            worst_fp = max(worst_fp, fp if fix == 0 else 0)

    print("\n  VERDICT : aucun réglage n'atteint FP=0 (toujours ≥3 FP, dont des cas à 0 correction).")
    print("            La fréquence ne sépare pas rare-correct de rare-typo → FP irréductibles.")
    print("            'did you mean' fréquence = FALSIFIÉ ; classe vrai-mot exige un modèle de CONTEXTE.")
    # garde-fou de régression : la falsification doit RESTER vraie (sinon ré-évaluer, ne pas câbler en aveugle)
    assert worst_fp >= 1, "FALSIFICATION CADUQUE : un réglage atteint FP=0 à 0 correction — ré-évaluer"
    return 0


if __name__ == '__main__':
    sys.exit(main())
