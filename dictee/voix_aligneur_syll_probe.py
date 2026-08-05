# -*- coding: utf-8 -*-
"""L'ALIGNEUR SANS MODÈLE — caler les mots CONNUS sur le signal, pour retrouver l'ancre temporelle.

LE PROBLÈME, POSÉ PAR REM (2026-08-05). La deuxième capture existe depuis toujours et elle a été
créée POUR LA PONCTUATION (le commentaire de saisie-vocale.html le dit : « seuils repris de voie B »).
Mais dans le navigateur on ne garde d'elle que DEUX NOMBRES toutes les 30 ms — l'énergie et le
pitch — et on jette le signal. J'ai ensuite répété que « à l'intérieur d'un segment il n'y a aucune
ancre temporelle » comme si c'était une loi. Ce n'en est pas une : c'est la conséquence du fait
qu'on jette le son.

CE QUE L'ANCRE VAUT, DÉJÀ MESURÉ (voix_ancre_plafond_probe.py, PR#389) : sur la prise de Rem, avec
l'alignement wav2vec2, on atteint 7 points et 5 virgules sur 8 et 6 écrites — contre 12 marques
sur 27 aujourd'hui. Les pauses de la bande VIRGULE [190-600 ms] que Google ne peut PAS exposer :
+71 % de marques accessibles. C'est le plus gros levier de tout ce chantier.

L'IDÉE ICI : ON N'A PAS BESOIN DE RECONNAÎTRE, GOOGLE DONNE DÉJÀ LES MOTS.
Il faut seulement ALIGNER du texte connu sur de l'audio connu — le problème contraint, pas le
problème ouvert. Et pour ça on possède déjà tout :
  · `g2p()` + la phono lexicale de Lexique  -> les phonèmes de chaque mot
  · `syllabify_sampa()` (attaque maximale)  -> son NOMBRE DE SYLLABES
  · l'énergie du signal                     -> les NOYAUX syllabiques réellement prononcés
On cale la suite connue de syllabes sur les noyaux détectés. ZÉRO modèle acoustique, donc
embarquable tel quel dans le navigateur.

⚠️ CE N'EST PAS LE « PRORATA DE SYLLABES » DÉJÀ MESURÉ-RÉFUTÉ (54 % de placement exact, 2026-08-04).
Celui-là RÉPARTISSAIT les mots proportionnellement sur la durée SANS REGARDER LE SIGNAL. Ici on
DÉTECTE les noyaux dans le signal et on y ALIGNE la suite connue. Répartir n'est pas aligner.

LE BANC : les 93 clips de `lit_joint.jsonl`, où l'on connaît pour chaque mot le silence qui le suit
(mesuré par wav2vec2, trames de 20 ms). C'est la vérité-terrain de l'alignement.
L'UNITÉ : pour chaque VRAIE pause, l'aligneur la place-t-il APRÈS LE BON MOT ? (justesse / rappel)
"""
import io, json, math, os, sys, wave

HERE = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(HERE)
sys.path.insert(0, HERE)

try:
    import numpy as np
except ImportError:
    print('numpy requis'); sys.exit(1)

import decompose as D

LIT = os.path.join(RACINE, 'data_local', 'voix', 'lit_joint.jsonl')
WAVDIR = os.path.join(RACINE, 'data_local', 'voix', 'voxpopuli_fr')

HOP_MS = 10          # pas d'analyse
FEN_MS = 25          # fenêtre RMS
LISSE_MS = 50        # lissage de l'enveloppe avant détection de pics
ECART_MIN_MS = 80    # deux noyaux syllabiques ne peuvent pas être plus proches (syllabe FR ~150-250 ms)
PAUSE_MIN_MS = 190   # la bande VIRGULE commence là (calibration voie A d'origine)


# ── phonologie : le nombre de syllabes d'un mot, par les outils qu'on possède déjà ────────────
_CACHE = {}
def nb_syllabes(mot):
    """Priorité à la phono LEXICALE (`D.W2P`, table Lexique déjà chargée par decompose) ; repli
    sur le g2p sublexical pour l'OOV. C'est exactement la hiérarchie de `decompose.py` — on ne
    réinvente pas la route, on l'appelle."""
    m = (mot or '').lower().strip("'’-")
    if not m: return 0
    if m in _CACHE: return _CACHE[m]
    sampa = D.W2P.get(m)
    if not sampa:
        try: sampa = D.sublexical_phon(m)[0]
        except Exception: sampa = None
    if sampa:
        _, n = D.syllabify_sampa(sampa)
    else:                                     # dernier recours : les voyelles écrites
        n = sum(1 for c in m if c in 'aeiouyàâéèêëîïôöûüù')
    n = max(1, n)
    _CACHE[m] = n
    return n


