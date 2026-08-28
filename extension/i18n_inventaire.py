# -*- coding: utf-8 -*-
"""INVENTAIRE i18n FINAL — compte des MESSAGES (pas des littéraux) et classement en 4 natures.

Un message coupé en trois par concaténation (`'<div>' + x + '</div>'`) reste UN message : on
fusionne les littéraux d'une même ligne. Puis on classe :

  LIBELLE   libellé court d'interface           -> traduction directe
  MESSAGE   phrase adressée à l'utilisateur     -> traduction directe
  PROSE_FR  pédagogie SUR le français           -> RÉÉCRITURE, pas traduction
  DONNEE_FR donnée linguistique française       -> ne se traduit jamais (reste FR ou disparaît)
  INERTE    balisage nu / nom propre / regex    -> zéro travail

Le classement est explicite (listes nommées) et non deviné : chaque ligne du rapport est
rattachable à un fichier et un numéro de ligne.
"""
import io, re, os, sys, json

sys.stdout.reconfigure(encoding='utf-8')
BASE = os.path.dirname(os.path.abspath(__file__))

# ─────────────────────────────────────────────────────────────────────────────
# tokeniseur conscient des littéraux regex (cf. inv3 : sans ça les commentaires fuitent)
# ─────────────────────────────────────────────────────────────────────────────
def chaines(js):
    out, i, n, ligne, prev = [], 0, len(js), 1, ''
    while i < n:
        c = js[i]
        if c == '\n': ligne += 1; i += 1; continue
        if c in ' \t\r': i += 1; continue
        if c == '/' and i+1 < n and js[i+1] == '/':
            while i < n and js[i] != '\n': i += 1
            continue
        if c == '/' and i+1 < n and js[i+1] == '*':
            k = js.find('*/', i+2)
            if k < 0: break
            ligne += js.count('\n', i, k); i = k + 2; continue
        if c == '/' and not (prev.isalnum() or prev in '_$)]'):
            j, classe = i + 1, False
            while j < n:
                d = js[j]
                if d == '\\': j += 2; continue
                if d == '[': classe = True
                elif d == ']': classe = False
                elif d == '/' and not classe: break
                elif d == '\n': break
                j += 1
            if j < n and js[j] == '/':
                i = j + 1; prev = '/'; continue
        if c in '"\'`':
            q, j, buf = c, i+1, []
            while j < n:
                d = js[j]
                if d == '\\': buf.append(js[j:j+2]); j += 2; continue
                if d == q: break
                if d == '\n' and q != '`': break
                buf.append(d); j += 1
            if j < n and js[j] == q:
                out.append((ligne, ''.join(buf)))
                ligne += js.count('\n', i, j); i = j + 1; prev = q; continue
        prev = c; i += 1
    return out

HUMAIN = re.compile(r'[àâçéèêëîïôöùûüœ]|[A-Za-zÀ-ÿ]{2,} [A-Za-zÀ-ÿ]{2,}|[?!…»]|« ')
REJET  = re.compile(r'^(#[\w-]+|\.[\w-]+|https?://|data:)$|^[a-zA-Z_$][\w$]*$|^[\d\s.,%-]+$|^use strict$')

def texte_nu(s):
    """retire le balisage : ce qui reste est-il du TEXTE pour l'humain ?"""
    return re.sub(r'<[^>]*>|data-\w+=|class="[^"]*"|type="[^"]*"', ' ', s).strip(' "\'=<>/·[]')

# lignes à classer à la main (fichier, ligne) -> nature
MANUEL = {
    ('sidepanel.js', 389): 'DONNEE_FR',      # motif de segmentation de phrase FR
    ('sidepanel.js', 431): 'DONNEE_FR',      # liste fermée de déterminants FR (ponctuation)
    ('sidepanel.js', 432): 'DONNEE_FR',
    ('sidepanel.js', 433): 'DONNEE_FR',
    ('son_panel.js',  90): 'INERTE',         # noms de polices
    ('son_panel.js',  97): 'INERTE',
}
# calc_dys.js : tout le nommage des nombres est l'ALGORITHME français
CALC_DONNEE = True

def nature(f, ligne, msg):
    if (f, ligne) in MANUEL: return MANUEL[(f, ligne)]
    if f == 'calc_dys.js' and CALC_DONNEE: return 'DONNEE_FR'
    nu = texte_nu(msg)
    if len(nu) < 2: return 'INERTE'
    if len(nu.split()) >= 7: return 'MESSAGE'
    return 'LIBELLE'

# ─────────────────────────────────────────────────────────────────────────────
lots = {}   # (fichier) -> [(ligne, message, nature)]

for f in ['sidepanel.js', 'content.js', 'son_panel.js', 'micro.js', 'background.js', 'calc_dys.js']:
    src = io.open(os.path.join(BASE, f), encoding='utf-8').read()
    par_ligne = {}
    for ligne, t in chaines(src):
        ts = t.strip()
        if len(ts) < 3 or REJET.match(ts) or not HUMAIN.search(ts): continue
        par_ligne.setdefault(ligne, []).append(ts)
    lots[f] = [(l, ' ⟨…⟩ '.join(v), nature(f, l, ' '.join(v))) for l, v in sorted(par_ligne.items())]

