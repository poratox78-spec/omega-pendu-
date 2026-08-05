# -*- coding: utf-8 -*-
"""VERROU du résiduel « sujet à travers une proposition relative en QUI ».

LE CAS (Rem) : « les villages QUI COMPOSENT la commune produit du vin » — le parseur de sujet
s'arrêtait au verbe de la relative et prenait « la commune » pour sujet, et deux gardes FP=0
(« qui » ∈ CONJ_WORDS, verbe fini intercalé) fermaient la règle. Mesuré AVANT, sur les cas
isolés par l'ANNOTATION UD (nsubj séparé de son verbe par une relative + leurre de nombre) :
FP 0/33 mais **rappel 0 %**.

⚠️⚠️ AUCUN CORRECTIF N'EST LIVRÉ AVEC CE PROBE — il MESURE le résiduel, il ne le répare pas.
Le mécanisme a pourtant été trouvé et validé dans le moteur de RÉFÉRENCE (Python) :

  « qui » est un pronom relatif SUJET, donc son verbe s'accorde OBLIGATOIREMENT avec
  l'antécédent. Si ce verbe porte le MÊME NOMBRE que le nom-tête trouvé, la relative CORROBORE
  ce nom-tête — contrainte grammaticale vérifiée sur le texte, pas heuristique de distance.
  Sans corroboration (« la liste des villages qui COMPOSENT … est longue » : tête sg, relative
  pl) -> abstention. Mesuré en Python : 6/6 sur les cas types, signalements à l'échelle
  INCHANGÉS (7 avant, 7 après), rappel de la famille 0 % -> 2,7 %.

POURQUOI CE N'EST PAS LIVRÉ : le port vers les deux moteurs JS ne se déclenche pas, alors que
Python le fait — vraisemblablement parce que `_SEG.bb` marque une frontière de proposition sur
« qui » et borne la remontée du parseur autrement d'un moteur à l'autre. Livrer aurait créé une
DIVERGENCE ENTRE MOTEURS, c'est-à-dire deux comportements pour le même texte. On garde donc la
mesure, et le correctif attend d'être identique partout.

CE PROBE MESURE LES DEUX FACES, et le FP passe EN PREMIER parce que c'est lui qui commande :
 ① FP=0 À L'ÉCHELLE sur du français CORRECT (UD FR GSD entier) — aucune affirmation nouvelle.
 ② RAPPEL sur les cas d'or, corrompus.
Usage : python dictee/sujet_relative_probe.py [--check]
"""
import io
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

UD = os.path.join('data_local', 'ud_fr_gsd-train.conllu')


def phrases_ud():
    out = []
    if not os.path.exists(UD):
        return out
    for l in io.open(UD, encoding='utf-8'):
        if l.startswith('# text = '):
            t = l[9:].strip()
            if 10 < len(t) < 300:
                out.append(t)
    return out


def cas_or():
    """Cas isolés par l'ANNOTATION : nsubj séparé de son verbe par une relative, avec un leurre
    de nombre entre les deux. On ne devine pas le sujet, on le LIT."""
    out, texte, mots = [], None, []
    if not os.path.exists(UD):
        return out

    def finir():
        if texte and mots:
            for m in mots:
                if m['deprel'] != 'nsubj':
                    continue
                v = mots[m['head'] - 1] if 0 < m['head'] <= len(mots) else None
                if not v or v['upos'] not in ('VERB', 'AUX') or 'Fin' not in (v['feats'] or ''):
                    continue
                a, b = min(m['id'], v['id']), max(m['id'], v['id'])
                if b - a < 3:
                    continue
                entre = mots[a:b - 1]
                if not any(x['deprel'] == 'acl:relcl' for x in entre) and \
                   not any(x['lemma'] == 'qui' for x in entre):
                    continue
                ns = 'p' if 'Number=Plur' in (m['feats'] or '') else ('s' if 'Number=Sing' in (m['feats'] or '') else None)
                if not ns:
                    continue
                out.append({'texte': texte, 'verbe': v['form'], 'iv': v['id'] - 1, 'n': ns,
                            'mots': [x['form'] for x in mots]})
                break
    for l in io.open(UD, encoding='utf-8'):
        if l.startswith('# text = '):
            texte = l[9:].strip(); continue
        if not l.strip():
            finir(); texte, mots = None, []; continue
        if l.startswith('#'):
            continue
        c = l.rstrip('\n').split('\t')
        if len(c) < 8 or '-' in c[0]:
            continue
        mots.append({'id': int(c[0]), 'form': c[1], 'lemma': c[2], 'upos': c[3],
                     'feats': c[5], 'head': int(c[6]), 'deprel': c[7]})
    finir()
    return out