# ── signal : enveloppe, noyaux, pauses ───────────────────────────────────────────────────────
def lire_wav(p):
    with wave.open(p, 'rb') as w:
        sr, n, sw, ch = w.getframerate(), w.getnframes(), w.getsampwidth(), w.getnchannels()
        brut = w.readframes(n)
    if sw != 2: return None, None
    x = np.frombuffer(brut, dtype=np.int16).astype(np.float32) / 32768.0
    if ch > 1: x = x.reshape(-1, ch).mean(axis=1)
    return x, sr


def enveloppe(x, sr):
    hop, fen = max(1, int(sr * HOP_MS / 1000)), max(1, int(sr * FEN_MS / 1000))
    n = 1 + max(0, (len(x) - fen)) // hop
    e = np.empty(n, dtype=np.float32)
    for i in range(n):
        s = x[i * hop:i * hop + fen]
        e[i] = math.sqrt(float(np.dot(s, s)) / max(1, len(s)))
    return e


def lisser(e, ms):
    k = max(1, int(ms / HOP_MS))
    if k < 2: return e
    noy = np.ones(k, dtype=np.float32) / k
    return np.convolve(e, noy, mode='same')


def seuil_bruit(e):
    """Le MÊME estimateur que le navigateur (saisie-vocale.html `_seuilSilence`) : plancher de
    bruit par décile bas, borné par la moitié de la médiane. On ne mesure pas ici un détecteur
    qu'on ne livrerait pas — c'est la faute qu'on a déjà payée avec le seuil relatif au pic."""
    v = np.sort(e)
    p10 = v[min(len(v) - 1, int(0.10 * len(v)))]
    med = v[min(len(v) - 1, int(0.50 * len(v)))]
    return min(max(0.008, p10 * 3 + 0.004), max(0.008, med * 0.5))


def zones_parole(e, thr):
    """Découpe l'enveloppe en (blocs de parole, pauses). Une pause = un creux >= PAUSE_MIN_MS."""
    sous = e < thr
    blocs, pauses, i, n = [], [], 0, len(e)
    kmin = int(PAUSE_MIN_MS / HOP_MS)
    deb = 0
    while i < n:
        if sous[i]:
            j = i
            while j < n and sous[j]: j += 1
            if (j - i) >= kmin:
                if i > deb: blocs.append((deb, i))
                pauses.append((i, j))
                deb = j
            i = j
        else:
            i += 1
    if deb < n: blocs.append((deb, n))
    return blocs, pauses


def noyaux_dans(e, a, b):
    """Compte les noyaux syllabiques : maxima locaux de l'enveloppe, espacés d'au moins
    ECART_MIN_MS et saillants au-dessus du creux voisin. C'est la définition acoustique usuelle
    du noyau (pic de sonorité) — et c'est ce qui fait la différence avec une répartition
    proportionnelle : on regarde le signal."""
    seg = e[a:b]
    if len(seg) < 3: return 1 if len(seg) else 0
    ecart = max(1, int(ECART_MIN_MS / HOP_MS))
    prom = 0.30 * (float(seg.max()) - float(seg.min()))    # saillance minimale
    pics = []
    for i in range(1, len(seg) - 1):
        if seg[i] >= seg[i - 1] and seg[i] > seg[i + 1]:
            g = seg[max(0, i - ecart):i].min() if i > 0 else seg[i]
            d = seg[i + 1:i + 1 + ecart].min() if i + 1 < len(seg) else seg[i]
            if seg[i] - max(g, d) >= prom:
                if not pics or (i - pics[-1]) >= ecart: pics.append(i)
                elif seg[i] > seg[pics[-1]]: pics[-1] = i
    return max(1, len(pics))


# ── L'ALIGNEMENT : partitionner les mots connus sur les blocs de parole détectés ──────────────
def attendu_par_bloc(blocs, noyaux, total_syll):
    """⭐ COMBIEN DE SYLLABES CHAQUE BLOC DE PAROLE DEVRAIT PORTER — et c'est ici que la première
    version se trompait. Je comptais les noyaux et je comparais ce compte AU NOMBRE ABSOLU de
    syllabes attendues. Le diagnostic l'a puni : le détecteur de pics ne trouve que ~50 % des
    noyaux (ratio mesuré 0,38 à 0,79 sur 12 clips), donc l'écart était systématiquement faux et
    l'alignement partait de travers — 26 % de placement exact.
    ⭐ Or on n'a PAS BESOIN de compter les noyaux : on CONNAÎT le nombre total de syllabes (il est
    dans le texte que Google nous donne) et on MESURE la durée totale de parole. Leur rapport est
    la durée moyenne d'une syllabe POUR CE LOCUTEUR ET CE CLIP — auto-calibrée, sans modèle et
    sans réglage. L'attendu d'un bloc suit de sa durée.
    Les noyaux détectés restent une SECONDE opinion : on les remet à l'échelle (ils ont un gain
    systématique, pas un biais de forme) et on moyenne les deux avis. Deux mesures indépendantes
    du même fait valent mieux qu'une — c'est la logique de l'OS, appliquée au signal."""
    duree = [float(b - a) for (a, b) in blocs]
    tot_d = sum(duree) or 1.0
    par_duree = [d / tot_d * total_syll for d in duree]
    tot_n = float(sum(noyaux)) or 1.0
    par_noyaux = [n / tot_n * total_syll for n in noyaux]
    return [0.5 * (par_duree[i] + par_noyaux[i]) for i in range(len(blocs))]


