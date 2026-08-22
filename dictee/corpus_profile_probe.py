# -*- coding: utf-8 -*-
"""PROFIL DU CORPUS — de quoi est FAIT « data_local/dys_reel », et à quoi ça ressemble vs la littérature.

POURQUOI CETTE SONDE EXISTE (22/08/2026). Toutes les mesures de la campagne qualité annonçaient
« 1 726 paires dys RÉELLES ». C'est une étiquette TROMPEUSE, découverte en confrontant nos chiffres aux
corpus dyslexiques français publiés (Bodard 2020) : le mélange est à **93 % des sondes à faute unique**.

  dictees_gold.jsonl      6 paires   (src « dys_reel/… »)  = les SEULES vraies productions dys
  faiblesses.jsonl    1 600 paires   (src « accent », « inversion », … 200 × 8 familles) = SONDES synthétiques
  genere_gold.jsonl     120 paires   (src « genere »)      = dys_gen.py

Ce que ça change :
  · les mesures AVANT/APRÈS restent VALIDES (même corpus des deux côtés, les deltas sont bons) ;
  · les ABSOLUS (« ortho auto 91,5 % », « 793 promus ») décrivent surtout la tenue du moteur sur des fautes
    ISOLÉES, pas sur du texte dys réel — ne PAS les généraliser à la population cible ;
  · ⚠️ RÉTRACTATION : « dys_gen.py met ~2× trop de fautes » est FAUX. Mesuré ici : le généré est à 13,2 %
    de mots fautifs contre **12,8 % dans les vraies dictées**. La conclusion venait d'une comparaison au
    MÉLANGE (6,9 %), dominé par les sondes. Le biais ×29 sur les DÉTERMINANTS, lui, reste à vérifier.

Le sous-ensemble RÉEL colle à la littérature sur la FORME des erreurs (c'est le mélange qui déformait) :

  axe                     RÉEL (nous)   Bodard 2020   sondes   généré
  distance d'édition 1       60,5 %        58,8 %     71,0 %   68,1 %
  distance ≥2                39,5 %        41,2 %     29,0 %   31,9 %
  1re lettre fausse          18,6 %        10,9 %      4,8 %    8,0 %
  erreurs en VRAI mot        48,8 %          53 %     31,2 %   38,3 %
  mots fautifs               12,8 %         ~33 %      5,4 %   13,2 %

(La densité reste sous la littérature, mais celle-ci varie énormément d'un corpus à l'autre : Antoine 2019
55 %, Pedler 2007 20 %, Rello 2012 15 %. La FORME, elle, converge — c'est le signal solide.)

  python3 dictee/corpus_profile_probe.py        # composition + profil par groupe
  OMEGA_DYS_DATA=/chemin/data_local/dys_reel python3 dictee/corpus_profile_probe.py
"""
import os
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dys_precision_probe as DP        # noqa: E402
import speller_probe as S               # noqa: E402

SP = S.Speller()

# Repères publiés (Bodard 2020, JEP-TALN-RÉCITAL, corpus dyslexiques FRANÇAIS) — cf. dictee/ETAT_DES_LIEUX.md
LITT = {'d1': 58.8, 'dsup': 41.2, 'ini': 10.9, 'vrai': 53.0, 'fautif': 33.0}

GROUPES = [('RÉEL (vraies dictées)', 'dictees_gold.jsonl'),
           ('RÉEL (corrigé à la main)', 'gold_claude.jsonl'),
           ('SONDES (faute unique)', 'faiblesses.jsonl'),
           ('GÉNÉRÉ (dys_gen.py)', 'genere_gold.jsonl')]


def est_non_mot(w):
    return w.lower().replace('œ', 'oe').replace('æ', 'ae') not in SP.WORDS


