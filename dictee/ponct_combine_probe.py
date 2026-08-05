# -*- coding: utf-8 -*-
"""COMBINER LES DEUX CANAUX — la mesure que Rem réclame depuis le début.

« on va combiner les deux, encore une fois ce qu'on ne fait pas sérieusement depuis le début ».
Jusqu'ici on mesurait le TEXTE sur des corpus écrits et l'AUDIO sur des prises de voix : deux
chiffres qui ne se parlaient pas. Le lit joint (`ponct_lit_joint.py`) met enfin les deux canaux
sur les MÊMES interstices, avec un alignement mot↔temps VÉRIFIÉ (clips rejetés sinon).

LES DEUX CANAUX, chacun rendant une DISTRIBUTION sur {rien, virgule, point} :
  · TEXTE : tables conditionnelles à repli, entraînées AILLEURS (UD FR GSD + Wiktionnaire).
            AUCUNE fuite : VoxPopuli n'entre pas dans son entraînement.
  · AUDIO : P(marque | durée du silence à la VRAIE frontière de mot), estimée sur la moitié
            TRAIN du lit joint, évaluée sur l'autre.

LES COMBINAISONS COMPARÉES — on ne présume pas laquelle gagne, on mesure :
  ① texte seul                  ② audio seul
  ③ PRODUIT des distributions (fusion probabiliste naïve)
  ④ ⭐ ARBITRAGE OS : la route la plus PIQUÉE tranche, l'autre porte la confiance.
     μ = r/(1+r) avec r = p1/p2 — c'est la forme maison, celle qui a battu six fusions
     probabilistes sur le problème du sujet. Ici elle est REMISE À L'ÉPREUVE, pas supposée.

⚠️ MÉTRIQUE : F1 PAR MARQUE. La classe « rien » pèse ~85 % des interstices — une exactitude
globale de 85 % s'obtient en ne prédisant jamais rien. Et le split est PAR CLIP, jamais par
interstice.
"""
import io
import json
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

LIT = os.path.join('data_local', 'voix', 'lit_joint.jsonl')
MARQUES = ('', ',', '.')


def bucket(d):
    """Le silence en tranches. Bornes reprises de ce qu'on a MESURÉ : plancher 190, virgule vers
    350-370, point 600. On garde des tranches fines autour pour laisser les données parler."""
    for b, hi in enumerate((60, 120, 190, 260, 340, 420, 520, 620, 800, 1100, 1600)):
        if d < hi:
            return b
    return 11


def dist_ou_prior(cpt, prior, mini=12):
    s = sum(cpt.values())
    if s >= mini:
        return {k: cpt[k] / float(s) for k in MARQUES}
    return prior


def piquage(d):
    """μ = r/(1+r), r = p1/p2 : la FIABILITÉ d'une route, c'est le piqué de sa distribution."""
    v = sorted(d.values(), reverse=True)
    p1, p2 = v[0], max(v[1], 1e-9)
    r = p1 / p2
    return r / (1.0 + r)


def f1(vp, fp, fn):
    p = vp / float(vp + fp) if (vp + fp) else 0.0
    r = vp / float(vp + fn) if (vp + fn) else 0.0
    return p, r, (2 * p * r / (p + r) if (p + r) else 0.0)


