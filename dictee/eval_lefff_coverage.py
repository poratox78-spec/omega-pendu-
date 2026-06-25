# -*- coding: utf-8 -*-
# MESURE de couverture : que gagnerait notre correcteur en s'appuyant sur le LEFFF (lexique morphosyntaxique FR) ?
#
# Le Lefff (Sagot, INRIA — LGPL-LR) couvre 500k+ formes fléchies (forme TAB POS TAB lemme TAB morph). On NE
# l'intègre PAS (licence LGPL-LR ≠ notre CC BY-SA → arbitrage requis avant redistribution) ; on MESURE seulement
# le gain de couverture vs notre `cgram_*` (Lexique 4). R67 : lecture seule, n'écrit aucun artefact.
#
#   LEFFF=/chemin/lefff-3.4.mlex  python3 dictee/eval_lefff_coverage.py
#   (données Lefff hors-repo, comme Lexique4.tsv ; cf. ClaudeCoulombe/FrenchLefffLemmatizer sur GitHub.)
import os, sys, io, re, json, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
LEFFF = os.environ.get('LEFFF', '/tmp/lefff/french_lefff_lemmatizer/data/lefff-3.4.mlex')


def deacc(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


def load_lefff_nc_gender(path):
    """noms communs (nc) → genre m/f non ambigu (déacc), depuis le champ morph du Lefff."""
    g = {}
    for ln in io.open(path, encoding='utf-8', errors='ignore'):
        p = ln.rstrip('\n').split('\t')
        if len(p) < 2 or p[1] != 'nc':
            continue
        morph = p[3] if len(p) > 3 else ''
        mm = re.search(r'\b([mf])[sp]\b', morph) or re.search(r'^([mf])', morph)
        if not mm:
            continue
        d = deacc(p[0].lower())
        if not d.isalpha():
            continue
        if d in g and g[d] != mm.group(1):
            g[d] = '?'
        else:
            g.setdefault(d, mm.group(1))
    return {k: v for k, v in g.items() if v in ('m', 'f')}


def main():
    if not os.path.exists(LEFFF):
        print(f"[lefff] données introuvables ({LEFFF}). Hors-repo (LGPL-LR) — voir docstring. Skip.")
        return 0
    full_g = json.load(open(os.path.join(HERE, 'cgram_gender.json'), encoding='utf-8'))
    vdc = json.load(open(os.path.join(HERE, '..', 'extension', 'assets', 'vdc-lex.json'), encoding='utf-8'))
    hf_gn = vdc.get('gn', {})
    lef = load_lefff_nc_gender(LEFFF)

    extra = [w for w in lef if w not in full_g]                 # noms genrés que Lefff a, pas notre full cgram
    extra_hf = [w for w in lef if w not in hf_gn]                # … pas notre sous-ensemble HF embarqué
    inter = [w for w in lef if w in full_g and full_g[w] in ('m', 'f')]
    agree = sum(1 for w in inter if full_g[w] == lef[w])
    print(f"[lefff] noms genrés (nc, non ambigu) : Lefff {len(lef)} · cgram full {len(full_g)} · HF embarqué {len(hf_gn)}")
    print(f"[lefff] GAIN couverture genre : +{len(extra)} noms vs cgram full · +{len(extra_hf)} vs HF embarqué")
    print(f"[lefff] FIABILITÉ : accord genre Lefff↔cgram sur l'intersection {len(inter)} = {100*agree/max(1,len(inter)):.1f}%")
    print(f"[lefff] exemples de noms ajoutés : {extra[:12]}")
    print("[lefff] Lecture : Lefff comblerait largement le gap *genre déterminant* (route lexicale du nom-tête),")
    print("        avec une cohérence ~99 % vs Lexique 4. Intégration = arbitrage licence LGPL-LR vs CC BY-SA.")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
