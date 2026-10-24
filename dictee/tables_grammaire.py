# -*- coding: utf-8 -*-
u"""tables_grammaire.py — LA recette des tables de grammaire du correcteur, en un seul endroit (LA LISTE n° 144, 24/10/2026).

Les tables (dictee/cgram_*.json, cgram_noun_post.json, gender_acc.json, conj_morphalou.json ; cgram_hf.json est embarquée dans l'app
puis l'extension) se construisent depuis Lexique 4.00, le Wiktionnaire, Morphalou 3.1 et le LEFFF, en dix étapes, dans cet ordre :

   1. build_cgram                 Lexique (+ LEFFF) : verbes, genre, adjectifs, conjugaison, inventaire, garde-fous
      bclf                        le classifieur de bornes (bornes_clf.json, #617) recopié dans cgram_hf.json
   2. build_noun_post             Lexique : part nom / verbe de chaque forme
   3. build_wikt_gender           lots du dictionnaire : genre des noms du Wiktionnaire et de l'argot (gn, noun_post)
   4. build_adj_invariable        Lexique : paires des masculins invariables en -x / -s
   5. build_conj_morphalou        Morphalou : verbes absents de Lexique (conj_morphalou.json)
   6. build_gender_acc_morphalou  Wiktionnaire + Lexique + Morphalou : genre accentué — AVANT la complétion de la conjugaison
   7. clean_gender_acc_noise      genre accentué : bruit sans accent retiré
   8. bake_conj_table             conjugaison : 3e pluriel régulier et passé simple, écrits en table
   9. complete_conj_morphalou     conjugaison : cases vides remplies par Morphalou
  10. héritage                    conjugaison : conj_heritage.json (ci-dessous)
puis la livraison : build_gacc_js → inject_gacc, inject_vdc, inject_noun_post, extension/build_assets, paquet, zip.

Jusqu'au 24/10 ces tables étaient des ACCRÉTIONS : bâties sur une Lexique antérieure, puis complétées par des scripts relancés à des
dates différentes, une fusion faite à la main (le genre accentué, #573, depuis un script resté dans data_local) et des retouches.
Rejouées telles quelles en 4.00, quatre ne se reproduisaient pas (adjectifs −626 entrées, noms −21 903, genre accentué −54 032,
conjugaison −7 019 verbes). Rejouées DANS CET ORDRE, avec leurs bases de naissance : noun_post, conj_morphalou, l'inventaire, le genre
et les garde-fous redonnent le commité ; adjectifs, genre des noms et genre accentué à quelques mots près (les règles stables de la
ligne 143 — adoptées le 24/10, 0 marque changée sur 28 772 textes réels) ; la conjugaison, non.

FIGÉE : cgram_gender_relaxed.json (genre « relâché », build_gender_relaxed.py, 10/07) — ni la Lexique ni le dictionnaire de sa
naissance ne la redonnent (±780 noms selon le seuil de fréquence) ; la recette la LIT (genre du moteur, étape 6), ne la réécrit pas.

L'HÉRITAGE. La conjugaison livrée a été complétée par des versions successives de complete_conj_morphalou, chacune sur l'état du
dictionnaire de son jour ; la version actuelle ne redonne pas toutes ces cases (et en propose d'autres). conj_heritage.json écrit la
différence, case par case et lecture par lecture : recette + héritage == table livrée. L'héritage n'est pas une vérité, c'est une
dette nommée : chaque case qui en sort doit le faire par une règle mesurée (alors --heritage le recalcule).

  python dictee/tables_grammaire.py --check          # garde (dev.sh + CI) : l'héritage est appliqué aux tables livrées
  python dictee/tables_grammaire.py --verifier       # rejoue les 10 étapes en place, compare au commité, restaure (sources locales)
  python dictee/tables_grammaire.py --reconstruire   # les 10 étapes puis la livraison (écrit)
  python dictee/tables_grammaire.py --heritage       # recalcule conj_heritage.json : la table livrée moins ce que la recette redonne
"""
import io, json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import conj_io, lots_dictionnaire
ETAPES = ('build_cgram', 'bclf', 'build_noun_post', 'build_wikt_gender', 'build_adj_invariable', 'build_conj_morphalou', 'build_gender_acc_morphalou',
          'clean_gender_acc_noise', 'bake_conj_table', 'complete_conj_morphalou')


