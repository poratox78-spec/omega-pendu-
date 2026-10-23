# -*- coding: utf-8 -*-
"""build_na_justes_lex.py — SPELLER : les NOMS, ADJECTIFS et ADVERBES justes que l'anti-masquage écartait (liste n° 113, 18/10/2026).

Même faute que la liste n° 108, pour les noms : le lot Morphalou des noms et adjectifs (build_morph_lex.py, 2025) refuse toute
forme à une lettre d'un mot fréquent « pour ne pas masquer une faute ». Une forme juste n'est jamais une faute : elle entre, et la
confusion qu'elle pourrait cacher se rattrape par le CONTEXTE.

Ce qui entre (forme exacte, « œ » écrit « oe » comme le dictionnaire) :
  - une forme de nom, d'adjectif ou d'adverbe de Morphalou 3.1 absente du dictionnaire (Lexique 4 + tous les lots) ;
  - la FORME attestée par un dictionnaire indépendant de Morphalou (DELA, Dicollecte, Lefff) ;
  - le MOT (lemme) au Wiktionnaire avec un sens qui n'est pas une simple variante ou faute d'orthographe ;
  - de lettres seules (le dictionnaire coupe au trait d'union), 3 lettres au moins ;
  - un MOT écrit en minuscules : pas un sigle (ADN, SARL), une abréviation, un symbole (ksr = kilostéradian) ni un nom propre
    (Morphalou et le Wiktionnaire lus avec leur casse ; lemme marqué « abréviation » écarté).
Même contrat que les autres lots : FreqOrtho 0 → connues, jamais proposées, jamais concurrentes au tri.

  python dictee/build_na_justes_lex.py            # régénère dictee/na_justes_lex_fr.tsv.gz (Morphalou + Lexique4 + Wiktionnaire)
  python dictee/build_na_justes_lex.py --check    # forme du TSV commité et son câblage dans le speller livré (témoins)
"""
import io, gzip, json, re, sys, os, unicodedata
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..')
OUT = os.path.join(HERE, 'na_justes_lex_fr.tsv.gz')
sys.path.insert(0, HERE); import lots_dictionnaire
LOTS = lots_dictionnaire.avant('na_justes_lex_fr.tsv.gz')   # base : Lexique + les lots nés AVANT celui-ci, ni lui ni ceux d'après (ligne 142)
TAGS_ECARTES = {'misspelling', 'alt-of', 'nonstandard', 'erroneous', 'abbreviation', 'form-of'}
POSW = {'noun': 'NOM', 'adj': 'ADJ', 'adv': 'ADV'}
CATS = {'Nom commun': 'NOM', 'Adjectif qualificatif': 'ADJ', 'Adverbe': 'ADV'}
TEMOINS_OUI = ('charismes', 'antiennes', 'capuce', 'componée')
TEMOINS_NON = ('developpement',)


def norm(w):
    return w.replace('œ', 'oe').replace('æ', 'ae')


def sans_acc(w):
    return ''.join(c for c in unicodedata.normalize('NFD', w) if unicodedata.category(c) != 'Mn')


def flexion(w, lem):
    """Une flexion de nom ou d'adjectif garde le début du lemme : 2 lettres communes au moins (ou le lemme entier)."""
    a, b = sans_acc(w), sans_acc(lem)
    return a[:2] == b[:2] or a == b


def ordinaire(r):
    for s in (r.get('senses') or []):
        if s.get('alt_of') or s.get('form_of'): continue
        if set(s.get('tags') or []) & TAGS_ECARTES: continue
        g = ' '.join(s.get('glosses') or [])
        if re.match(u'^(Variante|Faute|Erreur|Graphie|Orthographe|Ancienne|Vieille|Mauvaise|Symbole|Sigle|Abréviation|Acronyme)', g): continue
        return True
    return False


def ouvrir(p):
    return gzip.open(p, 'rt', encoding='utf-8') if p.endswith('.gz') else io.open(p, encoding='utf-8')


