# -*- coding: utf-8 -*-
# recall_probe.py — RAPPEL du correcteur par INJECTION CONTRÔLÉE d'homophones grammaticaux dans des phrases
# CORRECTES, ventilé PAR FAMILLE et PAR SOURCE (propre dys vs réel GEC). Le projet a lourdement mesuré le FAUX
# POSITIF (cardinal) ; le RAPPEL (faux négatif) n'était chiffré que sur de petits jeux. Ici, à l'échelle.
# R67 : LECTURE SEULE. Réutilise C.correct + diag_sentence.toks/deacc (§5) — match détection par MOT, comme eval_*.
#
# Sources :
#   • « propre » = domaine dys (sentences.json `text`) + held-out hand-crafted (corpus_externe `good`) : phrases
#     COURTES et nettes → un swap y est presque toujours une faute claire (peu de ratés illusoires).
#   • « gec »    = corpus réel GEC (corpus_gec_fr.jsonl `good`) : encyclopédique, long → bruité.
# Filtre de propreté commun (§6, contre les ratés illusoires) : on écarte URLs et phrases hors [3..25] mots
# (tronquées / run-ons encyclopédiques où l'injection tombe dans le vide).
#
# Honnêteté (§1) : injection SYNTHÉTIQUE. et/est & ce/se ABSTIENNENT par design (ambigus sans contexte) → leur
# bas rappel est une LIMITE, pas un bug. Le vrai rappel sur ERREURS RÉELLES se lit dans eval_gec (in-scope).
#
# Lancer :  python3 dictee/recall_probe.py                         (mesure, ventilée propre/gec)
#           python3 dictee/recall_probe.py --dump <bad.json>       (+ exporte le corpus injecté pour le rejeu JS)
import os, sys, json, re
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import correcteur_probe as C
from diag_sentence import toks, deacc

FAMILIES = {
    'a/à':            ['a', 'à'],
    'son/sont':       ['son', 'sont'],
    'on/ont':         ['on', 'ont'],
    'leur/leurs':     ['leur', 'leurs'],
    'ce/se':          ['ce', 'se'],
    'et/est':         ['et', 'est'],
    'peu/peux/peut':  ['peu', 'peux', 'peut'],
    # --- être / avoir : règles grammaticales + ressemblance PHONÉTIQUE (cible dys) ---
    "j'ai/j'est":     ["j'ai", "j'est"],       # avoir 1sg vs *être (malformation phon. /ʒe/~/ʒɛ/)
    'a/as·avoir':     ['a', 'as'],             # avoir 3sg/2sg, phon. identiques /a/ → accord personne
    'est/es·être':    ['est', 'es'],           # être 3sg/2sg, phon. identiques /ɛ/ → accord personne
}
SOURCES = ['propre', 'gec']
_URL = re.compile(r'https?://|www\.', re.I)


def clean_ok(s):
    n = len(toks(s))
    return 3 <= n <= 25 and not _URL.search(s)


def load_sentences():
    """-> [(texte, source)] correct, filtré propreté + dédoublonné."""
    raw = []
    sj = os.path.join(HERE, 'sentences.json')                      # domaine dys (propre, court)
    if os.path.exists(sj):
        for e in json.load(open(sj, encoding='utf-8')):
            t = e.get('text') if isinstance(e, dict) else None
            if t: raw.append((t, 'propre'))
    ext = os.path.join(HERE, 'corpus_externe.json')                # held-out hand-crafted (propre)
    if os.path.exists(ext):
        for c in json.load(open(ext, encoding='utf-8')).get('cases', []):
            raw.append((c[0], 'propre'))
    gec = os.path.join(HERE, 'corpus_gec_fr.jsonl')                # réel encyclopédique (bruité)
    if os.path.exists(gec):
        for l in open(gec, encoding='utf-8'):
            l = l.strip()
            if l:
                p = json.loads(l)
                if p.get('good'): raw.append((p['good'], 'gec'))
    seen, out = set(), []
    for t, src in raw:
        if t in seen or not clean_ok(t): continue
        seen.add(t); out.append((t, src))
    return out


def main():
    dump_path = sys.argv[sys.argv.index('--dump') + 1] if '--dump' in sys.argv else None
    sents = load_sentences()
    n_pr = sum(1 for _, s in sents if s == 'propre'); n_gc = len(sents) - n_pr
    print(f"=== RAPPEL par INJECTION (réf. Python) — {len(sents)} phrases ({n_pr} propres + {n_gc} gec, filtrées) ===")
    print(f"  couverture verbale : {'cgram ' + str(len(C.VERB_LEX)) + ' formes' if C.CGRAM_LOADED else 'liste blanche'}\n")

    per = {f: {s: [0, 0] for s in SOURCES} for f in FAMILIES}      # famille -> source -> [injections, détectées]
    injected = []
    for fam, forms in FAMILIES.items():
        formset = {x.lower() for x in forms}
        for s, src in sents:
            T = toks(s)
            for i, t in enumerate(T):
                if t.lower() not in formset: continue
                for w in forms:
                    if w == t.lower(): continue
                    wrong = w.capitalize() if (i == 0 and t[:1].isupper()) else w
                    bad_T = list(T); bad_T[i] = wrong
                    bad = ' '.join(bad_T)
                    if bad == s: continue
                    per[fam][src][0] += 1
                    flags = C.correct(bad)
                    hit = next((fl for fl in flags if deacc(fl[1].lower()) == deacc(wrong.lower())), None)
                    if hit: per[fam][src][1] += 1
                    injected.append({'family': fam, 'source': src, 'bad': bad, 'correct': t, 'wrong': wrong,
                                     'site': i, 'detected': bool(hit),
                                     'good_fix': bool(hit and hit[2].lower() == t.lower())})

    pct = lambda d, n: f"{round(100 * d / n)}%" if n else "—"
    print(f"  {'famille':16} {'PROPRE (det/inj)':>18}   {'GEC (det/inj)':>16}")
    tot = {s: [0, 0] for s in SOURCES}
    for fam in FAMILIES:
        pr, gc = per[fam]['propre'], per[fam]['gec']
        for k in (0, 1): tot['propre'][k] += pr[k]; tot['gec'][k] += gc[k]
        cell = lambda x: f"{x[1]}/{x[0]} ({pct(x[1], x[0])})"
        print(f"  {fam:16} {cell(pr):>18}   {cell(gc):>16}")
    cell = lambda x: f"{x[1]}/{x[0]} ({pct(x[1], x[0])})"
    print(f"  {'TOTAL':16} {cell(tot['propre']):>18}   {cell(tot['gec']):>16}")

    print("\n  Lecture : PROPRE (dys court) = rappel le plus fiable (peu de ratés illusoires) ; GEC = réel mais bruité.")
    print("            et/est & ce/se bas = ABSTENTION par design (limite contexte, pas bug). Rappel sur ERREURS")
    print("            RÉELLES (vérité-terrain) : voir eval_gec (in-scope). Injection synthétique = borne, pas vérité.")

    if dump_path:
        json.dump(injected, open(dump_path, 'w', encoding='utf-8'), ensure_ascii=False)
        print(f"\n  corpus injecté exporté ({len(injected)} cas) → {dump_path}  (rejeu JS : app pendu + extension)")


if __name__ == '__main__':
    main()
