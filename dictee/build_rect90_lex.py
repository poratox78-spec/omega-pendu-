# -*- coding: utf-8 -*-
"""build_rect90_lex.py — SPELLER : les graphies RECTIFIÉES de 1990 sont justes (liste n° 109, choix de Rem, 18/10/2026).

Le symptôme : « Il apparait au loin » → apparaît EN ROUGE, « Ça coute cher » → coûte, « Je cèderai ma place » muet par chance,
« Ils s'abiment » → mot inconnu. L'orthographe de 1990 est l'orthographe officielle recommandée : ses graphies ne sont pas des
fautes. Le dictionnaire en connaissait la plupart des mots isolés (connaitre, maitre, ognon, évènement, weekend…) mais pas les
FORMES (conjugaisons, pluriels, dérivés).

Trois règles, appliquées à la base du dictionnaire (Lexique 4 + les lots — pas l'asset livré, qui contient ce lot) :
  1. circonflexe retiré sur i et u (« apparait », « coute », « abimer », « goulument ») — SAUF là où 1990 le garde :
     dû, mûr(e)(s), sûr(e)(s), jeûne(r), les formes de croître (homographes de croire), et les terminaisons verbales où il est
     grammatical (passé simple « nous fîmes, vous fûtes », subjonctif imparfait « qu'il fît ») ;
  2. é → è au futur et au conditionnel (« je cèderai », « tu préfèrerais ») ;
  3. les graphies de Morphalou attestées par Dicollecte (dictionnaire de Grammalecte, réforme 1990) dont le jumeau traditionnel
     est connu (è/é, i/î, u/û).
Même contrat que les autres lots : FreqOrtho 0 → connues, jamais proposées (la graphie traditionnelle reste celle que le
correcteur propose), jamais concurrentes au tri. Nature : celle du jumeau traditionnel.

  python dictee/build_rect90_lex.py            # régénère dictee/rect90_lex_fr.tsv.gz (Lexique4 + Morphalou, data_local)
  python dictee/build_rect90_lex.py --check    # forme du TSV commité et son câblage dans le speller livré (témoins)
"""
import io, gzip, json, re, sys, os
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..')
OUT = os.path.join(HERE, 'rect90_lex_fr.tsv.gz')
LOTS = ('wikt_lex_fr.tsv', 'argot_rows.tsv', 'participle_rows.tsv', 'gacc_lex_fr.tsv', 'morph_na_lex_fr.tsv', 'morph_ver_lex_fr.tsv.gz',
        'morph_acc_lex_fr.tsv', 'conj_lex_fr.tsv', 'metier_lex_fr.tsv', 'ver_justes_lex_fr.tsv.gz')
TEMOINS_OUI = ('apparait', 'coute', 'cèderai', 'abimer', 'goulument')
TEMOINS_NON = ('fimes', 'futes')   # « nous fîmes », « vous fûtes » gardent le circonflexe
GARDE = {'dû', 'mûr', 'mûre', 'mûrs', 'mûres', 'sûr', 'sûre', 'sûrs', 'sûres'}
CAT = {'N': 'NOM', 'V': 'VER', 'A': 'ADJ'}


def ouvrir(p):
    return gzip.open(p, 'rt', encoding='utf-8') if p.endswith('.gz') else io.open(p, encoding='utf-8')


def base():
    pos = {}
    for p in [os.environ.get('LEX4', os.path.join(ROOT, 'data_local', 'Lexique4.tsv'))] + [os.path.join(HERE, l) for l in LOTS]:
        if not os.path.exists(p): continue
        for l in ouvrir(p):
            c = l.rstrip('\n').split('\t'); w = c[0].strip().lower()
            if not w: continue
            cg = c[4].strip().upper() if len(c) > 4 else ''
            k = 'N' if cg.startswith('NOM') else ('V' if cg.startswith(('VER', 'AUX')) else ('A' if cg.startswith('ADJ') else ('R' if cg.startswith('ADV') else '')))
            pos.setdefault(w, set());
            if k: pos[w].add(k)
    return pos


