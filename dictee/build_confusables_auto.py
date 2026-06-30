# -*- coding: utf-8 -*-
# PROBE : génère des CANDIDATS confusables depuis NOS données (phono_homophones.json = groupes d'homophones dérivés de
# Lexique 4, CC BY-SA) — license-clean, zéro dépendance externe. Filtre : fréquence (speller) + POS contenu + anti-flexion
# (même lemme) + anti-mots-outils + taille. Rapporte le NOMBRE et un ÉCHANTILLON pour juger la qualité AVANT d'embarquer.
#   Usage : python3 dictee/build_confusables_auto.py [freqmin]
import json, gzip, unicodedata, sys, os
HERE = os.path.dirname(__file__)
FREQMIN = int(sys.argv[1]) if len(sys.argv) > 1 else 150

def deacc(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').lower()
def stem(w):                      # flexion légère : nombre (s/x) + féminin (e) → détecte "même lemme"
    w = deacc(w)
    if w.endswith(('s', 'x')) and len(w) > 3: w = w[:-1]
    if w.endswith('e') and len(w) > 3: w = w[:-1]
    return w

homo = json.load(open(os.path.join(HERE, 'phono_homophones.json'), encoding='utf-8'))   # {SAMPA: [graphies]}
FREQ, POS = {}, {}
for l in gzip.open(os.path.join(HERE, '..', 'extension', 'assets', 'speller.tsv.gz'), 'rt', encoding='utf-8'):
    p = l.rstrip('\n').split('\t')
    if len(p) >= 3:
        FREQ[p[0]] = int(p[1]); POS[p[0]] = p[2]

# mots-outils + homophones GRAMMATICAUX (gérés en rouge / trop bruyants en vert) → exclus
STOP = set("""a à as ai aie aies ait es est et ou où on ont son sont ce se ces ses c s'est sais sait sai
la là l le les un une des du de d en y ne n me te se je tu il ils elle elles nous vous leur leurs
mais mes met mets m'est ma mon ton ta tes sa au aux ce cet cette si oui non que qui quoi dont
peu peut peux quel quelle quels quelles quand quant sans dans plus tout tous toute toutes
ni car or donc mais ainsi puis tres très trop bien comme cela ceci ça sur sous pour par avec
quel'que qu il'y j'ai""".split())

cur = set()
try:
    c = json.load(open(os.path.join(HERE, 'confusables.json'), encoding='utf-8'))
    for g in c['groups']:
        for f in g['forms']: cur.add(deacc(f))
except Exception:
    pass

cands = []
for sampa, words in homo.items():
    ws = [w for w in set(words) if w.isalpha() or "'" in w or '-' in w]
    # garde les graphies COMMUNES (fréquentes) et de contenu (N/A/V/ADV), non mots-outils
    keep = []
    for w in ws:
        d = deacc(w)
        if d in STOP: continue
        if len(d) < 3: continue
        f = FREQ.get(d, 0); ps = POS.get(d, '')
        if f < FREQMIN: continue
        if ps and ps not in ('N', 'A', 'V', 'J', 'D', 'R', 'W', 'G'):  # exclut pronoms/conj/det fonctionnels si tag dispo
            pass
        keep.append((w, f, ps))
    if len(keep) < 2: continue
    # un confusable lexical = ≥2 LEMMES distincts dont au moins 2 portent du NOM/ADJECTIF (sinon = famille de conjugaison)
    content_stems = {stem(w) for (w, f, p) in keep if ('N' in p or 'A' in p)}
    if len(content_stems) < 2: continue               # vire les familles de verbes (dit/dis/dît…)
    if any(deacc(w) in cur for (w, f, p) in keep): continue   # déjà dans la liste curée
    if len(keep) > 5: continue                        # trop gros = bruit
    # ne garde qu'une graphie par stem (la plus fréquente) pour un affichage propre
    best = {}
    for (w, f, p) in sorted(keep, key=lambda x: -x[1]):
        s = stem(w)
        if s not in best: best[s] = (w, f, p)
    rep = sorted(best.values(), key=lambda x: -x[1])
    if len(rep) < 2: continue
    cands.append(rep)

cands.sort(key=lambda g: -sum(f for (_, f, _) in g))
print("freqmin=%d · %d groupes candidats (≥2 lemmes distincts, fréquents, hors mots-outils, hors curés)\n" % (FREQMIN, len(cands)))
for g in cands[:45]:
    print("   " + ' / '.join('%s(%d,%s)' % (w, f, p or '?') for (w, f, p) in g))
