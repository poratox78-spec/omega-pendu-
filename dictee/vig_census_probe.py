# -*- coding: utf-8 -*-
u"""GARDE CENSUS DES VIGILANCES (demande de Rem, 2026-08-21 : « note le duo dump+census en garde
après chaque chantier ») — la certitude MESURÉE qu'aucune orange utile n'est perdue.
Re-joue le pipeline réel sur le corpus dys apparié (arbitre_vig_dump.js --dys-seul), classe
chaque orange contre le gold (JUSTE / POINTEUSE / FATIGUE) et compare aux effectifs de RÉFÉRENCE
committés (dictee/vig_census_ref.json — des NOMBRES, jamais le corpus). Tout écart = ROUGE avec
la liste des disparues : un chantier qui perd une juste ne passe pas la batterie.
  python dictee/vig_census_probe.py            # garde (rouge si écart)
  python dictee/vig_census_probe.py --fix      # ré-ancre la référence (changement ASSUMÉ)
Corpus absent (CI) → SAUTÉ explicite, jamais un rouge menteur."""
import os, sys, io, json, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

REF = os.path.join(HERE, 'vig_census_ref.json')
DUMP = os.path.join(ROOT, 'data_local', 'arbitre_vig_census.json')
FIX = '--fix' in sys.argv

def norm(w): return (w or u'').lower().replace(u'’', u"'")

def main():
    if not os.path.exists(os.path.join(ROOT, 'data_local', 'dys_reel', 'dictees_gold.jsonl')):
        print(u'· CENSUS : SAUTÉ (corpus dys absent de data_local — garde locale)')
        return 0
    r = subprocess.run(['node', os.path.join(HERE, 'arbitre_vig_dump.js'), '--dys-seul'],
                       capture_output=True, text=True, encoding='utf-8', cwd=ROOT)
    if r.returncode != 0:
        print(u'✗ CENSUS : le dump a échoué\n' + (r.stderr or '')[-400:]); return 1
    from dys_reel_probe import align
    D = json.load(io.open(DUMP, encoding='utf-8'))
    justes, pointeuses, fatigue = [], [], []
    for t in D['dys']:
        ops = align(t['tokens'], t['tokensFixed'])
        gold = {}; ia = 0
        for op in ops:
            k, a, b = op
            if k == 'ins': continue
            if k == 'del': ia += 1; continue
            gold[ia] = (a, b); ia += 1
        for f in t['flags']:
            g = gold.get(f['i'])
            if g is None: continue
            a, b = g
            cle = u'%s→%s [%s] %s' % (a, f.get('sugg'), f.get('name'), t.get('src'))
            if norm(a) == norm(b): fatigue.append(cle)
            elif norm(f.get('sugg')) == norm(b): justes.append(cle)
            else: pointeuses.append(cle)
    etat = {'justes': len(justes), 'pointeuses': len(pointeuses), 'fatigue': len(fatigue),
            'cles_justes': sorted(justes)}
    if FIX or not os.path.exists(REF):
        json.dump({'justes': etat['justes'], 'pointeuses': etat['pointeuses'],
                   'fatigue': etat['fatigue'], 'cles_justes': etat['cles_justes'],
                   'note': u"effectifs de référence du census (post-cartes PR#523-524) ; le cas sais→s'est de texte4 "
                           u"reste compté SIGNALE_AUTRE ici car le juge B2 (opt-in, WebGPU) est invisible aux harnais Node — "
                           u"sa couverture est prouvée par b2_web_probe (bout-en-bout navigateur)."},
                  io.open(REF, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(u'✓ CENSUS : référence ancrée (justes %d · pointeuses %d · fatigue %d)' % (etat['justes'], etat['pointeuses'], etat['fatigue']))
        return 0
    ref = json.load(io.open(REF, encoding='utf-8'))
    err = []
    if etat['justes'] < ref['justes']:
        perdues = set(ref.get('cles_justes', [])) - set(etat['cles_justes'])
        err.append(u'%d orange(s) JUSTE(S) PERDUE(S) :' % (ref['justes'] - etat['justes']))
        for p in sorted(perdues): err.append(u'    − ' + p)
    if etat['pointeuses'] < ref['pointeuses'] - 2:                     # tolérance 2 (bruit d'alignement)
        err.append(u'pointeuses %d < référence %d (au-delà de la tolérance)' % (etat['pointeuses'], ref['pointeuses']))
    if etat['justes'] > ref['justes']:
        err.append(u'MIEUX que la référence (justes %d > %d) — ré-ancrer : python dictee/vig_census_probe.py --fix' % (etat['justes'], ref['justes']))
    if err:
        print(u'✗ CENSUS VIGILANCE — le chantier a changé le bilan des oranges utiles :')
        for e in err: print(u'  ' + e)
        return 1
    print(u'✓ CENSUS : justes %d/%d · pointeuses %d (réf %d) · fatigue %d (réf %d — sa baisse est un GAIN)' %
          (etat['justes'], ref['justes'], etat['pointeuses'], ref['pointeuses'], etat['fatigue'], ref['fatigue']))
    return 0

if __name__ == '__main__':
    sys.exit(main())
