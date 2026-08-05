# -*- coding: utf-8 -*-
"""190 ms et 600 ms : constantes de la LANGUE, ou constantes de REM ?

LE PROBLÈME. Nos deux seuils de ponctuation viennent d'UNE voix (Rem) et de TROIS prises. Et ces
trois prises disaient déjà que ça bouge : le plancher de virgule optimal passait de 190 à 360 ms
d'une lecture à l'autre chez le MÊME locuteur. On n'avait aucun moyen de savoir si on calibrait
la langue française ou un homme un mardi soir.

LA MESURE, SANS ALIGNEMENT. On n'a pas d'alignement mot↔temps sur ce corpus (c'est justement le
mur de la voie A). Mais on n'en a pas besoin pour cette question-là : on COMPTE.
    · combien de silences >= S notre chaîne entend-elle dans un clip ?
    · combien de marques de ce niveau le locuteur a-t-il réellement écrites ?
Si les deux comptes coïncident sur 47 locuteurs, le seuil décrit la LANGUE. Sinon il décrit Rem.
C'est exactement le raisonnement du « 13 silences détectés = 13 marques réelles » de juillet,
mais sorti de l'échantillon d'un seul homme.

⚠️ Les clips VoxPopuli sont DÉCOUPÉS dans des discours : ils commencent et finissent souvent au
milieu d'une phrase. On ne compte donc que les marques et les silences INTERNES, jamais les bords.

La chaîne de détection est celle de la PRODUCTION : trames de 30 ms, RMS, seuil max(0,008 ; max×0,18).
"""
import io
import os
import json
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

DOSSIER = os.path.join('data_local', 'voix', 'voxpopuli_fr')
PAS_MS = 30


def silences_ms(data, sr):
    """Exactement ce que fait la double capture : RMS par trame de 30 ms, seuil relatif."""
    import numpy as np
    n = int(sr * PAS_MS / 1000.0)
    if n < 1:
        return [], 0
    trames = len(data) // n
    r = np.sqrt(np.mean(np.square(data[:trames * n].reshape(trames, n)), axis=1))
    seuil = max(0.008, float(r.max()) * 0.18)
    out = []
    run = 0
    deb = 0
    for i, v in enumerate(r):
        if v < seuil:
            if not run:
                deb = i
            run += 1
        else:
            if run:
                out.append((deb * PAS_MS, run * PAS_MS))
            run = 0
    if run:
        out.append((deb * PAS_MS, run * PAS_MS))
    # on JETTE le silence de tête et celui de queue : ce sont les bords du découpage, pas de la prosodie
    if out and out[0][0] == 0:
        out = out[1:]
    if out and (out[-1][0] + out[-1][1]) >= trames * PAS_MS:
        out = out[:-1]
    return [d for _, d in out], trames * PAS_MS


