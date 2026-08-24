# -*- coding: utf-8 -*-
# Injecte gacc_lex_js.json dans le bloc GZIP+base64 <script type="text/plain" id="gacc-lex-gz"> de
# l'app monolithe — pendant de inject_vdc.py, pour le genre ACCENTUÉ (gender_acc.json filtré).
# L'EXTENSION n'a PAS de blob inline (elle charge des assets/*.gz séparés, extraits de l'app par
# extension/build_assets.py) — c'est CE script qui alimente ensuite build_assets.py, pas l'inverse.
# Idempotent : crée le bloc s'il n'existe pas (1re fois), le met à jour sinon.
#     python3 dictee/build_gacc_js.py      # -> gacc_lex_js.json
#     python3 dictee/inject_gacc.py        # app <- gacc_lex_js.json (gzip)   (CE script)
#     python3 extension/build_assets.py    # extension/assets <- app (dont le nouveau bloc)
import os, re, sys, gzip, base64

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'gacc_lex_js.json')
TARGETS = [
    os.path.join(HERE, '..', 'app', 'omega-pendu.html'),
]
ANCHOR_ID = 'gdet-lex-gz'   # bloc existant juste avant lequel on insère le nouveau, 1re fois


def inject_one(path, b64):
    if not os.path.exists(path):
        print(f'[inject_gacc] {path} introuvable — ignoré'); return True
    txt = open(path, encoding='utf-8', newline='').read()
    block = '<script type="text/plain" id="gacc-lex-gz">' + b64 + '</script>'
    pat = re.compile(r'<script type="text/plain" id="gacc-lex-gz">.*?</script>', re.S)
    if pat.search(txt):
        new, n = pat.subn(lambda m: block, txt)
        if n != 1:
            print(f'[inject_gacc] {path} : {n} blocs gacc-lex-gz (attendu 1) — abandon'); return False
    else:
        anchor_pat = re.compile(r'(<script type="text/plain" id="' + ANCHOR_ID + r'">.*?</script>)', re.S)
        if not anchor_pat.search(txt):
            print(f'[inject_gacc] {path} : ni bloc gacc-lex-gz ni ancre {ANCHOR_ID} — abandon'); return False
        new, n = anchor_pat.subn(lambda m: m.group(1) + '\n' + block, txt, count=1)
        print(f'[inject_gacc] {path} : nouveau bloc créé (après {ANCHOR_ID})')
    if new == txt:
        print(f'[inject_gacc] {path} : déjà à jour'); return True
    open(path, 'w', encoding='utf-8', newline='').write(new)
    print(f'[inject_gacc] {path} : mis à jour ({len(b64)} caractères base64)')
    return True


def main():
    if not os.path.exists(SRC):
        print('[inject_gacc] gacc_lex_js.json introuvable — lance build_gacc_js.py d\'abord'); return 1
    raw = open(SRC, encoding='utf-8').read().strip()
    b64 = base64.b64encode(gzip.compress(raw.encode('utf-8'), 9)).decode('ascii')
    ok = True
    for path in TARGETS:
        ok = inject_one(path, b64) and ok
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
