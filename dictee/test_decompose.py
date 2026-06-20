# -*- coding: utf-8 -*-
# Test de RÉGRESSION (asserts, §1.5) du décomposeur + cognition phono→ortho.
# Garde les invariants clés ET des SEUILS mesurés (un régression qui dégrade l'exactitude
# fait ÉCHOUER la CI, pas seulement baisser un chiffre imprimé). Déterministe (seed 42).
# Lancer : python3 dictee/test_decompose.py
import os, sys, random
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import decompose as D
import p2g

N = 0
def check(cond, msg):
    global N
    assert cond, "ÉCHEC : " + msg
    N += 1; print("  ✓ " + msg)


def main():
    print("=== garde-fous g2p sublexical (cas connus) ===")
    for w, gold in {'chat': 'Sa', 'cheval': 'S°val', 'oiseau': 'wazo', 'maison': 'mEz§',
                    'examen': 'Egzam5', 'nation': 'nasj§', 'beau': 'bo', 'lui': 'l8i'}.items():
        check(D.sublexical_phon(w)[0] == gold, f"g2p('{w}') = /{gold}/")

    print("=== nbsyll (compte de noyaux) ===")
    for w, n in {'oiseau': 2, 'cheval': 2, 'examen': 3, 'beaucoup': 2, 'a': 1}.items():
        check(D.decompose(w)['nbsyll'] == n, f"nbsyll('{w}') = {n}")

    print("=== morphologie (route lexicale md/mb × repli sublexical) ===")
    check(D.morpho_of('portable')[0] == ['port', 'able'], "portable → port + able (lexicale)")
    check(D.morpho_of('national')[3] == 'lex', "national : morpho lexicale")
    sub = D.morpho_of('antibrouillage')
    check(sub[3] == 'sublex' and 'anti' in sub[0], "antibrouillage → repli sublexical avec 'anti'")

    print("=== double voie SON : lexicale exacte, sublexicale pour l'OOV ===")
    r = D.decompose('oiseau')
    check(r['src_phon'] == 'lex' and r['phono'] == 'wazo', "oiseau : route lexicale exacte")
    check(D.decompose('chevaux')['src_phon'] == 'sublex', "chevaux : route sublexicale (OOV)")

    print("=== apprend (FP=0 : 'lex' jamais écrasé par 'sublex') ===")
    lex = {'_meta': {'lus': 0, 'phon_inv': {}, 'graph_inv': {}}}
    lex['mot'] = {'phono': 'mo', 'src': 'lex', 'vu': 1}
    D.learn_word(lex, 'mot')                              # 'mot' OOV → sublex, ne doit PAS écraser le 'lex'
    check(lex['mot']['src'] == 'lex' and lex['mot']['vu'] == 2, "FP=0 : source lexicale préservée, vu incrémenté")

    print("=== SEUILS mesurés (held-out, seed 42) ===")
    random.seed(42)
    _, test = D.inlex_split(42)
    sample = test[:1500]
    exact = sum(1 for w in sample if D.sublexical_phon(w)[0] == D.W2P[w]) / len(sample)
    check(exact >= 0.50, f"g2p sublexical exact held-out = {100*exact:.1f}% (seuil 50%)")

    if p2g.TABLE:
        t5 = sum(1 for w in sample[:800]
                 if w.lower() in [s for s, _ in p2g.decode(D.W2P[w], k=5)]) / 800
        check(t5 >= 0.65, f"p2g phono→ortho top-5 held-out = {100*t5:.1f}% (seuil 65%)")
    else:
        print("  (p2g_table.json absent — seuil p2g sauté ; lance build_p2g.py)")

    print(f"\n=== {N} assertions OK ===")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
