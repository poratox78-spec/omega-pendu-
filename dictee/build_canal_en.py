#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build_canal_en.py — d'où viennent les constantes du CLASSEMENT PAR SORTE D'ÉDITION du speller anglais, et leur garde.

POURQUOI. Mesuré le 17/09/2026 : quand le speller anglais montre une mauvaise cible, 55 % du temps la bonne était
candidate À UNE ÉDITION et a perdu sur la seule fréquence — « accesed » -> accused (au lieu d'accessed), « achive » -> active
(achieve), « acertain » -> certain (ascertain). Le classement ignorait la SORTE de l'édition. Or les fautes réelles ne se
répartissent pas au hasard : sur les 2 784 fautes attestées de Wiktionary (dictee/misspell_en.tsv), la bonne cible est une
lettre doublée, une transposition, une voyelle oubliée ou une voyelle pour une autre bien plus souvent qu'un candidat
quelconque ; elle est rarement une consonne pour une autre, presque jamais une voyelle pour une consonne, et elle garde
presque toujours la PREMIÈRE lettre.

CE QUE CALCULE CE SCRIPT. Pour chaque sorte k : lift(k) = P(k | bonne cible) / P(k | candidat à une édition), en logarithme
(lissage +1) ; pareil pour « première lettre conservée / changée ». Le speller ajoute POIDS × (ln lift(sorte) + ln lift(1re
lettre)) au score des candidats à une édition, plus un BONUS pour la lettre doublée. POIDS = 1,5 et BONUS = 3 sont calibrés
par balayage sur deux bancs que ces constantes n'ont PAS vus (liste de Wikipédia, JFLEG) — voir REGLES_EN.md §1.
⚠️ Appris sur Wiktionary SEUL, exprès : la liste de Wikipédia et JFLEG restent des bancs de validation honnêtes. Contrôle :
appris sur Wikipédia seule, les mêmes sortes sortent dans le même ordre avec des valeurs voisines (propriété de l'anglais
écrit, pas d'un corpus).

  PYTHONUTF8=1 python dictee/build_canal_en.py            # affiche la table recalculée
  python dictee/build_canal_en.py --check                 # CI : constantes des DEUX moteurs == table recalculée
"""
import io, os, re, sys, math, collections

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import speller_en_probe as S


def apprendre(sp):
    vrai = collections.Counter(); cand = collections.Counter(); v1 = [0, 0]; c1 = [0, 0]; n = 0
    for bad, cible in sorted(sp.ATTESTED.items()):
        if bad in sp.KNOWN or "'" in cible: continue
        n += 1
        cs, _ = sp._cands(bad)
        for x, tier in cs.items():
            if tier != 1 or sp.FREQ.get(x, 0) < 1: continue
            k = S._sorte(bad, x); f = 1 if x[:1] != bad[:1] else 0
            cand[k] += 1; c1[f] += 1
            if x == cible: vrai[k] += 1; v1[f] += 1
    nv, nc = sum(vrai.values()), sum(cand.values())
    lift = {k: round(math.log(((vrai[k] + 1.0) / (nv + 10.0)) / ((cand[k] + 1.0) / (nc + 10.0))), 2) for k in cand}
    l1 = tuple(round(math.log(((v1[f] + 1.0) / (nv + 2.0)) / ((c1[f] + 1.0) / (nc + 2.0))), 2) for f in (0, 1))
    return lift, l1, vrai, cand, n


def constantes_js():
    js = io.open(os.path.join(HERE, 'corrector_en.js'), encoding='utf-8').read()
    m = re.search(r'const _CANAL = \{([^}]*)\};', js); m1 = re.search(r'const _CANAL_1RE = \[([^\]]*)\]', js)
    mp = re.search(r'_CANAL_POIDS = ([0-9.]+)', js); mb = re.search(r'_DOUBLE_BONUS = ([0-9.]+)', js)
    if not (m and m1 and mp and mb): return None
    lift = {k.strip(): float(v) for k, v in (kv.split(':') for kv in m.group(1).split(',') if ':' in kv)}
    return lift, tuple(float(x) for x in m1.group(1).split(',')), float(mp.group(1)), float(mb.group(1))


def main():
    sp = S.SpellerEN()
    lift, l1, vrai, cand, n = apprendre(sp)
    print('classement par sorte d\'édition — appris sur %d fautes attestées (Wiktionary)' % n)
    for k in sorted(lift, key=lambda k: -lift[k]):
        print('   %-8s bonne cible %4d / candidats %5d   ln lift %+.2f' % (k, vrai[k], cand[k], lift[k]))
    print('   première lettre conservée %+.2f · changée %+.2f' % l1)
    if '--check' not in sys.argv: return
    bad = []
    if dict(S._CANAL) != lift: bad.append('speller_en_probe.py _CANAL = %s ≠ recalculé %s' % (dict(S._CANAL), lift))
    if tuple(S._CANAL_1RE) != l1: bad.append('speller_en_probe.py _CANAL_1RE = %s ≠ recalculé %s' % (tuple(S._CANAL_1RE), l1))
    cj = constantes_js()
    if cj is None: bad.append('corrector_en.js : constantes du classement introuvables (la garde serait MUETTE)')
    else:
        if cj[0] != lift: bad.append('corrector_en.js _CANAL = %s ≠ recalculé %s' % (cj[0], lift))
        if cj[1] != l1: bad.append('corrector_en.js _CANAL_1RE = %s ≠ recalculé %s' % (cj[1], l1))
        if (cj[2], cj[3]) != (S._CANAL_POIDS, S._DOUBLE_BONUS):
            bad.append('poids/bonus : JS (%s, %s) ≠ Python (%s, %s)' % (cj[2], cj[3], S._CANAL_POIDS, S._DOUBLE_BONUS))
    for b in bad: print('  ✗ ' + b)
    print('✗ classement par sorte d\'édition : %d écart(s)' % len(bad) if bad else
          '✓ classement par sorte d\'édition : les constantes des deux moteurs == la table recalculée sur les %d fautes attestées '
          '(9 sortes + première lettre ; poids %s, bonus lettre doublée %s)' % (n, S._CANAL_POIDS, S._DOUBLE_BONUS))
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
