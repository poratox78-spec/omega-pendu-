# -*- coding: utf-8 -*-
# GARDE CI dictée : la copie inlinée `var SENT` de l'app == dictee/sentences.json (pas de dérive),
# + chaque phrase est SAINE : 0 faux positif sur sa propre bonne réponse (diagnose(text,text)==[]),
# + traps ⊆ familles DysProfile, + toute phrase taguée 'accent' contient bien un accent.
# (La copie app est manuelle — cette garde a été ajoutée après une dérive silencieuse du champ `traps`.)
import json, re, os, sys, unicodedata
HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)
import diag_sentence as D
import build_dictee as B   # annotation CANONIQUE : le corpus stocké doit == build() (anti-dérive)

FAMS = {'accent','voisee_sourde','inversion','muette','ajout','homophone','accord','surface','segmentation','liaison'}
def has_accent(s): return any(unicodedata.category(c) == 'Mn' for c in unicodedata.normalize('NFD', s))

errs = []
src = json.load(open(os.path.join(HERE, 'sentences.json'), encoding='utf-8'))
apptxt = open(os.path.join(HERE, '..', 'app', 'omega-pendu.html'), encoding='utf-8').read()
m = re.search(r'var SENT = (\[.*?\]);', apptxt, re.S)
if not m:
    print("FAIL: bloc `var SENT` introuvable dans l'app"); sys.exit(1)
app = json.loads(m.group(1))

if app != src:
    errs.append(f"parité app<->sentences.json ROMPUE (app {len(app)} phrases, json {len(src)})")

for s in src:
    t = s.get('text', '?')
    for k in ('text', 'd', 'fam', 'traps'):
        if k not in s: errs.append(f"clé manquante '{k}' : {t}")
    bad = set(s.get('traps', [])) - FAMS
    if bad: errs.append(f"trap(s) hors familles {bad} : {t}")
    if 'accent' in s.get('traps', []) and not has_accent(t):
        errs.append(f"tagué 'accent' mais aucun accent : {t}")
    # 0 faux positif : la bonne réponse ne doit lever AUCUNE faute
    fp = D.diagnose_sentence(t, t, {k.lower(): v for k, v in s.get('fam', {}).items()})
    if fp:
        errs.append(f"FAUX POSITIF sur la bonne réponse ({[f.get('types') for f in fp]}) : {t}")
    # ANNOTATION CANONIQUE : traps/fam DOIVENT être exactement la sortie de build_dictee.build (pas de dérive
    # manuelle ni de version périmée). Régénérer via build() si ça casse (les phrases s'annotent, ne se bricolent pas).
    canon = B.build(s.get('text', ''), s.get('d', ''))
    if canon['traps'] != s.get('traps'):
        errs.append(f"traps NON CANONIQUES (build={canon['traps']} ≠ stocké={s.get('traps')}) : {t}")
    if canon['fam'] != s.get('fam'):
        errs.append(f"fam NON CANONIQUE (build ≠ stocké) : {t}")

if errs:
    print("✗ GARDE DICTÉE : %d problème(s)" % len(errs))
    for e in errs[:20]: print("   -", e)
    sys.exit(1)
print(f"✓ dictée : {len(src)} phrases, app==json, 0 FP, traps valides")
