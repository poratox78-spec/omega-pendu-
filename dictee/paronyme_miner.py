# -*- coding: utf-8 -*-
# PROBE PARONYMES : paires de mots à 1 ÉDITION (substitution/insertion/suppression d'1 lettre) = confusables VISUELS
# (≠ homophones sonores). Source 100 % maison : graphies accentuées de phono_homophones.json (Lexique CC BY-SA),
# fréquence + POS de cgram_pos.json. Filtres : fréquent, mot de CONTENU (NOM/ADJ/VER/ADV), anti-flexion (même lemme),
# hors mots-outils, hors liste curée. Rapporte NOMBRE + ÉCHANTILLON pour curer à la main (comme les homophones).
#   Usage : python3 dictee/paronyme_miner.py [freqmin]      (freqmin en occurrences/million, défaut 2.0)
import json, unicodedata, sys, os
HERE = os.path.dirname(__file__)
FREQMIN = float(sys.argv[1]) if len(sys.argv) > 1 else 2.0
CONTENT = {'NOM', 'ADJ', 'VER', 'ADV'}

def deacc(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').lower()

POSF = json.load(open(os.path.join(HERE, 'cgram_pos.json'), encoding='utf-8'))     # déacc -> [POS, freq, nbhomog]
homo = json.load(open(os.path.join(HERE, 'phono_homophones.json'), encoding='utf-8'))

# liste de mots ACCENTUÉS fréquents et de contenu (graphie accentuée depuis phono ; freq/POS via déacc)
words = {}
for sampa, forms in homo.items():
    for w in forms:
        lw = w.lower()
        if len(lw) < 3 or not all(c.isalpha() for c in lw): continue
        info = POSF.get(deacc(lw))
        if not info: continue
        pos, freq = info[0], info[1]
        if pos not in CONTENT or freq < FREQMIN: continue
        if lw not in words or freq > words[lw][1]: words[lw] = (pos, freq)
print("mots accentués, contenu, freq≥%.1f : %d" % (FREQMIN, len(words)))

def edit_le1(a, b):                       # distance d'édition exactement 1 ?
    if a == b: return False
    la, lb = len(a), len(b)
    if la == lb:                          # substitution
        return sum(x != y for x, y in zip(a, b)) == 1
    if abs(la - lb) != 1: return False
    if la > lb: a, b = b, a               # a = plus court
    i = 0
    while i < len(a) and a[i] == b[i]: i += 1
    return a[i:] == b[i + 1:]             # insertion/suppression d'1 lettre

# SymSpell : bucket par variantes delete-1 → les paires d'un même bucket sont à ≤2 éditions, on vérifie ==1
buckets = {}
for w in words:
    keys = {w} | {w[:i] + w[i + 1:] for i in range(len(w))}
    for k in keys: buckets.setdefault(k, []).append(w)

cur = set()
try:
    for g in json.load(open(os.path.join(HERE, 'confusables.json'), encoding='utf-8'))['groups']:
        for f in g['forms']: cur.add(deacc(f))
except Exception: pass

def same_lemma(a, b):                     # flexion (pluriel/féminin) du même mot → pas une confusion
    da, db = deacc(a), deacc(b)
    s, l = sorted([da, db], key=len)
    return l == s + 's' or l == s + 'x' or l == s + 'e' or l == s + 'es'

seen, pairs = set(), []
for k, ws in buckets.items():
    if len(ws) < 2: continue
    for i in range(len(ws)):
        for j in range(i + 1, len(ws)):
            a, b = ws[i], ws[j]
            key = tuple(sorted((a, b)))
            if key in seen: continue
            seen.add(key)
            if not edit_le1(a, b): continue
            if same_lemma(a, b): continue
            if deacc(a) in cur or deacc(b) in cur: continue
            fa, fb = words[a][1], words[b][1]
            pairs.append((a, b, words[a][0], words[b][0], min(fa, fb)))

pairs.sort(key=lambda p: -p[4])           # tri par fréquence du membre le plus rare (les plus « utiles » d'abord)
print("paires à 1 édition (contenu, hors flexions, hors curés) : %d\n" % len(pairs))
for a, b, pa, pb, f in pairs[:60]:
    print("   %-16s / %-16s  (%s/%s, min=%.1f)" % (a, b, pa, pb, f))
