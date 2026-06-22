#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Génère cgram_noun_post.json — POSTERIOR §3 sur la lecture POS latente, par forme :

    P(POS | forme) = Σ FreqMot(lectures de cette POS) / Σ FreqMot(toutes lectures)

depuis Lexique4.tsv (1 ligne par lecture ortho×cgram, col. 1_Mot / 5_Cgram / 10_FreqMot).
Sert la GARDE §3 du pluriel du nom (remplace la garde binaire nbhomog==0 ∧ POS==NOM,
qui ratait ami/voiture/faute parce qu'elle lisait UN tag POS dur — souvent FAUX :
le POS embarqué dit amis=ADJ, pommes/faute=VER, alors que la fréquence dit 85-99 % NOM).

Sortie : { forme_déacc : [nom‰, ver‰] }  (parts NOM et VER en pour-mille, entiers 0..1000),
restreint aux formes nom‰ ≥ ANCHOR_MILLE (pluralisables OU formes-pluriel d'ancrage).
Dérivé CC BY-SA 4.0 (Lexique 4). Régénérer : LEX4=/tmp/lex4/Lexique4.tsv python3 dictee/build_noun_post.py
"""
import os, sys, json, collections

HERE = os.path.dirname(os.path.abspath(__file__))
TSV  = os.environ.get('LEX4', '/tmp/lex4/Lexique4.tsv')
OUT  = os.path.join(HERE, 'cgram_noun_post.json')
ANCHOR_MILLE = 300            # ne garde que les formes ≥30 % NOM (ancre/gate du pluriel ; le reste n'est jamais pluralisé ici)

def deacc(s):
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def main():
    if not os.path.isfile(TSV):
        print(f"[noun_post] Lexique4 introuvable ({TSV}) — déposer le TSV à /tmp/lex4 ou LEX4=… ; skip.")
        sys.exit(0)
    freq = collections.defaultdict(lambda: collections.defaultdict(float))   # forme -> {cgram: Σ FreqMot}
    with open(TSV, encoding='utf-8') as f:
        f.readline()
        for line in f:
            c = line.rstrip('\n').split('\t')
            if len(c) < 10: continue
            try: fm = float(c[9])
            except ValueError: fm = 0.0
            freq[deacc(c[0].lower())][c[4]] += fm
    post = {}
    for w, d in freq.items():
        tot = sum(d.values())
        if tot <= 0: continue
        nom = round(1000 * d.get('NOM', 0.0) / tot)
        if nom < ANCHOR_MILLE: continue                  # ni pluralisable ni ancre → inutile
        ver = round(1000 * d.get('VER', 0.0) / tot)
        post[w] = [nom, ver]
    json.dump(post, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    print(f"[noun_post] {len(post)} formes (nom‰≥{ANCHOR_MILLE}) → {OUT}")
    # contrôle : les cas qui résistaient le matin
    for w in ['ami', 'amis', 'voiture', 'faute', 'fautes', 'pomme', 'livre', 'porte', 'rouge', 'enfant']:
        print(f"   {w:9} {post.get(deacc(w), '— (hors set)')}")

if __name__ == '__main__':
    main()
