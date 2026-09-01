# -*- coding: utf-8 -*-
u"""PARITÉ SPELLER — Python (référence) ↔ JS (moteur livré), SUGGESTION COMPRISE.

⭐ LE TROU QUE CETTE SONDE FERME. La batterie gardait déjà :
    · « speller ext ≡ app (vigilance comprise) »  → JS ↔ JS
    · parity_corr                                 → GRAMMAIRE Python ↔ JS
  mais RIEN ne comparait le SPELLER Python ↔ JS. Les deux moteurs JS pouvaient donc s'accorder
  ENTRE EUX sur une suggestion FAUSSE que la référence Python donnait JUSTE, sans aucun signal.

  Ce n'est pas théorique. Sur le corpus dys réel, trois mots sortent faux du moteur de PRODUCTION
  alors que la référence Python les sort JUSTES, dans le MÊME contexte :
      priosn → prions   (référence : prison)
      séris  → sérieux  (référence : série)
      sonn   → sont     (référence : son)
  Ils étaient comptés comme de simples « régressions connues » du census, sans qu'on sache que la
  référence, elle, avait bon. `speller_probe.py` se déclare pourtant « Miroir JS » dès son en-tête.

CE QUE LA SONDE COMPARE : pour chaque token porteur d'un flag speller côté JS, la SUGGESTION et le
PALIER rendus par le Python sur la MÊME liste de tokens (celle du JS, donc pas de désaccord de
tokenisation). Corpus COMMITTÉS (fp_scale 2 500 correctes + corpus_gec_fr 98 fautives) → tourne en CI.

⚠️ ANCRAGE. Les divergences EXISTANTES sont listées dans parity_speller_ref.json et n'échouent pas :
poser la sonde ne doit basculer aucun verdict. Toute divergence NOUVELLE échoue. Si une divergence
ancrée disparaît, la sonde le dit — c'est le signal pour ré-ancrer à la hausse (--fix).
"""
import io, json, os, subprocess, sys

if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DUMP = os.path.join(ROOT, 'data_local', 'parity_speller_dump.json')
REF  = os.path.join(HERE, 'parity_speller_ref.json')
sys.path.insert(0, HERE)


def cle(d):
    return u'%s→%s [%s] vs py %s [%s]' % (d['tok'], d['js'], d['js_tier'], d['py'], d['py_tier'])


def main():
    fix = '--fix' in sys.argv
    # GARDE LOCALE, ET QUI LE DIT. La référence Python lit Lexique4 (33 Mo, NON committé : licence),
    # donc la CI ne peut pas la faire tourner. On saute alors EXPLICITEMENT — jamais un vert muet :
    # un contrôle qui passe sans rien avoir mesuré est exactement le défaut que le lot 1 corrige.
    import speller_probe as _S
    if not os.path.exists(_S.LEX):
        print(u'· PARITÉ SPELLER : SAUTÉ (Lexique4 absent — garde locale, cf. dev.sh)')
        return 0
    r = subprocess.run(['node', os.path.join(HERE, 'parity_speller_dump.js')],
                       capture_output=True, text=True, encoding='utf-8', cwd=ROOT)
    if r.returncode != 0:
        print(u'✗ PARITÉ SPELLER : le dump JS a échoué')
        print((r.stderr or '')[-400:])
        return 1
    D = json.load(io.open(DUMP, encoding='utf-8'))

    import speller_probe as S
    sp = S.Speller()

    div, compares = [], 0
    for t in D['dump']:
        T = t['tokens']
        for f in t['flags']:
            i = f['i']
            if i >= len(T):
                continue
            # ⭐ On ne compare QUE ce que les deux moteurs produisent tous les deux. Le palier
            # `vigilance` est une COUCHE À PART côté app (l'arbitre des oranges) ; `correct_token`
            # ne le rend jamais. Le comparer produisait 295 fausses « divergences » qui ne
            # mesuraient que l'absence de cet étage côté référence — du bruit, pas un défaut.
            if f['tier'] not in ('auto', 'flag'):
                continue
            compares += 1
            got = sp.correct_token(T[i], at_start=(i == 0), toks=T, idx=i)
            py_t, py_s = (got[0], got[1]) if got else (u'—', u'—')
            # la casse est portée par le TOKEN, pas par le choix du mot : « Lannée »→« L'année »
            # côté app et « l'année » côté référence, c'est le MÊME mot choisi.
            if py_s.lower() != (f['sugg'] or u'').lower() or py_t != f['tier']:
                div.append({'tok': T[i], 'js': f['sugg'], 'js_tier': f['tier'],
                            'py': py_s, 'py_tier': py_t})

    if fix:
        json.dump({'compares': compares, 'divergences': sorted(set(cle(d) for d in div)),
                   'note': u"Divergences Python↔JS ANCRÉES. Une NOUVELLE fait échouer ; une qui "
                           u"disparaît est un GAIN → ré-ancrer avec --fix."},
                  io.open(REF, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(u'✓ ancré : %d comparaisons, %d divergence(s)' % (compares, len(set(cle(d) for d in div))))
        return 0

    if not os.path.exists(REF):
        print(u'✗ PARITÉ SPELLER : pas de référence — ancrer avec : python dictee/parity_speller.py --fix')
        return 1
    ref = json.load(io.open(REF, encoding='utf-8'))
    connues = set(ref.get('divergences') or [])
    vues = set(cle(d) for d in div)
    neuves = sorted(vues - connues)
    disparues = sorted(connues - vues)

    if neuves:
        print(u'✗ PARITÉ SPELLER : %d divergence(s) NOUVELLE(S) Python↔JS (%d comparaisons) :' % (len(neuves), compares))
        for k in neuves[:12]:
            print(u'      ' + k)
        return 1
    print(u'✓ PARITÉ SPELLER : %d comparaisons, 0 divergence nouvelle (%d ancrée(s))' % (compares, len(connues)))
    if disparues:
        print(u'  ✓ %d divergence(s) DISPARUE(S) — ré-ancrer à la hausse (--fix) : %s'
              % (len(disparues), ', '.join(d.split(' vs ')[0] for d in disparues[:6])))
    return 0


if __name__ == '__main__':
    sys.exit(main())
