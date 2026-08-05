# -*- coding: utf-8 -*-
"""L'ALIGNEUR SANS MODÈLE, SUR LA VOIX DE REM — le test qui décide.

POURQUOI CE PROBE ET PAS L'AUTRE. `voix_aligneur_syll_probe.py` mesure l'aligneur sur les 93 clips
VoxPopuli : bon pour juger l'ALIGNEMENT lui-même (vérité-terrain wav2vec2), mauvais pour juger la
PONCTUATION qui en sort. Le lit est du discours parlementaire lu — un orateur fait ses pauses
AU MILIEU de ses phrases, par rhétorique. Mesuré : même avec une ancre PARFAITE, la règle 190/600
n'y atteint que 21 % de justesse. Ce n'est pas l'ancre qui échoue, c'est le domaine qui diffère.

ICI on prend le seul enregistrement du VRAI domaine : Rem dictant ses 8 phrases (`omega_asr_rec.wav`).
Sur ce même fichier, `voix_ancre_plafond_probe.py` a mesuré ce que donne une ancre PARFAITE
(wav2vec2, 20 ms/frame) : **7 points et 5 virgules sur 8 et 6 écrites**. C'est le plafond.

LA QUESTION : notre aligneur SANS MODÈLE — pauses + durée + syllabes que le lexique nous donne —
récupère-t-il ce plafond, ou s'effondre-t-il ? De la réponse dépend s'il faut payer un modèle
acoustique embarqué (ONNX/WASM) ou si l'on peut livrer avec ce qu'on a déjà.
"""
import io, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import voix_aligneur_syll_probe as A

WAV = os.path.join(os.path.dirname(HERE), 'data_local', 'voix', 'omega_asr_rec.wav')
COMMA_MS, PERIOD_MS = 190, 600

REF = [
    "Le petit chat blanc dort souvent sur le vieux fauteuil rouge.",
    "Ce matin, j'ai oublié mes clés sur la table.",
    "Il faut acheter du pain, du fromage et des pommes.",
    "Mon frère, celui qui habite à Lyon, arrive demain.",
    "Est-ce que tu viens avec nous ce week-end ?",
    "Quand j'aurai fini, je te préviendrai tout de suite.",
    "Le train part à huit heures, ne sois pas en retard.",
    "Elle m'a dit qu'elle viendrait, mais je n'en suis pas sûr.",
]

import re
MOT = re.compile(r"[A-Za-zÀ-ÿœŒ'’-]+")


def mots_et_marques():
    """Les mots dans l'ordre + la marque qui suit chacun ('' si aucune)."""
    mots, marq = [], []
    for phrase in REF:
        jets = re.findall(r"[A-Za-zÀ-ÿœŒ'’-]+|[,.;:!?]", phrase)
        for j in jets:
            if re.match(r"^[,.;:!?]$", j):
                if mots: marq[-1] = ',' if j == ',' else '.'
            else:
                mots.append(j); marq.append('')
    return mots, marq


def att_duree(blocs, tot):
    d = [float(b - a) for (a, b) in blocs]
    s = sum(d) or 1.0
    return [x / s * tot for x in d]


def main():
    if not os.path.exists(WAV):
        print('WAV absent :', WAV); return 1
    x, sr = A.lire_wav(WAV)
    if x is None:
        print('WAV illisible (16 bits attendus)'); return 1
    e = A.lisser(A.enveloppe(x, sr), A.LISSE_MS)
    blocs, pauses = A.zones_parole(e, A.seuil_bruit(e))
    mots, marq = mots_et_marques()
    syl = [A.nb_syllabes(w) for w in mots]
    coupes = A.aligner(syl, att_duree(blocs, sum(syl)))
    # ⛔ BUG CORRIGE : `pauses` contient AUSSI le silence de DEBUT et celui de FIN d'enregistrement,
    # qui ne separent aucun bloc. Les apparier par indice decalait tout d'un cran et faisait
    # tomber le score a 0/12. La duree qui nous interesse est celle du TROU ENTRE DEUX BLOCS
    # CONSECUTIFS — on la calcule depuis les blocs, la ou elle a un sens.
    dur = [(blocs[j + 1][0] - blocs[j][1]) * A.HOP_MS for j in range(len(blocs) - 1)]

    print('%d mots · %d syllabes attendues · %d blocs de parole · %d pauses detectees'
          % (len(mots), sum(syl), len(blocs), len(pauses)))
    print('duree moyenne de syllabe deduite : %.0f ms\n'
          % (sum(b - a for a, b in blocs) * A.HOP_MS / max(1, sum(syl))))

    att_vg = sum(1 for m in marq[:-1] if m == ',')
    att_pt = sum(1 for m in marq[:-1] if m == '.')
    jv = pv = jp = pp = 0
    jv1 = jp1 = 0
    detail = []
    for k, iw in enumerate(coupes):
        if k >= len(dur): break
        ms = dur[k]
        pred = '.' if ms >= PERIOD_MS else (',' if ms >= COMMA_MS else '')
        if not pred or iw < 0 or iw >= len(marq) - 1: continue
        vrai = marq[iw]
        ok = (pred == vrai)
        # tolérance ±1 mot : l'erreur est-elle un DÉCALAGE ou une INVENTION ?
        ok1 = any(0 <= iw + d < len(marq) - 1 and marq[iw + d] == pred for d in (-1, 0, 1))
        if pred == ',':
            pv += 1; jv += ok; jv1 += ok1
        else:
            pp += 1; jp += ok; jp1 += ok1
        detail.append('  %-14s apres « %s » (%d ms) -> %s %s'
                      % ('JUSTE' if ok else ('a 1 mot pres' if ok1 else 'FAUX'),
                         mots[iw], ms, pred, '' if ok else ('(vrai : %s)' % (vrai or 'rien'))))

    print('ATTENDU (ce que Rem a ecrit) : %d points · %d virgules' % (att_pt, att_vg))
    print('POSE par l\'aligneur          : %d points · %d virgules\n' % (pp, pv))
    print('  POINT    justes %d/%d   (a +/-1 mot : %d)' % (jp, pp, jp1))
    print('  VIRGULE  justes %d/%d   (a +/-1 mot : %d)' % (jv, pv, jv1))
    tot_j, tot_p, tot_a = jp + jv, pp + pv, att_pt + att_vg
    print('  TOTAL    justes %d/%d = %.0f %%   ·   trouvees %d/%d = %.0f %%'
          % (tot_j, tot_p, 100.0 * tot_j / max(1, tot_p), tot_j, tot_a, 100.0 * tot_j / max(1, tot_a)))
    print('\n  PLAFOND mesure (ancre PARFAITE wav2vec2, meme WAV) : 7 points + 5 virgules sur 8 + 6')
    print('  ETAT LIVRE (aucune ancre, canal texte + frontieres Google) : 12 marques sur 27 (3 prises)')
    print('\ndetail :')
    for d in detail: print(d)
    return 0


if __name__ == '__main__':
    sys.exit(main())
