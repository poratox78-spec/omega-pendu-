# -*- coding: utf-8 -*-
"""Lectures FANTÔMES de la table de conjugaison (chantier « DONNÉE : lectures fantômes 2e personne du singulier sur sommes /
êtes / faites / dites », 11/09/2026).

Lexique 4 agrège plusieurs formes homographes sur UNE ligne avec UN seul champ Nombre ; build_cgram en a tiré, pour 17 formes,
une lecture qui n'existe pas (« sommes » = être 2e du singulier, « mangent » = manger 2e du singulier, « viennent » = venir
1re du singulier, « circonvient » = circonvenir 3e du pluriel…). Ces formes mêlent alors singulier et pluriel : le nombre devient
indécidable et les règles d'accord se taisent (« tu sommes », « tu faites », « les enfants sommes » → silence, mesuré dans
Chrome le 08/09).

RÈGLE (l'autorité est la table de GÉNÉRATION `c`, jamais `f` seule) — une lecture (lemme, temps, personne, nombre) d'une forme
est un fantôme si, et seulement si :
  ① la forme mêle des lectures au singulier et au pluriel ;
  ② la génération connaît la case (lemme, temps, personne+nombre) et y met une AUTRE forme ;
  ③ le même lemme génère cette forme à l'AUTRE nombre (lecture confirmée).
Hors de ①-③ on ne touche à rien : « peux » (pouvoir 1s, que la génération écrit « puis ») est une VARIANTE légitime, pas un
fantôme — la 1re version de ce filtre, sans ①, l'aurait retirée et « je peux » serait devenu « je puis » en rouge.
Cas à part, vu au passage : la génération de « rendre » au subjonctif présent porte « rende » en 3e du PLURIEL et n'a pas de
3e du singulier — on remet 3s = rende, 3p = rendent (paradigme régulier du groupe).

Les deux sources sont corrigées (dictee/cgram_conj.json = référence Python ; dictee/cgram_hf.json = embarqué app → extension via
inject_vdc.py puis build_assets.py) par chirurgie de chaîne, format préservé. Idempotent.
    python3 dictee/patch_conj_phantoms.py [--dir DOSSIER] [--dry]
"""
import io, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DIR = HERE
DRY = '--dry' in sys.argv
if '--dir' in sys.argv: DIR = sys.argv[sys.argv.index('--dir') + 1]


def deacc(s):
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


def fantomes(f, c):
    """Retourne {forme: (anciennes lectures, nouvelles lectures)} selon la règle ①②③."""
    def cell(lem, mt, pn):
        v = (c.get(lem) or {}).get(mt, {}).get(pn)
        if isinstance(v, (list, tuple)): v = v[0]
        return deacc(v.lower()) if v else None
    out = {}
    for k, v in f.items():
        rs = [tuple(x.split(';')) for x in v.split('|') if x.count(';') == 3]
        nbs = {r[3] for r in rs}
        if not ('s' in nbs and 'p' in nbs): continue                                       # ①
        conf = [(lem, mt, p, n) for (lem, mt, p, n) in rs if cell(lem, mt, p + n) == k]
        keep = []
        for lem, mt, p, n in rs:
            g = cell(lem, mt, p + n)
            if g is not None and g != k and any(cl == lem and cn != n for (cl, cm, cp, cn) in conf):   # ② et ③
                continue
            keep.append((lem, mt, p, n))
        if len(keep) != len(rs):
            for (lem, mt, p, n) in list(keep):                                              # lectures que la génération CONFIRME et que f n'avait pas
                for pn2, f2 in ((c.get(lem) or {}).get(mt, {}) or {}).items():
                    f2 = f2[0] if isinstance(f2, (list, tuple)) else f2
                    if f2 and deacc(f2.lower()) == k and (lem, mt, pn2[0], pn2[1]) not in keep: keep.append((lem, mt, pn2[0], pn2[1]))
            out[k] = (v, '|'.join(';'.join(r) for r in keep))
    return out


def chirurgie(path, changes, rendre_fix):
    t = io.open(path, encoding='utf-8', newline='').read()
    n = 0
    for k, (old, new) in sorted(changes.items()):
        a = json.dumps(k, ensure_ascii=False) + ':' + json.dumps(old, ensure_ascii=False)
        b = json.dumps(k, ensure_ascii=False) + ':' + json.dumps(new, ensure_ascii=False)
        if t.count(b) == 1 and t.count(a) == 0: continue                                   # déjà fait
        if t.count(a) != 1: raise SystemExit('%s : ancre « %s » trouvée %d fois' % (path, k, t.count(a)))
        t = t.replace(a, b, 1); n += 1
    if rendre_fix:
        m = re.search(r'"rendre":\{', t)
        if not m: raise SystemExit('%s : lemme rendre introuvable' % path)
        seg_end = t.find('}}', m.end()) + 2
        seg = t[m.start():seg_end]
        if '"3p":"rende"' in seg:
            seg2 = seg.replace('"3p":"rende"', '"3p":"rendent","3s":"rende"', 1)
            t = t[:m.start()] + seg2 + t[seg_end:]; n += 1
    if not DRY:
        io.open(path, 'w', encoding='utf-8', newline='').write(t)
    return n


def main():
    total = 0
    for fn in ('cgram_conj.json', 'cgram_hf.json'):
        p = os.path.join(DIR, fn)
        d = json.loads(io.open(p, encoding='utf-8').read())
        cj = d if fn == 'cgram_conj.json' else d.get('cj', {})
        rs_ = (cj.get('c', {}).get('rendre') or {}).get('sub:pre')
        if rs_ is not None and rs_.get('3p') == 'rende': rs_['3p'] = 'rendent'; rs_['3s'] = 'rende'   # même réparation que la chirurgie, pour la règle
        ch = fantomes(cj.get('f', {}), cj.get('c', {}))
        nread = sum(len(o.split('|')) - len(nw.split('|')) for (o, nw) in ch.values())
        n = chirurgie(p, ch, True)
        print('%-16s %d forme(s) touchée(s), %d lecture(s) fantôme(s), %d modification(s) écrite(s)%s' % (fn, len(ch), nread, n, ' (dry)' if DRY else ''))
        for k in sorted(ch): print('    %-14s %s  →  %s' % (k, ch[k][0][:70], ch[k][1][:60]))
        total += n
    if total and not DRY:
        print('→ relancer : python3 dictee/inject_vdc.py && python3 extension/build_assets.py')
    return 0


if __name__ == '__main__':
    sys.exit(main())
