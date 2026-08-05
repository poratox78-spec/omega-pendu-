# -*- coding: utf-8 -*-
"""« UNE DURÉE EST UNE LONGUEUR » (Rem) — et si on cessait de compter en millisecondes ?

L'IDÉE. Dans le pendu, M3_d/bPC est doué parce qu'il travaille sur la LONGUEUR : il perçoit
l'état du mot, pas des valeurs absolues. Rem transpose : une durée EST une longueur — donc nos
seuils de ponctuation ne devraient peut-être pas s'exprimer en millisecondes absolues, mais dans
l'unité du LOCUTEUR lui-même.

CE QUE ÇA PRÉDIT, ET QUI EST FALSIFIABLE. Si 190/600 ms sont des constantes absolues, l'optimum
par locuteur doit être stable. Or il ne l'est pas : mesuré sur VoxPopuli, médiane 350 ms mais
écart-type 97 ms, de 125 à 500. Un débit rapide fait des pauses courtes, un débit lent des pauses
longues — la MÊME intention de virgule. Exprimer la pause en unités du RYTHME PROPRE du locuteur
devrait donc RESSERRER cette dispersion. Si ça ne la resserre pas, l'idée est fausse et on le dit.

L'UNITÉ DE RYTHME retenue : la MÉDIANE des durées de bouffées de parole du clip. C'est le grain
articulatoire du locuteur, il ne demande aucun texte, aucun alignement, et il se calcule en direct
dans le navigateur sur la capture qu'on a déjà.

⚠️ On mesure la DISPERSION INTER-LOCUTEUR de l'optimum, pas un taux : c'est elle qui dit si le
seuil décrit la langue ou l'individu. C'est le même raisonnement que voix_seuils_probe.py, mais
sur l'axe que Rem propose.
"""
import io
import os
import json
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

DOSSIER = os.path.join('data_local', 'voix', 'voxpopuli_fr')
PAS_MS = 30


def seuil_livre(r):
    """Le détecteur de silence tel qu'il est LIVRÉ (plancher de bruit borné par med/2)."""
    import numpy as np
    p10 = float(np.percentile(r, 10))
    med = float(np.median(r))
    return min(max(0.008, p10 * 3 + 0.004), max(0.008, med * 0.5))


def decoupe(r, seuil):
    """-> (silences_ms_internes, durees_de_bouffees_de_parole_ms)"""
    sil, par = [], []
    run_s = run_p = 0
    for v in r:
        if v < seuil:
            if run_p:
                par.append(run_p * PAS_MS)
            run_p = 0
            run_s += 1
        else:
            if run_s:
                sil.append(run_s * PAS_MS)
            run_s = 0
            run_p += 1
    if run_p:
        par.append(run_p * PAS_MS)
    if run_s:
        sil.append(run_s * PAS_MS)
    return (sil[1:-1] if len(sil) >= 2 else []), par


