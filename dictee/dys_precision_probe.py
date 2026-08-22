# -*- coding: utf-8 -*-
"""PRÉCISION PAR FAMILLE SUR TEXTE DYS RÉEL — la mesure qui décide ce qui a le droit de s'appeler « sûr ».

FP=0 est mesuré sur du texte CORRECT (batteries, UD). Mais le correcteur reçoit du texte DYS, où un mot
peut être JUSTE à l'accent près (« ma mere ») : une règle peut alors « corriger » du juste (FP dys) ou
proposer un mauvais mot (fausse correction). Ici, sur les paires (brut, corrigé) du corpus dys local
(data_local/dys_reel — PRIVÉ, jamais versionné ; la sonde se SAUTE en CI), chaque flag du moteur de
référence (grammaire correcteur_probe + speller speller_probe) est jugé contre le gold :
  JUSTE    : suggestion == gold
  INUTILE  : le gold garde le mot tel quel (le texte était juste) → FP sur texte dys
  FAUSSE   : suggestion ≠ gold (le mot était faux, mais pas comme ça)
Précision = JUSTE / (JUSTE + INUTILE + FAUSSE), par famille et par palier (auto/flag/vigilance).
  python3 dictee/dys_precision_probe.py            # tableau
  python3 dictee/dys_precision_probe.py --json     # sortie machine (pour décider les paliers)
"""
import difflib
import io
import json
import os
import re
import sys
import unicodedata
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
DATA = os.environ.get('OMEGA_DYS_DATA') or os.path.join(ROOT, 'data_local', 'dys_reel')   # worktree : OMEGA_DYS_DATA=/chemin/data_local/dys_reel
FILES = ['dictees_gold.jsonl', 'faiblesses.jsonl', 'genere_gold.jsonl']
TOK = re.compile(r"[A-Za-zÀ-ÿœŒæÆ']+")


def norm(w):
    w = w.lower().replace('’', "'")
    return ''.join(c for c in unicodedata.normalize('NFD', w) if unicodedata.category(c) != 'Mn')


def pairs():
    for fn in FILES:
        p = os.path.join(DATA, fn)
        if not os.path.exists(p):
            continue
        for line in io.open(p, encoding='utf-8'):
            line = line.strip()
            if not line:
                continue
            try:
                o = json.loads(line)
            except Exception:
                continue
            if o.get('raw') and o.get('fixed'):
                yield fn, o['raw'], o['fixed']


def eq(x, y):
    """égalité tolérante aux ÉLISIONS et aux soudures : « l'âge » ≡ « âge », « de dure » ≡ « dure » (dernier mot)."""
    nx, ny = norm(x), norm(y)
    if nx == ny:
        return True
    return nx.split("'")[-1].split(' ')[-1] == ny.split("'")[-1].split(' ')[-1]


def _sim(a, b):
    return difflib.SequenceMatcher(a=a, b=b, autojunk=False).ratio()


def align(raw_toks, fix_toks):
    """index brut → token gold. Blocs 'equal' : 1:1. Blocs 'replace' : chaque token brut prend le token gold
    du bloc qui lui RESSEMBLE le plus (similarité ≥ 0,5, un gold par brut) — sinon AMBIGU (non jugé).
    Sans ça, une insertion dans le gold (« à l'abri ») décale tout et fabrique de fausses « fausses »."""
    a = [norm(t) for t in raw_toks]; b = [norm(t) for t in fix_toks]
    m = {}
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes():
        if tag == 'equal':
            for k in range(i2 - i1):
                m[i1 + k] = fix_toks[j1 + k]
        elif tag == 'replace':
            used = set()
            for i in range(i1, i2):
                best, bs = None, 0.0
                for j in range(j1, j2):
                    if j in used:
                        continue
                    s = _sim(a[i], b[j])
                    if s > bs:
                        best, bs = j, s
                if best is not None and bs >= 0.5:
                    m[i] = fix_toks[best]; used.add(best)
    return m


