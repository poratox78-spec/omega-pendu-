# -*- coding: utf-8 -*-
"""LE LIT DE MESURE JOINT — le seul endroit où les DEUX canaux parlent des MÊMES interstices.

POURQUOI IL FALLAIT LE CONSTRUIRE. On mesurait le texte sur des corpus écrits et l'audio sur des
prises de voix : deux chiffres qui ne se parlaient pas. Impossible de dire si combiner gagne.
VoxPopuli a le texte PONCTUÉ et l'AUDIO des mêmes énoncés — il ne manquait que l'alignement
mot↔temps, et la voie B (wav2vec2) l'a : une étiquette par frame de 20 ms, la frontière de mot
EST un indice de frame.

⚠️ L'ALIGNEMENT N'EST PAS FABRIQUÉ, ET C'EST LA CONDITION DE VALIDITÉ. wav2vec2 rend des
PHONÈMES, pas les mots du texte. On ne s'en sert donc QUE pour compter et dater les mots — et on
NE GARDE QUE LES CLIPS où le nombre de mots alignés est ÉGAL au nombre de mots du texte. Là, et
seulement là, la correspondance 1:1 dans l'ordre est une déduction, pas une hypothèse. Les clips
qui ne collent pas sont JETÉS et comptés : un lit de mesure qui accepte du bruit d'alignement
mesurerait le bruit.

CE QU'ON EN TIRE, pour chaque interstice entre deux mots :
  · la VRAIE marque (du `raw_text` de VoxPopuli, écrit par un humain) ;
  · la distribution du canal TEXTE (tables à repli, entraînées AILLEURS — UD + Wiktionnaire) ;
  · la distribution du canal AUDIO (durée de silence à la VRAIE frontière de mot).
Puis on compare : texte seul · audio seul · et les combinaisons.

Sortie : data_local/voix/lit_joint.jsonl (gitignoré). Usage :
    python dictee/ponct_lit_joint.py --n 120
"""
import argparse
import io
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

DOSSIER = os.path.join('data_local', 'voix', 'voxpopuli_fr')
SORTIE = os.path.join('data_local', 'voix', 'lit_joint.jsonl')
FR_MS = 20                      # une frame wav2vec2


def decoupe(phrase):
    """-> (mots, marques) où marques[i] est la marque qui SUIT le mot i."""
    mots, marques, tampon = [], [], ''
    for ch in phrase:
        if ch.isalpha() or ch in "'’-" or ch.isdigit():
            tampon += ch
        else:
            if tampon:
                mots.append(tampon); marques.append('')
                tampon = ''
            if ch in ',;:' and marques:
                marques[-1] = ','
            elif ch in '.!?…' and marques:
                marques[-1] = '.'
    if tampon:
        mots.append(tampon); marques.append('')
    return mots, marques


PAS_MS = 30      # notre trame de double capture


