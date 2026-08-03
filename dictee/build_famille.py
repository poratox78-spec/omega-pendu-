# -*- coding: utf-8 -*-
# build_famille.py — TABLE DES TÉMOINS AUDIBLES (mot à lettre finale muette -> mot de la même famille
# où cette lettre s'ENTEND). Idée de Rem : l'orthographe française est de l'étymologie fossilisée, et
# la lettre muette qu'un dys oublie est audible AILLEURS, dans la famille du mot.
#   grand -> grande      (on entend le d)        petit  -> petite
#   amoureux -> amoureuse (le x devient s)       long   -> longue   (le g devient gu)
#
# C'est la méthode scolaire (« cherche un mot de la même famille »), et surtout ce n'est PAS du sens
# flou : la dérivation est DANS le lexique, donc vérifiable — même exigence que le reste du projet.
#
# AUCUNE ressource externe : tout sort de `extension/assets/speller.tsv.gz` (214 684 formes).
# Mesuré (sonde famille_probe) : ~80 % des mots à consonne finale muette sont couverts, stable de
# freq>=50 (96 cibles) à freq>=1 (1 191 cibles). Les ALTERNANCES valent +9 pts à elles seules.
#
#   PYTHONUTF8=1 python dictee/build_famille.py        -> dictee/famille.json
import gzip, io, json, os, collections

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'extension', 'assets', 'speller.tsv.gz')
OUT = os.path.join(HERE, 'famille.json')

VOW = set('aeiouyàâäéèêëîïôöùûü')
MUTE = 'dtgpcx'          # PAS le -s final : c'est presque toujours un pluriel/une conjugaison

# Suffixes dérivationnels/flexionnels FRANÇAIS attestés. Sans cette liste, « blanc -> blanco »
# (emprunt espagnol) passait pour une famille : le témoin doit être une VRAIE dérivation française.
SUF = ['e', 'es', 'er', 'ez', 'é', 'ée', 'és', 'ées', 'eur', 'euse', 'eux', 'aire', 'able', 'ible',
       'ation', 'ition', 'ement', 'ier', 'ière', 'iers', 'ique', 'iste', 'in', 'ine', 'ins', 'on',
       'onne', 'age', 'ard', 'arde', 'et', 'ette', 'esse', 'ir', 'ie', 'ien', 'ienne', 'al', 'ale',
       'aux', 'ure', 'oir', 'oire', 'if', 'ive', 'isme', 'u', 'ième', 'ièmes', 'ain', 'aine',
       'ois', 'oise', 'ies']

# ⭐ ALTERNANCES — la brique qui change tout (+9 pts mesurés). La consonne muette ne réapparaît pas
# telle quelle : elle se TRANSFORME devant la voyelle. Sans ça on conclut à un mur alors que le
# témoin EXISTE, simplement sous une autre graphie.
# ⚠️ L'alternance du -X doit être CONTEXTUELLE, pas libre. « x -> s » en général fabrique de FAUSSES
# FAMILLES avec de vrais mots français, donc invisibles à un test de forme : « prix -> prise »
# (pretium vs prendre), « voix -> voisin » (vox vs vicinus). Aucun lien, mais la forme colle.
# Seuls les motifs RÉGULIERS du genre sont sûrs : -eux/-euse, -oux/-ouce, -eux/-eille.
ALT = {'c': ['ch', 'qu', 'c'], 'g': ['gu', 'g'], 'f': ['v', 'f'],
       't': ['tt', 't'], 'd': ['d'], 'p': ['pp', 'p']}
ALT_X = [('eux', 'eus'), ('oux', 'ouc'), ('oux', 'ous')]   # amoureux->amoureuse, doux->douce, roux->rousse


def load(path):
    W, POS = {}, {}
    with gzip.open(path, 'rt', encoding='utf-8') as f:
        for ln in f:
            p = ln.rstrip('\n').split('\t')
            if len(p) < 2 or not p[0]:
                continue
            W[p[0]] = int(p[1]) / 1000.0
            if len(p) > 2:
                POS[p[0]] = p[2]
    return W, POS


