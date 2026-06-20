# -*- coding: utf-8 -*-
# BOUCLE DESCENDANTE pour le décomposeur : apprend une table de correction du g2p sublexical
# par ALIGNEMENT (graphème↔phonème) contre la vérité-terrain Lexique (phono_homophones.json),
# sur le split TRAIN seulement (la mesure se fait en HELD-OUT — cf. decompose.measure()).
#
# Principe (façon descending_probe.py, data-bound) : pour chaque mot in-lexique du TRAIN,
#   1. g2p(mot) → graphèmes + phonème SAMPA prédit (RAW, sans correction) ;
#   2. alignement MONOTONE (DP) du phono prédit sur le phono gold → chaque graphème reçoit son
#      « morceau » gold (0..3 caractères) ;
#   3. on tabule, par clé (graphème, caractère-suivant), la distribution des morceaux gold.
# La règle (g,next)→morceau est RETENUE si support ≥ MIN_SUPPORT et pureté ≥ PURITY (garde-fou FP).
# Mesuré net-positif en held-out (~+2 pts d'exactitude sur le SEG déjà enrichi). Inerte tant que non lancé.
#
# Lancer : python3 dictee/build_g2p_corrections.py   (régénère dictee/g2p_corrections.json)
import os, sys, json
from collections import defaultdict, Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import decompose as D                                    # réutilise g2p enrichi, ipa_to_sampa, W2P, _lev, inlex_split

OUT = os.path.join(HERE, 'g2p_corrections.json')
MIN_SUPPORT = int(os.environ.get('MIN_SUPPORT', '20'))   # nb mini d'observations pour retenir une règle
PURITY = float(os.environ.get('PURITY', '0.75'))         # part mini du morceau majoritaire (anti-bruit)
TRAIN_CAP = int(os.environ.get('TRAIN_CAP', '80000'))    # plafond d'apprentissage (runtime)


def main():
    if not D.W2P:
        print("[corr] phono_homophones.json absent — rien à apprendre."); return 1
    train, _ = D.inlex_split()
    train = train[:TRAIN_CAP]
    counts = defaultdict(Counter)
    for w in train:
        S = D.steps_of(w); chunks = D.align_chunks([s[2] for s in S], D.W2P[w])  # helpers partagés (decompose)
        for (g, nxt, _), ch in zip(S, chunks):
            counts[(g, nxt)][ch] += 1
    table = {}; kept = dropped = 0
    for (g, nxt), cnt in counts.items():
        tot = sum(cnt.values()); ch, c = cnt.most_common(1)[0]
        if tot >= MIN_SUPPORT and c / tot >= PURITY:
            table[g + '\t' + nxt] = ch; kept += 1
        else:
            dropped += 1
    out = {'min_support': MIN_SUPPORT, 'purity': PURITY, 'trained_on': len(train),
           'n_keys_seen': kept + dropped, 'table': table}
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f"[corr] appris sur {len(train)} mots TRAIN · {kept} règles retenues "
          f"(support≥{MIN_SUPPORT}, pureté≥{PURITY}) / {kept+dropped} clés vues → {OUT}")
    print("       mesure en held-out : python3 dictee/decompose.py --measure")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
