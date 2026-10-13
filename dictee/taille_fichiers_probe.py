# -*- coding: utf-8 -*-
u"""Aucun fichier du dépôt ne dépasse 25 Mio — la limite PAR FICHIER de Cloudflare Pages, qui déploie le dépôt tel quel.

Né le 13/10/2026 (conjugaison 14) : la table de conjugaison complète a porté trois fichiers à 27-29 Mio ; ./dev.sh était vert, et seul le
déploiement de prévisualisation de la PR a échoué (« Build failed »). La table est désormais compacte (dictee/conj_io.py) ; cette sonde
fait que le prochain dépassement se voie ICI, avant la PR.
    python3 dictee/taille_fichiers_probe.py        (sortie 1 = un fichier trop gros)
"""
import os, subprocess, sys
LIMITE = 25 * 1024 * 1024
MARGE = 22 * 1024 * 1024          # au-delà : avertissement (la table grossit à chaque lot)
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')


def main():
    noms = subprocess.run(['git', 'ls-files', '-z'], cwd=ROOT, capture_output=True).stdout.decode('utf-8').split('\0')
    trop, pres = [], []
    for n in noms:
        p = os.path.join(ROOT, n)
        if not n or not os.path.isfile(p): continue
        t = os.path.getsize(p)
        if t > LIMITE: trop.append((t, n))
        elif t > MARGE: pres.append((t, n))
    for t, n in sorted(pres, reverse=True):
        print(u'  ⚠ %s : %.1f Mio — proche de la limite de 25 Mio' % (n, t / 1048576.0))
    if trop:
        print(u'✗ FICHIER TROP GROS pour Cloudflare Pages (25 Mio par fichier) — le site ne se déploierait pas :')
        for t, n in sorted(trop, reverse=True): print(u'    %s : %.1f Mio' % (n, t / 1048576.0))
        return 1
    print(u'✓ aucun fichier du dépôt au-delà de 25 Mio (limite Cloudflare Pages) — %d fichiers' % len([n for n in noms if n]))
    return 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.exit(main())
