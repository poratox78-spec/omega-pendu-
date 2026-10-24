# -*- coding: utf-8 -*-
"""build_ver_justes_lex.py — SPELLER : les formes de VERBES justes que l'anti-masquage écartait (liste n° 108, 18/10/2026).

Le symptôme, sur du français juste : « Nous avouions notre erreur » → « mot inconnu » (avouons) ; « Tu écoutas la radio » →
écoutes ; « Je gâchai tout » → gâché ; « Il dragua la rivière » → drague. Le lot VER de build_morph_lex.py refuse toute forme à une
lettre d'un mot fréquent (« avouions » / avouons, « écoutas » / écoutais) pour ne pas « masquer » une faute. Une forme juste n'est
jamais une faute : elle entre au dictionnaire, et la confusion qu'elle pourrait cacher se rattrape par le CONTEXTE (règles), pas
en faisant passer du français juste pour faux.

Ce qui entre (forme exacte, normalisée œ → oe comme le dictionnaire) :
  - une forme fléchie d'un verbe de Morphalou 3.1 absente du dictionnaire (Lexique4 + tous les lots) ;
  - dont le LEMME est un verbe du Wiktionnaire qui n'est pas une simple variante ou faute d'orthographe — les graphies anciennes
    ou fautives que Morphalou range parmi les verbes (« developper », « diplomer ») restent dehors ; un verbe RARE, VIEILLI ou
    pronominal (« s'abader ») est un verbe juste : il entre ;
  - deux sources : la FORME dans un dictionnaire indépendant de Morphalou (DELA, Dicollecte, Lefff — une forme que Morphalou seul
    génère, « intervièwerais », n'entre pas), le VERBE dans le Wiktionnaire ;
  - pas une graphie RECTIFIÉE de 1990 dont la forme traditionnelle existe (« frèterais », « aouté ») : elles entrent par le lot de la
    liste n° 109 (rect90_lex_fr.tsv.gz, choix de Rem : justes) ;
  - de 4 lettres au moins.
Même contrat que les lots Morphalou : FreqOrtho 0 → dans WORDS, jamais candidat (jamais proposé), jamais concurrent au tri.

La nature NOM (même date) : une forme qui est AUSSI un nom dans Morphalou (>= 2 sources) reçoit cette nature en plus — celles
de ce lot, et les mots rares (< 0,01/M) que le dictionnaire ne connaissait que comme VERBE (« intailles », nom pluriel, n'était
qu'« intailler ») : une règle qui lit « verbe seul » ne doit pas tirer sur un nom.

  python dictee/build_ver_justes_lex.py            # régénère dictee/ver_justes_lex_fr.tsv.gz (Morphalou + Lexique4 + Wiktionnaire, data_local)
  python dictee/build_ver_justes_lex.py --check    # forme du TSV commité et son câblage dans le speller livré (témoins)
"""
import io, gzip, json, re, sys, os, unicodedata
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..')
OUT = os.path.join(HERE, 'ver_justes_lex_fr.tsv.gz')
sys.path.insert(0, HERE); import lots_dictionnaire
LOTS = lots_dictionnaire.avant('ver_justes_lex_fr.tsv.gz')   # base : Lexique + les lots nés AVANT celui-ci, ni lui ni ceux d'après (ligne 142)
TAGS_ECARTES = {'misspelling', 'alt-of', 'nonstandard', 'erroneous', 'abbreviation', 'form-of'}   # rare / vieilli / archaïque = juste : pas écarté
TEMOINS_OUI = ('avouions', 'écoutas', 'gâchai', 'dragua', 'prévit', 'appartint', 'crusses')   # ⭐ ligne 148 : les trois derniers
TEMOINS_NON = ('developpé', 'diplomé', 'débarasser')
TEMOINS_NOM = ('intailles', 'ocelles')
FINS = {('indicative', 'simplePast'), ('subjunctive', 'imperfect')}   # ⭐ ligne 148 : temps dont 1990 garde le circonflexe de terminaison
FIN_CIRC = re.compile(r'(t|nt|mes|tes|nmes|ntes)$')   # ⭐ ligne 148 : ce qui suit î / û de terminaison (prévît, vînt, suivîmes, vîntes)
CATS = {'Nom commun': 'NOM'}   # le NOM seul : une règle « verbe seul » tirait sur des noms ; l'adjectif ne change rien de mesuré


def norm(w):
    return w.replace('œ', 'oe').replace('æ', 'ae')


def ordinaire(r):
    for s in (r.get('senses') or []):
        if s.get('alt_of') or s.get('form_of'): continue
        if set(s.get('tags') or []) & TAGS_ECARTES: continue
        g = ' '.join(s.get('glosses') or [])
        if re.match(u'^(Variante|Faute|Erreur|Graphie|Orthographe|Ancienne|Vieille|Mauvaise)', g): continue
        return True
    return False


