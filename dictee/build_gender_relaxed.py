# -*- coding: utf-8 -*-
# Génère cgram_gender_relaxed.json : noms genrés (cgram_gender) MOINS les adjectifs (POS 'A', épicènes inclus).
# But : le correcteur (rule_det_gender) doit attraper « le voiture→la » (noms VERBE-homographes que le sous-ensemble
# « gn » excluait par prudence) SANS FP sur les adjectifs épicènes (« sa jeune fille » : jeune = adj épicène, pas dans
# cgram_adj). Les adjectifs (variables ET épicènes) viennent du tag POS 'A' du speller-lex embarqué dans l'app.
# Source unique pour le probe Python ET l'app (parité). Données dérivées Lexique 4 → CC BY-SA 4.0.
#   python3 dictee/build_gender_relaxed.py
import os, re, json, base64, gzip, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', 'app', 'omega-pendu.html')
GENDER = os.path.join(HERE, 'cgram_gender.json')
OUT = os.path.join(HERE, 'cgram_gender_relaxed.json')


def deac(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


def adjectives_from_speller():
    """Set des adjectifs (POS 'A', épicènes inclus) extraits du bloc speller-lex-gz de l'app."""
    src = open(APP, encoding='utf-8').read()
    m = re.search(r'id="speller-lex-gz"[^>]*>([A-Za-z0-9+/=\s]+?)</script>', src)
    if not m:
        raise SystemExit("speller-lex-gz introuvable dans l'app")
    raw = gzip.decompress(base64.b64decode(re.sub(r'\s', '', m.group(1)))).decode('utf-8')
    A = set()
    for line in raw.split('\n'):
        f = line.split('\t')
        if len(f) > 2 and 'A' in f[2]:
            A.add(deac(f[0].lower()))
    return A


def main():
    if not (os.path.exists(GENDER) and os.path.exists(APP)):
        print("cgram_gender.json ou app introuvable"); return 1
    ADJ = adjectives_from_speller()
    G = json.load(open(GENDER, encoding='utf-8'))
    out = {w: g for w, g in G.items()
           if g in ('m', 'f') and w.isalpha() and w not in ADJ}     # noms genrés − adjectifs (POS A)
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    print(f"[gender-relaxed] {len(G)} noms cgram_gender − {len(ADJ)} adjectifs (POS A) → {len(out)} noms purs → {OUT}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
