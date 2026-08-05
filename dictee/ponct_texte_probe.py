# -*- coding: utf-8 -*-
"""LE CANAL TEXTE DE LA PONCTUATION — celui qui nous manquait pour COMBINER.

POURQUOI (Rem) : « on va combiner les deux, encore une fois ce qu'on ne fait pas sérieusement
depuis le début ». Il a raison : on a deux canaux et on les traite en ALTERNATIVE. La littérature
va dans son sens — les +3 à +6 % de F1 apportés par l'acoustique sont mesurés EN AJOUT au texte.

CE QUI MANQUAIT POUR COMBINER : le canal TEXTE. On n'avait que des règles écrites à la main,
mesurées à ~60 % de précision (PR#379) — et j'avais pris ce plafond pour celui du TEXTE alors que
c'était celui de MES RÈGLES. La littérature place la virgule française à F1 0,831 en texte seul.

FORME CHOISIE : des TABLES CONDITIONNELLES À REPLI, la forme de `os-subj-lm.json.gz` qu'on
embarque déjà. Pas de réseau : ça doit tourner dans le navigateur à côté d'un tagger de 672 Ko.
Et surtout ça rend une DISTRIBUTION, pas une décision — c'est elle qu'on donnera à l'arbitrage OS
avec le canal audio.

⚠️⚠️ DEUX CORRECTIONS DE CONCEPTION SUR MA PREMIÈRE VERSION, et elles comptent :
① J'itérais sur `len(mots)-1` : **la ponctuation FINALE n'était ni apprise ni évaluée** — or c'est
   la plus importante en dictée, et son F1 sortait à 0,098 (mesuré sur un résidu bizarre).
② Je découpais par PHRASE. Mais l'ASR ne rend pas des phrases, il rend un FLUX. On entraîne et on
   évalue donc sur un flux de phrases CONCATÉNÉES : toute frontière devient interne, avec un vrai
   contexte des deux côtés. C'est la condition réelle d'emploi, pas une commodité de banc.

⚠️ MESURE : split par BLOC de flux (jamais par interstice), et F1 PAR MARQUE — la classe « rien »
pèse ~85 %, donc une exactitude globale de 85 % s'obtient en ne prédisant jamais rien.
"""
import io
import json
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# ⚠️ On n'enveloppe stdout QUE si ce fichier est le point d'entrée : importé depuis
# ponct_combine_probe, une seconde enveloppe FERME le flux du module appelant.
if __name__ == '__main__':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

D = 'data_local'
UD = os.path.join(D, 'ud_fr_gsd-train.conllu')
WIKT = os.path.join(D, 'fr', 'kaikki-frwikt.jsonl')


def phrases(limite_wikt=120000):
    out = []
    if os.path.exists(UD):
        for l in io.open(UD, encoding='utf-8'):
            if l.startswith('# text = '):
                t = l[9:].strip()
                if 20 < len(t) < 400 and t[-1] in '.!?':
                    out.append(t)
    n = 0
    if os.path.exists(WIKT):
        for l in io.open(WIKT, encoding='utf-8'):
            if n >= limite_wikt:
                break
            if '"examples"' not in l:
                continue
            try:
                o = json.loads(l)
            except Exception:
                continue
            for s in o.get('senses') or []:
                for ex in s.get('examples') or []:
                    t = (ex.get('text') or '').strip()
                    if 20 < len(t) < 400 and t[-1] in '.!?':
                        out.append(t)
                        n += 1
    return out


def decoupe(phrase):
    """-> (mots, marques) où marques[i] est la marque qui SUIT le mot i ('' si aucune)."""
    mots, marques, tampon = [], [], ''
    for ch in phrase:
        # ⚠️⚠️ LA TOKENISATION D'ENTRAÎNEMENT DOIT ÊTRE CELLE D'INFÉRENCE — sinon le modèle
        # apprend des contextes qui n'existeront jamais. `DC.toks` (le moteur) COUPE au trait
        # d'union ; garder « - » ici faisait de « Dessine-moi » UN token à l'entraînement et DEUX
        # à l'exécution. La garde CI l'a attrapé en sortie : « Dessine,-moi, un mouton » —
        # exactement la régression que Rem avait signalée en PR#380.
        if ch.isalpha() or ch in "'’" or ch.isdigit():
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


def flux(liste, par_bloc=12):
    """CONCATÈNE des phrases en blocs : c'est ce que l'ASR produit — un flux, pas des phrases.
    Toute frontière de phrase devient un interstice INTERNE, avec du contexte des deux côtés."""
    for k in range(0, len(liste) - par_bloc, par_bloc):
        mots, marques = [], []
        for p in liste[k:k + par_bloc]:
            m, q = decoupe(p)
            if len(m) >= 3:
                mots += m; marques += q
        if len(mots) >= 20:
            yield mots, marques


