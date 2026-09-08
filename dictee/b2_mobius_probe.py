# -*- coding: utf-8 -*-
u"""MÖBIUS EN BITS — la phonologie paie-t-elle l'orthographe, et réciproquement ?

POURQUOI CETTE SONDE EXISTE (2026-09-08, idée de Rem). Deux chantiers du dépôt sont la MÊME idée —
coupler la voie ORTHO et la voie PHONO — et tous deux sont classés falsifiés :

  · `L01_B2_MOBIUS` — « couplage croisé ortho↔phon (torsion de Möbius) », poids 0,05, livré OFF.
    Falsifié sur le WINRATE du pendu : la config maximale avec Möbius fait 10,7 %, identique à la
    partielle (`AUDIT_OMEGA.md`).
  · `cube_veto_probe.py` — les trois voies (ortho · phono · grammaire) en veto croisé.
    Falsifié sur (réparés, cassés) : meilleur taux de change 5 réparations perdues pour 1 casse
    évitée, et le plafond ORACLE rend +0/−1, soit un token sur 6 217.

CE QUE CES DEUX JUGES NE POUVAIENT PAS DIRE. Ni l'un ni l'autre ne distingue « il n'y a aucune
information à tirer du couplage » de « l'information existe, le câblage était faux ». Le winrate a
un plancher de bruit de ~200 parties sur 3 000 (JOURNAL 03/09) pour un couplage pesant 0,05 ; les
réparés/cassés portent sur 6 217 mots dont 92,7 % de sondes à faute unique, sous contrainte FP=0 et
pleins d'effets de seuil. Deux sorties DISCRÈTES et LOINTAINES, à basse résolution.

LE COMPRESSEUR EST UN JUGE À HAUTE RÉSOLUTION. L'entropie croisée d'un modèle EST une taille
compressée (−log2 p = bits) : chaque caractère devient une mesure, continue, sans seuil et sans
contrainte de faux positif. `b2_compress_probe.py` construit déjà les bonnes paires — (mot, phono
SAMPA), LES MÊMES MOTS des deux côtés — mais mesure H(ortho) et H(phono) SÉPARÉMENT. Le conditionnel
n'a jamais été mesuré. Or H(ortho | phono), c'est Möbius énoncé en bits.

⚠️ LA BONNE QUESTION. En français I(ortho ; phono) est ÉNORME — ce n'est pas à démontrer. La question
est : **B2 sait-il s'en servir ?** C'est exactement ce que les deux falsifications n'ont pas su dire.

⚠️ D'OÙ LE PLACEBO, obligatoire ici comme pour tout A/B du moteur pendu : on compare la VRAIE
phonologie à une phonologie MÉLANGÉE (permutation des mêmes chaînes). Les deux bras sont notés
exactement pareil — −log2 p(mot | préfixe) — donc aucun biais de convention (pas de premier
caractère facturé d'un côté et pas de l'autre) et une distribution de longueurs de préfixe
identique, puisque c'est une permutation. Seul l'ÉCART vrai − mélangé est interprétable :
B2 n'a jamais vu « SAMPA espace mot » à l'entraînement, donc le niveau absolu est hors distribution.

⚠️ INSTRUMENT VÉRIFIÉ AVANT LA MESURE : 100 % des caractères SAMPA et orthographiques employés ici
sont dans le vocabulaire de B2 (278 caractères). C'est le piège que `b2_compress_probe` documente —
une première version joignait les mots par un saut de ligne, hors-vocabulaire, donc supprimé, et le
modèle paraissait nul. L'INSTRUMENT, pas le modèle.

CE QUE ÇA PEUT ET NE PEUT PAS ACHETER. Un gain en bits n'est pas un gain en réparés à FP=0 : cette
sonde ne recâble rien et ne ressuscite aucun chantier. Elle remplace « ça n'a pas payé » par un
chiffre qui dit POURQUOI. Un écart nul ferme le couplage pour de bon, avec un instrument qui pouvait
le voir ; un écart franc laisse la falosification PRODUIT intacte mais en change le sens.

⚠️ CORPUS CONSERVATEUR : les paires viennent de l'index des HOMOPHONES, donc une même phonologie
porte plusieurs mots. La phonologie ne peut PAS déterminer le mot ici — l'écart mesuré est donc un
PLANCHER de ce que le couplage vaut, pas un plafond.

PAS DANS dev.sh, volontairement : la sonde exige le point de contrôle B2 (hors git, dans data_local)
et un GPU pour être rapide. En CI elle serait toujours SAUTÉE — une ligne verte qui ne mesure rien.
C'est une sonde de recherche, on la lance à la main.

  python3 dictee/b2_mobius_probe.py [n_mots]        (défaut 4000 ; GPU si dispo)
"""
import os, sys, io, json, math, random

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
DATA = os.environ.get('OMEGA_DATA', os.path.join(ROOT, 'data_local'))
SEP = ' '        # JAMAIS un saut de ligne : hors vocabulaire de B2 (cf. b2_compress_probe)


