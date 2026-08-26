# -*- coding: utf-8 -*-
"""LE VETO CROISÉ — trois faces, une décision. (26/08/2026)

IDÉE TESTÉE. Aujourd'hui le correcteur est une PYRAMIDE : l'ortho (speller) réécrit les tokens,
PUIS la grammaire travaille sur les tokens nettoyés. `spirale_probe` a mesuré ce que ça coûte : la
grammaire ne voit plus le non-mot ET **ignore que le mot vient d'être fabriqué** — la PROVENANCE est
effacée. Précision de la grammaire selon le voisinage (mesuré, corpus dys réel) :

    mot propre .................. 91 %
    voisin BIEN réparé .......... 86 %
    non-mot laissé tel quel ..... 85 %
    le mot lui-même MAL réparé .. 75 %
    le VOISIN MAL réparé ........ 55 %   <- le poison

L'hypothèse « cube » : au lieu d'un empilement où chaque couche écrase la précédente, les trois voies
(ORTHO · PHONO · GRAMMAIRE) sont trois FACES d'un même objet, et une correction ROUGE ne s'applique
d'office que si **aucune autre face ne la contredit**. Contredite => elle n'est pas perdue, elle
DESCEND EN ORANGE (proposée au clic). C'est la doctrine §3 (jointe, pas argmax) appliquée aux trois
voies au lieu d'une seule.

CE QUI EST MESURÉ. Le seul chiffre qui pilote : `dys_pipeline_probe` de bout en bout sur les 72
productions dys réelles — RÉPARÉS (le gain) et CASSÉS (la faute). Chaque veto est mesuré SÉPARÉMENT
(doctrine §4 : une jonction à la fois), puis les combinaisons qui paient.

Un veto ne peut faire que trois choses, et on les compte toutes les trois :
  · il ÉVITE une casse            -> gain net
  · il PERD une réparation        -> coût, atténué : la correction reste offerte AU CLIC (orange)
  · il ne change rien (faux->faux) -> neutre

FALSIFIABLE. Si aucun veto ne bouge le couple (réparés, cassés), l'idée du cube est morte pour ce
produit : on la jette et on garde la pyramide. C'est le but de la sonde.

⛔ RÉSULTAT (26/08/2026) — **FALSIFIÉ, NE PAS CÂBLER.** Baseline vérifiée contre
`dys_pipeline_probe` : 397 réparés (25,7 %) / 19 cassés (0,41 %) sur 6 217 mots, à l'identique.
AUCUN veto n'est un gain — le meilleur taux de change est de **5 réparations perdues pour 1 casse
évitée** (voisin fabriqué ±1 : −10/−2) ; le veto qui attrape le plus de casses (PHONO, −8) en coûte
**52**. Et le PLAFOND ORACLE — on ne garde chaque veto que sur les règles où il paie SUR CE CORPUS
MÊME, surapprentissage assumé, donc borne supérieure de l'idée — rend **+0 réparation / −1 casse**,
sur une seule règle (`on/ont`). Même en trichant, le cube croisé rapporte UN token sur 6 217.

CE QUE LA MESURE APPREND QUAND MÊME (le résultat utile, lui) :
  1. TROISIÈME confirmation de « garde PAR RÈGLE, jamais globale » (après l'ancre polluée et la
     contradiction dét/nom) : les pertes se concentrent sur `-é/-er`, `accord pluriel nom` et
     `accord sujet-verbe`, c.-à-d. les règles les plus JUSTES du moteur, qu'un veto global éteint
     indistinctement. Une contrainte jointe qui ignore l'identité de la règle ne peut pas payer.
  2. La face PHONO est le meilleur des trois signaux (8 casses vues, le plus haut), et son sous-cas
     le plus net est `accord sujet-verbe` quand la correction CHANGE LE NOMBRE d'un verbe :
     3 casses évitées / 7 réparations perdues (vaut→valent, décidera→décideront, rentre→rentrent).
     Toujours négatif (2,3 pour 1), mais seul endroit sous 5 — piste éventuelle, non comme VETO
     mais comme PREUVE exigée de la règle SV. Non traité.
  ⚠️ n=19 casses : les « casses évitées » reposent sur de très petits nombres. Ce qui est solide,
     c'est le COÛT (27 à 55 réparations perdues), mesuré sur des effectifs larges.

    OMEGA_DYS_DATA=... python3 dictee/cube_veto_probe.py       (~6 min, puis CACHE : instantané)
    CUBE_NOCACHE=1 python3 dictee/cube_veto_probe.py           (force le recalcul)
"""
import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import correcteur_probe as CP        # noqa: E402
import dys_precision_probe as DP     # noqa: E402
import speller_probe as S            # noqa: E402