def build(W, POS, floor=1.0, wfloor=1.0):
    idx = collections.defaultdict(list)
    for w in W:
        if len(w) >= 3:
            idx[w[:3]].append(w)
    cibles = [w for w in sorted(W)
              if len(w) >= 4 and w[-1] in MUTE and W[w] >= floor and all(c.isalpha() for c in w)
              and w[:-1] not in W                      # pas une flexion (« agit » <- « agi »)
              and 'V' not in POS.get(w, '')]           # pas une forme verbale (« avait », « maintenant »)
    fam, n_alt = {}, 0
    for w in cibles:
        stem, last = w[:-1], w[-1]
        best = None
        for v in idx.get(w[:3], ()):
            if len(v) <= len(w):
                continue
            reste, par_alt = None, False
            if v.startswith(w):
                reste = v[len(w):]
            elif last == 'x':                       # -x : SEULEMENT les motifs réguliers du genre
                for fin, rep in ALT_X:
                    if w.endswith(fin):
                        base = w[:-len(fin)] + rep
                        if v.startswith(base):
                            reste, par_alt = v[len(base):], True
                            break
            else:
                for a in ALT.get(last, ()):
                    if a != last and v.startswith(stem + a):
                        reste, par_alt = v[len(stem) + len(a):], True
                        break
            if not reste or reste[0] not in VOW or reste not in SUF:
                continue
            # ⚠️ PLANCHER SUR LE TÉMOIN. Le lexique contient des formes rarissimes ou parasites qui
            # passent le test de suffixe : « chat -> chaté », « champ -> champe », « cent -> cente »,
            # « chocolat -> chocolate » (anglais !). Un témoin sert à MONTRER à un dys — s'il n'est pas
            # un vrai mot courant, il nuit au lieu d'aider. La couverture mesurée disait qu'un témoin
            # EXISTE ; elle ne disait pas qu'il est MONTRABLE. Les deux ne sont pas la même question.
            if W.get(v, 0) < wfloor:
                continue
            # le MEILLEUR témoin : le plus court (donc le plus proche), puis le plus fréquent
            k = (len(v), -W.get(v, 0))
            if best is None or k < best[0]:
                best = (k, v, par_alt)
        if best:
            fam[w] = best[1]
            if best[2]:
                n_alt += 1
    return cibles, fam, n_alt


if __name__ == '__main__':
    W, POS = load(SRC)
    import sys
    # PLANCHER 5 = CALIBRÉ par balayage (0/1/5/20/100) sur la QUALITÉ des paires, pas sur le volume :
    #   0 -> 511 paires mais du poison pédagogique (chat->chaté, chocolat->chocolate, champ->champe)
    #   1 -> 229, encore douteux (cent->center)
    #   5 -> 121 paires, TOUTES montrables (chat->chaton, cent->centaine, avant->avantage)   <-- retenu
    #  20 -> 53, on perd des mots courants pour rien
    # ⚠️ La couverture « ~80 % » mesurée par la sonde disait qu'un témoin EXISTE dans le lexique.
    # Elle ne disait PAS qu'il est MONTRABLE à un enfant dys. Exiger un vrai mot fait tomber à ~10 %.
    # Ce sont deux questions différentes et c'est la SECONDE qui compte pour l'usage.
    wf = float(sys.argv[1]) if len(sys.argv) > 1 else 5.0
    cibles, fam, n_alt = build(W, POS, wfloor=wf)
    io.open(OUT, 'w', encoding='utf-8').write(json.dumps(fam, ensure_ascii=False, sort_keys=True))
    print('plancher témoin %g · lexique %d formes · cibles %d · témoins %d (%.1f %%) dont %d par ALTERNANCE'
          % (wf, len(W), len(cibles), len(fam), 100.0 * len(fam) / max(1, len(cibles)), n_alt))
    print('taille %s : %d octets' % (os.path.basename(OUT), os.path.getsize(OUT)))
    ech = [k for k in sorted(fam) if W.get(k, 0) >= 30][:18]
    print('échantillon :', ' · '.join('%s→%s' % (k, fam[k]) for k in ech))
