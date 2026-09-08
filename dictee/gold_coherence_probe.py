# -*- coding: utf-8 -*-
u"""LE GOLD PORTE-T-IL LUI-MÊME LA FAUTE QU'IL EST CENSÉ JUGER ?

Pourquoi ce fichier existe (08/09/2026). En traquant un « faux positif rouge » de la règle de personne,
la piste menait à 11 corrections comptées INUTILES sur `gold_frgec_norme` : « il soutiennent » → soutient,
« Elle aboutissent » → aboutit, « Il tiennent » → tient. Le produit avait raison à chaque fois. En lisant
les paires brutes, la cause est apparue : **le gold lui-même écrit « il soutiennent »** — ce corpus est
construit sur des phrases Wikipédia dont l'original porte déjà le désaccord, et la normalisation ne l'a
pas réparé. Un juge qui contient la faute qu'il juge transforme une correction JUSTE en « cassé ».

C'est le pendant mesuré de l'avertissement déjà écrit pour l'enquête « et » → « est » : *une part est du
gold sous-corrigé*. Ici on le CHIFFRE, par corpus et par famille, pour qu'on sache avant d'accuser le
moteur.

  python3 dictee/gold_coherence_probe.py           # tableau par corpus
  python3 dictee/gold_coherence_probe.py --check    # rouge si un gold dépasse son plancher ancré

Le plancher vit dans `dictee/gold_coherence_ref.json` : ce sont des corpus FIGÉS, leurs nombres ne
doivent pas bouger sans qu'on le sache (un corpus régénéré, une normalisation changée).
"""
import io
import json
import os
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

DATA = os.environ.get('OMEGA_DYS_DATA') or os.path.join(ROOT, 'data_local', 'dys_reel')
REF = os.path.join(HERE, 'gold_coherence_ref.json')
CORPUS = ['gold_claude.jsonl', 'dictees_gold.jsonl', 'faiblesses.jsonl', 'genere_gold.jsonl',
          'gold_ecriscol_norme.jsonl', 'gold_frgec_norme.jsonl']

SG_PRON = {'il', 'elle'}
PL_PRON = {'ils', 'elles'}
CLIT = {'ne', "n'", 'me', "m'", 'te', "t'", 'se', "s'", 'le', 'la', 'les', 'lui', 'leur', 'y', 'en', "l'"}


def dz(w):
    return ''.join(c for c in unicodedata.normalize('NFD', (w or '').lower()) if unicodedata.category(c) != 'Mn')


def _verbe_seul(reads, per, nb):
    """toutes les lectures de la forme sont cette personne+nombre — donc la forme n'est pas ambiguë"""
    return bool(reads) and all(r[2] == per and r[3] == nb for r in reads)


def familles(C, toks):
    """rend les familles de faute encore présentes dans CE texte (déjà corrigé, en principe)"""
    out = set()
    F = [dz(t) for t in toks]
    for i, w in enumerate(toks):
        if F[i] in SG_PRON or F[i] in PL_PRON:
            j, st = i + 1, 0
            while j < len(toks) and st < 3 and F[j] in CLIT:
                j += 1
                st += 1
            if j >= len(toks):
                continue
            r = C._reads(toks[j]) or []
            if F[i] in SG_PRON and _verbe_seul(r, '3', 'p'):
                out.add('pronom sg + verbe 3e pluriel')
            elif F[i] in PL_PRON and _verbe_seul(r, '3', 's'):
                out.add('pronom pl + verbe 3e singulier')
    return out


def main():
    check = '--check' in sys.argv
    if not os.path.isdir(DATA):
        print(u'· COHÉRENCE DU GOLD : SAUTÉ (corpus absent de data_local et OMEGA_DYS_DATA non posé — garde locale)')
        return 0
    import correcteur_probe as C   # noqa: E402  (lourd : seulement si on a des corpus)

    res = {}
    print(u'LE GOLD PORTE-T-IL LA FAUTE QU\'IL JUGE ?  (on lit le texte CORRIGÉ, pas la production)')
    print(u'  %-28s %8s   %s' % ('corpus', 'paires', 'golds portant encore la faute, par famille'))
    for g in CORPUS:
        p = os.path.join(DATA, g)
        if not os.path.exists(p):
            continue
        n = 0
        fam = {}
        for line in io.open(p, encoding='utf-8'):
            line = line.strip()
            if not line:
                continue
            try:
                o = json.loads(line)
            except Exception:
                continue
            fx = o.get('fixed')
            if not o.get('raw') or not fx:
                continue
            n += 1
            for f in familles(C, C.toks(fx)):
                fam[f] = fam.get(f, 0) + 1
        res[g] = {'paires': n, 'familles': fam}
        det = ' · '.join('%s : %d' % (k, v) for k, v in sorted(fam.items())) or u'aucune'
        print(u'  %-28s %8d   %s' % (g, n, det))

    total = sum(sum(v['familles'].values()) for v in res.values())
    print(u'\n  ⇒ %d gold(s) portent encore une faute de la famille qu\'ils servent à juger.' % total)
    if total:
        print(u'     Conséquence : sur CES phrases, une correction JUSTE du produit est comptée « cassée ».')
        print(u'     Ne pas conclure à un défaut du moteur sans avoir lu la paire brute.')

    if not check:
        io.open(REF, 'w', encoding='utf-8').write(json.dumps(res, ensure_ascii=False, indent=1) + '\n')
        print(u'\n  référence écrite : %s' % os.path.relpath(REF, ROOT))
        return 0

    if not os.path.exists(REF):
        print(u'\n✗ pas de référence ancrée — lancer la sonde sans --check une fois')
        return 1
    old = json.load(io.open(REF, encoding='utf-8'))
    bad = []
    for g, v in res.items():
        o = old.get(g)
        if not o:
            bad.append(u'%s : corpus NOUVEAU, non ancré' % g)
            continue
        for f, c in v['familles'].items():
            if c > (o['familles'].get(f, 0)):
                bad.append(u'%s : « %s » %d → %d (le gold s\'est DÉGRADÉ)' % (g, f, o['familles'].get(f, 0), c))
    if bad:
        print(u'\n✗ COHÉRENCE DU GOLD :')
        for b in bad:
            print(u'    ' + b)
        return 1
    print(u'\n✓ cohérence du gold : conforme à la référence ancrée.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
