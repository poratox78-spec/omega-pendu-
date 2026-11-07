# -*- coding: utf-8 -*-
u"""Liste n° 399 : les chances de faute PAR LETTRE, tirées du corpus PUBLIC WiCoPaCo (Max & Wisniewski 2010, corrections de Wikipédia),
pour le 8e trait du juge léger (« lettres probables », dictee/juge_lex.js et _jgLet dans dys-core.js).
Paires de non-mots à UNE édition près, sans accents : quelle lettre est oubliée (d), ajoutée (i), mise pour une autre (s), deux lettres
inversées (t). « dd » / « ii » : la lettre oubliée ou ajoutée fait partie d'une lettre double ; « $ » : en fin de mot.
  P(édition) = (compte + 10 × taux moyen de sa sorte) / (places où elle pouvait arriver + 10) ; valeur = ln P − moyenne de ln P sur les fautes vues,
  bornée à [−4, 4] : 0 = une faute aussi courante que la moyenne, > 0 plus courante, < 0 plus rare. Absente de la table = −4.
  python -I dictee/juge_lettres.py <wicopaco_pairs.jsonl> dictee/juge_lettres.json"""
import collections, io, json, math, sys, unicodedata
sys.stdout.reconfigure(encoding='utf-8')
SRC, OUT = sys.argv[1:3]
AZ = 'abcdefghijklmnopqrstuvwxyz'
def deacc(s): return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').replace('œ', 'oe').replace('æ', 'ae')
occ, occf, occ2, ed = collections.Counter(), collections.Counter(), collections.Counter(), collections.Counter()
def une(b, g):
    if len(b) == len(g) - 1:
        for i in range(len(g)):
            if g[:i] + g[i + 1:] == b:
                x = g[i]; dbl = (i > 0 and g[i - 1] == x) or (i + 1 < len(g) and g[i + 1] == x)
                return ('dd:' if dbl else 'd:') + x + ('$' if i == len(g) - 1 else '')
    elif len(b) == len(g) + 1:
        for i in range(len(b)):
            if b[:i] + b[i + 1:] == g:
                x = b[i]; dbl = (i > 0 and b[i - 1] == x) or (i + 1 < len(b) and b[i + 1] == x)
                return ('ii:' if dbl else 'i:') + x + ('$' if i == len(b) - 1 else '')
    elif len(b) == len(g):
        df = [i for i in range(len(b)) if b[i] != g[i]]
        if len(df) == 1: return 's:' + b[df[0]] + '>' + g[df[0]]
        if len(df) == 2 and df[1] == df[0] + 1 and b[df[0]] == g[df[1]] and b[df[1]] == g[df[0]]: return 't:' + g[df[0]] + g[df[1]]
    return None
npaires = 0
for l in io.open(SRC, encoding='utf-8'):
    d = json.loads(l)
    if d.get('type') != 'non_word_error': continue
    b, g = deacc(d['bad'].lower()), deacc(d['good'].lower())
    if b == g or not all(c in AZ for c in b + g) or not b or not g: continue
    npaires += 1
    for c in g: occ[c] += 1
    occf[g[-1]] += 1
    for i in range(len(g) - 1): occ2[g[i:i + 2]] += 1
    k = une(b, g)
    if k: ed[k] += 1
def base(k):   # les places où l'édition pouvait arriver : la lettre voulue (d, dd, s), la lettre doublée (ii), la paire (t) ; une lettre ajoutée seule (i) peut arriver partout
    t, x = k.split(':', 1)
    if t == 't': return occ2[x]
    if t == 's': return occ[x[-1]]
    if t == 'i': return npaires if x.endswith('$') else sum(occ.values())
    return occf[x[0]] if x.endswith('$') else occ[x[0]]
cles = [p + x + f for p in ('d:', 'dd:', 'i:', 'ii:') for x in AZ for f in ('', '$')] + ['s:' + a + '>' + b for a in AZ for b in AZ if a != b] + ['t:' + a + b for a in AZ for b in AZ if a != b]
sorte = lambda k: k.split(':')[0] + ('$' if k.endswith('$') else '')
# Lissage : une lettre rare (base petite) tire vers la moyenne de sa sorte d'édition (A = 10 observations fictives), pas vers 0,5.
num, den = collections.Counter(), collections.Counter()
for k in cles: num[sorte(k)] += ed[k]; den[sorte(k)] += base(k)
A = 10
P = lambda k: (ed[k] + A * max(0.5, num[sorte(k)]) / max(1, den[sorte(k)])) / (base(k) + A)
n = sum(ed.values()); ref = sum(c * math.log(P(k)) for k, c in ed.items()) / n
v = {}
for k in cles:
    x = round(max(-4.0, min(4.0, math.log(P(k)) - ref)), 2)
    if x > -4.0: v[k] = x
json.dump({'source': 'WiCoPaCo (Max & Wisniewski 2010), paires de non-mots à une édition près, sans accents', 'paires': npaires, 'editions': n, 'v': v},
          io.open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('paires', npaires, '| éditions simples', n, '| sortes vues', len(ed), '| clés gardées', len(v), '/', len(cles), '| réf %.3f' % ref)
for k, c in ed.most_common(12): print('  %-8s %6d  %+.2f' % (k, c, v.get(k, -4)))
