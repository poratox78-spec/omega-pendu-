# -*- coding: utf-8 -*-
# Évalue le correcteur sur un VRAI corpus GEC français (paires {bad, good}), au-delà du synthétique/held-out.
# Deux mesures décisives :
#   (1) FAUX POSITIFS sur les phrases CORRECTES (`good`) — le test cardinal sur du texte réel : doit être ~0.
#   (2) DÉTECTION/CORRECTION sur les erreurs DANS LE PÉRIMÈTRE du correcteur (homophones grammaticaux), repérées
#       en diffant bad↔good. (Le corpus contient surtout des erreurs HORS périmètre : genre du déterminant un/une,
#       nombre, ordre des mots, mots manquants, typos — le correcteur ne les vise pas, c'est attendu.)
# Données tierces (hors-repo, comme Lexique4) : dictee/corpus_gec_fr.jsonl (via fetch_gec_corpus.py ou fourni).
# Lancer : python3 dictee/eval_gec.py
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import correcteur_probe as C
import diag_sentence as D

PATH = os.path.join(HERE, 'corpus_gec_fr.jsonl')
if not os.path.exists(PATH):
    print(f"corpus absent : {PATH} (le fournir, ou fetch_gec_corpus.py une fois l'égress ouvert)."); sys.exit(1)
PAIRS = [json.loads(l) for l in open(PATH, encoding='utf-8') if l.strip()]

PAIRS8 = {'a/à': {'a', 'à'}, 'son/sont': {'son', 'sont'}, 'on/ont': {'on', 'ont'},
          'leur/leurs': {'leur', 'leurs'}, 'ce/se': {'ce', 'se'}, 'et/est': {'et', 'est'},
          'peu/peux/peut': {'peu', 'peux', 'peut'}}


def e_er_stem(w):
    wl = w.lower()
    if wl.endswith('é'): return D.deacc(wl)[:-1]
    if wl.endswith('er') and len(wl) > 3: return D.deacc(wl)[:-2]
    return None


def _verb_lemmas(w):
    s = C.CONJ_F.get(D.deacc(w.lower()))
    return {r.split(';')[0] for r in s.split('|')} if s else set()


def confusion_kind(bad, good):
    lb, lg = bad.lower(), good.lower()
    if lb == lg: return None
    for k, s in PAIRS8.items():
        if lb in s and lg in s: return k
    for s in ({'un', 'une'}, {'le', 'la'}, {'ce', 'cette'}, {'cet', 'cette'},
              {'mon', 'ma'}, {'ton', 'ta'}, {'son', 'sa'}):   # genre du déterminant (un/une, le/la…)
        if lb in s and lg in s: return 'genre déterminant'
    sb, sg = e_er_stem(bad), e_er_stem(good)
    if sb is not None and sg is not None and sb == sg: return '-é/-er'
    if _verb_lemmas(bad) & _verb_lemmas(good):    # même lemme verbal, forme différente → accord/conjugaison
        return 'accord sujet-verbe'
    return None


def main():
    print(f"=== ÉVAL CORRECTEUR sur VRAI corpus GEC FR — {len(PAIRS)} paires ===")
    print(f"  couverture verbale : {'cgram '+str(len(C.VERB_LEX))+' formes' if C.CGRAM_LOADED else 'liste blanche'}\n")

    # (1) FAUX POSITIFS sur les phrases correctes (good)
    fp = 0; fp_ex = []
    for p in PAIRS:
        for (i, w, sug, name) in C.correct(p['good']):
            fp += 1
            if len(fp_ex) < 12: fp_ex.append((w, sug, name, p['good']))
    print(f"  [1] FAUX POSITIFS sur {len(PAIRS)} phrases CORRECTES : {fp}  ({fp/len(PAIRS):.2f}/phrase)")
    for w, sug, name, s in fp_ex:
        print(f"        ⚠️ « {w} »→« {sug} » [{name}]  | {s[:90]}")

    # (2) erreurs DANS LE PÉRIMÈTRE (diff bad↔good) + détection/correction
    in_scope = det = corr = 0; per = {}
    for p in PAIRS:
        Tg, Sb = D.toks(p['good']), D.toks(p['bad'])
        for op, g, b in D.align(Tg, Sb):                  # T=good (cible), S=bad
            if op != 'sub': continue
            k = confusion_kind(b, g)
            if not k: continue
            in_scope += 1; per.setdefault(k, [0, 0, 0]); per[k][0] += 1
            flags = C.correct(p['bad'])
            hit = next(((ii, ww, ss, nn) for (ii, ww, ss, nn) in flags
                        if D.deacc(ww.lower()) == D.deacc(b.lower())), None)
            if hit:
                det += 1; per[k][1] += 1
                if hit[2].lower() == g.lower():
                    corr += 1; per[k][2] += 1
    print(f"\n  [2] erreurs DANS LE PÉRIMÈTRE (homophones grammaticaux du correcteur) : {in_scope}")
    print(f"      détection : {det}/{in_scope}   correction : {corr}/{in_scope}")
    for k in sorted(per):
        a, d, c = per[k]; print(f"        {k:14} présentes={a}  détectées={d}  corrigées={c}")

    print("\n  Lecture : [1] est le test cardinal sur du RÉEL — un correcteur doit ≈ ne pas toucher au juste.")
    print("            [2] mesure la part PÉRIMÈTRE ; le corpus est surtout hors-périmètre (genre dét., nombre,")
    print("            ordre, mots manquants, typos) → recall global bas attendu, ce n'est pas l'objet du correcteur.")


if __name__ == '__main__':
    main()
