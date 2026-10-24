# -*- coding: utf-8 -*-
u"""build_gender_acc_morphalou.py — le GENRE ACCENTUÉ (dictee/gender_acc.json) depuis ses trois sources : Wiktionnaire (kaikki), Lexique 4,
Morphalou 3.1 (LA LISTE n° 144, 24/10/2026).

Jusqu'au 24/10, gender_acc.json était une fusion faite UNE fois à la main (#573, 24/08) à partir d'un script exploratoire resté dans
data_local/ (hors dépôt), puis purgée (clean_gender_acc_noise.py, #574) et retouchée (« gens », 12/09). Ce script est ce script-là,
versé au dépôt, avec ce que la reconstruction a demandé :
  · base Wiktionnaire + Lexique (= build_gender_acc.py) ; Morphalou n'AJOUTE que des mots absents de la base, jamais en arbitrage ;
    une source ambiguë sur un mot (le même mot en deux genres) l'écarte ; deux sources en désaccord aussi ;
  · garde « forme verbale conjuguée » : lue dans la table de conjugaison telle qu'elle était à la naissance de la fusion (avant la
    complétion Morphalou de la conjugaison) — dans la recette (dictee/tables_grammaire.py), cette étape tourne donc avant elle ;
  · doublon majuscule / minuscule (« Ami » sigle féminin, « ami ») : le mot écrit en minuscules l'emporte — la dernière valeur lue
    gagnait, dans l'ordre d'un set Python (le hasard, ligne 143) ;
  · « gens » masculin (accord postposé, voir build_gender_acc.py, 12/09).
Sortie = le DELTA par rapport au genre que le moteur donne déjà (GENDER_PURE : cgram_hf « gn » + cgram_gender_relaxed + noms en œ).
Puis : clean_gender_acc_noise.py.

  python3 dictee/build_gender_acc_morphalou.py      # Wiktionnaire, Morphalou (data_local) et Lexique 4 requis
"""
import os, sys, io, json, csv, unicodedata
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import conj_io, lots_dictionnaire
OUT = os.environ.get('GACC_SORTIE') or os.path.join(HERE, 'gender_acc.json')
KAIKKI = os.path.join(ROOT, 'data_local', 'fr', 'kaikki-fr.jsonl')
MORPH_CSV = os.path.join(ROOT, 'data_local', 'morphalou', 'Morphalou3.1_CSV.csv')


def deacc(s):
    s = s.replace(u'œ', u'oe').replace(u'æ', u'ae')
    return u''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


def source_kaikki():
    G, amb = {}, set()
    for l in io.open(KAIKKI, encoding='utf-8'):
        o = json.loads(l)
        if o.get('pos') != 'noun':
            continue
        for ht in (o.get('head_templates') or []):
            a = (ht.get('args') or {})
            g = a.get('1') if str(ht.get('name', '')).startswith('fr-noun') else a.get('g')   # deux gabarits (cf. build_gender_acc.py)
            if g not in ('m', 'f'):
                continue
            w = o['word']
            if w in G and G[w] != g:
                amb.add(w)
            G[w] = g
    return G, amb


def source_lexique4():
    G, amb = {}, set()
    with lots_dictionnaire.ouvrir(os.environ.get('GACC_LEX4') or lots_dictionnaire.lexique()) as f:
        f.readline()
        for l in f:
            p = l.rstrip(u'\n').split(u'\t')
            if len(p) < 8 or p[4] != 'NOM':
                continue
            w, g = p[0], p[6]
            if g not in ('m', 'f'):
                amb.add(w)
                continue
            if w in G and G[w] != g:
                amb.add(w)
            G[w] = g
    return G, amb


