# -*- coding: utf-8 -*-
u"""Nettoie gender_acc.json du bruit NON-accentué / NON-collision qui contredit GENDER_PURE/FULL —
EXACTEMENT le filtre déjà appliqué EN LIGNE par correcteur_probe.py (ajouté 2026-08-09, cf. son
commentaire : « ami »→f, « cas »→f, « fut »→f, « export »→f, « le »→f, sur 33 mots mesurés).

Ce filtre tourne déjà à CHAQUE chargement du moteur Python — il n'a donc AUCUN effet comportemental
(GENDER_ACC après filtre est identique, que la source soit sale-puis-filtrée ou propre). Mais laisser
le bruit dans le fichier committé est fragile : ça repose sur un filtre pour CACHER une erreur au lieu
de la corriger, et n'importe qui relisant gender_acc.json brut y voit « ami »→f sans repère. Ce script
BAKE le filtre dans la source, une fois, pour de bon.

  python3 dictee/clean_gender_acc_noise.py
"""
import os, sys, io, json, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(HERE, 'gender_acc.json')
sys.path.insert(0, HERE)


def deacc(s):
    s = s.replace(u'œ', u'oe').replace(u'æ', u'ae')
    return u''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


def main():
    import correcteur_probe as C   # charge GENDER_PURE / GENDER_FULL AVANT le filtre gender_acc (déjà fait au module-level)
    raw = json.load(open(PATH, encoding='utf-8'))

    part = {}
    for w in raw:
        part.setdefault(deacc(w.lower()), set()).add(w.lower())

    garde, jete = {}, []
    for w, g in raw.items():
        lw = w.lower()
        if not lw.isalpha():
            garde[w] = g   # locutions/nombres : hors-scope de ce filtre, inchangées
            continue
        d = deacc(lw)
        autre = C.GENDER_PURE.get(d)
        if autre not in ('m', 'f'):
            autre = C.GENDER_FULL.get(d)
        if autre in ('m', 'f') and autre != g and lw == d and len(part.get(d, ())) < 2:
            jete.append((w, g, autre))
            continue
        garde[w] = g

    print(f'{len(raw)} entrées brutes -> {len(garde)} gardées, {len(jete)} écartées (bruit sans accent ni collision, contredit la base)')
    for w, g, autre in sorted(jete)[:60]:
        print(f'  {w:20s} {g} (etait)  vs  {autre} (base)')
    if len(jete) > 60:
        print(f'  … +{len(jete) - 60}')

    json.dump(garde, io.open(PATH, 'w', encoding='utf-8'), ensure_ascii=False, sort_keys=True)
    print(f'\nécrit -> {os.path.relpath(PATH)}')


if __name__ == '__main__':
    main()
