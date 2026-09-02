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
_DIR_ICI = os.path.dirname(os.path.abspath(__file__))
# ⭐ DEUX RÉFÉRENCES, PAS UNE. Le mode --navigateur mesure un AUTRE moteur (le produit :
# diagnoseAll, avec pyramide, cascade et arbitrage) que le mode par défaut (référence Python,
# grammaire et speller appelés séparément). Leurs chiffres divergent pour de VRAIES raisons :
# mesuré le 01/09, « accord sujet-verbe » auto·pollué vaut 67,9 % à la référence et 79,5 % au
# produit. Les faire partager un seul fichier ferait rougir chaque mode à cause de l'autre.
REF_PREC = os.path.join(_DIR_ICI, 'dys_precision_ref.json')
REF_PREC_NAV = os.path.join(_DIR_ICI, 'dys_precision_nav_ref.json')
DATA = os.environ.get('OMEGA_DYS_DATA') or os.path.join(ROOT, 'data_local', 'dys_reel')   # worktree : OMEGA_DYS_DATA=/chemin/data_local/dys_reel
FILES = ['dictees_gold.jsonl', 'faiblesses.jsonl', 'genere_gold.jsonl', 'gold_claude.jsonl']
# gold_claude.jsonl (22/08/2026) : les 72 productions dys réelles du corpus n'avaient AUCUN corrigé — seules les
# 6 dictées en avaient un (le texte dicté est connu). Corrigées À LA MAIN, en édition minimale (orthographe,
# accord, conjugaison, accents, élision, segmentation, majuscule de phrase ; ni style, ni ordre des mots).
# ⚠️ Annotation par CLAUDE, jamais un corrigé humain expert — `src` le dit. Produite SANS faire tourner le
# correcteur sur ces textes (sinon la mesure serait circulaire). Champ `ambig` = token que je n'ai pas su
# trancher, laissé INTACT : à exclure des mesures plutôt que d'en pénaliser le moteur.
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


def _flags_navigateur(phrases):
    """Interroge le PRODUIT (extension réelle dans Chrome) au lieu de la référence Python.

    ⭐ Pourquoi : cette sonde juge « le moteur de référence (correcteur_probe + speller_probe) »,
    qui appelle grammaire et speller SÉPARÉMENT. Le produit, lui, passe par `diagnoseAll` :
    pyramide (l'ortho nettoie les tokens avant la grammaire), CASCADE jusqu'au point fixe,
    arbitrage span/tier, couverture d'élision. Rien de tout ça n'est modelé ici.
    Le prix de la confusion est documenté : sur « élision fusionnée » le harnais Python annonçait
    3 justes / 17 fausses, le vrai Chrome 2 justes / 1 fausse, et le correctif qui en découlait
    faisait PERDRE « l'eau » et « j'ai ». Il a fallu le reverter.
    """
    import subprocess, tempfile
    d = tempfile.mkdtemp(prefix='omega-flags-')
    fin, fout = os.path.join(d, 'in.json'), os.path.join(d, 'out.json')
    io.open(fin, 'w', encoding='utf-8').write(json.dumps(phrases, ensure_ascii=False))
    r = subprocess.run(['node', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'navigateur_flags_dump.js'), fin, fout])
    if r.returncode != 0 or not os.path.exists(fout):
        return None
    return json.loads(io.open(fout, encoding='utf-8').read())


