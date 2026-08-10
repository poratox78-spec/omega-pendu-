# -*- coding: utf-8 -*-
"""LE BANC QUI MANQUAIT — genre perdu par la DÉSACCENTUATION.

POURQUOI IL EXISTE. Le chantier « bases de genre désaccentuées » traînait depuis des semaines
avec un delta accentué construit, un portage JS annulé, et personne pour dire si ça servait.
La raison est simple : AUCUN banc ne déclenchait la table. Conséquences mesurées le 2026-08-09 :
  · retirer la table ENTIÈREMENT ne changeait rien (sortie identique sur les 2 bancs existants) ;
  · elle contenait « le »→féminin en première position, et rien ne l'aurait vu ;
  · le fil vers `rule_det_gender` manquait depuis toujours, et rien ne l'aurait dit non plus.
⇒ **Un chantier sans banc n'est pas un chantier, c'est une intuition.** Celui-ci ferme le trou.

CE QU'IL MESURE, sur les mots dont la clé DÉSACCENTUÉE est partagée avec un autre genre
(« âme »/« amé », « affaire »/« affairé », « lettre »/« lettré ») :
  ① RAPPEL — une erreur de genre du déterminant sur ces mots doit être corrigée ;
  ② FAUX POSITIFS — les mêmes mots BIEN accordés, et les pièges que la table brute ferait
     dérailler (adjectifs antéposés : « une futur maman », « la troisième division »).

⚠️ SEUILS = PLANCHERS ANTI-RÉGRESSION, pas des cibles. Ils ne doivent que MONTER.

  python3 dictee/gender_coll_probe.py            # mesure
  python3 dictee/gender_coll_probe.py --check    # garde CI
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import correcteur_probe as C

RAPPEL_MIN = 200        # mesuré 217 au branchement (0 avant) — plancher, pas plafond
FP_MAX = 0              # non négociable

# Pièges : la table BRUTE les ferait déclencher (adjectifs antéposés pris pour la tête du GN).
# Ce sont EXACTEMENT les 3 faux positifs qu'avait produits le branchement naïf sur le scan UD.
PIEGES = [
    "Rien n'est fait pour accueillir convenablement une futur maman.",
    "La première participation au championnat de la troisième division a lieu en octobre.",
    "L'économie pourrait passer, sur le papier, pour un modèle de réussite.",
    "Le marché est ouvert le dimanche matin.",
    "Un chargé de mission est venu nous voir.",
    "Le carré est vert et le cercle est bleu.",
    "Il a réglé la facture hier soir.",
]


def _mots():
    """Mots du sous-ensemble COLLISION testables : alphabétiques, singuliers, assez longs."""
    coll = getattr(C, 'GENDER_ACC_COLL', {})
    return sorted(w for w in coll if w.isalpha() and not w.endswith('s') and len(w) > 3)


def _dump():
    """Sort la LISTE des cas + le résultat Python, pour que le harnais de parité JS (app et
    extension) mesure EXACTEMENT la même chose. Sans ça, chaque moteur aurait son propre banc et
    on ne saurait pas si l'écart vient de la règle ou de l'échantillon."""
    import json
    coll = getattr(C, 'GENDER_ACC_COLL', {})
    cas = []
    for w in _mots():
        g = coll[w]
        cas.append({'mot': w, 'genre': g,
                    'faux': 'un' if g == 'f' else 'une', 'bon': 'une' if g == 'f' else 'un'})
    trouve = 0
    for c in cas:
        p = 'Il note %s %s ici.' % (c['faux'], c['mot'])
        if any(f[1].lower() == c['faux'] and f[2].lower() == c['bon'] for f in C.correct(p)):
            trouve += 1
    print(json.dumps({'cas': cas, 'rappel_python': trouve, 'pieges': PIEGES}, ensure_ascii=False))
    return 0


def main(check):
    if '--dump' in sys.argv:
        return _dump()
    coll = getattr(C, 'GENDER_ACC_COLL', {})
    mots = _mots()
    if not coll:
        print('  (GENDER_ACC_COLL vide — table de genre accentuée absente, banc ignoré)')
        return 0

    # ① RAPPEL
    trouve, rates = 0, []
    for w in mots:
        g = coll[w]
        faux = 'un' if g == 'f' else 'une'
        bon = 'une' if g == 'f' else 'un'
        p = 'Il note %s %s ici.' % (faux, w)
        if any(f[1].lower() == faux and f[2].lower() == bon for f in C.correct(p)):
            trouve += 1
        elif len(rates) < 8:
            rates.append('%s %s' % (faux, w))

    # ② FAUX POSITIFS — d'abord les mots BIEN accordés, puis les pièges d'adjectif antéposé
    fp = []
    for w in mots:
        g = coll[w]
        bon = 'une' if g == 'f' else 'un'
        p = 'Il note %s %s ici.' % (bon, w)
        for f in C.correct(p):
            if f[1].lower() == bon:
                fp.append('%s %s -> %s' % (bon, w, f[2]))
    for p in PIEGES:
        for f in C.correct(p):
            if f[3] == 'genre déterminant':
                fp.append('%s -> %s   « %s »' % (f[1], f[2], p[:60]))

    print('GENRE PERDU PAR LA DÉSACCENTUATION — %d mots à clé partagée' % len(mots))
    print('  rappel (erreur de genre du déterminant corrigée) : %d / %d' % (trouve, len(mots)))
    for r in rates:
        print('      raté : %s' % r)
    print('  faux positifs (mots bien accordés + pièges adjectif antéposé) : %d' % len(fp))
    for x in fp[:10]:
        print('      %s' % x)

    if check:
        ok = trouve >= RAPPEL_MIN and len(fp) <= FP_MAX
        print('[check] %s — rappel %d (plancher %d), FP %d (max %d)'
              % ('OK' if ok else 'ÉCHEC', trouve, RAPPEL_MIN, len(fp), FP_MAX))
        return 0 if ok else 1
    return 0


if __name__ == '__main__':
    sys.exit(main('--check' in sys.argv))
