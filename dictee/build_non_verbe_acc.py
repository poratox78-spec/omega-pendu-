# -*- coding: utf-8 -*-
"""build_non_verbe_acc.py — la table des COLLISIONS D ACCENT (02/09/2026).

CONJ_F est keyee DESACCENTUEE : `adherent` = adherer ind:pre 3p (« ils adhèrent »). L adjectif « adhérent »
tombe sur la meme cle et le moteur le croit VERBE. Classe mesuree : 24 mots courants (côté, côte, gène,
mûre, précédent, indifférent, adhérent, châsse, faîtes...), TOUS connus du speller donc presents dans du
texte reel. Rem l avait vu au produit (« des adj pris pour des verbes alors qu on sait les identifier »).

La table = mot ACCENTUE connu nom/adj (GENDER_ACC) dont le jumeau desaccentue est dans CONJ_F mais qui
N EST PAS une forme verbale de Morphalou 3.1 (LGPL-LR, data_local/, colonne 9 = forme flechie, categorie
propagee depuis la ligne de LEMME). Filtre anti-bruit : la graphie doit exister dans Morphalou (ecarte
`aié`, `fléche`, `maniére`, `férons`... = fautes presentes dans GENDER_ACC).
Sortie : dictee/non_verbe_acc.json + les litteraux JS de app/extension (miroir strict).
  python dictee/build_non_verbe_acc.py            # regenere et reecrit les 3 cibles
  python dictee/build_non_verbe_acc.py --check    # echoue si une cible a derive
"""
import io, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..')
sys.path.insert(0, HERE)
import correcteur_probe as C
NL = chr(10)

def morphalou():
    p = os.path.join(ROOT, 'data_local', 'morphalou', 'Morphalou3.1_CSV.csv')
    if not os.path.exists(p): return None, None
    verb, tout, cat = set(), set(), None
    with io.open(p, encoding='utf-8', errors='replace') as fh:
        for l in fh:
            q = l.rstrip(NL).split(';')
            if len(q) < 10: continue
            if q[0].strip(): cat = q[2].strip() or cat
            w = q[9].strip().lower(); tout.add(w)
            if cat == 'Verbe': verb.add(w)
    return verb, tout

def calc():
    verb, tout = morphalou()
    if verb is None: return None
    src = set(w for w in C.GENDER_ACC if isinstance(w, str) and w != C.deacc(w))
    return sorted(w for w in src if C.deacc(w) in C.CONJ_F and w not in verb and w in tout)

JS_RE = re.compile(r'var _NON_VERBE_ACC=[{][^}]*[}];')
def js_literal(mots):
    return "var _NON_VERBE_ACC={" + ",".join("'%s':1" % w for w in mots) + "};"

def main():
    check = '--check' in sys.argv
    pj = os.path.join(HERE, 'non_verbe_acc.json')
    mots = calc()
    if mots is None:
        mots = json.load(io.open(pj, encoding='utf-8'))['mots']
        print('· non_verbe_acc : Morphalou absent (data_local) — coherence JSON <-> JS seulement')
    cibles = [os.path.join(ROOT, 'extension', 'dys-core.js'), os.path.join(ROOT, 'app', 'omega-pendu.html')]
    lit = js_literal(mots); ko = []
    if check:
        cur = json.load(io.open(pj, encoding='utf-8'))['mots']
        if cur != mots: ko.append('non_verbe_acc.json a derive (%d vs %d mots)' % (len(cur), len(mots)))
        for t in cibles:
            s = io.open(t, encoding='utf-8').read(); m = JS_RE.search(s)
            if not m or m.group(0) != lit: ko.append(os.path.relpath(t, ROOT) + ' : litteral _NON_VERBE_ACC absent ou different')
        if ko: print('✗ NON_VERBE_ACC :' + NL + '  ' + (NL + '  ').join(ko)); return 1
        print('✓ non_verbe_acc : %d mots, JSON == app == extension' % len(mots)); return 0
    json.dump({"note": "mots ACCENTUES connus nom/adj (GENDER_ACC) dont le jumeau DESACCENTUE est une forme verbale (CONJ_F) mais qui ne sont PAS une forme verbale (Morphalou 3.1, LGPL-LR). Generes par build_non_verbe_acc.py.",
               'mots': mots}, io.open(pj, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for t in cibles:
        s = io.open(t, encoding='utf-8', newline='').read()
        if not JS_RE.search(s): print('✗ ' + t + ' : pas de litteral _NON_VERBE_ACC a remplacer'); return 1
        io.open(t, 'w', encoding='utf-8', newline='').write(JS_RE.sub(lit, s, 1))
    print('✓ ecrit : %d mots -> non_verbe_acc.json + 2 litteraux JS' % len(mots)); return 0

if __name__ == '__main__':
    sys.exit(main())