def main():
    global REF_PREC
    as_json = '--json' in sys.argv
    au_navigateur = '--navigateur' in sys.argv
    if au_navigateur:
        REF_PREC = REF_PREC_NAV
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
    _TOUT = list(pairs())
    _NAV = None
    if au_navigateur:
        _NAV = _flags_navigateur([r.replace('’', "'").replace('ʼ', "'") for _f, r, _x in _TOUT])
        if _NAV is None:
            print('dys_precision_probe --navigateur : le PRODUIT n a pas pu etre interroge (Chrome ?) — ECHEC, pas un saut.')
            return 1
    for _k, (fn, raw, fixed) in enumerate(_TOUT):
        n_pairs += 1
        raw_n = raw.replace('’', "'").replace('ʼ', "'")
        ft = [x.group(0) for x in TOK.finditer(fixed)]
        # deux tokeniseurs, deux alignements : la grammaire indexe SES tokens (CP.toks), le speller rend des offsets
        ms = list(TOK.finditer(raw_n)); rt_s = [x.group(0) for x in ms]; al_s = align(rt_s, ft)
        starts = {x.start(): i for i, x in enumerate(ms)}
        flags = []
        if _NAV is not None:
            # LE PRODUIT : un seul flux de flags, deja arbitre par diagnoseAll. Les index sont ceux
            # de SON tokeniseur, rendu avec le dump — on ne recompose surtout pas le notre.
            _d = _NAV[_k]; rt_g = _d['toks']; al_g = align(rt_g, ft)
            for _fl in _d['flags']:
                if _fl.get('i') is None:
                    # flags ancres CARACTERE (typographie, point final, virgule) : le produit en a,
                    # la reference Python n'en produit pas. Hors perimetre de CETTE table, qui juge
                    # des MOTS contre un gold de mots. On les COMPTE pour ne pas les taire.
                    globals()['_HORS_TOKEN'] = globals().get('_HORS_TOKEN', 0) + 1
                    continue
                _fam = ('grammaire:' + _fl['name']) if _fl.get('name') else 'orthographe'
                flags.append((_fl['i'], _fl['word'], _fl['sugg'], _fam, _fl.get('tier') or 'auto', al_g))
        else:
            rt_g = CP.toks(raw_n); al_g = align(rt_g, ft)
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
            if k == 'inutile' and tier.startswith('auto'):
                # ⭐ LA LISTE ACTIONNABLE : chaque mot JUSTE réécrit en silence, avec son contexte.
                # Les exemples généraux mélangent INUTILE et FAUSSE ; seule cette liste-ci nomme des
                # violations de FP=0. `--casse` l'imprime en entier.
                globals().setdefault('_CASSE', []).append(
                    (fam, tier, w, sugg, ' '.join(rt_g[max(0, i - 4):i + 5]) if fam != 'orthographe' else ' '.join(rt_s[max(0, i - 4):i + 5])))
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
            print('      · ' + e)

    # ⭐ CONTRAT — cette sonde ne pouvait PAS échouer : elle imprimait un tableau et rendait 0.
    # Second banc décoratif du lot 1 (le premier, descending_probe, a reçu le sien en PR#622).
    # Les planchers sont l'ÉTAT MESURÉ à la pose, par (famille, palier) : aucun verdict ne bascule.
    # Une précision qui BAISSE rougit ; une famille qui DISPARAÎT rougit (on ne perd pas une mesure
    # en silence) ; une famille NEUVE passe et est annoncée, à ancrer avec --fix.
    vus = {}
    for r in rows:
        if r['precision'] is not None:
            vus['%s|%s' % (r['famille'], r['palier'])] = r['precision']
    _ht = globals().get('_HORS_TOKEN', 0)
    if _ht:
        print(u'')
        print(u'  ℹ %d flag(s) ancré(s) CARACTÈRE écarté(s) (typographie, point final, virgule) : cette'
              u' table juge des MOTS contre un gold de mots. Le produit en émet, la référence non.' % _ht)
    if '--fix' in sys.argv:
        json.dump({'paires': n_pairs, 'planchers': vus,
                   'inutile_auto': sum(r['inutile'] for r in rows if r['palier'].startswith('auto')),
                   'note': u"Précision par (famille, palier) sur texte dys, ANCRÉE. Une baisse "
                           u"rougit ; une hausse est un GAIN à ré-ancrer (--fix)."},
                  io.open(REF_PREC, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('✓ ancré : %d familles×paliers' % len(vus))
        return 0

    # ⚠️ DETTE VISIBLE, réimprimée À CHAQUE PASSAGE VERT (convention du census). Une règle au
    # palier AUTO est APPLIQUÉE EN SILENCE : sous 80 % de précision, elle réécrit plus d'un mot
    # sur cinq en une autre faute. Enterré dans une ligne de tableau, personne ne le voit.
    dette = [r for r in rows if r['palier'].startswith('auto') and r['precision'] is not None
             and r['precision'] < 80.0 and (r['juste'] + r['fausse']) >= 10]
    if dette:
        print('')
        print(u'  ⚠️ %d règle(s) APPLIQUÉE(S) EN SILENCE sous 80 %% de précision sur texte dys :' % len(dette))
        for r in sorted(dette, key=lambda r: r['precision']):
            print(u'      %-42s %-12s %5.1f %%  (%d justes / %d INUTILES / %d fausses)'
                  % (r['famille'][:42], r['palier'], r['precision'], r['juste'], r['inutile'], r['fausse']))

    # ⭐ LA COLONNE QUI PORTE LA DOCTRINE ÉTAIT CACHÉE. La bannière ci-dessus n'imprimait que
    # « justes / fausses » et taisait INUTILE — or les trois cas ne coûtent pas la même chose :
    #   JUSTE   : le mot était faux, la suggestion est celle du gold ;
    #   FAUSSE  : le mot était faux, la suggestion ne l'est pas — gêché, mais on ne CASSE rien ;
    #   INUTILE : le mot était JUSTE et on le réécrit — c'est ça, et ça seul, violer FP=0.
    # Le 01/09 j'ai rétrogradé « élision fusionnée » sur la foi d'une précision de 27,8 % en
    # croyant à des faux positifs. Elle a 0 INUTILE : elle ne touche JAMAIS de texte correct,
    # ses « fausses » sont de mauvaises devinettes sur des mots déjà faux. Le correctif faisait
    # perdre « l'eau » et « j'ai » ; il a fallu le reverter. Cette ligne existe pour que la
    # prochaine lecture ne refasse pas la confusion.
    # ⚠️ MAJORANT, PAS UN COMPTE EXACT. INUTILE veut dire « le gold garde le mot » — or le gold
    # du corpus dys est PARTIELLEMENT corrigé. Vérification à la main de 3 cas (02/09) : 1 défaut de
    # gold (« Tout cette mascarade », que le gold laisse tel quel alors que « Toute » est juste)
    # contre 2 vrais FP. Le plafond reste un GARDE DE RÉGRESSION valable — il ne peut que baisser —
    # mais on n'annonce pas ce nombre comme le compte exact des violations.
    # ⭐ ET LES DEUX « VRAIS FP » SONT UN ARBITRAGE ASSUMÉ, PAS UN BUG. « Les tige elle-même » et
    # « pendant les guerre » sont des désaccords DÉTERMINANT↔NOM où le déterminant est fautif ;
    # le moteur accorde le NOM. `rLeur` (dys-core.js) porte la mesure : sur 99 désaccords appariés,
    # le gold corrige le nom 59 fois contre 12 le déterminant — accorder le nom est le bon pari
    # 83 % du temps, et ces cas sont deux des 12. Ne PAS ouvrir de chantier là-dessus sans
    # remesurer les 99 : ce serait échanger 59 réparations contre 12.
    casse = [r for r in rows if r['palier'].startswith('auto') and r['inutile'] > 0]
    if casse:
        print('')
        print(u'  🔴 %d règle(s) AUTO réécrivent un mot que le GOLD GARDE (INUTILE > 0) — seule'
              u' colonne qui puisse violer FP=0. Majorant : le gold dys est partiellement corrigé.' % len(casse))
        for r in sorted(casse, key=lambda r: -r['inutile']):
            print(u'      %-42s %-12s %d mot(s) juste(s) réécrit(s)'
                  % (r['famille'][:42], r['palier'], r['inutile']))
        if '--casse' in sys.argv:
            print('')
            for (fam, tier, w, sugg, ctx) in globals().get('_CASSE', []):
                print(u'      %-34s %-12s %s → %s' % (fam[:34], tier, w, sugg))
                print(u'            ⟨ %s ⟩' % ctx)
        else:
            print(u'      (les %d cas, un par un, avec leur contexte : --casse)'
                  % len(globals().get('_CASSE', [])))

    if not os.path.exists(REF_PREC):
        print(u'✗ PRÉCISION DYS : pas de référence — ancrer : python dictee/dys_precision_probe.py --fix')
        return 1
    ref = json.load(io.open(REF_PREC, encoding='utf-8'))
    # ⭐ PLAFOND FP=0. Le contrat par (famille, palier) garde des POURCENTAGES, qui mélangent
    # « mauvaise devinette sur un mot faux » et « mot juste réécrit ». Seul le second viole la
    # règle n° 1. On le garde donc à part, en VALEUR ABSOLUE : il peut baisser, jamais monter.
    _inut = sum(r['inutile'] for r in rows if r['palier'].startswith('auto'))
    _plaf = ref.get('inutile_auto')
    if _plaf is None:
        print(u'  ℹ plafond FP=0 (mots justes réécrits au palier auto) pas encore ancré : %d — --fix' % _inut)
    elif _inut > _plaf:
        print(u'')
        print(u'✗ PRÉCISION DYS : %d mot(s) JUSTE(S) réécrit(s) au palier auto (plafond %d).' % (_inut, _plaf))
        print(u'    C’est FP=0 qui recule — pas un pourcentage qui bouge.')
        return 1
    planchers = ref.get('planchers') or {}
    err = []
    for k, plancher in sorted(planchers.items()):
        if k not in vus:
            err.append(u'%s : la mesure a DISPARU (plancher %.1f %%)' % (k, plancher))
        elif vus[k] < plancher - 0.05:
            err.append(u'%s : %.1f %% < plancher %.1f %%' % (k, vus[k], plancher))
    if err:
        print('')
        print(u'✗ PRÉCISION DYS : la précision a BAISSÉ :')
        for e in err[:10]: print(u'    ' + e)
        print(u"    (si la baisse est VOULUE et mesurée : python dictee/dys_precision_probe.py --fix)")
        return 1
    neuves = sorted(set(vus) - set(planchers))
    if neuves:
        print(u'  ✓ %d famille(s)×palier NEUVE(S) — à ancrer (--fix) : %s'
              % (len(neuves), ', '.join(neuves[:4])))
    return 0


if __name__ == '__main__':
    sys.exit(main())
