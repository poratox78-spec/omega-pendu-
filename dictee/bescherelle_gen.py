# -*- coding: utf-8 -*-
u"""LE TEST BESCHERELLE — tout le paradigme, verbe par verbe, temps par temps, personne par personne.

POURQUOI CET INSTRUMENT EXISTE (14-16/09/2026). Les quatre sondes du correcteur lisent un CORPUS :
batterie, corpus dys, UD 2 500, audit navigateur. Une case ABSENTE du corpus leur est invisible — et
c'est ainsi que « nous » et « vous » sont restés hors de TOUTE règle de personne depuis le premier
commit du correcteur sans qu'aucune mesure ne puisse le dire. Celui-ci n'ouvre aucun corpus : il
ÉNUMÈRE le paradigme depuis les tables et pose la question case par case, dans le VRAI Chrome.

Pour chaque case (verbe, temps, personne) il écrit DEUX phrases :
  · la CORRECTE   → le correcteur doit SE TAIRE (sinon : il casse un mot juste) ;
  · la FAUTÉE     → une autre personne du MÊME temps ; il doit rendre la forme juste.

  python3 dictee/bescherelle_gen.py <in.json> <meta.json>
  node   dictee/navigateur_flags_dump.js <in.json> <out.json>     # extension réelle, Chrome réel
  python3 dictee/bescherelle_score.py <meta.json> <out.json>

Les tables se complètent PARESSEUSEMENT (le passé simple pluriel n'existe qu'après _ps_completer) :
appeler CP._reads / CP._spos / CP._ps_completer avant de générer donne le paradigme COMPLET, et le
banc grandit alors — comparer les réussites ABSOLUES, pas seulement le taux.
"""
import io, json, sys, os
sys.path.insert(0, 'dictee')
import correcteur_probe as CP
PRON = [('je', '1s'), ('tu', '2s'), ('il', '3s'), ('nous', '1p'), ('vous', '2p'), ('ils', '3p')]
VERBES = ['etre', 'avoir', 'aller', 'faire', 'dire', 'pouvoir', 'vouloir', 'devoir', 'savoir', 'voir',
          'venir', 'prendre', 'manger', 'finir', 'partir', 'mettre', 'parler', 'aimer', 'sortir', 'lire']
TEMPS = ['ind:pre', 'ind:imp', 'ind:fut', 'cnd:pre', 'sub:pre', 'ind:pas']
cas = []
for lem in VERBES:
    C = CP.CONJ_C.get(lem) or {}
    for tps in TEMPS:
        slots = C.get(tps) or {}
        for pron, slot in PRON:
            juste = slots.get(slot)
            if not juste: continue
            pre = 'Il faut que ' if tps == 'sub:pre' else ''
            cas.append({'t': (pre + pron + ' ' + juste + ' souvent.').capitalize() if not pre else pre + pron + ' ' + juste + ' souvent.',
                        'v': lem, 'tps': tps, 'slot': slot, 'attendu': None, 'mot': juste})
            autres = [(s2, f) for s2, f in sorted(slots.items()) if s2 != slot and f != juste]
            if autres:
                s2, faux = autres[0]
                cas.append({'t': (pre + pron + ' ' + faux + ' souvent.').capitalize() if not pre else pre + pron + ' ' + faux + ' souvent.',
                            'v': lem, 'tps': tps, 'slot': slot, 'attendu': juste, 'mot': faux})
io.open(sys.argv[1], 'w', encoding='utf-8').write(json.dumps([c['t'] for c in cas], ensure_ascii=False))
io.open(sys.argv[2], 'w', encoding='utf-8').write(json.dumps(cas, ensure_ascii=False))
n_ok = sum(1 for c in cas if c['attendu'] is None)
print('BESCHERELLE : %d phrases — %d correctes (le correcteur doit SE TAIRE), %d fautées (il doit corriger) ; %d verbes × %d temps × %d personnes'
      % (len(cas), n_ok, len(cas) - n_ok, len(VERBES), len(TEMPS), len(PRON)))
