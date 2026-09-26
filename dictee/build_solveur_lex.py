# -*- coding: utf-8 -*-
u"""Le lexique du solveur de pendu : un fichier PAR LONGUEUR, classé par fréquence.

POURQUOI PAR LONGUEUR. Un motif de pendu donne sa longueur avant tout le reste. Charger les
705 653 formes du speller pour n'en garder que celles de sept lettres serait absurde : le moteur du
pendu indexe déjà par longueur (`len_index`), on fait pareil. Mesuré : le seau le plus lourd (onze
lettres) pèse 326 Ko gzippé, les longueurs courantes 57 à 280 Ko. C'est ce qui rend la page
utilisable en trois secondes, promesse du Lot C.

POURQUOI PAR FRÉQUENCE. Un mot de pendu est presque toujours un mot courant. Le classement par
fréquence sort MAISON, RAISON, PARDON, GARCON avant les formes verbales rares — vérifié à la main
sur plusieurs motifs. L'ORDRE DU FICHIER EST LE CLASSEMENT : aucune colonne de fréquence n'est
écrite, ce qui divise le poids par deux.

CE QU'ON GARDE, ET POURQUOI. Tout ce qui est alphabétique, désaccentué, de 3 à 15 lettres —
y compris les 490 969 formes de fréquence nulle. Un solveur qui ne trouve pas le mot de
l'utilisateur ne sert à rien ; le classement suffit à écarter le bruit sans le supprimer.
`index.json` note, par longueur, combien de mots ont une fréquence ATTESTÉE : la page peut ainsi
dire « dont N courants » sans embarquer les chiffres.

SOURCE : `omega-lexiques.zip` → `speller.tsv.gz`, le paquet qu'on publie déjà sur /donnees
(LGPL-LR). Aucune donnée nouvelle n'entre dans le projet : c'est une VUE d'un lexique existant.

  python3 dictee/build_solveur_lex.py            # construit
  python3 dictee/build_solveur_lex.py --check    # CI : rouge si le disque diverge de la source
"""
import collections
import gzip
import hashlib
import json
import os
import sys
import unicodedata
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(HERE)
SOURCE = os.path.join(RACINE, 'omega-lexiques.zip')
DEST = os.path.join(RACINE, 'solveur')
MIN_LEN, MAX_LEN = 3, 15
CHECK = '--check' in sys.argv


def desaccentue(mot):
    return ''.join(c for c in unicodedata.normalize('NFD', mot)
                   if unicodedata.category(c) != 'Mn')


def construire():
    u"""Retourne {longueur: [mots classés]} et {longueur: nb de mots à fréquence attestée}."""
    with zipfile.ZipFile(SOURCE) as z:
        brut = gzip.decompress(z.read('speller.tsv.gz')).decode('utf-8', 'replace')

    meilleur = {}
    for ligne in brut.split('\n'):
        p = ligne.split('\t')
        if len(p) != 3:
            continue
        mot = desaccentue(p[0]).upper()
        if not mot.isalpha() or not mot.isascii():
            continue
        if not (MIN_LEN <= len(mot) <= MAX_LEN):
            continue
        f = int(p[1]) if p[1].isdigit() else 0
        if f > meilleur.get(mot, -1):
            meilleur[mot] = f

    par = collections.defaultdict(list)
    for mot, f in meilleur.items():
        par[len(mot)].append((f, mot))

    seaux, courants = {}, {}
    for n in par:
        # fréquence décroissante, puis alphabétique : l'ordre est déterministe, donc le .gz aussi
        classe = sorted(par[n], key=lambda t: (-t[0], t[1]))
        seaux[n] = [m for _, m in classe]
        courants[n] = sum(1 for f, _ in classe if f > 0)
    return seaux, courants


def empreinte(octets):
    return hashlib.sha256(octets).hexdigest()[:16]


def main():
    if not os.path.exists(SOURCE):
        print(u'✗ SOLVEUR LEX : %s introuvable' % os.path.basename(SOURCE))
        return 1

    seaux, courants = construire()
    total = sum(len(v) for v in seaux.values())
    if total < 500000:
        print(u'✗ SOLVEUR LEX : seulement %d formes lues — la source est cassée' % total)
        return 1

    index = {'longueurs': {}, 'total': total}
    fichiers = {}
    for n in sorted(seaux):
        # mtime=0 : le .gz ne dépend que du contenu, donc --check est stable d'une machine à l'autre
        octets = gzip.compress('\n'.join(seaux[n]).encode('utf-8'), 9, mtime=0)
        fichiers['mots-%d.txt.gz' % n] = octets
        index['longueurs'][str(n)] = {'mots': len(seaux[n]), 'courants': courants[n],
                                      'octets': len(octets), 'sha': empreinte(octets)}
    idx = json.dumps(index, ensure_ascii=False, indent=1, sort_keys=True).encode('utf-8')
    fichiers['index.json'] = idx

    if CHECK:
        manques = []
        for nom, attendu in fichiers.items():
            chemin = os.path.join(DEST, nom)
            if not os.path.exists(chemin):
                manques.append(u'%s ABSENT' % nom)
            elif open(chemin, 'rb').read() != attendu:
                manques.append(u'%s DIVERGE de la source' % nom)
        extra = []
        if os.path.isdir(DEST):
            extra = [f for f in os.listdir(DEST) if f not in fichiers]
        if manques or extra:
            print(u'✗ SOLVEUR LEX : le lexique du solveur ne correspond plus à omega-lexiques.zip —')
            for m in manques[:6]:
                print(u'  ' + m)
            if extra:
                print(u'  fichiers en trop : %s' % ', '.join(sorted(extra)[:6]))
            print(u'  régénérer : python3 dictee/build_solveur_lex.py')
            return 1
        print(u'✓ lexique du solveur : %d fichiers, %d formes, %d Ko — identique à omega-lexiques.zip'
              % (len(fichiers), total, sum(len(v) for v in fichiers.values()) // 1024))
        return 0

    if not os.path.isdir(DEST):
        os.makedirs(DEST)
    for nom, octets in fichiers.items():
        with open(os.path.join(DEST, nom), 'wb') as f:
            f.write(octets)
    for f in os.listdir(DEST):
        if f not in fichiers:
            os.remove(os.path.join(DEST, f))

    poids = sum(len(v) for v in fichiers.values())
    print(u'lexique du solveur : %d formes en %d fichiers, %d Ko au total'
          % (total, len(fichiers), poids // 1024))
    print(u'  seau le plus lourd : %s'
          % max((('mots-%s' % n, v['octets']) for n, v in index['longueurs'].items()),
                key=lambda t: t[1]).__str__())
    return 0


if __name__ == '__main__':
    sys.exit(main())
