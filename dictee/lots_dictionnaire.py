# -*- coding: utf-8 -*-
u"""lots_dictionnaire.py — LA recette du dictionnaire d'orthographe, en un seul endroit (LA LISTE n° 142, 23/10/2026).

Le dictionnaire du correcteur (extension/assets/speller.tsv.gz, bloc speller-lex-gz de l'app) = Lexique 4.00 + 12 LOTS au schéma
Lexique (37 colonnes), lus ensemble par build_speller_lex.py avec MINFREQ=0. Les lots, dans l'ordre où ils sont nés :

   1. wikt_lex_fr.tsv            11/07 (#131)  Wiktionnaire : mots absents de Lexique        FIGÉ (dump de juillet absent)
   2. argot_rows.tsv             15/07 (#176)  argot et anglicismes curés                   build_argot_lex.py
   3. participle_rows.tsv        16/07 (#181)  participes accordés (dallée, dallées)        build_participles_lex.py
   4. gacc_lex_fr.tsv            02/09         table de genre accentuée → dictionnaire      build_gacc_lex.py
   5. morph_na_lex_fr.tsv        02/09 (#642)  Morphalou : noms, adjectifs, adverbes        build_morph_lex.py
   6. morph_ver_lex_fr.tsv.gz    02/09 (#643)  Morphalou : verbes (même passage que le 5)   build_morph_lex.py
   7. morph_acc_lex_fr.tsv       09/10         Morphalou : formes accentuées (calmât)       build_morph_acc_lex.py
   8. conj_lex_fr.tsv            14/10         table de conjugaison (outillent, indexent)   build_conj_lex.py
   9. metier_lex_fr.tsv          15/10 (#957)  liste curée (agentique, upcycler, rissole)   build_metier_lex.py
  10. ver_justes_lex_fr.tsv.gz   18/10 (#990)  formes verbales justes (liste n° 108)        build_ver_justes_lex.py
  11. rect90_lex_fr.tsv.gz       18/10 (#993)  graphies rectifiées de 1990 (liste n° 109)   build_rect90_lex.py
  12. na_justes_lex_fr.tsv.gz    18/10         noms, adjectifs, adverbes justes (n° 113)    build_na_justes_lex.py

UN LOT NE CONTIENT QUE DES MOTS QUE SA BASE IGNORE, et sa base = Lexique + les lots nés AVANT lui (avant(), mots_avant()). Jusqu'au
23/10, trois constructeurs prenaient pour base le dictionnaire LIVRÉ — qui contient déjà leur lot : relancés, ils le vidaient (mesuré
en 4.00 : gacc −39 897 lignes, morph_na −69 012, morph_ver −382 060, participes −3 049) ; cinq autres prenaient « tous les lots sauf
moi », lots nés après eux compris. Tous lisent maintenant leur base ici. Les tailles du dictionnaire à chaque naissance (--tailles)
retombent sur les chiffres écrits dans les commits d'origine : 214 684 avant gacc, 705 653 après Morphalou, 710 872, 713 854, 713 863.

VÉRIFIÉ le 23/10 en 4.00 (--verifier) : les 11 lots refaits redonnent le commité ligne pour ligne, et le dictionnaire == Lexique + 12
lots mot pour mot. Deux conditions, écrites dans le code : build_gacc_lex choisit catégorie et nombre dans un ordre stable (un set Python
les tirait au sort à chaque lancement : 175 à 3 028 lignes changeaient) ; build_conj_lex relit la table de conjugaison du 14/10
(SOURCES_DE_NAISSANCE) — sur celle d'aujourd'hui il ajouterait 7 078 formes, dont 7 072 que le dictionnaire a déjà reçues par les lots
du 18/10. Le lot 1 est figé : le dump Wiktionnaire de juillet n'est plus là, et son script a été réécrit le 15/10 (#957) en outil de
rafraîchissement par union (build_wikt_lex.py --ecrire), mesuré et refusé.

Pour refaire un lot : relancer son constructeur, PUIS ceux des lots nés après lui (leur base a changé), dans l'ordre, puis
--reconstruire. Le dictionnaire est bâti sur la 4.00 (`git show 6aade580:Lexique4.tsv.xz`, copie locale data_local/Lexique4.tsv) ;
la Lexique commitée depuis la ligne 138 est la 4.10, qui ne change qu'une ligne du dictionnaire (LEXIQUES).

  python dictee/lots_dictionnaire.py --check          # garde (dev.sh + CI) : dictionnaire livré == Lexique + 12 lots, mot pour mot
  python dictee/lots_dictionnaire.py --reconstruire   # Lexique + 12 lots → app → extension → paquet, solveur, zip (rien si identique)
  python dictee/lots_dictionnaire.py --verifier       # relance les constructeurs dans l'ordre, compare au commité, restaure (sources locales)
  python dictee/lots_dictionnaire.py --tailles        # taille du dictionnaire à la naissance de chaque lot
"""
import base64, gzip, hashlib, io, lzma, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
LOTS = ('wikt_lex_fr.tsv', 'argot_rows.tsv', 'participle_rows.tsv', 'gacc_lex_fr.tsv', 'morph_na_lex_fr.tsv', 'morph_ver_lex_fr.tsv.gz',
        'morph_acc_lex_fr.tsv', 'conj_lex_fr.tsv', 'metier_lex_fr.tsv', 'ver_justes_lex_fr.tsv.gz', 'rect90_lex_fr.tsv.gz', 'na_justes_lex_fr.tsv.gz')
