# -*- coding: utf-8 -*-
"""couverture_conj_probe.py — LA COUVERTURE DE LA CONJUGAISON, sujet par sujet et temps par temps.

⭐ POURQUOI CETTE SONDE EXISTE (14/09/2026, demande de Rem après « nous iriez » resté muet).
   Les quatre instruments du correcteur mesurent tous un CORPUS :
     · `correcteur_probe` — 188 témoins écrits à la main ;
     · `dys_pipeline_probe` — 72 productions dys réelles ;
     · `fp_scale_probe` — 2 500 phrases UD CORRECTES (donc : faux positifs, jamais le rappel) ;
     · `dys_precision_probe --navigateur` — le produit dans Chrome, sur ce même corpus.
   Un trou ABSENT du corpus leur est invisible. « nous iriez » → irions n'a jamais été corrigé, et
   aucune des quatre sondes ne pouvait le dire : la batterie n'a pas un seul témoin de faute de
   PERSONNE sur nous/vous, et les 91 occurrences de nous/vous du corpus dys sont toutes des
   compléments corrects. Mesuré le 14/09 avant de poser : nous 0/220, vous 0/235.

   Cette sonde ne lit aucun corpus. Elle ÉNUMÈRE : pour chaque sujet possible × chaque temps des
   tables, elle écrit la forme d'une AUTRE personne (faute de personne pure, le temps est GARDÉ) et
   demande au correcteur la forme juste. C'est un test de COUVERTURE, pas de rappel.

⚠️ Ce qu'elle ne dit pas : rien sur les faux positifs (c'est `fp_scale_probe` et la batterie), rien
   sur le produit réel (c'est le juge). Un taux de 100 % ici n'a jamais voulu dire « le correcteur
   est bon » — seulement « cette case n'est pas un trou ».

Ancrage : `dictee/couverture_conj_ref.json` (taux par sujet, plancher = le mesuré). Une baisse ROUGIT.
Usage : python3 dictee/couverture_conj_probe.py [--fix] [--detail]
"""
import io, json, os, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import correcteur_probe as CP                                                   # noqa: E402

REF = os.path.join(HERE, 'couverture_conj_ref.json')

# Les sujets que le français met devant un verbe fini. Les trois derniers ne sont pas des pronoms :
# ils gardent la sonde honnête (le sujet nominal et le relatif passent par d'autres règles).
SUJETS = [('je', '1s'), ('tu', '2s'), ('il', '3s'), ('elle', '3s'), ('on', '3s'),
          ('nous', '1p'), ('vous', '2p'), ('ils', '3p'), ('elles', '3p'),
          ("qu'il", '3s'), ("qu'ils", '3p'), ('le chat', '3s'), ('les chats', '3p')]

# Verbes : trois groupes, réguliers et irréguliers, fréquents (les tables les couvrent tous).
VERBES = ['aller', 'manger', 'finir', 'prendre', 'avoir', 'etre', 'venir', 'faire', 'dire', 'voir',
          'pouvoir', 'devoir']

MAX_SUBST = 3          # substitutions testées par case (déterministe : les 3 premières du slot trié)


def _phrase(sujet, forme, temps):
    """Une phrase MINIMALE et non ambiguë : le sujet, la forme fautive, un complément neutre.
    Le subjonctif reçoit son déclencheur (« il faut que »), sinon la forme est jugée à l'indicatif."""
    if temps == 'sub:pre':
        return 'Il faut que ' + sujet + ' ' + forme + ' souvent.'
    return sujet[0].upper() + sujet[1:] + ' ' + forme + ' souvent.'