def main():
    import numpy as np
    import soundfile as sf

    idx = os.path.join(DOSSIER, 'index.jsonl')
    if not os.path.exists(idx):
        print('corpus absent — lance d\'abord : python dictee/voix_corpus_pull.py')
        return 1
    lignes = [json.loads(l) for l in io.open(idx, encoding='utf-8')]

    clips = []
    for r in lignes:
        t = r['texte']
        interne = t[:-1] if t and t[-1] in '.!?' else t
        n_fort = sum(interne.count(c) for c in '.!?')   # marques de FIN de phrase, internes
        n_faible = interne.count(',') + interne.count(';') + interne.count(':')
        data, sr = sf.read(os.path.join(DOSSIER, r['wav']), dtype='float32')
        sils, duree = silences_ms(data, sr)
        clips.append({'sils': sils, 'fort': n_fort, 'faible': n_faible,
                      'loc': r['locuteur'], 'duree': duree, 'texte': t})

    tot_fort = sum(c['fort'] for c in clips)
    tot_faible = sum(c['faible'] for c in clips)
    print('%d clips · %d locuteurs · %.1f min' %
          (len(clips), len(set(c['loc'] for c in clips)),
           sum(c['duree'] for c in clips) / 60000.0))
    print('marques internes réellement écrites : %d fortes (. ! ?) · %d faibles (, ; :)\n'
          % (tot_fort, tot_faible))

    # ── ① LE SEUIL DU POINT — ⛔ CE CORPUS NE PEUT PAS Y RÉPONDRE, et il faut le montrer.
    # VoxPopuli découpe ses clips AUX FRONTIÈRES DE PHRASE : il ne reste donc presque aucune
    # marque forte INTERNE (40 pour 250 clips). Du coup « minimiser l'erreur » a une solution
    # dégénérée : monter le seuil jusqu'à ne PLUS RIEN détecter. On affiche exprès l'erreur de
    # la prédiction NULLE — si le « meilleur seuil » ne fait pas mieux qu'elle, il ne mesure rien.
    nul = tot_fort / len(clips)
    print('① SEUIL DU POINT — ⚠️ regarde la ligne « ne rien prédire » avant de croire un optimum')
    print('   ne rien prédire du tout : erreur %.2f marque/clip' % nul)
    print('%8s %10s %10s %9s %9s' % ('S (ms)', 'silences', 'attendu', 'ratio', 'err/clip'))
    best = None
    for S in range(200, 1601, 50):
        n = sum(sum(1 for d in c['sils'] if d >= S) for c in clips)
        err = sum(abs(sum(1 for d in c['sils'] if d >= S) - c['fort']) for c in clips) / len(clips)
        if best is None or err < best[1]:
            best = (S, err)
        if S % 200 == 0 or S == 600:
            print('%8d %10d %10d %9.2f %9.2f' % (S, n, tot_fort, n / tot_fort if tot_fort else 0, err))
    # ⚠️ « mieux que la prédiction nulle » ne suffit pas : 0,15 contre 0,16 n'est pas un signal,
    # c'est du bruit. On exige une marge NETTE (30 %), sinon on déclare le corpus muet là-dessus.
    verdict = ('informatif' if best[1] < nul * 0.70 else
               'DÉGÉNÉRÉ : la solution est « ne rien détecter » -> ce corpus ne dit RIEN sur le point')
    print('   -> « meilleur » S = %d ms (err %.2f) · prédiction nulle %.2f -> %s'
          % (best[0], best[1], nul, verdict))
    print('   (les clips sont découpés AUX phrases : %d marques fortes internes seulement)\n'
          % tot_fort)

    # ── ② LE SEUIL DE LA VIRGULE, sachant le seuil du point retenu
    print('② SEUIL DE LA VIRGULE — silences dans [V , 600) contre les marques faibles')
    print('%8s %10s %10s %9s %9s' % ('V (ms)', 'silences', 'attendu', 'ratio', 'err/clip'))
    bestv = None
    for V in range(100, 601, 25):
        n = sum(sum(1 for d in c['sils'] if V <= d < 600) for c in clips)
        err = sum(abs(sum(1 for d in c['sils'] if V <= d < 600) - c['faible']) for c in clips) / len(clips)
        if bestv is None or err < bestv[1]:
            bestv = (V, err)
        if V % 50 == 0:
            print('%8d %10d %10d %9.2f %9.2f' % (V, n, tot_faible, n / tot_faible if tot_faible else 0, err))
    print('   -> meilleur V mesuré : %d ms (erreur %.2f marque/clip) · notre prod : 190 ms\n'
          % (bestv[0], bestv[1]))

    # ── ③ CE QUI COMPTE VRAIMENT : le seuil est-il STABLE d'un locuteur à l'autre ?
    #     Si l'optimum se déplace autant entre locuteurs qu'entre deux lectures de Rem,
    #     alors « calibrer » n'a aucun sens et il faut le dire.
    # ── ③ LA VRAIE QUESTION : le seuil bouge-t-il d'un LOCUTEUR à l'autre ?
    # On la pose sur la VIRGULE, la seule dimension où ce corpus a de la matière (655 marques).
    # Si l'optimum se déplace autant entre 31 locuteurs qu'entre deux lectures de Rem, alors
    # « calibrer un seuil » n'a pas de sens et c'est ça qu'il faut écrire dans les notes.
    print('③ STABILITÉ ENTRE LOCUTEURS — mesurée sur la VIRGULE (dense), pas sur le point')
    par_loc = {}
    for c in clips:
        par_loc.setdefault(c['loc'], []).append(c)
    opt = []
    for loc, cs in sorted(par_loc.items(), key=lambda kv: -len(kv[1])):
        if len(cs) < 4 or loc is None or sum(c['faible'] for c in cs) < 8:
            continue
        b = min(range(100, 601, 25),
                key=lambda V: sum(abs(sum(1 for d in c['sils'] if V <= d < 600) - c['faible'])
                                  for c in cs))
        opt.append(b)
        if len(opt) <= 12:
            print('   locuteur %-8s %2d clips, %3d virgules -> V optimal %4d ms'
                  % (loc, len(cs), sum(c['faible'] for c in cs), b))
    if opt:
        o = sorted(opt)
        moy = sum(o) / len(o)
        et = (sum((x - moy) ** 2 for x in o) / len(o)) ** 0.5
        print('   %d locuteurs · médiane %d ms · min %d · max %d · écart-type %.0f ms'
              % (len(o), o[len(o) // 2], o[0], o[-1], et))
        dans = sum(1 for x in o if abs(x - o[len(o) // 2]) <= 75)
        print('   %d/%d locuteurs (%.0f %%) à moins de 75 ms de la médiane'
              % (dans, len(o), 100.0 * dans / len(o)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
