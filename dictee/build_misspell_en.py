#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build_misspell_en.py — la table des FAUTES ATTESTÉES de l'anglais (dictee/misspell_en.tsv).

POURQUOI. Mesuré le 17/09/2026 sur deux listes indépendantes de fautes réelles : le speller anglais propose une MAUVAISE
cible 16,4 % du temps sur la liste de Wikipédia (448/2 729) et 17,4 % sur celle de Wiktionary (491/2 820) — « abcess » →
access, « acount » → count, « absail » → assail — et son seul rouge franchement faux est « definatly » → defiantly.
Or Wiktionary (notre source, kaikki) étiquette lui-même ces graphies « Misspelling of X », relues par des anglophones :
une cible donnée par un humain vaut mieux que celle qu'un classement devine. Principe de Rem (CHANTIER_ANGLAIS §6) :
prendre ce qui est libre et déjà relu plutôt que réinventer — et ça se vérifie SANS savoir l'anglais : sur les 271 fautes
que les deux listes ont en commun, elles donnent la même cible 267 fois (98,5 %).

CE QUI ENTRE. Une graphie minuscule a-z dont Wiktionary ne connaît QUE des sens « misspelling » (aucun sens courant : « loose »,
« forth », « are » restent des mots), avec UNE seule cible, qui est un mot de notre lexique (ou une contraction dont la graphie
est la cible sans son apostrophe : « shouldnt » → shouldn't). Pas les fautes voulues (humour, argot d'internet), pas les
cibles en plusieurs mots (la règle des mots collés a sa liste), pas les graphies dialectales (eye dialect, pronunciation
spelling : « dat », « wuz » — un autre chantier, plus risqué dans un dialogue de roman).
Une graphie que NOTRE lexique tenait pour un mot (« wierd », « tought », « millenium » : kaikki les liste, donc le speller se
taisait) entre si elle est rare et sa cible courante : fréquence ≤ 30 et cible au moins 20 fois plus fréquente.