SP = S.Speller()
TOK = re.compile("[A-Za-zÀ-ÿœŒ'’ʼ]+")   # le tokeniseur DU MOTEUR (apostrophes typographiques incluses)
CACHE = os.path.join(os.environ.get('TEMP') or '/tmp', 'omega_cube_veto_cache.json')


# ---------------------------------------------------------------------------------------------
# 1. UNE PASSE D'ENREGISTREMENT — la pyramide, mais on garde la PROVENANCE et TOUTES les décisions
# ---------------------------------------------------------------------------------------------
def pyramide_rec(txt):
    """Comme `dys_pipeline_probe.pyramide`, mais au lieu d'appliquer la 1re règle rouge on ENREGISTRE
    la liste ordonnée des règles qui tirent sur chaque token, plus ce que le speller a fait avant.
    Rejouer un veto devient alors gratuit (pas de 2e passe speller)."""
    T = CP.toks(txt)
    starts = {m.start(): i for i, m in enumerate(TOK.finditer(txt))}
    Tc = T[:]
    prov = {}                                   # i -> 'lem' (lettres changées) | 'acc' (accent seul)
    orange_sp = {}
    signale = []
    for (st, w, sg, act) in SP.correct_text(txt):
        i = starts.get(st)
        if i is None or i >= len(T) or DP.norm(T[i]) != DP.norm(w):
            continue
        if act != 'vigilance' and sg.isalpha():
            # PROVENANCE : le mot que la grammaire va lire n'est plus celui de l'élève.
            # On sépare le changement de LETTRES (« parvies »->parties : risqué) de la simple
            # restauration d'ACCENT (« fenetre »->fenêtre : mesuré FP=0).
            if sg != Tc[i]:
                prov[str(i)] = 'lem' if DP.norm(sg) != DP.norm(Tc[i]) else 'acc'
            Tc[i] = sg
        elif act == 'vigilance' and sg.isalpha() and DP.norm(sg) != DP.norm(w):
            orange_sp.setdefault(str(i), []).append(sg)
        elif act == 'vigilance':
            signale.append(i)
    CP._SEG = CP._seg_info(' '.join(Tc))
    dec = {}                                    # i -> [(règle, suggestion, palier), ...] dans l'ordre de RULES
    for i in range(len(Tc)):
        lst = []
        for nm, rule in CP.RULES:
            try:
                d = rule(Tc, i)
            except Exception:
                continue
            if d is None:
                continue
            sg = d['sugg'] if isinstance(d, dict) else d
            if isinstance(sg, str) and sg != Tc[i]:
                try:
                    tr = CP.tier_of(Tc, i, nm, sg) or 'auto'
                except Exception:
                    tr = 'auto'
                lst.append([nm, sg, tr])
        if lst:
            dec[str(i)] = lst
    return {'T': T, 'Tc': Tc, 'dec': dec, 'prov': prov,
            'orange_sp': orange_sp, 'signale': signale}


# ---------------------------------------------------------------------------------------------
# 2. LES TROIS FACES — chaque veto est une CONTRADICTION entre deux faces, isolée et nommée
# ---------------------------------------------------------------------------------------------
def _inconnu(w):
    """face ORTHO, lecture brute : ce token est-il un mot attesté ? (définition LEXICALE du non-mot,
    la même que `spirale_probe` : absent du lexique speller, repli déaccentué)."""
    lw = w.lower()
    return not (lw in SP.WORDS or S.deacc(lw) in SP.WORDS or lw in SP.PRENOMS_L)


def _veto_self(kind):
    """ORTHO x GRAMMAIRE — le mot corrigé a lui-même été FABRIQUÉ par le speller (75 % de précision)."""
    def f(rec, i, nm, sg):
        return rec['prov'].get(str(i)) == kind
    return f


