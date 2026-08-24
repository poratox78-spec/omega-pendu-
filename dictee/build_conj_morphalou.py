# -*- coding: utf-8 -*-
u"""Complète cgram_conj.json (accord SUJET-VERBE, dictee/correcteur_probe.py:1683) avec des LEMMES
verbaux ENTIÈREMENT ABSENTS de Lexique4, via Morphalou 3.1 — EN AJOUT PUR, jamais en arbitrage.

⚠️ SCOPE VOLONTAIREMENT ÉTROIT (rester dans le compatible, cf. build_cgram.py) : on n'ajoute QUE des
LEMMES neufs, jamais de formes supplémentaires à un verbe déjà connu — la désambiguïsation 3e pers.
-ent/-ont (cj_x → promotion 3s/3p par longueur, régularisation 3pl, composés→base) est une machinerie
fine, mesurée, qu'on ne réplique pas ici. Un verbe déjà dans CONJ_C garde EXACTEMENT ses formes.

MÊME FORMAT que build_cgram.py, pour rester lisible par correcteur_probe.py SANS MODIFICATION :
  · cj_f : forme_déacc -> {"lemme;mode:temps;pers;nombre", …} (lectures finies, joint par '|')
  · cj_c : lemme -> mode:temps -> slot("3s") -> forme_accentuée (UNE SEULE, pas de tuple freq/spec —
    un lemme NEUF n'a qu'une source, pas de concurrence entre candidats à arbitrer)
  · MODES gardés : ind:pre/imp/fut, cnd:pre, sub:pre (identique à build_cgram.py — le passé simple
    ind:pas n'est PAS repris ici : sa garde "PURE_PS non-homographe" est un filtre supplémentaire
    qu'on ne réplique pas, mieux vaut l'absence qu'une mauvaise garde).
  · NOMBRE en 1re/2e pers. : dérivé MORPHOLOGIQUEMENT (derive_number, importé de build_cgram.py,
    JAMAIS réimplémenté) — même défiance envers la colonne NOMBRE brute que l'original.
  · 3e pers. finissant en -ent/-ont : ABSTENTION (ambiguë 3sg/3pl sans la machinerie de résolution) —
    FP=0 par construction, au prix d'un paradigme légèrement incomplet pour ces verbes neufs.
  · Filtre fréquence (demandé) : le lemme doit avoir une fréquence Lexique4 RÉELLE (infinitif) — un
    verbe absent même de Lexique4 est trop incertain pour qu'on lui fasse confiance ici.

  python3 dictee/build_conj_morphalou.py
"""
import os, sys, io, json, csv, lzma

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MORPH_CSV = os.path.join(ROOT, 'data_local', 'morphalou', 'Morphalou3.1_CSV.csv')
CONJ_PATH = os.path.join(HERE, 'cgram_conj.json')
OUT = os.path.join(HERE, 'conj_morphalou.json')
FREQ_MIN = 0.05

sys.path.insert(0, HERE)
from build_cgram import derive_number, PART_END   # RÉUTILISE la logique existante, ne la reproduit pas

try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass


def deacc(s):
    import unicodedata
    s = s.replace('œ', 'oe').replace('æ', 'ae')
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


MODE_MAP = {
    ('indicative', 'present'): 'ind:pre', ('indicative', 'future'): 'ind:fut',
    ('indicative', 'imperfect'): 'ind:imp', ('conditional', 'present'): 'cnd:pre',
    ('subjunctive', 'present'): 'sub:pre',
}
PERS_MAP = {'firstPerson': '1', 'secondPerson': '2', 'thirdPerson': '3'}


def load_lex4_freq():
    u"""Fréquence VERBALE uniquement (ligne CGRAM=VER/AUX) — pas la fréquence toutes catégories
    confondues : « avenir » (verbe rare, archaïque) partage sa clé avec « l'avenir » (nom, freq 60+),
    et confondre les deux aurait fait passer le filtre à un verbe qui ne le mérite pas."""
    p = os.path.join(ROOT, 'Lexique4.tsv.xz')
    F = {}
    f = lzma.open(p, 'rt', encoding='utf-8')
    H = f.readline().rstrip('\n').split('\t')
    ci = {h.split('_', 1)[1].lower() if '_' in h else h.lower(): i for i, h in enumerate(H)}
    cm, cf, cg = ci['mot'], ci['freqortho'], ci['cgram']
    for l in f:
        p2 = l.rstrip('\n').split('\t')
        if len(p2) <= max(cm, cf, cg): continue
        if not p2[cg].strip().startswith(('VER', 'AUX')):
            continue
        w = p2[cm].strip().lower()
        try: fr = float((p2[cf] or '0').replace(',', '.'))
        except ValueError: fr = 0.0
        if fr > F.get(w, -1): F[w] = fr
    return F, {}


