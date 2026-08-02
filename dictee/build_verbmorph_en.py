# -*- coding: utf-8 -*-
# build_verbmorph_en.py — VERBES IRRÉGULIERS RÉGULARISÉS (erreur dys/L2 : runned->ran, goed->went,
# teached->taught…) depuis **AGID** (Automatically Generated Inflection Database, Kevin Atkinson).
# Sortie : verbmorph_en.json = { forme_erreur : [passé, participe] }.
#
# POURQUOI AGID (remplace la table curée à la main de ~110 verbes, 2026-08-03) :
#   - couverture : 8 953 verbes au lieu de 110 ;
#   - il DIT quelles formes régularisées sont VALIDES (« bet, betted 1 », « dream: dreamed, dreamt 1 »,
#     « hang: hung, hanged {execute} ») → l'ambiguïté qui m'avait forcé à retirer cost/quit/put/wet/bet/
#     sweat/shine/hang/light/wind/kneel/dig/burst/pay/wake À LA MAIN devient une DONNÉE, pas du flair ;
#   - les formes kaikki (forms_en) étaient trop bruitées (dialectal « teuk », fuite du lemme).
# Licence AGID (Copyright 2000-2016 Kevin Atkinson) : « Permission to use, copy, modify, distribute and
# sell this database, the associated scripts, the output created from the scripts and its documentation
# for any purpose is hereby granted without fee » — permissive, compatible (attribution dans les docs).
#
# GARDES FP=0 (une forme n'est une ERREUR que si TOUT est vrai) :
#   1. elle n'est PAS listée par AGID comme forme valide de CE verbe (bet/betted → écarté) ;
#   2. elle n'est une forme valide d'AUCUN autre mot (putted = valide pour « putt » → écarté) ;
#   3. elle n'est pas un mot du lexique avec un sens NON-verbal (seed=NOUN, leaded=ADJ → écarté).
#   Source AGID locale (data_local/en/agid-*/infl.txt, non commitée) ; absente → JSON existant inchangé.
#   Lancer : PYTHONUTF8=1 python dictee/build_verbmorph_en.py
import gzip, io, os, re, sys, json, glob
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'verbmorph_en.json')

_agid = sorted(glob.glob(os.path.join(HERE, '..', 'data_local', 'en', 'agid-*', 'infl.txt')))
if not _agid:
    print('[SKIP] AGID absent (data_local/en/agid-*/infl.txt) — verbmorph_en.json inchangé.')
    sys.exit(0)
AGID = _agid[-1]

# ---- parseur AGID : « mot POS[?]: f1, f2 2 {sens} | f3 | … » ----
# champs séparés par « | » ; alternatives par « , » ; chaque alternative peut porter un niveau de
# variante (0, 1, 2, 0.1…), une étiquette de sens {…} et des tags de mot (~ < ! ?).
def _forms(field):
    out = []
    for alt in field.split(','):
        a = re.sub(r'\{[^}]*\}', ' ', alt)              # retire {sens}
        a = re.sub(r'\d+(?:\.\d+)?', ' ', a)            # retire le niveau de variante
        a = a.replace('~', ' ').replace('<', ' ').replace('!', ' ').replace('?', ' ')
        a = a.strip().lower()
        if a and re.fullmatch(r"[a-z']+", a): out.append(a)
    return out

VERBS = {}          # lemme -> {'past': [...], 'pp': [...]}
ALL_FORMS = set()   # TOUTE forme valide (tous POS, toutes variantes) + tous les lemmes
with io.open(AGID, encoding='utf-8', errors='replace') as f:
    for line in f:
        m = re.match(r"^([a-zA-Z' ]+?)\s+([VNA])\??:\s*(.*)$", line.rstrip('\n'))
        if not m: continue
        lemma, pos, rest = m.group(1).strip().lower(), m.group(2), m.group(3)
        if not re.fullmatch(r"[a-z']+", lemma): continue
        ALL_FORMS.add(lemma)
        fields = [_forms(x) for x in rest.split('|')]
        for fl in fields: ALL_FORMS.update(fl)
        if pos != 'V' or not fields: continue
        # V : 4 champs = passé | participe | -ing | -s ; 3 champs = passé&participe | -ing | -s
        if len(fields) >= 4: past, pp = fields[0], fields[1]
        elif len(fields) == 3: past = pp = fields[0]
        else: continue
        if not past or not pp: continue
        e = VERBS.setdefault(lemma, {'past': [], 'pp': []})
        e['past'] += past; e['pp'] += pp

print('AGID : %d verbes · %d formes valides (tous POS)' % (len(VERBS), len(ALL_FORMS)))