def charger(n, seed=1):
    """(mot, phono SAMPA) — mêmes mots des deux côtés. Reprend `paires` de b2_compress_probe."""
    from b2_compress_probe import paires
    return paires(n, seed)


def _modele():
    import torch
    for f in ('b2_model_14m.pt', 'b2_model.pt'):          # le _cu (curriculum) est MOINS BON en
        q = os.path.join(DATA, f)                          # langue générale — cf. b2_compress_probe
        if os.path.exists(q):
            ck = torch.load(q, map_location='cpu', weights_only=False)
            dev = 'cuda' if torch.cuda.is_available() else 'cpu'
            from b2_train import CharT
            m = CharT(len(ck['chars']), ck['cfg']).to(dev)
            m.load_state_dict(ck['model']); m.eval()
            return m, ck, dev, os.path.basename(q)
    return None, None, None, None


def cout_suffixe(m, ck, dev, lots, bs=64):
    u"""Pour chaque (préfixe, cible) : −Σ log2 p(c | tout ce qui précède) sur les caractères de la
    CIBLE seulement. Le préfixe n'est jamais facturé — c'est ce qui rend les bras comparables.
    Renvoie une liste de bits, alignée sur `lots`. Les paires trop longues pour le contexte du
    modèle sont tronquées PAR LA GAUCHE (on garde la fin du préfixe, la plus informative)."""
    import torch, torch.nn.functional as F
    chars = ck['chars']; i2 = {c: i for i, c in enumerate(chars)}
    CTX = ck['cfg']['CTX']
    out = [0.0] * len(lots)
    # Remplissage à GAUCHE par une ESPACE (pas par chars[0], arbitraire) : une espace devant un mot
    # est du français ordinaire, donc la contamination est bénigne — et surtout IDENTIQUE dans les
    # trois bras, qui sont triés et lotis pareil.
    PAD = i2.get(' ', 0)
    ordre = sorted(range(len(lots)), key=lambda k: len(lots[k][0]) + len(lots[k][1]))
    with torch.no_grad():
        for a in range(0, len(ordre), bs):
            idx = ordre[a:a + bs]
            seqs, ncib = [], []
            for k in idx:
                pre, cib = lots[k]
                ip = [i2[c] for c in pre if c in i2]
                ic = [i2[c] for c in cib if c in i2]
                s = (ip + ic)[-CTX:]
                nc = min(len(ic), len(s) - 1)              # au moins 1 caractère de contexte
                seqs.append(s); ncib.append(nc)
            L = max(len(s) for s in seqs)
            t = torch.full((len(seqs), L), PAD, dtype=torch.long, device=dev)
            for j, s in enumerate(seqs): t[j, L - len(s):] = torch.tensor(s, device=dev)
            lg = m(t)
            lp = F.log_softmax(lg.float(), -1)
            for j, k in enumerate(idx):
                nc = ncib[j]
                if nc <= 0: out[k] = float('nan'); continue
                # positions des caractères CIBLES dans la séquence paddée à gauche
                p0 = L - nc
                tg = t[j, p0:]                              # les nc caractères cibles
                pr = lp[j, p0 - 1:L - 1]                    # leurs prédictions
                out[k] = -(pr.gather(1, tg[:, None]).sum().item()) / math.log(2)
    return out


def bootstrap(d, n=2000, seed=7):
    u"""IC 95 % de la moyenne d'un échantillon APPARIÉ (différences), sans dépendance externe."""
    r = random.Random(seed); N = len(d)
    if N < 2: return (float('nan'), float('nan'))
    ms = []
    for _ in range(n):
        s = 0.0
        for _ in range(N): s += d[r.randrange(N)]
        ms.append(s / N)
    ms.sort()
    return (ms[int(0.025 * n)], ms[int(0.975 * n)])