def main():
    conj = json.load(open(CONJ_PATH, encoding='utf-8'))
    CONJ_F, CONJ_C = conj['f'], conj['c']              # lecture SEULE (collision/membership) — jamais mutés
    NEW_F, NEW_C = {}, {}                               # ce qui sera écrit dans conj_morphalou.json — l'AJOUT seul
    print(f'cgram_conj.json actuel : {len(CONJ_F)} formes / {len(CONJ_C)} lemmes')

    LEX4_FREQ, LEX4_CG = load_lex4_freq()

    # 1) collecte par LEMME (déaccentué) toutes les flexions verbales utiles de Morphalou
    par_lemme = {}   # lem_deacc -> [(mode_temps, pers, nombre, forme_accentuee)]
    lemme_infinitif_acc = {}  # lem_deacc -> infinitif accentué (pour la fréquence Lexique4)
    with open(MORPH_CSV, encoding='utf-8', newline='') as f:
        for _ in range(14): f.readline()
        r = csv.reader(f, delimiter=';')
        next(r); next(r)
        cur_lemme_graphie = None
        for row in r:
            if len(row) < 18: continue
            l_graphie, l_cat = row[0], row[2]
            f_graphie, f_nombre, f_mode, f_temps, f_pers = row[9], row[11], row[12], row[14], row[15]
            if l_graphie:
                cur_lemme_graphie = l_graphie if l_cat == 'Verbe' else None
            if not cur_lemme_graphie or not f_graphie:
                continue
            if '-' in f_graphie or ' ' in f_graphie:
                continue   # composé (sous-entendre, entre-tuer, petit-déjeuner…) : le tokeniseur du
                           # correcteur COUPE sur le trait d'union/espace ('sous-entendent' devient
                           # ['sous','entendent']) — la clé désaccentuée composée n'est JAMAIS atteinte
                           # en pratique (vérifié : « il sous-entendent » ne déclenche rien). Inclure ces
                           # entrées serait du poids mort, pas un ajout — écarté.
            # Morphalou nomme les verbes pronominaux avec le pronom collé ("s'enfuir", "se blottir") ;
            # Lexique4/cgram_conj.json ne le fait JAMAIS (0 lemme préfixé mesuré) — les 47 "nouveaux"
            # lemmes du premier essai étaient TOUS déjà connus sous leur forme nue (enfuir, blottir…).
            # On dépouille le préfixe pour comparer sur la MÊME convention.
            lg = cur_lemme_graphie
            if lg.lower().startswith("s'"): lg = lg[2:]
            elif lg.lower().startswith('se '): lg = lg[3:]
            lem = deacc(lg.lower())
            if f_mode == 'infinitive':                        # capturé AVANT le filtre de mode fini (sinon jamais atteint)
                fg = f_graphie
                if fg.lower().startswith("s'"): fg = fg[2:]
                elif fg.lower().startswith('se '): fg = fg[3:]
                lemme_infinitif_acc.setdefault(lem, fg)       # infinitif NU (même convention Lexique4) pour la fréquence
                continue
            mt = MODE_MAP.get((f_mode, f_temps))
            if not mt or f_pers not in PERS_MAP:
                continue
            form_lw = f_graphie.lower()
            if form_lw.endswith(PART_END):
                continue                                      # participe mal aligné → écarté (même garde que Lexique4)
            par_lemme.setdefault(lem, []).append((mt, PERS_MAP[f_pers], f_graphie))
    print(f'Morphalou : {len(par_lemme)} lemmes verbaux avec au moins une forme utile')

    # 2) ne garde que les lemmes NEUFS (absents de CONJ_C) ET à fréquence Lexique4 réelle
    nouveaux = 0; formes_ajoutees = 0; skip_freq = 0; skip_deja_connu = 0
    for lem, formes in par_lemme.items():
        if lem in CONJ_C:
            skip_deja_connu += 1
            continue                                          # lemme DÉJÀ connu : on n'y touche pas (scope étroit)
        inf = lemme_infinitif_acc.get(lem, lem)
        fr = LEX4_FREQ.get(inf.lower(), 0.0)
        if fr < FREQ_MIN:
            skip_freq += 1
            continue                                          # filtre fréquence demandé : lemme incertain, écarté
        slots = {}
        for mt, per, forme in formes:
            form_lw = forme.lower()
            nn = derive_number(form_lw, per)                  # RÉUTILISE build_cgram.derive_number, pas de réimplémentation
            if nn == 'x':
                continue                                       # 3e pers. -ent/-ont ambiguë → abstention (pas de machinerie de promotion ici)
            slot = per + nn
            d = slots.setdefault(mt, {})
            if slot not in d:                                  # 1re occurrence gagne (pas de tri freq/spécificité : source unique)
                d[slot] = forme
                key = deacc(form_lw)
                reading = f'{lem};{mt};{per};{nn}'
                # UNION des lectures : une forme neuve peut, par coïncidence, partager sa clé désaccentuée
                # avec un verbe DÉJÀ connu (design même que Lexique4 : plusieurs lemmes, une clé). On lit
                # CONJ_F (existant, intact) pour ne pas dupliquer une lecture déjà présente, mais on
                # n'ÉCRIT que dans NEW_F — jamais dans CONJ_F lui-même.
                deja = (CONJ_F.get(key, '') + '|' + NEW_F.get(key, '')).split('|')
                if reading not in deja:
                    cur_new = NEW_F.get(key, '')
                    lus = cur_new.split('|') if cur_new else []
                    lus.append(reading)
                    NEW_F[key] = '|'.join(lus)
                formes_ajoutees += 1
        if slots:
            NEW_C[lem] = slots
            nouveaux += 1

    print(f'lemmes déjà connus (non touchés) : {skip_deja_connu} · écartés (fréquence < {FREQ_MIN}) : {skip_freq}')
    print(f'NOUVEAUX lemmes ajoutés : {nouveaux} · formes ajoutées : {formes_ajoutees} · formes neuves (clés désacc.) : {len(NEW_F)}')

    json.dump({'f': NEW_F, 'c': NEW_C}, io.open(OUT, 'w', encoding='utf-8', newline=''),
               ensure_ascii=False, separators=(',', ':'))
    print(f'écrit -> {os.path.relpath(OUT, ROOT).replace(os.sep, "/")} (AJOUT SEUL, {len(NEW_C)} lemmes)')

    for lem in sorted(NEW_C.keys())[:15]:
        print(f'   {lem:15s} inf={lemme_infinitif_acc.get(lem,"?"):15s} freq={LEX4_FREQ.get(lemme_infinitif_acc.get(lem,lem).lower(),0):.2f}  {NEW_C[lem]}')


if __name__ == '__main__':
    main()