def aligner(syll_mots, noyaux_blocs):
    """Programmation dynamique : couper la suite de mots en autant de groupes CONTIGUS qu'il y a
    de blocs de parole, en minimisant l'écart entre le nombre de syllabes attendu par groupe et le
    nombre de noyaux détectés dans le bloc. Rend l'indice du DERNIER MOT de chaque groupe —
    c'est-à-dire, pour chaque pause, le mot après lequel elle tombe.
    ⚠️ Un groupe peut être vide : Google rend parfois plus de blocs que de coupures réelles
    (respiration), et forcer un mot par bloc fabriquerait des frontières."""
    n, m = len(syll_mots), len(noyaux_blocs)
    if m <= 1 or n == 0: return []
    cum = [0] * (n + 1)
    for i in range(n): cum[i + 1] = cum[i] + syll_mots[i]
    INF = float('inf')
    # co[j][i] = coût minimal pour placer les j premiers blocs sur les i premiers mots
    co = [[INF] * (n + 1) for _ in range(m + 1)]
    pre = [[0] * (n + 1) for _ in range(m + 1)]
    co[0][0] = 0.0
    for j in range(1, m + 1):
        for i in range(n + 1):
            for ip in range(i + 1):
                if co[j - 1][ip] == INF: continue
                c = co[j - 1][ip] + abs((cum[i] - cum[ip]) - noyaux_blocs[j - 1])
                if c < co[j][i]:
                    co[j][i] = c; pre[j][i] = ip
    i, coupes = n, []
    for j in range(m, 0, -1):
        ip = pre[j][i]
        if j > 1: coupes.append(ip)      # dernier mot du groupe j-1 = indice ip-1
        i = ip
    coupes.reverse()
    return [c - 1 for c in coupes if c >= 1]


def main():
    if not os.path.exists(LIT):
        print('lit joint absent'); return 1
    tot_j = tot_pred = tot_vrai = 0
    tot_j1 = 0                       # tolérance ±1 mot, pour situer l'erreur
    n_clips = 0
    for ligne in io.open(LIT, encoding='utf-8'):
        ligne = ligne.strip()
        if not ligne: continue
        d = json.loads(ligne)
        p = os.path.join(WAVDIR, d.get('wav', ''))
        if not os.path.exists(p): continue
        mots, sil = d.get('mots') or [], d.get('sil') or []
        if len(mots) != len(sil) or len(mots) < 4: continue
        x, sr = lire_wav(p)
        if x is None: continue
        e = lisser(enveloppe(x, sr), LISSE_MS)
        thr = seuil_bruit(e)
        blocs, pauses = zones_parole(e, thr)
        if len(blocs) < 2: continue
        n_clips += 1
        nb = [noyaux_dans(e, a, b) for (a, b) in blocs]
        syl = [nb_syllabes(w) for w in mots]
        att = attendu_par_bloc(blocs, nb, sum(syl))
        pred = set(aligner(syl, att))
        # VÉRITÉ : une pause réelle >= PAUSE_MIN_MS après le mot i (dernier interstice exclu :
        # c'est la fin d'enregistrement, pas une pause de parole).
        vrai = set(i for i in range(len(sil) - 1) if sil[i] >= PAUSE_MIN_MS)
        tot_pred += len(pred); tot_vrai += len(vrai)
        tot_j += len(pred & vrai)
        tot_j1 += sum(1 for i in pred if any(abs(i - k) <= 1 for k in vrai))
    print('ALIGNEUR SANS MODELE (energie + syllabation OMEGA) vs alignement wav2vec2')
    print('banc : %d clips reels\n' % n_clips)
    print('  pauses placees          : %d' % tot_pred)
    print('  pauses reelles          : %d' % tot_vrai)
    print('  APRES LE BON MOT        : %d  -> justesse %.0f %%   trouvees %.0f %%'
          % (tot_j, 100.0 * tot_j / max(1, tot_pred), 100.0 * tot_j / max(1, tot_vrai)))
    print('  a +/- 1 mot pres        : %d  -> justesse %.0f %%'
          % (tot_j1, 100.0 * tot_j1 / max(1, tot_pred)))
    print('\n  (rappel : le prorata de syllabes, qui NE REGARDE PAS le signal, faisait 54 % de')
    print('   placement exact — c\'est le chiffre a battre pour que l\'alignement ait un sens.)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