def generer():
    base = set()
    for p in [os.environ.get('LEX4', os.path.join(ROOT, 'data_local', 'Lexique4.tsv'))] + [os.path.join(HERE, l) for l in LOTS]:
        if not os.path.exists(p): continue
        for l in ouvrir(p):
            w = norm(l.split('\t', 1)[0].strip().lower())
            if w: base.add(w)
    wk = set()
    with io.open(os.path.join(ROOT, 'data_local', 'fr', 'kaikki-frwikt.jsonl'), encoding='utf-8') as f:
        for l in f:
            if not any(('"pos": "%s"' % p) in l for p in POSW): continue
            r = json.loads(l)
            if r.get('lang_code', 'fr') == 'fr' and r.get('pos') in POSW and ordinaire(r): wk.add(norm(r.get('word', '')))
    ok = re.compile(r'^[a-zà-ÿ]+$')
    rows, seen, cat, lem, lgen = [], set(), None, None, ''
    with io.open(os.path.join(ROOT, 'data_local', 'morphalou', 'Morphalou3.1_CSV.csv'), encoding='utf-8', errors='replace') as fh:
        for l in fh:
            p = l.rstrip('\n').split(';')
            if len(p) < 18: continue
            if p[0].strip():
                cat = CATS.get(p[2].strip()) if 'abréviation' not in p[3] else None
                lem = norm(p[0].strip()); lgen = p[5].strip().lower().strip('-')[:1]
            if not cat or lem not in wk or not ok.match(lem): continue   # minuscules : un sigle (ADN, SARL) ou un nom propre n'est pas un mot en minuscules
            w = norm(p[9].strip())
            if len(w) < 3 or not ok.match(w) or w in base or (w, cat) in seen: continue
            if not (set(p[17].split()) - {'morphalou', 'morphalou2'}): continue   # la FORME attestée hors Morphalou
            if len(w) <= 5 and not flexion(w, lem): continue   # symbole à préfixe (ksr, ccal), abréviation (msge), pluriel étranger (feet)
            seen.add((w, cat))
            g = (p[13].strip().lower().strip('-')[:1] or lgen) if cat != 'ADV' else ''
            nb = p[11].strip().lower()[:1]
            row = [''] * 37; row[0] = w; row[3] = lem; row[4] = cat; row[5] = cat; row[6] = g if g in ('m', 'f') else ''
            row[7] = nb if nb in ('s', 'p') else ''; row[9] = '0'; row[10] = '0'; row[11] = '0'
            rows.append('\t'.join(row))
    rows.sort()
    with gzip.open(OUT, 'wt', encoding='utf-8', newline='\n') as f: f.write('\n'.join(rows) + '\n')
    print('✓ na_justes : %d lignes (%d formes) -> %s' % (len(rows), len({w for w, _ in seen}), os.path.relpath(OUT, ROOT)))


def check():
    if not os.path.exists(OUT): print('✗ na_justes_lex_fr.tsv.gz absent'); return 1
    n = bad = 0; lot = set()
    for l in ouvrir(OUT):
        if not l.strip(): continue
        n += 1; c = l.rstrip('\n').split('\t')
        if len(c) != 37 or c[10] != '0' or c[4] not in ('NOM', 'ADJ', 'ADV'): bad += 1
        lot.add(c[0])
    if bad: print('✗ na_justes : %d ligne(s) mal formée(s) (37 colonnes, NOM/ADJ/ADV, FreqOrtho 0)' % bad); return 1
    SP = set(l.split('\t', 1)[0] for l in gzip.open(os.path.join(ROOT, 'extension', 'assets', 'speller.tsv.gz'), 'rt', encoding='utf-8') if l.strip())
    absents = [w for w in lot if w not in SP]
    if absents: print('✗ na_justes : %d forme(s) du lot absentes du speller livré (ex. %s) — régénérer le speller' % (len(absents), absents[0])); return 1
    for w in TEMOINS_OUI:
        if w not in SP: print('✗ na_justes : forme juste « %s » inconnue du speller livré' % w); return 1
    for w in TEMOINS_NON:
        if w in SP: print('✗ na_justes : graphie fautive « %s » connue du speller livré' % w); return 1
    print('✓ na_justes_lex_fr.tsv.gz : %d lignes, 37 colonnes, NOM/ADJ/ADV, FreqOrtho 0 ; câblé dans le speller livré (%s connus ; %s non)'
          % (n, ', '.join(TEMOINS_OUI), ', '.join(TEMOINS_NON)))
    return 0


def main():
    if '--check' in sys.argv: return check()
    for p in (os.path.join(ROOT, 'data_local', 'morphalou', 'Morphalou3.1_CSV.csv'), os.path.join(ROOT, 'data_local', 'fr', 'kaikki-frwikt.jsonl')):
        if not os.path.exists(p): print('✗ %s absent (data_local) : impossible de régénérer' % os.path.relpath(p, ROOT)); return 1
    generer(); return 0


if __name__ == '__main__':
    sys.exit(main())
