# -*- coding: utf-8 -*-
"""EXPORTE CE QUE L'ALIGNEUR VOIT, pour que le CANAL TEXTE puisse le corriger.

REPROCHE DE REM (2026-08-06), et il est fondé : « tu as mesuré que séparément, or on a toujours
trouvé un moyen de combiner ». C'est exact et c'est la faute de méthode de la journée.
  · l'aligneur SEUL, avec la vieille règle 190/600 : 0/12 sur la voix de Rem ;
  · le canal texte SEUL, tel qu'il est publié : 12 marques sur 27 ;
  · les deux ensemble : JAMAIS MESURÉ.
Or leurs forces sont complémentaires, et les chiffres le disent :
  · l'aligneur place la pause À ±1 MOT PRÈS DANS 89 % DES CAS (mais exactement dans 59 %) —
    il sait À PEU PRÈS OÙ, et il connaît la DURÉE, donc le TYPE de marque ;
  · le canal texte ne sait pas QUAND on s'est tu, mais il sait OÙ une marque est grammaticalement
    possible — « à la, plage » lui est interdit, « pain, du fromage » lui est naturel.
Un aligneur qui vise à un mot près et un modèle qui sait lequel des trois mots est légal : c'est
la définition d'une paire qui se complète, pas de deux concurrents.

CE FICHIER NE DÉCIDE RIEN. Il exporte, pour chaque pause détectée, le mot visé et la durée.
La combinaison et la mesure se font dans `voix_combine_probe.js`, côté Node — parce que c'est là
que vivent le tagger et `ponctDist` RÉELS, ceux qui sont livrés. Mesurer avec une ré-implémentation
Python du canal texte, ce serait mesurer autre chose que la livraison.
"""
import io, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import numpy as np
import voix_aligneur_syll_probe as A

WAV_REM = os.path.join(RACINE, 'data_local', 'voix', 'omega_asr_rec.wav')
LIT = os.path.join(RACINE, 'data_local', 'voix', 'lit_joint.jsonl')
WAVDIR = os.path.join(RACINE, 'data_local', 'voix', 'voxpopuli_fr')
SORTIE = os.path.join(RACINE, 'data_local', 'voix', 'combine_dump.json')

REF_REM = [
    "Le petit chat blanc dort souvent sur le vieux fauteuil rouge.",
    "Ce matin, j'ai oublié mes clés sur la table.",
    "Il faut acheter du pain, du fromage et des pommes.",
    "Mon frère, celui qui habite à Lyon, arrive demain.",
    "Est-ce que tu viens avec nous ce week-end ?",
    "Quand j'aurai fini, je te préviendrai tout de suite.",
    "Le train part à huit heures, ne sois pas en retard.",
    "Elle m'a dit qu'elle viendrait, mais je n'en suis pas sûr.",
]

def enveloppe_navigateur(x, sr):
    """⭐ LA TIMELINE TELLE QUE LE NAVIGATEUR LA PRODUIT, et non une enveloppe de laboratoire.
    saisie-vocale.html : toutes les 30 ms on lit `getFloatTimeDomainData` sur 1024 echantillons
    (= 21 ms a 48 kHz) et on garde UN RMS. Donc pas de 10 ms continu, mais un echantillon tous
    les 30 ms qui ne couvre que 21 ms — 9 ms sur 30 ne sont JAMAIS regardees.
    Mesurer sur une enveloppe continue et livrer ca, ce serait mesurer autre chose que la
    livraison : la faute exacte que la garde CI existe pour empecher.
    VERDICT MESURE : aucune degradation. Sur 93 clips, la chaine complete fait F1 0,309 sur cette
    grille contre 0,303 sur l'enveloppe continue — les pauses utiles durent >= 190 ms, soit au
    moins 6 echantillons."""
    pas = int(sr * 30 / 1000)
    fen = int(sr * 1024 / 48000)          # la fenetre reelle de l'AnalyserNode
    n = 1 + max(0, len(x) - fen) // pas
    e = np.empty(n, dtype=np.float32)
    for i in range(n):
        seg = x[i * pas:i * pas + fen]
        e[i] = float(np.sqrt(np.dot(seg, seg) / max(1, len(seg))))
    return e


def coupes_navigateur(x, sr, syl):
    """Meme chaine que `coupes_et_durees`, mais sur la timeline du navigateur (grille 30 ms)."""
    e = enveloppe_navigateur(x, sr)
    thr = A.seuil_bruit(e)
    sous = e < thr
    kmin = max(1, int(A.PAUSE_MIN_MS / 30))
    blocs, i, deb = [], 0, 0
    while i < len(e):
        if sous[i]:
            j = i
            while j < len(e) and sous[j]: j += 1
            if (j - i) >= kmin:
                if i > deb: blocs.append((deb, i))
                deb = j
            i = j
        else:
            i += 1
    if deb < len(e): blocs.append((deb, len(e)))
    if len(blocs) < 2: return []
    d = [float(b - a) for (a, b) in blocs]
    ssum = sum(d) or 1.0
    att = [v / ssum * sum(syl) for v in d]
    coupes = A.aligner(syl, att)
    dur = [(blocs[j + 1][0] - blocs[j][1]) * 30 for j in range(len(blocs) - 1)]
    return [(int(coupes[k]), int(dur[k])) for k in range(min(len(coupes), len(dur)))]