CE QUE LE MOTEUR EN FAIT (speller_en_probe.py et corrector_en.js, même règle) : la cible attestée REMPLACE la cible devinée ;
ROUGE si le moteur arrive seul à la même cible (deux sources indépendantes d'accord), ORANGE sinon (doute → orange).

  PYTHONUTF8=1 python dictee/build_misspell_en.py data_local/en/kaikki-en.jsonl [--dry]   # reconstruit la table
  python dictee/build_misspell_en.py --check                                              # CI : invariants du fichier livré
Source : Wiktionary via kaikki.org (CC BY-SA 3.0), comme le reste du lexique anglais.
"""
import io, json, re, gzip, os, sys, collections

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from speller_en_probe import _us_variant      # une cible britannique (« analyse ») vaut si le speller l'accepte déjà
OUT = os.path.join(HERE, 'misspell_en.tsv')
LEXP = os.path.join(HERE, 'lex_en.tsv.gz')
SURF = re.compile(r'^[a-z]{2,}$')
TGT_MOT = re.compile(r'^[a-z]{2,}$')
TGT_APOS = re.compile(r"^[a-z]+(?:n't|'ve|'ll|'re|'d|'m|'s)$")       # une vraie contraction, pas « re'you"
MS_GLOSE = ('misspelling of', 'common misspelling of', 'rare misspelling of')
VOULUE_TAGS = {'humorous', 'slang', 'Internet', 'vulgar', 'leet', 'childish', 'derogatory', 'offensive', 'euphemistic',
               'jocular', 'deliberate', 'eye-dialect', 'pronunciation-spelling'}
VOULUE_GLOSE = ('deliberate', 'intentional', 'humorous', 'jocular', 'facetious', 'eye dialect', 'pronunciation spelling')
MORT_TAGS = {'obsolete', 'archaic'}
MORT_GLOSE = ('obsolete', 'archaic')
FREQ_MAX_CONNUE, RATIO_CIBLE = 30, 20        # une graphie que le lexique connaît n'entre que rare, devant une cible courante
MIN_LIGNES = 2500


def lire_lexique():
    freq = {}
    with gzip.open(LEXP, 'rt', encoding='utf-8') as f:
        next(f)
        for ln in f:
            c = ln.rstrip('\n').split('\t')
            if len(c) < 7 or not c[0]: continue
            try: fr = int(c[6])
            except ValueError: fr = 0
            freq[c[0]] = max(freq.get(c[0], 0), fr)
    return freq


def cible_valide(surf, cible, freq):
    if cible == surf: return False
    if TGT_MOT.match(cible): return cible in freq or _us_variant(cible) in freq      # même test que le speller
    return bool(TGT_APOS.match(cible)) and cible.replace("'", '') == surf      # « shouldnt » → shouldn't


def check():
    """Invariants du fichier LIVRÉ — sans kaikki (CI)."""
    freq = lire_lexique(); bad = []
    lignes = io.open(OUT, encoding='utf-8').read().split('\n')
    if lignes[0] != 'faute\tcible': bad.append('en-tête inattendu : ' + lignes[0])
    corps = [l for l in lignes[1:] if l]
    if len(corps) < MIN_LIGNES: bad.append('%d lignes < plancher %d (table tronquée ?)' % (len(corps), MIN_LIGNES))
    if corps != sorted(set(corps)): bad.append('lignes non triées ou en double')
    surfs = set()
    for l in corps:
        c = l.split('\t')
        if len(c) != 2 or not SURF.match(c[0]): bad.append('ligne mal formée : ' + l); continue
        s, t = c
        if s in surfs: bad.append('graphie en double : ' + s)
        surfs.add(s)
        if not cible_valide(s, t, freq): bad.append('cible hors lexique ou identique : %s → %s' % (s, t))
        if s in freq and not (freq[s] <= FREQ_MAX_CONNUE and freq.get(t, 0) >= RATIO_CIBLE * max(1, freq[s])):
            bad.append('graphie CONNUE du lexique et trop fréquente pour être une faute sûre : %s (%d) → %s (%d)'
                       % (s, freq[s], t, freq.get(t, 0)))
    cibles = {l.split('\t')[1] for l in corps if '\t' in l}
    for s in sorted(surfs & cibles): bad.append('chaîne : « %s » est à la fois une faute et une cible' % s)
    for b in bad[:20]: print('  ✗ ' + b)
    print(('✗ misspell_en.tsv : %d invariant(s) violé(s)' % len(bad)) if bad else
          '✓ misspell_en.tsv : %d fautes attestées (Wiktionary « misspelling of »), triées, cibles toutes au lexique, '
          '%d graphies que le lexique tenait pour des mots (rares, cible ≥ %d× plus fréquente), aucune chaîne'
          % (len(corps), len([s for s in surfs if s in freq]), RATIO_CIBLE))
    return 1 if bad else 0


def main():
    if '--check' in sys.argv: sys.exit(check())
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args: print(__doc__); sys.exit(2)
    freq = lire_lexique()
    ms = {}; autres = collections.defaultdict(list); n = 0
    with io.open(args[0], encoding='utf-8') as f:
        for ln in f:
            n += 1
            if n % 300000 == 0: print('   … %d entrées' % n, flush=True)
            r = json.loads(ln); w = r.get('word') or ''
            if not SURF.match(w): continue
            for sn in r.get('senses') or []:
                tags = set(sn.get('tags') or [])
                gl = ' '.join(sn.get('glosses') or []).strip().lower()
                if 'misspelling' in tags or gl.startswith(MS_GLOSE):
                    e = ms.setdefault(w, {'tg': collections.Counter(), 'voulue': False})
                    if (tags & VOULUE_TAGS) or any(x in gl for x in VOULUE_GLOSE): e['voulue'] = True
                    for x in (sn.get('alt_of') or []) + (sn.get('form_of') or []):
                        t = (x.get('word') or '').strip().lower().replace('’', "'")
                        if t: e['tg'][t] += 1
                else:
                    # TOUT autre sens compte. Il n'est toléré que s'il vise LA MÊME cible (« hight », forme obsolète
                    # de height) ou s'il est MORT (archaïque : « hight » = nommé). Un sens encore vivant dans un
                    # registre — « cooky », graphie datée de cookie ; « wittle », little en langage enfantin ;
                    # « loose », « forth » — fait de la graphie un mot : elle n'entre pas.
                    tg = {(x.get('word') or '').strip().lower() for x in (sn.get('alt_of') or []) + (sn.get('form_of') or [])} - {''}
                    mort = bool(tags & MORT_TAGS) or gl.startswith(MORT_GLOSE)
                    autres[w].append((tg, mort))
    rej = collections.Counter(); table = {}
    for w, e in ms.items():
        if e['voulue']: rej['faute voulue (humour, argot, dialecte)'] += 1; continue
        tg = [t for t in e['tg'] if TGT_MOT.match(t) or TGT_APOS.match(t) or ' ' in t]
        if len(tg) != 1: rej['cible absente ou multiple'] += 1; continue
        t = tg[0]
        if any((tg2 - {t}) or (not tg2 and not mort) for tg2, mort in autres[w]):
            rej['a un autre sens vivant, ou qui vise un autre mot (loose, forth, cooky, wittle)'] += 1; continue
        if ' ' in t: rej['cible en plusieurs mots (règle des mots collés)'] += 1; continue
        if not cible_valide(w, t, freq): rej['cible hors lexique'] += 1; continue
        if w in freq and not (freq[w] <= FREQ_MAX_CONNUE and freq.get(t, 0) >= RATIO_CIBLE * max(1, freq[w])):
            rej['graphie connue du lexique, trop fréquente'] += 1; continue
        table[w] = t
    for w in [w for w, t in table.items() if t in table]: del table[w]; rej['chaîne (la cible est elle-même une faute)'] += 1
    print('Wiktionary : %d graphies à sens « misspelling » → %d retenues' % (len(ms), len(table)))
    for k, v in rej.most_common(): print('   écartées — %-52s %5d' % (k, v))
    connues = sorted((w for w in table if w in freq), key=lambda w: -freq[w])
    print('   dont %d que le lexique tenait pour des mots : %s' % (len(connues), ', '.join('%s→%s' % (w, table[w]) for w in connues)))
    apos = sorted(w for w, t in table.items() if "'" in t)
    print('   dont %d contractions : %s' % (len(apos), ', '.join('%s→%s' % (w, table[w]) for w in apos)))
    if '--dry' in sys.argv: print('(--dry : rien écrit)'); return
    with io.open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write('faute\tcible\n')
        for w in sorted(table): f.write('%s\t%s\n' % (w, table[w]))
    print('écrit : %s (%d lignes, %.0f Ko)' % (os.path.relpath(OUT), len(table), os.path.getsize(OUT) / 1024.0))
    sys.exit(check())


if __name__ == '__main__':
    main()
