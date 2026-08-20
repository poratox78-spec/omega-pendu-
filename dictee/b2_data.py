# -*- coding: utf-8 -*-
u"""B2 — préparation du corpus BRUT (la langue) pour le petit modèle maison.
Source : la même que le ponct-lm (UD + exemples d'usage du Wiktionnaire kaikki, ~695k phrases,
déjà sur disque — AUCUN téléchargement). Held-out EXCLUS : les phrases de fp_scale (banc FATIGUE).
Les bancs REEL/GEN (dictées ASEI) ne peuvent pas fuiter : ce sont des textes dys, pas du wikt.
  python dictee/b2_data.py  →  data_local/b2_train.txt (+ b2_dev.txt 1 %)"""
import os, sys, io, re, random

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from ponct_texte_probe import phrases

TOK = re.compile(u"[a-zA-Zà-ÿœæ'\\-]+")
def norm(s):
    return ' '.join(w.lower() for w in TOK.findall(s.replace(u'’', "'")))

def main():
    fp = set()
    for l in io.open(os.path.join(HERE, 'fp_scale_corpus.txt'), encoding='utf-8'):
        if l.strip(): fp.add(norm(l))
    P = phrases(limite_wikt=10**9)
    random.seed(20260821)
    random.shuffle(P)
    train, dev, exclus = [], [], 0
    for i, s in enumerate(P):
        if norm(s) in fp: exclus += 1; continue
        (dev if i % 100 == 0 else train).append(s)
    with io.open(os.path.join(ROOT, 'data_local', 'b2_train.txt'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(train))
    with io.open(os.path.join(ROOT, 'data_local', 'b2_dev.txt'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(dev))
    mo = sum(len(s) for s in train) / 1e6
    print(u'train %d phrases (%.1f Mchars) · dev %d · held-out fp exclus %d' % (len(train), mo, len(dev), exclus))

if __name__ == '__main__':
    main()