def main():
    import correcteur_probe as C
    from ponct_texte_probe import phrases, flux, Modele

    if not os.path.exists(LIT):
        print('lit joint absent — lance d\'abord : python dictee/ponct_lit_joint.py')
        return 1
    random.seed(20260805)

    # ── CANAL TEXTE : entraîné AILLEURS (aucune fuite depuis VoxPopuli)
    P = phrases()
    random.shuffle(P)
    M = Modele()
    for mots, marques in flux(P[:int(0.9 * len(P))]):
        M.entraine(mots, C.pos_tags(mots) or ['X'] * len(mots), marques)
    print('canal TEXTE entraîné hors VoxPopuli · tables : ' +
          ' · '.join(str(len(x)) for x in M.t))

    # ⭐ QUEL AUDIO ? (question de Rem). Le lit joint porte DEUX mesures du MÊME silence :
    #   `sil`     = les trames PAD/« | » de wav2vec2 — c'est le modèle acoustique qui décide ;
    #   `sil_rms` = NOTRE détecteur d'énergie (RMS 30 ms, plancher de bruit borné), celui qui
    #               tourne réellement dans le navigateur.
    # Mesurer la combinaison avec `sil` donne un chiffre qu'on ne peut PAS atteindre en prod.
    # Par défaut on prend donc le NÔTRE ; `--ideal` rejoue avec celui de wav2vec2 pour voir le
    # prix exact du détecteur.
    CHAMP = 'sil' if '--ideal' in sys.argv else 'sil_rms'
    print('canal AUDIO : %s' % ('wav2vec2 (IDÉAL, non atteignable en prod)' if CHAMP == 'sil'
                                else 'NOTRE détecteur RMS (celui de la production)'))
    clips = [json.loads(l) for l in io.open(LIT, encoding='utf-8')]
    random.shuffle(clips)
    coupe = len(clips) // 2
    tr, te = clips[:coupe], clips[coupe:]
    print('lit joint : %d clips · %d train (canal audio) · %d test' % (len(clips), len(tr), len(te)))

    # ── CANAL AUDIO : P(marque | tranche de silence), estimée sur TRAIN
    cpt = {}
    glob = {k: 0 for k in MARQUES}
    for c in tr:
        for i in range(len(c['mots'])):
            b = bucket(c[CHAMP][i])
            cpt.setdefault(b, {k: 0 for k in MARQUES})[c['marques'][i]] += 1
            glob[c['marques'][i]] += 1
    sg = float(sum(glob.values())) or 1.0
    prior = {k: glob[k] / sg for k in MARQUES}
    print('prior global : rien %.3f · virgule %.3f · point %.3f'
          % (prior[''], prior[','], prior['.']))

    # ── ÉVALUATION
    # ⚠️⚠️ POURQUOI ⑤ EXISTE — c'est la mesure ④ qui l'a imposé. L'audio rend un POSTERIOR
    # P(marque | silence), et il est écrasé par le prior (88,7 % de « rien ») : son argmax dit
    # TOUJOURS « rien », donc « audio seul » sort à 0,000, et dans l'arbitrage OS il gagne presque
    # toujours (une distribution dominée par un prior est PIQUÉE) et impose « rien » — la virgule
    # tombe à 1 % de rappel. Le piqué n'est PAS la fiabilité quand une classe écrase les autres.
    # LE CORRECTIF EST DOCTRINAL, pas cosmétique : en canal bruité on ne veut pas P(marque|audio)
    # mais la VRAISEMBLANCE P(audio|marque) ∝ P(marque|audio)/P(marque). Diviser par le prior rend
    # à l'audio son rôle : apporter une PREUVE, pas répéter ce que tout le monde sait déjà.
    noms = ['① texte seul', '② audio seul', '③ produit', '④ arbitrage OS',
            '⑤ ⭐ texte × vraisemblance audio', '⑥ arbitrage OS sur vraisemblance']
    sc = [{m: [0, 0, 0] for m in (',', '.')} for _ in noms]   # [vp, fp, fn]
    n = 0
    for c in te:
        mots, marques, sil = c['mots'], c['marques'], c[CHAMP]
        tg = C.pos_tags(mots) or ['X'] * len(mots)
        depuis = 0
        for i in range(len(mots)):
            n += 1
            dt = M.distribution(mots, tg, i, depuis)
            da = dist_ou_prior(cpt.get(bucket(sil[i]), {k: 0 for k in MARQUES}), prior)
            # ③ produit (fusion probabiliste naïve), renormalisé
            pr = {k: dt[k] * da[k] for k in MARQUES}
            s = sum(pr.values()) or 1.0
            pr = {k: v / s for k, v in pr.items()}
            # ④ arbitrage OS : la route la plus PIQUÉE tranche
            arb = dt if piquage(dt) >= piquage(da) else da
            # ⑤ CANAL BRUITÉ : l'audio en VRAISEMBLANCE (posterior ÷ prior), pas en posterior.
            vr = {k: da[k] / max(prior[k], 1e-9) for k in MARQUES}
            pv = {k: dt[k] * vr[k] for k in MARQUES}
            s5 = sum(pv.values()) or 1.0
            pv = {k: v / s5 for k, v in pv.items()}
            # ⑥ le même arbitrage OS, mais sur la vraisemblance normalisée
            sv = sum(vr.values()) or 1.0
            vrn = {k: v / sv for k, v in vr.items()}
            arb2 = dt if piquage(dt) >= piquage(vrn) else vrn
            preds = [max(dt, key=lambda k: dt[k]), max(da, key=lambda k: da[k]),
                     max(pr, key=lambda k: pr[k]), max(arb, key=lambda k: arb[k]),
                     max(pv, key=lambda k: pv[k]), max(arb2, key=lambda k: arb2[k])]
            vrai = marques[i]
            for j, pred in enumerate(preds):
                for m in (',', '.'):
                    if pred == m and vrai == m: sc[j][m][0] += 1
                    elif pred == m and vrai != m: sc[j][m][1] += 1
                    elif pred != m and vrai == m: sc[j][m][2] += 1
            depuis = 0 if vrai else depuis + 1

    print('\n%d interstices de test\n' % n)
    print('%-34s %-28s %s' % ('', 'VIRGULE', 'POINT'))
    print('%-34s %8s %8s %8s   %8s %8s %8s' % ('', 'précis', 'rappel', 'F1', 'précis', 'rappel', 'F1'))
    for j, nom in enumerate(noms):
        pv, rv, fv = f1(*sc[j][','])
        pp, rp, fp_ = f1(*sc[j]['.'])
        print('%-34s %7.1f%% %7.1f%% %7.3f   %7.1f%% %7.1f%% %7.3f'
              % (nom, 100 * pv, 100 * rv, fv, 100 * pp, 100 * rp, fp_))
    return 0


if __name__ == '__main__':
    sys.exit(main())