SPELLER = os.path.join(ROOT, 'extension', 'assets', 'speller.tsv.gz')
# constructeur de chaque lot, dans l'ordre (le n° 1 est figé : il n'entre pas dans la recette)
CONSTRUCTEURS = (('build_argot_lex', ('argot_rows.tsv',)), ('build_participles_lex', ('participle_rows.tsv',)),
                 ('build_gacc_lex', ('gacc_lex_fr.tsv',)), ('build_morph_lex', ('morph_na_lex_fr.tsv', 'morph_ver_lex_fr.tsv.gz')),
                 ('build_morph_acc_lex', ('morph_acc_lex_fr.tsv',)), ('build_conj_lex', ('conj_lex_fr.tsv',)),
                 ('build_metier_lex', ('metier_lex_fr.tsv',)), ('build_ver_justes_lex', ('ver_justes_lex_fr.tsv.gz',)),
                 ('build_rect90_lex', ('rect90_lex_fr.tsv.gz',)), ('build_na_justes_lex', ('na_justes_lex_fr.tsv.gz',)))
# une source du dépôt qui a changé APRÈS la naissance d'un lot : --verifier la lit telle qu'elle était (variable, commit, fichier)
SOURCES_DE_NAISSANCE = {'build_conj_lex': ('CONJ_TABLE', 'fddfb487', 'extension/assets/vdc-lex.json')}
# empreinte (md5 des lignes du TSV) d'une Lexique → son nom et les lignes du dictionnaire qu'elle change, mesurées (ligne 138) ;
# une Lexique inconnue doit redonner le dictionnaire à l'identique
# (la 4.10 brute, 27ebe29d…, n'y est pas : sa ligne « feeder » décalée change aussi le dictionnaire — c'est la ligne 138)
ECARTS_410 = {'int\t180\tAN': 'int\t180\tA'}   # la 4.10 retire la ligne NOM de « int » (restent ADJ et ADV)
LEXIQUES = {'2e730b179b96e64c696da1065d22eb7e': ('4.00', {}),
            '248ec927a09a7282009369d826ce0981': ('notre 4.10', ECARTS_410)}


def chemin(lot):
    return os.path.join(HERE, lot)


def ouvrir(p):
    if p.endswith('.gz'): return gzip.open(p, 'rt', encoding='utf-8')
    if p.endswith('.xz'): return lzma.open(p, 'rt', encoding='utf-8')
    return io.open(p, encoding='utf-8')


