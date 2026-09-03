# -*- coding: utf-8 -*-
"""etat_gen.py — ETAT.md (racine) est GÉNÉRÉ, jamais écrit à la main.

Le défaut fermé ici (remise en ordre, plan du 24/08) : les « états des lieux » écrits à la main
périment en silence — décomptes faux, chantiers annoncés ouverts alors que la mesure les a fermés
(37 PR entre deux notes suffisent). Un état GÉNÉRÉ ne peut pas dériver : il n'affirme que ce que
ses sources machine disent au moment où on le régénère, et --check rougit s'il est rassis.

Sources machine (aucun chiffre recopié à la main) :
  (a) dictee/metriques_probe.js — LE registre unique des chiffres que le site affirme (on parse
      son littéral REGISTRE : même source, zéro duplication — c'est lui qui garde déjà les pages) ;
  (b) dev.sh — les lignes `run`/`runsh` = la liste des garde-fous ACTIFS (nom + commande), même
      motif d'extraction que dictee/ci_parity_probe.py (qui garde le miroir ci.yml) ;
  (c) dictee/etat_chantiers.json — chantiers ouverts / fermés par la mesure. C'est le SEUL
      maillon curé à la main de la chaîne ; l'assemblage reste généré.

Usage : python3 dictee/etat_gen.py            (ré)écrit ETAT.md
        python3 dictee/etat_gen.py --check    régénère EN MÉMOIRE et échoue (exit 1) si ETAT.md
                                              sur disque diffère — fraîcheur structurelle.

Motif validé sur des positifs connus (règle mémoire du 27/08) : chaque parseur exige un plancher
d'entrées (8 métriques et 84 garde-fous à la pose, recoupés au grep) — s'il n'y arrive plus,
c'est LUI qui casse (exit 2), jamais un ETAT.md silencieusement vide.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
ETAT = os.path.join(ROOT, 'ETAT.md')
METRIQUES = os.path.join(HERE, 'metriques_probe.js')
DEVSH = os.path.join(ROOT, 'dev.sh')
CHANTIERS = os.path.join(HERE, 'etat_chantiers.json')

PORTEES = {'ci': 're-vérifié à chaque CI', 'locale': 'reproductible en local',
           'constat': 'mesuré une fois, daté'}


def mourir(msg):
    print('  ✗ etat_gen : ' + msg)
    sys.exit(2)


def lire(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


# ── (a) le registre des chiffres du site ────────────────────────────────────────
def js_str(chunk, cle):
    m = re.search(cle + r":\s*'((?:\\.|[^'\\])*)'", chunk)
    return m.group(1).replace("\\'", "'") if m else None


def registre():
    src = lire(METRIQUES)
    m = re.search(r'const REGISTRE = \{(.*?)\n\};', src, re.S)
    if not m:
        mourir('bloc `const REGISTRE = {…};` introuvable dans metriques_probe.js — le parseur '
               'ne comprend plus sa source (il la comprenait le 03/09/2026 : 8 entrées).')
    bloc = m.group(1)
    debuts = [(mm.start(), mm.group(1)) for mm in re.finditer(r'^\s{2}(\d+):\s*\{', bloc, re.M)]
    entrees = []
    for i, (pos, valeur) in enumerate(debuts):
        fin = debuts[i + 1][0] if i + 1 < len(debuts) else len(bloc)
        chunk = bloc[pos:fin]
        nom = js_str(chunk, 'nom')
        portee = js_str(chunk, 'portee')
        fichier = js_str(chunk, 'fichier')
        if not nom or not portee:
            mourir('entrée %s du REGISTRE sans nom ou sans portée — parseur ou source cassés.' % valeur)
        entrees.append({'valeur': int(valeur), 'nom': nom, 'portee': portee, 'fichier': fichier})
    if len(entrees) < 5:
        mourir('%d entrée(s) parsée(s) dans le REGISTRE (8 attendues au minimum historique 5) — '
               'motif de parsing périmé, corriger etat_gen.py.' % len(entrees))
    return entrees


# ── (b) les garde-fous actifs de dev.sh ─────────────────────────────────────────
def gardefous():
    src = lire(DEVSH)
    checks = []
    for m in re.finditer(r'^\s*run(sh)?\s+"([^"]*)"\s+(.+)$', src, re.M):
        cmd = ' '.join(m.group(3).split())
        if len(cmd) > 100:
            cmd = cmd[:97] + '…'
        checks.append({'nom': m.group(2), 'cmd': cmd, 'sh': bool(m.group(1))})
    if len(checks) < 50:
        mourir('%d ligne(s) run/runsh trouvée(s) dans dev.sh (84 à la pose, plancher 50) — '
               'motif de parsing périmé, corriger etat_gen.py.' % len(checks))
    return checks


# ── (c) les chantiers (curé) ────────────────────────────────────────────────────
def chantiers():
    with open(CHANTIERS, encoding='utf-8') as f:
        data = json.load(f)
    if not data.get('fermes') or not data.get('ouverts'):
        mourir('etat_chantiers.json doit avoir des listes `fermes` ET `ouverts` non vides.')
    for cle, champ in (('fermes', 'verdict'), ('ouverts', 'etat')):
        for c in data[cle]:
            if not (c.get('titre') and c.get(champ) and c.get('ref')):
                mourir('chantier « %s » (%s) : champs requis titre + %s + ref.'
                       % (c.get('titre', '?'), cle, champ))
    return data


# ── assemblage ──────────────────────────────────────────────────────────────────
def fr_nombre(v):
    return '{:,}'.format(v).replace(',', ' ')


def md_cell(s):
    return s.replace('|', '\\|')


def generer(reg, checks, ch):
    L = []
    L.append('# ÉTAT — OMEGA (généré)')
    L.append('')
    L.append('> ⚠️ **FICHIER GÉNÉRÉ** par `python3 dictee/etat_gen.py` — ne pas éditer à la main')
    L.append('> (toute édition sera écrasée et fait rougir `python3 dictee/etat_gen.py --check`).')
    L.append('> Sources machine : `dictee/metriques_probe.js` (registre unique des chiffres que le')
    L.append('> site affirme) · `dev.sh` (garde-fous `run`/`runsh`, miroir CI gardé par')
    L.append('> `ci_parity_probe`) · `dictee/etat_chantiers.json` (chantiers — le seul maillon curé).')
    L.append('')
    L.append('## 1. Les chiffres que le site affirme — %d métriques au registre unique' % len(reg))
    L.append('')
    L.append('| valeur | mesure | provenance | sonde |')
    L.append('|---:|---|---|---|')
    for e in reg:
        L.append('| %s | %s | %s | %s |' % (
            fr_nombre(e['valeur']), md_cell(e['nom']), e['portee'],
            ('`%s`' % e['fichier']) if e['fichier'] else '—'))
    L.append('')
    L.append('Portées : ' + ' · '.join('**%s** = %s' % (k, v) for k, v in PORTEES.items()) +
             '. Le détail (pages, notes) vit dans le registre lui-même.')
    L.append('')
    L.append('## 2. Garde-fous actifs — %d contrôles dans `dev.sh` (= CI, parité gardée)' % len(checks))
    L.append('')
    L.append('| # | contrôle | commande |')
    L.append('|---:|---|---|')
    for i, c in enumerate(checks, 1):
        L.append('| %d | %s | `%s` |' % (i, md_cell(c['nom']), md_cell(c['cmd'])))
    L.append('')
    L.append('## 3. Chantiers (source curée : `dictee/etat_chantiers.json`)')
    L.append('')
    L.append('### Fermés par la mesure — %d' % len(ch['fermes']))
    L.append('')
    for c in ch['fermes']:
        L.append('- **%s** — %s _(%s)_' % (c['titre'], c['verdict'], c['ref']))
    L.append('')
    L.append('### Ouverts — %d' % len(ch['ouverts']))
    L.append('')
    for c in ch['ouverts']:
        L.append('- **%s** — %s _(%s)_' % (c['titre'], c['etat'], c['ref']))
    L.append('')
    return '\n'.join(L)


def main():
    reg, checks, ch = registre(), gardefous(), chantiers()
    attendu = generer(reg, checks, ch)
    if '--check' in sys.argv:
        if not os.path.exists(ETAT):
            print('  ✗ ETAT.md ABSENT — le régénérer : python3 dictee/etat_gen.py')
            return 1
        disque = lire(ETAT).replace('\r\n', '\n')
        if disque != attendu:
            da, dd = attendu.split('\n'), disque.split('\n')
            for i in range(max(len(da), len(dd))):
                a = da[i] if i < len(da) else '<fin de fichier>'
                d = dd[i] if i < len(dd) else '<fin de fichier>'
                if a != d:
                    print('  ✗ ETAT.md RASSIS — première divergence ligne %d :' % (i + 1))
                    print('      sur disque : %s' % d[:140])
                    print('      régénéré   : %s' % a[:140])
                    break
            print('  ⇒ une source a changé (dev.sh, metriques_probe.js, etat_chantiers.json) ou '
                  'ETAT.md a été édité à la main. Régénérer : python3 dictee/etat_gen.py')
            return 1
        print('etat_gen --check : ETAT.md FRAIS (== régénération depuis les 3 sources).')
        return 0
    with open(ETAT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(attendu)
    print('ETAT.md régénéré : %d métriques (registre du site) · %d garde-fous (dev.sh) · '
          '%d chantiers fermés par la mesure / %d ouverts.'
          % (len(reg), len(checks), len(ch['fermes']), len(ch['ouverts'])))
    return 0


if __name__ == '__main__':
    sys.exit(main())