def bclf():
    u"""Le classifieur de bornes (bornes_clf.json, build_bornes_clf.py, #617), recopié sans sa notice dans cgram_hf.json « bclf »."""
    p = os.path.join(HERE, 'cgram_hf.json'); hf = json.load(io.open(p, encoding='utf-8'))
    b = json.load(io.open(os.path.join(HERE, 'bornes_clf.json'), encoding='utf-8'))
    hf['bclf'] = {k: v for k, v in b.items() if k != 'meta'}
    io.open(p, 'w', encoding='utf-8', newline='').write(conj_io.serialiser(hf))
LIVRAISON = ('dictee/build_gacc_js.py', 'dictee/inject_gacc.py', 'dictee/inject_vdc.py', 'dictee/inject_noun_post.py', 'extension/build_assets.py',
             'build_lexiques.py', 'extension/build_zip.py')
TABLES = ('cgram_hf.json', 'cgram_conj.json', 'cgram_adj.json', 'cgram_gender.json', 'cgram_words.json', 'cgram_guard.json', 'cgram_det.json',
          'cgram_verbs.json', 'cgram_plural.json', 'cgram_noun_post.json', 'gender_acc.json', 'conj_morphalou.json')
CONJ = ('cgram_conj.json', 'cgram_hf.json')
HERITAGE = os.path.join(HERE, 'conj_heritage.json')
SOURCES = (os.path.join(ROOT, 'data_local', 'morphalou', 'Morphalou3.1_CSV.csv'), os.path.join(ROOT, 'data_local', 'fr', 'kaikki-fr.jsonl'),
           os.environ.get('LEFFF', 'C:/tmp/lefff/lefff-3.4.mlex'))


def _cj(d, fn):
    return d if fn == 'cgram_conj.json' else d['cj']


def appliquer(heritage):
    u"""Étape 10 : chaque case et chaque lecture de l'héritage reçoit sa valeur (None = absente). Rend le nombre de changements."""
    n = 0
    for fn in CONJ:
        p = os.path.join(HERE, fn); raw = io.open(p, encoding='utf-8').read()
        d = conj_io.charger(p); cj = _cj(d, fn); h = heritage[fn]
        for lem, mts in h['c'].items():
            for mt, sl in mts.items():
                if sl is None:                                  # ce temps est absent de la table livrée
                    if mt in cj['c'].get(lem, {}): del cj['c'][lem][mt]; n += 1
                    continue
                temps = cj['c'].setdefault(lem, {}).setdefault(mt, {})   # présent, même vide : la table livrée garde parfois {} (« bouiller »)
                for s, v in sl.items():
                    if temps.get(s) == v: continue
                    n += 1
                    if v is None: del temps[s]
                    else: temps[s] = v
        for k, v in h['f'].items():
            if cj['f'].get(k) == v: continue
            n += 1
            if v is None: cj['f'].pop(k, None)
            else: cj['f'][k] = v
        # L'ORDRE DES VERBES aussi (24/10) : le moteur indexe le passé simple en parcourant la table, et garde la première lecture
        # trouvée — triée, la table rendait « nous vîtes » muet (24 cas de couverture perdus, contenu pourtant identique)
        rang = dict((l, i) for i, l in enumerate(h.get('ordre', [])))
        cj['c'] = dict(sorted(cj['c'].items(), key=lambda kv: (rang.get(kv[0], len(rang)), kv[0])))
        out = conj_io.serialiser(d)
        if out != raw: io.open(p, 'w', encoding='utf-8', newline='').write(out)
    return n