def lexique():
    u"""Lexique 4 : $LEX4, sinon data_local/Lexique4.tsv (la 4.00 locale), sinon /tmp/lex4 (la CI y décompresse la commitée), sinon le .xz."""
    for p in (os.environ.get('LEX4'), os.path.join(ROOT, 'data_local', 'Lexique4.tsv'), '/tmp/lex4/Lexique4.tsv', 'C:/tmp/lex4/Lexique4.tsv',
              os.path.join(ROOT, 'Lexique4.tsv.xz')):
        if p and os.path.exists(p): return p
    return None


def avant(lot):
    u"""Les lots nés AVANT `lot` (noms de fichiers de dictee/) : avec Lexique, la base contre laquelle `lot` se construit."""
    return LOTS[:LOTS.index(lot)]


def _lignes(lots):
    with ouvrir(lexique()) as f:
        for l in f: yield l
    for lot in lots:
        with ouvrir(chemin(lot)) as f:
            for l in f: yield l


def dictionnaire(lots=LOTS):
    u"""Le dictionnaire (lignes « mot\\tfreq_milli\\tPOS », règle de build_speller_lex, MINFREQ=0) de Lexique + `lots`."""
    sys.path.insert(0, HERE); import build_speller_lex
    return build_speller_lex.lignes_dictionnaire(_lignes(lots), minfreq=0.0)


def mots_avant(lot):
    u"""Les mots que le dictionnaire connaissait à la naissance de `lot` — sa base (jamais le dictionnaire livré, qui le contient)."""
    return set(l.split('\t', 1)[0] for l in dictionnaire(avant(lot)))


def _livre():
    with gzip.open(SPELLER, 'rt', encoding='utf-8') as f: return f.read().split('\n')


def _empreinte(p):
    h = hashlib.md5()
    with ouvrir(p) as f:
        for l in f: h.update(l.encode('utf-8'))
    return h.hexdigest()


def check():
    lex = lexique()
    if not lex: print('· dictionnaire : SAUTÉ — Lexique 4 introuvable (LEX4, data_local/Lexique4.tsv, /tmp/lex4, Lexique4.tsv.xz)'); return 0
    neuf, livre = dictionnaire(), _livre()
    nom, connus = LEXIQUES.get(_empreinte(lex), ('inconnue (%s)' % os.path.basename(lex), {}))
    retour = dict((b, a) for a, b in connus.items())
    if [retour.get(l, l) for l in neuf] != livre or not set(retour) <= set(neuf):
        plus = sorted(set(neuf) - set(livre) - set(retour)); moins = sorted(set(livre) - set(neuf) - set(connus))
        print('✗ dictionnaire livré ≠ Lexique (%s) + 12 lots : %d ligne(s) en plus (ex. %s), %d en moins (ex. %s) — un lot changé sans '
              'régénérer le dictionnaire (python dictee/lots_dictionnaire.py --reconstruire), ou l\'inverse'
              % (nom, len(plus), plus[:3], len(moins), moins[:3])); return 1
    print('✓ dictionnaire livré == Lexique (%s) + 12 lots, mot pour mot : %d mots%s' % (nom, len(livre), (' (écart connu de cette Lexique : %s)'
          % ', '.join('%s → %s' % (a.replace('\t', ' '), b.replace('\t', ' ')) for a, b in connus.items())) if connus else ''))
    return 0


def tailles():
    for i in range(len(LOTS) + 1):
        print('%-28s %7d mots' % ('Lexique' if i == 0 else '+ ' + LOTS[i - 1], len(dictionnaire(LOTS[:i]))))
    return 0


def reconstruire():
    if not lexique(): print('✗ Lexique 4 introuvable : impossible de reconstruire'); return 1
    neuf = dictionnaire()
    if neuf == _livre(): print('✓ dictionnaire déjà à jour (%d mots) : rien à écrire' % len(neuf)); return 0
    b64 = os.path.join(ROOT, 'speller_lex.b64.tmp')
    io.open(b64, 'wb').write(base64.b64encode(gzip.compress('\n'.join(neuf).encode('utf-8'), 9, mtime=0)))
    # bloc de l'app → assets de l'extension → paquet de données ouvertes → solveur du pendu (qui lit ce paquet) → zip de l'extension ;
    # le clone anglais n'y est pas : il vide ce bloc (build_pendu_en.py, _TOOL_BLOCKS)
    try:
        for etape in ('dictee/inject_speller.py', 'extension/build_assets.py', 'build_lexiques.py', 'dictee/build_solveur_lex.py', 'extension/build_zip.py'):
            r = subprocess.run([sys.executable, etape], cwd=ROOT, env=dict(os.environ, SPELLER_B64=b64, PYTHONUTF8='1'))
            if r.returncode: print('✗ étape %s : code %d' % (etape, r.returncode)); return 1
    finally:
        os.remove(b64)
    print('✓ dictionnaire reconstruit : %d mots → app, extension, omega-lexiques.zip, solveur, zip. Ensuite : ./dev.sh fresh' % len(neuf))
    return 0


