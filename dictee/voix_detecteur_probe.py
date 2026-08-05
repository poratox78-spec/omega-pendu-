# -*- coding: utf-8 -*-
"""LE DÉTECTEUR DE SILENCE LUI-MÊME EST-IL JUSTE ? (et non : quel seuil de ponctuation)

D'OÙ VIENT LA QUESTION. En cherchant à dater notre propre capture (idée de Rem), les bouffées de
parole se sont révélées absurdes : sur sa prise libre, **5850 ms de parole détectée pour 19470 ms
d'enregistrement et 62 mots** — 94 ms par mot, physiquement impossible. Le détecteur classe la
moitié de la parole en « silence ».

LA CAUSE. Le seuil est `max(0,008 ; maxRMS x 0,18)` : il est **relatif au PIC**. Un seul instant
fort (plosive, rire, on s'approche du micro) suffit à désensibiliser toute la détection. Sur la
prise libre, maxRMS = 0,3608 alors que la MÉDIANE des trames vaut 0,0247 : le pic est 14 fois la
médiane, donc le seuil (0,0649) passe au-dessus de la parole ordinaire.
`git log -S` : ce 0,18 a été posé au TOUT PREMIER commit de prosodie (32ba743, « EXPÉRIMENTAL »),
sans un commentaire ni une mesure. Tout repose dessus depuis.

COMMENT TRANCHER SANS SE MENTIR. Deux critères indépendants, et il faut les DEUX :
  ① PHYSIOLOGIE : en parole continue on phonatoire ~60-80 % du temps. Un détecteur qui rend 21 %
    de parole se trompe, quelle que soit la suite.
  ② VÉRITÉ TERRAIN : sur VoxPopuli (47 locuteurs, 655 virgules écrites par des humains), il doit
    exister un seuil de pause où le NOMBRE de silences colle au NOMBRE de virgules.
Un détecteur qui satisfait ① mais jamais ② ne sert à rien, et réciproquement.

⚠️ CONSÉQUENCE À NE PAS OUBLIER : la mesure d'hier (« 190 ms détecte 2,23 fois trop ») a été faite
AVEC CE DÉTECTEUR. Elle doit être refaite une fois le détecteur choisi — son « meilleur V = 350 ms »
compensait peut-être simplement le défaut.
"""
import io
import os
import json
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

DOSSIER = os.path.join('data_local', 'voix', 'voxpopuli_fr')
PAS_MS = 30


def rms(data, sr):
    import numpy as np
    n = int(sr * PAS_MS / 1000.0)
    t = len(data) // n
    if t < 2:
        return None
    return np.sqrt(np.mean(np.square(data[:t * n].reshape(t, n)), axis=1))


# ── LES DÉTECTEURS EN LICE. Chacun rend un seuil à partir des trames RMS.
def det_actuel(r):        # ce qui tourne en prod, jamais mesuré
    return max(0.008, float(r.max()) * 0.18)


def det_plancher(r):      # le plancher seul, sans le terme relatif au pic
    return 0.008


def det_bruit(r, k=3.0):  # ⭐ standard du domaine : estimer le PLANCHER DE BRUIT (décile bas)
    import numpy as np    # et se placer un facteur au-dessus. Insensible aux pics.
    return max(0.008, float(np.percentile(r, 10)) * k + 0.004)


def det_median(r, k=0.35):   # relatif à la MÉDIANE, pas au pic
    import numpy as np
    return max(0.008, float(np.median(r)) * k)


def det_borne(r):
    """⭐ CELUI QU'ON LIVRE. Le décile bas, mais BORNÉ PAR LA MOITIÉ DE LA MÉDIANE.
    La garde CI a exigé cette borne : l'estimation par décile suppose qu'au moins 10 % des trames
    sont du silence ; quelqu'un qui parle sans respirer fait monter le p10 au niveau de la PAROLE
    et le seuil s'emballe -> tout devient « silence ». Un seuil au-dessus de la moitié du niveau
    typique ne peut pas être un plancher de bruit, par construction."""
    import numpy as np
    p10 = float(np.percentile(r, 10))
    med = float(np.median(r))
    return min(max(0.008, p10 * 3 + 0.004), max(0.008, med * 0.5))


DETECTEURS = [
    ('actuel  max(0,008 ; pic x0,18)', det_actuel),
    ('plancher seul  0,008', det_plancher),
    ('bruit  p10 x3 + 0,004', det_bruit),
    ('médiane x0,35', det_median),
    ('⭐ LIVRÉ  p10x3+0,004 borné med/2', det_borne),
]


def silences(r, seuil):
    out = []
    run = 0
    for v in r:
        if v < seuil:
            run += 1
        else:
            if run:
                out.append(run * PAS_MS)
            run = 0
    if run:
        out.append(run * PAS_MS)
    return out[1:-1] if len(out) >= 2 else []   # on jette les bords (clips découpés)


def main():
    import numpy as np
    import soundfile as sf
    idx = os.path.join(DOSSIER, 'index.jsonl')
    if not os.path.exists(idx):
        print("corpus absent — lance d'abord : python dictee/voix_corpus_pull.py")
        return 1
    lignes = [json.loads(l) for l in io.open(idx, encoding='utf-8')]

    audio = []
    for r in lignes:
        data, sr = sf.read(os.path.join(DOSSIER, r['wav']), dtype='float32')
        v = rms(data, sr)
        if v is None:
            continue
        t = r['texte']
        interne = t[:-1] if t and t[-1] in '.!?' else t
        audio.append({'r': v, 'faible': interne.count(',') + interne.count(';') + interne.count(':'),
                      'duree': len(v) * PAS_MS})
    tot_faible = sum(a['faible'] for a in audio)
    tot_duree = sum(a['duree'] for a in audio)
    print('%d clips · %d virgules internes écrites · %.1f min\n' %
          (len(audio), tot_faible, tot_duree / 60000.0))

    for nom, fn in DETECTEURS:
        parole = 0
        for a in audio:
            s = fn(a['r'])
            parole += int((a['r'] >= s).sum()) * PAS_MS
        part = 100.0 * parole / tot_duree
        # ② le meilleur seuil de pause pour ce détecteur, et le ratio qu'il atteint
        best = None
        for V in range(60, 901, 10):
            n = 0
            for a in audio:
                n += sum(1 for d in silences(a['r'], fn(a['r'])) if d >= V)
            e = abs(n - tot_faible)
            if best is None or e < best[1]:
                best = (V, e, n)
        drapeau = 'OK' if 60 <= part <= 80 else ('TROP BAS' if part < 60 else 'TROP HAUT')
        print('%-32s parole %4.0f %%  [%s]' % (nom, part, drapeau))
        print('%-32s   meilleur seuil de pause %d ms -> %d silences pour %d virgules (ratio %.2f)'
              % ('', best[0], best[2], tot_faible, best[2] / tot_faible))
    return 0


if __name__ == '__main__':
    sys.exit(main())
