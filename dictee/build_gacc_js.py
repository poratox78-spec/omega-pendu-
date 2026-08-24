# -*- coding: utf-8 -*-
u"""Embarque gender_acc.json (genre ACCENTUÉ, 80 610 entrées après Morphalou) dans l'app + l'extension,
pour que les 4 règles JS qui utilisent déjà `_nounGender(..., full=true)` (rPpEpithetNum, rPpAvoirCod,
rEtreInfEr, rPpEpithetFem — mêmes gardes que Python, vérifié règle par règle) en profitent enfin, comme
la référence Python le fait DÉJÀ depuis toujours (`correcteur_probe.py:1043-1044`, INCONDITIONNEL, PAS
derrière `full`). Jusqu'ici seul `_GCOLL` (le sous-ensemble « collision », ~1500 mots) atteignait le JS,
via `rule_det_gender` — c'est un site DIFFÉRENT et intentionnellement plus restrictif (pas d'antécédent
[dét+NOM] confirmé, donc la table brute y est interdite). `_GACC` ne remplace PAS `_GCOLL`, s'ajoute.

Filtre : le même que le runtime Python (correcteur_probe.py:2668, `isalpha()`) — écarte les locutions/
titres Wiktionnaire (« 100 mètres », « 2-méthylbutane »). Le filtre anti-bruit (accent XOR collision) est
DÉJÀ dans le fichier (PR#574, dictee/clean_gender_acc_noise.py) — rien à refaire ici.

Format : JSON brut (comme vdc-lex-gz, pas TSV) — plus simple, le gain de taille TSV ne vaut pas la
complexité d'un 2e format pour ~1,6 Mo.

  python3 dictee/build_gacc_js.py       # -> dictee/gacc_lex_js.json (source du blob)
  python3 dictee/inject_gacc.py         # app + extension <- gacc_lex_js.json (gzip base64)
"""
import os, sys, io, json

HERE = os.path.dirname(os.path.abspath(__file__))
GACC = os.path.join(HERE, 'gender_acc.json')
OUT = os.path.join(HERE, 'gacc_lex_js.json')


def main():
    d = json.load(open(GACC, encoding='utf-8'))
    out = {w: g for w, g in d.items() if w.isalpha() and g in ('m', 'f')}
    json.dump(out, io.open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    print(f'{len(d)} entrées brutes -> {len(out)} après filtre isalpha (identique au runtime Python)')
    print(f'écrit -> {os.path.relpath(OUT, os.path.dirname(HERE))}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
