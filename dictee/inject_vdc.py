# -*- coding: utf-8 -*-
# Injecte cgram_hf.json (verbes + genre + noms purs + adjectifs + CONJUGAISON) dans le bloc GZIP+base64
# <script type="text/plain" id="vdc-lex-gz"> de l'app monolithe (#30 : −3,93 Mo d'embed vs le JSON en clair).
# Le JS charge en ASYNC via loadVdcLex (DecompressionStream), comme speller-lex-gz / noun-post-gz.
#     python3 dictee/build_cgram.py        # (LEX4) → cgram_hf.json (+ cgram_conj.json complet = Bescherelle)
#     python3 dictee/inject_vdc.py         # app ← cgram_hf.json (gzip)   (CE script)
#     python3 extension/build_assets.py    # extension/assets ← app (vdc-lex.json, etc.)
# Les harnais/lecteurs du blob passent par le shim dictee/blobgz.js (JS) / gzip (Python). Idempotent :
# convertit l'ancien bloc « application/json id=vdc-lex » en clair OU met à jour le bloc gz existant.
import os, re, sys, gzip, base64

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', 'app', 'omega-pendu.html')
HF = os.path.join(HERE, 'cgram_hf.json')


def main():
    if not (os.path.exists(APP) and os.path.exists(HF)):
        print(f"[inject] app ou cgram_hf.json introuvable"); return 1
    hf = open(HF, encoding='utf-8').read().strip()
    b64 = base64.b64encode(gzip.compress(hf.encode('utf-8'), 9)).decode('ascii')
    block = '<script type="text/plain" id="vdc-lex-gz">' + b64 + '</script>'
    app = open(APP, encoding='utf-8', newline='').read()   # newline='' : PRÉSERVE les CRLF (parité extension)
    pat = re.compile(r'<script type="[^"]*" id="vdc-lex(?:-gz)?">.*?</script>', re.S)   # ancien (application/json id=vdc-lex) OU nouveau (text/plain id=vdc-lex-gz)
    if not pat.search(app):
        print("[inject] bloc vdc-lex introuvable dans l'app"); return 2
    new, n = pat.subn(lambda m: block, app)
    if n != 1:
        print(f"[inject] {n} blocs vdc-lex (attendu 1) — abandon"); return 3
    if new == app:
        print("[inject] vdc-lex-gz déjà à jour (aucun changement)."); return 0
    open(APP, 'w', encoding='utf-8', newline='').write(new)
    print(f"[inject] vdc-lex-gz mis à jour ({len(b64) // 1024} Ko base64 ← {len(hf) // 1024} Ko JSON, −{(len(hf) - len(b64)) // 1024} Ko)")
    return 0


if __name__ == '__main__':
    sys.exit(main())
