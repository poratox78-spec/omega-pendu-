# -*- coding: utf-8 -*-
# BANC DE COMPARAISON : notre correcteur dys ⟷ Grammalecte, sur le même corpus GEC réel.
#
# Grammalecte (Olivier R. — GPL-3.0/MPL/LGPL) est le correcteur FR open-source le plus proche (JS/Python, hors-ligne).
# Ici il sert d'OUTIL EXTERNE de comparaison : on l'IMPORTE et on le LANCE (pas de copie de code → pas de dérivé GPL
# dans notre MIT). R67 lecture seule. Si Grammalecte n'est pas présent → message + exit 0 (n'échoue pas la CI).
#
# Recette de build (hors-ligne, GitHub atteignable) :
#   git clone --depth 1 https://github.com/Pofilo/grammalecte /tmp/gram   # mirror du dépôt officiel
#   mkdir -p /tmp/gram/gc_lang/fr/data && echo '{}' > /tmp/gram/gc_lang/fr/data/thes_fr.json  # stub thésaurus (cosmétique)
#   cd /tmp/gram && python3 make.py fr -b                                  # compile dict DAWG + règles + paquet
#   GRAMMALECTE=/tmp/gram python3 dictee/bench_grammalecte.py
import os, sys, json

HERE = os.path.dirname(os.path.abspath(__file__))
GRAM = os.environ.get('GRAMMALECTE', '/tmp/gram')


def main():
    if not os.path.isdir(os.path.join(GRAM, 'grammalecte', 'fr')):
        print(f"[bench] Grammalecte non construit dans {GRAM} (voir recette en tête de fichier). Skip.")
        return 0
    sys.path.insert(0, GRAM)
    sys.path.insert(0, HERE)
    import grammalecte
    import correcteur_probe as C
    oGC = grammalecte.GrammarChecker("fr")

    def gram_errs(txt):
        r = oGC.getParagraphErrors(txt)
        if isinstance(r, tuple):
            r = r[0]
        errs = list(r.values()) if isinstance(r, dict) else list(r)
        out = []
        for e in errs:
            out.extend(e if isinstance(e, (list, tuple)) else [e])
        return out

    pairs = [json.loads(l) for l in open(os.path.join(HERE, 'corpus_gec_fr.jsonl'), encoding='utf-8')]
    g_fp = g_det = o_fp = o_det = 0
    for d in pairs:
        if gram_errs(d['good']):
            g_fp += 1
        if C.correct(d['good']):
            o_fp += 1
        if gram_errs(d['bad']):
            g_det += 1
        if C.correct(d['bad']):
            o_det += 1
    n = len(pairs)
    print(f"=== BANC correcteur dys ⟷ Grammalecte — {n} paires GEC réelles ===")
    print(f"  Grammalecte (large, inclut typo/style) : touche au CORRECT {g_fp}/{n} · flague le FAUTIF {g_det}/{n}")
    print(f"  NOTRE correcteur (FP=0 cardinal)        : touche au CORRECT {o_fp}/{n} · flague le FAUTIF {o_det}/{n}")
    print("  Lecture : Grammalecte couvre plus (recall), mais touche souvent au juste (style/typo inclus) ;")
    print("            notre angle dys = PRÉCISION (ne jamais corriger un apprenant à tort, FP=0) + STADE développemental.")
    # garde douce : notre FP doit rester 0
    if o_fp != 0:
        print(f"  ⚠️ RÉGRESSION : notre FP={o_fp} (attendu 0)")
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
