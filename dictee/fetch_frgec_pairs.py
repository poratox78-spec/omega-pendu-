# -*- coding: utf-8 -*-
u"""RÉCOLTE de vraies paires faute→correction FRANÇAISES dans French_GEC (45 M paires Wikipédia).

POURQUOI CE LOADER EN PLUS DE `fetch_gec_corpus.py` (04/09→07/09/2026). Le goulot du projet reste
les DONNÉES : le corpus dys réel est privé et petit, `corpus_gec_fr.jsonl` fait 98 paires, et le
seul gisement de vraies corrections déjà tiré (WiCoPaCo, 138 495 paires dans data_local) est sous
GFDL — non redistribuable. `French_GEC` est le MÊME GENRE de source (historiques de révision de
Wikipédia) mais :
  · ~45 M de paires (X = phrase avant, y = phrase après) contre ~180 k pour WiCoPaCo ;
  · **CC BY-SA 4.0** annoncée à la source (Kaggle isakbiderre/french-gec-dataset) = la licence de
    Lexique 4, donc un dérivé PEUT être redistribué avec attribution + partage à l'identique ;
  · téléchargeable sans compte (miroir HF FrancophonIA/French_GEC, 20 CSV, chunk_0 = 1,3 Go).

⚠️ CE QUE LE CORPUS N'EST PAS — mesuré, pas supposé (07/09/2026, 30 Mio de chunk_0 = 71 580 paires) :
  · 4 524 paires (6,3 %) ont X == y : du bruit pur ;
  · 30,6 % ne changent qu'UN mot, mais l'auteur le dit lui-même et la mesure le confirme : beaucoup
    de ces changements sont FACTUELS, pas orthographiques (« 1980 »→« 1982 », « Leszek »→« Lech ») ;
  · le registre est WIKIPÉDIA — déjà mesuré comme un PIÈGE DE FRÉQUENCE pour le LM de la voie B
    (cf. `build_asr_lm.py` : couverture ×240, score 81 %→79 %). Ce n'est pas de l'écrit d'élève.

D'OÙ LE FILTRE, qui est tout l'intérêt du script : on ne garde que la signature d'une VRAIE faute
d'orthographe — un seul mot remplacé, la forme source ABSENTE du lexique (705 653 formes) et la
forme cible PRÉSENTE. Mesuré sur le même échantillon : 2 436 paires retenues, soit 3,40 % des paires
lues → de l'ordre de 1,5 M sur les 45 M. 1 184 d'entre elles (48,6 %) ont la MÊME clé phonétique que
la correction : « théatre »→« théâtre », « inconue »→« inconnue », « nourissant »→« nourrissant »,
« aprsè »→« après ». Le filtre laisse passer du bruit (« pinde »→« macédoine ») : ces paires sont un
GISEMENT À TRIER, pas un gold. Ne jamais les compter comme une mesure du produit.

  LEX4=… python3 dictee/fetch_frgec_pairs.py [--mo 30] [--chunk 0 | --chunks 0,1,2,3]
  → data_local/frgec_pairs.jsonl   {bad, good, x, y}  (bad/good = les deux mots ; x/y = les phrases)

Absence-safe : sans Lexique 4 (licence, hors git) la sonde SAUTE et rend 0, comme les autres.
"""
import difflib
import io
import json
import os
import re
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

URL = ('https://huggingface.co/datasets/FrancophonIA/French_GEC/resolve/main/'
       'dataset_chunk_%d.csv')
OUT = os.path.join(ROOT, 'data_local', 'frgec_pairs.jsonl')
STRIP = u"«»\"'’,;:.!?()[]…—–-"
MOT = re.compile(u"[a-zà-ÿœæ'’-]+")


def _arg(nom, defaut):
    return int(sys.argv[sys.argv.index(nom) + 1]) if nom in sys.argv else defaut


def main():
    import speller_probe as S
    if not os.path.exists(S.LEX):
        print(u'· FRGEC : SAUTÉ (Lexique 4 absent — garde locale, cf. dev.sh)')
        return 0
    mo = _arg('--mo', 30)
    if '--chunks' in sys.argv:                       # plusieurs tranches : --chunks 0,1,2,3
        chunks = [int(x) for x in sys.argv[sys.argv.index('--chunks') + 1].split(',')]
    else:
        chunks = [_arg('--chunk', 0)]

    import csv
    rows = []
    for ch in chunks:
        req = urllib.request.Request(URL % ch, headers={'Range': 'bytes=0-%d' % (mo * 1048576)})
        raw = urllib.request.urlopen(req, timeout=600).read().decode('utf-8', 'replace')
        raw = raw[:raw.rfind('\n')]                  # la dernière ligne est coupée par le Range
        r = list(csv.DictReader(io.StringIO(raw)))
        print(u'  chunk %d : %d paires' % (ch, len(r)))
        rows += r
    chunk = ','.join(str(c) for c in chunks)
    sp = S.Speller()
    W = sp.WORDS
    ident = un_mot = 0
    gardees = []
    for r in rows:
        a, b = (r.get('X') or u'').split(), (r.get('y') or u'').split()
        if a == b:
            ident += 1
            continue
        ops = [o for o in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes()
               if o[0] != 'equal']
        if len(ops) != 1 or ops[0][0] != 'replace':
            continue
        if ops[0][2] - ops[0][1] != 1 or ops[0][4] - ops[0][3] != 1:
            continue
        un_mot += 1
        wa = a[ops[0][1]].strip(STRIP).lower()
        wb = b[ops[0][3]].strip(STRIP).lower()
        if not wa or not wb or wa == wb:
            continue
        if not MOT.fullmatch(wa) or not MOT.fullmatch(wb):
            continue
        if wa in W or wb not in W:                   # LA signature : source hors lexique, cible dedans
            continue
        gardees.append({'bad': wa, 'good': wb, 'x': r.get('X') or u'', 'y': r.get('y') or u''})

    phon = sum(1 for g in gardees if S.phon_key(g['bad']) == S.phon_key(g['good']))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with io.open(OUT, 'w', encoding='utf-8') as f:
        for g in gardees:
            f.write(json.dumps(g, ensure_ascii=False) + u'\n')
    n = len(rows) or 1
    print(u'· FRGEC chunks %s, %d Mio : %d paires lues, %d identiques (%.1f %%), %d à un seul mot'
          % (chunk, mo, len(rows), ident, 100.0 * ident / n, un_mot))
    print(u'  → %d paires retenues (%.2f %% des lues), dont %d de même clé phonétique (%.1f %%)'
          % (len(gardees), 100.0 * len(gardees) / n, phon, 100.0 * phon / max(1, len(gardees))))
    print(u'  → %s' % OUT)
    return 0


if __name__ == '__main__':
    sys.exit(main())