def check():
    if not os.path.exists(HERITAGE): print('✗ conj_heritage.json absent'); return 1
    h = json.load(io.open(HERITAGE, encoding='utf-8')); ko = []
    for fn in CONJ:
        cj = _cj(conj_io.charger(os.path.join(HERE, fn)), fn)
        for lem, mts in h[fn]['c'].items():
            for mt, sl in mts.items():
                cur = cj['c'].get(lem, {}).get(mt)
                if sl is None:
                    if cur is not None: ko.append('%s c %s %s (absent attendu)' % (fn, lem, mt))
                    continue
                if cur is None: ko.append('%s c %s %s (présent attendu)' % (fn, lem, mt)); continue
                ko += ['%s c %s %s %s' % (fn, lem, mt, s) for s, v in sl.items() if cur.get(s) != v]
        ko += ['%s f %s' % (fn, k) for k, v in h[fn]['f'].items() if cj['f'].get(k) != v]
        o = h[fn].get('ordre', []); so = set(o)
        if [l for l in cj['c'] if l in so] != [l for l in o if l in cj['c']]: ko.append('%s : ordre des verbes' % fn)
    n = sum(len(sl or {}) or 1 for fn in CONJ for mts in h[fn]["c"].values() for sl in mts.values()) + sum(len(h[fn]['f']) for fn in CONJ)
    if ko:
        print('✗ héritage de la conjugaison NON appliqué aux tables livrées : %d écart(s) (ex. %s) — une table reconstruite sans l\'étape 10 '
              '(python dictee/tables_grammaire.py --reconstruire), ou l\'héritage à recalculer (--heritage)' % (len(ko), ko[:3])); return 1
    print('✓ héritage de la conjugaison appliqué aux tables livrées (%d case(s) et lecture(s) que la recette seule ne redonne pas)' % n)
    return 0


def _git(*a):
    return subprocess.run(['git'] + list(a), cwd=ROOT, capture_output=True).stdout


def _sources():
    manque = [p for p in SOURCES if not os.path.exists(p)]
    if not lots_dictionnaire.lexique(): manque.append('Lexique 4')
    return manque


def _etapes():
    env = dict(os.environ, LEX4=lots_dictionnaire.lexique(), PYTHONUTF8='1')
    for e in ETAPES:
        if e == 'bclf': bclf(); print('  · %-28s fait' % e, flush=True); continue
        r = subprocess.run([sys.executable, os.path.join(HERE, e + '.py')], cwd=ROOT, env=env, capture_output=True)
        print('  · %-28s %s' % (e, 'code %d' % r.returncode if r.returncode else 'fait'), flush=True)
        if r.returncode: raise SystemExit(r.stderr.decode('utf-8', 'replace')[-800:])


def _contenu(fn, raw):
    d = json.loads(raw.decode('utf-8'))
    if fn in CONJ:
        cj = _cj(d, fn); full = conj_io.reconstruire(cj); full['ordre des verbes'] = list(full['c'])   # l'ordre compte (voir appliquer)
        if fn == 'cgram_conj.json': d = full
        else: d = dict(d); d['cj'] = full
    return d


def _propres():
    return not _git('status', '--porcelain', '--', *[os.path.join('dictee', t) for t in TABLES + ('conj_heritage.json',)]).strip()


def verifier():
    u"""Rejoue les 10 étapes en place, compare chaque table au commité (contenu), restaure les tables."""
    manque = _sources()
    if manque: print('✗ sources absentes : %s' % ', '.join(manque)); return 1
    if not _propres(): print('✗ des tables diffèrent de git HEAD : commiter ou restaurer avant de vérifier'); return 1
    ko = 0
    try:
        _etapes(); n = appliquer(json.load(io.open(HERITAGE, encoding='utf-8')))
        print('  · héritage                      %d case(s) et lecture(s)' % n)
        for t in TABLES:
            a = _contenu(t, _git('show', 'HEAD:dictee/' + t)); b = _contenu(t, open(os.path.join(HERE, t), 'rb').read())
            ok = a == b; ko += not ok
            if ok: print('✓ %-22s redonne le commité' % t)
            else:
                ks = sorted(k for k in set(a) | set(b) if a.get(k) != b.get(k)) if isinstance(a, dict) else ['(liste)']
                print('✗ %-22s DIFFÈRE (clés : %s)' % (t, ks[:6]))
    finally:
        _git('checkout', '--', *[os.path.join('dictee', t) for t in TABLES])
        _git('checkout', '--', 'dictee/gacc_lex_js.json')
    print('%s %d table(s) sur %d redonnent le commité' % ('✓' if not ko else '✗', len(TABLES) - ko, len(TABLES)))
    return 1 if ko else 0


