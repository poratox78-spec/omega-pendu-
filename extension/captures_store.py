# -*- coding: utf-8 -*-
"""Assemble les captures de la fiche Chrome Web Store (STORE.md §6) : page d'écriture (860×800) + panneau réel (420×800) côte à côte,
séparés par un filet, en 1280×800 RGB (PNG 24 bits SANS canal alpha — exigence du Store) ; le mode d'emploi passe tel quel en RGB.
   node extension/captures_store.js && python extension/captures_store.py   → data_local/store/captures/0N-*.png"""
import os, sys
from PIL import Image
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRUT = os.path.join(RACINE, 'data_local', 'store', 'captures', 'brut')
SORTIE = os.path.join(RACINE, 'data_local', 'store', 'captures')
SCENES = [('p1-panneau.png', '01-panneau.png'), ('p2-pourquoi.png', '02-pourquoi.png'), ('p3-police-de-son.png', '03-police-de-son.png'),
          ('p4-nombre.png', '04-aide-au-nombre.png')]


def main():
    page = Image.open(os.path.join(BRUT, 'page.png')).convert('RGB')
    for src, dst in SCENES:
        pan = Image.open(os.path.join(BRUT, src)).convert('RGB')
        img = Image.new('RGB', (1280, 800), (255, 255, 255))
        img.paste(page.crop((0, 0, 859, 800)), (0, 0))
        for y in range(800): img.putpixel((859, y), (176, 188, 201))   # filet entre la page et le panneau
        img.paste(pan.crop((0, 0, 420, 800)), (860, 0))
        img.save(os.path.join(SORTIE, dst), 'PNG')
        print(u'✓', dst, img.size, img.mode)
    aide = Image.open(os.path.join(BRUT, 'p5-mode-emploi.png')).convert('RGB').crop((0, 0, 1280, 800))
    aide.save(os.path.join(SORTIE, '05-mode-emploi.png'), 'PNG')
    print(u'✓ 05-mode-emploi.png', aide.size, aide.mode)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
