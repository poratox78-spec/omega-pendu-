# -*- coding: utf-8 -*-
"""CE QU'UNE VRAIE ANCRE TEMPORELLE RAPPORTERAIT — le plafond, chiffré.

LE BLOCAGE, établi cette semaine. En voie A on a DEUX moteurs qui ne partagent pas d'horloge :
Google a les MOTS, notre double capture a le TEMPS, et RIEN ne les relie. Les `ftimes` datent
l'ARRIVÉE des résultats (la latence de Google), pas la parole. Conséquence mesurée : on ne sait
poser une marque QU'AUX frontières de segment, et les virgules du français — qui vivent vers
350 ms — n'y apparaissent presque jamais, Google ne coupant que sur des pauses ≥ 600 ms.

LA QUESTION QUE CE PROBE TRANCHE : est-ce que ça VAUT le coup d'aller chercher une ancre ?
Autrement dit — si on avait l'alignement mot↔temps, la ponctuation ferait combien ?

COMMENT ON LE MESURE SANS RIEN CONSTRUIRE. La voie B (`asr_voix.py`, wav2vec2) a cet alignement
POUR DE VRAI : une étiquette par frame de 20 ms, la frontière de mot EST un indice de frame.
On l'utilise donc comme ALIGNEUR — pas comme transcripteur — sur le WAV de Rem, dont on connaît
les 8 phrases de référence. Les marques sont posées aux VRAIES frontières de mots, avec les
VRAIS silences. Le score obtenu est le PLAFOND : ce que la voie A atteindrait si elle avait
l'ancre, et rien de plus.

⚠️ CE N'EST PAS UNE LIVRAISON ET ÇA NE PEUT PAS L'ÊTRE : wav2vec2 est Python. Le but est de
savoir si un aligneur embarqué (ONNX/WASM) mérite d'être payé, ou si le plafond est trop bas
pour justifier la dépense. Un chiffre, pour décider — pas une fonctionnalité.
"""
import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

WAV = os.path.join('data_local', 'voix', 'omega_asr_rec.wav')
COMMA_MS, PERIOD_MS = 190, 600          # les seuils de la voie A, tels qu'ils sont livrés
FR_MS = 20                              # une frame wav2vec2

# Les 8 phrases réellement lues par Rem (référence de asr_voix_test.py), avec LEUR ponctuation.
REF = [
    "Le petit chat blanc dort souvent sur le vieux fauteuil rouge.",
    "Ce matin, j'ai oublié mes clés sur la table.",
    "Il faut acheter du pain, du fromage et des pommes.",
    "Mon frère, celui qui habite à Lyon, arrive demain.",
    "Est-ce que tu viens avec nous ce week-end ?",
    "Quand j'aurai fini, je te préviendrai tout de suite.",
    "Le café est bon, mais il est un peu froid.",
    "Les enfants jouent dans le jardin depuis ce matin.",
]


def marques_ref():
    """-> liste de marques attendues, dans l'ordre, telles que Rem les a écrites."""
    out = []
    for p in REF:
        for ch in p:
            if ch in ',.?!':
                out.append('.' if ch in '.?!' else ',')
    return out


def main():
    if not os.path.exists(WAV):
        print('WAV absent (%s) — probe non exécutable' % WAV)
        return 0
    try:
        import asr_voix as B
    except Exception as e:
        print('voie B indisponible : %s' % e)
        return 0

    print('aligneur : %s' % B.MODEL)
    # ⚠️ `transcribe` s'appuie sur les globales TORCH/PROC/AM et sur les identifiants PAD/BAR
    # (le token « | » de frontière de mot). Sans ce chargement, PROC vaut None et l'appel meurt —
    # on ne charge QUE le modèle acoustique, pas l'index de prononciation (inutile ici : on veut
    # l'ALIGNEMENT, pas la transcription).
    B.TORCH, B.PROC, B.AM = B.load_am()
    B.PAD = B.PROC.tokenizer.pad_token_id
    B.BAR = B.PROC.tokenizer.convert_tokens_to_ids('|')
    mots = B.transcribe(WAV)            # -> [(sampa, silence_avant_frames, frame_debut, frame_fin)]
    print('%d mots alignés sur le WAV (frames de %d ms)' % (len(mots), FR_MS))

    # ── LES SILENCES, AUX VRAIES FRONTIÈRES DE MOTS. C'est tout l'enjeu : ici le silence
    # « avant le mot k » est un fait mesuré sur le signal, pas une estimation.
    pauses = [w[1] * FR_MS for w in mots]
    poses = []
    for k in range(1, len(pauses)):
        d = pauses[k]
        if d >= PERIOD_MS:
            poses.append(('.', k, d))
        elif d >= COMMA_MS:
            poses.append((',', k, d))

    att = marques_ref()
    n_pt_att = att.count('.')
    n_vg_att = att.count(',')
    n_pt = sum(1 for m, _k, _d in poses if m == '.')
    n_vg = sum(1 for m, _k, _d in poses if m == ',')

    print('\nMARQUES ATTENDUES (ce que Rem a écrit) : %d points · %d virgules'
          % (n_pt_att, n_vg_att))
    print('MARQUES POSÉES par l\'ancre vraie      : %d points · %d virgules' % (n_pt, n_vg))

    # ── LE SEUL SCORE HONNÊTE ICI : le COMPTE. Sans transcription mot-à-mot fiable de la voie B
    # (84,9 % de mots justes, mesuré), on ne peut pas apparier marque à marque sans fabriquer
    # l'appariement. On compare donc les COMPTES par type — c'est faible, et c'est dit.
    def ecart(a, b):
        return abs(a - b), (100.0 * min(a, b) / max(a, b)) if max(a, b) else 100.0

    e_pt, r_pt = ecart(n_pt, n_pt_att)
    e_vg, r_vg = ecart(n_vg, n_vg_att)
    print('\nÉCART DE COMPTE   points %d (%.0f %% de recouvrement) · virgules %d (%.0f %%)'
          % (e_pt, r_pt, e_vg, r_vg))

    # ── LE POINT DE COMPARAISON QUI DÉCIDE : la voie A, elle, ne peut poser de marque QU'AUX
    # frontières de segment de Google. Sur ce même enregistrement, combien de pauses de la bande
    # VIRGULE l'ancre voit-elle, que la voie A ne peut structurellement PAS voir ?
    intra = [d for d in pauses[1:] if COMMA_MS <= d < PERIOD_MS]
    inter = [d for d in pauses[1:] if d >= PERIOD_MS]
    print('\n⭐ CE QUE L\'ANCRE DÉBLOQUE, et que la voie A ne peut pas atteindre :')
    print('   pauses de la bande VIRGULE [190, 600) vues par l\'ancre : %d' % len(intra))
    print('   pauses ≥ 600 ms (les seules que Google expose)          : %d' % len(inter))
    if len(intra):
        print('   -> l\'ancre donne accès à %d marques de plus, soit %.0f %% de marques en plus'
              % (len(intra), 100.0 * len(intra) / max(1, len(inter))))
    print('\n   (rappel mesuré : Rem a écrit %d virgules pour %d points — la voie A, qui ne voit'
          % (n_vg_att, n_pt_att))
    print('    que les frontières ≥ 600 ms, ne peut donc en atteindre presque aucune)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