def heritage():
    u"""conj_heritage.json = la conjugaison commitée moins ce que les 9 premières étapes redonnent (cases de `c`, puis lectures de `f`)."""
    manque = _sources()
    if manque: print('✗ sources absentes : %s' % ', '.join(manque)); return 1
    if not _propres(): print('✗ des tables diffèrent de git HEAD : commiter ou restaurer avant de recalculer'); return 1
    vieux = {fn: _cj(conj_io.charger(os.path.join(HERE, fn)), fn) for fn in CONJ}
    try:
        _etapes()
        h = {}
        for fn in CONJ:
            a, p = vieux[fn], os.path.join(HERE, fn)
            d = conj_io.charger(p); b = _cj(d, fn)
            c = {}
            for lem in sorted(set(a['c']) | set(b['c'])):
                for mt in sorted(set(a['c'].get(lem, {})) | set(b['c'].get(lem, {}))):
                    x, y = a['c'].get(lem, {}).get(mt), b['c'].get(lem, {}).get(mt)
                    if x == y: continue
                    if x is None: c.setdefault(lem, {})[mt] = None; continue          # temps absent de la table livrée
                    c.setdefault(lem, {})[mt] = {s: x.get(s) for s in sorted(set(x) | set(y or {})) if x.get(s) != (y or {}).get(s)}
            f = {k: a['f'].get(k) for k in sorted(set(a['f']) | set(b['f'])) if a['f'].get(k) != b['f'].get(k)}   # `f` est écrit en table :
            h[fn] = {'c': c, 'f': f, 'ordre': list(a['c'])}                                                          # une case changée ne le change pas
        io.open(HERITAGE, 'w', encoding='utf-8', newline='').write(json.dumps(h, ensure_ascii=False, sort_keys=True, indent=0))
        for fn in CONJ:
            print('✓ héritage %-16s %d case(s), %d lecture(s)' % (fn, sum(len(sl or {}) or 1 for mts in h[fn]["c"].values() for sl in mts.values()), len(h[fn]['f'])))
    finally:
        _git('checkout', '--', *[os.path.join('dictee', t) for t in TABLES])
        _git('checkout', '--', 'dictee/gacc_lex_js.json')
    return 0


def reconstruire():
    manque = _sources()
    if manque: print('✗ sources absentes : %s' % ', '.join(manque)); return 1
    _etapes(); n = appliquer(json.load(io.open(HERITAGE, encoding='utf-8')))
    print('  · héritage                      %d case(s) et lecture(s)' % n)
    for e in LIVRAISON:
        r = subprocess.run([sys.executable, e], cwd=ROOT, env=dict(os.environ, PYTHONUTF8='1'), capture_output=True)
        print('  · %-28s %s' % (e, 'code %d' % r.returncode if r.returncode else 'fait'), flush=True)
        if r.returncode: print(r.stderr.decode('utf-8', 'replace')[-600:]); return 1
    print('✓ tables de grammaire reconstruites et livrées. Ensuite : ./dev.sh fresh')
    return 0


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
    a = sys.argv[1:]
    sys.exit(check() if '--check' in a else verifier() if '--verifier' in a else reconstruire() if '--reconstruire' in a else
             heritage() if '--heritage' in a else (print(__doc__) or 0))