def dist(a, b):
    """Levenshtein — sert à situer nos formes erronées sur l'échelle de distance de la littérature."""
    m, n = len(a), len(b)
    prev = list(range(n + 1))
    for i in range(1, m + 1):
        cur = [i] + [0] * n
        for j in range(1, n + 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] != b[j - 1]))
        prev = cur
    return prev[n]


def main():
    st = defaultdict(lambda: {'paires': 0, 'mots': 0, 'f': 0, 'd1': 0, 'dsup': 0, 'ini': 0, 'vrai': 0})
    for fn, brut, gold in DP.pairs():
        s = st[fn]
        s['paires'] += 1
        T = [x.group(0) for x in DP.TOK.finditer(brut)]
        al = DP.align(T, [x.group(0) for x in DP.TOK.finditer(gold)])
        for i, w in enumerate(T):
            if not w.isalpha():
                continue
            s['mots'] += 1
            if i not in al or DP.eq(w, al[i]):
                continue
            s['f'] += 1
            a, b = S.deacc(w.lower()), S.deacc(al[i].lower())
            if dist(a, b) == 1:
                s['d1'] += 1
            else:
                s['dsup'] += 1
            if a[:1] != b[:1]:
                s['ini'] += 1
            if not est_non_mot(w):
                s['vrai'] += 1
    if not st:
        print('corpus_profile_probe : corpus dys local absent (data_local/dys_reel) → sonde SAUTÉE (pas un échec).')
        return
    tot = sum(v['paires'] for v in st.values())
    print('\nCOMPOSITION de data_local/dys_reel — %d paires au total\n' % tot)
    for lbl, fn in GROUPES:
        s = st.get(fn)
        if not s:
            continue
        print('  %-24s %5d paires  (%4.1f %% du corpus)' % (lbl, s['paires'], 100.0 * s['paires'] / tot))
    print('\n  ⚠️ L\'étiquette « corpus dys réel » est TROMPEUSE : les vraies productions sont minoritaires.')
    print('     Les mesures AVANT/APRÈS restent valides (même corpus des deux côtés) ; les ABSOLUS décrivent')
    print('     surtout la tenue du moteur sur des fautes ISOLÉES — ne pas les généraliser au dys réel.\n')
    print('  %-24s %7s %9s %8s %8s %11s %10s' % ('groupe', 'mots', '% fautif', 'd=1', 'd≥2', '1re lettre', 'vrai mot'))
    for lbl, fn in GROUPES:
        s = st.get(fn)
        if not s or not s['f']:
            continue
        f = s['f']
        print('  %-24s %7d %8.1f %% %7.1f %% %7.1f %% %10.1f %% %9.1f %%'
              % (lbl, s['mots'], 100.0 * f / max(1, s['mots']), 100.0 * s['d1'] / f,
                 100.0 * s['dsup'] / f, 100.0 * s['ini'] / f, 100.0 * s['vrai'] / f))
    print('  %-24s %7s %8.1f %% %7.1f %% %7.1f %% %10.1f %% %9.1f %%'
          % ('LITTÉRATURE (Bodard 20)', '—', LITT['fautif'], LITT['d1'], LITT['dsup'], LITT['ini'], LITT['vrai']))
    reel, gen = st.get('dictees_gold.jsonl'), st.get('genere_gold.jsonl')
    if reel and gen and reel['mots'] and gen['mots']:
        dr, dg = 100.0 * reel['f'] / reel['mots'], 100.0 * gen['f'] / gen['mots']
        print('\n  ⇒ densité : GÉNÉRÉ %.1f %% contre RÉEL %.1f %% — le générateur n\'est PAS « 2× trop dense ».' % (dg, dr))
        print('    Cette conclusion venait d\'une comparaison au MÉLANGE (dominé par les sondes). RÉTRACTÉE.')
    print('  ⇒ sur la FORME des erreurs, le sous-ensemble RÉEL converge avec la littérature ; ce sont les')
    print('    SONDES qui sont atypiques (faute unique, isolée, jamais de première lettre touchée).\n')


if __name__ == '__main__':
    main()
