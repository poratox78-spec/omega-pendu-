# -*- coding: utf-8 -*-
"""PRÉNOMS + GENRE pour le correcteur — extracteur reproductible (demande de Rem, 2026-08-10).

POURQUOI. La machinerie d'accord fonctionne sur les noms communs mais est AVEUGLE sur les prénoms,
faute de connaître leur genre. Mesuré avec le moteur COMPLET (pas la seule couche speller) :

    « La fille est venu. »       -> venu→venue     ✓   (nom commun, genre connu)
    « La voiture est bleu. »     -> bleu→bleue     ✓
    « Le garçon est venue. »     -> venue→venu     ✓
    « Marie est venu. »          -> (RIEN)
    « Julie est parti. »         -> (RIEN)
    « ma soeur Julie est parti. »-> (RIEN)

Ce n'est donc pas la règle qui manque, c'est la DONNÉE. Critère de [[bases-genre-desaccentuees]] :
« pas le mot, la CAUSE de son absence » — ici la cause est une classe lexicale absente.

SOURCE : Wiktionnaire FRANÇAIS via kaikki.org (`data_local/fr/kaikki-frwikt.jsonl`), CC BY-SA =
notre licence. ⚠️ Le dump reste dans `data_local/` (gitignoré) ; SEULE la table extraite est commitée.

TROIS FILTRES, chacun motivé par une mesure :
  ① `pos=name` + tag `first-name` + initiale majuscule                    -> 9 274 prénoms vus
  ② genre NON AMBIGU : on écarte tout prénom dont UNE entrée porte à la fois `masculine` et
     `feminine` (« Prénom masculin ou féminin » : Claude, Camille, Alex, Dominique, Alix…).
     ⚠️ Quand les deux genres viennent d'entrées SÉPARÉES, on garde la PREMIÈRE (l'entrée
     française principale) : sans ça on perdait « Jean » (m. français / f. anglophone).
  ④ MOTS-OUTILS écartés (« Elle », attesté comme prénom mais pronom 99,9 % du temps) — voir _OUTILS.
  ③ ANTI-PIÈGE DU DÉBUT DE PHRASE : en tête de phrase tout mot est capitalisé, donc « Rose est
     belle » peut être la fleur. Mesuré : 518 prénoms ont un homographe nom commun, mais 413 ont
     le MÊME genre (rose f./Rose f., olivier m./Olivier m.) = sans danger. Restent **105 dont le
     genre CONTREDIT** celui du nom commun (Pierre m. / la pierre f., Ada, Alizé, Boris, Avril…).
     ⚠️ On ne les JETTE PAS — ça coûtait « Pierre », l'un des prénoms français les plus courants.
     On les MARQUE (3ᵉ colonne `1`) : le moteur ne doit s'en servir QUE si le token n'est pas en
     tête de phrase, où une majuscule ne prouve rien. Ailleurs, une majuscule EST un nom propre.

TABLE : `nom<TAB>genre<TAB>tete_de_phrase_interdite` (3ᵉ colonne 1 seulement pour les 105).

    Lancer :  PYTHONUTF8=1 python dictee/build_prenoms.py
    Vérifier :  ... --check     (échoue si la table livrée n'est plus celle que produit ce script)
"""
import io, os, re, sys, json, collections

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(HERE)
DUMP = os.path.join(RACINE, 'data_local', 'fr', 'kaikki-frwikt.jsonl')
COMMUNS = os.path.join(RACINE, 'data_local', 'genre_accentue.json')
SORTIE = os.path.join(HERE, 'prenoms_genre.tsv')
CHECK = '--check' in sys.argv


