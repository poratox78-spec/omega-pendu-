# -*- coding: utf-8 -*-
"""LA SPIRALE DU NON-MOT — que devient un non-mot dans la pyramide, et la grammaire y gagne-t-elle ?

Question posée le 22/08/2026 : « c'est quoi un non-mot ? le reste-t-il ? et à quel moment ? si c'est
parce qu'il y a une faute d'orthographe dedans est-il considéré comme un non-mot, et s'il est corrigé
reste-t-il un non-mot ? c'est comme une spirale qui apporte du négatif ou du positif ? »

DÉFINITION opérationnelle (miroir exact du moteur, `spellUnknown`) : un non-mot est un token ABSENT du
lexique speller (211 491 formes, repli sans accents). C'est une définition LEXICALE, pas linguistique —
elle ne dit RIEN sur la justesse : « parties » (mauvaise réparation de « parvis ») est un mot valide, et
la faute dys la plus fréquente (ces/ses, a/à, é/er) ne produit JAMAIS de non-mot. Un mot n'est donc pas
un non-mot « parce qu'il a une faute » : il l'est parce qu'il est inconnu. Deux notions disjointes.

LE MOMENT où le statut change : la PYRAMIDE de `diagnoseAll` applique les suggestions ortho non-vigilance
au tableau de tokens AVANT que la grammaire ne le lise (`_Tc[f.i]=f.sugg`). Après cette ligne la grammaire
ne voit plus le non-mot — et ne sait pas que le mot qu'elle lit vient d'être fabriqué : la PROVENANCE est
effacée. C'est là que se joue la spirale.

CE QUE LA SONDE MESURE (corpus dys RÉEL, privé — SAUTÉE si absent, comme dys_precision_probe) :
  ① le recensement : combien de non-mots, et ce qu'ils deviennent (promu bien / promu MAL / laissé) ;
  ② la grammaire jugée contre le gold sur les tokens BRUTS vs sur les tokens NETTOYÉS par la pyramide ;
  ③ la précision des décisions de grammaire selon le VOISINAGE (±2) — c'est le résultat utile ;
  ④ le palier (rouge/orange) des décisions prises sur une ancre blanchie ;
  ⑤ --densite : compare le taux de fautes du GÉNÉRATEUR à celui du réel (calibrage de dys_gen.py).

RÉSULTAT (22/08/2026, 1 726 paires · 29 784 mots · 16,1 % de non-mots) :
  devenir : 16 % promus avec la BONNE graphie · 5 % avec la MAUVAISE · 78 % restent non-mots.
  grammaire : brut 88 % (236 justes) → nettoyé 86 % (248 justes). La pyramide GAGNE 12 justes (+5 % de
  rappel) et COÛTE 8 fausses : spirale POSITIVE en volume, légèrement négative en confiance.
  voisinage : propre 91 % · non-mot BIEN réparé 86 % · non-mot LAISSÉ TEL QUEL 85 % · le mot lui-même mal
  réparé 75 % · VOISIN mal réparé 55 %.
    ⇒ un non-mot laissé en l'état coûte 6 points ; MAL réparé il en coûte 36. SIX FOIS PIRE.
    Le poison n'est pas le non-mot, c'est la RÉPARATION FAUSSE : elle promeut l'erreur au rang de mot
    connu et lui fait hériter de la confiance pleine (« parvies »→parties, puis accord « parties »→partie).
  palier : ces décisions sont 25 justes / 10 fautives, TOUTES EN ROUGE. Les passer en orange retirerait
  10 erreurs confiantes au prix de 25 corrections à un clic — arbitrage, pas gain gratuit. Le sous-cas
  « VOISIN mal réparé » (55 %, pile ou face, confirmé à 52 % sur corpus généré) est le seul qui mérite
  l'orange sans discussion.

CE QUE ÇA APPREND SUR LE GÉNÉRATEUR (--densite) : dys_gen.py est bien calibré sur la NATURE des fautes
(62 % de non-mots contre 66 % en réel) mais en met ~2× TROP par phrase (13,1 % de mots fautifs contre
6,9 %). Second biais, indépendant du ×29 sur les déterminants (cf. rules_audit_probe --ancres).
⚠️ CORRECTION À PORTER : le « 77 % des FP ont un voisin abîmé » du 22/08 vient du corpus GÉNÉRÉ, où la
probabilité qu'un des 4 voisins soit abîmé vaut 43 % contre 25 % en réel — ce chiffre est SURESTIMÉ.

  python3 dictee/spirale_probe.py              # la spirale sur corpus dys réel
  python3 dictee/spirale_probe.py --densite    # calibrage du générateur vs réel
  OMEGA_DYS_DATA=/chemin/data_local/dys_reel python3 dictee/spirale_probe.py    # depuis un worktree
"""
import io
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import correcteur_probe as CP           # noqa: E402
import dys_precision_probe as DP        # noqa: E402
import speller_probe as S               # noqa: E402

