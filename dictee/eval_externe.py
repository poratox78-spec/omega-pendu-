# -*- coding: utf-8 -*-
# Valide le correcteur sur un jeu HELD-OUT (corpus_externe.json) — vocabulaire neuf → teste la GÉNÉRALISATION
# (les règles sont contextuelles, pas mémorisées) et la couverture verbale/genre du lexique (cgram).
# Lancer : python3 dictee/eval_externe.py
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import correcteur_probe as C
from diag_sentence import toks, deacc

D = json.load(open(os.path.join(HERE, 'corpus_externe.json'), encoding='utf-8'))
cases = D['cases']


def main():
    print("=== VALIDATION HELD-OUT (vocabulaire neuf) — généralisation du correcteur ===")
    print(f"  couverture verbale : {'cgram '+str(len(C.VERB_LEX))+' formes' if C.CGRAM_LOADED else 'liste blanche'}\n")
    fp = det = corr = 0
    per = {}
    for good, trig, wrong, kind in cases:
        per.setdefault(kind, [0, 0, 0])
        okf = C.correct(good)                                   # FP : la phrase correcte ne doit pas flaguer le déclencheur
        if any(deacc(w.lower()) == deacc(trig.lower()) for (i, w, sug, nm) in okf):
            fp += 1; per[kind][0] += 1
        T = toks(good)
        bad = ' '.join(wrong if deacc(t.lower()) == deacc(trig.lower()) else t for t in T)
        bf = C.correct(bad)                                     # détection + correction sur la faute injectée
        hit = next(((i, w, sug, nm) for (i, w, sug, nm) in bf if deacc(w.lower()) == deacc(wrong.lower())), None)
        if hit:
            det += 1; per[kind][1] += 1
            if hit[2].lower() == trig.lower():
                corr += 1; per[kind][2] += 1
    n = len(cases)
    print(f"  faux positifs (forme correcte flaguée) : {fp}/{n}")
    print(f"  DÉTECTION (faute injectée repérée)      : {det}/{n}")
    print(f"  CORRECTION (bonne forme proposée)       : {corr}/{n}")
    print("  par confusion (fp · det · corr) :")
    for k in sorted(per):
        a, b, c = per[k]; t = sum(1 for x in cases if x[3] == k)
        print(f"     {k:14} fp={a}/{t}  det={b}/{t}  corr={c}/{t}")
    print("\n  Lecture : FP≈0 + det/corr élevés sur du vocabulaire NEUF = les règles GÉNÉRALISENT (contextuelles),")
    print("            et le lexique cgram porte la couverture verbale au-delà du corpus d'origine.")


if __name__ == '__main__':
    main()
