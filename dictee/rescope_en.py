# -*- coding: utf-8 -*-
# RE-SCOPE du lexique anglais COMMITTÉ vers ~200k mots RÉELS (« comme le français », décision Rem
# 2026-08-02). L'ancien scope (« ipa OU freq>0 OU homophone ») ne gardait que 124k — sous-dimensionné
# vs le FR (~214k). On vise la parité SANS injecter de bruit : on lit le MAÎTRE existant `lex_en.tsv`
# (901k surfaces, régénérable de kaikki mais on ne re-parse PAS les 3 Go) et on garde une surface si :
#   (a) IPA (headword kaikki transcrit)  OU  freq>0 (SUBTLEX)  OU  homophone  → « mot réel attesté », OU
#   (b) c'est une FORME FLÉCHIE d'un lemme réel (son lemma ∈ base)  → plurals/temps/comparatifs.
# ⚠️ count_1w (corpus web Google) a été ESSAYÉ puis REJETÉ (mesuré 2026-08-02) : il contient les fautes
#    d'orthographe FRÉQUENTES du web (seperate, arguement, harrass, independant…) → elles devenaient des
#    « mots connus » et le speller ne les corrigeait plus (recall 44→37). Un corpus web ≠ un dico propre.
# Mesuré recette propre : base(IPA∪freq∪homo)=124 189, +formes de lemmes réels → ~199 673. Régénère
# lex_en.tsv.gz + forms_en.tsv.gz.  Lancer : PYTHONUTF8=1 python dictee/rescope_en.py
# (build_en_lex.py applique la MÊME recette dans sa section scope — garder les deux synchrones.)
import io, os, gzip, json, sys
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
MASTER = os.path.join(HERE, 'lex_en.tsv')
FORMS  = os.path.join(HERE, 'forms_en.tsv')
HOMO   = os.path.join(HERE, 'homophones_en.json')
if not os.path.exists(MASTER):
    print('[FATAL] manquant :', MASTER, '(régénérable de kaikki via build_en_lex.py)'); sys.exit(1)

# homophones (déjà committé) : un mot avec homophone est un mot réel à garder
homo = set()
if os.path.exists(HOMO):
    d = json.load(io.open(HOMO, encoding='utf-8'))
    for k, v in d.items():
        homo.add(k.lower())
        for x in (v or []): homo.add(str(x).lower())

def _freq_pos(fq):
    try: return float(fq) > 0
    except: return False

# --- passe 1 : base = mots réels (IPA | freq | count_1w | homophone) ---
lines = []            # (ligne brute, surface, lemma)
base = set()
with io.open(MASTER, encoding='utf-8') as f:
    header = next(f).rstrip('\n')
    for ln in f:
        c = ln.rstrip('\n').split('\t')
        if len(c) < 7: continue
        surf, ipa, lemma, fq = c[0], c[2], c[3], c[6]
        lines.append((ln.rstrip('\n'), surf, lemma.lower()))
        if ipa or _freq_pos(fq) or (surf.lower() in homo):
            base.add(surf.lower())

# --- passe 2 : garde surface ∈ base OU forme fléchie d'un lemme réel (lemma ∈ base) ---
kept = set(); scoped = [header]
for (ln, surf, lemma) in lines:
    sl = surf.lower()
    if sl in base or (lemma and lemma in base):
        scoped.append(ln); kept.add(surf)

gzip.open(os.path.join(HERE, 'lex_en.tsv.gz'), 'wt', encoding='utf-8').write('\n'.join(scoped) + '\n')

# forms_en.tsv.gz : formes des lemmes retenus
scoped_forms = []
if os.path.exists(FORMS):
    with io.open(FORMS, encoding='utf-8') as f:
        for ln in f:
            lem = ln.split('\t', 1)[0]
            if lem in kept: scoped_forms.append(ln.rstrip('\n'))
    gzip.open(os.path.join(HERE, 'forms_en.tsv.gz'), 'wt', encoding='utf-8').write('\n'.join(sorted(scoped_forms)) + '\n')

sz = os.path.getsize(os.path.join(HERE, 'lex_en.tsv.gz'))
print('RE-SCOPE EN :')
print('  base (IPA|freq|homophone, sans count_1w) : %d' % len(base))
print('  lex_en.tsv.gz COMMITTÉ : %d surfaces (était ~124k) · %.2f Mo gz' % (len(scoped) - 1, sz / 1e6))
print('  forms_en.tsv.gz : %d lignes' % len(scoped_forms))
