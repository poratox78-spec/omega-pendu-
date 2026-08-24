# -*- coding: utf-8 -*-
u"""Complète la route LEXICALE du son de decompose.py avec Morphalou 3.1 — EN AJOUT PUR, jamais en
arbitrage (même patron que build_gender_acc_morphalou.py, validé PR#573/574).

LE TROU MESURÉ : W2P (dictee/decompose.py, inversion de phono_homophones.json) ne connaît QUE les
mots ayant un homophone (43 580 groupes) — pas un dictionnaire phonétique général. Sur les 170 782
mots de Lexique4, 54 298 tombent donc sur la route sublexicale (g2p, 52,4 % exact seulement),
parmi eux des mots parmi les PLUS fréquents du français (de, je, le, que, ne...), simplement parce
qu'ils n'ont pas d'homophone.

CONVERSION SAMPA (Morphalou espacé+alternates -> Lexique4 compact), dérivée et MESURÉE sur les
99 934 mots présents dans les DEUX systèmes : 82,4 % exact, 96,5 % si on compte les variantes
ouvert/fermé (o/O, e/E — divergence de transcription connue entre dictionnaires, pas une erreur).
    · 1re variante avant ' OU ' (les deux sont des prononciations attestées, on en choisit une) ;
    · schwa final (@ dernier token) = e muet -> supprimé (Lexique4 transcrit le parlé, pas l'écrit) ;
    · schwa milieu (@) -> '°' ; nasale a~/e~/o~/9~ -> '@'/'5'/'§'/'1' ; /ɲ/ (gn, J) -> 'N' ;
      /ŋ/ (ng anglicismes, N Morphalou) -> 'G' ; semi-voyelle /ɥ/ (huit/suivi, H Morphalou) -> '8'.

SORTIE : dictee/phono_morphalou.json (mot -> phono compact), consommé par decompose.py EN PLUS de
W2P — jamais à la place. Un mot déjà dans W2P (Lexique4) garde SA valeur, intouchée.

  python3 dictee/build_phon_morphalou.py
"""
import os, sys, io, json, csv

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MORPH_CSV = os.path.join(ROOT, 'data_local', 'morphalou', 'Morphalou3.1_CSV.csv')
OUT = os.path.join(HERE, 'phono_morphalou.json')

try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass


def load_w2p():
    p = os.path.join(HERE, 'phono_homophones.json')
    d = json.load(open(p, encoding='utf-8'))
    w2p = {}
    for phono, words in d.items():
        for w in words:
            w2p.setdefault(w.lower(), phono)
    return w2p


def load_morphalou_phon():
    M = {}
    if not os.path.exists(MORPH_CSV):
        return M
    with open(MORPH_CSV, encoding='utf-8', newline='') as f:
        for _ in range(14): f.readline()
        r = csv.reader(f, delimiter=';')
        next(r); next(r)
        for row in r:
            if len(row) < 18: continue
            l_graphie, l_phon = row[0], row[7]
            f_graphie, f_phon = row[9], row[16]
            if l_graphie and l_phon.strip():
                M.setdefault(l_graphie.lower(), l_phon.strip())
            if f_graphie and f_phon.strip():
                M.setdefault(f_graphie.lower(), f_phon.strip())
    return M


VOYELLES = {'a', 'e', 'E', 'i', 'o', 'O', 'u', 'y', '2', '9', '@', 'a~', 'e~', 'o~', '9~'}


def convert(morph_sampa):
    first = morph_sampa.split(' OU ')[0].strip()
    toks = [t for t in first.split(' ') if t]
    # schwa final = e muet -> Lexique4 transcrit le parlé (mattes -> mat) — SAUF si c'est l'unique
    # voyelle du mot (de/je/le/que/ne : /d°/, pas /d/ — vérifié contre Lexique4.tsv en direct, ces
    # mots courts N'ONT PAS d'homophone donc n'apparaissent jamais dans phono_homophones pour le
    # constater autrement).
    if toks and toks[-1] == '@' and any(t in VOYELLES for t in toks[:-1]):
        toks = toks[:-1]
    out = []
    for t in toks:
        t = t.replace('a~', '\x01').replace('e~', '\x02').replace('o~', '\x03').replace('9~', '\x04')
        t = t.replace('H', '8')           # /ɥ/ (huit, suivi, effectuer)
        t = t.replace('N', '\x05')        # /ŋ/ (anglicismes, lemming) — mis de côté AVANT de réutiliser N
        t = t.replace('J', 'N')           # /ɲ/ (gn)
        t = t.replace('\x05', 'G')
        t = t.replace('@', '°')           # schwa milieu de mot
        t = t.replace('\x01', '@').replace('\x02', '5').replace('\x03', '§').replace('\x04', '1')
        out.append(t)
    return ''.join(out)


def main():
    W2P = load_w2p()
    M = load_morphalou_phon()
    print(f'W2P actuel : {len(W2P)} mots · Morphalou avec phonétique : {len(M)} mots')

    ajout = {}
    for w, phon in M.items():
        if w in W2P:
            continue                       # W2P (Lexique4) intouché — Morphalou n'ajoute que du neuf
        if not w.isalpha():
            continue                       # locutions/nombres hors-scope (pas de tokenisation multi-mot ici)
        c = convert(phon)
        if not c:
            continue
        ajout[w] = c

    print(f'ajout Morphalou (mots absents de W2P) : {len(ajout)}')
    json.dump(ajout, io.open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, sort_keys=True)
    print(f'écrit -> {os.path.relpath(OUT, ROOT).replace(os.sep, "/")}')

    for w in ('de', 'je', 'le', 'que', 'ne', 'avec', 'pourquoi', 'comment', 'toujours'):
        print(f'   {w:10s} -> {ajout.get(w, "(déjà dans W2P ou non couvert)")}')


if __name__ == '__main__':
    main()
