# -*- coding: utf-8 -*-
u"""ordre_probe.py — les constructeurs des tables de grammaire ne dépendent ni de l'ORDRE des lignes de Lexique, ni du hasard de Python
(LA LISTE n° 143, 23/10/2026).

Chaque constructeur tourne deux fois : Lexique telle quelle avec PYTHONHASHSEED=1, puis Lexique aux lignes MÉLANGÉES avec
PYTHONHASHSEED=2 ; ses tables doivent être identiques (contenu JSON). Recensement du 23/10 sur les 25 constructeurs qui lisent Lexique :
22 stables ; avant correction, build_cgram changeait avec l'ordre (51 paires d'adjectifs, 520 entrées de conjugaison) et avec le seul
tirage de Python (14), build_adj_invariable avec l'ordre (2 mots à trait d'union), build_gender_acc avec le tirage (« ami »).
build_gender_acc lit le Wiktionnaire (data_local, absent de la CI) : il SAUTE là, explicitement.

  python dictee/ordre_probe.py        (sortie 1 = un constructeur dépend de l'ordre ou du hasard)
"""
import io, json, lzma, os, random, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import lots_dictionnaire


def lire_dossier(d):
    out = {}
    for n in sorted(os.listdir(d)):
        with io.open(os.path.join(d, n), encoding='utf-8') as f: out[n] = json.load(f)
    return out


def lancer(args, env):
    r = subprocess.run([sys.executable] + args, cwd=ROOT, env=dict(os.environ, PYTHONUTF8='1', **env), capture_output=True)
    if r.returncode: raise SystemExit('✗ %s : code %d\n%s' % (' '.join(args), r.returncode, r.stderr.decode('utf-8', 'replace')[-600:]))
    return r.stdout.decode('utf-8', 'replace')


def ecarts(a, b):
    n, ex = 0, []
    for k in sorted(set(a) | set(b)):
        x, y = a.get(k), b.get(k)
        if x == y: continue
        if isinstance(x, dict) and isinstance(y, dict):
            d = sorted(kk for kk in set(x) | set(y) if x.get(kk) != y.get(kk)); n += len(d); ex += ['%s/%s' % (k, kk) for kk in d[:3]]
        else: n += 1; ex.append(str(k))
    return n, ex[:5]


def main():
    lex = lots_dictionnaire.lexique()
    if not lex: print('· ordre : SAUTÉ — Lexique 4 introuvable'); return 0
    tmp = tempfile.mkdtemp(prefix='ordre143_')
    ko = 0
    try:
        with lots_dictionnaire.ouvrir(lex) as f: L = f.read().split('\n')
        corps = [l for l in L[1:] if l]; random.Random(143).shuffle(corps)
        tels, mel = os.path.join(tmp, 'tel.tsv'), os.path.join(tmp, 'mel.tsv')
        io.open(tels, 'w', encoding='utf-8', newline='').write('\n'.join([L[0]] + [l for l in L[1:] if l]) + '\n')
        io.open(mel, 'w', encoding='utf-8', newline='').write('\n'.join([L[0]] + corps) + '\n')
        passages = (('A', tels, '1'), ('B', mel, '2'))
        # build_cgram : toutes ses tables, écrites hors de dictee/
        sorties = {}
        for nom, src, seed in passages:
            d = os.path.join(tmp, 'cgram_' + nom); os.makedirs(d)
            lancer(['dictee/build_cgram.py'], {'LEX4': src, 'CGRAM_SORTIE': d, 'PYTHONHASHSEED': seed}); sorties[nom] = lire_dossier(d)
        for n in sorted(sorties['A']):
            e = ecarts(sorties['A'][n], sorties['B'].get(n, {})) if isinstance(sorties['A'][n], dict) else ((0, []) if sorties['A'][n] == sorties['B'].get(n) else (1, ['(liste)']))
            ko += bool(e[0]); print('%s build_cgram %-22s %s' % ('✗' if e[0] else '✓', n, '%d entrée(s) changent (ex. %s)' % e if e[0] else 'stable'))
        # build_adj_invariable : ses paires, calculées sans rien écrire
        code = ('import json, sys; sys.path.insert(0, "dictee"); import build_adj_invariable as B; '
                'print(json.dumps(B.invariable_pairs(), sort_keys=True, ensure_ascii=False))')
        p = {nom: json.loads(lancer(['-c', code], {'PYTHONHASHSEED': seed, 'LEX4': src})) for nom, src, seed in passages}
        e = ecarts(p['A'], p['B']); ko += bool(e[0])
        print('%s build_adj_invariable paires %8s %s' % ('✗' if e[0] else '✓', '', '%d entrée(s) changent (ex. %s)' % e if e[0] else 'stable (%d paires)' % len(p['A'])))
        # build_gender_acc : seulement là où le Wiktionnaire est présent
        if os.path.exists(os.path.join(ROOT, 'data_local', 'fr', 'kaikki-fr.jsonl')):
            g = {}
            for nom, src, seed in passages:
                xz = os.path.join(tmp, nom + '.tsv.xz'); open(xz, 'wb').write(lzma.compress(open(src, 'rb').read(), preset=0))
                o = os.path.join(tmp, 'gacc_' + nom + '.json')
                lancer(['dictee/build_gender_acc.py'], {'GACC_LEX4_XZ': xz, 'GACC_SORTIE': o, 'PYTHONHASHSEED': seed})
                g[nom] = json.load(io.open(o, encoding='utf-8'))
            e = ecarts(g['A'], g['B']); ko += bool(e[0])
            print('%s build_gender_acc %13s %s' % ('✗' if e[0] else '✓', '', '%d entrée(s) changent (ex. %s)' % e if e[0] else 'stable (%d entrées)' % len(g['A'])))
            # build_gender_acc_morphalou : celui de la recette (tables_grammaire.py, ligne 144) — Morphalou en plus
            if os.path.exists(os.path.join(ROOT, 'data_local', 'morphalou', 'Morphalou3.1_CSV.csv')):
                g = {}
                for nom, src, seed in passages:
                    o = os.path.join(tmp, 'gaccm_' + nom + '.json')
                    lancer(['dictee/build_gender_acc_morphalou.py'], {'GACC_LEX4': src, 'GACC_SORTIE': o, 'PYTHONHASHSEED': seed})
                    g[nom] = json.load(io.open(o, encoding='utf-8'))
                e = ecarts(g['A'], g['B']); ko += bool(e[0])
                print('%s build_gender_acc_morphalou %3s %s' % ('✗' if e[0] else '✓', '', '%d entrée(s) changent (ex. %s)' % e if e[0] else 'stable (%d entrées)' % len(g['A'])))
        else:
            print('· build_gender_acc : SAUTÉ — Wiktionnaire (data_local/fr/kaikki-fr.jsonl) absent')
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print('%s constructeurs de tables : %s' % ('✗' if ko else '✓', '%d dépendent de l\'ordre des lignes ou du hasard' % ko if ko else
          'indépendants de l\'ordre des lignes de Lexique et du hasard de Python'))
    return 1 if ko else 0


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
    sys.exit(main())