def mesurer(detail=False):
    if not CP.CONJ_C:
        return None, 'tables de conjugaison absentes'
    temps_tous = sorted({t for d in CP.CONJ_C.values() for t in d},
                        key=lambda t: -sum(1 for d in CP.CONJ_C.values() if t in d))
    res = collections.defaultdict(lambda: [0, 0])
    rates = collections.defaultdict(list)
    for lem in VERBES:
        C = CP.CONJ_C.get(lem) or {}
        for temps in temps_tous:
            slots = C.get(temps) or {}
            for sujet, slot in SUJETS:
                juste = slots.get(slot)
                if not juste:
                    continue
                autres = [f for s, f in sorted(slots.items()) if s != slot and f != juste][:MAX_SUBST]
                for faux in autres:
                    phrase = _phrase(sujet, faux, temps)
                    flags = CP.correct_tiered(phrase) or []
                    ok = any(f[1].lower() == faux.lower() and f[2].lower() == juste.lower() for f in flags)
                    res[(sujet, temps)][1] += 1
                    if ok:
                        res[(sujet, temps)][0] += 1
                    elif len(rates[(sujet, temps)]) < 3:
                        prop = [f[2] for f in flags if f[1].lower() == faux.lower()]
                        rates[(sujet, temps)].append('%s %s → %s%s' % (
                            sujet, faux, juste, (' (proposé : %s)' % prop[0]) if prop else ' (muet)'))
    return (res, temps_tous, rates), None


def main():
    fix = '--fix' in sys.argv
    detail = '--detail' in sys.argv
    out, err = mesurer(detail)
    if err:
        print('· COUVERTURE CONJUGAISON : SAUTÉ (%s)' % err)
        return 0
    res, temps_tous, rates = out
    print('COUVERTURE DE LA CONJUGAISON — faute de PERSONNE, le TEMPS est gardé (%d verbes, %d sujets)'
          % (len(VERBES), len(SUJETS)))
    print('%-12s %s' % ('sujet', ' '.join('%12s' % t for t in temps_tous)))
    taux, reus = {}, {}
    for sujet, _ in SUJETS:
        ligne, tf, tn = [], 0, 0
        for t in temps_tous:
            f, n = res[(sujet, t)]
            tf += f; tn += n
            ligne.append('%12s' % ('%d/%d' % (f, n) if n else '—'))
        taux[sujet] = round(100.0 * tf / tn, 1) if tn else None
        reus[sujet] = tf
        print('%-12s %s   %s' % (sujet, ' '.join(ligne),
                                 ('%.1f %%' % taux[sujet]) if taux[sujet] is not None else '—'))
    if detail:
        print('\nnon corrigés (échantillon) :')
        for sujet, _ in SUJETS:
            for t in temps_tous:
                if rates[(sujet, t)]:
                    print('   %-10s %-9s %s' % (sujet, t, ' | '.join(rates[(sujet, t)])))
    ref = {}
    if os.path.exists(REF):
        ref = json.loads(io.open(REF, encoding='utf-8').read())
    def _anc(v):   # l'ancre accepte l'ANCIEN format (un simple taux) et le nouveau [taux, réussites]
        return (v, None) if isinstance(v, (int, float)) else (v[0], v[1])
    if fix:
        io.open(REF, 'w', encoding='utf-8', newline='\n').write(
            json.dumps({s: [taux[s], reus[s]] for s in taux}, ensure_ascii=False, indent=2) + '\n')
        print('\n✓ ancré : %d sujets' % len(taux))
        return 0
    if not ref:
        print('\n· COUVERTURE : aucun ancrage (lancer --fix pour poser le plancher)')
        return 0
    baisses = []
    for s in ref:
        av_t, av_r = _anc(ref[s])
        if taux.get(s) is None or av_t is None: continue
        if taux[s] < av_t - 0.05:
            baisses.append((s, '%.1f %% < plancher %.1f %%' % (taux[s], av_t)))
        # ⚠️ Le TAUX seul MENT quand le BANC grandit : le 15/09, les tables ont gagné le passé simple
        # pluriel, le dénominateur a bondi (55 → 211 cas) et le taux a BAISSÉ alors que chaque case
        # gagnait (« il » 5 → 14 réussites). Le nombre ABSOLU, lui, ne baisse que si on perd vraiment.
        if av_r is not None and reus[s] < av_r:
            baisses.append((s, '%d réussites < plancher %d (le taux, lui, ne le dit pas : le banc a pu grandir)' % (reus[s], av_r)))
    if baisses:
        print('\n✗ COUVERTURE CONJUGAISON : la couverture a BAISSÉ :')
        for s, msg in baisses:
            print('    %-10s %s' % (s, msg))
        print('    (si la baisse est VOULUE et mesurée : python3 dictee/couverture_conj_probe.py --fix)')
        return 1
    print('\n✓ COUVERTURE CONJUGAISON : aucun sujet en baisse (%d ancrés)' % len(ref))
    return 0


if __name__ == '__main__':
    sys.exit(main())
