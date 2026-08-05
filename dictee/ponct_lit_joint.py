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
            f.write(json.dumps({'wav': r['wav'], 'loc': r['locuteur'], 'mots': mots,
                                'marques': marques, 'sil': sil_apres}, ensure_ascii=False) + '\n')
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
