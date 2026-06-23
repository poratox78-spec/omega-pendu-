# -*- coding: utf-8 -*-
# Injecte cgram_hf.json (sous-ensemble HF : verbes + genre + noms purs + adjectifs + CONJUGAISON) dans le bloc
# <script id="vdc-lex"> de l'app monolithe. Rend reproductible le pipeline d'embarquement :
#     python3 dictee/build_cgram.py        # (LEX4) → cgram_hf.json (+ cgram_conj.json complet = Bescherelle)
#     python3 dictee/inject_vdc.py         # app ← cgram_hf.json   (CE script)
#     python3 extension/build_assets.py    # extension/assets ← app (vdc-lex.json, etc.)
# Source unique = cgram_hf.json (dérivé Lexique 4, CC BY-SA 4.0). Parité app ⊆ Python garantie (même données).
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', 'app', 'omega-pendu.html')
HF = os.path.join(HERE, 'cgram_hf.json')


def main():
    if not (os.path.exists(APP) and os.path.exists(HF)):
        print(f"[inject] app ou cgram_hf.json introuvable"); return 1
    hf = open(HF, encoding='utf-8').read().strip()
    app = open(APP, encoding='utf-8').read()
    pat = re.compile(r'(<script type="application/json" id="vdc-lex">)(.*?)(</script>)', re.S)
    if not pat.search(app):
        print("[inject] bloc vdc-lex introuvable dans l'app"); return 2
    new, n = pat.subn(lambda m: m.group(1) + hf + m.group(3), app)
    if n != 1:
        print(f"[inject] {n} blocs vdc-lex (attendu 1) — abandon"); return 3
    if new == app:
        print("[inject] vdc-lex déjà à jour (aucun changement)."); return 0
    open(APP, 'w', encoding='utf-8', newline='').write(new)
    print(f"[inject] vdc-lex mis à jour dans l'app ({len(hf) // 1024} Ko) ← cgram_hf.json")
    return 0


if __name__ == '__main__':
    sys.exit(main())
