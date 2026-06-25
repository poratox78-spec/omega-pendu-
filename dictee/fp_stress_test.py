# -*- coding: utf-8 -*-
# STRESS-TEST FAUX POSITIFS à grande échelle — le garde-fou CARDINAL du correcteur sur du VRAI français correct.
#
# Les batteries curées (30 phrases, 98 GEC) sont courtes/simples → un FP=0 sur elles SUR-ESTIME la robustesse.
# Ici on passe le correcteur sur des MILLIERS de phrases CORRECTES réelles (UD French GSD, treebank gold édité) :
# tout flag = FAUX POSITIF (on ne devrait jamais « corriger » une phrase juste — condition n°1 pour un outil dys).
# R67 lecture seule. Données hors-repo (UD French = CC BY-SA/CC BY-NC selon corpus ; on LIT, on n'embarque pas).
#
#   git clone --depth 1 https://github.com/UniversalDependencies/UD_French-GSD /tmp/udfr   # GitHub atteignable
#   UDFR=/tmp/udfr python3 dictee/fp_stress_test.py            # mesure le taux de FP réel (+ ventilation par règle)
#   FP_MAX=2.5 UDFR=/tmp/udfr python3 dictee/fp_stress_test.py # mode garde : sort en erreur si FP% > seuil
import os, sys, glob
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
UDFR = os.environ.get('UDFR', '/tmp/udfr')
FP_MAX = os.environ.get('FP_MAX')   # si défini : échoue si le taux de FP dépasse ce % (garde CI optionnelle)


def conllu_sentences(d):
    out = []
    for f in sorted(glob.glob(os.path.join(d, '*.conllu'))):
        for ln in open(f, encoding='utf-8', errors='ignore'):
            if ln.startswith('# text = '):
                out.append(ln[9:].strip())
    return out


def main():
    sys.path.insert(0, HERE)
    import correcteur_probe as C
    if not os.path.isdir(UDFR):
        print(f"[fp_stress] corpus UD French introuvable ({UDFR}) — voir docstring. Skip.")
        return 0
    S = conllu_sentences(UDFR)
    if not S:
        print(f"[fp_stress] aucune phrase .conllu dans {UDFR}. Skip.")
        return 0
    fp = 0
    byrule = Counter()
    ex = []
    for s in S:
        flags = C.correct(s)
        if flags:
            fp += 1
            for f in flags:
                byrule[f[3]] += 1
            if len(ex) < 10:
                ex.append(([(f[1], f[2], f[3]) for f in flags], s[:80]))
    rate = 100 * fp / len(S)
    print(f"=== STRESS-TEST FP — {len(S)} phrases correctes (UD French) ===")
    print(f"  phrases avec ≥1 flag (= FAUX POSITIF) : {fp}/{len(S)} = {rate:.2f}%")
    print(f"  par règle : {dict(byrule.most_common())}")
    for fl, s in ex:
        print(f"    {fl} | {s}")
    if FP_MAX is not None:
        ok = rate <= float(FP_MAX)
        print(f"  garde FP_MAX={FP_MAX}% : {'OK' if ok else 'ÉCHEC'}")
        return 0 if ok else 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
