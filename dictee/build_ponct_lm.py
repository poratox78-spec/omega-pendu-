# -*- coding: utf-8 -*-
"""FABRIQUE L'ARTEFACT EMBARQUABLE DU CANAL TEXTE — extension/assets/ponct-lm.json.gz

POURQUOI (Rem) : « les mesures c'est bien beau mais ça nous sert pas dans l'état, faut trouver un
moyen que ça marche pour être publié sur le site ». Il a raison. Et le canal TEXTE est le seul des
trois morceaux qui soit livrable AUJOURD'HUI : **il n'a besoin d'AUCUNE ancre temporelle**, il
travaille sur le texte que Google rend, tel quel. L'audio, lui, reste coincé au mur des deux
horloges partout SAUF aux frontières de segment.

CE QUE ÇA DÉBLOQUE, concrètement : aujourd'hui la production ne pose une marque QU'AUX frontières
de segment. Or Google ne coupe qu'aux pauses >= 600 ms, donc les virgules — qui vivent vers
350 ms — sont DANS les segments, là où on ne pose rien. Le canal texte remplit ce trou sans avoir
besoin de savoir QUAND les mots ont été prononcés.

L'ÉLAGAGE, mesuré (`ponct_export_probe.py`) :
    modèle complet          2 411 124 entrées   virgule 0,270 · point 0,470
    élagué (mini 10, x1,5)     19 545 entrées   virgule 0,269 · point 0,464
**123 fois plus petit pour une perte quasi nulle.** La raison est simple et vaut d'être retenue :
un contexte dominé par « rien » ne sert à RIEN — « rien » est déjà le défaut, on n'a pas besoin
d'une entrée du modèle pour le dire. On ne garde que ce qui PRÉDIT une marque.

FORMAT : compact et lisible par le moteur JS sans dépendance —
    {"pri":[n_rien,n_virg,n_pt], "mini":10, "niv":[ {"clé":[n_rien,n_virg,n_pt], ...}, ... ]}
Les clés sont les composantes jointes par « \\u001f » (séparateur d'unité, absent des textes).
"""
import gzip
import io
import json
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

SORTIE = os.path.join('extension', 'assets', 'ponct-lm.json.gz')
MINI, MARGE = 10, 1.5          # réglage mesuré : 19 545 entrées, F1 quasi intact
SEP = ''


def main():
    import correcteur_probe as C
    from ponct_texte_probe import phrases, flux, Modele
    from ponct_export_probe import elague

    random.seed(20260805)
    P = phrases()
    if len(P) < 500:
        print('corpus insuffisant (data_local absent ?)')
        return 1
    random.shuffle(P)
    # ⚠️ On entraîne sur TOUT pour la livraison (le split train/test servait à MESURER, pas à
    # produire) — mais les chiffres annoncés restent ceux du split, jamais ceux de l'entraînement.
    M = Modele()
    n = 0
    for mots, marques in flux(P):
        M.entraine(mots, C.pos_tags(mots) or ['X'] * len(mots), marques)
        n += 1
    print('%d blocs de flux · %d entrées brutes' % (n, sum(len(x) for x in M.t)))

    garde = elague(M, {0, 1, 2, 3, 4}, MINI, MARGE)
    print('après élagage (mini=%d, marge=%.1f) : %d entrées' % (MINI, MARGE, garde))

    obj = {'pri': [M.pri[''], M.pri[','], M.pri['.']], 'mini': MINI, 'niv': []}
    for niv in range(M.NIV):
        d = {}
        for c, dd in M.t[niv].items():
            d[SEP.join(c)] = [dd[''], dd[','], dd['.']]
        obj['niv'].append(d)

    os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
    brut = json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    with gzip.open(SORTIE, 'wb', compresslevel=9) as f:
        f.write(brut)
    print('-> %s : %.0f Ko brut · %.0f Ko compressé'
          % (SORTIE, len(brut) / 1024.0, os.path.getsize(SORTIE) / 1024.0))
    print('   (repère : le tagger POS embarqué pèse 672 Ko brut / ~200 Ko en .gz)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