def rectifiees(w, fins=frozenset()):
    """Les graphies traditionnelles d'une forme écrite à la mode de 1990 : è → é (« frèterai » / fréterai), i → î, u → û (« aouté » / aoûté).
    ⭐ Ligne 148 (24/10/2026) : 1990 GARDE le circonflexe de TERMINAISON du passé simple et du subjonctif imparfait (« qu'il prévît »,
    « nous vînmes ») — celui-là (forme de `fins`, accent juste avant -t, -nt, -mes, -tes) n'est la graphie traditionnelle de personne ;
    celui du radical, si (« abîmai » / abimai)."""
    for i, ch in enumerate(w):
        for a, b in (('è', 'é'), ('i', 'î'), ('u', 'û')):
            if ch == a:
                v = w[:i] + b + w[i + 1:]
                if b != 'é' and v in fins and FIN_CIRC.match(w[i + 1:]): continue
                yield v


def sans_accent(w):
    return ''.join(c for c in unicodedata.normalize('NFD', w) if unicodedata.category(c) != 'Mn')


def ouvrir(p):
    return gzip.open(p, 'rt', encoding='utf-8') if p.endswith('.gz') else io.open(p, encoding='utf-8')


def generer():
    base, bpos, bfrq = set(), {}, {}
    for p in [os.environ.get('LEX4', os.path.join(ROOT, 'data_local', 'Lexique4.tsv'))] + [os.path.join(HERE, l) for l in LOTS]:
        if not os.path.exists(p): continue
        for l in ouvrir(p):
            c = l.rstrip('\n').split('\t'); w = norm(c[0].strip().lower())
            if not w: continue
            base.add(w); cg = c[4].strip().upper() if len(c) > 4 else ''
            k = 'N' if cg.startswith('NOM') else ('V' if cg.startswith(('VER', 'AUX')) else ('A' if cg.startswith('ADJ') else None))
            if k: bpos.setdefault(w, set()).add(k)
            try: fr = float((c[10] if len(c) > 10 else '0').replace(',', '.') or 0)
            except ValueError: fr = 0.0
            bfrq[w] = max(bfrq.get(w, 0.0), fr)
    wk = set()
    with io.open(os.path.join(ROOT, 'data_local', 'fr', 'kaikki-frwikt.jsonl'), encoding='utf-8') as f:
        for l in f:
            if '"pos": "verb"' not in l: continue
            r = json.loads(l)
            if r.get('pos') == 'verb' and r.get('lang_code', 'fr') == 'fr' and ordinaire(r): wk.add(norm(r.get('word', '').lower()))
    ok = re.compile(r"^[a-zà-ÿ]+$")
    rows, seen, lem, cat, lna, lgen, na, cand, fins, verbes_de = [], set(), None, None, None, '', {}, [], set(), {}
    with io.open(os.path.join(ROOT, 'data_local', 'morphalou', 'Morphalou3.1_CSV.csv'), encoding='utf-8', errors='replace') as fh:
        for l in fh:
            p = l.rstrip('\n').split(';')
            if len(p) < 18: continue
            if p[0].strip():
                cat = p[2].strip(); lna = norm(p[0].strip().lower()); lem = lna if cat == 'Verbe' else None; lgen = p[5].strip().lower().strip('-')[:1]
            if cat == 'Verbe':                                           # ⭐ ligne 148 : verbe(s) de chaque forme, formes à terminaison gardée
                f_ = norm(p[9].strip().lower()); verbes_de.setdefault(f_, set()).add(sans_accent(lna))
                if (p[12].strip(), p[14].strip()) in FINS: fins.add(f_)
            if cat in CATS:                                              # nom / adjectif : nature à compléter (voir plus bas)
                w = norm(p[9].strip().lower())
                if len(w) >= 3 and ok.match(w.replace('oe', 'o').replace('ae', 'a')) and len(p[17].split()) >= 2:
                    na.setdefault(w, {}).setdefault(CATS[cat], (lna, p[11].strip().lower()[:1], (p[13].strip().lower().strip('-')[:1] or lgen)))
                continue
            if lem is None or re.sub(r"^(s'|se )", '', lem) not in wk: continue   # pronominal : « s'abader » → abader
            w = norm(p[9].strip().lower())
            if len(w) < 4 or not ok.match(w.replace('oe', 'o').replace('ae', 'a')) or w in seen or w in base: continue
            if not (set(p[17].split()) - {'morphalou', 'morphalou2'}): continue   # la FORME attestée hors Morphalou (DELA, Dicollecte, Lefff) : une forme générée seule n'entre pas
            seen.add(w); nb = p[11].strip().lower()[:1]; cand.append((w, lem, nb if nb in ('s', 'p') else ''))
    tous, r90 = base | seen, 0
    for w, lem, nb in cand:                                          # graphie RECTIFIÉE de 1990 (« frèterais », « aouté ») : sa forme
        # traditionnelle existe — elle entre par le lot de la liste n° 109 (rect90). ⭐ Ligne 148 : à condition que 1990 change vraiment
        # cet accent (rectifiees) et que la forme traditionnelle soit du MÊME verbe, accents du lemme mis à part (abîmer / abimer ; mais
        # « crûsses » est à croître, « crusses » à croire : 1990 garde l'accent qui les sépare). Sans ces deux réserves, « il prévit »,
        # « il provint », « il appartint » passaient pour des graphies de 1990, étaient laissés au lot 1990… qui ne les prenait pas :
        # 81 formes justes manquaient au lot (67 au dictionnaire), « Il prévit la tempête. » recevait un orange.
        if any(v in tous and sans_accent(lem) in verbes_de.get(v, {sans_accent(lem)}) for v in rectifiees(w, fins)): seen.discard(w); r90 += 1; continue
        row = [''] * 37; row[0] = w; row[3] = lem; row[4] = 'VER'; row[5] = 'VER'; row[7] = nb; row[9] = '0'; row[10] = '0'; row[11] = '0'
        rows.append('\t'.join(row))
    nat = 0                                                         # nature NOM : formes du lot + verbes rares connus comme verbe seul
    for w in sorted(na):
        if not (w in seen or (bpos.get(w) == {'V'} and bfrq.get(w, 0.0) < 0.01)): continue
        for cg, (l2, nb, g) in sorted(na[w].items()):                # graphie « oe » : celle que le dictionnaire lit (« œ » y est normalisé)
            row = [''] * 37; row[0] = w; row[3] = l2; row[4] = cg; row[5] = cg; row[6] = g if g in ('m', 'f') else ''
            row[7] = nb if nb in ('s', 'p') else ''; row[9] = '0'; row[10] = '0'; row[11] = '0'
            rows.append('\t'.join(row)); nat += 1
    rows.sort()
    with gzip.open(OUT, 'wt', encoding='utf-8', newline='\n') as f: f.write('\n'.join(rows) + '\n')
    print('✓ ver_justes : %d lignes (%d formes verbales, %d natures nom ; %d graphies de 1990 laissées au lot rect90, liste n° 109) -> %s' % (len(rows), len(seen), nat, r90, os.path.relpath(OUT, ROOT)))


