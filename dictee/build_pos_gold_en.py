#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build_pos_gold_en.py — l'OR du tagger anglais, committé : dictee/pos_en_gold.tsv (UD English-PUD, UPOS annoté à la main).

POURQUOI. Le tagger anglais est le PLAFOND de toute règle de contexte (homophones, accords, vrais mots : le lexique
sur-verbifie, c'est le tagger qui tranche). Son exactitude n'était mesurée qu'en local (data_local/en/en_pud-ud-test.conllu) :
une régression du modèle ou d'une post-passe ne rougissait rien en CI. Le texte de PUD est déjà committé (parity_en_corpus.txt,
CC BY-SA 3.0) ; ses étiquettes le sont désormais aussi, au même titre.

FORMAT : « mot<TAB>UPOS » par ligne, ligne vide entre les phrases, « # » = commentaire. Les tokens composés (« don't » ->
do n't) et les nœuds vides du CoNLL-U sont écartés comme dans la sonde ; la ponctuation est GARDÉE (la sonde l'exclut du score,
mais le tagger la voit en contexte).

  PYTHONUTF8=1 python dictee/build_pos_gold_en.py            # (ré)écrit le TSV depuis data_local
  python dictee/build_pos_gold_en.py --check                 # CI : le TSV committé est complet (≥ 900 phrases, ≥ 18 000 tokens) ;
                                                             #      avec data_local présent, identique à ce qu'on regénérerait
"""
import io, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'data_local', 'en', 'en_pud-ud-test.conllu')
OUT = os.path.join(HERE, 'pos_en_gold.tsv')
ENTETE = ('# UD English-PUD (test), UPOS annoté à la main — CC BY-SA 3.0, https://github.com/UniversalDependencies/UD_English-PUD\n'
          '# Bâti par dictee/build_pos_gold_en.py ; lu par dictee/pos_en_exactitude_probe.js (--check : plancher d\'exactitude en CI).\n'
          '# mot<TAB>UPOS, ligne vide entre les phrases ; tokens composés et nœuds vides écartés.\n')

def depuis_conllu(path):
    lignes = []; cur = 0
    for l in io.open(path, encoding='utf-8'):
        l = l.rstrip('\n')
        if not l:
            if cur: lignes.append(''); cur = 0
            continue
        if l[0] == '#': continue
        c = l.split('\t')
        if len(c) < 5 or '-' in c[0] or '.' in c[0]: continue
        lignes.append(c[1] + '\t' + c[3]); cur += 1
    if cur: lignes.append('')
    return ENTETE + '\n'.join(lignes) + '\n'

def main():
    if '--check' in sys.argv:
        bad = []
        if not os.path.exists(OUT): bad.append('pos_en_gold.tsv absent')
        else:
            s = io.open(OUT, encoding='utf-8').read()
            corps = [l for l in s.split('\n') if l and l[0] != '#']
            phrases = s.count('\n\n'); tokens = len(corps)
            if phrases < 900: bad.append('%d phrases < 900' % phrases)
            if tokens < 18000: bad.append('%d tokens < 18 000' % tokens)
            if any(len(l.split('\t')) != 2 for l in corps): bad.append('lignes mal formées')
            if os.path.exists(SRC) and depuis_conllu(SRC) != s: bad.append('le TSV committé diffère de data_local (à regénérer)')
        for b in bad: print('  ✗ ' + b)
        print('✗ or du tagger EN : %d écart(s)' % len(bad) if bad else '✓ or du tagger EN : pos_en_gold.tsv complet (%d phrases, %d tokens)%s'
              % (phrases, tokens, '' if os.path.exists(SRC) else ' — data_local absent, contenu non recomparé'))
        sys.exit(1 if bad else 0)
    if not os.path.exists(SRC): print('data_local/en/en_pud-ud-test.conllu absent'); sys.exit(1)
    s = depuis_conllu(SRC)
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write(s)
    print('pos_en_gold.tsv écrit : %d phrases, %d tokens' % (s.count('\n\n'), len([l for l in s.split('\n') if l and l[0] != '#'])))

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
