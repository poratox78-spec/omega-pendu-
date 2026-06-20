# -*- coding: utf-8 -*-
# COGNITION Phono→Ortho (p2g) — apprend la table d'ÉMISSION « son → graphie » (l'INVERSE du g2p).
# C'est le point dur de la dyslexie : entendre un son, choisir l'orthographe (ortho non déductible
# du son : /o/ → o, au, eau, aux, eaux…). Doctrine §3 : on garde des DISTRIBUTIONS (pas d'argmax),
# la décision se fait par la jointe au décodage (p2g.py).
#
# Apprend par ALIGNEMENT (réutilise decompose.aligned_units : morceau-phono → graphie, lettres muettes
# repliées) sur le split TRAIN. Clé = (morceau-phono, phonème précédent) → distribution de graphies.
# Lancer : python3 dictee/build_p2g.py   (régénère dictee/p2g_table.json) ; mesure : python3 dictee/p2g.py --measure
import os, sys, json
from collections import defaultdict, Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import decompose as D

OUT = os.path.join(HERE, 'p2g_table.json')
MIN_COUNT = int(os.environ.get('P2G_MIN', '2'))          # élague les graphies vues < MIN_COUNT (anti-bruit)
TOPK = int(os.environ.get('P2G_TOPK', '12'))             # garde au plus TOPK graphies par clé
TRAIN_CAP = int(os.environ.get('TRAIN_CAP', '120000'))


def main():
    if not D.W2P:
        print("[p2g] phono_homophones.json absent."); return 1
    train, _ = D.inlex_split()
    train = train[:TRAIN_CAP]
    emit = defaultdict(Counter)
    for w in train:
        units = D.aligned_units(w)
        if not units:
            continue
        prev = '#'
        for i, (chunk, graph) in enumerate(units):
            fin = '1' if i == len(units) - 1 else '0'    # position FINALE (eau/ent/lettres muettes finales)
            emit[(chunk, prev, fin)][graph] += 1
            prev = chunk[-1] if chunk else prev
    table = {}; kept = 0
    for (chunk, prev, fin), cnt in emit.items():
        items = [(g, c) for g, c in cnt.most_common(TOPK) if c >= MIN_COUNT]
        if not items:
            continue
        table[chunk + '\t' + prev + '\t' + fin] = dict(items); kept += len(items)
    out = {'trained_on': len(train), 'n_keys': len(table), 'min_count': MIN_COUNT, 'table': table}
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    sz = os.path.getsize(OUT)
    print(f"[p2g] émission apprise sur {len(train)} mots TRAIN · {len(table)} clés (morceau,contexte) · "
          f"{kept} graphies → {OUT} ({sz//1024} Ko)")
    print("      mesure (held-out top-k) : python3 dictee/p2g.py --measure")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
