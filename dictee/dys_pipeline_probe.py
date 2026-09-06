# -*- coding: utf-8 -*-
"""LE PIPELINE COMPLET, JUGÉ DE BOUT EN BOUT — le chiffre que le projet n'avait pas.

POURQUOI (22/08/2026). `dys_precision_probe` juge chaque COUCHE isolément : le speller sur ses
suggestions, chaque règle sur les siennes. C'est utile pour régler une règle, mais ça MENT sur le
produit — parce que la correction d'un mot dys demande souvent DEUX couches :

    « je me suis preparer »
        · le speller restaure l'ACCENT      → « préparer »   (son métier, il le fait bien)
        · la grammaire corrige la FLEXION   → « préparé »    (son métier, elle le fait bien)

Jugé couche par couche, le speller compte une FAUSSE (il n'a pas rendu « préparé »). Jugé de bout
en bout, la pyramide rend « préparé » — c'est-à-dire le gold. Mesuré sur les 5 échecs `orthographe
auto` les plus typiques : **4 sont justes après pyramide**. Le « 75,4 % » du speller était donc en
grande partie un ARTEFACT DE MESURE, pas une faiblesse du moteur.

CE QU'ON MESURE ICI — la seule chose qui compte pour l'élève, mot à mot contre le gold :
  · RÉPARÉ   : le mot était faux, la sortie est le gold          → le gain
  · RATÉ     : le mot était faux, la sortie n'est pas le gold    → occasion manquée (pas une faute)
  · CASSÉ    : le mot était JUSTE, la sortie ne l'est plus       → LA FAUTE (le péché cardinal)
             ⚠️ seules les corrections ROUGES comptent : une orange est proposée AU CLIC, jamais
             appliquée seule. La 1re version de cette sonde les comptait à tort (5 sur 23).
  · INTACT   : le mot était juste et le reste

⚠️ « CASSÉ » est la seule métrique qui doit piloter un palier rouge : rater une correction se voit
à peine, en fabriquer une se paie cash — c'est la doctrine FP=0 du projet, appliquée au produit.

⚠️ Le juge tolère l'ACCENT et l'ÉLISION comme `dys_precision_probe.eq` : on juge une CORRECTION,
pas la description d'un corpus (cf. le biais mesuré dans ETAT_DES_LIEUX §3ter).

  OMEGA_DYS_DATA=… python3 dictee/dys_pipeline_probe.py
"""
import os
import re
import os as _os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import correcteur_probe as CP        # noqa: E402
import dys_precision_probe as DP     # noqa: E402
import speller_probe as S            # noqa: E402

SP = S.Speller()
# ⚠️ LE MÊME TOKENISEUR QUE LE MOTEUR, sinon les offsets ne correspondent pas. Bug rencontré le
# 22/08 : la sonde utilisait `[A-Za-zÀ-ÿœŒæÆ']+` (sans les apostrophes typographiques ’ʼ) alors que
# `CP.toks` les INCLUT — tout texte contenant « j’ai » décalait l'index, et **32 % des corrections du
# speller (188 sur 584) étaient silencieusement abandonnées**. Résultat : réparations sous-estimées et
# casses GONFLÉES (« tres »→« tre » n'existait que dans la sonde ; le speller corrige « tres »→« très »
# en auto bien avant la grammaire). Une sonde fausse est pire qu'une sonde absente.
TOK = re.compile(r"[A-Za-zÀ-ÿœŒ'’ʼ]+")