def _git(*a):
    return subprocess.run(['git'] + list(a), cwd=ROOT, capture_output=True).stdout


def _contenu(raw, lot):
    if lot.endswith('.gz'): raw = gzip.decompress(raw)
    return raw.decode('utf-8').replace('\r\n', '\n').rstrip('\n').split('\n')


def verifier():
    u"""Relance chaque constructeur et compare son lot au commité (contenu, ligne par ligne ; un .gz réécrit change d'octets à chaque
    passage, son contenu non). Chaque lot est restauré dès sa comparaison : le suivant se construit sur les lots COMMITÉS, et un écart
    est celui de SON constructeur, pas une cascade. Refuse de partir si un lot diffère déjà de git HEAD ; ne touche à aucun autre fichier."""
    fichiers = [os.path.join('dictee', l) for l in LOTS[1:]]
    if _git('status', '--porcelain', '--', *fichiers).strip(): print('✗ des lots diffèrent de git HEAD : commiter ou restaurer avant de vérifier'); return 1
    if not lexique(): print('✗ Lexique 4 introuvable'); return 1
    env = dict(os.environ, LEX4=lexique(), PYTHONUTF8='1', KAIKKI=os.environ.get('KAIKKI', os.path.join(ROOT, 'data_local', 'fr', 'kaikki-fr.jsonl')))
    ko = 0
    try:
        for b, lots in CONSTRUCTEURS:
            e, tmp = dict(env), None
            if b in SOURCES_DE_NAISSANCE:
                var, rev, f = SOURCES_DE_NAISSANCE[b]; tmp = os.path.join(ROOT, '.naissance_' + os.path.basename(f))
                io.open(tmp, 'wb').write(_git('show', '%s:%s' % (rev, f))); e[var] = tmp
            r = subprocess.run([sys.executable, os.path.join(HERE, b + '.py')], cwd=ROOT, env=e, capture_output=True)
            if tmp: os.remove(tmp)
            for lot in lots:
                a = _contenu(_git('show', 'HEAD:dictee/' + lot), lot); n = _contenu(open(chemin(lot), 'rb').read(), lot)
                ok = a == n; ko += not ok
                print('%s %-26s %-24s %s' % ('✓' if ok else '✗', lot, b, 'redonne le commité (%d lignes)' % len(a) if ok else
                      'DIFFÈRE : %d lignes au lieu de %d (+%d, ex. %s / −%d, ex. %s)%s' % (len(n), len(a), len(set(n) - set(a)),
                      sorted(l.split('\t', 1)[0] for l in set(n) - set(a))[:3], len(set(a) - set(n)), sorted(l.split('\t', 1)[0] for l in set(a) - set(n))[:3],
                      '' if not r.returncode else ' — code %d' % r.returncode)), flush=True)
            _git('checkout', '--', *[os.path.join('dictee', l) for l in lots])
    finally:
        _git('checkout', '--', *fichiers)
    print('%s %d lot(s) sur %d redonnent le commité' % ('✓' if not ko else '✗', sum(len(l) for _, l in CONSTRUCTEURS) - ko, sum(len(l) for _, l in CONSTRUCTEURS)))
    return 1 if ko else 0


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
    a = sys.argv[1:]
    sys.exit(check() if '--check' in a else reconstruire() if '--reconstruire' in a else verifier() if '--verifier' in a else tailles() if '--tailles' in a else
             (print(__doc__) or 0))