def coupes_et_durees(x, sr, syl, apprise=False):
    """Rend [(indice de mot vise, duree de la pause en ms)] pour un signal donne.
    ⚠️ `apprise` a disparu : la variante qui remplacait la duree par une COURBE DE SONORITE
    APPRISE (eleve distille de 2,9 Ko) a ete MESUREE-REFUTEE — la duree seule la bat une fois que
    le canal texte filtre (F1 0,480 contre 0,435 sur la voix de Rem). On ne garde pas un chemin
    mort : le probe mesure exactement ce qui est livre."""
    e = A.lisser(A.enveloppe(x, sr), A.LISSE_MS)
    blocs, _ = A.zones_parole(e, A.seuil_bruit(e))
    if len(blocs) < 2: return []
    d = [float(b - a) for (a, b) in blocs]; ssum = sum(d) or 1.0
    att = [v / ssum * sum(syl) for v in d]
    coupes = A.aligner(syl, att)
    # ⚠️ la duree d'une pause est le TROU ENTRE DEUX BLOCS, pas la n-ieme entree d'une liste de
    # silences : ceux de debut et de fin d'enregistrement ne separent aucun bloc (bug mesure,
    # il faisait tomber le score a 0/12).
    dur = [(blocs[j + 1][0] - blocs[j][1]) * A.HOP_MS for j in range(len(blocs) - 1)]
    return [(int(coupes[k]), int(dur[k])) for k in range(min(len(coupes), len(dur)))]


# ⭐ LE COMPTAGE NAIF : les GROUPES DE VOYELLES ECRITES, moins le « e » final muet.
# Enjeu : si ca suffit, l'aligneur est portable en JS en TROIS LIGNES, sans embarquer ni Lexique
# ni g2p. On ne le suppose pas — on le mesure contre le comptage lexical exact.
import re as _re
_VOY = _re.compile(r"[aeiouyàâäéèêëîïôöûüùœ]+", _re.I)
def nb_syll_naif(mot):
    m = (mot or '').lower().strip("'’-")
    if not m: return 0
    n = len(_VOY.findall(m))
    if n > 1 and m.endswith('e') and not m.endswith(('ee', 'ie', 'ue', 'oe')): n -= 1   # e muet final
    return max(1, n)


def mots_et_marques(phrases):
    mots, marq = [], []
    for phrase in phrases:
        for j in re.findall(r"[A-Za-zÀ-ÿœŒ'’-]+|[,.;:!?]", phrase):
            if re.match(r"^[,.;:!?]$", j):
                if mots: marq[-1] = ',' if j == ',' else '.'
            else:
                mots.append(j); marq.append('')
    return mots, marq


def main():
    out = {'rem': None, 'lit': []}
    if os.path.exists(WAV_REM):
        x, sr = A.lire_wav(WAV_REM)
        mots, marq = mots_et_marques(REF_REM)
        syl = [A.nb_syllabes(w) for w in mots]
        syln = [nb_syll_naif(w) for w in mots]
        out['rem'] = {'mots': mots, 'marques': marq,
                      'coupes': coupes_et_durees(x, sr, syl),
                      'coupes_duree': coupes_et_durees(x, sr, syl),
                      'coupes_naif': coupes_et_durees(x, sr, syln),
                      'coupes_nav': coupes_navigateur(x, sr, syl)}
        print('  syllabes : lexical %d · naif %d (ecart %d)'
              % (sum(syl), sum(syln), abs(sum(syl) - sum(syln))))
        print('REM : %d mots, %d pauses, %d (naif)'
              % (len(mots), len(out['rem']['coupes']), len(out['rem']['coupes_naif'])))
    n = 0
    for ligne in io.open(LIT, encoding='utf-8'):
        ligne = ligne.strip()
        if not ligne: continue
        d = json.loads(ligne)
        p = os.path.join(WAVDIR, d.get('wav', ''))
        if not os.path.exists(p): continue
        mots, sil, mq = d.get('mots') or [], d.get('sil') or [], d.get('marques') or []
        if len(mots) != len(sil) or len(mq) != len(mots) or len(mots) < 4: continue
        x, sr = A.lire_wav(p)
        if x is None: continue
        syl = [A.nb_syllabes(w) for w in mots]
        marq = [(',' if m == ',' else ('.' if m else '')) for m in mq]
        syln = [nb_syll_naif(w) for w in mots]
        out['lit'].append({'mots': mots, 'marques': marq,
                           'coupes': coupes_et_durees(x, sr, syl),
                           'coupes_naif': coupes_et_durees(x, sr, syln),
                      'coupes_nav': coupes_navigateur(x, sr, syl)})
        n += 1
    print('LIT : %d clips exportes' % n)
    io.open(SORTIE, 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False))
    print('ecrit ->', SORTIE)
    return 0


if __name__ == '__main__':
    sys.exit(main())
