# -*- coding: utf-8 -*-
u"""GENRE ACCENTUÉ — réparer la perte d'accent de la chaîne cgram, en DELTA.

LE PROBLÈME, MESURÉ LE 2026-08-07. `build_cgram.py` DÉSACCENTUE à l'écriture
(`w = deacc(row[c_mot])`). Toutes nos tables de genre livrées sont donc désaccentuées :
cgram_gender (53 200), cgram_gender_relaxed (46 531), gdet-lex-gz (46 431). Conséquence : `règle`
(nom f) et `réglé` (adjectif) partagent la clé `regle` ; le filtre « pas d'adjectif » élimine alors
le NOM, et le genre disparaît. Idem `marche`/`marché`, dont les genres sont OPPOSÉS (f / m).
⚠️ Les accents remis en 2026 l'ont été sur le LEXIQUE DU SPELLER et la tokenisation — une autre
chaîne. Celle-ci n'a jamais été traitée.

POURQUOI UN DELTA ET PAS UNE TABLE COMPLÈTE. Une table accentuée complète ferait ~97 k entrées
alors que la table désaccentuée existante répond DÉJÀ juste dans l'immense majorité des cas. On ne
livre donc que ce qu'elle RATE ou ce sur quoi elle TROMPE. Le reste continue de passer par elle :
aucune perte possible, et l'asset reste petit.

LES SOURCES SONT LES NÔTRES D'ABORD (remarque de Rem, vérifiée) :
  · `data_local/fr/kaikki-fr.jsonl` — NOTRE dump Wiktionnaire : 89 256 noms accentués à genre.
    ⚠️ Le genre est sous `head_templates[].args['1']`, PAS dans `tags`.
  · `Lexique4.tsv.xz` — 57 251, moins riche, MAIS il porte un signal que kaikki n'a pas :
    le genre `e` (ÉPICÈNE) explicite.
⚠️ NE JAMAIS PRENDRE KAIKKI SEUL : 8 204 désaccords mesurés sur les 38 405 mots communs.
Exemple : `livre` -> kaikki dit `f`, Lexique4 le marque épicène (le livre / la livre). Un mot à
deux genres ne peut pas trancher un accord -> il DOIT être écarté, pas arbitré.

  python dictee/build_gender_acc.py        # écrit dictee/gender_acc.json (le DELTA)
"""
import os, sys, io, json, lzma, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, 'gender_acc.json')
KAIKKI = os.path.join(ROOT, 'data_local', 'fr', 'kaikki-fr.jsonl')
LEX4 = os.path.join(ROOT, 'Lexique4.tsv.xz')


def deacc(s):
    s = s.replace(u'œ', u'oe').replace(u'æ', u'ae')
    return u''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


def source_kaikki():
    G, amb = {}, set()
    if not os.path.exists(KAIKKI):
        return G, amb
    for l in io.open(KAIKKI, encoding='utf-8'):
        o = json.loads(l)
        if o.get('pos') != 'noun':
            continue
        for ht in (o.get('head_templates') or []):
            # ⚠️ DEUX GABARITS, DEUX EMPLACEMENTS DU GENRE — le confondre empoisonne la table.
            #   `fr-noun`  -> le genre est args['1']            (« règle » : {"1": "f"})
            #   `head`     -> le genre est args['g'], et args['1'] vaut « fr », LE CODE DE LANGUE
            #                 (« étiages » : {"1": "fr", "2": "noun form", "g": "m"})
            # Première version : on lisait args['1'] avec un `startswith('f')` -> « fr » était pris
            # pour un féminin, et 17 001 formes PLURIELLES devenaient féminines. Le scan UD l'a
            # attrapé sur « des étiages estivaux »->estivales et « les trésors nationaux »->nationales.
            # D'où la comparaison EXACTE ci-dessous, jamais un préfixe.
            a = (ht.get('args') or {})
            g = a.get('1') if str(ht.get('name', '')).startswith('fr-noun') else a.get('g')
            if g not in ('m', 'f'):
                continue                      # 'mf', vide, ou autre -> ambigu/inconnu, on passe
            w = o['word']
            if w in G and G[w] != g:
                amb.add(w)
            G[w] = g
    return G, amb


def source_lexique4():
    G, amb = {}, set()
    if not os.path.exists(LEX4):
        return G, amb
    f = lzma.open(LEX4, 'rt', encoding='utf-8')
    f.readline()
    for l in f:
        p = l.rstrip(u'\n').split(u'\t')
        if len(p) < 8 or p[4] != 'NOM':
            continue
        w, g = p[0], p[6]
        if g not in ('m', 'f'):
            amb.add(w)                      # 'e' = ÉPICÈNE : ambiguïté EXPLICITE, on la garde
            continue
        if w in G and G[w] != g:
            amb.add(w)
        G[w] = g
    return G, amb


def fusion():
    K, Ka = source_kaikki()
    L, La = source_lexique4()
    G, rej = {}, {}
    for w in set(K) | set(L):
        if w in Ka or w in La:
            rej['ambigu'] = rej.get('ambigu', 0) + 1
            continue
        a, b = K.get(w), L.get(w)
        if a and b and a != b:
            rej['desaccord'] = rej.get('desaccord', 0) + 1
            continue
        G[w] = a or b
    return G, K, L, rej


def table_actuelle():
    u"""Ce que le moteur répond AUJOURD'HUI (clé désaccentuée)."""
    sys.path.insert(0, HERE)
    import correcteur_probe as P
    return P.GENDER_PURE


if __name__ == '__main__':
    G, K, L, rej = fusion()
    if not G:
        print(u'(sources absentes — kaikki dans data_local/fr, Lexique4 à la racine)')
        sys.exit(0)
    GP = table_actuelle()

    delta, corrige, ajoute = {}, 0, 0
    for w, g in G.items():
        actuel = GP.get(deacc(w.lower()))
        if actuel == g:
            continue                        # déjà juste -> ne rien livrer, la table existante suffit
        if actuel in ('m', 'f'):
            corrige += 1                    # la table actuelle TROMPE sur ce mot
        else:
            ajoute += 1                     # la table actuelle ne SAIT pas
        delta[w.lower()] = g

    json.dump(delta, io.open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, sort_keys=True)
    print(u'kaikki %d · Lexique4 %d -> fusion %d noms accentués à genre net' % (len(K), len(L), len(G)))
    print(u'   écartés : %s' % (u' · '.join(u'%s %d' % (k, v) for k, v in sorted(rej.items()))))
    print(u'\nDELTA écrit -> %s' % os.path.relpath(OUT, ROOT).replace(os.sep, '/'))
    print(u'   %d entrées   (%d que la table actuelle IGNORE · %d sur lesquels elle SE TROMPE)'
          % (len(delta), ajoute, corrige))
    print(u'   poids brut : %.0f Ko' % (os.path.getsize(OUT) / 1024.0))
    for w in (u'règle', u'marche', u'marché', u'ferme', u'livre', u'table'):
        print(u'   %-8s delta=%-8s (table actuelle : %s)' % (w, delta.get(w, u'—'), GP.get(deacc(w), u'—')))