def generer():
    B = base()
    cj = json.load(io.open(os.path.join(ROOT, 'extension', 'assets', 'vdc-lex.json'), encoding='utf-8'))['cj']['c']
    gramm, croitre = set(), set()
    for lem, tps in cj.items():
        for t, sl in tps.items():
            for pn, fo in sl.items():
                for f in (fo if isinstance(fo, list) else [fo]):
                    if not f: continue
                    if (t == 'ind:pas' and pn in ('1p', '2p')) or (t == 'sub:imp' and pn == '3s'): gramm.add(f.lower())
                    if lem == 'croitre': croitre.add(f.lower())
    croitre |= {'croître', 'crû', 'crûs'}
    cand = {}
    def add(w, jumeau):                                              # un mot de lettres seules (le dictionnaire coupe au trait d'union), « œ » écrit « oe » comme lui
        w = w.replace('œ', 'oe').replace('æ', 'ae')
        if re.match(r'^[a-zà-ÿ]+$', w) and w not in B and w not in cand: cand[w] = jumeau
    for w in B:                                                      # 1. circonflexe sur i et u
        if 'î' not in w and 'û' not in w: continue
        if w in GARDE or w.startswith('jeûn') or w in croitre or w in gramm: continue
        if B[w] == {'V'} and re.search(r'(îmes|îtes|[^ao]ît|ûmes|ûtes|ût)$', w): continue   # passé simple / subjonctif imparfait, même hors table (« -aît », « -oît » : présent, « apparait »)
        add(w.replace('î', 'i').replace('û', 'u'), w)
    futc = re.compile(r'^(.*)é([^aeiouyéèêëàâîïôûù]+)er(ai|as|a|ons|ez|ont|ais|ait|ions|iez|aient)$')
    for lem, tps in cj.items():                                       # 2. é → è au futur et au conditionnel
        for t in ('ind:fut', 'cnd:pre'):
            for pn, fo in (tps.get(t) or {}).items():
                for f in (fo if isinstance(fo, list) else [fo]):
                    if not f: continue
                    m = futc.match(f.lower())
                    if m and f.lower() in B: add(m.group(1) + 'è' + m.group(2) + 'er' + m.group(3), f.lower())
    with io.open(os.path.join(ROOT, 'data_local', 'morphalou', 'Morphalou3.1_CSV.csv'), encoding='utf-8', errors='replace') as fh:   # 3. Dicollecte
        for l in fh:
            p = l.rstrip('\n').split(';')
            if len(p) < 18 or 'dicollecte' not in p[17].split(): continue
            w = p[9].strip().lower().replace('œ', 'oe')
            if not w or not re.match(r'^[a-zà-ÿ]+$', w) or w in B: continue
            for i, ch in enumerate(w):
                for a, b in (('è', 'é'), ('i', 'î'), ('u', 'û')):
                    if ch == a and (w[:i] + b + w[i + 1:]) in B: add(w, w[:i] + b + w[i + 1:])
    rows = []
    for w, j in sorted(cand.items()):
        cats = sorted(CAT[k] for k in B.get(j, ()) if k in CAT) or (['ADV'] if 'R' in B.get(j, ()) else ['VER' if re.search(r'(er|ir|re|ai|as|a|ons|ez|ont|ais|ait|ions|iez|aient)$', w) else 'NOM'])
        for cg in cats:
            row = [''] * 37; row[0] = w; row[3] = j; row[4] = cg; row[5] = cg; row[9] = '0'; row[10] = '0'; row[11] = '0'
            rows.append('\t'.join(row))
    with gzip.open(OUT, 'wt', encoding='utf-8', newline='\n') as f: f.write('\n'.join(rows) + '\n')
    print('✓ rect90 : %d graphies rectifiées (%d lignes) -> %s' % (len(cand), len(rows), os.path.relpath(OUT, ROOT)))


def check():
    if not os.path.exists(OUT): print('✗ rect90_lex_fr.tsv.gz absent'); return 1
    n = bad = 0; lot = set()
    for l in ouvrir(OUT):
        if not l.strip(): continue
        n += 1; c = l.rstrip('\n').split('\t')
        if len(c) != 37 or c[10] != '0' or c[4] not in ('VER', 'NOM', 'ADJ', 'ADV'): bad += 1
        lot.add(c[0])
    if bad: print('✗ rect90 : %d ligne(s) mal formée(s) (37 colonnes, VER/NOM/ADJ/ADV, FreqOrtho 0)' % bad); return 1
    SP = set(l.split('\t', 1)[0] for l in gzip.open(os.path.join(ROOT, 'extension', 'assets', 'speller.tsv.gz'), 'rt', encoding='utf-8') if l.strip())
    absents = [w for w in lot if w not in SP]
    if absents: print('✗ rect90 : %d forme(s) du lot absentes du speller livré (ex. %s) — régénérer le speller' % (len(absents), absents[0])); return 1
    for w in TEMOINS_OUI:
        if w not in SP: print('✗ rect90 : graphie rectifiée « %s » inconnue du speller livré' % w); return 1
    for w in TEMOINS_NON:
        if w in lot: print('✗ rect90 : « %s » est dans le lot (1990 garde le circonflexe du passé simple)' % w); return 1
    print('✓ rect90_lex_fr.tsv.gz : %d lignes, 37 colonnes, FreqOrtho 0 ; câblé dans le speller livré (%s connus ; fimes, futes hors du lot)'
          % (n, ', '.join(TEMOINS_OUI)))
    return 0


def main():
    if '--check' in sys.argv: return check()
    p = os.path.join(ROOT, 'data_local', 'morphalou', 'Morphalou3.1_CSV.csv')
    if not os.path.exists(p): print('✗ %s absent (data_local) : impossible de régénérer' % os.path.relpath(p, ROOT)); return 1
    generer(); return 0


if __name__ == '__main__':
    sys.exit(main())