def pyramide(txt):
    """LA PYRAMIDE, comme `diagnoseAll` : ortho d'abord (marques non-vigilance appliquées aux
    tokens), PUIS grammaire sur les tokens nettoyés. Rend la liste des tokens de sortie."""
    T = CP.toks(txt)
    orange = {}                                      # i -> suggestions offertes AU CLIC (jamais appliquées)
    signale = set()                                  # i -> souligné SANS suggestion (« mot inconnu »)
    starts = {m.start(): i for i, m in enumerate(TOK.finditer(txt))}
    Tc = T[:]
    for (st, w, sg, act) in SP.correct_text(txt, inconnu=True):
        i = starts.get(st)
        if i is None or i >= len(T) or DP.norm(T[i]) != DP.norm(w):
            continue
        if act == 'inconnu':
            # PALIER « MOT INCONNU » (porté du JS le 04/09/2026 — spell_unknown, décalque de spellUnknown).
            # ORANGE au clic si suggestion, simple soulignement sinon : jamais appliqué → le chiffre
            # produit (réparés/cassés) ne peut PAS bouger par construction ; seule la VENTILATION des
            # ratés change (« signalé sans suggestion » cesse d'être structurellement 0).
            if sg and DP.norm(sg) != DP.norm(w):
                orange.setdefault(i, []).append(sg)
            else:
                signale.add(i)
            continue
        if act != 'vigilance' and sg.isalpha():
            Tc[i] = sg
        elif act == 'vigilance' and sg.isalpha() and DP.norm(sg) != DP.norm(w):
            orange.setdefault(i, []).append(sg)      # proposé, souligné, PAS appliqué
        elif act == 'vigilance':
            signale.add(i)                           # SOULIGNÉ sans suggestion : « il y a un problème ici »
    # ⚠️ VICE D'INSTRUMENT RÉPARÉ (31/08/2026, même famille que le bug des apostrophes du 22/08) :
    # « ' '.join(Tc) » DÉTRUISAIT la ponctuation de l'AUTEUR — le produit (diagnoseAll) calcule _SEG
    # sur le texte ORIGINAL, points et virgules compris. Mesuré sur une production réelle : « … des
    # milliers d'animaux . les animaux mange … » — le point donne la borne qui permet mange→mangent ;
    # la sonde sans point comptait un RATÉ que le produit répare. On normalise ’ʼ→' comme correct()
    # (sinon _seg_info, dont le motif n'a pas les apostrophes typographiques, désaligne les indices).
    CP._SEG = CP._seg_info(txt.replace('’', "'").replace('ʼ', "'"))
    CP._SEG['pb'] = CP._pred_bounds(Tc, CP._SEG)   # bornes prédites (canal pb) : la sonde équipe la grammaire COMME LE PRODUIT (diagnoseAll pose pb sur les tokens nettoyés)
    out = Tc[:]
    for i in range(len(Tc)):
        for nm, rule in CP.RULES:
            try:
                d = rule(Tc, i)
            except Exception:
                continue
            if d is None:
                continue
            sg = d['sugg'] if isinstance(d, dict) else d
            if isinstance(sg, str) and sg != Tc[i]:
                # ⚠️ LE PALIER, comme dans le produit : ROUGE = appliqué d'office, ORANGE (vigilance) =
                # proposé AU CLIC, jamais appliqué seul. Sans ce filtre la sonde comptait comme « cassés »
                # des mots que l'utilisateur ne voit que soulignés — mesuré le 22/08 : 5 des 23 casses de
                # grammaire, dont 4 des 6 « genre déterminant », étaient en réalité ORANGE.
                try:
                    _tr = CP.tier_of(Tc, i, nm, sg) or 'auto'
                except Exception:
                    _tr = 'auto'
                if _tr == 'vigilance':
                    orange.setdefault(i, []).append(sg)
                    continue                      # orange : on n'applique pas, on continue de chercher
                out[i] = sg
                break
    return T, out, Tc, orange, signale


_INFL = ('s', 'x', 'e', 'es', 'ent', 'é', 'ée', 'és', 'ées', 'er', 'ez', 'ai', 'ais', 'ait', 'aient', 'ons', 'ont', 'a', 'as', 'ra', 'rai', 'ras', 'rons', 'rez', 'ront')