SP = S.Speller()


def est_non_mot(w):
    """La définition du moteur, mot pour mot (`spellUnknown`) : absent du lexique speller."""
    return w.lower().replace('œ', 'oe').replace('æ', 'ae') not in SP.WORDS


def grammaire(T):
    """Chaque règle appelée sur les tokens fournis — sans la couche ortho, pour isoler son apport."""
    out = []
    for i in range(len(T)):
        for nm, rule in CP.RULES:
            try:
                d = rule(T, i)
            except Exception:
                continue
            if d is None:
                continue
            sg = d['sugg'] if isinstance(d, dict) else d
            if not isinstance(sg, str) or sg == T[i]:
                continue
            if nm != 'majuscule' and sg.lower() == T[i].lower():
                continue
            out.append((i, T[i], sg, nm))
            break
    return out


def densite():
    """Le générateur abîme-t-il le texte au même TAUX que la réalité ? (calibrage de dys_gen.py)"""
    import random
    import dys_gen
    for titre, flux in (('GÉNÉRÉ  ', 'gen'), ('DYS RÉEL', 'reel')):
        mots = nm = fautes = f_nm = 0
        if flux == 'gen':
            rng, lex, n = random.Random(20260822), dys_gen.charge_lex(), 0
            src = []
            for line in io.open(os.path.join(HERE, 'fp_scale_corpus.txt'), encoding='utf-8'):
                t = line.strip()
                if not t or len(t) < 25:
                    continue
                bad, k = dys_gen.genere(t, rng, lex)
                if not k:
                    continue
                n += 1
                if n > 1500:
                    break
                src.append((bad, t))
        else:
            src = [(b, g) for _fn, b, g in DP.pairs()]
        if not src:
            print('  %s : corpus absent → sauté.' % titre)
            continue
        for brut, gold in src:
            T = [x.group(0) for x in DP.TOK.finditer(brut)]
            al = DP.align(T, [x.group(0) for x in DP.TOK.finditer(gold)])
            for i, w in enumerate(T):
                if not w.isalpha():
                    continue
                mots += 1
                if est_non_mot(w):
                    nm += 1
                if i in al and not DP.eq(w, al[i]):
                    fautes += 1
                    if est_non_mot(w):
                        f_nm += 1
        print('  %s : %6d mots · %4.1f %% de non-mots · %4.1f %% de mots FAUTIFS · dont %.0f %% sont des non-mots'
              % (titre, mots, 100.0 * nm / mots, 100.0 * fautes / mots, 100.0 * f_nm / max(1, fautes)))
    print('\n  ⇒ nature des fautes bien calibrée, DENSITÉ ~2× trop forte (second biais de dys_gen.py).')