def _veto_voisin(kind, rayon):
    """ORTHO x GRAMMAIRE — l'ANCRE a été fabriquée par le speller. C'est le sous-cas à 55 %,
    « mérite l'orange sans discussion » (ETAT_DES_LIEUX), jamais câblé jusqu'ici."""
    def f(rec, i, nm, sg):
        for j in range(i - rayon, i + rayon + 1):
            if j != i and rec['prov'].get(str(j)) == kind:
                return True
        return False
    return f


def _veto_ancre_inconnue(rayon):
    """ORTHO x GRAMMAIRE — l'ancre est un NON-MOT laissé tel quel (85 %). La règle a lu un
    déterminant / un nom / un auxiliaire qui n'existe pas."""
    def f(rec, i, nm, sg):
        Tc = rec['Tc']
        for j in range(max(0, i - rayon), min(len(Tc), i + rayon + 1)):
            if j != i and Tc[j].isalpha() and _inconnu(Tc[j]):
                return True
        return False
    return f


def _veto_phono(rec, i, nm, sg):
    """PHONO x GRAMMAIRE — la correction CHANGE le son du mot. Une correction d'accord ou
    d'homophone grammatical est par construction phono-neutre (joue->jouent, a->à, sait->s'est) ;
    si le son change, la règle ne fait pas ce qu'elle annonce."""
    return S.phon_key(rec['Tc'][i]) != S.phon_key(sg)


VETOS = [
    ('ORTHO/GRAM  mot fabrique (lettres)',       _veto_self('lem')),
    ('ORTHO/GRAM  mot re-accentue',              _veto_self('acc')),
    ('ORTHO/GRAM  VOISIN fabrique +-1',          _veto_voisin('lem', 1)),
    ('ORTHO/GRAM  VOISIN fabrique +-2',          _veto_voisin('lem', 2)),
    ('ORTHO/GRAM  VOISIN re-accentue +-1',       _veto_voisin('acc', 1)),
    ('ORTHO/GRAM  ancre NON-MOT +-1',            _veto_ancre_inconnue(1)),
    ('ORTHO/GRAM  ancre NON-MOT +-2',            _veto_ancre_inconnue(2)),
    ('PHONO/GRAM  la correction change le son',  _veto_phono),
]


# ---------------------------------------------------------------------------------------------
# 3. REJEU — appliquer la pyramide sous un veto donné
# ---------------------------------------------------------------------------------------------
def rejoue(rec, veto=None):
    """Sortie de la pyramide. `veto(rec,i,nm,sg) -> True` fait DESCENDRE la correction en orange :
    elle n'est pas appliquée, et la recherche continue avec les règles suivantes (exactement le
    traitement d'une vigilance dans le moteur)."""
    out = rec['Tc'][:]
    qui = {}                                    # i -> regle effectivement appliquee
    bloque = {}                                 # i -> [regles descendues en orange par le veto]
    for si, lst in rec['dec'].items():
        i = int(si)
        for (nm, sg, tr) in lst:
            if tr == 'vigilance':
                continue
            if veto is not None and veto(rec, i, nm, sg):
                bloque.setdefault(i, []).append(nm)
                continue
            out[i] = sg
            qui[i] = nm
            break
    return out, qui, bloque


# ---------------------------------------------------------------------------------------------
# 4. MESURE
# ---------------------------------------------------------------------------------------------
def charge_ambig():
    amb = {}
    p = os.path.join(DP.DATA, 'gold_claude.jsonl')
    if os.path.exists(p):
        for l in io.open(p, encoding='utf-8'):
            l = l.strip()
            if l:
                o = json.loads(l)
                amb[o['raw']] = set(x.lower() for x in o.get('ambig', []))
    return amb


def collecte():
    """Une seule passe coûteuse (le speller), mise en cache."""
    if os.path.exists(CACHE) and not os.environ.get('CUBE_NOCACHE'):
        try:
            d = json.load(io.open(CACHE, encoding='utf-8'))
            sys.stderr.write('  (cache : %d productions relues)\n' % len(d))
            return d
        except Exception:
            pass
    amb = charge_ambig()
    recs = []
    for fn, brut, gold in DP.pairs():
        if fn != 'gold_claude.jsonl':          # le GOLD RÉEL corrigé à la main (72 productions)
            continue
        r = pyramide_rec(brut)
        r['gold'] = gold
        r['amb'] = sorted(amb.get(brut.strip(), set()))
        recs.append(r)
        sys.stderr.write('\r  passe speller+grammaire : %d' % len(recs))
        sys.stderr.flush()
    sys.stderr.write('\n')
    try:
        io.open(CACHE, 'w', encoding='utf-8').write(json.dumps(recs, ensure_ascii=False))
    except Exception:
        pass
    return recs