# ---- formes régularisées candidates (lemma + ed : e-drop / y->ied / doublement CVC) ----
VOW = set('aeiou')
def reg_ed(w):
    if w.endswith('e'): return w + 'd'
    if len(w) >= 2 and w[-1] == 'y' and w[-2] not in VOW: return w[:-1] + 'ied'
    if len(w) >= 3 and w[-1] not in VOW and w[-1] not in 'wxy' and w[-2] in VOW and w[-3] not in VOW:
        return w + w[-1] + 'ed'
    return w + 'ed'
def err_candidates(w):
    out = {reg_ed(w), w + 'ed'}
    if len(w) >= 2 and w[-1] == 'y' and w[-2] not in VOW: out.add(w[:-1] + 'ied')
    return {e for e in out if len(e) >= 4 and re.fullmatch(r'[a-z]+', e)}

# ---- garde 3 : mots du lexique ayant un sens NON-verbal (seed=NOUN, leaded=ADJ) ----
NONVERB = {'NOUN', 'ADJ', 'ADV', 'PRON', 'DET', 'PREP', 'CONJ', 'INTJ', 'NUM', 'PROPN', 'PART'}
PROTECT = set()
_lex = os.path.join(HERE, 'lex_en.tsv.gz')
if os.path.exists(_lex):
    with gzip.open(_lex, 'rt', encoding='utf-8') as f:
        next(f)
        for ln in f:
            c = ln.rstrip('\n').split('\t')
            if len(c) < 4: continue
            s = c[0].lower()
            if s.isascii() and s.isalpha() and (set((c[1] or '').upper().split('|')) & NONVERB):
                PROTECT.add(s)

# ---- garde 4 : DOUBLEMENT DE CONSONNE = variante dialectale US/GB, PAS une faute ----
# L'anglais US et GB divergent systématiquement sur le doublement (traveled/travelled, canceled/cancelled).
# AGID liste en général les deux, mais pas toujours (« trial V: trialled » seulement → « trialed », pourtant
# l'orthographe AMÉRICAINE valide, serait flaggée = FP RÉEL mesuré). Même mécanisme derrière le bruit de mon
# générateur (barberred/clatterred : le doublement CVC ne s'applique qu'à une syllabe ACCENTUÉE, que je ne
# connais pas). Règle : si la candidate et une forme valide sont égales une fois les consonnes dédoublées,
# c'est une variante de doublement → JAMAIS une faute.
def _undouble(w): return re.sub(r'([bcdfglmnprstvz])\1', r'\1', w)

morph = {}
n_skip_valid = n_skip_other = n_skip_pos = n_skip_dbl = 0
for lemma, e in VERBS.items():
    past_ok, pp_ok = set(e['past']), set(e['pp'])
    canon_past, canon_pp = e['past'][0], e['pp'][0]              # 1re listée = variante principale
    if canon_past == reg_ed(lemma) and canon_pp == reg_ed(lemma):
        continue                                                 # verbe régulier : rien à corriger
    _ok_undbl = {_undouble(x) for x in (past_ok | pp_ok)}
    for cand in err_candidates(lemma):
        if cand in past_ok or cand in pp_ok: n_skip_valid += 1; continue   # garde 1 : AGID le dit valide
        if cand in ALL_FORMS: n_skip_other += 1; continue                  # garde 2 : forme d'un AUTRE mot
        if cand in PROTECT: n_skip_pos += 1; continue                      # garde 3 : sens non-verbal
        if _undouble(cand) in _ok_undbl: n_skip_dbl += 1; continue         # garde 4 : variante de doublement US/GB
        if cand == lemma: continue
        if cand not in morph: morph[cand] = [canon_past, canon_pp]

morph = {k: morph[k] for k in sorted(morph)}
io.open(OUT, 'w', encoding='utf-8').write(json.dumps(morph, ensure_ascii=False, separators=(',', ':')))
print("verbmorph_en.json : %d formes-erreur (écartées : %d valides-AGID, %d formes d'un autre mot, %d sens non-verbal, %d doublement US/GB)"
      % (len(morph), n_skip_valid, n_skip_other, n_skip_pos, n_skip_dbl))
ex = ['runned', 'goed', 'buyed', 'teached', 'taked', 'catched', 'thinked', 'eated', 'comed', 'writed',
      'speaked', 'breaked', 'swimmed', 'drinked', 'knowed', 'gived', 'sended', 'builded',
      'seed', 'betted', 'dreamed', 'putted', 'hanged', 'costed', 'payed']
print('contrôle :', {e: morph.get(e, '(écarté)') for e in ex})