def check():
    if not os.path.exists(OUT): print('✗ ver_justes_lex_fr.tsv.gz absent'); return 1
    n = bad = 0; lot = []
    for l in ouvrir(OUT):
        if not l.strip(): continue
        n += 1; c = l.rstrip('\n').split('\t')
        if len(c) != 37 or c[10] != '0' or c[4] not in ('VER', 'NOM'): bad += 1
        lot.append(c[0])
    if bad: print('✗ ver_justes : %d ligne(s) mal formée(s) (37 colonnes, VER/NOM, FreqOrtho 0)' % bad); return 1
    SP = {}
    for l in gzip.open(os.path.join(ROOT, 'extension', 'assets', 'speller.tsv.gz'), 'rt', encoding='utf-8'):
        c = l.rstrip('\n').split('\t')
        if c[0]: SP[c[0]] = c[2] if len(c) > 2 else ''
    absents = [w for w in lot if w not in SP]
    if absents: print('✗ ver_justes : %d forme(s) du lot absentes de extension/assets/speller.tsv.gz (ex. %s) — régénérer le speller' % (len(absents), absents[0])); return 1
    for w in TEMOINS_OUI:
        if w not in SP: print('✗ ver_justes : forme juste « %s » inconnue du speller livré' % w); return 1
    for w in TEMOINS_NON:
        if w in SP: print('✗ ver_justes : graphie fautive « %s » connue du speller livré' % w); return 1
    for w in TEMOINS_NOM:
        if 'N' not in SP.get(w, ''): print('✗ ver_justes : « %s » (nom pluriel) n\'a pas la nature NOM dans le speller livré' % w); return 1
    print('✓ ver_justes_lex_fr.tsv.gz : %d lignes, 37 colonnes, VER/NOM, FreqOrtho 0 ; câblé dans le speller livré (%s connus ; %s non ; %s noms)'
          % (n, ', '.join(TEMOINS_OUI), ', '.join(TEMOINS_NON), ', '.join(TEMOINS_NOM)))
    return 0


def main():
    if '--check' in sys.argv: return check()
    for p in (os.path.join(ROOT, 'data_local', 'morphalou', 'Morphalou3.1_CSV.csv'), os.path.join(ROOT, 'data_local', 'fr', 'kaikki-frwikt.jsonl')):
        if not os.path.exists(p): print('✗ %s absent (data_local) : impossible de régénérer' % os.path.relpath(p, ROOT)); return 1
    generer(); return 0


if __name__ == '__main__':
    sys.exit(main())
