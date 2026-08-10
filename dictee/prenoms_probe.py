# -*- coding: utf-8 -*-
"""LA TABLE DES PRÉNOMS EXISTE EN TROIS COPIES — elles doivent être la MÊME.

`dictee/prenoms_genre.tsv` (référence Python) · le blob `prenoms-gz` de `app/omega-pendu.html` ·
`extension/assets/prenoms.tsv.gz` (dérivé par build_assets). Trois moteurs, une seule donnée : si
elles divergent, l'accord sur les prénoms ne dit pas la même chose selon qu'on est sur le site,
dans l'app ou dans l'extension — et la parité 3 moteurs ne le verrait pas forcément (elle compare
des SORTIES sur un échantillon, pas les tables).

⚠️ POURQUOI PAS `build_prenoms.py --check` EN CI : son dump source (`data_local/fr/kaikki-frwikt.jsonl`)
est GITIGNORÉ, donc absent du runner — le check mourrait sur « [FATAL] dump absent ». C'est le piège
payé le 2026-08-10 avec `lex4_en.b64` (PR#458) : un check qui ne peut pas tourner là où il compte ne
vaut rien. Ici on ne vérifie QUE ce qui est au dépôt.

    python3 dictee/prenoms_probe.py      # code de sortie ≠ 0 si les copies divergent
"""
import io, os, re, sys, gzip, base64

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(HERE)
TSV = os.path.join(HERE, 'prenoms_genre.tsv')
APP = os.path.join(RACINE, 'app', 'omega-pendu.html')
EXT = os.path.join(RACINE, 'extension', 'assets', 'prenoms.tsv.gz')

echec = []
ref = io.open(TSV, encoding='utf-8').read()

html = io.open(APP, encoding='utf-8').read()
m = re.search(r'<script type="text/plain" id="prenoms-gz">([^<]*)</script>', html)
if not m:
    echec.append('bloc prenoms-gz ABSENT de app/omega-pendu.html — la règle « sujet = prénom » ne peut pas tourner')
else:
    app_txt = gzip.decompress(base64.b64decode(re.sub(r'\s', '', m.group(1)))).decode('utf-8')
    if app_txt != ref:
        echec.append('le blob prenoms-gz de l\'app DIFFÈRE de dictee/prenoms_genre.tsv '
                     '(%d vs %d entrées)' % (app_txt.count('\n'), ref.count('\n')))

if not os.path.exists(EXT):
    echec.append('extension/assets/prenoms.tsv.gz ABSENT — lancer python3 extension/build_assets.py')
else:
    ext_txt = gzip.decompress(io.open(EXT, 'rb').read()).decode('utf-8')
    if ext_txt != ref:
        echec.append('extension/assets/prenoms.tsv.gz DIFFÈRE de la table — lancer extension/build_assets.py')

# garde-fous de CONTENU : la table doit rester ce qu'on a mesuré (cf. build_prenoms.py)
table = {}
for l in ref.split('\n'):
    if not l:
        continue
    p = l.split('\t')
    if len(p) == 3:
        table[p[0]] = (p[1], p[2] == '1')
if len(table) < 8000:
    echec.append('table trop courte : %d prénoms (attendu ≥ 8 000)' % len(table))
for nom, attendu in (('Marie', 'f'), ('Jean', 'm'), ('Julie', 'f'), ('Léa', 'f'), ('Pierre', 'm')):
    if table.get(nom, (None,))[0] != attendu:
        echec.append('%s devrait être « %s », vu %r' % (nom, attendu, table.get(nom)))
# ambigus : jamais dans la table (Claude/Camille = « prénom masculin OU féminin »)
for nom in ('Claude', 'Camille', 'Dominique', 'Alex'):
    if nom in table:
        echec.append('%s est AMBIGU (m/f) et ne doit pas être dans la table' % nom)
# mots-outils : « Elle » est attesté comme prénom mais c'est le PRONOM 99,9 % du temps
for nom in ('Elle', 'Il', 'On', 'Le', 'La', 'Et', 'Si'):
    if nom in table:
        echec.append('%s est un mot grammatical et ne doit pas être dans la table' % nom)
# marquage tête-de-phrase : les prénoms dont le genre contredit un nom commun homographe
if not table.get('Pierre', ('', False))[1]:
    echec.append('« Pierre » doit être MARQUÉ (la pierre est féminine) : inutilisable en tête de phrase')
if table.get('Marie', ('', True))[1]:
    echec.append('« Marie » ne doit PAS être marqué (aucun homographe de genre opposé)')

if echec:
    print('  ✗ TABLE DES PRÉNOMS :')
    for e in echec:
        print('      ' + e)
    sys.exit(1)
n_mark = sum(1 for v in table.values() if v[1])
print('  ✓ prénoms : %d entrées identiques dans les 3 moteurs (%d marqués « pas en tête de phrase »)'
      % (len(table), n_mark))