# HTML
from html.parser import HTMLParser
for f in ['sidepanel.html', 'micro.html']:
    trouve = []
    class E(HTMLParser):
        def __init__(s): super().__init__(); s.skip = 0
        def handle_starttag(s, t, a):
            if t in ('script', 'style'): s.skip += 1
            for k, v in a:
                if k in ('title', 'placeholder', 'aria-label', 'alt') and v and HUMAIN.search(v):
                    trouve.append((s.getpos()[0], '[' + k + '] ' + v.strip()))
        def handle_endtag(s, t):
            if t in ('script', 'style') and s.skip: s.skip -= 1
        def handle_data(s, d):
            if s.skip: return
            d = ' '.join(d.split())
            if len(d) > 1 and re.search(r'[A-Za-zÀ-ÿ]{2}', d): trouve.append((s.getpos()[0], d))
    p = E(); p.feed(io.open(os.path.join(BASE, f), encoding='utf-8').read())
    par_ligne = {}
    for l, t in trouve: par_ligne.setdefault(l, []).append(t)
    lots[f] = [(l, ' ⟨…⟩ '.join(v),
                'MESSAGE' if len(' '.join(v).split()) >= 7 else 'LIBELLE')
               for l, v in sorted(par_ligne.items())]

# manifest
mf = json.load(io.open(os.path.join(BASE, 'manifest.json'), encoding='utf-8'))
lots['manifest.json'] = [(0, 'name : ' + mf['name'], 'LIBELLE'),
                         (0, 'description : ' + mf['description'], 'MESSAGE')]

# moteur : les tables qui atterrissent à l'écran
core = io.open(os.path.join(BASE, 'dys-core.js'), encoding='utf-8').read()
def compte(motif):
    m = re.search(motif, core)
    if not m: return 0, 0
    fin = core.find('\n', m.start())
    bloc = core[m.start():fin]
    return len(re.findall(r"[:,]\s*'[^']{3,}'", bloc)), core[:m.start()].count('\n') + 1

n_lbl, l_lbl = compte(r'var STAGE_LBL=')
n_msg, l_msg = compte(r'var STAGE_MSG=')
n_hp,  l_hp  = compte(r'var _HPROBE=')
i = core.find('var REMED={'); j = core.find('\n  var ', i + 10)
n_remed = len([x for x in re.findall(r"'((?:[^'\\]|\\.){6,})'", core[i:j]) if HUMAIN.search(x)])
l_remed = core[:i].count('\n') + 1

conf = json.load(io.open(os.path.join(BASE, 'assets/confusables.json'), encoding='utf-8'))
n_gloss = sum(len(g.get('gloss') or {}) for g in conf.get('groups', []))

lots['dys-core.js'] = ([(l_lbl, 'STAGE_LBL — %d libellés de stade' % n_lbl, 'PROSE_FR'),
                        (l_msg, 'STAGE_MSG — %d explications de stade' % n_msg, 'PROSE_FR'),
                        (l_hp,  '_HPROBE — %d épreuves de substitution d\'homophones' % n_hp, 'DONNEE_FR'),
                        (l_remed, 'REMED — %d fragments de conseil fabriqué' % n_remed, 'PROSE_FR')])
lots['assets/confusables.json'] = [(0, '%d gloses de mots confusables FR' % n_gloss, 'DONNEE_FR')]

# ─────────────────────────────────────────────────────────────────────────────
ORDRE = ['LIBELLE', 'MESSAGE', 'PROSE_FR', 'DONNEE_FR', 'INERTE']
tot = {k: 0 for k in ORDRE}
print('═' * 96)
print('INVENTAIRE i18n — extension OMEGA-Ω')
print('═' * 96)
for f in ['manifest.json', 'sidepanel.html', 'micro.html', 'sidepanel.js', 'content.js',
          'micro.js', 'background.js', 'son_panel.js', 'calc_dys.js', 'dys-core.js',
          'assets/confusables.json']:
    items = lots.get(f, [])
    if not items: continue
    c = {k: 0 for k in ORDRE}
    for _, _, nat in items:
        c[nat] += 1; tot[nat] += 1
    util = sum(c[k] for k in ('LIBELLE', 'MESSAGE', 'PROSE_FR'))
    print('%-26s %3d messages   à traduire %3d   (prose %2d)   donnée FR %3d   inerte %2d'
          % (f, len(items), c['LIBELLE'] + c['MESSAGE'], c['PROSE_FR'], c['DONNEE_FR'], c['INERTE']))
print('─' * 96)
print('%-26s libellés %d · messages %d · PROSE À RÉÉCRIRE %d · donnée FR %d · inerte %d'
      % ('TOTAL', tot['LIBELLE'], tot['MESSAGE'], tot['PROSE_FR'], tot['DONNEE_FR'], tot['INERTE']))
print()
print('>>> À TRADUIRE (libellés + messages) : %d' % (tot['LIBELLE'] + tot['MESSAGE']))
print('>>> À RÉÉCRIRE (prose sur le français) : %d blocs' % tot['PROSE_FR'])
print('>>> JAMAIS traduit (donnée FR) : %d' % tot['DONNEE_FR'])

with io.open(os.path.join(BASE,'..','inventaire_i18n.tsv'), 'w', encoding='utf-8', newline='\n') as fo:
    fo.write('fichier\tligne\tnature\tmessage\n')
    for f, items in lots.items():
        for l, m, nat in items:
            fo.write('%s\t%d\t%s\t%s\n' % (f, l, nat, m.replace('\t', ' ')))
print('\ndétail complet : inventaire_i18n.tsv')