def juge(recs, veto=None, ref=None):
    """-> dict. `ref` = sorties de la baseline, pour ventiler EXACTEMENT ce que le veto a changé.

    ATTENTION AU PIÈGE DE VENTILATION (corrigé le 26/08) : un token que le veto rend juste n'est pas
    forcément une CASSE ÉVITÉE. Deux cas très différents, qu'il faut compter séparément :
      · le mot était JUSTE au départ, la pyramide l'a cassé, le veto le sauve  -> CASSE ÉVITÉE
      · le mot était FAUX, la grammaire s'est trompée, et le token nettoyé par le speller EST le gold
        -> RÉPARATION GAGNÉE (la grammaire écrasait une bonne réparation ortho)
    La 1re version mélangeait les deux et faisait passer « annocer->annoncé » pour une casse évitée
    alors que le mot était faux au départ. Seule la 1re justifie de toucher à un palier ROUGE."""
    rep = casse = faux = justes = 0
    ev_casse = ev_rep = perdu = neutre = nveto = 0
    par_regle = {}          # règle -> [casse évitée, réparation gagnée, réparation PERDUE, neutre, bloquées]
    ex_casse, ex_perdu = [], []
    for k, r in enumerate(recs):
        T = r['T']
        amb = set(r['amb'])
        out, qui, bloque = rejoue(r, veto)
        nveto += sum(len(v) for v in bloque.values())
        for i, lst in bloque.items():
            for nm in lst:
                par_regle.setdefault(nm, [0, 0, 0, 0, 0])[4] += 1
        al = DP.align(T, [x.group(0) for x in DP.TOK.finditer(r['gold'])])
        for i, w in enumerate(T):
            if not w.isalpha() or i not in al or w.lower() in amb:
                continue
            g = al[i]
            etait_faux = not DP.eq(w, g)
            fini_juste = DP.eq(out[i], g)
            if etait_faux:
                faux += 1
                if fini_juste:
                    rep += 1
            else:
                justes += 1
                if not fini_juste:
                    casse += 1
            if ref is None or ref[k][i] == out[i]:
                continue
            av_juste = DP.eq(ref[k][i], g)
            nm = _qui_base(k, i) or '(ortho seule)'      # la règle que la PYRAMIDE avait appliquée
            cell = par_regle.setdefault(nm, [0, 0, 0, 0, 0])
            if fini_juste and not av_juste:
                if etait_faux:
                    ev_rep += 1
                    cell[1] += 1
                else:
                    ev_casse += 1
                    cell[0] += 1
                    if len(ex_casse) < 8:
                        ex_casse.append('[%s] %s -> %s  CASSE EVITEE (gold %s)' % (nm, w, ref[k][i], g))
            elif av_juste and not fini_juste:
                perdu += 1
                cell[2] += 1
                if len(ex_perdu) < 8:
                    ex_perdu.append('[%s] %s -> %s  PERDU (le veto retient %s)' % (nm, w, ref[k][i], out[i]))
            else:
                neutre += 1
                cell[3] += 1
    return dict(rep=rep, casse=casse, faux=faux, justes=justes, nveto=nveto,
                ev_casse=ev_casse, ev_rep=ev_rep, perdu=perdu, neutre=neutre,
                par_regle=par_regle, ex_casse=ex_casse, ex_perdu=ex_perdu)


_BASE_QUI = None


def _qui_base(k, i):
    return (_BASE_QUI[k] or {}).get(i) if _BASE_QUI else None


