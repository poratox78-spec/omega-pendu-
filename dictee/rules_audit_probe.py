# -*- coding: utf-8 -*-
"""AUDIT RÈGLE PAR RÈGLE — « y a-t-il d'autres règles polluées ? » (question de Rem, 2026-08-22).

`dys_precision_probe` mesure par FAMILLE (le nom de la règle). Or 77 règles portent 60 noms :
« accord sujet-verbe » en cache 14 à lui seul. Une règle fautive peut donc se cacher derrière la
moyenne de ses voisines — et une règle SOURDE (qui ne tire jamais, comme le pronom élidé avant sa
réparation) est invisible d'une mesure de précision, puisque la précision ne compte que ce qui tire.

Ici, chaque règle est appelée SÉPARÉMENT sur deux corpus :
  · TEXTE DYS (data_local, privé — paires brut/gold) : ses tirs sont jugés contre le corrigé
    → juste / inutile (le texte était juste = FP dys) / fausse (mot faux, mauvaise cible) ;
  · TEXTE CORRECT (dictee/fp_scale_corpus.txt, 2 500 phrases UD) : tout tir est un FAUX POSITIF.
Et deux états structurels :
  · MASQUÉE : la règle tire, mais une règle prioritaire gagne toujours le même token (correct()
    s'arrête au premier match) → son effet réel est nul, son code est du décor ;
  · MUETTE : zéro tir sur les deux corpus → soit morte, soit aveugle à ce qu'elle devrait voir.
Les tirs sont dédupliqués (mot, suggestion, contexte ±2) : le corpus dys contient la même dictée
recopiée par plusieurs élèves, un piège unique y pèse sinon 7×.

  python3 dictee/rules_audit_probe.py            # tableau complet
  python3 dictee/rules_audit_probe.py --suspects # seulement ce qui mérite un regard
  python3 dictee/rules_audit_probe.py --rule NOM # détail + exemples d'une règle
"""
import os
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
UD = os.path.join(HERE, 'fp_scale_corpus.txt')


def fires(dec, tok, name):
    """La règle produit-elle une correction (mêmes conditions que correcteur_probe.correct) ?"""
    if dec is None:
        return None
    sg = dec['sugg'] if isinstance(dec, dict) else dec
    if not isinstance(sg, str) or sg == tok:
        return None
    if name != 'majuscule' and sg.lower() == tok.lower():
        return None
    return sg