def main():
    as_json = '--json' in sys.argv
    if not os.path.isdir(DATA):
        print('dys_precision_probe : corpus dys local absent (data_local/dys_reel) → sonde SAUTÉE (pas un échec).')
        return 0
    import correcteur_probe as CP
    import speller_probe as S
    import inspect
    sp = [o for n, o in vars(S).items() if inspect.isclass(o) and hasattr(o, '_cands')][0]()
    stats = defaultdict(lambda: defaultdict(int))
    exemples = defaultdict(list)
    distinct = defaultdict(set)
    n_pairs = 0
    for fn, raw, fixed in pairs():
        n_pairs += 1
        raw_n = raw.replace('’', "'").replace('ʼ', "'")
        ft = [x.group(0) for x in TOK.finditer(fixed)]
        # deux tokeniseurs, deux alignements : la grammaire indexe SES tokens (CP.toks), le speller rend des offsets
        ms = list(TOK.finditer(raw_n)); rt_s = [x.group(0) for x in ms]; al_s = align(rt_s, ft)
        rt_g = CP.toks(raw_n); al_g = align(rt_g, ft)
        starts = {x.start(): i for i, x in enumerate(ms)}
        flags = []
        try:
            for (i, w, sugg, name, tier) in CP.correct_tiered(raw_n):
                flags.append((i, w, sugg, 'grammaire:' + name, tier, al_g))
        except Exception as e:
            print('  ! grammaire :', e)
        try:
            for (st, w, sugg, act) in sp.correct_text(raw_n):
                i = starts.get(st)
                if i is not None:
                    flags.append((i, w, sugg, 'orthographe', act, al_s))
        except Exception as e:
            print('  ! speller :', e)
        spelled = set(i for (i, w, sugg, fam, tier, al) in flags if fam == 'orthographe')
        def clean_ctx(i):                                   # CONTEXTE PROPRE : voisins ±3 tous connus du lexique et sans flag ortho
            for j in range(max(0, i - 3), min(len(rt_g), i + 4)):
                if j == i:
                    continue
                t = norm(rt_g[j]).split("'")[-1]
                if not t or not t.isalpha():
                    continue
                if t not in sp.WORDS or any(i2 == j for i2 in spelled_g):
                    return False
            return True
        spelled_g = set()
        for (i, w, sugg, fam, tier, al) in flags:          # flags ortho re-projetés sur les tokens grammaire (par mot)
            if fam == 'orthographe':
                for j, t in enumerate(rt_g):
                    if norm(t) == norm(w):
                        spelled_g.add(j)
        for (i, w, sugg, fam, tier, al) in flags:
            if i not in al:
                stats[(fam, tier)]['ambigu'] += 1; continue
            g = al[i]
            if eq(sugg, g): k = 'juste'
            elif eq(g, w): k = 'inutile'
            else: k = 'fausse'
            key = (fam, tier) if fam == 'orthographe' else (fam, tier + ('·propre' if clean_ctx(i) else '·pollué'))
            stats[key][k] += 1
            # CAS DISTINCTS : le corpus contient la MÊME dictée recopiée par plusieurs élèves → un piège
            # (« vingt anse ») comptait 7×. On compte aussi chaque (mot, suggestion, contexte ±2) une seule fois.
            toks_ctx = rt_g if fam != 'orthographe' else rt_s
            dk = (norm(w), norm(sugg), ' '.join(norm(x) for x in toks_ctx[max(0, i - 2):i + 3]))
            if dk not in distinct[key]:
                distinct[key].add(dk); stats[key]['d_' + k] += 1
            if k != "juste" and len(exemples[key]) < (99 if "--all" in sys.argv else 6):
                ctx = ''
                if '--ctx' in sys.argv and fam != 'orthographe':
                    ctx = '   ⟨' + ' '.join(rt_g[max(0, i - 5):i + 6]) + '⟩'
                exemples[key].append('%s→%s (gold %s)%s' % (w, sugg, g, ctx))
    rows = []
    for (fam, tier), c in sorted(stats.items(), key=lambda kv: (-sum(kv[1].values()), kv[0])):
        j, u, f = c['juste'], c['inutile'], c['fausse']
        tot = j + u + f
        dj, du, df = c['d_juste'], c['d_inutile'], c['d_fausse']
        dtot = dj + du + df
        rows.append({'famille': fam, 'palier': tier, 'juste': j, 'inutile': u, 'fausse': f, 'ambigu': c['ambigu'],
                     'precision': (round(100.0 * j / tot, 1) if tot else None),
                     'distincts': [dj, du, df], 'precision_distincts': (round(100.0 * dj / dtot, 1) if dtot else None),
                     'exemples': exemples[(fam, tier)]})
    if as_json:
        print(json.dumps({'paires': n_pairs, 'familles': rows}, ensure_ascii=False, indent=1)); return 0
    print('dys_precision_probe — %d paires (brut, gold) · précision par famille et palier sur TEXTE DYS' % n_pairs)
    print('%-34s %-10s %5s %5s %5s %7s   %s' % ('famille', 'palier', 'juste', 'inut.', 'fauss', 'préc.', 'DISTINCTS j/i/f (préc.)'))
    for r in rows:
        d = r['distincts']
        print('%-34s %-10s %5d %5d %5d %6s%%   %d/%d/%d (%s%%)' % (r['famille'][:34], r['palier'], r['juste'], r['inutile'], r['fausse'],
              r['precision'] if r['precision'] is not None else '—', d[0], d[1], d[2], r['precision_distincts'] if r['precision_distincts'] is not None else '—'))
        for e in r['exemples']:
            print('      ✗ ' + e)
    return 0


if __name__ == '__main__':
    sys.exit(main())
