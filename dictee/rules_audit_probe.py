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
import io
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
    # `--genere N` : au lieu du corpus dys PRIVÉ, N paires fabriquées par le GÉNÉRATEUR DE FAUTES
    # (dictee/dys_gen.py, calibré sur l'écrit dys réel) appliqué au corpus UD — donc du FRANÇAIS
    # CORRECT RÉEL perturbé, dont le corrigé est l'original PAR CONSTRUCTION. Deux intérêts :
    #   · VOLUME — une règle rare (leur/leurs : 11 tirs distincts sur le corpus réel) devient
    #     mesurable ; c'était le goulot de l'audit.
    #   · Le mécanisme d'ANCRE POLLUÉE (« leur payss ») est justement ce que le générateur produit.
    # ⚠️ LIMITE À DIRE : il ne mesure QUE les fautes qu'il sait faire. Il complète le corpus réel,
    # il ne le remplace pas — un correctif validé ici doit rester vérifié sur les paires réelles.
    def _pairs_generees(n, seed=20260822):
        import random, dys_gen
        rng = random.Random(seed); lex = dys_gen.charge_lex(); out = []
        for line in io.open(UD, encoding='utf-8'):
            t = line.strip()
            if not t or len(t) < 25: continue
            bad, k = dys_gen.genere(t, rng, lex)
            if k: out.append(('genere', bad, t))
            if len(out) >= n: break
        return out

    n_gen = 0
    for a in sys.argv:
        if a.isdigit() and '--genere' in sys.argv and sys.argv.index(a) == sys.argv.index('--genere') + 1:
            n_gen = int(a)
    src = _pairs_generees(n_gen) if n_gen else (DP.pairs() if os.path.isdir(DP.DATA) else [])
    n_dys = 0
    if True:
        for _fn, raw, fixed in src:
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

    # ---------- 2ter. ANCRES POLLUÉES (`--ancres N`) : d'où viennent VRAIMENT les faux positifs ? ----------
    # Question de Rem : « on a la détection de type de mot (pronom/adjectif/sujet/verbe), pourquoi encore
    # ces problèmes ? » — Parce qu'un POS-tagger étiquette CORRECTEMENT un mot FAUX. La détection ne peut
    # rien quand l'information d'entrée est corrompue, et sur du texte dys ~20 % des mots le sont : pour
    # un mot donné, la probabilité qu'un de ses 4 voisins immédiats soit abîmé approche 1-(0,8)^4 ≈ 56 %.
    # On le MESURE ici : sur des paires générées (on sait exactement quels mots ont été abîmés), chaque
    # faux positif du correcteur est classé « voisin abîmé » (ancre polluée) vs « contexte propre »
    # (vraie erreur de détection ou de règle).
    if '--ancres' in sys.argv:
        import random, dys_gen
        n_a = int(sys.argv[sys.argv.index('--ancres') + 1]) if len(sys.argv) > sys.argv.index('--ancres') + 1 and sys.argv[sys.argv.index('--ancres') + 1].isdigit() else 600
        rng = random.Random(20260822); lex = dys_gen.charge_lex()
        pollue = propre = 0; exa = []; np_ = 0
        for line in io.open(UD, encoding='utf-8'):
            t = line.strip()
            if not t or len(t) < 25: continue
            bad, k = dys_gen.genere(t, rng, lex)
            if not k: continue
            np_ += 1
            if np_ > n_a: break
            CP._SEG = CP._seg_info(bad); T = CP.toks(bad)
            al = DP.align(T, [x.group(0) for x in DP.TOK.finditer(t)])
            for (i, w, sg, nm) in CP.correct(bad):
                if i not in al or not DP.eq(al[i], w): continue       # on ne garde que les FP (mot déjà juste)
                voisin = any(j in al and not DP.eq(T[j], al[j])
                             for j in range(max(0, i - 2), min(len(T), i + 3)) if j != i)
                if voisin:
                    pollue += 1
                    if len(exa) < 8: exa.append('%s→%s [%s]  ⟨%s⟩' % (w, sg, nm, ' '.join(T[max(0, i - 3):i + 4])))
                else: propre += 1
        tot = pollue + propre
        print("ancres — %d paires générées · %d faux positifs du correcteur (le mot corrigé était DÉJÀ juste)" % (np_, tot))
        print("  · VOISIN IMMÉDIAT ABÎMÉ (ancre polluée) : %d (%.0f %%)" % (pollue, 100.0 * pollue / max(1, tot)))
        print("  · contexte PROPRE (erreur de détection / de règle) : %d (%.0f %%)" % (propre, 100.0 * propre / max(1, tot)))
        print("  ⚠️ PLANCHER : les mots hors alignement ne sont pas comptés, et le juge tolère l'accent —")
        print("     la part réelle d'ancre polluée est donc SUPÉRIEURE à ce chiffre.")
        for e in exa: print('     ✗ ' + e)

        # --- L'ANCRE elle-même : un test LEXICAL générique attraperait-il ces FP ? ---
        # C'est la question qui décide si une primitive partagée « ancre fiable » vaut la peine.
        # ⚠️ Ne pas confondre « un voisin abîmé est un non-mot » (fréquent) avec « l'ANCRE de la règle
        # est un non-mot » (rare) : l'ancre est le token dont la règle LIT l'information.
        import speller_probe as _S, inspect as _insp
        _sp = [o for _n, o in vars(_S).items() if _insp.isclass(o) and hasattr(o, '_cands')][0]()
        ANCRE = {'accord pluriel nom': -1, 'accord singulier nom': -1, 'accord adjectif épithète': -1,
                 'accord participe épithète': -1, 'genre déterminant': +1, 'leur/leurs': +1,
                 'a/à': +1, 'on/ont': +1, 'ce/se': +1, 'des/dès': +1}
        connue = nonmot = 0; exb = []
        rng2 = random.Random(20260822); lex2 = dys_gen.charge_lex(); np2 = 0
        for line in io.open(UD, encoding='utf-8'):
            t = line.strip()
            if not t or len(t) < 25: continue
            bad, k = dys_gen.genere(t, rng2, lex2)
            if not k: continue
            np2 += 1
            if np2 > n_a: break
            CP._SEG = CP._seg_info(bad); T = CP.toks(bad)
            al = DP.align(T, [x.group(0) for x in DP.TOK.finditer(t)])
            for (i, w, sg, nm) in CP.correct(bad):
                if i not in al or not DP.eq(al[i], w) or nm not in ANCRE: continue
                j = i + ANCRE[nm]
                if j < 0 or j >= len(T): continue
                if T[j].lower().strip("'") in _sp.WORDS: connue += 1
                else:
                    nonmot += 1
                    if len(exb) < 5: exb.append('%s : %s→%s — ancre NON-MOT « %s »' % (nm, w, sg, T[j]))
        tt = connue + nonmot
        print()
        print("  L'ANCRE de la règle (10 règles à ancre identifiable) — %d faux positifs :" % tt)
        print("    · ancre = mot CONNU  → un test lexical N'AIDE PAS : %d (%.0f %%)" % (connue, 100.0 * connue / max(1, tt)))
        print("    · ancre = NON-MOT    → un test lexical AIDERAIT   : %d (%.0f %%)" % (nonmot, 100.0 * nonmot / max(1, tt)))
        for e in exb: print('       ✓ ' + e)
        print("  ⇒ CONCLUSION MESURÉE : une primitive lexicale partagée n'attraperait qu'une")
        print("     poignée de cas. La garde d'ancre doit rester PAR RÈGLE (le signal utile est la")
        print("     COHÉRENCE — déterminant vs nom, règle voisine — pas l'appartenance au lexique).")
        return 0

    # ---------- 3. rapport ----------
    print('rules_audit_probe — %d règles · %d paires %s · %d phrases correctes (UD)' % (len(RULES), n_dys, 'GÉNÉRÉES (dys_gen sur UD)' if n_gen else 'dys réelles', n_ud))
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
