# -*- coding: utf-8 -*-
"""Tire une TRANCHE de VoxPopuli-FR : du son de VRAIE VOIX HUMAINE avec sa transcription PONCTUÉE.

POURQUOI ON A BESOIN DE ÇA
--------------------------
Nos seuils de ponctuation (COMMA=190 ms, PERIOD=600 ms) sont calibrés sur **UNE voix** — celle de
Rem — et **trois prises**. Les trois prises ont d'ailleurs montré que l'optimum de la virgule se
déplace d'un facteur deux d'une lecture à l'autre chez le MÊME locuteur. Autant dire qu'on ne sait
pas si 190/600 sont des constantes de la langue ou des constantes de Rem.

VoxPopuli-FR répond exactement à ça : **211 h, 534 locuteurs**, et surtout le champ `raw_text`
**garde la ponctuation d'origine** (`normalized_text` la supprime — c'est celui-là qu'il ne faut
PAS prendre). Licence **CC0**. Parole de séance parlementaire : ni lue-préparée, ni conversation —
c'est le registre le plus proche de quelqu'un qui dicte un message.

⚠️ CE QUE CE CORPUS NE PEUT PAS FAIRE, et il faut le dire tout de suite : il ne teste PAS la voie A
de bout en bout. Web Speech **n'utilise pas** le périphérique de capture simulé de Chrome (mesuré,
`no-speech` sur un faux micro) — on ne peut donc pas lui rejouer un fichier. Ce corpus sert à
mesurer **la loi physique** : une pause de N ms annonce-t-elle une virgule, un point, ou rien ?
Ça, c'est indépendant du moteur, et c'est précisément ce qui est calibré sur une seule voix.

FRUGALITÉ : on ne télécharge pas les 955 Mo du fichier. `pyarrow` lit les **groupes de lignes**
par requêtes de plage HTTP ; on s'arrête dès qu'on a le nombre de clips demandé.
Sortie dans data_local/ (gitignoré) : un .wav 16 kHz mono par clip + un index .jsonl.
"""
import io
import json
import os
import sys
import argparse

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

DEPOT = 'facebook/voxpopuli'
FICHIER = 'fr/validation-00000-of-00001.parquet'
SORTIE = os.path.join('data_local', 'voix', 'voxpopuli_fr')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=300, help='nombre de clips à extraire')
    ap.add_argument('--min-mots', type=int, default=12,
                    help='ignorer les clips trop courts : sans frontière interne ils '
                         'n\'apprennent rien sur la ponctuation')
    a = ap.parse_args()

    import numpy as np
    import soundfile as sf
    import pyarrow.parquet as pq
    from huggingface_hub import HfFileSystem

    os.makedirs(SORTIE, exist_ok=True)
    fs = HfFileSystem()
    chemin = 'datasets/%s/%s' % (DEPOT, FICHIER)

    print('lecture par tranches de %s' % chemin)
    with fs.open(chemin, 'rb') as f:
        pf = pq.ParquetFile(f)
        print('  %d groupes de lignes, %d lignes au total'
              % (pf.num_row_groups, pf.metadata.num_rows))
        print('  colonnes : %s' % ', '.join(pf.schema_arrow.names))

        index = []
        garde = 0
        for g in range(pf.num_row_groups):
            t = pf.read_row_group(g, columns=['audio_id', 'audio', 'raw_text',
                                              'normalized_text', 'speaker_id', 'gender'])
            for r in t.to_pylist():
                txt = (r.get('raw_text') or '').strip()
                # ⚠️ c'est raw_text qui porte la ponctuation ; normalized_text est nu.
                if len(txt.split()) < a.min_mots:
                    continue
                # pas de ponctuation interne -> le clip n'a rien à nous apprendre
                if not any(c in txt[:-1] for c in ',.;:!?'):
                    continue
                au = r['audio']
                data, sr = sf.read(io.BytesIO(au['bytes']), dtype='float32')
                if getattr(data, 'ndim', 1) > 1:
                    data = data.mean(1)
                # ⚠️ les audio_id de VoxPopuli portent l'horodatage de séance avec des « : »
                # (« …_20090309-20:37:55_7 ») — interdit dans un nom de fichier Windows.
                nom = '%s.wav' % ''.join(c if (c.isalnum() or c in '-_') else '_'
                                         for c in r['audio_id'])
                sf.write(os.path.join(SORTIE, nom), data, sr)
                index.append({'wav': nom, 'sr': sr, 'duree_ms': int(1000 * len(data) / sr),
                              'texte': txt, 'nu': (r.get('normalized_text') or '').strip(),
                              'locuteur': r.get('speaker_id'), 'genre': r.get('gender')})
                garde += 1
                if garde >= a.n:
                    break
            print('  groupe %d -> %d clips gardés' % (g, garde))
            if garde >= a.n:
                break

    with io.open(os.path.join(SORTIE, 'index.jsonl'), 'w', encoding='utf-8') as f:
        for r in index:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')

    locs = len(set(r['locuteur'] for r in index))
    secs = sum(r['duree_ms'] for r in index) / 1000.0
    print('\n%d clips · %d locuteurs distincts · %.1f s de parole' % (len(index), locs, secs))
    print('-> %s' % SORTIE)
    for r in index[:3]:
        print('\n  %s (%d ms, locuteur %s)\n    %s' %
              (r['wav'], r['duree_ms'], r['locuteur'], r['texte'][:150]))


if __name__ == '__main__':
    main()
