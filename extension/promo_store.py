# -*- coding: utf-8 -*-
"""Images promotionnelles de la fiche Chrome Web Store (STORE.md §6) : convertit les rendus de promo_store.js en PNG 24 bits SANS
canal alpha, et vérifie les formats exigés par la console (440×280, 1400×560).
   node extension/promo_store.js && python extension/promo_store.py   → data_local/store/promo/0N-*.png"""
import os, sys
from PIL import Image
RACINE = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
DOSSIER = os.path.join(RACINE, 'data_local', 'store', 'promo')
ok = True
for brut, sortie, taille in (('petite.png', '01-petite-image-promo-440x280.png', (440, 280)),
                             ('grande.png', '02-image-haut-de-page-1400x560.png', (1400, 560))):
    im = Image.open(os.path.join(DOSSIER, 'brut', brut)).convert('RGB')
    if im.size != taille:
        print('✗ %s : %s au lieu de %s' % (brut, im.size, taille)); ok = False; continue
    im.save(os.path.join(DOSSIER, sortie), optimize=True)
    v = Image.open(os.path.join(DOSSIER, sortie))
    print('✓ %s : %dx%d, %s' % (sortie, v.size[0], v.size[1], v.mode))
sys.exit(0 if ok else 1)
