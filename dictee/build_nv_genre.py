# -*- coding: utf-8 -*-
"""build_nv_genre.py — GENRE des formes rares qui sont à la fois NOM et VERBE (liste n° 114, 18/10/2026).

« flue de données » → flux : la règle n° 35 donne le nom courant à une forme verbale rarissime placée après un déterminant. Mais
« flue » est aussi un nom (féminin) : la forme n'est plus « verbe seul » et la règle se tait. L'étendre à toutes les formes
nom + verbe tirait 413 fois sur du français juste (refusé). L'indice qui manque est le GENRE : « le flue » ne peut pas être le nom
féminin « flue ». Le genre des noms rares n'est dans aucune table du produit (la table de genre exige Lexique 4, qui ne les a pas) ;
ce script le donne pour les seules formes concernées.

Ce qui entre : une forme du dictionnaire livré (speller.tsv.gz) codée exactement nom + verbe (NV), rare (< 0,01 par million), dont le
genre de nom est UNIQUE et le même dans Morphalou 3.1 et au Wiktionnaire (un nom des deux genres, ou un désaccord, n'entre pas).
La liste fermée est écrite dans dictee/nv_genre_fr.json (lu par speller_probe) et injectée à l'identique dans dys-core.js et l'app
(ligne « var _G114 = … », générée : ne pas l'éditer à la main).

  python dictee/build_nv_genre.py            # régénère le JSON et la ligne JS (speller livré + data_local : Morphalou, Wiktionnaire)
  python dictee/build_nv_genre.py --check    # JSON bien formé, ligne JS == JSON dans les 2 moteurs, formes toujours rares NV, témoins
"""
import io, gzip, json, sys, os, collections
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..')
OUT = os.path.join(HERE, 'nv_genre_fr.json')
CIBLES = ('extension/dys-core.js', 'app/omega-pendu.html')
ANCRE = '  var _DG113={'
DEBUT = '  var _G114={};'
TEMOINS = {'flue': 'f'}


def rares_nv():
    r = {}
    for l in gzip.open(os.path.join(ROOT, 'extension', 'assets', 'speller.tsv.gz'), 'rt', encoding='utf-8'):
        c = l.rstrip('\n').split('\t')
        if len(c) >= 3 and ''.join(sorted(c[2])) == 'NV' and int(c[1] or 0) < 10: r[c[0]] = int(c[1] or 0)   # 10 = 0,01 par million
    return r


def ligne_js(d):
    return (DEBUT + "[['f','%s'],['m','%s']].forEach(function(x){x[1].split(' ').forEach(function(w){_G114[w]=x[0];});});"
            "   /* ⭐ liste n° 114 : genre des formes rares nom + verbe (Morphalou et Wiktionnaire d'accord) — généré par dictee/build_nv_genre.py */\n"
            % (' '.join(d['f']), ' '.join(d['m'])))


def generer():
    nv = rares_nv(); dl = os.path.join(ROOT, 'data_local')
    G = collections.defaultdict(set); lem = None; cat = None; lg = ''
    with io.open(os.path.join(dl, 'morphalou', 'Morphalou3.1_CSV.csv'), encoding='utf-8', errors='replace') as fh:
        for l in fh:
            p = l.rstrip('\n').split(';')
            if len(p) < 18: continue
            if p[0].strip(): cat = p[2].strip(); lem = p[0].strip(); lg = p[5].strip().lower()
            if cat != 'Nom commun' or lem != lem.lower(): continue
            w = p[9].strip().replace('œ', 'oe')
            if w not in nv: continue
            g = p[13].strip().lower().strip('-') or lg
            G[w].add('m' if g.startswith('masc') else 'f' if g.startswith('fem') else 'e')
    W = collections.defaultdict(set)
    with io.open(os.path.join(dl, 'fr', 'kaikki-frwikt.jsonl'), encoding='utf-8') as f:
        for l in f:
            if '"pos": "noun"' not in l: continue
            r = json.loads(l)
            if r.get('lang_code', 'fr') != 'fr' or r.get('pos') != 'noun': continue
            forms = {r.get('word', '').replace('œ', 'oe')} | {x.get('form', '').replace('œ', 'oe') for x in (r.get('forms') or [])}
            forms &= set(G)
            if not forms: continue
            tags = set(r.get('tags') or [])
            for s in (r.get('senses') or []): tags |= set(s.get('tags') or [])
            m, fe = 'masculine' in tags, 'feminine' in tags
            for x in forms: W[x].add('m' if m and not fe else 'f' if fe and not m else 'e' if (m or fe) else '?')
    d = {'f': [], 'm': []}
    for w in sorted(G):
        if len(G[w]) == 1 and G[w] <= {'m', 'f'} and (W.get(w, set()) - {'?'}) == G[w]: d[next(iter(G[w]))].append(w)
    with io.open(OUT, 'w', encoding='utf-8', newline='\n') as f: json.dump(d, f, ensure_ascii=False, indent=0); f.write('\n')
    for c in CIBLES:
        p = os.path.join(ROOT, c); s = io.open(p, encoding='utf-8', newline='').read(); L = ligne_js(d)
        i = s.find(DEBUT)
        if i >= 0: j = s.index('\n', i) + 1; s = s[:i] + L + s[j:]
        else: i = s.index(ANCRE); j = s.index('\n', i) + 1; s = s[:j] + L + s[j:]
        io.open(p, 'w', encoding='utf-8', newline='').write(s)
    print('✓ nv_genre : %d formes rares nom + verbe, %d de genre sûr (f %d, m %d) -> %s + ligne _G114 de %s'
          % (len(nv), len(d['f']) + len(d['m']), len(d['f']), len(d['m']), os.path.relpath(OUT, ROOT), ' et '.join(CIBLES)))


def check():
    if not os.path.exists(OUT): print('✗ nv_genre_fr.json absent'); return 1
    d = json.load(io.open(OUT, encoding='utf-8'))
    if sorted(d) != ['f', 'm'] or any(d[k] != sorted(set(d[k])) for k in d) or set(d['f']) & set(d['m']):
        print('✗ nv_genre_fr.json mal formé (clés f et m, listes triées sans doublon ni recouvrement)'); return 1
    L = ligne_js(d)
    for c in CIBLES:
        if io.open(os.path.join(ROOT, c), encoding='utf-8', newline='').read().count(L) != 1:
            print('✗ %s : ligne _G114 absente ou différente du JSON — relancer python dictee/build_nv_genre.py' % c); return 1
    nv = rares_nv(); hors = [w for k in d for w in d[k] if w not in nv]
    if hors: print('✗ nv_genre : %d forme(s) ne sont plus rares nom + verbe au speller livré (ex. %s) — régénérer' % (len(hors), hors[0])); return 1
    for w, g in TEMOINS.items():
        if w not in d[g]: print('✗ nv_genre : témoin « %s » (%s) absent' % (w, g)); return 1
    print('✓ nv_genre_fr.json : %d formes (f %d, m %d), ligne _G114 identique dans les 2 moteurs JS, toutes rares nom + verbe au speller livré (flue f)'
          % (len(d['f']) + len(d['m']), len(d['f']), len(d['m'])))
    return 0


def main():
    if '--check' in sys.argv: return check()
    for p in (os.path.join(ROOT, 'data_local', 'morphalou', 'Morphalou3.1_CSV.csv'), os.path.join(ROOT, 'data_local', 'fr', 'kaikki-frwikt.jsonl')):
        if not os.path.exists(p): print('✗ %s absent (data_local) : impossible de régénérer' % os.path.relpath(p, ROOT)); return 1
    generer(); return 0


if __name__ == '__main__':
    sys.exit(main())
