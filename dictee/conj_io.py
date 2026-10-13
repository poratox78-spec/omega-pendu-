# -*- coding: utf-8 -*-
u"""conj_io.py — lecture / écriture de la table de conjugaison COMPACTE (13/10/2026, conjugaison 14).

La table complète (12 925 verbes, tous les temps) faisait 27 à 29 Mio par fichier : au-delà de la limite de 25 Mio par fichier de
Cloudflare Pages, le site ne se déployait plus. Or l'index des lectures `f` (forme désaccentuée → « lemme;temps;personne;nombre|… »,
16 Mio) se RECALCULE presque entièrement depuis la table `c` (lemme → temps → case → forme) : 372 733 entrées sur 385 916, ordre
compris. Le fichier ne garde donc que `c` et les ÉCARTS :
    fo : entrées de `f` qui diffèrent de la dérivation (valeur exacte, ordre compris) ;
    fd : clés que la dérivation produit mais que `f` n'a pas (lectures écartées exprès : nom plus probable, clé d'un mot non verbal
         plus fréquent, impératif, subjonctif imparfait sur une clé déjà prise…).
Recalcul (identique dans dys-core.js, l'app et ici — parité gardée par dictee/parity_corr.js) : pour chaque lemme, chaque temps sauf
l'impératif, chaque case, chaque forme : clé = forme en minuscules sans accents ; lecture « lemme;temps;p;n » ajoutée si absente ; puis
`fo` remplace, `fd` retire. Après chargement, `f` est le MÊME objet qu'avant, octet pour octet.

    charger(chemin)            → dict, avec `f` reconstruit (table seule, ou sous la clé `cj` pour cgram_hf.json / vdc-lex.json)
    serialiser(d), ecrire(chemin, d) → la forme compacte (même sérialisation que les anciens json.dump)
    compacter(cj) / deriver(cj)
"""
import io, json, unicodedata


def _deacc(t):
    return ''.join(ch for ch in unicodedata.normalize('NFD', t) if unicodedata.category(ch) != 'Mn')


def deriver(cj):
    u"""L'index `f` recalculé depuis `c` (sans `fo` / `fd`). Même résultat que la boucle naïve (chaîne « a|b », sans doublon,
    dans l'ordre de première rencontre) ; plus rapide : clé ASCII sans normalisation, listes jointes à la fin."""
    L = {}
    for lem, tps in (cj.get('c') or {}).items():
        for t, sl in tps.items():
            if t == 'imp:pre': continue
            for s, fo in sl.items():
                r = lem + ';' + t + ';' + s[0] + ';' + s[1]
                for f in (fo if isinstance(fo, list) else (fo,)):
                    if not f: continue
                    f = f.lower(); k = f if f.isascii() else _deacc(f)
                    old = L.get(k)
                    if old is None: L[k] = [r]
                    elif r not in old: old.append(r)
    return {k: '|'.join(v) for k, v in L.items()}


def reconstruire(cj):
    u"""Rend `cj` avec `f` (déjà là : inchangé ; sinon recalculé + écarts)."""
    if 'f' in cj or 'c' not in cj: return cj
    D = deriver(cj)
    for k, v in (cj.get('fo') or {}).items(): D[k] = v
    for k in (cj.get('fd') or []): D.pop(k, None)
    out = {'f': D}
    for k, v in cj.items():
        if k not in ('fo', 'fd'): out[k] = v
    return out


def compacter(cj):
    u"""Forme compacte de `cj` ({'f','c'} → {'c','fo','fd'}), vérifiée : reconstruire(compacter(cj))['f'] == cj['f']."""
    if 'f' not in cj: return cj
    F = cj['f']; D = deriver(cj)
    fo = {k: F[k] for k in sorted(F) if D.get(k) != F[k]}      # TRIÉ : relire puis réécrire redonne les mêmes octets (canonique)
    fd = sorted(k for k in D if k not in F)
    out = {}
    for k, v in cj.items():
        if k != 'f': out[k] = v
    out['fo'] = fo; out['fd'] = fd
    assert reconstruire(dict(out))['f'] == F, 'conj_io : la forme compacte ne redonne pas f'
    return out


def _cle(d):
    return 'cj' if 'cj' in d else None


def charger(chemin):
    d = json.load(io.open(chemin, encoding='utf-8'))
    k = _cle(d)
    if k: d[k] = reconstruire(d[k])
    else: d = reconstruire(d)
    return d


def serialiser(d, **kw):
    u"""Le texte compact (même sérialisation que les anciens json.dumps : ensure_ascii=False, séparateurs serrés)."""
    k = _cle(d)
    if k: d = dict(d); d[k] = compacter(d[k])
    else: d = compacter(d)
    kw.setdefault('ensure_ascii', False); kw.setdefault('separators', (',', ':'))
    return json.dumps(d, **kw)


def ecrire(chemin, d, **kw):
    io.open(chemin, 'w', encoding='utf-8', newline='').write(serialiser(d, **kw))