def source_morphalou():
    u"""Genre strictement m/f, catégorie « Nom commun » ; une graphie à genres différents (vrai homographe : « tour ») est ambiguë."""
    G, amb = {}, set()
    MAP = {'masculine': 'm', 'feminine': 'f'}
    with open(MORPH_CSV, encoding='utf-8', newline='') as f:
        for _ in range(14): f.readline()
        r = csv.reader(f, delimiter=';')
        next(r); next(r)
        for row in r:
            if len(row) < 9: continue
            l_graphie, l_cat, l_genre = row[0], row[2], row[5]
            if not l_graphie or l_cat != 'Nom commun': continue
            g = MAP.get(l_genre)
            if not g: continue
            if l_graphie in G and G[l_graphie] != g:
                amb.add(l_graphie)
            G[l_graphie] = g
    return G, amb


def fusion2(K, Ka, L, La):
    u"""L'algorithme de build_gender_acc.py (Wiktionnaire + Lexique seuls)."""
    G, rej = {}, {}
    for w in sorted(set(K) | set(L)):
        if w in Ka or w in La:
            rej['ambigu_intra_source'] = rej.get('ambigu_intra_source', 0) + 1
            continue
        a, b = K.get(w), L.get(w)
        if a and b and a != b:
            rej['desaccord_inter_source'] = rej.get('desaccord_inter_source', 0) + 1
            continue
        G[w] = a or b
    return G, rej


def fusion_morphalou_ajout(G_base, M, Ma, VERB_FORMS):
    u"""Morphalou ajoute UNIQUEMENT des mots absents de la base — jamais une décision déjà prise (« bohémien », « ami », « foret »
    changeaient de genre dans une fusion à trois sources à égalité, 24/08). Un mot ajouté n'a aucune validation croisée : la garde
    « forme verbale conjuguée » s'applique à tous."""
    G_base_low = {w.lower() for w in G_base}
    ajout, rej = {}, {}
    for w, g in M.items():
        wl = w.lower()
        if wl in G_base_low:
            continue
        if w in Ma:
            rej['ambigu_intra_morphalou'] = rej.get('ambigu_intra_morphalou', 0) + 1
            continue
        if len(w) <= 2:
            rej['mot_court'] = rej.get('mot_court', 0) + 1
            continue
        if deacc(wl) in VERB_FORMS:
            rej['forme_verbale_conjuguee'] = rej.get('forme_verbale_conjuguee', 0) + 1
            continue
        ajout[w] = g
    return ajout, rej


def delta(G, GP):
    u"""Une entrée par clé en minuscules (le mot écrit en minuscules l'emporte sur sa forme à majuscule) ; seules les entrées où la
    table des noms se tait ou se trompe."""
    low = {}
    for w in sorted(G, key=lambda w: (w.lower(), w != w.lower(), w)):
        low.setdefault(w.lower(), G[w])
    return {w: g for w, g in low.items() if GP.get(deacc(w)) != g}


def main():
    for p in (KAIKKI, MORPH_CSV):
        if not os.path.exists(p): print('✗ source absente : %s' % p); return 1
    VERB_FORMS = set(conj_io.charger(os.path.join(HERE, 'cgram_conj.json'))['f'])
    K, Ka = source_kaikki(); L, La = source_lexique4(); M, Ma = source_morphalou()
    G2, rej2 = fusion2(K, Ka, L, La)
    ajout, rej_m = fusion_morphalou_ajout(G2, M, Ma, VERB_FORMS)
    G = dict(G2); G.update(ajout)
    import correcteur_probe                       # le genre que le moteur donne déjà : « gn » + cgram_gender_relaxed + noms en œ (GENDER_PURE)
    GP = correcteur_probe.GENDER_PURE
    d = delta(G, GP)
    d['gens'] = 'm'                                   # accord postposé (« les gens touchés ») — voir build_gender_acc.py, 12/09/2026
    json.dump(d, io.open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, sort_keys=True)
    print('Wiktionnaire %d · Lexique %d · Morphalou %d → base %d + ajout Morphalou %d → %d entrées (delta) → %s'
          % (len(K), len(L), len(M), len(G2), len(ajout), len(d), os.path.relpath(OUT, ROOT).replace(os.sep, '/')))
    print('   écartés : ' + ' · '.join('%s %d' % kv for kv in sorted(list(rej2.items()) + list(rej_m.items()))))
    return 0


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
    sys.exit(main())