def main():
    global _BASE_QUI
    recs = collecte()
    if not recs:
        print('cube_veto_probe : gold dys local absent -> sonde SAUTEE (pas un echec).')
        return
    base = [rejoue(r) for r in recs]
    base_out = [x[0] for x in base]
    _BASE_QUI = [x[1] for x in base]
    b = juge(recs, None)
    print('')
    print('VETO CROISE - 3 faces (ORTHO . PHONO . GRAMMAIRE) sur %d productions dys reelles' % len(recs))
    print('  %d mots alignes  |  %d faux au depart  |  %d justes au depart'
          % (b['faux'] + b['justes'], b['faux'], b['justes']))
    print('')
    print('  %-42s %14s %14s   %s' % ('', 'REPARES', 'CASSES', 'ce que le veto a change'))
    print('  %-42s %14s %14s' % ('PYRAMIDE (reference, aucun veto)',
                                 '%d (%.1f%%)' % (b['rep'], 100.0 * b['rep'] / max(1, b['faux'])),
                                 '%d (%.2f%%)' % (b['casse'], 100.0 * b['casse'] / max(1, b['justes']))))
    print('  ' + '-' * 122)
    res = []
    for nom, fn in VETOS:
        v = juge(recs, fn, ref=base_out)
        res.append((nom, fn, v))
        print('  %-42s %14s %14s   %3d veto : %d casse evitee, %d rep. gagnee, %d rep. PERDUE, %d neutre'
              % (nom,
                 '%d (%+d)' % (v['rep'], v['rep'] - b['rep']),
                 '%d (%+d)' % (v['casse'], v['casse'] - b['casse']),
                 v['nveto'], v['ev_casse'], v['ev_rep'], v['perdu'], v['neutre']))
    print('')
    print('  LE TAUX DE CHANGE : combien de reparations perdues pour UNE casse evitee ?')
    for nom, fn, v in res:
        dc = b['casse'] - v['casse']
        dr = b['rep'] - v['rep']
        tx = ('%.1f pour 1' % (float(dr) / dc)) if dc > 0 else 'AUCUNE casse evitee'
        print('    %-42s  -%2d reparations pour -%d casse   =  %s' % (nom, dr, dc, tx))
    print('')
    # -----------------------------------------------------------------------------------------
    # PAR REGLE. Un veto GLOBAL frappe indistinctement. Le detail dit s'il existe un sous-ensemble
    # de regles ou il paierait — le projet a deja conclu DEUX fois « garde PAR REGLE, jamais
    # globale » (ancre polluee, contradiction det/nom) ; troisieme confirmation attendue ici.
    # -----------------------------------------------------------------------------------------
    for nom, fn, v in res:
        util = dict((k2, c) for k2, c in v['par_regle'].items() if c[0] or c[1] or c[2])
        if not util:
            continue
        print('  -- %s : par regle (casse evitee / rep. gagnee / rep. PERDUE)' % nom)
        for k2, c in sorted(util.items(), key=lambda kv: (kv[1][2] - kv[1][0] - kv[1][1])):
            print('       %-36s  %2d / %2d / %2d%s' % (k2, c[0], c[1], c[2],
                                                       '   <= paie' if (c[0] + c[1]) > c[2] else ''))
        print('')
    # -----------------------------------------------------------------------------------------
    # PLAFOND ORACLE. On ne garde chaque veto que sur les regles ou il paie SUR CE CORPUS.
    # C'est du SURAPPRENTISSAGE ASSUME : pas une proposition de cablage, mais le MEILLEUR que
    # l'idee du cube puisse faire ici. Si meme ce plafond est plat, l'idee est morte.
    # -----------------------------------------------------------------------------------------
    print('  PLAFOND ORACLE (surapprentissage assume - PAS une proposition de cablage)')
    for nom, fn, v in res:
        keep = set(k2 for k2, c in v['par_regle'].items() if (c[0] + c[1]) > c[2])
        if not keep:
            print('    %-42s  aucun sous-ensemble de regles ne paie' % nom)
            continue

        def vf(rec, i, nm, sg, _fn=fn, _keep=keep):
            return nm in _keep and _fn(rec, i, nm, sg)
        o = juge(recs, vf, ref=base_out)
        print('    %-42s  REPARES %d (%+d)  CASSES %d (%+d)   [%s]'
              % (nom, o['rep'], o['rep'] - b['rep'], o['casse'], o['casse'] - b['casse'],
                 ', '.join(sorted(keep))[:60]))
    print('')
    for nom, fn, v in res:
        if v['ex_casse']:
            print('  -- %s : les casses REELLEMENT evitees' % nom)
            for x in v['ex_casse']:
                print('      OK  %s' % x)
            for x in v['ex_perdu'][:4]:
                print('      KO  %s' % x)
            print('')


if __name__ == '__main__':
    main()
