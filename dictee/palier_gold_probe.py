# -*- coding: utf-8 -*-
u"""ACCORD DE PALIER produit ↔ référence, sur le GOLD DYS — la garde qui aurait vu #667 plus tôt.

⭐ LE TROU QUE CETTE SONDE FERME. Jusqu'au 05/09/2026 la référence Python (`speller_probe.py`)
n'émettait que deux paliers (auto / flag) là où le produit en rend trois (auto / flag / VIGILANCE,
l'orange au clic). Personne ne le voyait : le chiffre de référence (`dys_pipeline_probe`, 402/19)
sur-comptait ~165 « réparations » que le produit ne fait que PROPOSER, et une variante du speller
(`b_slip`) a été crue gagnante sur un palier que le juge ne regardait pas. Le port du palier (#670)
a ramené le chiffre à 239/14 — à produit byte-identique.

CE QUE LA SONDE COMPARE. Sur les productions dys RÉELLES du gold (`gold_claude.jsonl`, champ `raw`),
chaque correction du speller que rendent LES DEUX moteurs pour le MÊME mot (appariement par
occurrence, dans l'ordre) : le PALIER de la référence (`sp.correct_text` → action) contre le palier
du produit (`dys-core.js` équipé de ses assets comme dans `extension/parity_core.js`, `spellText`,
famille `orthographe`). Sortie : accord global + matrice des paires (py, produit) + désaccords.
Les corrections que UN SEUL moteur rend sont comptées à part (elles ne sont pas un désaccord de
palier), jamais dans le pourcentage — mais depuis le 07/09/2026 elles sont ANCRÉES : une nouvelle rougit. C'est
l'angle mort de `parity_speller` (« Python corrige / produit muet »), fermé ici. Et le palier « mot inconnu »
(spellUnknown, orange) est comparé comme un 4ᵉ palier `inconnu` : 5 des 8 « référence seule » du 07/09 étaient
en fait cette famille côté produit.

RÈGLE D'ANCRAGE (--fix) : la référence fige l'accord mesuré ET la liste des désaccords. Une BAISSE
de l'accord est rouge ; un désaccord NOUVEAU est rouge (une hausse ailleurs ne le compense pas —
c'est le masque classique du plancher) ; une HAUSSE est un gain à ré-ancrer, et la sonde le dit.

GARDE LOCALE, ET QUI LE DIT : le gold est PRIVÉ (data_local, jamais versionné) et la référence lit
Lexique4 (licence). Sans l'un ou l'autre la sonde SAUTE explicitement — jamais un vert muet.
  python3 dictee/palier_gold_probe.py          # verdict contre la référence ancrée
  python3 dictee/palier_gold_probe.py --fix    # (ré)ancrer
  python3 dictee/palier_gold_probe.py --tout   # lister tous les désaccords
"""
import io, json, os, subprocess, sys, tempfile
from collections import Counter, defaultdict

if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
DATA = os.environ.get('OMEGA_DYS_DATA') or os.path.join(ROOT, 'data_local', 'dys_reel')   # worktree : OMEGA_DYS_DATA=…
GOLD = os.path.join(DATA, 'gold_claude.jsonl')
REF = os.path.join(HERE, 'palier_gold_ref.json')
DUMP_JS = os.path.join(HERE, 'palier_gold_dump.js')


def textes_gold():
    out = []
    for l in io.open(GOLD, encoding='utf-8'):
        l = l.strip()
        if not l: continue
        try: o = json.loads(l)
        except Exception: continue
        if o.get('raw') and o.get('fixed'):
            out.append(o['raw'].replace(u'’', "'").replace(u'ʼ', "'"))
    return out


def dump_produit(textes):
    d = tempfile.mkdtemp(prefix='omega-palier-')
    fin, fout = os.path.join(d, 'in.json'), os.path.join(d, 'out.json')
    json.dump(textes, io.open(fin, 'w', encoding='utf-8'), ensure_ascii=False)
    r = subprocess.run(['node', DUMP_JS, fin, fout], capture_output=True, text=True, encoding='utf-8', cwd=ROOT)
    if r.returncode != 0 or not os.path.exists(fout):
        print(u'✗ ACCORD DE PALIER : le dump du produit a échoué (node dictee/palier_gold_dump.js)')
        print((r.stderr or r.stdout or '')[-400:])
        return None
    return json.load(io.open(fout, encoding='utf-8'))


def apparier(py, js):
    u"""py / js : [(mot, sugg, palier)] — la k-ième occurrence d'un même mot des deux côtés est la
    même correction. Rend (paires, seulement_py, seulement_js)."""
    occ_js = defaultdict(list)
    for (w, s, t) in js: occ_js[w.lower()].append((w, s, t))
    paires, seul_py = [], []
    for (w, s, t) in py:
        k = w.lower()
        if occ_js[k]: paires.append(((w, s, t), occ_js[k].pop(0)))
        else: seul_py.append((w, s, t))
    seul_js = [x for l in occ_js.values() for x in l]
    return paires, seul_py, seul_js


def cle(p, j):
    return u'%s→%s [%s] vs produit %s [%s]' % (p[0], p[1], p[2], j[1], j[2])


