# -*- coding: utf-8 -*-
# PHON_TO_LETTERS ANGLAIS (phonème IPA -> lettres probables) — la « décompose EN » en données : l'INVERSE
# du g2p. Le moteur du pendu (route M4_PHON_USE_P, ON dans la config) lit w.p caractère par caractère et
# fait PHON_TO_LETTERS[char] pour un prior phon->lettre. La table de l'app est en SAMPA FRANÇAIS (R,S,Z,@,
# §,5,2,9,8…) ; le p anglais est en IPA (ʌ,ɪ,θ,ŋ,ɹ,ʃ…) → clés qui ne matchent pas → prior MORT en anglais
# (le moteur `if(!dist)continue` saute). On régénère la table en IPA, data-driven : on aligne chaque mot
# attesté (g2p_en_steps : graphème↔phonème) et on tally, pour chaque CARACTÈRE IPA, les lettres du graphème
# qui le produisent. Sortie : phon2letters_en.json  (consommé par build_pendu_en.py). Zéro français.
#   Lancer : PYTHONUTF8=1 python dictee/build_phon2letters_en.py
import gzip, io, os, sys, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from g2p_en_apply import g2p_en_steps
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
LEX = os.path.join(HERE, 'lex_en.tsv.gz')
OUT = os.path.join(HERE, 'phon2letters_en.json')

# on IGNORE l'accent tonique et les points syllabiques dans le tally (ils apparaissent dans w.p mais le
# moteur les saute déjà : pas de lettre associée)
IGNORE = set("ˈˌ.ˑ ‖|")
tally = collections.defaultdict(collections.Counter)
nwords = 0
with gzip.open(LEX, 'rt', encoding='utf-8') as f:
    f.readline()
    for line in f:
        c = line.rstrip('\n').split('\t')
        if len(c) < 7: continue
        w = c[0]
        if not (w.isalpha() and w.isascii()): continue
        try: fr = int(c[6])
        except ValueError:
            try: fr = int(float(c[6]))
            except ValueError: fr = 0
        if fr <= 0: continue                                  # attestés seulement (comme le n-gramme, #347)
        nwords += 1
        for (g, ph) in g2p_en_steps(w):
            if not ph: continue
            letters = [ch.upper() for ch in g if 'a' <= ch <= 'z']
            if not letters: continue
            for pch in ph:                                     # chaque CARACTÈRE IPA du bloc phonémique
                if pch in IGNORE: continue
                for L in letters:                             # crédite les lettres du graphème qui le produit
                    tally[pch][L] += 1

# normalise : garde les lettres ≥ 5 % (ou top-6), renormalise, arrondi 2 décimales
p2l = {}
for pch, ctr in tally.items():
    tot = sum(ctr.values())
    if tot < 5: continue                                      # phonème trop rare pour une stat fiable
    ranked = sorted(ctr.items(), key=lambda kv: -kv[1])
    kept = [(L, n) for (L, n) in ranked if n / tot >= 0.05][:6]
    if not kept: kept = ranked[:1]
    s = sum(n for _, n in kept)
    p2l[pch] = {L: round(n / s, 3) for (L, n) in kept}

io.open(OUT, 'w', encoding='utf-8').write(json.dumps(p2l, ensure_ascii=False, sort_keys=True))
print('phon2letters_en.json : %d phonèmes IPA (sur %d mots attestés)' % (len(p2l), nwords))
for k in ['ʌ', 'ɪ', 'i', 'æ', 'ɑ', 'ɔ', 'ə', 'ɚ', 'θ', 'ð', 'ŋ', 'ɹ', 'ʃ', 'ʒ', 'k', 's', 'e', 'o', 'a']:
    if k in p2l: print('  %-3s -> %s' % (k, p2l[k]))
