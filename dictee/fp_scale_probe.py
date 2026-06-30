# -*- coding: utf-8 -*-
# fp_scale_probe.py — GARDE-FOU FP À L'ÉCHELLE.
# Le correcteur tourne sur un échantillon de VRAI texte correct (fp_scale_corpus.txt : 2500 phrases d'UD French-GSD,
# CC BY-SA 4.0). Le texte étant correct, tout flag rouge = un faux positif (ou, parfois, une vraie faute présente
# dans UD). On VERROUILLE le taux : une régression qui réintroduit des FP en masse — comme l'audit du 2026-06-30
# (aux mal orthographié 241, majuscule 180 → 4,70 %) — fait sauter le plafond, en CI, automatiquement.
# Les batteries (30–95 phrases) ne voyaient pas ça ; CE check, si.
#   python3 dictee/fp_scale_probe.py            → affiche le taux + le détail par règle
#   python3 dictee/fp_scale_probe.py --check    → sort 1 si le taux dépasse le plafond (mode CI)
import os, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import correcteur_probe as C

CEILING = 3.0   # % de phrases flaggées max. Mesuré ~1,96 % sur la fixture (homophones tranchés par la grammaire,
                # dont une part de vraies fautes d'UD). Marge pour ne pas flaker, mais saute sur une catastrophe (4,70 %).
CORPUS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fp_scale_corpus.txt')


def main(check):
    sents = [l.rstrip('\n') for l in open(CORPUS, encoding='utf-8') if l.strip()]
    by = collections.Counter(); flagged = 0
    for s in sents:
        fl = C.correct(s)
        if fl: flagged += 1
        for (_i, _w, _sg, name) in fl: by[name] += 1
    rate = 100.0 * flagged / len(sents)
    if check:
        if rate > CEILING:
            print("✗ FP à l'échelle : %.2f%% > plafond %.1f%% (%d/%d phrases correctes flaggées). RÉGRESSION FP — détail :" % (rate, CEILING, flagged, len(sents)))
            for n, c in by.most_common(): print("    %-22s %d" % (n, c))
            return 1
        print("✓ FP à l'échelle : %.2f%% ≤ %.1f%% (%d/%d phrases correctes UD) — pas de régression FP en masse" % (rate, CEILING, flagged, len(sents)))
        return 0
    print("Correcteur sur %d phrases correctes (UD French-GSD) : %d flaggées = %.2f%% | %d flags" % (len(sents), flagged, rate, sum(by.values())))
    for n, c in by.most_common(): print("  %-22s %d" % (n, c))
    return 0


if __name__ == '__main__':
    sys.exit(main('--check' in sys.argv))