def meme_lemme(a, b):
    """« BON LEMME, MAUVAISE FLEXION » (10/09/2026) : le rouge a réécrit la faute vers une AUTRE forme du BON mot
    (aller→allé / gold allée, posibilité→possibilité / possibilités). Jugé avec les tables du produit que porte la
    référence : verbes = même lemme dans CONJ_F ; adjectifs = paire ADJ (m/f) ; noms/adjectifs = même forme à -s/-x près ;
    sinon même radical déaccentué (≥ 4 lettres) et deux finales d'une liste FERMÉE de flexions. Heuristique, nommée."""
    la, lb = a.lower(), b.lower()
    if la == lb: return False
    def lemmes(w):
        r = SP.CONJ_F.get(DP.norm(w)) or SP.CONJ_F.get(w) or ''
        return set(x.split(';')[0] for x in r.split('|') if x)
    if lemmes(la) & lemmes(lb): return True
    pa, pb = SP.ADJ.get(DP.norm(la)), SP.ADJ.get(DP.norm(lb))
    if pa and DP.norm(pa[1]) == DP.norm(lb): return True
    if pb and DP.norm(pb[1]) == DP.norm(la): return True
    na, nb = DP.norm(la).rstrip('sx'), DP.norm(lb).rstrip('sx')
    if na == nb: return True
    for ea in _INFL:
        for eb in _INFL:
            if la.endswith(ea) and lb.endswith(eb):
                ra, rb = DP.norm(la[:-len(ea)]), DP.norm(lb[:-len(eb)])
                if len(ra) >= 4 and ra == rb: return True
    return False


def _strict(x, y):
    """Comme DP.eq (élisions/soudures tolérées) mais SANS désaccentuer : « mere » ≠ « mère ». Posé le 11/09/2026 quand
    _AFIX_MIN a réparé 5 mots dans les 72 productions sans que le chiffre bouge — eq() les tenait pour déjà justes."""
    a = str(x).lower().replace(u'’', "'"); b = str(y).lower().replace(u'’', "'")
    return a == b or a.split("'")[-1].split(' ')[-1] == b.split("'")[-1].split(' ')[-1]