def bras(m, ck, dev, pr, sens):
    u"""sens='o|p' : coder le MOT en conditionnant sur la PHONO. 'p|o' : l'inverse.
    Trois bras notés à l'identique — vrai préfixe, préfixe MÉLANGÉ (placebo), préfixe VIDE."""
    src = [(p, o) for o, p in pr] if sens == 'o|p' else [(o, p) for o, p in pr]
    mel = [x[0] for x in src]
    random.Random(11).shuffle(mel)
    # ⚠️ DEUXIÈME PLACEBO, et c'est LUI qui tranche. Un préfixe tiré au hasard n'a pas la LONGUEUR
    # du bon : or la longueur seule aide déjà le modèle à prévoir où le mot s'arrête. Le mélange
    # LIBRE mesure donc « la phonologie dit quel mot » ET « elle dit combien de lettres » confondus.
    # Le mélange à LONGUEUR ÉGALE (permutation dans chaque classe de longueur) neutralise le second
    # et ne laisse que l'identité — la seule chose que Möbius prétend transporter.
    par_len = {}
    for i, x in enumerate(src): par_len.setdefault(len(x[0]), []).append(i)
    mel_l = [None] * len(src)
    rr = random.Random(13)
    for L, ids in par_len.items():
        perm = ids[:]
        if len(perm) > 1:
            for _ in range(8):                     # dérangement approché : on re-tire tant que
                rr.shuffle(perm)                   # trop de points fixes subsistent
                if sum(1 for a, b in zip(ids, perm) if a == b) <= max(1, len(ids) // 20): break
        for a, b in zip(ids, perm): mel_l[a] = src[b][0]
    vrai = [(a + SEP, b) for a, b in src]
    plac = [(mel[i] + SEP, src[i][1]) for i in range(len(src))]
    plac_l = [(mel_l[i] + SEP, src[i][1]) for i in range(len(src))]
    # ⚠️ BRAS « PRÉFIXE VIDE » — il faut coder les MÊMES n caractères que les deux autres, sinon on
    # compare des quantités différentes et il paraît moins cher pour une raison COMPTABLE. Le 1er
    # caractère n'a aucun contexte : il est facturé log2(V), la convention de b2_compress_probe.
    nu = [(src[i][1][0], src[i][1][1:]) for i in range(len(src))]
    bv = cout_suffixe(m, ck, dev, vrai)
    bp = cout_suffixe(m, ck, dev, plac)
    bl = cout_suffixe(m, ck, dev, plac_l)
    bn = [x + math.log2(len(ck['chars'])) for x in cout_suffixe(m, ck, dev, nu)]
    return bv, bp, bl, bn


def main(n=4000):
    m, ck, dev, nom = _modele()
    if m is None:
        print('  modèle B2 absent de %s — banc ignoré.' % DATA); return 0
    pr = charger(n)
    if not pr:
        print('  paires absentes — banc ignoré.'); return 0
    V = len(ck['chars'])
    print(u'MÖBIUS EN BITS — %d paires (mot, SAMPA), modèle %s, %s, vocab %d'
          % (len(pr), nom, dev, V))
    print(u'  la seule lecture licite est l\'ÉCART vrai − mélangé : le niveau absolu est hors distribution.\n')
    code = 0
    for sens, titre in (('o|p', u'coder le MOT en connaissant sa PHONOLOGIE'),
                        ('p|o', u'coder la PHONOLOGIE en connaissant le MOT')):
        bv, bp, bl, bn = bras(m, ck, dev, pr, sens)
        moy = lambda x: (sum(v for v in x if not math.isnan(v)) /
                         max(1, sum(1 for v in x if not math.isnan(v))))
        ecart = lambda a: [a[i] - bv[i] for i in range(len(bv))
                           if not (math.isnan(bv[i]) or math.isnan(a[i]))]
        d, dl = ecart(bp), ecart(bl)
        N = len(dl)
        gagne = sum(1 for x in dl if x > 0)
        lo, hi = bootstrap(dl)
        lo0, hi0 = bootstrap(d)
        print(u'· %s' % titre)
        print(u'     préfixe VIDE (1er car. facturé log2 V)   : %7.2f bits' % moy(bn))
        print(u'     préfixe MÉLANGÉ libre                    : %7.2f bits' % moy(bp))
        print(u'     préfixe MÉLANGÉ à LONGUEUR ÉGALE         : %7.2f bits' % moy(bl))
        print(u'     préfixe VRAI                             : %7.2f bits' % moy(bv))
        print(u'     écart vrai − mélangé libre (longueur COMPRISE) : %6.2f bits  [IC95 %.2f ; %.2f]'
              % (sum(d) / max(1, len(d)), lo0, hi0))
        print(u'     ÉCART vrai − MÊME LONGUEUR (LA mesure)        : %6.2f bits  [IC95 %.2f ; %.2f]'
              % (sum(dl) / N, lo, hi))
        print(u'     le vrai préfixe gagne sur                : %d/%d mots (%.1f %%)'
              % (gagne, N, 100.0 * gagne / N))
        verdict = (u'INFORMATION UTILISÉE — au-delà de la seule longueur' if lo > 0.05 else
                   u'NUL — hors la longueur, le couplage n\'apporte rien que B2 sache lire'
                   if hi < 0.05 else u'INDÉCIS à cet effectif')
        print(u'     → %s\n' % verdict)
    print(u'  Lecture : un écart franc ne recâble rien (un gain en bits n\'est pas un gain en réparés')
    print(u'            à FP=0) — il dit que l\'information EXISTE et que le câblage était en cause.')
    print(u'            Un écart nul ferme le couplage, avec un instrument qui pouvait le voir.')
    return code


if __name__ == '__main__':
    sys.exit(main(int(sys.argv[1]) if len(sys.argv) > 1 else 4000) or 0)
