# -*- coding: utf-8 -*-
u"""OÙ LE CORRECTEUR EST-IL FAIBLE ? — le générateur mis au travail.

À QUOI SERT UN GÉNÉRATEUR, CONCRÈTEMENT. Pas à gonfler un chiffre : à poser la MÊME famille de
faute des centaines de fois sur des phrases variées, et à regarder laquelle passe au travers. Les
6 dictées appariées ne le permettent pas — 67 fautes réparties sur 11 catégories, c'est 6 cas par
famille, trop peu pour décider quoi construire ensuite.

DEUX PRÉCAUTIONS DE MÉTHODE, sinon la mesure ne vaut rien :
 1. LE TEXTE SOURCE VIENT D'AILLEURS. On génère sur UD French GSD (français correct, externe), pas
    sur les 6 dictées : sinon on mesurerait le correcteur sur le vocabulaire qui a servi à calibrer
    le générateur, et on retomberait dans la circularité qu'on cherche à éviter.
 2. UNE SEULE FAUTE PAR PHRASE, et sa catégorie voyage dans le champ `src`. C'est ce qui permet
    d'attribuer sans ambiguïté chaque raté à une famille — avec plusieurs fautes par phrase, on ne
    sait pas laquelle le correcteur a manquée.

⚠️ CE QUE CETTE MESURE NE DIT PAS.
 · Le générateur reproduit la DIFFICULTÉ du réel (47 % traité contre 51 %, cf. `dys_gen.py`) mais
   pas sa composition rouge/orange. Un classement issu d'ici est une PISTE, pas un verdict.
 · ⚠️ LA FAMILLE « accord » EST SUR-PÉNALISÉE et il faut le dire. Retirer un « s » à un mot produit
   souvent une forme qui reste GRAMMATICALE dans un autre contexte ; le correcteur s'abstient à
   raison, mais le gold étant l'original, on le compte « raté ». Le 32,7 % est donc un PLANCHER.
   La conclusion tient quand même : elle va dans le même sens que le mur du sujet déjà mesuré.

RÉSULTAT (1 600 phrases, 200 par famille, graine 20260807) :
    accord 32,7 % · terminaison 42,0 % · lettre manquante 52,0 % · autre 55,0 %
    accent 62,5 % · lettre changée 69,5 % · inversion 73,5 % · lettre en trop 74,0 %
  ⭐ LES DEUX FAMILLES LES PLUS FAIBLES SONT CELLES QUI DOMINENT LE RÉEL : accord (13,4 % des
    fautes dys) et terminaison verbale (11,9 %) pèsent un quart de ce qu'écrit un dys, et ce sont
    exactement celles que le correcteur traite le moins bien. Les fautes de LETTRES, elles, sont
    bien couvertes (70-74 %). Le rappel ne se gagnera pas sur l'orthographe mais sur la GRAMMAIRE.

  python dictee/dys_gen_faiblesses.py [n_par_categorie]
"""
import os, sys, io, re, json, random, subprocess
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from dys_gen import (charge_lex, GRAINE, BRIQUES, OUTILS, APO)
from dys_reel_probe import toks

UD = os.path.join(ROOT, 'data_local', 'ud_fr_gsd-train.conllu')
DST = os.path.join(ROOT, 'data_local', 'dys_reel', 'faiblesses.jsonl')


def phrases_ud(n, rng):
    u"""Phrases FR correctes, source externe au corpus de calibration."""
    if not os.path.exists(UD):
        return []
    out = []
    for l in io.open(UD, encoding='utf-8'):
        if l.startswith(u'# text = '):
            t = l[9:].strip()
            if 40 <= len(t) <= 160 and u'"' not in t:
                out.append(t)
    rng.shuffle(out)
    return out[:n]


def une_faute(texte, fn, rng, lex):
    u"""Pose UNE faute de la brique `fn`. Renvoie (texte fautif, mot avant, mot après) ou None."""
    mor = re.split(u'(\\W+)', APO.sub(u"'", texte))
    idx = [i for i, m in enumerate(mor) if i % 2 == 0 and len(m) >= 3 and m.isalpha()]
    rng.shuffle(idx)
    for i in idx:
        w = mor[i]
        out = fn(w.lower(), rng, lex)
        if out and out != w.lower():
            avant = mor[i]
            mor[i] = (out[0].upper() + out[1:]) if w[0].isupper() else out
            return u''.join(mor), avant, mor[i]
    return None


if __name__ == '__main__':
    n_cat = int(sys.argv[1]) if len(sys.argv) > 1 else 200
    lex = charge_lex()
    rng = random.Random(GRAINE)
    src = phrases_ud(6000, rng)
    if not src:
        print(u'(UD French GSD absent de data_local — rien à mesurer)')
        sys.exit(0)

    lignes, k = [], 0
    for _, fn in BRIQUES:
        nom = fn.__name__.replace('f_', '')
        pose = 0
        while pose < n_cat and k < len(src):
            r = une_faute(src[k], fn, rng, lex)
            k += 1
            if r:
                lignes.append({'src': nom, 'raw': r[0], 'fixed': src[k - 1]})
                pose += 1
        if k >= len(src):
            k = 0
    io.open(DST, 'w', encoding='utf-8').write(
        u'\n'.join(json.dumps(l, ensure_ascii=False) for l in lignes) + u'\n')
    print(u'%d phrases (1 faute chacune, %d catégories) -> %s\n'
          % (len(lignes), len(BRIQUES), os.path.relpath(DST, ROOT).replace(os.sep, '/')))

    # --- on relance la sonde EXISTANTE plutôt que de réimplémenter le correcteur (§5) ---
    p = subprocess.Popen(['node', os.path.join(HERE, 'dys_corpus_probe.js'), DST],
                         stdout=subprocess.PIPE, stderr=subprocess.STDOUT, cwd=ROOT)
    sortie = p.communicate()[0].decode('utf-8', 'replace')

    stat = defaultdict(Counter)
    for l in sortie.split(u'\n'):
        m = re.match(u'^\\[([a-z_]+)\\] \\d+ fautes \\| (.*)$', l.strip())
        if not m:
            continue
        cat, corps = m.group(1), m.group(2)
        for tok in corps.split(u'  '):
            if not tok.strip():
                continue
            if u'=∅' in tok:
                stat[cat][u'raté'] += 1
            elif u'✅' in tok:
                stat[cat][u'rouge juste'] += 1
            elif u'🟠' in tok:
                stat[cat][u'orange'] += 1
            elif u'❌' in tok:
                stat[cat][u'dégrade'] += 1

    print(u'  %-18s %7s %7s %7s %7s   %s' % (u'famille', u'rouge', u'orange', u'raté', u'dégrade', u'TRAITÉ'))
    classement = []
    for cat in sorted(stat, key=lambda c: -stat[c][u'raté']):
        s = stat[cat]
        tot = sum(s.values())
        traite = 100.0 * (s[u'rouge juste'] + s[u'orange']) / max(1, tot)
        classement.append((traite, cat, s[u'raté'], tot))
        print(u'  %-18s %7d %7d %7d %7d   %5.1f %%'
              % (cat, s[u'rouge juste'], s[u'orange'], s[u'raté'], s[u'dégrade'], traite))
    if classement:
        classement.sort()
        print(u'\n  LES 3 FAMILLES LES PLUS FAIBLES (à confirmer sur du réel avant d\'y investir) :')
        for traite, cat, rate, tot in classement[:3]:
            print(u'    %-18s %5.1f %% traité   (%d ratés sur %d)' % (cat, traite, rate, tot))