def main():
    import numpy as np
    import soundfile as sf

    idx = os.path.join(DOSSIER, 'index.jsonl')
    if not os.path.exists(idx):
        print("corpus absent — lance d'abord : python dictee/voix_corpus_pull.py")
        return 1

    clips = []
    for r in [json.loads(l) for l in io.open(idx, encoding='utf-8')]:
        data, sr = sf.read(os.path.join(DOSSIER, r['wav']), dtype='float32')
        n = int(sr * PAS_MS / 1000.0)
        t = len(data) // n
        if t < 8:
            continue
        rms = np.sqrt(np.mean(np.square(data[:t * n].reshape(t, n)), axis=1))
        sil, par = decoupe(rms, seuil_livre(rms))
        if not par:
            continue
        txt = r['texte']
        interne = txt[:-1] if txt and txt[-1] in '.!?' else txt
        clips.append({'sil': sil,
                      'rythme': float(np.median(par)),          # le grain du locuteur, en ms
                      'faible': interne.count(',') + interne.count(';') + interne.count(':'),
                      'loc': r['locuteur']})

    par_loc = {}
    for c in clips:
        if c['loc'] is not None:
            par_loc.setdefault(c['loc'], []).append(c)
    locs = {k: v for k, v in par_loc.items()
            if len(v) >= 4 and sum(x['faible'] for x in v) >= 8}
    print('%d clips · %d locuteurs exploitables (>= 4 clips et >= 8 virgules)\n'
          % (len(clips), len(locs)))

    ryth = sorted(np.median([c['rythme'] for c in v]) for v in locs.values())
    print('rythme articulatoire par locuteur : médiane %.0f ms · min %.0f · max %.0f'
          % (ryth[len(ryth) // 2], ryth[0], ryth[-1]))
    print('   -> %s\n' % ('les locuteurs ONT des rythmes différents : la normalisation a un sens'
                          if ryth[-1] > 1.5 * ryth[0] else
                          'rythmes trop proches : la normalisation ne peut RIEN changer'))

    def dispersion(optim):
        o = sorted(optim)
        m = sum(o) / len(o)
        et = (sum((x - m) ** 2 for x in o) / len(o)) ** 0.5
        return o[len(o) // 2], et, o[0], o[-1]

    # ── A — SEUIL ABSOLU, en millisecondes (ce qu'on fait aujourd'hui)
    abs_opt = []
    for v in locs.values():
        b = min(range(100, 701, 25),
                key=lambda V: sum(abs(sum(1 for d in c['sil'] if V <= d < 600) - c['faible']) for c in v))
        abs_opt.append(b)
    med, et, lo, hi = dispersion(abs_opt)
    print('A · SEUIL ABSOLU (ms)          médiane %4d   écart-type %5.1f   [%d , %d]' % (med, et, lo, hi))
    cvA = et / med

    # ── B — SEUIL RELATIF AU RYTHME du locuteur (« une durée est une longueur »)
    rel_opt = []
    for v in locs.values():
        b = min([x / 10.0 for x in range(5, 81)],
                key=lambda K: sum(abs(sum(1 for d in c['sil'] if K * c['rythme'] <= d < 600) - c['faible'])
                                  for c in v))
        rel_opt.append(b)
    medR, etR, loR, hiR = dispersion(rel_opt)
    print('B · SEUIL RELATIF (x rythme)   médiane %.2f   écart-type %5.2f   [%.1f , %.1f]'
          % (medR, etR, loR, hiR))
    cvB = etR / medR

    # ── C — ⚠️ ON NE DÉCLARE PAS UNE IDÉE RÉFUTÉE SUR UNE SEULE OPÉRATIONNALISATION.
    # Le rythme des BOUFFÉES mesure l'articulation ; le rythme des PAUSES mesure directement ce
    # qu'on veut seuiller. C'est l'autre candidat naturel, il faut l'essayer avant de conclure.
    for c in clips:
        c['rythmeSil'] = float(np.median(c['sil'])) if c['sil'] else c['rythme']
    rel2 = []
    for v in locs.values():
        b = min([x / 10.0 for x in range(5, 81)],
                key=lambda K: sum(abs(sum(1 for d in c['sil'] if K * c['rythmeSil'] <= d < 600) - c['faible'])
                                  for c in v))
        rel2.append(b)
    med2, et2, lo2, hi2 = dispersion(rel2)
    cvC = et2 / med2
    print('C · RELATIF au rythme des PAUSES   médiane %.2f   écart-type %5.2f   [%.1f , %.1f]'
          % (med2, et2, lo2, hi2))

    print('\nCOEFFICIENT DE VARIATION (écart-type / médiane) — c\'est LUI qui tranche :')
    print('   absolu  %.3f   ·   relatif/parole  %.3f   ·   relatif/pauses  %.3f' % (cvA, cvB, cvC))
    cvB = min(cvB, cvC)      # on donne sa CHANCE à l'idée : on retient sa meilleure variante
    if cvB < cvA * 0.85:
        print('   ⭐ le relatif RESSERRE nettement : l\'idée de Rem tient, le seuil doit être relatif.')
    elif cvB > cvA * 1.15:
        print('   ⛔ le relatif DISPERSE davantage : idée mesurée-RÉFUTÉE, garder les millisecondes.')
    else:
        print('   ⚖️  match nul (moins de 15 % d\'écart) : rien ne justifie de compliquer.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