class Modele(object):
    """Tables conditionnelles à REPLI, du plus spécifique au plus général."""

    NIV = 5

    def __init__(self):
        self.t = [dict() for _ in range(self.NIV)]
        self.pri = {'': 0, ',': 0, '.': 0}

    @staticmethod
    def cles(mots, tg, i, depuis):
        """Les contextes, du plus spécifique au plus général.
        `depuis` = nombre de mots depuis la dernière marque : en français les marques ne se
        collent pas, et c'est une information que le seul voisinage ne porte pas."""
        g = mots[i].lower()
        d = mots[i + 1].lower() if i + 1 < len(mots) else '</s>'
        pg2 = tg[i - 1] if i > 0 else '<s>'
        pg = tg[i]
        pd = tg[i + 1] if i + 1 < len(tg) else '</s>'
        pd2 = tg[i + 2] if i + 2 < len(tg) else '</s>'
        loin = 'L' if depuis >= 6 else ('M' if depuis >= 3 else 'C')
        return [(g, d, loin),
                (pg2, pg, pd, pd2, d),
                (pg, pd, d),
                (pg2, pg, pd, pd2, loin),
                (pg, pd, loin)]

    def entraine(self, mots, tg, marques):
        depuis = 0
        for i in range(len(mots)):
            m = marques[i]
            for niv, c in enumerate(self.cles(mots, tg, i, depuis)):
                dd = self.t[niv].get(c)
                if dd is None:
                    dd = self.t[niv][c] = {'': 0, ',': 0, '.': 0}
                dd[m] += 1
            self.pri[m] += 1
            depuis = 0 if m else depuis + 1

    def distribution(self, mots, tg, i, depuis, mini=10):
        for niv, c in enumerate(self.cles(mots, tg, i, depuis)):
            dd = self.t[niv].get(c)
            if dd and sum(dd.values()) >= mini:
                s = float(sum(dd.values()))
                return {k: v / s for k, v in dd.items()}
        s = float(sum(self.pri.values())) or 1.0
        return {k: v / s for k, v in self.pri.items()}


def main():
    import correcteur_probe as C
    random.seed(20260805)

    P = phrases()
    if len(P) < 500:
        print('corpus insuffisant (data_local absent ?) — %d phrases' % len(P))
        return 0
    random.shuffle(P)
    coupe = int(0.85 * len(P))
    blocs_tr = list(flux(P[:coupe]))
    blocs_te = list(flux(P[coupe:]))
    print('%d phrases -> %d blocs de flux entraînement · %d test (split PAR BLOC)'
          % (len(P), len(blocs_tr), len(blocs_te)))

    M = Modele()
    for mots, marques in blocs_tr:
        M.entraine(mots, C.pos_tags(mots) or ['X'] * len(mots), marques)
    print('tables : ' + ' · '.join(str(len(x)) for x in M.t))

    vp = {',': 0, '.': 0}; fp = {',': 0, '.': 0}; fn = {',': 0, '.': 0}
    n = 0
    for mots, marques in blocs_te:
        tg = C.pos_tags(mots) or ['X'] * len(mots)
        depuis = 0
        for i in range(len(mots)):
            n += 1
            d = M.distribution(mots, tg, i, depuis)
            pred = max(d, key=lambda k: d[k])
            vrai = marques[i]
            for m in (',', '.'):
                if pred == m and vrai == m: vp[m] += 1
                elif pred == m and vrai != m: fp[m] += 1
                elif pred != m and vrai == m: fn[m] += 1
            depuis = 0 if vrai else depuis + 1

    print('\n%d interstices de test' % n)
    print('%-10s %8s %8s %8s   %s' % ('marque', 'précis.', 'rappel', 'F1', 'support'))
    for m, nom in ((',', 'virgule'), ('.', 'point')):
        p = vp[m] / float(vp[m] + fp[m]) if (vp[m] + fp[m]) else 0.0
        r = vp[m] / float(vp[m] + fn[m]) if (vp[m] + fn[m]) else 0.0
        f = 2 * p * r / (p + r) if (p + r) else 0.0
        print('%-10s %7.1f%% %7.1f%% %7.3f   %d' % (nom, 100 * p, 100 * r, f, vp[m] + fn[m]))
    print('\nrepère littérature (texte seul, FR) : virgule F1 0,831 · point 0,945')
    print('  -> modèle VOLONTAIREMENT minuscule (tables à repli, embarquables). L\'écart dit ce')
    print('     qu\'un transformer achète — et ce qu\'il coûterait à embarquer.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