# ④ MOTS-OUTILS : le Wiktionnaire enregistre « Elle » comme prénom (rare, mais attesté). Capitalisé
# en tête de phrase, c'est le PRONOM 99,9 % du temps — mesuré : 67 occurrences sur 2 500 phrases UD,
# contre 0 emploi comme prénom. Le genre coïncide (f), donc le FP restait à 0, mais le parseur
# rendait un sujet NOMINAL là où le chemin sujet-PRONOM doit s'appliquer : une mine, pas un bug.
# On écarte donc les pronoms et mots grammaticaux, quoi qu'en dise la source.
_OUTILS = set("""Elle Il On Nous Vous Ils Elles Je Tu Moi Toi Lui Eux Soi Le La Les Un Une Des Du De
Ce Cet Cette Ces Se Sa Son Ses Ma Mon Mes Ta Ton Tes Notre Nos Votre Vos Leur Leurs Et Ou Ni Or Car
Mais Si Que Qui Quoi Dont Ne Pas Plus Rien Tout Tous Toute Bien Aussi Encore En Y A Au Aux Par Pour
Sur Sous Sans Dans Avec Chez Vers Entre Contre Depuis Avant Après Ici Là Oui Non""".split())


def deacc(w):
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFD', w) if unicodedata.category(c) != 'Mn')


def extrait():
    if not os.path.exists(DUMP):
        print('[FATAL] dump absent :', DUMP)
        print('        (data_local/ est gitignoré — récupérer kaikki.org/frwiktionary)')
        sys.exit(1)
    ordre = collections.defaultdict(list)
    for ligne in io.open(DUMP, encoding='utf-8', errors='ignore'):
        try:
            d = json.loads(ligne)
        except ValueError:
            continue
        if d.get('pos') != 'name':
            continue
        w = d.get('word') or ''
        t = set(d.get('tags') or [])
        if 'first-name' not in t or not w or not w[0].isupper():
            continue
        if w in _OUTILS:
            continue                                        # ④ pronom / mot grammatical : jamais un sujet-prénom
        if not re.match(r"^[A-ZÀ-Þ][A-Za-zÀ-ÿ'’-]{1,}$", w):
            continue                                        # écarte sigles, chiffres, formes exotiques
        if 'masculine' in t and 'feminine' in t:
            ordre[w].append('x')                            # ② une SEULE entrée bi-genre = ambigu
        elif 'masculine' in t:
            ordre[w].append('m')
        elif 'feminine' in t:
            ordre[w].append('f')
    vus = len(ordre)
    table = {w: v[0] for w, v in ordre.items() if v and v[0] in ('m', 'f') and 'x' not in v}
    ambigus = vus - len(table)

    # ③ anti-piège du début de phrase : on MARQUE, on ne jette pas
    conflits = set()
    if os.path.exists(COMMUNS):
        com = json.load(io.open(COMMUNS, encoding='utf-8'))
        for w in table:
            gc = com.get(w.lower())
            if gc in ('m', 'f') and gc != table[w]:
                conflits.add(w)
    return table, vus, ambigus, conflits


if __name__ == '__main__':
    table, vus, ambigus, conflits = extrait()
    lignes = ''.join('%s\t%s\t%d\n' % (w, table[w], 1 if w in conflits else 0) for w in sorted(table))
    nm = sum(1 for v in table.values() if v == 'm')
    nf = len(table) - nm

    if CHECK:
        actuel = io.open(SORTIE, encoding='utf-8').read() if os.path.exists(SORTIE) else None
        if actuel == lignes:
            print('  ✓ table des prénoms FRAÎCHE : %d prénoms (%d m / %d f, %d à majuscule ambiguë)'
                  % (len(table), nm, nf, len(conflits)))
            sys.exit(0)
        print('  ✗ TABLE DES PRÉNOMS PÉRIMÉE : dictee/prenoms_genre.tsv ≠ build_prenoms.py')
        print('    Corriger : PYTHONUTF8=1 python dictee/build_prenoms.py')
        sys.exit(1)

    io.open(SORTIE, 'w', encoding='utf-8', newline='\n').write(lignes)
    print('TABLE écrite : dictee/prenoms_genre.tsv')
    print('  prénoms vus (pos=name + first-name)   : %d' % vus)
    print('  ② écartés, genre ambigu               : %d  (Claude, Camille, Alex, Dominique…)' % ambigus)
    print('  ③ MARQUÉS « pas en tête de phrase »   : %d  (%s…)' % (len(conflits), ', '.join(sorted(conflits)[:6])))
    print('  RETENUS                               : %d  (%d masculins / %d féminins)' % (len(table), nm, nf))