def main():
    fix, tout = '--fix' in sys.argv, '--tout' in sys.argv
    if not os.path.exists(GOLD):
        print(u'· ACCORD DE PALIER : SAUTÉ (gold dys absent de data_local et OMEGA_DYS_DATA non posé — garde locale)')
        return 0
    import speller_probe as S
    if not os.path.exists(S.LEX):
        print(u'· ACCORD DE PALIER : SAUTÉ (Lexique4 absent — garde locale, cf. dev.sh)')
        return 0
    textes = textes_gold()
    prod = dump_produit(textes)
    if prod is None: return 1
    sp = S.Speller()

    matrice, memes, div, seuls = Counter(), Counter(), [], []
    n_py, n_js, n_seul_py, n_seul_js = 0, 0, 0, 0
    for raw, pr in zip(textes, prod):
        py = [(w, s, a) for (_st, w, s, a) in sp.correct_text(raw, inconnu=True)]   # palier « inconnu » compris (07/09/2026)
        js = [(f['word'], f['sugg'] or u'', f['tier']) for f in pr['flags']]
        n_py += len(py); n_js += len(js)
        paires, seul_py, seul_js = apparier(py, js)
        n_seul_py += len(seul_py); n_seul_js += len(seul_js)
        seuls += [u'%s→%s [%s] (référence seule)' % (w, s_ or u'∅', t) for (w, s_, t) in seul_py]
        seuls += [u'%s→%s [%s] (produit seul)' % (w, s_ or u'∅', t) for (w, s_, t) in seul_js]
        for p, j in paires:
            k = u'%s (py) vs %s (produit)' % (p[2], j[2])
            matrice[k] += 1
            if p[1].lower() == j[1].lower(): memes[k] += 1
            if p[2] != j[2]: div.append(cle(p, j))
    n = sum(matrice.values())
    acc = n - len(div)
    pct = 100.0 * acc / n if n else 0.0
    vues = sorted(set(div))

    print(u'ACCORD DE PALIER produit↔référence sur le gold : %d / %d corrections appariées (%.1f %%)' % (acc, n, pct))
    print(u'  (référence : %d corrections, produit : %d · non appariées : %d référence seule, %d produit seul — hors accord)'
          % (n_py, n_js, n_seul_py, n_seul_js))
    for k, v in sorted(matrice.items(), key=lambda kv: -kv[1]):
        a, b = k.split(' (py) vs ')
        print(u'    %s %-40s %4d   (même mot : %d)' % (u'=' if a == b.split(' ')[0] else u'≠', k, v, memes[k]))

    if fix:
        json.dump({'paires': n, 'accord': acc, 'accord_pct': round(pct, 1),
                   'matrice': dict(sorted(matrice.items())), 'desaccords': vues, 'seuls': sorted(set(seuls)),
                   'note': u"Accord de PALIER (auto/flag/vigilance) produit↔référence sur le gold dys, ANCRÉ. "
                           u"Une baisse de l'accord ou un désaccord NOUVEAU rougit ; une hausse est un GAIN à "
                           u"ré-ancrer (--fix). Le gold est local : la sonde SAUTE sans lui."},
                  io.open(REF, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(u'✓ ancré : %d paires, accord %.1f %%, %d désaccord(s) distinct(s), %d hors accord' % (n, pct, len(vues), len(set(seuls))))
        return 0

    if not os.path.exists(REF):
        print(u'✗ ACCORD DE PALIER : pas de référence — ancrer avec : python dictee/palier_gold_probe.py --fix')
        return 1
    ref = json.load(io.open(REF, encoding='utf-8'))
    plancher = float(ref.get('accord_pct') or 0.0)
    connus = set(ref.get('desaccords') or [])
    neufs = sorted(set(vues) - connus)
    disparus = sorted(connus - set(vues))
    if tout:
        for k in vues: print(u'      ' + (u'' if k in connus else u'NOUVEAU  ') + k)

    seuls_connus = set(ref.get('seuls') or [])
    seuls_neufs = sorted(set(seuls) - seuls_connus)
    seuls_disparus = sorted(seuls_connus - set(seuls))
    err = []
    if pct < plancher - 0.05:
        err.append(u'accord %.1f %% < plancher ancré %.1f %% (%d paires, réf. %d)' % (pct, plancher, n, ref.get('paires') or 0))
    if neufs:
        err.append(u'%d désaccord(s) de palier NOUVEAU(X) :' % len(neufs))
    if seuls_neufs:
        err.append(u'%d correction(s) HORS ACCORD NOUVELLE(S) (un seul moteur la rend — l’angle mort de parity_speller) :' % len(seuls_neufs))
    if err:
        print(u'✗ ACCORD DE PALIER : ' + err[0])
        for e in err[1:]: print(u'  ✗ ' + e)
        if neufs:
            for k in neufs[:12]: print(u'      ' + k)
        if seuls_neufs:
            for k in seuls_neufs[:12]: print(u'      ' + k)
        print(u"    (si le changement est VOULU et mesuré : python dictee/palier_gold_probe.py --fix)")
        return 1
    print(u'✓ ACCORD DE PALIER : %.1f %% ≥ plancher %.1f %%, 0 désaccord nouveau (%d ancré(s)), 0 hors-accord nouveau (%d ancré(s))' % (pct, plancher, len(connus), len(seuls_connus)))
    if seuls_disparus:
        print(u'  ✓ %d correction(s) hors accord DISPARUE(S) (appariée ou éteinte) → ré-ancrer (--fix) : %s' % (len(seuls_disparus), u', '.join(d.split(' [')[0] for d in seuls_disparus[:6])))
    if pct > plancher + 0.05 or disparus:
        print(u'  ✓ GAIN — %d désaccord(s) DISPARU(S), accord %.1f %% → ré-ancrer à la hausse (--fix) : %s'
              % (len(disparus), pct, u', '.join(d.split(' vs ')[0] for d in disparus[:6])))
    return 0


if __name__ == '__main__':
    sys.exit(main())