def mesure_rms(wav, al, nmots):
    """Le MÊME silence, mesuré comme la PRODUCTION le mesure : trames de 30 ms, RMS, seuil =
    plancher de bruit borné (le détecteur réparé en PR#384). L'ancre (où sont les frontières de
    mots) vient toujours de wav2vec2 — sinon on ne saurait pas où regarder — mais la DÉCISION
    parole/silence est la nôtre. C'est la seule façon de savoir ce que la combinaison vaut avec
    l'outil qu'on a VRAIMENT, et pas avec celui du banc."""
    import numpy as np
    import soundfile as sf
    a, sr = sf.read(wav, dtype='float32')
    if getattr(a, 'ndim', 1) > 1:
        a = a.mean(1)
    n = int(sr * PAS_MS / 1000.0)
    t = len(a) // n
    if t < 4:
        return [0] * nmots
    r = np.sqrt(np.mean(np.square(a[:t * n].reshape(t, n)), axis=1))
    p10, med = float(np.percentile(r, 10)), float(np.median(r))
    seuil = min(max(0.008, p10 * 3 + 0.004), max(0.008, med * 0.5))
    muet = r < seuil
    out = []
    for i in range(nmots):
        if i + 1 >= len(al):
            out.append(0); continue
        # ⚠️ PIÈGE DE LECTURE, corrigé après une mesure absurde (0 ms PARTOUT) : dans `asr_voix`,
        # le 4e champ n'est PAS la fin du mot i — le tuple est empilé AU MOMENT où le mot SUIVANT
        # commence, donc `fin(i) == début(i+1)` et la fenêtre était TOUJOURS VIDE. Un zéro aussi
        # net n'est jamais une propriété du signal, c'est une fenêtre dégénérée.
        # Le vrai silence est porté par `before` : il occupe [début(i+1) − before(i+1), début(i+1)).
        deb, avant = al[i + 1][2], al[i + 1][1]
        d0 = int((deb - avant) * FR_MS / PAS_MS)
        d1 = int(deb * FR_MS / PAS_MS)
        d0 = max(0, min(d0, t)); d1 = max(d0, min(d1, t))
        out.append(int(muet[d0:d1].sum()) * PAS_MS)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=120, help='nombre de clips à traiter')
    a = ap.parse_args()

    idx = os.path.join(DOSSIER, 'index.jsonl')
    if not os.path.exists(idx):
        print("corpus absent — lance d'abord : python dictee/voix_corpus_pull.py")
        return 1
    import asr_voix as B
    B.TORCH, B.PROC, B.AM = B.load_am()
    B.PAD = B.PROC.tokenizer.pad_token_id
    B.BAR = B.PROC.tokenizer.convert_tokens_to_ids('|')

    lignes = [json.loads(l) for l in io.open(idx, encoding='utf-8')][:a.n]
    gardes, jetes, ecarts = 0, 0, []
    with io.open(SORTIE, 'w', encoding='utf-8') as f:
        for k, r in enumerate(lignes):
            mots, marques = decoupe(r['texte'])
            if len(mots) < 6:
                continue
            try:
                al = B.transcribe(os.path.join(DOSSIER, r['wav']))
            except Exception:
                jetes += 1
                continue
            # ⚠️ LA GARDE : même nombre de mots, sinon la correspondance 1:1 serait une invention.
            if len(al) != len(mots):
                jetes += 1
                ecarts.append(len(al) - len(mots))
                continue
            # silence AVANT chaque mot -> silence APRÈS le mot i = pause du mot i+1
            pauses = [w[1] * FR_MS for w in al]
            sil_apres = [(pauses[i + 1] if i + 1 < len(pauses) else 0) for i in range(len(mots))]
            # ⭐⭐ DEUXIÈME MESURE DU MÊME SILENCE, avec NOTRE détecteur (question de Rem : « quel
            # audio ? »). `sil` vient des trames PAD/« | » de wav2vec2 — c'est le modèle acoustique
            # qui décide, pas nous. Or en production on n'a PAS wav2vec2 : on a un seuil d'ÉNERGIE
            # (RMS 30 ms, plancher de bruit borné). Mesurer la combinaison avec le silence de
            # wav2vec2 donnerait un chiffre qu'on ne peut pas atteindre. On enregistre donc les
            # DEUX, et on comparera : `sil` (idéal) contre `sil_rms` (le nôtre, atteignable).
            sil_rms = mesure_rms(os.path.join(DOSSIER, r['wav']), al, len(mots))
            f.write(json.dumps({'wav': r['wav'], 'loc': r['locuteur'], 'mots': mots,
                                'marques': marques, 'sil': sil_apres, 'sil_rms': sil_rms},
                               ensure_ascii=False) + '\n')
            gardes += 1
            if (k + 1) % 20 == 0:
                print('  %d/%d traités · %d gardés' % (k + 1, len(lignes), gardes), file=sys.stderr)

    print('\nclips GARDÉS %d · JETÉS %d (alignement mot-à-mot non vérifiable)' % (gardes, jetes))
    if ecarts:
        moy = sum(abs(x) for x in ecarts) / float(len(ecarts))
        print('  écart moyen de comptage sur les jetés : %.1f mot(s)' % moy)
    print('-> %s' % SORTIE)
    print('\n⚠️ Le taux de rejet est une INFORMATION, pas un échec : il dit à quel point wav2vec2')
    print('   segmente les mots comme le texte les écrit. On préfère 40 clips sûrs à 250 douteux.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
