# -*- coding: utf-8 -*-
"""RENDRE LE CANAL TEXTE EMBARQUABLE — sinon toutes les mesures ne servent à rien (Rem).

LE POINT DÉCISIF : le canal TEXTE n'a besoin d'AUCUNE ancre temporelle. Il travaille sur le texte
que Google rend, tel quel. C'est donc le seul morceau livrable AUJOURD'HUI sur le site et dans
l'extension — l'audio, lui, reste coincé au mur des deux horloges sauf aux frontières de segment.

LE PROBLÈME : le modèle brut fait 1,29 M + 858 k + 315 k + 40 k + 657 entrées. Impossible à
embarquer à côté d'un tagger de 672 Ko.

CE QUE MESURE CE PROBE — le compromis TAILLE / F1, pour trancher sur des chiffres :
  ① combien coûte l'abandon du niveau LEXICAL (bigramme de mots), le plus gros de loin ;
  ② combien coûte l'ÉLAGAGE : ne garder que les contextes qui PRÉDISENT vraiment une marque.
     Un contexte dominé par « rien » ne sert à rien : « rien » est déjà le défaut. On ne garde
     donc que ceux où P(virgule) ou P(point) dépasse nettement le prior.

⚠️ On élague sur le TRAIN et on mesure sur le TEST — élaguer d'après le test serait se noter
soi-même.
"""
import io
import json
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if __name__ == '__main__':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


def evalue(M, blocs_te, C, niveaux, mini=10):
    """F1 par marque en n'autorisant QUE les niveaux donnés."""
    vp = {',': 0, '.': 0}; fp = {',': 0, '.': 0}; fn = {',': 0, '.': 0}
    for mots, marques in blocs_te:
        tg = C.pos_tags(mots) or ['X'] * len(mots)
        depuis = 0
        for i in range(len(mots)):
            d = None
            for niv, c in enumerate(M.cles(mots, tg, i, depuis)):
                if niv not in niveaux:
                    continue
                dd = M.t[niv].get(c)
                if dd and sum(dd.values()) >= mini:
                    s = float(sum(dd.values()))
                    d = {k: v / s for k, v in dd.items()}
                    break
            if d is None:
                s = float(sum(M.pri.values())) or 1.0
                d = {k: v / s for k, v in M.pri.items()}
            pred = max(d, key=lambda k: d[k])
            vrai = marques[i]
            for m in (',', '.'):
                if pred == m and vrai == m: vp[m] += 1
                elif pred == m and vrai != m: fp[m] += 1
                elif pred != m and vrai == m: fn[m] += 1
            depuis = 0 if vrai else depuis + 1
    out = {}
    for m in (',', '.'):
        p = vp[m] / float(vp[m] + fp[m]) if (vp[m] + fp[m]) else 0.0
        r = vp[m] / float(vp[m] + fn[m]) if (vp[m] + fn[m]) else 0.0
        out[m] = (2 * p * r / (p + r) if (p + r) else 0.0)
    return out


def elague(M, niveaux, mini, marge):
    """Ne garder que les contextes qui PRÉDISENT une marque. Un contexte dominé par « rien » est
    inutile : « rien » est déjà le défaut, on n'a pas besoin d'une entrée pour le dire.
    `marge` = combien de fois le prior il faut dépasser pour mériter une entrée."""
    s = float(sum(M.pri.values())) or 1.0
    pri = {k: M.pri[k] / s for k in ('', ',', '.')}
    garde = 0
    for niv in range(M.NIV):
        if niv not in niveaux:
            M.t[niv] = {}
            continue
        neuf = {}
        for c, dd in M.t[niv].items():
            tot = sum(dd.values())
            if tot < mini:
                continue
            if (dd[','] / float(tot) > marge * pri[','] or
                    dd['.'] / float(tot) > marge * pri['.']):
                neuf[c] = dd
        M.t[niv] = neuf
        garde += len(neuf)
    return garde


def main():
    import correcteur_probe as C
    from ponct_texte_probe import phrases, flux, Modele
    random.seed(20260805)

    P = phrases()
    random.shuffle(P)
    coupe = int(0.85 * len(P))
    blocs_tr, blocs_te = list(flux(P[:coupe])), list(flux(P[coupe:]))

    def neuf():
        M = Modele()
        for mots, marques in blocs_tr:
            M.entraine(mots, C.pos_tags(mots) or ['X'] * len(mots), marques)
        return M

    M = neuf()
    tot = sum(len(x) for x in M.t)
    print('modèle complet : %d entrées (%s)' % (tot, ' · '.join(str(len(x)) for x in M.t)))
    r = evalue(M, blocs_te, C, set(range(M.NIV)))
    print('  complet                 virgule %.3f · point %.3f' % (r[','], r['.']))

    # ① sans le niveau LEXICAL (bigramme de mots) — de loin le plus gros
    r = evalue(M, blocs_te, C, {1, 2, 3, 4})
    print('  sans bigramme de mots   virgule %.3f · point %.3f   (%d entrées)'
          % (r[','], r['.'], sum(len(M.t[i]) for i in (1, 2, 3, 4))))
    r = evalue(M, blocs_te, C, {3, 4})
    print('  POS SEULS (niv 3-4)     virgule %.3f · point %.3f   (%d entrées)'
          % (r[','], r['.'], len(M.t[3]) + len(M.t[4])))

    # ② élagage : on ne garde que ce qui PRÉDIT une marque
    print('\nÉLAGAGE (on jette les contextes dominés par « rien ») :')
    print('%10s %8s %10s %10s %10s' % ('mini', 'marge', 'entrées', 'virgule', 'point'))
    for mini, marge in ((10, 1.5), (20, 1.5), (20, 2.0), (40, 2.0), (60, 2.5), (100, 3.0)):
        M2 = neuf()
        g = elague(M2, {0, 1, 2, 3, 4}, mini, marge)
        r = evalue(M2, blocs_te, C, set(range(M2.NIV)), mini=mini)
        print('%10d %8.1f %10d %10.3f %10.3f' % (mini, marge, g, r[','], r['.']))
    print('\n  repère : le tagger embarqué pèse 672 Ko décompressé (~200 Ko en .gz).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
