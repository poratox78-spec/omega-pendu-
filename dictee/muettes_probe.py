# -*- coding: utf-8 -*-
"""LE « R » FINAL N'EST PAS MUET — et on le vérifie contre la vérité-terrain, pas contre une liste d'exemples.

NÉ D'UN DÉFAUT RÉEL (25/09/2026, rapport de Rem : « pour, jour, sur, bonjour, mer : ils sont pas
muets ces r, c'est chiant »). Le moteur marquait MUET tout « r » en fin de mot — mesuré alors sur
les 7 263 mots du lexique phonétique qui finissent par « r » : 1 967 d'entre eux, soit 27,1 %,
étaient déclarés muets à tort. Ce n'était pas un cas isolé, c'était toute une classe.

POURQUOI. La table conditionnelle du g2p (COND) est indexée sur le caractère SUIVANT. En fin de mot
elle ne voit que « # » et doit trancher pour une population qu'elle ne peut pas distinguer : les
infinitifs en -er (manger, parler — r muet) et tout le reste (pour, jour, mer — r prononcé). Elle
tranchait « muet » avec h = 0,85, son hésitation la plus haute toutes lettres confondues.
⚠️ La table APPRISE, elle, avait REFUSÉ de trancher : `g2p_corrections.json` porte une entrée
« r + suivant » pour 29 lettres et AUCUNE pour « # » — la clé tombait sous le seuil de pureté de
0,75. La donnée disait « je ne sais pas » ; la table de base répondait quand même.

CE QUE CE BANC GARDE, contre `phono_homophones.json` (la MÊME source qui a entraîné les corrections) :
  ① AUCUN « r » final déclaré muet à tort — c'est la classe que Rem a rapportée, elle doit rester à zéro ;
  ② l'exactitude globale sur cette famille ne redescend pas sous son plancher mesuré.

⚠️ UN SEUL MOT RESTE FAUX, et ce n'est pas le moteur : `désassortir`, à qui la vérité-terrain donne
`dezasORti` — la prononciation de « désassorti », sans son r final. C'est le GOLD qui est fautif. Il
est nommé ici pour qu'on ne le « répare » pas un jour en cassant la règle.

  python3 dictee/r_final_probe.py            # verbeux
  python3 dictee/r_final_probe.py --check    # CI : silencieux si vert, sort 1 si rouge
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

CHECK = '--check' in sys.argv
PLANCHER = 99.9          # % d'exactitude sur les mots finissant par « r » (mesuré : 99,99 %)
GOLD_FAUTIF = {'désassortir'}


def log(*a):
    if not CHECK:
        print(*a)


def main():
    try:
        import decompose as D
    except SystemExit as e:
        print('· R FINAL : SAUTÉ — %s' % e)
        return 0
    W2P = D.W2P

    def _gold(w):
        p = W2P[w]
        return str(p[0] if isinstance(p, (list, tuple)) else p)

    if not W2P:
        print('✗ R FINAL : lexique phonétique vide — ce banc ne mesure rien')
        return 1

    mots = [w for w in W2P if w.endswith('r') and len(w) >= 2 and w.isalpha()]
    if len(mots) < 3000:
        print('✗ R FINAL : seulement %d mots en « r » lus — la lecture du lexique est cassée' % len(mots))
        return 1

    faux_muets, faux_prononces, bons = [], [], 0
    for w in mots:
        st = D.g2p(w)
        if not st or st[-1]['g'] != 'r':
            continue
        dit_muet = (not st[-1]['ph']) or st[-1]['ph'] in ('∅', '')
        p = W2P[w]
        p = p[0] if isinstance(p, (list, tuple)) else p
        gold_prononce = str(p).endswith('R')
        if gold_prononce and dit_muet:
            faux_muets.append(w)
        elif (not gold_prononce) and (not dit_muet):
            faux_prononces.append(w)
        else:
            bons += 1

    tot = bons + len(faux_muets) + len(faux_prononces)
    pct = 100.0 * bons / max(1, tot)
    fail = []
    if faux_muets:
        fail.append('%d mot(s) dont le « r » final est déclaré MUET À TORT — la classe rapportée par Rem '
                    'est revenue : %s' % (len(faux_muets), ', '.join(faux_muets[:12])))
    inattendus = [w for w in faux_prononces if w not in GOLD_FAUTIF]
    if inattendus:
        fail.append('%d mot(s) dont le « r » final est déclaré PRONONCÉ à tort : %s'
                    % (len(inattendus), ', '.join(inattendus[:12])))
    if pct < PLANCHER:
        fail.append('exactitude %.2f %% < plancher %.2f %% sur %d mots' % (pct, PLANCHER, tot))

    if fail:
        print('✗ R FINAL :')
        for f in fail:
            print('  ' + f)
        return 1
    # ② LE « e » DE « LES » (25/09/2026). COND['e']['s'] tranche MUET avec h = 1,45, la deuxième
    # hésitation la plus haute de la table. Juste pour l immense majorité (petites, portes, chantes),
    # faux pour une poignée de monosyllabes très fréquents — six déterminants présents dans presque
    # toutes les phrases. La liste est fermée et relevée dans le gold.
    E_PRONONCE = ['ces', 'des', 'les', 'mes', 'ses', 'tes']
    mauvais_e = []
    for w in E_PRONONCE:
        if w not in W2P:
            continue
        st = D.g2p(w)
        for x in st:
            if x['g'] == 'e' and ((not x['ph']) or x['ph'] in ('∅', '')):
                mauvais_e.append(w); break
    if mauvais_e:
        print('✗ MUETTES : le « e » est déclaré muet dans %s — or il se prononce (gold /le/, /de/…)'
              % ', '.join(mauvais_e))
        return 1
    # et l inverse : le e de « petites » DOIT rester muet
    E_MUET = ['petites', 'portes', 'chantes', 'bases', 'roses']
    mauvais_m = []
    for w in E_MUET:
        if w not in W2P:
            continue
        st = D.g2p(w)
        if not any(x['g'] == 'e' and ((not x['ph']) or x['ph'] in ('∅', '')) for x in st):
            mauvais_m.append(w)
    if mauvais_m:
        print('✗ MUETTES : le « e » n est plus muet dans %s — la liste fermée a débordé' % ', '.join(mauvais_m))
        return 1

    # ③ LE « -ent » DES VERBES (25/09/2026). Le commentaire du moteur disait « la POS lève l ambiguïté » :
    # FAUX, le code lisait une liste figée de 582 mots pour 8 137 concernés. La table qui sait était déjà
    # embarquée (vdc-lex.cj : 66 146 formes, 5 948 verbes). Plancher mesuré : 93,9 %, 0 faux positif.
    PLANCHER_ENT = 90.0
    ent_muet = [w for w in W2P if w.endswith('ent') and w.isalpha() and len(w) > 4
                and not _gold(w).endswith('@')]
    ent_pron = [w for w in W2P if w.endswith('ent') and w.isalpha() and len(w) > 4
               and _gold(w).endswith('@')]
    if len(ent_muet) < 5000:
        print('✗ MUETTES : seulement %d mots en -ent lus — lecture du lexique cassée' % len(ent_muet))
        return 1
    def _dit_muet(w):
        return any(x['g'] == 'en' and ((not x['ph']) or x['ph'] in ('∅', '')) for x in D.g2p(w))
    bons_e = sum(1 for w in ent_muet if _dit_muet(w))
    faux_e = [w for w in ent_pron if _dit_muet(w)]
    pct_e = 100.0 * bons_e / len(ent_muet)
    if faux_e:
        print('✗ MUETTES : le « -ent » est déclaré muet sur %d nom(s)/adjectif(s) : %s'
              % (len(faux_e), ', '.join(sorted(faux_e)[:12])))
        return 1
    if pct_e < PLANCHER_ENT:
        print('✗ MUETTES : -ent verbal couvert à %.1f %% < plancher %.1f %% (%d/%d) — la lecture des'
              ' formes conjuguées a-t-elle été débranchée ?' % (pct_e, PLANCHER_ENT, bons_e, len(ent_muet)))
        return 1

    log('✓ muettes : r final — %d mots mesurés, %.2f %% justes, AUCUN muet à tort ; '
        'e de les/des/mes prononcé ; -ent verbal muet à %.1f %% sur %d mots, 0 faux positif '
        '(le gold seul reste fautif sur %s).'
        % (tot, pct, pct_e, len(ent_muet), ', '.join(sorted(GOLD_FAUTIF))))
    return 0


if __name__ == '__main__':
    sys.exit(main())
