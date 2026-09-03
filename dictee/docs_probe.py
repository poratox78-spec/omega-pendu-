# -*- coding: utf-8 -*-
"""docs_probe.py — garde-fous des DOCUMENTS DE PILOTAGE (remise en ordre, plan du 24/08).

CLAUDE.md est une mémoire projet : un SOMMAIRE qui oriente, pas l'archive. Mesuré à la pose
(03/09/2026, main@#655) : 7 617 mots, 38 lignes de plus de 200 caractères — l'histoire s'y est entassée au
lieu de migrer vers les docs pointés (JOURNAL, ETAT_DES_LIEUX, CORRECTEUR…). Cette sonde rend le
budget STRUCTUREL : on ne PEUT plus laisser regonfler le fichier sans que la batterie rougisse.

Trois contrôles (tous évalués, exit 1 si au moins un rouge) :
  ① CLAUDE.md ≤ BUDGET_MOTS mots (défaut 1500) ;
  ② aucune ligne de CLAUDE.md > BUDGET_LIGNE caractères (défaut 200) — une ligne-fleuve est
    illisible en diff et invisible au grep ;
  ③ aucun ÉNONCÉ recopié entre CLAUDE.md et DOCTRINE.md — la doctrine vit dans DOCTRINE.md,
    CLAUDE.md la POINTE. Détection par shingles de SHINGLE_MOTS mots normalisés (défaut 10) :
    une phrase recopiée partage ses fenêtres de 10 mots ; deux docs indépendants n'en partagent
    aucune (étalonné : voir --etalonnage, qui rejoue le positif connu ET les paires négatives).

Surcharges par env : BUDGET_MOTS, BUDGET_LIGNE, SHINGLE_MOTS.
Usage : python3 dictee/docs_probe.py [--etalonnage]

Motif validé sur un positif connu (règle mémoire du 27/08) : avant le verdict, le détecteur ③
doit retrouver une phrase de DOCTRINE.md réinjectée dans un texte témoin — sinon exit 2
(« détecteur cassé »), jamais un vert par accident.
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
CLAUDE = os.path.join(ROOT, 'CLAUDE.md')
DOCTRINE = os.path.join(ROOT, 'DOCTRINE.md')

BUDGET_MOTS = int(os.environ.get('BUDGET_MOTS', '1500'))
BUDGET_LIGNE = int(os.environ.get('BUDGET_LIGNE', '200'))
SHINGLE_MOTS = int(os.environ.get('SHINGLE_MOTS', '10'))


def lire(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


# ── normalisation + shingles ────────────────────────────────────────────────────
def mots_normalises(texte):
    """Texte → liste de mots : minuscules, apostrophes typographiques unifiées, tout ce qui
    n'est pas alphanumérique (accents et grecs compris : isalnum) devient séparateur. Le
    balisage Markdown (`, *, #, |, →) disparaît donc de lui-même."""
    texte = texte.casefold().replace('’', "'").replace('ʼ', "'")
    out, courant = [], []
    for ch in texte:
        if ch.isalnum():
            courant.append(ch)
        else:
            if courant:
                out.append(''.join(courant))
                courant = []
    if courant:
        out.append(''.join(courant))
    return out


def shingles(mots, k):
    """Positions incluses pour pouvoir RECONSTRUIRE le passage fautif (pas juste le compter)."""
    d = {}
    for i in range(len(mots) - k + 1):
        d.setdefault(tuple(mots[i:i + k]), []).append(i)
    return d


def passages_communs(texte_a, texte_b, k):
    """Shingles partagés, regroupés en PASSAGES contigus du texte A (une phrase recopiée de
    n mots produit n-k+1 shingles consécutifs : on les fusionne pour un message lisible)."""
    ma, mb = mots_normalises(texte_a), mots_normalises(texte_b)
    sa, sb = shingles(ma, k), shingles(mb, k)
    communs = sorted(i for sh, pos in sa.items() if sh in sb for i in pos)
    passages = []
    for i in communs:
        if passages and i <= passages[-1][1] + 1:
            passages[-1][1] = i
        else:
            passages.append([i, i])
    return [' '.join(ma[d:f + k]) for d, f in passages]


def positif_connu():
    """Le détecteur doit retrouver une phrase de DOCTRINE réinjectée dans un témoin — sinon il
    est cassé et son silence sur CLAUDE.md ne prouverait RIEN."""
    mots = mots_normalises(lire(DOCTRINE))
    if len(mots) < SHINGLE_MOTS + 2:
        return False
    extrait = ' '.join(mots[5:5 + SHINGLE_MOTS + 2])
    temoin = 'Préambule sans rapport aucun. ' + extrait + '. Suite indépendante du témoin.'
    return len(passages_communs(temoin, lire(DOCTRINE), SHINGLE_MOTS)) >= 1


def etalonnage():
    """--etalonnage : le seuil (k mots) est bon si le positif connu matche ET si des paires de
    docs INDÉPENDANTS ne matchent pas. Rejouable à volonté quand on change k."""
    print('étalonnage du détecteur ③ (shingles de %d mots) :' % SHINGLE_MOTS)
    print('  positif connu (phrase de DOCTRINE réinjectée) : %s'
          % ('DÉTECTÉ ✓' if positif_connu() else 'RATÉ ✗ — détecteur cassé'))
    for a, b in [('README.md', 'DOCTRINE.md'), ('LOCAL_SETUP.md', 'DOCTRINE.md'),
                 ('REGLES_FR.md', 'DOCTRINE.md')]:
        pa, pb = os.path.join(ROOT, a), os.path.join(ROOT, b)
        if not (os.path.exists(pa) and os.path.exists(pb)):
            print('  paire %s vs %s : fichier absent, sautée' % (a, b))
            continue
        n = len(passages_communs(lire(pa), lire(pb), SHINGLE_MOTS))
        print('  indépendants %s vs %s : %d passage(s) commun(s) %s'
              % (a, b, n, '✓ (aucun attendu)' if n == 0 else '✗'))


# ── les trois contrôles ─────────────────────────────────────────────────────────
def main():
    if '--etalonnage' in sys.argv:
        etalonnage()
        return 0

    err = 0

    def ko(msg):
        nonlocal err
        err += 1
        print('  ✗ ' + msg)

    claude = lire(CLAUDE)

    # ① budget de mots. Définition : jetons séparés par des blancs (str.split), indépendante
    # de la locale. NB vérifié le 03/09 : `wc -w` en locale C compte ~7 % de moins sur ce
    # fichier — il jette les jetons entièrement non-ASCII (« — », « · », « → ») ; on ne
    # mime pas cet artefact, on l'annonce dans le message pour que le recoupement au wc ne
    # surprenne pas.
    n_mots = len(claude.split())
    if n_mots > BUDGET_MOTS:
        ko('CLAUDE.md fait %d mots (jetons séparés par blancs ; wc -w en locale C en compte '
           'un peu moins, il jette les symboles non-ASCII isolés) pour un budget de %d '
           '(dépassement ×%.1f). La mémoire projet est un SOMMAIRE : l\'histoire migre vers '
           'les docs pointés (JOURNAL, ETAT.md, ETAT_DES_LIEUX…) avec un pointeur — on ne '
           'supprime rien, on déplace.' % (n_mots, BUDGET_MOTS, n_mots / BUDGET_MOTS))

    # ② lignes-fleuves
    longues = [(i, len(l)) for i, l in enumerate(claude.split('\n'), 1) if len(l) > BUDGET_LIGNE]
    if longues:
        apercu = ', '.join('L%d (%d c.)' % (i, n) for i, n in longues[:8])
        if len(longues) > 8:
            apercu += ', … (+%d autres)' % (len(longues) - 8)
        ko('CLAUDE.md a %d ligne(s) de plus de %d caractères : %s. Une ligne-fleuve est '
           'illisible en diff et au grep — découper en phrases courtes ou migrer le contenu.'
           % (len(longues), BUDGET_LIGNE, apercu))

    # ③ énoncés recopiés CLAUDE.md ↔ DOCTRINE.md
    if not positif_connu():
        print('  ✗ AUTO-TEST : le détecteur de duplication ne retrouve pas un positif CONNU '
              '(phrase de DOCTRINE réinjectée) — sonde cassée, verdict sans valeur.')
        return 2
    doublons = passages_communs(claude, lire(DOCTRINE), SHINGLE_MOTS)
    for p in doublons:
        ko('énoncé recopié entre CLAUDE.md et DOCTRINE.md : « %s%s » — la doctrine vit dans '
           'DOCTRINE.md, CLAUDE.md la POINTE (un lien, pas une copie).'
           % (p[:160], '…' if len(p) > 160 else ''))

    if err:
        print('docs_probe : %d contrôle(s) ROUGE(S) — CLAUDE.md n\'est pas en ordre '
              '(budgets : %d mots, %d c./ligne, shingle %d mots ; surchargeables par env).'
              % (err, BUDGET_MOTS, BUDGET_LIGNE, SHINGLE_MOTS))
        return 1
    print('docs_probe : CLAUDE.md %d/%d mots · 0 ligne > %d c. · 0 énoncé recopié depuis '
          'DOCTRINE.md (shingles %d mots, positif connu vérifié).'
          % (n_mots, BUDGET_MOTS, BUDGET_LIGNE, SHINGLE_MOTS))
    return 0


if __name__ == '__main__':
    sys.exit(main())