def main():
    if '--densite' in sys.argv:
        print('\nCALIBRAGE DU GÉNÉRATEUR — densité de fautes généré vs réel\n')
        densite()
        return
    cens = {'promu_juste': 0, 'promu_faux': 0, 'promu_inutile': 0, 'reste_nonmot': 0}
    stat = {'brut': [0, 0, 0], 'nettoye': [0, 0, 0]}
    apres = {'propre': [0, 0], 'promu_juste': [0, 0], 'reste_nonmot': [0, 0], 'promu_faux': [0, 0], 'soi_faux': [0, 0]}
    pal = {}
    mots = nonmots = n = 0
    for _fn, brut, gold in DP.pairs():
        if not brut.strip():
            continue
        n += 1
        CP._SEG = CP._seg_info(brut)
        T = CP.toks(brut)
        al = DP.align(T, [x.group(0) for x in DP.TOK.finditer(gold)])
        starts = {m.start(): i for i, m in enumerate(DP.TOK.finditer(brut))}
        # ① recensement + devenir de chaque non-mot
        sortie, corr = {}, {}
        for (st, w, sg, act) in SP.correct_text(brut):
            i = starts.get(st)
            if i is None or i >= len(T) or DP.norm(T[i]) != DP.norm(w):
                continue                      # tokenisations différentes (soudures) → on ne juge pas
            corr[i] = (sg, act)
            if act == 'vigilance' or not sg.isalpha():
                sortie[i] = 'reste_nonmot'
            elif i in al:
                sortie[i] = 'promu_juste' if DP.eq(sg, al[i]) else ('promu_inutile' if DP.eq(al[i], w) else 'promu_faux')
        for i, w in enumerate(T):
            if not w.isalpha():
                continue
            mots += 1
            if est_non_mot(w):
                nonmots += 1
                cens[sortie.get(i, 'reste_nonmot')] += 1
        # ② la grammaire, sur les tokens bruts PUIS sur ceux que la pyramide a nettoyés
        Tc = T[:]
        for i, (sg, act) in corr.items():
            if act != 'vigilance' and sg.isalpha():
                Tc[i] = sg
        for lbl, TT in (('brut', T), ('nettoye', Tc)):
            for (i, w, sg, nm) in grammaire(TT):
                if i not in al:
                    continue
                k = 0 if DP.eq(sg, al[i]) else (1 if DP.eq(al[i], T[i]) else 2)
                stat[lbl][k] += 1
                if lbl != 'nettoye':
                    continue
                # ③ la précision dépend-elle de la propreté du voisinage ?
                vois = [sortie.get(j, 'reste_nonmot' if (T[j].isalpha() and est_non_mot(T[j])) else None)
                        for j in range(max(0, i - 2), min(len(TT), i + 3))]
                if sortie.get(i) == 'promu_faux':
                    cat = 'soi_faux'
                elif 'promu_faux' in vois:
                    cat = 'promu_faux'
                elif 'reste_nonmot' in vois:
                    cat = 'reste_nonmot'
                elif 'promu_juste' in vois:
                    cat = 'promu_juste'
                else:
                    cat = 'propre'
                apres[cat][0 if k == 0 else 1] += 1
                if cat in ('promu_faux', 'soi_faux'):     # ④ ces décisions sont-elles rouges ou oranges ?
                    try:
                        tr = CP.tier_of(TT, i, nm, sg) or 'auto'
                    except Exception:
                        tr = '?'
                    key = (tr, 'juste' if k == 0 else 'fautive')
                    pal[key] = pal.get(key, 0) + 1
    if not n:
        print('spirale_probe : corpus dys local absent (data_local/dys_reel) → sonde SAUTÉE (pas un échec).')
        return
    print('\n%d paires dys réelles — %d mots, dont %d NON-MOTS (%.1f %%)\n' % (n, mots, nonmots, 100.0 * nonmots / max(1, mots)))
    print('  ① DEVENIR du non-mot dans la pyramide :')
    for k, lbl in (('promu_juste', 'promu MOT — bonne graphie'), ('promu_faux', 'promu MOT — MAUVAISE graphie'),
                   ('promu_inutile', 'promu MOT — il était déjà juste'), ('reste_nonmot', 'reste non-mot (orange / intouché)')):
        print('     %-38s %5d  (%2.0f %%)' % (lbl, cens[k], 100.0 * cens[k] / max(1, nonmots)))
    print('\n  ② LA GRAMMAIRE seule, jugée contre le gold :')
    for lbl in ('brut', 'nettoye'):
        j, u, f = stat[lbl]
        print('     tokens %-8s : juste %3d · inutile %3d · fausse %3d → précision %.0f %%' % (lbl, j, u, f, 100.0 * j / max(1, j + u + f)))
    print('\n  ③ PRÉCISION selon le VOISINAGE (±2) — le résultat utile :')
    for k, lbl in (('propre', 'aucun non-mot autour'), ('promu_juste', 'voisin non-mot BIEN réparé'),
                   ('reste_nonmot', 'non-mot laissé tel quel'), ('soi_faux', 'le mot LUI-MÊME mal réparé'),
                   ('promu_faux', 'VOISIN mal réparé')):
        a, b = apres[k]
        print('     %-30s %3d justes / %3d fautives → %3.0f %% justes' % (lbl, a, b, 100.0 * a / max(1, a + b)))
    print('\n  ④ PALIER ACTUEL des décisions prises sur une ancre BLANCHIE :')
    for key in sorted(pal):
        print('     %-11s %-8s %3d' % (key[0], key[1], pal[key]))
    print('\n  ⇒ le non-mot LAISSÉ coûte 6 points ; MAL RÉPARÉ il en coûte 36. Le poison est la réparation,')
    print("    pas le non-mot : elle promeut l'erreur au rang de mot connu, avec la confiance qui va avec.")


if __name__ == '__main__':
    main()
