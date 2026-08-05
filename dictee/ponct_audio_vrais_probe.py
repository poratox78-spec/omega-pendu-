# -*- coding: utf-8 -*-
"""LA ROUTE AUDIO, MESURÉE — et non plus deux falaises posées à la main.

CE QU'ON REMPLACE. La voie A décidait la marque de frontière ainsi :
    mk = sil >= 600 ? '.' : (sil >= 190 ? ',' : '')
Ces deux nombres viennent du tout premier commit de la saisie vocale (32ba743). `git log -S` le
confirme : ils n'ont JAMAIS été mesurés. Or on possède depuis le lit joint 93 clips où, pour
chaque interstice de mot, on connaît À LA FOIS la marque réelle ET le silence vu par
**exactement le détecteur du navigateur** (`sil_rms`, seuil borné par décile — pas la version
wav2vec2, qui n'existe pas dans Chrome).

CE QU'ON PRODUIT. Une VRAISEMBLANCE P(silence | marque) par tranche, pas une posterior.
⚠️ C'EST LA LEÇON DÉJÀ PAYÉE (note `asr-phon-route`, et re-payée sur l'arbitrage OS) : une
posterior est écrasée par le PRIOR — ici « rien » représente ~93 % des interstices, donc
P(marque | silence) est PIQUÉE SUR « RIEN » partout, y compris à 900 ms de pause. Un arbitre
qui pondère les routes par leur PIQUÉ prendrait ce piqué-là pour de la confiance et laisserait
l'audio écraser le texte en disant toujours « rien ». La vraisemblance, elle, dit ce que
l'audio SAIT : « une pause de 900 ms, ça ressemble à une fin de phrase ».

On rend donc, par tranche de silence, la distribution NORMALISÉE des vraisemblances
    L(c) = P(sil ∈ tranche | marque = c) ,   c ∈ {rien, virgule, point}
qui est, à un facteur près, la posterior sous prior UNIFORME — c'est-à-dire la contribution
propre de l'audio, débarrassée de ce que le texte sait déjà mieux que lui.
"""
import io, json, os, sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIT = os.path.join(RACINE, 'data_local', 'voix', 'lit_joint.jsonl')

# Tranches en millisecondes. Bornes CHOISIES SUR LA GRILLE DU DÉTECTEUR (pas rondes au hasard) :
# la fenêtre RMS avance de 30 ms, donc tout `sil_rms` est un multiple de 30. Des bornes à
# 0/30/90/180/300/450/600/900 tombent toutes sur la grille : aucune tranche n'est vide par
# construction, et aucune ne coupe un pas de quantification en deux.
BORNES = [0, 30, 90, 180, 300, 450, 600, 900, 10 ** 9]
CLASSES = ['', ',', '.']


def tranche(ms):
    for k in range(len(BORNES) - 1):
        if BORNES[k] <= ms < BORNES[k + 1]:
            return k
    return len(BORNES) - 2


