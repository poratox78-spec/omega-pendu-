# -*- coding: utf-8 -*-
# BANC DE RECALL du correcteur ANGLAIS — la mesure qui manquait (2026-08-03).
# On avait le FP=0 mesuré (RED sur EWT ≤55) mais JAMAIS le recall sur de vraies fautes anglaises :
# seulement 32 cas faits main + 28 formes verbales. Côté FR il y a des corpus réels (dys, WiCoPaCo,
# OQLF) ; côté EN on volait à l'aveugle → tout chantier suivant était deviné, pas ciblé.
#
# SOURCE : « Wikipedia:Lists of common misspellings/For machines » (CC BY-SA) — ~4 300 paires
#   faute→correction RÉELLES (relevées dans les éditions de Wikipédia). Fichier local
#   data_local/en/wiki_misspell.txt (export XML, NON commité — c'est un banc, pas une donnée livrée).
#   Absent → le probe se saute proprement (comme les autres bancs locaux).
#
# CE QUE ÇA MESURE (par famille) :
#   AUTO   = corrigé tout seul, bonne cible (rouge)          -> recall dur
#   FLAG   = proposé, bonne cible (orange)                    -> recall assisté
#   WRONG  = proposé, MAUVAISE cible                          -> qualité à travailler
#   MISS   = rien proposé                                     -> trou de couverture
#   KNOWN  = la « faute » est un mot connu du lexique         -> hors périmètre speller (real-word,
#            c'est le canal HOMOPHONE/grammaire qui doit la prendre — compté à part)
#   Lancer : PYTHONUTF8=1 python dictee/recall_en_probe.py [N]
import io, os, re, sys, importlib.util, collections
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'data_local', 'en', 'wiki_misspell.txt')
if not os.path.exists(SRC):
    print('[SKIP] banc absent :', os.path.relpath(SRC)); sys.exit(0)

# ---- paires « faute->correction » depuis le wikitexte des pages A..Z ----
# format d'une entrée : « * {{search link|FAUTE||ns0|…}} (CORRECTION) » — la correction peut être un
# lien [[mot]], contenir plusieurs variantes séparées par « or »/« , », ou une note entre parenthèses.
raw = io.open(SRC, encoding='utf-8', errors='replace').read()
pairs = []
for m in re.finditer(r'^\*\s*\{\{search link\|([^|}]+)\|[^}]*\}\}\s*\(([^)]*)\)', raw, re.M):
    bad = m.group(1).strip().strip('"').lower()
    tgt = m.group(2).replace('[[', ' ').replace(']]', ' ').replace('|', ' ')
    goods = [g.strip().lower() for g in re.split(r'\bor\b|,|/', tgt) if g.strip()]
    goods = [g for g in goods if re.fullmatch(r"[a-z']{2,}", g)]
    if bad and goods and re.fullmatch(r"[a-z']{2,}", bad): pairs.append((bad, goods))
LIM = int(sys.argv[1]) if len(sys.argv) > 1 else 0
if LIM: pairs = pairs[:LIM]
print('banc : %d paires faute->correction (Wikipedia, CC BY-SA)' % len(pairs))

spec = importlib.util.spec_from_file_location('sp', os.path.join(HERE, 'speller_en_probe.py'))
sp = importlib.util.module_from_spec(spec)
_argv = sys.argv; sys.argv = ['x']
try: spec.loader.exec_module(sp)
except SystemExit: pass
sys.argv = _argv
S = sp.SpellerEN()

cnt = collections.Counter(); ex = collections.defaultdict(list)
for bad, goods in pairs:
    if bad in S.KNOWN:                       # « faute » qui est un mot valide -> real-word, hors speller
        cnt['KNOWN'] += 1
        if len(ex['KNOWN']) < 6: ex['KNOWN'].append('%s (=%s)' % (bad, goods[0]))
        continue
    sug, mode = S.suggest(bad)
    ok = (sug or '').lower() in goods
    if mode == 'AUTO' and ok: k = 'AUTO'
    elif mode == 'AUTO': k = 'AUTO_WRONG'
    elif sug and ok: k = 'FLAG'
    elif sug: k = 'WRONG'
    else: k = 'MISS'
    cnt[k] += 1
    if len(ex[k]) < 8: ex[k].append('%s -> %s (attendu %s)' % (bad, sug, goods[0]))

tot = sum(cnt.values()); spell = tot - cnt['KNOWN']
print('\n=== RECALL (n=%d ; %d hors périmètre speller = mots réels) ===' % (tot, cnt['KNOWN']))
for k in ['AUTO', 'FLAG', 'WRONG', 'MISS', 'AUTO_WRONG']:
    print('  %-11s %5d  (%.1f%% du périmètre speller)' % (k, cnt[k], 100.0 * cnt[k] / max(1, spell)))
print('  --> recall CORRIGÉ (AUTO+FLAG, bonne cible) : %.1f%%'
      % (100.0 * (cnt['AUTO'] + cnt['FLAG']) / max(1, spell)))
print('  --> FP rouge (AUTO_WRONG, doit être 0)      : %d' % cnt['AUTO_WRONG'])
for k in ['AUTO_WRONG', 'WRONG', 'MISS', 'KNOWN']:
    if ex[k]: print('\n  %s :' % k); [print('    ' + s) for s in ex[k]]