def main():
    import correcteur_probe as CP
    import dys_precision_probe as DP
    only = None
    if '--rule' in sys.argv:
        only = sys.argv[sys.argv.index('--rule') + 1].lower()
    suspects_only = '--suspects' in sys.argv

    stat = defaultdict(lambda: defaultdict(int))     # (r) -> compteurs
    seen = defaultdict(set)                          # (r) -> cas distincts déjà comptés
    ex = defaultdict(list)
    RULES = CP.RULES

    # ---------- 1. TEXTE DYS : tirs jugés contre le gold ----------
    n_dys = 0
    if os.path.isdir(DP.DATA):
        for _fn, raw, fixed in DP.pairs():
            n_dys += 1
            raw_n = raw.replace('’', "'").replace('ʼ', "'")
            CP._SEG = CP._seg_info(raw_n)
            T = CP.toks(raw_n)
            al = DP.align(T, [x.group(0) for x in DP.TOK.finditer(fixed)])
            for i in range(len(T)):
                won = False                                   # correct() s'arrête au 1er match du token
                for r, (name, rule) in enumerate(RULES):
                    try:
                        sg = fires(rule(T, i), T[i], name)
                    except Exception as e:
                        stat[r]['erreur'] += 1
                        if len(ex[r]) < 4:
                            ex[r].append('EXCEPTION : %s' % e)
                        continue
                    if sg is None:
                        continue
                    key = (DP.norm(T[i]), DP.norm(sg), ' '.join(DP.norm(x) for x in T[max(0, i - 2):i + 3]))
                    dup = key in seen[r]
                    seen[r].add(key)
                    if not dup:
                        stat[r]['tirs'] += 1
                        if won:
                            stat[r]['masque'] += 1            # une règle prioritaire a déjà gagné ce token
                    if i in al and not dup:
                        g = al[i]
                        k = 'juste' if DP.eq(sg, g) else ('inutile' if DP.eq(g, T[i]) else 'fausse')
                        stat[r][k] += 1
                        if k != 'juste' and len(ex[r]) < 4:
                            ex[r].append('%s→%s (gold %s)  ⟨%s⟩' % (T[i], sg, g, ' '.join(T[max(0, i - 4):i + 5])))
                    won = True

    # ---------- 2. TEXTE CORRECT (UD) : tout tir est un faux positif ----------
    n_ud = 0
    if os.path.exists(UD):
        for line in open(UD, encoding='utf-8'):
            s = line.strip()
            if not s:
                continue
            n_ud += 1
            CP._SEG = CP._seg_info(s)
            T = CP.toks(s)
            for i in range(len(T)):
                won = False
                for r, (name, rule) in enumerate(RULES):
                    try:
                        sg = fires(rule(T, i), T[i], name)
                    except Exception:
                        continue
                    if sg is None:
                        continue
                    stat[r]['ud'] += 1
                    if won:
                        stat[r]['ud_masque'] += 1
                    else:
                        tier = CP.tier_of(T, i, name, sg)
                        stat[r]['ud_rouge' if tier == 'auto' else 'ud_orange'] += 1
                        if len(ex[r]) < 8:
                            ex[r].append('[UD %s] %s→%s  ⟨%s⟩' % (tier, T[i], sg, ' '.join(T[max(0, i - 4):i + 5])))
                    won = True

    # ---------- 2bis. BATTERIE (CASES) : la règle est-elle exercée quelque part ? ----------
    # Sans ça, « MUETTE » est ambigu : soit la règle est morte/aveugle, soit les deux corpus n'ont
    # simplement pas l'occasion de la déclencher (« j'est → j'ai » n'apparaît ni dans UD correct ni
    # dans ces dictées). La batterie fournit l'occasion : une règle muette PARTOUT, batterie comprise,
    # n'est vérifiée par rien.
    for case in getattr(CP, 'CASES', []):
        phrase, mot, faute = case[0], case[1], case[2]
        s = phrase.replace(mot, faute, 1) if mot in phrase else phrase
        CP._SEG = CP._seg_info(s)
        T = CP.toks(s)
        for i in range(len(T)):
            for r, (name, rule) in enumerate(RULES):
                try:
                    if fires(rule(T, i), T[i], name) is not None:
                        stat[r]['batt'] += 1
                except Exception:
                    pass

    # ---------- 3. rapport ----------
    print('rules_audit_probe — %d règles · %d paires dys · %d phrases correctes (UD)' % (len(RULES), n_dys, n_ud))
    if not n_dys:
        print('  (corpus dys local absent → colonnes dys vides ; OMEGA_DYS_DATA=… pour un worktree)')
    print()
    rows = []
    for r, (name, rule) in enumerate(RULES):
        c = stat[r]
        tot = c['juste'] + c['inutile'] + c['fausse']
        prec = (100.0 * c['juste'] / tot) if tot else None
        etat = []
        if not c['tirs'] and not c['ud']:
            etat.append('JAMAIS-EXERCÉE' if not c['batt'] else 'sans occasion (batterie ok)')
        elif c['tirs'] and c['tirs'] == c['masque'] and not (c['ud'] - c['ud_masque']):
            etat.append('MASQUÉE')
        if prec is not None and prec < 75:
            etat.append('PRÉCISION<75%')
        if c['ud_rouge']:
            etat.append('FP-ROUGE(UD)')
        if c['erreur']:
            etat.append('EXCEPTIONS')
        rows.append((r, name, rule.__name__, c, prec, etat))

    if only:
        rows = [x for x in rows if only in x[1].lower() or only in x[2].lower()]
    elif suspects_only:
        rows = [x for x in rows if [e for e in x[5] if e != 'sans occasion (batterie ok)']]

    print('%-3s %-30s %-26s %5s %5s %5s %5s %6s  %5s %5s  %s' %
          ('#', 'famille', 'fonction', 'tirs', 'just', 'inut', 'faux', 'préc.', 'UD-R', 'UD-O', 'état'))
    for (r, name, fnn, c, prec, etat) in rows:
        print('%-3d %-30s %-26s %5d %5d %5d %5d %5s%%  %5d %5d  %s' %
              (r, name[:30], fnn[:26], c['tirs'], c['juste'], c['inutile'], c['fausse'],
               ('%.0f' % prec) if prec is not None else '—', c['ud_rouge'], c['ud_orange'], ' '.join(etat)))
        if (only or etat) and ex[r]:
            for e in ex[r][:4]:
                print('        ✗ ' + e)
    print()
    print('LÉGENDE — tirs/just/inut/faux : cas DISTINCTS sur texte dys (inut. = le texte était déjà juste).')
    print('  UD-R / UD-O : tirs sur texte CORRECT (faux positifs) rendus en ROUGE / en ORANGE.')
    print('  MUETTE = ne tire nulle part · MASQUÉE = tire toujours derrière une règle prioritaire.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