def main():
    if not os.path.exists(LIT):
        print('lit joint absent :', LIT)
        return 1
    # compte[classe][tranche]
    compte = {c: [0] * (len(BORNES) - 1) for c in CLASSES}
    total = {c: 0 for c in CLASSES}
    n_clips = 0
    for ligne in io.open(LIT, encoding='utf-8'):
        ligne = ligne.strip()
        if not ligne:
            continue
        d = json.loads(ligne)
        sil = d.get('sil_rms') or []
        mq = d.get('marques') or []
        if len(sil) != len(mq):
            continue
        n_clips += 1
        # ⚠️ LE DERNIER INTERSTICE EST EXCLU : il porte le point final du clip, mais son silence
        # est celui de la FIN D'ENREGISTREMENT (0 ms partout dans le lit) — un artefact de
        # découpage, pas une pause de parole. L'y laisser apprendrait « point => 0 ms ».
        for i in range(len(sil) - 1):
            c = mq[i] if mq[i] in CLASSES else ('.' if mq[i] in ('!', '?', ';', ':') else '')
            compte[c][tranche(sil[i])] += 1
            total[c] += 1

    print('clips %d   ·   interstices : rien %d · virgule %d · point %d'
          % (n_clips, total[''], total[','], total['.']))
    print('PRIOR : rien %.1f %%  virgule %.1f %%  point %.1f %%'
          % tuple(100.0 * total[c] / max(1, sum(total.values())) for c in CLASSES))
    print()

    # Vraisemblance lissée (Laplace) : P(tranche | classe)
    tab = []
    for k in range(len(BORNES) - 1):
        L = []
        for c in CLASSES:
            L.append((compte[c][k] + 0.5) / (total[c] + 0.5 * (len(BORNES) - 1)))
        s = sum(L)
        tab.append([round(x / s, 4) for x in L])

    print('%-14s %7s %7s %7s   |  effectifs' % ('tranche (ms)', 'rien', 'virg', 'point'))
    for k in range(len(BORNES) - 1):
        hi = '+' if BORNES[k + 1] > 10 ** 8 else str(BORNES[k + 1])
        print('%-14s %7.3f %7.3f %7.3f   |  %5d %4d %4d'
              % ('%s-%s' % (BORNES[k], hi), tab[k][0], tab[k][1], tab[k][2],
                 compte[''][k], compte[','][k], compte['.'][k]))

    print()
    print('--- ce que disaient les DEUX FALAISES de la voie A, sur ces mêmes données ---')
    # Que fait la règle 190/600 ici ? On la mesure telle quelle.
    just = faux = manq = 0
    for ligne in io.open(LIT, encoding='utf-8'):
        ligne = ligne.strip()
        if not ligne:
            continue
        d = json.loads(ligne)
        sil, mq = d.get('sil_rms') or [], d.get('marques') or []
        if len(sil) != len(mq):
            continue
        for i in range(len(sil) - 1):
            vrai = mq[i] if mq[i] in CLASSES else ('.' if mq[i] in ('!', '?', ';', ':') else '')
            pred = '.' if sil[i] >= 600 else (',' if sil[i] >= 190 else '')
            if pred and pred == vrai:
                just += 1
            elif pred and pred != vrai:
                faux += 1
            elif not pred and vrai:
                manq += 1
    pose = just + faux
    print('  marques posées %d, dont JUSTES %d (%.1f %%)   ·   marques ratées %d'
          % (pose, just, 100.0 * just / max(1, pose), manq))
    print('  -> la règle 190/600 pose %d marques pour %d attendues : %.1fx TROP.'
          % (pose, just + manq, pose / max(1.0, float(just + manq))))

    # ─────────────────────────────────────────────────────────────────────────────────────────
    # LES DEUX AUTRES ROUTES QUI ÉTAIENT DES INTUITIONS, mesurées ici de la même façon.
    #
    # ① « GOOGLE A COUPÉ ICI ». La voie A finalise un segment sur une pause longue (~600 ms).
    # Cette coupure est donc une OBSERVATION sur la parole — et jusqu'ici on ne s'en servait pas
    # comme d'une preuve, mais comme d'une FRONTIÈRE D'ARCHITECTURE : à l'intérieur un code, aux
    # bords un autre, avec des seuils différents. La bonne question est : que vaut cette coupure ?
    # On la traduit par la vraisemblance du fait « silence ≥ 600 ms » — ce que la coupure affirme.
    # ⭐ C'est ça, faire parler la voie A et la voie B au même endroit : la segmentation de Google
    # devient une route parmi les autres, avec le poids que la mesure lui donne.
    #
    # ② L'HEURISTIQUE DE CONTINUATION (`CONT` : et/mais/ou/car/donc/qui/que/quand…). Elle servait
    # de repli sans micro : « le segment suivant commence par un mot de liaison => virgule, sinon
    # point ». Jamais mesurée. On la chiffre sur le même lit.
    import re as _re
    CONT = _re.compile(r"^(et|mais|ou|car|donc|ni|puis|alors|aussi|qui|que|qu|dont|quand|si|comme|parce|puisque|lorsque)$", _re.I)
    PASAPRES = set(("le la les un une des du de d au aux a en dans sur sous par pour avec sans chez "
                    "vers depuis pendant selon entre mon ma mes ton ta tes son sa ses notre nos "
                    "votre vos leur leurs ce cet cette ces chaque aucun aucune plusieurs quel "
                    "quelle quels quelles").split())
    COORD = _re.compile(r"^(et|ou|ni)$", _re.I)

    def bloc(cond):
        """vraisemblance normalisée P(cond | classe) — la contribution propre de l'indice."""
        c = {x: 0 for x in CLASSES}
        for ligne in io.open(LIT, encoding='utf-8'):
            ligne = ligne.strip()
            if not ligne:
                continue
            d = json.loads(ligne)
            sil, mq, mo = d.get('sil_rms') or [], d.get('marques') or [], d.get('mots') or []
            if len(sil) != len(mq) or len(mo) != len(mq):
                continue
            for i in range(len(sil) - 1):
                if not cond(sil, mo, i):
                    continue
                v = mq[i] if mq[i] in CLASSES else ('.' if mq[i] in ('!', '?', ';', ':') else '')
                c[v] += 1
        L = [(c[x] + 0.5) / (total[x] + 1.0) for x in CLASSES]
        s = sum(L)
        return [round(x / s, 4) for x in L], [c[x] for x in CLASSES]

    print()
    print('--- LES ROUTES NON-AUDIO, mesurees sur le meme lit ---')
    print('%-34s %7s %7s %7s   |  effectifs' % ('route', 'rien', 'virg', 'point'))
    routes = [
        ('coupe Google (sil >= 600 ms)', lambda s, m, i: s[i] >= 600),
        ('PAS de coupe (sil < 600 ms)', lambda s, m, i: s[i] < 600),
        ('CONT : suivant = mot de liaison', lambda s, m, i: i + 1 < len(m) and bool(CONT.match(m[i + 1]))),
        ('CONT : suivant ordinaire', lambda s, m, i: i + 1 < len(m) and not CONT.match(m[i + 1])),
        ('COORD : suivant = et/ou/ni', lambda s, m, i: i + 1 < len(m) and bool(COORD.match(m[i + 1]))),
        ('PASAPRES : courant = det/prep', lambda s, m, i: m[i].lower() in PASAPRES),
    ]
    dico = {}
    for nom, f in routes:
        L, c = bloc(f)
        dico[nom] = L
        print('%-34s %7.3f %7.3f %7.3f   |  %5d %4d %4d' % (nom, L[0], L[1], L[2], c[0], c[1], c[2]))

    sortie = os.path.join(RACINE, 'dictee', 'ponct_audio_vrais.json')
    io.open(sortie, 'w', encoding='utf-8').write(
        json.dumps({'bornes': BORNES[:-1], 'vrais': tab}, ensure_ascii=False))
    print('\necrit ->', sortie)
    return 0


if __name__ == '__main__':
    sys.exit(main())