def main():
    rep = rate = casse = intact = 0
    or_juste = or_faux = muet = sign = 0
    app_faux = 0; ex_appf = []                       # ⭐ ROUGE APPLIQUÉ… vers un AUTRE mauvais mot (07/09/2026)
    app_lem = 0; ex_lem = []                         # ⭐ dont « bon lemme, mauvaise flexion » (10/09/2026)
    acc_faux = acc_rep = acc_casse = 0; ex_acc_rep = []; ex_acc_casse = []   # ⭐ ACCENTS stricts (11/09/2026) : eq() désaccentue, cette colonne non
    _dump = [] if _os.environ.get('DUMP_MUETS') else None   # sonde : liste des ratés SILENCIEUX côté Python                # ventilation des RATÉS : que voit vraiment l'utilisateur ?
    ex_or, ex_orf = [], []
    ex_casse, ex_rep = [], []
    n = 0
    import io as _io, json as _json
    amb_par_src = {}
    _p = os.path.join(DP.DATA, 'gold_claude.jsonl')
    if os.path.exists(_p):
        for _l in _io.open(_p, encoding='utf-8'):
            _l = _l.strip()
            if _l:
                _o = _json.loads(_l)
                amb_par_src[_o['raw']] = set(x.lower() for x in _o.get('ambig', []))
    for fn, brut, gold in DP.pairs():
        if fn != 'gold_claude.jsonl':          # le GOLD RÉEL corrigé à la main (67 productions)
            continue
        n += 1
        # ⚠️ Les tokens `ambig` sont ceux que MOI je n'ai pas su trancher : je les ai laissés INTACTS
        # dans le gold. Les compter « cassés » quand le moteur les corrige serait lui reprocher de
        # savoir ce que j'ignore — on les exclut du jugement (cf. protocole, ETAT_DES_LIEUX §5ter).
        amb = amb_par_src.get(brut.strip(), set())
        T, out, _Tc_ref, orange, signale = pyramide(brut)
        al = DP.align(T, [x.group(0) for x in DP.TOK.finditer(gold)])
        for i, w in enumerate(T):
            if not w.isalpha() or i not in al or w.lower() in amb:
                continue
            g = al[i]
            etait_faux = not DP.eq(w, g)
            fini_juste = DP.eq(out[i], g)
            # ⭐ ACCENTS (11/09/2026) : eq()/norm() DÉSACCENTUENT — « mere » ≡ « mère » pour le juge. Les fautes d'accent SEUL (la famille
            # la plus fréquente des dys) et les accents CASSÉS sur des mots justes lui sont donc invisibles : ni dans « faux au départ »,
            # ni dans « réparés », ni dans « cassés ». Colonne stricte à côté, sans toucher au chiffre historique (comparable).
            if DP.eq(w, g) and not _strict(w, g):
                acc_faux += 1
                if _strict(out[i], g):
                    acc_rep += 1
                    if len(ex_acc_rep) < 10: ex_acc_rep.append('%s → %s' % (w, out[i]))
            elif _strict(w, g) and not _strict(out[i], g) and DP.eq(out[i], g):
                acc_casse += 1
                ex_acc_casse.append('%-14s → %-14s  …%s…' % (w, out[i], ' '.join(T[max(0, i - 4):i + 4])))
            if etait_faux and fini_juste:
                rep += 1
                if len(ex_rep) < 8:
                    ex_rep.append('%s → %s' % (w, out[i]))
            elif etait_faux:
                rate += 1
                # ⭐ APPLIQUÉ FAUX (07/09/2026, vu avec b_slip) : le ROUGE a réécrit la faute… vers un mot qui n'est
                # PAS le gold (« tres »→trés, « apres »→aprés). Avant cette colonne, ces cas tombaient en MUET — la
                # sonde ne savait pas dire « le produit a AFFIRMÉ un mauvais mot ». C'est le PIRE des ratés : ni
                # silence ni proposition, une réécriture fausse que l'utilisateur ne voit plus comme une faute.
                _props = orange.get(i, [])
                _bons = [x for x in _props if DP.eq(x, g)]
                if DP.norm(out[i]) != DP.norm(w):
                    app_faux += 1
                    if len(ex_appf) < 12: ex_appf.append('%s → %s (gold %s)' % (w, out[i], g))
                    if meme_lemme(out[i], g):
                        app_lem += 1
                        if len(ex_lem) < 8: ex_lem.append('%s → %s (gold %s)' % (w, out[i], g))
                elif _bons:
                    or_juste += 1
                    if len(ex_or) < 8: ex_or.append('%s → %s' % (w, _bons[0]))
                elif _props:
                    or_faux += 1
                    if len(ex_orf) < 8: ex_orf.append('%s → %s (gold %s)' % (w, _props[0], g))
                elif i in signale:
                    sign += 1                        # souligné sans suggestion : vu, pas réparable
                else:
                    muet += 1
                    if _dump is not None: _dump.append({'src': brut[:60], 'mot': w, 'gold': g})
            elif not fini_juste:
                casse += 1
                if len(ex_casse) < 60:
                    _q = ''
                    for _nm, _r in CP.RULES:                    # QUELLE règle a cassé le mot ? (pour trier par cause)
                        try:
                            _d = _r(out[:i] + [w] + out[i + 1:], i) if False else _r(_Tc_ref, i)
                        except Exception:
                            continue
                        if _d is None:
                            continue
                        _sg = _d['sugg'] if isinstance(_d, dict) else _d
                        if isinstance(_sg, str) and _sg == out[i]:
                            _q = _nm
                            break
                    ex_casse.append('%-28s %-14s → %-14s (gold %-12s)  …%s…'
                                    % ('[' + (_q or 'ortho') + ']', w, out[i], g, ' '.join(T[max(0, i - 4):i + 4])))
            else:
                intact += 1
    if not n:
        print('dys_pipeline_probe : gold dys local absent → sonde SAUTÉE (pas un échec).')
        return
    faux = rep + rate
    juste = casse + intact
    print('\nPIPELINE COMPLET sur %d productions dys RÉELLES — %d mots alignés\n' % (n, faux + juste))
    print('  mots FAUX au départ : %d' % faux)
    print('     · RÉPARÉS  : %4d   (%.1f %% des fautes)   ← le gain' % (rep, 100.0 * rep / max(1, faux)))
    print('     · ratés    : %4d   (%.1f %%)              occasion manquée, pas une faute' % (rate, 100.0 * rate / max(1, faux)))
    print()
    print("  -- LES RATES, VENTILES : que voit REELLEMENT l'utilisateur ? --")
    print('     - rattrapable EN UN CLIC : %4d  (%.1f %% des rates)  un ORANGE est propose, et il est JUSTE'
          % (or_juste, 100.0 * or_juste / max(1, rate)))
    print('     - bruit orange           : %4d  (%.1f %%)             un orange est propose, mais il est FAUX'
          % (or_faux, 100.0 * or_faux / max(1, rate)))
    print('     - signale SANS suggestion: %4d  (%.1f %%)             vu, pas reparable en un clic'
          % (sign, 100.0 * sign / max(1, rate)))
    print('     - MUET (cote Python)     : %4d  (%.1f %%)             (!) LEGER SUR-ESTIME - voir avertissement'
          % (muet, 100.0 * muet / max(1, rate)))
    print('     - APPLIQUE FAUX (rouge)  : %4d  (%.1f %%)             un ROUGE a REECRIT la faute vers un AUTRE mauvais mot — le pire des rates'
          % (app_faux, 100.0 * app_faux / max(1, rate)))
    print('         dont BON LEMME, mauvaise flexion : %4d  (%.1f %% des appliques faux)   le bon mot, pas la bonne forme — un rate d ACCORD, pas d orthographe'
          % (app_lem, 100.0 * app_lem / max(1, app_faux)))
    print()
    print('     (!) Le palier « mot inconnu » (spellUnknown JS) est PORTE dans la reference depuis le')
    print('         04/09/2026 (spell_unknown, action `inconnu`) : « signale = 0 » n est plus un artefact.')
    print('         « MUET » reste un LEGER sur-estime : les couches vigilance de spellText encore')
    print('         absentes cote Python (anglicisme, homoVig, accords oranges...) soulignent une part')
    print('         de ces rates dans le produit — la ventilation PRODUIT exacte se mesure avec un dump')
    print('         dys-core (cf. ETAT_DES_LIEUX §5septies et l enquete du 04/09).')
    if ex_or:  print('     exemples rattrapables :', ' | '.join(ex_or[:6]))
    if ex_orf: print('     exemples de bruit     :', ' | '.join(ex_orf[:4]))
    if ex_appf: print('     appliques FAUX        :', ' | '.join(ex_appf[:12]))
    if ex_lem:  print('     bon lemme, mauv. flex.:', ' | '.join(ex_lem[:8]))
    print()
    print('  -- ACCENTS, comptes STRICTEMENT (tout le reste de cette sonde DESACCENTUE : « mere » ≡ « mère » pour lui) --')
    print('     · fautes d ACCENT SEUL (invisibles ci-dessus) : %4d   dont REPAREES : %4d  (%.1f %%)'
          % (acc_faux, acc_rep, 100.0 * acc_rep / max(1, acc_faux)))
    print('     · (!) ACCENTS CASSES sur des mots justes       : %4d   (invisibles dans « CASSES » ci-dessous — de vraies casses du produit)' % acc_casse)
    if ex_acc_rep: print('     exemples reparees :', ' | '.join(ex_acc_rep[:10]))
    for _x in ex_acc_casse: print('         ', _x)
    if _dump is not None:
        import json as _j
        _io.open(_os.environ['DUMP_MUETS'], 'w', encoding='utf-8').write(_j.dumps(_dump, ensure_ascii=False))
        print('     (dump des muets ecrit : %d)' % len(_dump))
    print('  mots JUSTES au départ : %d' % juste)
    print('     · intacts  : %4d   (%.2f %%)' % (intact, 100.0 * intact / max(1, juste)))
    print('     · ⛔ CASSÉS : %3d   (%.2f %%)              ← LA métrique' % (casse, 100.0 * casse / max(1, juste)))
    if ex_rep:
        print('\n  échantillon de réparations :')
        for x in ex_rep:
            print('     ✓ %s' % x)
    if ex_casse:
        print('\n  mots CASSÉS (à traiter un par un) :')
        for x in ex_casse:
            print('     ✗ %s' % x)
    print('')


if __name__ == '__main__':
    main()
