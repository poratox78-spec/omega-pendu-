# -*- coding: utf-8 -*-
# Extrait la liste des NOMS INVARIABLES français depuis le dump Wiktextract kaikki.org
# (kaikki-fr.jsonl, CC BY-SA) — PER-SENS et PER-NOM, là où Lexique 4 échoue (colonne Nombre
# sale : « étape » singulier tagué 'p' ; absence de ligne plurielle ≠ invariable).
#
# RÈGLE : un mot est un NOM INVARIABLE ssi il a >=1 entrée pos:"noun" ET AUCUNE de ses entrées
# noun n'expose une forme tagée "plural" distincte du singulier. Le per-sens est GRATUIT :
# la couleur invariable « abricot » est une entrée pos:"adj" — on ne regarde que les pos:"noun",
# donc le NOM « abricot » (pluriel « abricots ») ressort VARIABLE. C'est ce que Lexique ne savait pas faire.
#
# Sortie : dictee/noun_invariable.txt (un lemme déaccentué par ligne, trié) — destiné à REMPLACER
# le NOUN_PL_STOP codé en dur (12 mots) dans les 3 moteurs. Denylist défensive : la sur-inclusion
# = coût de recall (safe), la sous-inclusion = rattrapée par l'ANCRE de _pluralize_noun (FP=0 tient).
#
#   Usage : KAIKKI=/chemin/kaikki-fr.jsonl python3 dictee/build_invariable_nouns.py
import os, sys, json, io, unicodedata
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
KAIKKI = os.environ.get('KAIKKI', os.path.join(HERE, '..', 'kaikki-fr.jsonl'))
OUT = os.path.join(HERE, 'noun_invariable.txt')

def deacc(s):
    s = s.lower().replace('œ', 'oe').replace('æ', 'ae')
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
ALPHA = set("abcdefghijklmnopqrstuvwxyz")
def mono_alpha(dw):
    return len(dw) >= 3 and all(c in ALPHA for c in dw)

if not os.path.exists(KAIKKI):
    print("kaikki introuvable (%s) — voir kaikki.org/dictionary/French" % KAIKKI); sys.exit(1)

is_noun = {}    # dw -> True si >=1 entrée noun
variable = {}   # dw -> True si >=1 entrée noun avec pluriel distinct
n = 0
for line in io.open(KAIKKI, encoding='utf-8'):
    n += 1
    try: r = json.loads(line)
    except: continue
    if r.get('pos') != 'noun': continue
    w = (r.get('word') or '').strip()
    if not w: continue
    dw = deacc(w)
    if not mono_alpha(dw): continue
    is_noun[dw] = True
    for f in (r.get('forms') or []):
        tags = f.get('tags') or []
        if 'plural' in tags:
            fd = deacc((f.get('form') or '').strip())
            if fd and fd != dw and mono_alpha(fd):
                variable[dw] = True
                break

# INVARIABLE = nom SANS pluriel distinct, hors -s/x/z (déjà gérés par la règle)
inv = sorted(dw for dw in is_noun
             if not variable.get(dw) and dw[-1] not in 'sxz')
io.open(OUT, 'w', encoding='utf-8').write('\n'.join(inv) + '\n')

print('lignes kaikki : %d' % n)
print('noms uniques (déacc, mono-alpha) : %d · variables : %d · INVARIABLES (hors sxz) : %d'
      % (len(is_noun), len(variable), len(inv)))
print('écrit : %s' % OUT)
print()
print('=== VALIDATION — VARIABLES courants (doivent être ABSENTS de la liste) ===')
VAR = ['etape', 'chat', 'media', 'oeuvre', 'depart', 'minute', 'kilo', 'voiture', 'journal',
       'cheval', 'pomme', 'table', 'livre', 'maison', 'chien', 'idee', 'probleme', 'metre',
       'eleve', 'travail', 'oeil', 'ciel', 'bijou', 'cheveu']
invset = set(inv); bad = 0
for w in VAR:
    d = deacc(w); marked = d in invset
    seen = d in is_noun
    if marked: bad += 1; print('  !! %-12s marqué INVARIABLE (FAUX)  [noun=%s var=%s]' % (w, seen, variable.get(d)))
print('  -> faux invariables : %d / %d' % (bad, len(VAR)))
print()
print('=== VALIDATION — INVARIABLES connus (devraient être présents ; absents = trou de couverture) ===')
INV = ['minima', 'maxima', 'errata', 'addenda', 'quanta', 'curricula', 'stimuli', 'data',
       'veto', 'credo', 'sanctus', 'modus', 'nimbus', 'extra', 'intra', 'kanji', 'yen', 'yuan']
for w in INV:
    d = deacc(w); print('  %-12s inv=%s  (noun connu=%s, variable=%s)' % (w, d in invset, d in is_noun, variable.get(d, False)))
print()
NOUN_PL_STOP = ['minima', 'maxima', 'media', 'data', 'extra', 'intra', 'euros', 'quanta',
                'addenda', 'errata', 'curricula', 'strata']
print('=== couverture de l ancien NOUN_PL_STOP hardcodé ===')
for w in NOUN_PL_STOP:
    d = deacc(w); print('  %-12s dans la liste dérivée=%s' % (w, d in invset))
print()
print('échantillon (40) :', inv[:40])
