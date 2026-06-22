# -*- coding: utf-8 -*-
# build_pos.py — extrait un POS-tagger (155k) du LEXIQUE EMBARQUÉ dans app/omega-pendu.html (lex4-data-gz),
# SANS le Lexique4.tsv (hors-repo). Champ `g` = cgram (NOM/VER/ADJ/ADV/…), `f` = fréquence, `nbhomog` = homographes.
#   → dictee/cgram_pos.json : { forme_déacc : [POS, freq, nbhomog] } (1 entrée/forme, la plus fréquente).
# Réutilise le décodeur de build_morpho.py (§5 anti-réinvention). Données Lexique 4 → CC BY-SA 4.0.
import os, re, base64, gzip, json, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', 'app', 'omega-pendu.html')
OUT = os.path.join(HERE, 'cgram_pos.json')


def deacc(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


def main():
    src = open(APP, encoding='utf-8').read()
    m = re.search(r'id="lex4-data-gz"[^>]*>([A-Za-z0-9+/=\s]+?)</script>', src)
    if not m:
        print("[pos] bloc lex4-data-gz introuvable"); return 2
    W = json.loads(gzip.decompress(base64.b64decode(re.sub(r'\s', '', m.group(1)))).decode('utf-8'))['words']
    pos = {}
    for w in W:
        k = deacc(w.get('m', '').lower())
        if not k or k in pos:
            continue                                   # 1re occurrence = la plus fréquente (ordre lexique)
        pos[k] = [w.get('g', ''), round(w.get('f', 0.0), 2), w.get('nbhomog', 0)]
    json.dump(pos, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f"[pos] {len(pos)} formes → {OUT}  ({os.path.getsize(OUT)//1024} Ko)")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