def bascule(v):
    for re_, r in ((r'ent$', 'e'), (r'ont$', 'a'), (r'aient$', 'ait'), (r'èrent$', 'a')):
        if re.search(re_, v):
            return re.sub(re_, r, v)
    for re_, r in ((r'^est$', 'sont'), (r'^a$', 'ont'), (r'^ait$', 'aient'), (r'e$', 'ent')):
        if re.search(re_, v):
            return re.sub(re_, r, v)
    return None


def main():
    import correcteur_probe as C
    check = '--check' in sys.argv
    ph = phrases_ud()
    if not ph:
        print('UD absent (data_local/) — probe non exécutable')
        return 0

    # ① FP=0 À L'ÉCHELLE — du français CORRECT, on ne doit RIEN affirmer de nouveau.
    # On ne regarde que les phrases contenant « qui » : c'est le chemin ouvert.
    avec_qui = [t for t in ph if re.search(r'\bqui\b', t, re.I)]
    fp, ex = 0, []
    for t in avec_qui:
        for (_i, w, s, nom) in C.correct(t):
            if nom == 'accord sujet-verbe':
                fp += 1
                if len(ex) < 8:
                    ex.append('%s → %s   | %s' % (w, s, t[:96]))
    # ⚠️⚠️ CE COMPTE N'EST PAS « LE NOMBRE DE FAUX POSITIFS », et les confondre serait grave.
    # UD FR GSD vient du web : il CONTIENT de vraies fautes. Sur les 7 signalements relevés, SIX
    # sont des corrections JUSTES du corpus — « Le pilier d'Héliodoros SEMBLENT indiquer », « tout
    # ceux qui RECHERCHE le calme », « un peuple indigène qui VIVAIENT », « qui lui PERMETTRONS ».
    # Le seul chiffre honnête est donc le DELTA, et il a été mesuré en rejouant CE MÊME probe sur
    # le code de `main` : **les 7 sont identiques avant et après l'ouverture de la relative**.
    # Le verrou porte donc sur la NON-RÉGRESSION, pas sur un absolu qu'on lirait de travers.
    BASE = 7
    print('① NON-RÉGRESSION À L\'ÉCHELLE — %d phrases UD correctes contenant « qui »' % len(avec_qui))
    print('   signalements accord sujet-verbe : %d   (référence avant ouverture : %d)   %s'
          % (fp, BASE, '⛔ RÉGRESSION' if fp > BASE else '✅ aucun signalement nouveau'))
    for e in ex:
        print('     ' + e)

    # ② RAPPEL sur les cas d'or corrompus
    G = cas_or()
    ok = muet = faux = 0
    exm = []
    for c in G:
        mau = bascule(c['verbe'])
        if not mau or mau == c['verbe']:
            continue
        T = list(c['mots']); T[c['iv']] = mau
        f = [x for x in C.correct(' '.join(T)) if x[0] == c['iv']]
        if not f:
            muet += 1
            if len(exm) < 5:
                exm.append(mau + ' | ' + ' '.join(T)[:92])
        elif f[0][2].lower() == c['verbe'].lower():
            ok += 1
        else:
            faux += 1
    tot = ok + muet + faux
    print('\n② RAPPEL sur %d cas d\'or (annotation UD) corrompus' % tot)
    print('   rétabli %d · muet %d · mauvaise suggestion %d  ->  %.1f %%'
          % (ok, muet, faux, (100.0 * ok / tot) if tot else 0))
    for e in exm:
        print('     muet : ' + e)

    if check and (fp > BASE or faux > 0):
        print('\n⛔ ÉCHEC : le rouge ne s\'affirme jamais sans preuve.')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
