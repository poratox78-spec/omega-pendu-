# -*- coding: utf-8 -*-
# Substrat ANGLAIS du moteur du pendu cognitif (app/omega-pendu.html) — équivalent du lex4-data FR.
# Produit le bloc OMEGA_LEX4 attendu par loadOmegaLex4() : { version, source, n_words, words:[{m,p,l,f,
# old,pld,g}], len_index:{"7":[i,...],...} }. Le moteur lit surtout m (mot), p (phono), f (fréquence) ;
# old/pld (distances de voisinage) secondaires -> 0 (null-safe). Colonnes psycholinguistiques FR non
# reproduites (le mode cheat-free par défaut ne les lit pas ; les modes phon ORANGE sont spécifiques FR).
#   + LETTER_FREQ_EN : fréquences de lettres anglaises (remplace LETTER_FREQ_FR en dur dans l'app).
# Sorties : lex4_en.json.gz (données, gitignoré) + lex4_en.b64 (embarquable) + letter_freq_en.json + stats.
#   Lancer : PYTHONUTF8=1 python dictee/build_lex4_en.py
import gzip, json, os, sys, base64, collections
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
LEX = os.path.join(HERE, 'lex_en.tsv.gz')
MINLEN, MAXLEN = 7, 15                                  # comme le pendu FR (mot à deviner >= 7 lettres)

words = []
letter_tot = collections.Counter(); letter_wtot = 0.0
with gzip.open(LEX, 'rt', encoding='utf-8') as f:
    f.readline()
    for line in f:
        c = line.rstrip('\n').split('\t')
        if len(c) < 7: continue
        w = c[0]
        if not w.isalpha() or not w.isascii(): continue           # a-z pur
        if not (MINLEN <= len(w) <= MAXLEN): continue
        try: fr = int(c[6])
        except ValueError: fr = 0
        if fr <= 0: continue                                       # vocabulaire réel (fréquence SUBTLEX > 0)
        m = w.upper()
        words.append({'m': m, 'p': c[2] or '', 'l': len(w), 'f': fr, 'old': 0, 'pld': 0, 'g': c[5] or ''})
        # fréquences de lettres pondérées par la fréquence du mot (comme LETTER_FREQ_FR = usage réel)
        for ch in w:
            letter_tot[ch] += fr; letter_wtot += fr

words.sort(key=lambda x: -x['f'])                                  # plus fréquents d'abord (comme Lexique)
len_index = collections.defaultdict(list)
for i, wd in enumerate(words):
    len_index[str(wd['l'])].append(i)

obj = {'version': 'en-v1', 'source': 'lex_en (kaikki + SUBTLEX)', 'n_words': len(words),
       'words': words, 'len_index': dict(len_index)}
raw = json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
gz = gzip.compress(raw, 9)
b64 = base64.b64encode(gz)
open(os.path.join(HERE, 'lex4_en.json.gz'), 'wb').write(gz)
open(os.path.join(HERE, 'lex4_en.b64'), 'wb').write(b64)

# LETTER_FREQ_EN normalisé (somme = 1), 26 lettres
LF = {ch: round(letter_tot.get(ch, 0) / (letter_wtot or 1), 6) for ch in 'abcdefghijklmnopqrstuvwxyz'}
open(os.path.join(HERE, 'letter_freq_en.json'), 'w', encoding='utf-8').write(
    json.dumps(LF, ensure_ascii=False, indent=0))

print('=== lex4_en ===')
print('  mots (7-15 lettres, freq>0) : %d' % len(words))
print('  brut %.2f Mo · gzip %.2f Mo · base64 (embarqué) %.2f Mo' % (len(raw)/1e6, len(gz)/1e6, len(b64)/1e6))
dist = collections.Counter(w['l'] for w in words)
print('  par longueur :', {k: dist[k] for k in sorted(dist)})
top = sorted(LF.items(), key=lambda x: -x[1])[:8]
print('  LETTER_FREQ_EN top-8 :', [(k, round(v*100, 1)) for k, v in top])
print('  ex mots fréquents :', [w['m'] for w in words[:12]])
